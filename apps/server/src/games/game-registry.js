import { getGame } from "@sala13/shared";
import { BattleshipEngine } from "./battleship-engine.js";
import { BlackjackEngine } from "./blackjack-engine.js";
import { BurracoEngine } from "./burraco-engine.js";
import { ChessCheckersEngine } from "./chess-checkers-engine.js";
import { ConnectFourEngine } from "./connect-four-engine.js";
import { DrawAndPassEngine } from "./draw-and-pass-engine.js";
import { BriscolaEngine, ScopaEngine } from "./italian-card-engines.js";
import { PokerEngine } from "./poker-engine.js";
import { TicTacToeEngine } from "./tic-tac-toe-engine.js";
import { UnoEngine } from "./uno-engine.js";
import { CategoriesEngine, HangmanEngine } from "./word-engines.js";

const engines = new Map([
  ["blackjack", BlackjackEngine],
  ["uno", UnoEngine],
  ["scopa", ScopaEngine],
  ["briscola", BriscolaEngine],
  ["texas-holdem", PokerEngine],
  ["burraco", BurracoEngine],
  ["battleship", BattleshipEngine],
  ["chess-checkers", ChessCheckersEngine],
  ["tic-tac-toe", TicTacToeEngine],
  ["categories", CategoriesEngine],
  ["hangman", HangmanEngine],
  ["connect-four", ConnectFourEngine],
  ["draw-and-pass", DrawAndPassEngine]
]);

export function resolveGame(gameId) {
  const definition = getGame(gameId);
  if (!definition) return null;
  return {
    definition,
    engine: engines.get(gameId)
  };
}
