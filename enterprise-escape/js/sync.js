// Serverless multiplayer sync via Firebase Realtime Database. No auth, no
// per-role security rules (test-mode rules) -- the trust model here is
// "nobody's going to open devtools," not adversarial. Hiding MrX from
// non-MrX clients is handled entirely in the render layer (see render.js),
// not here: this module happily reads/writes MrX's true position like
// everything else.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  get,
  onValue,
  off,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function randomRoomCode() {
  let code = "";
  for (let i = 0; i < 4; i++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  return code;
}

// sessionStorage, not localStorage: localStorage is shared across every tab
// of the same site, so two tabs on one browser (e.g. testing on one laptop)
// would silently collide into the same "player" and could end up sharing
// role claims -- including a crew tab inheriting the Fugitive role. Each
// tab getting its own identity by default matches how people will actually
// use this (one tab per physical device); running two detectives from one
// device is still done by checking both role boxes within that one tab.
function getOrCreateClientId() {
  let id = sessionStorage.getItem("sy_client_id");
  if (!id) {
    id = "c" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("sy_client_id", id);
  }
  return id;
}

export const clientId = getOrCreateClientId();

function encodeSettings(settings) {
  return {
    ...settings,
    maxCaptures: settings.maxCaptures === Infinity ? "Infinity" : settings.maxCaptures,
  };
}

export function decodeSettings(raw) {
  return {
    ...raw,
    maxCaptures: raw.maxCaptures === "Infinity" ? Infinity : raw.maxCaptures,
  };
}

// Firebase RTDB drops any key whose value is `null` (equivalent to a
// delete), so every optional field has to be defaulted back on the way out
// rather than trusted to round-trip literally.
export function encodeGameState(state) {
  const { board, ...rest } = state;
  return {
    ...rest,
    settings: encodeSettings(state.settings),
    lastReveal: state.lastReveal || null,
    lastCapture: state.lastCapture || null,
    outcome: state.outcome || null,
    staging: state.staging || {},
    readyDetectives: state.readyDetectives || [],
    detectives: state.detectives.map((d) => ({ ...d, stunnedUntilRound: d.stunnedUntilRound ?? null })),
  };
}

export function decodeGameState(raw, board) {
  if (!raw) return null;
  return {
    ...raw,
    board,
    settings: decodeSettings(raw.settings),
    lastReveal: raw.lastReveal || null,
    lastCapture: raw.lastCapture || null,
    outcome: raw.outcome || null,
    staging: raw.staging || {},
    readyDetectives: raw.readyDetectives || [],
    log: raw.log || [],
    detectives: (raw.detectives || []).map((d) => ({ ...d, stunnedUntilRound: d.stunnedUntilRound ?? null })),
  };
}

export async function createRoom(initialSettings) {
  const code = randomRoomCode();
  await set(ref(db, `rooms/${code}`), {
    phase: "lobby",
    hostId: clientId,
    settings: encodeSettings(initialSettings),
    players: { [clientId]: { roles: [], joinedAt: Date.now() } },
  });
  return code;
}

export async function joinRoom(code) {
  const roomRef = ref(db, `rooms/${code}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error("Room not found");
  await update(ref(db, `rooms/${code}/players/${clientId}`), {
    roles: [],
    joinedAt: Date.now(),
  });
  return snap.val();
}

export function subscribeRoom(code, callback) {
  const roomRef = ref(db, `rooms/${code}`);
  const handler = (snap) => callback(snap.val());
  onValue(roomRef, handler);
  return () => off(roomRef, "value", handler);
}

// Roles are advisory, not exclusively locked -- a single client (e.g. one
// laptop) may hold multiple roles (running two detectives solo), and
// nothing stops two clients claiming the same role (two kids sharing MrX
// on one iPad is exactly one client anyway). The transaction just avoids
// two near-simultaneous writes clobbering each other's role lists.
export async function setMyRoles(code, roles) {
  const playersRef = ref(db, `rooms/${code}/players`);
  await runTransaction(playersRef, (players) => {
    players = players || {};
    players[clientId] = { ...(players[clientId] || {}), roles, joinedAt: (players[clientId] && players[clientId].joinedAt) || Date.now() };
    return players;
  });
}

export async function updateSettings(code, settings) {
  await set(ref(db, `rooms/${code}/settings`), encodeSettings(settings));
}

export async function startGame(code, initialGameState) {
  await update(ref(db, `rooms/${code}`), {
    phase: "playing",
    gameState: encodeGameState(initialGameState),
  });
}

export async function pushGameState(code, state) {
  await set(ref(db, `rooms/${code}/gameState`), encodeGameState(state));
}
