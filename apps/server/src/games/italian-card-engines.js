import { cloneState, invalid, nextPlayerId, requirePlayers, requireTurn } from "./game-utils.js";
import { draw, ITALIAN_SUITS, shuffledItalianDeck } from "./standard-cards.js";

function teamFor(order, playerId) {
  if (order.length === 4) return order.indexOf(playerId) % 2 === 0 ? "team-1" : "team-2";
  return playerId;
}

function teamMembers(order) {
  const teams = {};
  for (const id of order) {
    const team = teamFor(order, id);
    (teams[team] ??= []).push(id);
  }
  return teams;
}

function dealScopa(state) {
  const cardsEach = Math.min(3, Math.floor(state.deck.length / state.order.length));
  for (let round = 0; round < cardsEach; round += 1) {
    for (const id of state.order) state.hands[id].push(...draw(state.deck));
  }
}

function hasSumCapture(cards, target) {
  const reachable = new Set([0]);
  for (const card of cards) {
    for (const sum of [...reachable]) {
      const next = sum + card.rank;
      if (next === target) return true;
      if (next < target) reachable.add(next);
    }
  }
  return false;
}

function primieraValue(rank) {
  return ({ 7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12 }[rank] ?? 10);
}

function scoreScopa(state) {
  if (state.table.length > 0 && state.lastCaptureTeam) {
    state.captured[state.lastCaptureTeam].push(...state.table);
    state.table = [];
  }
  const teams = Object.keys(state.teams);
  const result = Object.fromEntries(teams.map((team) => [team, {
    carte: state.captured[team].length,
    denari: state.captured[team].filter((card) => card.suit === "denari").length,
    settebello: state.captured[team].some((card) => card.suit === "denari" && card.rank === 7),
    primiera: 0,
    scope: state.scope[team],
    points: state.scope[team]
  }]));
  for (const team of teams) {
    let total = 0;
    let complete = true;
    for (const suit of ITALIAN_SUITS) {
      const cards = state.captured[team].filter((card) => card.suit === suit);
      if (cards.length === 0) {
        complete = false;
        break;
      }
      total += Math.max(...cards.map((card) => primieraValue(card.rank)));
    }
    result[team].primiera = complete ? total : 0;
    if (result[team].settebello) result[team].points += 1;
  }
  const awardMajority = (field) => {
    const sorted = [...teams].sort((a, b) => result[b][field] - result[a][field]);
    if (result[sorted[0]][field] > result[sorted[1]][field]) result[sorted[0]].points += 1;
  };
  awardMajority("carte");
  awardMajority("denari");
  awardMajority("primiera");
  state.scores = result;
  const best = Math.max(...teams.map((team) => result[team].points));
  state.winnerTeams = teams.filter((team) => result[team].points === best);
  state.phase = "finished";
  state.currentPlayerId = null;
}

export class ScopaEngine {
  static implemented = true;

  static start({ players }) {
    requirePlayers(players, { allowed: [2, 4] });
    const order = players.map((player) => player.id);
    const teams = teamMembers(order);
    const deck = shuffledItalianDeck(`scopa-${Date.now()}`);
    const state = {
      kind: "scopa",
      phase: "playing",
      order,
      teams,
      deck,
      table: draw(deck, 4),
      hands: Object.fromEntries(order.map((id) => [id, []])),
      captured: Object.fromEntries(Object.keys(teams).map((team) => [team, []])),
      scope: Object.fromEntries(Object.keys(teams).map((team) => [team, 0])),
      currentPlayerId: order[0],
      lastCaptureTeam: null,
      scores: null,
      winnerTeams: []
    };
    dealScopa(state);
    return state;
  }

  static applyAction({ action, playerId, state }) {
    if (state.phase !== "playing") invalid("La mano di Scopa è terminata.");
    requireTurn(state, playerId);
    if (action.type !== "play" || typeof action.cardId !== "string") invalid("Azione Scopa non riconosciuta.");
    const next = cloneState(state);
    const hand = next.hands[playerId];
    const cardIndex = hand.findIndex((card) => card.id === action.cardId);
    if (cardIndex < 0) invalid("Carta non presente nella tua mano.");
    const [card] = hand.splice(cardIndex, 1);
    const captureIds = Array.isArray(action.captureIds) ? [...new Set(action.captureIds)] : [];
    const selected = captureIds.map((id) => next.table.find((tableCard) => tableCard.id === id));
    if (selected.some((selectedCard) => !selectedCard)) invalid("La presa contiene carte non disponibili.");

    const exactMatches = next.table.filter((tableCard) => tableCard.rank === card.rank);
    if (exactMatches.length > 0) {
      if (selected.length !== 1 || selected[0].rank !== card.rank) {
        invalid("Quando esiste una carta dello stesso valore, quella presa è obbligatoria.");
      }
    } else {
      if (selected.length > 0 && selected.reduce((sum, tableCard) => sum + tableCard.rank, 0) !== card.rank) {
        invalid("La somma delle carte selezionate non corrisponde alla carta giocata.");
      }
      if (selected.length === 0 && hasSumCapture(next.table, card.rank)) {
        invalid("Esiste una presa valida: devi raccogliere una combinazione dal tavolo.");
      }
    }

    if (selected.length > 0) {
      const selectedIds = new Set(captureIds);
      next.table = next.table.filter((tableCard) => !selectedIds.has(tableCard.id));
      const team = teamFor(next.order, playerId);
      next.captured[team].push(card, ...selected);
      next.lastCaptureTeam = team;
      const cardsRemaining = next.deck.length + Object.values(next.hands).reduce((sum, cards) => sum + cards.length, 0);
      if (next.table.length === 0 && cardsRemaining > 0) next.scope[team] += 1;
    } else {
      next.table.push(card);
    }

    next.currentPlayerId = nextPlayerId(next.order, playerId);
    if (Object.values(next.hands).every((cards) => cards.length === 0)) {
      if (next.deck.length > 0) dealScopa(next);
      else scoreScopa(next);
    }
    return next;
  }

