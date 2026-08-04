// Pure rules engine: no DOM, no Firebase, no I/O. Every function here takes
// a state and returns a new state (or a derived value) — never mutates its
// input. That immutability is what lets sync.js push a whole state object to
// Firebase and lets the engine be exercised from plain Node test scripts.

export const TICKET_KINDS = ["taxi", "bus", "underground"];

export const DEFAULT_SETTINGS = {
  // How much movement pool each route type costs to use. Global -- a route
  // costs what it costs regardless of who's using it.
  movementCosts: { taxi: 0, bus: 2, underground: 5 },
  // Separate pools per side (like the old per-side ticket counts), each with
  // its own starting size, how much regenerates at the start of every one
  // of that side's turns, and an optional cap on how high it can build up.
  movementPools: {
    detective: { start: 20, regen: 1, capEnabled: true, cap: 20 },
    mrx: { start: 15, regen: 1, capEnabled: true, cap: 15 },
  },
  // When there are 2 detectives, do they draw from one shared pool (true)
  // or each get their own independent pool (false, default)?
  sharedDetectivePool: false,
  // Black and Double stay simple counted tickets, untouched by the movement
  // pool -- black hides which route was used (and can hide a Pass too), and
  // still costs the same movement as whichever route it stands in for.
  tickets: {
    detective: { black: 0, double: 0 },
    // MrX's double-move defaults to 0, not the classic 2 -- on this trimmed
    // 53-station board, exit interceptability margins are already 0-1 hops
    // in the tightest cases, and a single double-move (skipping a whole
    // round of detective movement) is enough to flip a barely-interceptable
    // exit into an uncatchable one. Black tickets don't touch round-count,
    // so they're unaffected and keep the classic default.
    mrx: { black: 5, double: 0 },
  },
  revealRounds: [3, 8, 13, 18, 24],
  stunDuration: 2,
  stunnedDetectiveBehavior: "stay", // "stay" | "respawn"
  maxCaptures: Infinity,
  detectiveCount: 2, // 1 or 2, sharing the board's single detective spawn
  // Purely a networked-lobby UI concern (which role checkboxes are shown) --
  // the engine's turn model is identical either way, since it was always
  // "both detectives stage moves, then one shared End Turn commits them."
  sharedDetectiveTurn: true,
};

export const DETECTIVE_COLORS = ["#a855f7", "#c2703d"]; // purple, fox orange

export function parseRevealRounds(str) {
  if (Array.isArray(str)) return str.slice().sort((a, b) => a - b);
  return String(str)
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

function mergeSettings(overrides = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
    movementCosts: { ...DEFAULT_SETTINGS.movementCosts, ...overrides.movementCosts },
    movementPools: {
      detective: { ...DEFAULT_SETTINGS.movementPools.detective, ...(overrides.movementPools && overrides.movementPools.detective) },
      mrx: { ...DEFAULT_SETTINGS.movementPools.mrx, ...(overrides.movementPools && overrides.movementPools.mrx) },
    },
    tickets: {
      detective: { ...DEFAULT_SETTINGS.tickets.detective, ...(overrides.tickets && overrides.tickets.detective) },
      mrx: { ...DEFAULT_SETTINGS.tickets.mrx, ...(overrides.tickets && overrides.tickets.mrx) },
    },
    revealRounds: overrides.revealRounds
      ? parseRevealRounds(overrides.revealRounds)
      : DEFAULT_SETTINGS.revealRounds.slice(),
  };
}

export function createGame(board, settingsOverrides = {}) {
  const settings = mergeSettings(settingsOverrides);
  const detectiveCount = settings.detectiveCount === 2 ? 2 : 1;
  const spawn = board.roles.detective;

  const detectives = [];
  for (let i = 0; i < detectiveCount; i++) {
    detectives.push({
      id: `d${i + 1}`,
      color: DETECTIVE_COLORS[i],
      position: spawn,
      movement: settings.movementPools.detective.start,
      tickets: { ...settings.tickets.detective },
      stunnedUntilRound: null,
    });
  }

  return {
    board,
    settings,
    round: 1,
    phase: "mrx", // "mrx" | "detectives" | "ended"
    mrx: {
      position: board.roles.mrx,
      movement: settings.movementPools.mrx.start,
      tickets: { ...settings.tickets.mrx },
    },
    detectives,
    staging: {}, // detectiveId -> { to, ticket, cost }
    readyDetectives: [], // detective ids who have locked in this turn
    captureCount: 0,
    lastReveal: null, // { round, position }
    lastCapture: null, // { round, detectiveId, position }
    log: [],
    outcome: null, // { type: "gain"|"maintain"|"lose"|"failure", exitKey?, label? }
  };
}

function neighborsByTicket(board, station) {
  const s = board.stations[String(station)];
  if (!s) return {};
  return { taxi: s.taxi, bus: s.bus, underground: s.underground };
}

