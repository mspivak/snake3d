import QRCode from "qrcode";
import {
  createCreateRoom,
  createStartGame,
  parseMessage,
  serializeMessage,
  buildJoinUrl,
  reduceLobbyPlayers,
  type GamePhase,
  type ServerMessage,
  type LobbyPlayer
} from "@snake3d/shared";
import { createBoardScene } from "./board.ts";

const SERVER_URL = import.meta.env["VITE_SERVER_URL"] ?? "ws://localhost:3001";
const HOST_NAME = "host-lobby";

const SERVER_HOSTNAME = new URL(SERVER_URL).hostname;

function joinOrigin(): string {
  const override = import.meta.env["VITE_PUBLIC_ORIGIN"];
  if (override !== undefined && override !== "") {
    return override;
  }
  const pageHost = window.location.hostname;
  if (pageHost !== "localhost" && pageHost !== "127.0.0.1") {
    return window.location.origin;
  }
  const port = window.location.port === "" ? "" : `:${window.location.port}`;
  return `${window.location.protocol}//${SERVER_HOSTNAME}${port}`;
}

const codeEl = document.getElementById("room-code") as HTMLElement;
const qrCanvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
const joinUrlEl = document.getElementById("join-url") as HTMLElement;
const listEl = document.getElementById("player-list") as HTMLElement;
const countEl = document.getElementById("player-count") as HTMLElement;
const emptyEl = document.getElementById("player-empty") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;
const boardCanvas = document.getElementById("board-canvas") as HTMLCanvasElement;
const startButton = document.getElementById("start-button") as HTMLButtonElement;
const restartButton = document.getElementById("restart-button") as HTMLButtonElement;
const gameoverCard = document.getElementById("gameover-card") as HTMLElement;
const gameoverDetail = document.getElementById("gameover-detail") as HTMLElement;

const board = createBoardScene(boardCanvas);
board.start();

let players: LobbyPlayer[] = [];
let phase: GamePhase = "lobby";
let roomCode = "";
let socket: WebSocket | undefined;

function sendStart(): void {
  if (socket !== undefined && socket.readyState === WebSocket.OPEN && roomCode !== "") {
    socket.send(serializeMessage(createStartGame(roomCode)));
  }
}

function renderLifecycle(): void {
  const inLobby = phase === "lobby";
  const isOver = phase === "over";
  startButton.classList.toggle("hidden", !inLobby);
  startButton.disabled = !inLobby || players.length === 0;
  gameoverCard.classList.toggle("hidden", !isOver);

  if (phase === "playing") {
    statusEl.textContent = "Game in progress.";
  } else if (isOver) {
    statusEl.textContent = "Round over.";
  }
}

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
  const joinUrl = buildJoinUrl(joinOrigin(), roomCode);
  joinUrlEl.textContent = joinUrl;
  void QRCode.toCanvas(qrCanvas, joinUrl, { width: 150, margin: 1 });
}

function handleMessage(message: ServerMessage): void {
  if (message.type === "room-created") {
    roomCode = message.payload.roomCode;
    renderRoom(message.payload.roomCode);
    statusEl.textContent = "Room open — share the code or QR to let players in.";
    renderLifecycle();
    return;
  }
  if (message.type === "player-joined" || message.type === "player-left") {
    players = reduceLobbyPlayers(players, message);
    renderPlayers();
    renderLifecycle();
    return;
  }
  if (message.type === "game-state") {
    board.update(message.payload.state);
    phase = message.payload.phase;
    if (phase === "over") {
      const alive = message.payload.state.snakes.filter((s) => s.status === "alive");
      gameoverDetail.textContent =
        alive.length === 1
          ? "One snake is left standing."
          : "All snakes have fallen.";
    }
    renderLifecycle();
  }
}

function start(): void {
  renderPlayers();
  renderLifecycle();
  const ws = new WebSocket(SERVER_URL);
  socket = ws;

  ws.addEventListener("open", () => {
    ws.send(serializeMessage(createCreateRoom(HOST_NAME)));
    statusEl.textContent = "Connected — creating room…";
  });

  ws.addEventListener("message", (event) => {
    handleMessage(parseMessage<ServerMessage>(String(event.data)));
  });

  ws.addEventListener("close", () => {
    statusEl.textContent = "Disconnected from server.";
  });
}

startButton.addEventListener("click", sendStart);
restartButton.addEventListener("click", sendStart);

start();