  static view(state, playerId) {
    return {
      kind: state.kind,
      phase: state.phase,
      order: state.order,
      teams: state.teams,
      currentPlayerId: state.currentPlayerId,
      table: state.table,
      deckCount: state.deck.length,
      hands: Object.fromEntries(state.order.map((id) => [id, id === playerId ? state.hands[id] : { count: state.hands[id].length }])),
      capturedCounts: Object.fromEntries(Object.keys(state.teams).map((team) => [team, state.captured[team].length])),
      scope: state.scope,
      scores: state.scores,
      winnerTeams: state.winnerTeams,
      yourTeam: teamFor(state.order, playerId)
    };
  }

  static isFinished(state) {
    return state.phase === "finished";
  }
}

const BRISCOLA_STRENGTH = Object.freeze({ 1: 10, 3: 9, 10: 8, 9: 7, 8: 6, 7: 5, 6: 4, 5: 3, 4: 2, 2: 1 });
const BRISCOLA_POINTS = Object.freeze({ 1: 11, 3: 10, 10: 4, 9: 3, 8: 2 });

function briscolaWinner(trick, trumpSuit) {
  const leadSuit = trick[0].card.suit;
  return trick.reduce((best, play) => {
    const bestTrump = best.card.suit === trumpSuit;
    const playTrump = play.card.suit === trumpSuit;
    if (playTrump !== bestTrump) return playTrump ? play : best;
    if (!playTrump && play.card.suit !== leadSuit) return best;
    if (!bestTrump && best.card.suit !== leadSuit) return play;
    return BRISCOLA_STRENGTH[play.card.rank] > BRISCOLA_STRENGTH[best.card.rank] ? play : best;
  });
}

function finishBriscola(state) {
  state.phase = "finished";
  state.currentPlayerId = null;
  const teams = Object.keys(state.teams);
  const best = Math.max(...teams.map((team) => state.points[team]));
  state.winnerTeams = teams.filter((team) => state.points[team] === best);
}

export class BriscolaEngine {
  static implemented = true;

  static start({ players }) {
    requirePlayers(players, { allowed: [2, 4] });
    const order = players.map((player) => player.id);
    const deck = shuffledItalianDeck(`briscola-${Date.now()}`);
    const hands = Object.fromEntries(order.map((id) => [id, []]));
    for (let round = 0; round < 3; round += 1) {
      for (const id of order) hands[id].push(...draw(deck));
    }
    const teams = teamMembers(order);
    return {
      kind: "briscola",
      phase: "playing",
      order,
      teams,
      hands,
      deck,
      briscolaCard: deck.at(-1),
      trumpSuit: deck.at(-1).suit,
      currentPlayerId: order[0],
      trickLeaderId: order[0],
      trick: [],
      points: Object.fromEntries(Object.keys(teams).map((team) => [team, 0])),
      tricksWon: Object.fromEntries(Object.keys(teams).map((team) => [team, 0])),
      winnerTeams: []
    };
  }

  static applyAction({ action, playerId, state }) {
    if (state.phase !== "playing") invalid("La partita di Briscola è terminata.");
    requireTurn(state, playerId);
    if (action.type !== "play" || typeof action.cardId !== "string") invalid("Azione Briscola non riconosciuta.");
    const next = cloneState(state);
    const hand = next.hands[playerId];
    const index = hand.findIndex((card) => card.id === action.cardId);
    if (index < 0) invalid("Carta non presente nella tua mano.");
    const [card] = hand.splice(index, 1);
    next.trick.push({ playerId, card });

    if (next.trick.length < next.order.length) {
      next.currentPlayerId = nextPlayerId(next.order, playerId);
      return next;
    }

    const winningPlay = briscolaWinner(next.trick, next.trumpSuit);
    const team = teamFor(next.order, winningPlay.playerId);
    next.points[team] += next.trick.reduce((sum, play) => sum + (BRISCOLA_POINTS[play.card.rank] ?? 0), 0);
    next.tricksWon[team] += 1;
    next.trick = [];
    next.trickLeaderId = winningPlay.playerId;
    next.currentPlayerId = winningPlay.playerId;

    if (next.deck.length > 0) {
      let drawingPlayer = winningPlay.playerId;
      for (let count = 0; count < next.order.length && next.deck.length > 0; count += 1) {
        next.hands[drawingPlayer].push(...draw(next.deck));
        drawingPlayer = nextPlayerId(next.order, drawingPlayer);
      }
    }
    if (Object.values(next.hands).every((cards) => cards.length === 0)) finishBriscola(next);
    return next;
  }

  static view(state, playerId) {
    return {
      kind: state.kind,
      phase: state.phase,
      order: state.order,
      teams: state.teams,
      currentPlayerId: state.currentPlayerId,
      trickLeaderId: state.trickLeaderId,
      trick: state.trick,
      briscolaCard: state.briscolaCard,
      trumpSuit: state.trumpSuit,
      deckCount: state.deck.length,
      hands: Object.fromEntries(state.order.map((id) => [id, id === playerId ? state.hands[id] : { count: state.hands[id].length }])),
      points: state.points,
      tricksWon: state.tricksWon,
      winnerTeams: state.winnerTeams,
      yourTeam: teamFor(state.order, playerId)
    };
  }

  static isFinished(state) {
    return state.phase === "finished";
  }
}
