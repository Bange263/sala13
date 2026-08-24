import {
  CLIENT_EVENTS,
  ERROR_CODES,
  SERVER_EVENTS
} from "@sala13/shared";
import { SocketRateLimiter } from "../security/socket-rate-limiter.js";
import { PublicError, toClientError } from "../utils/public-error.js";
import {
  createRoomSchema,
  gameActionSchema,
  joinRoomSchema,
  readySchema
} from "./schemas.js";

function ackSafely(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function validationError(result) {
  return new PublicError(ERROR_CODES.BAD_REQUEST, "Dati non validi.", {
    fields: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  });
}

export function registerSocketHandlers(io, roomManager, config) {
  const limiter = new SocketRateLimiter({
    windowMs: config.socketRateWindowMs,
    maxEvents: config.socketRateMaxEvents
  });

  const emitLobbySnapshot = (target = io) => {
    target.emit(SERVER_EVENTS.LOBBY_SNAPSHOT, roomManager.getPublicLobbies());
  };

  const emitPresence = () => {
    io.emit(SERVER_EVENTS.PRESENCE, { connectedClients: io.engine.clientsCount });
  };

  const emitRoomState = (room) => {
    for (const player of room.players.values()) {
      if (!player.connected || !player.socketId) continue;
      const view = room.viewFor(player.id);
      if (view) io.to(player.socketId).emit(SERVER_EVENTS.ROOM_STATE, view);
    }
  };

  roomManager.on("room:changed", ({ room }) => {
    emitRoomState(room);
    emitLobbySnapshot();
  });

  roomManager.on("room:deleted", ({ room, reason }) => {
    for (const player of room.players.values()) {
      if (player.socketId) {
        io.to(player.socketId).emit(SERVER_EVENTS.ROOM_CLOSED, { code: room.code, reason });
      }
    }
    emitLobbySnapshot();
  });

  io.on("connection", (socket) => {
    emitLobbySnapshot(socket);
    emitPresence();

    const guarded = (schema, handler) => async (payload = {}, ack) => {
      try {
        if (!limiter.consume(socket.id)) {
          throw new PublicError(ERROR_CODES.RATE_LIMITED, "Troppe richieste: attendi qualche secondo.");
        }
        const parsed = schema ? schema.safeParse(payload) : { success: true, data: payload };
        if (!parsed.success) throw validationError(parsed);
        const data = await handler(parsed.data);
        ackSafely(ack, { ok: true, ...data });
      } catch (error) {
        const clientError = toClientError(error);
        socket.emit(SERVER_EVENTS.GAME_ERROR, clientError);
        const membership = roomManager.peekMembership(socket.id);
        const room = membership ? roomManager.rooms.get(membership.code) : null;
        if (room) emitRoomState(room);
        ackSafely(ack, { ok: false, error: clientError });
      }
    };

    socket.on(
      CLIENT_EVENTS.LOBBY_LIST,
      guarded(null, async () => ({ lobbies: roomManager.getPublicLobbies() }))
    );

    socket.on(
      CLIENT_EVENTS.ROOM_CREATE,
      guarded(createRoomSchema, async (input) => {
        const current = roomManager.peekMembership(socket.id);
        if (current) {
          roomManager.leaveSocket(socket.id, { immediate: true });
          await socket.leave(current.code);
        }

        const room = roomManager.createRoom({ ...input, socketId: socket.id });
        await socket.join(room.code);
        emitRoomState(room);
        return { room: room.viewFor(input.playerId) };
      })
    );

    socket.on(
      CLIENT_EVENTS.ROOM_JOIN,
      guarded(joinRoomSchema, async (input) => {
        const current = roomManager.peekMembership(socket.id);
        if (current && (current.code !== input.code || current.playerId !== input.playerId)) {
          roomManager.leaveSocket(socket.id, { immediate: true });
          await socket.leave(current.code);
        }

        const { room, replacedSocketId } = roomManager.joinRoom({ ...input, socketId: socket.id });
        await socket.join(room.code);

        if (replacedSocketId && replacedSocketId !== socket.id) {
          const replaced = io.sockets.sockets.get(replacedSocketId);
          replaced?.emit(SERVER_EVENTS.ROOM_CLOSED, { code: room.code, reason: "session-replaced" });
          await replaced?.leave(room.code);
        }

        emitRoomState(room);
        return { room: room.viewFor(input.playerId) };
      })
    );

    socket.on(
      CLIENT_EVENTS.ROOM_READY,
      guarded(readySchema, async ({ ready }) => {
        const room = roomManager.setReady(socket.id, ready);
        return { room: room.viewFor(roomManager.getMembership(socket.id).playerId) };
      })
    );

    socket.on(
      CLIENT_EVENTS.ROOM_START,
      guarded(null, async () => {
        const room = roomManager.start(socket.id);
        return { room: room.viewFor(roomManager.getMembership(socket.id).playerId) };
      })
    );

    socket.on(
      CLIENT_EVENTS.GAME_ACTION,
      guarded(gameActionSchema, async (input) => {
        const room = await roomManager.applyAction(socket.id, input);
        return { version: room.version };
      })
    );

    socket.on(
      CLIENT_EVENTS.ROOM_LEAVE,
      guarded(null, async () => {
        const membership = roomManager.peekMembership(socket.id);
        const result = roomManager.leaveSocket(socket.id, { immediate: true });
        if (membership) await socket.leave(membership.code);
        return { left: Boolean(result) };
      })
    );

    socket.on("disconnect", () => {
      limiter.delete(socket.id);
      roomManager.leaveSocket(socket.id, { immediate: false });
      emitPresence();
    });
  });

  return { emitLobbySnapshot, emitRoomState };
}
