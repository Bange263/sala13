const validModes = new Set(["mobile", "desktop"]);

export function recommendedDeviceMode({ viewportWidth, coarsePointer = false }) {
  return viewportWidth <= 820 || coarsePointer ? "mobile" : "desktop";
}

export function applyDeviceMode(mode, root = document.documentElement) {
  if (!validModes.has(mode)) throw new TypeError(`Modalità dispositivo non valida: ${mode}`);
  root.dataset.deviceMode = mode;
  root.dataset.deviceSelecting = "false";
  return mode;
}

export function initializeDeviceMode({ documentRef = document, windowRef = window } = {}) {
  const root = documentRef.documentElement;
  const gate = documentRef.querySelector("#device-gate");
  const switchButton = documentRef.querySelector("#device-mode-switch");
  const switchLabel = documentRef.querySelector("#device-mode-label");
  const choices = [...documentRef.querySelectorAll("[data-device-choice]")];
  const coarsePointer = typeof windowRef.matchMedia === "function"
    && windowRef.matchMedia("(pointer: coarse)").matches;
  const recommendation = recommendedDeviceMode({
    viewportWidth: windowRef.innerWidth,
    coarsePointer
  });

  for (const choice of choices) {
    const mode = choice.dataset.deviceChoice;
    const badge = choice.querySelector("[data-device-recommendation]");
    const recommended = mode === recommendation;
    choice.dataset.recommended = String(recommended);
    if (badge) badge.hidden = !recommended;
  }

  function openChooser() {
    root.dataset.deviceSelecting = "true";
    gate.hidden = false;
    gate.setAttribute("aria-hidden", "false");
    const preferred = choices.find((choice) => choice.dataset.deviceChoice === recommendation) ?? choices[0];
    windowRef.requestAnimationFrame?.(() => preferred?.focus());
  }

  function selectMode(mode) {
    applyDeviceMode(mode, root);
    gate.hidden = true;
    gate.setAttribute("aria-hidden", "true");
    if (switchLabel) switchLabel.textContent = mode === "mobile" ? "Vista telefono" : "Vista PC";
    switchButton?.setAttribute("aria-label", mode === "mobile"
      ? "Vista telefono attiva. Cambia dispositivo"
      : "Vista PC attiva. Cambia dispositivo");
    windowRef.dispatchEvent?.(new CustomEvent("sala13:device-mode", { detail: { mode } }));
  }

  for (const choice of choices) {
    choice.addEventListener("click", () => selectMode(choice.dataset.deviceChoice));
  }
  switchButton?.addEventListener("click", openChooser);
  openChooser();

  return { openChooser, selectMode, recommendation };
}
