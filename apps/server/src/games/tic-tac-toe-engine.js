import { ERROR_CODES } from "@sala13/shared";
import { PublicError } from "../utils/public-error.js";

const WINNING_LINES = Object.freeze([
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
]);

function winningLine(board) {
  return WINNING_LINES.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]) ?? null;
}

export class TicTacToeEngine {
  static implemented = true;

  static start({ players }) {
    if (players.length !== 2) {
      throw new PublicError(ERROR_CODES.NOT_READY, "Il Tris richiede esattamente due giocatori.");
    }

    return {
      board: Array(9).fill(null),
      marks: {
        [players[0].id]: "X",
        [players[1].id]: "O"
      },
      currentPlayerId: players[0].id,
      winnerId: null,
      winningLine: null,
      draw: false,
      moveCount: 0
    };
  }

  static applyAction({ action, playerId, players, state }) {
    if (action?.type !== "place" || !Number.isInteger(action.cell)) {
      throw new PublicError(ERROR_CODES.INVALID_ACTION, "Mossa non riconosciuta.");
    }
    if (state.winnerId || state.draw) {
      throw new PublicError(ERROR_CODES.INVALID_ACTION, "La partita è già terminata.");
    }
    if (state.currentPlayerId !== playerId) {
      throw new PublicError(ERROR_CODES.INVALID_ACTION, "Non è il tuo turno.");
    }
    if (action.cell < 0 || action.cell > 8 || state.board[action.cell] !== null) {
      throw new PublicError(ERROR_CODES.INVALID_ACTION, "Questa casella non è disponibile.");
    }

    const board = [...state.board];
    board[action.cell] = state.marks[playerId];
    const line = winningLine(board);
    const moveCount = state.moveCount + 1;
    const draw = !line && moveCount === 9;
    const nextPlayer = players.find((player) => player.id !== playerId);

    return {
      ...state,
      board,
      currentPlayerId: line || draw ? null : nextPlayer.id,
      winnerId: line ? playerId : null,
      winningLine: line,
      draw,
      moveCount
    };
  }

  static view(state, playerId) {
    return {
      ...state,
      yourMark: state.marks[playerId] ?? null
    };
  }

  static isFinished(state) {
    return Boolean(state.winnerId || state.draw);
  }
}
