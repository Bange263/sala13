import { renderTicTacToe } from "./tic-tac-toe.js";
import { createUuid } from "../utils/id.js";

const SUITS = Object.freeze({
  hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠",
  denari: "Denari", coppe: "Coppe", bastoni: "Bastoni"
});
const PIECES = Object.freeze({
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
  wM: "●", bM: "●", wKCheckers: "◆", bKCheckers: "◆"
});

function el(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") element.textContent = text;
  return element;
}

function title(text, subtitle = "") {
  const header = el("header", "game-header");
  header.append(el("h2", "", text));
  if (subtitle) header.append(el("p", "", subtitle));
  return header;
}

function control(label, action, className = "button button-dark", disabled = false) {
  const button = el("button", className, label);
  button.type = "button";
  button.disabled = disabled;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await action();
    } finally {
      if (button.isConnected) button.disabled = disabled;
    }
  });
  return button;
}

function playerName(room, id) {
  return room.players.find((player) => player.id === id)?.name ?? "Giocatore";
}

function cardLabel(card) {
  if (!card) return "—";
  if (card.hidden) return "?";
  if (card.joker || card.rank === "JOKER") return "Jolly";
  return `${card.rank}${SUITS[card.suit] ? ` ${SUITS[card.suit]}` : ` ${card.suit}`}`;
}

function cardElement(card, onClick = null) {
  const tag = onClick ? "button" : "span";
  const element = el(tag, "playing-card", cardLabel(card));
  element.dataset.suit = card?.suit ?? "hidden";
  if (onClick) {
    element.type = "button";
    element.addEventListener("click", () => onClick(element));
  }
  return element;
}

function cardRow(cards, onClick = null) {
  const row = el("div", "card-row");
  for (const card of cards ?? []) row.append(cardElement(card, onClick ? (element) => onClick(card, element) : null));
  return row;
}

function stat(label, value) {
  const item = el("div", "game-stat");
  item.append(el("span", "", label), el("strong", "", String(value)));
  return item;
}

function countdown(deadline) {
  const timer = el("strong", "countdown");
  const update = () => {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
    const minutes = Math.floor(remaining / 60);
    timer.textContent = `${minutes}:${String(remaining % 60).padStart(2, "0")}`;
    if (remaining === 0 || !timer.isConnected) window.clearInterval(interval);
  };
  const interval = window.setInterval(update, 1_000);
  update();
  return timer;
}

function actionRow(...children) {
  const row = el("div", "game-actions");
  row.append(...children.filter(Boolean));
  return row;
}

function renderBlackjack(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board blackjack-board");
  wrapper.append(title("Tavolo Blackjack", state.phase === "betting" ? "Confermate le puntate" : state.phase === "players" ? `Turno di ${playerName(room, state.currentPlayerId)}` : "Banco e risultati"));
  const dealer = el("section", "table-zone dealer-zone");
  dealer.append(el("h3", "", `Banco${state.dealer.value !== null ? ` · ${state.dealer.value}` : ""}`), cardRow(state.dealer.cards));
  wrapper.append(dealer);
  const players = el("div", "player-hands-grid");
  for (const player of room.players) {
    const record = state.players[player.id];
    const panel = el("section", `hand-panel${player.id === state.currentPlayerId ? " active" : ""}`);
    panel.append(el("h3", "", `${player.name} · ${record.chips} chip`));
    record.hands.forEach((hand, index) => {
      const handBox = el("div", "blackjack-hand");
      handBox.append(el("p", "", `Mano ${index + 1} · ${hand.value} · puntata ${hand.bet}${hand.result ? ` · ${hand.result}` : ""}`));
      handBox.append(cardRow(hand.cards));
      panel.append(handBox);
    });
    players.append(panel);
  }
  wrapper.append(players);
  if (state.phase === "betting") {
    const record = state.players[room.selfPlayerId];
    if (record.hands.length === 0) {
      const amount = el("input", "inline-number");
      amount.type = "number";
      amount.min = "10";
      amount.max = String(record.chips);
      amount.value = String(Math.min(record.chips, state.settings.baseBet));
      wrapper.append(actionRow(amount, control("Conferma puntata", () => send({ type: "bet", amount: Number(amount.value) }), "button button-primary")));
    } else {
      wrapper.append(el("p", "game-callout", "Puntata confermata. Attendi gli altri giocatori."));
    }
  }
  if (state.currentPlayerId === room.selfPlayerId && state.phase === "players") {
    const record = state.players[room.selfPlayerId];
    const hand = record.hands[record.activeHandIndex];
    wrapper.append(actionRow(
      control("Carta", () => send({ type: "hit" })),
      control("Stai", () => send({ type: "stand" }), "button button-quiet"),
      control("Raddoppia", () => send({ type: "double" }), "button button-quiet", hand.cards.length !== 2 || record.chips < hand.bet),
      control("Dividi", () => send({ type: "split" }), "button button-quiet", hand.cards.length !== 2 || hand.cards[0].rank !== hand.cards[1].rank)
    ));
  }
  stage.replaceChildren(wrapper);
}

