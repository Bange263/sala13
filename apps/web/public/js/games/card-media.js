const FRENCH_RANKS = Object.freeze({
  A: "ace",
  J: "jack",
  Q: "queen",
  K: "king"
});

const ITALIAN_SUITS = Object.freeze({
  bastoni: "b",
  coppe: "c",
  denari: "d",
  spade: "s"
});

const SUIT_LABELS = Object.freeze({
  hearts: "cuori",
  diamonds: "quadri",
  clubs: "fiori",
  spades: "picche",
  bastoni: "bastoni",
  coppe: "coppe",
  denari: "denari"
});

const ITALIAN_RANKS = Object.freeze({
  1: "Asso",
  8: "Fante",
  9: "Cavallo",
  10: "Re"
});

const UNO_COLORS = Object.freeze({
  red: "#c94435",
  yellow: "#d5a928",
  green: "#2f7656",
  blue: "#356c91",
  wild: "#252c28"
});

const UNO_NAMES = Object.freeze({
  skip: "Salta",
  reverse: "Inverti",
  draw2: "+2",
  wild: "Jolly",
  wild4: "+4"
});

const unoCache = new Map();

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = text;
  return node;
}

export function cardLabel(card, deck = "french") {
  if (!card) return "Nessuna carta";
  if (card.hidden) return "Carta coperta";
  if (deck === "uno") return `${UNO_NAMES[card.value] ?? card.value} ${card.color === "wild" ? "" : card.color}`.trim();
  if (card.joker || card.rank === "JOKER") return "Jolly";
  if (deck === "italian") return `${ITALIAN_RANKS[card.rank] ?? card.rank} di ${SUIT_LABELS[card.suit] ?? card.suit}`;
  return `${card.rank} di ${SUIT_LABELS[card.suit] ?? card.suit}`;
}

function frenchSource(card) {
  if (!card || card.hidden) return "/assets/cards/french/back.svg";
  if (card.joker || card.rank === "JOKER") return jokerSource();
  const rank = FRENCH_RANKS[card.rank] ?? card.rank;
  return `/assets/cards/french/${rank}_of_${card.suit}.svg`;
}

function italianSource(card) {
  if (!card || card.hidden) return "/assets/cards/napoletane/bg.jpg";
  return `/assets/cards/napoletane/${card.rank}${ITALIAN_SUITS[card.suit]}.jpg`;
}

function svgData(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function jokerSource() {
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 336">
    <rect x="4" y="4" width="232" height="328" rx="18" fill="#fffdf7" stroke="#202722" stroke-width="8"/>
    <path d="M38 122 72 58l44 53 44-53 42 64-23 20H61z" fill="#d2a83a" stroke="#202722" stroke-width="7" stroke-linejoin="round"/>
    <circle cx="75" cy="151" r="20" fill="#c94435"/><circle cx="165" cy="151" r="20" fill="#356c91"/>
    <path d="M75 202c24 30 67 30 90 0" fill="none" stroke="#202722" stroke-width="9" stroke-linecap="round"/>
    <text x="120" y="286" text-anchor="middle" font-family="Georgia,serif" font-size="34" font-weight="700" fill="#202722">JOLLY</text>
  </svg>`);
}

function unoSource(card) {
  if (!card || card.hidden) {
    return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
      <rect x="5" y="5" width="230" height="350" rx="24" fill="#242a26" stroke="#f7f0df" stroke-width="10"/>
      <path d="M35 220C62 82 184 63 207 145S142 310 35 220Z" fill="#b94435" stroke="#f7f0df" stroke-width="9"/>
      <text x="120" y="207" text-anchor="middle" font-family="Arial,sans-serif" font-style="italic" font-weight="900" font-size="66" fill="#fffaf0" transform="rotate(-18 120 180)">S13</text>
    </svg>`);
  }
  const cacheKey = `${card.color}:${card.value}`;
  if (unoCache.has(cacheKey)) return unoCache.get(cacheKey);
  const color = UNO_COLORS[card.color] ?? UNO_COLORS.wild;
  const symbol = ({ skip: "⊘", reverse: "↻", draw2: "+2", wild: "W", wild4: "+4" })[card.value] ?? card.value;
  const label = UNO_NAMES[card.value] ?? card.value;
  const wildMarks = card.color === "wild"
    ? `<path d="M76 133a54 54 0 0 1 88 0l-44 47z" fill="#c94435"/><path d="M164 133a54 54 0 0 1 0 94l-44-47z" fill="#356c91"/><path d="M164 227a54 54 0 0 1-88 0l44-47z" fill="#d5a928"/><path d="M76 227a54 54 0 0 1 0-94l44 47z" fill="#2f7656"/>`
    : `<text x="120" y="211" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="78" fill="${card.color === "yellow" ? "#252c28" : "#fffdf6"}">${symbol}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
    <rect x="5" y="5" width="230" height="350" rx="24" fill="${color}" stroke="#fffaf0" stroke-width="10"/>
    <ellipse cx="120" cy="180" rx="78" ry="124" fill="#fffaf0" opacity=".18" transform="rotate(25 120 180)"/>
    ${wildMarks}
    <text x="28" y="50" font-family="Arial,sans-serif" font-weight="900" font-size="30" fill="${card.color === "yellow" ? "#252c28" : "#fffdf6"}">${symbol}</text>
    <text x="212" y="320" text-anchor="end" font-family="Arial,sans-serif" font-weight="900" font-size="30" fill="${card.color === "yellow" ? "#252c28" : "#fffdf6"}" transform="rotate(180 212 310)">${symbol}</text>
    <text x="120" y="316" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="15" fill="${card.color === "yellow" ? "#252c28" : "#fffdf6"}">${label.toUpperCase()}</text>
  </svg>`;
  const source = svgData(svg);
  unoCache.set(cacheKey, source);
  return source;
}