function stationOccupiedByAnyDetective(state, station, exceptId = null) {
  return state.detectives.some((d) => d.id !== exceptId && d.position === station);
}

// A station is off-limits to detective `exceptId` if another detective
// already stands there OR has already staged a move there this turn --
// the latter is what stops two crew members from both claiming the same
// destination, since a staged claim is visible to every device as soon as
// it syncs.
function stationClaimedThisTurn(state, station, exceptId = null) {
  if (stationOccupiedByAnyDetective(state, station, exceptId)) return true;
  return Object.entries(state.staging).some(([id, move]) => id !== exceptId && move.to === station);
}

function isDetectiveStunned(detective, round) {
  return detective.stunnedUntilRound != null && round < detective.stunnedUntilRound;
}

// How much movement a detective can actually draw on right now. With
// independent pools that's just their own value; with a shared pool, it's
// the (mirrored) shared value minus whatever the OTHER detective has
// already staged this turn but not yet committed -- otherwise both crew
// members could each plan a move as if the full shared pool were theirs
// alone and collectively overspend it.
function availableMovementFor(state, detectiveId) {
  const d = state.detectives.find((x) => x.id === detectiveId);
  if (!d) return 0;
  if (!state.settings.sharedDetectivePool) return d.movement;
  let reserved = 0;
  for (const [id, move] of Object.entries(state.staging)) {
    if (id !== detectiveId) reserved += move.cost;
  }
  return d.movement - reserved;
}

// Moves available from `from`, gated by movement pool rather than per-type
// ticket counts. Black tickets remain a separate limited count and can
// substitute for any route -- at that route's cost, picking the cheapest
// available one to a given destination when more than one connects it --
// so black is purely about hiding which route was used, not about being
// cheaper or faster than the route it stands in for.
// `blockDetectiveSquares` is true for MrX (can't step onto a detective) and
// false for detectives (their own occupancy rule is handled by the caller).
function movesFrom(board, from, movement, blackCount, costs, state, blockDetectiveSquares) {
  const byKind = neighborsByTicket(board, from);
  const out = [];
  const cheapestToDestination = new Map();
  for (const kind of TICKET_KINDS) {
    const cost = costs[kind];
    for (const to of byKind[kind] || []) {
      if (blockDetectiveSquares && stationOccupiedByAnyDetective(state, to)) continue;
      const existing = cheapestToDestination.get(to);
      if (existing === undefined || cost < existing) cheapestToDestination.set(to, cost);
      if (movement >= cost) out.push({ to, ticket: kind, cost });
    }
  }
  if (blackCount > 0) {
    for (const [to, cost] of cheapestToDestination) {
      if (movement < cost) continue;
      out.push({ to, ticket: "black", cost });
    }
  }
  return out;
}

export function legalMovesForMrX(state) {
  if (state.phase !== "mrx") return [];
  return movesFrom(state.board, state.mrx.position, state.mrx.movement, state.mrx.tickets.black, state.settings.movementCosts, state, true);
}

// Legal moves stay available even after this detective has already staged
// one -- picking a different highlighted station just restages, no explicit
// "undo" step required first.
export function legalMovesForDetective(state, detectiveId) {
  if (state.phase !== "detectives") return [];
  const d = state.detectives.find((x) => x.id === detectiveId);
  if (!d) return [];
  if (isDetectiveStunned(d, state.round)) return [];
  const movement = availableMovementFor(state, detectiveId);
  const moves = movesFrom(state.board, d.position, movement, d.tickets.black, state.settings.movementCosts, state, false);
  return moves.filter((m) => !stationClaimedThisTurn(state, m.to, detectiveId));
}

function checkExitOutcome(board, position) {
  const roles = board.roles;
  if (position === roles.exit1) return { type: "gain", exitKey: "exit1", label: "Exit 1 (gain)" };
  if (position === roles.exit2) return { type: "maintain", exitKey: "exit2", label: "Exit 2 (maintain)" };
  for (let i = 0; i < 5; i++) {
    const key = `exit3_${i}`;
    if (position === roles[key]) {
      return { type: "lose", exitKey: key, label: `Exit 3.${i} (lose)` };
    }
  }
  return null;
}

function cappedRegen(current, poolSettings) {
  const next = current + poolSettings.regen;
  return poolSettings.capEnabled ? Math.min(next, poolSettings.cap) : next;
}

