export function el(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") element.textContent = text;
  return element;
}

export function playerName(room, id) {
  return room.players.find((player) => player.id === id)?.name ?? "Giocatore";
}

export function gameHeader(name, subtitle, { eyebrow = "Partita in corso", badge = "" } = {}) {
  const header = el("header", "game-v2-header");
  const copy = el("div");
  copy.append(el("p", "game-v2-eyebrow", eyebrow), el("h2", "", name));
  if (subtitle) copy.append(el("p", "game-v2-subtitle", subtitle));
  header.append(copy);
  if (badge) header.append(el("strong", "phase-badge", badge));
  return header;
}

export function control(label, action, className = "button button-dark", disabled = false) {
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

export function actionBar(...children) {
  const bar = el("div", "table-action-bar");
  bar.append(...children.filter(Boolean));
  return bar;
}

export function metric(label, value, className = "") {
  const item = el("div", `table-metric${className ? ` ${className}` : ""}`);
  item.append(el("span", "", label), el("strong", "", String(value)));
  return item;
}

export function statusBanner(title, description = "", tone = "neutral") {
  const banner = el("section", "table-status");
  banner.dataset.tone = tone;
  banner.append(el("strong", "", title));
  if (description) banner.append(el("span", "", description));
  return banner;
}

export function leaderboard(room, rows, {
  title = "Classifica",
  subtitle = "Aggiornamento in tempo reale",
  sort = true
} = {}) {
  const aside = el("aside", "game-leaderboard");
  const heading = el("header", "leaderboard-heading");
  heading.append(el("h3", "", title), el("p", "", subtitle));
  aside.append(heading);
  const list = el("ol", "leaderboard-list");
  const normalized = rows.map((row, index) => ({
    id: row.id ?? `row-${index}`,
    name: row.name ?? playerName(room, row.id),
    value: row.value ?? 0,
    valueLabel: row.valueLabel ?? String(row.value ?? 0),
    detail: row.detail ?? "",
    active: Boolean(row.active),
    state: row.state ?? "",
    order: index
  }));
  if (sort) normalized.sort((left, right) => Number(right.value) - Number(left.value) || left.order - right.order);
  normalized.forEach((row, index) => {
    const item = el("li", "leaderboard-row");
    item.dataset.active = String(row.active);
    item.dataset.state = row.state;
    const position = el("span", "leaderboard-position", String(index + 1).padStart(2, "0"));
    const avatar = el("span", "leaderboard-avatar", row.name.slice(0, 1).toUpperCase());
    const copy = el("span", "leaderboard-player");
    copy.append(el("strong", "", row.name));
    if (row.detail) copy.append(el("small", "", row.detail));
    item.append(position, avatar, copy, el("strong", "leaderboard-value", row.valueLabel));
    list.append(item);
  });
  aside.append(list);
  return aside;
}

export function gameLayout(table, side) {
  const layout = el("div", "game-v2-layout");
  layout.append(table, side);
  return layout;
}

export function countdown(deadline) {
  const timer = el("strong", "table-countdown");
  const update = () => {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
    const minutes = Math.floor(remaining / 60);
    timer.textContent = `${minutes}:${String(remaining % 60).padStart(2, "0")}`;
    timer.dataset.urgent = String(remaining <= 15);
    if (remaining === 0 || !timer.isConnected) window.clearInterval(interval);
  };
  const interval = window.setInterval(update, 1_000);
  update();
  return timer;
}

export function phaseName(value) {
  return ({
    betting: "Puntate",
    players: "Giocatori",
    dealer: "Banco",
    finished: "Risultato",
    playing: "In gioco",
    placement: "Piazzamento",
    battle: "Battaglia",
    preflop: "Pre-flop",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    drawing: "Disegno",
    caption: "Descrizione",
    prompt: "Prompt",
    reveal: "Rivelazione",
    answering: "Risposte",
    review: "Votazione",
    "round-result": "Risultato round",
    draw: "Pesca",
    meld: "Combinazioni"
  })[value] ?? value;
}

export function resultText(result) {
  return ({
    win: "Vinta",
    lose: "Persa",
    push: "Pareggio",
    blackjack: "Blackjack",
    bust: "Sballato",
    stand: "Fermo"
  })[result] ?? result ?? "In corso";
}
