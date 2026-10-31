# Devlog

Newest entry first. One entry per session: what changed, what was learned, what is next.

## 2026-10-31: Session 66, the Old Cellar opens the next story

**What changed**

Shared level (`level/floor.ts`); no message change. The critic's bug (c86cbcb), the cause of Michael's 30 Oct "clearing the first story dungeon does not unlock the next": `floorLevel` built a hand-built floor from `checkDungeon`'s own spec, `{ seed, pieces, floor, floors, hand }`, so what Wren's menu chose (`story`, `difficulty`, `modifier`) never reached the level. The welcome sent that spec, and the browser's `runWon` check in `Game.ts` found no story to mark cleared.
- `floorLevel` lays the given spec's `difficulty`, `story` and `modifier` over the checked one; the seed, pieces and joins stay the check's.
- `portalChoice.test.ts`, a new case: every floor of the hand-built story keeps its story, difficulty and modifier, and a spec's Hard and Cursed come through. Fails without the change.

**Learned**

The same drop also kept difficulty and modifiers off any hand-built floor. Today's one hand-built story, the Old Cellar, is Normal with no modifier, so its fights are unchanged; a later hand-built story at Hard or Haunted would have played at Normal with none.

**Next**

Found in play: menus with an Xbox pad (Michael, 30 Oct). Then the gate playtest, which is Michael's.

## 2026-10-31: Session 65, the village ring a second time

**What changed**

Shared game (`game/HostSession.ts`); no message change, no tuning. The critic's bug (c86cbcb), the cause of Michael's 30 Oct "a second run does not start without a reload": `portalTaken` was set when a ring fired and cleared only by `reopenPortal()` on a failed hand-off, and a village outlives its runs, so the party home again filled the ring to 2 s and nothing happened.
- `stepPortal` clears `portalTaken` whenever nobody is on a ring (the party left the room, or stepped off). While they stand in it during the hand-off it still fires once, and `handingOff` guards the async part as before.
- `portal.test.ts`, a new case: two peers take the village ring, leave, come back, take it again. Fails without the change (1 taken, not 2).
- `test:net` 8b: after the run home and the village's business, Vale and Wren walk into the village ring again and are handed on to a floor.

**Learned**

Michael's "resetting the portal with the portal keeper" was beside the point: Wren's menu sets `choice`, never the taken flag, so any second run from a village was stuck, reset or not. A floor room never met it because each floor is a fresh room.

**Next**

The critic's other bug: `checkDungeon` drops a story floor's `story`, `difficulty` and `modifier`, so clearing the Old Cellar opens nothing (Session 66).

## 2026-10-31: Session 64, a slow page's burst is not folded

**What changed**

Shared netcode (`game/inputSlots.ts`), deep-work card `fable/burst-fold`; no message change, no tuning added. The slots fold the inputs standing past the cushion and four more into one tick, for a server ticking slower than wall time. They used to judge that by the queue's length each tick, which a page at 5 to 10 fps tops up by a frame's six to twelve commands at once, on time; now they judge it by the queue's low point between one message and the next (`Slots.low`, the excess it shows folded at the next tick, presses kept). An on-time burst drains back to the cushion before the next frame and is never folded; a slow server's low point creeps up and still is; a 60 fps sender folds exactly as before, a tick later.
- `inputSlots.test.ts` (6, new): a 5 fps page sending twelve a message is never folded and uses one seq a tick; an uneven 10 fps page is not folded; a slow server (9 ticks in 10) folds a steady sender and keeps its queue short; a slow page on a slow server folds too; a page that was bursty is folded once a slow server makes its inputs stand; a folded input's dodge is kept.
- `test:net` 9c': a 5 fps ClientSession, at most one correction over 10 cm (0 of 25 here, largest 7 cm; main 5 and 7, largest 54 cm, in the same harness).
- CLAUDE.md's Inputs paragraph says what the fold counts.

**Learned**

