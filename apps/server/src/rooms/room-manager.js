import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { ERROR_CODES, ROOM_VISIBILITY } from "@sala13/shared";
import { resolveGame } from "../games/game-registry.js";
import { PublicError } from "../utils/public-error.js";
import { generateRoomCode } from "../utils/room-code.js";
import { Room } from "./room.js";

export class RoomManager extends EventEmitter {
  constructor({ disconnectGraceMs, emptyRoomTtlMs, staleRoomTtlMs }) {
    super();
    this.rooms = new Map();
    this.socketMembership = new Map();
    this.playerTimers = new Map();
    this.emptyTimers = new Map();
    this.deadlineTimers = new Map();
    this.disconnectGraceMs = disconnectGraceMs;
    this.emptyRoomTtlMs = emptyRoomTtlMs;
    this.staleRoomTtlMs = staleRoomTtlMs;
    this.sweeper = setInterval(() => this.sweep(), Math.min(60_000, staleRoomTtlMs));
    this.sweeper.unref?.();
  }

  createRoom({ gameId, name, password, playerId, settings = {}, socketId, visibility }) {
    const game = resolveGame(gameId);
    if (!game) throw new PublicError(ERROR_CODES.BAD_REQUEST, "Gioco non riconosciuto.");

    const normalizedSettings = this.normalizeSettings(game.definition, settings);
    game.engine.validateSettings?.(normalizedSettings);
    let code;
    do code = generateRoomCode(); while (this.rooms.has(code));

    const room = new Room({
      code,
      game,
      host: { name, playerId, socketId },
      password,
      settings: normalizedSettings,
      visibility
    });
    this.rooms.set(code, room);
    this.socketMembership.set(socketId, { code, playerId });
    this.emitChanged(room, "created");
    return room;
  }

  joinRoom({ code, name, password, playerId, socketId }) {
    const normalizedCode = code.trim().toUpperCase();
    const room = this.rooms.get(normalizedCode);
    if (!room) throw new PublicError(ERROR_CODES.ROOM_NOT_FOUND, "Stanza non trovata.");

    this.clearPlayerTimer(normalizedCode, playerId);
    this.clearEmptyTimer(normalizedCode);
    const result = room.addPlayer({ name, password, playerId, socketId });
    if (result.replacedSocketId && result.replacedSocketId !== socketId) {
      this.socketMembership.delete(result.replacedSocketId);
    }
    this.socketMembership.set(socketId, { code: normalizedCode, playerId });
    this.emitChanged(room, "joined");
    return { room, ...result };
  }

  leaveSocket(socketId, { immediate = true } = {}) {
    const membership = this.socketMembership.get(socketId);
    if (!membership) return null;
    this.socketMembership.delete(socketId);

    const room = this.rooms.get(membership.code);
    if (!room) return null;

    if (immediate) {
      this.clearPlayerTimer(membership.code, membership.playerId);
      room.removePlayer(membership.playerId);
      this.afterPlayerRemoval(room, "left");
      return { room, ...membership };
    }

    room.markDisconnected(membership.playerId);
    this.emitChanged(room, "disconnected");
    const timerKey = this.playerTimerKey(membership.code, membership.playerId);
    const timer = setTimeout(() => {
      this.playerTimers.delete(timerKey);
      const currentRoom = this.rooms.get(membership.code);
      const player = currentRoom?.players.get(membership.playerId);
      if (!currentRoom || player?.connected) return;
      currentRoom.removePlayer(membership.playerId);
      this.afterPlayerRemoval(currentRoom, "disconnect-timeout");
    }, this.disconnectGraceMs);
    timer.unref?.();
    this.playerTimers.set(timerKey, timer);

    if (room.connectedPlayers.length === 0) this.scheduleEmptyDelete(room);
    return { room, ...membership };
  }

  setReady(socketId, ready) {
    const { room, playerId } = this.getMembership(socketId);
    room.setReady(playerId, ready);
    this.emitChanged(room, "ready");
    return room;
  }

