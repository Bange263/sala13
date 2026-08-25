import { GAME_CATALOG } from "/shared/game-catalog.js";
import { CLIENT_EVENTS, ERROR_CODES, SERVER_EVENTS } from "/shared/protocol.js";
import { createInfoModal } from "./components/info-modal.js";
import { renderGame } from "./games/game-renderer-v2.js";

const storageKeys = {
  playerId: "sala13.playerId",
  playerName: "sala13.playerName",
  roomCode: "sala13.roomCode"
};

function stablePlayerId() {
  const stored = localStorage.getItem(storageKeys.playerId);
  if (stored) return stored;
  const generated = crypto.randomUUID();
  localStorage.setItem(storageKeys.playerId, generated);
  return generated;
}

const state = {
  playerId: stablePlayerId(),
  room: null,
  lobbies: [],
  connectedClients: 0,
  reconnecting: false
};

const gameById = new Map(GAME_CATALOG.map((game) => [game.id, game]));
const infoModal = createInfoModal(GAME_CATALOG);
// Always follow the address used to open the page. A LAN, Tailscale, ZeroTier,
// ngrok or domain client must never be redirected to its own localhost.
const socket = window.io(window.location.origin, {
  path: "/socket.io",
  transports: ["websocket", "polling"]
});

const elements = {
  homeView: document.querySelector("#home-view"),
  roomView: document.querySelector("#room-view"),
  connectionPill: document.querySelector("#connection-pill"),
  connectionLabel: document.querySelector("#connection-label"),
  gameGrid: document.querySelector("#game-grid"),
  lobbyList: document.querySelector("#lobby-list"),
  lobbyCount: document.querySelector("#lobby-count"),
  joinForm: document.querySelector("#join-form"),
  joinName: document.querySelector("#join-name"),
  joinCode: document.querySelector("#join-code"),
  joinPassword: document.querySelector("#join-password"),
  createDialog: document.querySelector("#create-room-dialog"),
  createForm: document.querySelector("#create-room-form"),
  createGame: document.querySelector("#create-game"),
  createName: document.querySelector("#create-name"),
  createPasswordRow: document.querySelector("#create-password-row"),
  createPassword: document.querySelector("#create-password"),
  createMaxPlayers: document.querySelector("#create-max-players"),
  createVariant: document.querySelector("#create-variant"),
  createMode: document.querySelector("#create-mode"),
  createStacking: document.querySelector("#create-stacking"),
  createCategories: document.querySelector("#create-categories"),
  createRoundSeconds: document.querySelector("#create-round-seconds"),
  createStartingChips: document.querySelector("#create-starting-chips"),
  createBaseBet: document.querySelector("#create-base-bet"),
  createBigBlind: document.querySelector("#create-big-blind"),
  createSoft17: document.querySelector("#create-soft17"),
  variantSetting: document.querySelector("#variant-setting"),
  modeSetting: document.querySelector("#mode-setting"),
  stackingSetting: document.querySelector("#stacking-setting"),
  categoriesSetting: document.querySelector("#categories-setting"),
  timerSetting: document.querySelector("#timer-setting"),
  chipsSetting: document.querySelector("#chips-setting"),
  betSetting: document.querySelector("#bet-setting"),
  blindSetting: document.querySelector("#blind-setting"),
  soft17Setting: document.querySelector("#soft17-setting"),
  implementationNote: document.querySelector("#implementation-note"),
  roomGameTag: document.querySelector("#room-game-tag"),
  roomGameName: document.querySelector("#room-game-name"),
  roomCodeLabel: document.querySelector("#room-code-label"),
  roomCapacity: document.querySelector("#room-capacity"),
  playerList: document.querySelector("#player-list"),
  roomControls: document.querySelector("#room-controls"),
  readyButton: document.querySelector("#ready-button"),
  readySummary: document.querySelector("#ready-summary"),
  startButton: document.querySelector("#start-button"),
  gameStage: document.querySelector("#game-stage"),
  toastRegion: document.querySelector("#toast-region")
};

