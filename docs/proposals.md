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

## 2026-10-13: Judge a dodge against the swing the player saw

**Why.** Measured this run (critic.md, 2026-10-13). Alpha stood beside the Shieldbearer, which Alpha's screen showed mid-windup, and pressed dodge. The client drew the dodge, 3.2 m. The next patch said the hit had already landed (hp 35 → 15) and the dodge never happened, and the player popped back. The pop comes from one number. A dodge covers 3.5 m (16 m/s for 220 ms), more than `SNAP_DISTANCE` (2.5 m), so a refused dodge is always a snap and never eases out.

The late press comes from the netcode's design. Enemies are drawn 100 to 200 ms behind the server (`INTERP`), and the player is predicted ahead. So a windup still on screen may already have resolved, and a press that looked in time arrives late. The lab's throttled 150 ms runs had 4 snaps in 14, all with Alpha hurt mid-fight, which fits the same cause.

Pillar three asks for "telegraphed attacks": the windup is the telegraph, and dodging through it is the decision the Charger's lane and every goblin swing teach. A dodge that worked on screen and was refused breaks that promise. It gets worse with distance, which is also the gate's question 3 ("did anything teleport, rubber-band?").

**What.** Two parts, which can land separately.
1. Never pop a refused dodge: ease it like any other correction. This could raise `SNAP_DISTANCE` above the dodge's length, or ease any error that is explained by a dodge or a throw. It is small and client only (`reconcile` in `client/src/net.ts`).
2. Judge the dodge against what the player saw. The server keeps the last few ticks of each enemy's hit times. When a dodge frame arrives, it counts as in time if the hit had not landed at (the frame's slot − that client's interpolation delay), and the hit is voided for that player. This is the usual "favour the shooter" lag compensation, applied to the defender, and it is bounded by the 200 ms cap the delay already has.

**Cost.** Part 1: `client/src/net.ts`, one session, a unit or `test:net` case. Part 2: `shared/` (the hit check takes a per-player look-back), `server/` (the client's delay reported or estimated), tests at 150 ms. One to two sessions. It changes how hits resolve on both sides, so it is **(Fable)**.

**Risk.** Part 1 hides real errors behind a bigger ease: a 3.5 m slide over `INTERP.easeMs` reads as a lurch, not a pop. That is still better, but not invisible. Part 2 lets a high-ping player dodge a swing the server already landed, by up to 200 ms. The other player sees the goblin's swing miss someone it seemed to hit. In co-op against AI that is the right side to err on (nobody is cheated), but it is a rule worth Michael's yes.

**Recommendation.** Part 1 after the gate playtest, sooner if the playtest's question 3 names a pop near a dodge. Ask the playtesters specifically whether a dodge ever "did not take". Hold part 2 until a human on a real link says dodges feel late. Headless at 220 ms I caught one in three 40 s fights, and I cannot tell how often a person would notice.

## 2026-10-15: Give the art a frame budget before the gate playtest

**Why.** Measured this run (critic.md, 2026-10-15). The Knight took the lab's pages from about 21 fps to about 8 on the field, and the Warrens draw at 2.4 to 4.7 fps on one page, against 19 on the field. This box renders in software, so the absolute numbers are not a player's. The ratios are, though: the Knight costs about 2.7 times the old figure's frame, and the Warrens about 4 times the field. Under 5 fps the input clock drops everything past four frames a gap, so the player lurches 1.2 m at a time at a quarter of run speed. The HUD then shows a ping of seconds on a perfect link. Michael's "stuck after the portal" is not reproduced as an input bug, and slow Warrens frames on his machine would explain it.

The gate asks whether a party on a real connection feels responsive. If the playtest machine's GPU struggles, the answer will be "no" for a reason that is not the network, and Phase 1 will be judged on the art. Pillar one is "works on a modest laptop first", and Phase 5 is phones.

**What.**
1. A frame-time readout on the HUD's net line next to ping and corrections: the slowest frame in the last second. A playtester can then tell slow frames from a bad link. Add `__hg.fps` for the lab.
2. Make the cuts the builder already named, measured one at a time with the lab's pages before and after:
   - two lit torches, not four;
   - torches and floor out of the shadow pass;
   - the outline drawn as one mesh, not each body part again;
   - the clip files cut to the 15 clips played.
3. The lab gains a frame-rate line: "slow" under 15 fps on a page. The critic can do that part itself.

**Cost.** Builder work in `client/` only (`hud.ts`, `render.ts`, `dungeon.ts`, `models.ts`), one or two sessions. No netcode, not Fable.

**Risk.** The torch and shadow cuts make the Warrens a little flatter, which is Michael's eye to judge against the style guide. The readout is one more line in a corner (rule 5 holds). If the playtest machine has a real GPU this buys nothing for the gate. It still buys Phase 5.

**Recommendation.** Part 1 now, before the gate playtest: it is small, and it turns "it felt stuck" into a number. Do part 2 if Michael's machine reads under 30 fps in the Warrens.
