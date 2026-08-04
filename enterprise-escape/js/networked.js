import { isGameOver } from "./engine.js";
import * as sync from "./sync.js";

const el = (id) => document.getElementById(id);

function showScreen(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.add("hidden");
  el(id).classList.remove("hidden");
}

function showEndScreen(state) {
  const o = state.outcome;
  el("end-title").textContent = o.label || o.type;
  el("end-detail").textContent = o.type === "failure" ? "The Fugitive was captured too many times." : `The Fugitive reached ${o.exitKey}.`;
  showScreen("end-screen");
}

export function startNetworkedGame(board, code, myRoles, controller) {
  controller.onLocalMove = (state) => sync.pushGameState(code, state);
  controller.setViewerRoles(myRoles);
  showScreen("game-screen");

  sync.subscribeRoom(code, (room) => {
    if (!room || !room.gameState) return;
    const state = sync.decodeGameState(room.gameState, board);
    controller.setState(state);
    if (isGameOver(state)) showEndScreen(state);
  });
}