function toast(message, kind = "info") {
  const item = document.createElement("div");
  item.className = "toast";
  item.dataset.kind = kind;
  item.textContent = message;
  elements.toastRegion.append(item);
  window.setTimeout(() => item.remove(), 4_500);
}

function persistName(name) {
  localStorage.setItem(storageKeys.playerName, name);
  elements.joinName.value = name;
  elements.createName.value = name;
}

function currentName() {
  return (elements.joinName.value || elements.createName.value || localStorage.getItem(storageKeys.playerName) || "").trim();
}

function setConnection(stateName) {
  elements.connectionPill.dataset.state = stateName;
  if (stateName === "online") {
    const suffix = state.connectedClients > 0 ? ` · ${state.connectedClients} online` : "";
    elements.connectionLabel.textContent = `Server online${suffix}`;
  } else if (stateName === "offline") {
    elements.connectionLabel.textContent = "Server non raggiungibile";
  } else {
    elements.connectionLabel.textContent = "Connessione…";
  }
}

function emitAck(event, payload = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(8_000).emit(event, payload, (timeoutError, response) => {
      if (timeoutError) {
        reject(new Error("Il server non ha risposto in tempo."));
        return;
      }
      if (!response?.ok) {
        const error = new Error(response?.error?.message || "Operazione non riuscita.");
        error.code = response?.error?.code;
        error.details = response?.error?.details;
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

function button(label, className, onClick) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = className;
  control.textContent = label;
  control.addEventListener("click", onClick);
  return control;
}

function renderGames() {
  const fragment = document.createDocumentFragment();
  for (const game of GAME_CATALOG) {
    const card = document.createElement("article");
    card.className = "game-card";
    card.style.setProperty("--game-accent", game.accent);

    const top = document.createElement("div");
    const meta = document.createElement("div");
    meta.className = "game-card-meta";
    const tag = document.createElement("span");
    tag.className = "status-chip";
    tag.textContent = game.tag;
    const players = document.createElement("span");
    players.textContent = `${game.players.label} giocatori`;
    players.className = "count-label";
    meta.append(tag, players);

    const title = document.createElement("h3");
    title.textContent = game.name;
    const description = document.createElement("p");
    description.textContent = game.description;
    top.append(meta, title, description);

    const actions = document.createElement("div");
    actions.className = "game-card-actions";
    const create = button(
      "Crea e gioca",
      "button button-quiet",
      () => openCreateDialog(game.id)
    );
    const info = button("i", "card-info-button", () => infoModal.open(game.id));
    info.setAttribute("aria-label", `Regole di ${game.name}`);
    actions.append(create, info);
    card.append(top, actions);
    fragment.append(card);
  }
  elements.gameGrid.replaceChildren(fragment);
}

function renderLobbies() {
  elements.lobbyCount.textContent = `${state.lobbies.length} ${state.lobbies.length === 1 ? "aperta" : "aperte"}`;
  if (state.lobbies.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nessuna stanza pubblica al momento. Puoi aprire la prima.";
    elements.lobbyList.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const lobby of state.lobbies) {
    const row = document.createElement("article");
    row.className = "lobby-row";
    const game = document.createElement("strong");
    game.textContent = lobby.gameName;
    const host = document.createElement("span");
    host.className = "lobby-host";
    host.textContent = `Host: ${lobby.hostName}`;
    const status = document.createElement("span");
    status.className = "status-chip";
    status.textContent = `${lobby.playerCount}/${lobby.maxPlayers} · ${lobby.status}`;
    const join = button("Entra", "button button-dark", () => joinPublicLobby(lobby.code));
    join.disabled = lobby.playerCount >= lobby.maxPlayers || lobby.status === "playing";
    row.append(game, host, status, join);
    fragment.append(row);
  }
  elements.lobbyList.replaceChildren(fragment);
}

function populateGameSelect() {
  const fragment = document.createDocumentFragment();
  for (const game of GAME_CATALOG) {
    const option = document.createElement("option");
    option.value = game.id;
    option.textContent = `${game.name} · giocabile`;
    fragment.append(option);
  }
  elements.createGame.replaceChildren(fragment);
}

function updateCreateGameOptions() {
  const game = gameById.get(elements.createGame.value);
  if (!game) return;
  const counts = game.players.allowed
    ? game.players.allowed
    : Array.from({ length: game.players.max - game.players.min + 1 }, (_, index) => game.players.min + index);
  const fragment = document.createDocumentFragment();
  for (const count of counts) {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = String(count);
    fragment.append(option);
  }
  elements.createMaxPlayers.replaceChildren(fragment);
  elements.createMaxPlayers.value = String(counts.at(-1));
  elements.variantSetting.hidden = game.id !== "chess-checkers";
  elements.modeSetting.hidden = game.id !== "draw-and-pass";
  elements.stackingSetting.hidden = game.id !== "uno";
  elements.categoriesSetting.hidden = game.id !== "categories";
  elements.timerSetting.hidden = !["categories", "draw-and-pass"].includes(game.id);
  elements.chipsSetting.hidden = !["blackjack", "texas-holdem"].includes(game.id);
  elements.betSetting.hidden = game.id !== "blackjack";
  elements.blindSetting.hidden = game.id !== "texas-holdem";
  elements.soft17Setting.hidden = game.id !== "blackjack";
  elements.implementationNote.textContent = "Motore server-authoritative attivo: stato, turni e dati privati vengono validati dal server.";
}

function openCreateDialog(gameId = "tic-tac-toe") {
  elements.createGame.value = gameId;
  const savedName = localStorage.getItem(storageKeys.playerName) || elements.joinName.value;
  if (savedName) elements.createName.value = savedName;
  updateCreateGameOptions();
  elements.createDialog.showModal();
}

function setRoom(room) {
  state.room = room;
  localStorage.setItem(storageKeys.roomCode, room.code);
  elements.homeView.hidden = true;
  elements.roomView.hidden = false;
  renderRoom();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearRoom() {
  state.room = null;
  localStorage.removeItem(storageKeys.roomCode);
  elements.roomView.hidden = true;
  elements.homeView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPlayers(room) {
  const fragment = document.createDocumentFragment();
  for (const player of room.players) {
    const row = document.createElement("li");
    row.className = "player-row";
    const avatar = document.createElement("span");
    avatar.className = "player-avatar";
    avatar.textContent = player.name.slice(0, 1).toUpperCase();
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = `${player.name}${player.isHost ? " · host" : ""}${player.id === room.selfPlayerId ? " · tu" : ""}`;
    const playerState = document.createElement("span");
    playerState.className = "player-state";
    playerState.dataset.ready = String(player.ready);
    playerState.dataset.connected = String(player.connected);
    playerState.title = !player.connected ? "Disconnesso" : player.ready ? "Pronto" : "In attesa";
    row.append(avatar, name, playerState);
    fragment.append(row);
  }
  elements.playerList.replaceChildren(fragment);
}

function renderWaitingStage(room, game) {
  const wrapper = document.createElement("div");
  wrapper.className = "waiting-stage";
  const inner = document.createElement("div");
  const number = document.createElement("p");
  number.className = "stage-number";
  number.textContent = String(room.players.length).padStart(2, "0");
  const heading = document.createElement("h2");
  heading.textContent = "Il tavolo si sta formando";
  const paragraph = document.createElement("p");
  paragraph.textContent = "Condividi il codice, segnatevi tutti pronti e lascia che l'host avvii la partita.";
  inner.append(number, heading, paragraph);
  wrapper.append(inner);
  elements.gameStage.replaceChildren(wrapper);
}

function renderRoom() {
  const room = state.room;
  if (!room) return;
  const game = gameById.get(room.gameId);
  const self = room.players.find((player) => player.id === room.selfPlayerId);
  const connectedCount = room.players.filter((player) => player.connected).length;

  elements.roomGameTag.textContent = `${game.tag} · ${room.visibility === "private" ? "privata" : "pubblica"}`;
  elements.roomGameName.textContent = game.name;
  elements.roomCodeLabel.textContent = room.code;
  elements.roomCapacity.textContent = `${connectedCount} / ${room.settings.maxPlayers}`;
  renderPlayers(room);

  const canReady = room.status !== "playing";
  elements.roomControls.hidden = !canReady;
  elements.readyButton.textContent = self?.ready ? "Pronto ✓ · annulla" : "Segna come pronto";
  elements.readyButton.dataset.ready = String(Boolean(self?.ready));
  elements.startButton.hidden = room.hostPlayerId !== room.selfPlayerId;
  const readyCount = room.players.filter((player) => player.connected && player.ready).length;
  elements.readySummary.textContent = `${readyCount}/${connectedCount} pronti`;
  elements.startButton.disabled = !room.startEligibility?.canStart;
  elements.startButton.title = room.startEligibility?.canStart ? "Avvia la partita" : "Tutti i giocatori devono essere presenti e pronti";

  if ((room.status === "playing" || room.status === "finished") && room.gameState) {
    renderGame(elements.gameStage, room, async (action) => {
      try {
        await emitAck(CLIENT_EVENTS.GAME_ACTION, {
          expectedVersion: state.room.version,
          action
        });
      } catch (error) {
        toast(error.message, "error");
      }
    });
  } else {
    renderWaitingStage(room, game);
  }
}

async function joinPublicLobby(code) {
  const name = currentName();
  if (name.length < 2) {
    elements.joinCode.value = code;
    elements.joinName.focus();
    toast("Inserisci prima il tuo nome.", "error");
    return;
  }
  persistName(name);
  try {
    const response = await emitAck(CLIENT_EVENTS.ROOM_JOIN, {
      code,
      name,
      password: "",
      playerId: state.playerId
    });
    setRoom(response.room);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function tryReconnect() {
  const code = state.room?.code || localStorage.getItem(storageKeys.roomCode);
  const name = localStorage.getItem(storageKeys.playerName);
  if (!code || !name || state.reconnecting) return;
  state.reconnecting = true;
  try {
    const response = await emitAck(CLIENT_EVENTS.ROOM_JOIN, {
      code,
      name,
      password: "",
      playerId: state.playerId
    });
    setRoom(response.room);
    toast("Sei rientrato nella stanza.");
  } catch (error) {
    if ([ERROR_CODES.ROOM_NOT_FOUND, ERROR_CODES.WRONG_PASSWORD].includes(error.code)) {
      localStorage.removeItem(storageKeys.roomCode);
    }
  } finally {
    state.reconnecting = false;
  }
}

elements.joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.joinName.value.trim();
  const code = elements.joinCode.value.trim().toUpperCase();
  persistName(name);
  try {
    const response = await emitAck(CLIENT_EVENTS.ROOM_JOIN, {
      code,
      name,
      password: elements.joinPassword.value,
      playerId: state.playerId
    });
    elements.joinPassword.value = "";
    setRoom(response.room);
  } catch (error) {
    toast(error.message, "error");
  }
});

elements.createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.createForm.reportValidity()) return;

  const name = elements.createName.value.trim();
  const visibility = new FormData(elements.createForm).get("visibility");
  persistName(name);
  try {
    const settings = { maxPlayers: Number(elements.createMaxPlayers.value) };
    if (elements.createGame.value === "chess-checkers") settings.variant = elements.createVariant.value;
    if (elements.createGame.value === "draw-and-pass") settings.mode = elements.createMode.value;
    if (elements.createGame.value === "uno") settings.stacking = elements.createStacking.checked;
    if (["categories", "draw-and-pass"].includes(elements.createGame.value)) settings.roundSeconds = Number(elements.createRoundSeconds.value);
    if (elements.createGame.value === "categories") {
      const categories = elements.createCategories.value.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
      if (categories.length > 0) settings.categories = categories;
    }
    if (["blackjack", "texas-holdem"].includes(elements.createGame.value)) settings.startingChips = Number(elements.createStartingChips.value);
    if (elements.createGame.value === "blackjack") {
      settings.baseBet = Number(elements.createBaseBet.value);
      settings.dealerHitsSoft17 = elements.createSoft17.checked;
    }
    if (elements.createGame.value === "texas-holdem") settings.bigBlind = Number(elements.createBigBlind.value);
    const response = await emitAck(CLIENT_EVENTS.ROOM_CREATE, {
      gameId: elements.createGame.value,
      name,
      visibility,
      password: visibility === "private" ? elements.createPassword.value : "",
      playerId: state.playerId,
      settings
    });
    elements.createPassword.value = "";
    elements.createDialog.close();
    setRoom(response.room);
  } catch (error) {
    toast(error.message, "error");
  }
});

elements.createGame.addEventListener("change", updateCreateGameOptions);
elements.createForm.addEventListener("change", (event) => {
  if (event.target.name === "visibility") {
    elements.createPasswordRow.hidden = event.target.value !== "private";
  }
});

document.querySelector("#open-create-button").addEventListener("click", () => openCreateDialog());
document.querySelector("#close-create-button").addEventListener("click", () => elements.createDialog.close());
document.querySelector("#leave-room-button").addEventListener("click", async () => {
  try {
    await emitAck(CLIENT_EVENTS.ROOM_LEAVE);
  } catch {
    // The local exit still succeeds if the server disappeared.
  }
  clearRoom();
});
document.querySelector("#copy-room-code").addEventListener("click", async () => {
  if (!state.room) return;
  try {
    await navigator.clipboard.writeText(state.room.code);
    toast("Codice stanza copiato.");
  } catch {
    toast(`Codice stanza: ${state.room.code}`);
  }
});
document.querySelector("#room-info-button").addEventListener("click", () => {
  if (state.room) infoModal.open(state.room.gameId);
});

elements.readyButton.addEventListener("click", async () => {
  const self = state.room?.players.find((player) => player.id === state.room.selfPlayerId);
  if (!self) return;
  try {
    await emitAck(CLIENT_EVENTS.ROOM_READY, { ready: !self.ready });
  } catch (error) {
    toast(error.message, "error");
  }
});

elements.startButton.addEventListener("click", async () => {
  try {
    await emitAck(CLIENT_EVENTS.ROOM_START);
  } catch (error) {
    toast(error.message, "error");
  }
});

elements.joinCode.addEventListener("input", () => {
  elements.joinCode.value = elements.joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

socket.on("connect", () => {
  setConnection("online");
  tryReconnect();
});
socket.on("disconnect", () => setConnection("offline"));
socket.io.on("reconnect_attempt", () => setConnection("connecting"));
socket.on(SERVER_EVENTS.PRESENCE, ({ connectedClients }) => {
  state.connectedClients = connectedClients;
  if (socket.connected) setConnection("online");
});
socket.on(SERVER_EVENTS.LOBBY_SNAPSHOT, (lobbies) => {
  state.lobbies = Array.isArray(lobbies) ? lobbies : [];
  renderLobbies();
});
socket.on(SERVER_EVENTS.ROOM_STATE, (room) => setRoom(room));
socket.on(SERVER_EVENTS.ROOM_CLOSED, ({ reason }) => {
  clearRoom();
  const message = reason === "session-replaced"
    ? "Questa sessione è stata aperta in un'altra scheda."
    : "La stanza è stata chiusa.";
  toast(message, "error");
});
socket.on(SERVER_EVENTS.GAME_ERROR, (error) => {
  if (error?.code === ERROR_CODES.STALE_STATE) return;
});

const savedName = localStorage.getItem(storageKeys.playerName) || "";
elements.joinName.value = savedName;
elements.createName.value = savedName;
populateGameSelect();
updateCreateGameOptions();
renderGames();
renderLobbies();
setConnection("connecting");
