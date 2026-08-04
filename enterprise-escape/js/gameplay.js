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
  commitDetectiveTurn,
  isGameOver,
} from "./engine.js";
import { BoardView } from "./render.js";

const el = (id) => document.getElementById(id);

function getCanvasCoords(evt, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return [(evt.clientX - rect.left) * scaleX, (evt.clientY - rect.top) * scaleY];
}

function showChooser(container, options, ticketCounts, onChosen) {
  container.innerHTML = "";
  container.classList.remove("hidden");
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.className = "ticket-choice-btn";
    btn.textContent = `${opt.ticket} (${ticketCounts[opt.ticket]} left)`;
    btn.onclick = () => {
      container.classList.add("hidden");
      container.innerHTML = "";
      onChosen(opt);
    };
    container.appendChild(btn);
  }
}

function resolveClick(options, ticketCounts, chooserEl, onChosen) {
  if (options.length === 0) return;
  if (options.length === 1) onChosen(options[0]);
  else showChooser(chooserEl, options, ticketCounts, onChosen);
}

export class GameplayController {
  constructor(canvas, board, { onLocalMove }) {
    this.canvas = canvas;
    this.board = board;
    this.onLocalMove = onLocalMove;
    this.view = new BoardView(canvas, board);
    this.viewerRoles = new Set();
    this.state = null;
    this.armedDetectiveId = null;
    this.pendingLeg1 = null;

    canvas.addEventListener("click", (evt) => this._onCanvasClick(evt));
    el("end-turn-btn").addEventListener("click", () => {
      if (!this.state || this.state.phase !== "detectives") return;
      const controlsADetective = this.state.detectives.some((d) => this.viewerRoles.has(d.id));
      if (!controlsADetective) return;
      if (!window.confirm("Lock in this turn? You won't be able to change your moves after this.")) return;
      this._applyMove((s) => commitDetectiveTurn(s));
    });
    el("mrx-double-toggle").addEventListener("change", (evt) => {
      this.pendingLeg1 = null;
      el("mrx-double-status").textContent = evt.target.checked ? "Pick your first destination." : "";
      el("ticket-chooser").classList.add("hidden");
      this._renderBoard();
    });
  }

  setViewerRoles(roles) {
    this.viewerRoles = new Set(roles);
    this.view.setViewerRoles(this.viewerRoles);
  }

  setState(state) {
    this.state = state;
    this.armedDetectiveId = null;
    this.pendingLeg1 = null;
    el("mrx-double-toggle").checked = false;
    el("mrx-double-status").textContent = "";
    this._renderAll();
  }

