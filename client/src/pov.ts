import type * as THREE from "three";
import type { Cell, Direction, GameState, Snake, Vec3 } from "@snake3d/shared";

export interface HeadCamera {
  cameraPosition: Vec3;
  lookAtTarget: Vec3;
}

export function selectPlayerSnake(
  state: GameState,
  youPlayerId: string | undefined
): Snake | undefined {
  if (youPlayerId === undefined) {
    return undefined;
  }
  return state.snakes.find(
    (snake) => snake.playerId === youPlayerId && snake.status === "alive"
  );
}

function normalizeDirection(direction: Direction): Vec3 {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length === 0) {
    return { x: 1, y: 0, z: 0 };
  }
  return {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length
  };
}

export function computeHeadCamera(
  head: Cell,
  direction: Direction,
  back = 0,
  up = 0
): HeadCamera {
  const forward = normalizeDirection(direction);
  return {
    cameraPosition: {
      x: head.x - forward.x * back,
      y: head.y - forward.y * back + up,
      z: head.z - forward.z * back
    },
    lookAtTarget: {
      x: head.x + forward.x,
      y: head.y + forward.y,
      z: head.z + forward.z
    }
  };
}

export interface PovRenderer {
  update(state: GameState, youPlayerId: string | undefined): void;
  dispose(): void;
}

export async function createPovRenderer(
  container: HTMLElement
): Promise<PovRenderer> {
  const THREE = await import("three");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e14);

  const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(1, 2, 1);
  scene.add(sun);

  const boundsGroup = new THREE.Group();
  scene.add(boundsGroup);

  const dynamicGroup = new THREE.Group();
  scene.add(dynamicGroup);

  let currentBoundsSize = -1;

  const ownColor = new THREE.Color(0x4ade80);
  const otherColor = new THREE.Color(0xf87171);
  const foodColor = new THREE.Color(0xfacc15);

  const cellGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const foodGeometry = new THREE.SphereGeometry(0.45, 12, 12);

  function resize(): void {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();
  const resizeObserver = new ResizeObserver(() => {
    resize();
  });
  resizeObserver.observe(container);

  function buildBounds(size: number): void {
    boundsGroup.clear();
    const geometry = new THREE.BoxGeometry(size, size, size);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: 0x7dd3fc });
    const wireframe = new THREE.LineSegments(edges, material);
    const half = size / 2 - 0.5;
    wireframe.position.set(half, half, half);
    boundsGroup.add(wireframe);

    const grid = new THREE.GridHelper(size, size, 0x38507a, 0x21314f);
    grid.position.set(half, -0.5, half);
    boundsGroup.add(grid);

    currentBoundsSize = size;
  }

  function clearDynamic(): void {
    for (const child of [...dynamicGroup.children]) {
      dynamicGroup.remove(child);
      const mesh = child as THREE.Mesh;
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else if (material) {
        material.dispose();
      }
    }
  }

  function addCell(cell: Cell, color: THREE.Color): void {
    const material = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(cellGeometry, material);
    mesh.position.set(cell.x, cell.y, cell.z);
    dynamicGroup.add(mesh);
  }

  function addFood(cell: Cell): void {
    const material = new THREE.MeshLambertMaterial({ color: foodColor });
    const mesh = new THREE.Mesh(foodGeometry, material);
    mesh.position.set(cell.x, cell.y, cell.z);
    dynamicGroup.add(mesh);
  }

  function headCameraTarget(snake: Snake): { pos: Vec3; look: Vec3 } {
    const head = snake.cells[0] ?? { x: 0, y: 0, z: 0 };
    const { cameraPosition, lookAtTarget } = computeHeadCamera(
      head,
      snake.direction,
      6,
      3
    );
    return { pos: cameraPosition, look: lookAtTarget };
  }

  function overviewCameraTarget(size: number): { pos: Vec3; look: Vec3 } {
    const center = size / 2 - 0.5;
    return {
      pos: { x: center + size, y: center + size, z: center + size },
      look: { x: center, y: center, z: center }
    };
  }

  let currentPos: Vec3 = { x: 0, y: 0, z: 0 };
  let currentLook: Vec3 = { x: 0, y: 0, z: 0 };
  let targetPos: Vec3 = { x: 0, y: 0, z: 0 };
  let targetLook: Vec3 = { x: 0, y: 0, z: 0 };
  let hasTarget = false;
  let frameHandle = 0;

  const LERP = 0.12;
  const SNAP_EPSILON = 0.001;

  function lerp(from: Vec3, to: Vec3): Vec3 {
    const next = {
      x: from.x + (to.x - from.x) * LERP,
      y: from.y + (to.y - from.y) * LERP,
      z: from.z + (to.z - from.z) * LERP
    };
    if (
      Math.abs(to.x - next.x) < SNAP_EPSILON &&
      Math.abs(to.y - next.y) < SNAP_EPSILON &&
      Math.abs(to.z - next.z) < SNAP_EPSILON
    ) {
      return { x: to.x, y: to.y, z: to.z };
    }
    return next;
  }

  function renderFrame(): void {
    if (hasTarget) {
      currentPos = lerp(currentPos, targetPos);
      currentLook = lerp(currentLook, targetLook);

      camera.position.set(currentPos.x, currentPos.y, currentPos.z);

      const dx = currentLook.x - currentPos.x;
      const dy = currentLook.y - currentPos.y;
      const dz = currentLook.z - currentPos.z;
      const length = Math.hypot(dx, dy, dz) || 1;
      if (Math.abs(dy / length) > 0.9) {
        camera.up.set(0, 0, 1);
      } else {
        camera.up.set(0, 1, 0);
      }
      camera.lookAt(currentLook.x, currentLook.y, currentLook.z);

      renderer.render(scene, camera);
    }
    frameHandle = requestAnimationFrame(renderFrame);
  }

  frameHandle = requestAnimationFrame(renderFrame);

  function update(state: GameState, youPlayerId: string | undefined): void {
    const size = state.bounds.size;
    if (size !== currentBoundsSize) {
      buildBounds(size);
    }

    clearDynamic();

    const ownSnake = selectPlayerSnake(state, youPlayerId);
    for (const snake of state.snakes) {
      const color = snake.playerId === youPlayerId ? ownColor : otherColor;
      for (const cell of snake.cells) {
        addCell(cell, color);
      }
    }
    for (const cell of state.food) {
      addFood(cell);
    }

    const next = ownSnake
      ? headCameraTarget(ownSnake)
      : overviewCameraTarget(size);
    targetPos = next.pos;
    targetLook = next.look;

    if (!hasTarget) {
      currentPos = { x: targetPos.x, y: targetPos.y, z: targetPos.z };
      currentLook = { x: targetLook.x, y: targetLook.y, z: targetLook.z };
      hasTarget = true;
    }
  }

  function dispose(): void {
    cancelAnimationFrame(frameHandle);
    resizeObserver.disconnect();
    clearDynamic();
    boundsGroup.clear();
    cellGeometry.dispose();
    foodGeometry.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  }

  return { update, dispose };
}
