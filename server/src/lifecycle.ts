import type { GameState } from "@snake3d/shared";

export function countAliveSnakes(state: GameState): number {
  return state.snakes.filter((snake) => snake.status === "alive").length;
}

export function isRoundOver(state: GameState): boolean {
  const total = state.snakes.length;
  const alive = countAliveSnakes(state);
  if (total === 0) {
    return true;
  }
  if (total === 1) {
    return alive === 0;
  }
  return alive <= 1;
}
