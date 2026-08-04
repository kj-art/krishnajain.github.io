// Pure rules engine: no DOM, no Firebase, no I/O. Every function here takes
// a state and returns a new state (or a derived value) — never mutates its
// input. That immutability is what lets sync.js push a whole state object to
// Firebase and lets the engine be exercised from plain Node test scripts.

export const TICKET_KINDS = ["taxi", "bus", "underground"];

export const DEFAULT_SETTINGS = {
  tickets: {
    detective: { taxi: 10, bus: 8, underground: 4, black: 0, double: 0 },
    mrx: { taxi: 4, bus: 3, underground: 3, black: 5, double: 2 },
  },
  revealRounds: [3, 8, 13, 18, 24],
  stunDuration: 2,
  stunnedDetectiveBehavior: "stay", // "stay" | "respawn"
  maxCaptures: Infinity,
  detectiveCount: 1, // 1 or 2, sharing the board's single detective spawn
  // Purely a networked-lobby UI concern (which role checkboxes are shown) --
  // the engine's turn model is identical either way, since it was always
  // "both detectives stage moves, then one shared End Turn commits them."
  sharedDetectiveTurn: true,
};

const DETECTIVE_COLORS = ["#a855f7", "#c2703d"]; // purple, fox orange

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
      tickets: { ...settings.tickets.mrx },
    },
    detectives,
    staging: {}, // detectiveId -> { to, ticket }
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

function isDetectiveStunned(detective, round) {
  return detective.stunnedUntilRound != null && round < detective.stunnedUntilRound;
}

// Moves available from `from` for a rider with the given ticket pool.
// `blockDetectiveSquares` is true for MrX (can't step onto a detective) and
// false for detectives (their own occupancy rule is handled by the caller).
function movesFrom(board, from, tickets, state, blockDetectiveSquares) {
  const byKind = neighborsByTicket(board, from);
  const out = [];
  for (const kind of TICKET_KINDS) {
    if (!tickets[kind]) continue;
    for (const to of byKind[kind] || []) {
      if (blockDetectiveSquares && stationOccupiedByAnyDetective(state, to)) continue;
      out.push({ to, ticket: kind });
    }
  }
  if (tickets.black) {
    const seen = new Set();
    for (const kind of TICKET_KINDS) {
      for (const to of byKind[kind] || []) {
        if (seen.has(to)) continue;
        seen.add(to);
        if (blockDetectiveSquares && stationOccupiedByAnyDetective(state, to)) continue;
        out.push({ to, ticket: "black" });
      }
    }
  }
  return out;
}

export function legalMovesForMrX(state) {
  if (state.phase !== "mrx") return [];
  return movesFrom(state.board, state.mrx.position, state.mrx.tickets, state, true);
}

export function legalMovesForDetective(state, detectiveId) {
  if (state.phase !== "detectives") return [];
  const d = state.detectives.find((x) => x.id === detectiveId);
  if (!d) return [];
  if (isDetectiveStunned(d, state.round)) return [];
  if (state.staging[detectiveId]) return []; // already staged a move this turn
  const moves = movesFrom(state.board, d.position, d.tickets, state, false);
  return moves.filter((m) => !stationOccupiedByAnyDetective(state, m.to, detectiveId));
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

function afterMrxMoveResolved(state) {
  const outcome = checkExitOutcome(state.board, state.mrx.position);
  if (outcome) {
    return { ...state, outcome, phase: "ended" };
  }
  let lastReveal = state.lastReveal;
  if (state.settings.revealRounds.includes(state.round)) {
    lastReveal = { round: state.round, position: state.mrx.position };
  }
  return { ...state, lastReveal, phase: "detectives" };
}

function deductTicket(tickets, kind) {
  return { ...tickets, [kind]: tickets[kind] - 1 };
}

export function moveMrX(state, to, ticket) {
  if (state.phase !== "mrx") throw new Error("Not MrX's turn");
  const legal = legalMovesForMrX(state).some((m) => m.to === to && m.ticket === ticket);
  if (!legal) throw new Error(`Illegal MrX move to ${to} via ${ticket}`);

  const mrx = { position: to, tickets: deductTicket(state.mrx.tickets, ticket) };
  const log = [...state.log, { round: state.round, actor: "mrx", to, ticket }];
  return afterMrxMoveResolved({ ...state, mrx, log });
}

// Double-move: two component moves resolved back-to-back, consuming one
// double ticket plus each component's own ticket, but only ONE round-tick /
// reveal-schedule check happens, after the second move lands.
export function doubleMoveMrX(state, moves) {
  if (state.phase !== "mrx") throw new Error("Not MrX's turn");
  if (!Array.isArray(moves) || moves.length !== 2) throw new Error("Double move needs exactly 2 moves");
  if (!state.mrx.tickets.double) throw new Error("No double-move tickets remaining");

  let position = state.mrx.position;
  let tickets = { ...state.mrx.tickets, double: state.mrx.tickets.double - 1 };
  const log = [...state.log];

  for (const { to, ticket } of moves) {
    const legalFrom = movesFrom(state.board, position, tickets, state, true);
    const legal = legalFrom.some((m) => m.to === to && m.ticket === ticket);
    if (!legal) throw new Error(`Illegal double-move leg to ${to} via ${ticket}`);
    tickets = deductTicket(tickets, ticket);
    position = to;
    log.push({ round: state.round, actor: "mrx", to, ticket, double: true });
  }

  const mrx = { position, tickets };
  return afterMrxMoveResolved({ ...state, mrx, log });
}

export function stageDetectiveMove(state, detectiveId, to, ticket) {
  if (state.phase !== "detectives") throw new Error("Not the detectives' turn");
  const legal = legalMovesForDetective(state, detectiveId).some((m) => m.to === to && m.ticket === ticket);
  if (!legal) throw new Error(`Illegal detective move to ${to} via ${ticket}`);
  return { ...state, staging: { ...state.staging, [detectiveId]: { to, ticket } } };
}

export function unstageDetectiveMove(state, detectiveId) {
  if (!state.staging[detectiveId]) return state;
  const staging = { ...state.staging };
  delete staging[detectiveId];
  return { ...state, staging };
}

// Commits every staged detective move atomically ("End Turn"): applies
// moves, deducts tickets, resolves captures against MrX's true position,
// advances the round, and clears any stun timers that have expired.
export function commitDetectiveTurn(state) {
  if (state.phase !== "detectives") throw new Error("Not the detectives' turn");

  let detectives = state.detectives.map((d) => ({ ...d }));
  const log = [...state.log];
  let captureCount = state.captureCount;
  let lastCapture = state.lastCapture;
  const nextRound = state.round + 1;

  for (const d of detectives) {
    const move = state.staging[d.id];
    if (!move) continue;
    d.position = move.to;
    d.tickets = deductTicket(d.tickets, move.ticket);
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

  detectives = detectives.map((d) =>
    d.stunnedUntilRound != null && nextRound >= d.stunnedUntilRound ? { ...d, stunnedUntilRound: null } : d
  );

  let outcome = state.outcome;
  let phase = "mrx";
  if (captureCount >= state.settings.maxCaptures) {
    outcome = { type: "failure", label: "Captured too many times" };
    phase = "ended";
  }

  return {
    ...state,
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
