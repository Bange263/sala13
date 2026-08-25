import { randomInt } from "node:crypto";
import { DEFAULT_CATEGORIES, ERROR_CODES } from "@sala13/shared";
import { cloneState, invalid, nextPlayerId, normalizeText, requirePlayers, requireTurn } from "./game-utils.js";
import { PublicError } from "../utils/public-error.js";

const LETTERS = "ABCDEFGHILMNOPQRSTUVZ";
const HANGMAN_WORDS = Object.freeze([
  "aeroplano", "albero", "amicizia", "animale", "astronauta", "automobile", "bambino", "bastardo",
  "biblioteca", "bicicletta", "biscotto", "cane", "canzone", "castello", "cavallo", "cazzo",
  "cervello", "chiave", "cioccolato", "coccodrillo", "coglione", "computer", "coniglio", "costellazione",
  "dinosauro", "drago", "elefante", "elettricita", "finestra", "fiore", "forchetta", "fotografia",
  "fragola", "gatto", "gelateria", "giardino", "giornale", "inferno", "informatica", "labirinto",
  "lampada", "libro", "maiale", "merda", "montagna", "motorino", "nuvola", "oceano",
  "orchestra", "pallone", "panino", "paperino", "pianoforte", "pirata", "pizza", "porco",
  "puttana", "quadrifoglio", "ragazza", "robot", "scimmia", "scuola", "semaforo", "serpente",
  "sole", "stronzo", "tavolo", "temporale", "telefono", "tigre", "trattore", "uccello",
  "valigia", "vulcano", "zaino", "zebra"
]);
const HANGMAN_DICTIONARY = new Set(HANGMAN_WORDS.map(normalizeText));

function randomLetter(previous = null) {
  const choices = [...LETTERS].filter((letter) => letter !== previous);
  return choices[randomInt(0, choices.length)];
}

function openReview(state) {
  state.phase = "review";
  state.currentPlayerId = null;
  state.votes = {};
}

function scoreCategories(state) {
  const roundScores = Object.fromEntries(state.order.map((id) => [id, 0]));
  const validity = {};
  for (const category of state.categories) {
    const validAnswers = [];
    for (const id of state.order) {
      const answer = state.answers[id]?.[category] ?? "";
      const normalized = normalizeText(answer);
      const votes = Object.values(state.votes[id]?.[category] ?? {});
      const acceptedByVote = votes.filter(Boolean).length >= votes.filter((value) => !value).length;
      const valid = normalized.startsWith(normalizeText(state.letter)) && acceptedByVote;
      validity[`${id}:${category}`] = valid;
      if (valid) validAnswers.push({ id, normalized });
    }
    for (const answer of validAnswers) {
      const duplicates = validAnswers.filter((candidate) => candidate.normalized === answer.normalized).length;
      roundScores[answer.id] += duplicates > 1 ? 5 : 10;
    }
  }
  for (const id of state.order) state.scores[id] += roundScores[id];
  state.roundScores = roundScores;
  state.validity = validity;
  if (state.round >= state.maxRounds) {
    const best = Math.max(...Object.values(state.scores));
    state.winnerIds = state.order.filter((id) => state.scores[id] === best);
    state.phase = "finished";
  } else {
    state.phase = "round-result";
  }
}

function resetCategoriesRound(state) {
  state.round += 1;
  state.letter = randomLetter(state.letter);
  state.phase = "answering";
  state.answers = Object.fromEntries(state.order.map((id) => [id, null]));
  state.submitted = [];
  state.votes = {};
  state.validity = null;
  state.roundScores = null;
  state.deadline = Date.now() + state.roundSeconds * 1_000;
}

export class CategoriesEngine {
  static implemented = true;

  static start({ players, settings }) {
    requirePlayers(players, { min: 2, max: 40 });
    const order = players.map((player) => player.id);
    const selected = Array.isArray(settings.categories)
      ? [...new Set(settings.categories.map((value) => String(value).trim()).filter((value) => value.length >= 2))].slice(0, 20)
      : [];
    const categories = selected.length >= 2 ? selected : DEFAULT_CATEGORIES.slice(0, 8);
    const roundSeconds = Math.max(30, Math.min(600, Number(settings.roundSeconds) || 120));
    const maxRounds = Math.max(1, Math.min(20, Number(settings.maxRounds) || 5));
    return {
      kind: "categories",
      phase: "answering",
      order,
      hostId: order[0],
      round: 1,
      letter: randomLetter(),
      categories,
      roundSeconds,
      maxRounds,
      deadline: Date.now() + roundSeconds * 1_000,
      answers: Object.fromEntries(order.map((id) => [id, null])),
      submitted: [],
      votes: {},
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      roundScores: null,
      validity: null,
      winnerIds: []
    };
  }