  kick(socketId, targetPlayerId) {
    const { room, playerId } = this.getMembership(socketId);
    if (room.hostPlayerId !== playerId) throw new PublicError(ERROR_CODES.NOT_HOST, "Solo l'host può espellere un giocatore.");
    if (targetPlayerId === playerId) throw new PublicError(ERROR_CODES.BAD_REQUEST, "L'host non può espellere se stesso.");
    const target = room.players.get(targetPlayerId);
    if (!target) throw new PublicError(ERROR_CODES.BAD_REQUEST, "Giocatore non trovato.");
    if (target.socketId) this.socketMembership.delete(target.socketId);
    room.removePlayer(targetPlayerId, { reason: "kicked" });
    this.afterPlayerRemoval(room, "kicked");
    return { room, removed: target };
  }

  addBot(socketId) {
    const { room, playerId } = this.getMembership(socketId);
    if (room.hostPlayerId !== playerId) throw new PublicError(ERROR_CODES.NOT_HOST, "Solo l'host può aggiungere un'IA.");
    if (!room.engine.botAction) throw new PublicError(ERROR_CODES.BAD_REQUEST, "L'IA non è ancora disponibile per questa modalità.");
    room.addBot({
      playerId: randomUUID(),
      name: `IA ${room.players.size}`
    });
    this.emitChanged(room, "bot-added");
    return room;
  }

  start(socketId) {
    const { room, playerId } = this.getMembership(socketId);
    room.start(playerId);
    this.emitChanged(room, "started");
    return room;
  }

  async applyAction(socketId, { action, expectedVersion }) {
    const { room, playerId } = this.getMembership(socketId);
    await room.enqueue(() => room.applyAction(playerId, action, expectedVersion));
    this.emitChanged(room, "game-action");
    return room;
  }

  getMembership(socketId) {
    const membership = this.socketMembership.get(socketId);
    const room = membership ? this.rooms.get(membership.code) : null;
    if (!membership || !room || !room.players.has(membership.playerId)) {
      throw new PublicError(ERROR_CODES.NOT_IN_ROOM, "Non fai parte di una stanza.");
    }
    return { room, ...membership };
  }

  peekMembership(socketId) {
    const membership = this.socketMembership.get(socketId);
    return membership ? { ...membership } : null;
  }

