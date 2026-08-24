import { ERROR_CODES } from "@sala13/shared";
import { PublicError } from "../utils/public-error.js";

export function invalid(message, details) {
  throw new PublicError(ERROR_CODES.INVALID_ACTION, message, details);
}

export function requirePlayers(players, { min, max = min, allowed } = {}) {
  const valid = allowed
    ? allowed.includes(players.length)
    : players.length >= min && players.length <= max;
  if (!valid) invalid("Numero di giocatori non valido per questa modalità.");
}

export function requireTurn(state, playerId) {
  if (state.currentPlayerId !== playerId) invalid("Non è il tuo turno.");
}

export function nextPlayerId(order, currentPlayerId, direction = 1, skip = new Set()) {
  if (order.length === 0) return null;
  let index = order.indexOf(currentPlayerId);
  for (let attempts = 0; attempts < order.length; attempts += 1) {
    index = (index + direction + order.length) % order.length;
    if (!skip.has(order[index])) return order[index];
  }
  return null;
}

export function cloneState(state) {
  return structuredClone(state);
}

export function publicPlayers(players, records) {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    ...(records?.[player.id] ?? {})
  }));
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("it");
}
