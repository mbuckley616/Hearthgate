# Devlog

Newest entry first. One entry per session: what changed, what was learned, what is next.

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
