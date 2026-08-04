import { createGame, isGameOver } from "./engine.js";
import { settingsFromForm, wireCapToggle } from "./settings-form.js";

const el = (id) => document.getElementById(id);

function showScreen(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.add("hidden");
  el(id).classList.remove("hidden");
}

// Takes the single shared GameplayController (see main.js) rather than
// constructing its own -- hotseat and networked mode both drive the same
// #game-screen DOM, so only one controller may ever be attached to it at a
// time, with onLocalMove reassigned depending on which mode is active.
export function startHotseat(board, controller) {
  const setupForm = el("setup-form");
  const maxCapturesUnlimited = setupForm.querySelector('[name="maxCapturesUnlimited"]');
  const maxCapturesInput = setupForm.querySelector('[name="maxCaptures"]');
  maxCapturesUnlimited.addEventListener("change", () => {
    maxCapturesInput.disabled = maxCapturesUnlimited.checked;
  });

  wireCapToggle(setupForm, "det_movement_cap_enabled", "det_movement_cap");
  wireCapToggle(setupForm, "mrx_movement_cap_enabled", "mrx_movement_cap");

  const detectiveCountRadios = setupForm.querySelectorAll('[name="detectiveCount"]');
  const sharedPoolLabel = el("setup-shared-pool-label");
  const updateSharedPoolVisibility = () => {
    const twoDetectives = setupForm.querySelector('[name="detectiveCount"]:checked').value === "2";
    sharedPoolLabel.classList.toggle("hidden", !twoDetectives);
  };
  detectiveCountRadios.forEach((r) => r.addEventListener("change", updateSharedPoolVisibility));
  updateSharedPoolVisibility();

  controller.onLocalMove = (state) => afterStateChange(state);

  // onLocalMove now fires for every granular action (a detective staging a
  // move, locking in, unlocking) since the lock-in model needs each crew
  // member's action synced independently -- not just for a full turn
  // commit like the old single "End Turn" button. The airlock should only
  // appear on an actual phase handoff, so track the phase we last showed
  // and ignore same-phase updates.
  let currentPhase = null;

  function goToAirlock(message, onContinue) {
    el("airlock-message").textContent = message;
    showScreen("airlock-screen");
    const btn = el("airlock-continue");
    const handler = () => {
      btn.removeEventListener("click", handler);
      onContinue();
    };
    btn.addEventListener("click", handler);
  }

  function showEndScreen(state) {
    const o = state.outcome;
    el("end-title").textContent = o.label || o.type;
    el("end-detail").textContent = o.type === "failure" ? "The Fugitive was captured too many times." : `The Fugitive reached ${o.exitKey}.`;
    showScreen("end-screen");
  }

  function afterStateChange(state) {
    if (isGameOver(state)) {
      showEndScreen(state);
      return;
    }
    if (state.phase === currentPhase) return; // same-phase local action, no handoff yet
    currentPhase = state.phase;
    if (state.phase === "mrx") {
      goToAirlock("The Enterprise Crew's moves are locked in. Hand the device to the Fugitive.", () => {
        controller.setViewerRoles(["mrx"]);
        controller.setState(state);
        showScreen("game-screen");
      });
    } else {
      let msg = "The Fugitive's move is locked in. Hand the device to the Enterprise Crew.";
      if (state.lastReveal && state.lastReveal.round === state.round) {
        msg += ` The Fugitive is revealed this round at station ${state.lastReveal.position}.`;
      }
      const detectiveRoles = state.detectives.map((d) => d.id);
      goToAirlock(msg, () => {
        controller.setViewerRoles(detectiveRoles);
        controller.setState(state);
        showScreen("game-screen");
      });
    }
  }

  setupForm.addEventListener("submit", (evt) => {
    evt.preventDefault();
    const settings = settingsFromForm(setupForm);
    const state = createGame(board, settings);
    currentPhase = state.phase;

    goToAirlock("Setup complete. Hand the device to the Fugitive to begin.", () => {
      controller.setViewerRoles(["mrx"]);
      controller.setState(state);
      showScreen("game-screen");
    });
  });

  el("new-game-btn").addEventListener("click", () => {
    window.location.reload();
  });
}
