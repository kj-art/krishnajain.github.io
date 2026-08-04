// Drives the #game-screen DOM (canvas + side panel) for a given engine
// state, independent of *how* that state changes turn to turn. Hotseat mode
// wraps this with device-handoff airlocks and flips viewer roles every
// phase; networked mode wraps it with Firebase sync and keeps a client's
// viewer roles fixed to whatever it claimed in the lobby. Either way, this
// controller only ever needs: the current state, which roles this device is
// allowed to act as, and a callback for "I just made a local move."
import {
  legalMovesForMrX,
  legalMovesForDetective,
  moveMrX,
  doubleMoveMrX,
  stageDetectiveMove,
  unstageDetectiveMove,
  lockInDetective,
  unlockDetective,
  allDetectivesReady,
  commitDetectiveTurn,
  currentExitOpportunity,
  commitToExit,
  isGameOver,
} from "./engine.js";
import { BoardView } from "./render.js";
import { ticketSpan, ticketLabel } from "./ticket-theme.js";

const el = (id) => document.getElementById(id);

function getCanvasCoords(evt, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return [(evt.clientX - rect.left) * scaleX, (evt.clientY - rect.top) * scaleY];
}

// Tickets get auto-picked (no chooser popup) so a click always just moves
// you: cheapest/most common transport first, unless the "use black ticket"
// toggle is on and one's actually available for this destination.
const NATURAL_ORDER = ["taxi", "bus", "underground"];
function pickTicket(options, preferBlack) {
  if (preferBlack) {
    const black = options.find((o) => o.ticket === "black");
    if (black) return black;
  }
  for (const kind of NATURAL_ORDER) {
    const found = options.find((o) => o.ticket === kind);
    if (found) return found;
  }
  return options[0] || null;
}

// One highlight ring per destination, colored by whichever ticket
// pickTicket would actually spend to get there -- so the ring itself is
// the answer to "what will this cost me," visible before you ever click.
function resolvedDestinations(options, preferBlack) {
  const byDestination = new Map();
  for (const opt of options) {
    if (!byDestination.has(opt.to)) byDestination.set(opt.to, []);
    byDestination.get(opt.to).push(opt);
  }
  const result = [];
  for (const [to, opts] of byDestination) {
    const chosen = pickTicket(opts, preferBlack);
    if (chosen) result.push({ to, ticket: chosen.ticket });
  }
  return result;
}

function showCrewPicker(container, detectives, onChosen) {
  container.innerHTML = "";
  container.classList.remove("hidden");
  for (const d of detectives) {
    const btn = document.createElement("button");
    btn.className = "ticket-choice-btn";
    btn.style.borderLeft = `6px solid ${d.color}`;
    btn.textContent = `Crew ${d.id.slice(1)}`;
    btn.onclick = () => {
      container.classList.add("hidden");
      container.innerHTML = "";
      onChosen(d);
    };
    container.appendChild(btn);
  }
}

function isStunned(d, round) {
  return d.stunnedUntilRound != null && round < d.stunnedUntilRound;
}

export class GameplayController {
  constructor(canvas, board, { onLocalMove }) {
    this.canvas = canvas;
    this.board = board;
    this.onLocalMove = onLocalMove;
    this.view = new BoardView(canvas, board);
    this.viewerRoles = new Set();
    this.state = null;
    // null | { type: "single", to, ticket } | { type: "double", leg1, leg2: null|{to,ticket} }
    // Purely local UI state -- never committed to the engine (and never
    // synced) until the Fugitive explicitly presses End Turn and confirms.
    this.mrxPlan = null;

    canvas.addEventListener("click", (evt) => this._onCanvasClick(evt));
    el("mrx-double-toggle").addEventListener("change", () => {
      this.mrxPlan = null;
      this._renderMrxPanel();
      el("crew-picker").classList.add("hidden");
      this._renderBoard();
    });
    el("mrx-black-toggle").addEventListener("change", () => {
      this.mrxPlan = null;
      this._renderMrxPanel();
      this._renderBoard();
    });
    el("mrx-clear-btn").addEventListener("click", () => {
      this.mrxPlan = null;
      this._renderMrxPanel();
      this._renderBoard();
    });
    el("mrx-end-turn-btn").addEventListener("click", () => this._commitMrxPlan());
  }

  setViewerRoles(roles) {
    this.viewerRoles = new Set(roles);
    this.view.setViewerRoles(this.viewerRoles);
  }

