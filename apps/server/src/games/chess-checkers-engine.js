import { cloneState, invalid, requirePlayers, requireTurn } from "./game-utils.js";

const SIZE = 8;
const opposite = (color) => color === "w" ? "b" : "w";
const indexOf = (row, column) => row * SIZE + column;
const coordinates = (index) => [Math.floor(index / SIZE), index % SIZE];
const inside = (row, column) => row >= 0 && row < SIZE && column >= 0 && column < SIZE;
const pieceColor = (piece) => piece?.[0] ?? null;
const pieceType = (piece) => piece?.[1] ?? null;

function chessBoard() {
  const board = Array(64).fill(null);
  const back = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let column = 0; column < SIZE; column += 1) {
    board[indexOf(0, column)] = `b${back[column]}`;
    board[indexOf(1, column)] = "bP";
    board[indexOf(6, column)] = "wP";
    board[indexOf(7, column)] = `w${back[column]}`;
  }
  return board;
}

function slidingMoves(board, from, color, directions, attacksOnly) {
  const [row, column] = coordinates(from);
  const moves = [];
  for (const [rowStep, columnStep] of directions) {
    let targetRow = row + rowStep;
    let targetColumn = column + columnStep;
    while (inside(targetRow, targetColumn)) {
      const to = indexOf(targetRow, targetColumn);
      const target = board[to];
      if (!target) moves.push({ from, to });
      else {
        if (attacksOnly || pieceColor(target) !== color) moves.push({ from, to });
        break;
      }
      targetRow += rowStep;
      targetColumn += columnStep;
    }
  }
  return moves;
}

function attacked(state, square, byColor) {
  for (let from = 0; from < 64; from += 1) {
    if (pieceColor(state.board[from]) !== byColor) continue;
    if (pseudoChessMoves(state, from, true).some((move) => move.to === square)) return true;
  }
  return false;
}

function pseudoChessMoves(state, from, attacksOnly = false) {
  const board = state.board;
  const piece = board[from];
  const color = pieceColor(piece);
  const type = pieceType(piece);
  if (!piece) return [];
  const [row, column] = coordinates(from);
  const moves = [];
  const add = (targetRow, targetColumn, special = null) => {
    if (!inside(targetRow, targetColumn)) return;
    const to = indexOf(targetRow, targetColumn);
    const target = board[to];
    if (!target || pieceColor(target) !== color || attacksOnly) moves.push({ from, to, special });
  };

  if (type === "P") {
    const direction = color === "w" ? -1 : 1;
    for (const columnStep of [-1, 1]) add(row + direction, column + columnStep, "pawn-attack");
    if (attacksOnly) return moves;
    moves.length = 0;
    const one = indexOf(row + direction, column);
    if (inside(row + direction, column) && !board[one]) {
      moves.push({ from, to: one, special: row + direction === 0 || row + direction === 7 ? "promotion" : null });
      const startRow = color === "w" ? 6 : 1;
      const two = indexOf(row + direction * 2, column);
      if (row === startRow && !board[two]) moves.push({ from, to: two, special: "double-pawn" });
    }
    for (const columnStep of [-1, 1]) {
      const targetRow = row + direction;
      const targetColumn = column + columnStep;
      if (!inside(targetRow, targetColumn)) continue;
      const to = indexOf(targetRow, targetColumn);
      if ((board[to] && pieceColor(board[to]) !== color) || to === state.enPassant) {
        moves.push({ from, to, special: to === state.enPassant ? "en-passant" : (targetRow === 0 || targetRow === 7 ? "promotion" : null) });
      }
    }
    return moves;
  }

  if (type === "N") {
    for (const [rowStep, columnStep] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
      add(row + rowStep, column + columnStep);
    }
    return moves;
  }
  if (type === "B") return slidingMoves(board, from, color, [[-1, -1], [-1, 1], [1, -1], [1, 1]], attacksOnly);
  if (type === "R") return slidingMoves(board, from, color, [[-1, 0], [1, 0], [0, -1], [0, 1]], attacksOnly);
  if (type === "Q") return slidingMoves(board, from, color, [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]], attacksOnly);
  if (type === "K") {
    for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
      for (let columnStep = -1; columnStep <= 1; columnStep += 1) {
        if (rowStep || columnStep) add(row + rowStep, column + columnStep);
      }
    }
    if (attacksOnly) return moves;
    const homeRow = color === "w" ? 7 : 0;
    const enemy = opposite(color);
    if (from === indexOf(homeRow, 4) && !attacked(state, from, enemy)) {
      if (
        state.castling[color].king && board[indexOf(homeRow, 7)] === `${color}R` &&
        !board[indexOf(homeRow, 5)] && !board[indexOf(homeRow, 6)] &&
        !attacked(state, indexOf(homeRow, 5), enemy) && !attacked(state, indexOf(homeRow, 6), enemy)
      ) moves.push({ from, to: indexOf(homeRow, 6), special: "castle-king" });
      if (
        state.castling[color].queen && board[indexOf(homeRow, 0)] === `${color}R` &&
        !board[indexOf(homeRow, 1)] && !board[indexOf(homeRow, 2)] && !board[indexOf(homeRow, 3)] &&
        !attacked(state, indexOf(homeRow, 3), enemy) && !attacked(state, indexOf(homeRow, 2), enemy)
      ) moves.push({ from, to: indexOf(homeRow, 2), special: "castle-queen" });
    }
  }
  return moves;
}

