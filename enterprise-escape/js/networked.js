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
  controller.setViewerRoles(myRoles); // best-known roles at hand-off, corrected below on every update
  showScreen("game-screen");

  // Role claims are async writes (see lobby.js's setMyRoles), so the
  // snapshot lobby.js had at the moment Start Game was pressed can be
  // stale for whichever device's claim hadn't landed yet -- that device
  // would otherwise be permanently stuck with the wrong (possibly empty)
  // viewer roles for the whole game. Re-deriving from the live room data
  // on every update means it self-corrects the instant the real claim
  // arrives, instead of only ever reading it once.
  sync.subscribeRoom(code, (room) => {
    if (!room || !room.gameState) return;
    const liveRoles = (room.players && room.players[sync.clientId] && room.players[sync.clientId].roles) || [];
    controller.setViewerRoles(liveRoles);
    const state = sync.decodeGameState(room.gameState, board);
    controller.setState(state);
    if (isGameOver(state)) showEndScreen(state);
  });
}