function renderUno(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board uno-board");
  wrapper.append(title("Uno", state.winnerId ? `${playerName(room, state.winnerId)} ha vinto` : `Turno di ${playerName(room, state.currentPlayerId)}`));
  const center = el("div", "uno-center");
  center.append(stat("Colore", state.currentColor), cardElement(state.topCard), stat("Mazzo", state.drawCount));
  if (state.pendingDraw) center.append(stat("Penalità", `+${state.pendingDraw}`));
  wrapper.append(center);
  const counts = el("div", "compact-player-list");
  for (const player of room.players) {
    const hand = state.hands[player.id];
    counts.append(el("span", "status-chip", `${player.name}: ${Array.isArray(hand) ? hand.length : hand.count}`));
  }
  wrapper.append(counts);
  const ownHand = state.hands[room.selfPlayerId];
  if (Array.isArray(ownHand)) {
    const color = el("select", "inline-select");
    for (const value of ["red", "yellow", "green", "blue"]) {
      const option = el("option", "", value);
      option.value = value;
      color.append(option);
    }
    const unoCall = el("input", "");
    unoCall.type = "checkbox";
    const unoLabel = el("label", "eraser-toggle", "Dichiaro UNO ");
    unoLabel.append(unoCall);
    const hand = cardRow(ownHand, (card) => send({ type: "play", cardId: card.id, color: color.value, uno: unoCall.checked }));
    hand.classList.add("uno-hand");
    wrapper.append(el("h3", "subheading", "La tua mano"), hand, actionRow(color, unoLabel, control(state.pendingDraw ? `Pesca ${state.pendingDraw}` : "Pesca", () => send({ type: "draw" }), "button button-dark", state.currentPlayerId !== room.selfPlayerId)));
  }
  stage.replaceChildren(wrapper);
}

function renderScopa(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board italian-board");
  wrapper.append(title("Scopa", state.phase === "finished" ? "Punteggio finale" : `Turno di ${playerName(room, state.currentPlayerId)}`));
  const scoreRow = el("div", "stats-row");
  for (const [team, count] of Object.entries(state.capturedCounts)) scoreRow.append(stat(`${team} · prese`, `${count} · scope ${state.scope[team]}`));
  wrapper.append(scoreRow, el("h3", "subheading", "Carte sul tavolo"));
  const selected = new Set();
  const table = cardRow(state.table, (card, element) => {
    if (selected.has(card.id)) selected.delete(card.id);
    else selected.add(card.id);
    element.classList.toggle("selected");
  });
  wrapper.append(table);
  const hand = state.hands[room.selfPlayerId];
  if (Array.isArray(hand)) {
    wrapper.append(el("h3", "subheading", "La tua mano"), cardRow(hand, (card) => send({ type: "play", cardId: card.id, captureIds: [...selected] })));
  }
  if (state.scores) {
    const results = el("div", "result-panel");
    for (const [team, value] of Object.entries(state.scores)) results.append(el("p", "", `${team}: ${value.points} punti · carte ${value.carte} · denari ${value.denari} · primiera ${value.primiera}`));
    wrapper.append(results);
  }
  stage.replaceChildren(wrapper);
}

