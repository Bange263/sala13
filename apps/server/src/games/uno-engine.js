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
      winnerId: null,
      stacking: Boolean(settings.stacking)
    };
  }

  static applyAction({ action, playerId, state }) {
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
    if (card.color === "wild" && !validColor(action.color)) invalid("Scegli il nuovo colore.");

    hand.splice(cardIndex, 1);
    next.discardPile.push(card);
    next.currentColor = card.color === "wild" ? action.color : card.color;

    if (hand.length === 1 && action.uno !== true) drawCards(next, playerId, 2);

    if (hand.length === 0) {
      next.winnerId = playerId;
      next.phase = "finished";
      next.currentPlayerId = null;
      return next;
    }

    if (card.value === "reverse") {
      next.direction *= -1;
      advance(next, next.order.length === 2 ? 2 : 1);
    } else if (card.value === "skip") {
      advance(next, 2);
    } else if (card.value === "draw2" || card.value === "wild4") {
      const amount = card.value === "draw2" ? 2 : 4;
      if (next.stacking) {
        next.pendingDraw += amount;
        next.pendingType = card.value;
        advance(next);
      } else {
        advance(next);
        drawCards(next, next.currentPlayerId, amount);
        advance(next);
      }
    } else {
      advance(next);
    }
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
      winnerId: state.winnerId,
      stacking: state.stacking,
      hands: Object.fromEntries(state.order.map((id) => [id, id === playerId ? state.hands[id] : { count: state.hands[id].length }]))
    };
  }

  static isFinished(state) {
    return state.phase === "finished";
  }
}
