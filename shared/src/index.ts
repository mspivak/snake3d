export const PROTOCOL_VERSION = 1;

export type ClientMessageType = "hello";
export type ServerMessageType = "welcome";

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

export type ClientMessage = MessageEnvelope<"hello", HelloPayload>;
export type ServerMessage = MessageEnvelope<"welcome", WelcomePayload>;

export function createHello(clientName: string): ClientMessage {
  return {
    type: "hello",
    protocolVersion: PROTOCOL_VERSION,
    payload: { clientName }
  };
}

export function createWelcome(clientId: string, serverTime: number): ServerMessage {
  return {
    type: "welcome",
    protocolVersion: PROTOCOL_VERSION,
    payload: { clientId, serverTime }
  };
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
