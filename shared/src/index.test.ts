import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROTOCOL_VERSION,
  createHello,
  createWelcome,
  createCreateRoom,
  createRoomCreated,
  createJoinRoom,
  createJoined,
  createJoinError,
  createPlayerJoined,
  createPlayerLeft,
  parseMessage,
  serializeMessage,
  type ClientMessage,
  type ServerMessage
} from "./index.ts";

test("createHello builds a versioned hello envelope", () => {
  const msg = createHello("alice");
  assert.equal(msg.type, "hello");
  assert.equal(msg.protocolVersion, PROTOCOL_VERSION);
  assert.equal(msg.payload.clientName, "alice");
});

test("createWelcome builds a versioned welcome envelope", () => {
  const msg = createWelcome("client-1", 1234);
  assert.equal(msg.type, "welcome");
  assert.equal(msg.protocolVersion, PROTOCOL_VERSION);
  assert.equal(msg.payload.clientId, "client-1");
  assert.equal(msg.payload.serverTime, 1234);
});

test("serialize then parse round-trips a client message", () => {
  const original = createHello("bob");
  const raw = serializeMessage(original);
  const parsed = parseMessage<ClientMessage>(raw);
  assert.deepEqual(parsed, original);
});

test("serialize then parse round-trips a server message", () => {
  const original = createWelcome("client-2", 99);
  const raw = serializeMessage(original);
  const parsed = parseMessage<ServerMessage>(raw);
  assert.deepEqual(parsed, original);
});

test("parseMessage rejects an unsupported protocol version", () => {
  const raw = JSON.stringify({ type: "hello", protocolVersion: 999, payload: {} });
  assert.throws(() => parseMessage(raw), /Unsupported protocol version/);
});

test("parseMessage rejects a message without a type", () => {
  const raw = JSON.stringify({ protocolVersion: PROTOCOL_VERSION, payload: {} });
  assert.throws(() => parseMessage(raw), /missing a string type/);
});

test("createCreateRoom builds a versioned create-room envelope", () => {
  const msg = createCreateRoom("desktop");
  assert.equal(msg.type, "create-room");
  assert.equal(msg.protocolVersion, PROTOCOL_VERSION);
  assert.equal(msg.payload.hostName, "desktop");
});

test("createRoomCreated builds a versioned room-created envelope", () => {
  const msg = createRoomCreated("ABCD", "host-1");
  assert.equal(msg.type, "room-created");
  assert.equal(msg.payload.roomCode, "ABCD");
  assert.equal(msg.payload.hostId, "host-1");
});

test("createJoinRoom builds a versioned join-room envelope", () => {
  const msg = createJoinRoom("ABCD", "phone");
  assert.equal(msg.type, "join-room");
  assert.equal(msg.payload.roomCode, "ABCD");
  assert.equal(msg.payload.playerName, "phone");
});

test("createJoined builds a versioned joined envelope", () => {
  const msg = createJoined("ABCD", "player-1");
  assert.equal(msg.type, "joined");
  assert.equal(msg.payload.roomCode, "ABCD");
  assert.equal(msg.payload.playerId, "player-1");
});

test("createJoinError carries a typed error code", () => {
  const msg = createJoinError("ZZZZ", "unknown-room", "No such room");
  assert.equal(msg.type, "join-error");
  assert.equal(msg.payload.code, "unknown-room");
  assert.equal(msg.payload.message, "No such room");
});

test("createPlayerJoined and createPlayerLeft build host notifications", () => {
  const joined = createPlayerJoined("ABCD", "player-1", "phone");
  assert.equal(joined.type, "player-joined");
  assert.equal(joined.payload.playerName, "phone");

  const left = createPlayerLeft("ABCD", "player-1");
  assert.equal(left.type, "player-left");
  assert.equal(left.payload.playerId, "player-1");
});

test("serialize then parse round-trips a room-created message", () => {
  const original = createRoomCreated("WXYZ", "host-9");
  const parsed = parseMessage<ServerMessage>(serializeMessage(original));
  assert.deepEqual(parsed, original);
});
