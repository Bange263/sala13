import { cardElement, cardRow, coveredCards, chipElement, chipStack } from "./card-media.js";
import {
  actionBar,
  control,
  countdown,
  el,
  gameHeader,
  gameLayout,
  leaderboard,
  metric,
  phaseName,
  playerName,
  resultText,
  statusBanner
} from "./game-ui.js";

const CHESS_PIECES = Object.freeze({
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟"
});

function rootFor(className) {
  return el("div", `game-board game-v2 ${className}`);
}

function tableSurface(className = "") {
  return el("main", `game-table-surface${className ? ` ${className}` : ""}`);
}

function finish(stage, root) {
  stage.replaceChildren(root);
}

function numberInput({ min = 0, max = 1_000_000, step = 1, value = min, className = "table-number-input" } = {}) {
  const input = el("input", className);
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.inputMode = "numeric";
  return input;
}

function textInput(placeholder, maxLength = 80) {
  const input = el("input", "table-text-input");
  input.type = "text";
  input.placeholder = placeholder;
  input.maxLength = maxLength;
  input.autocomplete = "off";
  return input;
}

function teamLabel(room, state, team) {
  const memberIds = state.teams?.[team] ?? [team];
  return memberIds.map((id) => playerName(room, id)).join(" + ");
}

function turnSubtitle(room, state) {
  if (state.phase === "finished") return "Partita conclusa";
  if (!state.currentPlayerId) return phaseName(state.phase);
  return state.currentPlayerId === room.selfPlayerId
    ? "È il tuo turno"
    : `Turno di ${playerName(room, state.currentPlayerId)}`;
}

function resultTone(result) {
  if (["win", "blackjack"].includes(result)) return "success";
  if (result === "lose") return "danger";
  if (result === "push") return "warning";
  return "neutral";
}

function renderBlackjack(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("blackjack-v2");
  const phase = phaseName(state.phase);
  root.append(gameHeader("Blackjack", state.phase === "betting" ? "Scegli la puntata prima della distribuzione" : turnSubtitle(room, state), { eyebrow: "Casinò · banco contro tavolo", badge: phase }));

  const table = tableSurface("blackjack-felt");
  const dealer = el("section", "dealer-rack");
  const dealerHeading = el("div", "zone-heading");
  dealerHeading.append(el("span", "zone-label", "Banco"), el("strong", "zone-score", state.dealer.value === null ? "Carta coperta" : `${state.dealer.value} punti`));
  dealer.append(dealerHeading, cardRow(state.dealer.cards, { label: "Carte del banco", size: "large" }));
  table.append(dealer);

  const seats = el("div", "blackjack-seats");
  for (const player of room.players) {
    const record = state.players[player.id];
    const seat = el("section", "blackjack-seat");
    seat.dataset.active = String(player.id === state.currentPlayerId);
    seat.dataset.self = String(player.id === room.selfPlayerId);
    const heading = el("header", "seat-heading");
    const identity = el("div");
    identity.append(el("strong", "", player.name), el("small", "", player.id === room.selfPlayerId ? "Il tuo posto" : "Giocatore"));
    heading.append(identity, chipStack(record.chips, { compact: true }));
    seat.append(heading);
    if (record.hands.length === 0) {
      seat.append(el("div", "empty-hand-slot", "Puntata non ancora confermata"));
    }
    record.hands.forEach((hand, index) => {
      const handBox = el("div", "blackjack-hand-v2");
      handBox.dataset.active = String(player.id === state.currentPlayerId && index === record.activeHandIndex);
      handBox.dataset.result = hand.result ?? hand.status;
      const summary = el("div", "hand-summary");
      const name = el("span", "hand-name", record.hands.length > 1 ? `Mano ${index + 1}` : "Mano");
      const value = el("strong", "hand-score", `${hand.value} punti`);
      const bet = el("span", "hand-bet", `Puntata ${hand.bet}`);
      summary.append(name, value, bet);
      if (hand.result) summary.append(el("strong", "hand-result", resultText(hand.result)));
      handBox.append(summary, cardRow(hand.cards, { label: `Carte di ${player.name}`, size: "normal" }));
      if (hand.result) {
        const payout = hand.payout > 0 ? `Accredito: ${hand.payout} chip` : "Nessuna vincita";
        handBox.append(statusBanner(resultText(hand.result), payout, resultTone(hand.result)));
      }
      seat.append(handBox);
    });
    seats.append(seat);
  }
  table.append(seats);

  if (state.phase === "betting") {
    const self = state.players[room.selfPlayerId];
    if (self.hands.length === 0) {
      const panel = el("section", "betting-console");
      let amountValue = Math.min(self.chips, state.settings.baseBet);
      const amount = numberInput({ min: 10, max: self.chips, step: 10, value: amountValue });
      const total = el("strong", "bet-total", `${amountValue} chip`);
      const preview = el("div", "bet-preview");
      const refresh = () => {
        amountValue = Math.max(10, Math.min(self.chips, Number(amount.value) || 10));
        amount.value = String(amountValue);
        total.textContent = `${amountValue} chip`;
        preview.replaceChildren(chipStack(amountValue));
      };
      const chipTray = el("div", "chip-tray");
      for (const value of [10, 25, 50, 100, 500]) {
        if (value > self.chips) continue;
        chipTray.append(chipElement(value, { interactive: true, onClick: () => {
          amount.value = String(Math.min(self.chips, Number(amount.value) + value));
          refresh();
        } }));
      }
      amount.addEventListener("input", refresh);
      panel.append(
        el("div", "bet-console-copy", "Scegli quante chip mettere sul tavolo"),
        chipTray,
        el("label", "bet-input-label", "Importo esatto"),
        amount,
        preview,
        total,
        actionBar(
          control("Azzera", async () => { amount.value = "10"; refresh(); }, "button button-quiet"),
          control("Conferma puntata", () => send({ type: "bet", amount: Number(amount.value) }), "button button-primary")
        )
      );
      refresh();
      table.append(panel);
    } else {
      table.append(statusBanner("Puntata confermata", "La distribuzione parte quando tutti hanno puntato.", "success"));
    }
  }

  if (state.phase === "players" && state.currentPlayerId === room.selfPlayerId) {
    const self = state.players[room.selfPlayerId];
    const hand = self.hands[self.activeHandIndex];
    const actions = el("section", "decision-console");
    actions.append(
      el("p", "decision-question", `Hai ${hand.value}. Come vuoi giocare?`),
      actionBar(
        control("Carta", () => send({ type: "hit" }), "button button-primary"),
        control("Resta", () => send({ type: "stand" }), "button button-dark"),
        control("Raddoppia", () => send({ type: "double" }), "button button-quiet", hand.cards.length !== 2 || self.chips < hand.bet),
        control("Dividi", () => send({ type: "split" }), "button button-quiet", hand.cards.length !== 2 || hand.cards[0].rank !== hand.cards[1].rank || self.chips < hand.bet)
      )
    );
    table.append(actions);
  } else if (state.phase === "players") {
    table.append(statusBanner(`Sta giocando ${playerName(room, state.currentPlayerId)}`, "Il banco aspetta che tutti abbiano concluso le proprie mani."));
  }

  const ranking = leaderboard(room, room.players.map((player) => {
    const record = state.players[player.id];
    const totalBet = record.hands.reduce((sum, hand) => sum + hand.bet, 0);
    return {
      id: player.id,
      value: record.chips,
      valueLabel: `${record.chips}`,
      detail: record.hands.length ? `${totalBet} chip sul tavolo` : "Deve puntare",
      active: player.id === state.currentPlayerId,
      state: record.hands.some((hand) => hand.result === "win" || hand.result === "blackjack") ? "winner" : ""
    };
  }), { title: "Chip al tavolo", subtitle: `Mazzo: ${state.deckCount} carte` });
  root.append(gameLayout(table, ranking));
  finish(stage, root);
}

