// Wires a "cap enabled" checkbox to disable/enable its paired cap number
// field -- same pattern as the maxCapturesUnlimited checkbox already used.
export function wireCapToggle(form, checkboxName, numberName) {
  const checkbox = form.querySelector(`[name="${checkboxName}"]`);
  const numberField = form.querySelector(`[name="${numberName}"]`);
  if (!checkbox || !numberField) return;
  checkbox.addEventListener("change", () => {
    numberField.disabled = !checkbox.checked;
  });
}

export function settingsFromForm(form) {
  const fd = new FormData(form);
  const num = (name) => parseInt(fd.get(name), 10) || 0;
  const unlimited = fd.get("maxCapturesUnlimited") === "on";
  // Only the networked lobby form has these fields; hotseat is always
  // single-device, so they're meaningless there and default to the
  // engine's default rather than being coerced by an absent field.
  const checkbox = (name, fallback) => {
    const field = form.querySelector(`[name="${name}"]`);
    return field ? field.checked : fallback;
  };
  const detCapEnabled = checkbox("det_movement_cap_enabled", true);
  const mrxCapEnabled = checkbox("mrx_movement_cap_enabled", true);
  return {
    detectiveCount: parseInt(fd.get("detectiveCount"), 10),
    sharedDetectivePool: checkbox("sharedDetectivePool", false),
    movementCosts: {
      taxi: num("cost_taxi"),
      bus: num("cost_bus"),
      underground: num("cost_underground"),
    },
    movementPools: {
      detective: {
        start: num("det_movement_start"),
        regen: num("det_movement_regen"),
        capEnabled: detCapEnabled,
        cap: detCapEnabled ? num("det_movement_cap") : num("det_movement_start"),
      },
      mrx: {
        start: num("mrx_movement_start"),
        regen: num("mrx_movement_regen"),
        capEnabled: mrxCapEnabled,
        cap: mrxCapEnabled ? num("mrx_movement_cap") : num("mrx_movement_start"),
      },
    },
    tickets: {
      detective: { black: num("det_black"), double: num("det_double") },
      mrx: { black: num("mrx_black"), double: num("mrx_double") },
    },
    revealRounds: fd.get("revealRounds"),
    revealRoundsInterval: num("revealRoundsInterval"),
    stunDuration: num("stunDuration"),
    stunnedDetectiveBehavior: fd.get("stunnedDetectiveBehavior"),
    maxCaptures: unlimited ? Infinity : num("maxCaptures"),
  };
}

export function populateForm(form, settings) {
  const set = (name, value) => {
    const field = form.querySelector(`[name="${name}"]`);
    if (field) field.value = value;
  };
  const setChecked = (name, checked) => {
    const field = form.querySelector(`[name="${name}"]`);
    if (field) field.checked = checked;
  };

  const countField = form.querySelector(`[name="detectiveCount"][value="${settings.detectiveCount}"]`);
  if (countField) countField.checked = true;
  setChecked("sharedDetectivePool", settings.sharedDetectivePool);

  set("cost_taxi", settings.movementCosts.taxi);
  set("cost_bus", settings.movementCosts.bus);
  set("cost_underground", settings.movementCosts.underground);

  const det = settings.movementPools.detective;
  set("det_movement_start", det.start);
  set("det_movement_regen", det.regen);
  setChecked("det_movement_cap_enabled", det.capEnabled);
  const detCapField = form.querySelector('[name="det_movement_cap"]');
  if (detCapField) {
    detCapField.disabled = !det.capEnabled;
    detCapField.value = det.cap;
  }

  const mrxPool = settings.movementPools.mrx;
  set("mrx_movement_start", mrxPool.start);
  set("mrx_movement_regen", mrxPool.regen);
  setChecked("mrx_movement_cap_enabled", mrxPool.capEnabled);
  const mrxCapField = form.querySelector('[name="mrx_movement_cap"]');
  if (mrxCapField) {
    mrxCapField.disabled = !mrxPool.capEnabled;
    mrxCapField.value = mrxPool.cap;
  }

  set("det_black", settings.tickets.detective.black);
  set("det_double", settings.tickets.detective.double);
  set("mrx_black", settings.tickets.mrx.black);
  set("mrx_double", settings.tickets.mrx.double);
  set("revealRounds", Array.isArray(settings.revealRounds) ? settings.revealRounds.join(",") : settings.revealRounds);
  set("revealRoundsInterval", settings.revealRoundsInterval);
  set("stunDuration", settings.stunDuration);
  const behaviorField = form.querySelector('[name="stunnedDetectiveBehavior"]');
  if (behaviorField) behaviorField.value = settings.stunnedDetectiveBehavior;

  const unlimited = settings.maxCaptures === Infinity;
  const unlimitedField = form.querySelector('[name="maxCapturesUnlimited"]');
  const maxCapturesField = form.querySelector('[name="maxCaptures"]');
  if (unlimitedField) unlimitedField.checked = unlimited;
  if (maxCapturesField) {
    maxCapturesField.disabled = unlimited;
    if (!unlimited) maxCapturesField.value = settings.maxCaptures;
  }
}
