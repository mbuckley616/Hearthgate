import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import http from "node:http";
import { FightRoom } from "./rooms/FightRoom.js";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, game: "hearthgate", phase: 1 });
});

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer })
});

// One room type for T1: the combat slice's fight. Play creates one (solo is a room of one); a code joins one by id.
gameServer.define("fight", FightRoom);

gameServer.listen(PORT).then(() => {
  console.log(`Hearthgate server listening on ws://localhost:${PORT}`);
  console.log(`Health check:                http://localhost:${PORT}/health`);
});
