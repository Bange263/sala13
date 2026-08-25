import { cloneState, invalid, requirePlayers, requireTurn } from "./game-utils.js";
import { draw, shuffledFrenchDeck } from "./standard-cards.js";

function handValue(cards) {
  let value = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") {
      value += 11;
      aces += 1;
    } else if (["K", "Q", "J"].includes(card.rank)) {
      value += 10;
    } else {
      value += Number(card.rank);
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }
  return { value, soft: aces > 0 };
}

function makeHand(cards, bet, naturalEligible = true) {
  const score = handValue(cards);
  const natural = naturalEligible && cards.length === 2 && score.value === 21;
  return {
    cards,
    bet,
    natural,
    status: natural ? "blackjack" : score.value === 21 ? "stand" : "playing",
    result: null,
    payout: 0
  };
}

function activeHand(record) {
  return record.hands[record.activeHandIndex] ?? null;
}

function nextPlayablePlayer(state) {
  const start = state.order.indexOf(state.currentPlayerId);
  for (let offset = 0; offset < state.order.length; offset += 1) {
    const playerId = state.order[(start + offset) % state.order.length];
    const record = state.playerStates[playerId];
    const nextHand = record.hands.findIndex((hand, index) => index >= record.activeHandIndex && hand.status === "playing");
    if (nextHand >= 0) {
      record.activeHandIndex = nextHand;
      state.currentPlayerId = playerId;
      return true;
    }
  }
  return false;
}

function settle(state) {
  state.phase = "dealer";
  let dealerScore = handValue(state.dealer.cards);
  while (dealerScore.value < 17 || (dealerScore.value === 17 && dealerScore.soft && state.settings.dealerHitsSoft17)) {
    state.dealer.cards.push(...draw(state.deck));
    dealerScore = handValue(state.dealer.cards);
  }
  state.dealer.value = dealerScore.value;
  state.dealer.bust = dealerScore.value > 21;
  const dealerBlackjack = state.dealer.cards.length === 2 && dealerScore.value === 21;

  for (const playerId of state.order) {
    const record = state.playerStates[playerId];
    for (const hand of record.hands) {
      const score = handValue(hand.cards).value;
      if (score > 21 || hand.status === "bust") {
        hand.result = "lose";
      } else if (hand.natural) {
        if (dealerBlackjack) {
          hand.result = "push";
          hand.payout = hand.bet;
        } else {
          hand.result = "blackjack";
          hand.payout = Math.floor(hand.bet * 2.5);
        }
      } else if (score > dealerScore.value || dealerScore.value > 21) {
        hand.result = "win";
        hand.payout = hand.bet * 2;
      } else if (score === dealerScore.value) {
        hand.result = "push";
        hand.payout = hand.bet;
      } else {
        hand.result = "lose";
      }
      record.chips += hand.payout;
      hand.value = score;
      hand.status = "done";
    }
  }
  state.currentPlayerId = null;
  state.phase = "finished";
}

function advance(state) {
  const current = state.playerStates[state.currentPlayerId];
  if (current) current.activeHandIndex += 1;
  if (!nextPlayablePlayer(state)) settle(state);
}

export class BlackjackEngine {
  static implemented = true;

  static start({ players, settings }) {
    requirePlayers(players, { min: 2, max: 12 });
    const deck = shuffledFrenchDeck({ decks: 6, prefix: `bj-${Date.now()}` });
    const baseBet = Math.max(10, Math.min(500, Number(settings.baseBet) || 100));
    const startingChips = Math.max(baseBet * 2, Math.min(1_000_000, Number(settings.startingChips) || 1_000));
    const requestedMaxBet = Math.max(10, Math.min(9_999, Number(settings.maxBet) || 9_999));
    const maxBet = requestedMaxBet === 9_999 ? 9_999 : Math.max(baseBet, requestedMaxBet);
    const playerStates = Object.fromEntries(players.map((player) => [player.id, {
      chips: startingChips,
      hands: [],
      activeHandIndex: 0
    }]));
    const dealer = { cards: [] };

    return {
      kind: "blackjack",
      phase: "betting",
      order: players.map((player) => player.id),
      currentPlayerId: null,
      deck,
      dealer,
      playerStates,
      settings: { baseBet, maxBet, startingChips, dealerHitsSoft17: Boolean(settings.dealerHitsSoft17) }
    };
  }

