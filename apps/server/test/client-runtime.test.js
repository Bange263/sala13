import assert from "node:assert/strict";
import test from "node:test";
import { applyDeviceMode, initializeDeviceMode, recommendedDeviceMode } from "../../web/public/js/components/device-mode.js";
import { createUuid } from "../../web/public/js/utils/id.js";

test("creates a valid player id when randomUUID is unavailable on an HTTP LAN origin", () => {
  const cryptoWithoutRandomUuid = {
    getRandomValues(bytes) {
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = index;
      return bytes;
    }
  };
  const id = createUuid(cryptoWithoutRandomUuid);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(id, "00010203-0405-4607-8809-0a0b0c0d0e0f");
});

test("uses native randomUUID when the browser exposes it", () => {
  assert.equal(createUuid({ randomUUID: () => "native-id" }), "native-id");
});

test("recommends and applies the appropriate device layout", () => {
  assert.equal(recommendedDeviceMode({ viewportWidth: 390, coarsePointer: true }), "mobile");
  assert.equal(recommendedDeviceMode({ viewportWidth: 1440, coarsePointer: false }), "desktop");
  const root = { dataset: {} };
  assert.equal(applyDeviceMode("mobile", root), "mobile");
  assert.deepEqual(root.dataset, { deviceMode: "mobile", deviceSelecting: "false" });
  assert.throws(() => applyDeviceMode("television", root), /non valida/);
});

test("device chooser opens on entry and switches between touch and desktop layouts", () => {
  function target(dataset = {}) {
    return {
      dataset,
      hidden: true,
      attributes: {},
      listeners: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, listener) { this.listeners[name] = listener; },
      click() { this.listeners.click(); },
      focus() { this.focused = true; }
    };
  }
  const mobileBadge = { hidden: true };
  const desktopBadge = { hidden: true };
  const mobile = { ...target({ deviceChoice: "mobile" }), querySelector: () => mobileBadge };
  const desktop = { ...target({ deviceChoice: "desktop" }), querySelector: () => desktopBadge };
  const gate = target();
  const switchButton = target();
  const switchLabel = { textContent: "Dispositivo" };
  const root = { dataset: {} };
  const documentRef = {
    documentElement: root,
    querySelector(selector) {
      return { "#device-gate": gate, "#device-mode-switch": switchButton, "#device-mode-label": switchLabel }[selector];
    },
    querySelectorAll: () => [mobile, desktop]
  };
  const windowRef = {
    innerWidth: 390,
    matchMedia: () => ({ matches: true }),
    requestAnimationFrame: (callback) => callback(),
    dispatchEvent() {}
  };

  const chooser = initializeDeviceMode({ documentRef, windowRef });
  assert.equal(chooser.recommendation, "mobile");
  assert.equal(gate.hidden, false);
  assert.equal(mobileBadge.hidden, false);
  assert.equal(desktopBadge.hidden, true);
  mobile.click();
  assert.equal(root.dataset.deviceMode, "mobile");
  assert.equal(gate.hidden, true);
  assert.equal(switchLabel.textContent, "Vista telefono");
  switchButton.click();
  assert.equal(gate.hidden, false);
  desktop.click();
  assert.equal(root.dataset.deviceMode, "desktop");
  assert.equal(switchLabel.textContent, "Vista PC");
});