function boardAfterChessMove(state, move, promotion = "Q") {
  const board = [...state.board];
  const piece = board[move.from];
  const color = pieceColor(piece);
  board[move.from] = null;
  if (move.special === "en-passant") {
    const [targetRow, targetColumn] = coordinates(move.to);
    board[indexOf(targetRow + (color === "w" ? 1 : -1), targetColumn)] = null;
  }
  if (move.special === "castle-king") {
    const [row] = coordinates(move.from);
    board[indexOf(row, 5)] = board[indexOf(row, 7)];
    board[indexOf(row, 7)] = null;
  }
  if (move.special === "castle-queen") {
    const [row] = coordinates(move.from);
    board[indexOf(row, 3)] = board[indexOf(row, 0)];
    board[indexOf(row, 0)] = null;
  }
  board[move.to] = move.special === "promotion" ? `${color}${promotion}` : piece;
  return board;
}

function legalChessMoves(state, color, onlyFrom = null) {
  const legal = [];
  for (let from = 0; from < 64; from += 1) {
    if ((onlyFrom !== null && from !== onlyFrom) || pieceColor(state.board[from]) !== color) continue;
    for (const move of pseudoChessMoves(state, from)) {
      const board = boardAfterChessMove(state, move);
      const king = board.findIndex((piece) => piece === `${color}K`);
      if (king < 0) continue;
      const projected = { ...state, board };
      if (!attacked(projected, king, opposite(color))) legal.push(move);
    }
  }
  return legal;
}

function chessKey(state) {
  return `${state.board.map((piece) => piece ?? "--").join("")}|${state.turn}|${JSON.stringify(state.castling)}|${state.enPassant ?? "-"}`;
}

function startChess(order) {
  const state = {
    kind: "chess-checkers",
    variant: "chess",
    board: chessBoard(),
    order,
    colors: { [order[0]]: "w", [order[1]]: "b" },
    turn: "w",
    currentPlayerId: order[0],
    castling: { w: { king: true, queen: true }, b: { king: true, queen: true } },
    enPassant: null,
    halfmoveClock: 0,
    fullmove: 1,
    repetition: {},
    lastMove: null,
    inCheck: false,
    result: null,
    winnerId: null
  };
  state.repetition[chessKey(state)] = 1;
  return state;
}

