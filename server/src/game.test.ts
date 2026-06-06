import { test } from "node:test";
import assert from "node:assert/strict";
import { DIRECTIONS } from "@snake3d/shared";
import type { Cell, GameState } from "@snake3d/shared";
import {
  createGameState,
  applyDirection,
  step,
  makeSeededRng
} from "./game.ts";

function snakeOf(state: GameState, playerId: string) {
  const snake = state.snakes.find((s) => s.playerId === playerId);
  assert.ok(snake, `expected snake for ${playerId}`);
  return snake;
}

function cellEqual(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

test("createGameState spawns one snake per player at distinct safe positions", () => {
  const rng = makeSeededRng(1);
  const state = createGameState(["a", "b", "c"], 12, rng);

  assert.equal(state.snakes.length, 3);
  assert.equal(state.bounds.size, 12);
  assert.equal(state.tick, 0);
  assert.ok(state.food.length >= 1);

  const heads = state.snakes.map((s) => s.cells[0]);
  for (let i = 0; i < heads.length; i += 1) {
    for (let j = i + 1; j < heads.length; j += 1) {
      assert.equal(cellEqual(heads[i], heads[j]), false);
    }
  }

  for (const snake of state.snakes) {
    assert.equal(snake.status, "alive");
    assert.ok(snake.cells.length >= 1);
    for (const cell of snake.cells) {
      assert.ok(cell.x >= 0 && cell.x < 12);
      assert.ok(cell.y >= 0 && cell.y < 12);
      assert.ok(cell.z >= 0 && cell.z < 12);
    }
  }
});

test("createGameState is deterministic for the same seed", () => {
  const a = createGameState(["a", "b"], 12, makeSeededRng(42));
  const b = createGameState(["a", "b"], 12, makeSeededRng(42));
  assert.deepEqual(a, b);
});

test("step advances each living snake one cell in its direction", () => {
  const state = createGameState(["a"], 12, makeSeededRng(7));
  const snake = snakeOf(state, "a");
  const head = snake.cells[0];
  const dir = snake.direction;
  const length = snake.cells.length;

  const next = step(state, {}, makeSeededRng(7));
  const moved = snakeOf(next, "a");

  assert.deepEqual(moved.cells[0], {
    x: head.x + dir.x,
    y: head.y + dir.y,
    z: head.z + dir.z
  });
  assert.equal(moved.cells.length, length);
  assert.equal(moved.status, "alive");
  assert.equal(next.tick, 1);
});

test("step does not mutate the input state", () => {
  const state = createGameState(["a"], 12, makeSeededRng(7));
  const before = structuredClone(state);
  step(state, {}, makeSeededRng(7));
  assert.deepEqual(state, before);
});

test("applyDirection sets a new direction", () => {
  const state = createGameState(["a"], 12, makeSeededRng(7));
  const next = applyDirection(state, "a", DIRECTIONS["+z"]);
  assert.deepEqual(snakeOf(next, "a").direction, DIRECTIONS["+z"]);
});

test("applyDirection rejects a 180-degree reversal into the neck", () => {
  let state: GameState = {
    tick: 0,
    bounds: { size: 12 },
    snakes: [
      {
        playerId: "a",
        cells: [
          { x: 5, y: 5, z: 5 },
          { x: 4, y: 5, z: 5 }
        ],
        direction: DIRECTIONS["+x"],
        status: "alive"
      }
    ],
    food: [{ x: 0, y: 0, z: 0 }]
  };

  const next = applyDirection(state, "a", DIRECTIONS["-x"]);
  assert.deepEqual(snakeOf(next, "a").direction, DIRECTIONS["+x"]);
});

test("applyDirection allows reversal for a length-one snake", () => {
  const state: GameState = {
    tick: 0,
    bounds: { size: 12 },
    snakes: [
      {
        playerId: "a",
        cells: [{ x: 5, y: 5, z: 5 }],
        direction: DIRECTIONS["+x"],
        status: "alive"
      }
    ],
    food: [{ x: 0, y: 0, z: 0 }]
  };

  const next = applyDirection(state, "a", DIRECTIONS["-x"]);
  assert.deepEqual(snakeOf(next, "a").direction, DIRECTIONS["-x"]);
});

test("eating food grows the snake and spawns new food in a free cell", () => {
  const state: GameState = {
    tick: 0,
    bounds: { size: 12 },
    snakes: [
      {
        playerId: "a",
        cells: [
          { x: 5, y: 5, z: 5 },
          { x: 4, y: 5, z: 5 }
        ],
        direction: DIRECTIONS["+x"],
        status: "alive"
      }
    ],
    food: [{ x: 6, y: 5, z: 5 }]
  };

  const next = step(state, {}, makeSeededRng(3));
  const snake = snakeOf(next, "a");

  assert.equal(snake.cells.length, 3);
  assert.deepEqual(snake.cells[0], { x: 6, y: 5, z: 5 });
  assert.equal(next.food.length, 1);
  assert.equal(cellEqual(next.food[0], { x: 6, y: 5, z: 5 }), false);

  const occupied = new Set(snake.cells.map((c) => `${c.x},${c.y},${c.z}`));
  assert.equal(occupied.has(`${next.food[0].x},${next.food[0].y},${next.food[0].z}`), false);
});

test("moving past an edge wraps to the opposite side without dying", () => {
  const state: GameState = {
    tick: 0,
    bounds: { size: 12 },
    snakes: [
      {
        playerId: "a",
        cells: [{ x: 11, y: 5, z: 5 }],
        direction: DIRECTIONS["+x"],
        status: "alive"
      }
    ],
    food: [{ x: 0, y: 0, z: 0 }]
  };

  const next = step(state, {}, makeSeededRng(1));
  const snake = snakeOf(next, "a");
  assert.equal(snake.status, "alive");
  assert.deepEqual(snake.cells[0], { x: 0, y: 5, z: 5 });
});

test("a dead snake does not advance on subsequent ticks", () => {
  const state: GameState = {
    tick: 0,
    bounds: { size: 12 },
    snakes: [
      {
        playerId: "a",
        cells: [{ x: 11, y: 5, z: 5 }],
        direction: DIRECTIONS["+x"],
        status: "dead"
      }
    ],
    food: [{ x: 0, y: 0, z: 0 }]
  };

  const next = step(state, {}, makeSeededRng(1));
  assert.deepEqual(snakeOf(next, "a").cells, [{ x: 11, y: 5, z: 5 }]);
});

test("moving into own body kills the snake", () => {
  const state: GameState = {
    tick: 0,
    bounds: { size: 12 },
    snakes: [
      {
        playerId: "a",
        cells: [
          { x: 5, y: 5, z: 5 },
          { x: 6, y: 5, z: 5 },
          { x: 6, y: 6, z: 5 },
          { x: 5, y: 6, z: 5 }
        ],
        direction: DIRECTIONS["+x"],
        status: "alive"
      }
    ],
    food: [{ x: 0, y: 0, z: 0 }]
  };

  const next = step(state, {}, makeSeededRng(1));
  assert.equal(snakeOf(next, "a").status, "dead");
});

test("moving into another snake body kills the moving snake", () => {
  const state: GameState = {
    tick: 0,
    bounds: { size: 12 },
    snakes: [
      {
        playerId: "a",
        cells: [{ x: 5, y: 5, z: 5 }],
        direction: DIRECTIONS["+x"],
        status: "alive"
      },
      {
        playerId: "b",
        cells: [
          { x: 6, y: 5, z: 5 },
          { x: 7, y: 5, z: 5 }
        ],
        direction: DIRECTIONS["+y"],
        status: "alive"
      }
    ],
    food: [{ x: 0, y: 0, z: 0 }]
  };

  const next = step(state, {}, makeSeededRng(1));
  assert.equal(snakeOf(next, "a").status, "dead");
  assert.equal(snakeOf(next, "b").status, "alive");
});

test("step applies queued direction inputs before moving", () => {
  const state: GameState = {
    tick: 0,
    bounds: { size: 12 },
    snakes: [
      {
        playerId: "a",
        cells: [{ x: 5, y: 5, z: 5 }],
        direction: DIRECTIONS["+x"],
        status: "alive"
      }
    ],
    food: [{ x: 0, y: 0, z: 0 }]
  };

  const next = step(state, { a: DIRECTIONS["+y"] }, makeSeededRng(1));
  const snake = snakeOf(next, "a");
  assert.deepEqual(snake.direction, DIRECTIONS["+y"]);
  assert.deepEqual(snake.cells[0], { x: 5, y: 6, z: 5 });
});

test("step is deterministic for the same seed and inputs", () => {
  const base = createGameState(["a", "b"], 12, makeSeededRng(5));
  const a = step(base, {}, makeSeededRng(99));
  const b = step(base, {}, makeSeededRng(99));
  assert.deepEqual(a, b);
});