function renderUno(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("uno-v2");
  root.append(gameHeader("Sala13 Colors", state.winnerId ? `${playerName(room, state.winnerId)} ha chiuso la mano` : turnSubtitle(room, state), { eyebrow: "Carte colore · mazzo personalizzato", badge: state.winnerId ? "Vincitore" : state.direction === 1 ? "Senso orario" : "Senso antiorario" }));
  const table = tableSurface("uno-table");
  const center = el("section", "uno-piles");
  const drawPile = el("div", "uno-pile");
  drawPile.append(coveredCards(state.drawCount, { deck: "uno", max: 2, size: "large" }), el("span", "pile-label", `Mazzo · ${state.drawCount}`));
  const discard = el("div", "uno-pile discard-pile");
  discard.append(cardElement(state.topCard, { deck: "uno", size: "large" }), el("span", "pile-label", "Scarti"));
  const color = el("div", "uno-current-color");
  color.dataset.color = state.currentColor;
  color.append(el("span", "color-orbit"), el("strong", "", `Colore: ${state.currentColor}`));
  if (state.pendingDraw) color.append(el("span", "pending-penalty", `Penalità +${state.pendingDraw}`));
  center.append(drawPile, color, discard);
  table.append(center);

  const ownHand = state.hands[room.selfPlayerId];
  if (Array.isArray(ownHand)) {
    let selectedColor = "red";
    const colorPicker = el("div", "uno-color-picker");
    for (const value of ["red", "yellow", "green", "blue"]) {
      const button = el("button", "uno-color-choice");
      button.type = "button";
      button.dataset.color = value;
      button.dataset.selected = String(value === selectedColor);
      button.title = `Scegli ${value}`;
      button.setAttribute("aria-label", `Scegli ${value}`);
      button.addEventListener("click", () => {
        selectedColor = value;
        [...colorPicker.children].forEach((candidate) => { candidate.dataset.selected = String(candidate === button); });
      });
      colorPicker.append(button);
    }
    const unoCall = el("input");
    unoCall.type = "checkbox";
    unoCall.id = "uno-call-toggle";
    const unoToggle = el("label", "uno-call-toggle");
    unoToggle.htmlFor = unoCall.id;
    unoToggle.append(unoCall, el("span", "", "Dichiaro UNO"));
    const handArea = el("section", "own-card-zone");
    handArea.append(el("div", "zone-heading", "La tua mano"));
    handArea.append(cardRow(ownHand, {
      deck: "uno",
      fan: true,
      size: "normal",
      label: "La tua mano Uno",
      onClick: (card) => send({ type: "play", cardId: card.id, color: selectedColor, uno: unoCall.checked })
    }));
    handArea.append(actionBar(
      colorPicker,
      unoToggle,
      control(state.pendingDraw ? `Pesca ${state.pendingDraw} carte` : "Pesca una carta", () => send({ type: "draw" }), "button button-dark", state.currentPlayerId !== room.selfPlayerId)
    ));
    table.append(handArea);
  }
  if (state.currentPlayerId !== room.selfPlayerId && !state.winnerId) table.append(statusBanner(`Attendi ${playerName(room, state.currentPlayerId)}`, "Puoi preparare la carta da giocare, ma il server accetta solo il turno corretto."));

  const ranking = leaderboard(room, room.players.map((player) => {
    const hand = state.hands[player.id];
    const count = Array.isArray(hand) ? hand.length : hand.count;
    return { id: player.id, value: -count, valueLabel: `${count} carte`, detail: player.id === room.selfPlayerId ? "La tua mano" : "Carte coperte", active: player.id === state.currentPlayerId, state: player.id === state.winnerId ? "winner" : "" };
  }), { title: "Carte rimaste", subtitle: state.stacking ? "Accumulo attivo" : "Accumulo disattivato" });
  root.append(gameLayout(table, ranking));
  finish(stage, root);
}

function renderScopa(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("scopa-v2");
  root.append(gameHeader("Scopa", state.phase === "finished" ? "Conteggio finale completato" : turnSubtitle(room, state), { eyebrow: "Carte napoletane", badge: state.phase === "finished" ? "Risultato" : `${state.deckCount} nel mazzo` }));
  const table = tableSurface("italian-card-table scopa-table");
  const selected = new Set();
  const tableZone = el("section", "italian-table-zone");
  const instruction = el("p", "selection-instruction", state.currentPlayerId === room.selfPlayerId ? "1. Seleziona le carte da prendere · 2. Gioca una carta dalla tua mano" : `Sta scegliendo ${playerName(room, state.currentPlayerId)}`);
  const tableCards = cardRow(state.table, {
    deck: "italian",
    size: "large",
    label: "Carte sul tavolo",
    onClick: (card, node) => {
      if (state.currentPlayerId !== room.selfPlayerId) return;
      if (selected.has(card.id)) selected.delete(card.id);
      else selected.add(card.id);
      node.classList.toggle("selected");
      instruction.textContent = selected.size ? `${selected.size} carte selezionate. Ora scegli la carta da giocare.` : "Seleziona una presa oppure gioca senza prendere.";
    }
  });
  tableZone.append(el("div", "zone-heading", "Carte sul tavolo"), instruction, tableCards);
  table.append(tableZone);
  const hand = state.hands[room.selfPlayerId];
  if (Array.isArray(hand)) {
    const handZone = el("section", "own-card-zone italian-hand-zone");
    handZone.append(el("div", "zone-heading", "La tua mano"), cardRow(hand, {
      deck: "italian",
      size: "large",
      fan: true,
      label: "La tua mano di Scopa",
      onClick: (card) => send({ type: "play", cardId: card.id, captureIds: [...selected] })
    }));
    table.append(handZone);
  }
  if (state.scores) {
    const breakdown = el("section", "score-breakdown");
    for (const [team, value] of Object.entries(state.scores)) {
      const row = el("article", "score-breakdown-row");
      row.append(el("strong", "", teamLabel(room, state, team)), metric("Carte", value.carte), metric("Denari", value.denari), metric("Primiera", value.primiera), metric("Scope", value.scope), metric("Totale", value.points, "accent"));
      breakdown.append(row);
    }
    table.append(breakdown);
  }
  const rows = Object.keys(state.teams).map((team) => {
    const result = state.scores?.[team];
    return { id: team, name: teamLabel(room, state, team), value: result?.points ?? state.capturedCounts[team], valueLabel: result ? `${result.points} pt` : `${state.capturedCounts[team]} prese`, detail: `${state.scope[team]} scope${result?.settebello ? " · Settebello" : ""}`, state: state.winnerTeams?.includes(team) ? "winner" : "" };
  });
  root.append(gameLayout(table, leaderboard(room, rows, { title: "Punteggio Scopa", subtitle: "Carte · Denari · Primiera · Settebello" })));
  finish(stage, root);
}

