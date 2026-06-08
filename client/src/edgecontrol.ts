import {
  serializeMessage,
  createDirectionInput,
  type Vec3
} from "@snake3d/shared";

export interface Frame {
  forward: Vec3;
  up: Vec3;
}

export type TurnAction = "left" | "right" | "up" | "down";

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y + 0,
    y: a.z * b.x - a.x * b.z + 0,
    z: a.x * b.y - a.y * b.x + 0
  };
}

export function neg(v: Vec3): Vec3 {
  return { x: -v.x + 0, y: -v.y + 0, z: -v.z + 0 };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function equalVec(a: Vec3, b: Vec3): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function applyTurn(frame: Frame, action: TurnAction): Frame {
  const right = cross(frame.forward, frame.up);
  switch (action) {
    case "right":
      return { forward: right, up: frame.up };
    case "left":
      return { forward: neg(right), up: frame.up };
    case "up":
      return { forward: frame.up, up: neg(frame.forward) };
    case "down":
      return { forward: neg(frame.up), up: frame.forward };
  }
}

export function perpUp(up: Vec3, forward: Vec3): Vec3 {
  const nonZero = up.x !== 0 || up.y !== 0 || up.z !== 0;
  if (dot(up, forward) === 0 && nonZero) {
    return up;
  }
  return Math.abs(forward.y) === 1
    ? { x: 0, y: 0, z: 1 }
    : { x: 0, y: 1, z: 0 };
}

export function reframe(forward: Vec3, prevUp: Vec3): Frame {
  return { forward, up: perpUp(prevUp, forward) };
}

export function edgeAt(
  x: number,
  y: number,
  width: number,
  height: number
): TurnAction {
  const left = x;
  const right = width - x;
  const top = y;
  const bottom = height - y;
  let action: TurnAction = "left";
  let best = left;
  if (right < best) {
    best = right;
    action = "right";
  }
  if (top < best) {
    best = top;
    action = "up";
  }
  if (bottom < best) {
    best = bottom;
    action = "down";
  }
  return action;
}

export interface EdgeControlHandle {
  destroy(): void;
  sync(forward: Vec3): void;
}

const FLASH_MS = 180;
const SAFETY_MS = 1500;

const HINT_GLYPHS: Record<TurnAction, string> = {
  left: "◀",
  right: "▶",
  up: "▲",
  down: "▼"
};

export function mountEdgeControl(
  container: HTMLElement,
  socket: Pick<WebSocket, "readyState" | "send" | "OPEN">
): EdgeControlHandle {
  let frame: Frame = reframe({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  let pending: Vec3 | null = null;
  let safetyTimer: ReturnType<typeof setTimeout> | undefined;

  const hints: Record<TurnAction, HTMLElement> = {} as Record<
    TurnAction,
    HTMLElement
  >;
  const flashTimers: Record<TurnAction, ReturnType<typeof setTimeout> | undefined> =
    {} as Record<TurnAction, ReturnType<typeof setTimeout> | undefined>;

  for (const action of ["left", "right", "up", "down"] as TurnAction[]) {
    const hint = document.createElement("div");
    hint.className = `edge-hint edge-hint-${action}`;
    hint.textContent = HINT_GLYPHS[action];
    container.appendChild(hint);
    hints[action] = hint;
  }

  function flash(action: TurnAction): void {
    const hint = hints[action];
    hint.classList.add("flash");
    if (flashTimers[action] !== undefined) {
      clearTimeout(flashTimers[action]);
    }
    flashTimers[action] = setTimeout(() => {
      hint.classList.remove("flash");
      flashTimers[action] = undefined;
    }, FLASH_MS);
  }

  function onPointerDown(event: PointerEvent): void {
    if (pending !== null) {
      return;
    }
    const action = edgeAt(
      event.clientX,
      event.clientY,
      container.clientWidth,
      container.clientHeight
    );
    frame = applyTurn(frame, action);
    pending = frame.forward;
    if (socket.readyState === socket.OPEN) {
      socket.send(serializeMessage(createDirectionInput(frame.forward)));
    }
    flash(action);
    if (safetyTimer !== undefined) {
      clearTimeout(safetyTimer);
    }
    safetyTimer = setTimeout(() => {
      pending = null;
      safetyTimer = undefined;
    }, SAFETY_MS);
  }

  container.addEventListener("pointerdown", onPointerDown);

  function sync(forward: Vec3): void {
    if (pending !== null) {
      if (equalVec(forward, pending)) {
        pending = null;
        if (safetyTimer !== undefined) {
          clearTimeout(safetyTimer);
          safetyTimer = undefined;
        }
        frame = { forward, up: perpUp(frame.up, forward) };
      }
      return;
    }
    if (!equalVec(forward, frame.forward)) {
      frame = reframe(forward, frame.up);
    } else {
      frame.up = perpUp(frame.up, forward);
    }
  }

  function destroy(): void {
    container.removeEventListener("pointerdown", onPointerDown);
    if (safetyTimer !== undefined) {
      clearTimeout(safetyTimer);
      safetyTimer = undefined;
    }
    for (const action of ["left", "right", "up", "down"] as TurnAction[]) {
      if (flashTimers[action] !== undefined) {
        clearTimeout(flashTimers[action]);
      }
      hints[action].remove();
    }
  }

  return { destroy, sync };
}
