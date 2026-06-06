import { test } from "node:test";
import assert from "node:assert/strict";
import type { GameState, Snake } from "@snake3d/shared";
import { createGameState } from "./game.ts";
import { countAliveSnakes, isRoundOver } from "./lifecycle.ts";

function snake(playerId: string, status: "alive" | "dead"): Snake {
  return {
    playerId,
    cells: [{ x: 0, y: 0, z: 0 }],
    direction: { x: 1, y: 0, z: 0 },
    status
  };
}

function stateWith(snakes: Snake[]): GameState {
  return { tick: 0, bounds: { size: 12 }, snakes, food: [] };
}

test("countAliveSnakes counts only alive snakes", () => {
  const state = stateWith([snake("a", "alive"), snake("b", "dead"), snake("c", "alive")]);
  assert.equal(countAliveSnakes(state), 2);
});

test("solo round is over when the only snake is dead", () => {
  assert.equal(isRoundOver(stateWith([snake("a", "dead")])), true);
  assert.equal(isRoundOver(stateWith([snake("a", "alive")])), false);
});

test("multiplayer round is over when one snake remains alive", () => {
  const state = stateWith([snake("a", "alive"), snake("b", "dead")]);
  assert.equal(isRoundOver(state), true);
});

test("multiplayer round is over when all snakes are dead", () => {
  const state = stateWith([snake("a", "dead"), snake("b", "dead")]);
  assert.equal(isRoundOver(state), true);
});

test("multiplayer round is not over while two or more snakes are alive", () => {
  const state = stateWith([
    snake("a", "alive"),
    snake("b", "alive"),
    snake("c", "dead")
  ]);
  assert.equal(isRoundOver(state), false);
});

test("a round with no snakes is over", () => {
  assert.equal(isRoundOver(stateWith([])), true);
});

test("starting a round creates one snake per current player", () => {
  const state = createGameState(["p1", "p2", "p3"]);
  assert.equal(state.snakes.length, 3);
  assert.deepEqual(
    state.snakes.map((s) => s.playerId).sort(),
    ["p1", "p2", "p3"]
  );
  assert.ok(state.snakes.every((s) => s.status === "alive"));
});
