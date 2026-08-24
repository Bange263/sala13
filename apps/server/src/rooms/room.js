import {
  ERROR_CODES,
  ROOM_STATUS,
  ROOM_VISIBILITY
} from "@sala13/shared";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { PublicError } from "../utils/public-error.js";

export class Room {
  constructor({ code, game, host, settings, visibility, password }) {
    this.code = code;
    this.gameId = game.definition.id;
    this.game = game.definition;
    this.engine = game.engine;
    this.visibility = visibility;
    this.passwordDigest = visibility === ROOM_VISIBILITY.PRIVATE ? hashPassword(password) : null;
    this.settings = Object.freeze({ ...settings });
    this.hostPlayerId = host.playerId;
    this.status = ROOM_STATUS.LOBBY;
    this.players = new Map();
    this.gameState = null;
    this.version = 0;
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    this.actionQueue = Promise.resolve();
    this.addPlayer(host, { skipPassword: true });
  }

  get maxPlayers() {
    return this.settings.maxPlayers;
  }

  get connectedPlayers() {
    return [...this.players.values()].filter((player) => player.connected);
  }

  get isPasswordProtected() {
    return Boolean(this.passwordDigest);
  }

  touch() {
    this.updatedAt = Date.now();
    this.version += 1;
  }

  addPlayer({ playerId, socketId, name, password }, { skipPassword = false } = {}) {
    const existing = this.players.get(playerId);
    if (existing) {
      const replacedSocketId = existing.socketId;
      existing.socketId = socketId;
      existing.connected = true;
      existing.name = name;
      existing.disconnectedAt = null;
      this.touch();
      return { player: existing, replacedSocketId };
    }

    if (this.status === ROOM_STATUS.PLAYING) {
      throw new PublicError(ERROR_CODES.BAD_REQUEST, "La partita è già iniziata.");
    }
    if (this.players.size >= this.maxPlayers) {
      throw new PublicError(ERROR_CODES.ROOM_FULL, "La stanza è piena.");
    }
    if (!skipPassword && !verifyPassword(password, this.passwordDigest)) {
      throw new PublicError(ERROR_CODES.WRONG_PASSWORD, "Password della stanza non corretta.");
    }

    const player = {
      id: playerId,
      socketId,
      name,
      ready: false,
      connected: true,
      joinedAt: Date.now(),
      disconnectedAt: null
    };
    this.players.set(playerId, player);
    this.touch();
    return { player, replacedSocketId: null };
  }

  markDisconnected(playerId) {
    const player = this.players.get(playerId);
    if (!player) return false;
    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = Date.now();
    player.ready = false;
    this.touch();
    return true;
  }

  removePlayer(playerId) {
    const removed = this.players.get(playerId);
    if (!removed) return null;
    this.players.delete(playerId);

    if (this.hostPlayerId === playerId) {
      this.hostPlayerId = this.players.values().next().value?.id ?? null;
    }

    if (this.status === ROOM_STATUS.PLAYING && !this.engine.isFinished?.(this.gameState)) {
      this.status = ROOM_STATUS.FINISHED;
      this.gameState = null;
      for (const player of this.players.values()) player.ready = false;
    }

    this.touch();
    return removed;
  }

  setReady(playerId, ready) {
    if (this.status === ROOM_STATUS.PLAYING) {
      throw new PublicError(ERROR_CODES.BAD_REQUEST, "Non puoi cambiare stato durante la partita.");
    }
    const player = this.players.get(playerId);
    if (!player) throw new PublicError(ERROR_CODES.NOT_IN_ROOM, "Non fai parte di questa stanza.");
    player.ready = Boolean(ready);
    this.touch();
  }

  getStartEligibility() {
    const connected = this.connectedPlayers;
    const allowed = this.game.players.allowed;
    const validPlayerCount = allowed
      ? allowed.includes(connected.length)
      : connected.length >= this.game.players.min && connected.length <= this.maxPlayers;
    const disconnectedPlayerIds = [...this.players.values()]
      .filter((player) => !player.connected)
      .map((player) => player.id);
    const notReadyPlayerIds = connected.filter((player) => !player.ready).map((player) => player.id);
    return {
      canStart: validPlayerCount && disconnectedPlayerIds.length === 0 && notReadyPlayerIds.length === 0,
      validPlayerCount,
      disconnectedPlayerIds,
      notReadyPlayerIds
    };
  }

  start(playerId) {
    if (this.hostPlayerId !== playerId) {
      throw new PublicError(ERROR_CODES.NOT_HOST, "Solo l'host può avviare la partita.");
    }
    if (!this.engine.implemented) {
      throw new PublicError(
        ERROR_CODES.GAME_NOT_IMPLEMENTED,
        `${this.game.name} ha già lobby, regole e contratto architetturale; il motore è il prossimo modulo da implementare.`
      );
    }

    const connected = this.connectedPlayers;
    const eligibility = this.getStartEligibility();
    if (!eligibility.canStart) {
      throw new PublicError(ERROR_CODES.NOT_READY, "Servono tutti i giocatori presenti e pronti.");
    }

    this.gameState = this.engine.start({ players: connected, settings: this.settings });
    this.status = ROOM_STATUS.PLAYING;
    this.touch();
  }

  applyAction(playerId, action, expectedVersion) {
    if (this.status !== ROOM_STATUS.PLAYING || !this.gameState) {
      throw new PublicError(ERROR_CODES.INVALID_ACTION, "La partita non è attiva.");
    }
    if (expectedVersion !== this.version) {
      throw new PublicError(ERROR_CODES.STALE_STATE, "Lo stato è cambiato: sincronizzazione aggiornata.", {
        currentVersion: this.version
      });
    }

    this.gameState = this.engine.applyAction({
      action,
      playerId,
      players: this.connectedPlayers,
      settings: this.settings,
      state: this.gameState
    });

    if (this.engine.isFinished(this.gameState)) {
      this.status = ROOM_STATUS.FINISHED;
      for (const player of this.players.values()) player.ready = false;
    }
    this.touch();
  }

  enqueue(operation) {
    const task = this.actionQueue.then(operation, operation);
    this.actionQueue = task.catch(() => undefined);
    return task;
  }

  publicSummary() {
    const host = this.players.get(this.hostPlayerId);
    return {
      code: this.code,
      gameId: this.gameId,
      gameName: this.game.name,
      hostName: host?.name ?? "—",
      playerCount: this.connectedPlayers.length,
      maxPlayers: this.maxPlayers,
      status: this.status,
      createdAt: this.createdAt
    };
  }

  viewFor(playerId) {
    const self = this.players.get(playerId);
    if (!self) return null;

    const { words: _secretWords, ...publicSettings } = this.settings;
    return {
      code: this.code,
      gameId: this.gameId,
      gameName: this.game.name,
      visibility: this.visibility,
      passwordProtected: this.isPasswordProtected,
      status: this.status,
      version: this.version,
      hostPlayerId: this.hostPlayerId,
      selfPlayerId: playerId,
      settings: publicSettings,
      startEligibility: this.getStartEligibility(),
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        name: player.name,
        ready: player.ready,
        connected: player.connected,
        isHost: player.id === this.hostPlayerId
      })),
      gameState: this.gameState ? this.engine.view(this.gameState, playerId) : null
    };
  }
}
