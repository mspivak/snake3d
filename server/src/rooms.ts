import { randomUUID } from "node:crypto";
import type { JoinErrorCode } from "@snake3d/shared";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

export interface Player {
  id: string;
  name: string;
}

export interface Room {
  code: string;
  hostId: string;
  hostName: string;
  players: Map<string, Player>;
}

export interface JoinSuccess {
  playerId: string;
  hostId: string;
}

export interface JoinFailure {
  error: JoinErrorCode;
}

export type JoinResult = JoinSuccess | JoinFailure;

export interface PlayerRemoval {
  roomCode: string;
  hostId: string;
  playerId: string;
}

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * CODE_ALPHABET.length);
    code += CODE_ALPHABET[index];
  }
  return code;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  createRoom(hostId: string, hostName: string): Room {
    let code = generateCode();
    while (this.rooms.has(code)) {
      code = generateCode();
    }
    const room: Room = { code, hostId, hostName, players: new Map() };
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, playerName: string): JoinResult {
    const room = this.rooms.get(code);
    if (room === undefined) {
      return { error: "unknown-room" };
    }
    const playerId = randomUUID();
    room.players.set(playerId, { id: playerId, name: playerName });
    return { playerId, hostId: room.hostId };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getPlayers(code: string): Player[] {
    const room = this.rooms.get(code);
    if (room === undefined) {
      return [];
    }
    return [...room.players.values()];
  }

  removePlayer(code: string, playerId: string): PlayerRemoval | undefined {
    const room = this.rooms.get(code);
    if (room === undefined) {
      return undefined;
    }
    if (!room.players.delete(playerId)) {
      return undefined;
    }
    return { roomCode: code, hostId: room.hostId, playerId };
  }

  removeHost(code: string): boolean {
    return this.rooms.delete(code);
  }

  roomCount(): number {
    return this.rooms.size;
  }
}
