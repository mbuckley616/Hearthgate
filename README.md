# Hearthgate

A browser-based co-op fantasy game: a village you own, portals into short dungeon runs, and an economy that rewards visiting and trading with other players. Playable solo with hirelings, better with friends at any level.

This repository is at **Phase 1: the combat slice**. Phase 0 (an authoritative server with client-side prediction) passed on 3 Oct 2026. Since 27 Oct the fight is Michael's combat slice moved over whole (`docs/slice-transplant-plan.md`): its knight, archer and mage, the antechamber, three waves and the Warden, its look and sound, running on Hearthgate's server with every player predicting their own hero. The village, the portal and generated dungeons are rebuilt on top of it next (see `docs/backlog.md`).

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

This starts the game server on port 2567 and the client on port 5173. Open **http://localhost:5173** and press Play: that is a fight of your own on the server. For a second player, open the pause menu (Esc), press Invite friends and open the link in another tab, or type its four-letter code under Join a party.

Controls: **WASD** to move, the mouse or the **arrows** to turn the camera, left click or **J** to attack, right click or **L** to guard, **Ctrl** to dodge, **Space** to jump, **Shift** to sprint, **Q** and **E** for abilities, **1 2 3** to swap hero, **F** to revive or start again. The full list, and the gamepad's, is under Controls on the title screen. Your name is in the pause menu.

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

## Hosted build

Merging to `main` ships. Render runs both halves from `render.yaml` on its free plan: the server at https://hearthgate-8lrq.onrender.com, which sleeps after 15 idle minutes and wakes in about a minute on the first join, and the client as a static site at https://hearthgate-client.onrender.com with the server URL baked in at build time. The hosted build is what the Phase 0 remote playtest uses; a tunnel (above) still works for a one-off.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Server and client together with live reload |
| `npm run dev:server` / `npm run dev:client` | Each on its own |
| `npm test` | Unit tests: the server's input queue and message checks, and parity with the slice's recorded fight |
| `npm run test:parity` | The same scripted fights through the slice's own code (its repo beside this one) and Hearthgate's copy, compared tick by tick |
| `npm run test:net` | Boots a server, plays bots and the real client session against it. No browser needed |
| `npm run test:e2e` | Browser smoke test with Playwright: solo, two players, the gate (first time: `npx playwright install chromium`) |
| `npm run lab` | The lag lab: two browsers through a delayed, lossy link, corrections and snaps a minute |
| `npm run typecheck` | TypeScript across all three packages |
| `npm run check` | Typecheck plus unit tests, the pre-commit minimum |
| `npm run build` | Production client build into `client/dist` |

## Layout

```
shared/   @hearthgate/shared   the slice's fight (sim, tuning, level), its protocol and the server's HostSession
server/   @hearthgate/server   Colyseus room: the only place game truth lives
client/   @hearthgate/client   the slice's client: render, camera, input, prediction, UI, sound
tests/                         parity, netcode smoke test, the lag lab and the Playwright smoke test
docs/                          design doc, devlog, backlog, playtest notes
```

The rule that shapes everything: **the browser never decides anything.** It sends inputs and draws what the server says, predicting its own movement only so it feels instant. See `CLAUDE.md` for the working conventions.

## The current gate

T1 of the slice transplant: side by side with the slice, solo on the hosted build feels the same (movement, the chains at 0.25x, hit feel, the look, the sound), then two players get through a run with no snap. Then the village and the portal return (T3) and the Phase 1 gate in the design doc follows (T5).
