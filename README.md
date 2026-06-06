# snake3d

3D multiplayer multi-screen snake. TypeScript monorepo built with npm workspaces.

## Layout

| Workspace | Stack | Role |
| --- | --- | --- |
| `client/` | Vite + Three.js + TypeScript | Browser renderer; opens a WebSocket to the server |
| `server/` | Node.js + `ws` + TypeScript | Authoritative game server |
| `shared/` | TypeScript | Message/state types shared by client and server |

The server is authoritative for game state; clients render and send input only. State is in-memory only (no DB, no auth, no persistence).

## Requirements

- Node.js >= 22 (uses native `--experimental-strip-types` for running TypeScript directly)
- npm >= 10

## Install

```sh
npm install
```

## Run locally

```sh
npm run dev
```

This builds `shared/`, then runs the Node `ws` server and the Vite client together via `concurrently`.

- Client: http://localhost:5173
- Server: ws://localhost:3001

Open the client in a browser and check the console — it logs `[client] connected to ws://localhost:3001` and `[client] welcome received, assigned id ...` once the WebSocket handshake completes.

Override the server URL the client connects to with the `VITE_SERVER_URL` env var; override the server port with `PORT`.

## Build

```sh
npm run build
```

Builds `shared/`, then type-checks and emits `server/`, then type-checks and bundles `client/`.

## Test

```sh
npm test
```

Runs the `shared/` and `server/` test suites with the Node test runner.
