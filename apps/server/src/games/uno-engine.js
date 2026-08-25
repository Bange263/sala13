import { secureShuffle } from "./card-utils.js";
import { cloneState, invalid, nextPlayerId, requirePlayers, requireTurn } from "./game-utils.js";

const COLORS = Object.freeze(["red", "yellow", "green", "blue"]);

function unoDeck(deckCount = 1) {
  const cards = [];
  let sequence = 0;
  const add = (color, value) => cards.push({ id: `uno-${sequence++}`, color, value });
  for (let deckIndex = 0; deckIndex < deckCount; deckIndex += 1) {
    for (const color of COLORS) {
      add(color, "0");
      for (let copy = 0; copy < 2; copy += 1) {
        for (let value = 1; value <= 9; value += 1) add(color, String(value));
        for (const value of ["skip", "reverse", "draw2"]) add(color, value);
      }
    }
    for (let copy = 0; copy < 4; copy += 1) {
      add("wild", "wild");
      add("wild", "wild4");
    }
  }
  return secureShuffle(cards);
}

function refillDrawPile(state) {
  if (state.drawPile.length > 0 || state.discardPile.length <= 1) return;
  const top = state.discardPile.at(-1);
  state.drawPile = secureShuffle(state.discardPile.slice(0, -1));
  state.discardPile = [top];
}

function drawCards(state, playerId, count) {
  for (let index = 0; index < count; index += 1) {
    refillDrawPile(state);
    const card = state.drawPile.shift();
    if (!card) break;
    state.hands[playerId].push(card);
  }
}

function advance(state, steps = 1) {
  for (let count = 0; count < steps; count += 1) {
    state.currentPlayerId = nextPlayerId(state.order, state.currentPlayerId, state.direction);
  }
}

function playable(card, state) {
  const top = state.discardPile.at(-1);
  if (card.color === "wild") return true;
  return card.color === state.currentColor || card.value === top.value;
}

function validColor(value) {
  return COLORS.includes(value);
}

function resolvePlayedCard(state, playerId, card) {
  const hand = state.hands[playerId];
  if (hand.length === 0) {
    state.winnerId = playerId;
    state.phase = "finished";
    state.currentPlayerId = null;
    return;
  }
  if (card.value === "reverse") {
    state.direction *= -1;
    advance(state, state.order.length === 2 ? 2 : 1);
  } else if (card.value === "skip") {
    advance(state, 2);
  } else if (card.value === "draw2" || card.value === "wild4") {
    const amount = card.value === "draw2" ? 2 : 4;
    if (state.stacking) {
      state.pendingDraw += amount;
      state.pendingType = card.value;
      advance(state);
    } else {
      advance(state);
      drawCards(state, state.currentPlayerId, amount);
      advance(state);
    }
  } else {
    advance(state);
  }
}

export class UnoEngine {
  static implemented = true;

  static start({ players, settings }) {
    requirePlayers(players, { min: 2, max: 20 });
    const deck = unoDeck(Math.ceil((players.length * 7 + 1) / 108));
    const hands = Object.fromEntries(players.map((player) => [player.id, []]));
    for (let round = 0; round < 7; round += 1) {
      for (const player of players) hands[player.id].push(deck.shift());
    }
    let firstIndex = deck.findIndex((card) => card.color !== "wild" && !["draw2", "skip", "reverse"].includes(card.value));
    if (firstIndex < 0) firstIndex = 0;
    const [first] = deck.splice(firstIndex, 1);
    return {
      kind: "uno",
      phase: "playing",
      order: players.map((player) => player.id),
      currentPlayerId: players[0].id,
      direction: 1,
      drawPile: deck,
      discardPile: [first],
      currentColor: first.color,
      hands,
      pendingDraw: 0,
      pendingType: null,
      pendingWild: null,
      winnerId: null,
      stacking: Boolean(settings.stacking)
    };
  }