function renderBriscola(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("briscola-v2");
  root.append(gameHeader("Briscola", state.phase === "finished" ? "L'ultima presa è stata conteggiata" : turnSubtitle(room, state), { eyebrow: "Carte napoletane", badge: `${state.deckCount} nel tallone` }));
  const table = tableSurface("italian-card-table briscola-table");
  const trump = el("section", "briscola-trump-zone");
  const deck = coveredCards(state.deckCount, { deck: "italian", max: 3, size: "normal" });
  const trumpCard = cardElement(state.briscolaCard, { deck: "italian", size: "normal", className: "trump-card" });
  trump.append(deck, trumpCard, el("div", "trump-copy", `Seme di briscola\n${state.trumpSuit}`));
  table.append(trump);
  const trick = el("section", "trick-table");
  trick.append(el("div", "zone-heading", "Presa in corso"));
  const spots = el("div", "trick-spots");
  for (const player of room.players) {
    const play = state.trick.find((candidate) => candidate.playerId === player.id);
    const spot = el("div", "trick-spot");
    spot.dataset.active = String(player.id === state.currentPlayerId);
    spot.append(el("strong", "", player.name));
    spot.append(play ? cardElement(play.card, { deck: "italian", size: "large" }) : el("span", "empty-card-outline", "In attesa"));
    spots.append(spot);
  }
  trick.append(spots);
  table.append(trick);
  const hand = state.hands[room.selfPlayerId];
  if (Array.isArray(hand)) {
    const handZone = el("section", "own-card-zone italian-hand-zone");
    handZone.append(el("div", "zone-heading", "La tua mano"), cardRow(hand, { deck: "italian", size: "large", fan: true, label: "La tua mano di Briscola", onClick: (card) => send({ type: "play", cardId: card.id }) }));
    table.append(handZone);
  }
  const rows = Object.keys(state.teams).map((team) => ({ id: team, name: teamLabel(room, state, team), value: state.points[team], valueLabel: `${state.points[team]} pt`, detail: `${state.tricksWon[team]} prese`, state: state.winnerTeams?.includes(team) ? "winner" : "" }));
  root.append(gameLayout(table, leaderboard(room, rows, { title: "Punti Briscola", subtitle: "Servono almeno 61 punti" })));
  finish(stage, root);
}

function renderPoker(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("poker-v2");
  const winnerCopy = state.winnerIds?.length ? `${state.winnerIds.map((id) => playerName(room, id)).join(", ")} vince il piatto` : "Showdown";
  root.append(gameHeader("Texas Hold'em", state.phase === "finished" ? winnerCopy : turnSubtitle(room, state), { eyebrow: `Bui ${state.smallBlind}/${state.bigBlind}`, badge: phaseName(state.phase) }));
  const table = tableSurface("poker-felt");
  const oval = el("section", "poker-oval");
  const pot = el("div", "central-pot");
  pot.append(chipStack(state.pot), el("strong", "", `Piatto ${state.pot}`));
  const community = el("div", "community-cards");
  for (let index = 0; index < 5; index += 1) {
    community.append(state.community[index] ? cardElement(state.community[index], { deck: "french", size: "large" }) : el("span", "empty-card-outline community-slot", ["Flop", "Flop", "Flop", "Turn", "River"][index]));
  }
  oval.append(pot, community);
  const seats = el("div", "poker-seat-ring");
  for (const player of room.players) {
    const record = state.players[player.id];
    const seat = el("article", "poker-seat-v2");
    seat.dataset.active = String(player.id === state.currentPlayerId);
    seat.dataset.folded = String(record.folded);
    seat.dataset.winner = String(state.winnerIds?.includes(player.id));
    const heading = el("header");
    heading.append(el("strong", "", `${player.name}${player.id === state.dealerId ? " · D" : ""}`), el("span", "", `${record.chips} chip`));
    const hole = Array.isArray(record.hole) ? cardRow(record.hole, { deck: "french", size: "small", compact: true, label: `Carte di ${player.name}` }) : coveredCards(record.hole.count, { deck: "french", max: 2, size: "small" });
    const status = record.folded ? "Fold" : record.allIn ? "All-in" : record.streetBet ? `Puntata ${record.streetBet}` : "In gioco";
    seat.append(heading, hole, el("small", "poker-seat-status", status));
    if (state.evaluations?.[player.id]) seat.append(el("strong", "poker-hand-name", state.evaluations[player.id].name));
    seats.append(seat);
  }
  oval.append(seats);
  table.append(oval);
  if (state.currentPlayerId === room.selfPlayerId && state.phase !== "finished") {
    const self = state.players[room.selfPlayerId];
    const toCall = Math.max(0, state.currentBet - self.streetBet);
    const minimum = Math.min(self.streetBet + self.chips, state.currentBet + state.minRaise);
    const maximum = self.streetBet + self.chips;
    const amount = numberInput({ min: Math.max(0, minimum), max: maximum, step: state.bigBlind, value: Math.max(0, minimum) });
    const console = el("section", "poker-action-console");
    console.append(
      statusBanner(toCall > 0 ? `Per restare devi vedere ${toCall}` : "Puoi fare check", `Puntata corrente: ${state.currentBet} · rilancio minimo: ${state.currentBet + state.minRaise}`),
      actionBar(
        control("Fold", () => send({ type: "fold" }), "button button-quiet"),
        control("Check", () => send({ type: "check" }), "button button-dark", toCall > 0),
        control(`Call ${toCall}`, () => send({ type: "call" }), "button button-dark", toCall === 0),
        amount,
        control("Rilancia", () => send({ type: "raise", amount: Number(amount.value) }), "button button-primary", maximum <= state.currentBet),
        control(`All-in ${self.chips}`, () => send({ type: "all-in" }), "button button-quiet", self.chips === 0)
      )
    );
    table.append(console);
  } else if (state.phase !== "finished") {
    table.append(statusBanner(`Decisione di ${playerName(room, state.currentPlayerId)}`, `Piatto attuale: ${state.pot}`));
  }
  if (state.phase === "finished" && state.pots?.length) {
    const pots = el("section", "pot-results");
    state.pots.forEach((entry, index) => pots.append(statusBanner(index === 0 ? "Piatto principale" : `Side pot ${index}`, `${entry.amount} chip a ${entry.winnerIds.map((id) => playerName(room, id)).join(", ")}`, "success")));
    table.append(pots);
  }
  const ranking = leaderboard(room, room.players.map((player) => {
    const record = state.players[player.id];
    return { id: player.id, value: record.chips, valueLabel: `${record.chips}`, detail: record.folded ? "Fold" : record.allIn ? "All-in" : `${record.totalBet} investite`, active: player.id === state.currentPlayerId, state: state.winnerIds?.includes(player.id) ? "winner" : record.folded ? "folded" : "" };
  }), { title: "Chip e posizioni", subtitle: `Piatto totale ${state.pot}` });
  root.append(gameLayout(table, ranking));
  finish(stage, root);
}

