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

export function computeHeadCamera(head: Cell, direction: Direction): HeadCamera {
  const forward = normalizeDirection(direction);
  return {
    cameraPosition: { x: head.x, y: head.y, z: head.z },
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

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

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
    const material = new THREE.LineBasicMaterial({ color: 0x3b82f6 });
    const wireframe = new THREE.LineSegments(edges, material);
    const half = size / 2 - 0.5;
    wireframe.position.set(half, half, half);
    boundsGroup.add(wireframe);
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

  function applyHeadCamera(snake: Snake): void {
    const head = snake.cells[0] ?? { x: 0, y: 0, z: 0 };
    const { cameraPosition, lookAtTarget } = computeHeadCamera(
      head,
      snake.direction
    );
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
  }

  function applyOverviewCamera(size: number): void {
    const center = size / 2 - 0.5;
    camera.position.set(center + size, center + size, center + size);
    camera.lookAt(center, center, center);
  }

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

    if (ownSnake) {
      applyHeadCamera(ownSnake);
    } else {
      applyOverviewCamera(size);
    }

    renderer.render(scene, camera);
  }

  function dispose(): void {
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