// Landing on an exit station does NOT end the game by itself -- MrX must
// explicitly commitToExit(). Otherwise every exit station becomes a single
// mandatory trap the moment you touch it, which makes those nodes useless
// for anyone routing through the area without meaning to end the game there.
function afterMrxMoveResolved(state) {
  let lastReveal = state.lastReveal;
  if (state.settings.revealRounds.includes(state.round)) {
    lastReveal = { round: state.round, position: state.mrx.position };
  }
  // Regen fires at the START of the side whose turn it now is -- detectives
  // regen the moment it becomes their turn, not when they last acted.
  const poolSettings = state.settings.movementPools.detective;
  let detectives;
  if (state.settings.sharedDetectivePool) {
    const shared = cappedRegen(state.detectives[0] ? state.detectives[0].movement : 0, poolSettings);
    detectives = state.detectives.map((d) => ({ ...d, movement: shared }));
  } else {
    detectives = state.detectives.map((d) => ({ ...d, movement: cappedRegen(d.movement, poolSettings) }));
  }
  return { ...state, detectives, lastReveal, phase: "detectives", readyDetectives: [] };
}

// What MrX would win/lose by committing to an exit right now, or null if
// the current station isn't an exit at all.
export function currentExitOpportunity(state) {
  return checkExitOutcome(state.board, state.mrx.position);
}

export function commitToExit(state) {
  const outcome = currentExitOpportunity(state);
  if (!outcome) throw new Error("Not standing on an exit station");
  return { ...state, outcome, phase: "ended" };
}

function applyMoveCost(mrxOrDetective, ticket, cost) {
  return {
    ...mrxOrDetective,
    movement: mrxOrDetective.movement - cost,
    tickets: ticket === "black" ? { ...mrxOrDetective.tickets, black: mrxOrDetective.tickets.black - 1 } : mrxOrDetective.tickets,
  };
}

export function moveMrX(state, to, ticket) {
  if (state.phase !== "mrx") throw new Error("Not MrX's turn");
  const match = legalMovesForMrX(state).find((m) => m.to === to && m.ticket === ticket);
  if (!match) throw new Error(`Illegal MrX move to ${to} via ${ticket}`);

  const mrx = { ...applyMoveCost(state.mrx, ticket, match.cost), position: to };
  const log = [...state.log, { round: state.round, actor: "mrx", to, ticket }];
  return afterMrxMoveResolved({ ...state, mrx, log });
}

// MrX can always choose not to move -- free (no movement cost), and can
// optionally spend a black ticket to hide even the fact that they passed,
// same as hiding which route a real move used.
export function passMrX(state, useBlack = false) {
  if (state.phase !== "mrx") throw new Error("Not MrX's turn");
  if (useBlack && !state.mrx.tickets.black) throw new Error("No black tickets remaining");
  const tickets = useBlack ? { ...state.mrx.tickets, black: state.mrx.tickets.black - 1 } : state.mrx.tickets;
  const mrx = { ...state.mrx, tickets };
  const log = [...state.log, { round: state.round, actor: "mrx", to: state.mrx.position, ticket: useBlack ? "black" : "pass" }];
  return afterMrxMoveResolved({ ...state, mrx, log });
}

// Double-move: two component moves resolved back-to-back, consuming one
// double ticket plus each component's own movement cost (and black ticket,
// if either leg used one), but only ONE round-tick / reveal-schedule check
// happens, after the second move lands.
export function doubleMoveMrX(state, moves) {
  if (state.phase !== "mrx") throw new Error("Not MrX's turn");
  if (!Array.isArray(moves) || moves.length !== 2) throw new Error("Double move needs exactly 2 moves");
  if (!state.mrx.tickets.double) throw new Error("No double-move tickets remaining");

  let mrx = { ...state.mrx, tickets: { ...state.mrx.tickets, double: state.mrx.tickets.double - 1 } };
  const log = [...state.log];

  for (const { to, ticket } of moves) {
    const legalFrom = movesFrom(state.board, mrx.position, mrx.movement, mrx.tickets.black, state.settings.movementCosts, state, true);
    const match = legalFrom.find((m) => m.to === to && m.ticket === ticket);
    if (!match) throw new Error(`Illegal double-move leg to ${to} via ${ticket}`);
    mrx = { ...applyMoveCost(mrx, ticket, match.cost), position: to };
    log.push({ round: state.round, actor: "mrx", to, ticket, double: true });
  }

  return afterMrxMoveResolved({ ...state, mrx, log });
}

// Restaging (picking a new destination for a detective who already staged
// one) implicitly un-readies them -- a changed move needs re-confirming via
// lockInDetective, rather than silently committing something they didn't
// mean to lock in.
export function stageDetectiveMove(state, detectiveId, to, ticket) {
  if (state.phase !== "detectives") throw new Error("Not the detectives' turn");
  const match = legalMovesForDetective(state, detectiveId).find((m) => m.to === to && m.ticket === ticket);
  if (!match) throw new Error(`Illegal detective move to ${to} via ${ticket}`);
  const staging = { ...state.staging, [detectiveId]: { to, ticket, cost: match.cost } };
  const readyDetectives = state.readyDetectives.filter((id) => id !== detectiveId);
  return { ...state, staging, readyDetectives };
}

