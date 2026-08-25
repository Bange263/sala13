import { cardSource } from "../games/card-media.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function node(name, attributes = {}, text = null) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== null) element.textContent = text;
  return element;
}

function add(parent, ...children) {
  parent.append(...children);
  return parent;
}

function text(x, y, value, attributes = {}) {
  return node("text", {
    x,
    y,
    fill: "#1f2923",
    "font-family": "Inter, system-ui, sans-serif",
    "font-size": 14,
    "font-weight": 700,
    ...attributes
  }, value);
}

function card(x, y, label, suit = "", color = "#1f2923", rotate = 0) {
  const group = node("g", { transform: `translate(${x} ${y}) rotate(${rotate} 38 52)` });
  add(
    group,
    node("rect", { width: 76, height: 104, rx: 9, fill: "#fffdf8", stroke: "#cfc6b7", "stroke-width": 2 }),
    text(11, 25, label, { fill: color, "font-family": "Georgia, serif", "font-size": 22 }),
    text(38, 66, suit, { fill: color, "font-family": "Georgia, serif", "font-size": 27, "text-anchor": "middle" })
  );
  return group;
}

function imageCard(x, y, cardValue, deck = "french", { width = 76, height = 112, rotate = 0 } = {}) {
  return node("image", {
    x,
    y,
    width,
    height,
    href: cardSource(cardValue, deck),
    preserveAspectRatio: "xMidYMid meet",
    transform: `rotate(${rotate} ${x + width / 2} ${y + height / 2})`
  });
}

function baseSvg(titleValue) {
  const svg = node("svg", { viewBox: "0 0 320 190", role: "img", "aria-label": titleValue });
  add(svg, node("title", {}, titleValue), node("rect", { width: 320, height: 190, fill: "#ece6da" }));
  return svg;
}

function blackjackExample(titleValue) {
  const svg = baseSvg(titleValue);
  add(
    svg,
    imageCard(67, 27, { rank: "A", suit: "spades" }, "french"),
    imageCard(169, 27, { rank: "K", suit: "hearts" }, "french", { rotate: 3 }),
    text(160, 167, "11 + 10 = 21", { "text-anchor": "middle", "font-size": 16 })
  );
  return svg;
}

function unoExample(titleValue) {
  const svg = baseSvg(titleValue);
  const cards = [
    { color: "red", value: "2" },
    { color: "yellow", value: "reverse" },
    { color: "green", value: "draw2" },
    { color: "wild", value: "wild4" }
  ];
  cards.forEach((cardValue, index) => svg.append(imageCard(34 + index * 63, 34, cardValue, "uno", { width: 52, height: 91, rotate: index - 1.5 })));
  add(svg, text(160, 155, "Il jolly imposta il prossimo colore", { "text-anchor": "middle", "font-size": 13 }));
  return svg;
}

function scopaExample(titleValue) {
  const svg = baseSvg(titleValue);
  add(
    svg,
    imageCard(28, 31, { rank: 7, suit: "denari" }, "italian", { width: 66, height: 116 }),
    text(121, 96, "+", { "font-family": "Georgia, serif", "font-size": 27 }),
    imageCard(143, 31, { rank: 3, suit: "coppe" }, "italian", { width: 66, height: 116 }),
    text(245, 96, "= 10", { "font-family": "Georgia, serif", "font-size": 25 }),
    text(160, 164, "Il 10 prende 7 + 3", { "text-anchor": "middle", "font-size": 13 })
  );
  return svg;
}

function briscolaExample(titleValue) {
  const svg = baseSvg(titleValue);
  add(
    svg,
    imageCard(45, 28, { rank: 1, suit: "coppe" }, "italian", { width: 69, height: 121, rotate: -3 }),
    imageCard(157, 28, { rank: 2, suit: "denari" }, "italian", { width: 69, height: 121, rotate: 3 }),
    node("path", { d: "M135 92 H151", stroke: "#1f2923", "stroke-width": 3 }),
    text(160, 164, "Denari è briscola: il 2 vince", { "text-anchor": "middle", "font-size": 13 })
  );
  return svg;
}

function pokerExample(titleValue) {
  const svg = baseSvg(titleValue);
  const cards = [
    { rank: "K", suit: "clubs" },
    { rank: "K", suit: "diamonds" },
    { rank: "K", suit: "hearts" },
    { rank: "7", suit: "spades" },
    { rank: "7", suit: "clubs" }
  ];
  cards.forEach((cardValue, index) => svg.append(imageCard(15 + index * 58, 42, cardValue, "french", { width: 53, height: 90, rotate: index - 2 })));
  add(svg, text(160, 158, "K-K-K + 7-7: full house", { "text-anchor": "middle", "font-size": 13 }));
  return svg;
}

