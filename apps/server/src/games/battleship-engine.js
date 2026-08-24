import { randomInt } from "node:crypto";
import { cloneState, invalid, nextPlayerId, requirePlayers, requireTurn } from "./game-utils.js";

const GRID_SIZE = 10;
const FLEET = Object.freeze([
  { id: "carrier", size: 5 },
  { id: "battleship", size: 4 },
  { id: "cruiser", size: 3 },
  { id: "submarine", size: 3 },
  { id: "destroyer", size: 2 }
]);

function validCell(cell) {
  return Number.isInteger(cell) && cell >= 0 && cell < GRID_SIZE * GRID_SIZE;
}

function validatePlacement(ships) {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return null;
  const occupied = new Set();
  const normalized = [];
  for (const required of FLEET) {
    const ship = ships.find((candidate) => candidate.id === required.id);
    if (!ship || !Array.isArray(ship.cells) || ship.cells.length !== required.size) return null;
    const cells = [...new Set(ship.cells.map(Number))];
    if (cells.length !== required.size || cells.some((cell) => !validCell(cell) || occupied.has(cell))) return null;
    const rows = new Set(cells.map((cell) => Math.floor(cell / GRID_SIZE)));
    const columns = new Set(cells.map((cell) => cell % GRID_SIZE));
    if (rows.size !== 1 && columns.size !== 1) return null;
    const sorted = [...cells].sort((a, b) => a - b);
    const step = rows.size === 1 ? 1 : GRID_SIZE;
    if (sorted.some((cell, index) => index > 0 && cell - sorted[index - 1] !== step)) return null;
    for (const cell of cells) occupied.add(cell);
    normalized.push({ id: required.id, size: required.size, cells: sorted, hits: [] });
  }
  return normalized;
}

function autoPlacement() {
  const ships = [];
  const occupied = new Set();
  for (const ship of FLEET) {
    let placed = false;
    while (!placed) {
      const horizontal = randomInt(0, 2) === 0;
      const row = randomInt(0, horizontal ? GRID_SIZE : GRID_SIZE - ship.size + 1);
      const column = randomInt(0, horizontal ? GRID_SIZE - ship.size + 1 : GRID_SIZE);
      const cells = Array.from({ length: ship.size }, (_, offset) =>
        (row + (horizontal ? 0 : offset)) * GRID_SIZE + column + (horizontal ? offset : 0)
      );
      if (cells.some((cell) => occupied.has(cell))) continue;
      for (const cell of cells) occupied.add(cell);
      ships.push({ id: ship.id, cells });
      placed = true;
    }
  }
  return validatePlacement(ships);
}

function shipAt(board, cell) {
  return board.ships.find((ship) => ship.cells.includes(cell));
}

export class BattleshipEngine {
  static implemented = true;

  static start({ players }) {
    requirePlayers(players, { min: 2 });
    const order = players.map((player) => player.id);
    return {
      kind: "battleship",
      phase: "placement",
      order,
      boards: Object.fromEntries(order.map((id) => [id, { ships: null, incomingShots: {} }])),
      shots: Object.fromEntries(order.map((id) => [id, {}])),
      currentPlayerId: null,
      winnerId: null,
      lastShot: null
    };
  }

  static applyAction({ action, playerId, state }) {
    if (state.phase === "finished") invalid("La battaglia è terminata.");
    const next = cloneState(state);

    if (next.phase === "placement") {
      if (next.boards[playerId].ships) invalid("Hai già confermato la flotta.");
      const ships = action.type === "auto-place" ? autoPlacement() : validatePlacement(action.ships);
      if (!ships) invalid("Piazzamento della flotta non valido.");
      next.boards[playerId].ships = ships;
      if (next.order.every((id) => next.boards[id].ships)) {
        next.phase = "battle";
        next.currentPlayerId = next.order[0];
      }
      return next;
    }

    requireTurn(next, playerId);
    if (action.type !== "fire" || !validCell(action.cell)) invalid("Coordinata di tiro non valida.");
    if (Object.hasOwn(next.shots[playerId], action.cell)) invalid("Hai già sparato su questa casella.");
    const opponentId = next.order.find((id) => id !== playerId);
    const board = next.boards[opponentId];
    const ship = shipAt(board, action.cell);
    let result = "miss";
    if (ship) {
      ship.hits.push(action.cell);
      result = ship.hits.length === ship.cells.length ? "sunk" : "hit";
      if (result === "sunk") {
        for (const cell of ship.cells) {
          next.shots[playerId][cell] = "sunk";
          board.incomingShots[cell] = "sunk";
        }
      }
    }
    next.shots[playerId][action.cell] = result;
    board.incomingShots[action.cell] = result;
    next.lastShot = { playerId, opponentId, cell: action.cell, result, shipId: result === "sunk" ? ship.id : null };

    if (board.ships.every((candidate) => candidate.hits.length === candidate.cells.length)) {
      next.phase = "finished";
      next.winnerId = playerId;
      next.currentPlayerId = null;
    } else {
      next.currentPlayerId = nextPlayerId(next.order, playerId);
    }
    return next;
  }

  static view(state, playerId) {
    const own = state.boards[playerId];
    const opponentId = state.order.find((id) => id !== playerId);
    return {
      kind: state.kind,
      phase: state.phase,
      gridSize: GRID_SIZE,
      fleet: FLEET,
      order: state.order,
      currentPlayerId: state.currentPlayerId,
      placed: Object.fromEntries(state.order.map((id) => [id, Boolean(state.boards[id].ships)])),
      ownBoard: own.ships ? { ships: own.ships, incomingShots: own.incomingShots } : null,
      targetBoard: { playerId: opponentId, shots: state.shots[playerId] },
      winnerId: state.winnerId,
      lastShot: state.lastShot
    };
  }

  static isFinished(state) {
    return state.phase === "finished";
  }
}
