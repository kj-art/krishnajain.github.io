// Which side of the screen the round info / turn controls sit on is a
// personal display preference, not a game rule -- the Windows PC running
// the game as host and an iPad joining as crew might reasonably want
// different answers at the same time, so this is local-only (localStorage),
// never synced through sync.js/settings like everything else in this app.
const KEY = "sy_gui_layout";
const VALID = ["auto", "left", "right", "top", "bottom"];

// Board canvas's native size (see index.html's #board-canvas width/height
// attributes) -- what its aspect ratio actually is, not an approximation.
const BOARD_ASPECT = 1100 / 620;
// Rough budget for round-info + transport-log + turn controls + the reveal
// ticker + the gaps/padding around them, when stacked above/below the
// board at full width. Exact content height varies turn to turn (a
// double-move's extra plan row, a capture banner, 1 vs 2 crew...), but
// picking "auto" from actual live DOM measurements would mean the layout
// could flip mid-game as those wiggle -- jarring. A fixed estimate keeps
// the choice stable for a given window size instead.
//
// 150, not the first guess of 300 -- an iPad Pro 13" landscape (~1376x1032
// points) makes a full-width board ~776px tall on its own, so anything
// above ~150-200 here made "right" win on real tablets in landscape even
// though "top" fits comfortably in practice (round-info + a Pass/End Turn
// row + the ticker is nowhere near 300px most turns).
const RESERVED_GUI_HEIGHT = 150;

// "auto" resolves to "top" if a full-width board would still leave enough
// vertical room underneath for the controls (i.e. the board is limited by
// the screen's SIDES before it's limited by its TOP/BOTTOM) -- otherwise
// "right", where the board maximizes height instead and the controls sit
// beside it. This can't be a plain CSS aspect-ratio media query: the
// relationship isn't a fixed ratio, it has a constant (RESERVED_GUI_HEIGHT)
// baked in, so it has to be computed against the actual viewport pixels.
function resolveAutoDirection() {
  const mapHeightAtFullWidth = window.innerWidth / BOARD_ASPECT;
  const fitsWithControlsBelow = mapHeightAtFullWidth + RESERVED_GUI_HEIGHT <= window.innerHeight;
  return fitsWithControlsBelow ? "top" : "right";
}

export function getGuiLayoutPref() {
  const v = localStorage.getItem(KEY);
  return VALID.includes(v) ? v : "auto";
}

export function setGuiLayoutPref(value) {
  if (!VALID.includes(value)) return;
  localStorage.setItem(KEY, value);
  applyGuiLayoutPref();
}

// Shown next to the layout <select> on both the setup and lobby screens
// (any element with this class) -- lets anyone read off the actual
// detected viewport size and decision without needing dev tools, which
// isn't an option at all on an iPad.
function renderDebugInfo() {
  const pref = getGuiLayoutPref();
  const resolved = pref === "auto" ? resolveAutoDirection() : pref;
  const mapHeightAtFullWidth = Math.round(window.innerWidth / BOARD_ASPECT);
  const text =
    pref === "auto"
      ? `viewport ${window.innerWidth}×${window.innerHeight}, full-width board would be ${mapHeightAtFullWidth}px tall (+${RESERVED_GUI_HEIGHT} budget) → auto picked "${resolved}"`
      : `viewport ${window.innerWidth}×${window.innerHeight}, forced to "${resolved}"`;
  document.querySelectorAll(".gui-layout-debug").forEach((el) => {
    el.textContent = text;
  });
}

// Safe to call any time, including before #game-screen exists (e.g. at app
// boot) -- it's a no-op until the element shows up.
export function applyGuiLayoutPref() {
  renderDebugInfo();
  const screen = document.getElementById("game-screen");
  if (!screen) return;
  const pref = getGuiLayoutPref();
  const resolved = pref === "auto" ? resolveAutoDirection() : pref;
  screen.classList.remove("layout-left", "layout-right", "layout-top", "layout-bottom");
  screen.classList.add(`layout-${resolved}`);
}

export function wireGuiLayoutSelect(select) {
  select.value = getGuiLayoutPref();
  select.addEventListener("change", () => setGuiLayoutPref(select.value));
}

// Re-resolve "auto" as the window is resized/rotated -- a no-op (cheap
// getElementById + no-op classList calls) whenever the preference isn't
// "auto" or the game screen isn't mounted yet.
window.addEventListener("resize", applyGuiLayoutPref);