  static applyAction({ action, playerId, state }) {
    if (state.phase === "choose-color") {
      requireTurn(state, playerId);
      if (action.type !== "choose-color" || !validColor(action.color) || state.pendingWild?.playerId !== playerId) {
        invalid("Scegli uno dei quattro colori dopo aver giocato il Jolly.");
      }
      const next = cloneState(state);
      const card = { value: next.pendingWild.cardValue, color: "wild" };
      next.currentColor = action.color;
      next.pendingWild = null;
      next.phase = "playing";
      resolvePlayedCard(next, playerId, card);
      return next;
    }
    if (state.phase !== "playing") invalid("La partita è terminata.");
    requireTurn(state, playerId);
    const next = cloneState(state);

    if (action.type === "draw") {
      const amount = next.pendingDraw || 1;
      drawCards(next, playerId, amount);
      next.pendingDraw = 0;
      next.pendingType = null;
      advance(next);
      return next;
    }

    if (action.type !== "play" || typeof action.cardId !== "string") {
      invalid("Azione Uno non riconosciuta.");
    }

    const hand = next.hands[playerId];
    const cardIndex = hand.findIndex((card) => card.id === action.cardId);
    if (cardIndex < 0) invalid("Questa carta non è nella tua mano.");
    const card = hand[cardIndex];

    if (next.pendingDraw > 0) {
      if (!next.stacking || card.value !== next.pendingType) {
        invalid(`Devi pescare ${next.pendingDraw} carte oppure accumulare una carta compatibile.`);
      }
    } else if (!playable(card, next)) {
      invalid("La carta non corrisponde per colore o simbolo.");
    }
    if (card.value === "wild4" && next.pendingDraw === 0 && hand.some((candidate) => candidate.id !== card.id && candidate.color === next.currentColor)) {
      invalid("Il +4 non è legale perché possiedi una carta del colore corrente.");
    }
    hand.splice(cardIndex, 1);
    next.discardPile.push(card);
    if (card.color !== "wild") next.currentColor = card.color;

    if (hand.length === 1 && action.uno !== true) drawCards(next, playerId, 2);

    if (card.color === "wild") {
      next.phase = "choose-color";
      next.pendingWild = { playerId, cardValue: card.value };
      return next;
    }
    resolvePlayedCard(next, playerId, card);
    return next;
  }

  static view(state, playerId) {
    return {
      kind: state.kind,
      phase: state.phase,
      order: state.order,
      currentPlayerId: state.currentPlayerId,
      direction: state.direction,
      topCard: state.discardPile.at(-1),
      currentColor: state.currentColor,
      drawCount: state.drawPile.length,
      pendingDraw: state.pendingDraw,
      pendingType: state.pendingType,
      awaitingColor: state.phase === "choose-color",
      pendingWildPlayerId: state.pendingWild?.playerId ?? null,
      winnerId: state.winnerId,
      stacking: state.stacking,
      hands: Object.fromEntries(state.order.map((id) => [id, id === playerId ? state.hands[id] : { count: state.hands[id].length }]))
    };
  }

  static isFinished(state) {
    return state.phase === "finished";
  }

  static botAction({ playerId, state }) {
    const hand = state.hands[playerId];
    if (state.phase === "choose-color" && state.pendingWild?.playerId === playerId) {
      const counts = Object.fromEntries(COLORS.map((color) => [color, hand.filter((card) => card.color === color).length]));
      const color = [...COLORS].sort((left, right) => counts[right] - counts[left])[0];
      return { type: "choose-color", color };
    }
    if (state.phase !== "playing" || state.currentPlayerId !== playerId) return null;
    const card = hand.find((candidate) => {
      if (state.pendingDraw > 0) return state.stacking && candidate.value === state.pendingType;
      if (!playable(candidate, state)) return false;
      return candidate.value !== "wild4" || !hand.some((other) => other.id !== candidate.id && other.color === state.currentColor);
    });
    return card ? { type: "play", cardId: card.id, uno: hand.length === 2 } : { type: "draw" };
  }
}