  static applyAction({ action, playerId, state }) {
    if (state.phase === "betting") {
      if (action.type !== "bet") invalid("Prima devi scegliere la puntata.");
      const next = cloneState(state);
      const record = next.playerStates[playerId];
      if (record.hands.length > 0) invalid("Hai già confermato la puntata.");
      const bet = Number(action.amount);
      const effectiveMaximum = next.settings.maxBet === 9_999 ? record.chips : Math.min(record.chips, next.settings.maxBet);
      if (!Number.isInteger(bet) || bet < 10 || bet > effectiveMaximum) {
        invalid(`Puntata non valida: il massimo del tavolo è ${next.settings.maxBet === 9_999 ? "il tuo saldo" : `${next.settings.maxBet} chip`}.`);
      }
      record.chips -= bet;
      record.hands = [makeHand([], bet)];
      if (next.order.every((id) => next.playerStates[id].hands.length === 1)) {
        for (let round = 0; round < 2; round += 1) {
          for (const id of next.order) next.playerStates[id].hands[0].cards.push(...draw(next.deck));
          next.dealer.cards.push(...draw(next.deck));
        }
        for (const id of next.order) {
          const hand = next.playerStates[id].hands[0];
          const score = handValue(hand.cards);
          hand.natural = score.value === 21;
          hand.status = hand.natural ? "blackjack" : "playing";
        }
        next.phase = "players";
        next.currentPlayerId = next.order[0];
        if (handValue(next.dealer.cards).value === 21 || !nextPlayablePlayer(next)) settle(next);
      }
      return next;
    }
    if (state.phase !== "players") invalid("La mano è già terminata.");
    requireTurn(state, playerId);
    const next = cloneState(state);
    const record = next.playerStates[playerId];
    const hand = activeHand(record);
    if (!hand || hand.status !== "playing") invalid("Questa mano non può ricevere azioni.");

    if (action.type === "hit") {
      hand.cards.push(...draw(next.deck));
      const score = handValue(hand.cards).value;
      if (score >= 21) {
        hand.status = score > 21 ? "bust" : "stand";
        advance(next);
      }
      return next;
    }

    if (action.type === "stand") {
      hand.status = "stand";
      advance(next);
      return next;
    }

    if (action.type === "double") {
      if (hand.cards.length !== 2 || record.chips < hand.bet) invalid("Non puoi raddoppiare questa mano.");
      record.chips -= hand.bet;
      hand.bet *= 2;
      hand.cards.push(...draw(next.deck));
      hand.status = handValue(hand.cards).value > 21 ? "bust" : "stand";
      advance(next);
      return next;
    }

    if (action.type === "split") {
      if (hand.cards.length !== 2 || hand.cards[0].rank !== hand.cards[1].rank || record.chips < hand.bet) {
        invalid("Lo split richiede due carte dello stesso valore e chip sufficienti.");
      }
      record.chips -= hand.bet;
      const [first, second] = hand.cards;
      const firstHand = makeHand([first, ...draw(next.deck)], hand.bet, false);
      const secondHand = makeHand([second, ...draw(next.deck)], hand.bet, false);
      record.hands.splice(record.activeHandIndex, 1, firstHand, secondHand);
      if (firstHand.status !== "playing") advance(next);
      return next;
    }

    invalid("Azione Blackjack non riconosciuta.");
  }

  static view(state, playerId) {
    const hideHole = state.phase === "players";
    return {
      kind: state.kind,
      phase: state.phase,
      currentPlayerId: state.currentPlayerId,
      dealer: {
        cards: hideHole ? [state.dealer.cards[0], { hidden: true }] : state.dealer.cards,
        value: hideHole ? null : handValue(state.dealer.cards).value,
        bust: state.dealer.bust ?? false
      },
      deckCount: state.deck.length,
      players: Object.fromEntries(state.order.map((id) => [id, {
        chips: state.playerStates[id].chips,
        activeHandIndex: state.playerStates[id].activeHandIndex,
        hands: state.playerStates[id].hands.map((hand) => ({
          ...hand,
          value: handValue(hand.cards).value
        }))
      }])),
      yourPlayerId: playerId,
      settings: state.settings
    };
  }

  static isFinished(state) {
    return state.phase === "finished";
  }

  static botPlayerToAct({ players, state }) {
    if (state.phase !== "betting") return null;
    return state.order.find((id) => players.find((player) => player.id === id)?.isBot && state.playerStates[id].hands.length === 0) ?? null;
  }

  static botAction({ playerId, state }) {
    const record = state.playerStates[playerId];
    if (state.phase === "betting") {
      const maximum = state.settings.maxBet === 9_999 ? record.chips : Math.min(record.chips, state.settings.maxBet);
      return { type: "bet", amount: Math.min(maximum, state.settings.baseBet) };
    }
    if (state.phase !== "players" || state.currentPlayerId !== playerId) return null;
    const hand = activeHand(record);
    if (!hand) return null;
    return { type: handValue(hand.cards).value < 17 ? "hit" : "stand" };
  }
}
