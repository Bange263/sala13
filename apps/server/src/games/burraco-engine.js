import { cloneState, invalid, nextPlayerId, requirePlayers, requireTurn } from "./game-utils.js";
import { draw, shuffledFrenchDeck } from "./standard-cards.js";

function teamFor(order, playerId) {
  return order.length === 4 ? (order.indexOf(playerId) % 2 === 0 ? "team-1" : "team-2") : playerId;
}

function isWild(card) {
  return card.joker || card.rank === "2";
}

function rankNumber(card) {
  if (card.rank === "A") return 1;
  if (card.rank === "J") return 11;
  if (card.rank === "Q") return 12;
  if (card.rank === "K") return 13;
  return Number(card.rank);
}

function validateMeld(cards) {
  if (cards.length < 3) return null;
  const wilds = cards.filter(isWild);
  const natural = cards.filter((card) => !isWild(card));
  if (wilds.length > 1) return null;
  if (natural.length === 0) return null;

  if (natural.every((card) => card.rank === natural[0].rank)) {
    const suits = new Set(natural.map((card) => card.suit));
    if (suits.size !== natural.length) return null;
    return { type: "group", clean: wilds.length === 0 };
  }

  if (!natural.every((card) => card.suit === natural[0].suit)) return null;
  const values = natural.map(rankNumber).sort((a, b) => a - b);
  if (new Set(values).size !== values.length) return null;
  let gaps = 0;
  for (let index = 1; index < values.length; index += 1) gaps += values[index] - values[index - 1] - 1;
  if (gaps > wilds.length) return null;
  return { type: "run", clean: wilds.length === 0 };
}

function cardPoints(card) {
  if (card.joker) return 30;
  if (card.rank === "2") return 20;
  if (card.rank === "A") return 15;
  if (["8", "9", "10", "J", "Q", "K"].includes(card.rank)) return 10;
  return 5;
}

function hasBurraco(state, team) {
  return state.melds[team].some((meld) => meld.cards.length >= 7);
}

function finish(state, winnerTeam) {
  state.phase = "finished";
  state.currentPlayerId = null;
  state.winnerTeam = winnerTeam;
  state.scores = {};
  for (const team of Object.keys(state.melds)) {
    let score = state.melds[team].flatMap((meld) => meld.cards).reduce((sum, card) => sum + cardPoints(card), 0);
    for (const meld of state.melds[team]) {
      if (meld.cards.length >= 7) score += meld.clean ? 200 : 100;
    }
    for (const id of state.order.filter((playerId) => teamFor(state.order, playerId) === team)) {
      score -= state.hands[id].reduce((sum, card) => sum + cardPoints(card), 0);
    }
    if (!state.tookPot[team]) score -= 100;
    if (team === winnerTeam) score += 100;
    state.scores[team] = score;
  }
}

function removeCards(hand, cardIds) {
  const unique = [...new Set(cardIds)];
  if (unique.length !== cardIds.length) invalid("Una carta non può essere usata due volte.");
  const cards = unique.map((id) => hand.find((card) => card.id === id));
  if (cards.some((card) => !card)) invalid("Una carta selezionata non è nella tua mano.");
  const ids = new Set(unique);
  return { cards, remaining: hand.filter((card) => !ids.has(card.id)) };
}

export class BurracoEngine {
  static implemented = true;

  static start({ players }) {
    requirePlayers(players, { min: 2, max: 4 });
    const order = players.map((player) => player.id);
    const deck = shuffledFrenchDeck({ decks: 2, jokersPerDeck: 2, prefix: `burraco-${Date.now()}` });
    const hands = Object.fromEntries(order.map((id) => [id, []]));
    for (let round = 0; round < 11; round += 1) {
      for (const id of order) hands[id].push(...draw(deck));
    }
    const pots = order.length === 4 ? [draw(deck, 11), draw(deck, 11)] : [draw(deck, 11), draw(deck, 11)];
    const teams = [...new Set(order.map((id) => teamFor(order, id)))];
    return {
      kind: "burraco",
      phase: "draw",
      order,
      currentPlayerId: order[0],
      deck,
      discardPile: draw(deck),
      hands,
      pots,
      melds: Object.fromEntries(teams.map((team) => [team, []])),
      tookPot: Object.fromEntries(teams.map((team) => [team, false])),
      winnerTeam: null,
      scores: null
    };
  }

