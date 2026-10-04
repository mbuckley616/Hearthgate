# Devlog

Newest entry first. One entry per session: what changed, what was learned, what is next.

## 2026-10-04: Session 12, respawns are placements, not snaps

**What changed**

- The critic's bug: `reconcile` counted the server moving us to our spawn as a prediction error over `SNAP_DISTANCE`, so every respawn and wipe raised the HUD's corrections and `__hg.snaps`, and the lag lab's snaps a minute with them. Now a patch that takes us from dead to standing (a bleed-out, a cleared room, a wipe) is a placement: the client takes the server's position, clears the visual offset and counts nothing. The first patch after joining is treated the same, since the client starts at the origin and the server puts us at a spawn (it counted one snap per join before). Real errors are unchanged: a 3.5 m error while standing still snaps and counts.
- `tests/reconcile-placement.ts` feeds the real `Net` class fake patches (no server): joining, downed, dead, respawned 10 m away, then a real error. It fails on the old code (joining alone counted a snap) and passes now. `npm run test:net` runs it first.

**Learned**

- Pickup (downed to standing) is left counted on purpose: the player stays where they crawled, so any error there is a real one.
- `Net` runs under tsx in Node without a browser, so client netcode can be checked headless by calling `onState` with plain objects; useful for later reconcile work.

**Next**

- The critic's first bug (movement speed falls with frame rate) is filed as likely **(Fable)** and waits for a card. The rest of Phase 1 waits on the four questions in `decisions.md`.

## 2026-10-04: Session 11, controls hint clear of the ability slots

**What changed**

- The critic's bug: between 601 and about 750 px wide the bottom-left controls hint ran under ability slots 1 and 2 (109 px of overlap at 640 x 400). The hint is now capped at the width left of the slots (`max-width: calc(100% - 226px)`: the 14 px gutter, the 184 px of slots, their 14 px gutter and a 14 px gap) and wraps upward instead. Under 600 px it is still hidden.
- `tests/mobile.e2e.ts` gains a 640 x 400 viewport and checks, wherever the hint shows, that it stays on screen and clear of the slots and the top panels. Without the fix the new case fails on the overlap; with it, 4 of 4 pass.

**Learned**

- The hint panel had no right edge at all, so any viewport between the breakpoint and the hint's natural one-line width was exposed. A bound tied to the slots' size fixes the whole range rather than one width.

**Next**

- The critic's third bug: respawn and wipe teleports counted as snaps and corrections.

## 2026-10-04: Session 10, ability slots and Cleave

**What changed**

- Three ability slots a player, pressed with 1, 2, 3 (number row or numpad) or Y, B, RB on a gamepad. `InputFrame` gains an optional `ability` (0 to 3; absent means none, so older frames and the bot harness stay valid); `isValidInput` rejects anything else. Which ability sits in a slot comes from the weapon: the sword is the only weapon, so `SWORD_SLOTS` is Cleave, empty, empty. Arrow rain and Magic missile wait for the bow and the staff (weapon classes, blocked on The Old Gates).
- Cleave (`ABILITIES.cleave` in `sim.ts`): a committed move like the sword swing, predicted the same way. 250 ms windup, 600 ms total, 2.8 m reach, a 198 degree arc (the sword's is 108), 14 damage, 6 s cooldown. It hits as melee and area (so it lands in full on a Rooted target), applies Staggered (Session 8's states: the setup for a later Execute or Backstab), and breaks a goblin windup in progress, which is how Melee answers a telegraph. Downed players cannot use it; respawning clears the cooldowns.
- Server: the schema carries `abilityUntil`, `abilityHitAt`, `abilitySlot` and the per-slot `readyAt` as an `ArraySchema`, and Cleave's hit is an `abilityHit` event. Client: the cooldowns come back in `reconcile`; a wide arc flashes when Cleave lands, for you and for others; hits nudge and sound like the sword's; the log says "You cleaved the goblin for 14: staggered, swing broken".
- HUD: the slots sit in the bottom-right corner as three 56 px boxes with the key, the name and a cooldown count (empty slots dashed). The event log moved up above them. The controls hint lists the new keys.
- Tests: 6 unit tests in `shared/src/abilities.test.ts` (50 total): validation, commit and cooldown, empty slots and the downed, the hit with stagger and interrupt, the wider arc, prediction parity. `npm run test:net` has Alpha walk up and Cleave the goblin (landed in 553 ms), and checks Bravo sees Alpha's slot cooling down, which proves the array syncs. The mobile e2e test checks the slots are on screen in the bottom half, at least 48 px, clear of the top panels; 4 of 4 e2e pass.

