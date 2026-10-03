import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import http from "node:http";
import { DungeonRoom } from "./rooms/DungeonRoom.js";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, game: "hearthgate", phase: 0 });
});

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer })
});

gameServer.define("dungeon", DungeonRoom);

gameServer.listen(PORT).then(() => {
  console.log(`Hearthgate server listening on ws://localhost:${PORT}`);
  console.log(`Health check:                http://localhost:${PORT}/health`);
});
