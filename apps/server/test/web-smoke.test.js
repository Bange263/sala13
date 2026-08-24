import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const webRoot = new URL("../../web/public/", import.meta.url);

test("create-room close control never submits or validates the form", async () => {
  const html = await readFile(new URL("index.html", webRoot), "utf8");
  assert.match(html, /id="close-create-button"[^>]*type="button"/);
  assert.doesNotMatch(html, /aria-label="Chiudi"[^>]*type="submit"/);
});

test("main UI uses authoritative start eligibility and the universal game renderer", async () => {
  const source = await readFile(new URL("js/main.js", webRoot), "utf8");
  assert.match(source, /room\.startEligibility\?\.canStart/);
  assert.match(source, /renderGame\(elements\.gameStage/);
  assert.match(source, /Pronto ✓ · annulla/);
});
