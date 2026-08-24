import { cloneState, invalid, requirePlayers, requireTurn } from "./game-utils.js";
import { cardRankValue, draw, shuffledFrenchDeck } from "./standard-cards.js";

const PHASES = Object.freeze(["preflop", "flop", "turn", "river"]);
const HAND_NAMES = Object.freeze([
  "Carta alta", "Coppia", "Doppia coppia", "Tris", "Scala", "Colore", "Full", "Poker", "Scala colore"
]);

function combinations(cards, choose, start = 0, selected = [], output = []) {
  if (selected.length === choose) {
    output.push([...selected]);
    return output;
  }
  for (let index = start; index <= cards.length - (choose - selected.length); index += 1) {
    selected.push(cards[index]);
    combinations(cards, choose, index + 1, selected, output);
    selected.pop();
  }
  return output;
}

function straightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  for (let index = 0; index <= unique.length - 5; index += 1) {
    if (unique[index] - unique[index + 4] === 4) return unique[index];
  }
  return 0;
}

function evaluateFive(cards) {
  const values = cards.map((card) => cardRankValue(card.rank)).sort((a, b) => b - a);
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const straight = straightHigh(values);
  if (flush && straight) return [8, straight];
  if (groups[0][1] === 4) return [7, groups[0][0], groups.find((group) => group[1] === 1)[0]];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...values];
  if (straight) return [4, straight];
  if (groups[0][1] === 3) return [3, groups[0][0], ...groups.filter((group) => group[1] === 1).map(([value]) => value)];
  const pairs = groups.filter((group) => group[1] === 2).map(([value]) => value).sort((a, b) => b - a);
  if (pairs.length >= 2) {
    const kicker = groups.find((group) => group[1] === 1)?.[0] ?? 0;
    return [2, pairs[0], pairs[1], kicker];
  }
  if (pairs.length === 1) return [1, pairs[0], ...groups.filter((group) => group[1] === 1).map(([value]) => value)];
  return [0, ...values];
}

