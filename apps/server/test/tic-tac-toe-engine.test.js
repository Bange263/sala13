import assert from "node:assert/strict";
import test from "node:test";
import { ERROR_CODES } from "@sala13/shared";
import { TicTacToeEngine } from "../src/games/tic-tac-toe-engine.js";

const players = [
  { id: "player-a", name: "Ada" },
  { id: "player-b", name: "Linus" }
];

test("starts with a blank board and deterministic marks", () => {
  const state = TicTacToeEngine.start({ players });
  assert.deepEqual(state.board, Array(9).fill(null));
  assert.equal(state.currentPlayerId, "player-a");
  assert.equal(state.marks["player-a"], "X");
  assert.equal(state.marks["player-b"], "O");
});

test("rejects an action from the wrong player", () => {
  const state = TicTacToeEngine.start({ players });
  assert.throws(
    () => TicTacToeEngine.applyAction({ action: { type: "place", cell: 0 }, playerId: "player-b", players, state }),
    (error) => error.code === ERROR_CODES.INVALID_ACTION
  );
});

test("detects a winning row on the server", () => {
  let state = TicTacToeEngine.start({ players });
  const moves = [
    ["player-a", 0],
    ["player-b", 3],
    ["player-a", 1],
    ["player-b", 4],
    ["player-a", 2]
  ];

  for (const [playerId, cell] of moves) {
    state = TicTacToeEngine.applyAction({ action: { type: "place", cell }, playerId, players, state });
  }

  assert.equal(state.winnerId, "player-a");
  assert.deepEqual(state.winningLine, [0, 1, 2]);
  assert.equal(TicTacToeEngine.isFinished(state), true);
});

test("returns a player-specific mark in the public view", () => {
  const state = TicTacToeEngine.start({ players });
  assert.equal(TicTacToeEngine.view(state, "player-b").yourMark, "O");
});
