# Hearthgate: conventions for Claude Code

Read this first in every session. The design doc is `docs/design-doc.md`; the current plan is `docs/backlog.md`; history is `docs/devlog.md`.

## What this project is

A browser co-op dungeon crawler with a host-owned village, portals into short runs, and region-based trading. Phase 0 (now) is only the netcode spike. Build phases in order; each has an exit gate in the design doc's Milestones section. Do not start the next phase's content before the current gate is met and recorded in `docs/playtest-notes.md`.

## Architecture rules (never bend these)

1. **The server is the only source of truth.** Positions, hits, states, damage, loot, items: decided in `server/` by stepping `@hearthgate/shared`. The client sends `InputFrame`s and draws state. If a feature needs the client to decide something, the design is wrong.
2. **`shared/src/sim.ts` stays deterministic and side-effect free.** No `Date.now()`, no `Math.random()` without a seeded RNG passed in, no DOM, no Node APIs. Time is always a `now` argument in ms. Both sides must produce identical results from identical inputs; the unit tests assert this.
3. **Items, when they arrive (Phase 3), move only through the item and trade service** inside a database transaction. Nothing else creates, moves or destroys an item.
4. **Keyboard-only must always work.** Any new interaction gets a key and a gamepad button before it gets a mouse or touch binding. Nothing requires hover.
5. **Nothing may block a later touch layout.** HUD stays in the corners, interactive elements at least 48 px, no hover-only UI.

## Working rhythm

- Start a session by reading `docs/backlog.md` and the last devlog entry. Pick the top item unless the user says otherwise.
- Small, reviewable changes. One feature or one bug per commit.
- Before every commit: `npm run check` (typecheck plus shared unit tests). Before committing anything that touches `server/` or `client/src/net.ts`: also `npm run test:net`.
- End a session by appending a devlog entry (date, what changed, what was learned, what is next) and updating the backlog. Never leave the backlog stale.
- Playtests go in `docs/playtest-notes.md` with the date, who played, connection types, and the three gate questions answered.

## Model split

- **Fable** for cross-cutting work: netcode and reconciliation changes, the shared simulation's structure, the item ledger, splitting modules, anything that touches server and client together.
- **Opus** for contained features and bug hunts: a new enemy, a HUD element, a dungeon room type, a failing test.

## Code style

- TypeScript strict. Named exports. No default exports except where a framework requires one.
- Constants in `shared/src/sim.ts` are the tuning surface; change numbers there, not inline.
- Comments explain *why* (a timing choice, a netcode trade-off), not *what*.
- Prefer plain objects for simulation state and copy into Colyseus schema in `DungeonRoom.syncState`. Do not step the simulation on schema objects.
- Three.js: build meshes once in `client/src/render.ts`, update them per frame. No allocations inside `draw()` beyond the existing small vectors.

## How the netcode works (so you do not break it)

- Server ticks at `TICK_RATE` (20 Hz). Each tick it applies up to two queued inputs per player, resolves attacks, steps the goblin, syncs schema. `patchRate` equals the tick, so clients get one patch per tick.
- Client ticks input at 20 Hz: samples, predicts its own player with `applyInput`, stores the frame in `pending`, sends it.
- On every patch the client **rewinds** its own player to the server's copy and **replays** all pending frames the server has not applied (`seq > lastSeq`). The difference between where it was drawn and where it now is goes into a decaying visual offset so corrections never pop. Big errors (over `SNAP_DISTANCE`) snap.
- Other players and the goblin are **interpolated** 100 ms behind the estimated server time between received snapshots. No extrapolation yet (see backlog).
- The client's "now" for prediction is `predictedTime`, which is server time plus one tick per unconfirmed input. Do not mix it with `performance.now()`.

## When unsure

Ask the user, with the trade-off stated in one or two sentences. He is a product manager and will decide quickly; he does not want a long menu of options.
