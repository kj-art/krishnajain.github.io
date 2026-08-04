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
    this.pendingLeg1 = null;

    canvas.addEventListener("click", (evt) => this._onCanvasClick(evt));
    el("mrx-double-toggle").addEventListener("change", (evt) => {
      this.pendingLeg1 = null;
      el("mrx-double-status").textContent = evt.target.checked ? "Pick your first destination." : "";
      el("crew-picker").classList.add("hidden");
      this._renderBoard();
    });
    el("mrx-black-toggle").addEventListener("change", () => {
      this.pendingLeg1 = null;
      el("mrx-double-status").textContent = "";
    });
  }

  setViewerRoles(roles) {
    this.viewerRoles = new Set(roles);
    this.view.setViewerRoles(this.viewerRoles);
  }

  setState(state) {
    this.state = state;
    this.pendingLeg1 = null;
    el("mrx-double-toggle").checked = false;
    el("mrx-black-toggle").checked = false;
    el("mrx-double-status").textContent = "";
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
    const scratch = {
      ...this.state,
      mrx: {
        position: this.pendingLeg1.to,
        tickets: { ...this.state.mrx.tickets, [this.pendingLeg1.ticket]: this.state.mrx.tickets[this.pendingLeg1.ticket] - 1 },
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

  _handleMrxClick(to) {
    const preferBlack = el("mrx-black-toggle").checked;
    if (el("mrx-double-toggle").checked) {
      if (!this.pendingLeg1) {
        const options = legalMovesForMrX(this.state).filter((m) => m.to === to);
        const chosen = pickTicket(options, preferBlack);
        if (!chosen) return;
        this.pendingLeg1 = chosen;
        el("mrx-double-status").textContent = `Leg 1: ${ticketLabel(chosen.ticket)} to ${chosen.to}. Pick your second destination.`;
        this._renderBoard();
      } else {
        const options = this._scratchLeg2Options().filter((m) => m.to === to);
        const chosen = pickTicket(options, preferBlack);
        if (!chosen) return;
        const leg1 = this.pendingLeg1;
        this._applyMrxMove((s) => doubleMoveMrX(s, [leg1, chosen]));
      }
    } else {
      const options = legalMovesForMrX(this.state).filter((m) => m.to === to);
      const chosen = pickTicket(options, preferBlack);
      if (!chosen) return;
      this._applyMrxMove((s) => moveMrX(s, chosen.to, chosen.ticket));
    }
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
    if (this.state.phase === "mrx" && this.viewerRoles.has("mrx")) {
      legalMoves = this.pendingLeg1 ? this._scratchLeg2Options() : legalMovesForMrX(this.state);
    }
    this.view.render(this.state, { legalMoves });
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
          this._applyMove((s) => (ready ? unlockDetective(s, d.id) : lockInDetective(s, d.id)));
        };
        row.appendChild(lockBtn);
      }

      container.appendChild(row);
    }
  }
}
