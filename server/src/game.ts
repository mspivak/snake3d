import type {
  Cell,
  Direction,
  GameState,
  Snake,
  Vec3
} from "@snake3d/shared";

export type Rng = () => number;

export type DirectionInputs = Record<string, Direction>;

const DEFAULT_GRID_SIZE = 12;

export function makeSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  if (state === 0) {
    state = 0x9e3779b9;
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function key(cell: Vec3): string {
  return `${cell.x},${cell.y},${cell.z}`;
}

function addVec(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function isOutOfBounds(cell: Vec3, size: number): boolean {
  return (
    cell.x < 0 ||
    cell.y < 0 ||
    cell.z < 0 ||
    cell.x >= size ||
    cell.y >= size ||
    cell.z >= size
  );
}

function occupiedCells(snakes: Snake[]): Set<string> {
  const occupied = new Set<string>();
  for (const snake of snakes) {
    for (const cell of snake.cells) {
      occupied.add(key(cell));
    }
  }
  return occupied;
}

function pickFreeCell(size: number, occupied: Set<string>, rng: Rng): Cell | null {
  const total = size * size * size;
  const free = total - occupied.size;
  if (free <= 0) {
    return null;
  }
  let target = Math.floor(rng() * free);
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let z = 0; z < size; z += 1) {
        const cell = { x, y, z };
        if (occupied.has(key(cell))) {
          continue;
        }
        if (target === 0) {
          return cell;
        }
        target -= 1;
      }
    }
  }
  return null;
}

function isReversal(current: Direction, next: Direction): boolean {
  return (
    current.x === -next.x &&
    current.y === -next.y &&
    current.z === -next.z
  );
}

export function createGameState(
  playerIds: string[],
  size: number = DEFAULT_GRID_SIZE,
  rng: Rng = makeSeededRng(1)
): GameState {
  const snakes: Snake[] = [];
  const occupied = new Set<string>();

  for (const playerId of playerIds) {
    const head = pickFreeCell(size, occupied, rng);
    if (head === null) {
      throw new Error(`No free cell to spawn snake for player ${playerId}`);
    }
    occupied.add(key(head));
    snakes.push({
      playerId,
      cells: [head],
      direction: { x: 1, y: 0, z: 0 },
      status: "alive"
    });
  }

  const food = pickFreeCell(size, occupied, rng);
  const state: GameState = {
    tick: 0,
    bounds: { size },
    snakes,
    food: food === null ? [] : [food]
  };
  return state;
}

export function applyDirection(
  state: GameState,
  playerId: string,
  direction: Direction
): GameState {
  const snakes = state.snakes.map((snake) => {
    if (snake.playerId !== playerId || snake.status !== "alive") {
      return snake;
    }
    if (snake.cells.length > 1 && isReversal(snake.direction, direction)) {
      return snake;
    }
    return { ...snake, direction: { ...direction } };
  });
  return { ...state, snakes, food: state.food };
}

export function step(
  state: GameState,
  inputs: DirectionInputs,
  rng: Rng = makeSeededRng(1)
): GameState {
  const directed: Snake[] = state.snakes.map((snake) => {
    if (snake.status !== "alive") {
      return snake;
    }
    const input = inputs[snake.playerId];
    if (input === undefined) {
      return snake;
    }
    if (snake.cells.length > 1 && isReversal(snake.direction, input)) {
      return snake;
    }
    return { ...snake, direction: { ...input } };
  });

  const food = state.food.map((cell) => ({ ...cell }));
  const occupied = occupiedCells(directed);

  const heads = new Map<string, Cell>();
  const eaten = new Set<string>();
  for (const snake of directed) {
    if (snake.status !== "alive") {
      continue;
    }
    const head = addVec(snake.cells[0], snake.direction);
    heads.set(snake.playerId, head);
    const foodIndex = food.findIndex((f) => f.x === head.x && f.y === head.y && f.z === head.z);
    if (foodIndex !== -1) {
      eaten.add(snake.playerId);
    }
  }

  const movedSnakes: Snake[] = directed.map((snake) => {
    if (snake.status !== "alive") {
      return { ...snake, cells: snake.cells.map((c) => ({ ...c })) };
    }
    const head = heads.get(snake.playerId)!;

    if (isOutOfBounds(head, state.bounds.size)) {
      return {
        ...snake,
        status: "dead",
        cells: snake.cells.map((c) => ({ ...c }))
      };
    }

    const grows = eaten.has(snake.playerId);
    const tailKey = grows ? null : key(snake.cells[snake.cells.length - 1]);
    if (occupied.has(key(head)) && key(head) !== tailKey) {
      return {
        ...snake,
        status: "dead",
        cells: snake.cells.map((c) => ({ ...c }))
      };
    }

    const newCells = [head, ...snake.cells.map((c) => ({ ...c }))];
    if (!grows) {
      newCells.pop();
    }
    return { ...snake, cells: newCells };
  });

  let nextFood = food;
  if (eaten.size > 0) {
    nextFood = food.filter((f) => {
      for (const snake of movedSnakes) {
        if (snake.status === "alive" && eaten.has(snake.playerId)) {
          const head = snake.cells[0];
          if (head.x === f.x && head.y === f.y && head.z === f.z) {
            return false;
          }
        }
      }
      return true;
    });

    const occupiedAfter = occupiedCells(movedSnakes);
    for (const f of nextFood) {
      occupiedAfter.add(key(f));
    }
    const want = food.length;
    while (nextFood.length < want) {
      const cell = pickFreeCell(state.bounds.size, occupiedAfter, rng);
      if (cell === null) {
        break;
      }
      occupiedAfter.add(key(cell));
      nextFood.push(cell);
    }
  }

  return {
    tick: state.tick + 1,
    bounds: { ...state.bounds },
    snakes: movedSnakes,
    food: nextFood
  };
}