function burracoExample(titleValue) {
  const svg = baseSvg(titleValue);
  [4, 5, 6, 7, 8, 9, 10].forEach((value, index) => {
    svg.append(imageCard(11 + index * 42, 48, { rank: String(value), suit: "hearts" }, "french", { width: 42, height: 74 }));
  });
  add(svg, text(160, 154, "Sette carte consecutive, nessuna matta", { "text-anchor": "middle", "font-size": 13 }));
  return svg;
}

function grid(svg, { cols, rows, x, y, cell, fill = "#f8f4eb" }) {
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      svg.append(node("rect", {
        x: x + col * cell,
        y: y + row * cell,
        width: cell,
        height: cell,
        fill,
        stroke: "#c7beae",
        "stroke-width": 1
      }));
    }
  }
}

function battleshipExample(titleValue) {
  const svg = baseSvg(titleValue);
  grid(svg, { cols: 7, rows: 5, x: 58, y: 25, cell: 29 });
  [[2, 1], [3, 1], [4, 1]].forEach(([col, row]) => {
    svg.append(node("circle", { cx: 72.5 + col * 29, cy: 39.5 + row * 29, r: 8, fill: "#b84f3b" }));
  });
  [[0, 0], [6, 0], [1, 3], [5, 4]].forEach(([col, row]) => {
    add(
      svg,
      node("line", { x1: 66 + col * 29, y1: 33 + row * 29, x2: 79 + col * 29, y2: 46 + row * 29, stroke: "#527789", "stroke-width": 2 }),
      node("line", { x1: 79 + col * 29, y1: 33 + row * 29, x2: 66 + col * 29, y2: 46 + row * 29, stroke: "#527789", "stroke-width": 2 })
    );
  });
  add(svg, text(160, 180, "Rosso: colpito · Croce: acqua", { "text-anchor": "middle", "font-size": 13 }));
  return svg;
}

function chessExample(titleValue) {
  const svg = baseSvg(titleValue);
  const cell = 24;
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      svg.append(node("rect", {
        x: 64 + col * cell,
        y: 21 + row * cell,
        width: cell,
        height: cell,
        fill: (row + col) % 2 ? "#6d776d" : "#f5efe3"
      }));
    }
  }
  add(
    svg,
    text(124, 91, "♞", { "font-family": "Georgia, serif", "font-size": 31, "text-anchor": "middle" }),
    node("path", { d: "M130 76 Q166 50 180 79", fill: "none", stroke: "#c65f3f", "stroke-width": 4, "stroke-linecap": "round" }),
    node("circle", { cx: 181, cy: 80, r: 5, fill: "#c65f3f" }),
    text(160, 180, "Il server convalida origine e destinazione", { "text-anchor": "middle", "font-size": 12 })
  );
  return svg;
}

function ticTacToeExample(titleValue) {
  const svg = baseSvg(titleValue);
  const x = 82;
  const y = 19;
  const cell = 52;
  for (let index = 1; index < 3; index += 1) {
    add(
      svg,
      node("line", { x1: x + index * cell, y1: y, x2: x + index * cell, y2: y + cell * 3, stroke: "#7c817b", "stroke-width": 3 }),
      node("line", { x1: x, y1: y + index * cell, x2: x + cell * 3, y2: y + index * cell, stroke: "#7c817b", "stroke-width": 3 })
    );
  }
  [0, 1, 2].forEach((index) => {
    add(
      svg,
      node("line", { x1: x + 13 + index * cell, y1: y + 13 + index * cell, x2: x + 39 + index * cell, y2: y + 39 + index * cell, stroke: "#c65f3f", "stroke-width": 5, "stroke-linecap": "round" }),
      node("line", { x1: x + 39 + index * cell, y1: y + 13 + index * cell, x2: x + 13 + index * cell, y2: y + 39 + index * cell, stroke: "#c65f3f", "stroke-width": 5, "stroke-linecap": "round" })
    );
  });
  return svg;
}

