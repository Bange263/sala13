import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
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
  assert.match(source, /game-renderer-v2\.js/);
  assert.match(source, /Pronto ✓ · annulla/);
});

test("visual game tables ship complete local card decks and a leaderboard for every mode", async () => {
  const html = await readFile(new URL("index.html", webRoot), "utf8");
  const renderer = await readFile(new URL("js/games/game-renderer-v2.js", webRoot), "utf8");
  const media = await readFile(new URL("js/games/card-media.js", webRoot), "utf8");
  const css = await readFile(new URL("game-tables.css", webRoot), "utf8");
  const frenchDirectory = new URL("assets/cards/french/", webRoot);
  const italianDirectory = new URL("assets/cards/napoletane/", webRoot);
  const french = (await readdir(frenchDirectory)).filter((name) => name.endsWith(".svg"));
  const italian = (await readdir(italianDirectory)).filter((name) => name.endsWith(".jpg"));

  assert.equal(french.length, 53);
  assert.equal(italian.length, 41);
  for (const filename of [...french.map((name) => new URL(name, frenchDirectory)), ...italian.map((name) => new URL(name, italianDirectory))]) {
    assert.ok((await stat(filename)).size > 0, filename.pathname);
  }
  assert.match(html, /game-tables\.css/);
  assert.match(media, /assets\/cards\/french/);
  assert.match(media, /assets\/cards\/napoletane/);
  assert.match(renderer, /chip-tray/);
  assert.match(renderer, /drawing-message/);
  assert.ok((renderer.match(/leaderboard\(room/g) ?? []).length >= 13);
  assert.match(css, /\.blackjack-felt/);
  assert.match(css, /\.italian-card-table/);
  assert.match(css, /\.poker-oval/);
});