function renderBriscola(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board italian-board");
  wrapper.append(title("Briscola", state.phase === "finished" ? "Partita conclusa" : `Turno di ${playerName(room, state.currentPlayerId)}`));
  wrapper.append(el("p", "game-callout", `Seme di briscola: ${state.trumpSuit} · ${cardLabel(state.briscolaCard)} · ${state.deckCount} carte rimaste`));
  const trick = el("section", "table-zone");
  trick.append(el("h3", "", "Presa in corso"));
  for (const play of state.trick) {
    const item = el("div", "played-card");
    item.append(el("span", "", playerName(room, play.playerId)), cardElement(play.card));
    trick.append(item);
  }
  wrapper.append(trick);
  const scores = el("div", "stats-row");
  for (const [team, points] of Object.entries(state.points)) scores.append(stat(team, `${points} punti`));
  wrapper.append(scores);
  const hand = state.hands[room.selfPlayerId];
  if (Array.isArray(hand)) wrapper.append(el("h3", "subheading", "La tua mano"), cardRow(hand, (card) => send({ type: "play", cardId: card.id })));
  stage.replaceChildren(wrapper);
}

function renderPoker(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board poker-board");
  wrapper.append(title("Texas Hold'em", state.phase === "finished" ? "Showdown" : `${state.phase} · turno di ${playerName(room, state.currentPlayerId)}`));
  wrapper.append(el("div", "poker-pot", `Piatto: ${state.pot}`), cardRow(state.community));
  const seats = el("div", "poker-seats");
  for (const player of room.players) {
    const record = state.players[player.id];
    const seat = el("section", `poker-seat${player.id === state.currentPlayerId ? " active" : ""}${record.folded ? " folded" : ""}`);
    seat.append(el("h3", "", player.name), el("p", "", `${record.chips} chip · puntata ${record.streetBet}${record.allIn ? " · ALL-IN" : ""}${record.folded ? " · fold" : ""}`));
    if (Array.isArray(record.hole)) seat.append(cardRow(record.hole));
    if (state.evaluations?.[player.id]) seat.append(el("strong", "", state.evaluations[player.id].name));
    seats.append(seat);
  }
  wrapper.append(seats);
  if (state.currentPlayerId === room.selfPlayerId && state.phase !== "finished") {
    const self = state.players[room.selfPlayerId];
    const toCall = Math.max(0, state.currentBet - self.streetBet);
    const amount = el("input", "inline-number");
    amount.type = "number";
    amount.min = String(state.currentBet + state.minRaise);
    amount.max = String(self.streetBet + self.chips);
    amount.value = String(Math.min(Number(amount.max), Number(amount.min)));
    wrapper.append(actionRow(
      control("Fold", () => send({ type: "fold" }), "button button-quiet"),
      control("Check", () => send({ type: "check" }), "button button-dark", toCall > 0),
      control(`Call ${toCall}`, () => send({ type: "call" }), "button button-dark", toCall === 0),
      amount,
      control("Raise", () => send({ type: "raise", amount: Number(amount.value) }), "button button-primary"),
      control("All-in", () => send({ type: "all-in" }), "button button-quiet")
    ));
  }
  stage.replaceChildren(wrapper);
}

