import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import {
  createHello,
  createCreateRoom,
  createJoinRoom,
  parseMessage,
  serializeMessage,
  type ServerMessage
} from "@snake3d/shared";
import { createGameServer } from "./server.ts";

function expect(client: WebSocket, type: ServerMessage["type"]): Promise<ServerMessage> {
  return new Promise<ServerMessage>((resolve, reject) => {
    function onMessage(data: Buffer): void {
      const message = parseMessage<ServerMessage>(data.toString());
      if (message.type === type) {
        client.off("message", onMessage);
        resolve(message);
      }
    }
    client.on("message", onMessage);
    client.once("error", reject);
  });
}

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

test("host creates a room and receives a short shareable code", async () => {
  const server = await createGameServer({ port: 0, host: "127.0.0.1" });
  const host = new WebSocket(`ws://127.0.0.1:${server.port}`);

  try {
    await opened(host);
    host.send(serializeMessage(createCreateRoom("desktop")));
    const created = await expect(host, "room-created");
    assert.equal(created.type, "room-created");
    if (created.type !== "room-created") {
      return;
    }
    assert.ok(created.payload.roomCode.length >= 4 && created.payload.roomCode.length <= 6);
    assert.equal(server.rooms.roomCount(), 1);
  } finally {
    host.close();
    await server.close();
  }
});

test("player joins by code, gets a stable id, host is notified", async () => {
  const server = await createGameServer({ port: 0, host: "127.0.0.1" });
  const host = new WebSocket(`ws://127.0.0.1:${server.port}`);
  let player: WebSocket | undefined;

  try {
    await opened(host);
    host.send(serializeMessage(createCreateRoom("desktop")));
    const created = await expect(host, "room-created");
    if (created.type !== "room-created") {
      return;
    }
    const code = created.payload.roomCode;

    player = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await opened(player);
    const hostNotified = expect(host, "player-joined");
    player.send(serializeMessage(createJoinRoom(code, "phone")));

    const joined = await expect(player, "joined");
    if (joined.type !== "joined") {
      return;
    }
    assert.equal(joined.payload.roomCode, code);
    assert.ok(joined.payload.playerId.length > 0);

    const notice = await hostNotified;
    if (notice.type !== "player-joined") {
      return;
    }
    assert.equal(notice.payload.playerId, joined.payload.playerId);
    assert.equal(notice.payload.playerName, "phone");
  } finally {
    host.close();
    player?.close();
    await server.close();
  }
});

test("joining an unknown code returns a typed join-error", async () => {
  const server = await createGameServer({ port: 0, host: "127.0.0.1" });
  const player = new WebSocket(`ws://127.0.0.1:${server.port}`);

  try {
    await opened(player);
    player.send(serializeMessage(createJoinRoom("ZZZZZ", "phone")));
    const error = await expect(player, "join-error");
    if (error.type !== "join-error") {
      return;
    }
    assert.equal(error.payload.code, "unknown-room");
  } finally {
    player.close();
    await server.close();
  }
});

test("host is notified and room cleaned up when a player disconnects", async () => {
  const server = await createGameServer({ port: 0, host: "127.0.0.1" });
  const host = new WebSocket(`ws://127.0.0.1:${server.port}`);
  let player: WebSocket | undefined;

  try {
    await opened(host);
    host.send(serializeMessage(createCreateRoom("desktop")));
    const created = await expect(host, "room-created");
    if (created.type !== "room-created") {
      return;
    }
    const code = created.payload.roomCode;

    player = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await opened(player);
    player.send(serializeMessage(createJoinRoom(code, "phone")));
    await expect(player, "joined");
    await expect(host, "player-joined");

    const left = expect(host, "player-left");
    player.close();
    const notice = await left;
    if (notice.type !== "player-left") {
      return;
    }
    assert.equal(notice.payload.roomCode, code);
    assert.equal(server.rooms.getPlayers(code).length, 0);
  } finally {
    host.close();
    player?.close();
    await server.close();
  }
});

test("room is removed when the host disconnects", async () => {
  const server = await createGameServer({ port: 0, host: "127.0.0.1" });
  const host = new WebSocket(`ws://127.0.0.1:${server.port}`);

  try {
    await opened(host);
    host.send(serializeMessage(createCreateRoom("desktop")));
    await expect(host, "room-created");
    assert.equal(server.rooms.roomCount(), 1);

    host.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(server.rooms.roomCount(), 0);
  } finally {
    host.close();
    await server.close();
  }
});
