import { test } from "node:test";
import assert from "node:assert/strict";
import type { GameState } from "@snake3d/shared";
import { colorForPlayer, buildRenderItems } from "./board.geometry.ts";

function emptyState(size: number): GameState {
  return { tick: 0, bounds: { size }, snakes: [], food: [] };
}

test("colorForPlayer is stable for the same id", () => {
  assert.equal(colorForPlayer("alice"), colorForPlayer("alice"));
});

test("colorForPlayer differs for different ids", () => {
  assert.notEqual(colorForPlayer("alice"), colorForPlayer("bob"));
});

test("colorForPlayer returns a 24-bit color number", () => {
  const color = colorForPlayer("alice");
  assert.equal(Number.isInteger(color), true);
  assert.ok(color >= 0 && color <= 0xffffff);
});

test("buildRenderItems centers cells around the origin", () => {
  const size = 4;
  const state: GameState = {
    ...emptyState(size),
    snakes: [
      { playerId: "p1", cells: [{ x: 0, y: 0, z: 0 }], direction: { x: 1, y: 0, z: 0 }, status: "alive" }
    ]
  };
  const items = buildRenderItems(state, size);
  const offset = (size - 1) / 2;
  assert.deepEqual(items[0].position, { x: -offset, y: -offset, z: -offset });
});

test("buildRenderItems produces one snake item per cell with player color", () => {
  const state: GameState = {
    ...emptyState(4),
    snakes: [
      {
        playerId: "p1",
        cells: [
          { x: 1, y: 1, z: 1 },
          { x: 2, y: 1, z: 1 }
        ],
        direction: { x: 1, y: 0, z: 0 },
        status: "alive"
      }
    ]
  };
  const items = buildRenderItems(state, 4);
  const snakeItems = items.filter((item) => item.kind === "snake");
  assert.equal(snakeItems.length, 2);
  for (const item of snakeItems) {
    assert.equal(item.color, colorForPlayer("p1"));
    assert.equal(item.playerId, "p1");
  }
});

test("buildRenderItems renders food with a distinct kind", () => {
  const state: GameState = {
    ...emptyState(4),
    food: [{ x: 3, y: 3, z: 3 }]
  };
  const items = buildRenderItems(state, 4);
  const foodItems = items.filter((item) => item.kind === "food");
  assert.equal(foodItems.length, 1);
  assert.equal(foodItems[0].playerId, undefined);
});

test("buildRenderItems gives each snake a stable distinct color", () => {
  const state: GameState = {
    ...emptyState(6),
    snakes: [
      { playerId: "p1", cells: [{ x: 0, y: 0, z: 0 }], direction: { x: 1, y: 0, z: 0 }, status: "alive" },
      { playerId: "p2", cells: [{ x: 1, y: 0, z: 0 }], direction: { x: 1, y: 0, z: 0 }, status: "alive" }
    ]
  };
  const items = buildRenderItems(state, 6);
  assert.notEqual(items[0].color, items[1].color);
});

test("buildRenderItems emits no items for an empty state", () => {
  assert.equal(buildRenderItems(emptyState(8), 8).length, 0);
});