function renderBurraco(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board burraco-board");
  wrapper.append(title("Burraco", state.phase === "finished" ? "Partita conclusa" : `${state.phase} · turno di ${playerName(room, state.currentPlayerId)}`));
  wrapper.append(el("p", "game-callout", `Tallone ${state.deckCount} · scarti ${state.discardCount} · pozzetti ${state.potCount} · il tuo team: ${state.yourTeam}`));
  const meldArea = el("div", "meld-grid");
  for (const [team, melds] of Object.entries(state.melds)) {
    const teamArea = el("section", "meld-team");
    teamArea.append(el("h3", "", team));
    melds.forEach((meld, index) => {
      const item = el("div", "meld");
      item.append(el("p", "", `${meld.type} ${meld.cards.length >= 7 ? `· burraco ${meld.clean ? "pulito" : "sporco"}` : ""}`), cardRow(meld.cards));
      item.dataset.index = String(index);
      teamArea.append(item);
    });
    meldArea.append(teamArea);
  }
  wrapper.append(meldArea);
  const hand = state.hands[room.selfPlayerId];
  if (Array.isArray(hand)) {
    const selected = new Set();
    const handRow = cardRow(hand, (card, element) => {
      if (selected.has(card.id)) selected.delete(card.id);
      else selected.add(card.id);
      element.classList.toggle("selected");
    });
    wrapper.append(el("h3", "subheading", "La tua mano"), handRow);
    const myTurn = state.currentPlayerId === room.selfPlayerId;
    const meldSelect = el("select", "inline-select");
    state.melds[state.yourTeam].forEach((meld, index) => {
      const option = el("option", "", `${index + 1}. ${meld.type}`);
      option.value = String(index);
      meldSelect.append(option);
    });
    wrapper.append(actionRow(
      control("Pesca dal tallone", () => send({ type: "draw", source: "deck" }), "button button-dark", !myTurn || state.phase !== "draw" || state.deckCount === 0),
      control("Raccogli scarti", () => send({ type: "draw", source: "discard" }), "button button-quiet", !myTurn || state.phase !== "draw" || state.discardCount === 0),
      control("Cala combinazione", () => send({ type: "meld", cardIds: [...selected] }), "button button-primary", !myTurn || state.phase !== "meld"),
      meldSelect,
      control("Aggiungi alla combinazione", () => send({ type: "add-to-meld", cardIds: [...selected], meldIndex: Number(meldSelect.value) }), "button button-quiet", !myTurn || state.phase !== "meld" || state.melds[state.yourTeam].length === 0),
      control("Scarta selezionata", () => send({ type: "discard", cardId: [...selected][0] }), "button button-quiet", !myTurn || state.phase !== "meld")
    ));
  }
  if (state.scores) wrapper.append(el("pre", "result-panel", JSON.stringify(state.scores, null, 2)));
  stage.replaceChildren(wrapper);
}

function gridCellLabel(index) {
  return `${String.fromCharCode(65 + (index % 10))}${Math.floor(index / 10) + 1}`;
}

function renderSeaGrid({ shots = {}, ships = [], incomingShots = {} }, onFire = null) {
  const grid = el("div", "sea-grid");
  const shipCells = new Set(ships.flatMap((ship) => ship.cells));
  for (let cell = 0; cell < 100; cell += 1) {
    const result = shots[cell] ?? incomingShots[cell] ?? "";
    const button = el("button", "sea-cell", result === "miss" ? "·" : result ? "×" : "");
    button.type = "button";
    button.title = gridCellLabel(cell);
    button.dataset.result = result;
    button.dataset.ship = String(shipCells.has(cell));
    button.disabled = !onFire || Boolean(result);
    if (onFire) button.addEventListener("click", () => onFire(cell));
    grid.append(button);
  }
  return grid;
}

