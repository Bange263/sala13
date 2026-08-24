import assert from "node:assert/strict";
import test from "node:test";
import { ERROR_CODES } from "@sala13/shared";
import { RoomManager } from "../src/rooms/room-manager.js";

const config = {
  disconnectGraceMs: 10,
  emptyRoomTtlMs: 10,
  staleRoomTtlMs: 60_000
};

function player(index) {
  return {
    playerId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    socketId: `socket-${index}`,
    name: `Player ${index}`
  };
}

test("creates, lists and removes a public room", async (context) => {
  const manager = new RoomManager(config);
  context.after(() => manager.close());
  const room = manager.createRoom({
    ...player(1),
    gameId: "tic-tac-toe",
    settings: { maxPlayers: 2 },
    visibility: "public"
  });

  assert.equal(manager.getPublicLobbies().length, 1);
  assert.equal(manager.getPublicLobbies()[0].code, room.code);
  assert.equal(room.viewFor(player(1).playerId).passwordDigest, undefined);

  const deleted = new Promise((resolve) => manager.once("room:deleted", resolve));
  manager.leaveSocket(player(1).socketId, { immediate: true });
  await deleted;
  assert.equal(manager.rooms.size, 0);
});

test("keeps private rooms out of the public list and validates password", (context) => {
  const manager = new RoomManager(config);
  context.after(() => manager.close());
  const room = manager.createRoom({
    ...player(1),
    gameId: "uno",
    password: "classroom-secret",
    settings: { maxPlayers: 4 },
    visibility: "private"
  });

  assert.equal(manager.getPublicLobbies().length, 0);
  assert.throws(
    () => manager.joinRoom({ ...player(2), code: room.code, password: "wrong" }),
    (error) => error.code === ERROR_CODES.WRONG_PASSWORD
  );

  manager.joinRoom({ ...player(2), code: room.code, password: "classroom-secret" });
  assert.equal(room.players.size, 2);
});

test("serial state versions reject stale Tic-Tac-Toe actions", async (context) => {
  const manager = new RoomManager(config);
  context.after(() => manager.close());
  const room = manager.createRoom({
    ...player(1),
    gameId: "tic-tac-toe",
    settings: { maxPlayers: 2 },
    visibility: "public"
  });
  manager.joinRoom({ ...player(2), code: room.code, password: "" });
  manager.setReady(player(1).socketId, true);
  manager.setReady(player(2).socketId, true);
  manager.start(player(1).socketId);

  const expectedVersion = room.version;
  await manager.applyAction(player(1).socketId, {
    expectedVersion,
    action: { type: "place", cell: 0 }
  });

  await assert.rejects(
    manager.applyAction(player(2).socketId, {
      expectedVersion,
      action: { type: "place", cell: 1 }
    }),
    (error) => error.code === ERROR_CODES.STALE_STATE
  );
});

test("start eligibility is false until every connected player is ready", (context) => {
  const manager = new RoomManager(config);
  context.after(() => manager.close());
  const room = manager.createRoom({
    ...player(1),
    gameId: "tic-tac-toe",
    settings: { maxPlayers: 2 },
    visibility: "public"
  });
  manager.joinRoom({ ...player(2), code: room.code, password: "" });
  assert.equal(room.getStartEligibility().canStart, false);
  assert.throws(() => manager.start(player(1).socketId), (error) => error.code === ERROR_CODES.NOT_READY);
  manager.setReady(player(1).socketId, true);
  assert.equal(room.getStartEligibility().canStart, false);
  manager.setReady(player(2).socketId, true);
  assert.equal(room.getStartEligibility().canStart, true);
  manager.setReady(player(2).socketId, false);
  assert.equal(room.getStartEligibility().canStart, false);
});

test("secret Hangman word lists never appear in room settings sent to clients", (context) => {
  const manager = new RoomManager(config);
  context.after(() => manager.close());
  const room = manager.createRoom({
    ...player(1),
    gameId: "hangman",
    settings: { maxPlayers: 2, words: ["segretissima"] },
    visibility: "private",
    password: ""
  });
  assert.equal(room.viewFor(player(1).playerId).settings.words, undefined);
});
