import assert from "node:assert/strict";
import test from "node:test";
import { CLIENT_EVENTS, SERVER_EVENTS } from "@sala13/shared";
import { io as createClient } from "socket.io-client";
import { createApplication } from "../src/create-application.js";

const testConfig = {
  host: "127.0.0.1",
  port: 0,
  environment: "test",
  allowedOrigins: [],
  disconnectGraceMs: 250,
  emptyRoomTtlMs: 250,
  staleRoomTtlMs: 60_000,
  socketRateWindowMs: 10_000,
  socketRateMaxEvents: 100
};

function emitAck(socket, event, payload = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Ack timeout for ${event}`)), 2_000);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

function nextRoomState(socket, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(SERVER_EVENTS.ROOM_STATE, handler);
      reject(new Error("room:state timeout"));
    }, 2_000);
    const handler = (room) => {
      if (!predicate(room)) return;
      clearTimeout(timer);
      socket.off(SERVER_EVENTS.ROOM_STATE, handler);
      resolve(room);
    };
    socket.on(SERVER_EVENTS.ROOM_STATE, handler);
  });
}

test("wildcard binding is reachable without using localhost as the server host", async (context) => {
  const application = createApplication({ ...testConfig, host: "0.0.0.0" });
  await new Promise((resolve) => application.httpServer.listen(0, "0.0.0.0", resolve));
  context.after(async () => application.close());

  const address = application.httpServer.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  const health = await response.json();

  assert.equal(response.status, 200);
  assert.equal(health.ok, true);
  assert.equal(health.version, "0.3.2");

  for (const path of ["/", "/device-mode.css", "/js/components/device-mode.js", "/js/utils/id.js"]) {
    const asset = await fetch(`http://127.0.0.1:${address.port}${path}`);
    assert.equal(asset.status, 200, path);
    assert.ok((await asset.text()).length > 0, path);
  }
});

test("two real Socket.IO clients can create, join and play a move", async (context) => {
  const application = createApplication(testConfig);
  await new Promise((resolve) => application.httpServer.listen(0, "127.0.0.1", resolve));
  context.after(async () => application.close());

  const address = application.httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;
  const first = createClient(url, { transports: ["websocket"], forceNew: true });
  const second = createClient(url, { transports: ["websocket"], forceNew: true });
  context.after(() => {
    first.disconnect();
    second.disconnect();
  });
  await Promise.all([
    new Promise((resolve) => first.once("connect", resolve)),
    new Promise((resolve) => second.once("connect", resolve))
  ]);

  const host = {
    playerId: "10000000-0000-4000-8000-000000000001",
    name: "Host"
  };
  const guest = {
    playerId: "20000000-0000-4000-8000-000000000002",
    name: "Guest"
  };
  const created = await emitAck(first, CLIENT_EVENTS.ROOM_CREATE, {
    ...host,
    gameId: "tic-tac-toe",
    visibility: "public",
    password: "",
    settings: { maxPlayers: 2 }
  });
  assert.equal(created.ok, true);

  const joined = await emitAck(second, CLIENT_EVENTS.ROOM_JOIN, {
    ...guest,
    code: created.room.code,
    password: ""
  });
  assert.equal(joined.ok, true);

  assert.equal((await emitAck(first, CLIENT_EVENTS.ROOM_READY, { ready: true })).ok, true);
  assert.equal((await emitAck(second, CLIENT_EVENTS.ROOM_READY, { ready: true })).ok, true);
  const started = await emitAck(first, CLIENT_EVENTS.ROOM_START);
  assert.equal(started.ok, true);
  assert.equal(started.room.status, "playing");

  const expectedVersion = started.room.version;
  const stateForGuest = nextRoomState(second, (room) => room.version > expectedVersion);
  const action = await emitAck(first, CLIENT_EVENTS.GAME_ACTION, {
    expectedVersion,
    action: { type: "place", cell: 4 }
  });
  assert.equal(action.ok, true);

  const guestView = await stateForGuest;
  assert.equal(guestView.gameState.board[4], "X");
  assert.equal(guestView.gameState.currentPlayerId, guest.playerId);
  assert.equal(guestView.gameState.yourMark, "O");
});

test("a new socket can reclaim the same private-room player during grace", async (context) => {
  const application = createApplication(testConfig);
  await new Promise((resolve) => application.httpServer.listen(0, "127.0.0.1", resolve));
  context.after(async () => application.close());

  const address = application.httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;
  const player = {
    playerId: "30000000-0000-4000-8000-000000000003",
    name: "Reconnect"
  };
  const firstSocket = createClient(url, { transports: ["websocket"], forceNew: true });
  await new Promise((resolve) => firstSocket.once("connect", resolve));
  const created = await emitAck(firstSocket, CLIENT_EVENTS.ROOM_CREATE, {
    ...player,
    gameId: "tic-tac-toe",
    visibility: "private",
    password: "secret",
    settings: { maxPlayers: 2 }
  });

  const disconnected = new Promise((resolve) => {
    const handler = ({ reason }) => {
      if (reason !== "disconnected") return;
      application.roomManager.off("room:changed", handler);
      resolve();
    };
    application.roomManager.on("room:changed", handler);
  });
  firstSocket.disconnect();
  await disconnected;

  const replacement = createClient(url, { transports: ["websocket"], forceNew: true });
  context.after(() => replacement.disconnect());
  await new Promise((resolve) => replacement.once("connect", resolve));
  const rejoined = await emitAck(replacement, CLIENT_EVENTS.ROOM_JOIN, {
    ...player,
    code: created.room.code,
    password: ""
  });

  assert.equal(rejoined.ok, true);
  assert.equal(rejoined.room.players.length, 1);
  assert.equal(rejoined.room.players[0].connected, true);
  assert.equal(rejoined.room.players[0].isHost, true);
});
