import { createGame } from "./engine.js";
import { settingsFromForm, populateForm } from "./settings-form.js";
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

  let code = null;
  let unsubscribe = null;
  let lastKnownSettingsJSON = null;
  let suppressFormEvents = false;

  function enterRoom(roomCode) {
    code = roomCode;
    el("lobby-join-box").classList.add("hidden");
    el("lobby-room-box").classList.remove("hidden");
    el("lobby-room-code").textContent = code;
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
    renderMyRoleCheckboxes(room.players || {});

    const settingsJSON = JSON.stringify(room.settings);
    if (settingsJSON !== lastKnownSettingsJSON && document.activeElement && !settingsForm.contains(document.activeElement)) {
      lastKnownSettingsJSON = settingsJSON;
      suppressFormEvents = true;
      populateForm(settingsForm, sync.decodeSettings(room.settings));
      suppressFormEvents = false;
    } else if (lastKnownSettingsJSON === null) {
      lastKnownSettingsJSON = settingsJSON;
    }

    updateStartButtonState(room.players || {});
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

  function renderMyRoleCheckboxes(players) {
    const mine = (players[sync.clientId] && players[sync.clientId].roles) || [];
    el("role-mrx").checked = mine.includes("mrx");

    const settings = settingsFromForm(settingsForm);
    const twoDetectives = settings.detectiveCount === 2;
    const useSharedUI = twoDetectives && settings.sharedDetectiveTurn;

    el("shared-turn-label").classList.toggle("hidden", !twoDetectives);
    el("role-crew-shared-label").classList.toggle("hidden", !useSharedUI);
    el("role-d1-label").classList.toggle("hidden", useSharedUI);
    el("role-d2-label").classList.toggle("hidden", !twoDetectives || useSharedUI);

    el("role-crew-shared").checked = mine.includes("d1") && mine.includes("d2");
    el("role-d1").checked = mine.includes("d1");
    el("role-d2").checked = mine.includes("d2");
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

  function updateStartButtonState(players) {
    const allRoles = Object.values(players).flatMap((p) => p.roles || []);
    const hasMrx = allRoles.includes("mrx");
    const hasDetective = allRoles.includes("d1") || allRoles.includes("d2");
    el("lobby-start-btn").disabled = !(hasMrx && hasDetective);
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
    renderMyRoleCheckboxes({ [sync.clientId]: { roles: currentMyRoles() } });
  });

  el("lobby-create-btn").addEventListener("click", async () => {
    const settings = settingsFromForm(settingsForm);
    const roomCode = await sync.createRoom(settings);
    enterRoom(roomCode);
  });

  el("lobby-join-btn").addEventListener("click", async () => {
    const input = el("lobby-join-code");
    const roomCode = input.value.trim().toUpperCase();
    if (!roomCode) return;
    try {
      await sync.joinRoom(roomCode);
      enterRoom(roomCode);
    } catch (err) {
      el("lobby-join-error").textContent = err.message;
    }
  });

  el("lobby-start-btn").addEventListener("click", async () => {
    const settings = settingsFromForm(settingsForm);
    const state = createGame(board, settings);
    await sync.startGame(code, state);
  });
}
