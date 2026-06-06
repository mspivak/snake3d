import QRCode from "qrcode";
import {
  createCreateRoom,
  parseMessage,
  serializeMessage,
  buildJoinUrl,
  reduceLobbyPlayers,
  type ServerMessage,
  type LobbyPlayer
} from "@snake3d/shared";

const SERVER_URL = import.meta.env["VITE_SERVER_URL"] ?? "ws://localhost:3001";
const HOST_NAME = "host-lobby";

const codeEl = document.getElementById("room-code") as HTMLElement;
const qrCanvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
const joinUrlEl = document.getElementById("join-url") as HTMLElement;
const listEl = document.getElementById("player-list") as HTMLElement;
const countEl = document.getElementById("player-count") as HTMLElement;
const emptyEl = document.getElementById("player-empty") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;

let players: LobbyPlayer[] = [];

function renderPlayers(): void {
  countEl.textContent = String(players.length);
  emptyEl.style.display = players.length === 0 ? "block" : "none";
  listEl.replaceChildren(
    ...players.map((player) => {
      const item = document.createElement("li");
      item.textContent = player.playerName;
      return item;
    })
  );
}

function renderRoom(roomCode: string): void {
  codeEl.textContent = roomCode;
  const joinUrl = buildJoinUrl(window.location.origin, roomCode);
  joinUrlEl.textContent = joinUrl;
  void QRCode.toCanvas(qrCanvas, joinUrl, { width: 240, margin: 1 });
}

function handleMessage(message: ServerMessage): void {
  if (message.type === "room-created") {
    renderRoom(message.payload.roomCode);
    statusEl.textContent = "Room open — share the code or QR to let players in.";
    return;
  }
  if (message.type === "player-joined" || message.type === "player-left") {
    players = reduceLobbyPlayers(players, message);
    renderPlayers();
  }
}

function start(): void {
  renderPlayers();
  const socket = new WebSocket(SERVER_URL);

  socket.addEventListener("open", () => {
    socket.send(serializeMessage(createCreateRoom(HOST_NAME)));
    statusEl.textContent = "Connected — creating room…";
  });

  socket.addEventListener("message", (event) => {
    handleMessage(parseMessage<ServerMessage>(String(event.data)));
  });

  socket.addEventListener("close", () => {
    statusEl.textContent = "Disconnected from server.";
  });
}

start();
