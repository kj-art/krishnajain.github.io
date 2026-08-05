import { createGame, parseRevealRounds, DETECTIVE_COLORS, DETECTIVE_IMAGES, TNG_CREW_COLORS } from "./engine.js";
import { settingsFromForm, populateForm, wireCapToggle } from "./settings-form.js";
import * as sync from "./sync.js";
import { startNetworkedGame } from "./networked.js";
import { wireGuiLayoutSelect } from "./layout-pref.js";

const el = (id) => document.getElementById(id);

function showScreen(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.add("hidden");
  el(id).classList.remove("hidden");
}

const ROLE_LABELS = { mrx: "Fugitive", d1: "Crew 1", d2: "Crew 2" };

export function initLobby(board, controller) {
  wireGuiLayoutSelect(el("lobby-gui-layout"));

  const settingsForm = el("lobby-settings-form");
  const unlimitedField = settingsForm.querySelector('[name="maxCapturesUnlimited"]');
  const maxCapturesField = settingsForm.querySelector('[name="maxCaptures"]');
  unlimitedField.addEventListener("change", () => {
    maxCapturesField.disabled = unlimitedField.checked;
  });
  wireCapToggle(settingsForm, "det_movement_cap_enabled", "det_movement_cap");
  wireCapToggle(settingsForm, "mrx_movement_cap_enabled", "mrx_movement_cap");

  // Badge art only makes sense once the host is playing Fugitive (it's the
  // host's nieces' characters, shown when the nieces are the ones playing
  // Crew) -- otherwise plain TNG red/gold, same as the eventual game will
  // use. Reactive to every room update (see renderCrewSwatches below), not
  // set once here, since it tracks the host's LIVE role pick, not a fixed
  // value -- backgroundColor, not the "background" shorthand, because the
  // shorthand resets background-size/position to their defaults, which
  // (being inline) then wins over the .swatch stylesheet rule that makes
  // the image actually cover the circle instead of showing its raw
  // top-left corner at 1:1.
  function renderCrewSwatches(hostIsFugitive) {
    const colors = hostIsFugitive ? DETECTIVE_COLORS : TNG_CREW_COLORS;
    el("role-d1-swatch").style.backgroundColor = colors[0];
    el("role-d1-swatch").style.backgroundImage = hostIsFugitive ? `url('${DETECTIVE_IMAGES[0]}')` : "";
    el("role-d2-swatch").style.backgroundColor = colors[1];
    el("role-d2-swatch").style.backgroundImage = hostIsFugitive ? `url('${DETECTIVE_IMAGES[1]}')` : "";
  }

  let code = null;
  let isHost = false;
  let unsubscribe = null;
  let lastKnownSettingsJSON = null;
  let suppressFormEvents = false;
  // True once this subscription has seen the room in "lobby" phase --
  // distinguishes "I was already here when the host started" (auto-jump
  // straight in, unchanged from before) from "I just joined/rejoined a
  // game that was already in progress" (needs the rejoin gate below,
  // since this device never got a chance to confirm/pick a role for it).
  let sawLobbyPhase = false;

  function enterRoom(roomCode) {
    code = roomCode;
    sawLobbyPhase = false;
    el("lobby-join-box").classList.add("hidden");
    el("lobby-room-box").classList.remove("hidden");
    el("lobby-room-code").textContent = code;
    el("lobby-rejoin-box").classList.add("hidden");
    // Only the host edits the ruleset and starts the game; everyone else
    // just picks a role against whatever the host has configured.
    settingsForm.classList.toggle("hidden", !isHost);
    el("lobby-start-btn").classList.toggle("hidden", !isHost);
    el("lobby-start-hint").classList.toggle("hidden", !isHost);
    unsubscribe = sync.subscribeRoom(code, onRoomUpdate);
  }

  // Shown once, the first time this device encounters a room that's
  // already "playing" -- lets a rejoining player confirm or pick a role
  // before dropping into the board, instead of silently resuming with
  // whatever they last had (or nothing, for a genuinely new device).
  //
  // There's no presence/heartbeat system here (that'd need something like
  // Firebase's onDisconnect hooks), so the app has no way to tell "this
  // role's claim is stale, its device is really gone" from "someone's
  // just idle for a minute" -- rather than risk permanently locking a
  // role because of that unknowable difference, this gate lets a role be
  // claimed even if it's currently held by someone else. That's a
  // deliberate trust call, fine for a family game with nobody adversarial;
  // it would NOT be fine for a version of this meant for strangers.
  function renderRejoinGate(room) {
    renderPlayers(room.players || {});
    suppressFormEvents = true;
    populateForm(settingsForm, sync.decodeSettings(room.settings));
    suppressFormEvents = false;
    renderMyRoleCheckboxes(room.players || {}, { allowStealing: true });
    settingsForm.classList.add("hidden");
    el("lobby-start-btn").classList.add("hidden");
    el("lobby-start-hint").classList.add("hidden");
    el("lobby-rejoin-box").classList.remove("hidden");
  }

  function onRoomUpdate(room) {
    if (!room) return;
    if (room.phase === "playing") {
      if (!sawLobbyPhase) {
        renderRejoinGate(room);
        return;
      }
      if (unsubscribe) unsubscribe();
      const myRoles = (room.players && room.players[sync.clientId] && room.players[sync.clientId].roles) || [];
      startNetworkedGame(board, code, myRoles, controller);
      return;
    }
    sawLobbyPhase = true;
    renderPlayers(room.players || {});

    const settingsJSON = JSON.stringify(room.settings);
    if (settingsJSON !== lastKnownSettingsJSON && document.activeElement && !settingsForm.contains(document.activeElement)) {
      lastKnownSettingsJSON = settingsJSON;
      suppressFormEvents = true;
      populateForm(settingsForm, sync.decodeSettings(room.settings));
      suppressFormEvents = false;
    } else if (lastKnownSettingsJSON === null) {
      lastKnownSettingsJSON = settingsJSON;
    }

    // Must run after the populateForm sync above -- role visibility depends
    // on live settings (detectiveCount), and a joining client's form starts
    // out at defaults until populateForm pulls in the room's real values.
    renderMyRoleCheckboxes(room.players || {});
    updateStartButtonState(room);
    renderHowToPlay(sync.decodeSettings(room.settings));

    const hostRoles = (room.hostId && room.players && room.players[room.hostId] && room.players[room.hostId].roles) || [];
    renderCrewSwatches(hostRoles.includes("mrx"));
  }

  // Only the parts of the rules that were vague placeholders before ("a
  // couple of rounds", "ask whoever set up the game") get filled in from
  // live settings -- everything else in the section is fixed prose that
  // doesn't depend on configuration, so it stays static.
  function renderHowToPlay(settings) {
    const costs = settings.movementCosts;
    const detRegen = settings.movementPools.detective.regen;
    const mrxRegen = settings.movementPools.mrx.regen;
    el("htp-movement-summary").textContent =
      `Corridor costs ${costs.taxi}, Tram costs ${costs.bus}, Turbolift costs ${costs.underground} -- ` +
      `the Crew gets ${detRegen} back each round, the Fugitive gets ${mrxRegen} back.`;

    const mrxDouble = settings.tickets.mrx.double;
    el("htp-double-move").classList.toggle("hidden", !(mrxDouble > 0));
    if (mrxDouble > 0) {
      el("htp-double-move").textContent =
        `The Fugitive also has ${mrxDouble} double-move ticket${mrxDouble === 1 ? "" : "s"}, letting them take two moves in a single turn.`;
    }

    const stun = settings.stunDuration;
    el("htp-stun").textContent = `${stun} round${stun === 1 ? "" : "s"}`;

    const maxCaptures = settings.maxCaptures;
    el("htp-max-captures").textContent =
      maxCaptures === Infinity
        ? ""
        : ` If that happens ${maxCaptures} time${maxCaptures === 1 ? "" : "s"}, the Fugitive wins by default.`;

    const rounds = parseRevealRounds(settings.revealRounds);
    const interval = settings.revealRoundsInterval;
    let revealText =
      "The Fugitive's starting position is shown on round 1, while everyone waits for their first move (they start in the brig, so there's nothing to hide yet) -- it disappears again the moment their turn ends";
    if (rounds.length > 0) revealText += `, then their location is shown again (this time after they've moved) on rounds ${rounds.join(", ")}`;
    revealText += interval > 0 ? `, then every ${interval} round${interval === 1 ? "" : "s"} after that.` : ", and never again after that.";
    el("htp-reveals").textContent = revealText;
  }

  function renderPlayers(players) {
    const container = el("lobby-players");
    const entries = Object.entries(players);
    if (entries.length === 0) {
      container.textContent = "No one here yet.";
      return;
    }
    container.innerHTML = entries
      .map(([pid, p]) => {
        const roles = (p.roles || []).map((r) => ROLE_LABELS[r] || r).join(", ") || "no role yet";
        const you = pid === sync.clientId ? " (you)" : "";
        return `<div>Player${you}: ${roles}</div>`;
      })
      .join("");
  }

  // A role checkbox is grayed out (disabled, "(taken)") whenever some OTHER
  // player already holds it -- this is what actually prevents conflicts at
  // the UI level, rather than the settings-driven show/hide alone. Crew 1
  // and Crew 2 are always shown as separate checkboxes -- one device
  // checking both is exactly "sharing a turn and a device," no separate
  // setting needed to pick between the two.
  // allowStealing: true (used only by the rejoin gate, see renderRejoinGate
  // above) drops the disabled state entirely -- there's no way to tell a
  // stale claim from someone who's just idle, so a late joiner can claim
  // ANY role, including ones that already show as held by someone else.
  // Pre-game, this stays off: a soft "(taken)" block is still useful there
  // to catch accidental double-claims while everyone's actively setting up
  // together, a genuinely different situation from rejoining mid-game.
  function renderMyRoleCheckboxes(players, { allowStealing = false } = {}) {
    const mine = (players[sync.clientId] && players[sync.clientId].roles) || [];
    const settings = settingsFromForm(settingsForm);
    const twoDetectives = settings.detectiveCount === 2;

    el("lobby-shared-pool-label").classList.toggle("hidden", !twoDetectives);
    el("role-d1-label").classList.remove("hidden");
    el("role-d2-label").classList.toggle("hidden", !twoDetectives);

    const claimedBy = {};
    for (const [pid, p] of Object.entries(players)) {
      for (const r of p.roles || []) {
        (claimedBy[r] = claimedBy[r] || []).push(pid);
      }
    }
    const takenByOther = (role) => (claimedBy[role] || []).some((pid) => pid !== sync.clientId);

    function applyRoleCheckbox(id, statusId, roleKey, checked) {
      const checkbox = el(id);
      const taken = takenByOther(roleKey);
      checkbox.checked = checked;
      checkbox.disabled = taken && !checked && !allowStealing;
      el(statusId).textContent = taken ? (allowStealing ? " (also claimed elsewhere)" : " (taken)") : "";
    }

    applyRoleCheckbox("role-mrx", "role-mrx-status", "mrx", mine.includes("mrx"));
    applyRoleCheckbox("role-d1", "role-d1-status", "d1", mine.includes("d1"));
    applyRoleCheckbox("role-d2", "role-d2-status", "d2", mine.includes("d2"));
  }

  function currentMyRoles() {
    const roles = [];
    if (el("role-mrx").checked) roles.push("mrx");
    if (el("role-d1").checked) roles.push("d1");
    if (el("role-d2").checked) roles.push("d2");
    return roles;
  }

  // Only the host has a Start Game button at all; it's gated purely on the
  // lobby being in a startable state -- every connected player has picked
  // a role, no role is double-claimed, and every role the current settings
  // need is covered. The host needs no one else's permission once that's
  // true.
  function validateRoomForStart(players, settings) {
    const entries = Object.entries(players);
    if (entries.length === 0) return "No one is in the room yet.";
    for (const [, p] of entries) {
      if (!p.roles || p.roles.length === 0) return "Someone hasn't picked a role yet.";
    }
    const claimCounts = {};
    for (const [, p] of entries) {
      for (const r of p.roles) claimCounts[r] = (claimCounts[r] || 0) + 1;
    }
    for (const [role, count] of Object.entries(claimCounts)) {
      if (count > 1) return `${ROLE_LABELS[role] || role} is claimed by more than one player.`;
    }
    if (!claimCounts.mrx) return "No one has claimed Fugitive yet.";
    if (!claimCounts.d1) return "No one has claimed Crew 1 yet.";
    if (settings.detectiveCount === 2 && !claimCounts.d2) return "No one has claimed Crew 2 yet.";
    return null;
  }

  function updateStartButtonState(room) {
    const settings = sync.decodeSettings(room.settings);
    const problem = validateRoomForStart(room.players || {}, settings);
    el("lobby-start-btn").disabled = !!problem;
    el("lobby-start-hint").textContent = problem || "";
  }

  for (const id of ["role-mrx", "role-d1", "role-d2"]) {
    el(id).addEventListener("change", () => {
      if (!code) return;
      sync.setMyRoles(code, currentMyRoles());
    });
  }

  settingsForm.addEventListener("input", () => {
    if (!code || suppressFormEvents) return;
    const settings = settingsFromForm(settingsForm);
    lastKnownSettingsJSON = JSON.stringify({
      ...settings,
      maxCaptures: settings.maxCaptures === Infinity ? "Infinity" : settings.maxCaptures,
    });
    sync.updateSettings(code, settings);
    // Don't re-render role checkboxes from a fabricated single-player
    // object here -- the real onRoomUpdate (triggered by this same write)
    // arrives moments later with the actual full players list. Rendering
    // from a partial stand-in risked racing against an in-flight role
    // claim from the same rapid input burst.
  });

  el("lobby-create-btn").addEventListener("click", async () => {
    const settings = settingsFromForm(settingsForm);
    const roomCode = await sync.createRoom(settings);
    isHost = true;
    enterRoom(roomCode);
  });

  el("lobby-join-btn").addEventListener("click", async () => {
    const input = el("lobby-join-code");
    const roomCode = input.value.trim().toUpperCase();
    if (!roomCode) return;
    try {
      await sync.joinRoom(roomCode);
      isHost = false;
      enterRoom(roomCode);
    } catch (err) {
      el("lobby-join-error").textContent = err.message;
    }
  });

  el("lobby-start-btn").addEventListener("click", async () => {
    if (el("lobby-start-btn").disabled) return;
    // settingsForm's values are authoritative for every client here, host
    // or not -- the host edits it directly, everyone else has it kept in
    // sync via populateForm even while it's hidden from their view.
    const settings = settingsFromForm(settingsForm);
    // This button only ever exists on the host's own device (see enterRoom
    // above), so currentMyRoles() here IS the host's roles.
    const hostIsFugitive = currentMyRoles().includes("mrx");
    const state = createGame(board, settings, { hostIsFugitive });
    await sync.startGame(code, state);
  });

  el("lobby-rejoin-continue-btn").addEventListener("click", () => {
    if (unsubscribe) unsubscribe();
    startNetworkedGame(board, code, currentMyRoles(), controller);
  });
}