**Learned**

- The sword swing and Cleave share one rule for "committed" (`isAttacking` covers both), which kept the downs pickup and the movement lock right without touching either.
- A Playwright locator that matches three elements fails in strict mode inside `boundingBox`; pick one slot by its `data-slot`.

**Next**

- Unblocked Phase 1 work left: the Goblin Warrens floor (rooms, an objective, stairs). It turns one goblin into many and adds walls to movement, which reshapes the shared sim and touches server and client together; the builder will raise it as a question before starting.
- Michael's answers on The Old Gates access and the Revive Draught unblock the rest.

## 2026-10-04: Session 9, four-player stress test

**What changed**

- `npm run test:net` ends with a stress run: `STRESS_BOTS` bots (default 4) join a fresh room and, for `STRESS_MS` (default 5 s), each walks a circle at its own phase at the client's 20 Hz, swinging every 15 inputs and dodging every 40. It fails if any client does not see every bot, any bot is dropped (the flood limit must not trip on honest bots), the server has not applied a bot's inputs to within 3 of the last sent, two clients disagree on a bot's position by over 0.5 m, any client gets under 18 patches a second or waits over 200 ms for one, or the server tick strays more than 5% from wall time.
- Measured on loopback, 5 s: 4 bots and 8 bots (the room's maximum) both: 99 inputs each, all applied, clients agree exactly, 20.0 patches a second to every client, worst gap 51 ms, server tick 1.000 of wall time.
- The script's header lists the downs check from Session 7, which it had not.

**Learned**

- Eight players cost the server nothing visible at this size of simulation: the patch cadence is the tick, to the millisecond. The load that will matter is the floor (many enemies) and state sync, not the player count; the stress run is the place to grow that check when the floor lands.
- `tests/clock-sync.ts` has six type errors under the root `tsconfig.json` (narrowing to `never` on line 239). `npm run check` does not typecheck `tests/`, and tsx runs it regardless, so nothing caught it. Left for the Fable session that owns it; the new stress code typechecks clean.

**Next**

- The remaining unblocked Phase 1 items are the ability slots (they change `InputFrame` and lean on weapon styles, which are blocked) and the Goblin Warrens floor. Michael's answers on The Old Gates access and the Revive Draught unblock five more.

## 2026-10-04: Session 8, states and combo payoffs

**What changed**

- `shared/src/states.ts`: the six states from the design doc on a target (`StateSet`), each remembering who applied it. `applyState` applies or refreshes (a refresh extends to a full duration and adds the applier once), `expireStates` drops the old ones each tick, and `resolveHit` takes a hit's damage and tags and returns the final damage, what it consumed, and the payoffs for the caller to carry out. The "Consumed by" column is a table: Soaked by lightning (chain to enemies within 4 m for 60% of the hit) or frost (frozen: rooted and chilled for 2 s); Staggered by backstab or execute (double damage and a 1.2 s knockdown); Burning by oil or wind (spread within 4 m); Rooted by area hits (full multiplier, cannot dodge); Chilled by Shatter (+40). Marked is never consumed: +25% on every hit from anyone.
- The payoff multiplier is 1 + 0.5 per distinct contributor beyond the first (appliers plus the finisher), counted up to 4 (2.5x), so two players setting up and a third finishing is worth 2x what the veteran does alone, and a full room of eight does not one-shot anything. Numbers are `STATES` and `COMBO` in `sim.ts`, first guesses for playtests.
- Wired into the sim already: the goblin carries a `StateSet`, expires it every tick and clears it on death and wipe; the sword hit goes through `resolveHit` (tag "melee", so it only gains from Marked); a Rooted goblin does not move. Nothing applies a state in play yet: that is the abilities item.
- 9 unit tests in `shared/src/states.test.ts` (44 total); `npm run test:net` unchanged and green.

**Learned**

- `sim.ts` imports `states.ts` and `states.ts` reads the tuning from `sim.ts`. That cycle is safe only while `states.ts` touches the constants inside functions, so `STATE_KINDS` is a literal rather than `Object.keys(STATES)`, which would run before `STATES` exists.
- Chain, spread, freeze and knockdown come back as effects rather than being applied, because they need the other enemies and the enemy AI, and there is one goblin. The enemy roster item makes them real.

**Next**

- Three ability slots with Cleave, Arrow rain and Magic missile: they are the first things that apply and consume states. That needs new inputs in `InputFrame`, which changes the wire format the netcode reconciles; the builder will check whether it is a **(Fable)** item before starting.

## 2026-10-04: Session 7, downs, bleed-out and pickup

**What changed**

- `shared/src/sim.ts`: a player at zero health is downed, not dead (design doc, "Downs, revives and wipes"). Tuning is `DOWNS`: a 30 s bleed-out, a 1.2 m/s crawl with no swing or dodge, and a pickup by any standing teammate who stays within 2 m (centre to centre) for 1.5 s without swinging or dodging; walking off breaks the channel and it starts over. Picked-up players stand with 40 hp. Bleeding out is dead for the fight: no timer, back when the room is clear. Felling the goblin stands every downed player up where they lie and brings the dead back at their spawn after the usual 3 s. Nobody standing is a wipe: everyone respawns at their spawn after 3 s and the goblin resets to full health at its post. The goblin ignores the downed and goes for whoever is standing. New: `downPlayer`, `stepDowns`, `isDowned`, `isDead`; events `playerDowned`, `playerPickedUp`, `squadWiped`; `playerDied` now means bled out.
- The pickup is proximity, not a button: it needs no new input, so it works on keyboard, gamepad and a later touch layout alike, and `InputFrame` (the netcode's wire format) is unchanged.
- Server: `stepDowns` runs after the goblin each tick; the schema carries `downedUntil`, `pickupMs`, `pickupBy`. Client: prediction crawls a downed player at the server's speed (the state arrives in `reconcile`); a downed player lies down in their colour, the dead lie dark; a ground ring grows round the downed as the pickup fills; the centre banner shows the bleed-out countdown, the pickup percentage, or "back when the goblin falls".
- Tests: 8 unit tests in `shared/src/downs.test.ts` (crawl, pickup, broken channel, bleed-out without wipe, room clear, wipe once, the goblin's targeting, determinism); 35 total. `npm run test:net` now walks Bravo into the goblin until downed (8.9 s) and Alpha over to pick them up (2.3 s, Bravo at 40 hp). The mobile and hit-feedback e2e tests pass.

**Learned**

- Solo play is unchanged in feel: one player downed is nobody standing, so it wipes at once and respawns in 3 s, as before.
- The first four Phase 1 items and the enemy roster lift code from The Old Gates, and this cloud run is not allowed to clone that repository. They are marked **(design)** with a question for Michael (A: let the builder read it, recommended). The Revive Draught needs an item before the item ledger exists (rule 3), so it is a second question (A: a Phase 1 stand-in counter, recommended).

**Next**

- The state system (Soaked, Staggered, Marked, Burning, Rooted, Chilled) and the three ability slots are the next unblocked items.
- Michael's answers on The Old Gates access and the Revive Draught.

## 2026-10-04: Session 6, clock sync

**What changed**

- `shared/src/clock.ts` (tuned by `CLOCK_SYNC` in `sim.ts`): a pure clock estimator. Every stamped message from the server is a sample `serverTime - recvAt`: the patches (stamped with their tick, 20 a second) and the ping replies (the server's simulation time including the part of the tick elapsed; they also give the HUD its round trip). The largest sample in a 20 s window is the message with the shortest trip from the server, so it is the floor the snapshots can reach, and it is the target. The applied offset slews toward the target at 10 ms/s (a remote player drawn against it runs at most 1% off speed) and snaps only over 250 ms (first sample, a tab that slept). The card asked for the lowest-RTT reply; the shortest *return* trip is the quantity that matters, because the snapshots ride the return path and a quick outbound leg can pick a slow return. 7 unit tests, including a 90 s simulated 150 ms link with jitter and late packets (27 total).
- `server/src/rooms/DungeonRoom.ts`: the tick is locked to wall time. `setInterval(50)` fired every 50-and-a-bit ms, which made simulation time run 0.3 to 1.1% slow (measured as `srv rate` below); any client clock that assumes a second is a second then drifts against it, and the old per-patch EMA was quietly tracking that drift. A self-scheduling timer (`pump`) now runs every tick that is due, catching up at most four, and the patch goes out at the end of `step` with Colyseus's own patch interval off: that interval ran out of phase and sent each snapshot about 49 ms after the tick it carried, which is a whole tick of lag for everyone and would have eaten the interpolation budget once the clock was honest. `ping` is answered with `{ sentAt, serverTime }`.
- `client/src/net.ts`: the clock replaces the patch-offset EMA; `serverNow()` is server time as it reaches us on the least-delayed path and is never mixed with `predictedTime`. Pings go every 250 ms for the first twelve, then once a second. Snapshots carry their arrival time, corrections too big to smooth are counted as `snaps`, and `window.__hg` exposes `minRtt`, `clockOffset` and `snaps`. `Net` no longer touches `window`, so it runs in Node.
- `tests/clock-sync.ts` (`npm run test:clock`): a delay-and-jitter TCP proxy around the real `Net` class. One client walks, the other renders it at 60 Hz, and the run reports the clock's wander and fastest move, where it sits against the best delivery seen, the interpolation margin, held frames, and the driven player's corrections and snaps per minute, at 0, 50 and 150 ms round trips with jitter and 2% late packets. It fails if the clock moves faster than its slew limit, sits ahead of the delivery floor, or a remote player holds on a clean or 50 ms link. The lag lab in `tests/lab/` does not exist yet, so these are the numbers the card asked for; the critic can lift the proxy.
- `CLAUDE.md`: the netcode section describes the wall-locked tick, the patch at the step, and the clock.

Before and after, 30 s per link (the before run is `main` with only the `window` timer change so it runs in Node):

| link | server rate | offset sd (ms) | fastest move (ms/s) | clock vs floor max (ms) | margin p5 (ms) | held frames | corrections/min |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms, before | 0.996 | 34.9 | 7.2 | +11.3 | 48 | 0% | 0 |
| 0 ms, after | 1.000 | 4.4 | 10.0 | +0.3 | 51 | 0% | 0 |
| 50 ms, before | 0.996 | 39.2 | 9.6 | n/a | 45 | 0% | 0 |
| 50 ms, after | 1.000 | 5.8 | 10.0 | +0.1 | 38 | 0.1% | 0 |
| 150 ms, before | 0.999 | 29.1 | 17.2 | n/a | 34 | 1.7% | 0 |
| 150 ms, after | 1.001 | 23.7 | 10.1 | 0.0 | 13 | 1.3% | 0 |

The "before" clock's position against the floor is not meaningful (the floor is a run-wide maximum and the drifting server clock set it in the first seconds), so only the 0 ms figure, where drift is smallest, is shown. With 5% late packets instead of 2% the before run moved 39 ms/s at 150 ms (4% speed error) and held 2.6% of frames. Corrections and snaps are the prediction side and were not expected to change; they did not.

**Learned**

- The slew limit is now the fastest the clock moves at every link (10.0 ms/s); what remains at 150 ms is the target hopping between the floor and 25 to 40 ms below it as the best sample ages out, in the safe direction. The holds there are the fixed 100 ms budget, not the clock: a snapshot more than 50 ms late holds whatever the clock does. That is a tuning question for Michael (`decisions.md`, Pending).
- A timer per delayed chunk reorders chunks that arrive in the same event-loop turn, because Node starts timers from the loop's millisecond clock while the delays were computed from `performance.now()`. The proxy's first version did that and the WebSocket upgrade failed at 150 ms about half the time, which looked like a server bug for an hour. One queue per direction, drained from the head, fixed it.
- `tests/two-players.e2e.ts` still fails here (Alpha moves 1.2 m, not over 2) as Session 4 recorded; the other four e2e tests pass. The clock did not change the input path.

**Next**

- Michael's answer on the interpolation budget (A fixed 100, B fixed 150, C adaptive; C recommended).
- Extrapolation by up to one tick when a snapshot is late, then reconnect with a grace period.
- The critic's lag lab can start from `tests/clock-sync.ts`'s proxy.

## 2026-10-03: Session 5, hit feedback

**What changed**

- Landing a hit on the goblin slides the camera 0.12 m toward it for 110 ms; taking a hit shoves it 0.32 m away for 180 ms. The eye and the look target move together, so the view slides without tilting. Skipped under `prefers-reduced-motion`. Tuning is `HIT_FEEDBACK` in `shared/src/sim.ts`; the curve (fast out, eased back, peak early so it lands on contact) is `nudgeOffset` in `shared/src/feedback.ts`.
- `client/src/sound.ts`: a bright thwack for hits on the goblin and a low thud for hits on players, synthesised with WebAudio (filtered noise plus a falling tone), no assets. A friend's hits play at 35% volume and give no nudge. Audio starts on the first key, gamepad or touch, as browsers require.
- Presentation only: both are driven by the server's `playerHit` / `enemyHit` events and never touch the sim.
- Tests: 3 unit tests on the nudge curve (20 total). `tests/hit-feedback.e2e.ts` walks to the goblin, trades blows, and checks every hit you land or take nudged exactly once, with no page errors; 12 of 12 passed with the mobile tests over 3 repeats. `playwright.config.ts` now runs one worker, because every e2e test joins the same room.

**Learned**

- Running e2e tests in parallel put them all in one room, so one test counted another's hits. That also explains part of why `two-players.e2e.ts` waits for exactly 2 players.

**Next**

- Phase 0's builder items are done. What is left is **(Fable)** (extrapolation, clock sync, reconnect), **(Michael)** playtests, and the critic's lag lab. Michael answered the gate card "passed" on the control room; the producer records it and moves the phase.

## 2026-10-03: Session 4, mobile sanity check

**What changed**

- `tests/mobile.e2e.ts`: Playwright opens the client on emulated phones (Pixel 7 portrait and landscape, and a 360 x 640 Android) with touch on, and checks that the canvas fills the screen, the scene draws (more than 8 colours in the frame, so WebGL did not fail silently), both top HUD panels are on screen and do not overlap, HP text shows, there is no page scroll, and there are no page errors. All 3 pass.
- It found a real bug: on portrait phones the top-right net panel (ping, unconfirmed, corrections, room) ran about 300 px wide on one line and covered the health bars. `client/index.html` now drops the panels' desktop `min-width` under 600 px, tightens their padding, and caps the right panel at 36vw so the net line wraps. Checked by screenshot at 360 px.
- `playwright.config.ts` takes an optional `PW_CHROMIUM` executable path, so a machine with a preinstalled Chromium (cloud sessions) can run `npm run test:e2e` without `playwright install`.

**Learned**

- The existing `two-players.e2e.ts` fails here before and after this session: Alpha moves 0.3 to 0.6 m in a 700 ms key hold instead of about 4 m, and `bringToFront()` does not fix it. The server never drops the client, so it is not the new rate limit; it looks like headless Chromium throttling the input `setInterval` when two pages are open. CI does not run the e2e tests, so nothing caught it.
- Emulation is not a phone. A real phone over the LAN is still worth one look (GPU, notch, browser chrome), but nothing blocks it now.

**Next**

- Hit feedback: a camera nudge and a sound on `playerHit` and `enemyHit`.
- Someone should look at why the two-page e2e test barely moves.

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
