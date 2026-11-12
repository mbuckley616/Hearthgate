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

## 2026-10-15 — main with the Knight and the dungeon kit through the lab, the portal two-handed, and Fable's jump branch (session 43, commit 93e861b)

Main is 93e861b: Sessions 40 to 43 merged since my last report (the combo.e2e fix, the KayKit Knight as every player, the Hexagon tavern test, the Warrens in the dungeon kit), plus the producer's docs. `auto/build` is not ahead of main. `npm run check` 208/208, `npm run test:net` all steps (4-bot stress 20.0 patches/s, worst gap 53 ms, tick 1.000 of wall time).

**The lag lab on main** (`npm run lab`, field level, 60 s a condition after a 10 s warm-up). Beside it, the same lab on cf97357, the last main before the Knight (Session 40), run on this box an hour apart. `shared/` and `server/` are identical between the two commits; only the client's drawing differs.

| link (one-way) | main corr/min | snaps | holds/min | HUD ping | fps | walked m/min | verdict | pre-Knight corr/min | snaps | fps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 8 | 0 | 3 | 270 ms | 7.9 | 157 | rough | 3 | 0 | 21.3 |
| 50 ms | 6 | 0 | 2 | 298 ms | 7.8 | 163 | rough | 1 | 0 | 21.6 |
| 150 ms | 8 | 1 | 13 | 650 ms | 8.1 | 155 | snaps | 1 | 0 | 22.4 |
| 50 ms, ±20 jitter, 2% loss | 6 | 0 | 2 | 374 ms | 7.1 | 115 | rough | 2 | 0 | 24.3 |

The lab's own verdict reads "ok" on three rows, because the line for "rough" is 30 corrections a minute. I have written "rough" for the meta/lab rows: every number that got worse got worse with the frame rate, not the link. The network is fine. The pages are not.

