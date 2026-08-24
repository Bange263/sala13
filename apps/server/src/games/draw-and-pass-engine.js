import { randomInt } from "node:crypto";
import { validateStroke } from "./drawing-protocol.js";
import { cloneState, invalid, nextPlayerId, normalizeText, requirePlayers } from "./game-utils.js";

const PROMPTS = Object.freeze([
  "un gatto astronauta", "una pizza che balla", "un castello sulla luna", "un drago raffreddato",
  "un robot in vacanza", "una balena volante", "un detective invisibile", "una scuola sott'acqua",
  "un vulcano di gelato", "una giraffa in monopattino", "un fantasma cuoco", "un dinosauro al computer"
]);

function prompt(previous = null) {
  const choices = PROMPTS.filter((value) => value !== previous);
  return choices[randomInt(0, choices.length)];
}

function parseStroke(action) {
  try {
    return validateStroke(action.stroke);
  } catch {
    invalid("Tratto non valido o troppo grande.");
  }
}

function startDraw(order, settings) {
  const roundSeconds = Math.max(30, Math.min(600, Number(settings.roundSeconds) || 90));
  return {
    kind: "draw-and-pass",
    mode: "draw",
    phase: "drawing",
    order,
    hostId: order[0],
    drawerId: order[0],
    round: 1,
    prompt: prompt(),
    roundSeconds,
    deadline: Date.now() + roundSeconds * 1_000,
    strokes: [],
    guesses: [],
    scores: Object.fromEntries(order.map((id) => [id, 0])),
    winnerId: null
  };
}

function nextDrawRound(state) {
  state.drawerId = nextPlayerId(state.order, state.drawerId);
  state.round += 1;
  state.prompt = prompt(state.prompt);
  state.deadline = Date.now() + state.roundSeconds * 1_000;
  state.strokes = [];
  state.guesses = [];
  state.winnerId = null;
  state.phase = "drawing";
}

function applyDraw(action, playerId, state) {
  const next = cloneState(state);
  if (action.type === "stroke") {
    if (next.phase !== "drawing" || playerId !== next.drawerId) invalid("Solo il disegnatore può usare il canvas.");
    if (Date.now() > next.deadline) invalid("Il tempo del round è terminato.");
    if (next.strokes.length >= 2_000) invalid("Il canvas ha raggiunto il limite di tratti.");
    next.strokes.push(parseStroke(action));
    return next;
  }
  if (action.type === "clear") {
    if (next.phase !== "drawing" || playerId !== next.drawerId) invalid("Solo il disegnatore può pulire il canvas.");
    next.strokes = [];
    return next;
  }
  if (action.type === "guess") {
    if (next.phase !== "drawing" || playerId === next.drawerId) invalid("Non puoi inviare questa risposta.");
    if (Date.now() > next.deadline) invalid("Il tempo del round è terminato.");
    const text = String(action.text ?? "").trim().slice(0, 80);
    if (!text) invalid("Scrivi un tentativo.");
    const correct = normalizeText(text) === normalizeText(next.prompt);
    next.guesses.push({ playerId, text: correct ? "Risposta corretta" : text, correct });
    if (correct) {
      next.scores[playerId] += 100;
      next.scores[next.drawerId] += 50;
      next.winnerId = playerId;
      next.phase = "round-result";
    }
    return next;
  }
  if (action.type === "end-round") {
    if (playerId !== next.drawerId && playerId !== next.hostId) invalid("Solo host o disegnatore può chiudere il round.");
    next.phase = "round-result";
    return next;
  }
  if (action.type === "next-round") {
    if (playerId !== next.hostId || next.phase !== "round-result") invalid("Il prossimo round non può iniziare.");
    nextDrawRound(next);
    return next;
  }
  if (action.type === "finish-game") {
    if (playerId !== next.hostId) invalid("Solo l'host può terminare la partita.");
    next.phase = "finished";
    const best = Math.max(...Object.values(next.scores));
    next.winnerIds = next.order.filter((id) => next.scores[id] === best);
    return next;
  }
  invalid("Azione Disegna non riconosciuta.");
}

function beginPassStep(state) {
  state.phase = state.step % 2 === 1 ? "drawing" : "caption";
  state.submitted = [];
  for (let chainIndex = 0; chainIndex < state.chains.length; chainIndex += 1) {
    const chain = state.chains[chainIndex];
    chain.holderId = state.order[(chainIndex + state.step) % state.order.length];
    chain.draftStrokes = [];
  }
}

