import {
  createHello,
  createJoinRoom,
  parseMessage,
  serializeMessage,
  parseRoomCodeFromQuery,
  joinReducer,
  initialJoinState,
  type JoinState,
  type JoinAction,
  type ServerMessage
} from "@snake3d/shared";

const SERVER_URL = import.meta.env["VITE_SERVER_URL"] ?? "ws://localhost:3001";

const joinView = document.querySelector<HTMLElement>("#join-view")!;
const waitingView = document.querySelector<HTMLElement>("#waiting-view")!;
const form = document.querySelector<HTMLFormElement>("#join-form")!;
const roomInput = document.querySelector<HTMLInputElement>("#room-code")!;
const nameInput = document.querySelector<HTMLInputElement>("#player-name")!;
const joinButton = document.querySelector<HTMLButtonElement>("#join-button")!;
const errorEl = document.querySelector<HTMLElement>("#join-error")!;
const waitingRoom = document.querySelector<HTMLElement>("#waiting-room")!;

let state: JoinState = initialJoinState;
let socket: WebSocket | undefined;

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