function renderBurraco(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("burraco-v2");
  root.append(gameHeader("Burraco", state.phase === "finished" ? "Conteggio finale" : turnSubtitle(room, state), { eyebrow: `La tua squadra: ${teamLabel(room, { teams: { [state.yourTeam]: room.players.filter((player) => (state.order.indexOf(player.id) % 2 === state.order.indexOf(room.selfPlayerId) % 2)).map((player) => player.id) } }, state.yourTeam)}`, badge: phaseName(state.phase) }));
  const table = tableSurface("burraco-table");
  const piles = el("section", "burraco-piles");
  const stock = el("div", "burraco-pile");
  stock.append(coveredCards(state.deckCount, { deck: "french", max: 3 }), el("strong", "", `Tallone · ${state.deckCount}`));
  const discard = el("div", "burraco-pile");
  discard.append(state.discardTop ? cardElement(state.discardTop, { deck: "french", size: "normal" }) : el("span", "empty-card-outline", "Vuoto"), el("strong", "", `Scarti · ${state.discardCount}`));
  const pots = el("div", "burraco-pot-counter");
  pots.append(el("strong", "", String(state.potCount)), el("span", "", "pozzetti disponibili"));
  piles.append(stock, discard, pots);
  table.append(piles);
  const meldArea = el("section", "burraco-meld-area");
  for (const [team, melds] of Object.entries(state.melds)) {
    const teamArea = el("article", "burraco-team-melds");
    teamArea.append(el("h3", "", teamLabel(room, { teams: { [team]: state.order.filter((id) => state.order.length === 4 ? state.order.indexOf(id) % 2 === (team === "team-1" ? 0 : 1) : id === team) } }, team)));
    if (melds.length === 0) teamArea.append(el("p", "empty-meld-copy", "Nessuna combinazione calata"));
    melds.forEach((meld, index) => {
      const item = el("div", "burraco-meld");
      const label = meld.cards.length >= 7 ? `Burraco ${meld.clean ? "pulito" : "sporco"}` : meld.type === "run" ? "Scala" : "Gruppo";
      item.append(el("strong", "", `${index + 1}. ${label}`), cardRow(meld.cards, { deck: "french", size: "small", compact: true }));
      item.dataset.index = String(index);
      teamArea.append(item);
    });
    meldArea.append(teamArea);
  }
  table.append(meldArea);
  const hand = state.hands[room.selfPlayerId];
  if (Array.isArray(hand)) {
    const selected = new Set();
    const selectionCopy = el("p", "selection-instruction", state.phase === "draw" ? "Prima pesca dal tallone o raccogli gli scarti." : "Seleziona le carte da calare o una sola carta da scartare.");
    const handRow = cardRow(hand, { deck: "french", fan: true, size: "normal", label: "La tua mano di Burraco", onClick: (card, node) => {
      if (selected.has(card.id)) selected.delete(card.id);
      else selected.add(card.id);
      node.classList.toggle("selected");
      selectionCopy.textContent = `${selected.size} ${selected.size === 1 ? "carta selezionata" : "carte selezionate"}`;
    } });
    const myTurn = state.currentPlayerId === room.selfPlayerId;
    const meldSelect = el("select", "table-select");
    state.melds[state.yourTeam].forEach((meld, index) => {
      const option = el("option", "", `${index + 1}. ${meld.type === "run" ? "Scala" : "Gruppo"}`);
      option.value = String(index);
      meldSelect.append(option);
    });
    const handZone = el("section", "own-card-zone burraco-hand-zone");
    handZone.append(el("div", "zone-heading", "La tua mano"), selectionCopy, handRow, actionBar(
      control("Pesca dal tallone", () => send({ type: "draw", source: "deck" }), "button button-dark", !myTurn || state.phase !== "draw" || state.deckCount === 0),
      control("Raccogli tutti gli scarti", () => send({ type: "draw", source: "discard" }), "button button-quiet", !myTurn || state.phase !== "draw" || state.discardCount === 0),
      control("Cala combinazione", () => send({ type: "meld", cardIds: [...selected] }), "button button-primary", !myTurn || state.phase !== "meld"),
      meldSelect,
      control("Aggiungi", () => send({ type: "add-to-meld", cardIds: [...selected], meldIndex: Number(meldSelect.value) }), "button button-quiet", !myTurn || state.phase !== "meld" || state.melds[state.yourTeam].length === 0),
      control("Scarta", () => send({ type: "discard", cardId: [...selected][0] }), "button button-quiet", !myTurn || state.phase !== "meld")
    ));
    table.append(handZone);
  }
  if (state.scores) {
    const result = el("section", "pot-results");
    for (const [team, score] of Object.entries(state.scores)) result.append(statusBanner(teamLabel(room, { teams: { [team]: state.order.filter((id) => state.order.length === 4 ? state.order.indexOf(id) % 2 === (team === "team-1" ? 0 : 1) : id === team) } }, team), `${score} punti`, team === state.winnerTeam ? "success" : "neutral"));
    table.append(result);
  }
  const rows = room.players.map((player) => {
    const cards = state.hands[player.id];
    const count = Array.isArray(cards) ? cards.length : cards.count;
    const team = state.order.length === 4 ? (state.order.indexOf(player.id) % 2 === 0 ? "team-1" : "team-2") : player.id;
    return { id: player.id, value: -count, valueLabel: `${count} carte`, detail: `${team === state.yourTeam ? "La tua squadra" : "Avversari"}${state.tookPot[team] ? " · pozzetto preso" : ""}`, active: player.id === state.currentPlayerId, state: team === state.winnerTeam ? "winner" : "" };
  });
  root.append(gameLayout(table, leaderboard(room, rows, { title: "Situazione mani", subtitle: "Chiude chi ha pozzetto e burraco" })));
  finish(stage, root);
}

function gridCellLabel(index) {
  return `${String.fromCharCode(65 + (index % 10))}${Math.floor(index / 10) + 1}`;
}

function renderSeaGrid({ shots = {}, ships = [], incomingShots = {} }, onFire = null) {
  const shell = el("div", "sea-grid-v2");
  shell.append(el("span", "sea-axis corner"));
  for (let column = 0; column < 10; column += 1) shell.append(el("span", "sea-axis", String.fromCharCode(65 + column)));
  const shipCells = new Set((ships ?? []).flatMap((ship) => ship.cells));
  for (let row = 0; row < 10; row += 1) {
    shell.append(el("span", "sea-axis", String(row + 1)));
    for (let column = 0; column < 10; column += 1) {
      const cell = row * 10 + column;
      const result = shots[cell] ?? incomingShots[cell] ?? "";
      const button = el("button", "sea-cell-v2");
      button.type = "button";
      button.title = gridCellLabel(cell);
      button.dataset.result = result;
      button.dataset.ship = String(shipCells.has(cell));
      button.disabled = !onFire || Boolean(result);
      button.setAttribute("aria-label", `${gridCellLabel(cell)}${result ? `: ${result}` : ""}`);
      if (onFire) button.addEventListener("click", () => onFire(cell));
      shell.append(button);
    }
  }
  return shell;
}