function applyChess(action, playerId, state) {
  if (state.result) invalid("La partita è terminata.");
  requireTurn(state, playerId);
  const from = Number(action.from);
  const to = Number(action.to);
  if (action.type !== "move" || !Number.isInteger(from) || !Number.isInteger(to)) invalid("Mossa non valida.");
  const legal = legalChessMoves(state, state.turn, from);
  const move = legal.find((candidate) => candidate.to === to);
  if (!move) invalid("Questa mossa non è legale.");
  const next = cloneState(state);
  const movingPiece = next.board[from];
  const capturedPiece = next.board[to];
  const color = next.turn;
  const promotion = ["Q", "R", "B", "N"].includes(action.promotion) ? action.promotion : "Q";
  next.board = boardAfterChessMove(next, move, promotion);

  if (pieceType(movingPiece) === "K") next.castling[color] = { king: false, queen: false };
  const rookSquares = { w: { queen: 56, king: 63 }, b: { queen: 0, king: 7 } };
  if (pieceType(movingPiece) === "R") {
    if (from === rookSquares[color].king) next.castling[color].king = false;
    if (from === rookSquares[color].queen) next.castling[color].queen = false;
  }
  const capturedColor = pieceColor(capturedPiece);
  if (pieceType(capturedPiece) === "R") {
    if (to === rookSquares[capturedColor].king) next.castling[capturedColor].king = false;
    if (to === rookSquares[capturedColor].queen) next.castling[capturedColor].queen = false;
  }
  if (move.special === "double-pawn") next.enPassant = (from + to) / 2;
  else next.enPassant = null;
  next.halfmoveClock = pieceType(movingPiece) === "P" || capturedPiece || move.special === "en-passant" ? 0 : next.halfmoveClock + 1;
  if (color === "b") next.fullmove += 1;
  next.turn = opposite(color);
  next.currentPlayerId = next.order.find((id) => next.colors[id] === next.turn);
  next.lastMove = { from, to, piece: movingPiece, captured: capturedPiece, special: move.special, promotion };
  const king = next.board.findIndex((piece) => piece === `${next.turn}K`);
  next.inCheck = attacked(next, king, color);
  const replies = legalChessMoves(next, next.turn);
  if (replies.length === 0) {
    next.result = next.inCheck ? "checkmate" : "stalemate";
    next.winnerId = next.inCheck ? playerId : null;
    next.currentPlayerId = null;
  } else if (next.halfmoveClock >= 100) {
    next.result = "fifty-move-draw";
    next.currentPlayerId = null;
  } else {
    const key = chessKey(next);
    next.repetition[key] = (next.repetition[key] ?? 0) + 1;
    if (next.repetition[key] >= 3) {
      next.result = "threefold-draw";
      next.currentPlayerId = null;
    }
  }
  return next;
}

function checkersBoard() {
  const board = Array(64).fill(null);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 8; column += 1) if ((row + column) % 2 === 1) board[indexOf(row, column)] = "bM";
  }
  for (let row = 5; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) if ((row + column) % 2 === 1) board[indexOf(row, column)] = "wM";
  }
  return board;
}

function checkerCaptures(board, from) {
  const piece = board[from];
  const color = pieceColor(piece);
  const king = pieceType(piece) === "K";
  const [row, column] = coordinates(from);
  const rowSteps = king ? [-1, 1] : [color === "w" ? -1 : 1];
  const moves = [];
  for (const rowStep of rowSteps) {
    for (const columnStep of [-1, 1]) {
      const middleRow = row + rowStep;
      const middleColumn = column + columnStep;
      const targetRow = row + rowStep * 2;
      const targetColumn = column + columnStep * 2;
      if (!inside(targetRow, targetColumn)) continue;
      const captured = indexOf(middleRow, middleColumn);
      const to = indexOf(targetRow, targetColumn);
      if (board[captured] && pieceColor(board[captured]) !== color && !board[to]) moves.push({ from, to, captured });
    }
  }
  return moves;
}

function legalCheckerMoves(state, color) {
  const fromSquares = state.continuationFrom !== null ? [state.continuationFrom] : Array.from({ length: 64 }, (_, index) => index);
  const captures = fromSquares.flatMap((from) => pieceColor(state.board[from]) === color ? checkerCaptures(state.board, from) : []);
  if (captures.length > 0) return captures;
  if (state.continuationFrom !== null) return [];
  const moves = [];
  for (let from = 0; from < 64; from += 1) {
    const piece = state.board[from];
    if (pieceColor(piece) !== color) continue;
    const [row, column] = coordinates(from);
    const rowSteps = pieceType(piece) === "K" ? [-1, 1] : [color === "w" ? -1 : 1];
    for (const rowStep of rowSteps) {
      for (const columnStep of [-1, 1]) {
        const targetRow = row + rowStep;
        const targetColumn = column + columnStep;
        if (inside(targetRow, targetColumn) && !state.board[indexOf(targetRow, targetColumn)]) {
          moves.push({ from, to: indexOf(targetRow, targetColumn), captured: null });
        }
      }
    }
  }
  return moves;
}

