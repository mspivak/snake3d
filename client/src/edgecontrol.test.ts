import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cross,
  neg,
  dot,
  equalVec,
  applyTurn,
  perpUp,
  reframe,
  edgeAt,
  mountEdgeControl,
  type Frame
} from "./edgecontrol.ts";
import { parseMessage, type DirectionInputMessage } from "@snake3d/shared";

const px = { x: 1, y: 0, z: 0 };
const py = { x: 0, y: 1, z: 0 };
const pz = { x: 0, y: 0, z: 1 };

test("cross of +x and +y is +z", () => {
  assert.deepEqual(cross(px, py), pz);
});

test("neg flips every component", () => {
  assert.deepEqual(neg({ x: 1, y: -2, z: 3 }), { x: -1, y: 2, z: -3 });
});

test("dot computes the scalar product", () => {
  assert.equal(dot(px, px), 1);
  assert.equal(dot(px, py), 0);
});

test("equalVec is exact integer equality", () => {
  assert.equal(equalVec(px, { x: 1, y: 0, z: 0 }), true);
  assert.equal(equalVec(px, py), false);
});

test("applyTurn right from +x/+y faces -z keeping up +y", () => {
  const frame: Frame = { forward: px, up: py };
  assert.deepEqual(applyTurn(frame, "right"), {
    forward: { x: 0, y: 0, z: -1 },
    up: py
  });
});

test("applyTurn left from +x/+y faces +z keeping up +y", () => {
  const frame: Frame = { forward: px, up: py };
  assert.deepEqual(applyTurn(frame, "left"), { forward: pz, up: py });
});

test("applyTurn up from +x/+y faces +y with up -x", () => {
  const frame: Frame = { forward: px, up: py };
  assert.deepEqual(applyTurn(frame, "up"), {
    forward: py,
    up: { x: -1, y: 0, z: 0 }
  });
});

test("applyTurn down from +x/+y faces -y with up +x", () => {
  const frame: Frame = { forward: px, up: py };
  assert.deepEqual(applyTurn(frame, "down"), {
    forward: { x: 0, y: -1, z: 0 },
    up: px
  });
});

test("perpUp keeps an up that is already perpendicular and non-zero", () => {
  assert.deepEqual(perpUp(py, px), py);
});

test("perpUp picks a default axis when up is not perpendicular", () => {
  assert.deepEqual(perpUp(px, px), py);
});

test("perpUp avoids the vertical axis when forward is vertical", () => {
  assert.deepEqual(perpUp(py, py), pz);
});

test("reframe pairs forward with a perpendicular up", () => {
  assert.deepEqual(reframe(px, py), { forward: px, up: py });
  assert.deepEqual(reframe(py, py), { forward: py, up: pz });
});

test("edgeAt resolves each of the four diagonal regions", () => {
  assert.equal(edgeAt(5, 100, 200, 200), "left");
  assert.equal(edgeAt(195, 100, 200, 200), "right");
  assert.equal(edgeAt(100, 5, 200, 200), "up");
  assert.equal(edgeAt(100, 195, 200, 200), "down");
});

interface SentMessage {
  payload: string;
}

function fakeSocket(): {
  readyState: number;
  OPEN: number;
  send: (data: string) => void;
  sent: SentMessage[];
} {
  const sent: SentMessage[] = [];
  return {
    readyState: 1,
    OPEN: 1,
    send: (data: string) => {
      sent.push({ payload: data });
    },
    sent
  };
}

function makeContainer(): HTMLElement {
  const hints: unknown[] = [];
  const listeners: Record<string, (e: unknown) => void> = {};
  const container = {
    clientWidth: 200,
    clientHeight: 200,
    children: hints,
    appendChild(child: unknown): unknown {
      hints.push(child);
      return child;
    },
    removeChild(child: unknown): void {
      const i = hints.indexOf(child);
      if (i >= 0) hints.splice(i, 1);
    },
    addEventListener(type: string, handler: (e: unknown) => void): void {
      listeners[type] = handler;
    },
    removeEventListener(type: string): void {
      delete listeners[type];
    },
    fire(type: string, e: unknown): void {
      listeners[type]?.(e);
    }
  };
  return container as unknown as HTMLElement;
}

function setupDom(): void {
  const g = globalThis as unknown as { document?: unknown };
  g.document = {
    createElement(): unknown {
      const el = {
        className: "",
        classList: {
          _set: new Set<string>(),
          add(c: string) {
            (this._set as Set<string>).add(c);
          },
          remove(c: string) {
            (this._set as Set<string>).delete(c);
          }
        },
        appendChild(child: unknown): unknown {
          return child;
        },
        remove(): void {}
      };
      return el;
    }
  };
}

function directionOf(raw: string): { x: number; y: number; z: number } {
  return parseMessage<DirectionInputMessage>(raw).payload.direction;
}

test("a single edge tap sends one perpendicular direction", () => {
  setupDom();
  const socket = fakeSocket();
  const container = makeContainer();
  const handle = mountEdgeControl(container, socket);

  (container as unknown as { fire: (t: string, e: unknown) => void }).fire(
    "pointerdown",
    { clientX: 195, clientY: 100 }
  );

  assert.equal(socket.sent.length, 1);
  const dir = directionOf(socket.sent[0].payload);
  assert.deepEqual(dir, { x: 0, y: 0, z: -1 });

  handle.destroy();
});

test("a second tap before sync is ignored, then accepted after sync", () => {
  setupDom();
  const socket = fakeSocket();
  const container = makeContainer();
  const fire = (container as unknown as {
    fire: (t: string, e: unknown) => void;
  }).fire;
  const handle = mountEdgeControl(container, socket);

  fire("pointerdown", { clientX: 195, clientY: 100 });
  assert.equal(socket.sent.length, 1);
  const first = directionOf(socket.sent[0].payload);

  fire("pointerdown", { clientX: 5, clientY: 100 });
  assert.equal(socket.sent.length, 1);

  handle.sync(first);

  fire("pointerdown", { clientX: 5, clientY: 100 });
  assert.equal(socket.sent.length, 2);
  assert.notDeepEqual(directionOf(socket.sent[1].payload), first);

  handle.destroy();
});
