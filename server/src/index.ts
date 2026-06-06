import { createGameServer } from "./server.ts";

const PORT = Number(process.env["PORT"] ?? 3001);

const server = await createGameServer({ port: PORT });
console.log(`[server] listening on ws://localhost:${server.port}`);
