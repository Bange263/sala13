import { randomInt } from "node:crypto";

/**
 * Unbiased Fisher-Yates shuffle using cryptographic randomness. The input is
 * never mutated, which makes round replays and tests easier to reason about.
 */
export function secureShuffle(cards, randomInteger = randomInt) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = randomInteger(0, index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function dealRoundRobin(deck, playerIds, cardsPerPlayer) {
  const remaining = [...deck];
  const hands = Object.fromEntries(playerIds.map((playerId) => [playerId, []]));
  for (let round = 0; round < cardsPerPlayer; round += 1) {
    for (const playerId of playerIds) {
      const card = remaining.shift();
      if (!card) throw new Error("Not enough cards to complete the deal");
      hands[playerId].push(card);
    }
  }
  return { hands, deck: remaining };
}

/**
 * A reusable hidden-information projection. Only the requesting player gets
 * card identities; opponents expose counts.
 */
export function projectHands(hands, requestingPlayerId) {
  return Object.fromEntries(
    Object.entries(hands).map(([playerId, cards]) => [
      playerId,
      playerId === requestingPlayerId ? cards : { count: cards.length }
    ])
  );
}