  setState(state) {
    this.state = state;
    this.mrxPlan = null;
    el("mrx-double-toggle").checked = false;
    el("mrx-black-toggle").checked = false;
    this._renderAll();
    this._maybeAutoCommit();
  }

  _applyMove(mutator) {
    const newState = mutator(this.state);
    this.setState(newState);
    // Read this.state fresh rather than passing the local `newState` --
    // setState can trigger a nested _applyMove (auto-commit, once every
    // detective is locked in), which advances this.state further before
    // we get back here. Reporting the pre-commit snapshot would show a
    // stale phase to onLocalMove right after a real transition happened.
    this.onLocalMove(this.state);
  }

  // Landing on an exit station is just a station like any other unless MrX
  // says otherwise -- ask before ending the game there, so exit nodes stay
  // usable as ordinary pass-through stops for anyone not trying to win yet.
  _applyMrxMove(mutator) {
    this._applyMove(mutator);
    const outcome = currentExitOpportunity(this.state);
    if (!outcome) return;
    const commit = window.confirm(
      `You've reached ${outcome.label}. Commit to this exit and end the game here? Choose Cancel to pass through and keep playing.`
    );
    if (commit) this._applyMove((s) => commitToExit(s));
  }

  _mrxPlanComplete() {
    if (!this.mrxPlan) return false;
    return this.mrxPlan.type === "single" || (this.mrxPlan.type === "double" && this.mrxPlan.leg2);
  }

  _mrxPlanDescription() {
    if (!this.mrxPlan) return "";
    if (this.mrxPlan.type === "single") {
      return `Selected: ${this.mrxPlan.to} via ${ticketLabel(this.mrxPlan.ticket)}.`;
    }
    const { leg1, leg2 } = this.mrxPlan;
    if (!leg2) return `Leg 1: ${leg1.to} via ${ticketLabel(leg1.ticket)}. Pick your second destination.`;
    return `Selected: ${leg1.to} via ${ticketLabel(leg1.ticket)}, then ${leg2.to} via ${ticketLabel(leg2.ticket)}.`;
  }

  // Nothing actually moves until this fires -- clicking the board only
  // ever stages mrxPlan. End Turn asks for an explicit confirmation before
  // the move (and any exit-commit prompt that follows it) actually happens.
  _commitMrxPlan() {
    if (!this._mrxPlanComplete()) return;
    const plan = this.mrxPlan;
    const description =
      plan.type === "single"
        ? `Move to ${plan.to} via ${ticketLabel(plan.ticket)}`
        : `Move to ${plan.leg1.to} via ${ticketLabel(plan.leg1.ticket)}, then to ${plan.leg2.to} via ${ticketLabel(plan.leg2.ticket)}`;
    if (!window.confirm(`${description}. End your turn?`)) return;
    this.mrxPlan = null;
    if (plan.type === "single") {
      this._applyMrxMove((s) => moveMrX(s, plan.to, plan.ticket));
    } else {
      this._applyMrxMove((s) => doubleMoveMrX(s, [plan.leg1, plan.leg2]));
    }
  }

  // Fires once every non-stunned detective has locked in -- nobody needs to
  // press a shared "End Turn"; whichever device notices the condition
  // commits, and since it's a pure function of the same synced state, two
  // devices noticing at once just produce the same result twice, harmlessly.
  _maybeAutoCommit() {
    if (this.state.phase === "detectives" && allDetectivesReady(this.state)) {
      this._applyMove((s) => commitDetectiveTurn(s));
    }
  }

  _scratchLeg2Options() {
    const leg1 = this.mrxPlan.leg1;
    const scratch = {
      ...this.state,
      mrx: {
        position: leg1.to,
        tickets: { ...this.state.mrx.tickets, [leg1.ticket]: this.state.mrx.tickets[leg1.ticket] - 1 },
      },
    };
    return legalMovesForMrX(scratch);
  }

  _onCanvasClick(evt) {
    if (!this.state || isGameOver(this.state)) return;
    const [x, y] = getCanvasCoords(evt, this.canvas);
    const stationKey = this.view.hitTest(x, y);
    if (!stationKey) return;
    const to = Number(stationKey);

    if (this.state.phase === "mrx") {
      if (!this.viewerRoles.has("mrx")) return;
      this._handleMrxClick(to);
    } else if (this.state.phase === "detectives") {
      this._handleDetectiveClick(to);
    }
  }

