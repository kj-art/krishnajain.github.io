export function settingsFromForm(form) {
  const fd = new FormData(form);
  const num = (name) => parseInt(fd.get(name), 10) || 0;
  const unlimited = fd.get("maxCapturesUnlimited") === "on";
  return {
    detectiveCount: parseInt(fd.get("detectiveCount"), 10),
    tickets: {
      detective: {
        taxi: num("det_taxi"),
        bus: num("det_bus"),
        underground: num("det_underground"),
        black: num("det_black"),
        double: num("det_double"),
      },
      mrx: {
        taxi: num("mrx_taxi"),
        bus: num("mrx_bus"),
        underground: num("mrx_underground"),
        black: num("mrx_black"),
        double: num("mrx_double"),
      },
    },
    revealRounds: fd.get("revealRounds"),
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

  const countField = form.querySelector(`[name="detectiveCount"][value="${settings.detectiveCount}"]`);
  if (countField) countField.checked = true;
  set("det_taxi", settings.tickets.detective.taxi);
  set("det_bus", settings.tickets.detective.bus);
  set("det_underground", settings.tickets.detective.underground);
  set("det_black", settings.tickets.detective.black);
  set("det_double", settings.tickets.detective.double);
  set("mrx_taxi", settings.tickets.mrx.taxi);
  set("mrx_bus", settings.tickets.mrx.bus);
  set("mrx_underground", settings.tickets.mrx.underground);
  set("mrx_black", settings.tickets.mrx.black);
  set("mrx_double", settings.tickets.mrx.double);
  set("revealRounds", Array.isArray(settings.revealRounds) ? settings.revealRounds.join(",") : settings.revealRounds);
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