function compareRank(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function evaluatePokerHand(cards) {
  if (cards.length < 5) throw new Error("Servono almeno cinque carte.");
  let best = null;
  for (const candidate of combinations(cards, 5)) {
    const rank = evaluateFive(candidate);
    if (!best || compareRank(rank, best.rank) > 0) best = { rank, cards: candidate };
  }
  return { ...best, name: HAND_NAMES[best.rank[0]] };
}

function seatAfter(state, playerId, predicate = () => true) {
  let index = state.order.indexOf(playerId);
  for (let attempts = 0; attempts < state.order.length; attempts += 1) {
    index = (index + 1) % state.order.length;
    const id = state.order[index];
    if (predicate(state.playerStates[id])) return id;
  }
  return null;
}

function contenders(state) {
  return state.order.filter((id) => !state.playerStates[id].folded);
}

function actionable(state) {
  return state.order.filter((id) => {
    const player = state.playerStates[id];
    return !player.folded && !player.allIn;
  });
}

function pay(state, playerId, amount) {
  const player = state.playerStates[playerId];
  const paid = Math.max(0, Math.min(player.chips, amount));
  player.chips -= paid;
  player.streetBet += paid;
  player.totalBet += paid;
  if (player.chips === 0) player.allIn = true;
  return paid;
}

function awardUncontested(state, winnerId) {
  const pot = state.order.reduce((sum, id) => sum + state.playerStates[id].totalBet, 0);
  state.playerStates[winnerId].chips += pot;
  state.pots = [{ amount: pot, winnerIds: [winnerId] }];
  state.winnerIds = [winnerId];
  state.phase = "finished";
  state.currentPlayerId = null;
}

function showdown(state) {
  state.phase = "showdown";
  const eligibleIds = contenders(state);
  const evaluations = Object.fromEntries(eligibleIds.map((id) => [id, evaluatePokerHand([
    ...state.playerStates[id].hole,
    ...state.community
  ])]));
  const levels = [...new Set(state.order.map((id) => state.playerStates[id].totalBet).filter((value) => value > 0))].sort((a, b) => a - b);
  let previous = 0;
  const pots = [];
  const winnerSet = new Set();
  for (const level of levels) {
    const contributors = state.order.filter((id) => state.playerStates[id].totalBet >= level);
    const amount = (level - previous) * contributors.length;
    previous = level;
    const eligible = contributors.filter((id) => !state.playerStates[id].folded);
    if (amount <= 0 || eligible.length === 0) continue;
    let best = evaluations[eligible[0]].rank;
    let winners = [eligible[0]];
    for (const id of eligible.slice(1)) {
      const comparison = compareRank(evaluations[id].rank, best);
      if (comparison > 0) {
        best = evaluations[id].rank;
        winners = [id];
      } else if (comparison === 0) {
        winners.push(id);
      }
    }
    const share = Math.floor(amount / winners.length);
    let remainder = amount - share * winners.length;
    for (const id of winners) {
      state.playerStates[id].chips += share + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
      winnerSet.add(id);
    }
    pots.push({ amount, winnerIds: winners });
  }
  state.evaluations = Object.fromEntries(Object.entries(evaluations).map(([id, value]) => [id, {
    name: value.name,
    rank: value.rank,
    cards: value.cards
  }]));
  state.pots = pots;
  state.winnerIds = [...winnerSet];
  state.phase = "finished";
  state.currentPlayerId = null;
}

function dealStreet(state) {
  const currentIndex = PHASES.indexOf(state.phase);
  if (currentIndex < 0 || currentIndex === PHASES.length - 1) {
    showdown(state);
    return;
  }
  state.deck.shift();
  if (state.phase === "preflop") state.community.push(...draw(state.deck, 3));
  else state.community.push(...draw(state.deck, 1));
  state.phase = PHASES[currentIndex + 1];
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.acted = [];
  for (const id of state.order) state.playerStates[id].streetBet = 0;
  state.currentPlayerId = seatAfter(state, state.order[state.dealerIndex], (player) => !player.folded && !player.allIn);
}

function roundComplete(state) {
  const active = actionable(state);
  return active.every((id) => state.acted.includes(id) && state.playerStates[id].streetBet === state.currentBet);
}

function progress(state, lastActorId) {
  if (contenders(state).length === 1) {
    awardUncontested(state, contenders(state)[0]);
    return;
  }
  if (roundComplete(state)) {
    do {
      dealStreet(state);
    } while (state.phase !== "finished" && actionable(state).length <= 1);
    return;
  }
  state.currentPlayerId = seatAfter(state, lastActorId, (player) => !player.folded && !player.allIn);
}

export class PokerEngine {
  static implemented = true;

  static start({ players, settings }) {
    requirePlayers(players, { min: 2, max: 12 });
    const order = players.map((player) => player.id);
    const startingChips = Math.max(200, Math.min(1_000_000, Number(settings.startingChips) || 2_000));
    const bigBlind = Math.max(10, Math.min(Math.floor(startingChips / 4), Number(settings.bigBlind) || 20));
    const smallBlind = Math.max(1, Math.floor(bigBlind / 2));
    const deck = shuffledFrenchDeck({ prefix: `poker-${Date.now()}` });
    const playerStates = Object.fromEntries(order.map((id) => [id, {
      chips: startingChips,
      hole: [],
      folded: false,
      allIn: false,
      streetBet: 0,
      totalBet: 0
    }]));
    for (let round = 0; round < 2; round += 1) {
      for (const id of order) playerStates[id].hole.push(...draw(deck));
    }
    const state = {
      kind: "poker",
      phase: "preflop",
      order,
      dealerIndex: 0,
      smallBlind,
      bigBlind,
      deck,
      community: [],
      playerStates,
      currentBet: 0,
      minRaise: bigBlind,
      acted: [],
      currentPlayerId: null,
      winnerIds: [],
      pots: [],
      evaluations: null
    };
    const smallBlindId = order[order.length === 2 ? 0 : 1];
    const bigBlindId = order[order.length === 2 ? 1 : 2 % order.length];
    pay(state, smallBlindId, smallBlind);
    pay(state, bigBlindId, bigBlind);
    state.currentBet = state.playerStates[bigBlindId].streetBet;
    state.currentPlayerId = order.length === 2
      ? smallBlindId
      : seatAfter(state, bigBlindId, (player) => !player.folded && !player.allIn);
    return state;
  }

  static applyAction({ action, playerId, state }) {
    if (!PHASES.includes(state.phase)) invalid("La mano di poker è terminata.");
    requireTurn(state, playerId);
    const next = cloneState(state);
    const player = next.playerStates[playerId];
    const callAmount = Math.max(0, next.currentBet - player.streetBet);

    if (action.type === "fold") {
      player.folded = true;
      next.acted.push(playerId);
    } else if (action.type === "check") {
      if (callAmount !== 0) invalid("Non puoi fare check: devi vedere, rilanciare o passare.");
      next.acted.push(playerId);
    } else if (action.type === "call") {
      if (callAmount === 0) invalid("Non c'è una puntata da vedere.");
      pay(next, playerId, callAmount);
      next.acted.push(playerId);
    } else if (action.type === "raise") {
      const target = Number(action.amount);
      if (!Number.isInteger(target) || target <= next.currentBet) invalid("Importo del rilancio non valido.");
      const maximum = player.streetBet + player.chips;
      const actualTarget = Math.min(target, maximum);
      const raiseBy = actualTarget - next.currentBet;
      if (actualTarget < maximum && raiseBy < next.minRaise) invalid(`Rilancio minimo: ${next.currentBet + next.minRaise}.`);
      pay(next, playerId, actualTarget - player.streetBet);
      if (player.streetBet > next.currentBet) {
        next.minRaise = Math.max(next.minRaise, player.streetBet - next.currentBet);
        next.currentBet = player.streetBet;
        next.acted = [playerId];
      } else {
        next.acted.push(playerId);
      }
    } else if (action.type === "all-in") {
      const oldBet = next.currentBet;
      pay(next, playerId, player.chips);
      if (player.streetBet > oldBet) {
        next.minRaise = Math.max(next.minRaise, player.streetBet - oldBet);
        next.currentBet = player.streetBet;
        next.acted = [playerId];
      } else {
        next.acted.push(playerId);
      }
    } else {
      invalid("Azione Poker non riconosciuta.");
    }

    next.acted = [...new Set(next.acted)];
    progress(next, playerId);
    return next;
  }

  static view(state, playerId) {
    const reveal = state.phase === "finished";
    return {
      kind: state.kind,
      phase: state.phase,
      order: state.order,
      dealerId: state.order[state.dealerIndex],
      currentPlayerId: state.currentPlayerId,
      community: state.community,
      pot: state.order.reduce((sum, id) => sum + state.playerStates[id].totalBet, 0),
      currentBet: state.currentBet,
      minRaise: state.minRaise,
      smallBlind: state.smallBlind,
      bigBlind: state.bigBlind,
      players: Object.fromEntries(state.order.map((id) => {
        const record = state.playerStates[id];
        return [id, {
          chips: record.chips,
          folded: record.folded,
          allIn: record.allIn,
          streetBet: record.streetBet,
          totalBet: record.totalBet,
          hole: id === playerId || (reveal && !record.folded) ? record.hole : { count: record.hole.length }
        }];
      })),
      winnerIds: state.winnerIds,
      pots: state.pots,
      evaluations: reveal ? state.evaluations : null
    };
  }

  static isFinished(state) {
    return state.phase === "finished";
  }
}
