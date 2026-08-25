import assert from "node:assert/strict";
import test from "node:test";
import { resolveGame } from "../src/games/game-registry.js";
import { RoomManager } from "../src/rooms/room-manager.js";

const players = [
  { id: "player-a", name: "Ada" },
  { id: "player-b", name: "Linus" }
];

const roomConfig = {
  disconnectGraceMs: 10,
  emptyRoomTtlMs: 10,
  staleRoomTtlMs: 60_000
};

function member(index) {
  return {
    playerId: `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    socketId: `release-socket-${index}`,
    name: `Player ${index}`
  };
}

test("Uno asks for a wild color only after the card is played", () => {
  const engine = resolveGame("uno").engine;
  let state = engine.start({ players, settings: {} });
  const wildIndex = state.drawPile.findIndex((card) => card.color === "wild" && card.value === "wild");
  const [wild] = state.drawPile.splice(wildIndex, 1);
  state.hands["player-a"].push(wild);

  state = engine.applyAction({ action: { type: "play", cardId: wild.id }, playerId: "player-a", players, state });
  assert.equal(state.phase, "choose-color");
  assert.equal(state.currentPlayerId, "player-a");
  assert.equal(state.currentColor === "red" || state.currentColor === "yellow" || state.currentColor === "green" || state.currentColor === "blue", true);

  state = engine.applyAction({ action: { type: "choose-color", color: "blue" }, playerId: "player-a", players, state });
  assert.equal(state.phase, "playing");
  assert.equal(state.currentColor, "blue");
  assert.equal(state.currentPlayerId, "player-b");
});

test("room scoreboard records a Tic-Tac-Toe winner and survives the finished state", async (context) => {
  const manager = new RoomManager(roomConfig);
  context.after(() => manager.close());
  const first = member(1);
  const second = member(2);
  const room = manager.createRoom({ ...first, gameId: "tic-tac-toe", visibility: "public", settings: { maxPlayers: 2 } });
  manager.joinRoom({ ...second, code: room.code, password: "" });
  manager.setReady(first.socketId, true);
  manager.setReady(second.socketId, true);
  manager.start(first.socketId);

  for (const [socketId, cell] of [[first.socketId, 0], [second.socketId, 3], [first.socketId, 1], [second.socketId, 4], [first.socketId, 2]]) {
    await manager.applyAction(socketId, { expectedVersion: room.version, action: { type: "place", cell } });
  }

  const view = room.viewFor(first.playerId);
  assert.equal(view.status, "finished");
  assert.equal(view.matchScores[first.playerId], 1);
  assert.deepEqual(view.lastResult.winnerIds, [first.playerId]);
  assert.match(view.lastResult.title, /ha vinto/i);
});

test("host can add a ready AI and it answers a Connect Four move", async (context) => {
  const manager = new RoomManager(roomConfig);
  context.after(() => manager.close());
  const host = member(3);
  const room = manager.createRoom({ ...host, gameId: "connect-four", visibility: "public", settings: { maxPlayers: 2 } });
  manager.addBot(host.socketId);
  assert.equal(room.players.size, 2);
  assert.equal([...room.players.values()].find((player) => player.isBot).ready, true);
  manager.setReady(host.socketId, true);
  manager.start(host.socketId);
  await manager.applyAction(host.socketId, { expectedVersion: room.version, action: { type: "drop", column: 0 } });
  assert.equal(room.gameState.moveCount, 2);
  assert.equal(room.gameState.currentPlayerId, host.playerId);
});

test("host can kick another participant but not itself", (context) => {
  const manager = new RoomManager(roomConfig);
  context.after(() => manager.close());
  const host = member(4);
  const guest = member(5);
  const room = manager.createRoom({ ...host, gameId: "uno", visibility: "public", settings: { maxPlayers: 4 } });
  manager.joinRoom({ ...guest, code: room.code, password: "" });
  assert.throws(() => manager.kick(host.socketId, host.playerId), /se stesso/i);
  manager.kick(host.socketId, guest.playerId);
  assert.equal(room.players.has(guest.playerId), false);
});

test("Categories enforces max rounds, duplicate scoring and server timeout", () => {
  const engine = resolveGame("categories").engine;
  let state = engine.start({ players, settings: { categories: ["Nomi", "Città"], maxRounds: 1, roundSeconds: 30 } });
  const same = Object.fromEntries(state.categories.map((category) => [category, `${state.letter}roma`]));
  state = engine.applyAction({ action: { type: "submit", answers: same }, playerId: "player-a", players, state });
  state = engine.applyAction({ action: { type: "submit", answers: same }, playerId: "player-b", players, state });
  state = engine.applyAction({ action: { type: "score-round" }, playerId: "player-a", players, state });
  assert.equal(state.phase, "finished");
  assert.equal(state.scores["player-a"], 10);
  assert.equal(state.scores["player-b"], 10);

  let timed = engine.start({ players, settings: { categories: ["Nomi", "Città"] } });
  timed.deadline = Date.now() - 1;
  timed = engine.onTimeout({ state: timed });
  assert.equal(timed.phase, "review");
});

test("custom Hangman validates its local dictionary and keeps the setter out of guessing", () => {
  const engine = resolveGame("hangman").engine;
  assert.throws(() => engine.start({ players, settings: { hangmanMode: "custom", customWord: "inesistente" } }), /dizionario/i);
  const state = engine.start({ players, settings: { hangmanMode: "custom", customWord: "cazzo" } });
  assert.equal(state.setterId, "player-a");
  assert.equal(state.currentPlayerId, "player-b");
  assert.equal(engine.view(state, "player-b").solution, null);
  assert.equal(engine.view(state, "player-a").solution, "cazzo");
});

test("pass-the-prompt advances expired prompt phases on the server", () => {
  const engine = resolveGame("draw-and-pass").engine;
  let state = engine.start({ players, settings: { mode: "pass", promptSeconds: 60, roundSeconds: 75 } });
  state.deadline = Date.now() - 1;
  state = engine.onTimeout({ state });
  assert.equal(state.phase, "drawing");
  assert.equal(state.step, 1);
  assert.equal(state.chains.every((chain) => chain.pages.length === 1), true);
  assert.ok(state.deadline > Date.now());
});

test("Blackjack max bet and chess legal move hints are server-authoritative", () => {
  const blackjack = resolveGame("blackjack").engine;
  const blackjackState = blackjack.start({ players, settings: { startingChips: 2_000, baseBet: 100, maxBet: 250 } });
  assert.throws(() => blackjack.applyAction({ action: { type: "bet", amount: 300 }, playerId: "player-a", players, state: blackjackState }), /massimo/i);

  const chess = resolveGame("chess-checkers").engine;
  const chessState = chess.start({ players, settings: { variant: "chess" } });
  const view = chess.view(chessState, "player-a");
  assert.equal(view.legalMoves.some((move) => move.from === 52 && move.to === 36), true);
});
