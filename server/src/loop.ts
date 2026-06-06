import {
  createGameStateMessage,
  type GamePhase,
  type GameState,
  type GameStateMessage,
  type ServerMessage
} from "@snake3d/shared";
import {
  createGameState,
  makeSeededRng,
  step,
  type DirectionInputs,
  type Rng
} from "./game.ts";
import { isRoundOver } from "./lifecycle.ts";

export interface RoomMember {
  role: "host" | "player";
  playerId?: string;
  send: (message: ServerMessage) => void;
}

export interface RoomGame {
  state: GameState;
  inputs: DirectionInputs;
  members: RoomMember[];
  rng: Rng;
  phase: GamePhase;
  size?: number;
}

export interface AddressedMessage {
  member: RoomMember;
  message: GameStateMessage;
}

export function createRoomGame(
  playerIds: string[] = [],
  seed = 1,
  size?: number
): RoomGame {
  const rng = makeSeededRng(seed);
  const room: RoomGame = {
    state: createGameState(playerIds, size, rng),
    inputs: {},
    members: [],
    rng,
    phase: playerIds.length > 0 ? "playing" : "lobby",
    size
  };
  return room;
}

export function startRound(
  room: RoomGame,
  playerIds: string[],
  seed = 1,
  size?: number
): void {
  const gridSize = size ?? room.size;
  room.rng = makeSeededRng(seed);
  room.state = createGameState(playerIds, gridSize, room.rng);
  room.inputs = {};
  room.size = gridSize;
  room.phase = "playing";
}

export function buildGameStateMessages(
  state: GameState,
  members: RoomMember[],
  phase: GamePhase
): AddressedMessage[] {
  return members.map((member) => ({
    member,
    message: createGameStateMessage(
      state,
      member.role === "player" ? member.playerId : undefined,
      phase
    )
  }));
}

export function broadcastGameState(
  state: GameState,
  members: RoomMember[],
  phase: GamePhase
): void {
  for (const { member, message } of buildGameStateMessages(state, members, phase)) {
    member.send(message);
  }
}

export function tickRoomGame(room: RoomGame): void {
  room.state = step(room.state, room.inputs, room.rng);
  room.inputs = {};
  if (isRoundOver(room.state)) {
    room.phase = "over";
  }
  broadcastGameState(room.state, room.members, room.phase);
}

export function startGameLoop(room: RoomGame, ticksPerSecond = 7): () => void {
  const interval = setInterval(() => {
    tickRoomGame(room);
    if (room.phase === "over") {
      clearInterval(interval);
    }
  }, 1000 / ticksPerSecond);
  return () => clearInterval(interval);
}
