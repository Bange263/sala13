import { getGame } from "@sala13/shared";
import { PlaceholderEngine } from "./placeholder-engine.js";
import { TicTacToeEngine } from "./tic-tac-toe-engine.js";

const engines = new Map([["tic-tac-toe", TicTacToeEngine]]);

export function resolveGame(gameId) {
  const definition = getGame(gameId);
  if (!definition) return null;
  return {
    definition,
    engine: engines.get(gameId) ?? PlaceholderEngine
  };
}