  static applyAction({ action, playerId, state }) {
    if (state.phase === "finished") invalid("La partita è terminata.");
    const next = cloneState(state);
    if (action.type === "submit") {
      if (next.phase !== "answering" || next.submitted.includes(playerId)) invalid("Risposte già consegnate o fase chiusa.");
      if (Date.now() > next.deadline) invalid("Tempo scaduto: l'host deve chiudere le consegne.");
      const answers = {};
      for (const category of next.categories) answers[category] = String(action.answers?.[category] ?? "").trim().slice(0, 80);
      next.answers[playerId] = answers;
      next.submitted.push(playerId);
      if (next.submitted.length === next.order.length) openReview(next);
      return next;
    }
    if (action.type === "close-answers") {
      if (playerId !== next.hostId || next.phase !== "answering") invalid("Solo l'host può chiudere la consegna.");
      for (const id of next.order) {
        if (!next.answers[id]) next.answers[id] = Object.fromEntries(next.categories.map((category) => [category, ""]));
      }
      openReview(next);
      return next;
    }
    if (action.type === "skip-letter") {
      if (playerId !== next.hostId || next.phase !== "answering") invalid("Solo l'host può cambiare la lettera durante le risposte.");
      next.letter = randomLetter(next.letter);
      next.answers = Object.fromEntries(next.order.map((id) => [id, null]));
      next.submitted = [];
      next.votes = {};
      next.deadline = Date.now() + next.roundSeconds * 1_000;
      return next;
    }
    if (action.type === "vote") {
      if (next.phase !== "review" || !next.order.includes(action.targetPlayerId) || !next.categories.includes(action.category)) {
        invalid("Voto non valido.");
      }
      if (action.targetPlayerId === playerId) invalid("Non puoi votare la tua risposta.");
      next.votes[action.targetPlayerId] ??= {};
      next.votes[action.targetPlayerId][action.category] ??= {};
      next.votes[action.targetPlayerId][action.category][playerId] = Boolean(action.valid);
      return next;
    }
    if (action.type === "score-round") {
      if (playerId !== next.hostId || next.phase !== "review") invalid("Solo l'host può calcolare il round.");
      scoreCategories(next);
      return next;
    }
    if (action.type === "next-round") {
      if (playerId !== next.hostId || next.phase !== "round-result") invalid("Il prossimo round non può ancora iniziare.");
      if (next.round >= next.maxRounds) invalid("Hai già giocato il numero massimo di round.");
      resetCategoriesRound(next);
      return next;
    }
    if (action.type === "finish-game") {
      if (playerId !== next.hostId || !["review", "round-result"].includes(next.phase)) invalid("Non puoi terminare ora la partita.");
      if (next.phase === "review") scoreCategories(next);
      const best = Math.max(...Object.values(next.scores));
      next.winnerIds = next.order.filter((id) => next.scores[id] === best);
      next.phase = "finished";
      return next;
    }
    invalid("Azione Nomi, Cose, Città non riconosciuta.");
  }

  static view(state, playerId) {
    const reveal = state.phase !== "answering";
    return {
      kind: state.kind,
      phase: state.phase,
      order: state.order,
      hostId: state.hostId,
      round: state.round,
      maxRounds: state.maxRounds,
      letter: state.letter,
      categories: state.categories,
      deadline: state.deadline,
      submitted: state.submitted,
      answers: reveal ? state.answers : { [playerId]: state.answers[playerId] },
      votes: reveal ? state.votes : {},
      scores: state.scores,
      roundScores: state.roundScores,
      validity: state.validity,
      winnerIds: state.winnerIds
    };
  }

  static isFinished(state) {
    return state.phase === "finished";
  }

  static onTimeout({ state }) {
    if (state.phase !== "answering") return state;
    const next = cloneState(state);
    for (const id of next.order) {
      if (!next.answers[id]) next.answers[id] = Object.fromEntries(next.categories.map((category) => [category, ""]));
    }
    openReview(next);
    return next;
  }
}

