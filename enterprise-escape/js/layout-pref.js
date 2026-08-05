// Which side of the screen the round info / turn controls sit on is a
// personal display preference, not a game rule -- the Windows PC running
// the game as host and an iPad joining as crew might reasonably want
// different answers at the same time, so this is local-only (localStorage),
// never synced through sync.js/settings like everything else in this app.
const KEY = "sy_gui_layout";
const VALID = ["auto", "left", "right", "top", "bottom"];

export function getGuiLayoutPref() {
  const v = localStorage.getItem(KEY);
  return VALID.includes(v) ? v : "auto";
}

export function setGuiLayoutPref(value) {
  if (!VALID.includes(value)) return;
  localStorage.setItem(KEY, value);
  applyGuiLayoutPref();
}

// Safe to call any time, including before #game-screen exists (e.g. at app
// boot) -- it's a no-op until the element shows up.
export function applyGuiLayoutPref() {
  const screen = document.getElementById("game-screen");
  if (!screen) return;
  screen.classList.remove("layout-auto", "layout-left", "layout-right", "layout-top", "layout-bottom");
  screen.classList.add(`layout-${getGuiLayoutPref()}`);
}

export function wireGuiLayoutSelect(select) {
  select.value = getGuiLayoutPref();
  select.addEventListener("change", () => setGuiLayoutPref(select.value));
}