function renderBattleship(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("battleship-v2");
  const subtitle = state.phase === "placement" ? "Le flotte restano segrete sul server" : state.phase === "finished" ? `${playerName(room, state.winnerId)} ha affondato la flotta` : turnSubtitle(room, state);
  root.append(gameHeader("Battaglia Navale", subtitle, { eyebrow: "Due griglie · informazioni segrete", badge: phaseName(state.phase) }));
  const table = tableSurface("naval-command-table");
  if (state.phase === "placement" && !state.placed[room.selfPlayerId]) {
    const placementPanel = el("section", "fleet-placement-console");
    let placement = [];
    let orientationValue = "horizontal";
    const renderPlacement = () => {
      const currentShip = state.fleet[placement.length];
      const orientation = el("div", "orientation-switch");
      for (const [value, label] of [["horizontal", "Orizzontale"], ["vertical", "Verticale"]]) {
        const button = control(label, async () => { orientationValue = value; renderPlacement(); }, "button button-quiet");
        button.dataset.selected = String(orientationValue === value);
        orientation.append(button);
      }
      const occupied = new Set(placement.flatMap((ship) => ship.cells));
      const grid = renderSeaGrid({ ships: placement }, currentShip ? (cell) => {
        const row = Math.floor(cell / 10);
        const column = cell % 10;
        const cells = Array.from({ length: currentShip.size }, (_, offset) => orientationValue === "horizontal" ? row * 10 + column + offset : (row + offset) * 10 + column);
        const valid = cells.every((candidate) => candidate >= 0 && candidate < 100 && !occupied.has(candidate)) && (orientationValue === "vertical" || cells.every((candidate) => Math.floor(candidate / 10) === row));
        if (!valid) return;
        placement.push({ id: currentShip.id, cells });
        renderPlacement();
      } : null);
      const copy = currentShip ? `Piazza ${currentShip.id} (${currentShip.size} caselle) scegliendo la casella iniziale.` : "Flotta completa. Controlla la griglia e conferma.";
      placementPanel.replaceChildren(statusBanner(currentShip ? `Nave ${placement.length + 1} di ${state.fleet.length}` : "Flotta pronta", copy, currentShip ? "neutral" : "success"), orientation, grid, actionBar(
        control("Ricomincia", async () => { placement = []; renderPlacement(); }, "button button-quiet", placement.length === 0),
        control("Conferma flotta", () => send({ type: "place", ships: placement }), "button button-primary", Boolean(currentShip)),
        control("Piazzamento automatico", () => send({ type: "auto-place" }), "button button-dark")
      ));
    };
    renderPlacement();
    table.append(placementPanel);
  } else if (state.phase === "placement") {
    table.append(statusBanner("Flotta confermata", "L'avversario deve ancora completare il piazzamento.", "success"));
  }
  const grids = el("div", "naval-grids");
  const own = el("section", "naval-grid-panel");
  own.append(el("header", "zone-heading", "La tua flotta"), state.ownBoard ? renderSeaGrid(state.ownBoard) : el("div", "empty-board", "Flotta non piazzata"));
  const target = el("section", "naval-grid-panel target-grid");
  const canFire = state.phase === "battle" && state.currentPlayerId === room.selfPlayerId;
  target.append(el("header", "zone-heading", canFire ? "Scegli dove sparare" : "Acque avversarie"), renderSeaGrid(state.targetBoard, canFire ? (cell) => send({ type: "fire", cell }) : null));
  grids.append(own, target);
  table.append(grids);
  if (state.lastShot) table.append(statusBanner(state.lastShot.result === "miss" ? "Acqua" : state.lastShot.result === "hit" ? "Colpito" : "Nave affondata", `${playerName(room, state.lastShot.playerId)} ha sparato in ${gridCellLabel(state.lastShot.cell)}`, state.lastShot.result === "miss" ? "neutral" : "danger"));
  const ownHits = Object.values(state.targetBoard.shots ?? {}).filter((value) => value === "hit" || value === "sunk").length;
  const enemyHits = Object.values(state.ownBoard?.incomingShots ?? {}).filter((value) => value === "hit" || value === "sunk").length;
  const rows = room.players.map((player) => ({ id: player.id, value: player.id === room.selfPlayerId ? ownHits : enemyHits, valueLabel: `${player.id === room.selfPlayerId ? ownHits : enemyHits} colpi`, detail: state.placed[player.id] ? "Flotta pronta" : "Sta piazzando", active: player.id === state.currentPlayerId, state: player.id === state.winnerId ? "winner" : "" }));
  root.append(gameLayout(table, leaderboard(room, rows, { title: "Rapporto di battaglia", subtitle: "Colpi a segno conosciuti", sort: false })));
  finish(stage, root);
}

