import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseRoomCodeFromQuery,
  normalizeRoomCode,
  joinReducer,
  initialJoinState,
  type JoinState
} from "./join.ts";

test("parseRoomCodeFromQuery reads the room param", () => {
  assert.equal(parseRoomCodeFromQuery("?room=ABCD"), "ABCD");
});

test("parseRoomCodeFromQuery uppercases and trims", () => {
  assert.equal(parseRoomCodeFromQuery("?room=abcd"), "ABCD");
  assert.equal(parseRoomCodeFromQuery("?room=%20ab12%20"), "AB12");
});

test("parseRoomCodeFromQuery returns empty string when absent", () => {
  assert.equal(parseRoomCodeFromQuery(""), "");
  assert.equal(parseRoomCodeFromQuery("?foo=bar"), "");
});

test("parseRoomCodeFromQuery tolerates a leading url", () => {
  assert.equal(parseRoomCodeFromQuery("?room=WXYZ&x=1"), "WXYZ");
});

test("normalizeRoomCode strips whitespace and uppercases", () => {
  assert.equal(normalizeRoomCode("  ab12 "), "AB12");
  assert.equal(normalizeRoomCode(""), "");
});

test("initialJoinState is idle", () => {
  assert.equal(initialJoinState.status, "idle");
});

test("joinReducer idle -> joining on submit", () => {
  const next = joinReducer(initialJoinState, {
    type: "submit",
    roomCode: "ABCD",
    playerName: "phone"
  });
  assert.equal(next.status, "joining");
  if (next.status === "joining") {
    assert.equal(next.roomCode, "ABCD");
    assert.equal(next.playerName, "phone");
  }
});

test("joinReducer submit is rejected without a room code", () => {
  const next = joinReducer(initialJoinState, {
    type: "submit",
    roomCode: "",
    playerName: "phone"
  });
  assert.equal(next.status, "error");
  if (next.status === "error") {
    assert.match(next.message, /room code/i);
  }
});

test("joinReducer submit is rejected without a name", () => {
  const next = joinReducer(initialJoinState, {
    type: "submit",
    roomCode: "ABCD",
    playerName: "   "
  });
  assert.equal(next.status, "error");
  if (next.status === "error") {
    assert.match(next.message, /name/i);
  }
});

test("joinReducer joining -> waiting on joined", () => {
  const joining: JoinState = {
    status: "joining",
    roomCode: "ABCD",
    playerName: "phone"
  };
  const next = joinReducer(joining, {
    type: "joined",
    roomCode: "ABCD",
    playerId: "p1"
  });
  assert.equal(next.status, "waiting");
  if (next.status === "waiting") {
    assert.equal(next.roomCode, "ABCD");
    assert.equal(next.playerId, "p1");
    assert.equal(next.playerName, "phone");
  }
});

test("joinReducer joining -> error on join-error", () => {
  const joining: JoinState = {
    status: "joining",
    roomCode: "ZZZZ",
    playerName: "phone"
  };
  const next = joinReducer(joining, {
    type: "join-error",
    code: "unknown-room",
    message: "Room not found"
  });
  assert.equal(next.status, "error");
  if (next.status === "error") {
    assert.equal(next.code, "unknown-room");
    assert.match(next.message, /not found/i);
  }
});

test("joinReducer error -> joining on retry submit", () => {
  const errored: JoinState = {
    status: "error",
    message: "Room not found",
    code: "unknown-room"
  };
  const next = joinReducer(errored, {
    type: "submit",
    roomCode: "ABCD",
    playerName: "phone"
  });
  assert.equal(next.status, "joining");
});

test("joinReducer error on connection-error while joining", () => {
  const joining: JoinState = {
    status: "joining",
    roomCode: "ABCD",
    playerName: "phone"
  };
  const next = joinReducer(joining, { type: "connection-error" });
  assert.equal(next.status, "error");
  if (next.status === "error") {
    assert.match(next.message, /connect/i);
  }
});

test("joinReducer ignores joined when not joining", () => {
  const next = joinReducer(initialJoinState, {
    type: "joined",
    roomCode: "ABCD",
    playerId: "p1"
  });
  assert.equal(next.status, "idle");
});
