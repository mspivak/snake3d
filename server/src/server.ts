import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import {
  createWelcome,
  parseMessage,
  serializeMessage,
  type ClientMessage
} from "@snake3d/shared";

export interface GameServerOptions {
  port: number;
  host?: string;
}

export interface GameServer {
  wss: WebSocketServer;
  port: number;
  close: () => Promise<void>;
}

export function createGameServer(options: GameServerOptions): Promise<GameServer> {
  const wss = new WebSocketServer({ port: options.port, host: options.host ?? "0.0.0.0" });

  wss.on("connection", (socket: WebSocket) => {
    const clientId = randomUUID();
    socket.send(serializeMessage(createWelcome(clientId, Date.now())));

    socket.on("message", (data) => {
      try {
        const message = parseMessage<ClientMessage>(data.toString());
        if (message.type === "hello") {
          console.log(`[server] hello from ${message.payload.clientName} (${clientId})`);
        }
      } catch (error) {
        console.warn(`[server] dropped invalid message from ${clientId}:`, error);
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
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            wss.close((err) => (err ? rejectClose(err) : resolveClose()));
          })
      });
    });
  });
}
