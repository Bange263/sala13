import assert from "node:assert/strict";
import test from "node:test";
import { GAME_CATALOG } from "@sala13/shared";
import { resolveGame } from "../src/games/game-registry.js";
import { evaluatePokerHand } from "../src/games/poker-engine.js";

const players = [
  { id: "player-a", name: "Ada" },
  { id: "player-b", name: "Linus" }
];

function start(gameId, settings = {}) {
  return resolveGame(gameId).engine.start({ players, settings });
}

function subsetForScopa(table, target) {
  for (let mask = 1; mask < (1 << table.length); mask += 1) {
    const cards = table.filter((_card, index) => mask & (1 << index));
    if (cards.reduce((sum, card) => sum + card.rank, 0) === target) return cards.map((card) => card.id);
  }
  return [];
}

test("every catalog entry has a playable server engine", () => {
  for (const game of GAME_CATALOG) {
    const resolved = resolveGame(game.id);
    assert.ok(resolved.engine, game.id);
    assert.equal(resolved.engine.implemented, true, game.id);
    const count = game.players.allowed?.[0] ?? game.players.min;
    const participants = Array.from({ length: count }, (_, index) => ({ id: `p-${index}`, name: `P ${index}` }));
    const state = resolved.engine.start({
      players: participants,
      settings: { variant: "chess", mode: "draw", stacking: true }
    });
    assert.ok(resolved.engine.view(state, participants[0].id), game.id);
  }
});

test("expanded multiplayer limits can create their maximum-size state", () => {
  for (const [gameId, count, settings] of [
    ["blackjack", 12, {}],
    ["uno", 20, {}],
    ["texas-holdem", 12, {}],
    ["categories", 40, {}],
    ["hangman", 30, {}],
    ["draw-and-pass", 24, { mode: "draw" }]
  ]) {
    const participants = Array.from({ length: count }, (_, index) => ({ id: `${gameId}-${index}`, name: `P${index}` }));
    const state = resolveGame(gameId).engine.start({ players: participants, settings });
    assert.equal(state.order.length, count, gameId);
  }
});

test("hidden information is redacted for card, word and naval games", () => {
  const uno = start("uno");
  const unoView = resolveGame("uno").engine.view(uno, players[0].id);
  assert.ok(Array.isArray(unoView.hands[players[0].id]));
  assert.deepEqual(Object.keys(unoView.hands[players[1].id]), ["count"]);
  assert.equal(unoView.drawPile, undefined);

  const poker = start("texas-holdem");
  const pokerView = resolveGame("texas-holdem").engine.view(poker, players[0].id);
  assert.ok(Array.isArray(pokerView.players[players[0].id].hole));
  assert.deepEqual(Object.keys(pokerView.players[players[1].id].hole), ["count"]);

  const hangman = start("hangman");
  assert.equal(resolveGame("hangman").engine.view(hangman, players[0].id).solution, null);

  let battleship = start("battleship");
  battleship = resolveGame("battleship").engine.applyAction({ action: { type: "auto-place" }, playerId: players[0].id, players, state: battleship });
  battleship = resolveGame("battleship").engine.applyAction({ action: { type: "auto-place" }, playerId: players[1].id, players, state: battleship });
  const seaView = resolveGame("battleship").engine.view(battleship, players[0].id);
  assert.ok(seaView.ownBoard.ships);
  assert.equal(seaView.targetBoard.ships, undefined);

  const drawing = start("draw-and-pass", { mode: "draw" });
  assert.equal(resolveGame("draw-and-pass").engine.view(drawing, players[1].id).prompt, null);
});

