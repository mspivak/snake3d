import {
  createHello,
  parseMessage,
  serializeMessage,
  type ServerMessage
} from "@snake3d/shared";

export interface ConnectionHandlers {
  onOpen?: () => void;
  onWelcome?: (message: ServerMessage) => void;
  onClose?: () => void;
}

export function connectToServer(
  url: string,
  clientName: string,
  handlers: ConnectionHandlers = {}
): WebSocket {
  const socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    console.log(`[client] connected to ${url}`);
    socket.send(serializeMessage(createHello(clientName)));
    handlers.onOpen?.();
  });

  socket.addEventListener("message", (event) => {
    const message = parseMessage<ServerMessage>(String(event.data));
    if (message.type === "welcome") {
      console.log(
        `[client] welcome received, assigned id ${message.payload.clientId}`
      );
      handlers.onWelcome?.(message);
    }
  });

  socket.addEventListener("close", () => {
    console.log("[client] connection closed");
    handlers.onClose?.();
  });

  return socket;
}