function progressPass(state) {
  if (state.submitted.length !== state.order.length) return;
  if (state.step >= state.order.length - 1) {
    state.phase = "reveal";
    for (const chain of state.chains) {
      delete chain.holderId;
      delete chain.draftStrokes;
    }
    return;
  }
  state.step += 1;
  beginPassStep(state);
}

function assignmentFor(state, playerId) {
  return state.chains.find((chain) => chain.holderId === playerId);
}

function applyPass(action, playerId, state) {
  const next = cloneState(state);
  if (action.type === "submit-prompt") {
    if (next.phase !== "prompt" || next.submitted.includes(playerId)) invalid("Prompt già consegnato o fase chiusa.");
    const text = String(action.text ?? "").trim().slice(0, 100);
    if (text.length < 3) invalid("Il prompt deve contenere almeno tre caratteri.");
    const chain = next.chains.find((candidate) => candidate.originId === playerId);
    chain.pages.push({ type: "text", playerId, content: text });
    next.submitted.push(playerId);
    if (next.submitted.length === next.order.length) {
      next.step = 1;
      beginPassStep(next);
    }
    return next;
  }
  const chain = assignmentFor(next, playerId);
  if (!chain) invalid("Non hai una consegna attiva.");
  if (action.type === "stroke") {
    if (next.phase !== "drawing" || next.submitted.includes(playerId)) invalid("Non puoi disegnare in questa fase.");
    if (chain.draftStrokes.length >= 2_000) invalid("Il canvas ha raggiunto il limite di tratti.");
    chain.draftStrokes.push(parseStroke(action));
    return next;
  }
  if (action.type === "clear") {
    if (next.phase !== "drawing" || next.submitted.includes(playerId)) invalid("Non puoi pulire il canvas.");
    chain.draftStrokes = [];
    return next;
  }
  if (action.type === "submit-drawing") {
    if (next.phase !== "drawing" || next.submitted.includes(playerId)) invalid("Disegno già consegnato o fase errata.");
    chain.pages.push({ type: "drawing", playerId, strokes: chain.draftStrokes });
    delete chain.draftStrokes;
    next.submitted.push(playerId);
    progressPass(next);
    return next;
  }
  if (action.type === "submit-caption") {
    if (next.phase !== "caption" || next.submitted.includes(playerId)) invalid("Didascalia già consegnata o fase errata.");
    const text = String(action.text ?? "").trim().slice(0, 100);
    if (text.length < 2) invalid("Scrivi una descrizione.");
    chain.pages.push({ type: "text", playerId, content: text });
    next.submitted.push(playerId);
    progressPass(next);
    return next;
  }
  invalid("Azione Passa non riconosciuta.");
}

function startPass(order) {
  return {
    kind: "draw-and-pass",
    mode: "pass",
    phase: "prompt",
    order,
    hostId: order[0],
    step: 0,
    submitted: [],
    chains: order.map((originId) => ({ originId, pages: [] }))
  };
}

export class DrawAndPassEngine {
  static implemented = true;

  static start({ players, settings }) {
    requirePlayers(players, { min: 2, max: 24 });
    const order = players.map((player) => player.id);
    return settings.mode === "pass" ? startPass(order) : startDraw(order, settings);
  }

  static applyAction({ action, playerId, state }) {
    if (["finished", "reveal"].includes(state.phase)) invalid("La partita è terminata.");
    return state.mode === "pass" ? applyPass(action, playerId, state) : applyDraw(action, playerId, state);
  }

  static view(state, playerId) {
    if (state.mode === "draw") {
      return {
        kind: state.kind,
        mode: state.mode,
        phase: state.phase,
        order: state.order,
        hostId: state.hostId,
        drawerId: state.drawerId,
        round: state.round,
        prompt: playerId === state.drawerId || state.phase !== "drawing" ? state.prompt : null,
        deadline: state.deadline,
        strokes: state.strokes,
        guesses: state.guesses,
        scores: state.scores,
        winnerId: state.winnerId,
        winnerIds: state.winnerIds ?? []
      };
    }
    const assignment = assignmentFor(state, playerId);
    const lastPage = assignment?.pages.at(-1) ?? null;
    return {
      kind: state.kind,
      mode: state.mode,
      phase: state.phase,
      order: state.order,
      hostId: state.hostId,
      step: state.step,
      submitted: state.submitted,
      assignment: assignment ? {
        originId: assignment.originId,
        source: lastPage,
        draftStrokes: state.phase === "drawing" ? assignment.draftStrokes : undefined
      } : null,
      chains: state.phase === "reveal" ? state.chains : null
    };
  }

  static isFinished(state) {
    return state.phase === "finished" || state.phase === "reveal";
  }
}