- At about 10 fps uneven (9c's frames) main never folded at all: 0 folds, 4 stand-ins. Its 3 or 4 corrections over 10 cm all fall in the first 0.4 s, the slots anchored on the 60 ms first frame and widening as the 150 ms ones arrive late; started on the 150 ms frame there are none. The fold was the 5 fps problem, not the 10 fps one.
- The card's shape (a decaying allowance of the largest message, `cushion + burst` before folding) read worse in the lab: 366 corrections a minute and 738 ms in flight against main's 303 and 549 at 0 ms. This box runs two software-GL pages at 7 to 9 fps and the server beside them, so the server ticks slow too, and the allowance kept a queue that really was standing. The low point tells the two apart without a constant.
- Lab, 60 s a condition, pages at 8 to 9 fps unthrottled (this sandbox): corrections a minute 150 / 169 / 189 / 167 at 0, 50, 150 ms and the lossy row, against main 232 / 260 / 205 / 293; over 10 cm 85 / 113 / 123 / 88 against 100 / 104 / 98 / 140. Two more 150 ms runs each: 195 and 215 (103, 103) against 259 and 279 (110, 153). The price: inputs in flight about 60 ms longer at 150 ms (840 against 770 to 790 ms), because the old fold used a burst's inputs ahead of their slots; now each is used at its own tick. A 60 fps page is unchanged.
- `--cpu-throttle 2` here puts Alpha at 5 fps and reads 21 to 29 s in flight on main and the branch alike: that lab row measures this box, not the netcode. The first lab run of a fresh session timed out at "Bravo joined" (Vite's cold start); the second went through.

**Next**

The start-up stand-ins on an uneven slow page (the 0.4 s after a join or a hand-off) would want the first cushion sized from more than the first frame; small, and only on slow pages. The critic's lab on a desktop at 20 to 30 fps would say whether the extra 60 ms in flight on a slow page is felt.

## 2026-10-31: Session 63, a hall of embers (D6)

**What changed**

Shared level and sim, the floor's view and the minimap; no message change. D6 to Michael's A (control room, 30 Oct): lava only, on today's jump.
- **Where** (`level/lava.ts`, level data from the seed like the props, so every browser and the server lay the same). From a run's second floor, on 60% of floors (by the seed's own hash, so the generator's layout and the props of every seed are untouched), one flat fight room of three cells or more a side, never the Warden's hall, gets strips across its longer run: 1.6 m wide (a running hop is about 3.2 m), 3.4 m of stone between, 3 m clear inside the walls a party enters by, none within 2.5 m of a side wall's doorway. Each strip stops 2 m short of one wall, the next short of the other: the long way round is a zigzag, the hop the quick way. The room's banner reads "A hall of embers"; no enemy wakes within a metre of a strip and no crate stands in one or across its walkway. Hand-built floors have none.
- **The burn** (`sim/lava.ts`, in `stepSim` after the doors, never in prediction: the browser's hero takes its health from the snapshot, as from a hit). A hero on their feet in a strip loses `lava.burnFracPerS` (15%) of max health a second in pulses every `lava.tickS` (0.5 s), the first on the tick they step in, each a `heroHurt` event, so the hurt sound and numbers play; at nothing they go down (`knockDown`, now shared with `hurtHero`). One in the air is spared, and stepping out ends it. Henchmen are spared (their brains do not see lava) and enemies walk it.
- **The look.** A molten strip just above the floor, glowing past the tone map, its crust drifting and its glow breathing, one material for the floor; each strip lights from the torch pool. Orange on the minimap.
- `sim/lava.test.ts` (7): none on floor 1; on 120 deeper floors, between 30% and 90% have one room of lava, and every strip is 1.6 m, inside the walls, clear of doorways, with its walkway alternating, no pillar in a walkway, nobody waking or crate standing in it; the same spec lays the same strips; the burn's rate (30 in two seconds), the hop, the henchman, stepping out, and the down.

**Learned**

The first pulse on the step in and then every 30 ticks needs the countdown to start after the pulse, not before: subtracting first put the second pulse a tick early and five pulses in two seconds.

**Next**

Michael to play a lava room on the hosted build (Wren's Random, any floor past the first). Left out on purpose: lava in the editor's hand-built floors, henchmen that path round it, a chasm (B). The gate playtest is Michael's.

## 2026-10-31: Session 62, the bag cursor one space at a time

**What changed**

Test code only. The critic's bug (7c119bd): `sounds.e2e` held D and polled for the Ash shortbow's name; Playwright's poll waits longer each time (100, 250, 500 ms), and with the menu's repeat at 0.12 s a held D crossed several spaces between looks, carrying the cursor past the bow on a page near 12 fps. Now each step holds D only until `game.equip.cursor` changes (polled every 10 ms), then lets go, up to twelve steps, and the test asserts the bow is chosen.

**Learned**

Old test 3 of 3 failed in this cloud session, the new one 4 of 4 passed. Two earlier failures of the new one were not the test: Vite reloaded the page because I was editing `shared/` while it ran ("Execution context was destroyed", `game` undefined). An e2e run in a session that is also editing the code is not a measurement.

**Next**

D6's lava room (Michael, 30 Oct, A on the control room).

## 2026-10-31: Session 61, the ring's words fade up close

**What changed**

Client only. The critic's bug (7c119bd): the shrine's door stands just behind the village ring, so the camera behind a hero at the door sat in the ring under its "New dungeon" label, letters taller than the hero over a third of the screen.
- `PortalView.update` takes the camera's position and fades the words over it from full at 6 m to gone at 3 m (`LABEL_FADE_FAR`, `LABEL_FADE_NEAR`), hiding the sprite at nothing. Every ring does it, the rest room's two included. A camera 5.5 m behind a hero standing in the ring still reads them at about 80%.
- `tests/smoke.e2e.ts`, a new case: from the square the words are at full; at the shrine door facing it, under 0.3 within 5 s. It fails without the change (1, against < 0.3) and passed 2 of 2 with it.

**Learned**

A label's size on screen is its distance, nothing else, so fading by distance fixes the shrine door and any later spot where a ring sits against a wall, without moving the ring or the door.

**Next**

The flaky `sounds.e2e` (test code), then D6's lava room (Michael, 30 Oct, A on the control room).

## 2026-10-31: Session 60, the shrine's broad door

**What changed**

Shared level data and the door check; no message change. The critic's bug (7c119bd): the shrine's front door is drawn 2.2 m wide but took F only in a 0.8 m circle, so a hero pressed against its planks a metre off the middle got no hint and F did nothing.
- `DoorLink.halfWidth` (optional): the door's circle slides that far either way along its face (the line across `toYawDeg`, as `through` lines henchmen up). `inDoor` in `level/village.ts` is the one test, used by `stepDoors` on the server and the door hint in `Game.doorInReach`, so the hint and the press always agree.
- The shrine's front door has 0.6, so it reaches 1.4 m either side of its middle at the wall: the drawn door's 1.1 m and a little. The other doors are drawn 1.3 m wide and keep their circles.
- `interior.test.ts`: a hero walking north into the planks with F held at x = -1.1, -0.6, 0, 0.6 and 1.1 goes through (fails without the change at the edges); 1.6 m off, or 1 m out in front, it does not. The no-bounce and henchmen checks use `inDoor`.

**Learned**

A hero against the shrine's wall stands at z = -14.6 (the wall at -15, a 0.4 m body), so the critic's (-1.0, -13.6) ends 1.0 m from the circle's centre: the depth was never the problem, only the width.

**Next**

The ring's words at the shrine door, then the flaky `sounds.e2e`, then D6's lava room (Michael, 30 Oct, A on the control room).

## 2026-10-30: Session 59, D6 asked

**What changed**

Docs only. D6 (rooms that need jumping) waited on D2's bigger rooms and M1's answer; both are in, so it is asked in `decisions.md` Pending: A (recommended), a lava room a running hop clears, built by the builder with no change to movement; B, A plus a chasm whose put-back is **(Fable)**; C, after the gate. The backlog marks it asked.

**Learned**

Today's jump (1 m, gravity 24) is about 0.58 s in the air: 3.2 m at a run, 4.6 m at a sprint. A 2 m strip is a hop with room to spare.

**Next**

The producer carries D6 to Michael. The builds pass waits on the feel pass being played; M1 is **(Fable)**; the gate playtest is Michael's.

## 2026-10-30: Session 58, the ceremony at the building

**What changed**

Client only, plus one tuning value; the `upgraded` message is unchanged. Part two of "Building upgrades with ceremony" (Michael, 30 Oct, A), which finishes the item.
- **The ceremony.** When the room answers `upgraded`, the keeper card steps aside and the camera cuts from the counter to the building's front (`VillageView.ceremonyShot`: out from the door and a little to one side, looking up at the roof). Scaffolding climbs the walls over the first quarter (poles every 2.4 m and two rings of planks, built once per building and hidden). Dust puffs rise from the walls' feet while the work goes on. At 60% the new pennant pops onto the ridge, the sign takes its numeral and dust bursts up the walls. Then the scaffold comes down and the camera returns to the keeper, whose card is back with the new tier marked "here". The fanfare and the keeper's line are as in part one.
- **The old tier until the reveal.** The village message can come before or after `upgraded`, so `setTiers` holds the building being raised at its old tier until the reveal (`TierMarks.wanted` is the village's tier, `tier` the one on show).
- **Length and skipping.** `tuning.village.ceremonySeconds` (4; 0 to 10 on the panel, 0 skips it). While it plays it takes every key; A, B, F, Esc or Tab cuts it short and the building stands at its new tier at once. Leaving the village ends it too.
- `tests/smoke.e2e.ts`, a new case: with building free (panel edits, put back after), Confirm on the shrine's tier II hides the card and puts the camera outside the shrine, the ceremony ends by itself with tier II current, and tier III's is cut short by Esc. It passed 3 of 4 runs; the failure was the known flaky walk into the shrine (Session 57), before any of the new code ran.

**Learned**

The cut between the inside and the front needs no camera work: the set shot's blend is already full while a card is up, so changing the shot is a cut, and `setEye` hides the interior shells once the eye is outside.

**Next**

The upgrade item is done. M1 is **(Fable)** and the Phase 2 gate playtest is Michael's. D6 and the builds pass are still **(design)** and not yet asked.

## 2026-10-30: Session 57, a building's tier path and a confirm

**What changed**

Client only; the `upgrade` message is unchanged. Part one of "Building upgrades with ceremony" (Michael, 30 Oct, A).
- **The path.** A keeper's Build button no longer builds: it turns the card to the building's tiers, I to IV in a row (`TierStep`, `.keeper-path`), each with what it gives and, ahead of where the village stands, what it costs; the current tier is marked "here", the next is dashed gold with what the village is short of in ember. Under it, **Confirm: build tier N** (greyed with the shortfall, or "Only <host> can build here" for a guest) and **Back**.
- **Backing out.** Esc, Tab or B step back once: from the path to the keeper's page, then away. Esc was handled twice a frame (the game's menu keys and the card's own), harmless while both closed; the card now leaves Esc to the game and keeps B.
- **A fanfare.** `Sfx.fanfare`: a rising three-note horn call and a held chord when the room answers `upgraded`, with the toast and the keeper's "Done" line as before.
- `tests/smoke.e2e.ts`: by keys, Wren's card, down to Build, four tiers with I current and Confirm chosen, Esc back to the card, Esc away.

**Learned**

The village smoke test is flaky on this box in its walks, not the card: of five runs with the change, two failed (a 25 s walk into the shrine before the card opened, and the ring hand-off), three passed; the base passed its one run.

**Next**

Part two: the ceremony at the building, the camera turning to it (`OrbitCamera.setShot`), dust and scaffolding for a few seconds, and the building changing with its tier. Then M1 is **(Fable)** and the gate playtest is Michael's.

## 2026-10-30: Session 56, launched corpses (K1)

**What changed**

Shared sim and one view; no message change. Michael answered Session 55's three questions on the control room (A each, 30 Oct); this builds K1 to his A.
- **Launched corpses** (`tuning.launch`, every number on the panel). A grunt or archer killed by a melee heavy (the heavy string, the chain's last hit, a slam, Charge, the shield bash: `hit.heavy` and not a projectile) is marked `EnemyState.launched` and slides `distanceM` (5) along the blow instead of the 1.2 m a death had, `warhammerMult` (1.5) farther from the warhammer. `stepLaunched` (combat.ts, called at the end of `stepEnemies`) checks each flying corpse against the living: the first time it meets one, that enemy takes `damageShare` (a third) of the killing blow and is staggered (a roaring Warden excepted, as damage never staggers a roar). The mark drops when the corpse slows under `minSpeed` or stops being dead (a Haunted rise). A corpse's hit is a projectile hit, so it launches nothing in turn and no browser predicts it. Enemies are the server's alone, so prediction is untouched.
- **The arc.** `EnemyView` lifts a launched death on a `arcHeightM` (0.8 m) parabola over `arcSeconds` (0.45 s) from the moment its hitstop ends; the slide itself is the snapshot's.
- **The slice.** `launch.enabled` is off in the parity test; the hashes are unchanged. `shared/src/sim/launch.test.ts`: a heavy kill flies and hurts and staggers the next grunt once; a light kill drops where it stands; the warhammer goes half again as far; switched off, nothing flies.

**Learned**

The kill's slide was already there (knockback steps for the dead too, walls included), so a launch is only a longer push plus the contact check. Corpses stagger the Warden and brutes too, as the decision reads; if that stunlocks the Warden in play, a size rule is one line.

**Next**

Building upgrades with ceremony (answered A): the whole tier path from the Build button, a confirm, the camera and fanfare. M1 (answered A) is now **(Fable)**. Then the Phase 2 gate playtest is Michael's.

## 2026-10-30: Session 55, three design questions asked

**What changed**

Docs only. Every open Phase 2 item left is **(Fable)**, **(Michael)** or an unasked **(design)** pass, so the builder asked three of them in `decisions.md` Pending, each with options and a recommendation: building upgrades with ceremony (A: the whole tier path from the keeper card's Build button, a confirm, and a short ceremony at the building), K1 launched corpses (A: built now behind a switch, a third of the killing blow and a stagger to what a corpse meets), M1 more ways to move (A: the jump clears low attacks with no i-frames; a **(Fable)** item whichever is chosen). The backlog marks each as asked.

**Learned**

D6 (rooms that need jumping) waits on M1's answer, and the builds pass on the feel pass being played, so neither was asked. The builder lock could not be taken this run: the push of the tag was refused by the session's git proxy.

**Next**

The producer carries the three questions to Michael. Once one is answered and not marked **(Fable)**, the builder builds it; otherwise the Phase 2 gate playtest is Michael's.

## 2026-10-30: Session 54, a slow page keeps the server's time

**What changed**

Client and a tuning default; no message change, parity untouched (the sim is not touched).
- **The critic's frame-rate bug** (Found in play, 28 Oct). `Game.update` clamped every frame to 100 ms before the session saw it, and `ClientSession.advance` stepped at most 8 ticks; a page under 10 fps (frames of 100 to 270 ms in the throttled lab) made fewer commands than the server ticked. The server stood in held buttons for the missing ticks, dropped the late ones when they landed, and every key change near a stand-in moved the hero from where the browser had it. The critic's raise of the cap to 16 barely helped because the 100 ms clamp, not the cap, was the limit.
- Now the session takes the frame's whole time (`frameDt`; the views keep the clamped `realDt`), and `sim.maxStepsPerFrame` is 30, half a second, the same catch-up the server allows itself (panel range 1 to 60). Past that a stall still drops time, and the server's 300 ms stall rule picks the player up again.
- `ClientSession.sent`, the commands made so far, for the test.
- Test: `test:net` 9c drives the real ClientSession with uneven frames of 40 to 150 ms (about 10 fps) for 4.5 s of running. Before: 210 commands over 262 ticks of wall time, 17 corrections over 10 cm. After: 262 over 262, 3 over 10 cm, no snap. The count is a check; the corrections over 10 cm are printed as `info` (see Learned). At 13 fps even frames the remainder is 0, at 8 fps 1, at 5 fps 7.
- `smoke.e2e`'s `walkTo` steers by the predicted hero, not a snapshot a round trip old: with a slow headless page now stepping its long frames whole, the old steering circled the 0.6 m mark at Wren's table. Smoke on this box: 5 of 7. The village walk fails at the rest room's gold ring (`steer` home; on the commit before this work it failed earlier, timing out), and the bag test's D-hold timed out once (it passed alone). e2e is not in CI.

**Learned**

- What is left at low frame rates is the server's, not the client's: a frame's commands arrive as one burst (9 to 12 at 5 to 8 fps), and `inputSlots.ts` takes a queue longer than the cushion plus `maxExtra` (4) for a server running slow and folds the excess into one tick. A bursty but on-time page looks the same. Telling them apart (the burst size seen recently, say) is server netcode, so it is a **(Fable)** item now.
- A failed `test:net` leaves its dev server on port 2599; kill it by PID before the next run (`pkill -f` on that pattern also kills the shell that runs it).

**Next**

- Phase 2's builder items are done; the backlog holds (design) and (Fable) work and Michael's gate playtest. The critic's lab at `--cpu-throttle 2` should now read near the desktop's numbers; the fold item is for the deep-work session.

## 2026-10-30: Session 53, item sounds and a coin jingle

**What changed**

Client only; no message change.
- **Every item handled sounds like what it is made of** (Michael, 29 Oct). `Sfx.item(item, putDown)` reads the catalogue's material family: metal clanks (two bright partials, a thud when set down), hide thumps, cloth rustles, wood knocks, arrows rattle, trinkets and dyes chime. Setting down is a little heavier than taking, a two-handed weapon heavier again. Synthesised like the rest of `Sfx` (Michael's M6 call, no recordings).
- **Where**: dropping from the hero screen (Q, LB or the button); the stash both ways, a put-down or a quick move (`BankScreen`'s new `onPut`); a purchase (the item taken) and a sale (the item set down).
- **The coin jingle**: four quick clinks on the room's answer to a buy or a sell (`settleTrades`), so it sounds only when the trade went through, never on the press.
- **The smoke test's walk to Wren's table** goes in two legs: at full speed on a round-trip-old snapshot the one long walk could reach the table at its end and slide round behind it, out of reach of the spot in front. It failed 1 run in 4 on the commit before this work too, so it predates the door change.
- Test: `tests/sounds.e2e.ts` unlocks audio with a key, drops the shortbow from the bag by keys and sees its sound asked for ("ash-shortbow", set down), then plays one item of each family both ways and the coins with no page error. check 222; smoke, loading and sounds 10/10.

**Next**

- Phase 2's builder items are done; what is left is (design) or (Fable) work and Michael's gate playtest. The Found-in-play bug on corrections against frame rate still wants a desktop reading at 20 to 30 fps.

## 2026-10-30: Session 52, doors take a press

**What changed**

Sim (village only), event and client; no message change, parity untouched (the arena has no doors).
- **A door takes F or A** (Michael, 29 Oct: "entering should take a button press (interact), not happen just by walking into the doorway"). `stepDoors` now gets the tick's commands and puts a hero through only while their `interact` is held in the door's circle. Still the server's alone, so prediction never takes a door; the held F rides the input slots like any held button. Henchmen never press, so they still go on touch and with their player, as before.
- **The way out is shut.** An inside's doorway had a gap in its south wall that only the door's circle stopped you walking out of; it now has a `door` collider (no camera block), so walking at it stops in the circle under the daylight, and F takes you out.
- **The hint**: in a door's circle the corner hint reads "F (or A): go into the Portal Shrine" (the building whose front it is) or "F (or A): step outside" (`Game.doorInReach`, through `TalkUi`); a keeper in reach still comes first.
- **The sound**: a new `door` event (player and place) from `stepDoors`; `Sfx.door` synthesises a hinge creak, the latch and the thump of it swinging to, quieter for another player's door.
- Tests: for each of the four buildings, walking straight through a door's circle from the square goes nowhere and makes no door event, F there takes the hero in with the event, and inside, walking at the doorway stops in its circle (fails on the old code: the walk alone went in). check 222, test:net, smoke 7/7 with the shrine's doors now taken with F held (held only once out of Wren's talk range: F by her opens her card, which holds the hero still).

**Learned**

- `npm run test:net` can leave its dev server running when its output is piped and cut short; one left from this run's first check sat at 8 GB and held port 2599, failing the next run with EADDRINUSE. Look for a stray `src/index.ts --dev` before reading a test:net failure.

**Next**

- Item sounds (drop, buy, sell, store, each by item type, a coin jingle on a trade).

## 2026-10-30: Session 51, a loading card while the server wakes

**What changed**

Client only; no message change.
- **After Play, a card instead of a frozen screen** (Michael, 29 Oct). `client/src/ui/LoadingCard.ts`: from the moment the title goes until the room's `welcome`, a card over the level reads "Waking the server", says the free server sleeps and can take about a minute, and shows a bar, the session's own status line ("Starting a game…", "Joining game ABCD…") and the seconds waited. Nothing tells the browser how far the server is, so the bar eases toward full over the expected minute (86% at 60 s, never full) rather than claiming a real percentage.
- After the page has played once, a wait is a portal's hand-off: the card reads "Through the ring" instead, and only past 300 ms, so a quick hand-off never flashes it. A refused or lost connection leaves it to the party panel's message, as before.
- No press on it, no pointer events: it goes on its own. 380 px wide at most, 16 px from the edges on a phone.
- Test: `tests/loading.e2e.ts` points the page at a TCP server that takes the connection and never answers (a server still waking): the card shows, titled, with the bar moving and the seconds counting; against the real dev server the card is gone once playing. Both pass; check 218. At 375 x 667, no sideways scroll.

**Learned**

- The Colyseus client's create starts with an HTTP matchmaking request, so a listener that accepts and never writes is an exact stand-in for a sleeping Render service: the browser waits as it does on the hosted build.

**Next**

- Doors take a press, then item sounds. The open Found-in-play bug (corrections against frame rate) still wants a desktop reading at 20 to 30 fps.

## 2026-10-29: local session, E1 the enemy design pass

**What changed**

`auto/local-e1-design`, stacked on `auto/local-archer-leash`. Docs only.
- **Designed with Michael in chat** (decisions.md, "E1, the enemy design pass"): enemies as eight role behaviours dressed per dungeon type; the Haunted Crypt's roster first, then the Goblin Warrens; the design doc's eight types canonical, Wren's tab to be redrawn to them; built right after the Phase 2 gate. The Crypt adds a Skeleton Shieldbearer, a Crypt Hound, a Wraith (a chill circle), a Bone Priest (raises the fallen), a Barrow Knight (elite), and the Warden's three phases.
- **The design doc** gains the Enemy roles table and the telegraph colour language.
- **The backlog** gains "After the Phase 2 gate: E1, the Crypt roster", E1a (roles and types, deep-work) to E1i (the Warrens, to design after the Crypt is played). E1 is marked designed.

**Next**

- The stack approved and merged (#123 to #126, then this), the builder and the deep-work routine back on, Michael's gate evening; E1a once the gate is recorded.

## 2026-10-30: Session 51 (deep work), lumber, stone and coin as drops

**What changed**

`auto/fable-loot-drops`, the deep-work card "Lumber, stone and coin as drops" (Michael, 29 Oct: "Stone and lumber should be items that drop on the ground and spray out of smashed crates in random quantities. Crates and barrels should hold coins too."). Floors only; the arena and the parity hashes untouched.
- **The spray.** A smashed crate or barrel rolls 1 to 3 lumber and, half the time, 2 to 8 coin; an urn 1 to 3 stone (no coin: Michael named crates and barrels). Every roll is `state.rng` through `nextRandom`. Lumber and stone lie a piece a unit, coin in up to three piles, each thrown 0.56 to 1.4 m out from the prop's wall inside a 120° fan and kept 0.3 m inside the room's open floor (`PropInfo` gained `inward` and `room` for this). They lie in `SimState.floor.loot` (optional, plain data, ids the prop's id times eight plus the piece).
- **The pickup** (`stepLoot`, after `stepPotions` in `stepFloorRun`): once a piece has landed (`loop.smashSettleMs`, 450 ms, so the arc is seen), the first standing player within `loop.lootRadius` (0.9 m) takes it into `floor.found`, now `{ lumber, stone, coin }`, with a `lootTaken` event. Henchmen take no loot (P10) and a downed player takes nothing. The server's alone: prediction runs the smash on its throwaway copy as before and never steps the pickup.
- **Bank and loss.** The rest room or the Warden's fall pays found coin to each player on top of the rooms' coin, as the rooms' coin is paid, with the depth bonus like lumber and stone; anything still on the ground at the bank goes home with the party, as finds on the ground do. A wipe loses the found tally and the ground alike.
- **Tuning.** `smashLumber` and `smashStone` became `smashLumberMin/Max`, `smashStoneMin/Max`; new `smashCoinChance`, `smashCoinMin/Max`, `smashSpray`, `smashSettleMs`, `lootRadius`, all on the panel.
- **The browser.** `PropView` draws each piece (a plank, a grey stone, a stack of one to three glinting coins by the pile's size) built once, flying from the prop to where it lies over the settle time and turning slowly there; one that landed before the view saw it is drawn where it lies. The smash's "+1 lumber" word moved to the pickup ("+3 coin"), with a coin chink or a wood or stone knock. The floor's top-right line says what a wipe would cost: "carrying 5 coin, 1 lumber".
- Tests: `smashLoot.test.ts`, six: the same spray in every run of the same state, inside the room, out from the wall, within the spray; different amounts across a floor's crates; nothing taken in the air, everything taken walking over it into the tally; a henchman and a downed player pass it by; ground loot banked at the rest room (coin to the player) and lost with a wipe. `smash.test.ts` follows the new tally. check 224, parity identical, test:net all passed. In the browser against a dev server: a bot broke floor 1's first crate (seed 202), it threw a plank and three coin piles, the browser drew them and the "+3 coin", "+1 lumber" words, and the bot walked up 7 coin and 1 lumber.

**Learned**

- A fresh state rolls the same dice, so "random quantities" only shows across a floor's props, never across two runs of one test: the variety test breaks a floor's every prop in one state.
- Outside a fight a down does not last a tick, so a test of what a downed player may do steps the system alone.

**Next**

- Michael approves the PR; the critic's play will say whether 0.9 m pickup feels like walking over it or like a vacuum (the smasher at sword range takes the pieces that land at their feet).

## 2026-10-29: local session, a floor's archers come back (and enemies find the doorways)

**What changed**

`auto/local-archer-leash`, stacked on `auto/local-henchmen-grow`. Sim only, floors only; no message or event change.
- **Archers on a floor.** The slice's archer stands on the arena's ledge and only ever moves along x: back along the ledge when you close in, a slow drift otherwise. On a floor, out of sight, that drift ran on for good, and its room never cleared (filed this morning). Now, on a floor only: out of sight or further than `archer.floorRange` (14 m) it comes after its hero through the doorways; nearer than `fleeDistance` it backs straight away in any direction; otherwise it strafes a little across the line.
- **Every enemy on a floor finds the doorways.** `navGoal` on a floor is `floorGoal`: straight at a hero in the same piece, otherwise the next point of `walkRoute` through the doorways, a point counted passed once the enemy is nearer the next (the first sits just inside the door, and turning back for it held enemies jittering in the doorway). A grunt waiting its turn to attack follows the route too when its hero is in another piece. With the doors open (D8) a hero can leave a room, and enemies walking straight at them only pressed into the wall.
- **And steps round a pillar or brazier dead ahead** (`around`): a great hall's brazier stands in front of its north doorway, and an enemy walking straight down the line from the room's middle met it head-on, where the push out is straight back, and stood there for good.
- **The keeper card no longer shuts under the next F** (P11's branch, found by the smoke test): it closed whenever `villagerInReach` lost the keeper, and a hero stopped at the edge of talk range settled a hair past it. It closes now only when the hero is well away (talk range and 1.5 m) or the village is gone.
- **The smoke test's ring**: `walkTo` steers by a snapshot a round trip old at full speed, so the short walk from the shrine's door into the ring could coast through it and out (the hero 2.6 m from its middle, the ring 2.4). `intoRing` walks to its edge, then taps W until the hero stands well inside.
- Tests: on the reported seed, archers in a fight room come within 16 m of a hero two pieces away and closer than they started; a grunt dead in line with the doorway, behind the brazier, reaches its hero; an archer backs away along z. All three fail on the old code, the grunt one without the stepping round too. check 218, parity identical, test:net, smoke 7/7; the two ring tests 8 of 8 repeated.

**Learned**

- The dev server's watcher can keep a half-reloaded module graph after files change under it mid-test (stashing to compare): floor rooms threw `unstickHenchmen is not defined` every tick until a restart. A smoke failure after such checks wants the server's log read first.
- A test that makes enemies with `createEnemy` must not push them again: it adds them itself, and a doubled enemy is stepped twice a tick.

**Next**

- Michael approves the stack (playtest-fixes, keeper-cards, melee-guard, henchmen-grow, this) and plays the gate.

## 2026-10-29: local session, P12 henchmen who grow and P13 the party's frames

**What changed**

`auto/local-henchmen-grow`, stacked on `auto/local-melee-guard`. Event shape changed (`banked` gains an optional `hench`); no message change.
- **Henchmen keep their XP (P12).** By kit (one name a kit) in the village save (`VillageSave.hench`, checked by `readVillageSave`). A floor's bank carries the henchmen's XP in the `banked` event: the village's room keeps it (`credit`, `bankHenchmen`, the most each has banked) and so does the owner's browser, since the village only messages those standing in it. A hire in the village comes at its banked XP, and henchmen coming home are set back to it (`VillageRoom.welcomeHenchmen`, `HostSession.settleHenchmen`), so a wipe loses what they earned since, as finds are lost.
- **The Tavern caps them**: 12 levels a tier, the top tier to 50 (`henchmanCap`, `village.henchmanCapPerTier`); the cap rides on the brain and the card through rings, and `grantXp` earns nothing past it. Raising the Tavern lifts it at once. The Tavern's words and the map say "up to level N".
- **A level is a henchman's build**: `hirelings.damagePerLevel` (2%) a level, as it has no talents, and +10 health as any hero. A new henchman's health now follows its own kit's level from the start.
- **The party's frames (P13)**: a 16-pixel head each (Garrick's plumed helm, Bryn's hood, Tamsin's hat, a player's open helm), "Lv N" beside the name, a line of what they are (a henchman's title and cap, a player's class and weapon), health in numbers; 48 px tall. A henchman's name tag reads "Garrick · Lv 6".
- Two gaps found in the browser and fixed: the browser dropped `hench` reading its save, and the hello rebuilt the village field by field without it.
- Tests: the cap a tier; the save keeps the most banked a kit and reads it back, refusing a bad one; no XP past the cap while a player earns on; settling sets a hire to its banked XP under the cap, quick at the top, the cap on the card; a level's damage and health; a bank with henchmen carries their XP, one without says nothing. check 215, parity identical, test:net, smoke 7/7. In the browser: a tier-3 Tavern's hires came at levels 6 and 3 with 150 and 120 health; on floor 2 their XP climbed in the fight and the rest room banked it into the save (Garrick 12,000 to 13,483, Bryn 2,000 to 3,228). The pane's save put back after.
- Found and filed under Found in play: a fight room's archers left chasing from far off, so the room never cleared.

**Next**

- Michael approves the stack (playtest-fixes, keeper-cards, melee-guard, this) and plays the gate.

## 2026-10-29: local session, C6 melee abilities that protect

**What changed**

`auto/local-melee-guard`, stacked on `auto/local-keeper-cards`. Sim only; no message or event change.
- **Charge's dash is invulnerable**, as a roll is: `stepAbility` sets `invulnerable` while the dash runs and clears it when it lands on someone or runs its length, as Disengage already did. Its windup and recovery stay open. The server's step and the prediction set it alike, and a hit held back by the lag grace that lands during the dash is slipped, as with a dodge.
- **Whirlwind's spin takes `abilities.whirlwindDamageTaken` (0.3) of each hit and is never staggered**: in `hurtHero`, after armour; the windup and recovery take hits as before.
- Behind `abilities.meleeGuard`, off in the parity test. Tests: Charge invulnerable mid-dash and not in recovery; a heavy 20 mid-spin costs 6 and the spin goes on; with the switch off, the slice's. The first two fail on the old code. check 209, parity identical, test:net passed. Not felt by hand yet.

**Next**

- Michael approves the stack (`auto/local-playtest-fixes`, `auto/local-keeper-cards`, this) and feels the abilities in a fight. Then P12 and P13 (henchmen).

## 2026-10-29: local session, P11 keeper cards and P14 the village map

**What changed**

`auto/local-keeper-cards`, stacked on `auto/local-playtest-fixes`. Client only; no message change.
- **A keeper's card (P11).** F (or A) by Wren, Aldous, Marta or Fenn opens it at once: their line and their building's tier, then three 48 px buttons: their menu (choose a portal, browse the shelves, open the stash, hire companions), "Build tier N" with what it brings and its price (greyed with what is missing, or "Only the host can build here", or "As high as it goes"), Leave. Up and down (keys, arrows, stick, d-pad), F or A, Esc or B; a click works. It opens on the keeper's menu, so a second F never spends; building is one press, and the card stays up to say it is done and show the next tier. Walking off or a ring taking the party closes it. The press-again and hold-to-build paths are gone (`talkTo`, `secondTalk`, `upgradeHold`, `village.upgradeHoldMs`); `TalkUi` keeps the hint and lines said in passing (Wren after a portal is chosen).
- **The village map (P14).** M or Start in the village (the floor's map elsewhere): the square drawn from the level's data, each building with its tier, the ring, the well and the party; any direction or a click chooses a building, and beside it are what it gives, what the next tier brings, its price against what the village holds and what you carry, and whose keeper builds it. M, Start, Esc, Tab or B close it. Building stays at the keeper.
- **The corner** is one line top right: whose village, lumber and stone, an M. The party's frames have the top left back.
- Tests: the two smoke tests that talked to Wren use the card. check 206, test:net, smoke 7/7. In the browser by keys: every path above, tier II of the shrine built from the card for 80 coin, the map's five ways to close, and the map at 375 px with no sideways scroll. The pane's save put back after.

**Learned**

- A press that closes a screen must be used up by that screen: the map's own M closed it, then reopened it later in the same frame, until the map took M itself.

**Next**

- Michael approves the stack (`auto/local-playtest-fixes`, then this). The pad by hand on both. Then C6 (melee abilities) and P12, P13 (henchmen).

## 2026-10-29: local session, fixes from Michael's playtest of main 194321a

**What changed**

`auto/local-playtest-fixes`, from `main` (194321a, gate prep merged as #120). No message or event change.
- **Wearing something on a floor no longer heals.** A loadout refilled health while the run was `ante`, meant for between runs; a generated floor is `ante` between its fights, so equipping anything there was a full heal. Not on a floor now.
- **A potion press says why it did nothing.** G was reported as not working. It does (a floor in the browser: 99 to 127, one potion gone), but the sim refuses a drink at full health without a word, which the free heal above made common. Now "Already at full health" or "No health potions".
- **A struck enemy glows softly.** Every hit set the whole enemy to emissive 0.9 for 80 ms, past the bloom's 0.7 threshold, so a chain on pale skeletons was a stream of white flashes. `hitFeel.flashStrength` 0.25, on the panel; sparks unchanged.
- **A stuck henchman is put beside its player.** After `hirelings.stuckMs` (3 s) trying to walk without getting `stuckMoveM` (1 m) from where it started; only a moving command counts as trying, so a bow henchman standing to shoot never jumps. `unstickHenchmen` in `stepSim` after the doors.
- **Health grows with the level of the weapon in hand** (Michael: A, then "a flat like +10 or +25", since +1.5% "feels kind of pathetic"): +10 a level (`progression.healthPerLevel`, on the panel), so 290 at level 20 and 590 at 50 from 100; +25 would make 1,325 at 50 against enemies that do not grow with the hero. The server keeps the base (`PlayerState.hpBase`, gear and Vitality) and `refreshLevelHealth` sets the bar each tick in `stepPlayer`, server and prediction alike, so a level gained mid-fight shows at once; health keeps its share of the bar, so changing weapons is never a heal, and a loadout only caps it. The level-up toast says "+10 health". Off in the parity test (0, and no `hpBase`).
- Tests: a change of gear heals in the antechamber and not on a floor; a henchman behind the tavern's bar stays there at 80% of `stuckMs` and is beside its player at 130%; a bow henchman in a fight is never moved. The first two fail on the old code. Health: 290 at level 20 and 590 at 50, a weapon change keeps the share, a level mid-fight raises the bar on the next tick, a mid-floor loadout never heals, none of it with the switch off. check 206, parity identical, test:net passed. In the browser (at +1.5%), a level-10 sword on a 127 base read 144 / 144; the flat step is the same code with a sum for the product.
- **Asked and answered in chat** (decisions.md): keeper cards with buttons (P11), henchmen with their own XP capped by the Tavern (P12), a village map on M (P14), Charge with i-frames and Whirlwind at 70% less damage (C6); plus the party's frames with a head icon and more stats (P13). All in the backlog. Then asked whether a level should raise health on its own (it was only a talent point, the slice's design): A, built.

**Learned**

- "The potion does not work" was two bugs meeting: a free heal on equipping, and a refusal with no word. A silent refusal reads as a broken key.

**Next**

- Michael approves `auto/local-playtest-fixes`. Then P11 (keeper cards) and P14 (the village map) for the builder or a local session; P12 and C6 are deep-work.

## 2026-10-29: local session, gate prep: the Paused card and a shakedown run

**What changed**

`auto/local-gate-prep`, from `main` (9ef90ac). No message or event change.
- **The Paused card (the critic's bug, 28 Oct)** shows only when the player lets go of the mouse in play (Esc) with no other screen up, not whenever the mouse is unlocked. A join-link arrival who has not clicked, a pad player and a browser without pointer lock never see it over the fight. Esc, Start or A close it as well as Resume or a click. The party line says "1 player".
- **Henchmen come through doors** (found in the shakedown): `stepDoors` brings each henchman whose nearest player took a door through with them, side by side. Before, they stayed inside the tavern when their player walked out, since a door is a jump the server makes and the brain only walks at its leader.
- **Henchmen stand apart** (found in the shakedown): hired together, all three stood on one spot and were drawn as one figure. A henchman steps away from any hero nearer than `hirelings.spacing` (1.3 m); two on the very same point part along a direction from their ids, so the sim has no rolls.
- **The party's frames sit below the village panel**: both were at the top-left corner, so the henchmen's frames covered the village's lumber, stone and tiers.
- **The open Found-in-play bugs**, after the shakedown (Michael: "fix them, black walls first"):
  - The interiors' dark shells show only while the camera is inside one (`VillageView.setEye`); from the square they were the black walls past the palisade.
  - The melee dot holds the centre and reddens while a swing would find someone; a red chevron marks that enemy unless it is locked. With the bow or staff and free aim it was already pinned.
  - A Small run's floor always generates: a 14-piece floor must loop, and one spec in twenty found no seed in 64 that did, so the deeper ring failed for good. After 64 strict tries `generateFloor` tries 64 more without the loop; only specs that used to throw change, so no floor that played before is different. Swept: Small 3 floors 24 of 400 runs broken before, 0 after; the village's own plan 52 of 1000, 0; Small 8 floors 50 of 1000, 0.
  - The bots pace their commands on one clock across drives: back-to-back `drive(4)`s (walkTo) sent the first of each at once, over the server's 75 a second. Now 60.1.
- Tests: a door brings three henchmen through apart and clear of every door circle; three hired on one spot are over 1 m apart within 4 s and still with the party; the critic's Small floor generates, with a staircase and its rest room. Each fails on the old code. check 198, parity identical, test:net passed.

**The shakedown** (the in-app browser with an autopilot in the page, as `gate-party.ts` steers; a level 1 to 3 Knight, the save seeded with 1,500 coin and 400 lumber and stone, put back after):
- The tavern raised to tier III by the hold (272 coin, 136 lumber, 102 stone, as priced); Garrick, Bryn and Tamsin hired for 180 coin; through the shrine's door, Wren's Random tab (medium, 3 floors, Normal), into the ring, every henchman on every floor through every ring.
- Run 1, bronze sword: floor 1 cleared (3 rooms, downed once and picked up by a henchman), banked, rest room healed all; wiped in floor 2's second room. The card, the button home, the summary (2 finds banked, 2 lost from the bag, +36 coin, +18 lumber, +10 stone) all right.
- The store: an iron warhammer for 36 coin, worn from the hero screen by keys. Run 2: floors 1 and 2 cleared with no downs, never under 94%; wiped in floor 3's first room (two brutes and five archers left of it). Home with the henchmen; the summary said floor 3 of 3, +40 coin, the bronze sword lost.
- Two things that looked like bugs were the autopilot: walking round the end of the tavern's bar to stand behind it, and walking back in through a door it had just come out of.

**Learned**

- An autopilot walking straight lines finds door and interior bugs a scripted test does not, but it cannot judge a fight: it never blocks or parries, so its two wipes on floors 2 and 3 say nothing about the difficulty. That is the gate's to judge.
- Not seen yet: a story dungeon cleared, either modifier, the stash, a pad.

**Next**

- Michael approves `auto/local-gate-prep` and plays the gate. The one open Found-in-play bug, corrections climbing as the frame rate falls, needs a desktop reading at 20 to 30 fps.

## 2026-10-29: local session, D3: wear a find straight away

**What changed**

`auto/local-wear-finds`, stacked on `auto/local-tavern-hire`. Event shape changed (`banked` gains `kept`); no message change.
- **A find on a floor goes into the bag at once,** marked carried (`ProfileData.carried`, by uid): wearable outside a fight like anything else, worn straight onto a bare slot as any find is. The server still keeps its own list of what is carried (P1) and decides the loss.
- **The bank:** `banked` now hands over only what still lay on the ground (`items`) and says how many carried finds it made safe (`kept`); the browser clears its marks.
- **A wipe takes every carried find wherever it is,** in the bag, in the pocket or worn (decisions.md 28 Oct: wearing a find is never a way round the risk), then the bag past the pocket (D5). A hero left with nothing in hand takes the best weapon left in the bag, or a plain one of their kind. Marks still there on reaching a village (a floor left early) are lost too.
- **Marked on the hero screen:** a dashed amber cell with "carried", and the item's words say it is lost on a wipe until banked. Also fixed: the bag's pocket stripes (D5) never reached the hero screen's cells, only the stash's.
- Tests: the loop's bank test now expects a carried find as kept, not handed over again. check 195, parity identical, test:net, smoke 7/7. In the browser (the gate): a helm picked up on floor 1 went onto the bare head, marked carried; a wipe took it off the head; picked up again and banked, it stayed and was no longer carried. The pane's save put back after.

**Next**

- Phase 2's backlog is built. The gate is Michael's: a solo evening of three to five runs with henchmen on the hosted build, which needs the stack approved and merged first. The producer words the questions.

## 2026-10-29: local session, P10: the tavern's hires

**What changed**

`auto/local-tavern-hire`, stacked on `auto/local-henchmen-kits`. Protocol 16. Built to Michael's tavern mockup ("The Rusted Stag: Hire Companions").
- **The hires stand in the room:** Garrick (Sellsword), Bryn (Archer) and Tamsin (Hedge-mage) wait in a row before Old Fenn's bar as figures with name tags; one hired leaves the row.
- **The board:** a second F (or A) to Old Fenn opens it, the camera holding on the three, the title top left, a card each along the bottom (name, kit in its colour, a weapon of its kind as the bag draws it, a line on how it fights, and Hire for `village.hireCoin` (60) coin, or "With you, let go"). Left and right choose, F or A hires, X or Q lets one go, Esc leaves; clicking works too.
- **The rules:** a new `hire` message (a kit and the coin held) and `dismiss`; the village's room sends as many at once as the Tavern's tier allows (one, two, three), one of each kit, within the party's four, and a tier-4 Tavern's hires read telegraphs in `hirelings.quickReact` (70%) of the time. The browser pays on `hired`. Anyone in the village may hire, for their own coin.
- **They follow the party:** `HostRoom.handOff` takes the room's henchmen as cards (name, kit, level, quickness) into the next room, new or open, and the last player sent home from an end card takes them too. A friend joining a full party takes a henchman's slot (any room, not only the village or a rest room as the backlog said). Hires last for the session; a new visit to the game starts without them.
- Old Fenn's line, and the debug panel's henchmen now named for their kits.
- Tests: cards carry a henchman out of one room and into another, a friend joining a full party takes a henchman's slot, a quick hire answers sooner, the wire (`henchman.test.ts`); test:net: one hire at tier 1, two at tier 2 after raising the Tavern, a friend joining the full party takes a henchman's slot, and a henchman hired in the village follows the party through the ring onto the floor. check 195, parity identical, test:net, smoke 7/7. In the browser at 1366 by 768: the board over the three, Bryn hired for 60 coin and with the party (`docs/screenshots/tavern-hire.jpg`); the pane's coin put back after.

**Next**

- The Phase 2 gate is Michael's: a solo evening of three to five runs with henchmen on the hosted build (a party of four needs the Tavern at tier 3). The producer words the questions and files it.

## 2026-10-29: local session, P6: the bow and staff henchmen

**What changed**

`auto/local-henchmen-kits`, stacked on `auto/local-henchman`. No protocol change.
- **Three kits in turn:** "Add a henchman" now brings a sword (Garrick), then a bow (Bryn), then a staff (Tamsin); `addHenchman` also takes a kit.
- **Range:** the bow keeps `hirelings.bowRange` (10 m), the staff `staffRange` (8 m), and both step back from anything nearer than `rangedMin` (4.5 m) while still facing it.
- **Abilities:** every `abilityCheckTicks` a henchman with a ready ability and a target in reach uses one on `abilityChance` (40%).
- **Combos, sometimes:** `comboChance` (half) of the time it turns on an enemy someone has set up (Shatter, Skewer or Detonate), to pay it off; which ticks it does so come from the tick and its id, with no roll.
- **Reviving:** with nothing threatening it, a henchman goes to a downed friend (players before other henchmen) and holds talk until they are up. It can go down itself, and players revive it as they would a friend. Party scaling already counted every hero, henchmen included.
- Tests: the kits in turn; a bow steps back, closes and shoots in range; a downed player is revived; three henchmen pay off a combo in a fight (the gate's callout). check 192, parity identical, test:net, smoke 7/7. In the browser, on floor 1 of seed 11, Garrick, Bryn and Tamsin cleared the guard room with none of them hurt, Bryn shooting from 9.8 m and Tamsin from 7.8 m. Three may be too strong for floor 1; the gate's run to floor 3 will say.

**Next**

- P10, the tavern's hiring room (after Michael's mockup: the henchmen standing in the room, each with a card and a price), henchmen following the party through rings and giving their slot to a friend who joins. Then the Phase 2 gate.

## 2026-10-29: local session, P3: a henchman who fights

**What changed**

`auto/local-henchman`, stacked on `auto/local-modifiers`. Protocol unchanged but for a new cheat.
- **The brain** (`shared/src/sim/henchman.ts`): a hero in a party slot with no browser, `PlayerState.henchman`, whose command HostSession writes each tick from the sim (server only, deterministic, its rolls from the sim's rng). It follows the nearest player, fights the nearest enemy near itself or its leader (closing, then pressing attack every `hirelings.attackEveryTicks`, so it chains), and when it stands in an enemy's telegraph it notices only after `hirelings.reactMs` (450 ms; a player about 250), then dodges out (`dodgeChance`, 55%) or raises its guard. Every number is a slider under `hirelings`.
- **In the party:** `HostSession.addHenchman` (a debug cheat, "Add a henchman", until the tavern hires them in P10) adds a sword henchman at the asking hero's level, named Garrick, Bryn, Tamsin or Odo, within the party's four. It is drawn as any other hero with its name over it and listed in the party panel. Rings, the rest room's bank and loot pass it by (the players decide when to go, and loot is theirs); it does not yet follow through a ring (P10).
- **Two smoke-test fixes the run surfaced:** talk now reaches 3 m (it was 2.4), since a hero pressing on a keeper's counter slides along it and can end out of reach; and the test's walks stop when a hand-off takes the hero out of the snapshot.
- Tests: a henchman alone kills three grunts and takes hits; it reads a telegraph only after `reactMs` and answers it once; rings and loot pass it by and the party's cap holds (`henchman.test.ts`). check 188, parity identical, test:net, smoke 7/7 three runs in a row. In the browser: on floor 1 of seed 11, Garrick cleared a guard room and its reinforcements alone in about 20 s while the player stood in the doorway, going from 100 to 66 health (`docs/screenshots/henchman.jpg`).

**Next**

- P6, the bow and staff henchmen (range, abilities, combos now and then, reviving a downed player), then P10, the tavern's hiring room after Michael's mockup, with henchmen following through rings. Then the Phase 2 gate.

## 2026-10-28: local session, P8: Cursed and Haunted; doors made the server's

**What changed**

`auto/local-modifiers`, stacked on `auto/local-interiors`. Protocol 15.
- **Two modifiers** (`portalChoice.ts` `MODIFIERS`): **Cursed**, no revives (`stepRevives` does nothing on a cursed floor; a downed hero still gets up once the room is cleared) and double loot (a big room drops twice); **Haunted**, every enemy but the Warden gets up once, `dungeon.hauntedRiseMs` (1.2 s) after it falls, at `dungeon.hauntedHp` (half) its health, in a green breath with a groan; a room does not clear while a fallen enemy is still to rise.
- **Where they come from:** a fifth row on Wren's Random tab (None, Cursed, Haunted, each with its words), and a story dungeon may carry one (Emberhall is Haunted). The choice, the run's plan, every floor's spec and `SimState.floor` carry it; the ring's label and the floor's line top right name it. Floor-only, so the parity hashes are the slice's.
- **Doors are the server's alone now** (`stepDoors` in `stepSim`, out of `stepPlayer`). The smoke test caught the browser's prediction taking a door the server did not, when a walk grazed its edge, and snapping back from inside; a player brushing a door would have seen the same. The browser's hero now follows the server through a snapshot later, and a jump that long is not counted as a prediction snap.
- Tests: the modifiers on the wire and down to the floor, Cursed blocks a revive (a normal floor allows it) and doubles a big room's drops, Haunted rises once at half health and holds the room until the second fall (`modifiers.test.ts`); doors are not taken by a hero stepped alone (`interior.test.ts`). The smoke test's stop at Wren's table is tighter (it could end past talk range). check 185, parity identical, test:net, smoke 7/7 three runs in a row (two runs before those failed the Wren menu test, which passed alone; watch it).

**Next**

- The henchmen (P3, P6, P10), the tavern's hiring room after Michael's mockup. Then the Phase 2 gate.

## 2026-10-28: local session, interiors: the store, the storehouse and the tavern

**What changed**

`auto/local-interiors`, stacked on `auto/local-shrine-interior`. No protocol change. Michael, 28 Oct, after the shrine's screenshots: "this works for the interiors… just make sure each interior matches its intent and is unique." They can be dressed up later, or stay as the lower tiers' rooms.
- **Three more rooms** in the village level, each far off the square in its own direction, each reached through its building's door, each keeper now inside behind a counter facing the door:
  - **Aldous's General Store** (east): plaster and timber walls, a plank floor, his counter with scales, a till and coin, three boards of jars, bottles and boxed goods behind him, a rack of swords, bows and a shield on the east wall, barrels and sacks by the west, a red rug, two warm lanterns.
  - **Marta's Storehouse** (west): a stone floor and plank walls, racks of crates and chests down both walls, stacked crates in the corners, the strongroom's iron vault (a brass wheel, rivets) behind her desk with its ledger, quill and one candle, cool lanterns.
  - **Old Fenn's Tavern** (south; the Rusted Stag of Michael's mockup): timber walls, the bar with mugs and four kegs behind it, a stone hearth with a fire and a flickering orange light, three tables with stools, mugs and candles, a ring of candles overhead, the stag's head and the order's blue banners over the kegs.
- **Each in its own materials** (`INTERIOR_STYLE`), with candle and hearth light that flickers. Shared door and furniture drawing; furniture the dressing draws itself (barrels, kegs, crates) is no longer a plain box.
- **The store and the stash are framed by their rooms** like Wren's menu: the camera holds a shot of the keeper at their counter, the menu to the right on a wide screen; the talk box closes as a menu opens.
- Tests: every building in and out, its keeper in reach at the counter, every inside far from the square and the others (`interior.test.ts`); the village solidity test now runs into the store's wall away from its door. check 180, parity identical, test:net, smoke 7/7. Screenshots of each room in `docs/screenshots/`.

**Learned**

- **A test that ran into a building's door now walks inside it**: doors are the one place a wall is not a wall.

**Next**

- P8, the two modifiers, then the henchmen; the tavern's hiring room (P10) after Michael's tavern mockup.

## 2026-10-28: local session, interiors: Keeper Wren's shrine

**What changed**

`auto/local-shrine-interior`, stacked on `auto/local-portal-menu`. No protocol change. Michael's call (decisions.md "Wren's portal menu"): interiors you can enter, the shrine first, for him to judge.
- **The inside is part of the village level** (`village.ts`: `InteriorDef`, `DoorLink`): a 14 by 12 m room far north of the square, out of sight, with walls, a table and two bookshelves as colliders. Its walls fade for the camera as a dungeon's do. Keeper Wren stands inside now, at her table.
- **Doors** (`throughDoor` in `stepPlayer`): stepping into the shrine's front door puts the hero inside facing in, and the inside door puts them back on the square before the shrine, past the ring. In `stepPlayer` so the browser's own hero goes through at once and the server agrees; each arrival lies outside the other door's circle. One room, so friends see each other go in; no loading. The camera snaps through with the hero, facing in.
- **The room** (`VillageView.buildInterior`): dark stone and planks, a dark shell hiding the sky and woods, Wren's table with a violet orb (its light) and candles, two candle stands with warm lights, shelves of books, crystals in the far corners, a violet rug and a rune circle before her, and the doorway's daylight.
- **Her menu is framed by the room:** while it is up the camera eases to a set shot from the room's front, Wren and her orb in the left third; on a wide screen the menu sits to the right so she shows (Michael's mockup). Her words close as it opens.
- Tests: a hero walks in through the front door and out through the inside one, no arrival in a door's circle (`interior.test.ts`); the smoke tests that talk to Wren now go round the ring, into the shrine and out. check 176, parity identical, test:net, smoke 7/7 twice. In the browser: in and out with no correction, the room, and the menu over the framed shot at 1366 by 768.

**Learned**

- **A test that steers the camera at a door keeps steering after it,** walking the hero straight back through: the smoke helper stops turning once the hero is on the far side. A player holding W after a door walks on into the room, since the camera turns with them.
- **Wren stood 2.3 m from her table's front** with talk reaching 2.4: she now stands against it.

**Next**

- Michael judges the shrine. Then the store's, the storehouse's and the tavern's insides the same way (the tavern with P10's hiring room, after his mockup), and P8.

## 2026-10-28: local session, P7: Keeper Wren's portal menu

**What changed**

`auto/local-portal-menu`, stacked on `auto/local-stash`. Protocol 14. Built from Michael's mockup and answers (decisions.md "Wren's portal menu").
- **The rules** (`shared/src/game/portalChoice.ts`): five difficulties, Easy (-25%) to Legendary (+150%), each filling every room with that much more of the budget and paying that much more (`depthMult`); the shrine opens Normal at tier 1 and one more a tier. Three sizes (12, 22, 34 pieces on the first floor, more each floor), 1 to 8 floors. Five story dungeons to start: The Old Cellar (hand-built), Mossgate Barrow, The Saltmarsh Warrens, Emberhall, The Hollow Crown, each with a level range (a guide), words, reward slots and key enemies; the generated ones from a fixed seed, so each is the same place every time. A run's plan and every floor's spec carry the difficulty and the story id.
- **The menu** (`client/src/ui/PortalScreen.ts`): a second F (or A) to Wren opens it, violet and candle-coloured after the mockup. Story tab: the dungeons in order, locked until the one before is cleared, each with its picture of rewards (as the bag draws those slots), key enemies and Open Portal; the player's own editor dungeons follow. Random tab: floor count, size, the themes shown locked ("later"), difficulty with the locked ones saying which shrine tier opens them, and Reshape Portal. Q and E (LB, RB) change tab, up and down choose, left and right change a setting, F or A opens, Esc, Tab or B leave; clicking works too.
- **The server**: a new `portal` message; `VillageRoom` refuses a difficulty past its shrine's tier and leads the ring with the choice. Whether a story dungeon is open is the browser's to say (progress is in its save until Phase 3); a win records the story cleared and says which opens next.
- **A second word now acts on letting go of F.** Holding F to build (P4) begins with a press, which at a keeper already talking was taken for opening their menu; now a hold that builds opens nothing.
- Tests: difficulty caps, the wire, plans and specs carrying difficulty and story, a story dungeon the same whatever the server's seed, harder paying more (`portalChoice.test.ts`); test:net: Hard refused at shrine tier 1, a random choice and a story one taken, the ring saying so; the smoke test's Wren case now opens the menu and takes story 1. check 174, parity identical, test:net, smoke 7/7. In the browser: the menu by keys, both tabs, a large 3-floor Normal run reshaped and the ring saying so.

**Learned**

- **Only four enemy kinds exist** (grunt, archer, brute, the Warden), so the key enemies are those until E1's themes. Rewards are slots, not items, until a story dungeon has a loot table of its own.

**Next**

- Wren's shrine interior, enterable, her menu framed by the room (decisions.md, interiors), for Michael to judge before the other three.
- Then P8, and the henchmen with the tavern's hiring room (Michael's tavern mockup).

## 2026-10-28: local session, P9 and D5: Marta's stash, and the bag at risk

**What changed**

`auto/local-stash`, stacked on `auto/local-general-store` (which also gained the store's rows drawn as the bag's cells and the respec at Wren's shrine, after Michael's look). No protocol change.
- **Marta's stash** (P9; Michael's answers, decisions.md "The stash's design"): a second F (or A) to Marta opens it, in the village that is yours. The stash is a wide grid, 8 across like a RuneScape bank, the bag beside it 4 across. It holds `village.stashBase` (16) spaces and `stashPerTier` (8) more a Storehouse tier: 16, 24, 32, 40. F or A (or a click) picks an item up and puts it down, swapping with what is there; X on a pad (Q, or a shift- or right-click) sends it straight to the first free space on the other side; Esc, Tab or B puts a held item back, then leaves. The stash lives in the owner's browser with their village save (P2), never sent to the server, until Phase 3's ledger; the room's word on lumber, stone and tiers no longer overwrites it. A visitor is told their things are in their own village.
- **The bag at risk** (D5; decisions.md 28 Oct, extraction-style): a wipe on a floor now also sends each player `bagLost`, and the browser empties its bag but for the safe pocket, the bag's first `village.pocketBase` (3) spaces and `pocketPerTier` (1) more a Storehouse tier. Worn gear and the stash are never touched. The pocket is marked (striped) on the hero screen and at Marta's; a find never lands in it by itself, so what goes there is the player's choice, made at Marta's. The run summary counts what the wipe took; a toast says so.
- Marta's line, and the Storehouse's words on its tier, say what is safe.
- Tests: the wipe sends `bagLost` to each player (`loop.test.ts`). check 170, parity identical, test:net, smoke 7/7. In the browser: two items quick-moved into the stash, one picked up and put into a pocket space (swapping), the grid and the striped pocket; a `bagLost` took the three items past the pocket and kept the pocket, the two worn pieces and the stash. The pane's save put back after.

**Learned**

- **A find put in the first free space would have gone straight into the pocket,** making the risk vanish for anyone with a near-empty bag. Finds and taken-off gear now skip the pocket.
- **The village's room replaced the whole save,** which would have wiped the stash the moment the village answered. It now replaces only what the room holds.

**Next**

- P7, the portal board, after asking Michael about Wren's dungeon chooser (he has thoughts). Then P8, and the henchmen.

## 2026-10-28: local session, P5: coin and the General Store

**What changed**

`auto/local-general-store`, stacked on `auto/local-village-tiers`. Protocol 13.
- **Aldous's shelves** (`shared/src/game/store.ts`): rolled each day (UTC) from the catalogue, `storeStock` items for the store's tier (4 at tier 1, 2 more a tier). Commons only, of materials up to a tier above the store's; the first three are a melee, a ranged and a magic weapon, so there is always one for another weapon kind. Each place is rolled from the whole catalogue and brought down to the best material the store can get, so raising the store keeps the same things in better materials and adds more. `VillageRoom` keeps the day's shelves (and what was bought from them) and sends them with the village.
- **Prices** in `tuning.village`: a tier-1 common costs 20 coin, each tier 1.8 times more, a rare three times; Aldous pays 30% of his price.
- **Buying and selling.** A second F (or A) to Aldous opens the store: the shelves and the bag side by side with prices and the coin you hold; up and down to choose, left and right to change side, F or A to buy or sell, Esc, Tab or B to leave; clicking works too. New `buy` (a shelf uid and the player's coin) and `sell` (a bag item, checked as D13's drop is) messages; the room answers `bought` (the item, the price) or `sold` (the uid, the price) and the browser changes the bag and the coin. Anyone in the village may trade, visitors too; a bought item is gone from the shelf for everyone until tomorrow.
- **A champion point taken back now costs coin, at Keeper Wren's shrine** (`village.respecCoinPerPoint`, 15 a point, a reset all of them; decisions.md 27 Oct: free until coin came; Michael, 28 Oct, liked the shrine as the place). Within 6 m of Wren the Champion tab takes points back and shows the coin held; elsewhere it says where to go. Wren says so too.
- After Michael's look at the first version: each row on the store's lists is drawn as the bag draws an item (its icon in a cell with the shape's name and rarity), then what it does, then its price.
- Aldous's line no longer says his shelves are bare.
- Tests: prices, the day, the shelves (the same all day, a weapon of each kind first, commons within the tier, the same things better as the store rises), the wire (`store.test.ts`); test:net's village now has a visitor refused short of coin, then buying a shelf item that leaves it for both, and selling it back at Aldous's price. check 170, parity identical, test:net, smoke 7/7. In the browser: the store opened on a second F, a warhammer bought (300 to 264 coin, the shelf one short), a staff sold for 6, Esc closed it; the pane's save put back after.

**Learned**

- **Rolling each tier's shelves from that tier's catalogue reshuffled them** when the store rose (an oak shortbow became an elm one, the cape changed colour). Rolling from the whole catalogue and capping the material keeps a shelf a shelf.
- **Coin is still the browser's,** so the room takes the buyer's word for it, as with upgrades; the item a seller names is checked as an item could be, and the bag is the browser's to empty.

**Next**

- P9 and D5: the Storehouse's stash, and the bag at risk. Then P7, P8.
- Michael: prices are a first guess (`village` sliders).

## 2026-10-28: local session, P4: the four buildings' tiers

**What changed**

`auto/local-village-tiers`, stacked on `auto/local-village-save`. Protocol 12.
- **Prices** in `tuning.village`: tier 2 costs 40 lumber, 30 stone and 80 coin, and each tier after 2.4 times the one before (tier 3: 96, 72, 192; tier 4: 230, 173, 461). Lumber and stone are the village's; coin is the owner's, in their save.
- **What a tier gives** (`villageSave.ts`, for P5, P7, P9 and P10 to use): the shrine opens portals up to one tier above its own; the store stocks 4 items a day and 2 more a tier; the storehouse keeps 12 spaces a tier; the tavern hires a henchman a tier to three, and at tier 4 they are quicker.
- **Building one.** Each building's keeper (Wren, Aldous, Marta, Old Fenn) now says its tier, what it gives, what the next would bring and cost, and what the owner still needs. The owner holds talk (F, or A on a pad) for `village.upgradeHoldMs` (0.9 s) to build it, a hold so spending is never an accident; the hint shows it and fills while held. A new `upgrade` message carries the building and the owner's coin; `VillageRoom` takes it only from the owner, checks the village's lumber and stone and the coin they say they have (their browser holds it until Phase 3), pays, raises the tier, sends everyone the village and the owner an `upgraded` message, whose browser takes the coin and says so. A visitor hears it is the host's to build.
- **The tier shows** on the building: a pennant on the roof for each tier (the top one gold), and the numeral on its sign ("General Store II").
- Tests: prices, what is missing, paying, the top tier, the wire (`villageSave.test.ts`); test:net's village run now has the visitor refused, the owner refused short of coin, then the store raised to tier 2 with the village paying lumber and stone and both players seeing it. check 166, parity identical, test:net. In the browser: Aldous's words, the hold filling, the store raised (coin 300 to 220, lumber 150 to 110, stone 120 to 90), the panel and the sign saying II after a reload. The browser pane's save was put back after.

**Learned**

- **Coin is the player's and lives in their browser,** so the room takes the owner's word for how much they have, as it takes a loadout's. Phase 3's ledger ends that.
- **Wren already uses a second F to turn the ring,** so holding F at her to raise the shrine also turns the ring if her words were already up. Small; a press-on-release for the ring would part them.

**Next**

- P5, coin and the General Store (Aldous's stock, sized by the store's tier), then P9 and D5, P7, P8.
- Michael: the prices are a first guess (`village` sliders); a run banks about 100 lumber and 70 stone over three floors.

## 2026-10-28: local session, P2: the village save

**What changed**

`auto/local-village-save`, stacked on `auto/local-dodge-smash`. Protocol 11.
- **The village is a save of its own** (`shared/src/game/villageSave.ts`): an id, lumber, stone and the four starting buildings' tiers (1 to `village.maxTier`, 4). The browser keeps it under P1's key, which gains the id and the tiers on first load.
- **The hello carries it when joining a village.** The server checks it (`readVillageSave`: an id, whole counts within bounds, tiers that exist; a bad one refuses the hello whole) and `VillageRoom` keeps the first one it is given. From then on the room's copy is the village: a floor's bank adds to it on the server (`FloorRoom.onEvents` credits the village the run came from).
- **A new `village` message** goes to each player on joining and whenever the village changes: the save without its id, the host's name, and whether it is this player's own (their hello carried the same id). Only the owner's browser keeps it, replacing its save with the room's count; a visitor's own save is never touched. A panel top left shows "Your village" or "Vale's village", the lumber and stone and each building's tier.
- The browser still adds its own banks to its save as they happen, so a tab closed mid-run keeps them; the room's count, which has them too, replaces it on the way home.
- Tests: the save's bounds and the hello (`villageSave.test.ts`); test:net's village run now brings two saves and checks the gate: the maker's is the room's, the visitor is told it is the host's, and the run's two banks grew it from 10 lumber and 5 stone to 15 and 9, seen by both. check 163, parity identical, test:net. In the browser: the panel in the village, the save given an id.

**Learned**

- **Ownership by room code broke on the way home,** because a session id changes with every room. An id kept in the save, never sent back to anyone, is what says whose village it is.
- **"Costs it could have paid"** cannot be checked yet: no tier has a price until P4, and the save does not record what was spent. P4 can keep a running total of lumber and stone earned if the check is wanted.

**Next**

- P4, the buildings' tiers: prices in `tuning.village`, an upgrade at each building's villager, and the tier showing on the building.

## 2026-10-28: local session, D9's scaling and D4: a quicker roll with perks, things to smash, the health potion

**What changed**

`auto/local-dodge-smash`, stacked on `auto/local-bigger-rooms`, one commit each (and the docs). Protocol 10.
- **D9's scaling (Michael: option A).** Each Second wind rank (the level-40 row) takes `talents.windCancelMsPerRank` (10 ms) off the point a roll can be cut, and each Light step rank (champion) `champion.lightstepCancelMsPerRank` (4 ms), never under `dodge.cancelFloorMs` (110). Maxed, both bring 170 ms to 110. Both perks' text says so. With neither, it is `cancelAfterMs` to the bit, so parity is untouched.
- **D4, things to smash.** Crates, barrels and urns stand against the walls of a generated floor's rooms and halls (not the rest room or a stair, never within 3 m of a doorway), placed from the floor's seed in `floor.ts` so every browser has the same; the sim keeps only which are broken (`SimState.floor.broken`), so a snapshot grows by a few ids. About 20 to 30 a floor, 4 to 7 a fight room, over five seeds. Any hero's blow breaks one: a swing in its arc, a shot (it stops there), a burst, a whirlwind's turn, a charge, a bash, a frost ring (`sim/smash.ts`). A crate or barrel gives `loop.smashLumber` (1), an urn `loop.smashStone` (1), carried by the party until the floor banks (with the deeper floors' bonus) and lost with a wipe. They do not block movement. Drawn from primitives (`client/src/render/PropView.ts`; the repo has no KayKit models, everything is made in code), with splinters or shards, dust, a sound, and "+1 lumber" floating up.
- **D4, the health potion.** `loop.potionChance` (12%) of smashed props drop one on the floor; the first standing hero over it with room on the belt (`loop.potionMax`, 3) takes it. G, 4 or d-pad left drinks one (`PlayerCommand.drink`, a press, predicted like the rest): `loop.potionHeal` (40%) of max health at once, not at full health, one a second. The belt is `PlayerState.potions` on the server; the browser saves the server's count and brings it into the next room on the loadout (`Loadout.potions`, clamped, taken on joining only; rule 1's accepted exception, like the bag). The HUD shows "Health potion ×N G" under the draughts, and a toast names the keys.
- Tests: the scaling (ranks, the shut row below 40, the floor, i-frames kept); placement (the same every build, against a wall, nowhere it should not be); a swing breaks what is in front and not behind; an arrow stops at a crate; banking pays the smashed lumber and stone, a wipe loses them; a potion rolls out, waits for a belt with room, and is taken; drinking heals, waits a second, refuses at full; the loadout's belt and the `drink` press on the wire. check 160, parity identical, test:net, smoke 7/7. In the browser: a swing broke a crate and an urn (1 lumber, 1 stone), a potion rolled out and went on the belt, the save kept it into the arena, and a drink took 118 back to 127.

**Learned**

- **A level shot flies over a crate.** Arrows leave at chest height and a crate is under a metre, so a crate is broken by aiming down (D12's free aim) or by a swing. The soft target never picks a prop.
- **A handoff carries the loadout ClientSession kept at the last gear change,** so the belt would have been lost at a portal. The browser now refreshes that loadout whenever it saves (`ClientSession.keepLoadout`), without sending it.
- **`Object.assign` cannot set a three.js mesh's position** (it is a read-only property); tsc does not catch it. The first PropView threw on every floor.

**Next**

- Michael plays a floor: smash, drink, and judge how much the props pay and how often a potion drops (sliders under `loop`).
- Then, village first (Michael, 28 Oct): P2, P4, P5, P9 with D5, P7, P8, then the henchmen, then the gate.

## 2026-10-28: local session, D10, D13, D12, D2: death and home, drop to the floor, free aim, bigger rooms

**What changed**

Four stacked branches on `auto/local-dungeon-rules`, one commit each (and the docs): `auto/local-death-home`, `auto/local-drop-to-floor`, `auto/local-free-aim`, `auto/local-bigger-rooms`. Protocol 9.
- **D10, death and going home.** A downed hero lies still (`coop.crawlSpeed` 0; T5's 1.1 is a slider away). A wiped floor's party stays down and no ring opens. The card reads "You died" solo or "Your party was defeated", with a 48 px Return to the village button (F, A). The button sends a new `home` message and `FloorRoom` hands that player alone (`HostRoom.handOne`) to the village the run left from. A win keeps its ring and gains the button. The mouse is freed for the button and the pause card stays away.
- **D13, drop to the floor.** Drop on the hero screen sends the bag's item in a `drop` message, checked as a catalogue item with a bonus a roll could give (`readGearItem`). The server lays it at the hero's feet as a drop only its owner sees, marked `dropped`: taken back only once the owner has stepped away, never banked, carried or lost, and kept when a rest room banks. At most `gear.maxDropped` (12) a player in a room. Handing items over waits for Phase 3.
- **D12, free aim over the shoulder.** With a bow, staff, crossbow or wand out and no lock-on, the camera moves 0.85 m right of the hero (short of any wall) and comes in to 80%, and the reticle pins to the centre. The browser casts from the camera through it against walls, the floor and enemies' bodies (`client/src/game/aim.ts`) and sends the heading and pitch from the hand to what it met (`PlayerCommand.aimPitch`, optional, clamped). A ranged attack or ability with free aim skips soft targeting, tracks the aim while drawn, and leaves along it; lock-on keeps the slice's aim. In the browser, the server's arrow left at pitch 0.154 for an aim of 0.157, on the same heading.
- **D2, rooms a size up.** Four new kit rooms the generator fights in: a 3x3 guard room, a 4x4 hall of pillars, a 6x5 great hall, a 7x7 pit (18 to 42 m across, was 12 to 30). The old four stay in the kit and the editor, so the Old Cellar and any saved hand-built dungeon are unchanged. `dungeon.budgetPerCell` 1 to 0.6. Solo, every enemy a room sends, over 30 seeds:

| Room | Floor 1 | Floor 3 | D1's room, floor 1 / 3 |
| --- | --- | --- | --- |
| Guard room (3x3, was 2x2) | 5.3 | 7.4 | 3.6 / 6.2 |
| Hall of pillars (4x4, was 3x3) | 7.1 | 10.0 | 6.3 / 10.0 |
| Great hall (6x5, was 4x4) | 11.5 | 18.6 | 10.5 / 15.7 |
| The pit (7x7, was 5x5) | 19.0 | 30.5 | 16.6 / 26.2 |

- The floor banners lost "the doors are shut" and the "+40% health" a clear no longer gives (D7, D8 left them).
- Tests: a wipe leaves no ring, keeps the party down and answers `home` only then; a downed hero lies still (and crawls with the slider up); dropping (owner only, after stepping away, not banked, the cap, the item check); free aim (pitch and heading, tracked to release, lock-on and no pitch keep the slice's aim, the wire's clamp). The generator's walk test now checks a big floor has a staircase, not that the way through crosses one. check 151, parity identical, test:net. In the browser: the death card and its button home, a drop round trip in the village, the shoulder camera and an arrow on the aim, a guard room and the hall of pillars.

**Learned**

- **A wiped party used to stand back up to walk to the ring,** because the slice gets heroes up outside a fight. On a floor the end card now holds them down.
- **Picking a dropped item straight back up** is what happens if it lands at your feet with nothing else said, so a dropped item waits for its owner to step away.
- **Free aim needs the shot aimed from the hand, not along the camera.** The camera sits behind and right; aiming along its ray would land every shot left of the reticle, so the browser finds what the ray meets and aims the hand at that.
- **Bigger rooms at D1's density would double the enemies,** so the budget a cell came down to keep D1's counts and give the space to moving.

**Next**

- Michael plays a floor with a bow and a staff (free aim), dies once (the card), drops something, and judges the room sizes and the counts above.
- D9's scaling still wants his answer.
- Then D3 (wear a find straight away), D4 (smashables and the health potion), P9 and D5 (stash, bag at risk).

## 2026-10-28: local session, D7, D8, D9, D11: no heal per room, open doors, a quicker dodge, a reticle

**What changed**

Michael played D1 ("plays pretty well") and sent eight notes (decisions.md, "After playing D1"). The four contained ones are built on `auto/local-dungeon-rules`, stacked on `auto/local-denser-fights`, one commit each.
- **D7, no heal after each room.** A cleared room on a generated floor heals `dungeon.healOnClear` (0) instead of the slice's 40%; the rest room heals every standing hero `dungeon.restHeal` (full) as it banks, and its banner says so. The arena keeps `run.healOnWaveClear`.
- **D8, the doors stay open** (`dungeon.shutDoors`, off). A fight room's fight starts on the first hero in; nobody waits at the door, nobody is pulled in, and the room never walls anyone in or out. T4's shut doors stay behind the switch, and their tests turn it on.
- **D9, a shorter dodge recovery.** `dodge.cancelAfterMs` 240 to 170 ms: any input ends the roll's tail sooner. A roll cut short now keeps the rest of its i-frames (`dodge.keepIframesOnCancel`), because in the slice cutting the tail also ended them, and a held stick cuts it at once, so a shorter tail alone would have made every dodge leakier. The parity test puts back 240 and the slice's ending.
- **D11, a reticle** (`client/src/ui/Reticle.ts`): a dot for melee, a crosshair for the bow and crossbow, a ring for the staff and wand, drawn where the next swing or shot goes. That is the enemy the sim's soft targeting would pick (`pickSoftTarget`, tinted red), or a point ahead along the camera's heading. It glides between targets (`lockOn.reticleRate`) and hides behind the pause card, the hero screen and when down.
- Tests: open doors (a straggler stays where they are, a hero runs out mid-fight), no heal on a clear and a full one in the rest room, the dodge's tail ending under 240 ms with its i-frames kept (and leaking with the switch off). check 142, parity identical, test:net, e2e 14/14 (smoke 7/7). In the browser the dot sits ahead of the knight and the bow's crosshair turned red on a grunt.

**Learned**

- **Soft targeting ignores walls.** The bow's crosshair turned red on a grunt in the next corridor, because the sim would turn a shot toward it. The reticle is honest about that; the sim's choice is D12's to revisit with free aim.
- **With the camera behind the hero, the screen's centre is the hero's head,** so a mark at the screen centre would sit on the hero. Until D12's over-the-shoulder camera, the mark sits on a point 10 to 14 m ahead.

**Next**

- Michael plays a floor: the three rules and the reticle. All the numbers are sliders (`dungeon.healOnClear`, `dungeon.restHeal`, `dodge.cancelAfterMs`, `lockOn.reticleRate`) and `dungeon.shutDoors` a switch.
- D9's scaling with levels and perks needs his answer (Second wind's milestone and a Nimble champion perk, recommended).
- Then D10 (death and the button home), D13 (drop to the floor), D12 (free aim), D2 (bigger rooms): all deep work.

## 2026-10-28: local session, D1: denser fights

**What changed**

- **About twice the enemies a room** (`tuning.dungeon`): a budget of 1 a cell (was 0.45), +35% a floor deeper (was 25%), 2 for each player past the first (was 1.5), and 70% of it in the first group (was 60%), so a room arrives as a fight.
- **Guard rooms mix in archers,** at most one for every two blades. They were grunts only, which made them a queue.
- **Three attackers a hero on a generated floor** (`dungeon.attackersPerHero`). The slice's two (`grunt.maxAttackers`) left most of a fuller room circling. The arena has no `SimState.floor`, so it and the parity test keep two.
- Solo, every enemy a room sends (first group and reinforcements), averaged over 59 seeds:

| Room | Floor 1 before | Floor 1 now | Floor 3 before | Floor 3 now |
| --- | --- | --- | --- | --- |
| Guard room (2x2 cells) | 2.0 | 3.6 | 3.0 | 6.2 |
| Medium | 3.2 | 6.3 | 4.3 | 10.0 |
| Large (4x4) | 4.9 | 10.5 | 6.5 | 15.7 |
| Arena (5x5) | 8.2 | 16.6 | 10.9 | 26.2 |

- Three new floor-run tests: a guard room meets one hero with three or more, a large room has six or more and more again on floor 3, and three enemies hold attack tokens at once on a floor while `grunt.maxAttackers` stays two. All three fail on the old numbers.
- check 138, parity identical, test:net (0 corrections on the floor walks; a four-player snapshot 6.0 KB), smoke 7/7. In the browser, seed 11's large room had seven up at once, three attacking, a brute's slam telegraphed, a 5.9 KB snapshot.

**Learned**

- **Rooms already woke together:** the whole first group spawns when the doors shut. What made a room feel like a queue was the size of the group and the two-attacker cap, not the waking.
- **A guard room's budget was under two,** so with the reinforcement split it sent one grunt, then one more. Most fight rooms are guard rooms, so most fights were one at a time.
- **A scripted bot is no judge of difficulty.** One that walks in and taps attack landed no kills under the old numbers or the new, so the comparison is the per-room counts above, and the feel is Michael's.

**Next**

- Michael plays a floor or two: too much, too little, or right. Every number above is a debug-panel slider.
- D2, bigger rooms (deep work), which these numbers will want to be re-checked against.

## 2026-10-28: local session, quality of life after the feel-pass playtest

**What changed**

Michael played the feel pass and sent a list; the quality-of-life half is built (`auto/local-qol`).
- **Tab opens and closes the hero screen** (it was I). Lock-on moves from Tab to T; middle click and the right stick click stay.
- **Every item has an icon.** `ui/gearIcons.ts` has a 16x16 pixel grid per catalogue shape, in the HUD icons' style, painted in the item's material: base, a lighter and a darker base, and its trim. The cells keep the item's name under the icon; a worn slot's label shows only while it is empty.
- **The three weapon levels are on the Talents tab only.**
- **The HUD's three style chips are gone** (`StyleBar` deleted). A line over the health bar names the hero and the weapon in hand's level ("Knight · Level 6", a gold +N for talent points to spend) with a hairline of progress. The ability slots move under the health bar, in the same corner.
- **The bag tab shows the hero as dressed** (`ui/HeroPreview.ts`): the game's own `HeroView`, put through `applyLoadout` from the profile, facing the player, on a small renderer of its own, drawn only while the tab is open.
- **The mouse wheel zooms the camera**, from half to twice `camera.distance` (`tuning.camera.zoom*`), eased, and kept in the browser. Also - and =, and the d-pad's up and down off the hero screen (rule 4). Over a menu the wheel still scrolls the menu.
- check 135, parity identical, smoke 7/7 (its hero-screen test now opens with Tab and checks the icons, the figure and the levels on the Talents tab). In the browser: icons for all 31 shapes, the dressed figure, the level line, and the zoom from 5.5 m out to 8.5 m on four presses of -.

**Learned**

- **The hero screen redraws by `innerHTML`,** so a WebGL canvas inside it would be thrown away on every keypress. The preview's canvas lives outside and is put back into its slot after each redraw.
- **The game's shared Palette carries the main renderer's reflection map,** which a second renderer cannot use. The preview builds its own from the same `dungeonEnvironment` (now exported), so metal reads the same in both.

**Next**

- Michael's answers on the rest of the list (decisions.md, "After the feel-pass playtest"): the bag at risk with a safe pocket, finds wearable mid-run but still at risk, and the dungeon's feel before the village. The backlog has them as D1 to D5, with P9's stash moved up beside D5.
- D1 (denser fights) is first; it is tuning, so a local session or the builder can take it.

## 2026-10-28: local session, C5: warhammer, crossbow and wand

**What changed**

- **Weapon families.** A family fights its style's fight (its levels, talents and strings) with a chain of its own (`tuning.warhammerCombo`, `crossbowCombo`, `wandCombo`).
- **Each step borrows a pose.** `FAMILY_ANIM` gives each step the pose and projectiles of one of its style's steps, so the views and the shots need nothing new:
  - Warhammer: the sword's sweep, spin and slam.
  - Crossbow: the bow's two quick shots, then the power shot with a long reload. The power shot still sets up Skewer.
  - Wand: the staff's single bolts, five of them, fast.
- **State and checks.** `PlayerState.attackStep` holds the family's step. `Mods.family` travels in the loadout, the server checks it, and it counts only with its own style.
- **A family's heavies** are its style's strings, scaled by `tuning.families`: the warhammer's hit 40% harder and come 30% slower.
- **The warhammer takes both hands** (+20%).
- **The off-hands C4 held back,** each on 3:
  - the tome's **Ward**: the next hit on you and on every ally within 5 m is absorbed, for 8 s
  - the buckler's **Deflect**: every hit is parried for 450 ms
  - the hand crossbow's **Quick shot**: two bolts
- **Drawn as simple meshes in their materials,** on the borrowed poses. The off-hand sits in the off hand with any one-handed weapon. The three abilities have icons.
- **Parity identical.**

**Learned**

- **Borrowing a step's pose made a family cheap.** It carries the slice's swing, its projectiles and its hit timing with it; only the numbers are new. Poses of their own can come later without touching the sim.
- **From behind, the crossbow and the off-hands are hard to see** on the borrowed bow poses. They read in the bag and on the HUD, not yet on the figure.

**Next**

- The feel pass (C1 to C5) is built. It wants a hand on it: heavies, Flow, one weapon per outing, the off-hands and the families.
- Then P2, the village save, or the henchmen (P3).

## 2026-10-28: local session, C4: the off-hand slot

**What changed**

- **The shield slot is the off-hand.** A one-handed weapon takes an off-hand of its kind, and the off-hand brings the third ability.
- **The shield's bash** goes on 3 (or R, or RT). It knocks the nearest enemy in front off its feet and has its own cooldown (`PlayerState.offhandCooldown`).
- **Two-handed weapons** take no off-hand and hit 20% harder (`gear.twoHandDamage`).
- **RuneScape's eleventh slot holds arrows.** With a bow, frost arrows slow what they hit, and a barbed charged shot opens a bleed.
- **What travels and what is checked.** `Mods.offhand` and `Mods.ammo` go in the loadout, and the server checks them against the kinds there are. `PlayerCommand.ability3` is an optional press that a late input carries.
- **On screen:**
  - The HUD shows the third slot only while an off-hand is in use.
  - The hero screen has the ammo cell beside the neck.
  - Item text names the bash, the two-hand bonus and what arrows do.
- **Parity identical.**
- **test:net's flake is fixed.** The netcode test's walk onto floor 2's ring home failed CI four times since 28 Oct (main included, and #89). Both bots stood inside the ring's 2.2 m before the second reached its exact mark, the ring handed the party on, and the bot's walk waited on a room that had stopped sending. A walk now ends once a hand-off arrives.

**Learned**

- **Today's bow and staff take both hands,** so the off-hands for ranged and magic had nothing to go with. The tome, the buckler and the dual hand crossbow moved to C5, beside the one-handed wand and crossbow.
- **The new ammo cell caught the hero screen's cursor.** Right from the head went down to it rather than across to the bag (a tie the ammo cell won). The smoke test walks that route and failed. The cursor now weighs a row change at three steps, so it keeps to its row.
- **One flaky test can hide behind another.** A deterministic floor (`dungeon.seed` pinned) failing only sometimes pointed to timing, not geometry. Checking every CI failure's message found the same waypoint four times.

**Next**

- C5: the warhammer, the one-handed crossbow and the wand, with the tome, the buckler and the dual hand crossbow.

## 2026-10-28: local session, C3: one weapon set per outing

**What changed**

- **The weapon changes only outside a fight** (Michael chose inventory only). The sim holds a requested swap until no fight is on: no doors shut, no waves running. It sits behind `combo.swapInFight`, which the parity test turns on because the slice's scripted parties swap. Parity identical.
- **1 and 2 are the abilities**, beside Q and E; the pad keeps LB and RB. 3 waits for C4's off-hand.
- **The hero screen keeps 1, 2, 3 and the d-pad for its tabs.** New `tab1`, `tab2` and `tab3` actions take the press there before anything else, so a tab change never casts.
- **Gone or changed:**
  - the wheel and d-pad weapon swaps
  - the key numbers on the style bar
  - the HUD's ability keys now read 1 and 2
  - the controls table says how to choose a weapon
- The smoke test that pressed 1 to take the sword back now checks that 1 no longer swaps.

**Learned**

- **The backlog's "move the tabs to free keys" was not needed.** The hero screen already stands the hero still and only opens between fights, so 1, 2 and 3 can mean tabs there and abilities everywhere else, as long as the tab actions are read first.
- **A new hero's 2 does nothing** until the second ability unlocks at level 2. That is the slice's unlock, not a binding fault, and worth knowing when testing keys.

**Next**

- C4, the off-hand slot and its third ability on 3.

## 2026-10-28: local session, C2: Flow

**What changed**

- **A rhythm meter on the hero** (`PlayerState.flow`, `sim/flow.ts`, `tuning.flow`).
- **The beat.** A press as the chain's next step opens (120 ms before to 160 ms after) is on the beat. It is judged on the tick the press was made for, presses during a hit's freeze included, so the server and the prediction agree.
- **What fills it.** An attack's earnings land with its first hit, so swings at the air earn nothing:
  - a light: 8 on the beat, 3 off it
  - a heavy: 14 on the beat, 5 off it
  - the same chain a third time running: half
  - a perfect parry, or a dodge that slips a hit (once a dodge): 20
  - a combo payoff: a whole tier
- **What empties it.** A hit taken costs a tier, and the meter drains after 2.5 s without fighting.
- **The tiers:**
  - I: attacks 5% faster.
  - II: the trail runs hotter.
  - III: a heavy hit lands but does not interrupt.
  - Full: a charged heavy becomes a Crescendo (charge 3, twice the damage) and spends the meter.
- **Harmony:** the payer and another player both at Flow III add 20% to a combo payoff.
- **On screen and in the music.** A thin meter sits under the health bar with tier ticks and a label ("Crescendo: charge a heavy" when full). The fight music adds a layer a tier: hats, then the lead every bar, then bells.
- **Off in the parity test:** parity identical.

**Learned**

- **The first press of a chain from standing is never on the beat;** there is no beat to keep yet. A press that starts a new chain from the last hit's recovery is, so a player who keeps chaining keeps the rhythm.
- **Corrections in a brute fight swing from 11 to 49** over twelve seconds with Flow on or off alike. Flow moves the hero only from tier I (5% faster attacks), so it is not the cause.
- **One smoke failure came from my own scratch runs.** God mode and a Flow switch left on a shared local server failed a test; on fresh servers it was 7/7. Scratch runs should restore what they tune, or use their own server.

**Next**

- C3, one weapon set per outing.
- Flow needs a hand on it: whether the beat window feels like a rhythm, and whether III is reachable in a real fight.

## 2026-10-28: local session, C1: light and heavy strings

**What changed**

- **Hold to go heavy.** Holding attack turns a step into a heavy (`combo.heavyHoldMs`, 250 ms), and holding 450 ms more reaches charge level 2. It is the same on mouse, keyboard and pad: `attackHeld` is a held field on the command, so prediction and the server step it alike.
- **A tap is the slice's light, exactly.** A test compares every tick of the five taps with heavies on and off.
- **Each weapon's string moves** are keyed by the presses that lead to them:
  - Sword: H overhead cleave, LH rising cut, LLH sweeping arc, LLLH pommel break, LLLLH blade spin, HH ground slam, HHH earthsplitter, and HLL whirling counter (Michael's heavy-light-light example).
  - Bow and staff have their own seven.
  - A heavy string without its own move plays H.
- **Each move borrows a chain step's pose, reach and projectiles** (`stringAnim`), so the views follow without knowing about strings until the moves get poses of their own. The numbers are in `tuning` with slider ranges.
- **The HUD names each move** as it fires, so the strings are learned by playing.
- **Behind `combo.heavies`,** which the parity test turns off: parity identical.

**Learned**

- **A hold has to belong to the swing its press started.** The bow's buffer window opens inside the next shot's windup, so pressing and holding for the next heavy turned the *current* light into it. A press made mid-swing now marks its hold as the next swing's (`attackHoldNext`). A test covers it.
- **Heavies add next to no corrections.** In a browser run, the five taps gave 3 to 4 corrections (the known lunge ease); the three heavy moves after them gave 0 to 1 more, and none were snaps.

**Next**

- C2, Flow.
- The heavies need poses of their own: today the overhead cleave is the leaping slam's pose.

## 2026-10-28: local session, P1: the loop's stakes and rewards

**What changed**

- **Carried finds.** On a generated floor a pickup is carried (`SimState.floor.carried`) instead of going straight into the bag.
- **Banking.** The rest room, or the Warden's fall, banks every player's finds in a `banked` event. The event also carries:
  - the coin for the fight rooms cleared on that floor
  - the village's lumber and stone
- **Pay** is `tuning.loop`: 12 coin, 4 lumber and 3 stone for each room cleared, more for the Warden's hall, and 30% more for each floor deeper. Rare drops get likelier deeper too.
- **Losing finds.** A wipe loses what was carried (`findsLost`). A player who leaves mid-floor gives up theirs.
- **The browser saves what the server gives it.**
  - Items go into the bag and coin into the profile.
  - Lumber and stone go into `hearthgate.village.v1`, but only in the browser that opened the village the run set out from. That holds until P2 makes it a real village save.
- **On screen:**
  - The timer line shows what is carried.
  - A summary card greets the party home. F, A or Escape closes it.
  - The equip screen shows coin.
- **Protocol 8.**
- **The slice's arena keeps its own loot**, so parity is identical.

**Learned**

- Banking pays only for rooms actually fought. Since the deeper ring opens on arrival (decisions.md, 27 Oct), skipping rooms is now a real trade: a faster floor for less pay.
- **The summary was hidden at first.** It sat under the Paused card, which shows whenever the mouse is not locked (the critic's open bug). It now sits above that card and below the hero screen.
- The smoke walk's route to the rest room can cross no fight room, so the scratch check steered through one first. One room cleared on floor 1 banked 12 coin, 4 lumber and 3 stone.

**Next**

- C1, light and heavy strings.

## 2026-10-28: local session, combat depth designed with Michael

**What changed**

- A design conversation about combat, drawn up as an interactive page ("Hearthgate Combat Builds") with a Keep, Unsure or Cut on every piece. Michael marked all 43; four conflicts were settled in chat. All of it is in `decisions.md` ("Combat depth").
- **The design doc's Combat section** gains a Builds block, and its Loadout paragraph now says one weapon set per outing. Layer 1 now names the specialization trees.
- **The backlog's Phase 2** gains the feel pass, C1 to C5, after P1: strings, Flow, one weapon set per outing, the off-hand slot, three new families. The builds pass waits as a **(design)** item.

**Learned**

- Michael chose no weapon swap mid-fight. One player can no longer set up and pay off a cross-style combo alone, so combos become party play. That fits pillar 1, and makes the henchmen's combo awareness matter more.
- The slice's parity scenario swaps weapons mid-fight, so the no-swap rule must sit behind a switch the parity test turns back on.

**Next**

- P1 (the loop's stakes), then C1 (light and heavy strings).

## 2026-10-28: local session, Phase 2 planned

**What changed**

- **Phase 2's items** are in the backlog, P1 to P10 and the gate, planned from the design doc with Michael's four answers (`decisions.md`, "Phase 2's shape").
  - The loop's stakes and rewards.
  - The village in the host's browser save.
  - The four starting buildings at tiers 1 to 4.
  - Coin, the General Store and the stash.
  - A portal board with tiers and two modifiers.
  - Three henchmen in three steps.
- The backlog also lists what is not in Phase 2, and three draft gate questions for the producer.

**Learned**

- Nothing in a run is at risk today: a pickup goes straight into the bag, so going deeper costs nothing. P1 fixes that first, because the gate's "holds up" depends on the loop having stakes.
- The fight needs nothing new for henchmen: a henchman is a `PlayerState` whose `PlayerCommand` comes from a brain in `shared/` instead of a browser. Prediction and snapshots carry it as they carry any hero.

**Next**

- The critic's two open bugs, then P1 and P3 (deep work) beside P4 (the builder).

## 2026-10-28: local session, T6c: the slotted perks

**What changed**

- **Nine slotted perks** (`shared/src/sim/champion.ts`), three per constellation, with Michael's answers (`decisions.md`, 28 Oct):
  - Offence: Wide shatter, Teamwork, Deep wounds.
  - Defence: Counterstep, Bulwark, Lifeline.
  - Utility: Long fuse, Momentum, Magnet.
- **Opening and slotting:** a constellation's slotted perks open at 5, 10 and 15 points spent in it; four are slotted at once. They travel as `ChampionState.slots`.
- **Where they change:** `slotsOpen` (coop.ts) allows the village, a floor's rest room once the party has reached it, and the arena's antechamber. Elsewhere `HostSession` keeps the hero's four whatever the browser sends, and the tab says where to change them.
- **The effects** sit where the fight already decides those things: the Shatter splash, the payoff damage, the bleed, the parry, the block, the revive, the combo windows, a new `payCombo` beside the three combo callouts, and the pickup radius.
- **The Champion tab** lists each constellation's slotted perks under its ranked ones, with a slot bar. F or A slots, Q or LB takes one out.
- **Parity identical:** each effect is a branch a hero without champion points never takes. Combo setters (`shatterBy`, `skewerBy`, `detonateBy`, for Teamwork) are recorded only for heroes with champion points.

**Learned**

- A slotted perk whose constellation loses its points stays slotted and does nothing, on both sides. Refusing it instead would make the server drop the whole loadout after a respec on a floor, where the slots are fixed.
- Momentum hooks the combo callout, not the payoff hit, because a Detonate burst lands on every enemy it catches and would otherwise refund once per enemy.

**Next**

- T6 is built. Its gate wants a play past level 50, which today takes a seeded save or the debug panel; the pace of the XP curve is still unjudged.

## 2026-10-28: local session, T6b: champion points

**What changed**

- **Earning** (`shared/src/sim/champion.ts`): once any weapon is at level 50, every weapon's XP also banks toward champion points. The first costs 20,000 XP and each costs 250 more than the last, without end (`tuning.champion`).
- **Nine ranked perks in three constellations:**
  - Offence: Precision (damage), Heft (poise damage), Exploit (combo payoffs).
  - Defence: Vitality (max health), Toughness (damage taken), Steady hands (time to revive a friend).
  - Utility: Will (cooldowns), Light step (dodge recharge), Stride (move speed).
- **The ceiling:** Precision and Vitality stop at +15% damage and +15% health (Michael), and the code holds the ceiling even if the per-rank values are tuned up.
- **The player's, not the hero's:**
  - They are saved under their own key (`hearthgate.champion.v1`), so a second character will share them.
  - They travel in the loadout and `PlayerState.champion`.
  - The server refuses ranks the banked XP could not buy, and applies Vitality to max health itself, so the ceiling holds whatever a browser sends.
- **Parity identical:** the state is optional, and a hero without it (the slice, the parity test) gains exact zeros.
- **The equip screen's third tab, 3 Champion,** works by keys and pad like the talents. Resetting is free between fights until coin. A toast marks each point.
- **The design doc's Layer 1** now says the player moves a little, and chooses how.

**Learned**

- Points come from a closed form (the cost's quadratic, settled to whole points), not a loop: banked XP never stops growing, and the sim asks on every XP grant past 50.
- Health is the one champion number not stepped per tick: it is set when a loadout is applied, so the server applies it rather than taking the browser's max health.

**Next**

- T6c: the four slotted perks, which make a build. They are chosen in the village or a rest room.

## 2026-10-27: local session, T6a: style levels to 50

**What changed**

- **Michael's T6 answers** (decisions.md): a +15% damage and +15% health ceiling on champion points' passive perks, shared across characters, free respec until coin, built in three steps.
- **Levels to 50** on the slice's curve. Levels 2 to 5 are where they were; 10 takes 33,000 XP, 20 takes 120,500, 50 takes 683,000, all on the panel's sliders.
- **Every raw gain is a point.** The slice's flat +10% at level 4 is now Might's top two ranks (7, not 5).
- **Milestone rows** (`talents.ts`): one talent opens at each of 10, 20, 30, 40 and 50, four ranks each.
  - Weight: poise damage.
  - Finisher: this weapon's combo payoff (Shatter, Skewer or Detonate).
  - Riposte: parry window.
  - Second wind: dodge recharge.
  - Mastery: damage.
  - The slice's 29 ranks and these 20 make 49, a point for every level after the first.
- **Checks:** a row below its level is shut in the sim, whatever a save says, and the server refuses a loadout whose board its XP could not have bought (`boardProblem`).
- **The talent tab by keys and pad:** move to choose, F or A adds, Q or LB takes off, E or RB resets that column. It had none: only the mouse worked there.
- **The weapon glow** lights at 25 (was 5) and burns gold at 50.
- **Parity identical:** the parity test sets the slice's level-4 bonus and level cap back, and the new talents add exact zeros (the parry check keeps the slice's milliseconds).

**Learned**

- The curve is long for "about 10 after an evening". A floor-1 clear gave each bot 230 to 380 XP, so 33,000 for level 10 is many evenings. The early gaps (3,500 from 4 to 5) set it, and they are the slice's; T6's gate playtest should judge it before the numbers move.
- `levelFor` built a fresh 50-entry table on every call, and the sim now asks it every tick (rows, dodge recharge). It is cached by the six numbers that shape it.

**Next**

- T6b, champion points: earned past 50 from any style, three constellations of passive perks under the +15% ceiling, shared across characters in the save.
- T6c, the four slotted perks.

## 2026-10-27: local session, the Phase 1 gate played by a bot party

**What changed**

- **`npm run gate:party`** (`tests/gate-party.ts`): the gate's machine stand-in, as Michael asked (decisions.md, 27 Oct).
  - **The party:** four of mixed levels and gear (sword 10 in steel, bow 4 in leather, staff 1 in linen, sword 1 in bronze). They take the village's ring together and clear floor 1 to its rest room with no cheats.
  - **How the bots play:** they follow the floor's doorways, all take the enemy nearest the veteran, and close in or keep their range by weapon. They press their abilities now and then, roll from a wind-up beside them, and pick up a friend who is down.
  - **The browser:** with `--client` the squire is a real browser on the client, steered through the game's own commands, and its screen is saved at every combo and every few seconds of a fight.
  - **The numbers:** counted from the server's events: rooms cleared, combos by kind and finisher, damage share, kills, downs, bleed-outs, revives.
- **`tests/bots.ts`:** a bot can bring its own loadout, keeps the events it was sent, and no longer counts the old room's goodbye after a portal as being kicked (a race that showed up only when the goodbye beat the new seat).
- **Filed:** three runs of three on the hosted build cleared floor 1 with 6 to 12 combos each, numbers in `playtest-notes.md`.

**Learned**

- **Mixed levels hardly matter on floor 1.** The two level-1s did as much damage as the level-10 veteran or more in every run. A style level gives little until its talents are spent.
- **Floor 1 is easy for four.** Nobody went down in any hosted run, so the downs went unexercised here.
- **Two traps for anyone steering the client from a test:**
  - The game lays its pending presses over the command `buildCommand` returns, so attack and ability presses have to go there, not in the command.
  - tsx compiles functions handed to `page.evaluate` with a `__name` helper the page lacks, so the page needs a one-line stand-in.

**Next**

- Michael closed Phase 1 on these runs the same day ("I'm good to close it and move on!"). Phase 2, village and loop, is current.
- T6, progression to 50, carried over as Phase 2's first item. Phase 2's own items still need planning from the design doc.

## 2026-10-27: local session, T5c: every piece drawn on the hero as itself

**What changed**

- **The look travels.** The loadout carries what the hero wears as catalogue ids (`look`), and `applyLoadout` puts it on `PlayerState.look`, so the snapshot gives every player everyone's gear. The server checks each id is in the catalogue and that there is one a slot; a look that fails drops the message whole. Optional, so the slice's state never carries it (parity identical). `PROTOCOL_VERSION` 7. It costs a dressed hero about 100 bytes a snapshot.
- **The wardrobe** (`client/src/render/wardrobe.ts`): every shape in the catalogue has its own build on the slice's skeleton, drawn in its material's base and trim colours.
  - Heads: an open med helm with a nasal bar, the closed full helm with its slit and crest, a hide coif tipped back off the face, a wizard's hat.
  - Bodies: chainbody (a mail texture), platebody (pauldrons, a ridge, a gorget), jerkin (a panel and a strap), robe top (wide sleeves).
  - Legs: platelegs, a flared plateskirt, chaps, a robe skirt to the floor.
  - Hands, feet and the rest: gauntlets, vambraces and gloves; boots (metal ones with a toe cap); capes (the Warden's carries his cross); an amulet; a ring.
  - Square and kite shields.
- **Weapons and shields.** The weapons are the slice's, tinted by their material. A bow or staff in hand slings the shield on the back, and a bow carries a quiver. Nothing worn shows a plain tunic, trousers and shoes. A hero with no look (villagers, the test bots) keeps the slice's three figures.
- **Tests:**
  - A catalogue test for the look and its checks (check 77).
  - A `test:net` step: a look reaches the other player, and an unknown id is dropped.
  - The browser bag test asserts the drawn bow (7/7).
  - Parity identical.

**Learned**

- The look is the views' alone, but the snapshot is the one way a player hears about another, and `PlayerState` already carried the name and the mods: an optional field there was simpler than a message of its own.
- A test page talking to the dev client's default server reaches whatever runs on 2567, another session's included. The local client for these tests now gets `VITE_SERVER_URL` pointing at this session's own server.

**Next**

- Michael: try T5 on the hosted build once merged (#75, #76, this).
- The Phase 1 gate on a generated floor.

## 2026-10-27: local session, T5b: the bag and the body

**What changed**

- **The item catalogue** (`shared/src/sim/catalogue.ts`): every piece is a shape in a slot (med and full helms, chainbody, platebody, jerkin, robe top, platelegs, plateskirt, chaps, robe skirt, gauntlets, vambraces, gloves, boots, square and kite shields, cape, amulet, ring, sword, shortbow, staff) made of a material in a family: metal for melee (bronze, iron, steel, black, wardensteel), hide for ranged (leather, hard leather, studded, wyvernhide, stormhide), cloth for magic (linen, wool, silk, starweave, duskweave), wood for bows and staves (ash, oak, elm, yew, heartwood), trinkets for necks and rings (copper, silver, gold), dyes for capes. The pair gives the name ("Iron full helm", "Black platebody"), the kind, the tier and the stats. Past iron, steel and black the tier names are Hearthgate's own, not RuneScape's.
- **What it does in the fight:** armour cuts damage taken (`Mods.armour`, a piece's tier times its shape's weight, hide and cloth less than metal, capped at 60%); a weapon adds 5% damage a tier; rares carry the slice's bonus stats and perks; each worn armour piece of another kind than the weapon costs that weapon 5% damage (Michael: per piece). A shield does nothing while a bow or staff takes both hands. Capes, necks and rings have no kind and never count against you. All of it travels in the loadout the server already takes, so no fight code changed but the armour line in `hurtHero`.
- **Drops** roll from the catalogue behind `gear.catalogue`; the parity test keeps it off with the downs, since loot is rolled in the fight (identical).
- **The save (v2):** a 28-space bag and RuneScape's ten worn slots. The slice's save carries over: its weapons and body armour become catalogue pieces and its rares keep their names, stats and perks. A new hero holds a bronze sword with an ash shortbow and an ash staff in the bag, and no armour. 1, 2, 3 and the wheel take the best weapon of that kind from the bag; the hero fights with the weapon in hand, whatever changed it.
- **The equip screen:** the body laid out as RuneScape's, the bag beside it, what the chosen piece does and what a mismatch costs now. Keys and pad first (move to choose, F or A to wear or take off, Q or LB to drop, 1 and 2 for the tabs), clicks too; the hero stands still while it is open, and it opens on a floor between rooms as well.
- **Tests:** 9 catalogue tests (check 76); browser smoke 7/7, a bow worn from the bag by keys alone and the sword back on 1; `test:net` passes; parity identical.

**Learned**

- The slice's per-style damage in `Mods` already had room for the mismatch rule: armour of another kind lowers the other styles' numbers, so the weapon in hand picks the right one with no new rule in the fight.
- A key tapped faster than a slow headless frame is never seen by the action layer's held axes; the browser test holds keys as a player does.

**Next**

- Michael: the bag and body on the hosted build once merged.
- T5c, every piece drawn on the hero as itself.

## 2026-10-27: local session, T5a: Hearthgate's downs

**What changed**

- **Hearthgate's downs (5A)** behind one switch, `coop.bleedOut` (on). A hero downed in a fight crawls (`coop.crawlSpeed`, 1.1 m/s) and bleeds out over 30 s; then they are out until the room is cleared. A friend holding F for 3 s picks up the downed for free; the out need the helper's Revive Draught (`coop.draughtsPerFloor`, one per player per floor, a counter until Phase 3's items), used when the revive completes. Out of a fight everyone gets back up (the slice's `downMs`), so a cleared room on a generated floor brings the party back; a party all down or out is wiped.
- New state is optional (`PlayerState.bleed`, `draughts`) and never set with the switch off, so the slice's state never carries it.
- **Parity:** the parity test (and `tests/parity.ts`) plays with the switch off, so it still proves every other rule is the slice's to the bit; identical.
- HUD: the bleed-out clock and "Out until the room is cleared", the draughts under the dodge pips, party frames with the bleed-out left or "out", a revive prompt that knows a draught is needed and how many you carry, toasts for a bleed-out and a draught revive.
- Michael's bag-and-body answers recorded (decisions.md): 28 spaces, RuneScape's ten slots, -5% damage per mismatched piece, every piece drawn as itself. Planned as T5b and T5c.
- Tests: 8 downs unit tests (check 67); `test:net` and browser smoke 6/6 with the downs on in every fight.

**Learned**

- A rule the slice does not have can still be checked against the slice: put it behind a switch the parity test turns off, and keep its state optional so the slice's JSON never grows.
- Solo, going down is a wipe straight away (nobody is left standing), so the bleed-out only shows with a party; the bot harness joins a browser's room by its code for a check like this.

**Next**

- Michael: the downs with a friend on the hosted build once merged.
- T5b, the bag and the body; then T5c, the look.

## 2026-10-27: local session, the T3 / T4 / T4b playtest and its follow-ups

**What changed**

- Michael played T3, T4 and T4b on the hosted build: all three gates passed ("everything looks good for the most part"), filed in `playtest-notes.md`. He answered T5's questions as cards (decisions.md, PR #73, merged into this branch).
- **The HUD overlap he saw** was a T4b regression: both pages imported `theme.css`, so the build moved it into a shared chunk that the game's page loaded before `style.css`, and the base styles won (the weapon chips and abilities fell back to their old centred spots, on top of each other). Dev serves CSS in import order, so only the built game showed it. The editor now keeps its own copy of the colour tokens; checked against a production build.
- **A hand-built dungeon has floors of its own**, his second callout (going deeper fell into generated floors): one to five floors, each its own layout, and a run through it is exactly those floors. Every floor but the last ends in a rest room whose violet ring leads to the next; the last ends at the Warden's hall, or in a rest room with only the ring home. The editor shows floors as tabs ([ and ], the stick clicks, N adds, Shift+Backspace removes), each marked ready or not, and Play starts on the floor being edited. Files from before floors open as one floor. The Old Cellar has a second floor, a drop to the Warden. Protocol 6.
- **Tests**: check 59 (the floor rules, legacy files); `test:net` takes The Old Cellar's deeper ring onto its own second floor; browser smoke 6/6 with two floors built by keys alone.

**Learned**

- A stylesheet two Vite pages share becomes its own chunk, loaded first: the cascade order of the built game is not the order of its imports. Check layout against `npm run build`, not only the dev server, when CSS moves between entries.

**Next**

- Michael: approve #73 (T5's answers, docs) and this branch's PR.
- T5, starting with Hearthgate's downs.

## 2026-10-27: local session, T4b: the dungeon editor

**What changed**

- Michael on T4: the screenshots were as expected; the rest room's rings stay open on arrival ("you should be able to skip rooms and rush the dungeon"). On T4b: dungeons saved in the browser plus an exported file committed to the repo, and Keeper Wren picks where the ring leads (decisions.md).
- **Hand-built dungeons** (`shared/src/level/handmade.ts`): a layout is its placements only (piece, cell, turn, height). `checkDungeon` joins facing doorways at one height as the generator does and says in words what keeps a layout from play (no entrance, no way out, overlaps, a piece cut off; notes for walled-up doorways and ones that meet at another height). `FloorSpec.hand` carries one, so it plays through the floor code T4 built. A run can start on one: ending at the Warden's hall it is that floor alone; ending in a rest room its deeper ring goes on into generated floors. The Old Cellar (9 pieces, a staircase up, three fight rooms) ships in `shared/src/level/dungeons/`.
- **The editor** (`client/editor.html`, `client/src/editor/`): a top-down grid with a ghost of the chosen piece at the cursor, its doorways green where they would join a neighbour and amber where one meets it at another height. Keyboard first (arrows or WASD, Q/E or 1 to 0, R, Z/X, Space, Backspace, F copies the piece under the cursor, U undo, Ctrl+S, P plays), the same on a gamepad, the mouse as an extra; 48 px buttons. Checked as it changes. Saved in the browser (a draft too, so a refresh keeps the work); Export and Import files; Play opens the game on `?floor&play&hand=NAME`. The title screen has a Dungeon editor button.
- **Keeper Wren**: F says where the ring opens; F again while she speaks turns it. A `destination` message, checked whole on the server; the ring carries a label (the dungeon's name, Deeper, Home) drawn over it. Protocol 5.
- **Tests**: 7 unit tests (check 58); `test:net` asks Wren for The Old Cellar, has a broken layout refused, and walks the floor with two bots; browser smoke 6/6, the editor built by keys alone, saved and played, and Wren turning the ring. Parity identical.

**Learned**

- Joining doorways by facing sockets made the hand-built and generated floors one format: nothing downstream of `FloorDef` had to change.
- A synthetic keydown on `window` reaches the game's keyboard, so the browser can be driven for screenshots without the mouse capture.

**Next**

- Michael: approve #71 (T4), then this PR; build a dungeon in the editor, play it, and take it through Wren with a friend. Export the ones worth keeping; committed to `shared/src/level/dungeons/` they ship.
- T5, party rules and the Phase 1 gate.

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
