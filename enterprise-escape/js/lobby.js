import { createGame, parseRevealRounds } from "./engine.js";
import { settingsFromForm, populateForm, wireCapToggle } from "./settings-form.js";
import * as sync from "./sync.js";
import { startNetworkedGame } from "./networked.js";

const el = (id) => document.getElementById(id);

function showScreen(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.add("hidden");
  el(id).classList.remove("hidden");
}

const ROLE_LABELS = { mrx: "Fugitive", d1: "Crew 1", d2: "Crew 2" };

export function initLobby(board, controller) {
  const settingsForm = el("lobby-settings-form");
  const unlimitedField = settingsForm.querySelector('[name="maxCapturesUnlimited"]');
  const maxCapturesField = settingsForm.querySelector('[name="maxCaptures"]');
  unlimitedField.addEventListener("change", () => {
    maxCapturesField.disabled = unlimitedField.checked;
  });
  wireCapToggle(settingsForm, "det_movement_cap_enabled", "det_movement_cap");
  wireCapToggle(settingsForm, "mrx_movement_cap_enabled", "mrx_movement_cap");

  let code = null;
  let isHost = false;
  let unsubscribe = null;
  let lastKnownSettingsJSON = null;
  let suppressFormEvents = false;

  function enterRoom(roomCode) {
    code = roomCode;
    el("lobby-join-box").classList.add("hidden");
    el("lobby-room-box").classList.remove("hidden");
    el("lobby-room-code").textContent = code;
    // Only the host edits the ruleset and starts the game; everyone else
    // just picks a role against whatever the host has configured.
    settingsForm.classList.toggle("hidden", !isHost);
    el("lobby-start-btn").classList.toggle("hidden", !isHost);
    el("lobby-start-hint").classList.toggle("hidden", !isHost);
    unsubscribe = sync.subscribeRoom(code, onRoomUpdate);
  }

  function onRoomUpdate(room) {
    if (!room) return;
    if (room.phase === "playing") {
      if (unsubscribe) unsubscribe();
      const myRoles = (room.players && room.players[sync.clientId] && room.players[sync.clientId].roles) || [];
      startNetworkedGame(board, code, myRoles, controller);
      return;
    }
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
    // on live settings (detectiveCount, sharedDetectiveTurn), and a joining
    // client's form starts out at defaults until populateForm pulls in the
    // room's real values.
    renderMyRoleCheckboxes(room.players || {});
    updateStartButtonState(room);
    renderHowToPlay(sync.decodeSettings(room.settings));
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

    const stun = settings.stunDuration;
    el("htp-stun").textContent = `${stun} round${stun === 1 ? "" : "s"}`;

    const maxCaptures = settings.maxCaptures;
    el("htp-max-captures").textContent =
      maxCaptures === Infinity
        ? ""
        : ` If that happens ${maxCaptures} time${maxCaptures === 1 ? "" : "s"}, the Fugitive wins by default.`;

    const rounds = parseRevealRounds(settings.revealRounds);
    el("htp-reveals").textContent =
      rounds.length > 0
        ? `Every so often, the Fugitive's real location gets shown to everyone automatically -- rounds ${rounds.join(", ")}.`
        : `The Fugitive's real location is never shown automatically.`;
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
  // the UI level, rather than the settings-driven show/hide alone.
  function renderMyRoleCheckboxes(players) {
    const mine = (players[sync.clientId] && players[sync.clientId].roles) || [];
    const settings = settingsFromForm(settingsForm);
    const twoDetectives = settings.detectiveCount === 2;
    const useSharedUI = twoDetectives && settings.sharedDetectiveTurn;

    el("shared-turn-label").classList.toggle("hidden", !twoDetectives);
    el("lobby-shared-pool-label").classList.toggle("hidden", !twoDetectives);
    el("role-crew-shared-label").classList.toggle("hidden", !useSharedUI);
    el("role-d1-label").classList.toggle("hidden", useSharedUI);
    el("role-d2-label").classList.toggle("hidden", !twoDetectives || useSharedUI);

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
      checkbox.disabled = taken && !checked;
      el(statusId).textContent = taken ? " (taken)" : "";
    }

    applyRoleCheckbox("role-mrx", "role-mrx-status", "mrx", mine.includes("mrx"));
    if (useSharedUI) {
      const bothMine = mine.includes("d1") && mine.includes("d2");
      const taken = takenByOther("d1") || takenByOther("d2");
      const checkbox = el("role-crew-shared");
      checkbox.checked = bothMine;
      checkbox.disabled = taken && !bothMine;
      el("role-crew-shared-status").textContent = taken ? " (taken)" : "";
    } else {
      applyRoleCheckbox("role-d1", "role-d1-status", "d1", mine.includes("d1"));
      applyRoleCheckbox("role-d2", "role-d2-status", "d2", mine.includes("d2"));
    }
  }

  function currentMyRoles() {
    const roles = [];
    if (el("role-mrx").checked) roles.push("mrx");
    const settings = settingsFromForm(settingsForm);
    const useSharedUI = settings.detectiveCount === 2 && settings.sharedDetectiveTurn;
    if (useSharedUI) {
      if (el("role-crew-shared").checked) roles.push("d1", "d2");
    } else {
      if (el("role-d1").checked) roles.push("d1");
      if (el("role-d2").checked) roles.push("d2");
    }
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

  for (const id of ["role-mrx", "role-crew-shared", "role-d1", "role-d2"]) {
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
    const state = createGame(board, settings);
    await sync.startGame(code, state);
  });
}