function renderBattleship(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board battleship-board");
  wrapper.append(title("Battaglia Navale", state.phase === "placement" ? "Piazza la flotta in segreto" : state.phase === "finished" ? `${playerName(room, state.winnerId)} ha vinto` : `Turno di ${playerName(room, state.currentPlayerId)}`));
  if (state.phase === "placement") {
    wrapper.append(el("p", "game-callout", state.placed[room.selfPlayerId] ? "Flotta confermata. Attendi l'avversario." : "Il server può creare subito un piazzamento valido e casuale."));
    if (!state.placed[room.selfPlayerId]) {
      const placementPanel = el("section", "manual-placement");
      let placement = [];
      const renderPlacement = () => {
        const currentShip = state.fleet[placement.length];
        const orientation = el("select", "inline-select");
        for (const [value, label] of [["horizontal", "Orizzontale"], ["vertical", "Verticale"]]) {
          const option = el("option", "", label);
          option.value = value;
          orientation.append(option);
        }
        const occupied = new Set(placement.flatMap((ship) => ship.cells));
        const grid = renderSeaGrid({ ships: placement, incomingShots: {} }, currentShip ? (cell) => {
          const row = Math.floor(cell / 10);
          const column = cell % 10;
          const cells = Array.from({ length: currentShip.size }, (_, offset) =>
            orientation.value === "horizontal" ? row * 10 + column + offset : (row + offset) * 10 + column
          );
          const valid = cells.every((candidate) => candidate >= 0 && candidate < 100 && !occupied.has(candidate)) &&
            (orientation.value === "vertical" || cells.every((candidate) => Math.floor(candidate / 10) === row));
          if (!valid) return;
          placement.push({ id: currentShip.id, cells });
          renderPlacement();
        } : null);
        const heading = el("p", "", currentShip ? `Posiziona ${currentShip.id} (${currentShip.size} caselle), scegliendo la casella iniziale.` : "Flotta completa: puoi confermarla.");
        placementPanel.replaceChildren(heading, orientation, grid, actionRow(
          control("Azzera", async () => { placement = []; renderPlacement(); }, "button button-quiet", placement.length === 0),
          control("Conferma flotta", () => send({ type: "place", ships: placement }), "button button-primary", Boolean(currentShip)),
          control("Piazzamento automatico", () => send({ type: "auto-place" }), "button button-dark")
        ));
      };
      renderPlacement();
      wrapper.append(placementPanel);
    }
  }
  const grids = el("div", "sea-layout");
  const own = el("section", "sea-panel");
  own.append(el("h3", "", "La tua flotta"), state.ownBoard ? renderSeaGrid(state.ownBoard) : el("div", "empty-board", "Non piazzata"));
  const target = el("section", "sea-panel");
  const canFire = state.phase === "battle" && state.currentPlayerId === room.selfPlayerId;
  target.append(el("h3", "", "Griglia avversaria"), renderSeaGrid(state.targetBoard, canFire ? (cell) => send({ type: "fire", cell }) : null));
  grids.append(own, target);
  wrapper.append(grids);
  stage.replaceChildren(wrapper);
}

function boardPiece(piece, variant) {
  if (!piece) return "";
  if (variant === "checkers") {
    if (piece === "wM") return "●";
    if (piece === "bM") return "●";
    return "◆";
  }
  return PIECES[piece] ?? piece;
}

function renderChessCheckers(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board board-game");
  const variantName = state.variant === "checkers" ? "Dama" : "Scacchi";
  wrapper.append(title(variantName, state.result ? `Risultato: ${state.result}` : `${state.inCheck ? "Scacco · " : ""}turno di ${playerName(room, state.currentPlayerId)}`));
  const board = el("div", "chess-board");
  let selected = null;
  const order = state.yourColor === "b" ? Array.from({ length: 64 }, (_, index) => 63 - index) : Array.from({ length: 64 }, (_, index) => index);
  const buttons = new Map();
  for (const index of order) {
    const [row, column] = [Math.floor(index / 8), index % 8];
    const piece = state.board[index];
    const square = el("button", "board-square", boardPiece(piece, state.variant));
    square.type = "button";
    square.dataset.dark = String((row + column) % 2 === 1);
    square.dataset.color = piece?.[0] ?? "";
    square.title = `${String.fromCharCode(97 + column)}${8 - row}`;
    square.disabled = Boolean(state.result) || state.currentPlayerId !== room.selfPlayerId;
    square.addEventListener("click", () => {
      if (selected === null) {
        if (piece?.[0] !== state.yourColor) return;
        selected = index;
        square.classList.add("selected");
        return;
      }
      if (piece?.[0] === state.yourColor) {
        buttons.get(selected)?.classList.remove("selected");
        selected = index;
        square.classList.add("selected");
        return;
      }
      send({ type: "move", from: selected, to: index, promotion: "Q" });
    });
    buttons.set(index, square);
    board.append(square);
  }
  wrapper.append(board);
  stage.replaceChildren(wrapper);
}

