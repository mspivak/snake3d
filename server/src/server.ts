import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import {
  createWelcome,
  createRoomCreated,
  createJoined,
  createJoinError,
  createPlayerJoined,
  createPlayerLeft,
  createGameStateMessage,
  parseMessage,
  serializeMessage,
  type ClientMessage,
  type ServerMessage
} from "@snake3d/shared";
import { RoomManager } from "./rooms.ts";
import {
  broadcastGameState,
  createRoomGame,
  startRound,
  startGameLoop,
  type RoomGame,
  type RoomMember
} from "./loop.ts";

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

  interface RunningGame {
    game: RoomGame;
    stop: (() => void) | undefined;
  }

  const games = new Map<string, RunningGame>();

  function send(socket: WebSocket, message: ServerMessage): void {
    socket.send(serializeMessage(message));
  }

  function makeMember(socket: WebSocket, role: "host" | "player", playerId?: string): RoomMember {
    return {
      role,
      playerId,
      send: (message) => {
        if (socket.readyState === socket.OPEN) {
          send(socket, message);
        }
      }
    };
  }

  function ensureGame(roomCode: string): RunningGame {
    const existing = games.get(roomCode);
    if (existing !== undefined) {
      return existing;
    }
    const running: RunningGame = { game: createRoomGame(), stop: undefined };
    games.set(roomCode, running);
    return running;
  }

  function stopLoop(running: RunningGame): void {
    if (running.stop !== undefined) {
      running.stop();
      running.stop = undefined;
    }
  }

  function startRoomRound(roomCode: string): void {
    const running = games.get(roomCode);
    if (running === undefined) {
      return;
    }
    stopLoop(running);
    const playerIds = rooms.getPlayers(roomCode).map((player) => player.id);
    startRound(running.game, playerIds, Date.now() >>> 0);
    broadcastGameState(running.game.state, running.game.members, running.game.phase);
    running.stop = startGameLoop(running.game);
  }

  function destroyGame(roomCode: string): void {
    const running = games.get(roomCode);
    if (running === undefined) {
      return;
    }
    stopLoop(running);
    games.delete(roomCode);
  }

  function removeMember(roomCode: string, member: RoomMember): void {
    const running = games.get(roomCode);
    if (running === undefined) {
      return;
    }
    running.game.members = running.game.members.filter((existing) => existing !== member);
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
    let member: RoomMember | undefined;

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
        const running = ensureGame(room.code);
        member = makeMember(socket, "host");
        running.game.members.push(member);
        send(socket, createGameStateMessage(running.game.state, undefined, running.game.phase));
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

        const running = ensureGame(roomCode);
        member = makeMember(socket, "player", result.playerId);
        running.game.members.push(member);
        send(
          socket,
          createGameStateMessage(running.game.state, result.playerId, running.game.phase)
        );
        return;
      }

      if (message.type === "direction-input") {
        if (state === undefined || state.role !== "player") {
          return;
        }
        const running = games.get(state.roomCode);
        if (running === undefined) {
          return;
        }
        running.game.inputs[state.playerId] = message.payload.direction;
        return;
      }

      if (message.type === "start-game") {
        if (state === undefined || state.role !== "host") {
          return;
        }
        startRoomRound(state.roomCode);
        return;
      }
    });

    socket.on("close", () => {
      if (state === undefined) {
        return;
      }
      if (state.role === "host") {
        hostSockets.delete(state.roomCode);
        if (member !== undefined) {
          removeMember(state.roomCode, member);
        }
        destroyGame(state.roomCode);
        rooms.removeHost(state.roomCode);
        return;
      }
      if (member !== undefined) {
        removeMember(state.roomCode, member);
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
