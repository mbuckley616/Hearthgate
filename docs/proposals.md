# Proposals (unapproved)

The critic's ideas, argued from what it measured. None of these is a spec: Michael promotes one into the backlog or decisions, nobody else.

## 2026-10-04: Send input for the time that passed, not per timer callback

**Why.** Measured this run: a held key moves the player 9.3 m in 1.5 s at 60 fps, 5.7 m at 21 fps and 2.1 m at 10 fps, because the client sends one 50 ms input frame per `setInterval` callback and a busy main thread skips callbacks. The server is right about what it received, so the netcode never sees the problem: the player on the weakest laptop simply walks slower and dodges shorter than their friends. The design doc's Phase 0 gate is "feels responsive on a laptop over a real connection", and pillar one is co-op with friends on whatever they own; a mixed-hardware party is the normal case, and the Phase 1 floor (more enemies, more draw cost) will make frames slower, not faster.

**What.** The input loop counts ticks due by wall clock and sends one frame per tick missed (up to a cap of about 4, matching the server's catch-up), each predicted at its own time. The server already applies up to two queued inputs a tick, so a short backlog drains in a tick or two; the flood limit (25 a second sustained) needs to tolerate a burst after a stall, which it likely already does on average but should be checked.

**Cost.** `client/src/main.ts` input loop and `client/src/net.ts` (prediction per frame), a look at `server/` input queue and flood limit, and a test: the lab can assert distance-per-second at a forced low frame rate. One session; it touches the input path the reconciliation depends on and server and client together, so **(Fable)** by CLAUDE.md's split.

**Risk.** A tab that slept for seconds must not dump a burst of stale movement: cap the catch-up and drop the rest, as the server's `pump` does. Bunched inputs arrive at the server together, so on a slow client remote viewers may see a slightly steppier walk; still better than a slow one.

**Recommendation.** Do it before the Warrens floor raises the frame cost, as the next Fable card after the interpolation budget. Until then, the fix for the long-failing `tests/two-players.e2e.ts` is a small viewport in that test (it passes at 320 x 200), which is builder work.

## 2026-10-07: Hold the Phase 1 gate playtest now; do not wait for the input card

**Why.** The producer has the gate playtest waiting on the Fable input card (frame-rate speed and tick-timing corrections, 3 to 5 hours, freezing the builder). Headless today, both halves of the gate happened with real clients on main 32dadcd: a tier-5 claymore and a tier-1 sword cleared the Warrens in 93 to 98 s, and Cleave then Execute put "Combo x1.5" on both screens eight times, once in a run that also cleared. The two input bugs bite where a human on a desktop mostly is not: the frame-rate one only below about 40 fps (a desktop browser holds 60), and the tick-timing corrections run 5 to 18 a minute on clean links, drawn smoothly by the decaying offset (no snap on a clean link in four days). Only at 150 ms one-way do they reach 30 to 40 a minute, and the playtest is local or on a good connection.

**What it costs.** Nothing to build: Michael and one other player, two tabs or two machines, about 20 minutes, the three gate questions into `playtest-notes.md`. The input card runs after it, unchanged.

**What it risks.** If the playtest feels a correction and blames the combat, the gate's answer is muddied; the HUD's corrections count, read at the end, separates the two. And a playtest before the input card means a second look at feel after it lands, which the Phase 2 work would want anyway.

**Recommendation.** Play the gate now, with the HUD's corrections number written beside the answers; start the input card the same day. The playtest's verdict on Execute's numbers, the callout's size and the portal's 2 s stand is the input the builder needs next, and it is blocked on nothing.
