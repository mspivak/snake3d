import {
  DIRECTIONS,
  serializeMessage,
  createDirectionInput,
  type DirectionName
} from "@snake3d/shared";

const DEAD_ZONE_PX = 18;

export function dragToDirectionName(
  dx: number,
  dy: number,
  deadZone: number = DEAD_ZONE_PX
): DirectionName | null {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude < deadZone) {
    return null;
  }
  const angle = Math.atan2(-dy, dx);
  const sector = Math.round(angle / (Math.PI / 4));
  switch (((sector % 8) + 8) % 8) {
    case 0:
      return "+x";
    case 1:
      return "+z";
    case 2:
      return "+y";
    case 3:
      return "+z";
    case 4:
      return "-x";
    case 5:
      return "-z";
    case 6:
      return "-y";
    default:
      return "-z";
  }
}

export function createDirectionDeduper(): (name: DirectionName | null) => boolean {
  let last: DirectionName | null = null;
  return (name) => {
    if (name === null || name === last) {
      return false;
    }
    last = name;
    return true;
  };
}

export interface JoystickHandle {
  destroy: () => void;
}

export function mountJoystick(
  container: HTMLElement,
  socket: Pick<WebSocket, "readyState" | "send" | "OPEN">,
  deadZone: number = DEAD_ZONE_PX
): JoystickHandle {
  const base = document.createElement("div");
  base.className = "joystick-base";
  const knob = document.createElement("div");
  knob.className = "joystick-knob";
  base.appendChild(knob);
  container.appendChild(base);

  const shouldSend = createDirectionDeduper();
  let pointerId: number | null = null;
  let originX = 0;
  let originY = 0;

  function maxRadius(): number {
    return base.clientWidth / 2 || 64;
  }

  function moveKnob(dx: number, dy: number): void {
    const limit = maxRadius();
    const magnitude = Math.hypot(dx, dy);
    const scale = magnitude > limit ? limit / magnitude : 1;
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }

  function resetKnob(): void {
    knob.style.transform = "translate(0px, 0px)";
  }

  function handle(dx: number, dy: number): void {
    moveKnob(dx, dy);
    const name = dragToDirectionName(dx, dy, deadZone);
    if (name !== null && shouldSend(name) && socket.readyState === socket.OPEN) {
      socket.send(serializeMessage(createDirectionInput(DIRECTIONS[name])));
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (pointerId !== null) {
      return;
    }
    pointerId = event.pointerId;
    originX = event.clientX;
    originY = event.clientY;
    base.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== pointerId) {
      return;
    }
    handle(event.clientX - originX, event.clientY - originY);
    event.preventDefault();
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== pointerId) {
      return;
    }
    pointerId = null;
    resetKnob();
    if (base.hasPointerCapture(event.pointerId)) {
      base.releasePointerCapture(event.pointerId);
    }
  }

  base.addEventListener("pointerdown", onPointerDown);
  base.addEventListener("pointermove", onPointerMove);
  base.addEventListener("pointerup", onPointerUp);
  base.addEventListener("pointercancel", onPointerUp);

  return {
    destroy: () => {
      base.removeEventListener("pointerdown", onPointerDown);
      base.removeEventListener("pointermove", onPointerMove);
      base.removeEventListener("pointerup", onPointerUp);
      base.removeEventListener("pointercancel", onPointerUp);
      base.remove();
    }
  };
}