function maskWord(solution, guessed) {
  return [...solution].map((character) => {
    const normalized = normalizeText(character);
    return /[a-z]/.test(normalized) && !guessed.includes(normalized) ? "_" : character;
  }).join(" ");
}

function rotateHangman(state) {
  state.currentPlayerId = nextPlayerId(state.guessOrder, state.currentPlayerId);
}

export class HangmanEngine {
  static implemented = true;

  static validateSettings(settings) {
    if (settings.hangmanMode !== "custom") return;
    const customWord = normalizeText(settings.customWord).replace(/[^a-z]/g, "");
    if (customWord.length < 3 || customWord.length > 12 || !HANGMAN_DICTIONARY.has(customWord)) {
      throw new PublicError(ERROR_CODES.BAD_REQUEST, "La parola personalizzata deve essere nel dizionario italiano di Sala13 e avere da 3 a 12 lettere.");
    }
  }

  static start({ players, settings }) {
    requirePlayers(players, { min: 2, max: 30 });
    this.validateSettings(settings);
    const order = players.map((player) => player.id);
    const mode = settings.hangmanMode === "custom" ? "custom" : "classic";
    const setterId = mode === "custom" ? order[0] : null;
    const guessOrder = mode === "custom" ? order.slice(1) : order;
    const customWords = Array.isArray(settings.words)
      ? settings.words.map((word) => String(word).trim()).filter((word) => word.length >= 3 && word.length <= 40)
      : [];
    const words = customWords.length > 0 ? customWords : HANGMAN_WORDS;
    const solution = mode === "custom" ? normalizeText(settings.customWord) : words[randomInt(0, words.length)];
    return {
      kind: "hangman",
      phase: "playing",
      order,
      guessOrder,
      mode,
      setterId,
      currentPlayerId: guessOrder[0],
      solution,
      guessedLetters: [],
      wrongLetters: [],
      attempts: [],
      errors: 0,
      maxErrors: 8,
      winnerId: null,
      teamWon: false
    };
  }

  static applyAction({ action, playerId, state }) {
    if (state.phase !== "playing") invalid("La partita è terminata.");
    requireTurn(state, playerId);
    const next = cloneState(state);
    if (action.type === "guess-letter") {
      const letter = normalizeText(action.letter).replace(/[^a-z]/g, "").slice(0, 1);
      if (!letter || next.guessedLetters.includes(letter) || next.wrongLetters.includes(letter)) invalid("Lettera già usata o non valida.");
      if (normalizeText(next.solution).includes(letter)) next.guessedLetters.push(letter);
      else {
        next.wrongLetters.push(letter);
        next.errors += 1;
      }
    } else if (action.type === "guess-word") {
      const guess = String(action.word ?? "").trim().slice(0, 40);
      if (guess.length < 2) invalid("Inserisci una parola.");
      next.attempts.push({ playerId, word: guess });
      if (normalizeText(guess) === normalizeText(next.solution)) {
        next.teamWon = true;
        next.winnerId = playerId;
      } else {
        next.errors += 1;
      }
    } else {
      invalid("Azione Impiccato non riconosciuta.");
    }
    const allLetters = [...new Set(normalizeText(next.solution).replace(/[^a-z]/g, ""))];
    if (allLetters.every((letter) => next.guessedLetters.includes(letter))) {
      next.teamWon = true;
      next.winnerId = playerId;
    }
    if (next.teamWon || next.errors >= next.maxErrors) {
      next.phase = "finished";
      next.currentPlayerId = null;
    } else {
      rotateHangman(next);
    }
    return next;
  }

  static view(state, playerId) {
    return {
      kind: state.kind,
      phase: state.phase,
      order: state.order,
      guessOrder: state.guessOrder,
      mode: state.mode,
      setterId: state.setterId,
      currentPlayerId: state.currentPlayerId,
      maskedWord: maskWord(state.solution, state.guessedLetters),
      solution: state.phase === "finished" || playerId === state.setterId ? state.solution : null,
      guessedLetters: state.guessedLetters,
      wrongLetters: state.wrongLetters,
      attempts: state.attempts,
      errors: state.errors,
      maxErrors: state.maxErrors,
      winnerId: state.winnerId,
      teamWon: state.teamWon
    };
  }

  static isFinished(state) {
    return state.phase === "finished";
  }
}