  // Clicking the board only ever stages this.mrxPlan -- nothing moves until
  // End Turn is pressed and confirmed. Picking a different destination is
  // always computed from MrX's true current position (never chained off a
  // not-yet-committed selection), so changing your mind is a single direct
  // click, no undo step first.
  _handleMrxClick(to) {
    const preferBlack = el("mrx-black-toggle").checked;
    if (el("mrx-double-toggle").checked) {
      const needLeg1 = !this.mrxPlan || this.mrxPlan.type !== "double" || this.mrxPlan.leg2;
      if (needLeg1) {
        const options = legalMovesForMrX(this.state).filter((m) => m.to === to);
        const chosen = pickTicket(options, preferBlack);
        if (!chosen) return;
        this.mrxPlan = { type: "double", leg1: chosen, leg2: null };
      } else {
        const options = this._scratchLeg2Options().filter((m) => m.to === to);
        const chosen = pickTicket(options, preferBlack);
        if (!chosen) return;
        this.mrxPlan = { ...this.mrxPlan, leg2: chosen };
      }
    } else {
      const options = legalMovesForMrX(this.state).filter((m) => m.to === to);
      const chosen = pickTicket(options, preferBlack);
      if (!chosen) return;
      this.mrxPlan = { type: "single", to: chosen.to, ticket: chosen.ticket };
    }
    this._renderMrxPanel();
    this._renderBoard();
  }

  _handleDetectiveClick(to) {
    const myDetectives = this.state.detectives.filter(
      (d) => this.viewerRoles.has(d.id) && !isStunned(d, this.state.round)
    );
    const candidates = myDetectives.filter((d) => legalMovesForDetective(this.state, d.id).some((m) => m.to === to));
    if (candidates.length === 0) return;
    if (candidates.length === 1) {
      this._stageDetectiveTo(candidates[0], to);
    } else {
      showCrewPicker(el("crew-picker"), candidates, (chosen) => this._stageDetectiveTo(chosen, to));
    }
  }

  _stageDetectiveTo(detective, to) {
    const options = legalMovesForDetective(this.state, detective.id).filter((m) => m.to === to);
    const chosen = pickTicket(options, false);
    if (!chosen) return;
    this._applyMove((s) => stageDetectiveMove(s, detective.id, chosen.to, chosen.ticket));
  }

  _renderAll() {
    this._renderRoundInfo();
    this._renderTransportLog();
    this._renderCaptureBanner();
    this._renderMrxPanel();
    this._renderDetectivesPanel();
    this._renderBoard();
  }

  _renderBoard() {
    let legalMoves = [];
    let mrxPending = [];
    if (this.state.phase === "mrx" && this.viewerRoles.has("mrx")) {
      const preferBlack = el("mrx-black-toggle").checked;
      const pickingLeg2 = this.mrxPlan && this.mrxPlan.type === "double" && !this.mrxPlan.leg2;
      const rawOptions = pickingLeg2 ? this._scratchLeg2Options() : legalMovesForMrX(this.state);
      legalMoves = resolvedDestinations(rawOptions, preferBlack);
      if (this.mrxPlan) {
        mrxPending =
          this.mrxPlan.type === "single"
            ? [this.mrxPlan.to]
            : [this.mrxPlan.leg1.to, ...(this.mrxPlan.leg2 ? [this.mrxPlan.leg2.to] : [])];
      }
    }
    this.view.render(this.state, { legalMoves, mrxPending });
  }

  _renderRoundInfo() {
    const label = this.state.phase === "mrx" ? "the Fugitive's" : "the Enterprise Crew's";
    el("round-info").textContent = `Round ${this.state.round} — ${label} turn`;
  }

  // Classic rule: the Fugitive's transport type is announced to the crew
  // every round, but never their location. Doesn't matter who's looking --
  // the type alone carries no position info.
  _renderTransportLog() {
    const entries = this.state.log.filter((e) => e.actor === "mrx" && e.round === this.state.round);
    const target = el("transport-log");
    if (entries.length === 0) {
      target.innerHTML = "";
      return;
    }
    const parts = entries.map((e) => ticketSpan(this.board, e.ticket));
    target.innerHTML = `Fugitive travelled via: ${parts.join(" then ")}`;
  }

