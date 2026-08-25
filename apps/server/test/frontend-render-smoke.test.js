import assert from "node:assert/strict";
import test from "node:test";
import { GAME_CATALOG } from "@sala13/shared";
import { resolveGame } from "../src/games/game-registry.js";

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
  }

  values() {
    return new Set(String(this.owner.className || "").split(/\s+/).filter(Boolean));
  }

  write(values) {
    this.owner.className = [...values].join(" ");
  }

  add(...names) {
    const values = this.values();
    names.forEach((name) => values.add(name));
    this.write(values);
  }

  remove(...names) {
    const values = this.values();
    names.forEach((name) => values.delete(name));
    this.write(values);
  }

  toggle(name, force) {
    const values = this.values();
    const enabled = force ?? !values.has(name);
    if (enabled) values.add(name);
    else values.delete(name);
    this.write(values);
    return enabled;
  }

  contains(name) {
    return this.values().has(name);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.className = "";
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.style = { setProperty: (name, value) => { this.style[name] = value; } };
    this.classList = new FakeClassList(this);
    this.isConnected = false;
    this.textContent = "";
    this.value = "";
  }

  append(...children) {
    for (const child of children.flat()) {
      if (child === null || child === undefined) continue;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(name, listener) {
    (this.listeners[name] ??= []).push(listener);
  }

  getContext() {
    return {
      save() {}, restore() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}
    };
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 900, height: 520 };
  }

  setPointerCapture() {}

  requestSubmit() {}
}

function containsClass(node, className) {
  if (node?.classList?.contains(className)) return true;
  return (node?.children ?? []).some((child) => containsClass(child, className));
}

globalThis.document = {
  createElement: (tagName) => new FakeElement(tagName),
  createElementNS: (_namespace, tagName) => new FakeElement(tagName)
};
globalThis.window = {
  setInterval,
  clearInterval
};

const { renderGame } = await import("../../web/public/js/games/game-renderer-v2.js");

function renderState(gameId, engine, state, players, selfPlayerId = players[0].id) {
  const view = engine.view(state, selfPlayerId);
  const room = { gameId, selfPlayerId, players, gameState: view };
  const stage = new FakeElement("section");
  stage.isConnected = true;
  renderGame(stage, room, async () => {});
  assert.equal(containsClass(stage, "game-v2"), true, gameId);
  assert.equal(containsClass(stage, "game-leaderboard"), true, gameId);
  return stage;
}

test("every game view renders its dedicated visual table without a browser exception", () => {
  for (const game of GAME_CATALOG) {
    const count = game.players.allowed?.[0] ?? game.players.min;
    const players = Array.from({ length: count }, (_, index) => ({ id: `player-${index}`, name: `Player ${index + 1}` }));
    const resolved = resolveGame(game.id);
    const state = resolved.engine.start({ players, settings: { variant: "chess", mode: "draw", stacking: true } });
    let stage;
    assert.doesNotThrow(() => { stage = renderState(game.id, resolved.engine, state, players); }, game.id);
    assert.equal(stage.children.length, 1, game.id);
  }
});

test("visual tables render active and finished high-value game phases", () => {
  const players = [
    { id: "player-a", name: "Ada" },
    { id: "player-b", name: "Linus" }
  ];

  const blackjackEngine = resolveGame("blackjack").engine;
  let blackjack = blackjackEngine.start({ players, settings: { startingChips: 1_000, baseBet: 100 } });
  for (const player of players) blackjack = blackjackEngine.applyAction({ action: { type: "bet", amount: 100 }, playerId: player.id, players, state: blackjack });
  renderState("blackjack", blackjackEngine, blackjack, players);
  while (blackjack.phase === "players") blackjack = blackjackEngine.applyAction({ action: { type: "stand" }, playerId: blackjack.currentPlayerId, players, state: blackjack });
  renderState("blackjack", blackjackEngine, blackjack, players);

  const pokerEngine = resolveGame("texas-holdem").engine;
  let poker = pokerEngine.start({ players, settings: {} });
  while (!pokerEngine.isFinished(poker)) {
    const playerId = poker.currentPlayerId;
    const player = poker.playerStates[playerId];
    const type = poker.currentBet - player.streetBet > 0 ? "call" : "check";
    poker = pokerEngine.applyAction({ action: { type }, playerId, players, state: poker });
  }
  renderState("texas-holdem", pokerEngine, poker, players);

  const battleshipEngine = resolveGame("battleship").engine;
  let battleship = battleshipEngine.start({ players, settings: {} });
  battleship = battleshipEngine.applyAction({ action: { type: "auto-place" }, playerId: "player-a", players, state: battleship });
  battleship = battleshipEngine.applyAction({ action: { type: "auto-place" }, playerId: "player-b", players, state: battleship });
  battleship = battleshipEngine.applyAction({ action: { type: "fire", cell: 0 }, playerId: "player-a", players, state: battleship });
  renderState("battleship", battleshipEngine, battleship, players);

  const categoriesEngine = resolveGame("categories").engine;
  let categories = categoriesEngine.start({ players, settings: { categories: ["Nomi", "Città"] } });
  const answers = Object.fromEntries(categories.categories.map((category) => [category, `${categories.letter}prova`]));
  for (const player of players) categories = categoriesEngine.applyAction({ action: { type: "submit", answers }, playerId: player.id, players, state: categories });
  renderState("categories", categoriesEngine, categories, players);
  categories = categoriesEngine.applyAction({ action: { type: "score-round" }, playerId: "player-a", players, state: categories });
  renderState("categories", categoriesEngine, categories, players);

  const drawEngine = resolveGame("draw-and-pass").engine;
  let drawing = drawEngine.start({ players, settings: { mode: "draw" } });
  drawing.prompt = "forchetta";
  drawing = drawEngine.applyAction({ action: { type: "guess", text: "vorcheta" }, playerId: "player-b", players, state: drawing });
  renderState("draw-and-pass", drawEngine, drawing, players, "player-b");
});