function renderChessCheckers(stage, room, send) {
  const state = room.gameState;
  const checkers = state.variant === "checkers";
  const root = rootFor(checkers ? "checkers-v2" : "chess-v2");
  const name = checkers ? "Dama" : "Scacchi";
  const subtitle = state.result ? `Risultato: ${state.result}` : `${state.inCheck ? "Scacco · " : ""}${turnSubtitle(room, state)}`;
  root.append(gameHeader(name, subtitle, { eyebrow: "Scacchiera con mosse validate dal server", badge: state.yourColor === "w" ? "Giochi chiaro" : "Giochi scuro" }));
  const table = tableSurface("board-table");
  const board = el("div", "chess-board-v2");
  let selected = null;
  const order = state.yourColor === "b" ? Array.from({ length: 64 }, (_, index) => 63 - index) : Array.from({ length: 64 }, (_, index) => index);
  const buttons = new Map();
  for (const index of order) {
    const row = Math.floor(index / 8);
    const column = index % 8;
    const piece = state.board[index];
    const square = el("button", "board-square-v2");
    square.type = "button";
    square.dataset.dark = String((row + column) % 2 === 1);
    square.dataset.color = piece?.[0] ?? "";
    square.title = `${String.fromCharCode(97 + column)}${8 - row}`;
    square.disabled = Boolean(state.result) || state.currentPlayerId !== room.selfPlayerId;
    const coordinate = el("span", "square-coordinate", square.title);
    const visual = el("span", checkers ? "checker-piece" : "chess-piece");
    if (checkers && piece) {
      visual.dataset.king = String(piece.endsWith("K"));
      visual.dataset.color = piece[0];
    } else {
      visual.textContent = CHESS_PIECES[piece] ?? "";
    }
    square.append(coordinate, visual);
    square.addEventListener("click", () => {
      if (selected === null) {
        if (piece?.[0] !== state.yourColor) return;
        selected = index;
        square.classList.add("selected");
        board.dataset.selecting = "true";
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
  table.append(board);
  if (!state.result) table.append(statusBanner(state.currentPlayerId === room.selfPlayerId ? "Seleziona un pezzo, poi la destinazione" : `Attendi la mossa di ${playerName(room, state.currentPlayerId)}`, checkers ? "Le prese obbligatorie e i salti multipli vengono controllati dal server." : "Scacco, arrocco, en passant e promozione vengono controllati dal server."));
  const colorNames = ["Bianchi", "Neri"];
  const rows = state.order.map((id, index) => ({ id, value: 0, valueLabel: colorNames[index], detail: id === room.selfPlayerId ? "Tu" : "Avversario", active: id === state.currentPlayerId, state: state.result && state.result.includes(index === 0 ? "white" : "black") ? "winner" : "" }));
  root.append(gameLayout(table, leaderboard(room, rows, { title: "Giocatori", subtitle: checkers ? "Pedine chiare e scure" : "Bianchi e neri", sort: false })));
  finish(stage, root);
}

function renderTicTacToe(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("tic-v2");
  const subtitle = state.winnerId ? `${playerName(room, state.winnerId)} ha completato la linea` : state.draw ? "La griglia è completa: pareggio" : turnSubtitle(room, state);
  root.append(gameHeader("Tris", subtitle, { eyebrow: "Tre simboli in linea", badge: `Sei ${state.yourMark}` }));
  const table = tableSurface("tic-table-v2");
  const board = el("div", "tic-board-v2");
  state.board.forEach((value, cell) => {
    const button = el("button", "tic-cell-v2", value ?? "");
    button.type = "button";
    button.disabled = Boolean(value) || state.currentPlayerId !== room.selfPlayerId || Boolean(state.winnerId || state.draw);
    button.dataset.winning = String(state.winningLine?.includes(cell) ?? false);
    button.setAttribute("aria-label", value ? `Casella ${cell + 1}: ${value}` : `Casella ${cell + 1}: vuota`);
    button.addEventListener("click", () => send({ type: "place", cell }));
    board.append(button);
  });
  table.append(board, statusBanner(state.winnerId ? (state.winnerId === room.selfPlayerId ? "Hai vinto" : "Partita persa") : state.draw ? "Pareggio" : state.currentPlayerId === room.selfPlayerId ? "Tocca a te" : "Attendi l'avversario", state.winnerId || state.draw ? "La linea vincente resta evidenziata." : "Scegli una casella libera.", state.winnerId === room.selfPlayerId ? "success" : "neutral"));
  const rows = room.players.map((player) => ({ id: player.id, value: 0, valueLabel: state.marks[player.id], detail: player.id === room.selfPlayerId ? "Tu" : "Avversario", active: player.id === state.currentPlayerId, state: player.id === state.winnerId ? "winner" : "" }));
  root.append(gameLayout(table, leaderboard(room, rows, { title: "Tabellone", subtitle: "X inizia la partita", sort: false })));
  finish(stage, root);
}

function renderCategories(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("categories-v2");
  root.append(gameHeader("Nomi, Cose, Città", `Round ${state.round} · ${phaseName(state.phase)}`, { eyebrow: "Parole e votazione condivisa", badge: `Lettera ${state.letter}` }));
  const table = tableSurface("categories-table-v2");
  const letterPanel = el("section", "letter-panel");
  letterPanel.append(el("strong", "spinner-letter", state.letter), el("div", "letter-copy", "Ogni risposta deve iniziare con questa lettera"));
  if (state.phase === "answering") letterPanel.append(countdown(state.deadline));
  table.append(letterPanel);
  if (state.phase === "answering") {
    const form = el("form", "category-sheet");
    const inputs = {};
    for (const category of state.categories) {
      const label = el("label", "category-field");
      label.append(el("span", "", category));
      const input = textInput(`${state.letter}…`, 80);
      input.disabled = state.submitted.includes(room.selfPlayerId);
      inputs[category] = input;
      label.append(input);
      form.append(label);
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await send({ type: "submit", answers: Object.fromEntries(state.categories.map((category) => [category, inputs[category].value])) });
    });
    form.append(actionBar(control(state.submitted.includes(room.selfPlayerId) ? "Risposte consegnate" : "Consegna risposte", () => form.requestSubmit(), "button button-primary", state.submitted.includes(room.selfPlayerId)), room.selfPlayerId === state.hostId ? control("Chiudi consegne", () => send({ type: "close-answers" }), "button button-quiet") : null));
    table.append(form);
  } else {
    const review = el("section", "answer-review-v2");
    for (const player of room.players) {
      const sheet = el("article", "answer-sheet");
      sheet.append(el("h3", "", player.name));
      for (const category of state.categories) {
        const answer = state.answers[player.id]?.[category] || "—";
        const key = `${player.id}:${category}`;
        const row = el("div", "answer-row-v2");
        row.dataset.valid = state.validity ? String(Boolean(state.validity[key])) : "pending";
        row.append(el("span", "answer-category", category), el("strong", "answer-value", answer));
        if (state.phase === "review" && player.id !== room.selfPlayerId) row.append(actionBar(control("Valida", () => send({ type: "vote", targetPlayerId: player.id, category, valid: true }), "mini-review-button accept"), control("Rifiuta", () => send({ type: "vote", targetPlayerId: player.id, category, valid: false }), "mini-review-button reject")));
        if (state.validity) row.append(el("span", "answer-verdict", state.validity[key] ? "Valida" : "Non valida"));
        sheet.append(row);
      }
      review.append(sheet);
    }
    table.append(review);
    if (room.selfPlayerId === state.hostId && state.phase === "review") table.append(actionBar(control("Calcola il round", () => send({ type: "score-round" }), "button button-primary"), control("Termina partita", () => send({ type: "finish-game" }), "button button-quiet")));
    if (room.selfPlayerId === state.hostId && state.phase === "round-result") table.append(actionBar(control("Prossimo round", () => send({ type: "next-round" }), "button button-primary"), control("Termina partita", () => send({ type: "finish-game" }), "button button-quiet")));
  }
  const ranking = leaderboard(room, room.players.map((player) => ({ id: player.id, value: state.scores[player.id], valueLabel: `${state.scores[player.id]} pt`, detail: state.roundScores ? `${state.roundScores[player.id] >= 0 ? "+" : ""}${state.roundScores[player.id]} nel round` : state.submitted.includes(player.id) ? "Consegnato" : "Sta scrivendo", state: state.winnerIds?.includes(player.id) ? "winner" : "" })), { title: "Classifica", subtitle: `Round ${state.round}` });
  root.append(gameLayout(table, ranking));
  finish(stage, root);
}

function hangmanDrawing(errors) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 300 300");
  svg.setAttribute("class", "hangman-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Impiccato con ${errors} errori`);
  const shapes = [
    ["line", { x1: 30, y1: 278, x2: 170, y2: 278 }],
    ["line", { x1: 70, y1: 278, x2: 70, y2: 28 }],
    ["line", { x1: 67, y1: 31, x2: 218, y2: 31 }],
    ["line", { x1: 214, y1: 28, x2: 214, y2: 65 }],
    ["circle", { cx: 214, cy: 91, r: 26 }],
    ["line", { x1: 214, y1: 117, x2: 214, y2: 202 }],
    ["path", { d: "M214 137 171 171 M214 137 257 171" }],
    ["path", { d: "M214 202 176 256 M214 202 252 256" }]
  ];
  shapes.forEach(([tag, attributes], index) => {
    const shape = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([name, value]) => shape.setAttribute(name, String(value)));
    shape.setAttribute("class", index < errors ? "visible" : "pending");
    svg.append(shape);
  });
  return svg;
}

function renderHangman(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("hangman-v2");
  root.append(gameHeader("L'Impiccato", state.phase === "finished" ? (state.teamWon ? "La parola è stata indovinata" : "Tentativi terminati") : turnSubtitle(room, state), { eyebrow: "Parola condivisa · turni alternati", badge: `${state.errors}/${state.maxErrors} errori` }));
  const table = tableSurface("hangman-table-v2");
  const puzzle = el("section", "hangman-puzzle");
  puzzle.append(hangmanDrawing(state.errors), el("div", "masked-word-v2", state.maskedWord));
  const wrong = el("div", "wrong-letter-rack");
  wrong.append(el("span", "", "Lettere errate"));
  for (const letter of state.wrongLetters) wrong.append(el("strong", "", letter.toUpperCase()));
  if (state.wrongLetters.length === 0) wrong.append(el("em", "", "Nessuna"));
  puzzle.append(wrong);
  table.append(puzzle);
  if (state.solution) table.append(statusBanner("Soluzione", state.solution, state.teamWon ? "success" : "danger"));
  if (state.currentPlayerId === room.selfPlayerId) {
    const controls = el("section", "hangman-controls");
    const keyboard = el("div", "letter-keyboard");
    const used = new Set([...state.guessedLetters, ...state.wrongLetters]);
    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") keyboard.append(control(letter, () => send({ type: "guess-letter", letter }), "letter-key", used.has(letter.toLowerCase())));
    const word = textInput("Prova la parola completa", 40);
    const form = el("form", "word-guess-form");
    form.addEventListener("submit", (event) => { event.preventDefault(); send({ type: "guess-word", word: word.value }); });
    form.append(word, control("Prova parola", () => form.requestSubmit(), "button button-primary"));
    controls.append(el("h3", "", "Scegli una lettera"), keyboard, form);
    table.append(controls);
  }
  if (state.attempts.length) {
    const history = el("section", "guess-history");
    history.append(el("h3", "", "Parole tentate"));
    state.attempts.slice(-6).reverse().forEach((attempt) => history.append(el("p", "", `${playerName(room, attempt.playerId)}: ${attempt.word}`)));
    table.append(history);
  }
  const rows = state.order.map((id, index) => ({ id, value: 0, valueLabel: String(index + 1).padStart(2, "0"), detail: id === state.winnerId ? "Ha indovinato" : id === state.currentPlayerId ? "Sta giocando" : "In attesa", active: id === state.currentPlayerId, state: id === state.winnerId ? "winner" : "" }));
  root.append(gameLayout(table, leaderboard(room, rows, { title: "Ordine dei turni", subtitle: `${state.guessedLetters.length} lettere trovate`, sort: false })));
  finish(stage, root);
}

function renderConnectFour(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("connect-v2");
  const subtitle = state.winnerId ? `${playerName(room, state.winnerId)} ha fatto quattro` : state.draw ? "Griglia piena: pareggio" : turnSubtitle(room, state);
  root.append(gameHeader("Forza Quattro", subtitle, { eyebrow: "Sette colonne · sei righe", badge: state.winnerId ? "Vittoria" : state.draw ? "Pareggio" : "In gioco" }));
  const table = tableSurface("connect-table-v2");
  const boardShell = el("section", "connect-board-shell");
  const dropRow = el("div", "connect-drop-row-v2");
  for (let column = 0; column < state.columns; column += 1) dropRow.append(control(String(column + 1), () => send({ type: "drop", column }), "connect-drop-button", state.currentPlayerId !== room.selfPlayerId || Boolean(state.board[column])));
  const board = el("div", "connect-grid-v2");
  state.board.forEach((mark, index) => {
    const slot = el("span", "connect-slot-v2");
    slot.dataset.mark = mark ?? "";
    slot.dataset.winning = String(state.winningLine?.includes(index) ?? false);
    slot.append(el("span", "connect-disc"));
    board.append(slot);
  });
  boardShell.append(dropRow, board);
  table.append(boardShell, statusBanner(state.currentPlayerId === room.selfPlayerId ? "Scegli una colonna" : `Attendi ${playerName(room, state.currentPlayerId)}`, "I gettoni cadono sempre nella prima posizione libera."));
  const rows = state.order.map((id, index) => ({ id, value: 0, valueLabel: index === 0 ? "Rosso" : "Ocra", detail: id === room.selfPlayerId ? "Tu" : "Avversario", active: id === state.currentPlayerId, state: id === state.winnerId ? "winner" : "" }));
  root.append(gameLayout(table, leaderboard(room, rows, { title: "Giocatori", subtitle: "Primo a quattro", sort: false })));
  finish(stage, root);
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
  const shell = el("section", "canvas-studio");
  const toolbar = el("div", "canvas-toolbar-v2");
  let activeColor = "#202722";
  let erasing = false;
  let brushSize = 7;
  const swatches = el("div", "color-swatches");
  for (const value of ["#202722", "#c94435", "#d5a928", "#2f7656", "#356c91", "#8b5a3c", "#f4efe4"]) {
    const swatch = el("button", "color-swatch");
    swatch.type = "button";
    swatch.style.setProperty("--swatch", value);
    swatch.dataset.selected = String(value === activeColor);
    swatch.setAttribute("aria-label", `Colore ${value}`);
    swatch.addEventListener("click", () => {
      activeColor = value;
      erasing = false;
      [...swatches.children].forEach((candidate) => { candidate.dataset.selected = String(candidate === swatch); });
      eraser.dataset.selected = "false";
    });
    swatches.append(swatch);
  }
  const sizes = el("div", "brush-sizes");
  for (const value of [3, 7, 14, 26]) {
    const button = el("button", "brush-size");
    button.type = "button";
    button.dataset.selected = String(value === brushSize);
    button.setAttribute("aria-label", `Pennello ${value}`);
    const dot = el("span");
    dot.style.width = `${Math.max(4, value)}px`;
    dot.style.height = `${Math.max(4, value)}px`;
    button.append(dot);
    button.addEventListener("click", () => {
      brushSize = value;
      [...sizes.children].forEach((candidate) => { candidate.dataset.selected = String(candidate === button); });
    });
    sizes.append(button);
  }
  const eraser = el("button", "canvas-tool-button", "Gomma");
  eraser.type = "button";
  eraser.addEventListener("click", () => { erasing = !erasing; eraser.dataset.selected = String(erasing); });
  toolbar.append(swatches, sizes, eraser);
  if (enabled) toolbar.append(control("Annulla tratto", () => send({ type: "undo" }), "canvas-tool-button", !strokes?.length), control("Pulisci tutto", () => send({ type: "clear" }), "canvas-tool-button danger", !strokes?.length));
  const canvas = el("canvas", "drawing-canvas-v2");
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
      paintStroke(context, { tool: erasing ? "eraser" : "brush", color: activeColor, size: brushSize, points: [points.at(-1), nextPoint] }, canvas.width, canvas.height);
      points.push(nextPoint);
    });
    const finishStroke = async () => {
      if (!points) return;
      if (points.length === 1) points.push({ ...points[0], x: Math.min(1, points[0].x + 0.001) });
      const stroke = { id: crypto.randomUUID(), tool: erasing ? "eraser" : "brush", color: activeColor, size: brushSize, points };
      points = null;
      await send({ type: "stroke", stroke });
    };
    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", () => { points = null; });
  }
  shell.append(toolbar, canvas);
  return shell;
}