function renderCategories(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board categories-board");
  wrapper.append(title(`Lettera ${state.letter}`, `Round ${state.round} · fase ${state.phase}`));
  if (state.phase === "answering") wrapper.append(countdown(state.deadline));
  const scores = el("div", "compact-player-list");
  for (const player of room.players) scores.append(el("span", "status-chip", `${player.name}: ${state.scores[player.id]}`));
  wrapper.append(scores);
  if (state.phase === "answering") {
    const form = el("form", "category-form");
    const inputs = {};
    for (const category of state.categories) {
      const label = el("label", "");
      label.append(el("span", "", category));
      const input = el("input", "");
      input.maxLength = 80;
      input.autocomplete = "off";
      input.disabled = state.submitted.includes(room.selfPlayerId);
      inputs[category] = input;
      label.append(input);
      form.append(label);
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await send({ type: "submit", answers: Object.fromEntries(state.categories.map((category) => [category, inputs[category].value])) });
    });
    form.append(control(state.submitted.includes(room.selfPlayerId) ? "Risposte consegnate" : "Consegna risposte", () => form.requestSubmit(), "button button-primary", state.submitted.includes(room.selfPlayerId)));
    wrapper.append(form);
    if (room.selfPlayerId === state.hostId) wrapper.append(control("Chiudi consegne", () => send({ type: "close-answers" }), "button button-quiet"));
  } else {
    const table = el("div", "answer-review");
    for (const player of room.players) {
      const section = el("section", "answer-player");
      section.append(el("h3", "", player.name));
      for (const category of state.categories) {
        const answer = state.answers[player.id]?.[category] || "—";
        const row = el("div", "answer-row");
        row.append(el("span", "", category), el("strong", "", answer));
        if (state.phase === "review" && player.id !== room.selfPlayerId) {
          row.append(control("✓", () => send({ type: "vote", targetPlayerId: player.id, category, valid: true }), "mini-action"), control("×", () => send({ type: "vote", targetPlayerId: player.id, category, valid: false }), "mini-action danger"));
        }
        section.append(row);
      }
      table.append(section);
    }
    wrapper.append(table);
    if (room.selfPlayerId === state.hostId && state.phase === "review") wrapper.append(actionRow(control("Calcola round", () => send({ type: "score-round" }), "button button-primary"), control("Termina partita", () => send({ type: "finish-game" }), "button button-quiet")));
    if (room.selfPlayerId === state.hostId && state.phase === "round-result") wrapper.append(actionRow(control("Prossimo round", () => send({ type: "next-round" }), "button button-primary"), control("Termina partita", () => send({ type: "finish-game" }), "button button-quiet")));
  }
  stage.replaceChildren(wrapper);
}

function renderHangman(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board hangman-board");
  wrapper.append(title("L'Impiccato", state.phase === "finished" ? (state.teamWon ? "Parola indovinata" : "Tentativi terminati") : `Turno di ${playerName(room, state.currentPlayerId)}`));
  const gallows = el("div", "gallows");
  for (let part = 1; part <= 8; part += 1) {
    const shape = el("span", `gallows-part part-${part}`);
    shape.hidden = state.errors < part;
    gallows.append(shape);
  }
  wrapper.append(gallows, el("div", "masked-word", state.maskedWord));
  wrapper.append(el("p", "game-callout", `Errori ${state.errors}/${state.maxErrors} · lettere errate: ${state.wrongLetters.join(", ") || "nessuna"}`));
  if (state.solution) wrapper.append(el("p", "result-panel", `Soluzione: ${state.solution}`));
  if (state.currentPlayerId === room.selfPlayerId) {
    const letter = el("input", "inline-text");
    letter.maxLength = 1;
    letter.placeholder = "Lettera";
    const word = el("input", "inline-text");
    word.maxLength = 40;
    word.placeholder = "Parola completa";
    wrapper.append(actionRow(letter, control("Prova lettera", () => send({ type: "guess-letter", letter: letter.value })), word, control("Prova parola", () => send({ type: "guess-word", word: word.value }), "button button-primary")));
  }
  stage.replaceChildren(wrapper);
}