export function unstageDetectiveMove(state, detectiveId) {
  if (!state.staging[detectiveId] && !state.readyDetectives.includes(detectiveId)) return state;
  const staging = { ...state.staging };
  delete staging[detectiveId];
  const readyDetectives = state.readyDetectives.filter((id) => id !== detectiveId);
  return { ...state, staging, readyDetectives };
}

// A detective can lock in with no staged move at all -- that's a valid
// explicit choice to stay put this turn.
export function lockInDetective(state, detectiveId) {
  if (state.readyDetectives.includes(detectiveId)) return state;
  return { ...state, readyDetectives: [...state.readyDetectives, detectiveId] };
}

export function unlockDetective(state, detectiveId) {
  if (!state.readyDetectives.includes(detectiveId)) return state;
  return { ...state, readyDetectives: state.readyDetectives.filter((id) => id !== detectiveId) };
}

// The turn only commits once every non-stunned detective has locked in --
// no single crew member can end another's turn for them.
export function allDetectivesReady(state) {
  return state.detectives.every((d) => isDetectiveStunned(d, state.round) || state.readyDetectives.includes(d.id));
}

// Commits every staged detective move atomically ("End Turn"): applies
// moves, deducts movement/black tickets (shared pool spends deduct the
// SAME amount from every detective at once, keeping their mirrored values
// in sync), resolves captures against MrX's true position, advances the
// round, and clears any stun timers that have expired.
export function commitDetectiveTurn(state) {
  if (state.phase !== "detectives") throw new Error("Not the detectives' turn");

  let detectives = state.detectives.map((d) => ({ ...d }));
  const log = [...state.log];
  let captureCount = state.captureCount;
  let lastCapture = state.lastCapture;
  const nextRound = state.round + 1;
  const shared = state.settings.sharedDetectivePool;
  let totalSharedCost = 0;
  let sharedBlackSpent = 0;

  for (const d of detectives) {
    const move = state.staging[d.id];
    if (!move) continue;
    if (!shared) {
      const updated = applyMoveCost(d, move.ticket, move.cost);
      d.movement = updated.movement;
      d.tickets = updated.tickets;
    } else {
      totalSharedCost += move.cost;
      if (move.ticket === "black") sharedBlackSpent += 1;
    }
    d.position = move.to;
    log.push({ round: state.round, actor: d.id, to: move.to, ticket: move.ticket });

    if (move.to === state.mrx.position) {
      captureCount += 1;
      lastCapture = { round: state.round, detectiveId: d.id, position: move.to };
      d.stunnedUntilRound = nextRound + state.settings.stunDuration;
      if (state.settings.stunnedDetectiveBehavior === "respawn") {
        d.position = state.board.roles.detective;
      }
    }
  }

  if (shared && (totalSharedCost > 0 || sharedBlackSpent > 0)) {
    const newMovement = (detectives[0] ? detectives[0].movement : 0) - totalSharedCost;
    detectives = detectives.map((d) => ({
      ...d,
      movement: newMovement,
      tickets: sharedBlackSpent > 0 ? { ...d.tickets, black: d.tickets.black - sharedBlackSpent } : d.tickets,
    }));
  }

  detectives = detectives.map((d) =>
    d.stunnedUntilRound != null && nextRound >= d.stunnedUntilRound ? { ...d, stunnedUntilRound: null } : d
  );

  let outcome = state.outcome;
  let phase = "mrx";
  if (captureCount >= state.settings.maxCaptures) {
    outcome = { type: "failure", label: "Captured too many times" };
    phase = "ended";
  }

  let mrx = state.mrx;
  if (phase === "mrx") {
    mrx = { ...state.mrx, movement: cappedRegen(state.mrx.movement, state.settings.movementPools.mrx) };
  }

  return {
    ...state,
    mrx,
    detectives,
    staging: {},
    round: nextRound,
    phase,
    captureCount,
    lastCapture,
    log,
    outcome,
  };
}

export function isGameOver(state) {
  return state.phase === "ended";
}

// For rendering: per-detective reachable-station sets plus the overlap set,
// computed once from turn-start positions (staged moves don't shift other
// detectives' reachable sets — occupancy is checked against turn-start
// state only, matching the "nothing is final until End Turn" design).
export function getReachableSets(state) {
  const result = {};
  const sets = state.detectives.map((d) => new Set(legalMovesForDetective(state, d.id).map((m) => m.to)));
  state.detectives.forEach((d, i) => {
    result[d.id] = sets[i];
  });
  let shared = null;
  if (sets.length === 2) {
    shared = new Set([...sets[0]].filter((s) => sets[1].has(s)));
  }
  result.shared = shared || new Set();
  return result;
}
