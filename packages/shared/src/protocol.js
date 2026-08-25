export const CLIENT_EVENTS = Object.freeze({
  LOBBY_LIST: "lobby:list",
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_KICK: "room:kick",
  ROOM_ADD_BOT: "room:add-bot",
  ROOM_READY: "room:ready",
  ROOM_START: "room:start",
  GAME_ACTION: "game:action"
});

export const SERVER_EVENTS = Object.freeze({
  LOBBY_SNAPSHOT: "lobby:snapshot",
  ROOM_STATE: "room:state",
  ROOM_CLOSED: "room:closed",
  GAME_ERROR: "game:error",
  PRESENCE: "presence:update"
});

export const ROOM_VISIBILITY = Object.freeze({
  PUBLIC: "public",
  PRIVATE: "private"
});

export const ROOM_STATUS = Object.freeze({
  LOBBY: "lobby",
  PLAYING: "playing",
  FINISHED: "finished"
});

export const ERROR_CODES = Object.freeze({
  BAD_REQUEST: "BAD_REQUEST",
  RATE_LIMITED: "RATE_LIMITED",
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_FULL: "ROOM_FULL",
  WRONG_PASSWORD: "WRONG_PASSWORD",
  NOT_IN_ROOM: "NOT_IN_ROOM",
  NOT_HOST: "NOT_HOST",
  NOT_READY: "NOT_READY",
  GAME_NOT_IMPLEMENTED: "GAME_NOT_IMPLEMENTED",
  INVALID_ACTION: "INVALID_ACTION",
  STALE_STATE: "STALE_STATE",
  INTERNAL_ERROR: "INTERNAL_ERROR"
});
