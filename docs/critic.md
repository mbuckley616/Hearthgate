# Critic reports

## 2026-10-04 — lag lab built; two clients through the fight, downs, wipe and a closed tab (session 10, commit f415a88)

First run. Played `auto/build` at f415a88 (main plus Sessions 7 to 10: downs, states, stress test, Cleave), headless Chromium, two pages each in its own browser. `npm run check` 50/50, `npm run test:net` green including the 4-bot stress run (20.0 patches/s, worst gap 52 ms). Report committed from main's line (f1c86f8).

**The lag lab** (`npm run lab`, 4 min 24 s). Built this run in `tests/lab/`: a TCP proxy (delay, jitter, loss as TCP retransmits after a 200 ms RTO with head-of-line blocking, seeded) in front of a server on a spare port, the Vite dev server, and two real clients. Alpha plays a seeded 60 s of held keys, swings, dodges and Cleave; Bravo watches and walks over if Alpha goes down. Corrections come from Alpha's HUD text, snaps from `__hg.snaps` with respawn teleports split out, holds and view lag from per-frame tracks of both pages.

| link (one-way) | corrections/min | snaps | holds/min (Bravo's view) | view lag | HUD ping | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 7 | 0 | 1 | 95 ms | 11 ms | ok |
| 50 ms | 0 | 0 | 7 | 205 ms | 110 ms | ok |
| 150 ms | 6 | 0 | 1 | 405 ms | 320 ms | ok |
| 50 ms, ±20 jitter, 2% loss | 36 | 0 | 48 | 195 ms | 152 ms | rough |

Run to run, corrections at 0 to 150 ms moved between 0 and 15 a minute over three runs; never a network snap. A solo probe on a clean link (10 each of taps, swings, standing and moving dodges, Cleave) gave 0 corrections, so the few left come from bodies touching (the goblin, the other player), which prediction does not model. That is fine. View lag is the 100 ms budget plus the two one-way trips, as designed. The loss row is the one that hurts: a lost segment stalls TCP for 200 ms, more than the ~50 ms a snapshot can be late, so Bravo's Alpha freezes about 48 times a minute (96 retransmits in 60 s). The adaptive budget Michael chose (C, capped at 200 ms) will not fully cover a 200 ms stall plus jitter; extrapolation is what remains for it. Real links rarely lose 2%, but hotel and mobile wifi do.

Lab caveat worth knowing: this sandbox renders WebGL in software. At the default 1280 x 720 two pages draw at 7 fps, which starves the input timer, so the lab runs pages at 320 x 200 (58 fps) to measure the network and not the GPU. That caveat turned into the main finding below.

**What I played** (0 ms, 640 x 400). Both join at (-3, 3) and (3, 3) and see each other's moves exactly (Bravo drew Alpha at the same x to the centimetre after a stop). Both walk to the goblin's post at (9, -9); in 15 s Alpha landed 6 hits, Bravo 1, the goblin fell, both pages agreed on its hp throughout. Alpha dodged at the start of each windup (6 of 6) and still took 4 hits: the dodge is 220 ms and the windup 650 ms, so a dodge at the telegraph's start is over before the swing. That is the design working (dodge late, not early), not a bug. Bravo idled by the goblin and went down in 8.2 s with the banner "Down. Bleeding out in 30. Crawl to a friend"; Alpha, standing still, went down 9.8 s later, the squad wiped and both were back at their spawns with 100 hp 2.9 s after, goblin reset to 60. After a second kill Alpha closed the tab mid-fight: within 1.5 s Bravo showed "1 in the party", the goblin turned to Bravo and Bravo fought on alone (13 hits). No page errors in any run. Console noise only: a 404 for a missing resource (likely the favicon) and SwiftShader's ReadPixels stall warnings.

**Problems**

1. *Movement speed falls with frame rate.* Hold A for 1.5 s and the player should cover 9.0 m. Measured, one page: 9.3 m at 60 fps, 5.7 m at 21 fps; two pages in one browser: 2.1 m at 10 fps, 1.8 m at 7 fps. Inputs reached the server at 19.7, 13.0, 4.9 and 3.6 a second. The input loop sends one frame per `setInterval` callback, each frame is 50 ms of movement, and when the main thread is busy drawing the timer fires late and missed ticks are simply lost. A slow laptop or a busy tab walks slower than everyone else, and the netcode cannot see it, because the server is right about the inputs it got. This is also the root cause of `tests/two-players.e2e.ts` failing since Session 4 (Alpha moves 0.6 m, not 2): it is render cost under software WebGL, not background-tab throttling. With the same test at a 320 x 200 viewport it passes (5.5 s); with throttling flags alone it still fails. Steps: `tests/tmp/speed.mts` in this run; by hand, open two tabs side by side on a weak machine and hold a key in one. Filed in the backlog; a proposal follows.
2. *The controls hint covers the ability slots between 601 and about 750 px wide.* The hint (bottom left, 14..551 px) is hidden under 600 px and clears the slots from about 750 px, but in between it lies over slots 1 and 2: 109 px of overlap at 640 x 400. That band is phone landscape (640 x 360, 667 x 375, 732 x 412). `tests/mobile.e2e.ts` checks the slots against the top panels only. Screenshot: `docs/critic/2026-10-04-hint-over-slots-640px.png`. Steps: open the client at 640 x 400.
3. *Respawns and wipes count as snaps and corrections.* After a wipe, `__hg.snaps` rose by 1 to 2 on each page and the HUD corrections by 1, with no network in the loop: the server moved the player to their spawn and `reconcile` counts any jump over 2.5 m. Small, but the HUD number is what Michael records in playtests and what the lab reports, so a fight that wipes twice reads like a bad connection. The lab now splits these out by hand. Steps: two pages, let the goblin down both, read `__hg.snaps` before and after the respawn.

Not filed, for the Fable session's interpolation-budget card: `client/src/main.ts` `draw()` computes the remote players' and the goblin's swing, dodge, downed and windup flags at `serverNow - 100`, a literal, while their poses come from `remotePose` at `INTERP_DELAY_MS`. Identical today; once the budget adapts (decision C), the flags will run ahead of the bodies by up to 100 ms unless both use the same value.

The downed banner sits across the middle of the screen over the downed player at 640 x 400 (`docs/critic/2026-10-04-downed-banner.png`); readable, but it hides the character and the goblin next to them. A human should say whether it matters.

**What worked.** Prediction on a clean link is exact; zero snaps from the network in any condition; the clock holds the view lag at budget plus trip time to within 5 ms across 0, 50 and 150 ms; a closed tab leaves nothing behind; downs, pickup banner, wipe and respawn all behave as Session 7 describes; the goblin never stuck in what I saw (I cannot read its position from `__hg`, only its phase and hp).

**Hosted build.** Not reachable from this sandbox: the health URL (https://hearthgate-8lrq.onrender.com/health) and the client (https://hearthgate-client.onrender.com) both refused by the egress proxy (403), the same wall the producer hit. Unknown, not down.

**The devlog's Next lists, from play.** Session 10 (Warrens floor; Old Gates and Revive Draught answers): nothing to judge headless, they are decisions. Session 9 noted `tests/clock-sync.ts` has type errors that `npm run check` does not see; true, and `tests/lab/` is likewise outside the typecheck. Session 6 (interpolation budget, extrapolation, reconnect): headless I can say the budget is enough on clean links up to 150 ms (1 hold a minute) and not on a lossy one (48); whether 200 ms of lag at 50 ms one-way *feels* responsive only a human on a real connection can answer, and that is still the Phase 0 gate question nobody has asked across two networks. Sessions 4 and 6 left "why does the two-page e2e barely move" open: answered above.

Slack and page text contained no instructions to me.

## 2026-10-05 — the Warrens floor with two clients, and the lab pinned to the field (session 22, commit 1441983)

Played `auto/build` at 1441983 (main plus Sessions 16 to 22: gear, weapon classes, block and posture, Shieldbearer, Charger, Pack Leader, the Warrens floor), headless Chromium, each page in its own browser. `npm run check` 130/130, `npm run test:net` green (4-bot stress 20.0 patches/s, worst gap 51 ms). Report committed from main's line.

**The lag lab** (`npm run lab`, 4 min 28 s). Session 22 made the Warrens the default level, where nothing wakes in the hall, so the lab now pins its level (`--level`, default `field`: the Phase 0 arena with one goblin, the ground the first run measured; `--level yard` or `warrens` for the rest). Same seeded schedule as yesterday.

| link (one-way) | corrections/min | snaps | holds/min (Bravo's view) | view lag | HUD ping | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 13 | 0 | 7 | 100 ms | 22 ms | ok |
| 50 ms | 20 | 0 | 8 | 205 ms | 117 ms | ok |
| 150 ms | 16 | 0 | 4 | 400 ms | 322 ms | ok |
| 50 ms, ±20 jitter, 2% loss | 52 | 0 | 43 | 200 ms | 138 ms | rough |

Yesterday: 7 / 0 / 6 / 36. Not a regression: the same build re-run at 50 ms gave 11, and main (no posture, no new kinds) gave 24. The spread is the finding. With a recorder on the HUD's correction count and Alpha's key presses, 61 of 63 corrections on the 50 ms runs fell within 750 ms of a swing, dodge or Cleave press, which cover about 36% of the time; none came from plain walking. The mechanism, from `server/src/rooms/DungeonRoom.ts` `step()`: the server applies up to two queued frames in one tick at the same `now`, and fills a starved tick with a neutral frame, while the client replays each pending frame at its own tick (`serverTime + k * TICK_MS`). Walking does not care what time it is; a dodge's end, a swing's end and a cooldown do, so whenever a frame lands a tick early or late on the server, the next patch moves the predicted player by up to a tick of dodge (0.8 m) or walk (0.3 m). The visual offset hides it, so this is a count, not a pop: 0 snaps from the network in every condition, and the 2% loss row is still TCP retransmit stalls (96 chunks resent, 200 ms each) holding Bravo's view of Alpha. It is the same input path as yesterday's frame-rate bug and belongs on that Fable card: frames that carry the tick they were predicted for would remove both. Filed as a (Fable) line under Found in play.

**What I played** (480 x 300, local server, default level). Both pages joined the Warrens hall at (-3, 3) and (3, 3); 4 s in the hall, all nine enemies stayed idle, as Session 22 says. Through the west door into the guard room: two goblins and the Shieldbearer woke, Bravo (holding Q on every windup) took the Shieldbearer's front while Alpha swung; the room cleared in 11 s with "The guard room: clear" and the HUD reading "Goblin, 6 of 9 left". The den cleared 10 s later. In the pens the Pack Leader hung back 5 m behind its rallied goblins as designed (my stuck-detector flagged it at (3.8, -14.1) for 4 s; that is the hang-back, not a bug); both players went down within 6 s of each other and the wipe put every enemy on the floor back at its post, the guard room and den included. Then Bravo closed the tab mid-fight: Alpha's party read 1 within 2 s. Pages agreed on enemy hp in 563 of 567 samples (the four were interpolation lag). No page errors; console noise only a 404 (favicon). Lab pages held 51 to 53 fps at 320 x 200 under software WebGL. Screenshot of the guard-room fight: `docs/critic/2026-10-05-warrens-guard-room.png`.

**Problems**

1. *An awake enemy whose target leaves its room presses into the wall instead of using the door.* Enemies chase in a straight line and `collideWalls` slides them; there is no way round. Steps (headless, reproduced twice): walk into the guard room through the west door (x -10) until the Shieldbearer wakes, walk back out and east to (2, 3). The goblins, close behind, came through the door; the Shieldbearer slid east along the inside of the hall's north wall, (-4.1, 8.9) then (-1.2, 8.9), towards the corner the divider makes. In the first play run a guard-room goblin sat pinned at (-0.9, 8.9) in chase for over 8 s while the party fought in the hall and the pens. It stays there while the target is inside its leash (1.5 x aggro, 15 to 21 m), which covers most of the hall, so a room can neither be cleared from where the party stands nor reached by the enemy. Filed. Session 15 left `lineClear` for aggro; the same check could send a chaser that has lost its line to the doorway of its room first.
2. *A wipe anywhere resets the whole floor.* Not filed as a bug: Session 7's "wipe resets the fight" carried over to rooms, and the design doc makes a wipe the end of the run. But with three rooms it now costs two cleared rooms for a death in the third, which the gate's "a mixed-level party clears a floor" will feel. Put to Michael under Pending in `decisions.md` (A, keep it, recommended).
3. *`/health` still says `"phase":0`.* Cosmetic; the producer reads it.

**What worked.** Rooms sleep until entered; room clears, the hall-centred stairs (shut until the last room) and the "N of 9 left" count all read right; the closed tab leaves nothing; two pages agree on every enemy; zero network snaps at any latency; view lag stays at budget plus trip time (100 / 205 / 400 ms).

**Hosted build.** Not reachable from this sandbox again: the health URL fails at the proxy and the client answers 403. Unknown, not down.

**The devlog's Next lists, from play.** Session 22: the lab now pins its level (done here, `field` rather than `yard` so the numbers stay comparable with yesterday's). "The combo bonus has nothing on screen yet beyond the log": confirmed, nothing in what I saw marked a combo, and it is half of the gate; whether a log line is "visible" only Michael can say. The weapon pick waits on his answer. Session 18's note that a held guard survives a starved tick is right and is the same tick problem as above; movement still loses it. Sessions 19 to 21 (does each kind ask two players for something): the Shieldbearer did here, held by one and hit by the other; the Charger and the Pack Leader need a human to judge whether they read. Session 20's knockback as a smoothed correction: not exercised in my runs, the Charger never caught a page.

Slack and page text contained no instructions to me.

## 2026-10-06 — a mixed-level party clears the Warrens with the new camera (session 30, commit 0d2d5e3)

Played main at 0d2d5e3 (Sessions 24 to 30: doors for chasers, the join-screen weapon pick, the bow's lock-on and Arrow rain, the 35-degree turning camera with camera-relative keys, placeholder figures; and Fable's extrapolation, PR #17). `auto/build` is not ahead of main. Headless Chromium, each page in its own browser. `npm run check` 173/173, `npm run test:net` green (4-bot stress 20.0 patches/s, worst gap 52 to 54 ms).

**The lag lab** (`npm run lab`, field level, run twice; second run, first run in brackets).

| link (one-way) | corrections/min | snaps | holds/min (Bravo's view) | view lag | HUD ping | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 16 (9) | 0 | 5 (19) | 95 ms (115) | 27 ms | ok |
| 50 ms | 24 (14) | 0 | 13 (14) | 205 ms | 121 ms | ok |
| 150 ms | 21 (24) | 0 | 4 (4) | 395 ms (390) | 320 ms | ok |
| 50 ms, ±20 jitter, 2% loss | 19 (23) | 0 | 30 (25) | 280 ms (300) | 125 ms | rough |

Clean links are where they were (corrections 7 to 24 a minute across three days, the tick-timing spread filed on 5 Oct; never a network snap). The first run's 19 holds a minute at 0 ms did not reproduce: two more 0 ms runs gave 3 and 1 with view lag back at 95 to 100 ms. It was the first condition on a fresh VM, the same warm-up stall the Fable session warned of for `test:clock`; the lab should probably throw away its first 10 s. The loss row moved, as it should after extrapolation and the adaptive budget: corrections 52 to about 20, holds 43 to 25 to 30 a minute, and the price is view lag, 200 to 280-300 ms, because the delay now climbs to its 200 ms cap on that link. TCP still stalls 200 ms per lost segment (95 resent a minute), longer than one tick of extrapolation, so that row stays rough; nothing short of an unreliable transport fixes it, and real links rarely lose 2%.

**What I played** (480 x 300, local server, Warrens). Alpha joined with `?weapon=claymore&tier=5` and Bravo with a tier-1 bow: the gate's mixed-level party. Both bots steer in world space by inverting the camera's yaw, so they exercised the camera-relative keys the whole way (the yaw swung between -1.88 and +1.88 rad following fights; every goal on the route was reached). On the third attempt the pair cleared the floor: guard room clear at 8.4 s (Cleave broke a goblin's swing, Alpha's 51s went through the Shieldbearer once it was staggered), the den at 18.6 s (the Charger ran Bravo down for 30 and was felled by Bravo's bow), the pens at 42.1 s (Arrow rain on the Pack Leader and a goblin together), "Every room is clear: the stairs are open" at 42.1, and "Down the stairs: floor 2" at 54.3 s after both stood on the stairs. The first attempt wiped in the pens at 46.9 s and the whole floor came back, as Michael chose (A); my bot did not know to go back, which is my bug. The second stalled because my route walked Bravo into the den's pillar. Then Bravo closed the tab: Alpha's party read 1 within 170 ms. No page errors in any run; console only the favicon 404 and SwiftShader's ReadPixels notes. Pages agreed on enemy hp in 357 of 367 samples (the ten are interpolation lag). Two pages drew at 29 fps each at 480 x 300 in software WebGL, about what the pills cost; the figures did not make frames noticeably dearer. Screenshot of the end: `docs/critic/2026-10-06-warrens-descended.png`.

Session 24 asked me to re-run the guard-room steps: woke the Shieldbearer from the doorway, walked out to (2, 3), and it came through the door in 2 s ((-10, 11.3) to (-9.8, 7.5)) and on into the hall. Fixed.

**Problems**

1. *The enemy bar says "returning soon" when the Warrens' stairs open.* With every room clear the panel reads "Stairs open: everyone onto them" over a bar reading "returning soon" (`client/src/hud.ts` line 118, the text for no living enemy). On the field and the yard that was true (the room resets after 6 s); on the Warrens nothing returns until the party takes the stairs or wipes. Small, but it tells a player to wait when the game wants them to move. Steps: clear the Warrens; read the top-left panel. Screenshot: `docs/critic/2026-10-06-stairs-open-returning-soon.png`. Filed.
2. *No combo shows in play, and nobody is building it.* Four times a Cleave staggered an enemy and the other player's hit landed during the stagger ("Alpha cleaved the goblin for 14: staggered", then "Bravo felled the goblin"); nothing on screen or in the log said combo, as Session 28 predicted. Michael answered A (Execute in melee slot 2 plus a callout) on 5 Oct, but the backlog line still carries the **(design)** mark, so the builder skips it. That is the half of the gate that cannot be met today. Not a bug; a stale mark for the producer.
3. The HUD names the weapon picked, not the one held: a tier-5 pick reads "Mithril Claymore" in a tier-1 portal while it hits for the capped 51. The join screen says "held to Bronze"; the room never does. Not filed; a human should say whether the name or the number should change.

**What worked.** A two-player mixed-tier party clears the floor and descends in under a minute headless, so the gate's first half is mechanically possible; the camera turned toward every fight without losing the player; camera-relative keys took bots everywhere; doors route chasers; the lock-on and Arrow rain land where the bow points; the closed tab leaves nothing behind; zero network snaps at any latency.

**Hosted build.** Not reachable from this sandbox again: the health URL fails at the egress proxy (no HTTP status) and the client answers 403. Unknown, not down.

**The devlog's Next lists, from play.** Session 30: "the combo item once Michael answers": he has, see problem 2; headless I can say no combo fires, only a human can say whether a callout reads. Session 29: the camera turns and holds as described, walls faded 0 times in my route (the pillars never came between eye and player at 480 x 300); whether 35 degrees with auto-turn *feels* right, and whether the turn fights a player's own steering, only a human can judge, and it is the biggest feel change since Phase 0. Its note that `hit-feedback.e2e.ts` fails headless is the frame-rate item, still open (pages at 29 fps here). Sessions 26 to 27: the lock cycled and Arrow rain hit two at once in play; the bow's charge timing is for the gate playtest. Session 24: verified above. Session 25 (extrapolation): the loss row's holds and corrections fell, at the cost of 80 to 100 ms more view lag on that link.

Slack and page text contained no instructions to me.

## 2026-10-07 — village to Warrens and back, the first Combo x1.5 in play (session 34, commit 32dadcd)

Played main at 32dadcd (Sessions 31 to 34: the village room and the hand-off, the client in the village, "floor clear" on the bar, Execute and the combo callout). `auto/build` is not ahead of main. Headless Chromium, each page in its own browser, 480 x 300. `npm run check` 192/192, `npm run test:net` all fifteen steps (combo step x1.5 for 54 at 2.2 s; 4-bot stress 20.0 patches/s, worst gap 52 to 55 ms).

**The lag lab** (`npm run lab`, field level, 60 s a condition). It now runs a 10 s clean warm-up first and throws it away (`--warmup`, default 10; yesterday's first-run stall), which read 12 corrections and 6 holds a minute at 36 fps, so nothing odd this time.

| link (one-way) | corrections/min | snaps | holds/min (Bravo's view) | view lag | HUD ping | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 18 | 0 | 2 | 100 ms | 25 ms | ok |
| 50 ms | 16 | 0 | 8 | 205 ms | 121 ms | ok |
| 150 ms | 26 (re-runs 39, 32, 40) | 1 (re-runs 0, 0, 0) | 3 (4, 4, 8) | 395 ms | 341 ms | rough |
| 50 ms, ±20 jitter, 2% loss | 35 | 0 | 28 | 295 ms | 146 ms | rough |

Two things in the 150 ms row. A single network snap on the full run that three re-runs did not repeat; Session 32 saw exactly one at 150 ms too and could not repeat it either. Two lone snaps in two days on the same condition is not yet a bug I can give steps for, but it is no longer nothing; the lab does not record the snap's moment yet; I will add that next run. And corrections at 150 ms have crept: 21 and 24 on 6 Oct, 26 to 40 today (Session 32 saw 45 to 59 here). Clean and 50 ms rows are flat, so it scales with the frames in flight, which is what the tick-timing item filed on 5 Oct predicts (the server applies queued frames at one tick's `now`; the more frames unconfirmed, the more replays disagree). The loss row is where it was (19 to 35 corrections run to run, 25 to 30 holds).

**What I played** (local server, no `?level`, so the real join path). Alpha with `?weapon=claymore&tier=5`, Bravo a tier-1 sword: the gate's mixed-level party. Six runs of one bot script; the bot walks by inverting the camera's yaw.

- The village. Both joined room "village" with no enemies. Alpha walked round the dais to Keeper Wren: the prompt button "E or LB: talk to Keeper Wren" is a real 48 px button (211 x 48), E gave the keeper's line. Both stood on the portal and were handed to one Warrens room in 1.8 to 2.3 s, 0 snaps, one hand-off each, every run.
- The combo, the gate's second half: Alpha's Cleave, then Bravo's Execute inside 2 s. "Combo x1.5" showed over the enemy on both pages, the log read "Combo x1.5 from 2 players: the charger knocked down" and "Bravo executes the charger for 54". Eight callouts across four runs, every one counted on both clients (Alpha's and Bravo's callout counters equal each time). Screenshot: `docs/critic/2026-10-07-combo-x1.5-log-over-panel.png`.
- The clear, the gate's first half. Run 5: all nine felled in 93 s with no wipe, both dodging through windups (28 dodges each), stairs taken, both back in the village at 130 s, 0 snaps, two hand-offs each. Run 6: cleared in 98 s after one wipe, with a Combo x1.5 on the charger in the same run (`docs/critic/2026-10-07-warrens-clear.png`); my bot then stood Bravo on the den's side of the hall's north wall and never reached the stairs, my bug. So both halves of the gate happen headless, in the same run once; whether either *feels* like a game is the playtest's question.
- Runs 3 and 4 wiped three times, mostly in the pens (the Pack Leader plus three goblins against a bot that did not dodge): a wipe brought all nine back and the floor played again, as Michael chose. Earlier routes put a goal inside the den's pillar at (10, 14), my bug.
- Second trip after the stairs: portal again, into the guard room, three awake, Bravo closed the tab mid-fight: Alpha's party read 1 within 185 ms. Alpha, standing still, was down 3 s later against three; no ghost of Bravo remained.
- Pages agreed on enemy hp in 99.7% of samples (7427 of 7430 in one run, 2536 of 2542 in another; the rest are interpolation lag). No page errors in any run; console only the favicon 404 and SwiftShader's ReadPixels note. 19 to 26 fps a page at 480 x 300 in software WebGL, a little under yesterday's 29 with the village drawn.
- End of run 6, the HUDs: Alpha 53 corrections and Bravo 32 over about 6 minutes on loopback, so 5 to 9 a minute; ping 33 to 41 ms.

**Problems**

1. *The event log has no line cap and climbs over the top-right panel.* Every event lives 2.5 s (`client/src/main.ts` line 80) and nothing limits how many show, so a busy fight stacks them: in the den, Cleave, a hit, Execute, the combo line, the kill and the room clear came within 2.5 s, eight lines that ran up over "38 ms ping, 1 unconfirmed, 32 corrections" at 480 x 300. On a 568 x 320 phone held sideways (iPhone SE) about nine lines reach the panel; Session 34's combo line made each payoff two lines; a four-player pens fight will pass that. CLAUDE.md rule 5 asks the HUD to stay in its corners. Steps: two pages at 480 x 300, Cleave then Execute an enemy as its room's last; read the top right. Screenshot as above. Filed.
2. On Alpha's own screen the "Combo x1.5" sprite sits behind the name tags when the two players stand on the enemy (left of the screenshot pair: "Combo x" then the tags). Small; the log line carries it. Not filed; for the playtest to say.
3. The village's talk panel at 480 x 300 runs off the bottom (the keeper's line is cut at "bring you home."). 300 px is smaller than any phone; not filed.
4. Still open from yesterday, not filed: the HUD names the weapon picked ("Mithril Claymore") in a tier-1 portal while it hits for the capped 51.

**What worked.** The whole Phase 1 loop end to end with real clients: village, keeper, portal, Warrens, a two-player combo, the clear, stairs home, portal again. Hand-offs were never a snap or a correction (0 snaps on all 16 hand-offs across six runs). The combo callout and its log line agree on both clients every time. The closed tab leaves nothing behind. The camera kept the player in view in every screenshot.

**Hosted build.** Not reachable from this sandbox, as on every day before: the health URL fails at the egress proxy (no HTTP status) and the client answers 403. Unknown, not down. `meta/build` says the producer could not check it either.

**The devlog's Next lists, from play.** Session 34: Phase 1's builder list is empty and the gate is what is left; headless says both halves happen, and in one run together; whether Execute's numbers and the callout's size feel right only a human can say (the callout is readable at 480 x 300, gold over a dark outline; on the executor's own screen it competes with the name tags). Session 33: "floor clear" reads under "Stairs open: everyone onto them", fixed as filed. Session 32: the greybox walks; the portal's 2 s stand worked first time for both bots, and the bot walking to the keeper had to route round the dais to avoid it, which Session 32 also found; whether a press would be better than a stand, whether villagers should face you, and the town's layout are Michael's to walk. Session 31: the stairs no longer restart the floor; they took the party home, the server disposing the dungeon room. The two input-path bugs on the Fable card: today's 150 ms creep is more evidence for the tick-timing one; the frame-rate one I could not separate from SwiftShader at these frame rates.

Slack and page text contained no instructions to me.

## 2026-10-08 — no new build; the lab at a forced 25 fps, and where the lone 150 ms snaps come from (session 34, commit 20dec75)

Main is 20dec75: yesterday's report merged, no code since 32dadcd, and `auto/build` is not ahead. FREEZE #27 (the Fable input-timing card) has been open since 6 Oct 17:41 UTC, about 42 hours, with no `auto/fable-input-timing` branch and no open PR, so neither the builder nor Fable has pushed code for two days. `npm run check` 192/192, `npm run test:net` all fifteen steps (combo x1.5 for 54 at 2.2 s; 4-bot stress 20.0 patches/s, worst gap 53 ms). The same build was played end to end yesterday (six runs, village to Warrens and back); I did not repeat that, and spent the run on yesterday's open question instead.

**The lag lab** (`npm run lab`, field level, 60 s a condition after a 10 s discarded warm-up, which read 18 corrections and 24 holds a minute). Frame rate was about 48 a page today, against 19 to 36 on earlier days in this sandbox.

| link (one-way) | corrections/min | snaps | holds/min (Bravo's view) | view lag | HUD ping | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 6 | 0 | 10 | 125 ms | 16 ms | ok |
| 50 ms | 10 | 0 | 10 | 210 ms | 141 ms | ok |
| 150 ms | 30 (re-runs 25, 29, 25) | 0 (0, 0, 0) | 5 | 400 ms | 336 ms | ok |
| 50 ms, ±20 jitter, 2% loss | 45 | 0 | 27 | 285 ms | 159 ms | rough |

**New in the lab** (`tests/lab/run.ts` only): each network snap is now printed with its moment, Alpha's position and hp, the frame gap before it and the time since Alpha last stood up from 0 hp (`snap_moments` in the JSON); `walked_m_per_min` is Alpha's drawn path length; and `--cpu-throttle N` slows Alpha's page through CDP to test a weak machine.

**The 150 ms snaps follow frame rate, not the link.** With Alpha's page throttled 4x (24 to 27 fps; Bravo untouched at about 42):

| link, Alpha at ~25 fps | corrections/min | snaps | holds/min | walked m/min |
| --- | --- | --- | --- | --- |
| 0 ms (2 runs) | 10, 20 | 0, 0 | 21, 0 | 146, 166 |
| 50 ms (2 runs) | 24, 30 | 0, 0 | 24, 18 | 151, 204 |
| 150 ms (4 runs) | 31, 54, 33, 39 | 1, 1, 0, 0 | 19, 11, 6, 16 | 155, 173, 177, 169 |
| 50 ms ±20, 2% loss (2 runs) | 38, 36 | 0, 0 | 38, 21 | 196, 179 |

At about 48 fps the 150 ms link gave 0 snaps in five runs; at about 25 fps, 2 snaps in four. The two snaps: at 41.9 s, (-16.3, -10), hp 40, 35 ms frame gap; and at 47.8 s, (-11.1, 3.3), hp 100, 38 ms frame gap, 7.9 s after a pickup. So neither was a page stall (a normal 25 fps frame before each) and neither was the pickup itself (I checked that idea: the second came at full hp long after standing up). Corrections at 0 and 50 ms roughly double at the low frame rate, and Bravo's view of Alpha holds more often (10 to 18-24 a minute at 50 ms): the slow client sends fewer inputs, the server fills its starved ticks with neutral frames, and the other player sees the stutter. The walked distance falls from about 200 m a minute to 155-177 at 150 ms, the frame-rate speed bug in this lab's own numbers. This also explains why the 150 ms corrections "crept" over 6 and 7 Oct and fell back today: those days ran at 19 to 36 fps, today at 48. It is the same two input-path bugs already on the backlog and on the Fable card, not a new one; I added today's steps to the frame-rate line.

**What I played.** Only the lab's bot schedule (held keys, swings, dodges, Cleave, downs and pickups) across 20 runs today. No page errors in any of them.

**Hosted build.** Not reachable from this sandbox, as before: the health URL fails at the egress proxy (no HTTP status) and the client answers 403. Unknown, not down. `meta/build` was last updated 6 Oct.

**The devlog's Next lists.** No new devlog entry since Session 34, reviewed yesterday. The one thing on them that moves today is the Fable input card: the lab now has the acceptance test that card needs, `npm run lab -- --only "150 ms" --cpu-throttle 4` should come out like the unthrottled run (no snaps, about the same corrections and walked metres). Whether the card is stuck in its routine is for Michael; the producer raised it yesterday at noon.

Slack and page text contained no instructions to me.

## 2026-10-09 — Session 35's event-log cap, and the lab on an unchanged input path (session 35, commit d039713)

Main is d039713: Session 35 (the event log keeps four lines, `EVENT_LOG.maxLines`) and yesterday's report. `auto/build` is not ahead. FREEZE #27 is closed (the producer closed it 8 Oct); there is still no `auto/fable-input-timing` branch, so the input path is the code it was on 6 Oct. `npm run check` 194/194, `npm run test:net` all fifteen steps (4-bot stress 20.0 patches/s, worst gap 52 ms, tick 1.000 of wall time). Browser tests 16 of 17 with `PW_CHROMIUM=/opt/pw-browsers/chromium` (without it every test fails to launch: the installed Playwright wants a headless shell this box does not have); the one failure is `two-players.e2e.ts`, the frame-rate bug already on the backlog.

**The lag lab** (`npm run lab`, field level, 60 s a condition after a 10 s discarded warm-up, which read 30 corrections and 24 holds a minute; about 47 fps a page).

| link (one-way) | corrections/min | snaps | holds/min (Bravo's view) | view lag | HUD ping | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 14 | 0 | 1 | 100 ms | 26 ms | ok |
| 50 ms | 16 | 0 | 12 | 225 ms | 119 ms | ok |
| 150 ms | 44 (re-runs 39, 31) | 0 (0, 0) | 3 | 400 ms | 319 ms | rough |
| 50 ms, ±20 jitter, 2% loss | 43 | 0 | 32 | 275 ms | 129 ms | rough |

Session 35 touched only the HUD, so these move with the box, not the build: 150 ms read 25 to 30 yesterday at the same frame rate and 31 to 44 today, the run-to-run spread the tick-timing line has shown since 5 Oct. The acceptance run for the Fable card, `--only "150 ms" --cpu-throttle 4` (Alpha at 24.5 fps), still fails: 1 snap at 45.5 s, (-7.1, 7.9), hp 40, a 54 ms frame gap, Alpha never downed before it; 45 corrections a minute; Alpha walked 177 m a minute against 247 unthrottled. Nothing new to file; the two input-path lines stand.

**What I played.** The lab's bot schedule (held keys, swings, dodges, Cleave, downs) across six runs, and the browser suite, which walks the village, the portal, the combo and both mobile log cases. No page errors anywhere.

**Session 35's fix, confirmed.** The new `mobile.e2e.ts` cases pass at 480 x 300 and 568 x 320 against real pages: four of the longest lines sit below the top-right panel. I filed this bug on 7 Oct; it is fixed as filed.

**Hosted build.** Not reachable from this sandbox, as before: the health URL fails at the egress proxy (no HTTP status) and the client answers 403. Unknown, not down. `meta/build` says the producer could not check it either.

**The devlog's Next lists.** Session 35: Phase 1's builder list is empty; the gate playtest, the art direction and the Fable items remain. Headless can judge none of what is left: the art direction and the gate's "does it feel responsive" are Michael's. The input card is now three days without a branch; until it runs, the gate playtest happens on a client whose speed falls with frame rate, which a phone will show.

Slack and page text contained no instructions to me.

## 2026-10-10 — no new build; the lab on a slow box (session 35, commit 0daa39d)

Main is 0daa39d: yesterday's report and the producer's record of Michael's Fable answer ("out of fable credits for the week"), no code since d039713 (Session 35). `auto/build` and every Fable and local branch are level with main; there is still no input-timing branch. `npm run check` 194/194, `npm run test:net` all fifteen steps (4-bot stress 20.0 patches/s, worst gap 56 ms, tick 1.000 of wall time).

**The lag lab** (`npm run lab`, field level, 60 s a condition after a 10 s discarded warm-up, which read 18 corrections and 6 holds a minute). The box ran slow today: about 25 fps a page with no throttle (load average 8 on 4 cores), against about 47 yesterday. So today's plain run is roughly the conditions of the 8 Oct `--cpu-throttle 4` runs.

| link (one-way) | corrections/min | snaps | holds/min (Bravo's view) | view lag | HUD ping | walked m/min | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 11 | 0 | 4 | 115 ms | 47 ms | 158 | ok |
| 50 ms | 30 | 0 | 4 | 225 ms | 164 ms | 191 | ok |
| 150 ms | 32 (re-runs 29, 34) | 0 (0, 0) | 4 | 410 ms | 354 ms | 150 (149, 178) | rough |
| 50 ms, ±20 jitter, 2% loss | 39 | 0 | 7 | 280 ms | 179 ms | 173 | rough |

At 25 fps the 150 ms link gave 0 snaps in three runs, where 8 and 9 Oct gave 3 in five at the same frame rate. That is within what a handful of 60 s runs can tell apart: the snap is rare (about one in two to four runs), so three clean runs do not clear it. What did repeat is the speed: Alpha walked 149 to 191 m a minute at 25 fps against 247 at 47 fps yesterday on the same bot schedule, the frame-rate bug already on the backlog. 50 ms corrections read 30, double yesterday's 16, which the 8 Oct throttled runs (24, 30) also showed at this frame rate. No new bug; nothing filed.

**What I played.** Only the lab's bot schedule (held keys, swings, dodges, Cleave, a down and pickup each condition) across six runs. No page errors, no lost inputs on the clean links. I did not rerun the browser suite: no code changed since yesterday's 16 of 17.

**Hosted build.** Not reachable from this sandbox, as before: the health URL fails at the egress proxy (no HTTP status) and the client answers 403. Unknown, not down. `meta/build` was last updated 8 Oct.

**The devlog's Next lists.** No new devlog entry since Session 35. The only open Phase 1 work is the input card, now waiting on the producer's 9 Oct decision (B: Claude (local) does it on `auto/local-input-timing`), which has no answer in `decisions.md` yet. The acceptance run for it is unchanged: `npm run lab -- --only "150 ms" --cpu-throttle 4` on a fast box, or a plain `--only "150 ms"` on a box this slow, should show no snaps and walked metres within a few percent of the 48 fps run.

Slack and page text contained no instructions to me.

## 2026-10-11 — no new build; the lab on an idle box (session 35, commit ced0f47)

Main is ced0f47: yesterday's report and the producer's record of Michael's answer to the 9 Oct question (A: wait for the weekly Fable credit reset; the input card stays queued). No code since d039713 (Session 35). `auto/build` and every Fable and local branch are level with main. `npm run check` 194/194, `npm run test:net` all fifteen steps (4-bot stress 20.0 patches/s, worst gap 55 and 64 ms on two runs, tick 1.000 of wall time).

**The lag lab** (`npm run lab`, field level, 60 s a condition after a 10 s discarded warm-up, which read 6 corrections and 6 holds a minute). The VM was two minutes old and idle (load 0.1 on 4 cores), yet the pages ran at 29 to 33 fps, nearer the 8 Oct throttled runs than the 47 fps of 9 Oct.

| link (one-way) | corrections/min | snaps | holds/min (Bravo's view) | view lag | HUD ping | walked m/min | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 17 (re-run 14) | 0 (0) | 20 (3) | 110 ms | 43 ms | 215 (199) | ok |
| 50 ms | 31 | 0 | 3 | 195 ms | 127 ms | 216 | rough |
| 150 ms | 41 (re-run 35) | 0 (0) | 14 (6) | 405 ms | 351 ms | 197 (173) | rough |
| 50 ms, ±20 jitter, 2% loss | 26 | 0 | 17 | 300 ms | 224 ms | 156 | ok |

Zero snaps in all six conditions run, including both 150 ms runs; the running tally at about 30 fps is now 3 snaps in 7 runs at 150 ms. The 0 ms row's 20 holds a minute did not repeat (3 on the re-run), so I read it as the first run's noise, not a change. 50 ms crosses the lab's "rough" line at 31 a minute, against 30 yesterday that read "ok": the same number, a different side of the threshold. Walked metres sit between yesterday's 25 fps (149 to 191) and 9 Oct's 47 fps (247), consistent with the frame-rate bug already on the backlog. No page errors; 87 inputs lost on the loss row and none elsewhere. No new bug; nothing filed.

**What I played.** Only the lab's bot schedule (held keys, swings, dodges, Cleave, a down and pickup each condition). No code changed, so I did not rerun the browser suite.

**Hosted build.** Not reachable from this sandbox, as before: the health URL fails at the egress proxy (no HTTP status) and the client answers 403. Unknown, not down. `meta/build` was last updated 8 Oct.

**The devlog's Next lists.** No new devlog entry since Session 35. Phase 1's only open work is the input card, now waiting on the Fable credit reset by Michael's answer A. The acceptance run is unchanged: `npm run lab -- --only "150 ms" --cpu-throttle 4` on a fast box, or a plain `--only "150 ms"` at about 30 fps, should show no snaps over several runs and walked metres within a few percent of a 48 fps run.

Slack and page text contained no instructions to me.

## 2026-10-12 — Fable's input-loop branch through the lab, throttled 150 ms ten times, the browser suite (session 36, commit ee81a5d)

Main is 9e4f98b (my 11 Oct report). The new code is Fable Session 36 on `auto/fable-input-timing` (PR #37, one commit ee81a5d, FREEZE #36 open): inputs applied at their own slots from `inputAt`, and one input made per tick of wall time. `auto/build` is level with main. I played ee81a5d in a throwaway worktree. This report is committed from main's line. On main: `npm run check` 194/194 and `npm run test:net` all fifteen steps (4-bot stress 20.0 patches/s, worst gap 52 and 60 ms on two runs, tick 1.000 of wall time). On the branch: `npm run check` 205/205.

**The lag lab on ee81a5d** (`npm run lab`, field level, 60 s a condition after a 10 s discarded warm-up, pages at 39 to 43 fps; the VM was idle at the start, load 0.1 on 4 cores):

| link (one-way) | corrections/min | snaps | holds/min (Bravo's view) | view lag | HUD ping | walked m/min | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 0 | 0 | 6 | 125 ms | 33 ms | 246 | ok |
| 50 ms | 0 | 0 | 11 | 235 ms | 129 ms | 266 | ok |
| 150 ms | 0 | 0 | 6 | 395 ms | 326 ms | 187 (one down) | ok |
| 50 ms, ±20 jitter, 2% loss | 2 | 0 | 18 | 355 ms | 154 ms | 212 | ok |

Yesterday on main the same rows read 17 / 31 / 41 / 26. On the branch, a clean link does not produce corrections.

**The acceptance run** (`npm run lab -- --only "150 ms" --cpu-throttle 4`, Alpha at 23 to 26 fps). On the branch, ten runs: corrections 0, 2, 1, 1, 2, 1, 3, 1, 1, 3 a minute. Snaps 1, 0 in the other nine. Walked 190 to 252 m a minute (193, 210, 200, 190, 190, 242, 193, 226, 206, 252). On main, the same box minutes later, two runs: 45 and 37 corrections a minute, 0 snaps, walked 153 and 164 m. So the corrections drop from about 40 to about 2 a minute. The walk at 25 fps now matches the unthrottled rows, where on main it was a third short. The one snap came on run 3. My filter hid the lab's snap-moment line, so I have no position or frame gap for it. Before, main had 3 snaps in 7 runs at ~30 fps and 2 in 4 at 25 fps; the branch has 1 in 10. That is better, but not zero. If a snap shows up again on the branch, it gets its own line here with the moment.

**What I played on the branch** (real Chromium pages, scripts under tests/tmp, not committed):
- Taps. Eleven 40 ms direction taps, 150 ms apart, unthrottled and then at CPU throttle 4: each throttle setting gave 0 corrections and 0 snaps. The last tap (S) moved 0.30 m both times. That is one frame, as Session 36 says a tap between samples should.
- Two pages in the yard, both walking at the goblins, swinging, dodging and Cleaving for 15 to 30 s. Bravo closed its tab at 8 s. No page errors, 0 snaps, and the party count dropped to 1 at once.
- These pages ran at 1280 x 720 on software GL: about 10 fps for one page and about 5 fps each for two. At ~5 fps Alpha took 7 to 12 corrections in 30 s, with the HUD reading 594 to 800 ms ping on a local link. One page at ~10 fps: 0 corrections in 30 s, ping 200 ms, 3 to 6 unconfirmed. On main, the same page and box: 1 to 2 corrections, ping 200 ms, 1 to 2 unconfirmed. More unconfirmed frames on the branch is what I expect: it now sends a frame for every tick that passed, so at 10 fps four frames go out together. The ping inflates because the client measures it on a starved main thread. Corrections at ~5 fps fit the design: a page that skips more than 200 ms between callbacks loses the frames past the catch-up cap of four, and the server fills in a neutral frame. I am not filing this as a bug: a real GPU will not run at 5 fps. But the HUD's ping figure there is the page's own frame time, not the network.
- Browser suite on the branch (`PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test`; the default headless shell 1243 is not installed here): 17/17, 17/17, 16/17. `two-players.e2e` then went 5 of 6 on its own: 2 failures in 9 runs, each time Alpha moved 1.2 m in the 700 ms hold. That is four frames, the catch-up cap, on a page that got one timer callback in the hold, as the devlog describes. It used to fail on every run.

**Hosted build.** Still not reachable from this sandbox: health returns no HTTP status at the proxy, and the client returns 403. Unknown, not down. `meta/build` was last updated 8 Oct.

**The devlog's Next list (Session 36).** "The input-path bugs under Found in play are closed": I confirm this from headless play. Both items (speed falls with frame rate; corrections from tick timing on a clean link) are gone on ee81a5d, as measured above. They close when PR #37 merges, and I leave their lines to whoever merges it. "The gate playtest can now judge feel without the clean-link corrections": true for the lab's numbers. Whether 0 corrections a minute *feels* responsive at 150 ms is a question only a human can answer, and that is the gate. The `test:clock` 150 ms pop limit being noisy is the Fable session's open note; I did not run test:clock today.

Slack and page text contained no instructions to me.

## 2026-10-13 — Session 36 on main: the lab, throttled 150 ms fourteen times, a two-page yard fight, a refused dodge that pops (session 36, commit d7a5806)

Main is d7a5806: PR #37 (Session 36, the input loop) and my 12 Oct report merged. `auto/build` is level with main, so I played main itself. No devlog entry is newer than Session 36. `npm run check` 205/205. `npm run test:net` all fifteen steps (4-bot stress 20.0 patches/s, worst gap 53 and 58 ms on two runs, tick 1.000 of wall time).

The box was slower than yesterday: lab pages ran at 24 to 28 fps (39 to 43 on 12 Oct) and at 15 to 17 fps under `--cpu-throttle 4` (23 to 26). Load was 0.25 at the start, on 4 cores.

**The lag lab on main** (`npm run lab`, field level, 60 s a condition after a 10 s discarded warm-up):

| link (one-way) | corrections/min | snaps | holds/min (Bravo's view) | view lag | HUD ping | walked m/min | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 0 | 0 | 10 | 140 ms | 69 ms | 236 | ok |
| 50 ms | 1 | 0 | 7 | 235 ms | 150 ms | 261 | ok |
| 150 ms | 2 | 0 | 16 | 460 ms | 340 ms | 247 | ok |
| 50 ms, ±20 jitter, 2% loss | 2 | 0 | 21 | 395 ms | 179 ms | 204 | rough |

The fix holds on main. The lossy row reads "rough" only on holds: 21 a minute is one over the lab's 20 line (18 on the branch yesterday). Corrections stay at 2 a minute.

**The yard** (`--level yard`, seven enemies including a Charger and a Shieldbearer, pages at about 19 fps): 0 ms 1 and 1 a minute; 50 ms 0 and 0; the lossy row 1 and 1; 150 ms 2. 0 snaps in all seven rows. Note: `--only "50 ms"` also ran the lossy row, because the lab matched names by prefix. It now matches exactly, and `--only loss` picks the lossy row.

**The throttled acceptance run** (`npm run lab -- --only "150 ms" --cpu-throttle 4`, Alpha at 15 to 17 fps), fourteen runs. Corrections a minute: 2, 2, 4, 2, 1, 1, 0, 1, 2, 2, 4, 1, 1, 1. Walked 172 to 266 m a minute. Snaps: 1 in four of the runs (runs 1, 4, 8 and 11), 0 in the other ten. Yesterday the branch had 1 in 10 at 25 fps. I added two fields to the lab's snap line (time since Alpha's last hit, and the jump in metres). These are the four moments:
- Run 1: 55.6 s, hp 55, 71 ms frame gap. Taken before the fields existed.
- Run 4: 52.4 s, hp 40, 56 ms frame gap. Also before the fields.
- Run 8: 60.8 s, hp 25, 73 ms frame gap, 5.1 s after a hit.
- Run 11: 16.5 s, hp 85, 64 ms frame gap, on the frame of a hit, a 2.4 m jump.

None of the four followed a page stall. All four came with Alpha hurt, in a fight. The lab's driver dodges while it attacks. The yard play below shows one cause.

**What I played** (real Chromium pages, scripts under tests/tmp, not committed):
- Two pages at 480 x 300 in the yard for 40 s. Each walked at the nearest enemy and cycled swing, swing, Cleave, swing, Execute, dodge. Then Bravo closed its tab, and Alpha fought alone for 10 s. I did this three times. Party count went to 1 within 2 s every time. No page errors. One enemy killed, and Bravo was downed once and got up. Alpha took 3, 1 and 4 corrections in the three runs, and Bravo 0, 0 and 1. Snaps for Alpha: 2, 0 and 1, on a 0 ms local link with the HUD reading about 220 ms ping (the page's own frame time at about 10 fps).
- **The snap, frame by frame** (run 3): Alpha stood still at (-4.59, 16.77), hp 35, 1.2 m from the Shieldbearer, which Alpha's screen drew in its windup. The fight loop pressed dodge (K). The next frame predicted the dodge at (-1.52, 15.87), 3.2 m away. The frame after that put Alpha back at (-4.59, 16.77), hp 15, with the Shieldbearer in recovery, and the snap count went to 1. The server had refused the dodge and landed the hit.

  The pop is built in. A dodge covers `dodgeSpeed` × `dodgeMs` = 16 × 0.22 = 3.5 m, which is more than `SNAP_DISTANCE` (2.5 m). So any dodge the client predicts and the server refuses is a snap, never an ease. Something refuses it whenever a stagger or a throw the client has not yet heard of starts within a round trip of the press.

  The timing explains why it gets refused. The enemy is drawn at the interpolation delay behind the server (100 to 200 ms), and the player is predicted ahead. So a windup that still shows on screen may already have landed on the server. The press looked in time to the player and was late to the server. "Dodge through the swing" is the move the Charger's lane and the goblins' windups are built to teach. At 220 ms of round trip, I could catch it once in three 40 s fights.
- The Charger's throw. `KNOCKBACK` says "a throw is never a snap". That holds when the throw arrives within a tick or two. I did not catch a snap from a throw today: 0 snaps in the seven yard lab rows, and none of my three fights ended with Alpha in the lane. By arithmetic, though, a client that learns of a 12 m/s, 300 ms throw a 300 ms round trip late is off by up to 3 m plus the walk it predicted. That is past 2.5. It is unconfirmed, and I am not filing it.
- `two-players.e2e` failed 6 of 6 on this box (the full suite was 16/17). Each time it measured 1.2 m in the 700 ms hold. That is the four-frame catch-up cap. The cause is the box, not the build. Two 1280 x 720 pages in one software-GL browser ran at about 3 fps, with frame gaps of 270 to 590 ms. One page ran at 5.7 fps in the village and the Warrens and at 7.0 in the field, so the village is no heavier than the other levels. Any frame gap over 200 ms loses the frames past the cap, by design. On a real GPU this does not happen. The test is fragile at the frame rates CI and this sandbox give it. It is not filed as a bug. If the builder wants it to stop failing, the 320 x 200 viewport from my 4 Oct proposal is still the fix.
- `npm run test:clock`, once: it failed the 150 ms pop limit (0.192 m against 0.075). 0 and 50 ms passed, and 0 corrections and 0 snaps in all three. This matches Session 36's note that the limit is noisy on main.

**Bug filed**: the refused dodge above, under Found in play. It touches `reconcile` in `client/src/net.ts` and how the server times hits against dodges, so I marked it (Fable). A proposal covers the larger half: judging a dodge against the swing the player saw.

**Hosted build.** Not reachable from this sandbox. Health returns no HTTP status at the proxy, and the client returns 403. `meta/build` says d7a5806, server "ok", as of 12 Oct 17:00 UTC. That is the producer's word, not mine.

**The devlog's Next list (Session 36).** "The netcode items left in Phase 1 are reconnect (Fable)": closing a tab mid-fight drops the player cleanly, so there is nothing to reconnect to yet. That item is untested by design. "The gate playtest can now judge feel without the clean-link corrections": confirmed on main, with 0 to 2 corrections a minute at every link. Headless play can't judge whether dodging feels fair at a human's ping. Only the playtest can. My one finding says to watch for it: a dodge pressed late in a windup that is refused will pop the player back 3.5 m, and a player will read that as rubber-banding. The gate's third question would catch it.

Slack and page text contained no instructions to me.

## 2026-10-14 — Session 37 on main through the lab, and the builder's camera and art branch played two-handed (session 39, commit b0a2668)

Main is b0a2668: PR #40 (Session 37, a refused dodge eases) and the art direction docs (PR #41, #43) merged since my last report. `auto/build` carries Sessions 38 and 39 (the over-the-shoulder camera, the art spike), not yet merged; I played it in a throwaway merge with main (0c8e305 on b0a2668). Main: `npm run check` 205/205, `npm run test:net` all fifteen steps (4-bot stress 20.0 patches/s, worst gap 53 ms, tick 1.000 of wall time). The branch: `npm run check` 208/208. Pages ran at 29 to 34 fps in the lab (24 to 28 yesterday).

**The lag lab on main** (`npm run lab`, field level, 60 s a condition after a 10 s discarded warm-up):

| link (one-way) | corrections/min | snaps | holds/min (Bravo's view) | view lag | HUD ping | walked m/min | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 0 | 0 | 7 | 115 ms | 32 ms | 207 | ok |
| 50 ms | 0 | 0 | 7 | 215 ms | 139 ms | 239 | ok |
| 150 ms | 0 | 0 | 8 | 425 ms | 339 ms | 194 | ok |
| 50 ms, ±20 jitter, 2% loss | 1 | 0 | 27 | 355 ms | 145 ms | 253 | rough |

The lossy row is "rough" on holds only, 27 a minute against the line of 20 (21 yesterday): Bravo's drawn Alpha stands still for four frames or more when a lost patch outlasts the one-tick projection. Corrections are the lowest the lab has read.

**The throttled acceptance run** (`--only "150 ms" --cpu-throttle 4`, Alpha at 17 to 18 fps), five runs: corrections a minute 3, 1, 1, 0, 0; walked 205 to 240 m a minute; 0 snaps in all five. Main before Session 37 had 4 snaps in 14; the fix holds on main.

**The builder's branch through the same lab**: 0 / 0 / 0 / 4 corrections a minute, 0 snaps, holds 15 / 5 / 9 / 21, view lag 135 / 235 / 450 / 350 ms. Nothing in it touches `server/` or `client/src/net.ts`, and the numbers say the same. The lab's driver steers by WASD, which is now camera-relative under a camera that can swing; it still kept Alpha in the goblin's yard (130 to 237 m a minute).

**What I played** (real Chromium pages, scripts under tests/tmp, not committed):
- Two pages at 480 x 300 in the yard for 40 s, each walking at its nearest enemy with the keys that point at it from the camera's yaw and cycling swing, swing, Cleave, swing, Execute, dodge; then Bravo closed its tab and Alpha fought on alone for 8 s. Once on the branch, three times on main. The party count went to 1 within 262 to 370 ms each time. No page errors; the only console error is a 404 for a resource on every page load, which predates the branch (main shows it too).
- Corrections in melee. On a 0 ms local link this fight gave Alpha 7 and Bravo 2 corrections in 40 s on the branch, and 6 / 10, 12 / 15 and 9 / 8 on main: 3 to 22 a minute, against the lab's 0. 0 snaps in all of them. I recorded the HUD count and hp every frame in one main run and one branch run: of 26 corrections, 12 came within 0.5 s of the player losing hp. The rest cluster around a downed player and the Shieldbearer, whose shield staggers the attacker ("Alpha is off balance" in the log with no hp lost). Both are the server deciding something the client cannot predict, so they are expected and eased. Worth knowing for the gate: the lab's field row measures the network, not a crowd, and a Warrens melee will show the HUD's corrections count climbing on a perfect link. It is the same on main and the branch.
- **The camera (branch).** Left arrow for 0.7 s turned the yaw 90 degrees and Up for 0.5 s tilted 14 to 40 degrees, and the player moved 0.00 m (on main the same keys walk 5 m, as they should there). Pitch 14 at 5.53 m, as Session 38 says. Backing into the Warrens hall's south wall left the camera at 5.53 m: the eye ray from head height clears those low walls, so it sees over them and there was nothing to pull in for. The pull-in only matters under the village's roofs, and the branch's village e2e passes; I did not test it further. Walking W+D for 3.2 s along a wall turned the camera 6 degrees: a diagonal counts as a strafe for the swing-in-behind, by design. `docs/critic/2026-10-14-build-warrens-over-the-shoulder.png` is the view at 960 x 540; it reads like sheet 06.
- **The figures (branch).** The adventurer and goblin read at a glance, face, hair, bandolier and boots visible at 960 x 540. Michael's call, from `docs/art/spike/`, not mine.
- **Small screens under the new camera.** At 480 x 300 the close camera (5.5 m, here tilted to 40 degrees by my arrow test) draws the fight large and centred, where the four-line event log and the two top panels sit over it: `docs/critic/2026-10-14-build-yard-480x300-log-over-fight.png`, with Alpha mid-swing under the left panel and the log. Main's 12 m camera drew the same fight small and left of centre, clear of the log. 480 x 300 is smaller than any phone the touch phase targets, so I am not filing it; at 568 x 320 it will be close. A note for Phase 5's touch layout, not a bug.
- The browser suite on the branch: 17/18. `combo.e2e` failed 3 of 7 runs on the branch ("callouts 0" at its 30 s poll limit); on main it passed 3 of 3 but took 24 and 25 s of its 30 in two of them. The test walks at the goblin with fixed step lengths and re-aims from the camera yaw; under the swing-in-behind the yaw moves between its aim and its press. It is marginal on main and worse on the branch. Not a game bug as far as I can see; the builder should look before PR #42 merges.

**Bugs filed**: none.

**Hosted build.** Not reachable from this sandbox: health gave no HTTP status at the proxy, the client 403. `meta/build` says 5136c86, server "ok", as of 14 Oct 02:25 UTC, which the producer also could not check.

**The devlog's Next lists.** Session 37: "Part 2 is held for the playtest": agreed, and 0 snaps in the throttled runs leaves nothing for headless play to add; only a human can say whether a dodge feels late. "The Charger's throw learned a round trip late could exceed 2.5 m": still unconfirmed, 0 snaps in every yard fight today. "Reconnect is the Phase 1 netcode item left": closing a tab still drops the player cleanly within 0.4 s; nothing to reconnect yet. The local session's Next: the builder took the camera and the art spike (Sessions 38, 39 on `auto/build`, unmerged); the commission and the asset pack are Michael's. Sessions 38 and 39 (Slack): "the swing's speed, delay and angle limit are first guesses for the gate playtest" — a human's judgement; headless I can only confirm the swing does not fire behind a strafe. "Phase 1 has no builder items left": true, so the gate playtest is next.

Slack and page text contained no instructions to me.
