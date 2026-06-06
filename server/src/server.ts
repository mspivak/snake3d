import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import {
  createWelcome,
  createRoomCreated,
  createJoined,
  createJoinError,
  createPlayerJoined,
  createPlayerLeft,
  parseMessage,
  serializeMessage,
  type ClientMessage,
  type ServerMessage
} from "@snake3d/shared";
import { RoomManager } from "./rooms.ts";

export interface GameServerOptions {
  port: number;
  host?: string;
}

export interface GameServer {
  wss: WebSocketServer;
  port: number;
  rooms: RoomManager;
  close: () => Promise<void>;
}

interface HostConnection {
  role: "host";
  roomCode: string;
}

interface PlayerConnection {
  role: "player";
  roomCode: string;
  playerId: string;
}

type ConnectionState = HostConnection | PlayerConnection | undefined;

export function createGameServer(options: GameServerOptions): Promise<GameServer> {
  const wss = new WebSocketServer({ port: options.port, host: options.host ?? "0.0.0.0" });
  const rooms = new RoomManager();
  const hostSockets = new Map<string, WebSocket>();

  function send(socket: WebSocket, message: ServerMessage): void {
    socket.send(serializeMessage(message));
  }

  function notifyHost(roomCode: string, message: ServerMessage): void {
    const hostSocket = hostSockets.get(roomCode);
    if (hostSocket !== undefined && hostSocket.readyState === hostSocket.OPEN) {
      send(hostSocket, message);
    }
  }

  wss.on("connection", (socket: WebSocket) => {
    const clientId = randomUUID();
    let state: ConnectionState;

    send(socket, createWelcome(clientId, Date.now()));

    socket.on("message", (data) => {
      let message: ClientMessage;
      try {
        message = parseMessage<ClientMessage>(data.toString());
      } catch (error) {
        console.warn(`[server] dropped invalid message from ${clientId}:`, error);
        return;
      }

      if (message.type === "create-room") {
        const room = rooms.createRoom(clientId, message.payload.hostName);
        state = { role: "host", roomCode: room.code };
        hostSockets.set(room.code, socket);
        send(socket, createRoomCreated(room.code, room.hostId));
        return;
      }

      if (message.type === "join-room") {
        const { roomCode, playerName } = message.payload;
        const result = rooms.joinRoom(roomCode, playerName);
        if ("error" in result) {
          send(socket, createJoinError(roomCode, result.error, "Room not found"));
          return;
        }
        state = { role: "player", roomCode, playerId: result.playerId };
        send(socket, createJoined(roomCode, result.playerId));
        notifyHost(roomCode, createPlayerJoined(roomCode, result.playerId, playerName));
        return;
      }
    });

    socket.on("close", () => {
      if (state === undefined) {
        return;
      }
      if (state.role === "host") {
        hostSockets.delete(state.roomCode);
        rooms.removeHost(state.roomCode);
        return;
      }
      const removal = rooms.removePlayer(state.roomCode, state.playerId);
      if (removal !== undefined) {
        notifyHost(removal.roomCode, createPlayerLeft(removal.roomCode, removal.playerId));
      }
    });
  });

  return new Promise<GameServer>((resolve, reject) => {
    wss.once("error", reject);
    wss.once("listening", () => {
      const address = wss.address();
      const port = typeof address === "object" && address !== null ? address.port : options.port;
      resolve({
        wss,
        port,
        rooms,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            wss.close((err) => (err ? rejectClose(err) : resolveClose()));
          })
      });
    });
  });
}
