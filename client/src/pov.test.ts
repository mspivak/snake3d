import { test } from "node:test";
import assert from "node:assert/strict";
import { selectPlayerSnake, computeHeadCamera } from "./pov.ts";
import type { GameState, Snake } from "@snake3d/shared";

function snake(playerId: string, head = { x: 2, y: 0, z: 0 }): Snake {
  return {
    playerId,
    cells: [head, { x: head.x - 1, y: head.y, z: head.z }],
    direction: { x: 1, y: 0, z: 0 },
    status: "alive"
  };
}

function state(snakes: Snake[]): GameState {
  return {
    tick: 0,
    bounds: { size: 10 },
    snakes,
    food: []
  };
}

test("selectPlayerSnake returns the snake matching youPlayerId", () => {
  const mine = snake("me");
  const other = snake("other");
  const found = selectPlayerSnake(state([other, mine]), "me");
  assert.equal(found, mine);
});

test("selectPlayerSnake returns undefined when youPlayerId is absent", () => {
  assert.equal(selectPlayerSnake(state([snake("a")]), undefined), undefined);
});

test("selectPlayerSnake returns undefined when no snake matches", () => {
  assert.equal(selectPlayerSnake(state([snake("a")]), "ghost"), undefined);
});

test("selectPlayerSnake ignores a dead snake", () => {
  const dead = snake("me");
  dead.status = "dead";
  assert.equal(selectPlayerSnake(state([dead]), "me"), undefined);
});

test("computeHeadCamera places the camera at the head and looks ahead", () => {
  const head = { x: 2, y: 3, z: 4 };
  const direction = { x: 1, y: 0, z: 0 };
  const cam = computeHeadCamera(head, direction);
  assert.equal(cam.cameraPosition.x, 2);
  assert.equal(cam.cameraPosition.y, 3);
  assert.equal(cam.cameraPosition.z, 4);
  assert.equal(cam.lookAtTarget.x, 3);
  assert.equal(cam.lookAtTarget.y, 3);
  assert.equal(cam.lookAtTarget.z, 4);
});

test("computeHeadCamera forward target follows -z direction", () => {
  const cam = computeHeadCamera({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  assert.deepEqual(cam.lookAtTarget, { x: 0, y: 0, z: -1 });
});

test("computeHeadCamera normalizes a non-unit direction", () => {
  const cam = computeHeadCamera({ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 });
  assert.equal(cam.lookAtTarget.x, 1);
});

test("computeHeadCamera falls back to +x for a zero direction", () => {
  const cam = computeHeadCamera({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
  assert.deepEqual(cam.lookAtTarget, { x: 1, y: 0, z: 0 });
});
