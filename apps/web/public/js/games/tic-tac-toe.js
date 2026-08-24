export function renderTicTacToe(container, room, onPlace) {
  const state = room.gameState;
  const self = room.players.find((player) => player.id === room.selfPlayerId);
  const current = room.players.find((player) => player.id === state.currentPlayerId);
  const winner = room.players.find((player) => player.id === state.winnerId);
  const isYourTurn = state.currentPlayerId === room.selfPlayerId;

  const layout = document.createElement("div");
  layout.className = "tic-layout";

  const status = document.createElement("div");
  status.className = "tic-status";
  const mark = document.createElement("p");
  mark.className = "tic-mark";
  mark.textContent = state.yourMark ?? "—";
  const heading = document.createElement("h2");
  const paragraph = document.createElement("p");

  if (state.winnerId) {
    heading.textContent = state.winnerId === room.selfPlayerId ? "Hai vinto" : `${winner?.name ?? "L'avversario"} ha vinto`;
    paragraph.textContent = "La linea vincente è evidenziata. Segnatevi pronti per una rivincita.";
  } else if (state.draw) {
    heading.textContent = "Pareggio";
    paragraph.textContent = "La griglia è piena. Potete prepararvi per una nuova partita.";
  } else if (isYourTurn) {
    heading.textContent = "Tocca a te";
    paragraph.textContent = `Sei ${state.yourMark}. Scegli una casella libera.`;
  } else {
    heading.textContent = `Tocca a ${current?.name ?? "…"}`;
    paragraph.textContent = `${self?.name ?? "Tu"}, attendi la mossa avversaria.`;
  }
  status.append(mark, heading, paragraph);

  const board = document.createElement("div");
  board.className = "tic-board";
  board.setAttribute("role", "grid");
  board.setAttribute("aria-label", "Griglia del Tris");

  state.board.forEach((value, cell) => {
    const button = document.createElement("button");
    button.className = "tic-cell";
    button.type = "button";
    button.textContent = value ?? "";
    button.disabled = Boolean(value) || !isYourTurn || Boolean(state.winnerId || state.draw);
    button.dataset.winning = String(state.winningLine?.includes(cell) ?? false);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", value ? `Casella ${cell + 1}: ${value}` : `Casella ${cell + 1}: vuota`);
    button.addEventListener("click", () => onPlace(cell));
    board.append(button);
  });

  layout.append(status, board);
  container.replaceChildren(layout);
}
