export const PROTOCOL_VERSION = 1;

export type ClientMessageType = "hello" | "create-room" | "join-room";
export type ServerMessageType =
  | "welcome"
  | "room-created"
  | "joined"
  | "join-error"
  | "player-joined"
  | "player-left";

export type JoinErrorCode = "unknown-room" | "room-full";

export interface MessageEnvelope<T extends string, P> {
  type: T;
  protocolVersion: number;
  payload: P;
}

export interface HelloPayload {
  clientName: string;
}

export interface WelcomePayload {
  clientId: string;
  serverTime: number;
}

export interface CreateRoomPayload {
  hostName: string;
}

export interface RoomCreatedPayload {
  roomCode: string;
  hostId: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
}

export interface JoinedPayload {
  roomCode: string;
  playerId: string;
}

export interface JoinErrorPayload {
  roomCode: string;
  code: JoinErrorCode;
  message: string;
}

export interface PlayerJoinedPayload {
  roomCode: string;
  playerId: string;
  playerName: string;
}

export interface PlayerLeftPayload {
  roomCode: string;
  playerId: string;
}

export type HelloMessage = MessageEnvelope<"hello", HelloPayload>;
export type CreateRoomMessage = MessageEnvelope<"create-room", CreateRoomPayload>;
export type JoinRoomMessage = MessageEnvelope<"join-room", JoinRoomPayload>;

export type WelcomeMessage = MessageEnvelope<"welcome", WelcomePayload>;
export type RoomCreatedMessage = MessageEnvelope<"room-created", RoomCreatedPayload>;
export type JoinedMessage = MessageEnvelope<"joined", JoinedPayload>;
export type JoinErrorMessage = MessageEnvelope<"join-error", JoinErrorPayload>;
export type PlayerJoinedMessage = MessageEnvelope<"player-joined", PlayerJoinedPayload>;
export type PlayerLeftMessage = MessageEnvelope<"player-left", PlayerLeftPayload>;

export type ClientMessage = HelloMessage | CreateRoomMessage | JoinRoomMessage;
export type ServerMessage =
  | WelcomeMessage
  | RoomCreatedMessage
  | JoinedMessage
  | JoinErrorMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage;

export function createHello(clientName: string): HelloMessage {
  return {
    type: "hello",
    protocolVersion: PROTOCOL_VERSION,
    payload: { clientName }
  };
}

export function createWelcome(clientId: string, serverTime: number): WelcomeMessage {
  return {
    type: "welcome",
    protocolVersion: PROTOCOL_VERSION,
    payload: { clientId, serverTime }
  };
}

export function createCreateRoom(hostName: string): CreateRoomMessage {
  return {
    type: "create-room",
    protocolVersion: PROTOCOL_VERSION,
    payload: { hostName }
  };
}

export function createRoomCreated(roomCode: string, hostId: string): RoomCreatedMessage {
  return {
    type: "room-created",
    protocolVersion: PROTOCOL_VERSION,
    payload: { roomCode, hostId }
  };
}

export function createJoinRoom(roomCode: string, playerName: string): JoinRoomMessage {
  return {
    type: "join-room",
    protocolVersion: PROTOCOL_VERSION,
    payload: { roomCode, playerName }
  };
}

export function createJoined(roomCode: string, playerId: string): JoinedMessage {
  return {
    type: "joined",
    protocolVersion: PROTOCOL_VERSION,
    payload: { roomCode, playerId }
  };
}

export function createJoinError(
  roomCode: string,
  code: JoinErrorCode,
  message: string
): JoinErrorMessage {
  return {
    type: "join-error",
    protocolVersion: PROTOCOL_VERSION,
    payload: { roomCode, code, message }
  };
}

export function createPlayerJoined(
  roomCode: string,
  playerId: string,
  playerName: string
): PlayerJoinedMessage {
  return {
    type: "player-joined",
    protocolVersion: PROTOCOL_VERSION,
    payload: { roomCode, playerId, playerName }
  };
}

export function createPlayerLeft(roomCode: string, playerId: string): PlayerLeftMessage {
  return {
    type: "player-left",
    protocolVersion: PROTOCOL_VERSION,
    payload: { roomCode, playerId }
  };
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Cell = Vec3;

export type DirectionName = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

export type Direction = Vec3;

export const DIRECTIONS: Record<DirectionName, Direction> = {
  "+x": { x: 1, y: 0, z: 0 },
  "-x": { x: -1, y: 0, z: 0 },
  "+y": { x: 0, y: 1, z: 0 },
  "-y": { x: 0, y: -1, z: 0 },
  "+z": { x: 0, y: 0, z: 1 },
  "-z": { x: 0, y: 0, z: -1 }
};

export type SnakeStatus = "alive" | "dead";

export interface Snake {
  playerId: string;
  cells: Cell[];
  direction: Direction;
  status: SnakeStatus;
}

export interface GridBounds {
  size: number;
}

export interface GameState {
  tick: number;
  bounds: GridBounds;
  snakes: Snake[];
  food: Cell[];
}

export function parseMessage<T extends MessageEnvelope<string, unknown>>(raw: string): T {
  const parsed = JSON.parse(raw) as T;
  if (typeof parsed !== "object" || parsed === null) {
    throw new TypeError("Message is not an object");
  }
  if (typeof parsed.type !== "string") {
    throw new TypeError("Message is missing a string type");
  }
  if (parsed.protocolVersion !== PROTOCOL_VERSION) {
    throw new TypeError(
      `Unsupported protocol version: ${String(parsed.protocolVersion)}`
    );
  }
  return parsed;
}

export function serializeMessage(message: MessageEnvelope<string, unknown>): string {
  return JSON.stringify(message);
}
