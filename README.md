# Hearthgate

A browser-based co-op fantasy game: a village you own, portals into short dungeon runs, and an economy that rewards visiting and trading with other players. Playable solo with hirelings, better with friends at any level.

This repository is at **Phase 0: the netcode spike**. Two or more browsers join one room, fight one goblin with one attack, and the whole thing runs on an authoritative server with client-side prediction. Nothing else is built yet, on purpose: if this does not feel good, nothing after it matters.

The design doc lives in `docs/design-doc.md`. Session history is in `docs/devlog.md`, what to build next in `docs/backlog.md`.

## First run (about five minutes)

You need **Node.js 20 or newer**. Check in a terminal (or the Claude Code terminal):

```
node --version
```

If that prints `v20` or higher you are set. If not, install the LTS build from https://nodejs.org and reopen the terminal.

Then, from the repository folder:

```
npm install
npm run dev
```

This starts the game server on port 2567 and the client on port 5173. Open **http://localhost:5173** in a browser tab. Open it again in a second tab (or a second browser). Both tabs are in the same room.

Controls: **WASD** or arrows to move, **J** or **Space** to attack, **Shift** to dodge. A gamepad works too: left stick, X to attack, A to dodge.

Add `?name=Yourname` to the URL to pick a name, for example `http://localhost:5173/?name=Michael`.

## Playing with a friend on another network

Phase 0's real test is two people on different connections. Two options:

**Option A, a tunnel (fastest, no hosting bill).** Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) or [ngrok](https://ngrok.com/). With `npm run dev` running, open a second terminal and tunnel the server:

```
cloudflared tunnel --url http://localhost:2567
```

It prints a public `https://something.trycloudflare.com` address. Build and serve the client with that address baked in as the server:

```
npm run build
npx vite preview --host
```

Your friend opens `http://<your-lan-ip>:4173/?server=wss://something.trycloudflare.com` if they are on your network, or you tunnel port 4173 too and send them that address with the same `?server=` parameter.

**Option B, a small VPS.** Copy the repo, `npm install`, `npm run start:server`, serve `client/dist` from any static host, and point the client at `wss://your-server:2567` with `?server=`. This is the Phase 4 setup; a tunnel is enough for Phase 0.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Server and client together with live reload |
| `npm run dev:server` / `npm run dev:client` | Each on its own |
| `npm test` | Unit tests for the shared simulation |
| `npm run test:net` | Boots a server, joins two headless clients, checks they sync. No browser needed |
| `npm run test:e2e` | Browser test with Playwright (first time: `npx playwright install chromium`) |
| `npm run typecheck` | TypeScript across all three packages |
| `npm run check` | Typecheck plus unit tests, the pre-commit minimum |
| `npm run build` | Production client build into `client/dist` |

## Layout

```
shared/   @hearthgate/shared   the deterministic simulation both sides run
server/   @hearthgate/server   Colyseus room: the only place game truth lives
client/   @hearthgate/client   Vite + Three.js: render, input, prediction, HUD
tests/                         netcode smoke test and the Playwright e2e test
docs/                          design doc, devlog, backlog, playtest notes
```

The rule that shapes everything: **the browser never decides anything.** It sends inputs and draws what the server says, predicting its own movement only so it feels instant. See `CLAUDE.md` for the working conventions.

## Phase 0 exit gate

Two people on different networks fight the goblin together and both say it feels responsive: movement is instant, hits land where they look like they land, and nothing teleports. Record the session in `docs/playtest-notes.md`. Only then does Phase 1 (the combat slice) start.
