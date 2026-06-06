import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROTOCOL_VERSION,
  createHello,
  createWelcome,
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
