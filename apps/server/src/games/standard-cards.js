import { secureShuffle } from "./card-utils.js";

export const FRENCH_SUITS = Object.freeze(["hearts", "diamonds", "clubs", "spades"]);
export const FRENCH_RANKS = Object.freeze(["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]);
export const ITALIAN_SUITS = Object.freeze(["denari", "coppe", "spade", "bastoni"]);

export function frenchDeck({ decks = 1, jokersPerDeck = 0, prefix = "c" } = {}) {
  const cards = [];
  for (let deckIndex = 0; deckIndex < decks; deckIndex += 1) {
    for (const suit of FRENCH_SUITS) {
      for (const rank of FRENCH_RANKS) {
        cards.push({ id: `${prefix}-${deckIndex}-${suit}-${rank}`, suit, rank });
      }
    }
    for (let joker = 0; joker < jokersPerDeck; joker += 1) {
      cards.push({ id: `${prefix}-${deckIndex}-joker-${joker}`, suit: "joker", rank: "JOKER", joker: true });
    }
  }
  return cards;
}

export function shuffledFrenchDeck(options) {
  return secureShuffle(frenchDeck(options));
}

export function italianDeck(prefix = "it") {
  return ITALIAN_SUITS.flatMap((suit) =>
    Array.from({ length: 10 }, (_, index) => ({
      id: `${prefix}-${suit}-${index + 1}`,
      suit,
      rank: index + 1
    }))
  );
}

export function shuffledItalianDeck(prefix) {
  return secureShuffle(italianDeck(prefix));
}

export function draw(deck, count = 1) {
  if (deck.length < count) throw new Error("Il mazzo non contiene abbastanza carte.");
  return deck.splice(0, count);
}

export function cardRankValue(rank) {
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  return Number(rank);
}
