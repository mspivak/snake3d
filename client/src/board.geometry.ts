import type { Cell, GameState } from "@snake3d/shared";

export type RenderItemKind = "snake" | "food";

export interface RenderItem {
  kind: RenderItemKind;
  position: Cell;
  color: number;
  playerId?: string;
}

export function colorForPlayer(playerId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < playerId.length; i += 1) {
    hash ^= playerId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hue = (hash >>> 0) % 360;
  return hslToHex(hue, 70, 55);
}

function hslToHex(h: number, s: number, l: number): number {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toByte = (v: number): number => Math.round((v + m) * 255);
  return (toByte(r) << 16) | (toByte(g) << 8) | toByte(b);
}

export const FOOD_COLOR = 0xffffff;

export function buildRenderItems(state: GameState, size: number): RenderItem[] {
  const offset = (size - 1) / 2;
  const center = (cell: Cell): Cell => ({
    x: cell.x - offset,
    y: cell.y - offset,
    z: cell.z - offset
  });
  const items: RenderItem[] = [];
  for (const snake of state.snakes) {
    const color = colorForPlayer(snake.playerId);
    for (const cell of snake.cells) {
      items.push({
        kind: "snake",
        position: center(cell),
        color,
        playerId: snake.playerId
      });
    }
  }
  for (const cell of state.food) {
    items.push({ kind: "food", position: center(cell), color: FOOD_COLOR });
  }
  return items;
}

export function renderKey(item: RenderItem, index: number): string {
  return `${item.kind}:${item.position.x},${item.position.y},${item.position.z}:${index}`;
}