test("initial card zones conserve every physical card", () => {
  const collect = (zones, expected) => {
    const cards = zones.flat(Infinity).filter((value) => value && typeof value === "object" && typeof value.id === "string");
    assert.equal(cards.length, expected);
    assert.equal(new Set(cards.map((card) => card.id)).size, expected);
  };

  const uno = start("uno");
  collect([uno.drawPile, uno.discardPile, ...Object.values(uno.hands)], 108);
  const scopa = start("scopa");
  collect([scopa.deck, scopa.table, ...Object.values(scopa.hands), ...Object.values(scopa.captured)], 40);
  const briscola = start("briscola");
  collect([briscola.deck, ...Object.values(briscola.hands), briscola.trick.map((play) => play.card)], 40);
  const poker = start("texas-holdem");
  collect([poker.deck, poker.community, ...Object.values(poker.playerStates).map((player) => player.hole)], 52);
  const burraco = start("burraco");
  collect([burraco.deck, burraco.discardPile, burraco.pots, ...Object.values(burraco.hands), ...Object.values(burraco.melds).flatMap((melds) => melds.map((meld) => meld.cards))], 108);
});

test("Connect Four detects vertical victory", () => {
  const engine = resolveGame("connect-four").engine;
  let state = start("connect-four");
  for (const [playerId, column] of [["player-a", 0], ["player-b", 1], ["player-a", 0], ["player-b", 1], ["player-a", 0], ["player-b", 1], ["player-a", 0]]) {
    state = engine.applyAction({ action: { type: "drop", column }, playerId, players, state });
  }
  assert.equal(state.winnerId, "player-a");
  assert.equal(engine.isFinished(state), true);
});

test("chess and checkers accept legal opening moves", () => {
  const engine = resolveGame("chess-checkers").engine;
  let chess = start("chess-checkers", { variant: "chess" });
  chess = engine.applyAction({ action: { type: "move", from: 52, to: 36 }, playerId: "player-a", players, state: chess });
  assert.equal(chess.board[36], "wP");
  assert.equal(chess.currentPlayerId, "player-b");

  let checkers = start("chess-checkers", { variant: "checkers" });
  checkers = engine.applyAction({ action: { type: "move", from: 40, to: 33 }, playerId: "player-a", players, state: checkers });
  assert.equal(checkers.board[33], "wM");
  assert.equal(checkers.currentPlayerId, "player-b");
});

test("poker evaluator ranks a straight flush above four of a kind", () => {
  const straightFlush = evaluatePokerHand([
    { rank: "9", suit: "hearts" }, { rank: "10", suit: "hearts" }, { rank: "J", suit: "hearts" },
    { rank: "Q", suit: "hearts" }, { rank: "K", suit: "hearts" }, { rank: "2", suit: "clubs" }, { rank: "3", suit: "clubs" }
  ]);
  const quads = evaluatePokerHand([
    { rank: "A", suit: "hearts" }, { rank: "A", suit: "diamonds" }, { rank: "A", suit: "clubs" },
    { rank: "A", suit: "spades" }, { rank: "K", suit: "hearts" }, { rank: "2", suit: "clubs" }, { rank: "3", suit: "clubs" }
  ]);
  assert.ok(straightFlush.rank[0] > quads.rank[0]);
});

test("poker check/call flow reaches showdown and conserves chips", () => {
  const engine = resolveGame("texas-holdem").engine;
  let state = start("texas-holdem");
  let actions = 0;
  while (!engine.isFinished(state) && actions < 30) {
    const currentId = state.currentPlayerId;
    const record = state.playerStates[currentId];
    const amountToCall = state.currentBet - record.streetBet;
    state = engine.applyAction({ action: { type: amountToCall > 0 ? "call" : "check" }, playerId: currentId, players, state });
    actions += 1;
  }
  assert.equal(state.phase, "finished");
  assert.equal(state.community.length, 5);
  assert.equal(Object.values(state.playerStates).reduce((sum, player) => sum + player.chips, 0), 4_000);
});

