import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import {
  createHello,
  parseMessage,
  serializeMessage,
  type ServerMessage
} from "@snake3d/shared";
import { createGameServer } from "./server.ts";

function nextMessage(client: WebSocket): Promise<ServerMessage> {
  return new Promise<ServerMessage>((resolve, reject) => {
    client.once("message", (data: Buffer) => {
      resolve(parseMessage<ServerMessage>(data.toString()));
    });
    client.once("error", reject);
  });
}

function opened(client: WebSocket): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    client.once("open", () => resolve());
    client.once("error", reject);
  });
}

test("server sends a welcome envelope when a client connects", async () => {
  const server = await createGameServer({ port: 0, host: "127.0.0.1" });
  const client = new WebSocket(`ws://127.0.0.1:${server.port}`);

  try {
    const message = await nextMessage(client);
    assert.equal(message.type, "welcome");
    assert.ok(message.payload.clientId.length > 0);
    assert.equal(typeof message.payload.serverTime, "number");
  } finally {
    client.close();
    await server.close();
  }
});

test("server accepts a hello message from the client", async () => {
  const server = await createGameServer({ port: 0, host: "127.0.0.1" });
  const client = new WebSocket(`ws://127.0.0.1:${server.port}`);

  try {
    await opened(client);
    await nextMessage(client);
    client.send(serializeMessage(createHello("tester")));
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(client.readyState, WebSocket.OPEN);
  } finally {
    client.close();
    await server.close();
  }
});
