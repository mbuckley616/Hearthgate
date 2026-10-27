# Devlog

Newest entry first. One entry per session: what changed, what was learned, what is next.

## 2026-10-27: local session, T4: the dungeon generator

**What changed**

- **The kit** (`shared/src/level/kit.ts`): 13 pieces in code on a 6 m grid (entrance, hall, long hall, corner, junction, crossing, staircase, small, medium and large rooms, the slice-sized arena, rest room, the Warden's hall), each with doorway sockets in the middle of a cell edge, pillars and braziers. Walls stand inside a piece's own cells, so neighbours meet back to back and never overlap.
- **The generator** (`generate.ts`): seeded and pure. A floor grows from its entrance, more than half the time from the newest doorways (paths run on) and otherwise from any doorway (branches); it puts the exit (a rest room, or the Warden's hall on the last floor) at the doorway farthest from the entrance, closes loops with short halls and corners between open doorways at one height that are four or more pieces apart, fills to the piece count with side rooms, and tidies away any hall that leads nowhere. Staircases climb or drop 2.4 m. A try that comes out without a joined staircase, a loop (14 pieces and up) or its exit moves to the next seed, so a spec always gives the same floor. About 2 ms for 50 pieces.
- **Floors as levels** (`floor.ts`): the slice's `LevelDef` and `World`, like the village: walls, lintels, a gate per doorway of each fight room (`World.roomColliders`), raised rooms as flat surfaces, staircases as the slice's ramps between landings.
- **The run, room by room** (`sim/floorRun.ts`): the slice's gate wait, intro, budgeted group (size, floor, party; grunts, archers and brutes), reinforcements and heal, per room; a wipe ends the run where it happens; the rest room banks drops. In `SimState.floor`, never set in the arena. The enemy code's only changes: a floor's open-ground check, and a guard for a level without ledge ramps.
- **Rings** are a list (the rest room's violet deeper and gold home), at their floor's height. **Protocol 4**: `welcome` carries a floor's spec, `snap` the rings.
- **Server**: `FloorRoom` per floor, carrying the run's plan (`runPlan.ts`, `tuning.dungeon`: 3 floors at tier 1, 15 pieces on the first floor growing 6 a floor, more with tier and level). The village's ring starts a run; the arena stays for the tests and the lab.
- **Client**: `FloorView` (pieces at their heights, staircases drawn as steps over the ramp, fading walls, portcullises, ten torch lights following the hero, shadows following the hero), the **minimap** (bottom right, every piece shaded by height, stairs arrowed, fight rooms dotted until cleared, the shut room in red, rings, party and your arrow; M or Start for the whole floor), floor texts in the run UI, `?floor&seed=N&pieces=N`.
- **Tests**: 9 generator tests on five seeds from 10 to 50 pieces (deterministic, distinct shapes, reachable, doorways face to face, no overlapping colliders even shut, branching and loops, a joined staircase, open doorways and spawn spots, a hero walking entrance to exit in the sim); 6 floor-run tests (check 51). `test:net`: two bots village → floor 1 → rest room → deeper → floor 2 → home, and the browser's ClientSession up a staircase with no snap. Browser smoke 4/4 with the round trip now through a floor. Parity identical.

**Learned**

- Growing only from the newest doorway makes one corridor; only from random ones makes a blob. A mix, plus loop-closing paths through empty cells, gives floors that branch and loop.
- A smooth ramp reads as flat floor from behind the hero; drawing steps over it (the sim still walks the ramp, feet within 10 cm) makes a climb obvious.
- One shadow map cannot cover a 150 m floor; the moon's shadow area follows the hero instead.
- A floor carries its corpses in every snapshot unless they go: the dead of the last room are dropped when the next room starts.

**Next**

- Michael: the T4 gate on the hosted build once merged: `?floor&play&seed=101&pieces=10`, `seed=202&pieces=18`, `seed=303&pieces=28&at=2`, `seed=404&pieces=40&floors=5`, `seed=505&pieces=50&floors=5&at=5` (M for the whole floor). (Michael answered the clearing question the same day: rings open on arrival, rooms can be skipped.)
- T4b, the dungeon editor; the builder can take kit pieces (archer ledges in the arena piece, more room shapes) and the minimap's polish.

## 2026-10-27: local session, T3: the village and the portal

**What changed**

- Michael on T1 and T2 (decisions.md): "Feels good"; lag testing waits, content first. T1's gate passed on his solo play (PR #69); T2 (PR #68) is out of draft, waiting for his approval.
- His answers for T3: a portal in the arena brings the party home, and the village is a golden afternoon.
- **The village** (`shared/src/level/village.ts`): a second level kind in the slice's own format. The four starting buildings round a square (Portal Shrine north with the portal before it, General Store east, Storehouse west, Tavern south-west), a villager at each door who answers F (TalkUi), a well, trees inside a palisade and a wood beyond. Its run-start line lies off the map, so the slice's sim runs in it unchanged and no run or enemy ever starts there; the arena's `buildWorld` path is untouched (parity identical).
- **Rooms** (`server/src/rooms/`): HostRoom (the old FightRoom) under VillageRoom and DungeonRoom. Play makes a village; everyone standing in its ring for 2 s is handed into a fresh dungeon run; once the run is won or lost a ring opens in the antechamber and takes the party back to the same village, which stays open while they are away.
- **Client**: ServerLink follows a hand-off (a lost seat lands in a village of our own), ClientSession drops the old room's state and builds the new world, Game rebuilds the level's views without a reload (music and the mouse capture survive). The village is drawn in code (VillageView, villageTextures: grass, packed earth, plaster and timber, shingles, planks, fieldstone) under `tuning.villageLook` (a low western sun, gold-to-blue sky dome, bluish shade, dust motes), tunable live in the panel. PortalView draws the ring, its swirl and the fill as the party holds it.
- **Tests**: portal and village unit tests (check 34); `test:net` takes two bots village -> ring -> one dungeon -> finish -> ring -> the same village; the browser smoke test adds the round trip with Keeper Wren's line (4/4). The lab and the gate test start in a run (`?dungeon`).

**Learned**

- A dungeon room closes as its party leaves it, before they have taken their seats in the village, so a village that closed when its last run closed lost the returning party ("seat reservation expired"). It now waits 30 s.
- The paths are drawn pulled toward the camera so they never flicker against the grass, which hid a ring lying on them; the ring now sits higher with a stronger pull of its own.
- The well's roof stood in the camera's way: its collider now reaches the roof and fades like the trees.
- Bots steering by snapshots overshoot a 2.4 m ring at a run; they ease off near a mark.
- CI found two bugs in T2's input slots, both fixed here (#68 as approved has them): a player stalled past 300 ms whose next input never came was held still for good, and a server ticking slower than wall time (CI's runner at about three quarters speed; a busy free host could do the same) let a player's backlog grow without bound, so inputs landed 0.6 s late. A stalled player now picks up from the first input that arrives, and more than four beyond the cushion are used at once, as the slice folded them. The lossy lab row afterwards, one 120 s run: 57.5 corrections a minute over 2 cm, 13.5 over 10 cm; too noisy against T2's single run to call.
- Bots that fall silent read to the slots as late, which widens the cushion; the test bots keep sending while they stand.

**Next**

- Michael: the village and the portal on the hosted build once #68 and this PR are merged (T3's gate is two players village to dungeon and back, nobody stranded, and the village looks like it belongs to the slice).
- T4, the dungeon generator, from the kit of pieces in decisions.md (27 Oct).

## 2026-10-27: local session, T2: the clean link's corrections were enemy bodies

**What changed**

- The lab splits each correction over 10 cm by what the hero was doing (its own swing or ability, a hit taken, placed by the server, or neither), and `--diag` records, for each, every field where the server's hero at the acked input differs from the browser's prediction of that input. Bravo now fights (it faces the nearest enemy and swings), so a pair can try to finish a run.
- The diagnosis: the 0 ms row's remaining big corrections differed in position alone, mid-dodge or mid-run. The server pushes heroes out of enemy bodies in the enemy step (`settle`), which a joiner's prediction never runs. `separateBodies()` is that push lifted out unchanged (parity with the slice still identical); `ClientSession` applies it after each predicted step against the enemies as the last snapshot had them.

**Lab (local)**

A/B at 0 ms, 180 s each: 231 corrections a minute over 2 cm without the push predicted, 6 with it; over 10 cm 23.7 against 1.7 (of those 1.3 placements, 0 from the network).

| Link (120 s) | Over 2 cm a minute | Over 10 cm | of which placed | Holds a minute | Inputs in flight |
| --- | --- | --- | --- | --- | --- |
| 0 ms | 14 | 3.5 | 1 | 3.5 | 61 ms |
| 50 ms | 31 | 2.5 | 1 | 3 | 240 ms |
| 150 ms | 28 | 6 | 1.5 | 5 | 352 ms |
| 50 ms ±20, 2% loss | 47.5 | 4.5 | 2 | 25 | 358 ms |

The lab against the hosted build with Bravo fighting (main, before these fixes): 5 minutes, 0 network snaps, 54 corrections a minute over 2 cm, 8 runs started and none won.

**Learned**

- My first reading (the clean link's big corrections were the swing's lunge) was wrong; the split and the field diff found the real cause in one run. Measure the cause before naming it.
- Over 10 cm, 0 and 50 ms are inside T2's gate (8 / 3); 150 ms is not (6, or 4.5 without placements, against 1). Lossy holds are 25 a minute, over the lab's line of 20.
- The bots cannot win a run even with Bravo fighting; the T1 gate's two players through a run needs people.

**Next**

- Michael: the T1 gate's two-player run (people), and #68 once he has looked.
- T2: the 150 ms row's remaining big corrections (the diag), and the lossy row's holds.
- The lab against the hosted build once #68 ships.

## 2026-10-27: local session, T2: input slots for the lossy link

**What changed**

- T1 merged (PR #67, Michael on GitHub) and is live. Michael played it solo on the hosted build: "Gameplay looks good." He answered the fight's small corrections A (they stay; T2's gate counts corrections over 10 cm). The T1 gate is filed in `playtest-notes.md` with the lab against the hosted build (PR #69): 5 minutes, two browsers through Render, 0 network snaps, 70 corrections a minute over 2 cm, 2.8 holds a minute, but no run finished, since the bot pair only revives.
- `shared/src/game/inputSlots.ts` replaces the slice host's input queue. Each input has a slot one tick after the one before, behind a cushion. A tick whose input is missing runs on the held buttons and counts as that input (acked); the input is dropped when it lands, its presses carried to the next tick. Late arrivals widen the cushion a tick each (up to 15), five calm seconds narrow it, a player silent 300 ms has stalled. 5 unit tests in `HostSession.test.ts` (check 28); `test:net`'s ack checks now allow the server's 18 stood-in ticks after a bot stops.
- `CLAUDE.md`'s netcode section describes the slots and the adaptive delay.

**Lab (local, 60 s a row)**

| Link | Corrections a minute (over 2 cm) | Over 10 cm | Holds a minute | Inputs in flight |
| --- | --- | --- | --- | --- |
| 0 ms | 77 (repeat: 120) | 16 (repeat: 14) | 0 (repeat: 6) | 74 ms |
| 50 ms | 102 | 5 | 7 | 168 ms |
| 150 ms | 76 | 6 | 5 | 364 ms |
| 50 ms ±20, 2% loss | 92 (before: 277) | 8 (before: 170) | 27 | 360 ms (before: 197) |

**Learned**

- The slice's queue already counted ticks roughly right on a lossy link (repeating held buttons, then folding the burst), but every press and key change in the gap landed ticks from the prediction. Standing in for each missing input and acking it keeps the count exact; widening the cushion after the first retransmit means later ones fit, at the cost of the player's actions reaching the server up to a quarter of a second later on that link.
- One 60-second row is noisy here: the same 0 ms row read 77 and 120 corrections a minute over 2 cm. Compare rows over several runs before calling a change.
- On a clean link the over-10 cm count (14 to 16 at 0 ms) was above the gate's 8. I first put it down to the swing's lunge and turn (decision A); the lab now splits each by what the hero was doing, and that was wrong: with Bravo fighting, the rows read 8 / 5 / 3 over 10 cm at 0 / 50 / 150 ms and 4 lossy, and at 0 ms 6 of the 8 were neither a swing nor a hit taken (50 ms: 3 of 5; 150 ms: 1 of 3).

**Next**

- T2: what the 0 ms row's remaining big corrections are (neither swing nor hit: a dodge, a jump or a stall are the candidates). With Bravo fighting the rows are near the gate (8 / 5 / 3 against 8 / 3 / 1), but rows with a fighting Bravo are not comparable with the earlier ones.
- The lab's bot pair cannot finish a run (5 minutes on the hosted build with Bravo fighting: 8 runs, none won, 0 network snaps), so the T1 gate's two-players-through-a-run needs two people.
- The lab against the hosted build once #68 ships, for the real link.
- Bandwidth stays (about 117 KB/s a player).

## 2026-10-27: local session, T2 begun: where the lab's corrections come from, and the clock back from the shelf

Started on Michael's word ("after this work is finished ... please begin the next step ... I don't want to be a blocker", while T1 waits for its gate), on `auto/local-slice-netcode`, stacked on T1's branch. Nothing here is merged or meant to be before T1's gate.

**What changed**

- `shared/src/net/clock.ts`: Hearthgate's Phase 0 clock, back from the shelf for snapshots only (no pings). The offset is the window's least-delayed snapshot rather than the slice's 5% average, and the interpolation delay follows the longest wait for a snapshot a frame saw: the slice's 80 ms on a clean link, rising on a lossy one up to the lag grace (150 ms), never later, since hits on you wait that long so an on-screen dodge counts. Both slew at 10 ms/s. Its numbers are in `tuning.coop` (`interpDelayMaxMs`, `clockWindowMs`, `clockSlewMsPerS`, `clockSnapMs`). 6 unit tests (check 27).
- The lab: `--tune path=value` sends a tuning edit through the server before the run, to test one cause at a time; it reports corrections over 10 cm and the draw delay.
- `decisions.md`: the small corrections in a fight, three options (recommended A, leave them and judge at the gate).

**Lab (local, 60 s a row)**

| Link | Corrections a minute (over 2 cm) | Over 10 cm | Holds a minute | Draw delay |
| --- | --- | --- | --- | --- |
| 0 ms | 75 | 10 | 1 | 83 ms |
| 50 ms | 65 | 5 | 4 | 83 ms |
| 150 ms | 124 | 3 | 4 | 82 ms |
| 50 ms ±20, 2% loss | 277 | 170 | 22 (T1: 30) | 150 ms |

**Learned**

- The fight's corrections are the hero's own swings, not hits taken and not the input queue: at 0 ms the count was about the same with enemies that never swing (164 a minute counting every difference), higher with god mode (319, Alpha fights longer), and unchanged with a four-tick input cushion (159). A melee swing's lunge stretches to its soft target and the soft target turns the hero, both measured on the client against the last snapshot's enemy. Over 10 cm they read 10 / 5 / 3 a minute at 0 / 50 / 150 ms, near Hearthgate's old 8 / 3 / 1.
- With the delay capped at 200 ms the lossy row held only 12 times a minute, but on clean links the delay drifted to 120 to 160 ms after single slow snapshots, later than the lag grace. Capped at the grace: 22 holds, and clean links stay at the slice's 80.
- The lossy row's 170 big corrections a minute are the slice's input queue under retransmits: a player's inputs held 200 ms, the server repeating their held buttons meanwhile, then folding the late burst into fewer ticks, so a dodge or a turn lands at a different tick than predicted.

**Next**

- Michael: the decision on the fight's corrections (decisions.md); T1's gate first.
- T2: the input queue under loss (the lossy row's 170 a minute over 10 cm). Candidates: count the ticks the server guessed and drop as many late inputs when they arrive (keeping their presses), so a late burst is neither folded nor replayed; or Hearthgate's old input slots. Measured on the lossy row before and after.
- T2: bandwidth stays as it is (about 120 KB/s a player); deltas only if the hosted lab or Render's limits ask.

## 2026-10-27: local session, T1: the combat slice on Hearthgate's server

**What changed**

- The combat slice (`mbuckley616/combat-slice`, 363b726) moved over whole. Its engine-free code (`sim/`, `config/tuning.ts`, `level/`, `net/protocol.ts`, `game/Session.ts`) is in `shared/src/` as it was, imported by path (`@hearthgate/shared/sim/world`); everything else (its `Game`, `ClientSession`, views, camera, UI, sound, input, debug panel, CSS, title screen) is in `client/src/` with only import paths changed. Three.js 0.186. TypeScript and Vite stay at 5.x and 6: the slice typechecks clean on them, and dropping `experimentalDecorators` and `useDefineForClassFields: false` (no schema now) gives its classes their own field semantics.
- The slice's `HostSession` runs on the server (`shared/src/game/HostSession.ts`, in `server/src/rooms/FightRoom.ts`): its input queue, acks, folding and staleness line for line, with the local hero taken out and `send` in place of the relay. The room steps it on Hearthgate's wall-locked 60 Hz pump and broadcasts the slice's `snap` every second tick. One room type, `fight`, with the slice's four-letter codes as room ids: Play creates one (solo is a room of one), Invite shares `?join=CODE`.
- Every player is the slice's joiner: `ClientSession` speaks to the room through `ServerLink` (colyseus.js, the relay's events). Its clock runs at the server's speed so debug slow motion, now the server's, slows prediction and drawing alike. It counts corrections and snaps for the tests and the lab.
- What the slice's host did itself now goes to the server: a lost or won run restarts on anyone's F, tuning edits of values the fight reads are range-checked and passed to everyone (`config/edits.ts`), and the cheat buttons work in a dev build only (`npm run dev`, or `HEARTHGATE_DEV=1`, set in `render.yaml` for Phase 1). Every message is checked before the session sees it (`net/validate.ts`); the rate limit counts commands, 75 a second with a burst of 120.
- Keyboard-only (rule 4, decision 10A): J attacks, L guards, the arrows turn and tilt the camera at the stick's rates. The slice had no attack or camera without a mouse.
- Gone: Hearthgate's `sim.ts` and its modules and ~230 tests, the old client, the schema, the village, dungeon and sim rooms, the levels, the KayKit packs and the art spike images. `clock.ts`, `interp.ts` and `gear.ts` are read-only in `docs/reference/hearthgate-shelf/` for T2 and Phase 3; the hand-off is at 1f4e3e9 for T3.
- Tests: `tests/parity.ts` plays two scripted parties (a party of three to four through four waves with a join and a leave; the Warden, a wipe, a restart and the run again; 9,000 ticks each) through the slice's own `stepSim` from its repo and through Hearthgate's copy: identical every tick. Their hashes are in `shared/src/parity/golden.json`, which `npm test` checks, so CI holds the line without the slice. Unit tests for the room's queue, acks, joins, snapshots and requests, and for the message checks (21 in all). `test:net` rewritten on bots speaking the slice's messages, plus the browser's own `ClientSession` (25 checks). `tests/smoke.e2e.ts`: solo, two players by code, through the gate into wave 1 (3/3). The lab rewritten for the new client.

**Lab (local, this desktop, 60 s a row, both pages at 60 fps on the GPU; a correction is a replay that moves the hero over 2 cm, the old client's line)**

| Link | Corrections a minute | Snaps | Holds a minute | View lag | Inputs in flight | Server to each player |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 59 | 0 (+2 placed) | 0 | 110 ms | 66 ms | 122 KB/s |
| 50 ms | 71 | 0 (+2 placed) | 2 | 215 ms | 175 ms | 119 KB/s |
| 150 ms | 93 | 0 (+2 placed) | 3 | 410 ms | 366 ms | 118 KB/s |
| 50 ms ±20, 2% loss | 379 | 0 (+2 placed) | 30 | 225 ms | 196 ms | 118 KB/s |

Hearthgate's last numbers (step 1, its own fight) were 8 / 3 / 1 and 8 lossy. "Placed" snaps are the server moving the player itself (the gate bringing stragglers in, a restart). Counting every difference instead of those over 2 cm, the same rows read about 210 a minute at 0 ms, 3 cm on average. Without enemies the browser's `ClientSession` makes none at all (`test:net`: four seconds of running, sprinting, dodging and jumping). The same row with enemies that never swing reads about the same as with them, and with god mode more (Alpha fights longer): the corrections come from the hero's own swings, not from hits taken. A melee swing's lunge stretches to reach its soft target and the soft target turns the hero, both measured against the enemy where the last snapshot had it; the server measures a few ticks later.

**Learned**

- The corrections are the slice's own joiner prediction, now every player's: a swing's lunge and soft-target turn are predicted against enemies where the last snapshot had them. In the slice the host never predicted; solo is now a joiner, so solo has them too. They are eased over 120 ms, but the lab's line (30 a minute) calls every row rough. That is T2's first question, and Michael's, since the fixes change the slice's fight or its feel.
- On the lossy link the slice's input queue is the trouble: a retransmit holds a player's inputs 200 ms, the server repeats their held buttons meanwhile, then folds the late burst into fewer ticks. 379 corrections a minute, and Bravo's view of Alpha holds 30 times a minute behind the fixed 80 ms delay.
- The slice's input cushion (two ticks) assumes one tick a frame. At 25 fps (the lab's first run, software WebGL) every frame carried two or three ticks, the queue ran dry between frames, the server repeated the held buttons, and corrections ran 268 a minute at 0 ms. A machine below 60 fps will see the same.
- A restart has to travel as a message: the slice's host read F's *press*, and a tap released inside one frame never shows as interact held in any command. The lab caught it.
- Lag grace (150 ms) now covers every player, solo included; in the slice the host had none. Whether enemy hits feel late solo is a gate question.
- About 120 KB/s a player as msgpack (a snapshot is 5.3 KB as JSON for four players): under the 170 KB/s the plan feared.

**Next**

- Michael's T1 gate: side by side with the slice on his desktop, solo on the hosted build feels the same (movement, the chains at 0.25×, hit feel, the look, the sound); then two players through a run with no snap. Watch for: hits on you landing late solo (lag grace), and small eases in a fight.
- T2, netcode from the lab: the combat corrections, the cushion at low frame rates, the lossy row's holds.

## 2026-10-27: local session, step 1 played; the slice moves over whole

**What changed**

- Step 1 merged (PR #64) and is live on the hosted build. Michael played it: it felt okay, but the combat is still Hearthgate's and the movement is hard to judge under the old animations and meshes, and he feared the system-by-system port would water the slice down.
- New plan, `docs/slice-transplant-plan.md`, replacing `combat-port-plan.md` (except its progression section): copy the slice as it is and run its `HostSession` on Hearthgate's server, with every player on the slice's `ClientSession`; then rebuild the village, the portal, generated dungeons and progression on top of it. It lists what Hearthgate keeps (the server, hosting, rooms and hand-off, the 60 Hz pump, the tuning path, the lab, the team, the design) and what goes (`sim.ts` and its tests, the whole client, the schema, the levels, KayKit). Six steps, T1 to T6; the backlog and `decisions.md` follow.
- Earlier the same day: the port was re-planned once (the slice's look first, a dungeon generator before the gate) and Michael answered the generator's questions; those answers carry into T4. The slice was pushed to the private repo `mbuckley616/combat-slice`.

**Learned**

- The slice's code already has the seam a server needs: `stepSim(state, commands, dt)` is pure and engine-free, `HostSession` is the only thing that runs it, and the view only reads a session. A system-by-system port re-creates what that seam lets us move whole.
- A step that changes only what the player cannot see (the tick rate, prediction) is hard to judge in a playtest under the old look: Michael could not tell the movement from the animations.

**Next**

- T1, the transplant, in a local session with Michael.

## 2026-10-27: local session, the combat port's step 1 finished (camera and keys)

**What changed**

- The camera is the combat slice's orbit camera (`client/src/orbit.ts`), centred behind the hero. It sphere-casts from a pivot 1.7 m up to the eye against the level's walls, roofs and the ground (`shared/src/geometry.ts`, the slice's cast on boxes), eases in early on a wider probe and on a cast where a fast swing is heading, and when the walls would bring it inside 1.5 m it cranes up over the hero instead. Pitch runs from 30 degrees below the pivot to 60 above, the bow's lock swings it round and pulls the look point toward the target, and a sprint widens the view by 5 degrees. Its numbers are `tuning.camera` and `tuning.lockOn`, so the panel tunes it. Hearthgate's swing in behind the travel is gone: with strafe movement the hero faces the camera, so there is no travel to swing behind. The old camera's helpers left `shared/src/camera.ts`; `CAMERA` keeps only the shot the art tools frame and the wall fade's aim height.
- Input goes through the slice's action layer (`client/src/input/`, decision 10A): Ctrl dodge, Space jump, Shift sprint, left click or J attack, right click or L guard, Q and E the two ability slots, Tab or the middle button lock-on, F talks and uses the Revive Draught, WASD moves, the arrows turn the camera (Up still raises the eye; the mouse and the right stick tilt the usual way). The gamepad is the slice's: X attack, Y jump, B dodge, A interact, LB and RB the abilities, LT guard, L3 sprint, R3 lock-on. 1, 2 and 3 do nothing until step 3's weapon swap. The HUD's hints and slot keys say so.
- Ctrl is the dodge and Ctrl+W (dodge while running forward) closes a tab, which no page may stop, so a real join asks before leaving, as the slice did; other Ctrl shortcuts are stopped while playing. Scripted joins (tests, the lab) skip the question.

**Learned**

- Backed flat against a wall the camera cranes nearly overhead (up to 85 degrees), the slice's behaviour, and eases back out as the hero steps away. It never enters a wall: `camera.e2e` backs into the yard's east wall at 20 degrees below the pivot and checks fifty frames that the eye is outside every wall and that no wall stands between it and the head; with the walls left out of the camera the same test fails with the eye inside the wall.
- The browser pane's page runs about one frame a second while the pane is hidden, so camera feel cannot be judged there; the headless browser suite runs at full rate.
- Checks: `npm run check` 229 (the old camera's seven tests out, three for the sphere cast in), `test:net` every step, the browser suite 20/20.

**Next**

- Step 1's gate, Michael's: run round the Warrens on the hosted build once the branch is approved and merged; it should feel like the slice, the camera never clips, the panel tunes it live, keyboard-only works, and the lab is no worse. The lab against the hosted build goes with it.
- Then step 2, the sword's combat.

## 2026-10-26: local session, the combat port begins (step 1, part one)

**What changed**

- Michael's combat slice (a separate repo, M0 to M6 passed today) is now the reference for Hearthgate's combat. `docs/combat-port-plan.md` has the plan: Hearthgate's server and netcode stay, and the slice's simulation, tuning, input, camera, views, effects and sound come across in seven steps, each with a playtest gate. His answers are in `decisions.md`: 1A 2A 3A 4B 5A 7A 8A 9A 10A, and his own progression (the slice's levels to 50 with a talent point a level, then Champion-style points). The steps head Phase 1 in the backlog, all **(Fable)**. A `FREEZE:` issue (#63) keeps the builder idle while the shared sim is rewritten.
- The server ticks at 60 Hz (1A) and sends a patch every second tick, 30 a second (`PATCH_TICKS`, `PATCH_MS`). A tick is 16.7 ms, not a whole number of ms, so every slot and replay time goes through `onTick` (back onto the grid), and every time in the schema is `float64`: Colyseus sends a `number` as float32 whenever that loses under 1e-4, which moved a swing's end a hair off the grid and would have made the replay end it a tick late.
- The slice's movement in `applyInput`, with the slice's numbers in the new `shared/src/tuning.ts`: acceleration toward the stick (velocity `vx`, `vz` is synced and rewound), strafe movement facing the camera's aim (`aimX`, `aimZ` in every frame; a frame with no aim turns to run, so the bots still swing where they walk), walk, run 5.5, sprint 8 forward only, the slice's dodge (two charges, an eased roll, a backstep with no direction, i-frames for the first 300 ms in `isUntouchable`, any input ends the tail past 240 ms, it cuts a swing short), the slice's jump arc (still a pure function of the landing time). Combat on top is still Hearthgate's until step 2.
- The live tuning panel (backtick, lil-gui, `client/src/debug.ts`). An edit goes to the server as `tune`; the server checks it against `tuningRanges`, applies it and every room sends its clients the whole set; a joining client gets it before its first patch.
- CLAUDE.md: rule 2 reads "time comes from the tick count" (2A), `tuning.ts` is the tuning surface, and the netcode and movement notes are rewritten for 60 Hz.

**Learned**

- The 60 Hz tick first made the lag lab much worse on this desktop (corrections a minute at 0 / 50 / 150 ms: 68 / 234 / 46; the 20 Hz build on the same box: 14 at 0 ms). Counters on the input queue showed why: under the lab's load the server stalled 200 to 450 ms several times a run, past its 200 ms catch-up, and dropped that time; every client's frames then sat up to 25 ticks ahead of their slots, and the drain cleared them one tick a second, each a correction. At 20 Hz the same stall dropped four ticks. Three fixes: the pump catches up 500 ms, the drain moves the slots back by the whole standing backlog in one step, and the lag window is 300 ms, so a frame a TCP retransmit held up (200 ms minimum timeout) still lands in its slot (the lossy row went from 34 corrections a minute to 6 with it). After those and the movement: 8 / 3 / 1 at 0 / 50 / 150 ms and 8 on the lossy link, no snaps, every row ok.
- More packets mean more lost packets: at 60 Hz the client sends three times the input messages, so a lossy link holds up frames three times as often. Batching frames is the next lever if the hosted build shows it.
- A Node timer asked for 16.7 ms fires nearer 25 ms on Windows, so the bot harness now paces frames by wall time (`sendPaced`), as the browser's `InputClock` does.
- An idle enemy kept the first player in the room as its target while asleep; at 60 Hz a tick falls between two joins. Asleep, it now wakes for whoever is nearest.
- The browser suite: 19/19 after two fixes. A tap of a key is one frame, which with acceleration moves about a centimetre, so `village.e2e` nudges onto its marks with 150 ms holds. And dungeon rooms are now matched by level (`filterBy(["level"])`): a page asking for `?level=yard` had joined a field room an earlier test left open. A browser-pane tab left in the village also stalls that test's portal, which waits for everyone in the room.

**Next**

- Step 1 is not finished: the 10A key layout through the slice's action layer (Ctrl dodge, left click attack, right click guard, Q/E, F; J, L and the arrows for keyboard-only), and the slice's orbit camera. Then Michael's step 1 gate on the hosted build.

## 2026-10-18: Session 50, a downing blow eases instead of snapping

**What changed**

- The critic's bug (c44600d): on a slow link a downing blow snapped the player back. The client keeps predicting its run for a round trip past the frame the server downed it on, and a downed player's replayed frames only crawl, so the error is run speed times the round trip, over `SNAP_DISTANCE` (2.5 m) once that passes about 420 ms; the lab saw 2.7 m and 2.4 m. Like the refused dodge (Session 37), it is a prediction the client could not make, not a teleport. `reconcile` in `client/src/net.ts` now eases a correction on the patch that takes us from standing to downed up to `DOWNED_SNAP_DISTANCE`: the snap limit plus `DOWNED_EASE_MS` (500 ms) of sprinting, 7.0 m, from `PLAYER`'s own numbers so it follows their tuning. The same error while already down, or with no down in it, still snaps.
- Draw and count only: the server, `shared/` and the prediction are unchanged; the player still ends exactly where the server put them, the offset decays as every correction's does.
- Test: `tests/reconcile-placement.ts` case 6 runs east with eleven frames unconfirmed (550 ms), the server downs us at the first: 2.70 m, the critic's figure, eased with one correction and the exact offset; already down, the same error snaps. Without the fix the case fails ("a 2.70 m downing blow snapped instead of easing"). `npm run check` 226; `test:net` every step.

**Learned**

- The downed crawl replays: ten frames at 1.2 m/s claw back 0.6 m of the run, so a 500 ms round trip alone (2.46 m) stays just under the snap limit and it takes about 550 ms to cross it, near the critic's ~420 ms estimate once a sprint or a knock is in the mix.

**Next**

- Phase 1 has no builder item left: the gate playtest is Michael's. The critic can watch for `hp 0` snaps at 150 ms; there should be none.

## 2026-10-17: Session 49, the two-player test holds until it has moved

**What changed**

- The critic's bug (0f5465b): `tests/two-players.e2e.ts` held D for a fixed 700 ms and then asked for more than 2 m. On a slow headless page one frame gap can cover the whole hold, the input clock makes at most four frames of a gap (4 x 0.3 m), and the test failed at exactly 1.2 m: it measured the page's frame rate. Now Alpha holds D until its own position has moved more than 2 m (polled, 10 s limit), then lets go, the way `village.e2e`'s `walkTo` holds until arrival. The checks that matter are unchanged: Bravo must see Alpha more than 2 m along, and the ping must read. Test-only: nothing in `shared/`, the server or the client changes.
- `two-players.e2e` 8/8 at normal speed and 4/4 with Alpha's page throttled six times by CDP (about 4 fps), the case that used to fail. `npm run check` 226; `test:net` every step (run on the branch before the change; the change touches neither `server/` nor `net.ts`).

**Learned**

- The browser tests share one server and the client joins the first open room for its level, so `--workers` above 1 puts every repeat into one room (the party reads 8, not 2). Repeat them with `--workers 1`.

**Next**

- Phase 1 has no builder item left: the gate playtest is Michael's.

## 2026-10-16: Session 48, no figure where the server never put it

**What changed**

- The critic's bug (2026-10-16): from the `handoff` message to the new room's first patch, `draw()` drew our own player in the new level at the old room's coordinates (the village portal, about (0, -9.3)), then at a fresh player's (0, 0) once the seat was taken, and the camera followed it; 1.35 s on the critic's box. Now `draw()` in `client/src/main.ts` draws the own figure and moves the camera only once `Net.isPlaced` (a new getter on the existing `placed` flag in `net.ts`) says the room's first patch has placed us. Until then the figure is removed and the camera holds where it was; the mouse and arrows still turn it. The hand-off's `resetFollow` keys off the same flag, so the camera starts at the placement.
- The same holds on the first join, where the camera used to start at (0, 0) and glide to the spawn.
- `__hg.ownDrawn` for the tests. Nothing in `shared/`, the server, prediction or the inputs changes: draw-only.
- Test: `tests/village.e2e.ts` records every frame through the portal and fails if the own figure is drawn between the hand-off and the Warrens' first patch. With the fix turned off it fails, the figure at (1.70, -9.72) inside the Warrens. `npm run check` 226; `test:net` every step; the browser suite 19/19; `village.e2e` 9 of 10 repeated, the one failure at the keeper's speech before the portal (main alone failed 1 of 4 here, at the step after arrival).

**Learned**

- Playwright here needs `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`: the installed `@playwright/test` looks for headless shell 1243, and the image carries 1194.
- `village.e2e` flakes on this box about one run in five, at different steps (the keeper's speech, the step after arrival), with or without this change: slow headless frames against fixed timeouts. Worth the critic's look if it continues.

**Next**

- Phase 1 has no builder item left: the gate playtest is Michael's. If he sees the figure "at an angle" again after the portal, it is no longer this.

## 2026-10-15: Session 47, the portal can no longer strand a player

**What changed**

- Michael's report (B, 2026-10-15): through the portal, the figure at an angle, no movement at all, the HUD otherwise normal. Not reproduced: five browser runs here, a key held through the hand-off in three, all moved in the Warrens, and the shared sim moves from every spawn point on every level. One path in the code gives exactly those symptoms, and it is now closed: `Net.handoff` (`client/src/net.ts`) waited for the old room to acknowledge the leave, then took the seat, and if the seat was refused or never answered it only logged to the console. The client was then left with no room for good: the player drawn in the new level, the HUD up, every input dropped.
- The hand-off now sends the old room's leave without waiting for it (the seat is ours either way), gives the seat `HANDOFF.seatTimeoutMs` (8 s, in `sim.ts`; the server holds a seat 15 s), and when the seat is refused or times out joins the village under the same name and weapon, with "The way closed: back to the village" on the status line. A join that answers after it was given up is left at once. `__hg.handoffFallbacks` counts them.
- The camera starts over at the hand-off's placement (`View.resetFollow`): it used to glide 10 m from the portal to the new spawn and read the jump as travel, which swings the view round behind it, so the figure arrived seen from an angle.
- Test: `test:net` step 6e drives the real `Net` at the client rate through the village portal (5.1 s) and walks 6.00 m east in the Warrens a second later; then a seat for a room that does not exist (the server answers "seat reservation expired") lands it in the village in 71 ms, where it walks 6.00 m. `npm run check` 226; `test:net` every step; `village.e2e` and `camera.e2e` 5/5.

**Learned**

- The server's refusal for a seat it does not hold is "seat reservation expired", the same error a seat taken after its 15 s gets, so the fallback covers a slow hand-off and a lost room alike.
- In the headless browser here the first key pressed after arriving in the Warrens can be lost: the dressing builds on the first frame in the new level and the stall outlasts a short press. A held key is not lost. On real hardware the build is far shorter.

**Next**

- The critic: the portal on the hosted build (Michael's B), watching `__hg.handoffFallbacks` and the console for "hand-off to warrens failed". A fallback seen there means the seat is being lost and the server side is the next place to look; a stuck player with no fallback means another cause.
- Phase 1 has no builder item left: the gate playtest is Michael's.

## 2026-10-15: Session 46, mouse look and mouse buttons

**What changed**

- Michael's A (2026-10-14): pointer-lock mouse look, the left button attacks, the right blocks. A click on the game view takes the lock (`Input.attachMouse` on the renderer's canvas, from `startLoops`, so the join screen never takes it); under the lock the mouse turns the camera, and with it where W walks; Escape lets go, the browser's own key. The click that takes the lock does nothing else, and buttons are read only under the lock, so a click on the HUD's talk button never swings.
- `mouseTurn` in `shared/src/camera.ts` (pure, beside `turnCamera`): `CAMERA.mouseDegPerPx` 0.15 in `sim.ts`, so 2,400 px is a full turn. Right turns the view right like the Right arrow; up lowers the eye to look up, the usual mouse way and the opposite of the Up arrow's RuneScape tilt; pitch stays in the 5 to 45 degree clamp. A per-pixel turn, not a rate, since the mouse is a position. `View.turnByMouse` counts it as the player's own camera input, so the swing in behind waits its 1.2 s after it as it does after the arrows.
- Left button: the same attack press as J. Right button held: block, as L, Q or LT; let go on release anywhere, on losing the lock and on blur. The context menu is off on the canvas. Nothing in `InputFrame`, `shared/src/sim.ts`'s simulation, the server or the netcode changes: the buttons become the frame's existing `attack` and `block`.
- The HUD's key list has a line for it, hidden on touch screens and on screens under 481 px tall, where it pushed the hint into the top-left panel at 640 x 400. `__hg` gains `mouseLocked`, `me.attackUntil` and `me.guarding`.
- Tests: `camera.test.ts` one case (direction against the arrows, the clamp, a full sweep wraps, no travel no turn); `camera.e2e.ts` a mouse-look case with real pointer lock in headless Chromium: the locking click swings nothing, 200 px right turns 30 degrees, up lowers the pitch, right button guards and lets go, left button attacks, and after the lock is let go the mouse turns nothing (4/4 repeated). `npm run check` 226; browser suite 19/20, the one failure `two-players.e2e` at 1.2 m as on main here (Session 45).

**Learned**

- Headless Chromium grants pointer lock to a Playwright click and reports `movementX` from `page.mouse.move`, so the mouse is testable end to end without stubbing `pointerLockElement`.
- "Turns the camera and aim": the player faces the way they move (`applyInput` sets `facing` from the move vector), so the mouse aims by turning the camera, which turns the move keys. A standing player swinging toward the crosshair would need a facing in `InputFrame`, which is shared-sim work, so it is not built; the bow's lock-on is unchanged.

**Next**

- Michael's feel at the gate playtest: the sensitivity (`CAMERA.mouseDegPerPx`), and whether a standing swing should face the crosshair (a **(Fable)** item if so).
- The portal bug waits on Michael's answer to the critic's question in `decisions.md`.

## 2026-10-15: Session 45, jump, sprint and a separate dodge (Fable)

**What changed**

- Michael answered 1A 2A 3A on the control room. `applyInput` (`shared/src/sim.ts`) has a jump and a sprint; the numbers are in `PLAYER` (`sprintMult` 1.5, `jumpMs` 500, `jumpHeight` 0.6, `jumpSteer` 0.25).
- The sprint: `sprint` held in the frame runs at 9 m/s. Swinging, an ability and the guard's shuffle are unchanged by it, so they stop it; a dodge from a sprint is the same dodge.
- The jump: a `jump` press on the ground, not mid-swing or mid-dodge (a dodge pressed on the same tick wins), sets `jumpUntil` to ten ticks on and keeps this tick's ground velocity as `jumpVx`, `jumpVz`: 3 m walking, 4.5 m sprinting, plus a steer of a quarter of walking speed from the stick. In the air there is no swing, ability, dodge, guard or second jump; walls stop a hop as they stop a walk; a down or a respawn cancels it. `jumpHeight(p, now)` is the parabola, a pure function of the landing time.
- Server: `jumpUntil`, `jumpVx`, `jumpVz` in `PlayerState` and `copyPlayer`. Client: the rewind copies them (so a jump replays like a dodge), remotes keep `jumpUntil` and are lifted by `jumpHeight` at `remoteNow()`, the figure rises by the height and plays `Jump_Full_Short` fitted to the 500 ms.
- Bindings (`client/src/input.ts`): J attacks, Space jumps, Shift held sprints, K or C dodges. Gamepad: X attack, A jump, B dodge, a left-stick click sprints until the stick comes back to rest, slots Y, RT, RB; RT is also the bow's lock-on cycle, which is safe because the bow has no slot 2. The HUD's key list says so.
- Tests: `shared/src/jump.test.ts` (17: speeds, the parabola, landing on a tick, carried speed, steering, what the air forbids, walls, a down, determinism over 200 scripted frames, validation). `test:net` step 5d: 20 sprinting ticks move 9.00 m on the server, a sprint jump carries 4.57 m (4.5 plus the takeoff tick's steer) and the other client sees the same landing time and speed. `figures.e2e` presses Space and sees the landing time come back and the jump clip play (3/3). `npm run check` 225, `npm run test:net` every step.
- CLAUDE.md's netcode section has a line for the jump.

**Learned**

- Keeping the jump's height out of the integrator is what makes it free for the netcode: there is no vertical speed to drift, so nothing new can disagree between prediction and replay, and the remote hop needs no new snapshot field or interpolation. Session 44 planned `y` and a vertical speed in the sim and the schema; the landing time does both jobs.
- Lag lab, 60 s a condition, on this machine at about 12 fps (branch run twice, main once): corrections a minute at 0 / 50 / 150 / 50 lossy were 3 / 5 / 1 / 4 and 6 / 1 / 0 / 1 on the branch, 1 / 2 / 4 / 3 on main; snaps 0 everywhere. Holds read 6 to 10 a minute on the branch and 4 to 10 on main. The lab's schedule never jumps or sprints, so the spread is the slow frames', not the change's; the critic's real-hardware run is the number to trust.
- `two-players.e2e` fails here on main too, every run at exactly 1.2 m for a 700 ms hold of D: the headless software rasteriser of Session 41, not this change. The rest of the browser suite passes (17/18).

**Next**

- The critic: the lab with a schedule that jumps and sprints (it owns `tests/lab/`), and whether `two-players.e2e`'s 1.2 m reproduces off this machine.
- Michael's playtest feel: the hop's height and air time, the sprint's 9 m/s against enemies (kiting), and RT for slot 2 on a pad.

## 2026-10-14: Session 44, jump, sprint and dodge: the design question (Fable)

**What changed**

- Nothing in code. Read the movement path end to end (`applyInput` in `shared/src/sim.ts`, `client/src/input.ts`, the replay in `client/src/net.ts`, `SimRoom`) and wrote the design question under Pending in `decisions.md`: the jump (a hop that clears nothing, a hop that clears low cover, or a hop that is also a defence), the sprint (free, stamina shared with the dodge, or out of combat only), and the buttons (Space jump, hold Shift sprint, K or C dodge; gamepad A jump, B dodge, left-stick click sprint, ability slot 2 to RT).
- FREEZE #50 stays open: the builder must not run while the card holds `shared/`.

**Learned**

- Space is the attack key today (with J) and Shift and K are dodge, so Michael's note moves three bindings, not one; the gamepad has no free face button, which is why slot 2 has to move.
- Walls are footprints with no height in the sim: the 3.2 m dungeon walls and the yard's "low wall" differ only in how they are drawn. Clearing low cover means giving every wall a height, which is why it is its own option.
- A jump is vertical state the server owns: `y` and a vertical speed on `PlayerSim`, `y` in the schema, `y` in the remote pose track, and the replay restoring both. Integrating it per tick with a fixed `dtMs` keeps prediction and replay identical; with g = 20 m/s² a 0.6 m hop is 4.9 m/s up and 0.49 s in the air.

**Next**

- When Michael answers: the sim (jump, sprint, constants in `PLAYER`), `InputFrame` (`jump`, `sprint`), the schema and the replay, the bindings and the HUD hint, unit tests, `test:net`, and the lag lab at 0, 50 and 150 ms against main's 0 / 0 / 0.

## 2026-10-14: Session 43, the Warrens in the KayKit dungeon kit

**What changed**

- `client/src/dungeon.ts` dresses the Warrens (only them: the yard, the cellar, the field and the village stay greybox) from the Dungeon Pack at 0.8 m a kit unit, so a kit wall's 1-unit thickness is the sim's 0.8 m wall and it stands 3.2 m tall. Every long wall rectangle is tiled with `wall` pieces stretched along its length to fill it exactly, with a `wall_endcap` inside each open end (the six doorway sides); the level's edge, a collider already, gets the same walls just outside its bounds in place of the low greybox rim. The floor is 169 `floor_tile_large` tiles. The three cover pillars hold a kit `pillar`, `crates_stacked` and `barrel_large`, each scaled to sit inside its 1.4 m rectangle. 44 `torch_mounted` every 6 m along the room faces, and the torch nearest the middle of each room and of the hall carries a point light (4 in all, warm, 9 m, no shadows). Repeated pieces are one `InstancedMesh` per wall rectangle (so the camera's fade can swap one wall's material), the floor and the torches one each; everything draws with the pack's one material on `dungeon_texture.png`. `level.ts` and collision are untouched.
- The camera: each dressed rectangle goes into the pull-in at the kit's height (3.2 m, a prop at its own), so the eye stops in front of the tall walls (2.7 m from the head with a wall behind it, in a check here); the fade swaps a dressed wall to a see-through copy of the kit material.
- `models.ts` loads the seven pieces with the figures, before anyone joins. `__hg.dressing` gives the instance counts; `village.e2e` checks the Warrens arrive dressed with at most four lit torches.
- Browser suite 18/18, `npm run check` 208, build clean.

**Learned**

- Frame time on the Warrens, one headless page here at 1280 x 720 (software GL, so only the ratios mean anything): 117 ms before, 450 ms with eight torch lights, 260 ms with none, 325 ms with the four kept. Every point light is paid on every lit pixel; the walls and floor (about 85,000 triangles, 50,000 of them in the shadow pass) cost the rest. The critic's lab pages will give the real number.
- Bytes: the seven pieces and the texture add 0.23 MB, so the client loads 6.6 MB of models.
- The kit's `wall_doorway`, `wall_corner` and chests were left out: the doorway piece is solid either side of a narrower opening than the sim's 3 m gaps, a corner and a chest reach outside the rectangles, and nothing in sight may be other than a collider. The end caps fit inside.

**Next**

- The critic's frame time on the Warrens; if it costs, the first cuts are two lit torches, not four, and the torches out of the shadow pass.
- Michael's pick of the village kit from Session 42's shots.

## 2026-10-14: Session 42, the Hexagon tavern scale test

**What changed**

- `npm run tavern-test` (`tests/tavern-test.ts`, page `client/tavern-test.html`, dev only like the turnaround) builds the real village `View`, hides the greybox Tavern (walls, roof, sign; the sim's walls are unchanged), stands KayKit Hexagon's `building_tavern_green` on its spot turned so its arched door faces the square, puts the Knight beside it in its idle, and renders from the game's camera (`CAMERA`'s 5.5 m, 1.6 m look height, 0.55 m shoulder, 50 degree field of view) at 1280 x 720. Two shots, committed: `docs/art/spike/hexagon-tavern-door.png` (at the foot of its steps, starting pitch) and `hexagon-tavern-square.png` (from beside the Storehouse across the square, 18 degrees). `-- --probe` writes turns of the model to `test-results/` to find the door again.
- The tavern is scaled 6x: its door then stands about 2.2 m against the 1.8 m Knight, on a stone plinth about 0.8 m high with three steps, and the building is about 7 m wide, 8 m deep and 8.4 m to the top of the barrel on its roof (the greybox Tavern is 10 x 6 m). The rest of the village is not dressed.

**Learned**

- The Hexagon models carry no door node and no hex tile under the buildings: the scale comes from the shots, not the data. 1 unit of the tavern is 1.4 units tall, so at 6x it is 8.4 m.
- At that scale it reads as a building a Knight walks into, and the pack's villagers stand right beside it. Its footprint is squarer than the greybox's, so taking the kit means re-blocking the Tavern's walls to about 7 x 8 m.

**Next**

- Michael looks at `docs/art/spike/hexagon-tavern-*.png` and picks Hexagon or the Quaternius Medieval Village MegaKit for the village.
- The builder takes part (1) of the item: the KayKit dungeon kit on the Warrens.

## 2026-10-14: Session 41, the KayKit Knight is every player

**What changed**

- `client/src/models.ts` loads the KayKit figures once with three's `GLTFLoader` before anyone joins: the Knight and the four villager bodies, the four held weapons, and five Rig_Medium clip files. The join screen's button reads "Loading" until they are in (a press made while loading joins as soon as they are); a scripted join (`?name=`, tests, the lab) waits for them too. Each figure is a `SkeletonUtils.clone` scaled to 1.8 m, facing +z, returned as the same `Figure` render.ts already used, with a `rig` (one `AnimationMixer`) in place of the hand-posed parts.
- Every player is the Knight, whatever the weapon. The held weapon is the pack's own in the rig's `handslot.r`: `sword_1handed` for the one-handers, `sword_2handed` for the Claymore, `axe_2handed` for the other two-handers, `bow_withString` for the bow, tinted 45% toward its material's colour with the old glow for the high tiers. The party colour is an outline (each body mesh drawn again on the same skeleton, back faces pushed 2.2 cm out along the normals) and the name tag; the outline is what flashes, lightens on a swing and darkens when downed or dead.
- `RigAnimator` maps the timers render.ts already has onto clips: `Idle_A` (`Melee_2H_Idle` with a two-hander, `Ranged_Bow_Idle` with the bow), `Walking_A` under 2.6 m/s and `Running_A` (`Running_HoldingBow`) above, at a time scale from the drawn speed `stepFigureWalk` now also keeps; `Melee_Blocking` while blocking, `Crawling` while downed, `Death_A` held at its end while dead. One-shots play over the base and hand back: `Melee_1H_Attack_Chop`, `Melee_2H_Attack_Chop` or `Ranged_Bow_Release` on a swing (fitted into the swing's time plus 0.3 s), `Dodge_Forward`, `Hit_A` when the drawn hp drops, `Spawn_Ground` on standing up from a down or a respawn. A staggered player still rocks back 0.25 rad. The clips' root translation is dropped at load, so the dodge never draws the figure off the server's spot. No allocation per frame.
- Villagers are the Barbarian, Mage, Ranger and Rogue in turn, each in `Idle_A` at a different phase, stepped in `View.render`.
- The goblin's gear moved onto the dungeon atlas's colours (wood `#A86A4C`, leather `#5E4A40`, iron `#5F676C`, gold `#F0B84A`); its Grub green skin already sits on the atlas's green. The other enemy figures are unchanged. The spike's adventurer code is gone from `figures.ts`.
- `npm run turnaround` renders the Knight (idle, walk, swing; front, side, back, in game) through the real clips, beside the adventurer reference it replaces: `docs/art/spike/knight-*.png`; the goblin sheets are re-rendered in the new colours. The adventurer sheets stay as they were.
- Tests: `figures.e2e` checks the Knight's budget (14,000 drawn triangles), its height, and that it stands in `Idle_A`, runs in `Running_A` and chops on J. `two-players.e2e` now joins the open field (below). Browser suite 18/18, with figures, village, combo and hit-feedback 12/12 over three repeats and two-players 6/6; `npm run check` 208; `npm run test:net` all steps.

**Learned**

- The clips in the pack: General (Death_A, Death_A_Pose, Death_B, Death_B_Pose, Hit_A, Hit_B, Idle_A, Idle_B, Interact, PickUp, Spawn_Air, Spawn_Ground, Throw, Use_Item), MovementBasic (Jump_Full_Long, Jump_Full_Short, Jump_Idle, Jump_Land, Jump_Start, Running_A, Running_B, Walking_A, Walking_B, Walking_C), MovementAdvanced (Crawling, Crouching, Dodge_Backward, Dodge_Forward, Dodge_Left, Dodge_Right, Running_HoldingBow, Running_HoldingRifle, Running_Strafe_Left, Running_Strafe_Right, Sneaking, Walking_Backwards), CombatMelee (Melee_1H_Attack_Chop, _Jump_Chop, _Slice_Diagonal, _Slice_Horizontal, _Stab, Melee_2H_Attack_Chop, _Slice, _Spin, _Spinning, _Stab, Melee_2H_Idle, Melee_Block, Melee_Block_Attack, Melee_Block_Hit, Melee_Blocking, Melee_Dualwield_Attack_Chop/_Slice/_Stab, Melee_Unarmed_Attack_Kick, Melee_Unarmed_Attack_Punch_A, Melee_Unarmed_Idle), CombatRanged (Ranged_1H_/2H_ Aiming, Reload, Shoot, Shooting; Ranged_Bow_Aiming_Idle, _Draw, _Draw_Up, _Idle, _Release, _Release_Up; Ranged_Magic_Raise, _Shoot, _Spellcasting, _Spellcasting_Long, _Summon); every file also has T-Pose. Simulation, Special and Tools are not loaded.
- The Knight is 5,800 triangles (the spike's adventurer was 564), drawn twice for the outline: 13,504 with the sword in hand. The client now loads 6.4 MB of models: 1.97 MB of bodies, 0.16 MB of weapons and textures, 4.25 MB of clip files. The clip files are two thirds of it and carry a mannequin mesh and about 80 clips we do not use; cutting them to the 15 we play would bring the load near 2.5 MB.
- three's loader drops the dots from the pack's bone names: `handslot.r` is `handslotr`.
- The first patch of a join puts the predicted time 200 ms before zero for one frame, so `now < dodgeUntil` reads true; the old figure leaned for a frame, the Knight would play a whole dodge. The animator takes the state as it stands for its first 0.3 s.
- Headless Chromium here draws in software: two pages in the village went from about 183 ms a frame to about 280 ms with the skinned figures, past the input clock's 200 ms catch-up, so `two-players.e2e` held D for 700 ms and moved 1.2 m in one run of four. Turning off the outline, the villagers' shadows or frustum culling each saved about a tenth. The test was written before the village and moved into it silently when the village became the first room; it now joins the open field, which is what it checks. The cost is the software rasteriser's, not the game's; the critic's lab pages (about 31 fps) will say what a real frame costs.

**Next**

- The dungeon kit on the Warrens and the Hexagon tavern test shots (the next item).
- The critic's lab pages give the frame time with the Knight; if it costs, a smaller clip file (the 15 clips we use) and a single-mesh outline are the first cuts.
- Michael's eye at the gate playtest: the swing clips are fitted to the swing's time, not to the server's hit frame.

## 2026-10-14: local session, the art sources picked and the KayKit packs in the repo

**What changed**

- The control room's "Fable routine has not taken the input-timing card" blocker is cleared. It was stale: the routine has run on Opus as the deep-work session since 12 Oct and took the card that day (Session 36, PR #37). CLAUDE.md's Model split and team list say so, and the 9 Oct "wait for the credit reset" decision is marked superseded. The "fable" names on cards, branches and the backlog mark stay, because the producer and the routine match on them.
- `docs/style-guide.md` is one page: rules, palette, camera, lighting, UI, the three reference models and a "Where the art comes from" table. The per-sheet notes and the ChatGPT prompts moved to `docs/art/concept/README.md`. Rule 1 now allows a small colour-swatch texture, since every KayKit pack uses one.
- Michael's calls (`decisions.md`): on the Session 39 spike, KayKit Adventurers for the characters instead of a commission; from a comparison of packs (https://claude.ai/artifact/QqeTEhWyfe9tcpeQFpPyjH), the KayKit Dungeon Pack, a scaled-up KayKit Hexagon tavern tested from the game camera before the village is settled (the Quaternius Medieval Village MegaKit as the fallback), and the spike's goblin kept.
- The free tiers of KayKit Adventurers, Character Animations, Dungeon Pack and Medieval Hexagon are in `client/public/models/kaykit/`: glTF and GLB only, 18 MB, 525 files, each pack's CC0 licence beside it and a README listing what is there. Hexagon is only the eight green buildings the test needs.
- The art direction backlog item is closed; two builder items replace it: the Knight as the player figure, then the dungeon kit on the Warrens plus the tavern test shots.

**Learned**

- The free Adventurers tier has only idle and basic movement clips; the swing, block and dodge clips come from the Character Animations pack, on the same Rig_Medium.
- The Dungeon Pack has torches (`torch`, `torch_lit`, `torch_mounted`), which the pack page did not say.
- KayKit has no goblin, and its character textures are one shared atlas, so the party colour cannot tint a tunic; it stays on the outline and name tag.
- itch.io's free download links expire 60 s after they are issued.

**Next**

- The producer cards this branch: it is no longer docs only (the models are under `client/`), so it needs Michael's approval before it merges, and the builder sees the two new items only once it is on main.
- The builder takes the Knight item, then the dungeon kit and the tavern test; Michael looks at `docs/art/spike/hexagon-tavern-*.png` and picks the village kit.

## 2026-10-14: Session 40, combo.e2e no longer loses the fight standing in the goblin

**What changed**

- `tests/combo.e2e.ts` failed about 1 run in 10 here (3 in 7 on the critic's runs of the branch, 2026-10-14), always at its 30 s limit. A trace of a failing run: the close-in step was timed on the player's speed alone, the goblin closed at its 3.4 m/s too, and the player ended 0.43 m from it, then 0.16 m. That near, "in front" for Cleave's and Execute's cones is a coin toss: one Cleave landed, every Execute after it missed, and the goblin downed the player at 29 s. The camera's swing in behind (Session 38) turns the keys a little between the aim and the press, which makes the overshoot likelier, not the cause.
- The approach step is now timed on both speeds (`PLAYER.speed + ENEMY_KINDS.goblin.speed`), and under 1 m the test backs off to about 1.5 m before it strikes. The stale comment about the camera turning toward the fight now says it swings in behind the travel. No game code changed.
- `combo.e2e` 40/40 in two runs of 20 (7.4 to 9.7 s each; before, 9/10 with the failure at 31 s); the full browser suite 18/18; `npm run check` 208; `npm run test:net` all fifteen steps.

**Learned**

- A player standing inside an enemy happens in play (the drawn goblin sat 0.16 m from the player for 15 s), and at that distance a melee cone misses as often as it hits. For a test that is a steering bug; for a player it would read as "my Execute whiffed point blank". Worth the gate playtest's eye, not a change now.

**Next**

- Phase 1 has no builder item left; the gate playtest and the art spike's keep-or-hire look are Michael's.

## 2026-10-14: Session 39, the art spike: the adventurer and the goblin rebuilt to the references

**What changed**

- `playerFigure` is now the base adventurer from `docs/art/reference-models/adventurer.png`: 1.8 m, a big blocky head (jaw, nose, ears, dark eyes and brows, brown hair with a swept quiff), broad iron shoulder pads, a tunic flaring to a skirt at mid-thigh with a belt, brass buckle and a bandolier front and back, dark sleeves, leather bracers, big gloves, dark trousers and chunky boots with a turned cuff. The party colour tints the tunic only. 38 parts, 564 triangles (budget 1,500).
- `goblinFigure` is now the basic goblin from `goblin.png`: 1.1 m, hunched 0.4 rad with the head lifted out of the hunch, an oversized faceted head, two huge flat ears swept out and up, a drooping nose, glowing torch-orange eyes under angry brows, a leather vest over a pot belly, wrapped wrists, boots, a short iron sword carried point-up and a round oak shield with an iron rim and brass boss on the off arm. 29 parts, 480 triangles (budget 800). Its skin is now Grub green `#A5C83A` (the Warrens accent; the reference is yellow-green), and its windup colour lightens it like the other kinds.
- Both are flat-shaded, one colour per face, with a lighter top baked into vertex colours (0.82 at the feet to 1 at the head), colours from the style guide's neutrals. Geometry is built once per kind and shared by every figure of it; only the tinted material is per figure. The Shieldbearer, Charger and Pack Leader are untouched (they keep `goblinShape`).
- Animation, all in `poseFigure` by moving whole parts: an idle sway (a 3 s breath on the torso and arms, fading out as the walk comes in), the walk (the old stride plus a lean and a shoulder twist against the hips), the swing (the torso twists into it; the goblin's windup lifts the sword overhead, 2.6 rad), and a hit flinch (torso and head rock back). The goblin flinches while its hit flash shows; a player flinches for 220 ms when its drawn hp drops (`render.ts`, draw-only). Nothing allocated per frame.
- `npm run turnaround` (`tests/turnaround.ts`, page `client/turnaround.html`, dev only: the build still has one entry): starts Vite on port 5179, renders each figure on a Bone backdrop under the game's lights from the front, side, back and the game's over-the-shoulder camera (`CAMERA`'s pitch, distance and shoulder, 50 degree field of view), in idle, mid-walk and mid-swing, with the reference crop on the left, and writes six PNGs to `docs/art/spike/` (committed). In a cloud session it needs `PW_CHROMIUM=/opt/pw-browsers/chromium`.
- Tests: `tests/figures.e2e.ts` now checks the triangle budgets (visible meshes, so the held weapon counts); it, `camera`, `hit-feedback` and `village` e2e pass.

**Learned**

- The silhouette carries it: the goblin's ears and the adventurer's head and pads read at once in the turnarounds, and at the in-game distance (a figure about a fifth of the screen tall) the detail below that (buckle, brows, wraps) barely registers. Budget spent on shape beats budget spent on trim.
- What a box-built figure cannot match is the reference's softness: rounded cheeks, the hair's tufts and the cloth folds. That is the line between "good enough to keep" and "hire".

**Next**

- Michael's one look at `docs/art/spike/*.png`: keep (an Artist agent joins and the other kinds follow) or hire (the freelancer commission goes ahead). The spike does not touch the other kinds, `shared/` or the server.
- Phase 1 has no builder item left after this; the gate playtest is Michael's.

## 2026-10-14: Session 38, the camera goes over the shoulder

**What changed**

- The camera sits low and close behind the player (Michael, 2026-10-13, "like RuneScape: Dragonwilds"), replacing Session 29's 35 degrees at 12 m. `CAMERA` in `sim.ts` holds every number: 14 degrees of pitch at 5.5 m, the look target at head height (1.6 m) and 0.55 m to the camera's right, so the player stands left of centre with the way ahead clear.
- The player turns it. Left and Right arrows yaw it at 150 degrees a second, Up and Down tilt it at 75 a second between 5 and 45 degrees (Up raises the eye to look down more, as RuneScape's arrows do), and the right stick does both past a 0.2 deadzone (`Input.look`, `turnCamera`). The arrows no longer move the player: WASD and the left stick are the only movement, still camera-relative through `cameraRelativeMove`. The camera turn never goes in an `InputFrame`, so the server and the replay are unchanged.
- The auto-turn toward the fight is gone (`fightYaw` deleted). In its place, after 1.2 s with no camera input, the camera swings in behind the player's drawn travel (`swingTarget`), at most 45 degrees a second past an 8 degree deadband, and only when the travel is faster than 1.5 m/s and within 75 degrees of the view: the move keys are camera-relative, so swinging behind a strafe or a backpedal would wheel the player round in a circle. While the bow's lock is held the camera keeps the locked enemy within 15 degrees of straight ahead instead (`lockYaw`, `LOCK_TUNING`). Reduced motion turns both off; the player's own turning stays.
- Walls pull the eye in. `clearDistance` casts the head-to-eye segment through every wall as a box from the ground to its height, and every village roof as a slab, and stops the eye 0.3 m short of the first one, never closer than 0.9 m; it comes in at once and eases back out over 350 ms (`easeDistance`) so walking past a pillar does not pump the view. The shoulder offset shrinks with it, so the eye is never in a wall. The pillar fade stays for what the shoulder offset leaves across the body.
- Floor telegraphs got bright rims (a 0.14 m band at the windup wedge's far edge, strips down both sides of the Charger's lane): at 14 degrees the fills flatten to slivers, the rims still read. Teammates' name tags already draw through walls (`depthTest: false`), so a teammate behind a wall stays findable; the local player's own tag is now hidden, since at this distance it hung in the middle of the view.
- HUD hint: "WASD move, arrows camera" and "Gamepad: sticks". README controls updated.
- Tests. `shared/src/camera.test.ts` rewritten (10): the pitch and distance sit in the item's ranges and the look target at head height; Left turns the view left, Up raises the eye, the tilt clamps at 5 and 45; the swing goes behind forward travel and holds for standing, strafing and backing up; it never snaps and rests at the deadband's edge; the lock framing; the pull-in short of a 3 m wall, not for a 1.1 m one the ray climbs over, the minimum when pressed against a wall, a roof overhead; in at once and eased out; the pillar fade. `npm run check` 208. `tests/camera.e2e.ts` rewritten (3): the arrows turn and tilt the camera and leave the player within 0.2 m, then S walks toward the eye at the turned yaw; W+D swings the camera; with reduced motion W+D leaves it at 0 and Right still turns it. e2e 18/18 twice; `combo` missed once in one earlier full-suite run and passed in the five runs since. `npm run test:net` all fifteen steps (nothing in `server/` or `net.ts` changed).

**Learned**

- With camera-relative movement, "swing behind the travel" and "the player strafes" fight each other: any swing during a strafe rotates the strafe with it. A window on the travel's angle to the view is the cheap answer; whether 75 degrees is right is for a playtest.
- At 14 degrees the low walls (1.1 m) almost never block the head ray, the pillars (1.8 m) and the village's walls do; the pull-in mostly happens in the village and against the Warrens' pillars.

**Next**

- The optional mouse look (drag or pointer lock) the item allows is not built; it is never required (CLAUDE.md rule 4) and waits for someone to ask. The swing's window, speed and delay, and the arrows' rates, are first guesses for the gate playtest to judge.
- Phase 1 has no builder item left; the gate playtest is Michael's.

## 2026-10-13: local session, art direction style guide draft

**What changed**

- New `docs/style-guide.md`, the draft of the one-page style guide the backlog's (Michael) art direction item asks for. Part 1: style rules, camera, palette swatches (shared neutrals, the four regions, the dungeon accents, the six states, party outlines), lighting, UI direction, a do / do not table. Part 2: a master style block and five concept-sheet prompts for ChatGPT (world and regions; characters and gear; enemies and combat readability; village and the run; HUD and menus), plus one-line fixes for when an image drifts. Michael read it and approved it as it stands.
- Michael generated the five sheets in ChatGPT; they are in `docs/art/concept/` (WebP, about 450 KB each), and the style guide has a Reference sheets section that links each one with what to use, what to ignore and what is missing.
- A sixth sheet (`06-run-choices.webp`) from a prompt written for the gaps: rest room, go deeper, wipe, combo, downed and revive, the Guide, a corner HUD with three slots, the design's control table, Market Hall trade, the phone layout. It drew all ten and kept the design's bindings.
- Michael's camera direction (decisions.md, 2026-10-13): over the shoulder, like RuneScape: Dragonwilds, not a raised camera that reads as top-down. The design doc's Combat camera paragraph and control table, the style guide's camera rules and prompts, and a new Phase 1 backlog item for the builder carry it. Arrow keys move from walking to turning the camera, so WASD is the only keyboard move.

**Learned**

- The Old Gates concept sheets are painterly and near-realistic; Hearthgate's design doc asks for flat-shaded low-poly. An image model drifts toward painterly unless told otherwise in every prompt, so the guide says so up front and the fixes list leads with it.
- With the style stated that firmly, the look landed on the first try; the content is what drifted. Every sheet invents features the design does not have (classes, a Farm, jumping, a world map and quest log, a centre ability bar, level ranges instead of tiers) and leaves out the rest room choice. Generated sheets are style references only; the notes list each conflict so no one builds from a picture.

**Next**

- The builder takes the over-the-shoulder camera item, then the art spike (decisions.md, 2026-10-13: an agent rebuilds the adventurer and the goblin to match `docs/art/reference-models/` and renders turnarounds beside them for Michael to judge, before any freelancer is hired).
- Michael picked the three reference models (the base adventurer, the basic goblin, the regional building; `decisions.md`). Next for him: the character commission and the asset-pack purchase. A sixth sheet could cover what the five missed: the rest room choice, combo, downed and revive, the Guide, the trade window, a corner HUD with three slots.

## 2026-10-13: Session 37, a refused dodge eases back instead of popping

**What changed**

- `reconcile` (`client/src/net.ts`) tells a refused dodge from a teleport. It keeps the predicted `dodgeCooldownUntil` before it rewinds; a dodge start always sets the cooldown, so a different one after the replay means the server refused or moved a dodge we predicted. Such a correction eases into the visual offset up to `DODGE_SNAP_DISTANCE`, the snap limit plus the dodge's own length (2.5 + 16 m/s x 220 ms = 6.02 m, taken from `PLAYER` so it follows the dodge's tuning), instead of snapping at `SNAP_DISTANCE`. Any other error over 2.5 m still snaps; respawns and hand-offs are placements as before. It still counts as a correction.
- Server and sim unchanged: the server still refuses the dodge and lands the blow, as it should. Only how the client draws the undo changed.
- CLAUDE.md's netcode section names the exception.
- Tests. `tests/reconcile-placement.ts` (part of `npm run test:net`) grew case 5: through the real `Net`, a dodge east predicted over six frames (4.30 m), then a patch where the server applied the dodge frame staggered by a blow (hp down 20, no dodge) and the replay holds us off balance. It eases (0 snaps, 1 correction, a 4.30 m offset to decay); the same 4.30 m error with no dodge in it still snaps. Without the fix the case fails ("a refused 4.30 m dodge snapped instead of easing"). `npm run check` 205; `npm run test:net` all fifteen steps.
- Lag lab, this branch, 60 s a condition on the field: corrections a minute 0 / 1 / 1 / 7 at 0 / 50 / 150 ms / the lossy row, 0 snaps throughout (the critic on main: 0 / 1 / 2 / 2, 0 snaps). The throttled acceptance run (`--only "150 ms" --cpu-throttle 4`, Alpha at 20 to 28 fps), eight runs: corrections a minute 1, 2, 4, 2, 1, 4, 1, 0, walked 181 to 295 m a minute, 0 snaps in all eight. The critic had 4 snaps in 14 runs on main, all with Alpha hurt mid-fight, where the lab's driver dodges while it attacks.

**Learned**

- The dodge was the only predicted move longer than the snap limit, so the limit was really "a dodge is never refused". The cooldown is a free witness: it is set only by a dodge start, so the client needs no new state to know a dodge is what it got wrong.
- A 3.5 m ease over the 90 ms decay is a fast glide back, not a pop; it reads as being caught, which is what happened on the server.

**Next**

- Part 2 of the critic's item, judging a dodge against the swing the player saw (lag compensation of the defender), is not done and not raised: the critic advises holding it until a human says dodges feel late, and the gate playtest's third question will say. The Charger's throw learned a round trip late could in theory exceed 2.5 m too (critic, unconfirmed, not filed). Reconnect is the Phase 1 netcode item left.

## 2026-10-12: Session 36, inputs land in their own slots and come by wall time

**What changed**

- The server applies each input at its slot, not at the tick it arrived in (`shared/src/inputs.ts`, `applyDueInputs`, tuned by `INPUT_TIMING` in `sim.ts`). A player has an input clock, `inputAt` (in `PlayerSim` and the schema): the time their last frame was applied. The next frame belongs one tick after it, never later than the tick (nobody acts in the future, which is also the speed limit), at most two a tick. So a frame that arrived a tick late is applied a tick in the past, where the client predicted it, and two frames that arrive together get two times instead of one. A quiet tick does nothing within 200 ms (`maxLagMs`); past that the player gets a neutral frame at the window's edge (guard kept, so a knock still slides) and the next frame is placed at the tick, the one case the client is corrected for. A frame that waits for its slot is pure latency, so when ticks ending with a frame waiting outnumber those without by 20 (`drainAfterTicks`), the slots move a tick earlier.
- The client replays its pending frames one tick apart from the patch's `inputAt` instead of the patch's tick, so its replay and the server agree on when a dodge, a swing or a cooldown ends. `predictedTime` is now `inputAt` plus a tick per unconfirmed frame.
- The client makes one frame per tick of wall time (`InputClock`, `dueInputTicks`), from a timer scheduled to the next due tick like the server's pump: a timer that runs late sends a frame for every tick it missed, up to four (`clientCatchupTicks`), and drops the rest, so a sleeping tab does not dump stale movement. A held key covers the same ground at 10 fps as at 60.
- A key pressed and released between two samples counts as held for one frame (`input.ts`): on a busy page a short tap of a direction or of block used to vanish, the same frame-rate dependence as a dropped tick.
- Three e2e tests were tuned, without knowing it, to the slow walk the frame-rate bug gave a starved headless page. `combo` walked at the goblin with fixed W+D holds; at full speed it overshot and faced away, so Execute's cone missed. It now aims with the camera's yaw and sizes its steps by distance. `village` stopped within the keeper's talk range on the portal (2.5 m radius, 3.2 m from the keeper) and got handed off mid-walk; it now comes at the keeper from the east, taps the last 2.5 m and checks the portal label while it walks. `camera` held A for 1.2 s and walked 7 m, far enough for the chasing goblin to be in front again; it now takes short steps until the camera turns.
- CLAUDE.md's netcode section describes the slots, the input clock and the replay.
- Tests. `shared/src/inputs.test.ts` (11): a 1.5 s hold covers 9 m within one 10 fps frame at 60, 21 and 10 fps (one frame a callback walked 4.5 m at 10 fps); the catch-up cap; a late frame lands in its slot; nothing applies ahead of the tick; two a tick; the stall rule; the silent-player neutral frame with the guard held; the drain, and no drain for a bunch that comes and goes; determinism. And a client and server over a link that bunches frames (60 ms one way, 0 to 70 ms late, order kept), with dodges, swings and guards: the old timing corrected 30 times in 200 frames, the slots 0. 205 in all.
- `npm run test:net`: all fifteen steps.
- e2e: `two-players`, failing since Session 4, passes. The suite went 17/17, 16/17 and 17/17 in three runs; the miss was `two-players` on a page that got one timer callback in its 700 ms hold (four frames, 1.2 m). On main it fails every run.
- Lag lab, 60 s a condition, main then this branch, corrections a minute: 0 ms 9 and 16 → 0; 50 ms 18 and 15 → 0; 150 ms 31 and 52 → 1; 50 ms ±20 with 2% loss 41 and 21 → 3. Snaps 0 throughout, before and after. View lag 100–110 ms on a clean link before and 115 after; 50 ms 210–240 → 200; 150 ms 395–425 → 405. With `--cpu-throttle 4` (Alpha at about 25 fps) on the 150 ms link: corrections 35 → 1 a minute, walked 174 → 209 m a minute.
- `npm run test:clock` is noisy on main too: its 150 ms pop limit (0.075 m) failed in 2 of the last 4 runs on main (0.225 m) and in about half the runs here (0.1 to 0.25 m). Its held and pop numbers come from late patches and the one-tick projection, not from the inputs. It still needs a look. A guess, not measured: the harness drives Alpha from a `setInterval`, which sends a little under 20 frames a second, and the slots turn that into a frame placed at the tick every few seconds where main gave a neutral frame.

**Learned**

- The corrections on a clean link were never the network: they came from the server and the client giving the same frame different times. Once both count slots from the same `inputAt`, the whole class goes away, not just the dodge cases.
- The first version kept a frame that arrived early until its slot came, which put a standing queue of 0.7 to 1 frames on the driven client (about 40 ms more view lag). A strict "waited every tick for a second" drain never fired, because jitter emptied the queue now and then; counting up and down does.
- A held key that walks the right speed showed up three e2e tests leaning on the bug.

**Next**

- The netcode items left in Phase 1 are reconnect (Fable). The input-path bugs under Found in play are closed. The gate playtest can now judge feel without the clean-link corrections.

## 2026-10-08: Session 35, the event log keeps four lines

**What changed**

- The bottom-right event log holds at most four lines (`EVENT_LOG.maxLines` in `sim.ts`, next to its 2.5 s `showMs`, which moved there from a literal in `main.ts`). A burst drops the oldest line instead of stacking: the critic's case was eight lines in 2.5 s from a Cleave and Execute, which climbed over the ping and corrections panel at 480 x 300 (CLAUDE.md rule 5).
- `pushLogLine` and `expireLogLines` in `shared/src/feedback.ts`, pure, which `main.ts` now calls instead of pushing and shifting by hand.
- Tests. `shared/src/feedback.test.ts` (+2): nine events leave the newest four; a line shows for exactly `showMs`. 194 in all. `tests/mobile.e2e.ts` (+2): four of the longest log lines at 480 x 300 and 568 x 320 sit below the top-right panel and clear of the ability slots. With eight lines the same check fails (log top at 50 px against the panel's bottom at 89 px at 480 x 300), so it catches the bug; with four the log's top is at 130 px, two lines of room to spare. mobile e2e 6 of 6.

**Learned**

- No CSS change was needed: a line is about 20 px, and the gap between the slots and the top-right panel on the smallest landscape phone fits six. A cap in lines is simpler than a max-height and never cuts a line in half.

**Next**

- Phase 1's builder list is empty again: the gate playtest, the art-direction item, and the Fable items (reconnect, the two input-path bugs, whose card is the producer's open question).

## 2026-10-06: Session 34, Execute and the combo callout

**What changed**

- Execute is the melee weapons' slot 2 (key 2, gamepad B), Michael's A on "No combo can fire in play yet". `ABILITIES.execute` in `sim.ts`: 300 ms windup, 650 ms committed, 2.4 m, the sword's 108 degree cone, 18 damage, 5 s cooldown. It takes the nearest Staggered enemy in its cone, else the nearest, with the tags `melee` and `execute`, so `resolveHit` consumes Staggered for the crit (x2) times the combo multiplier: 36 alone, 54 when someone else did the staggering (x1.5 for two players). On an enemy that is not staggered it is an 18 hit that drains posture like Cleave. A goblin (60) is felled by a teammate's Cleave (14) then Execute (54).
- The crit's knockdown is carried out now (`knockDown`): recovery for `COMBO.knockdownMs` (1.2 s), guard down, posture broken for the time, any charge stopped.
- The server no longer drops the payoffs: every hit that consumes a state adds a `combo` event (attacker, enemy, payoff, contributors, multiplier), broadcast with the tick's other events. Marked, which consumes nothing, is not a callout.
- `contributors` ignores the empty applier: a Charger stunned on a wall is Staggered by the level, which set up a crit but is not a second player (it would have read x1.5 alone).
- Client: the callout over the enemy, "Combo x1.5" (or "Critical" alone), gold with a dark outline, rising 0.7 m and fading over a second, from three sprites built once in `render.ts`; a rising chime in `sound.ts`, one note per player (two to four); a log line ("Combo x1.5 from 2 players: the goblin knocked down"); the slot reads "Execute".
- Tests. `shared/src/execute.test.ts` (8): slot 2 commits and cools down; a plain hit with no combo; a solo crit with the knockdown; the two-player x1.5 that kills the goblin; Execute lands inside Staggered's 2.5 s after a teammate's Cleave; it prefers the staggered enemy over a nearer one; a wall stun counts no extra player; a plain swing makes no combo event. 192 in all. `npm run test:net` grew a step: in a cellar Mira cleaves, Nell executes, and both clients get the combo event, x1.5 from 2 players for 54, 2.2 s after setting off. `tests/combo.e2e.ts`: a real browser walks at the cellar's goblin, presses 1 then 2, and sees the callout ("Critical"), the log line and the slot's name, no page errors. camera, figures, join, mobile, village and combo e2e 13 of 13.

**Learned**

- Every piece of the combo was built except the last metre: the states, the multiplier and the contributor count were in `states.ts` since Session 8, but nothing consumed Staggered and the server threw the result away. The gate's "visible" was a missing event and a sprite, not a system.

**Next**

- Phase 1's builder list is empty: what is left is the gate playtest (a mixed-level party clears the Warrens and sees "Combo x1.5"), the art-direction item, and the Fable items (reconnect, the two input-path bugs). Whether Execute's numbers and the callout's size feel right is the playtest's call.

## 2026-10-06: Session 33, the enemy bar stops promising a return on a floor

**What changed**

- The enemy bar's text once nothing lives comes from `clearedBarText(level)` (`shared/src/feedback.ts`): "returning soon" on a level without stairs (the field and the yard, which reset after `ROOM.resetMs`), "floor clear" on one with stairs (the Warrens, the cellar), where nothing returns until the party leaves. The label above it still reads "Stairs open: everyone onto them". Fixes the critic's 2026-10-06 find.
- Test: one unit test over the four combat levels (184 in all).

**Learned**

- The HUD had one level-blind string left from the field's reset loop; the stairs' arrival made it false. Any text that describes what the level does next belongs with the level, not the HUD.

**Next**

- Execute in melee slot 2 and the combo callout (Michael's A).

## 2026-10-06: Session 32, the client walks the village and follows the hand-off

**What changed**

- The client joins the village first: `Net.connect` picks the `village` room when no level is asked for (or the village's id) and a `dungeon` room on that floor otherwise, so the tests and the lab (`?level=field`, `yard`, `warrens`) go where they always did. A `handoff` message from the server (`Net.handoff`) leaves the room, drops everything that was its (the clock, since each room counts ticks from its own zero; the pending inputs, the remotes, the enemies, the placement, the pings) and consumes the seat; the new room's first patch places us as a join does, so the move is neither a correction nor a snap (`tests/village.e2e.ts` checks `snaps` stays 0). A status line ("Through the portal: The Goblin Warrens", "Up the stairs: back to the village") shows until that patch; the event log and any villager's line are cleared with it.
- The town's look, built once per level in `render.ts`: the ground, grid and edge wall now take the level's bounds (the village is 48 m square, the sun's shadow box follows); a wall is drawn at its own `h` when the level gives one, so the buildings stand 3.2 m with a doorway, a flat roof a little proud of the walls and a sign over the door; each villager is the player figure in a plain coat with a name tag; the portal is a blue dais in a ring of stones that glows a little always and brightens as the party's hold fills (`setPortal`), beside the stairs' dais.
- The villager prompt: when a villager is within `NPC.talkRange` of where we are drawn, the top-left panel shows a real button, "E or LB: talk to Keeper Wren", at least 48 px high, that a tap or a click presses as E does (`Input.pressUse`), so the touch layout can keep it as it is. The server's `npcTalk` for us puts the line under it for 8 s ("Keeper Wren: The shrine's portal opens on..."); a friend's talk is a log line. In the village the enemy bar is hidden and its label says where you are, or the portal's hold as it fills. The enemy label is capped at the bar's width so a long one wraps instead of pushing the panel into the top-right one (the mobile test caught it on a 412 px portrait phone).
- Tests. `tests/village.e2e.ts`, a real browser: joins the village (level and room "village", no enemies), walks round the dais to the keeper, sees the prompt (48 px) and the keeper's line on E, stands on the portal, is moved to a Warrens room with nine enemies and one hand-off, no snap, the status line gone, and a step still moves it on the new server clock, with no page errors (25 s). The rest of the suite: `camera`, `figures`, `join`, `mobile` 11 of 11 with it; `two-players` fails on the committed tree as it has since Session 4 (0.3 m in 700 ms headless, the frame-rate item in Found in play) and `hit-feedback` as Session 29 found. `npm run check` 183, `npm run test:net` all fourteen steps.
- The lag lab (`npm run lab`, 60 s a condition, on the field as the critic pins it, so a dungeon room and none of this session's code in the path): corrections a minute 12 / 36 / 59 / 20 and holds 15 / 2 / 20 / 21 at 0 / 50 / 150 ms / the loss row, 0 snaps but one at 150 ms. Against the critic's 13 / 20 / 16 / 52 and 7 / 8 / 4 / 43 on 2026-10-05 that read worse, so the 150 ms condition was run again on main and on this branch back to back on the same box: main 45 corrections and 12 holds, the branch 52 and 5, no snap on either. That is this sandbox's spread (the critic saw 11 to 24 on one build and Session 25 saw 51 on main at 150 ms here, both at about 30 fps under software WebGL), and the corrections are the tick-timing item the critic filed, not the rooms: the dungeon's step is the same code moved into `SimRoom`. The single snap did not come back in either re-run.
- CLAUDE.md's netcode section describes the two room types and the hand-off; the backlog item is checked.

**Learned**

- The hand-off's cost on the client is the clock: it starts over, and the first second in the new room runs on the fast pings (twelve at 250 ms) before the window fills, as a join does. Nothing else about the netcode knew which room it was in, which is what the `SimRoom` split was for.
- A slow walk across the dais is a hold: the first e2e run was handed to the Warrens on its way to the keeper, because the headless page walks at about a metre a second and the portal takes two seconds of everyone standing on it. At 6 m/s a player crosses the 5 m dais in under a second, so in play it needs a stop; the test goes round it. Whether the portal should ask for a press rather than a stand is a feel question for the playtest, noted below.

**Next**

- The greybox is Michael's to walk: the layout (the shrine straight ahead, the tavern behind and to the left so the camera is not inside it from the square), the hold on the portal against a press, whether villagers should face you when you talk, and what the stairs' return should feel like. Then the Phase 1 gate playtest, the combo item (builder), and the Fable items left: reconnect with a grace period, the two input-path bugs the critic filed.

## 2026-10-06: Session 31, the village room and the hand-off between rooms

**What changed**

- The server has two room types, as the design doc's Rooms paragraph says: a `village` room the client joins first and a `dungeon` room a run. Both are a `SimRoom` (`server/src/rooms/SimRoom.ts`): one `Level`, the 20 Hz tick locked to wall time, two queued inputs a player a tick, the patch at the end of each step, the clock pings. `DungeonRoom` and `VillageRoom` only name their level and act on the tick's events, so nothing in the netcode's shape moved.
- The village is a `Level` (`VILLAGE` in `shared/src/level.ts`): four greybox buildings (Portal Shrine north, General Store west, Storehouse east, Tavern south) whose walls are ordinary `WallRect`s made by `buildingWalls` (four faces at 3.2 m, a 2.4 m doorway in the face the door is on), so a building stops a player exactly as a ruin does and the client's prediction already runs it. A villager (`Npc`) stands by each door with one line; a portal on the ground before the shrine leads to the Warrens. No enemies. `WallRect.h` is a drawing height the collision ignores.
- The hand-off. The party moves as the stairs already did: every standing player on the portal (`PORTAL`, 2.5 m, 2 s) or the open stairs (`STAIRS`, unchanged) for the hold. The sim says so once (`portalTaken`, `stairsTaken`; `Encounter.departed` latches) and the server does the rest in `SimRoom.handOffParty`: it locks the room, makes a fresh dungeon room on the portal's level (or finds an open village, or makes one), reserves a seat per client under their own name, weapon and tier, and sends each a `handoff` message with the reservation and the level id. The client leaves and consumes the seat (`colyseus.js` `consumeSeatReservation`); the old room disposes when empty. A refused reservation clears the latch so the portal or the stairs fire again.
- The stairs no longer restart the floor: `floorDescended` and the floor counter are gone, with the enemy reset and the draught refill that rode on them (a fresh run is a fresh dungeon room). `use` (E, LB) is one key: a dead teammate in reach takes the draught, else a villager in reach talks (`talkToNpc`, 2.5 m) and the server broadcasts `npcTalk`; the line itself is level data, never sent.
- `CELLAR`: the smallest floor, one goblin and the stairs, for the tests. `LEVELS` now holds five.
- Tests. `shared/src/village.test.ts` (10, 183 in all): a building's five walls and its doorway on each face, a player through the door and stopped beside it; the village's spawns, villagers and portal clear of its walls and the spawns off the portal; every door reachable from the square and every back wall closed; talk in reach and not out of it or downed; the portal fires once when everyone holds it, resets when one steps off, ignores the dead, and works again after the server clears the latch. The Warrens stairs tests say "taken, once" instead of "restart the floor". `npm run test:net` grew two steps: two bots in a village room (no enemies, four villagers), one talks to the keeper in 1.5 s, both hold the portal and are handed seats in one fresh Warrens room 3.3 s after setting off, there together with the bow Juno picked; then in a cellar Kit kills the goblin in 2.7 s, both hold the open stairs and are handed to a village together, 2.9 s. The server log shows each left room disposing. The old eight steps and the stress run (20.0 patches a second, 54 ms worst gap) are unchanged.
- Client: only what the typecheck needed (the floor counter and its log line); the join, the hand-off, the town's look and the villager prompt are the next session.

**Learned**

- Colyseus's matchmaker does the hand-off's hard part on the server: `createRoom` plus `joinById` per client gives every member a seat in the same new room before any of them moves, and a locked room is skipped by `joinOrCreate`, so a party on its way out cannot be joined. The clients never see a room id they did not get from the server.
- One hold rule for both moves keeps the sim to one new function (`holdOn`) and means the portal needs nothing the stairs did not already have on keyboard, gamepad and a later touch layout.

**Next**

- Session 32: the client joins the village by default and follows a `handoff` (tear down the level, the remotes and the clock, consume the seat, build the new level), draws the buildings with roofs and signs, the villagers and the portal, shows the 48 px talk button and the line, and the e2e test walks a real browser through the portal. Then CLAUDE.md's netcode section, the lab numbers and the backlog.

## 2026-10-05: Session 30, placeholder figures instead of pills

**What changed**

- Every player and enemy is a low-poly figure of flat-shaded parts instead of a capsule or a cone, built once per entity in `client/src/figures.ts`, one function per kind behind `enemyFigure(kind)` and `playerFigure(colour)`, each returning a `Figure` (root, hip and shoulder pivots, the right hand, the flashing material, the height) so a commissioned model can replace a kind without touching `render.ts`.
- Players: broad-shouldered wedge torso in the party colour, a head with a dark brow band on the front (the facing; the old nose block is gone), dark legs, arms. The held weapon now hangs from the right hand, a little oversized per the design doc's Art section, so a swing lifts it with the arm.
- Goblins small and hunched (1.0 m, leaning 0.45 rad) with big ears, glowing eyes and a stubby club. The Shieldbearer the same family at 1.35x, more upright, with a helmet, behind its existing plank shield. The Pack Leader 1.45x and nearly upright with a red crest of spikes under its existing banner: the tallest outline in the room. The Charger a four-legged beast, long and low (wider than it is tall), with a hump, a low head and tusks.
- Animation without a skeleton: `stepFigureWalk` advances a stride from how far the drawn pose moved (a full cycle per 1.3 m; a jump over 1.5 m is a placement, not a stride) and eases the swing in and out over about 100 ms; `poseFigure` swings legs and arms opposite, bobs the root, and raises the weapon arm for a swing. An enemy's windup rears it back with the arm raised (the Charger only rears), replacing the old rising cone. Dodge, stagger, downed and dead lean or lay the whole figure as they did the capsule; hit flash, windup and rally tints are unchanged. Name tags and party colours stay; the HP bar sits above the tallest figures.
- Tests: `tests/figures.e2e.ts` reads a new `__hg.figures()`: each of the four kinds and the player has 7+ parts; goblin shorter than the player, Shieldbearer taller than the goblin, Pack Leader taller still, Charger wider than tall; standing stride under 0.05, over 0.5 while S is held, back under 0.05 after. `camera`, `join`, `mobile` e2e green with it (11 of 11, three runs). `npm run check` 173.
- Follow-up to Session 29: `tests/camera.e2e.ts` walks at the goblin until it wakes instead of for a fixed 1.5 s, and steps west before waiting for the turn: 1 run in 6 had stopped short or left the goblin inside the deadband. 16 of 16 after.

**Learned**

- At the new camera the yard's 1.1 m walls read as big blocks; the figures are scaled to them (the player 1.84 m) rather than the other way round, so the levels' numbers did not move.

**Next**

- The combo item once Michael answers. Then Phase 1 holds only Fable work, the art-direction item and the gate playtest.

## 2026-10-05: Session 29, the camera to the design doc's spec

**What changed**

- Merged main (Fable's extrapolation, PR #17, and the local camera/art backlog) into `auto/build`. Three conflicts, all keep-both: `client/src/net.ts` (each remote player keeps its `weapon` from Session 25 and takes main's `PoseTrack`; the old `sampleSnapshots` and `pushSnapshot` go, `syncWeapon` stays), `decisions.md` (the staff and village answers side by side) and the devlog (both Session 25 entries kept).
- The camera sits at 35 degrees and 12 m from the player instead of 55 degrees and 15.8 m, so it reads as third person, not top-down. It turns toward the fight: the centre of the awake enemies and living teammates within 14 m, the player included. The turn ignores the first 20 degrees of error, eases over 1.5 s and never exceeds 40 degrees a second; out of combat, or with the fight centred on the player, it holds still. All of it is pure in `shared/src/camera.ts`, tuned by `CAMERA` in `sim.ts`, and draw-only.
- Movement is camera-relative: `Input.sample(yaw)` turns WASD and the left stick by the camera's yaw before the vector goes in the `InputFrame`, so the server and the replay still see plain world vectors and nothing in the simulation changed. At yaw 0 the frame is exactly what it was.
- Walls between the eye and the player swap to a see-through material (and stop casting shadows) while they are in the way: the sight line to the player's middle is clipped to each wall's footprint and checked against its top where it leaves. At 35 degrees that is the 1.8 m pillars; a 1.1 m wall would have to stand within 0.3 m of the player's centre.
- Reduced motion (`prefers-reduced-motion`) keeps the camera from turning, as the hit nudge already did; the nudge still rides on top of the follow.
- Tests: 7 in `shared/src/camera.test.ts` (173 in all): 35 degrees and closer than before; yaw 0 moves as before; W away from the eye and D to the screen's right at any yaw; the fight pulls the camera, out of range or out of combat holds; the turn is capped per frame, takes the short way across the back and rests inside the deadband; which pillar hides the player at two yaws. `tests/camera.e2e.ts` (2 of 2): in the yard the camera turns once a goblin wakes and S then walks toward the eye within 35 degrees; with reduced motion the yaw stays 0. `join` and `mobile` e2e 7 of 7. `npm run test:net` green on the merged tree.

**Learned**

- `hit-feedback.e2e.ts` fails without this change too (no hit lands in 20 s headless): the same headless slowness as the critic's frame-rate item, not the camera.
- A sight line falls from the eye to the player, so it is lowest where it leaves a wall's footprint, not where it enters; testing the entry point missed a pillar standing right behind the player.

**Next**

- Placeholder figures instead of pills, the next builder item. Then the combo item once Michael answers.

## 2026-10-05: Session 28, Magic deferred; no combo fires in play

**What changed**

- Michael's answer B on "The staff for Magic missile" (control room, 2026-10-05): Magic and Magic missile wait for Phase 2 or later. The Arrow rain item closes with Arrow rain (Session 27), and the weapon classes item closes too: the staff goes with Magic, and the bow's charge timing is left for the gate playtest to judge. The question moves to Answered in `decisions.md`.
- Checked what the gate's "combo bonus is visible" can rest on, and it is nothing yet. `resolveHit` pays off only when a hit's tags consume a state: Staggered (applied by Cleave, parries and posture breaks) is consumed by `execute` or `backstab`, and no hit carries either tag; Marked, Soaked, Burning, Rooted and Chilled are applied by nothing. The server also ignores the returned `effects`, so even a payoff would reach no client. New question under Pending: "No combo can fire in play yet" (A, Execute in the melee slot 2 plus a combo callout over the enemy, recommended), and a **(design)** item in the backlog for it.
- No code changed. `npm run check` (155 tests) and `npm run test:net` green on the merged tree.

**Learned**

- The states system was built ahead of the abilities that feed it (Session 8), and the abilities that landed since (Cleave, Arrow rain) apply or ignore states without consuming any, so the combo half of the gate fell through a gap no single item owned.

**Next**

- Build to Michael's answer on the combo question. Without it, nothing is left in Phase 1 for the builder: the rest is Fable work and the gate playtest.

## 2026-10-05: Session 27, Arrow rain

**What changed**

- The bow's slot 1 (design doc: "Arrow rain: arrows fall on a marked area"; `ABILITIES.arrowRain` in `sim.ts`, `BOW_SLOTS`). Press 1 (gamepad Y) with a bow: a 650 ms draw and flight, committed for 700 ms, then a volley lands on every living enemy within 3 m of the spot for 16 each, tagged ranged and area for the combos; 8 s cooldown. It comes from above, so a Shieldbearer's raised shield does not cut it, and it breaks no windup (Cleave's job).
- Where it falls (`rainSpot`, server only, chosen when it lands so it falls where the target is now): the bow's lock if it is within 12 m and in sight, else the enemy a bow shot would take, else 7 m ahead inside the level. Session 26's lock is the "mark".
- `SimEvent` gains `arrowRain` (the spot and how many it hit), sent even when it hits nobody; the client flashes a gold disc of the volley's size there for 400 ms (four discs built once in the View, the oldest reused). The log says "Your arrows hit the goblin for 16", or "Your arrows found nothing". The slot reads "Arrow rain".
- Magic missile waits: the staff does not exist in The Old Gates. Question under Pending in `decisions.md` ("The staff for Magic missile"; A, add a Staff with Magic missile, recommended).
- Tests: 4 more in `shared/src/weapons.test.ts` (155 in all): on the lock, three of a pack under it and the fourth outside untouched, once each and not again; the auto target and the miss ahead; full damage on a raised shield; a lock behind a wall is not the spot. An earlier test now checks that an archer's empty slot 2 spends nothing. `npm run test:net`: the lock-on room now casts Arrow rain on the locked goblin and sees it land for 16. `tests/join.e2e.ts` 4 of 4 and `tests/mobile.e2e.ts` 4 of 4, twice; the archer's walk now holds the keys until the goblin is in range, since a fixed 1.5 s walk fell 4.6 m short in one run (the frame-rate bug).

**Learned**

- Choosing the spot when the volley lands, not when it is loosed, keeps it out of prediction entirely: the cast (cooldown, commitment) is predicted from the player alone, and only the server, which knows where every enemy is, picks the spot.
- The client's disc shows where it landed, after the fact. A telegraph before landing would matter if enemies could see it; for now the bow's target ring is the aim.

**Next**

- Magic missile and the staff after Michael's answer.
- The Phase 1 builder list is otherwise done: the gate needs a playtest of a mixed-level party clearing the Warrens, and the combo bonus has nothing on screen beyond the log (Session 22's note), which may be worth a backlog item before that playtest.

## 2026-10-05: Session 26, the bow's lock-on cycle

**What changed**

- The design doc's Targeting line ("ranged weapons use a lock-on cycle rather than free aim"): with a bow, Tab or R (gamepad RT) locks on. The candidates are the living enemies within the bow's 12 m with a clear line, in any direction, nearest first; each press moves the lock to the next, and past the last it goes back to soft auto-targeting, so the same key lets go. Any other weapon clears the lock.
- The server decides it, as the draught is decided: `InputFrame.cycle` (a press; `isValidInput` checks it), and `cycleLock` runs in `DungeonRoom.step` after everyone has moved, from where the archer stands. `PlayerSim.lockId` is in the schema (`lockId`); the client copies it on reconcile and never predicts it, since `applyInput` does not touch it (a unit test proves a cycle frame predicts exactly like one without).
- A locked shot goes to the lock wherever the archer faces, while it is in range and in sight; with a wall between them the shot falls back to the cone and the lock holds. `dropStaleLocks` (once a tick in `stepEncounter`) lets go when the enemy dies, gets past 1.25x the bow's range (`LOCK_ON.keepRangeMult` in `sim.ts`), or the archer is down or dead.
- Client: one ring built once in the View, on the ground under the bow's target: solid gold under a lock, faint under the enemy the cone would pick now (presentation only, from the interpolated poses). The enemy panel follows the lock ("Goblin (locked), 1 of 1 left"). The controls hint lists Tab.
- Tests: 6 in `shared/src/weapons.test.ts` (151 in all): the cycle order through range, sight and direction and back to auto, only a bow locks, a locked shot behind the archer, a lock out of sight falling back without letting go, letting go on death and distance, the input check and prediction parity. `npm run test:net` adds a lock-on room: nothing in range at 17 m, the field goblin locked at 8.3 m after walking toward it, back to auto on the next press. `tests/join.e2e.ts` adds an archer who walks in and presses Tab: the lock reaches `__hg` and the HUD says "(locked)". join 4 of 4 twice, mobile 4 of 4.

**Learned**

- A key that cycles is a toggle in disguise: the first version of the e2e pressed Tab every 300 ms until it read a lock, and a press still in flight let go again. Anything scripted against the cycle should press once and wait for the patch.
- The goblin's aggro (14 m) is longer than the bow's reach (12 m), so a goblin always closes on an archer it has seen; the Shieldbearer (10 m) and the Charger's lane are where the bow's range will matter.

**Next**

- Arrow rain in the bow's slot 1 (Ranged), with a ground marker on the lock. The staff (Magic) and Magic missile need defining, since The Old Gates has no staff; they may want a design question first.

## 2026-10-05: Session 25, pick a weapon before joining

**What changed**

- Michael's answer A (2026-10-05) to "How a player picks a weapon": a join screen before the room (`client/src/join.ts`). Two rows of buttons, the eleven weapon types and the ten materials, and Join. Arrows or WASD move, Enter or Space joins; a gamepad's d-pad or stick moves and A joins (polled per frame, acting on the press, and a button already down when the screen opens is ignored); every choice is a real button of at least 48 px, so a tap works too, and nothing needs hover. A line under the rows says what the pick does and what it is worth here: "Iron Claymore, two-handed: slower, hits up to 3 in front; Cleave on 1. 51 a hit in a tier-1 portal, held to Bronze (a tier-1 portal allows up to tier 2).". The last pick is remembered in the browser (wrapped in try/catch; a private window starts from the sword).
- A scripted join skips the screen: a URL with `?name=` or `?weapon=` connects straight away, which keeps the e2e tests and the critic's lab unchanged; `?weapon=claymore&tier=5` picks for it (Michael's note on A).
- The server trusts only a type name and a number: `weaponFromPick` in `gear.ts` turns an unknown type (or `toString`, or an object) into the starter sword and clamps the tier to 1..10. `DungeonRoom.onJoin` sets the player's weapon from it; `PlayerState` gains `weaponType` and `weaponTier`, so every client sees what everyone holds.
- Prediction: the client starts with its pick and takes the server's checked weapon on every reconcile, before the replay, so a Claymore's 300 ms windup is predicted with a Claymore. Remote players carry theirs for drawing.
- Abilities by style (`slotsFor`): melee weapons (one- and two-handed) carry Cleave in slot 1, the bow's slots are empty until Arrow rain. `abilityInSlot` now takes the weapon; before this an archer would have cleaved.
- Client: one held mesh per class (a blade, a long blade, a bow) and one swing arc per class sized to its range and cone, built once per player and toggled; the held mesh takes the material's colour and its glow from Mithril up, changed only when the weapon changes. The swing flash follows the class's timings instead of the Phase 0 sword's. The HUD's top-left panel shows the weapon under the name.
- Tests: 4 in `shared/src/weapons.test.ts` (145 in all): the pick, the fallbacks and clamps, slots by style, and an archer pressing 1 spending nothing on either side. `npm run test:net` adds a weapon-pick room: a tier-5 Claymore reaches both clients and swings two-handed on the server, a "laser" at tier 99 becomes a tier-1 sword. `tests/join.e2e.ts` (3, all green): keyboard alone picks an Iron Claymore and joins with it; at 360 x 640 every choice is 48 px or more with no sideways scroll, and a tap on Bow then Join works; a scripted join skips the screen. `tests/mobile.e2e.ts` 4 of 4.

**Learned**

- `tests/hit-feedback.e2e.ts` is flaky on this box with or without this session's change (1 of 3 on the merged tree before it, 1 of 2 after): the player walks 1.5 s toward the yard's first goblin and sometimes never trades a hit within 20 s. Likely the frame-rate movement bug (Fable, in Found in play) or the Session 24 chase routes; not chased here.
- Putting the weapon on the name line pushed the top-left panel into the top-right one at 360 px (the mobile e2e caught it); it has its own line now.

**Next**

- The bow's lock-on marker and a key and button to cycle targets, then Arrow rain in the bow's slot 1. The staff (Magic) and Magic missile need defining: The Old Gates has no staff.
- The gate's "mixed-level party" is now possible: two players can join with different tiers.

## 2026-10-05: Session 24, enemies use the doors

(Numbered 24 because the Fable branch, PR #9, already carries a Session 23.)

**What changed**

- The critic's bug (2026-10-05): an awake enemy whose target left its room pressed straight at them into the wall and slid to a corner, where it stayed; a Shieldbearer sat at (-1, 8.9) inside the guard room while its target stood in the hall at (2, 3).
- `Level.waypoints` in `shared/src/level.ts`: points either side of each doorway, 1.8 m out from the wall so the way to them clears the jambs. The Warrens has six (guard room to hall, pens to hall, guard room to den). The field and the yard have none and behave as before.
- `pathClear` (a body of a given radius fits from a to b: the centre line and both edges clear) and `steerToward` (the target itself when the way is clear, else the first waypoint on the shortest route, a Dijkstra over the handful of points with ties to the lower index, so it is deterministic). In `stepEnemy`'s chase, an enemy that cannot walk straight now walks to that waypoint and faces it; arriving hands on to the next leg. With no route it slides as before. The wake rule (line of sight) and the Charger's lane are unchanged.
- Tests: `shared/src/pathing.test.ts`, 6 (136 in all): the critic's exact case reaches the hall, a den goblin reaches the hall through the guard room, a pens goblin uses its door, straight walking when clear and on levels without waypoints, two runs agree. The three chase tests fail on the old code. `npm run test:net` green (no server change; the Warrens and 4-bot stress steps unchanged).

**Learned**

- A single door point in the wall's plane is not enough: a chaser pressed along the wall approaches it nearly parallel and its edge clips the jamb, so the route says blocked. Two points per doorway, set back from the wall, fix that and give the chaser a straight line through.
- Routes are recomputed every tick per enemy; with six points and nine walls that is cheap. A bigger floor would want the waypoint-to-waypoint visibility cached per level.

**Next**

- Still waiting on Michael's answer on picking a weapon (decisions.md); then the rest of the weapon classes, Arrow rain and Magic missile.
- For the critic: re-run the guard-room steps; a chaser should now come out of the door within a few seconds.
## 2026-10-05: Session 25, extrapolation past a late snapshot

**What changed**

- `shared/src/interp.ts`, pure and unit tested: the remote pose lookup the client used to keep in `net.ts` (`sampleSnapshots`, `pushSnapshot`, the 24-deep buffer) moved here as a `PoseTrack` per entity, and learned two things. Past the newest snapshot, `projectPose` moves the pose along the motion of the last tick (the last two snapshots) by at most `INTERP.extrapolateMaxMs` (one tick, 50 ms) and holds there; facing is held, because the sim turns a player to a new heading inside one tick and projecting that would spin them past it. The projection runs through `collideWalls` with the entity's radius (`PLAYER.radius`, or the kind's from `ENEMY_KINDS`), so a goblin walking at a wall is drawn stopped at its face the way the server stops it, never inside. A step faster than `INTERP.extrapolateMaxMps` (20 m/s; the fastest real move, a dodge, a charge or a throw, is 12) is a placement, a respawn or the stairs, and is held rather than flung another 15 m.
- The ease. A projection is a guess, and the snapshot that ends it can disagree: the player stopped, turned, or the stall ran past the cap and they are a metre on. `pushPoseSnapshot` remembers the pose the track last handed out and the draw time it was for; when the newest snapshot arrives for a time the track was already past, it interpolates the new buffer at that same draw time and makes the difference a per-entity offset that `samplePoseTrack` adds to every later pose, decaying with time constant `INTERP.easeMs` (100 ms). So the first frame after the late snapshot continues from the last one drawn, and the remote is on the true path within half a second. Over `INTERP.easeSnapM` (2.5 m) the difference is a placement and pops, as a correction of the own player does over `SNAP_DISTANCE`. Position only: facing was already interpolated across a tick.
- `client/src/net.ts`: `RemotePlayer` and `EnemyView` carry a `track` instead of `snaps`; `remotePose` is `samplePoseTrack` at `remoteNow()` inside `net.level`; the snapshot push passes the level too, so the fold-in sees the same walls. `Pose` is the shared type now, re-exported for `render.ts`. `main.ts` is unchanged: every call site (the draw loop, the HUD's nearest enemy, the revive prompt, `__hg`) goes through `remotePose`, so remote players and every enemy get the projection and the ease together.
- Constants in `INTERP` (`sim.ts`): `extrapolateMaxMs`, `extrapolateMaxMps`, `easeMs`, `easeSnapM`. The server is untouched: this is draw-only, and the shared sim's step does not call any of it.
- `tests/clock-sync.ts` reports five more columns and fails on three of them: `late %` (frames whose newest snapshot was late, what a fixed pose would have held on), `proj %` (late within one tick: projected), `held %` (late past the cap: frozen), `ahead` (the furthest a drawn pose sat from the newest snapshot while projecting, m; one tick of travel is 0.3 m walking and 0.6 when the tick before was a server catch-up of two inputs, so the bar is the code's own guarantee, one tick at `extrapolateMaxMps`, 1.0 m, and the table shows what really happens), and `pop` (the largest change between frames of the drawn pose's error against the true path, rebuilt after the run from every snapshot received; limit a quarter of a tick of travel). The 150 ms link's bar moved from 0.4% held to 0.02%. 10 new unit tests (146 total): interpolation unchanged, the projection and its cap, a standing entity and a respawn held, a wall and the bounds, the ease's continuity and convergence, a hold's end eased, a placement popping, determinism of the whole track.
- `CLAUDE.md`: the interpolation bullet describes the projection and the ease and no longer ends "No extrapolation yet".

`npm run test:clock -- --seconds 30`, before (this branch with only the harness change) and after:

| link | delay mean / max (ms) | late frames | projected | held | ahead max (m) | pop max (m) |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms, before | 100.0 / 100.0 | 0.00% | | 0.00% | | 0.098 |
| 0 ms, after | 100.0 / 100.0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.001 |
| 50 ms, before | 101.2 / 106.7 | 0.05% | | 0.05% | | 0.039 |
| 50 ms, after | 105.7 / 106.9 | 0.05% | 0.05% | 0.00% | 0.012 | 0.001 |
| 150 ms, before | 157.9 / 165.3 | 0.76% | | 0.76% | | 0.488 |
| 150 ms, after | 165.1 / 175.1 | 0.00% | 0.00% | 0.00% | 0.000 | 0.001 |
| 150 ms, after, 60 s | 157.1 / 165.4 | 0.08% | 0.08% | 0.00% | 0.071 | 0.053 |

Before, every late frame was a held frame (the two columns are the same number) and the pop column is the hold ending. After, the 60 s row is the one where the projection fired: the drawn player ran 7 cm past the newest snapshot at most (a 12 ms guess) and the ease's first frame moved it 5 cm more than the true path did, against the 49 cm jump a hold's end made before. The pop limit (a quarter of a tick of travel) is for this link, whose lateness never passes the cap; a 200 ms TCP stall, the lab's loss row, ends with the ease walking 1.2 m back over a few frames, 18 cm in the first, which is a catch-up rather than a jump but would fail this bar, so the bar stays on the jitter link only. The 150 ms link's late share runs 0.27% to 0.76% from run to run (Sessions 14 and 23 saw 0.2% and 0.1%); the 30 s "after" run happened to see none, hence the 60 s row. The one baseline run with a 0.098 m pop on the clean link was a frame 16 ms late; the first baseline (same code, first version of the metric) had 0.00% late there.

`npm run check` (146 unit tests) and `npm run test:net` (placement, field, flooder, downs, Cleave, draught, the yard wall, 4-bot stress at 20.0 patches/s and tick 1.000 of wall time) green. Lab (`npm run lab -- --seconds 60`, the field level, two headless Chromiums at 48 fps on this box), with the critic's run on main this morning for comparison:

| link | corrections/min, critic / here | holds/min, critic / here |
| --- | --- | --- |
| 0 ms | 13 / 7 | 7 / 7 |
| 50 ms | 20 / 22 | 8 / 12 |
| 150 ms | 16 / 53 (main on this box, same hour: 51) | 4 / 3 |
| 50 ms, ±20 jitter, 2% loss | 52 / 26 | 43 / 32 |

The lab's hold is Bravo's drawn Alpha standing still for four or more samples while Alpha moved. The 0 and 50 ms conditions have no jitter and no late snapshot, so their holds are Bravo's page skipping frames at 48 fps headless (the sampler reads the same `__hg` until the next draw), which no drawing change can remove; they are the same here as on main. The loss row is where the network holds live: a lost segment stalls TCP for 200 ms, four ticks past the one-tick cap, so the projection covers the first tick of each stall and the hold count falls by a quarter rather than to nothing. That cap is the card's; raising it is a design question for Michael, not this session's. Corrections are Alpha's own reconciliation, which this change does not touch (draw-only); the 150 ms figure is this box's: main run here the same hour, same condition, gives 51 a minute and 4 holds, so the box (two browsers, the server and Vite on a small VM) is where the critic's 16 became 53, and the critic's tick-timing item under "Found in play" is the cause either way.

**Learned**

- The first pop metric (the drawn step beyond walking speed in a frame) read 0.1 m on a clean link with no late frames at all. That is the server, not the drawing: a tick that applies two queued inputs moves a player 0.6 m in 50 ms, and interpolating that tick draws 12 m/s for 50 ms. It is the critic's tick-timing finding seen from the other side and the harness cannot fix it, so the metric compares the drawn pose with the true path instead (every snapshot received, interpolated after the run), and a pop is the change in that error between frames. The server's catch-up ticks are then invisible to it and a hold ending is not.
- The 150 ms link's late share is a few events a run and swings fourfold between runs of the same code (0.00, 0.27, 0.76% here). A 30 s run proves the projection works when it fires and says little about how often; the 60 s row and the lab's daily run are the frequency numbers. A run of `npm run check` on the same box while the harness measured the clean link cost that link 11 ms of delay and a 67 ms late patch; the harness measures the box as Session 15 said.
- The ease folds the disagreement in at the arrival, not at the next frame, and compares the pose last handed out (offset included) with what the new buffer says for that same draw time, then replaces the offset rather than adding to it. That is what makes the drawn pose exactly continuous: at the draw time of the fold the new sample plus the new offset equals the old pose by construction. Adding would double count when two late snapshots arrive a frame apart.
- The projection uses the real wall collision rather than clamping to the last snapshot: `collideWalls` is two passes over the level's rectangles, cheap at ten entities and sixty frames, and it draws the one thing a player near a wall expects, the body stopping at the face. A clamp would have made the entity visibly stop a tick early at every wall on a bad link.

**Next**

- Reconnect with a grace period (the last Phase 0 Fable carry-over), then the two items under "Found in play" that share the input path: movement speed falling with frame rate, and corrections from tick timing.
- The lab's `holds/min` already reads the projected pose through `__hg`, so the critic's loss row (TCP stalls of 200 ms, 48 holds a minute before the adaptive delay) will show what the ease does at a hold's end: catching up 1.2 m over a few frames instead of a jump.

## 2026-10-05: Session 23, the adaptive delay merged with the Warrens groundwork

**What changed**

- `origin/main` (the Warrens groundwork, local Session 15: many enemies as an `Encounter`, walls in a `Level`, a snapshot buffer and a mesh per enemy) merged into `auto/fable-interp-budget` again, Michael's answer A of 2026-10-05. The producer counted one conflict (the devlog); there were four. `CLAUDE.md`: the adaptive interpolation bullet now says every enemy and names the per-enemy buffer, and main's `Level` bullet sits between it and the clock bullet. `client/src/net.ts`: both halves of the class comment (the delay from the window's longest wait; prediction inside the level). `client/src/main.ts`: main's `draw()` took `serverNow()` at the top and a literal `serverNow - 100` for every remote timer, the pattern Session 14 removed; the merged `draw()` takes `remoteNow()` once and the remote players' swing, dodge and Cleave flash and every enemy's windup and hit flash run at it, so four goblins are drawn at the adaptive delay like one was. `shared/src/sim.ts` and `server/src/rooms/DungeonRoom.ts` merged on their own: the `INTERP` block beside `ENEMY_KINDS` and `ROOM`, the step's wall time still taken after the patch leaves.
- Numbered 23 because the builder's branch already carries Sessions 16 to 22 (its Slack post of 2026-10-04); two Session 15 entries sit in this file already and a third pair would not help anyone reading it.
- On the merged tree: `npm run check` (77 unit tests), `npm run test:net` (placement, field, flooder, downs, Cleave, draught, the yard wall at x = 5.10, 4-bot stress at 20.0 patches/s and tick 1.000 of wall time) and `npm run test:clock -- --seconds 30`: 0 ms link delay 100.0 / 100.0 ms (mean / max), 0 holds; 50 ms 103.5 / 104.9, 0.1% held frames, 2 holds a minute; 150 ms 155.3 / 165.9, 0.1% held, 2 holds a minute; corrections and snaps 0 on all three. Session 15's run had 0 holds at 50 and 150 ms and Session 14's 6 a minute at 150; this is within that spread and well under the test's 0.4% bar.

**Learned**

- A "docs-only conflict" is what git reports, not what the merge needs: `main.ts` had no textual conflict in the enemies loop, and taking it as it came would have drawn every goblin a fixed 100 ms behind while the players next to them moved at the adaptive delay. The thing to check after any merge touching the client is that `remoteNow()` is still the only subtraction from `serverNow()` (`git grep -n 'serverNow - ' client/src` should find nothing).
- The builder's branch (`auto/build`, Sessions 16 to 22, PR #7) changes `sim.ts`, `net.ts` and `main.ts` again on top of main: a test merge of `auto/build` onto this merged tree conflicts only in the devlog, and its `draw()` keeps `remoteNow()` as the one remote clock, so that merge is a routine one. Whichever of PR #9 and PR #7 merges second needs one more merge of main; #9 is the smaller one, so landing it first costs the builder a routine merge and landing #7 first costs another Fable card.

**Next**

- Michael approves PR #9 and the producer merges it before PR #7; then extrapolation by up to one tick when a snapshot is late, then reconnect with a grace period.

## 2026-10-04: Session 15, the adaptive delay merged with builder Sessions 7 to 13

**What changed**

- `origin/main` (builder Sessions 7 to 13: downs, states, Cleave, the Revive Draught, the placement fix, the stress test) merged into `auto/fable-interp-budget`. Three conflicts, all keep-both: the `INTERP` block and the `STATES`, `COMBO` and `ABILITIES` blocks both added after `GOBLIN` in `shared/src/sim.ts`; the `interpDelayAt` and `isAlive`/`isDead` imports in `client/src/net.ts`; Sessions 13 and 14 both at the top of this file. No code was changed in the merge: `main.ts` merged on its own and already runs the remote swing, dodge, Cleave flash and goblin windup timers at `remoteNow()`, so the builder's Cleave is drawn at the adaptive delay like everything else remote.
- `npm run check` (62 unit tests), `npm run test:net` (placement, downs, Cleave, draught, 4-bot stress) and `npm run test:clock -- --seconds 30` green on the merged tree. The clock run: 0 ms link 100.0 / 100.0 ms delay, 0 holds; 50 ms 102.0 / 103.0, 0 holds; 150 ms 155.3 / 162.8, 0.0% held frames, 0 holds a minute. Same shape as Session 14's table (0.2% held at 150 ms then; the difference is the run, not the code).

**Learned**

- The first `test:clock` on this box failed hard on the 0 and 50 ms links (a patch 540 and 1324 ms late, the server tick at 0.97 of wall time, the clock snapping at 957 ms/s) and passed the 150 ms link that ran last. The VM was two minutes old and still compiling; the second run was clean. The test measures the box as much as the code, so a red clock run on a cold machine is a re-run first. The critic's lab has the same exposure.

**Next**

- Michael approves PR #9 and the producer merges it; then the extrapolation item (one tick when a snapshot is late), then reconnect with a grace period.

## 2026-10-04: Session 14, adaptive interpolation delay

**What changed**

- `INTERP` in `shared/src/sim.ts` (the tuning surface): `baseMs` 100, `maxMs` 200, `slewMsPerS` 10. Michael's answer C to the Session 6 question: 100 ms plus the measured jitter, capped at 200, slewed like the clock.
- `shared/src/clock.ts` estimates the delay from the window it already keeps. At every frame the newest patch is some way behind the clock, `now + offset - stamp`: the wait for the next patch so far. On a punctual link that peaks at one tick; a late patch makes it peak at a tick plus its lateness, and a remote player holds exactly when the wait exceeds the delay. Each patch sample remembers the longest wait a frame saw while it was the newest, the window's largest less the tick is `late`, and the delay target is `late` plus a tick within the bounds. The applied delay slews toward it at 10 ms/s and never jumps (the cap bounds the walk to ten seconds; the offset still snaps over 250 ms, the delay does not). `interpDelayAt` and `remoteTimeAt` are the entry points; `stepClock` slews both.
- `client/src/net.ts`: `INTERP_DELAY_MS` is gone. `remoteNow()` is server time less the delay, `remotePose` samples at it, and `draw()` in `main.ts` runs remote swing, dodge and windup timers at the same `remoteNow()` instead of the literal `serverNow - 100`, which the critic had flagged would run ahead of the bodies once the delay moved. `interpDelayMs` and `lateMs` are debug handles, on `window.__hg` as `interpDelay` and `late`.
- `server/src/rooms/DungeonRoom.ts`: the step's wall time is taken after the patch leaves, not when the step begins. A ping reply was stamped from the step's start while the patch it compares with left at its end, so on a busy box pings beat patches by the step's own duration and the clock sat 5 ms ahead of anything a snapshot could deliver (`vs floor max` 5.0 in the first run here, 0.2 after). The server is otherwise unchanged.
- `tests/clock-sync.ts` reads the live delay, reports the worst lateness the frames saw and the delay's mean and max, and fails if the clean link pays more than the base, the 150 ms link holds more than 0.4% of frames (a third of the fixed delay's), or the delay passes the cap. 5 new unit tests (32 total): base on a link up to 50 ms late, following the longest wait and ageing out through the slew, the slew surviving an offset snap, a client stall not reading as lateness, and the 150 ms simulation where the fixed base holds and the adaptive delay does not.
- `CLAUDE.md`: the interpolation line describes the adaptive delay and names `remoteNow()` as the one place a delay is subtracted.

`npm run test:clock -- --seconds 30`, before (fixed 100 ms, this branch before the change) and after:

| link | delay mean / max (ms) | worst lateness seen (ms) | held frames | holds/min |
| --- | --- | --- | --- | --- |
| 0 ms, before | 100 / 100 | | 0.0% | 0 |
| 0 ms, after | 100.0 / 100.0 | 31 | 0.0% | 0 |
| 50 ms, before | 100 / 100 | | 0.2% | 6 |
| 50 ms, after | 101.3 / 101.9 | 52 | 0.0% | 0 |
| 150 ms, before | 100 / 100 | | 1.6% | 14 |
| 150 ms, after | 145.4 / 158.3 | 108 | 0.2% | 6 |

The clock numbers (wander, drift, position against the floor) and the driven player's corrections and snaps did not change. `npm run test:net` green.

**Learned**

- The first version measured lateness at arrival: the worst sample's distance below the target in the window. It gave 0 holds at 150 ms with the delay at 167 to 179 ms, and the clean link paid 117 ms, because the window had caught the connection's startup burst, patches 80 ms "late" while the client was still joining. In a browser that is every page load: 20 s at the cap while the scene builds. Measuring the wait at the frames that actually ran is immune to it, and to a background tab or a long GC pause: nothing was drawn while the client stalled, and the patches it missed are handled before its next frame (there is a unit test for exactly that).
- Measured against the applied offset the budget came out short: 133 ms mean at 150 ms and 0.8% held, because the offset sags 13 ms below the floor on average while the best sample ages out. Against the floor (the target, or the offset when that is the later) it is 145 ms and 0.2%.
- What is left at 150 ms is the measure being reactive: the first spike after the previous one has left the window holds for a frame or two before the delay has risen to cover it, and the climb from 100 to 180 takes 8 s at 10 ms/s. A guard of one frame above the measured wait, or a faster rise than fall, would take some of those at the cost of 15 to 20 ms on the 50 ms link; the extrapolation item (next) covers a late snapshot by up to a tick and is the designed answer. Not done here, since C says what it says.
- The clock slews at 10 ms/s and so does the delay; when both move the same way the drawn remote runs up to 2% off speed for a few seconds. Nobody saw it in the lab; if someone does, a shared budget is the fix.

**Next**

- Extrapolate remote players by up to one tick when a snapshot is late, then reconnect with a grace period.
- The critic's lab can read `__hg.interpDelay`; its loss row (TCP stalls of 200 ms, 48 holds a minute) should now draw at the cap and hold far less.

## 2026-10-05: Session 22, the Goblin Warrens floor

**What changed**

- `WARRENS` in `shared/src/level.ts`, now the default level (`?level=yard` keeps the yard): an entry hall where the party spawns, with the stairs at its centre, and three rooms off it through 3 m doorways. North-west the guard room (two goblins and a Shieldbearer), through it the den (a Charger watching the door from the far side and a goblin), south the pens (the Pack Leader with two goblins in its rally and one just outside it). Pillars in the den and the pens for cover and for baiting the Charger.
- Rooms (`Level.rooms`, `roomAt`): every enemy belongs to the room it spawned in. When a room's last enemy falls the room is clear ("The guard room: clear"): the downed stand up and the dead come back, as a whole-level clear did before. A level without rooms is one room, so the field and the yard behave as they did.
- Michael's objective (A, 2026-10-04): when every room is clear the stairs open (`Level.stairs`, `STAIRS`): the dais lights up and the HUD says "Stairs open: everyone onto them". Every standing player within 2.5 m of the stairs for 2 s takes the party down (`stepStairs`); the dead do not hold it up. Until a second floor exists, going down starts this floor again: every enemy back at its post, the stairs shut, a draught each, `floor` counting up ("Down the stairs: floor 2"). The stairs sit where the party spawns, so going down moves nobody and the client has nothing to reconcile. Levels without stairs keep `ROOM.resetMs`.
- Enemies need a line of sight to wake (`lineClear`, as Session 15 left for this item): each room sleeps until someone walks in, and an idle enemy behind a wall stays idle. Two Session 15 tests assumed goblins woke through a wall; one now checks both sides of that, the other starts its goblins awake.
- Server: `stairsOpen`, `descendMs` and `floor` in the room state. Client: the stairs built once with the walls and lit while open, brighter as the party's hold fills.
- Tests: 7 in `shared/src/warrens.test.ts` (130 in all): the layout (every enemy in a room, the spawns and stairs in the hall, nothing in a wall), the doorways, every room asleep while the party waits, rooms clearing one by one with the stairs shut until the last, the descent and its refill, the dead not holding it, the yard still on its timer. `npm run test:net` adds a Warrens room (nine enemies asleep, stairs shut, floor 1); the yard and stress steps now ask for the yard by name. `tests/hit-feedback.e2e.ts` joins `?level=yard`, since it walks to the yard's first goblin. e2e mobile and hit feedback 5 of 5.

**Learned**

- Putting the stairs in the spawn hall is what keeps the descent free of netcode: a floor change that moved players would be a teleport, which reconcile counts as a snap unless the client is told it is a placement (Session 12's rule). When a real second floor arrives with its own layout, that placement flag is the work to do, and it is a client netcode change.
- For the critic: the lag lab joins the default level, now the Warrens hall where nothing wakes, so its corrections will fall for a reason unrelated to the network. `level=yard` in its page URL keeps its numbers comparable; the lab is the critic's, so this run left it alone.

**Next**

- Nothing else in Phase 1 is the builder's until Michael answers how a player picks a weapon (decisions.md). Then the rest of the weapon classes, Arrow rain and Magic missile.
- The gate (a mixed-level party clears a Warrens floor, the combo bonus visible) is playable once the weapon pick lands, and the combo bonus has nothing on screen yet beyond the log: worth a look before the playtest.

## 2026-10-05: Session 21, the Pack Leader

**What changed**

- The Pack Leader (`PACK_LEADER` in `sim.ts`), designed in The Old Gates ("buffs nearby enemies") and never built there: a goblin chief with a red banner, 90 hp. Every other living enemy within 7 m of it is rallied: 25% quicker and a third harder (a goblin's 15 becomes 20), tinted war-paint red. While it has a rallied pack it hangs back 5 m from its target instead of closing in; alone, it fights like a goblin. Kill it and the pack is ordinary goblins on the next tick. Leaders do not rally each other.
- `updateRallies` runs at the start of `stepEnemies`, from where everyone stood when the tick began, so the order enemies step in cannot change who is rallied. `rallied` is in the enemy schema for the tint and the HUD ("Goblin, 6 of 7 left, rallied").
- The yard has one at (-15, -13), behind the south-west goblin, which it rallies from the start: the first goblin pack. The yard now holds four goblins, a Shieldbearer, a Charger and a Pack Leader.
- Tests: 4 more in `shared/src/roster.test.ts` (123 in all): who is rallied and only while the leader lives, a rallied goblin's speed and blow, the hang-back and the charge-in once alone, the yard's leader starting with its goblin. `npm run test:net` green (seven enemies in the yard, 4-bot stress at 20.0 patches/s); e2e mobile and hit feedback 5 of 5.

**Learned**

- The three new kinds each ask a different thing of a party: the Shieldbearer a hold and a flank, the Charger reading a lane, the Pack Leader reaching the back line. None is a bigger health bar, which is the design doc's rule for tiers too.
- Goblin packs are placement: a leader and the goblins in its reach. The floor item places them room by room; nothing more is needed in the sim.

**Next**

- The Goblin Warrens floor: rooms as a `Level`, clear every room (Michael's A), stairs in place of `ROOM.resetMs`, packs and the new kinds placed by room.
- Michael's answer on picking a weapon unblocks the rest of the weapon classes, then Arrow rain and Magic missile.

## 2026-10-05: Session 20, the Charger

**What changed**

- The Charger (`CHARGER` in `sim.ts`), designed in The Old Gates and never built there; its charge is the lair beast's (every 7 s, from 5 to 16 units, four times its speed, double damage, a three-unit throw) on a brown brute with 80 hp. When a player is 5 to 14 m away with a clear line and the charge is ready, it plants for 900 ms with a red lane on the ground (`aim`), then runs straight down the lane at 12 m/s (`charge`) for up to 14 m. The first standing player it meets takes 30 (blocked or parried like any blow) and is thrown 3 m along the lane; a dodge goes through it; a wall stops it dead and stuns it for 2 s (Staggered, so the combos pay). Up close it swings like a goblin. Cleave breaks the aim or the run like a windup.
- The throw is a slide, not a teleport (`KNOCKBACK`, `PlayerSim.knockUntil/knockDx/knockDz`): `applyInput` moves a thrown player at 12 m/s for the five ticks after the blow and ignores their input, and the state is in the schema, so the client rewinds to it and replays it like a dodge. The patch that brings a throw is a smoothed correction (the client could not have known), never a snap, and the next patch agrees with the replay; `tests/reconcile-placement.ts` proves both.
- `strikePlayer` takes the blow's size, so the charge goes through the same parry, block and posture rules as a swing.
- The yard has one in the south-east corner (14, -15), open ground in front of it. Client: the Charger's mesh and its lane are built once; the log says "The charger ran you down" and "The charger hit the wall: stunned".
- Tests: 8 more in `shared/src/roster.test.ts` (119 in all): aim and the fixed lane, the run and the 3 m throw with no actions during it, a dodge through, a parry, a wall stun, the cooldown, the swing up close and the line-of-sight wait, Cleave breaking the aim, prediction parity for a slide. `npm run test:net` green (the yard step reads the level's list, now six); e2e mobile and hit feedback 5 of 5.

**Learned**

- The slide runs on the ticks after the blow, because inputs are applied before hits resolve in a tick; a 250 ms window gave four ticks (2.4 m). `KNOCKBACK.ms` is 300 for the 3 m. Anything else that moves a player from the server (a pull, a shove) should reuse this state rather than set a position.
- A Charger aimed at a group hits whoever is first in the lane, sorted along the lane with ids breaking ties, so the server and a replay agree on the victim.

**Next**

- The Pack Leader (buffs goblins near it), then goblin packs placed by the floor item.

## 2026-10-05: Session 19, the Shieldbearer

**What changed**

- The first new kind in the roster, lifted from The Old Gates' enemy table (`SHIELDBEARER` in `sim.ts`): a tall grey figure behind a plank shield. Hits on its front half do 35% while the shield is up (`EnemyDef.frontGuard`, `shieldCovers`), sword and bow alike. The Old Gates' two answers both work: Cleave on the shield (the power attack) breaks the guard outright, staggering it for 1.5 s with the shield down so follow-ups land in full; or go round it, since the shield covers only the front half and turns to face its target, so in a party one player holds it while another hits its back. Any posture break drops the shield (Session 18's posture), and it comes back up when the stagger ends, so a long fight means breaking it again.
- Numbers are The Old Gates' ratios on Hearthgate's goblin: 100 hp (48 to the goblin's 28 there), 2.0 m/s, 20 a blow, an 800 ms tell and 700 ms recovery (slower to read than the goblin's 650), aggro at 10 m so it waits until someone walks up.
- The yard has one, at (0, 15) facing the start, 12 m north of the spawns, out of aggro at join.
- Server and client: `guardUp` in the enemy schema; the renderer builds the shield once per Shieldbearer and hides it while the guard is broken; the HUD label reads "Shieldbearer, 5 of 5 left, shield up"; the log says "You hit the shieldbearer's shield for 7".
- Tests: 8 in `shared/src/roster.test.ts` (111 in all): shield up at spawn, 35% on the front, full from the side and behind, Cleave breaks it and follow-ups land in full, it comes back after the stagger and on a reset, posture damage through the shield drops it, it covers the front half as it turns, the yard spawn is clear of walls. `npm run test:net`: the yard step now checks the level's own enemy list arrives with the Shieldbearer's shield up. e2e: mobile and hit feedback 5 of 5.

**Learned**

- The Shieldbearer is the first enemy that asks for two players (hold and flank) rather than one player doing more damage, which is the design doc's whole point about mixed-level parties; the Charger and the Pack Leader should be judged by the same test.
- Facing the target every chase tick is what makes the flank a co-op move: a lone player circling it is always in front. If playtests find it too hard alone, a slower turn rate is the knob, not a smaller shield.

**Next**

- The Charger (rush plus knockback; The Old Gates' lair-beast charge is the closest built mechanic) and the Pack Leader (buffs goblins nearby), then goblin packs placed by the floor.

## 2026-10-05: Session 18, block, parry and posture

**What changed**

- Block, from The Old Gates' `executeStrike` and parry window, simplified for crowds. Hold L or Q (LT on a gamepad; held, not a press) and the guard goes up: a plate across the front of the character, half walking speed without turning, no swing or ability until you let go, and a dodge drops it. A blow from the front half is cut by the weapon's `blockReduce` (a goblin's 15 becomes 10 with a sword, 8 with a two-hander); from behind it lands in full. `InputFrame` gains an optional `block` (absent means no; `isValidInput` rejects a non-boolean).
- Parry: a blow that lands within 300 ms of raising the guard (`GUARD.parryWindowMs`; The Old Gates' 200 ms, made more generous for crowds as the design doc asks) does nothing to you, staggers the goblin (the Staggered state, so it feeds the combos), drains 40% of its posture and holds it in recovery for 1.2 s. Holding the guard up and waiting is a block, not a parry.
- Posture (`POSTURE` in `sim.ts`). The player has 100: an unblocked blow drains its damage x1.5, a blocked one x1, a parry nothing. Empty, you are off balance for 0.8 s (no move, swing, guard or dodge; rocked back on screen), then the bar is full. A goblin has half its health (30): a weapon hit drains 8 times the weapon's `postureMult` (sword 4 hits, War Hammer 2), Cleave 25, a parry 12; empty, it is staggered and in recovery for 1.5 s, which breaks a windup in progress. Both refill 5 a second after 1.5 s without a blow (`stepPosture`, in `stepEncounter`).
- The guard is predicted like a dodge: `guarding` and `blockSince` are in the schema and the client rewinds and replays them; posture and the stagger come from the server. A starved tick no longer lowers a held guard: the server's fill frame carries `block: p.guarding`, because raising it again on the next frame would hand out a fresh parry window nobody timed. Without that line the guard dropped on every late frame (`test:net` fails on it).
- HUD: "Posture 85 / 100, guard up" (or "off balance") under the health bar; the nearest enemy's label adds "off balance" while its posture is broken; the log says "You parried the goblin: staggered", "The goblin hit your guard for 10", "You are knocked off balance", "The goblin is off balance: hit it now". The controls hint lists the block key and LT.
- Tests: 12 in `shared/src/guard.test.ts` (103 in all): input validation; raise once, shuffle, no swing; a dodge drops it; parry; block; a Claymore blocks more; the back is open; a posture break and recovery; sword and War Hammer breaking a goblin; Cleave's drain; regen; prediction parity. `npm run test:net` adds a guard step: held, a three-tick gap, held again, the window unchanged, Bravo sees it, release lowers it. `tests/mobile.e2e.ts` 4 of 4 with the longer hint (run with `PW_CHROMIUM=/opt/pw-browsers/chromium` in the cloud).

**Learned**

- Holding a guard across a gap in the inputs is the same problem as the critic's frame-rate bug in a smaller form: the server fills a missed tick with a neutral frame, and anything held (movement today, now the guard) is lost for that tick. For the guard the fill keeps it; movement is still the Fable item's.
- A frozen tab keeps its guard up until its inputs resume or it leaves. That is the right side to err on (a stuck guard costs the player speed, not the party a fight).
- The backstab, riposte and finisher multipliers from the same Old Gates files are not in: backstab is already a state consumer (Staggered, design doc) waiting on an ability that tags "backstab", and the riposte would be a second bonus on the same opening. A playtest should say whether the parry's stagger is reward enough first.

**Next**

- Michael's answer on picking a weapon unblocks the rest of the weapon classes and then Arrow rain.
- The enemy roster (Shieldbearer, Charger, Pack Leader) is the next builder item; the Shieldbearer's frontal block can reuse `GUARD.arc` and break on posture.

## 2026-10-05: Session 17, weapon classes in the shared sim

**What changed**

- Every `PlayerSim` holds a `weapon` (a `Gear` from Session 16; the Wooden Sword to start), and the swing comes from its class (`WEAPON_CLASSES` in `sim.ts`, `weaponClassOf` in `gear.ts`). One-handers keep the Phase 0 sword's numbers exactly (2.4 m, 108 degrees, 150 ms windup, 450 ms committed). Two-handers wind up 300 ms, commit 750 ms, reach 2.9 m over 135 degrees, and hit up to the weapon's `cleaveTargets` nearest in the cone (Claymore 3, Great Axe 2, War Hammer and Great Club 1). The bow locks on to the nearest enemy it can see in a 63 degree cone out to 12 m (`lineClear` against the level's walls, its first use) and the hit lands when the 350 ms draw ends; no projectile yet.
- Damage is `weaponStats(weapon, level.tier)`: `Level` gains an optional portal `tier` (1 when absent, as in both levels today), `resolvePlayerAttacks` takes the level, and `stepEncounter` passes the room's. A weapon hit is tagged with the weapon's style (melee or ranged) for the states.
- Nothing changes in play: everyone holds the sword, server and client both build players with `createPlayer`, so prediction and truth agree, and the schema is untouched. How a player picks another weapon is a question for Michael (decisions.md, Pending; A, a pick on the join screen, recommended).
- Tests: 8 in `shared/src/weapons.test.ts` (91 in all): the starter sword swings as before, classes by type, a Claymore hits the three nearest of four, War Hammer one and Great Axe two, the bow hits at 10 m and not 45 degrees off, a wall hides a goblin from the bow, the room's tier caps a Mithril sword through `stepEncounter` (27 at tier 1, 54 at tier 3), and prediction parity for a two-hander. `npm run test:net` green (placement, downs, Cleave, draught, yard wall, 4-bot stress at 20.0 patches/s).

**Learned**

- `sim.ts` and `gear.ts` import each other (gear reads `GEAR`, sim reads the weapon helpers). It is safe because neither touches the other's exports at load time, only inside functions; keep it that way or move `GEAR` across.
- The bow's lock-on is the soft auto-target with a narrower, longer cone plus line of sight. The design doc's lock-on *cycle* (a key to switch targets) and *charge timing* are left for when the bow is in someone's hands and can be felt.

**Next**

- After Michael's answer on picking a weapon: sync `weapon` in the schema, the pick itself, a mesh per class in `render.ts`, the bow's lock-on marker and target cycle, and Arrow rain in the bow's slot 1. The staff (Magic) is not in The Old Gates and needs defining with Magic missile.
- Posture, parry and block is the next builder item that does not wait on the answer.

## 2026-10-05: Session 16, gear and weapon definitions from The Old Gates

**What changed**

- `shared/src/gear.ts`: the lift of `docs/reference/old-gates/14-items.js`. Kept unchanged: the ten materials (Wooden to Cosmic, with the blade colour and the glow from Mithril up), the eleven weapon types with their attack multipliers and the two-hander fields (`twoHand`, `cleaveTargets`, `postureMult`, `blockReduce`), the eight armour types, and the per-tier attack, defence and shield-block curves. Each weapon type gains a `style` (every melee weapon Melee, the bow Ranged; the staff is not in The Old Gates and comes with the weapon classes item). Four weapon enchants (Flames, Frost, Shock, Life Drain) as data; Fatigue, Soul Tap and the armour enchants stayed behind because Hearthgate has no stamina, mana or attributes. Also left behind on purpose: weight and encumbrance, attribute requirements, prices and drop weights (the economy is Phase 3).
- A piece of gear is a plain description (`Gear`: kind, type, material tier, enchant) and its numbers are always derived for a portal tier (`weaponStats`, `armorStats`), so no caller can hold stats that forgot the cap. Nothing here creates or moves an item (rule 3); it only says what one is worth.
- The re-tune, in `GEAR` in `sim.ts`: a portal of tier T lets gear perform up to material tier 2T (ten materials over five portal tiers), and Old Gates attack times 3 is Hearthgate damage, which makes the starter Wooden Sword hit for exactly 20, today's `PLAYER.attackDamage`. Hits are fixed, not rolled: a weapon at or under the cap hits for the middle of its range, a capped one for the top of the capped tier's range. So a Mithril sword in a tier-1 portal hits for 27, a native Bronze sword for 25, an Iron sword in a tier-2 portal for 32: "a strong tier-1 sword", better, never the next tier, and it keeps its enchant.
- Nothing in combat reads it yet: the weapon classes item puts the weapon in the player's hand and the swing.
- Tests: 11 in `shared/src/gear.test.ts` (83 in all): the tables kept, the starter sword equals today's damage, the cap mapping, a capped weapon between native and next tier, the enchant survives the cap, damage rises with tier for every type, style and two-hander fields, armour and shield caps, names, clamping, purity. The code went up in one commit and these docs in the next (a script error split them).

**Learned**

- The Old Gates rolls damage in a range with `Math.random()` on every hit; rule 2 would need a seeded stream for that, and Hearthgate's hits have always been fixed numbers. The midpoint keeps the starter sword at 20 and gives the cap a natural meaning (the top of the range), so no RNG was needed.
- The design doc's "tier-5 sword in a tier-1 portal" uses one scale for gear and portals; The Old Gates has ten materials and Hearthgate five portal tiers. Two materials a portal tier is the number to revisit in playtests (`GEAR.materialsPerPortalTier`).

**Next**

- Weapon classes: put a `Gear` weapon on `PlayerSim`, take damage, reach and swing time from it, add the two-handers' cleave cap and the bow with lock-on, and slots by style.

## 2026-10-04: Session 15 (Fable, local), many enemies and walls, and the Old Gates reference

**What changed**

- Michael's local session, started because the game still looked like the Phase 0 spike: Phase 1 had twelve builder sessions behind it but the four items that lift The Old Gates were blocked (the cloud builder is refused that repo even after his answer A), and the Warrens groundwork he assigned to Fable had no session yet. Both are done here.
- `shared/src/level.ts`: a `Level` is bounds, walls as axis-aligned rectangles and enemy spawns. `collideWalls` keeps a circle inside the bounds and out of the walls (push out along the nearest point; a centre that lands inside a wall leaves by the nearest face; two passes so corners settle), and both sides run it: `applyInput` takes the level, the client passes `net.level` to prediction and replay. `lineClear` (segment against the walls) is there for the floor item's aggro and ranged attacks; nothing uses it yet. Two levels: `field` (the Phase 0 arena, one goblin; the unit tests and the smoke test's downs steps assume it) and `yard` (the default: five ruined walls and four goblins spread so a lone player meets one or two at a time).
- `sim.ts`: enemies are an `Encounter` of keyed `EnemySim`s (`e1`..), each with a `kind` from `ENEMY_KINDS` (`EnemyDef`: hp, speed, reach, telegraph), a `maxHp` and a spawn. The sword hits the nearest living enemy in its cone (`enemiesInCone`, soft auto-targeting from the design doc); Cleave hits every enemy in its wider cone. Enemies no longer respawn one by one: a dead one stays dead, the last kill is `roomCleared` (the downed stand up, the dead come back, as before), and `ROOM.resetMs` (6 s) later `roomReset` puts them all back, the stand-in for stairs. `separateEnemies` keeps living enemies out of each other (pairs in id order, half the overlap each, then back out of the walls). `stepEncounter` is the server's one call per tick. Events carry `enemyId`.
- Server: `EnemyState` gains `id`, `kind`, `maxHp`; the state has an `enemies` map and a `levelId`; `onCreate` takes a `level` option (tests use `field`). Client: `net.enemies` with a snapshot buffer per enemy, `net.level`, `nearestEnemy`; the renderer builds the level's walls once (waist-high ruins, taller pillars) and one mesh per enemy; the HUD shows the nearest enemy's bar and "Goblin, 3 of 4 left"; the log names the enemy and says "Room clear" and "The goblins are back". `?level=field` joins a field room.
- `docs/reference/old-gates/`: copies of `10-player.js`, `14-items.js`, `62-actions.js`, `74-strikes.js` and the enemy tables, with a README mapping each to its Phase 1 item and noting that only the Shieldbearer exists in The Old Gates code; Charger and Pack Leader were designed there and never built. The four lift items lose their (design) mark and name their source files. The roster item notes the groundwork is in.
- The remote playtest, by machine: Michael dropped the "friend on another network" item (no such friend; it would stay a blocker), so the critic's lag lab gained `--server` and `--client`: no local server, no proxy, no Vite, two real Chromium pages on this desktop against the hosted Render build over the public internet. Five minutes at main c064e1a: 19 ms round trip, 1 correction (0.2 a minute), 0 snaps, 0 holds, Bravo drew Alpha 105 ms behind with a 0.45 m mean gap, verdict ok. Filed in `docs/playtest-notes.md`; both Phase 0 (Michael) items and the lag-lab item are checked.
- Tests: 15 new unit tests in `level.test.ts` (a wall stops and slides, a dodge cannot pass one, a circle inside a wall leaves by the nearest face, prediction parity through walls, line of sight, the yard keeps every spawn clear; chase, separation, sliding along a wall, room clear and reset, sword versus Cleave targeting, wipe, determinism), 65 in all. `npm run test:net` runs its downs and Cleave steps on the field (as written for one goblin), then a yard room: four goblins reach the client and the server holds a client walking east from (-3, 3) at x = 5.10, the wall's face less the radius; stress runs in the yard. e2e: 5 pass; `two-players.e2e.ts` fails as it has since Session 4 (the critic's frame-rate bug: 0.9 m in 700 ms headless), not from this change.

**Learned**

- The Old Gates has no Charger or Pack Leader in code (devlog there: designed in the Session 5 monster ladder, only the Shieldbearer shipped). The design doc's "reuse" for those two is a reuse of the design, which is why the roster item now says so.
- With four goblins the old smoke test's downs step is not a fair test any more (two goblins down the rescuer before the 1.5 s pickup finishes), so that step keeps the one-goblin field and the yard gets its own step. A test that depends on a tuning number should pin the level it assumes.
- Enemy order matters for determinism in separation: iterate pairs in id order, not Map order, or a server that rebuilt its map would part a crowd differently.

**Next**

- The builder: gear, weapon classes, posture and parry, the roster, then the Warrens floor as a `Level` with rooms (walls with gaps), the clear-every-room objective and stairs in place of `ROOM.resetMs`.
- Fable: extrapolation, reconnect, the frame-rate input bug (the critic's), and PR #9's conflicts with main.
- Interest management stays out until a floor has more enemies than a patch comfortably carries; measure first.

## 2026-10-04: Session 13, the Revive Draught

**What changed**

- Michael answered the four Phase 1 questions on the control room (all A). The Revive Draught is built to his choice: a plain counter in the sim, not an item, which the Phase 3 ledger replaces (rule 3 stays whole: nothing here creates or moves an item). Every player has one (`DOWNS.draughtsPerFloor`). A standing player presses E, or LB on a gamepad, next to a dead teammate's body (within 2.5 m, centre to centre) and they stand where they lie at 50 hp (`draughtHp`, more than a pickup's 40 because the draught is the scarce one). It only works on the dead: the downed have the free pickup, and the dead already on a respawn timer (room cleared, squad wiped) are coming back anyway. Nothing to target, or no draught left, spends nothing.
- Floors do not exist yet, so a wipe, which the design doc makes the end of the run, refills everyone. The floor item moves the refill to the floor's start.
- `shared/src/sim.ts`: `InputFrame` gains an optional `use` (absent means no, so older frames and the bot harness stay valid; `isValidInput` rejects a non-boolean), `PlayerSim.draughts`, `useDraught()` and the `playerRevived` event. The draught changes another player, so it is not in `applyInput`: the server collects this tick's presses after every player's inputs and resolves them before the attacks, and the client does not predict it.
- Server: the schema carries `draughts`. Client: the top-left panel shows "Revive Draughts: 1", and turns into "E or LB: revive Bram (1 draught)" when a body is in reach; the controls hint lists E and LB; the log says "Orla brought Bram back with a draught"; the dead player's banner says a friend's draught can bring them back.
- Tests: 7 unit tests in `shared/src/draught.test.ts` (57 total): the input flag, the revive where the body lies, out of reach, the downed and the respawning are not targets, one a floor, nearest body first and the dead cannot use one, the wipe refill. `npm run test:net` sends five draught presses with nobody dead and checks they are applied, spend nothing, and both clients see the count. `tests/mobile.e2e.ts` checks the count renders in the top-left panel on all four viewports; 5 of 5 e2e pass (mobile and hit feedback).

**Learned**

- `test:net` cannot cheaply reach a real revive: a bleed-out is 30 s. The sim tests carry the revive and the net test carries the wire and the schema; if that gap ever matters, a test-only room option for a short bleed-out would close it.
- Michael's Old Gates answer (A) did not unblock this run: the clone is still refused by the run's own permission check. It needs the repository added to the routine's sources, which only Michael can do.

**Next**

- Nothing else in Phase 1 is the builder's today: the four Old Gates items wait on that access, Arrow rain and Magic missile wait on the weapon classes, the Warrens groundwork is now a **(Fable)** item ahead of the floor, and the critic's frame-rate bug is likely **(Fable)**.
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