function startCheckers(order) {
  return {
    kind: "chess-checkers",
    variant: "checkers",
    board: checkersBoard(),
    order,
    colors: { [order[0]]: "w", [order[1]]: "b" },
    turn: "w",
    currentPlayerId: order[0],
    continuationFrom: null,
    lastMove: null,
    quietMoves: 0,
    result: null,
    winnerId: null
  };
}

function applyCheckers(action, playerId, state) {
  if (state.result) invalid("La partita è terminata.");
  requireTurn(state, playerId);
  const from = Number(action.from);
  const to = Number(action.to);
  if (action.type !== "move" || !Number.isInteger(from) || !Number.isInteger(to)) invalid("Mossa non valida.");
  const move = legalCheckerMoves(state, state.turn).find((candidate) => candidate.from === from && candidate.to === to);
  if (!move) invalid("Mossa non valida: ricorda che la presa è obbligatoria.");
  const next = cloneState(state);
  const piece = next.board[from];
  next.board[from] = null;
  next.board[to] = piece;
  if (move.captured !== null) next.board[move.captured] = null;
  const [targetRow] = coordinates(to);
  if (pieceType(piece) === "M" && ((next.turn === "w" && targetRow === 0) || (next.turn === "b" && targetRow === 7))) {
    next.board[to] = `${next.turn}K`;
  }
  next.lastMove = { from, to, captured: move.captured };
  next.quietMoves = move.captured === null ? next.quietMoves + 1 : 0;
  if (move.captured !== null && checkerCaptures(next.board, to).length > 0) {
    next.continuationFrom = to;
    return next;
  }
  next.continuationFrom = null;
  next.turn = opposite(next.turn);
  next.currentPlayerId = next.order.find((id) => next.colors[id] === next.turn);
  const remaining = next.board.filter((candidate) => pieceColor(candidate) === next.turn).length;
  if (remaining === 0 || legalCheckerMoves(next, next.turn).length === 0) {
    next.result = "win";
    next.winnerId = playerId;
    next.currentPlayerId = null;
  } else if (next.quietMoves >= 80) {
    next.result = "draw";
    next.currentPlayerId = null;
  }
  return next;
}

export class ChessCheckersEngine {
  static implemented = true;

  static start({ players, settings }) {
    requirePlayers(players, { min: 2 });
    const order = players.map((player) => player.id);
    return settings.variant === "checkers" || settings.variant === "dama" ? startCheckers(order) : startChess(order);
  }

  static applyAction({ action, playerId, state }) {
    return state.variant === "checkers" ? applyCheckers(action, playerId, state) : applyChess(action, playerId, state);
  }

  static view(state, playerId) {
    const yourColor = state.colors[playerId] ?? null;
    const legalMoves = state.currentPlayerId === playerId && !state.result
      ? (state.variant === "checkers" ? legalCheckerMoves(state, yourColor) : legalChessMoves(state, yourColor))
          .map(({ from, to }) => ({ from, to }))
      : [];
    return {
      ...state,
      repetition: undefined,
      yourColor,
      legalMoves
    };
  }

  static isFinished(state) {
    return Boolean(state.result);
  }

  static botAction({ playerId, state }) {
    if (state.currentPlayerId !== playerId || state.result) return null;
    const color = state.colors[playerId];
    const moves = state.variant === "checkers" ? legalCheckerMoves(state, color) : legalChessMoves(state, color);
    const move = moves.find((candidate) => state.board[candidate.to]) ?? moves[0];
    return move ? { type: "move", from: move.from, to: move.to, promotion: "Q" } : null;
  }
}