  static applyAction({ action, playerId, state }) {
    if (state.phase === "finished") invalid("La partita di Burraco è terminata.");
    requireTurn(state, playerId);
    const next = cloneState(state);
    const hand = next.hands[playerId];
    const team = teamFor(next.order, playerId);

    if (action.type === "draw") {
      if (next.phase !== "draw") invalid("Hai già pescato in questo turno.");
      if (action.source === "discard") {
        if (next.discardPile.length === 0) invalid("Il monte scarti è vuoto.");
        hand.push(...next.discardPile);
        next.discardPile = [];
      } else {
        if (next.deck.length === 0) invalid("Il tallone è terminato.");
        hand.push(...draw(next.deck));
      }
      next.phase = "meld";
      return next;
    }

    if (action.type === "meld" || action.type === "add-to-meld") {
      if (next.phase !== "meld") invalid("Prima devi pescare.");
      if (!Array.isArray(action.cardIds)) invalid("Seleziona le carte da calare.");
      const removed = removeCards(hand, action.cardIds);
      if (action.type === "meld") {
        const validation = validateMeld(removed.cards);
        if (!validation) invalid("La combinazione non è un gruppo o una scala valida.");
        next.melds[team].push({ ...validation, cards: removed.cards });
      } else {
        const meldIndex = Number(action.meldIndex);
        const meld = next.melds[team][meldIndex];
        if (!meld) invalid("Combinazione non trovata.");
        const combined = [...meld.cards, ...removed.cards];
        const validation = validateMeld(combined);
        if (!validation || validation.type !== meld.type) invalid("Le carte non possono essere aggiunte a questa combinazione.");
        meld.cards = combined;
        meld.clean = validation.clean;
      }
      next.hands[playerId] = removed.remaining;
      if (next.hands[playerId].length === 0) {
        if (!next.tookPot[team] && next.pots.length > 0) {
          next.hands[playerId] = next.pots.shift();
          next.tookPot[team] = true;
        } else if (next.tookPot[team] && hasBurraco(next, team)) {
          finish(next, team);
        }
      }
      return next;
    }

    if (action.type === "discard") {
      if (next.phase !== "meld" || typeof action.cardId !== "string") invalid("Scarto non valido.");
      const index = hand.findIndex((card) => card.id === action.cardId);
      if (index < 0) invalid("Carta non presente nella tua mano.");
      const [card] = hand.splice(index, 1);
      next.discardPile.push(card);

      if (hand.length === 0) {
        if (!next.tookPot[team] && next.pots.length > 0) {
          next.hands[playerId] = next.pots.shift();
          next.tookPot[team] = true;
        } else if (next.tookPot[team] && hasBurraco(next, team)) {
          finish(next, team);
          return next;
        }
      }
      next.currentPlayerId = nextPlayerId(next.order, playerId);
      next.phase = "draw";
      if (next.deck.length === 0 && next.discardPile.length === 0) finish(next, null);
      return next;
    }

    invalid("Azione Burraco non riconosciuta.");
  }

  static view(state, playerId) {
    const yourTeam = teamFor(state.order, playerId);
    return {
      kind: state.kind,
      phase: state.phase,
      order: state.order,
      currentPlayerId: state.currentPlayerId,
      deckCount: state.deck.length,
      potCount: state.pots.length,
      discardTop: state.discardPile.at(-1) ?? null,
      discardCount: state.discardPile.length,
      hands: Object.fromEntries(state.order.map((id) => [id, id === playerId ? state.hands[id] : { count: state.hands[id].length }])),
      melds: state.melds,
      tookPot: state.tookPot,
      yourTeam,
      winnerTeam: state.winnerTeam,
      scores: state.scores
    };
  }

  static isFinished(state) {
    return state.phase === "finished";
  }
}
