import type { JoinErrorCode } from "./index.ts";

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase();
}

export function parseRoomCodeFromQuery(search: string): string {
  const query = search.startsWith("?") ? search.slice(1) : search;
  for (const pair of query.split("&")) {
    if (pair === "") {
      continue;
    }
    const eq = pair.indexOf("=");
    const key = eq === -1 ? pair : pair.slice(0, eq);
    if (key !== "room") {
      continue;
    }
    const raw = eq === -1 ? "" : pair.slice(eq + 1);
    return normalizeRoomCode(decodeURIComponent(raw.replace(/\+/g, " ")));
  }
  return "";
}

export type JoinState =
  | { status: "idle" }
  | { status: "joining"; roomCode: string; playerName: string }
  | { status: "waiting"; roomCode: string; playerName: string; playerId: string }
  | { status: "error"; message: string; code?: JoinErrorCode };

export type JoinAction =
  | { type: "submit"; roomCode: string; playerName: string }
  | { type: "joined"; roomCode: string; playerId: string }
  | { type: "join-error"; code: JoinErrorCode; message: string }
  | { type: "connection-error" };

export const initialJoinState: JoinState = { status: "idle" };

export function joinReducer(state: JoinState, action: JoinAction): JoinState {
  switch (action.type) {
    case "submit": {
      const roomCode = normalizeRoomCode(action.roomCode);
      const playerName = action.playerName.trim();
      if (roomCode === "") {
        return { status: "error", message: "Enter a room code to join." };
      }
      if (playerName === "") {
        return { status: "error", message: "Enter your name to join." };
      }
      return { status: "joining", roomCode, playerName };
    }
    case "joined": {
      if (state.status !== "joining") {
        return state;
      }
      return {
        status: "waiting",
        roomCode: action.roomCode,
        playerName: state.playerName,
        playerId: action.playerId
      };
    }
    case "join-error": {
      return { status: "error", message: action.message, code: action.code };
    }
    case "connection-error": {
      return { status: "error", message: "Could not connect to the game server." };
    }
    default:
      return state;
  }
}