  _applyMove(mutator) {
    const newState = mutator(this.state);
    this.setState(newState);
    this.onLocalMove(newState);
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
      if (!this.armedDetectiveId || !this.viewerRoles.has(this.armedDetectiveId)) return;
      this._handleDetectiveClick(to);
    }
  }

  _handleMrxClick(to) {
    const toggle = el("mrx-double-toggle");
    if (toggle.checked) {
      if (!this.pendingLeg1) {
        const options = legalMovesForMrX(this.state).filter((m) => m.to === to);
        resolveClick(options, this.state.mrx.tickets, el("ticket-chooser"), (chosen) => {
          this.pendingLeg1 = chosen;
          el("mrx-double-status").textContent = `Leg 1: → ${chosen.to} via ${chosen.ticket}. Pick your second destination.`;
          this._renderBoard();
        });
      } else {
        const scratchTickets = { ...this.state.mrx.tickets, [this.pendingLeg1.ticket]: this.state.mrx.tickets[this.pendingLeg1.ticket] - 1 };
        const options = this._scratchLeg2Options().filter((m) => m.to === to);
        resolveClick(options, scratchTickets, el("ticket-chooser"), (chosen) => {
          const leg1 = this.pendingLeg1;
          this._applyMove((s) => doubleMoveMrX(s, [leg1, chosen]));
        });
      }
    } else {
      const options = legalMovesForMrX(this.state).filter((m) => m.to === to);
      resolveClick(options, this.state.mrx.tickets, el("ticket-chooser"), (chosen) => {
        this._applyMove((s) => moveMrX(s, chosen.to, chosen.ticket));
      });
    }
  }

  _handleDetectiveClick(to) {
    const detectiveId = this.armedDetectiveId;
    const detective = this.state.detectives.find((d) => d.id === detectiveId);
    const options = legalMovesForDetective(this.state, detectiveId).filter((m) => m.to === to);
    resolveClick(options, detective.tickets, el("ticket-chooser-det"), (chosen) => {
      const newState = stageDetectiveMove(this.state, detectiveId, chosen.to, chosen.ticket);
      this.armedDetectiveId = null;
      this.setState(newState);
      this.onLocalMove(newState);
    });
  }

  _renderAll() {
    this._renderRoundInfo();
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
    const canAct = this.state.phase === "mrx" && this.viewerRoles.has("mrx");
    const isMrxTurn = this.state.phase === "mrx";
    if (!isMrxTurn && !this.viewerRoles.has("mrx")) {
      panel.classList.add("hidden");
    } else {
      panel.classList.remove("hidden");
    }
    el("detectives-panel").classList.toggle("hidden", isMrxTurn);

    if (!isMrxTurn) return;

    if (!this.viewerRoles.has("mrx")) {
      el("mrx-tickets").textContent = "Waiting for the Fugitive to move…";
      el("mrx-double-toggle").parentElement.classList.add("hidden");
      return;
    }
    el("mrx-double-toggle").parentElement.classList.remove("hidden");
    const t = this.state.mrx.tickets;
    el("mrx-tickets").innerHTML =
      `Taxi: ${t.taxi} &nbsp; Bus: ${t.bus} &nbsp; Underground: ${t.underground} &nbsp; Black: ${t.black} &nbsp; Double: ${t.double}`;
    el("mrx-double-toggle").disabled = t.double === 0;
    void canAct;
  }

  _renderDetectivesPanel() {
    if (this.state.phase !== "detectives") return;
    el("detectives-panel").classList.remove("hidden");
    el("mrx-panel").classList.add("hidden");

    const controlsADetective = this.state.detectives.some((d) => this.viewerRoles.has(d.id));
    el("end-turn-btn").classList.toggle("hidden", !controlsADetective);

    const container = el("detective-rows");
    container.innerHTML = "";
    for (const d of this.state.detectives) {
      const row = document.createElement("div");
      row.className = "detective-row";
      if (d.id === this.armedDetectiveId) row.classList.add("armed");
      const stunned = d.stunnedUntilRound != null && this.state.round < d.stunnedUntilRound;
      if (stunned) row.classList.add("stunned");
      const controllable = this.viewerRoles.has(d.id);

      const staged = this.state.staging[d.id];
      const t = d.tickets;
      row.innerHTML = `
        <span class="swatch" style="background:${d.color}"></span>
        <strong>Crew ${d.id.slice(1)}</strong> — at station ${d.position}
        ${stunned ? `<div>Stunned until round ${d.stunnedUntilRound}</div>` : ""}
        <div>Taxi: ${t.taxi} &nbsp; Bus: ${t.bus} &nbsp; Underground: ${t.underground} &nbsp; Black: ${t.black}</div>
        ${staged ? `<div>Moving to ${staged.to} via ${staged.ticket}</div>` : ""}
        ${!controllable ? "<div><em>Not yours to move</em></div>" : ""}
      `;

      if (!stunned && controllable) {
        if (staged) {
          const undoBtn = document.createElement("button");
          undoBtn.textContent = "Undo";
          undoBtn.onclick = () => {
            const newState = unstageDetectiveMove(this.state, d.id);
            this.armedDetectiveId = null;
            this.setState(newState);
            this.onLocalMove(newState);
          };
          row.appendChild(undoBtn);
        } else {
          const moveBtn = document.createElement("button");
          moveBtn.textContent = this.armedDetectiveId === d.id ? "Click a highlighted station…" : "Move";
          moveBtn.onclick = () => {
            this.armedDetectiveId = this.armedDetectiveId === d.id ? null : d.id;
            this._renderDetectivesPanel();
            this._renderBoard();
          };
          row.appendChild(moveBtn);
        }
      }

      container.appendChild(row);
    }
  }
}