  _renderCaptureBanner() {
    const banner = el("capture-banner");
    const lc = this.state.lastCapture;
    if (lc && lc.round === this.state.round - 1) {
      banner.textContent = `Crew ${lc.detectiveId.slice(1)} caught the Fugitive at station ${lc.position}! Pause for the physical encounter — the crew member is stunned. (Captures so far: ${this.state.captureCount})`;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  _renderMrxPanel() {
    const panel = el("mrx-panel");
    const isMrxTurn = this.state.phase === "mrx";
    panel.classList.toggle("hidden", !isMrxTurn && !this.viewerRoles.has("mrx"));
    el("detectives-panel").classList.toggle("hidden", isMrxTurn);
    if (!isMrxTurn) return;

    if (!this.viewerRoles.has("mrx")) {
      el("mrx-tickets").textContent = "Waiting for the Fugitive to move…";
      el("mrx-controls").classList.add("hidden");
      return;
    }
    el("mrx-controls").classList.remove("hidden");
    const t = this.state.mrx.tickets;
    el("mrx-tickets").innerHTML =
      `${ticketSpan(this.board, "taxi")}: ${t.taxi} &nbsp; ${ticketSpan(this.board, "bus")}: ${t.bus} &nbsp; ${ticketSpan(this.board, "underground")}: ${t.underground} &nbsp; Black: ${t.black} &nbsp; Double: ${t.double}`;
    el("mrx-double-toggle").disabled = t.double === 0;
    el("mrx-black-toggle").disabled = t.black === 0;

    el("mrx-double-status").textContent = el("mrx-double-toggle").checked ? this._mrxPlanDescription() : "";
    el("mrx-plan-status").textContent = !el("mrx-double-toggle").checked ? this._mrxPlanDescription() : "";
    el("mrx-clear-btn").classList.toggle("hidden", !this.mrxPlan);
    el("mrx-end-turn-btn").disabled = !this._mrxPlanComplete();
  }

  _renderDetectivesPanel() {
    if (this.state.phase !== "detectives") return;
    el("detectives-panel").classList.remove("hidden");
    el("mrx-panel").classList.add("hidden");

    const container = el("detective-rows");
    container.innerHTML = "";
    for (const d of this.state.detectives) {
      const row = document.createElement("div");
      row.className = "detective-row";
      const stunned = isStunned(d, this.state.round);
      if (stunned) row.classList.add("stunned");
      const controllable = this.viewerRoles.has(d.id);
      const staged = this.state.staging[d.id];
      const ready = this.state.readyDetectives.includes(d.id);
      if (ready) row.classList.add("ready");

      const t = d.tickets;
      let statusHtml;
      if (stunned) {
        statusHtml = `<div>Stunned until round ${d.stunnedUntilRound}</div>`;
      } else if (staged) {
        statusHtml = `<div>Moving to ${staged.to} via ${ticketSpan(this.board, staged.ticket)}</div>`;
      } else if (ready) {
        statusHtml = `<div>Staying put</div>`;
      } else if (controllable) {
        statusHtml = `<div>Tap a highlighted station to move…</div>`;
      } else {
        statusHtml = `<div><em>Still deciding…</em></div>`;
      }

      row.innerHTML = `
        <span class="swatch" style="background:${d.color}"></span>
        <strong>Crew ${d.id.slice(1)}</strong> — at station ${d.position}
        <div>${ticketSpan(this.board, "taxi")}: ${t.taxi} &nbsp; ${ticketSpan(this.board, "bus")}: ${t.bus} &nbsp; ${ticketSpan(this.board, "underground")}: ${t.underground} &nbsp; Black: ${t.black}</div>
        ${statusHtml}
        ${ready ? '<div class="locked-badge">Locked in ✓</div>' : ""}
      `;

      if (!stunned && controllable) {
        if (staged) {
          const clearBtn = document.createElement("button");
          clearBtn.textContent = "Stay put instead";
          clearBtn.onclick = () => {
            this._applyMove((s) => unstageDetectiveMove(s, d.id));
          };
          row.appendChild(clearBtn);
        }
        const lockBtn = document.createElement("button");
        lockBtn.textContent = ready ? "Unlock" : "Lock In";
        lockBtn.onclick = () => {
          if (ready) {
            this._applyMove((s) => unlockDetective(s, d.id));
            return;
          }
          const destDescription = staged ? `moving to ${staged.to}` : "staying put";
          if (!window.confirm(`Lock in Crew ${d.id.slice(1)}, ${destDescription}? The turn ends once everyone's locked in.`)) return;
          this._applyMove((s) => lockInDetective(s, d.id));
        };
        row.appendChild(lockBtn);
      }

      container.appendChild(row);
    }
  }
}