function renderConnectFour(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board connect-board");
  wrapper.append(title("Forza Quattro", state.winnerId ? `${playerName(room, state.winnerId)} ha vinto` : state.draw ? "Pareggio" : `Turno di ${playerName(room, state.currentPlayerId)}`));
  const dropRow = el("div", "connect-drop-row");
  for (let column = 0; column < state.columns; column += 1) dropRow.append(control("↓", () => send({ type: "drop", column }), "drop-button", state.currentPlayerId !== room.selfPlayerId || Boolean(state.board[column])));
  const board = el("div", "connect-grid");
  for (let index = 0; index < state.board.length; index += 1) {
    const cell = el("span", "connect-cell");
    cell.dataset.mark = state.board[index] ?? "";
    cell.dataset.winning = String(state.winningLine?.includes(index) ?? false);
    board.append(cell);
  }
  wrapper.append(dropRow, board);
  stage.replaceChildren(wrapper);
}

function paintStroke(context, stroke, width, height) {
  if (!stroke?.points?.length) return;
  context.save();
  context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.size;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  stroke.points.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.restore();
}

function canvasTool(strokes, enabled, send) {
  const shell = el("div", "canvas-shell");
  const toolbar = el("div", "canvas-toolbar");
  const color = el("input", "");
  color.type = "color";
  color.value = "#1f2923";
  const size = el("input", "");
  size.type = "range";
  size.min = "2";
  size.max = "40";
  size.value = "7";
  const eraser = el("input", "");
  eraser.type = "checkbox";
  const eraserLabel = el("label", "eraser-toggle", "Gomma ");
  eraserLabel.append(eraser);
  toolbar.append(color, size, eraserLabel);
  if (enabled) toolbar.append(control("Pulisci", () => send({ type: "clear" }), "button button-quiet"));
  const canvas = el("canvas", "drawing-canvas");
  canvas.width = 900;
  canvas.height = 520;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes ?? []) paintStroke(context, stroke, canvas.width, canvas.height);
  if (enabled) {
    let points = null;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
    };
    canvas.addEventListener("pointerdown", (event) => {
      canvas.setPointerCapture(event.pointerId);
      points = [point(event)];
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!points) return;
      const nextPoint = point(event);
      const preview = { tool: eraser.checked ? "eraser" : "brush", color: color.value, size: Number(size.value), points: [points.at(-1), nextPoint] };
      paintStroke(context, preview, canvas.width, canvas.height);
      points.push(nextPoint);
    });
    canvas.addEventListener("pointerup", async () => {
      if (!points) return;
      if (points.length === 1) points.push({ ...points[0], x: Math.min(1, points[0].x + 0.001) });
      const stroke = { id: createUuid(), tool: eraser.checked ? "eraser" : "brush", color: color.value, size: Number(size.value), points };
      points = null;
      await send({ type: "stroke", stroke });
    });
  }
  shell.append(toolbar, canvas);
  return shell;
}

