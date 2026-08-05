import { GameplayController } from "./gameplay.js";
import { startHotseat } from "./hotseat.js";
import { initLobby } from "./lobby.js";
import { applyGuiLayoutPref } from "./layout-pref.js";

const el = (id) => document.getElementById(id);

function showScreen(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.add("hidden");
  el(id).classList.remove("hidden");
}

async function main() {
  const res = await fetch("board.json");
  const board = await res.json();

  // A single GameplayController drives the shared #game-screen DOM for
  // both modes -- only one of hotseat.js / networked.js ever "owns" it at
  // a time (by reassigning controller.onLocalMove), since the user picks
  // exactly one mode per session.
  const controller = new GameplayController(el("board-canvas"), board, { onLocalMove: () => {} });
  applyGuiLayoutPref();

  startHotseat(board, controller);
  initLobby(board, controller);

  el("mode-hotseat-btn").addEventListener("click", () => showScreen("setup-screen"));
  el("mode-networked-btn").addEventListener("click", () => showScreen("lobby-screen"));
}

main();