test("all remaining engines accept their first real action", () => {
  const blackjackEngine = resolveGame("blackjack").engine;
  let blackjack = start("blackjack");
  blackjack = blackjackEngine.applyAction({ action: { type: "bet", amount: 100 }, playerId: "player-a", players, state: blackjack });
  blackjack = blackjackEngine.applyAction({ action: { type: "bet", amount: 100 }, playerId: "player-b", players, state: blackjack });
  if (blackjack.phase === "players") {
  blackjack = blackjackEngine.applyAction({ action: { type: "stand" }, playerId: blackjack.currentPlayerId, players, state: blackjack });
  }
  assert.ok(blackjack);

  const unoEngine = resolveGame("uno").engine;
  let uno = start("uno");
  uno = unoEngine.applyAction({ action: { type: "draw" }, playerId: uno.currentPlayerId, players, state: uno });
  assert.equal(uno.currentPlayerId, "player-b");

  const scopaEngine = resolveGame("scopa").engine;
  let scopa = start("scopa");
  const scopaCard = scopa.hands["player-a"][0];
  const exact = scopa.table.find((card) => card.rank === scopaCard.rank);
  const captureIds = exact ? [exact.id] : subsetForScopa(scopa.table, scopaCard.rank);
  scopa = scopaEngine.applyAction({ action: { type: "play", cardId: scopaCard.id, captureIds }, playerId: "player-a", players, state: scopa });
  assert.equal(scopa.currentPlayerId, "player-b");

  const briscolaEngine = resolveGame("briscola").engine;
  let briscola = start("briscola");
  briscola = briscolaEngine.applyAction({ action: { type: "play", cardId: briscola.hands["player-a"][0].id }, playerId: "player-a", players, state: briscola });
  assert.equal(briscola.trick.length, 1);

  const burracoEngine = resolveGame("burraco").engine;
  let burraco = start("burraco");
  burraco = burracoEngine.applyAction({ action: { type: "draw", source: "deck" }, playerId: "player-a", players, state: burraco });
  const discardId = burraco.hands["player-a"][0].id;
  burraco = burracoEngine.applyAction({ action: { type: "discard", cardId: discardId }, playerId: "player-a", players, state: burraco });
  assert.equal(burraco.currentPlayerId, "player-b");

  const categoriesEngine = resolveGame("categories").engine;
  let categories = start("categories", { categories: ["Nomi", "Città"] });
  const answers = Object.fromEntries(categories.categories.map((category) => [category, `${categories.letter}prova`]));
  categories = categoriesEngine.applyAction({ action: { type: "submit", answers }, playerId: "player-a", players, state: categories });
  categories = categoriesEngine.applyAction({ action: { type: "submit", answers }, playerId: "player-b", players, state: categories });
  assert.equal(categories.phase, "review");

  const hangmanEngine = resolveGame("hangman").engine;
  let hangman = start("hangman");
  hangman = hangmanEngine.applyAction({ action: { type: "guess-letter", letter: "z" }, playerId: "player-a", players, state: hangman });
  assert.equal(hangman.currentPlayerId, "player-b");

  const drawEngine = resolveGame("draw-and-pass").engine;
  let drawing = start("draw-and-pass", { mode: "draw" });
  drawing = drawEngine.applyAction({
    action: { type: "stroke", stroke: { id: "00000000-0000-4000-8000-000000000001", tool: "brush", color: "#112233", size: 5, points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }] } },
    playerId: "player-a", players, state: drawing
  });
  assert.equal(drawing.strokes.length, 1);
});

test("pass-the-prompt mode rotates private assignments", () => {
  const engine = resolveGame("draw-and-pass").engine;
  let state = start("draw-and-pass", { mode: "pass" });
  state = engine.applyAction({ action: { type: "submit-prompt", text: "Un gatto in barca" }, playerId: "player-a", players, state });
  state = engine.applyAction({ action: { type: "submit-prompt", text: "Un robot a scuola" }, playerId: "player-b", players, state });
  assert.equal(state.phase, "drawing");
  const view = engine.view(state, "player-a");
  assert.ok(view.assignment.source.content);
  assert.equal(view.chains, null);
});
