import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import http from "node:http";
import { DungeonRoom } from "./rooms/DungeonRoom.js";
import { VillageRoom } from "./rooms/VillageRoom.js";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, game: "hearthgate", phase: 1 });
});

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer })
});

// The client joins the village first; its portal makes a dungeon room a run, and the tests and the lab make one by level.
gameServer.define("village", VillageRoom);
gameServer.define("dungeon", DungeonRoom);

gameServer.listen(PORT).then(() => {
  console.log(`Hearthgate server listening on ws://localhost:${PORT}`);
  console.log(`Health check:                http://localhost:${PORT}/health`);
});
