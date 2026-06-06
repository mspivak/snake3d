import {
  createGameStateMessage,
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
}

export interface AddressedMessage {
  member: RoomMember;
  message: GameStateMessage;
}

export function createRoomGame(
  playerIds: string[],
  seed = 1,
  size?: number
): RoomGame {
  const rng = makeSeededRng(seed);
  return {
    state: createGameState(playerIds, size, rng),
    inputs: {},
    members: [],
    rng
  };
}

export function buildGameStateMessages(
  state: GameState,
  members: RoomMember[]
): AddressedMessage[] {
  return members.map((member) => ({
    member,
    message: createGameStateMessage(state, member.role === "player" ? member.playerId : undefined)
  }));
}

export function broadcastGameState(state: GameState, members: RoomMember[]): void {
  for (const { member, message } of buildGameStateMessages(state, members)) {
    member.send(message);
  }
}

export function tickRoomGame(room: RoomGame): void {
  room.state = step(room.state, room.inputs, room.rng);
  room.inputs = {};
  broadcastGameState(room.state, room.members);
}

export function startGameLoop(room: RoomGame, ticksPerSecond = 7): () => void {
  const interval = setInterval(() => tickRoomGame(room), 1000 / ticksPerSecond);
  return () => clearInterval(interval);
}
