import * as THREE from "three";
import type { GameState } from "@snake3d/shared";
import { buildRenderItems, renderKey } from "./board.geometry.ts";

export {
  buildRenderItems,
  colorForPlayer,
  FOOD_COLOR,
  renderKey
} from "./board.geometry.ts";
export type { RenderItem, RenderItemKind } from "./board.geometry.ts";

export interface BoardScene {
  update(state: GameState): void;
  start(): void;
  dispose(): void;
}

export function createBoardScene(canvas: HTMLCanvasElement): BoardScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(0x0b0e14, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(5, 10, 7);
  scene.add(ambient, directional);

  const cubeGeometry = new THREE.BoxGeometry(0.85, 0.85, 0.85);
  const foodGeometry = new THREE.SphereGeometry(0.45, 16, 16);

  const meshes = new Map<string, THREE.Mesh>();
  let boundsBox: THREE.LineSegments | null = null;
  let currentSize = 0;
  let frame = 0;

  function ensureBounds(size: number): void {
    if (boundsBox && currentSize === size) {
      return;
    }
    if (boundsBox) {
      scene.remove(boundsBox);
      boundsBox.geometry.dispose();
    }
    currentSize = size;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const edges = new THREE.EdgesGeometry(geometry);
    geometry.dispose();
    boundsBox = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x3a4658 })
    );
    scene.add(boundsBox);

    const dist = size * 1.8;
    camera.position.set(dist, dist * 0.8, dist);
    camera.lookAt(0, 0, 0);
  }

  function resize(): void {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function update(state: GameState): void {
    ensureBounds(state.bounds.size);
    const items = buildRenderItems(state, state.bounds.size);
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const key = renderKey(item, index);
      seen.add(key);
      let mesh = meshes.get(key);
      if (!mesh) {
        const geometry = item.kind === "food" ? foodGeometry : cubeGeometry;
        mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({ color: item.color })
        );
        scene.add(mesh);
        meshes.set(key, mesh);
      }
      (mesh.material as THREE.MeshStandardMaterial).color.setHex(item.color);
      mesh.position.set(item.position.x, item.position.y, item.position.z);
    });
    for (const [key, mesh] of meshes) {
      if (!seen.has(key)) {
        scene.remove(mesh);
        (mesh.material as THREE.MeshStandardMaterial).dispose();
        meshes.delete(key);
      }
    }
  }

  function renderLoop(): void {
    resize();
    scene.rotation.y += 0.0015;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(renderLoop);
  }

  function start(): void {
    resize();
    if (frame === 0) {
      frame = requestAnimationFrame(renderLoop);
    }
  }

  function dispose(): void {
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    renderer.dispose();
  }

  return { update, start, dispose };
}
