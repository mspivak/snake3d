import { test } from "node:test";
import assert from "node:assert/strict";
import { RoomManager } from "./rooms.ts";

const AMBIGUOUS = /[O0I1L]/;

test("createRoom returns a short shareable code without ambiguous chars", () => {
  const manager = new RoomManager();
  const room = manager.createRoom("host-1", "desktop");

  assert.ok(room.code.length >= 4 && room.code.length <= 6);
  assert.equal(AMBIGUOUS.test(room.code), false);
  assert.equal(room.hostId, "host-1");
  assert.equal(manager.roomCount(), 1);
});

test("createRoom generates unique codes", () => {
  const manager = new RoomManager();
  const codes = new Set<string>();
  for (let i = 0; i < 50; i += 1) {
    codes.add(manager.createRoom(`host-${i}`, "h").code);
  }
  assert.equal(codes.size, 50);
});

test("joinRoom assigns a stable player id and tracks membership", () => {
  const manager = new RoomManager();
  const room = manager.createRoom("host-1", "desktop");

  const result = manager.joinRoom(room.code, "phone");
  assert.equal("playerId" in result, true);
  if (!("playerId" in result)) {
    return;
  }
  assert.ok(result.playerId.length > 0);

  const members = manager.getPlayers(room.code);
  assert.equal(members.length, 1);
  assert.equal(members[0]!.id, result.playerId);
  assert.equal(members[0]!.name, "phone");
});

test("joinRoom on an unknown code returns a typed unknown-room error", () => {
  const manager = new RoomManager();
  const result = manager.joinRoom("ZZZZ", "phone");

  assert.equal("error" in result, true);
  if (!("error" in result)) {
    return;
  }
  assert.equal(result.error, "unknown-room");
});

test("removeConnection of a player drops them and notifies via room lookup", () => {
  const manager = new RoomManager();
  const room = manager.createRoom("host-1", "desktop");
  const joined = manager.joinRoom(room.code, "phone");
  assert.equal("playerId" in joined, true);
  if (!("playerId" in joined)) {
    return;
  }

  const removal = manager.removePlayer(room.code, joined.playerId);
  assert.equal(removal?.roomCode, room.code);
  assert.equal(removal?.hostId, "host-1");
  assert.equal(manager.getPlayers(room.code).length, 0);
  assert.equal(manager.roomCount(), 1);
});

test("removing the host deletes the room", () => {
  const manager = new RoomManager();
  const room = manager.createRoom("host-1", "desktop");
  manager.joinRoom(room.code, "phone");

  manager.removeHost(room.code);
  assert.equal(manager.roomCount(), 0);
  assert.equal(manager.getPlayers(room.code).length, 0);
});

test("an empty room is removed once its host leaves", () => {
  const manager = new RoomManager();
  const room = manager.createRoom("host-1", "desktop");
  assert.equal(manager.roomCount(), 1);

  manager.removeHost(room.code);
  assert.equal(manager.roomCount(), 0);
});
