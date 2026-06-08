import {
  createHello,
  createJoinRoom,
  parseMessage,
  serializeMessage,
  parseRoomCodeFromQuery,
  joinReducer,
  initialJoinState,
  type GamePhase,
  type GameState,
  type JoinState,
  type JoinAction,
  type ServerMessage
} from "@snake3d/shared";
import { mountEdgeControl, type EdgeControlHandle } from "./edgecontrol.ts";
import { createPovRenderer, type PovRenderer } from "./pov.ts";

const SERVER_URL = import.meta.env["VITE_SERVER_URL"] ?? "ws://localhost:3001";

const joinView = document.querySelector<HTMLElement>("#join-view")!;
const waitingView = document.querySelector<HTMLElement>("#waiting-view")!;
const form = document.querySelector<HTMLFormElement>("#join-form")!;
const roomInput = document.querySelector<HTMLInputElement>("#room-code")!;
const nameInput = document.querySelector<HTMLInputElement>("#player-name")!;
const joinButton = document.querySelector<HTMLButtonElement>("#join-button")!;
const errorEl = document.querySelector<HTMLElement>("#join-error")!;
const waitingRoom = document.querySelector<HTMLElement>("#waiting-room")!;
const edgeControlView = document.querySelector<HTMLElement>("#edge-control")!;
const povView = document.querySelector<HTMLElement>("#pov-view")!;
const statusBanner = document.querySelector<HTMLElement>("#status-banner")!;

let state: JoinState = initialJoinState;
let socket: WebSocket | undefined;
let control: EdgeControlHandle | undefined;
let povReady: Promise<PovRenderer> | undefined;

function startPov(): void {
  if (povReady !== undefined) {
    return;
  }
  povView.classList.remove("hidden");
  povReady = createPovRenderer(povView);
}

let dead = false;

function setBanner(text: string): void {
  statusBanner.textContent = text;
  statusBanner.classList.toggle("hidden", text === "");
}

function applyLifeStatus(
  gameState: GameState,
  youPlayerId: string | undefined,
  phase: GamePhase
): void {
  const snake =
    youPlayerId === undefined
      ? undefined
      : gameState.snakes.find((s) => s.playerId === youPlayerId);
  const isDead = snake !== undefined && snake.status === "dead";

  if (phase === "over") {
    setBanner(isDead ? "You died — game over" : "Game over");
  } else if (isDead) {
    setBanner("You died — spectating");
  } else {
    setBanner("");
  }

  const shouldDisable = isDead || phase === "over";
  if (shouldDisable !== dead) {
    dead = shouldDisable;
    if (dead) {
      control?.destroy();
      control = undefined;
    } else if (state.status === "waiting" && socket !== undefined) {
      control = mountEdgeControl(edgeControlView, socket);
    }
  }

  if (!dead && snake !== undefined && snake.status === "alive") {
    control?.sync(snake.direction);
  }
}

function dispatch(action: JoinAction): void {
  state = joinReducer(state, action);
  render();
}

function render(): void {
  const waiting = state.status === "waiting";
  joinView.classList.toggle("hidden", waiting);
  waitingView.classList.toggle("hidden", !waiting);

  joinButton.disabled = state.status === "joining";
  joinButton.textContent = state.status === "joining" ? "Joining…" : "Join game";

  errorEl.textContent = state.status === "error" ? state.message : "";

  if (state.status === "waiting") {
    waitingRoom.textContent = state.roomCode;
    startPov();
  }

  edgeControlView.classList.toggle("hidden", !waiting || dead);
  if (waiting && !dead && control === undefined && socket !== undefined) {
    control = mountEdgeControl(edgeControlView, socket);
  } else if ((!waiting || dead) && control !== undefined) {
    control.destroy();
    control = undefined;
  }
}

function openConnection(roomCode: string, playerName: string): void {
  socket?.close();
  const ws = new WebSocket(SERVER_URL);
  socket = ws;

  ws.addEventListener("open", () => {
    ws.send(serializeMessage(createHello(playerName)));
    ws.send(serializeMessage(createJoinRoom(roomCode, playerName)));
  });

  ws.addEventListener("message", (event) => {
    const message = parseMessage<ServerMessage>(String(event.data));
    if (message.type === "joined") {
      dispatch({
        type: "joined",
        roomCode: message.payload.roomCode,
        playerId: message.payload.playerId
      });
    } else if (message.type === "join-error") {
      dispatch({
        type: "join-error",
        code: message.payload.code,
        message: message.payload.message
      });
      ws.close();
    } else if (message.type === "game-state") {
      const youPlayerId = message.payload.youPlayerId;
      startPov();
      povReady?.then((renderer) => {
        renderer.update(message.payload.state, youPlayerId);
      });
      applyLifeStatus(message.payload.state, youPlayerId, message.payload.phase);
    }
  });

  ws.addEventListener("error", () => {
    if (state.status === "joining") {
      dispatch({ type: "connection-error" });
    }
  });

  ws.addEventListener("close", () => {
    if (state.status === "joining") {
      dispatch({ type: "connection-error" });
    }
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  dispatch({
    type: "submit",
    roomCode: roomInput.value,
    playerName: nameInput.value
  });
  if (state.status === "joining") {
    openConnection(state.roomCode, state.playerName);
  }
});

const prefilledRoom = parseRoomCodeFromQuery(window.location.search);
if (prefilledRoom !== "") {
  roomInput.value = prefilledRoom;
}
render();
