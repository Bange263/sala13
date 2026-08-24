import { cloneState, invalid, requirePlayers, requireTurn } from "./game-utils.js";

const ROWS = 6;
const COLUMNS = 7;

function lineFrom(board, row, column, mark) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [rowStep, columnStep] of directions) {
    const cells = [row * COLUMNS + column];
    for (const direction of [-1, 1]) {
      let nextRow = row + rowStep * direction;
      let nextColumn = column + columnStep * direction;
      while (
        nextRow >= 0 && nextRow < ROWS && nextColumn >= 0 && nextColumn < COLUMNS &&
        board[nextRow * COLUMNS + nextColumn] === mark
      ) {
        if (direction < 0) cells.unshift(nextRow * COLUMNS + nextColumn);
        else cells.push(nextRow * COLUMNS + nextColumn);
        nextRow += rowStep * direction;
        nextColumn += columnStep * direction;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

export class ConnectFourEngine {
  static implemented = true;

  static start({ players }) {
    requirePlayers(players, { min: 2 });
    return {
      kind: "connect-four",
      board: Array(ROWS * COLUMNS).fill(null),
      marks: { [players[0].id]: "R", [players[1].id]: "Y" },
      order: players.map((player) => player.id),
      currentPlayerId: players[0].id,
      winnerId: null,
      winningLine: null,
      draw: false,
      moveCount: 0
    };
  }

  static applyAction({ action, playerId, state }) {
    if (state.winnerId || state.draw) invalid("La partita è terminata.");
    requireTurn(state, playerId);
    if (action.type !== "drop" || !Number.isInteger(action.column) || action.column < 0 || action.column >= COLUMNS) {
      invalid("Colonna non valida.");
    }
    const next = cloneState(state);
    let row = ROWS - 1;
    while (row >= 0 && next.board[row * COLUMNS + action.column]) row -= 1;
    if (row < 0) invalid("Questa colonna è piena.");
    next.board[row * COLUMNS + action.column] = next.marks[playerId];
    next.moveCount += 1;
    next.winningLine = lineFrom(next.board, row, action.column, next.marks[playerId]);
    next.winnerId = next.winningLine ? playerId : null;
    next.draw = !next.winnerId && next.moveCount === ROWS * COLUMNS;
    next.currentPlayerId = next.winnerId || next.draw ? null : next.order.find((id) => id !== playerId);
    next.lastDrop = { row, column: action.column };
    return next;
  }

  static view(state, playerId) {
    return { ...state, yourMark: state.marks[playerId] ?? null, rows: ROWS, columns: COLUMNS };
  }

  static isFinished(state) {
    return Boolean(state.winnerId || state.draw);
  }
}