export function cardSource(card, deck = "french") {
  if (deck === "italian") return italianSource(card);
  if (deck === "uno") return unoSource(card);
  return frenchSource(card);
}

export function cardElement(card, {
  deck = "french",
  size = "normal",
  interactive = false,
  selected = false,
  onClick = null,
  className = ""
} = {}) {
  const node = element(interactive ? "button" : "figure", `table-card deck-${deck} size-${size}${selected ? " selected" : ""}${className ? ` ${className}` : ""}`);
  if (interactive) node.type = "button";
  const image = document.createElement("img");
  image.src = cardSource(card, deck);
  image.alt = cardLabel(card, deck);
  image.draggable = false;
  image.loading = "eager";
  node.title = image.alt;
  node.dataset.suit = card?.suit ?? card?.color ?? "hidden";
  node.dataset.value = String(card?.rank ?? card?.value ?? "hidden");
  node.append(image);
  if (interactive && onClick) node.addEventListener("click", () => onClick(card, node));
  return node;
}

export function cardRow(cards, options = {}) {
  const row = element("div", `visual-card-row${options.fan ? " fan" : ""}${options.compact ? " compact" : ""}`);
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", options.label ?? "Carte");
  for (const card of cards ?? []) {
    row.append(cardElement(card, {
      ...options,
      interactive: Boolean(options.onClick),
      onClick: options.onClick
    }));
  }
  return row;
}

export function coveredCards(count, { deck = "french", max = 5, size = "small" } = {}) {
  const group = element("div", "covered-card-group");
  const visible = Math.min(Math.max(0, Number(count) || 0), max);
  for (let index = 0; index < visible; index += 1) {
    const card = cardElement({ hidden: true }, { deck, size });
    card.style.setProperty("--stack-index", String(index));
    group.append(card);
  }
  const badge = element("strong", "card-count-badge", String(count ?? 0));
  badge.setAttribute("aria-label", `${count ?? 0} carte`);
  group.append(badge);
  return group;
}

export function chipElement(value, { interactive = false, onClick = null, selected = false } = {}) {
  const chip = element(interactive ? "button" : "span", `casino-chip chip-${value}${selected ? " selected" : ""}`);
  if (interactive) chip.type = "button";
  chip.dataset.value = String(value);
  chip.append(element("span", "chip-ring", String(value)));
  if (interactive && onClick) chip.addEventListener("click", () => onClick(value, chip));
  return chip;
}

export function chipStack(amount, { compact = false } = {}) {
  const wrapper = element("span", `chip-stack${compact ? " compact" : ""}`);
  const values = [500, 100, 50, 25, 10, 5, 1];
  let remaining = Math.max(0, Number(amount) || 0);
  const chips = [];
  for (const value of values) {
    const count = Math.min(4, Math.floor(remaining / value));
    for (let index = 0; index < count; index += 1) chips.push(value);
    remaining %= value;
    if (chips.length >= 8) break;
  }
  if (chips.length === 0) chips.push(1);
  chips.slice(0, 8).forEach((value, index) => {
    const chip = chipElement(value);
    chip.style.setProperty("--chip-index", String(index));
    wrapper.append(chip);
  });
  wrapper.append(element("strong", "chip-stack-value", String(amount ?? 0)));
  return wrapper;
}