function renderDrawAndPass(stage, room, send) {
  const state = room.gameState;
  const root = rootFor("draw-v2");
  if (state.mode === "draw") {
    const subtitle = state.phase === "drawing" ? `${playerName(room, state.drawerId)} sta disegnando` : state.phase === "finished" ? "Partita conclusa" : `Round ${state.round} concluso`;
    root.append(gameHeader("Disegna e indovina", subtitle, { eyebrow: "Canvas condivisa", badge: `Round ${state.round}` }));
    const table = tableSurface("drawing-table-v2");
    const prompt = el("section", "drawing-prompt-bar");
    prompt.append(el("span", "", state.prompt ? "Devi disegnare" : "Prompt segreto"), el("strong", "", state.prompt ?? "Guarda il disegno e prova a indovinare"));
    if (state.phase === "drawing") prompt.append(countdown(state.deadline));
    table.append(prompt, canvasTool(state.strokes, room.selfPlayerId === state.drawerId && state.phase === "drawing", send));
    if (room.selfPlayerId !== state.drawerId && state.phase === "drawing") {
      const guess = textInput("Scrivi cosa rappresenta il disegno", 80);
      const form = el("form", "drawing-guess-form");
      form.addEventListener("submit", (event) => { event.preventDefault(); if (guess.value.trim()) { send({ type: "guess", text: guess.value }); guess.value = ""; } });
      form.append(guess, control("Invia risposta", () => form.requestSubmit(), "button button-primary"));
      table.append(form);
    }
    const messages = el("section", "drawing-chat");
    messages.append(el("h3", "", "Tentativi"));
    if (state.guesses.length === 0) messages.append(el("p", "empty-chat", "Nessun tentativo ancora."));
    for (const guess of state.guesses.slice(-12)) {
      const item = el("p", "drawing-message");
      item.dataset.match = guess.match ?? (guess.correct ? "exact" : "wrong");
      item.dataset.system = String(Boolean(guess.system));
      item.append(el("strong", "", guess.system ? "Sistema" : playerName(room, guess.playerId)), el("span", "", guess.text));
      messages.append(item);
    }
    table.append(messages);
    if (room.selfPlayerId === state.drawerId && state.phase === "drawing") table.append(control("Chiudi il round", () => send({ type: "end-round" }), "button button-quiet"));
    if (room.selfPlayerId === state.hostId && state.phase === "round-result") table.append(actionBar(control("Prossimo round", () => send({ type: "next-round" }), "button button-primary"), control("Termina partita", () => send({ type: "finish-game" }), "button button-quiet")));
    const ranking = leaderboard(room, room.players.map((player) => ({ id: player.id, value: state.scores[player.id], valueLabel: `${state.scores[player.id]} pt`, detail: player.id === state.drawerId ? "Disegnatore" : player.id === state.winnerId ? "Ha indovinato" : "Giocatore", active: player.id === state.drawerId, state: state.winnerIds?.includes(player.id) || player.id === state.winnerId ? "winner" : "" })), { title: "Classifica", subtitle: "100 risposta · 50 disegnatore" });
    root.append(gameLayout(table, ranking));
  } else {
    root.append(gameHeader("Passa il prompt", state.phase === "reveal" ? "Le catene sono complete" : `Fase ${phaseName(state.phase)}`, { eyebrow: "Telefono senza fili", badge: `Passaggio ${state.step + 1}` }));
    const table = tableSurface("pass-table-v2");
    if (state.phase === "prompt") {
      const input = textInput("Scrivi qualcosa di divertente da disegnare", 100);
      const form = el("form", "prompt-submit-form");
      form.addEventListener("submit", (event) => { event.preventDefault(); send({ type: "submit-prompt", text: input.value }); });
      form.append(statusBanner("Crea il primo prompt", "Gli altri giocatori non lo vedranno direttamente."), input, control("Consegna prompt", () => form.requestSubmit(), "button button-primary", state.submitted.includes(room.selfPlayerId)));
      table.append(form);
    } else if (state.phase === "drawing" && state.assignment) {
      table.append(statusBanner("Disegna questo prompt", state.assignment.source?.content ?? "Prompt", "warning"), canvasTool(state.assignment.draftStrokes, !state.submitted.includes(room.selfPlayerId), send), control("Consegna disegno", () => send({ type: "submit-drawing" }), "button button-primary", state.submitted.includes(room.selfPlayerId)));
    } else if (state.phase === "caption" && state.assignment) {
      const input = textInput("Cosa rappresenta questo disegno?", 100);
      const form = el("form", "prompt-submit-form");
      form.addEventListener("submit", (event) => { event.preventDefault(); send({ type: "submit-caption", text: input.value }); });
      form.append(statusBanner("Descrivi senza vedere il prompt originale", "La tua frase verrà passata al prossimo giocatore."), canvasTool(state.assignment.source?.strokes ?? [], false, send), input, control("Consegna descrizione", () => form.requestSubmit(), "button button-primary", state.submitted.includes(room.selfPlayerId)));
      table.append(form);
    } else if (state.phase === "reveal" && state.chains) {
      const chains = el("div", "story-chains-v2");
      for (const chain of state.chains) {
        const section = el("section", "story-chain-v2");
        section.append(el("h3", "", `Catena di ${playerName(room, chain.originId)}`));
        chain.pages.forEach((page, index) => {
          const pageNode = el("article", "story-page-v2");
          pageNode.append(el("span", "story-step", String(index + 1).padStart(2, "0")), el("strong", "story-author", playerName(room, page.playerId)));
          pageNode.append(page.type === "text" ? el("blockquote", "", page.content) : canvasTool(page.strokes, false, send));
          section.append(pageNode);
        });
        chains.append(section);
      }
      table.append(chains);
    } else {
      table.append(statusBanner("Consegna completata", "Attendi che tutti terminino questa fase.", "success"));
    }
    const ranking = leaderboard(room, room.players.map((player, index) => ({ id: player.id, value: 0, valueLabel: state.submitted.includes(player.id) ? "Fatto" : "Attesa", detail: `Posizione ${index + 1}`, state: state.submitted.includes(player.id) ? "ready" : "" })), { title: "Avanzamento", subtitle: `${state.submitted.length}/${state.order.length} consegne`, sort: false });
    root.append(gameLayout(table, ranking));
  }
  finish(stage, root);
}

export function renderGame(stage, room, send) {
  switch (room.gameId) {
    case "blackjack": return renderBlackjack(stage, room, send);
    case "uno": return renderUno(stage, room, send);
    case "scopa": return renderScopa(stage, room, send);
    case "briscola": return renderBriscola(stage, room, send);
    case "texas-holdem": return renderPoker(stage, room, send);
    case "burraco": return renderBurraco(stage, room, send);
    case "battleship": return renderBattleship(stage, room, send);
    case "chess-checkers": return renderChessCheckers(stage, room, send);
    case "tic-tac-toe": return renderTicTacToe(stage, room, send);
    case "categories": return renderCategories(stage, room, send);
    case "hangman": return renderHangman(stage, room, send);
    case "connect-four": return renderConnectFour(stage, room, send);
    case "draw-and-pass": return renderDrawAndPass(stage, room, send);
    default: return undefined;
  }
}
