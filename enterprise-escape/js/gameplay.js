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
  passMrX,
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
  DETECTIVE_IMAGES,
  upcomingRevealRounds,
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

// A click always auto-picks the cheapest natural (non-black) route to that
// destination -- cost-aware rather than a fixed kind order, since costs are
// now a configurable setting -- and just moves you, no pre-selection toggle
// to remember. Black is a separate decision made AFTER a move is chosen
// (see the per-move "Hide this move" checkboxes in _renderMrxPlanRows),
// except when black is truly the only way to reach that destination at all,
// in which case it's picked automatically since there's no other option.
function pickTicket(options) {
  const natural = options.filter((o) => o.ticket !== "black");
  if (natural.length > 0) {
    return natural.reduce((best, o) => (o.cost < best.cost ? o : best));
  }
  return options[0] || null;
}

// One highlight ring per destination, colored by whichever ticket
// pickTicket would actually spend to get there -- so the ring itself is
// the answer to "what will this cost me," visible before you ever click.
function resolvedDestinations(options) {
  const byDestination = new Map();
  for (const opt of options) {
    if (!byDestination.has(opt.to)) byDestination.set(opt.to, []);
    byDestination.get(opt.to).push(opt);
  }
  const result = [];
  for (const [to, opts] of byDestination) {
    const chosen = pickTicket(opts);
    if (chosen) result.push({ to, ticket: chosen.ticket });
  }
  return result;
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
    // null | { type: "single", to, naturalTicket, cost, useBlack }
    //      | { type: "double", leg1: {to,naturalTicket,cost,useBlack}, leg2: null|{...} }
    //      | { type: "pass", naturalTicket: "pass", cost: 0, useBlack }
    // Purely local UI state -- never committed to the engine (and never
    // synced) until the Fugitive explicitly presses End Turn and confirms.
    this.mrxPlan = null;
    // Which of this device's own detectives the board is currently wired to
    // -- clicking a station stages a move for THIS one. Purely local UI
    // state, re-derived (not reset) on every render so it survives staging/
    // locking actions and only changes when the player taps another crew
    // member's panel or the previous active one stops being controllable.
    this.activeDetectiveId = null;

    canvas.addEventListener("click", (evt) => this._onCanvasClick(evt));
    el("mrx-double-toggle").addEventListener("change", () => {
      this.mrxPlan = null;
      this._renderMrxPanel();
      this._renderBoard();
    });
    el("mrx-pass-btn").addEventListener("click", () => {
      this.mrxPlan = { type: "pass", naturalTicket: "pass", cost: 0, useBlack: false };
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
    return (
      this.mrxPlan.type === "single" ||
      this.mrxPlan.type === "pass" ||
      (this.mrxPlan.type === "double" && this.mrxPlan.leg2)
    );
  }

  // The ticket actually spent for a leg: black if the player checked "hide
  // this move" AND black is what naturalTicket already is not (nothing to
  // swap if it's already black because it was the only option available).
  _effectiveTicket(leg) {
    return leg.useBlack && leg.naturalTicket !== "black" ? "black" : leg.naturalTicket;
  }

  // How many black tickets are left to offer THIS leg's checkbox, after
  // accounting for the OTHER leg (if any) already claiming some -- this is
  // what lets the checkbox disable itself with "no Black tickets left"
  // instead of silently allowing an over-commitment.
  _blackAvailableExcluding(legKey) {
    let used = 0;
    if (this.mrxPlan.type === "double") {
      if (legKey !== "leg1" && this.mrxPlan.leg1.useBlack) used++;
      if (legKey !== "leg2" && this.mrxPlan.leg2 && this.mrxPlan.leg2.useBlack) used++;
    }
    return this.state.mrx.tickets.black - used;
  }

  _setLegUseBlack(legKey, value) {
    if (legKey === "leg1") {
      this.mrxPlan = { ...this.mrxPlan, leg1: { ...this.mrxPlan.leg1, useBlack: value } };
    } else if (legKey === "leg2") {
      this.mrxPlan = { ...this.mrxPlan, leg2: { ...this.mrxPlan.leg2, useBlack: value } };
    } else {
      // "single" or "pass" -- both keep their data directly on the plan.
      this.mrxPlan = { ...this.mrxPlan, useBlack: value };
    }
    this._renderMrxPlanRows();
  }

  // One row per chosen move (one for a single move or a Pass, one or two
  // for a double), each showing the effective ticket and -- unless that
  // move can only ever be black anyway -- a checkbox to hide it.
  _renderMrxPlanRows() {
    const container = el("mrx-plan-rows");
    container.innerHTML = "";
    if (!this.mrxPlan) return;

    const legs =
      this.mrxPlan.type === "double"
        ? [
            { key: "leg1", data: this.mrxPlan.leg1, label: "Leg 1" },
            ...(this.mrxPlan.leg2 ? [{ key: "leg2", data: this.mrxPlan.leg2, label: "Leg 2" }] : []),
          ]
        : [{ key: this.mrxPlan.type, data: this.mrxPlan, label: null }];

    for (const { key, data, label } of legs) {
      const row = document.createElement("div");
      row.className = "mrx-plan-row";
      const prefix = label ? `${label}: ` : "";
      const description = data.to != null ? `${prefix}To ${data.to} via ${ticketSpan(this.board, this._effectiveTicket(data))}` : `${prefix}Stay put this turn`;
      row.innerHTML = `<div>${description}</div>`;

      if (data.naturalTicket !== "black") {
        const blackLeft = this._blackAvailableExcluding(key);
        const canCheck = data.useBlack || blackLeft > 0;
        const wrap = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = data.useBlack;
        cb.disabled = !canCheck;
        cb.onchange = () => this._setLegUseBlack(key, cb.checked);
        wrap.appendChild(cb);
        wrap.append(` Hide this move (use Black ticket)${!canCheck ? " — no Black tickets left" : ""}`);
        row.appendChild(wrap);
      }

      container.appendChild(row);
    }
  }

  // Nothing actually moves until this fires -- clicking the board only
  // ever stages mrxPlan. End Turn asks for an explicit confirmation before
  // the move (and any exit-commit prompt that follows it) actually happens.
  _commitMrxPlan() {
    if (!this._mrxPlanComplete()) return;
    const plan = this.mrxPlan;
    let description;
    if (plan.type === "pass") {
      description = this._effectiveTicket(plan) === "black" ? "Stay put this turn (hidden)" : "Stay put this turn";
    } else if (plan.type === "single") {
      description = `Move to ${plan.to} via ${ticketLabel(this._effectiveTicket(plan))}`;
    } else {
      description = `Move to ${plan.leg1.to} via ${ticketLabel(this._effectiveTicket(plan.leg1))}, then to ${plan.leg2.to} via ${ticketLabel(this._effectiveTicket(plan.leg2))}`;
    }
    if (!window.confirm(`${description}. End your turn?`)) return;
    if (plan.type === "pass") {
      const useBlack = this._effectiveTicket(plan) === "black";
      this.mrxPlan = null;
      this._applyMrxMove((s) => passMrX(s, useBlack));
    } else if (plan.type === "single") {
      const ticket = this._effectiveTicket(plan);
      this.mrxPlan = null;
      this._applyMrxMove((s) => moveMrX(s, plan.to, ticket));
    } else {
      const moves = [
        { to: plan.leg1.to, ticket: this._effectiveTicket(plan.leg1) },
        { to: plan.leg2.to, ticket: this._effectiveTicket(plan.leg2) },
      ];
      this.mrxPlan = null;
      this._applyMrxMove((s) => doubleMoveMrX(s, moves));
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

  // Cost is invariant to whether leg1 ends up hidden via black -- black is
  // always offered at the same (cheapest) cost as the natural route it
  // stands in for -- so the stored leg1.cost is safe to use here regardless
  // of the current state of leg1's "hide this move" checkbox.
  _scratchLeg2Options() {
    const leg1 = this.mrxPlan.leg1;
    const usedBlack = this._effectiveTicket(leg1) === "black";
    const scratch = {
      ...this.state,
      mrx: {
        ...this.state.mrx,
        position: leg1.to,
        movement: this.state.mrx.movement - leg1.cost,
        tickets: usedBlack ? { ...this.state.mrx.tickets, black: this.state.mrx.tickets.black - 1 } : this.state.mrx.tickets,
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
    if (el("mrx-double-toggle").checked) {
      const needLeg1 = !this.mrxPlan || this.mrxPlan.type !== "double" || this.mrxPlan.leg2;
      if (needLeg1) {
        const options = legalMovesForMrX(this.state).filter((m) => m.to === to);
        const chosen = pickTicket(options);
        if (!chosen) return;
        this.mrxPlan = {
          type: "double",
          leg1: { to: chosen.to, naturalTicket: chosen.ticket, cost: chosen.cost, useBlack: false },
          leg2: null,
        };
      } else {
        const options = this._scratchLeg2Options().filter((m) => m.to === to);
        const chosen = pickTicket(options);
        if (!chosen) return;
        this.mrxPlan = { ...this.mrxPlan, leg2: { to: chosen.to, naturalTicket: chosen.ticket, cost: chosen.cost, useBlack: false } };
      }
    } else {
      const options = legalMovesForMrX(this.state).filter((m) => m.to === to);
      const chosen = pickTicket(options);
      if (!chosen) return;
      this.mrxPlan = { type: "single", to: chosen.to, naturalTicket: chosen.ticket, cost: chosen.cost, useBlack: false };
    }
    this._renderMrxPanel();
    this._renderBoard();
  }

  // Which of this device's detectives the board is "wired to" for the next
  // click -- clicking a crew panel (outside its own buttons) switches this,
  // so on a shared device with two crew members, only one at a time is ever
  // ambiguous about whose move a board click means.
  _ensureActiveDetective() {
    const controllable = this.state.detectives.filter(
      (d) => this.viewerRoles.has(d.id) && !isStunned(d, this.state.round)
    );
    if (!controllable.some((d) => d.id === this.activeDetectiveId)) {
      this.activeDetectiveId = controllable[0] ? controllable[0].id : null;
    }
  }

  _handleDetectiveClick(to) {
    if (!this.activeDetectiveId) return;
    const detective = this.state.detectives.find((d) => d.id === this.activeDetectiveId);
    if (!detective) return;
    const legal = legalMovesForDetective(this.state, detective.id).some((m) => m.to === to);
    if (!legal) return;
    this._stageDetectiveTo(detective, to);
  }

  _stageDetectiveTo(detective, to) {
    const options = legalMovesForDetective(this.state, detective.id).filter((m) => m.to === to);
    const chosen = pickTicket(options);
    if (!chosen) return;
    this._applyMove((s) => stageDetectiveMove(s, detective.id, chosen.to, chosen.ticket));
  }

  _renderAll() {
    if (this.state.phase === "detectives") this._ensureActiveDetective();
    this._renderRoundInfo();
    this._renderTransportLog();
    this._renderCaptureBanner();
    this._renderMrxPanel();
    this._renderDetectivesPanel();
    this._renderRevealSchedule();
    this._renderBoard();
  }

  // Public to both sides -- the SCHEDULE of when the Fugitive's position
  // gets shown is common knowledge either way, only the position itself is
  // sometimes hidden. Reads like a dial: the current/upcoming round is
  // always first, and it shifts forward as rounds pass. Renders a generous
  // batch (far more than could ever fit, even on an ultrawide screen) and
  // lets the row's own overflow:hidden clip it to whatever actually fits --
  // no resize listener needed, it just adapts on its own at every width.
  _renderRevealSchedule() {
    const upcoming = upcomingRevealRounds(this.state.round, this.state.settings, 40);
    const parts = upcoming.map((r) => {
      const isNow = r === this.state.round;
      return `<span class="round${isNow ? " now" : ""}">${r}${isNow ? " (now)" : ""}</span>`;
    });
    el("reveal-schedule").innerHTML = `<span class="label">Fugitive exposed on rounds:</span>${parts.join("")}`;
  }

  _renderBoard() {
    let legalMoves = [];
    let mrxPending = [];
    if (this.state.phase === "mrx" && this.viewerRoles.has("mrx")) {
      const pickingLeg2 = this.mrxPlan && this.mrxPlan.type === "double" && !this.mrxPlan.leg2;
      const rawOptions = pickingLeg2 ? this._scratchLeg2Options() : legalMovesForMrX(this.state);
      legalMoves = resolvedDestinations(rawOptions);
      if (this.mrxPlan && this.mrxPlan.type === "single") {
        mrxPending = [this.mrxPlan.to];
      } else if (this.mrxPlan && this.mrxPlan.type === "double") {
        mrxPending = [this.mrxPlan.leg1.to, ...(this.mrxPlan.leg2 ? [this.mrxPlan.leg2.to] : [])];
      }
      // "pass" has no destination to mark.
    }
    const activeDetectiveId = this.state.phase === "detectives" ? this.activeDetectiveId : null;
    this.view.render(this.state, { legalMoves, mrxPending, activeDetectiveId });
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
    const startingTickets = this.state.settings.tickets.mrx;
    const pool = this.state.settings.movementPools.mrx;
    const capText = pool.capEnabled ? `/${pool.cap}` : "";
    const parts = [`Movement: ${this.state.mrx.movement}${capText}`];
    if (startingTickets.black > 0) parts.push(`Black: ${t.black}`);
    if (startingTickets.double > 0) parts.push(`Double: ${t.double}`);
    el("mrx-tickets").innerHTML = parts.join(" &nbsp; ");
    // A double-move ticket count of 0 in settings means the whole feature is
    // off for this game -- hide the toggle rather than just disabling it, so
    // it doesn't read as a broken/greyed-out control.
    const hasDouble = startingTickets.double > 0;
    el("mrx-double-wrap").classList.toggle("hidden", !hasDouble);
    el("mrx-double-toggle").disabled = t.double === 0;

    const pickingLeg2 = this.mrxPlan && this.mrxPlan.type === "double" && !this.mrxPlan.leg2;
    el("mrx-double-status").textContent = pickingLeg2 ? "Pick your second destination." : "";
    this._renderMrxPlanRows();
    el("mrx-clear-btn").classList.toggle("hidden", !this.mrxPlan);
    el("mrx-end-turn-btn").disabled = !this._mrxPlanComplete();
  }

  _renderDetectivesPanel() {
    if (this.state.phase !== "detectives") return;
    el("detectives-panel").classList.remove("hidden");
    el("mrx-panel").classList.add("hidden");

    const container = el("detective-rows");
    container.innerHTML = "";
    const multipleControllable = this.state.detectives.filter((d) => this.viewerRoles.has(d.id)).length > 1;
    for (const d of this.state.detectives) {
      const row = document.createElement("div");
      row.className = "detective-row";
      const stunned = isStunned(d, this.state.round);
      if (stunned) row.classList.add("stunned");
      const controllable = this.viewerRoles.has(d.id);
      const staged = this.state.staging[d.id];
      const ready = this.state.readyDetectives.includes(d.id);
      if (ready) row.classList.add("ready");
      const active = controllable && !stunned && d.id === this.activeDetectiveId;
      if (active) {
        row.classList.add("active");
        row.style.borderColor = d.color;
      }

      const t = d.tickets;
      let statusHtml;
      if (stunned) {
        statusHtml = `<div>Stunned until round ${d.stunnedUntilRound}</div>`;
      } else if (staged) {
        statusHtml = `<div>Moving to ${staged.to} via ${ticketSpan(this.board, staged.ticket)}</div>`;
      } else if (ready) {
        statusHtml = `<div>Staying put</div>`;
      } else if (controllable && active) {
        statusHtml = `<div>Tap a highlighted station to move…</div>`;
      } else if (controllable) {
        statusHtml = `<div>Tap here to control Crew ${d.id.slice(1)}</div>`;
      } else {
        statusHtml = `<div><em>Still deciding…</em></div>`;
      }

      const pool = this.state.settings.movementPools.detective;
      const capText = pool.capEnabled ? `/${pool.cap}` : "";
      const sharedNote = this.state.settings.sharedDetectivePool ? " (shared)" : "";
      const blackHtml = this.state.settings.tickets.detective.black > 0 ? ` &nbsp; Black: ${t.black}` : "";
      const image = this.state.crewBadgeImages ? DETECTIVE_IMAGES[Number(d.id.slice(1)) - 1] : null;
      const imageHtml = image ? `background-image:url('${image}')` : "";
      row.innerHTML = `
        <span class="swatch" style="background-color:${d.color};${imageHtml}"></span>
        <strong>Crew ${d.id.slice(1)}</strong> — at station ${d.position}
        <div>Movement: ${d.movement}${capText}${sharedNote}${blackHtml}</div>
        ${statusHtml}
        ${ready ? '<div class="locked-badge">Locked in ✓</div>' : ""}
      `;

      if (!stunned && controllable) {
        // The row itself is the "control this crew member" button -- only
        // suppressed for a click that actually landed on one of the buttons
        // below, which handle their own action instead.
        if (multipleControllable) {
          row.addEventListener("click", (evt) => {
            if (evt.target.closest("button")) return;
            this.activeDetectiveId = d.id;
            this._renderDetectivesPanel();
            this._renderBoard();
          });
        }
        if (staged) {
          const clearBtn = document.createElement("button");
          clearBtn.textContent = "Stay put instead";
          clearBtn.onclick = () => {
            // Reverting to your own real station isn't always legal
            // anymore -- someone else may have since staged (or locked
            // in) a move that lands them exactly there. The map's click
            // targets are pre-filtered to only ever offer legal moves, so
            // this is the one detective action that can still hit an
            // engine-level rejection through completely normal use.
            try {
              this._applyMove((s) => unstageDetectiveMove(s, d.id));
            } catch (err) {
              window.alert(err.message);
            }
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
          // Only the lock-in that actually ends the turn needs a confirm --
          // locking in while someone else still hasn't is fully reversible
          // (there's an Unlock button right there), so a popup on every
          // single lock-in is just friction on a shared device where both
          // crew members are clicking through the same screen in a row.
          const wouldEndTurn = allDetectivesReady({ ...this.state, readyDetectives: [...this.state.readyDetectives, d.id] });
          if (wouldEndTurn && !window.confirm(`Lock in Crew ${d.id.slice(1)}, ${destDescription}? This ends the turn -- the Fugitive goes next.`)) {
            return;
          }
          // Hand the board straight to whichever other crew member hasn't
          // locked in yet -- saves an extra tap to switch on a shared device.
          const next = this.state.detectives.find(
            (other) =>
              other.id !== d.id &&
              this.viewerRoles.has(other.id) &&
              !isStunned(other, this.state.round) &&
              !this.state.readyDetectives.includes(other.id)
          );
          if (next) this.activeDetectiveId = next.id;
          this._applyMove((s) => lockInDetective(s, d.id));
        };
        row.appendChild(lockBtn);
      }

      container.appendChild(row);
    }
  }
}