function renderDrawAndPass(stage, room, send) {
  const state = room.gameState;
  const wrapper = el("div", "game-board draw-board");
  if (state.mode === "draw") {
    wrapper.append(title("Disegna e indovina", state.phase === "drawing" ? `Disegna: ${playerName(room, state.drawerId)}` : `Round ${state.round} concluso`));
    wrapper.append(el("p", "game-callout", state.prompt ? `Prompt: ${state.prompt}` : "Il prompt è segreto: prova a indovinare."));
    if (state.phase === "drawing") wrapper.append(countdown(state.deadline));
    wrapper.append(canvasTool(state.strokes, room.selfPlayerId === state.drawerId && state.phase === "drawing", send));
    if (room.selfPlayerId !== state.drawerId && state.phase === "drawing") {
      const guess = el("input", "inline-text");
      guess.placeholder = "La tua risposta";
      wrapper.append(actionRow(guess, control("Invia", () => send({ type: "guess", text: guess.value }), "button button-primary")));
    }
    const messages = el("div", "guess-list");
    for (const guess of state.guesses) messages.append(el("p", guess.correct ? "correct" : "", `${playerName(room, guess.playerId)}: ${guess.text}`));
    wrapper.append(messages);
    if (room.selfPlayerId === state.drawerId && state.phase === "drawing") wrapper.append(control("Chiudi round", () => send({ type: "end-round" }), "button button-quiet"));
    if (room.selfPlayerId === state.hostId && state.phase === "round-result") wrapper.append(actionRow(control("Prossimo round", () => send({ type: "next-round" }), "button button-primary"), control("Termina", () => send({ type: "finish-game" }), "button button-quiet")));
  } else {
    wrapper.append(title("Passa il prompt", state.phase === "reveal" ? "Le catene complete" : `Fase: ${state.phase}`));
    if (state.phase === "prompt") {
      const input = el("input", "inline-text");
      input.placeholder = "Scrivi un prompt da disegnare";
      wrapper.append(actionRow(input, control("Consegna prompt", () => send({ type: "submit-prompt", text: input.value }), "button button-primary", state.submitted.includes(room.selfPlayerId))));
    } else if (state.phase === "drawing" && state.assignment) {
      wrapper.append(el("p", "game-callout", `Disegna: ${state.assignment.source?.content ?? "Prompt"}`));
      wrapper.append(canvasTool(state.assignment.draftStrokes, !state.submitted.includes(room.selfPlayerId), send));
      wrapper.append(control("Consegna disegno", () => send({ type: "submit-drawing" }), "button button-primary", state.submitted.includes(room.selfPlayerId)));
    } else if (state.phase === "caption" && state.assignment) {
      wrapper.append(el("p", "game-callout", "Descrivi il disegno senza vedere il prompt precedente."));
      wrapper.append(canvasTool(state.assignment.source?.strokes ?? [], false, send));
      const input = el("input", "inline-text");
      input.placeholder = "Cosa rappresenta?";
      wrapper.append(actionRow(input, control("Consegna descrizione", () => send({ type: "submit-caption", text: input.value }), "button button-primary", state.submitted.includes(room.selfPlayerId))));
    } else if (state.phase === "reveal" && state.chains) {
      const chains = el("div", "story-chains");
      for (const chain of state.chains) {
        const section = el("section", "story-chain");
        section.append(el("h3", "", `Catena di ${playerName(room, chain.originId)}`));
        for (const page of chain.pages) {
          section.append(el("p", "story-author", playerName(room, page.playerId)));
          section.append(page.type === "text" ? el("blockquote", "", page.content) : canvasTool(page.strokes, false, send));
        }
        chains.append(section);
      }
      wrapper.append(chains);
    }
  }
  stage.replaceChildren(wrapper);
}

export function renderGame(stage, room, send) {
  switch (room.gameId) {
    case "tic-tac-toe": return renderTicTacToe(stage, room, (cell) => send({ type: "place", cell }));
    case "blackjack": return renderBlackjack(stage, room, send);
    case "uno": return renderUno(stage, room, send);
    case "scopa": return renderScopa(stage, room, send);
    case "briscola": return renderBriscola(stage, room, send);
    case "texas-holdem": return renderPoker(stage, room, send);
    case "burraco": return renderBurraco(stage, room, send);
    case "battleship": return renderBattleship(stage, room, send);
    case "chess-checkers": return renderChessCheckers(stage, room, send);
    case "categories": return renderCategories(stage, room, send);
    case "hangman": return renderHangman(stage, room, send);
    case "connect-four": return renderConnectFour(stage, room, send);
    case "draw-and-pass": return renderDrawAndPass(stage, room, send);
    default: return undefined;
  }
}
