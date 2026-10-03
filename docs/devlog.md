# Devlog

Newest entry first. One entry per session: what changed, what was learned, what is next.

## 2026-10-03: Session 3, input rate limiting

**What changed**

- `shared/src/sim.ts`: `INPUT_LIMIT` (25 a second refill, 25 burst) and a pure token bucket, `createInputBucket` / `takeInputToken`, timed by a `now` argument like the rest of the sim.
- `DungeonRoom` keeps one bucket per client and counts every `input` message before validation, so garbage costs the same as real frames. An empty bucket drops the client with close code 4001 (`CLOSE_INPUT_FLOOD`).
- 5 new unit tests (17 total): an honest 20 Hz client with ±30 ms jitter for a minute never trips; a one-second stall plus a 20-frame backlog dump passes; 60/s is dropped inside a second; 30/s is dropped only after more than 3 s; identical arrival times give identical results.
- `npm run test:net` adds a third client sending 80 inputs a second: dropped after 36 inputs in 656 ms with code 4001, while the two honest clients stay connected.

**Learned**

- The client sends from a fixed 50 ms `setInterval`, and background tabs only throttle it, never burst it, so 25/s leaves an honest client 5 inputs a second of headroom plus a full second of backlog.

**Next**

- Hit feedback (camera nudge and sound on hits), then the mobile sanity check.

## 2026-10-03: Session 2, the team, the control room and hosting

**What changed**

- Netcode smoke test runs on Windows: node is launched directly with the tsx loader instead of `npx` (a .cmd shim that spawn() cannot exec), and the server cwd comes from `fileURLToPath` (05e828e).
- Hosting on the free tier, all on Render: `render.yaml` runs the server (sleeps after 15 idle minutes) and builds the client as a static site with `VITE_SERVER_URL` baked in. `client/src/main.ts` reads it; `?server=` still overrides. GitHub Pages was the first plan and was dropped when the repo turned out to be private.
- The agent team, mirroring Neighborhood Airsoft: builder (Opus, every 3 h), Fable session (hourly card check), critic (daily, owns the new lag lab), producer (Sonnet, after each builder run, owns the phase gate). Slack #hearthgate (C0C6LQQF8CC). Control room artifact with a phase-and-gate card, a playtest form and a lag-lab table.
- `docs/decisions.md` with the three answers from today; backlog items marked **(Fable)** and **(Michael)**; a `## Found in play (the critic)` section; CLAUDE.md gained Shipping, The team, The room and the non-code files.

**Learned**

- The desktop app's dev-server preview injects `PORT`, and the Colyseus server honours it, so `npm run dev` through the preview tool makes the server steal Vite's port. `.claude/launch.json` (untracked) runs server and client as separate entries instead.
- A cloud routine cannot be created against a repository the account cannot reach; the routines had to wait for the repo to exist.

**Next**

- Michael connects Render to the repo (one click on the blueprint). If Render renames the server, he sets `VITE_SERVER_URL` on the client site to match.
- Then the builder takes rate limiting, hit feedback and the mobile check; the producer proposes the three Fable cards (extrapolation, clock sync, reconnect); the critic builds the lag lab.

## 2026-10-03: Session 1, Phase 0 scaffold

**What changed**

- New repo. Three npm workspaces: `shared` (deterministic simulation), `server` (Colyseus 0.16 room), `client` (Vite, Three.js, colyseus.js).
- Shared sim: player movement, dodge with i-frames, committed attack with a windup, cone hit test, goblin AI (idle, chase, windup, recover, dead, respawn), player death and respawn. 12 unit tests, including a determinism test.
- Server: `DungeonRoom` steps the sim at 20 Hz, applies at most two queued inputs per player per tick, validates input shape, broadcasts combat events, syncs plain sim objects into schema. Health endpoint.
- Client: prediction with rewind-and-replay reconciliation and a decaying visual error offset; remote players and the goblin interpolated 100 ms behind the server; keyboard and gamepad input; raised third-person follow camera; attack arc flash and a growing red telegraph for the goblin's swing; corner HUD with HP bars, party count, ping, unconfirmed inputs, corrections, and an event log.
- Tests: `npm run test:net` boots the server and joins two headless clients, drives one, and checks the other sees it move and the goblin aggroes. Playwright two-page e2e test written (needs `npx playwright install chromium` locally). CI runs typecheck, unit tests, netcode smoke and the client build.

**Learned**

- `@colyseus/schema` v3 decorators require `useDefineForClassFields: false` in tsconfig. With define semantics the class field initialisers overwrite the decorator's accessors and the encoder crashes with `Cannot read properties of undefined (reading 'Symbol(Symbol.metadata)')`.
- `tsx` only applies a tsconfig to files that tsconfig `include`s, so the server must be launched from `server/` (or with `--tsconfig server/tsconfig.json`) for `experimentalDecorators` to apply.
- Iterating a `Map` with `for...of` yields entries, not values. Caught by the enemy-targeting tests.

**Next**

- Local two-tab playtest, then a remote one with a friend over a tunnel. See the backlog.