function categoriesExample(titleValue) {
  const svg = baseSvg(titleValue);
  add(
    svg,
    node("circle", { cx: 80, cy: 88, r: 46, fill: "#315c4d" }),
    text(80, 105, "M", { fill: "#fffaf3", "font-family": "Georgia, serif", "font-size": 52, "text-anchor": "middle" }),
    text(152, 54, "Nome", { "font-size": 13 }),
    text(152, 83, "Cosa", { "font-size": 13 }),
    text(152, 112, "Città", { "font-size": 13 }),
    text(152, 141, "Animale", { "font-size": 13 }),
    text(285, 54, "01:30", { fill: "#a64032", "font-size": 13, "text-anchor": "end" })
  );
  [61, 90, 119, 148].forEach((lineY) => svg.append(node("line", { x1: 150, y1: lineY, x2: 285, y2: lineY, stroke: "#c7beae" })));
  return svg;
}

function hangmanExample(titleValue) {
  const svg = baseSvg(titleValue);
  add(
    svg,
    node("line", { x1: 43, y1: 164, x2: 145, y2: 164, stroke: "#5d5145", "stroke-width": 6 }),
    node("line", { x1: 72, y1: 164, x2: 72, y2: 26, stroke: "#5d5145", "stroke-width": 6 }),
    node("line", { x1: 69, y1: 28, x2: 126, y2: 28, stroke: "#5d5145", "stroke-width": 6 }),
    node("line", { x1: 124, y1: 28, x2: 124, y2: 51, stroke: "#5d5145", "stroke-width": 3 }),
    node("circle", { cx: 124, cy: 65, r: 14, fill: "none", stroke: "#c65f3f", "stroke-width": 4 }),
    node("line", { x1: 124, y1: 79, x2: 124, y2: 122, stroke: "#c65f3f", "stroke-width": 4 }),
    node("line", { x1: 124, y1: 91, x2: 102, y2: 108, stroke: "#c65f3f", "stroke-width": 4 }),
    node("line", { x1: 124, y1: 91, x2: 146, y2: 108, stroke: "#c65f3f", "stroke-width": 4 }),
    text(228, 84, "S A _ A", { "font-family": "Georgia, serif", "font-size": 23, "text-anchor": "middle" }),
    text(228, 118, "Errori: E · T · O · R", { fill: "#6e5849", "font-size": 12, "text-anchor": "middle" })
  );
  return svg;
}

function connectFourExample(titleValue) {
  const svg = baseSvg(titleValue);
  const startX = 62;
  const startY = 30;
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const winning = [[1, 5], [2, 4], [3, 3], [4, 2]].some(([winCol, winRow]) => col === winCol && row === winRow);
      const occupied = winning || (row === 5 && [0, 3, 5, 6].includes(col));
      svg.append(node("circle", {
        cx: startX + col * 33,
        cy: startY + row * 27,
        r: 10,
        fill: winning ? "#c65f3f" : occupied ? "#c59a3d" : "#f7f2e8",
        stroke: "#315c4d",
        "stroke-width": 3
      }));
    }
  }
  return svg;
}

function canvasExample(titleValue) {
  const svg = baseSvg(titleValue);
  add(
    svg,
    node("rect", { x: 28, y: 24, width: 264, height: 130, rx: 12, fill: "#fffdf8", stroke: "#cfc6b7" }),
    node("path", { d: "M65 128 C89 49 134 150 170 75 S228 39 259 110", fill: "none", stroke: "#315c4d", "stroke-width": 8, "stroke-linecap": "round", "stroke-linejoin": "round" }),
    node("circle", { cx: 65, cy: 128, r: 5, fill: "#c65f3f" }),
    node("circle", { cx: 259, cy: 110, r: 5, fill: "#c65f3f" }),
    text(160, 176, "Punti ordinati e convalidati dal server", { "text-anchor": "middle", "font-size": 12 })
  );
  return svg;
}

const renderers = {
  blackjack: blackjackExample,
  uno: unoExample,
  scopa: scopaExample,
  briscola: briscolaExample,
  poker: pokerExample,
  burraco: burracoExample,
  battleship: battleshipExample,
  chess: chessExample,
  "tic-tac-toe": ticTacToeExample,
  categories: categoriesExample,
  hangman: hangmanExample,
  "connect-four": connectFourExample,
  canvas: canvasExample
};

export function renderExample(example) {
  const figure = document.createElement("figure");
  figure.className = "example-figure";
  const renderer = renderers[example.type] ?? canvasExample;
  figure.append(renderer(example.title));
  const caption = document.createElement("figcaption");
  caption.textContent = example.title;
  figure.append(caption);
  return figure;
}