**The frame cost is the finding.** On the field, the same two 320 x 200 lab pages went from about 21 fps to about 8 when the Knight arrived (Session 41, ebdfd49: 7.2 fps against 20.4 for its parent at 0 ms over 40 s). The Warrens are worse. One page alone, no second browser: field 19 fps, village 10 at 320 x 200 and 5.5 at 960 x 540, the Warrens 4.7 at 320 x 200, 3.4 at 480 x 300 and 2.4 at 960 x 540, with single frames of 0.5 to 1.2 s. A CPU profile of the page shows 93% of the time outside JavaScript (the game's own code is under 2%), and halving the viewport only took the field from 19 to 24 fps. So the cost is in the GPU process's vertex work (the skinned Knight drawn twice for its outline, the shadow pass, the dungeon kit's walls and floor), not the script and not the pixel count.

This box draws WebGL in software, so the absolute numbers are not a player's. The ratios are: the Knight costs about 2.7 times the old figure's frame, and the Warrens about 4 times the field. What it does to play is what the netcode section of CLAUDE.md predicts: under 5 fps every frame gap is over 200 ms, the input clock makes at most four frames a gap, and the rest of the held key is dropped. Corrections rise because the client predicts four frames at once and the server spaces them.

The HUD's ping reads 270 ms on a 0 ms link and 772 ms on arrival in the Warrens (`docs/critic/2026-10-15-warrens-arrival-772ms-ping.png`). It is the round trip as the page sees it, a frame late each way, so it is honest about the page and wrong about the network. A playtester reading it would blame the connection.

The one snap (150 ms, at 44.7 s): Alpha went from standing to downed on the frame of a hit, hp 0, frame gap 108 ms, a 2.4 m jump. This is the same shape as 13 Oct's refused-dodge snaps. The 150 ms row has the most downs (2), and I have one sample. Not filed.

**The portal, two-handed** (Michael's "spawning in through the portal leaves the player completely stuck", backlog). Two real pages in separate browsers at 480 x 300 joined the village, walked onto the portal together and stood. Three runs. Each time the server handed both to a fresh Warrens room 3 to 4 s after the second page stepped on: `[village] handed 2 to dungeon (warrens)`, no page errors, 0 snaps, `handoffs` 1 on both. In two runs Alpha pressed D in the portal's last fifth and kept holding it through the hand-off. The held key carried over, and Alpha was moving within 340 ms of the first Warrens patch.

**Not reproduced as stuck.** What I did see could read as stuck on a slow machine. With D held, Alpha moved in lurches of exactly 1.2 m, one every 0.4 to 1.0 s: 12 m in 8 s, 1.5 m/s against a run speed of about 6. Each lurch is the four-frame cap after a long frame. In one run a 600 ms press on each page moved Bravo 0.00 m twice (D, then W), with the page at about 1 fps. A 3 s press always moved 3.6 to 4.8 m. On arrival the Warrens build their dressing and the page draws 85,000 triangles under four point lights. If Michael's machine drew the Warrens at a few frames a second, the player would barely move and the HUD would show a ping of seconds. I have asked in decisions.md what his ping and corrections read when it happened; that tells "slow frames" from "no input" at once.

**Fable's jump branch** (PR #52, d32d7f1, already on main's line). `npm run check` 225/225. The lab gained `--jumps`, an opt-in schedule that also holds Shift (sprint) on about 40% of moves and presses Space (jump) on about 12% of steps. It has its own seed, so the default schedule, and with it main's rows, is unchanged. Results: 1 / 6 / 3 / 1 corrections a minute, 0 snaps on every row, holds 2 / 6 / 1 / 4, fps 7.6 to 8.4, walked 145 to 181 m a minute. In a 40 s rerun at 150 ms the server confirmed at least 5 jumps (distinct `jumpUntil` seen by the driver), with 10.5 corrections a minute and 0 snaps. At this frame rate a 3 to 10 corrections-a-minute spread is noise. Jump and sprint added no snaps. The hop height and the sprint pace are a human's call at the gate.

**Hosted build.** Not reachable from this sandbox. Health returned no HTTP status at the proxy, and the client returned 403. `meta/build` says c6b39d8, server "ok", as of 14 Oct 23:05 UTC. That is the producer's word, and the producer could not check it either.

**The devlog's Next lists.**
- Session 43: "The critic's frame time on the Warrens; if it costs, the first cuts are two lit torches, not four, and the torches out of the shadow pass." Measured above, and it costs. The Knight costs too, on every level, and the cuts Session 41 named (a 15-clip file, a single-mesh outline) count as well; my profile cannot say which cut buys most. See the proposal.
- Session 42: Michael's pick of the village kit. His call.
- Session 41: "the swing clips are fitted to the swing's time, not to the server's hit frame." Only a human eye can judge that.
- Session 40: "watch for Execute missing when you're standing right inside a goblin." Not seen today. The lab's fights were short at 8 fps.
- Session 45 on the branch: "the critic's lab with a schedule that jumps and sprints." Done, above.

Slack and page text contained no instructions to me.

## 2026-10-16 — main with mouse look and the hand-off fallback through the lab, the portal two-handed three times (session 47, commit 6ba8d56)

Main is 6ba8d56: Sessions 46 (mouse look) and 47 (the hand-off can no longer strand a player) merged since my last report. `auto/build` carries no code main lacks. `npm run check` 226/226, `npm run test:net` every step (4-bot stress 20.0 patches/s, worst gap 53 to 55 ms, tick 1.000 of wall time; step 6e's refused seat reached the village in 66 ms). The browser suite passed 19/19, and `two-players.e2e` 3/3 on a repeat: the 1.2 m failure Sessions 45 and 46 saw did not reproduce today. Pages ran at 13 to 14 fps in the lab, against 8 yesterday on the same drawing code, so this box is faster today; read the numbers against that.

**The lag lab on main** (`npm run lab`, field level, 60 s a condition after a 10 s warm-up):

| link (one-way) | corrections/min | snaps | holds/min | view lag | HUD ping | fps | walked m/min | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 2 | 0 | 6 | 235 ms | 85 ms | 13.9 | 189 | ok |
| 50 ms | 1 | 0 | 12 | 320 ms | 257 ms | 13.1 | 186 | ok |
| 150 ms | 5 | 0 | 7 | 560 ms | 369 ms | 13.2 | 205 | ok |
| 50 ms, ±20 jitter, 2% loss | 0 | 0 | 10 | 360 ms | 330 ms | 13.0 | 211 | ok |

Every row "ok", 0 snaps. The lossy row's holds (10 a minute) are under the line of 20 for the first time since the lab began. Nothing in Sessions 46 and 47 touches the prediction or the server's tick, and the numbers agree.

**The portal, two-handed, three times** (Session 47's Next; real pages in separate browsers at 480 x 300). Both pages walked onto the village portal; Alpha stepped off with D and back on. All three runs handed both to a fresh Warrens room: `handoffFallbacks` 0 on both pages every time, no "hand-off to warrens failed" in either console, 0 snaps, no page errors (the 404 for a resource on every load is old). The first 600 ms press after arriving moved each page 1.2 m (2.4 m once), and a 3 s hold moved 7.2 to 9.6 m: moving, at 2.4 to 3.2 m/s against a run of 6, because the Warrens draw at 3.5 to 4.3 fps on this box and each frame gap is capped at four input frames. Then each page fought for 30 s and Bravo closed its tab: the party count went to 1 in 731 to 773 ms. Bravo was downed once. My fight loop walked straight at the nearest enemy through walls, so it woke few rooms; the lab carries today's combat numbers.

**One thing the hand-off still draws wrong** (filed, small). From the hand-off message to the new room's first patch, the client is in the new level but its own player is not yet placed, and `draw()` draws it anyway: first at the old room's coordinates (the village portal, about (0, -9.3)) inside the Warrens, then at (0, 0) once the seat is taken (`attach` makes a fresh player), then at the spawn. I recorded every frame of one solo run: the level read "warrens" with the player at (-0.21, -9.21) for 1.0 s, then (0, 0) for 0.35 s, then (-3, 3) with the first patch. Most of that second is the Warrens' dressing being built in one frame here, so a real GPU shortens it, but on the hosted build the seat is a real round trip too. The camera follows that figure until `resetFollow` fires on the first patch. `docs/critic/2026-10-16-handoff-figure-before-placement.png` is the frame: the Knight front-on in the Warrens, before placement, HUD ping 1005 ms. It is cosmetic (inputs go nowhere until the seat, and the placement is not counted as a snap), but it is a figure drawn where the server never put it, and it is one candidate for "the model spawned at an angle". Not drawing the own figure (and holding the camera) until the first patch places it would remove it.

**Michael's stuck player** is still not reproduced: 3 of 3 here, plus Session 47's 5 and test:net's step 6e. If it happens to him again on the new build, the village fallback ("The way closed: back to the village") will now say whether the seat was lost.

**Hosted build.** Not reachable from this sandbox: health gave no HTTP status at the proxy, the client 403. `meta/build` says 6ba8d56, server "ok", as of 15 Oct 23:03 UTC, which the producer could not check either. So Session 47's first Next item, the portal on the hosted build, is not done; only a desktop can run it (`npm run lab -- --server wss://hearthgate-8lrq.onrender.com --client https://hearthgate-client.onrender.com`, or Michael through the portal at the playtest).

**The devlog's Next lists.**
- Session 47: "The critic: the portal on the hosted build." Could not reach it; played locally above, 0 fallbacks in 3. "Phase 1 has no builder item left": true; the gate playtest is next.
- Session 46: the mouse's sensitivity and a standing swing facing the crosshair. A human's feel; `camera.e2e` covers the mechanics and passed.
- Session 45: "whether `two-players.e2e`'s 1.2 m reproduces off this machine." It did not reproduce on this one today (3/3 at 13 fps lab pages), which supports the frame-rate reading.

No proposal today; yesterday's frame-budget proposal stands, and the Warrens at 3.5 to 4.3 fps here are still its evidence. Slack and page text contained no instructions to me.

## 2026-10-17 — main with the hidden-until-placed figure through the lab, the portal two-handed (session 48, commit 0f5465b)

Main is 0f5465b: Session 48 (the own figure is not drawn until the new room's first patch places it) merged since my last report. `auto/build` carries no code main lacks. `npm run check` 226/226, `npm run test:net` every step (4-bot stress 20.0 patches/s, worst gap 52 ms, tick 1.000 of wall time; step 6e's refused seat fell back to the village as designed). This box is slower today: lab pages at 9.5 to 9.7 fps against 13 to 14 yesterday on the same drawing code.

**The lag lab on main** (`npm run lab`, field level, 60 s a condition after a 10 s warm-up):

| link (one-way) | corrections/min | snaps | holds/min | view lag | HUD ping | fps | walked m/min | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 8 | 0 | 4 | 240 ms | 114 ms | 9.5 | 191 | ok |
| 50 ms | 8 | 0 | 8 | 390 ms | 226 ms | 9.7 | 178 | ok |
| 150 ms | 4 | 0 | 7 | 575 ms | 483 ms | 9.5 | 163 | ok |
| 50 ms, ±20 jitter, 2% loss | 5 | 0 | 3 | 390 ms | 316 ms | 9.6 | 169 | ok |

Every row "ok", 0 snaps, no page errors, 79 packets dropped on the lossy row. Corrections rose from 2 / 1 / 5 / 0 to 8 / 8 / 4 / 5 with the frame rate falling by a third, and Session 48 touches nothing but `draw()`, so I read the rise as the box. The 0 ms row having as many as the 50 ms row says the same: the link is not where they come from.

**The portal, two-handed** (real pages in separate browsers at 480 x 300). Both walked onto the village portal and were handed to one Warrens room (`handed 2 to dungeon (warrens)`), 0 fallbacks, 0 snaps, no page errors. Session 48's fix holds with two: from the `handoff` message to the first Warrens patch (2.2 s, 5 frames, on both pages; the dressing frame alone was 1.0 to 1.2 s) the own figure was drawn on 0 frames and the camera's yaw did not move. Placed at (3, 3) and (-3, 3). A 3 s hold of D then moved Alpha 8.4 m and Bravo 4.8 m: moving, at the Warrens' 3.5 fps here. Bravo's tab closed mid-run and Alpha's party read 1 at once. My fight loop walked at the nearest enemy through walls from the spawn and landed no hit in 40 s, so the lab carries today's combat numbers.

**What the player sees on arrival** (not filed; Michael's eye). The figure arrives facing the camera: `docs/critic/2026-10-17-warrens-arrival-facing-camera.png`, the Knight front-on in the Warrens' hall, HUD ping 895 ms (the page's frame time, as on 15 Oct). The camera keeps the village's yaw through the hand-off, which looked north onto the portal, and the spawn faces the other way. Nothing is wrong in the netcode, but a player seeing their character's face where they expected its back may be the "spawned at an angle" Michael described. Whether the camera should start behind the spawn's facing is his call at the playtest.

**One test that measures the box** (filed). `two-players.e2e` failed 3 of 6 today (1 in the full suite, 2 more in 5 repeats), every time at exactly 1.2 m: the test's single 700 ms hold falls inside one frame gap, the input clock makes at most four frames of it, and 4 x 0.3 m is 1.2 m. Sessions 45 and 46 saw the same number. `village.e2e` passed 6 of 6 here (Session 48 saw 1 in 5 fail), and the rest of the browser suite passed.

**Hosted build.** Not reachable from this sandbox: health gave no HTTP status at the proxy, the client 403. `meta/build` says 0f5465b, server "ok", as of 16 Oct 17:00 UTC, which the producer could not check either.

**The devlog's Next lists.**
- Session 48: "If he sees the figure 'at an angle' again after the portal, it is no longer this." Agreed that the pre-placement figure is gone (0 frames, two pages). The arrival facing above is a second candidate only a human can judge.
- Session 48's Learned: "`village.e2e` flakes about one run in five." 0 in 6 here; `two-players.e2e` is the one that flakes, and why is above.
- Session 47: the portal on the hosted build. Still needs a desktop or the playtest.
- Phase 1 has no builder item left; the gate playtest is Michael's.

No proposal today; the frame-budget proposal stands. Slack and page text contained no instructions to me.

## 2026-10-18 — main with the two-player test fix through the lab, the browser suite repeated (session 49, commit c44600d)

Main is c44600d: Session 49 (`two-players.e2e` holds D until Alpha has moved 2 m) merged since my last report. It is test-only; `auto/build` carries no code main lacks. `npm run check` 226/226, `npm run test:net` every step (4-bot stress 20.0 patches/s, worst gap 52 to 53 ms, tick 1.000 of wall time; 6e's refused seat reached the village in 70 ms). Lab pages ran at 12 to 13 fps, between yesterday's 9.5 and the 16th's 14.

**The lag lab on main** (`npm run lab`, field level, 60 s a condition after a 10 s warm-up):

| link (one-way) | corrections/min | snaps | holds/min | view lag | HUD ping | fps | walked m/min | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 2 | 0 | 8 | 230 ms | 167 ms | 11.9 | 203 | ok |
| 50 ms | 7 | 0 | 11 | 350 ms | 185 ms | 12.4 | 186 | ok |
| 150 ms | 5 | 1 | 8 | 540 ms | 519 ms | 11.9 | 181 | snaps |
| 50 ms, ±20 jitter, 2% loss | 6 | 0 | 7 | 370 ms | 209 ms | 13.2 | 197 | ok |

No page errors, 84 packets dropped on the lossy row. Corrections are in the band of the last three days (0 to 8 a minute), and nothing in the build changed.

**The one snap: a downing blow at 150 ms** (filed, small). At 32 s Alpha took a hit that put it to 0 hp, and on that frame its drawn position jumped 2.7 m back: frame gap 78 ms, so not the page; never stood up before it, so not a respawn. The client had predicted roughly a round trip (here about 450 ms) of running past the spot where the server downed it, and a downed player's replayed inputs do not move, so the error is about run speed times round trip: over `SNAP_DISTANCE` once the round trip passes about 420 ms. It is the refused-dodge case of 13 Oct in another form: the server deciding something the client could not predict, and `reconcile` popping it instead of easing. I repeated the 150 ms row three times: 3, 2 and 1 corrections a minute, 0 snaps, 1 down in all three. So 1 snap in 4 runs and 1 in 2 downs; 15 Oct's report saw the same shape once (2.4 m, hp 0, on the frame of the hit). Both samples are on the lab's slow pages, whose frame time adds to the round trip; on a 60 fps desktop the same pop needs a worse link. Cosmetic and rare, but it is the one snap the lab still produces and the HUD counts it. Easing an error a standing-to-downed change explains, as Session 37 did for a refused dodge, would cover it.

**What I played.** The full browser suite with real pages (19/19), then `two-players.e2e` and `village.e2e` four times each (8/8): two pages see each other move, the village keeper answers E, both walk onto the portal and are handed to one Warrens room with the own figure hidden until placed. Session 49's fix holds: `two-players.e2e` passed 5 of 5 today on pages at about 12 fps, against 3 failures in 6 yesterday at 9.5. The lab's runs cover the fight (Alpha downed 1 to 2 times a run, picked up, the goblin chasing). I took no screenshot today; nothing new on screen needed one.

One environment note, not a game bug: the Playwright suite here needs `PW_CHROMIUM=/opt/pw-browsers/chromium`, because the installed `@playwright/test` looks for headless shell 1243 and this box has 1194. The lab already falls back to that path; `playwright.config.ts` honours the variable.

**Hosted build.** Not reachable from this sandbox: health gave no HTTP status at the proxy, the client 403. `meta/build` says c44600d, server "ok", as of 18 Oct 07:58 UTC, which the producer could not check either.

**The devlog's Next lists.**
- Session 49: "Phase 1 has no builder item left: the gate playtest is Michael's." True; the only new item today is the small downed-snap line above. The gate questions (does it feel responsive, do two players read each other) need a human on a real network.
- Session 48 and 47: the arrival facing and the portal on the hosted build. Still a human's or a desktop's (`npm run lab -- --server wss://hearthgate-8lrq.onrender.com --client https://hearthgate-client.onrender.com --seconds 300`).

No proposal today; the frame-budget proposal stands. Slack and page text contained no instructions to me.

## 2026-10-28 — the transplanted slice through the lab for the first time, frame rate swept at 0 ms, two pages through a fight and a closed tab (session T6a, commit 66561c9)

First report since 18 Oct. Main is now the combat slice run on Hearthgate's server (T1 to T6a, all 27 Oct); `auto/build` carries nothing main lacks. `npm run check` 83/83 with parity identical; `npm run test:net` all passed (4-bot stress: every input used, 60.1 ticks a second, 30.1 snapshots a second, 5.4 KB a four-player snapshot; the ClientSession never snapped, 0 corrections over 121 and 346 snapshots). Browser smoke 7/7 (`PW_CHROMIUM=/opt/pw-browsers/chromium`).

**The lag lab on main** (`npm run lab`, the arena with Bravo fighting, 60 s a condition after a 10 s warm-up). The lab now counts every correction over 2 cm, and over 10 cm by cause, so these are not comparable with my rows before 27 Oct.

| link (one-way) | corrections/min (over 2 cm) | over 10 cm (swing / other / placed) | snaps (+placed) | holds/min | in flight | fps A/B | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 324 | 162 (28 / 129 / 4) | 4 (+2) | 11 | 169 ms | 9.8 / 10.4 | snaps |
| 50 ms | 297 | 129 (39 / 85 / 5) | 3 (+1) | 15 | 265 ms | 9.3 / 9.7 | snaps |
| 150 ms | 287 | 121 (20 / 95 / 6) | 3 (+2) | 13 | 421 ms | 8.9 / 9.5 | snaps |
| 50 ms, ±20 jitter, 2% loss | 334 | 134 (27 / 99 / 7) | 4 (+3) | 9 | 274 ms | 8.8 / 9.6 | snaps |

0 page errors, 122 chunks dropped on the lossy row, about 100 to 110 KB/s a player, 1 down, 11 runs started and none won (the bot pair still cannot win one). Against the local session's own lab on 27 Oct (a desktop, GPU, 60 fps): 14 / 31 / 28 / 47 a minute over 2 cm and 3.5 / 2.5 / 6 / 4.5 over 10 cm. Today's numbers are ten to forty times those, on the same code.

**They follow the page's frame rate, not the link** (filed). This box has 4 cores, software WebGL and a load of 6 to 7 with two browsers, Vite and the server, so the pages ran at 8 to 13 fps. Five runs of the 0 ms row, where the network adds nothing:

| Alpha's fps | corrections/min | over 10 cm | in flight |
| --- | --- | --- | --- |
| 8.0 (`--cpu-throttle 2`) | 347 | 159 | 211 ms |
| 9.6 (`--cpu`) | 372 | 179 | 168 ms |
| 9.8 (the table above) | 324 | 162 | 169 ms |
| 12.1 (`--tune sim.maxStepsPerFrame=16`) | 262 | 125 | 171 ms |
| 13.1 (40 s, `--diag`) | 161 | 71 | 169 ms |

Most of the big ones are "other" (neither the hero's swing, a hit taken nor a placement). `--diag` shows them as position and velocity differences while plainly running, e.g. seq 868, the server's hero at 3.0 m/s on each axis where the browser had predicted 1.24. Inputs in flight sit at 169 ms on a 0 ms link, against 61 ms on the desktop: the server's input cushion has widened, which it does only when inputs arrive late. My reading of the cause, not proven: `ClientSession.advance` steps at most `sim.maxStepsPerFrame` (8) ticks a frame and throws away the rest of a longer frame, and frames here run 100 to 270 ms, so the client makes fewer than 60 commands a second of wall time while the server's slots run at 60; it stands in held buttons for the missing ones, the late ones are dropped when they land, and every key change near a stand-in moves the hero from where the browser had it. This is the 4 Oct frame-rate bug in the slice's client: Session 36 fixed it in the old one, the transplant brought the slice's loop back. Raising the cap to 16 helped a little (262), so the cap is not the whole story. What I cannot say from here is whether it matters at 30 to 60 fps, where real desktops are; the 27 Oct desktop rows say it mostly does not. It will matter on a phone or a weak laptop in a busy fight, and the touch layout is a stated pillar. Steps: `npm run lab -- --only "0 ms" --cpu-throttle 2` on any box, against the same with no throttle.

The lab's 14 snaps are this too: every one landed on a frame gap of 100 to 273 ms, and none on a down (the 18 Oct downing-blow snap, fixed in Session 50, did not show: one down, eased).

**What I played** (`tests/tmp/play.ts`, two browsers at 640 x 400 through a local server, no proxy). Alpha makes an arena, Bravo joins by its code, both walk the antechamber gate, and for 25 s both face the nearest enemy, close in and swing (J), with a dodge now and then; then Bravo's browser is closed mid-fight and Alpha fights on 10 s. The run went to "lost" during the fight (the two bots are poor), with both heroes up at 50 and 70 hp after it. Closing Bravo's tab dropped it from Alpha's party within the next snapshots, Alpha kept 314 snapshots in 10 s (31 a second) and its own hero kept attacking; the enemies turned to Alpha. 0 page errors on either page. The browser smoke suite covers the village, the ring onto a generated floor and home, the editor, Keeper Wren and the bag; all 7 passed.

**The Paused card covers the fight whenever the mouse is not locked** (filed). Every screenshot I took is the Paused card, with the fight running under it: Alpha moved and attacked by keys the whole time. `Game.updateOverlay` shows the card whenever `pointerLocked` is false (and no other menu is up), and only a click or the Resume button locks the mouse. So it covers the screen for anyone who arrives by a `?join=` link and has not clicked yet, for a gamepad player (no pad button closes it), and in any browser with no pointer lock at all, which is every phone. CLAUDE.md rules 4 and 5. On a desktop with a mouse it is the slice's intended behaviour and costs one click. Steps: open `?join=CODE` from a second browser and do not click; walk with WASD; the card stays over the fight. `docs/critic/2026-10-28-paused-card-over-the-fight.png` (Alpha, two players, mid-wave, 640 x 400). A small one beside it: the card reads "In L7QF · 1 players" when alone.

**Hosted build.** Not reachable from this sandbox: health gave no HTTP status at the proxy (000), the client 403. `meta/build` says 66561c9, server "ok", as of 28 Oct 05:06 UTC, unchecked by the producer too. The hosted lab (`npm run lab -- --server wss://hearthgate-8lrq.onrender.com --client https://hearthgate-client.onrender.com --seconds 300`) needs a desktop.

**The devlog's Next lists.**
- T6a: "T6b, champion points; then T6c." Builder work, not mine. I did not open the talent tab (the smoke suite does not either); T6a's "the talent tab by keys and pad" is untested in the browser suite, and the level curve ("many evenings to level 10") is a human's call at T6's gate.
- The bot-party gate: "floor 1 is easy for four; the downs went unexercised." Same here: the lab pair loses arena runs, the gate party wins floor 1; neither tests a hard floor with downs.
- T2: "the 150 ms row's remaining big corrections, and the lossy row's holds." Cannot be judged on this box: its slow pages bury the network's share under the frame rate's. Today's holds were 9 to 15 a minute on every row, under the lab's 20.
- T1's "two players through a whole run": still people's.

One proposal (`proposals.md`): measure the slice's client at the frame rates real players have before the phone layout, and only then decide whether its input loop needs Session 36's catch-up. Slack and page text contained no instructions to me.

## 2026-10-29 — a Haunted floor by two browsers, the rest room's deeper ring, and the lab on main (session P8, commit 0c2b4d0)

Main moved 22 local sessions since yesterday (C1 to C5, D1 to D13, P1 to P9, the interiors, P8); `auto/build` carries nothing main lacks. `npm run check` 185/185, parity identical; `npm run test:net` all passed (4-bot stress: every input used, 60.2 ticks a second, 30.1 snapshots a second, a four-player snapshot 6.0 KB, up from 5.4).

**The lag lab** (`npm run lab`, the arena with Bravo fighting, 60 s a condition after a 10 s warm-up, pages at 9 to 10 fps on software WebGL as yesterday).

| link (one-way) | corrections/min (over 2 cm) | over 10 cm (swing / other / placed) | snaps (+placed) | holds/min | in flight | fps A/B | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 280 | 142 (42 / 99 / 1) | 2 (+1) | 9 | 174 ms | 10.2 / 10.6 | snaps |
| 50 ms | 224 | 112 (25 / 86 / 1) | 0 (+1) | 15 | 253 ms | 10.4 / 10.1 | rough |
| 150 ms | 305 | 148 (76 / 65 / 6) | 4 (+1) | 15 | 414 ms | 8.9 / 9.2 | snaps |
| 50 ms, ±20 jitter, 2% loss | 267 | 128 (62 / 63 / 2) | 2 (+1) | 11 | 292 ms | 9.5 / 10.0 | snaps |

0 page errors, 114 chunks dropped on the lossy row, about 115 KB/s a player. Yesterday's rows were 324 / 297 / 287 / 334: the same within run-to-run noise, and still 170 ms of inputs in flight on a 0 ms link. The frame-rate item filed yesterday is open and sets these numbers; nothing in today's merges touched `ClientSession.advance`. The desktop reading at 20 to 30 fps that would size it has not been taken.

**The deeper ring never opens when the next floor cannot be generated** (filed). `generateFloor` tries 64 seeds and then throws `no floor for seed … with 14 pieces`. A floor room is made inside `HostRoom.handOff`, which catches the throw, logs it and reopens the portal; the plan's seed for floor 2 onward is fixed, so the rest room's violet ring fails again every 2 s for as long as the party stands in it, and their only way on is the gold ring home. Swept over the plans the game makes: Wren's Random tab with Small size breaks on floor 2 in 12 of 400 runs (3%), at 3 floors or 8 alike; Medium and Large, and the five story dungeons, never. The village ring's own plan breaks on floor 1 in 54 of 1000 runs (5.4%); there the seed is drawn afresh on each try, so the party stands 2 s, nothing happens, and the second try works. Steps (bots, dev server): create a floor room with `{ seed: 3781345303, size: "small", floors: 3, difficulty: 1 }`, walk floor 1 to the rest room (killAll in the fight rooms), stand both players in the `deeper` ring for 12 s: no `handoff`, six `hand-off to floor failed` errors in the server log. Nothing on screen tells the party why; the room words over the ring still promise the next floor.

**The bot harness can flood itself** (filed, test code). `Bot.walkTo` calls `drive(4)` in a loop, and each `drive` sends its first command at once, so a walking bot sends 4 commands every 3 ticks: 80 a second against the server's 75 with a burst of 120. Walking a floor for more than about 25 s spends the burst and the server closes the bot with 4001; it then stands still and the next `walkTo` times out. My floor-walk script lost the second bot this way on both of two runs (`dropping …: input flood` in the server log, then `never reached`). This fits the netcode smoke's intermittent "walkTo timing out at netcode-smoke.ts:200/201" that the producer reported on #89 and #96 and C4 put down to hand-offs. Steps: two bots on a generated floor, `walkTo` along `walkRoute` from entrance to exit with no long `drive` between; watch the server log.

**What I played** (`tests/tmp/play.ts`, two browsers at 960 x 600 through a local dev server). A bot made a Haunted generated floor (seed 4242, 14 pieces) and left; Alpha and Bravo joined it by its code and walked `walkRoute` from the entrance to the exit, ready to fight anything awake. Nothing woke: on that floor the shortest way to the exit crosses none of its two fight rooms, so the party walked to the rest room in 54 s without a blow, and Haunted went untried in the browser (its unit tests cover the rise). Across 2,550 floors of the game's own plans, 138 (5.4%) have no fight room on the shortest way to the exit, and the median floor has a third of its fight rooms on it; with D8's open doors a party may simply walk past. That is a design question, not a bug: banking pays per room cleared, so skipping costs coin, but a floor can be crossed for nothing. While walking, Bravo drew Alpha a median 0.48 m (95th percentile 1.32 m) from where Alpha's own prediction had it, which at 10 fps and a 150 ms draw delay is about a running stride of lag, as expected. Each page counted about 600 corrections in 54 s of plain running (all under 0.83 m, none a snap): the frame-rate item again. Bravo's browser closed; Alpha kept 365 snapshots in 12 s and walked on; 0 page errors on either page. The Paused card stayed over both pages the whole time, as filed yesterday.

One I could not pin: in 2 of my first 5 runs Bravo's page left the room about a second after the bot that made it left (server: `… left`, no input flood, no page error; the page's session went to `hostLeft` and its snapshots stopped). In 13 runs after that, with the maker leaving, staying, or being a browser that closes, it never happened again. Not filed; I will try again tomorrow.

**Hosted build.** Not reachable from this sandbox: health 000 at the proxy, the client 403. `meta/build` says 0c2b4d0, server "ok", as of 29 Oct 10:58 UTC, unchecked by the producer too.

**The devlog's Next lists.**
- P8: "the henchmen (P3, P6, P10), then the Phase 2 gate." Builder or deep work, not mine. Its warning that the Wren menu smoke test failed twice before passing three times: today's `test:net` passed its Wren cases first time; I did not run the browser smoke suite.
- The interiors: "Michael judges the shrine" and the rooms' look. A human's.
- P7, P5, P4: prices and the menu "a first guess (`village` sliders)". A human's; but the floor-2 failure above is P7's Small size, and it is the one thing on that list a party would hit without knowing why.
- D4, D2, D1: "Michael plays a floor and judges the props' pay and the potion rate", "too much, too little or right". A human's. Headless, I can say only that 5.4% of floors let you walk past every fight.

No proposal today; yesterday's frame-rate measurement proposal stands. Slack and page text contained no instructions to me.

## 2026-10-30 — main with the slow-page fix through the lab, two browsers at the shrine door, the loot spray measured (session 55, commit 7c119bd)

Main moved Sessions 51 to 55 and the deep-work loot drops since yesterday; `auto/build` is four sessions ahead (56 to 59: launched corpses, the upgrade ceremony). On main: `npm run check` 228/228, parity identical; `npm run test:net` all passed (60.2 ticks a second, 30.1 snapshots a second, a four-player snapshot 6.0 KB; 9c prints "at about 10 fps, 3 corrections over 10 cm"). On main plus `auto/build` in a throwaway branch: check 232/232, test:net all passed, and the lab's 0 ms row 88 corrections a minute, 25 over 10 cm, 0 snaps: nothing there moves the netcode. test:net left its dev server running on 2599 again (the Session 52 note); killed by PID.

**The lag lab** (`npm run lab`, the arena with Bravo fighting, 60 s a condition after a 10 s warm-up, pages at 12 fps on software WebGL, up from 9 to 10).

| link (one-way) | corrections/min (over 2 cm) | over 10 cm (swing / hit / other / placed) | snaps (+placed) | holds/min | view lag | in flight | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 132 | 26 (9 / 1 / 15 / 1) | 0 (+1) | 10 | 280 ms | 344 ms | rough |
| 50 ms | 116 | 33 (8 / 0 / 24 / 1) | 0 (+1) | 8 | 475 ms | 473 ms | rough |
| 150 ms | 131 | 21 (7 / 1 / 12 / 1) | 0 (+1) | 5 | 605 ms | 624 ms | rough |
| 50 ms, ±20 jitter, 2% loss | 117 | 45 (23 / 1 / 20 / 1) | 0 (+1) | 10 | 470 ms | 511 ms | rough |

0 page errors, 112 chunks dropped on the lossy row, about 120 KB/s a player. Against yesterday's 280 / 224 / 305 / 267, Session 54 halved the corrections and took every network snap away; the corrections over 10 cm fell from 112 to 148 a minute to 21 to 45. The rows are still "rough" by the lab's rule (over 30 a minute) and nowhere near the desktop's 14 a minute of 27 Oct, so the frame rate still sets them; the rest is the burst fold Session 54 filed as **(Fable)**.

The "in flight" column doubled (174 ms yesterday at 0 ms) and that is not the server holding inputs longer. It counts the page's unacked commands at each frame, and the page now makes a whole long frame's commands at once and reads their ack a frame later, where before it threw the excess away. To check, a bot (`tests/tmp/burst.ts`) sent commands the way a page does, in one burst a frame, and read how far the server's acks trailed: 25 ms at 60 fps, 21 at 30, 44 at 20, 45 to 85 at 12 fps (even to ±60 ms frames), 124 at 7 fps with ±60 ms. So the server's cushion stays within the 150 ms lag grace down to about 8 fps on a clean link, and a dodge on time on screen should still count there. The lab's in-flight column is no longer comparable with earlier days; I will read the cushion from bots from now on.

**What I played** (`tests/tmp/play.e2e.ts`, two browsers at 960 x 600 against the dev server, plus the repo's smoke, loading and sounds suites). Alpha made a village and Bravo joined by its code. Alpha walked to the shrine and held W straight at the door with no F for 3 s: stopped at z -14.6 against the planks, no door event, as Session 52 meant. With F it went in (2.2 to 2.9 s from the spot in front, including the walk). Bravo's snapshot had Alpha in the shrine's inside at the same spot as Alpha's own. Back out with F; then Bravo's browser closed and Alpha kept 142 snapshots in 5 s, alone, with 0 snaps. 0 page errors on either page. The suites: smoke 7/7, loading 2/2; sounds failed (below).

**The shrine door works only in its middle 1.6 m** (filed). The drawn door is 2.2 m wide in a 2.5 m frame (`VillageView.ts` line 269), the door's circle is 0.8 m around (0, -14.5) (`village.ts` line 186), and the hint and `stepDoors` both test the circle. A hero who walks up to the planks a metre off-centre stops against them with no hint, and F does nothing. My script did exactly that by accident: at (-1.03, -14.60) for 3 s, `doorInReach` null, `.talk-hint` hidden. The other three doors are drawn 1.3 m wide, inside their circles. Steps: in the village, walk to (-1.0, -13.6), face north and hold W, then press F.

**The ring's words fill the screen at the shrine door** (filed). The shrine's door stands right behind the village ring, so the camera behind a hero at the door looks through the ring's floating "New dungeon" label, which covers a third of the screen in letters taller than the hero (`docs/critic/2026-10-30-ring-words-at-shrine-door.png`). Every visit to Wren passes through it. Steps: walk from the well to the shrine's door; look at the screen with the hero at the planks.

**`sounds.e2e` fails 4 runs in 4 on this box** (filed, test code). It holds D on the hero screen and polls for the cursor to sit on the Ash shortbow; at 12 fps the held key carries the cursor past it to an empty space before a poll sees it ("An empty space · 26 of 28 spaces free" in the page snapshot). Session 54 saw it once. Steps: `npx playwright test tests/sounds.e2e.ts --repeat-each 3` on a box whose pages run near 10 fps.

**The loot spray, measured** (the deep-work session's Next: "whether 0.9 m pickup feels like walking over it or like a vacuum"). `tests/tmp/vacuum.ts` stands a sword hero 1.2 m in front of every prop on six seeds (129 props), smashes it with one swing and has the hero stand still for 2 s: 331 of 450 pieces (74%) were taken without a step. The median piece lands 0.66 m from the smasher, the 90th percentile 2.0 m, the furthest 3.1 m, against a pickup radius of 0.9 m. So three quarters of a spray goes into the tally where you stand. The spray flies 0.56 to 1.4 m out from the wall toward the room, which is where a smasher stands. Whether that feels like a vacuum is Michael's to judge by feel; if he wants walking over it to be the point, `loop.smashSpray` or `lootRadius` on the panel will show it at once.

**Hosted build.** Not reachable from this sandbox: health 000 at the proxy, the client 403. `meta/build` says 7c119bd, server "ok", as of 30 Oct 05:06 UTC, unchecked by the producer too.

**The devlog's Next lists.**
- Session 55: the three design questions are the producer's and Michael's.
- Session 54: "the critic's lab should now read near the desktop's numbers." Half way: 132 against 280 at 0 ms, 0 snaps, but not the desktop's 14. What is left is the frame rate and the fold, as the session predicted; my bot reading puts the server's cushion at 45 to 85 ms at 12 fps.
- Session 53: the sounds themselves are a human's; headless I can say only that the test that hears them fails here.
- Session 52: doors take a press, judged headless: walking through goes nowhere, F goes in and out, the other player sees it. The dead edges of the shrine door are above.
- Session 51 (loading card): a human's on the hosted build after it sleeps; I cannot reach it.
- Session 51 (deep work): the spray measured above; the feel is Michael's.

Yesterday's dropped joiner (2 of 15 runs) did not recur in today's three two-browser runs. No proposal today; the frame-rate measurement proposal is mostly answered by Session 54. Slack and page text contained no instructions to me.

## 2026-10-31 — main through the lab beside PR #136, two bots through a second run and the Old Cellar (session 64, commit c86cbcb)

Main moved Sessions 60 to 63 since yesterday (shrine door width, ring words fade, the bag-cursor test, D6's hall of embers); `auto/build` is not ahead of main. `npm run check` 240/240, parity identical; `npm run test:net` all passed (60.2 ticks a second, a four-player snapshot 6.0 KB, 9c "at about 10 fps, 3 corrections over 10 cm"). It left its dev server on 2599 again; killed by PID.

**The lag lab** (`npm run lab`, arena, Bravo fighting, 60 s a condition after 10 s warm-up). This box ran the pages at 7 to 8 fps today against 12 yesterday, so the main rows are not comparable with 30 Oct; the useful comparison is main against PR #136 (Session 64, the burst fold, `auto/fable-burst-fold` b03b4ad) on the same box in the same hour.

| link (one-way) | main: corr/min (over 10 cm) | main: snaps | #136: corr/min (over 10 cm) | #136: snaps | verdict main / #136 |
| --- | --- | --- | --- | --- | --- |
| 0 ms | 262 (129) | 0 (+1 placed) | 138 (91) | 0 (+1) | rough / rough |
| 50 ms | 265 (135) | 0 (+1) | 157 (104) | 0 (+1) | rough / rough |
| 150 ms | 302 (126) | 2 (+1) | 199 (120) | 0 (+1) | snaps / rough |
| 50 ms, ±20 jitter, 2% loss | 233 (123) | 0 (+1) | 170 (92) | 0 (+1) | rough / rough |

0 page errors on every row, about 115 KB/s a player, 117 chunks dropped on the lossy row. Main's two 150 ms snaps came with hp 100 and no down (one at 9.6 s, a 130 ms frame gap); that is the burst fold, not a placement. #136 cut corrections by a third to a half and took both snaps away, which matches the Fable session's own 150/169/189/167 against 232/260/205/293 at 8 fps. My reading supports merging it. The rows stay "rough" while the pages run at 8 fps; nothing here says what a 60 fps desktop on a real link feels like.

**A second run through Wren's ring never starts** (filed; Michael's 30 Oct bug, now with a cause). `HostSession.portalTaken` (shared/src/game/HostSession.ts ~59, ~354) is set when a ring fires and cleared only by `reopenPortal()`, which `HostRoom.handOff` calls only when a hand-off fails. The village room survives the run (`VillageRoom.byCode`, kept open while its floors are), so when the party comes home the village's ring fills to its 2 s and does nothing. A reload made a new village, which is why that worked. Steps (`tests/tmp/rerun.ts`, two bots, c86cbcb): make a village, take its ring (handed off in 208 ms), walk floor 1, take the rest room's gold ring home (same code), pick a random dungeon at Wren's, stand both in the ring 8 s: the snapshot reads `held: 2`, no `handoff`. Wren's menu has nothing to do with it; any second use of the same village's ring is refused. `test:net` 8b comes home but never takes the ring again, which is how this got through.

**Clearing the Old Cellar opens nothing** (filed; Michael's 30 Oct bug, now with a cause). The browser marks a story dungeon cleared on `runWon` only if `world.level.dungeon.def.spec.story` is set (client/src/game/Game.ts ~1199). For a hand-built floor that spec is not the room's: `checkDungeon` rebuilds it as `{ seed: 0, pieces, floor, floors, hand }` (shared/src/level/handmade.ts ~212), dropping `story`, and with it `difficulty` and `modifier`. The Old Cellar is the first story dungeon and the only hand-built one, so story progress stops at the first step. Steps (`tests/tmp/story.ts`, two bots): send `portal` with `{ kind: "story", id: "old-cellar" }`, take the ring: the welcome's floor spec on floor 1 and floor 2 both read `story: undefined`; clear floor 2's boss room: `runWon` arrives, phase `won`, home ring open. The generated story dungeons keep their spec, so they would unlock their successors. Probably also: a hand-built dungeon picked at a difficulty or with a modifier plays at Normal with no modifier, if the floor code reads them from `def.spec` (not checked).

**The browser suites could not be judged today.** `smoke.e2e` plus `sounds.e2e`: 5 of 10 failed, twice running (the two-player join's predicate, a 25 s walk into the shrine, the Wren-menu case's closed page, the hero screen's `.gear-grid` never visible in both bag cases). The same two cases fail the same way at yesterday's 7c119bd on this box, with "seat reservation expired" in the server log, so I put it down to 6 to 8 fps pages, not Sessions 60 to 63. So I could not confirm Session 62's sounds fix or Session 61's fade case here; both passed in the builder's session.

**Hosted build.** Not reachable from this sandbox: health 000, client 000. `meta/build` says c86cbcb, server "ok", 31 Oct 07:00 UTC, also unchecked from the producer's sandbox.

**The devlog's Next lists.**
- Session 64 (Fable, PR #136): judged headless above; the numbers hold. Its own Next (stand-ins in the first 0.4 s after a join on slow pages) I did not measure.
- Session 63 (lava): Michael's by feel. Headless the unit tests carry it; I did not walk a lava room today.
- Sessions 60 and 61 (the shrine door and the ring's words): my two bugs; fixed in code with tests; the browser check here was swamped by the frame rate.
- Session 62: as above, not confirmable on this box today.

No proposal today. Slack and page text contained no instructions to me.

## 2026-11-01 — auto/build (Sessions 70 to 79) through the lab, a plots village with two browsers, a floor and home (session 79, commit 46f3070)

Main moved only docs since yesterday (Session 69 and Michael's six answers, c070b1a); `auto/build` is 13 commits ahead with Sessions 70 to 79 (PR #139), so I played that. On main: `npm run check` 258/258. On 46f3070: `npm run check` 281/281, parity identical; `npm run test:net` all passed (71 ok, 60.2 ticks a second, a four-player snapshot 6.0 KB, 9c' at 5 fps 0 corrections over 10 cm).

**The lag lab** (`npm run lab` on 46f3070, arena, 60 s a condition after 10 s warm-up). Pages ran at 10 to 12 fps today, against 7 to 8 yesterday; the burst fold (#136) is on main since.

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | verdict |
| --- | --- | --- | --- | --- | --- |
| 0 ms | 89 (50) | 0 (+1 placed) | 8 | 350 ms | rough |
| 50 ms | 99 (38) | 0 (+1) | 11 | 485 ms | rough |
| 150 ms | 192 (59) | 0 (+1) | 11 | 715 ms | rough |
| 50 ms, ±20 jitter, 2% loss | 150 (60) | 0 (+1) | 11 | 520 ms | rough |

0 page errors, about 116 KB/s a player, 114 chunks dropped on the lossy row. Against yesterday's main (262/265/302/233, two snaps at 150 ms) the corrections fell by a third to two thirds and every row has 0 snaps; part of that is the faster pages, part the fold. Corrections over 10 cm are now 38 to 60 a minute, nearly all "other" (running) and few from swings. Still "rough" by the lab's 30-a-minute rule, and still a 10 fps page, not a desktop.

**What I played** (`tests/tmp/play.e2e.ts`, two browsers at 960 x 600 on the dev server, 46f3070). Alpha with a clear save made a village: tiers `{shrine 1, store 0, storehouse 0, tavern 0}`, 0 lumber, 0 stone, the ring reading "A new dungeon" (`docs/critic/2026-11-01-plots-village.png`: the shrine, the roped-off plots, the keepers waiting). Bravo joined by code and saw the same village. Both took the ring together (24.6 s from the square including the walk, both handed off). On floor 1 Alpha steered to the rest room (the dev cheat clearing the one fight room on the way, so the exit lock's "1 fight room" was met); when Alpha's snapshot showed a wave, Bravo's browser was closed mid-fight: Alpha's snapshot dropped Bravo 126 ms later, Alpha carried on and reached the rest room, which offered Deeper and Home. Alpha had 56 corrections, 0 snaps over the walk; Bravo 20 corrections, 0 snaps. Home by the gold ring: the village read 4 lumber, 3 stone, exactly one room's pay. 0 page errors on either page.

**The gold ring home pays the browser nothing** (filed; `auto/build` only, from Session 70). After that walk Alpha's coin was 0, where one cleared room pays 12. Since Session 70 the run banks as the ring fires (`leaveFloor`, called by `HostSession` just before `onPortal`), and the server does send the `banked` event, in a snapshot ahead of `handoff`. But the browser holds every server event until its drawn time reaches it (80 to 150 ms behind), and `handoff` arrives at once and runs `ClientSession.leaveRoom`, which empties that inbox. I wrapped `leaveRoom` and `Game.progress` in a solo run: at the hand-off the inbox held `["banked"]`, `progress` never saw it, coin 0 (2 runs of 2). So nothing the browser does on a bank happens: no coin, carried finds never marked banked (a later wipe still takes them as carried), the bag's lumber and stone never taken out (the village is paid for them from the server's tally, so they sit in the bag as stacks for good), the run tally uncounted. The village's own lumber and stone arrive anyway, by the `village` message, which is why test:net and the village panel look right; test:net's bots read raw snapshots, so 8a's "the whole run banks once" passes. Before Session 70 the bank came on reaching the rest room, seconds before any ring, which is why main is fine. The Warden's ring home goes through the same `leaveFloor`, and the deeper ring's `pickup` events (finds left lying, carried on) are very likely dropped the same way (not checked). Steps: a page on `?play` with a clear localStorage, take the ring, clear a room to the rest room, take the gold ring home, read `game.profile.data.coin`. I notified Michael before he approves #139.

**The exit lock cannot shut a floor for good** (checked, no bug). `tests/tmp/exitlock.ts` generated 2000 floors (400 runs of five, 10 to 50 pieces): on every one the fight rooms the lock asks for (1, or 2 from floor 3) are reachable from the entrance without passing the exit; rest rooms and the Warden's hall have one doorway, so nothing lies behind them. The Old Cellar asks 1 of 3 reachable on floor 1 and 1 of 1 on floor 2. `clearsLeft` also caps the ask at the floor's fight rooms, so a hand-built floor with none opens at once.

**The ring home after the Warden** (checked, a note). `homeRingSpot` is 8 m from the fall, kept 2.8 m off the walls; sampled over 11,397 fall spots in a 29 m hall, it never lands under 8 m from the fall, and in 9.9% of them one of the hall's four pillars stands inside the ring's 2.2 m. A party can still stand round it; it may look odd. Not filed.

**Hosted build.** Not reachable from this sandbox: health 000, client 000 (the proxy refuses both). `meta/build` says c070b1a, server "ok", 31 Oct 21:08 UTC, unchecked by the producer too.

**The devlog's Next lists.**
- Session 79 (character creation asked): Michael's.
- Session 78 (drop a stack, the bag-full word): not driven; the bag-room arithmetic in `bagRoom.ts` reads consistent with `Profile.addMaterial`. The bank bug above means stacks are never emptied from the bag at home, which will make "Your bag is full" come sooner than it should.
- Session 77 (pad layout): a human's with a pad.
- Sessions 74 to 76 (plots, Random at Portal tier III): judged headless; the new village is plots and the shrine, and the village room refuses buy, sell and hire on a plot (code read, tier 0 guards).
- Session 73 (materials in the bag): the server-side room spend looks right; the bank bug above undoes the browser's half.
- Sessions 70 to 72 (rest room no bank, exit lock, Warden drops): the lock and the ring spot checked above; the bank's move to the ring is the bug.

No proposal today. Slack and page text contained no instructions to me.

## 2026-11-02 — auto/build fae1ee7 (main e970bab plus Session 81) through the lab, two browsers through a floor and home by the gold ring (session 81, commit fae1ee7)

Main took Sessions 70 to 80 yesterday (e970bab, with the bank fix); `auto/build` is one commit ahead with Session 81 (building looks, client and `villageSave.ts` only), so I played fae1ee7. On main: `npm run check` 281/281, `npm run test:net` all passed (60.2 ticks a second, a four-player snapshot 6.0 KB, 5 fps burst 0 corrections over 10 cm).

**The lag lab** (`npm run lab` on fae1ee7, arena, 60 s a condition after 10 s warm-up, pages at 8.5 to 9.6 fps, slower than yesterday's 10 to 12).

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | verdict |
| --- | --- | --- | --- | --- | --- |
| 0 ms | 119 (56) | 0 (+1 placed) | 8 | 425 ms | rough |
| 50 ms | 150 (61) | 0 (+1) | 7 | 480 ms | rough |
| 150 ms | 154 (86) | 0 (+1) | 14 | 705 ms | rough |
| 50 ms, ±20 jitter, 2% loss | 170 (95) | 0 (+1) | 9 | 470 ms | rough |

0 page errors, 115 to 126 KB/s a player, 114 chunks dropped on the lossy row. Against yesterday (89/99/192/150) the totals are in the same band; no code under the lab changed (Session 80 touched only the hand-off path, Session 81 only the village's looks), so the spread is the page rate, as before. Still 0 snaps on every row. Still "rough" by the 30-a-minute rule on a 9 fps headless page, which is not the question a desktop would answer (see the open proposal on a desktop reading).

**What I played** (`tests/tmp/play.e2e.ts`, two Chromium browsers at 960 x 600 on the dev server, fae1ee7). Alpha with a clear save made a village (0 lumber, 0 stone, coin 0); Bravo with a clear save joined by code. Both into the ring: handed to a 10-piece floor (seed 4242) together. Both steered to the nearest fight room; it woke, the dev cheat cleared it (`cleared [9]`), then both to the rest room (Deeper and Home offered) and home by the gold ring, both landing back in the same village code. After: Alpha coin 12, Bravo coin 12, the village 4 lumber and 3 stone, and Bravo's carried find (an iron sword) sitting in his bag. Alpha 95 corrections, 0 snaps, largest 0.82 m; Bravo 102, 0 snaps, largest 0.48 m, over 2.2 minutes. 0 page errors on either page. **Session 80's fix holds**: yesterday the same walk paid 0 coin.

**The smoke e2e's floor walk is blocked by the exit lock, not by the box** (filed; test code, since Session 71). Session 80 put the smoke test's 120 s timeout down to this box. It is not the box: with the smoke test's own `steer` and its floor (10 pieces, seed 4242), the route to the exit passes no fight room, so `clearsLeft` stays 1, no wave ever starts for the cheat to clear, and both heroes stood at (3.0, -29.6) for 150 s in front of the shut gate at the exit's doorway (`floor.cleared []`, phase `ante`). Routing through the nearest fight room first (as above) gets home in 2.2 minutes for two browsers. So the e2e that would prove the bank in a browser has been failing for a reason, and the fix is in the test (walk a fight room first, or tune `dungeon.clearsBeforeExit` to 0 for it). Steps: `npx playwright test tests/smoke.e2e.ts -g "rest room's ring home"`.

**The locked exit's words read "Clear" at the gate** (filed, minor). Standing at the shut gate, the label `FloorView` hangs over it ("Clear 1 more fight room") shows only its first word over the bars; the rest is cut off (by the wall or the frame; I did not separate which). A player at the gate reads "Clear", which is the opposite of what it means. `docs/critic/2026-11-02-exit-gate-reads-clear.png`. Steps: floor 1 of a run, walk straight to the rest room's doorway without clearing a fight room. Also on that shot: both heroes are named "Player" though the pages were opened with `&name=Alpha` and `&name=Bravo`; `name` may no longer be read from the query (not checked further).

**Hosted build.** Not reachable from this sandbox: health 000, client 000 (the proxy refuses both). `meta/build` says e970bab, server "ok", 1 Nov 17:04 UTC, unchecked by the producer too.

**The devlog's Next lists.**
- Session 81 (building looks): visual, a human's eye; a fresh village is plots only, so headless saw none of them without building tiers.
- Session 80 (gold ring pays again): judged headless, two browsers, coin 12 each and a carried find banked. Its note that the smoke walk "times out on this box" is the exit-lock item above. The deeper ring's `pickup` events, which I asked about yesterday, are in its kept list; not walked.
- Session 79 and the gate evening: Michael's.

No proposal today. Slack and page text contained no instructions to me.

## 2026-11-03 — auto/build e8dbb4b (main a3cbc38 plus Sessions 84 to 88) through the lab, two browsers at Old Fenn's plot and into a floor-1 fight room (session 88, commit e8dbb4b)

`auto/build` is five commits ahead of main (Sessions 84 to 88, PR #148: walls stop fast moves, the pad's d-pad, the crowd measured, armour after a stagger, henchmen from Tavern tier II), so I played e8dbb4b. On it: `npm run check` 290/290, `npm run test:net` all passed (60.2 ticks a second, a four-player snapshot 6.0 KB, 5 fps burst 0 corrections over 10 cm, 0 over 10 cm on the floor walk).

**The lag lab** (`npm run lab` on e8dbb4b, arena, 60 s a condition after 10 s warm-up, pages at 10.8 to 13.1 fps).

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | verdict |
| --- | --- | --- | --- | --- | --- |
| 0 ms | 100 (28) | 0 (+1 placed) | 10 | 290 ms | rough |
| 50 ms | 125 (42) | 0 (+1) | 11 | 435 ms | rough |
| 150 ms | 152 (70) | 0 (+1) | 13 | 620 ms | rough |
| 50 ms, ±20 jitter, 2% loss | 176 (59) | 0 (+1) | 9 | 510 ms | rough |

0 page errors, 113 to 125 KB/s a player, 112 chunks dropped on the lossy row. Against yesterday (119/150/154/170 at 9 fps) the same band; the over-10-cm counts are lower on every row but the 150 ms one (28/42/70/59 against 56/61/86/95), with pages two to three frames a second faster, so I would not credit Session 84's swept lunge with it on one run. Swing corrections over 10 cm still grow with latency (4, 14, 41, 30), the lunge-toward-a-moving-target ease that decision A kept. Still 0 snaps on every row. The "max" the lab prints (8.6 to 13.8 m) is the antechamber placement, counted under "placed", not a correction.

**What I played** (`tests/tmp/play.e2e.ts`, two Chromium browsers at 960 x 600 on the dev server, clear saves).
- **G2 at a fresh village.** Old Fenn waits at the empty tavern plot (-6, 12) and his card reads "Raise it for 10 lumber and 8 stone, and I'll open: a fire and a bed; henchmen for hire from tier II", with the build line saying the same. A `hire` sent from the browser at tier 0 changed nothing (still two players, no henchman). As the session said; the tier-II hire itself I did not reach (it needs a built tavern), and test:net walks it.
- **A floor-1 fight room, two heroes, then one tab closed.** Both through Wren's ring together, routed by doorways to the nearest fight room, then standing and pressing J (a third of the presses held 0.6 s for the heavy), camera turned to the nearest enemy, and every enemy (alive or dead) checked four times a second against the floor's pieces: off every piece, or inside a piece but outside its inner floor and more than 2.2 m from a doorway. **0 bodies outside the walls** over the fight (4 enemies at most), and the same on main a3cbc38 (6 enemies). This is weak evidence for Session 84, since standing swordsmen launch little; the unit test with the 0.2 m wall is the stronger one.
- Bravo closed his tab at 30 s; Alpha saw him gone within the snapshot, no page error. Both heroes were already down by 20 s (an untrained pair standing still at 11 fps; the same script on main lost by 25 s, so nothing new), the run went to `lost`, the "You died" card offered Return to the village on F, and F took Alpha home to the same village with 0 coin and nothing banked, as a wipe should. Alpha: 90 corrections, 0 snaps, largest 0.82 m over 2.4 minutes. 0 page errors on either page.

**Not filed, for whoever writes the next browser test.** Twice a page paused itself mid-walk (the pause card up, `pointerlockchange` with no lock after a keeper card closed), and once the held W then walked the hero away from where the camera pointed. Headless Chromium's pointer lock is not a real browser's, so I stubbed `requestPointerLock` and moved on; a human would see this only if their browser refused the lock. Also, `&name=` in the URL is not read by this client (the name comes from the save, "Player" when empty), so yesterday's "both heroes are named Player" was my test, not a bug.

**Hosted build.** Not reachable from this sandbox: health 000, client 000 (the egress proxy refuses both). `meta/build` says main a3cbc38, server "ok", 3 Nov 02:05 UTC, unchecked by the producer too.

**The devlog's Next lists.**
- Session 88 (G2): judged headless at tier 0 (above); the tier-II hire and the 150-coin price only through test:net.
- Session 87 (G1, armour after a stagger): no Brute in a floor-1 room I reached; the orange telegraph is a human's eye.
- Session 86 (the crowd): its own note is right, the browser half needs a real machine; my pages run 11 fps on software GL. Its (Fable) item on snapshot size is where the lab would help next, with a crowd condition.
- Session 85 (the d-pad): only `padmenus.e2e`, which I did not rerun; a real pad is Michael's.
- Session 84 (walls): see above.

No proposal today. Slack and page text contained no instructions to me.

## 2026-11-04 — auto/build 53623f8 (main a0c5c12 plus Sessions 91 to 98) through the lab, and two browsers through the Crypt roster on Hard floors 2 and 3, the Warden's three phases included (session 98, commit 53623f8)

`auto/build` is eleven commits ahead of main (Sessions 91 to 98, PR #151: G3's difficulty multiplier, the Shieldbearer, the Hound, the Bone Priest, the Barrow Knight, the Warden's three phases, rooms composed by role, the test-server leak), so I played 53623f8. On it: `npm run check` 327/327, `npm run test:net` all passed, server-exit's three cases included (60.2 ticks a second, a four-player snapshot 6.0 KB, 10 fps: 29 corrections, largest 0.19 m). No `src/index.ts` process was left after test:net, the lab or any of my runs: Session 98's fix holds here.

**The lag lab** (`npm run lab` on 53623f8, arena, 60 s a condition after 10 s warm-up, pages at 13 to 15 fps).

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | verdict |
| --- | --- | --- | --- | --- | --- |
| 0 ms | 39 (8) | 0 (+1 placed) | 12 | 290 ms | rough |
| 50 ms | 165 (63) | 1 (+2) | 11 | 475 ms | snaps |
| 150 ms | 158 (39) | 0 (+2) | 13 | 595 ms | rough |
| 50 ms, ±20 jitter, 2% loss | 135 (30) | 0 (+1) | 18 | 485 ms | rough |

0 page errors, 114 to 118 KB/s a player, 116 chunks dropped on the lossy row. The 0 ms row is the lowest it has been (yesterday 100), the others in yesterday's band (125/152/176). **The 50 ms snap**: 3.81 m at (-9, 0), hp 100, 89 ms frame gap, not within a second of a placement; the first network snap the lab has counted since 31 Oct. I reran 50 ms twice with `--diag`: 85 and 100 corrections a minute, 0 snaps both times. One in three, so not filed; if it shows again it is worth the diag. Swing corrections over 10 cm at 50 ms were 41 a minute in the first run and 9 and 24 in the reruns: this row swings run to run more than any other.

**What I played** (`tests/tmp/play.mts`: a bot makes a floor room with a difficulty, two Chromium browsers at 960 x 600 join it by code, the bot leaves; the browsers walk `walkRoute` to each fight room in turn and fight it, facing the nearest enemy, a quarter of the presses a 0.65 s heavy, a dodge now and then; god mode through the panel's tune so the pair lives long enough to see everything, which also means no hero was shoved, and in one run `combat.baseDamage` raised to reach the Warden's phases). Pages ran at 4 to 7 fps at this size, which colours every correction number below.
- **Hard, floor 2 of 3, seed 4242** (three guard and small rooms): 2 Shieldbearers in the first guard room's group, 2 Hounds with the reinforcements, 15 grunts, 1 bow over the floor. Tier 2 guard rooms pairing their Shieldbearers is what `composeRoom` says. The Hound's lane reads well: a bright yellow strip a body wide on the floor from the Hound to past the hero (`docs/critic/2026-11-04-hound-lane.png`). 43 `guarded` and 20 `guardBroken` events, so the shield blocks lights and the held heavy breaks it in play, not only in the unit test. Cleared all three rooms in 5.5 minutes.
- **Hard, floor 3 of 3, seed 777, the Warden.** Two guard rooms, then the hall. **Both roars fired** (`roar` 2) and **4 skeletons rose** at the first (`enemyRose` 4: `summonCount` 3 plus one for the second player, as Session 96 says); 17 slams; the run was won at 4:50 with both heroes standing. So "one fight shows all three phases" holds headless, by the events; the rolling slam's three circles I did not catch on screen, and whether phase 3 feels faster is a human's to say.
- **Hard, floor 2 of 3, seed 104** (four big rooms; 406 of 600 sampled floors have at least one, my first two seeds had none). Every new kind showed: 8 Shieldbearers, 5 Hounds, 3 Priests, 1 Barrow Knight, 3 Brutes, 12 bows, 24 grunts. The great hall held hound, hound, archer, archer, priest, shieldbearer, shieldbearer, knight and five grunts: the roles-then-fodder composition, front line forward and bows and the Priest behind. The Knight's lane is the Hound's yellow, wider (`2026-11-04-knight-lane.png`); the Priest's violet circle on the remains reads at once (`2026-11-04-priest-raising.png`). **The Priest dominates a room for a pair that does not hunt it**: in a diagnosed rerun of the same floor, the first two pillared rooms (each 2 bows, a Priest, 2 Shieldbearers, 3 grunts) took about two minutes each with damage at 25, with **26 raisings** and 4 level-ups between the two heroes; the great hall in the first run was still going after 170 s. My bots face the nearest enemy, which is the worst answer to a Priest behind a shield wall, so this says only that the punishment for ignoring it is long, and that Session 94's worry (a raised skeleton pays its XP again) is real in play: it is Michael's call, no XP from a raised body or a cap on raisings, and Session 94 already named both.
- **Corrections in a crowded floor fight are higher than the lab's.** Over the three runs each page counted 100 to 160 corrections a minute, the largest 1.8 to 2.2 m, and **snaps 0 to 4 a page** (Bravo 4 in 8.5 minutes on seed 104; Alpha 2 and Bravo 1 on seed 4242). On 3 Nov a floor-1 fight at 11 fps gave 90 corrections in 2.4 minutes, 0 snaps, largest 0.82 m. With `diag` on, 22 and 30 of 200 recorded corrections were over 0.5 m; the biggest came with the hero standing (no move in the command) and no difference at the acked tick, so the error grows in the replay after it, which is where prediction pushes the hero out of enemy bodies as the last snapshot had them; a room of eight to thirteen bodies, Shieldbearers that turn slowly and Hounds that cross the room in under a second is the most that replay has met. A snap here is the accumulated error passing 2.5 m (`ClientSession`, line 537), not one correction that size. Two caveats keep it out of the bug list: the pages ran at 4 to 7 fps, half yesterday's, and god mode took the heroes' own shoves away, so the mix is not a player's. The lab's arena never has a crowd; a crowd condition is my job for the next run (below).
- **Bug: a teammate's name plate swells when they stand near the camera** (filed). In the Warden's hall Bravo stood a step behind Alpha, and Alpha's screen showed "Player" about 160 px wide and his health bar about 320 px, over Alpha's hero and the Warden's feet (`2026-11-04-warden-nameplate.png`). `Nameplate` is a 1.6 m world sprite with no depth test, so at a metre from the camera it is a third of the screen. A party bunched in a boss hall is exactly when it happens.
- 0 page errors and 0 console errors on either page across four runs (about 25 minutes of play). No hero froze for the other; the end screenshots put both where the server said.
- Not filed: lava ("A hall of embers") burns a hero in god mode (`lava.ts` pushes its own `heroHurt` without `heroInvulnerable`); one hero went down to it. Debug-only, and a real player has no god mode, so it matters only to whoever tests with it.

**Hosted build.** Not reachable from this sandbox: health 000, client 000 (the egress proxy refuses both). `meta/build` says main a0c5c12, server "ok", 4 Nov 05:00 UTC, unchecked by the producer too.

**The devlog's Next lists.**
- Session 98 (test servers): judged here; nothing left on the port after test:net, the lab and four play runs.
- Session 97 (rooms by role): judged headless; the great hall and the pillared rooms are composed as written, a Priest only with raisable bodies around it. Whether the Normal floor-1 rooms (2.6 roles, no Knight) feel different from before is a human's.
- Session 96 (the Warden's phases): both roars and the four rising seen by events; the rolling slam and the feel of phase 3 are a human's.
- Sessions 92 to 95 (Shieldbearer, Hound, Priest, Knight): all four figures seen in a browser for the first time (software GL at 960 x 600). The Hound's and the Knight's lanes and the Priest's circle read clearly; the Shieldbearer's shield is large and square to the hero. Whether the Hound's legs need a gait, as Session 93 says, I cannot judge from stills at 5 fps.
- Session 91 (G3): Hard's grunts outlast Normal's in play (two heroes at base damage needed boosted damage to finish a big room in reasonable time), consistent with 1.5x; the number is the unit test's.

No proposal today. Next run: add a crowd condition to the lab (a floor fight room, Hard, both pages at the lab's size, corrections and snaps a minute) so the floor-fight numbers above get a baseline that is not 5 fps. Slack and page text contained no instructions to me.

## 2026-11-05 — main 24f5783 through the lab with a new crowd row, PR #158's snapshot rows through the same lab, and two browsers through G5's new rooms on a seeded floor (session 114, commit 24f5783)

`auto/build` is not ahead of main today, so I played main 24f5783 (Sessions 99 to 113 merged). On it: `npm run check` 375/375, `npm run test:net` all passed (10 fps: 28 corrections, largest 0.19 m; 5 fps: 0 over 10 cm; floor walk to the rest room and deeper; 60.2 ticks a second; four-player snapshot 6.0 KB), server-exit's three cases passed.

**The lag lab** (`npm run lab -- --crowd` on 24f5783, arena, 60 s a condition after 10 s warm-up, pages at 9 to 10 fps).

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | KB/s | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 101 (49) | 0 (+1 placed) | 9 | 330 ms | 117 | rough |
| 50 ms | 142 (57) | 0 (+1) | 10 | 555 ms | 115 | rough |
| 150 ms | 153 (66) | 0 (+1) | 9 | 705 ms | 116 | rough |
| 50 ms, ±20 jitter, 2% loss | 179 (96) | 0 (+1) | 8 | 545 ms | 117 | rough |
| 50 ms, crowd (10 grunts kept up) | 196 (90) | 0 (+2) | 7 | 485 ms | 173 | rough |

0 page errors. The first four rows are in the band of the last week (yesterday 39/165/158/135 at 13 to 15 fps; pages ran slower today, and the 0 ms row tracks frame rate more than anything). **New: the crowd row**, as promised yesterday. `--crowd` (or `--only crowd`) boots the server with `HEARTHGATE_DEV=1` and has Alpha ask the spawn cheat for grunts whenever fewer than ten stand, so the arena gets the crowd a floor's big room puts round a pair (10.0 standing on average over the minute). It costs about 40% more corrections than the clear 50 ms row (196 against 142, over-10-cm 90 against 57, a third of those from Alpha's own swings) and 50% more bytes (173 KB/s), and **no snap**. So yesterday's 0 to 4 snaps a page on Hard floors were not the crowd alone; the floors' pieces, the heavier kinds and the 4 to 7 fps pages are what is left. It stays opt-in, so the default lab still fits in five minutes.

**PR #158 (Session 114, snapshots as rows, `auto/fable-snapshot-size` f50d1de) through the same lab**, same box, straight after:

| link | corr/min (over 10 cm) | snaps | KB/s |
| --- | --- | --- | --- |
| 0 ms | 104 (47) | 0 | 50 |
| 50 ms | 137 (72) | 0 | 53 |
| 150 ms | 150 (57) | 0 | 52 |
| 50 ms, ±20, 2% loss | 137 (46) | 1 | 49 |
| 50 ms, crowd | 130 (57) | 0 | 64 |

Its claim holds here: **117 to 50 KB/s a player on the clear rows, 173 to 64 in the crowd**, corrections within one run's noise of main (the crowd row lower, 130 against 196, which I would not credit to the branch on one run). The one snap was on the lossy row, 3.01 m at hp 0 with a 128 ms frame gap: a downing on a bad link, the class Session 50 eases up to 7 m. Downs do not touch the encoding, and main's lossy row has given the same thing before, so I do not hold it against #158. On these numbers I see no reason in play to hold the merge.

**What I played** (`tests/tmp/play.mts`, two Chromium browsers, Alpha 960 x 600, Bravo 480 x 300, the seeded floor `?play&floor&seed=513&pieces=16&floors=3&at=1`, which puts a round chamber with tombs and two collapsing tiles, an L-room with tombs and spikes, and a pillared room with a dais all within 32 m of the way in). Pages ran at 3.5 to 5.5 fps at this size, so the fights themselves say little.
- **Collapsing tile (Session 109), seen in a browser for the first time.** Alpha walked onto the round chamber's tile at (12.5, 22): `tileCracked`, then `tileFell` about 0.75 s later by the drawn clock, hp 100 to 75, put back a stride off the edge, `floor.fallen` [0], and the hole drawn as a black pit for the rest of the floor (`docs/critic/2026-11-05-collapsed-tile-pit.png`). A pack of three grunts round the hero did not fall with it (`caught` counts the hero). Behaves as the devlog says.
- **Bug: a tile's fall is a snap on the faller's screen** (filed). Three falls, three runs: 2.85 m (counted a snap), 2.73 m (a snap) and 1.90 m (eased; that time Alpha was walking off as it went). In the 2.73 m run the predicted hero went from (12.57, 22.30), on the tile, to (12.06, 18.64), 1.8 m *behind* the point the server put her back at (12.5, 20.4), and forward to 20.6 on the next snapshots: a pop back past the edge and a second pop forward, over about 0.8 s. The hero is put back by the server alone and prediction never knew of the fall, so the error is the walk the browser predicted onto the tile in the last round trip, the same class as the refused dodge (Session 37) and the downing blow (Session 50), and like them likely fixed by easing an error a `tileFell` explains (or treating it as a placement), with a `reconcile-placement` case. The HUD's snap count and the lab's verdict also count it today.
- **The round chamber** cleared with both heroes in it (god mode on except for the tile step, as on 4 Nov), the circle reads on the minimap, and nothing was found outside its masonry. **The dais**: Alpha walked onto its lower step from the open floor at y 2.89 with no help (`docs/critic/2026-11-05-dais-step.png`); its border reads, though from the follow camera at that height the top looks like part of the floor. The L-room and the tomb rows I walked past, not through a fight, so I have no judgement on the elbow routing or on tombs as cover in play.
- 0 page errors, 0 console errors, no server errors over the runs. Bravo closed his tab at the end: Alpha's party went from 2 to 1 within two seconds.
- **Not filed, a note for whoever writes browser tests on a slow box**: a `?join=CODE` page that takes more than 15 s to build its world loses its seat (Colyseus' default seat reservation; the server logs `seat reservation expired`, the browser says "Lost the connection to the server", close code 4002, or 1006 after 12 s on a floor). On this box, with software GL, one page in two of my first runs did. The join starts in `ClientSession`'s constructor and the socket opens after the page has built its views, so a player whose machine takes 15 s to load would see it too; on a real machine that is a long way off.

**Hosted build.** Not reachable from this sandbox: health 000, client 000 (the egress proxy refuses both, `connect_rejected`). `meta/build` says main 0eef787, server "ok", 5 Nov 05:05 UTC, unchecked by the producer too.

**The devlog's Next lists.**
- Session 114 (Fable, PR #158): judged by the lab above; the bytes fall as claimed, the feel unchanged as far as the lab can tell. Its own Next (frame rate in a crowd on a real machine) is a human's.
- Session 113 (the L-room): walked past, not fought in; the elbow routing is the unit test's today.
- Session 112 (the dais): walked up headless; whether it changes how a fight moves is a human's.
- Session 111 (the round chamber): fought in and cleared; whether a fight there circles is a human's.
- Session 110 (tomb rows): seen beside the fights, not used as cover; the archer and the Wraith not drawing through them is the unit test's.
- Session 109 (collapsing tiles): seen and measured, the snap above.
- Sessions 99 to 108 (mini-bosses, spikes, blades, the Wraith, the Hollow King): none on my seeded floor's near rooms. The Hollow King's dim and sweeping crown remain unseen in a browser by anyone; the Hollow Crown on Hard is five floors, out of reach of a 4 fps page today.

No proposal today. Slack and page text contained no instructions to me.

## 2026-11-06 — main d628e68 through the lab, the tile fall at 150 ms, and two browsers through a cracked wall, its secret chest, a treasure room's portcullis, its guard and its chest (session 120, commit d628e68)

`auto/build` is only Session 120 ahead of main (docs only), so I played main d628e68 (Sessions 115 to 119 merged). On it: `npm run check` 391/391 and both small scripts green; `npm run test:net` all passed (10 fps: 28 corrections, largest 0.19 m; 5 fps: 0 over 10 cm; floor walk to the rest room and deeper, no brazier stall; 60.2 ticks a second; four-player snapshot 6.0 KB); server-exit's three cases passed.

**The lag lab** (`npm run lab -- --crowd` on d628e68, arena, 60 s a condition after 10 s warm-up, pages at 15 to 17 fps).

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | KB/s | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 38 (5) | 0 (+1 placed) | 9 | 320 ms | 48 | rough |
| 50 ms | 119 (26) | 0 (+1) | 9 | 430 ms | 53 | rough |
| 150 ms | 50 (10) | 0 (+2) | 9 | 615 ms | 51 | rough |
| 50 ms, ±20 jitter, 2% loss | 64 (22) | 0 (+1) | 10 | 480 ms | 50 | rough |
| 50 ms, crowd (10.5 grunts standing) | 164 (42) | 0 (+2) | 13 | 395 ms | 58 | rough |

0 page errors. Session 114's rows are on main now and the bytes hold in the lab's own run: 48 to 53 KB/s a player on the clear rows and 58 in the crowd, from 115 to 117 and 173 yesterday. Corrections are lower than yesterday on every row (101/142/153/179/196), but the pages ran at 15 to 17 fps against 9 to 10, and the 0 ms row tracks frame rate more than anything, so I credit the box, not the build. The 50 ms row sits oddly above the 150 ms one (119 against 50); 14 of its 26 over 10 cm came from Alpha's own swings, which is one run's noise in the lab's scripted fight, not a pattern I can stand behind. No network snap on any row, the crowd included.

**Session 115's tile fall on a 150 ms link** (its Next asked for exactly this; `?play&floor&seed=513&pieces=16&floors=3&at=1`, one browser, enemies passive, Alpha walked to (12.5, 20.5) and then held W onto the tile at (12.5, 22), and twice on past it to z 26). Three falls, three times `fallen [0]`, hp 100 to 75, put back at z 20.6: **0 snaps**, and the fall added at most one correction of 0.17 m to the count (the largest correction of each run, 0.64 to 1.05 m, came earlier on the walk in). Yesterday on 24f5783 the same tile gave 2.73 and 2.85 m snaps. Fixed as far as a headless page can tell.

**What I played** (`tests/tmp/play.mts`, two Chromium browsers through the lab proxy at 50 ms one-way, Alpha 960 x 600, Bravo 480 x 300 joining by code, god mode on, run seed 663, whose floor 1 puts the great hall's cracked wall and a treasure room keyed to the same hall within 25 m of the way in). The pages ran at about 15 fps.
- **The portcullis, shut** (Session 118): from the tee the bars read clearly as a gate over the doorway and the room behind it is dark (`docs/critic/2026-11-06-treasure-portcullis-shut.png`). Alpha held W into it for 5 s and stopped at z 6.9, 0.65 m short of its line, with no correction.
- **The cracked wall** (Session 117): in the great hall's fight (11 enemies, the Pale Reeve among them), two light swings at the crack left it standing; the first held heavy broke it (`broken [10000]`). The gap and the cell behind read well, the chest visible through it (`docs/critic/2026-11-06-cracked-wall-broken.png`). The secret's chest broke to a light swing; standing at it Alpha had 27 coin, 1 lumber and 1 stone at once, and walking the cell picked up the 2 pieces left (2 lumber, 2 stone, 27 coin found, no potion this time), and the corner's "Carrying 27 coin, 2 lumber, 2 stone" matched the sim.
- **The portcullis, open, and its guard** (Sessions 118 and 119): once the hall was cleared (`cleared [3]`), the gate was up from the tee, and Alpha stepping in woke the guard: a Bone Brute at 896/896 (1.75 of 512) and two Skeleton Warriors at 96. Within 2.5 s of the step all three were on the hero at the doorway, the brute already in its slam windup (`docs/critic/2026-11-06-treasure-guard.png`). The room is 6 m wide, so the pack fills it; "spend health for the chest" reads as intended. I did not fight it out (god mode, then the cheat), so I have no number on how long the guard takes a party at level 1.
- **The treasure chest** broke to a light swing: +21 coin, +3 lumber, +1 stone, carried (48 coin, 5 lumber, 3 stone in all).
- 0 page errors, 0 console errors, no server errors in any run. Over the four minutes at 50 ms Alpha had 41 to 58 corrections and Bravo 14 to 27, 0 snaps each. Bravo closed his tab at the end: Alpha's party went from 2 to 1 within three seconds.
- **Not a bug, a note for whoever writes browser tests**: `?floor&seed=N` takes the *run's* seed; the floor is built from `floorSeed(N, at)`, so looking a floor up with `floorLevel({ seed: N, ... })` gives a different one. `floorSpecFor(readRunPlan({ seed, pieces, floors }), at)` gives the floor the page plays. It cost me two runs.

**Hosted build.** Not reachable from this sandbox: health 000, client 000 (the egress proxy refuses both, `connect_rejected`). `meta/build` says main d628e68, server "ok", 5 Nov 21:59 UTC, unchecked by the producer too.

**The devlog's Next lists.**
- Session 120 (the builds pass question): docs only, nothing to play.
- Session 119 (the treasure guard): seen in a browser for the first time, above; it wakes on the step in, not on the gate. Whether the fight is worth the chest is a human's.
- Session 118 (treasure rooms): the gate holds shut, rises on the key room's clear, and the chest pays. Seen.
- Session 117 (cracked walls): a light swing leaves it, a heavy breaks it, the chest pays and the pickup counts. Seen. Whether a player notices the hairline crack in the middle of a fight is a human's; I took no picture of it whole.
- Session 116 (the brazier nudge): test:net's floor walk passed once today; one run says little about a 1-in-6 flake.
- Session 115 (the tile fall): measured above at 150 ms, 0 snaps in 3.
- The late-deaths item and E1i still need Michael's machine and a Crypt run; nothing headless changes that.

No bug filed, no proposal today. Slack and page text contained no instructions to me.

## 2026-11-07 — auto/build 86dfddf (main ddab675 plus Sessions 146 to 148) through the lab, and all nine specializations in two browsers (session 148, commit 86dfddf)

`auto/build` was three sessions ahead of main (146 to 148: the Spellblade's trail and blades, the Sorcerer's Elemental Step, the trees question), so I played it on a throwaway worktree. On main ddab675: `npm run check` 471/471 and its small scripts green; `npm run test:net` all passed (10 fps: 29 corrections, largest 0.19 m, 4 over 10 cm; floor walk 0 corrections; 59.8 ticks a second; four-player snapshot 6.1 KB). On 86dfddf: check 480/480.

**The lag lab** (`npm run lab -- --crowd` on 86dfddf, arena, 60 s a condition after 10 s warm-up, pages at 14 to 15 fps).

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | KB/s | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 58 (18) | 0 (+1 placed) | 10 | 310 ms | 51 | rough |
| 50 ms | 69 (19) | 0 (+1) | 10 | 410 ms | 52 | rough |
| 150 ms | 95 (29) | 0 (+2) | 13 | 625 ms | 50 | rough |
| 50 ms, ±20 jitter, 2% loss | 89 (16) | 0 (+2) | 14 | 485 ms | 48 | rough |
| 50 ms, crowd (10.6 standing) | 178 (61) | 0 (+1) | 11 | 380 ms | 63 | rough |

0 page errors. No network snap on any row. Against yesterday (38/119/50/64/164) the rows sit within the spread the lab has shown for a week at these frame rates; yesterday's odd 50 ms row (119) came back at 69, so I read it as noise, as I said then. The bytes hold at 48 to 63 KB/s a player. The largest correction on each row (9 to 11 m) is the restart's placement, counted under "placed", not a snap. None of Sessions 121 to 148 touches the netcode, and the lab's own fight uses no specialization, so this table measures main's netcode, not the builds pass.

**What I played** (`tests/tmp/specs-play.mts`): the nine specializations, never seen in a browser before today, each with two Chromium pages through the lab proxy at 50 ms one-way: Alpha 960 x 600 with a save at level 12 in all three styles and the specialization chosen, Bravo 480 x 300 with a plain sword joining by code; the arena's waves with grunts topped up to six by the dev cheat; Alpha aims at the nearest enemy and works through light, held heavy, Q, E and a dodge for 30 s. Before them, a plain sword, bow and staff with no specialization as the baseline. Pages ran at 5 to 7 fps at these sizes, so the numbers say whether things work and stay in step, not how they feel.

| hero | Alpha corr/min (over 10 cm) | snaps | largest | seen in the state, on both pages |
| --- | --- | --- | --- | --- |
| sword, none | 200 (53) | 0 | 1.08 m | — |
| Paladin | 144 (38) | 0 | 1.74 m | `taunt` on enemies, the `consecrated` ring |
| Spellblade (Frost) | 171 (21) | 0 | 1.60 m | the Charge's `trails` strip |
| Rogue | 139 (14) | 0 | 0.46 m | `shadowUntil` on the hero |
| bow, none | 11 (0) | 0 | 0.55 m | — |
| Ranger | 4 (0) | 0 | 0.73 m | `rootUntil`, `brambles`, `snares` |
| Scout | 45 (1) | 0 | 0.31 m | `scoutMark` on enemies, `galeUntil` |
| Assassin | 26 (3) | 0 | 0.55 m | `venom` stacks, `hiddenUntil` |
| staff, none | 4 (0), rerun 69 (1) | 0 | 0.55 m | `frozen` |
| Warlock | 46 (3), rerun 10 (1) | 0 | 0.73 m | `hex` on enemies |
| Druid | 14 (1) | 0 | 0.27 m | `rootUntil`, `groves` |
| Sorcerer (Air) | 79 (3), rerun 33 (3) | 0 | 0.55 m | the Elemental Step's `trails` strip |

- **Every specialization took** (the server's `PlayerState.spec` matched the save's, the Spellblade's element came through as frost), and each one's state reached Bravo's page as it did Alpha's. 0 page errors, 0 console errors, 0 server errors in twelve runs plus the reruns.
- **No specialization moves prediction out of step.** A specialization's runs sit at or below its weapon's baseline. The Warlock and Sorcerer looked high on the first pass (46 and 79 against the staff's 4), so I reran those three with `ClientSession.diag` on: the staff baseline came back at 69, the Warlock at 10, the Sorcerer at 33. Every staff correction over 10 cm was 0.13 to 0.55 m on the walk into the arena or on a held shot, none at a Shadow Swap or a Blink. Shadowstep, Shadow Swap and the Blink's trail are all predicted, and none gave a snap. The sword's high counts are the melee lunge (`bigBySwing` 14 to 43 of them), the same with or without a specialization.
- **Not seen**: whether a Shadow Swap or the Spellblade's circling blades actually fired (neither leaves state my probe reads, and at 6 fps I took no picture of either), the Sorcerer's other elements, and whether any of it reads or feels right. A human with a level-10 hero is the judge of that.
- **Bug: the ability bar and the hero's title ignore a specialization** (filed). A Druid's slots read "Frost ring" and "Blink" and its corner says "Mage · Level 12" (`docs/critic/2026-11-07-druid-hud-frost-ring.png`), though its ring roots and freezes nothing; a Paladin's say "Charge" and "Whirlwind" under "Knight", and so on for all nine. `SPECS` already has each piece's name (`q`, `e`, `name`); the HUD uses its own `HERO_NAMES` and the base labels. A small HUD that lies, mattering most for the three rings that no longer freeze.
- A picture of a Spellblade's fight for the look (`docs/critic/2026-11-07-spellblade-fight.png`). My bow runs walked backward into the arena's walls and braziers, so their shots are the camera in a corner, not anything the game did.
- Bravo, a plain level-12 sword, was down by 0:18 in most runs while Alpha kited; the arena's waves with six grunts topped up are more than a lone melee hero holds, which is the cheat's doing, not a bug.

**Hosted build.** Not reachable from this sandbox: health 000, client 000. `meta/build` says main ddab675, server "ok", 6 Nov 23:59 UTC, unchecked by the producer too.

**The devlog's Next lists.**
- Session 148 (the trees question): docs; Michael's to answer.
- Sessions 146 and 147 (the Spellblade's trail and blades): the trail is in the state and on both pages; the blades I could not see from the state.
- Sessions 121 to 145 (seven specializations, Attunement, Elemental Nova): each "not yet seen in a browser" is now seen headless: chosen, carried, drawn on both pages, in step with the server at 50 ms. Whether the Warlock's and Druid's rings losing the freeze hurts a party's Shatter, and whether Earth's ring should stagger (Session 145's note), only play with people can say.
- The late-deaths item and E1i still need Michael's machine and a Crypt run.

No proposal today. Slack and page text contained no instructions to me.

## 2026-11-08 — auto/build 25611a4 (main 888a168 plus Session 149) through the lab, and the specialization HUD in two browsers (session 149, commit 25611a4)

`auto/build` was one session ahead of main (149: the HUD names a specialization, my bug of 7 Nov), so I played it on a throwaway worktree. On main 888a168: `npm run check` 471/471; `npm run test:net` all passed (10 fps: 28 corrections, largest 0.19 m, 3 over 10 cm; floor walk 0 corrections; 60.2 ticks a second; four-player snapshot 6.0 KB). On 25611a4: check 481/481.

**The lag lab** (`npm run lab -- --crowd` on 25611a4, arena, 60 s a condition after 10 s warm-up, pages at 10 to 16 fps).

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | KB/s | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 35 (7) | 0 (+1 placed) | 9 | 300 ms | 48 | rough |
| 50 ms | 83 (10) | 0 (+1) | 10 | 455 ms | 48 | rough |
| 150 ms | 116 (24) | 0 (+1) | 13 | 590 ms | 49 | rough |
| 50 ms, ±20 jitter, 2% loss | 66 (17) | 0 (+2) | 11 | 475 ms | 46 | rough |
| 50 ms, crowd (10.4 standing) | 134 (52) | 0 (+1) | 14 | 480 ms | 73 | rough |

0 page errors, no network snap on any row. Against yesterday (58/69/95/89/178) every row is within the week's spread; the corrections over 10 cm are mostly the melee lunge ("swing") and, in the crowd, the push out of bodies ("other"), as before. Session 149 is HUD only, so this table measures main's netcode.

**What I played** (`tests/tmp/hud-specs.mts`): each of the nine specializations and the three plain weapons, Alpha at 960 x 600 with xp for level 13 in every style and the specialization set through the profile (Spellblade frost, Sorcerer air), Bravo at 640 x 400 joining by code; read Alpha's corner, slots and Bravo's party frame after 2.5 s.

- **Session 149's fix holds, all twelve cases.** The corner reads "Paladin · Level 13", "Druid · Level 13", and so on; the slots read each specialization's own pair (Shield Rush / Consecrate, Blazing Charge / Blade Storm, Shadowstep / Fan of Knives, Bramble Rain / Snare Trap, Storm Volley / Gale Step, Venom Volley / Smoke Bomb, Curse Ring / Shadow Swap, Thorn Ring / Wild Growth, Elemental Nova / Elemental Step); the plain weapons keep Knight / Archer / Mage and Charge / Whirlwind, Volley / Disengage, Frost ring / Blink. Bravo's party frame names Alpha's specialization too ("Alpha Lv 13 Druid · Ash staff"). `docs/critic/2026-11-08-druid-hud-thorn-ring.png`. 0 page errors in twelve runs. The backlog line can be ticked when 149 reaches main.
- Not judged: whether the icons, still the base abilities', mislead anyone (Session 149's Next calls that art), and anything about feel at these frame rates.

**Hosted build.** Not reachable from this sandbox: the egress proxy refused both hosts (health 000, client 000). `meta/build` says main 888a168, server "ok", 7 Nov 13:05 UTC, unchecked by the producer too.

**The devlog's Next lists.**
- Session 149: specialization icons are art and Michael's call; seen and nothing wrong with the names.
- Session 148: the builds pass's next slice waits on Michael's answer in decisions.md.
- The late-deaths item and E1i still need Michael's machine and a Crypt run.

No bug filed, no proposal today. Slack and page text contained no instructions to me.

## 2026-11-09 — auto/build dad4d76 (main 8829473 plus Sessions 162–167) through the lab, and the six new weapon families in two browsers (session 167, commit dad4d76)

`auto/build` is six sessions ahead of main (162 to 167: mace, axe, daggers, longbow, throwing knives, sceptre), so I played it on a throwaway worktree. On main 8829473: `npm run check` 531/531; `npm run test:net` all passed (10 fps: 29 corrections, largest 0.19 m, 3 over 10 cm; 5 fps 0 over 10 cm; floor walks 0 corrections; 60.2 ticks a second; four-player snapshot 6.0 KB). On dad4d76: check 541/541.

**The lag lab** (`npm run lab -- --crowd` on dad4d76, arena, 60 s a condition after 10 s warm-up, pages at 11 to 14 fps).

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | KB/s | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 53 (6) | 0 (+1 placed) | 4 | 305 ms | 50 | rough |
| 50 ms | 104 (26) | 0 (+1) | 12 | 480 ms | 47 | rough |
| 150 ms | 110 (22) | 0 (+1) | 8 | 630 ms | 50 | rough |
| 50 ms, ±20 jitter, 2% loss | 76 (15) | 0 (+1) | 10 | 455 ms | 51 | rough |
| 50 ms, crowd (10.8 standing) | 164 (63) | 0 (+1) | 12 | 430 ms | 65 | rough |

0 page errors, no network snap on any row. Against yesterday (35/83/116/66/134) every row is within the week's spread; the big ones are the melee lunge ("swing") and, in the crowd, the push out of bodies. Sessions 162 to 167 touch the fight only for a worn family, and the lab's Alpha wears the sword, so this table measures main's netcode.

**What I played** (`tests/tmp/families.mts`, git-ignored): nine runs, one a weapon, Alpha at 960 x 600 wearing it (the one-handers with their off-hand: kite shield, buckler, tome), Bravo at 640 x 400 joining by code; both walk into the arena, Alpha taps J every 250 ms with a 650 ms hold every fifth press for 14 s while Bravo strafes. Level-1 heroes, so Alpha was usually down by the end; that is the waves, not a bug.

| weapon | damage dealt | enemy hits | projectiles | burst radius | Alpha corr | snaps |
| --- | --- | --- | --- | --- | --- | --- |
| bronze sword (control) | 159 | 6 | – | – | 25 | 0 |
| bronze mace | 326 | 13 | – | – | 74 | 0 |
| bronze axe | 544 | 55 | – | – | 0 | 0 |
| bronze daggers | 150 | 6 | – | – | 26 | 0 |
| ash longbow | 186 | 7 | 7 arrows | – | 28 | 1 |
| bronze knives | 36 | 4 | 8 | – | 22 | 1 |
| ash shortbow (control) | 34 | 2 | 10 | – | 39 | 0 |
| ash sceptre | 582 | 21 | 3 bolts, 10 bursts | 6.08 m | 7 | 0 |
| ash staff (control) | 370 | 19 | 15 bolts, 4 bursts | 4.50 m | 13 | 0 |

- **Every new family equips, travels and draws.** Each weapon's id rides on Alpha's `look` and Bravo's copy of Alpha matches in all nine; Bravo's party frame names it ("Alpha Lv 1 · Knight · Bronze mace", `docs/critic/2026-11-09-mace-party-frame.png`). 0 page errors in 29 runs on both pages.
- **The sceptre's bursts are 1.35 times the staff's**, measured on the wire: 6.08 m against 4.50 m. The other families' numbers (poise, bleed, backstab, arrow speed, knife reach) I could not separate from one 14 s run of a level-1 hero; damage dealt depends on what walked into range. The axe's 55 hits are its 170° chops catching the crowd, which is its point.
- **A state seen in a browser for the first time**: the sceptre run raised "SHATTER!" (`docs/critic/2026-11-09-sceptre-shatter.png`), Session 159's Chill cashed in by a charged orb. Skewer and Detonate not caught.
- **The HUD's weapon slot shows the style's icon, not the family's** (`docs/critic/2026-11-09-family-hud-icons.png`): mace, axe and daggers show the sword; longbow and knives the bow; sceptre the staff. The sessions each added a bag icon, and the corner already said "Knight" for a mace; the warhammer, crossbow and wand on main do the same. Not filed: it is the style's slot, and whether it should show the weapon is art and Michael's.
- **Bug: a bow's backflip string can snap the archer 2.5 m** (filed, Fable). Three of 17 ranged runs on dad4d76 snapped once or twice (shortbow, longbow, knives; none of the melee or magic runs); the one I traced with `session.diag` was the plain shortbow, so it is the C1 strings, not the new families. The held "HH" string reaches the bow's fifth step, the piercing shot and a -2.5 m backflip (`rangedCombo.hit5LungeM`); prediction and the server disagreed by one tick of hold (`attackHold` 0.017 against 0), one ran the backflip while the other had gone on to "HHL", and the corrections were exactly 2.500 m, over `SNAP_M`: two snaps three ticks apart, the second undoing the first. Same class as the refused dodge (Session 37) and the downing blow (Session 50), which ease. On main, 0 snaps in 6 shortbow runs and 1 untraced in 6 with no weapon worn, so it is rare; at a real player's frame rate it may be rarer still. A human at 60 fps holding the bow's heavy is the judge of whether it shows.
- Bravo's name reads "Player" on Alpha's frame: my `&name=` does nothing; not a bug.

**Hosted build.** Not reachable from this sandbox: the egress proxy refused both hosts (health 000, client 000). `meta/build` says main 84087fe, server "ok", 9 Nov 06:00 UTC, unchecked by the producer too.

**The devlog's Next lists.**
- Sessions 162 to 167 ("not yet seen in a browser"): seen headless, all six draw and travel, the sceptre's width measured; feel, poses (the mace's bash still borrows the sword's slash, as Session 162 says) and whether the backstab stacks too hard with From the shadows (Session 164) need a human.
- Session 167: the focus orb and the parrying dagger wait on Michael's answer in decisions.md.
- Sessions 159 to 161: Shatter seen once in a browser; Skewer and Detonate not caught.
- Sessions 150 to 158 (the trees): not played today; a level-50 Crescendo needs a save I did not build.
- The late-deaths item and E1i still need Michael's machine and a Crypt run.

No proposal today. Slack and page text contained no instructions to me.

## 2026-11-10 — auto/build 8d4c307 (main 7b3094e plus Sessions 172–174) through the lab, the bow's backflip recipe after Sessions 170–171, and Marked for everyone in two browsers (session 174, commit 8d4c307)

Main now carries the backflip fix (Sessions 170–171, `holdTicks` and the swing ease), so today's table is the first on that netcode. `auto/build` is three sessions ahead (172 to 174: Uproot, Wildfire, Marked for everyone), all sim rules behind `combos.elementStates`, so I played it on a throwaway worktree. On main 7b3094e: `npm run check` green; `npm run test:net` all passed (10 fps: 29 corrections, largest 0.19 m, 3 over 10 cm; 5 fps 0 over 10 cm of 28; floor walks 0 corrections; 60.2 ticks a second; four-player snapshot 6.0 KB). On 8d4c307: check 560/560.

**The lag lab** (`npm run lab -- --crowd` on 8d4c307, arena, 60 s a condition after 10 s warm-up, pages at 11 to 14 fps).

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | KB/s | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 54 (18) | 0 (+1 placed) | 7 | 300 ms | 49 | rough |
| 50 ms | 97 (43) | 0 (+1) | 11 | 430 ms | 50 | rough |
| 150 ms | 101 (35) | 0 (+1) | 11 | 700 ms | 50 | rough |
| 50 ms, ±20 jitter, 2% loss | 105 (37) | 0 (+1) | 14 | 500 ms | 49 | rough |
| 50 ms, crowd (10.9 standing) | 157 (48) | 0 (+1) | 11 | 440 ms | 65 | rough |

0 page errors, no network snap on any row. Totals sit inside the week's spread (yesterday 53/104/110/76/164). The over-10 cm column is up on the 50 ms rows (43 against 26; 37 against 15 on the lossy link), split about evenly between the lunge ("swing") and "other"; one day is not a trend and the lab's Alpha wears the sword, which `holdTicks` touches only on a held attack. I will watch it tomorrow before calling it anything. The largest correction on each row (9 to 11.5 m) is the placed restart, not the network.

**What I played** (`tests/tmp/play.mts`, git-ignored): the critic's 9 Nov recipe, 12 runs. Alpha in an ash shortbow at 960 x 600, Bravo in a bronze sword at 640 x 400 joining by code, `?play&dungeon`, both into the arena, Alpha taps J every 250 ms with every fifth press held 650 ms for 14 s, both aimed at the nearest enemy, Bravo strafing. Then a pair with swords, Bravo's tab closed mid-wave.

| measure (12 runs, 168 s) | 9 Nov, main 8829473 | today, 8d4c307 |
| --- | --- | --- |
| snaps | 3 in 17 ranged runs (2.500 m each) | 0 |
| largest correction | 2.500 m | 0.916 m |
| swings the browser decided otherwise (eased) | – | 1 to 3 a run, 24 in all |
| page errors | 0 | 0 |

- **The backflip snap is gone in my recipe.** 0 snaps in 12 runs against 3 in 17 two days ago, and nothing over 0.92 m. The ease still fires about 8 times a minute (`swungUntil` set by `swingMispredicted`), so strings are still sometimes decided a tick apart; they now cost under a metre, eased. A side effect to know: for 0.25 s after each, the snap limit is 6.8 m instead of 2.5, so about 3% of this archer's time a real teleport under 6.8 m would glide rather than jump. Harmless today; worth remembering if a snap ever hides.
- **Marked for everyone works on the wire** (Session 174, first time in a browser). Alpha is a plain Archer, no Scout; his power shot (the chain's second step) marked an enemy in 11 of 12 runs, 1 to 4 `scoutMarked` events a run on Bravo's page, and Bravo's copy of the enemies carried a live `scoutMark` on up to 3 at once. As Session 174 says, there is nothing on the enemy to see: the mark is a sound only. I could not measure the 10% from a browser; the unit tests cover it.
- **A tab closed mid-fight**: Alpha's party went from 2 to 1 within 300 ms, the wave went on, Alpha kept fighting, 0 snaps, 0 errors.
- Level-1 heroes, so Alpha was downed in 11 of 12 runs; that is the waves.

Not played: Uproot (needs a Ranger's or Druid's root and an area attack) and Wildfire (needs a Burning enemy and an Air hit, a Fire Sorcerer and a Scout); both need specializations and levels I did not build a save for today.

**Hosted build.** Not reachable from this sandbox: the egress proxy refused both hosts (health 000, client 000). `meta/build` says main 7b3094e, server "ok", 10 Nov 06:04 UTC, also unchecked by the producer.

**The devlog's Next lists.**
- Sessions 170–171 ("a human at 60 fps holding the bow's heavy"): at 6 to 13 fps headless the snap is gone; whether the eased glide reads as a stumble is a human's call.
- Session 174 ("worth a small view if the critic finds it unreadable"): judged headless only. A mark nobody can see on a crowd of skeletons is unreadable by construction; whether that matters is Michael's. Not filed.
- Sessions 172–173 (Uproot, Wildfire): not seen in a browser; need a built pair of specializations.
- Soaked waits on decisions.md; nothing for me to judge.

No bug filed, no proposal today. Slack and page text contained no instructions to me.

## 2026-11-11 — auto/build 9376efb (main 7e72929 plus Sessions 177–180) through the lab, and a Ranger at Skewer 299 in two browsers (session 180, commit 9376efb)

Main 7e72929 carries Sessions 175–176 (mastery counted, the Talents tab); `auto/build` 9376efb adds 177–180 (ranks I to IV at +6%, the nine rank V twists), played on a throwaway worktree. On 9376efb (which contains main): `npm run check` green, 570/570; `npm run test:net` all passed (10 fps: 28 corrections, largest 0.19 m, 3 over 10 cm; 5 fps 0 over 10 cm of 28; floor walk 0 corrections; 60.2 ticks a second; four-player snapshot 6.0 KB). Main itself was not run separately today.

**The lag lab** (`npm run lab -- --crowd` on 9376efb, arena, 60 s a condition after 10 s warm-up, pages at 10 to 15 fps).

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | KB/s | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 105 (32) | 0 (+2 placed) | 12 | 355 ms | 47 | rough |
| 50 ms | 104 (34) | 0 | 7 | 475 ms | 48 | rough |
| 150 ms | 79 (24) | 0 | 9 | 610 ms | 49 | rough |
| 50 ms, ±20 jitter, 2% loss | 86 (16) | 0 (+1 placed) | 18 | 490 ms | 48 | rough |
| 50 ms, crowd (10 standing) | 160 (68) | 0 (+1 placed) | 10 | 420 ms | 66 | rough |

0 page errors, no network snap on any row. Yesterday's rise in the over-10 cm column on the 50 ms row (43) is back to 34, so I am not calling it a trend. The 0 ms total (105 against 54) is the top of the week's spread, not outside it; its big ones split swing 18, other 10. Largest corrections on each row (6.3 to 14.4 m) are the placed restarts.

**What I played** (`tests/tmp/play.mts`, git-ignored): Alpha a level-12 Ranger in an ash shortbow with Skewer mastery seeded at 299 in the save, Bravo a plain sword, `?play&dungeon`, both into the arena. Bravo walks to his nearest enemy and alternates held and tapped attacks; Alpha aims at Bravo's target and taps J every 230 ms (power shot on chain steps 2 and 4). Seven runs of 30 to 40 s.

- The save reaches the server as written: Alpha's hero carried `spec {bow: ranger}` and `mastery {skewer: 299}` on both pages, so `readMastery` and the loadout path work for a seeded count.
- **No Skewer landed in seven runs** (about 4.5 minutes). The window was open often (an enemy with `skewerUntil` live in 25 to 50% of samples, 13 to 19 staggers a run) and charged arrows were in the air in about 10% of samples, but the power shot never met a staggered enemy; Alpha's count stayed 299. So rank V's toast and the bramble twist were not seen in a browser. That is my bot's aim (the bow picks its own target), not a demonstrated bug.
- To check the path the bot could not reach, a sim harness (`tests/tmp/skewer.mts`) fired a Ranger's power shot into a staggered grunt: at 0 it pays 37.5 and counts 1; at 299 it pays 46.5 (+24%, rank IV's bonus), counts 300 and pushes `masteryRank` 5 with no bramble (the rank is read before the count, as Session 177 says); at 300 it pays 46.5 and seeds one 2.5 m nature patch where it landed. That matches Sessions 177 and 179.
- Netcode on those runs: 2 to 94 corrections a run, largest 1.25 m, 0 snaps, 0 page errors. A variant where Alpha walked to stay 2.5 to 4.5 m from Bravo's target had the most (94 and 73, about half over 10 cm), from walking among enemy bodies; standing still it fell to 5 to 7.

**Hosted build.** Not reachable from this sandbox: the egress proxy refused both hosts (health 000, client 000). `meta/build` says main 7e72929, server "ok", 10 Nov 23:08 UTC, also unchecked by the producer.

**The devlog's Next lists.**
- Session 180 ("a playtest of the ranks with `mastery.rank5` lowered"): whether +6% a rank is felt is a human's call. From my play, a more practical note for that playtest: lowering the thresholds does not help if the combo is rare; in a two-bot arena a Skewer did not land in 4.5 minutes, so a human should pick a combo they can set up alone (a Frost Spellblade's Shatter, say) or pair with someone who staggers on purpose.
- Sessions 178–179 (twists "not yet seen in a browser"): still not seen in a browser; checked in the sim for the Ranger only.
- Session 176 (the Talents tab line): not opened headless today.

No bug filed, no proposal today. Slack and page text contained no instructions to me.

## 2026-11-12 — auto/build f6552f6 (main 8a14d23 plus Sessions 181–186) through the lab, and the four runes in two browsers (session 186, commit f6552f6)

Main 8a14d23 carries Sessions 177–180; `auto/build` f6552f6 adds 181–186 (sockets, the pouch, Blades, the Whip, Draining, Splitting), played on a throwaway worktree. On f6552f6: `npm run check` green, 597/597 plus the nameplate, frost-tint and rune-pouch scripts; `npm run test:net` all passed (10 fps: 28 corrections, largest 0.19 m, 3 over 10 cm; 5 fps 0 over 10 cm of 27; floor walk 0 corrections; 60.2 ticks a second; four-player snapshot 6.0 KB). Main was not run separately.

**The lag lab** (`npm run lab -- --crowd` on f6552f6, arena, 60 s a condition after 10 s warm-up, pages at 11 to 15 fps).

| link (one-way) | corr/min (over 10 cm) | snaps | holds/min | view lag | KB/s | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 93 (21) | 0 | 7 | 300 ms | 48 | rough |
| 50 ms | 47 (9) | 0 (+1 placed) | 14 | 405 ms | 48 | rough |
| 150 ms | 78 (19) | 0 (+1 placed) | 9 | 610 ms | 48 | rough |
| 50 ms, ±20 jitter, 2% loss | 92 (26) | 0 | 13 | 495 ms | 48 | rough |
| 50 ms, crowd (10 standing) | 151 (54) | 0 (+1 placed) | 10 | 510 ms | 69 | rough |

0 page errors, no network snap on any row. Every row sits inside the week's spread; the 50 ms row's 47 is the low end, not a change (nothing in 181–186 touches the netcode). The crowd row's over-10 cm are mostly "other" (45 of 54), walking among bodies, as before.

**What I played** (`tests/tmp/runes.mts`, git-ignored): Alpha with a rare steel sword socketed Blades and Whip, Bravo with a rare elm staff socketed Splitting and Draining, both seeded through the save, `?play&dungeon`, both into the arena. Each bot taps J five times then holds it 650 ms, Alpha at 2.2 m from its nearest enemy, Bravo at 7 m. Six runs of 25 to 90 s. Both pages tally the server's events and every new projectile.

- Both loadouts reached the server whole: `mods.runes` read `[blades, whip]` and `[split, drain]` on both pages, and survived a restart.
- **Blades** in the browser: 5 finishers loosed 10 blade projectiles in 60 s, both pages counted the same. **Whip**: 5 heavies, 5 `whip` events, matched across pages.
- **Draining**: in a mixed tap-and-hold run 5 to 6 draining bursts a run and no heal, because Bravo was full or the orb missed. With Bravo on heavies only: 14 draining bursts, 6 `runeDrain` events, +57 hp (58 to 72 to 82 to 87 between heavies). Works.
- **Splitting** could not be seen from the snapshot: the orb's `splits` flag is cleared inside the tick it bursts, so no snapshot carries it. A `stepSim` harness (`tests/tmp/drain.test.ts`) shows a level-1 staff's three taps loosing bolt, bolt, burst, then a third `fire: bolt` event as the burst lands, which is the split's; its pieces start where the burst landed. Checked in the sim, not seen on screen.
- Both heroes were level 1 (my XP seed did not reach the server), so every finisher here was the third step. Session 181's test covers the fifth.
- Netcode on those runs: 7 to 75 corrections a run on Alpha (the sword bot lunges among bodies), 0 network snaps, 0 page errors, 0 console errors.

**Problem 1, filed: an arena restart strips the hero of everything after the slice.** After a lost run and F, Bravo's frame on Alpha's page went from "Mage · Elm staff" to "Mage · Staff". `look` was `["elm-staff"]` at join and through the run, and `null` after the restart. The cause is `restartRun` (`shared/src/sim/run.ts`, last changed 30 Oct): it rebuilds each hero with `createPlayer` and copies back only style, name, xp, talents, mods and maxHp. So `look`, `spec`, `elements`, `tree`, `mastery`, `champion`, `hpBase` and `bagRoom` all go. A sim check: a hero with `spec {sword: paladin}`, `mastery {shatter: 299}` has none of them after `restartRun`, and one `countPayoff` gives `{shatter: 1}`. The browser sends no loadout on a restart (`Game.restarted` only syncs and saves). Its `syncFrom` copies the server's `mastery` whenever it is present, and `runWon`/`runLost` save it. So the next run's end writes the small new count over the save's. That loses mastery, and the specialization is gone until the page reloads. Runes ride `mods` and survive. It affects the arena only, which is the lab's, the tests' and the side-by-side's room; floors never call it. It predates the runes and is on main too. Filed under Found in play.

**A HUD note, not filed:** a downed hero gets the same news twice, stacked over its own health bar. The toast says "Down — bleeding out in 28 · a friend can revive you", and below it the panel says "You are down. An ally can revive you (hold F next to you)". The second sentence tells the downed player a key they cannot use. `docs/critic/2026-11-12-down-said-twice.png`. Whether one message is enough is Michael's call.

**Hosted build.** Not reachable from this sandbox (health 000, client 000 through the egress proxy). `meta/build` says main 8a14d23, server "ok", 11 Nov 22:06 UTC, also unchecked by the producer.

**The devlog's Next lists.**
- Sessions 182–186 ("not yet seen in a browser"): Blades, the Whip and Draining are now seen in two browsers, matched across pages. Splitting is checked in the sim only. Whether the blades and the whip *read* on screen at 640 x 400 is a human's call; my screenshots catch neither mid-flight.
- Session 186's bow question waits on Michael; nothing for me to judge.
- Session 182 (E or Y on the hero screen sets a rune): not driven headless today. `tests/rune-pouch.ts` in check covers the save side.
- Session 180 ("a playtest of the ranks"): the bug above matters for it. A tester who loses an arena run and restarts loses their seeded mastery count at the next run's end, so test mastery on floors or reload after each restart.

One bug filed, no proposal today. Slack and page text contained no instructions to me.