  getPublicLobbies() {
    return [...this.rooms.values()]
      .filter((room) => room.visibility === ROOM_VISIBILITY.PUBLIC)
      .map((room) => room.publicSummary())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  normalizeSettings(game, settings) {
    const parsedMax = Number(settings.maxPlayers ?? game.players.max);
    const requestedMax = Number.isInteger(parsedMax) ? parsedMax : game.players.max;
    const maxPlayers = Math.min(game.players.max, Math.max(game.players.min, requestedMax));
    if (game.players.allowed && !game.players.allowed.includes(maxPlayers)) {
      throw new PublicError(
        ERROR_CODES.BAD_REQUEST,
        `Numero giocatori non valido: scegli ${game.players.allowed.join(" o ")}.`
      );
    }
    return {
      maxPlayers,
      ...(typeof settings.variant === "string" ? { variant: settings.variant.slice(0, 32) } : {}),
      ...(typeof settings.mode === "string" ? { mode: settings.mode.slice(0, 32) } : {}),
      ...(typeof settings.stacking === "boolean" ? { stacking: settings.stacking } : {}),
      ...(Array.isArray(settings.categories) ? { categories: settings.categories.slice(0, 20) } : {}),
      ...(Array.isArray(settings.words) ? { words: settings.words.slice(0, 100) } : {}),
      ...(Number.isInteger(settings.roundSeconds) ? { roundSeconds: settings.roundSeconds } : {}),
      ...(Number.isInteger(settings.promptSeconds) ? { promptSeconds: settings.promptSeconds } : {}),
      ...(Number.isInteger(settings.maxRounds) ? { maxRounds: settings.maxRounds } : {}),
      ...(Number.isInteger(settings.startingChips) ? { startingChips: settings.startingChips } : {}),
      ...(Number.isInteger(settings.baseBet) ? { baseBet: settings.baseBet } : {}),
      ...(Number.isInteger(settings.maxBet) ? { maxBet: settings.maxBet } : {}),
      ...(Number.isInteger(settings.bigBlind) ? { bigBlind: settings.bigBlind } : {}),
      ...(typeof settings.hangmanMode === "string" ? { hangmanMode: settings.hangmanMode } : {}),
      ...(typeof settings.customWord === "string" ? { customWord: settings.customWord.slice(0, 12) } : {}),
      ...(typeof settings.dealerHitsSoft17 === "boolean" ? { dealerHitsSoft17: settings.dealerHitsSoft17 } : {})
    };
  }

  afterPlayerRemoval(room, reason) {
    if (room.players.size === 0) {
      this.scheduleEmptyDelete(room, true);
    } else {
      this.emitChanged(room, reason);
    }
  }

  scheduleEmptyDelete(room, immediate = false) {
    this.clearEmptyTimer(room.code);
    const delay = immediate ? 0 : this.emptyRoomTtlMs;
    const timer = setTimeout(() => {
      this.emptyTimers.delete(room.code);
      const current = this.rooms.get(room.code);
      if (current && current.connectedPlayers.length === 0) this.deleteRoom(room.code, "empty");
    }, delay);
    timer.unref?.();
    this.emptyTimers.set(room.code, timer);
  }

  deleteRoom(code, reason) {
    const room = this.rooms.get(code);
    if (!room) return;
    this.rooms.delete(code);
    this.clearEmptyTimer(code);
    this.clearDeadlineTimer(code);
    for (const player of room.players.values()) {
      this.clearPlayerTimer(code, player.id);
      if (player.socketId) this.socketMembership.delete(player.socketId);
    }
    this.emit("room:deleted", { room, reason });
  }

  sweep(now = Date.now()) {
    for (const room of this.rooms.values()) {
      if (now - room.updatedAt >= this.staleRoomTtlMs) this.deleteRoom(room.code, "stale");
    }
  }

  emitChanged(room, reason) {
    this.scheduleDeadline(room);
    this.emit("room:changed", { room, reason });
  }

  scheduleDeadline(room) {
    this.clearDeadlineTimer(room.code);
    const deadline = room.status === "playing" ? Number(room.gameState?.deadline) : 0;
    if (!Number.isFinite(deadline) || deadline <= 0 || !room.engine.onTimeout) return;
    const timer = setTimeout(async () => {
      this.deadlineTimers.delete(room.code);
      const current = this.rooms.get(room.code);
      if (!current) return;
      const changed = await current.enqueue(() => current.applyTimeout(Date.now()));
      if (changed) this.emitChanged(current, "game-timeout");
    }, Math.max(0, deadline - Date.now() + 25));
    timer.unref?.();
    this.deadlineTimers.set(room.code, timer);
  }

  clearDeadlineTimer(code) {
    const timer = this.deadlineTimers.get(code);
    if (timer) clearTimeout(timer);
    this.deadlineTimers.delete(code);
  }

  playerTimerKey(code, playerId) {
    return `${code}:${playerId}`;
  }

  clearPlayerTimer(code, playerId) {
    const key = this.playerTimerKey(code, playerId);
    const timer = this.playerTimers.get(key);
    if (timer) clearTimeout(timer);
    this.playerTimers.delete(key);
  }

  clearEmptyTimer(code) {
    const timer = this.emptyTimers.get(code);
    if (timer) clearTimeout(timer);
    this.emptyTimers.delete(code);
  }

  close() {
    clearInterval(this.sweeper);
    for (const timer of this.playerTimers.values()) clearTimeout(timer);
    for (const timer of this.emptyTimers.values()) clearTimeout(timer);
    for (const timer of this.deadlineTimers.values()) clearTimeout(timer);
  }
}
