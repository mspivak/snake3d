import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIRECTIONS,
  createGameStateMessage,
  type GameStateMessage,
  type ServerMessage
} from "@snake3d/shared";
import { createGameState } from "./game.ts";
import {
  buildGameStateMessages,
  createRoomGame,
  startRound,
  tickRoomGame,
  startGameLoop,
  type RoomMember
} from "./loop.ts";

function hostMember(sink: ServerMessage[]): RoomMember {
  return { role: "host", send: (m) => sink.push(m) };
}

function playerMember(playerId: string, sink: ServerMessage[]): RoomMember {
  return { role: "player", playerId, send: (m) => sink.push(m) };
}

test("buildGameStateMessages addresses the host with no youPlayerId", () => {
  const state = createGameState(["p1", "p2"]);
  const host = hostMember([]);
  const messages = buildGameStateMessages(state, [host], "playing");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].message.type, "game-state");
  assert.equal(messages[0].message.payload.youPlayerId, undefined);
});

test("buildGameStateMessages gives each player their own youPlayerId", () => {
  const state = createGameState(["p1", "p2"]);
  const host = hostMember([]);
  const p1 = playerMember("p1", []);
  const p2 = playerMember("p2", []);
  const messages = buildGameStateMessages(state, [host, p1, p2], "playing");
  assert.equal(messages.length, 3);
  const byMember = new Map(messages.map((m) => [m.member, m.message]));
  assert.equal(byMember.get(host)!.payload.youPlayerId, undefined);
  assert.equal(byMember.get(p1)!.payload.youPlayerId, "p1");
  assert.equal(byMember.get(p2)!.payload.youPlayerId, "p2");
});

test("a tick produces a game-state message addressed to host and each player", () => {
  const hostSink: ServerMessage[] = [];
  const p1Sink: ServerMessage[] = [];
  const p2Sink: ServerMessage[] = [];
  const room = createRoomGame(["p1", "p2"], 1);
  room.members.push(hostMember(hostSink));
  room.members.push(playerMember("p1", p1Sink));
  room.members.push(playerMember("p2", p2Sink));

  const before = room.state.tick;
  tickRoomGame(room);

  assert.equal(room.state.tick, before + 1);
  const host = hostSink[0] as GameStateMessage;
  const p1 = p1Sink[0] as GameStateMessage;
  const p2 = p2Sink[0] as GameStateMessage;
  assert.equal(host.type, "game-state");
  assert.equal(host.payload.youPlayerId, undefined);
  assert.equal(p1.payload.youPlayerId, "p1");
  assert.equal(p2.payload.youPlayerId, "p2");
  assert.equal(host.payload.state.tick, before + 1);
});

test("tick consumes collected direction inputs and clears them", () => {
  const room = createRoomGame(["p1"], 1);
  room.inputs["p1"] = DIRECTIONS["+y"];
  const headBefore = room.state.snakes[0].cells[0];
  tickRoomGame(room);
  const headAfter = room.state.snakes[0].cells[0];
  assert.equal(headAfter.y, headBefore.y + 1);
  assert.deepEqual(room.inputs, {});
});

test("startGameLoop ticks repeatedly and stop halts it", async () => {
  const sink: ServerMessage[] = [];
  const room = createRoomGame(["p1"], 1);
  room.members.push(playerMember("p1", sink));
  const stop = startGameLoop(room, 100);
  await new Promise((resolve) => setTimeout(resolve, 60));
  stop();
  const ticked = sink.length;
  assert.ok(ticked >= 2, `expected at least 2 ticks, got ${ticked}`);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(sink.length, ticked);
});

test("a fresh room game starts in the lobby phase with no snakes", () => {
  const room = createRoomGame();
  assert.equal(room.phase, "lobby");
  assert.equal(room.state.snakes.length, 0);
});

test("startRound creates one snake per current player and enters playing", () => {
  const room = createRoomGame();
  startRound(room, ["p1", "p2", "p3"]);
  assert.equal(room.phase, "playing");
  assert.equal(room.state.snakes.length, 3);
  assert.deepEqual(room.state.snakes.map((s) => s.playerId).sort(), ["p1", "p2", "p3"]);
});

test("startRound resets a finished round from the current roster", () => {
  const room = createRoomGame();
  startRound(room, ["p1"]);
  room.phase = "over";
  startRound(room, ["p1", "p2"]);
  assert.equal(room.phase, "playing");
  assert.equal(room.state.snakes.length, 2);
  assert.equal(room.state.tick, 0);
});

test("tick sets phase to over when the round ends", () => {
  const room = createRoomGame();
  startRound(room, ["solo"], 1, 2);
  for (let i = 0; i < 20 && room.phase === "playing"; i += 1) {
    tickRoomGame(room);
  }
  assert.equal(room.phase, "over");
});

test("game-state messages carry the room phase", () => {
  const sink: ServerMessage[] = [];
  const room = createRoomGame();
  startRound(room, ["p1"]);
  room.members.push(playerMember("p1", sink));
  tickRoomGame(room);
  const msg = sink[0] as GameStateMessage;
  assert.equal(msg.payload.phase, room.phase);
});

test("createGameStateMessage omits youPlayerId for host payloads", () => {
  const state = createGameState(["p1"]);
  const msg = createGameStateMessage(state);
  assert.equal("youPlayerId" in msg.payload, false);
});
