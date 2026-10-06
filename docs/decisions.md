# Decisions

Questions for Michael and his answers. Nothing is a spec without a `Michael:` line.
Agents write questions under **Pending** with lettered options and a recommendation; the
producer carries them to Michael (Slack #hearthgate or the control room) and writes the
answer here. Answered entries override the backlog.

## Pending

## Answered

### 2026-10-05: No combo can fire in play yet, and the gate needs one visible (builder, Session 28)
The Phase 1 gate is "a mixed-level party clears a floor and the combo bonus is visible". The combo math is built (Session 8, `states.ts`), but nothing in play can trigger it: Cleave and posture breaks apply Staggered, which only Execute or Backstab consume, and neither exists; nothing applies Marked, Soaked, Burning, Rooted or Chilled. With Magic deferred (B above), the abilities that remain in the backlog consume nothing. The client also never shows a combo: the server drops `resolveHit`'s effects. So the gate cannot be met as the backlog stands.
A. Execute in the melee slot 2 (design doc's Melee row: heavy damage on a staggered target; it consumes Staggered for the crit and knockdown, x1.5 when another player did the staggering), plus a combo callout: the server sends a `combo` event with the payoff and contributor count, the client shows "Combo x1.5" over the enemy for a second, a rising chime, and a log line. Cleave from one player then Execute from another is the visible two-player combo. **Recommended**: one ability the design doc already names, and it uses the Staggered that Cleave, parries and posture breaks already apply.
B. Arrow rain applies Marked (8 s), and every hit on a marked enemy shows the bonus (the same callout as A). Less to build, but Marked never consumes, so it reads as a damage buff more than a combo.
C. Both A and B: two combos for the playtest, melee and ranged.
Michael: **A. Execute in melee slot 2, plus a combo callout**. (2026-10-05)

### 2026-10-05: The staff for Magic missile (builder, Session 27)
The backlog's "Arrow rain (Ranged) and Magic missile (Magic) in slot 1 for the bow and the staff" needs a staff, and The Old Gates has none: its eleven weapon types are melee and the bow, so there are no tuned numbers to lift. Arrow rain is built (Session 27). The design doc's Magic row is Magic missile (hits up to 5 enemies once each), Shatter and Ward.
A. Add a Staff weapon type (Magic style, two-handed) to `gear.ts` on the bow's damage curve, pickable on the join screen; its swing is a short-range bolt at the soft auto-target, and slot 1 is Magic missile: up to 5 living enemies in sight within 10 m, nearest first, once each. First-guess numbers, tuned in the playtest. **Recommended**: it completes the three styles the combo system scales on, and the gate's combo bonus is easier to see with more than two styles in a party.
B. Leave Magic for Phase 2 or later: Phase 1 ships with Melee and Ranged only, and this backlog item closes with Arrow rain.
Michael: **B. Leave Magic for Phase 2 or later** — answered on the control room. (2026-10-05)

### 2026-10-05: A village greybox before the Phase 1 gate? (Claude (local))
Michael asked why the game is still a simple top-down arena with pills when the design doc promises a town, a portal, buildings with NPCs, a third-person camera and character models. The answer: the town is Phase 2 and CLAUDE.md forbids starting a later phase early; the camera is off-spec (about 55 degrees and fixed, against the doc's 30 to 40 with auto-rotation) and was on no list; the style guide and first commission were meant to be ordered during Phase 1 and were on no list either.
A. Keep the phase order; the town waits for the Phase 1 gate.
B. Build a rough, walkable town now (greybox buildings, placeholder NPCs, a portal into the Warrens) to judge the feel early; Phase 2 still owns the real village (merchants, portal board, resources, persistence).
Michael: **B, as a (Fable) item**, plus the camera, placeholder figures and the art-direction item on the Phase 1 backlog (2026-10-05, in chat). This is an exception to CLAUDE.md's "do not start the next phase's content" for the greybox only; the Phase 1 gate is unchanged.

### 2026-10-05: Does a wipe reset the whole Warrens floor? (the critic)
In headless play a wipe in the pens (the third room) put all nine enemies back, the two cleared rooms included: Session 7's "wipe resets the fight" now covers the floor. The design doc makes a wipe the end of the run, so this may be the intent, but it is what the gate's "a party clears a floor" will feel first.
A. Keep it: a wipe restarts the floor (the run ends; no change). **Recommended** until a human playtest says it is too harsh, since it matches the design doc.
B. A wipe resets only the room the party died in; cleared rooms stay clear.
Michael: **A. Keep it: a wipe restarts the floor** — answered on the control room. (2026-10-05)


### 2026-10-05: How a player picks a weapon in Phase 1 (builder, Session 17)
Session 17 put a weapon in every player's hand in the shared sim: one-handers swing as today, two-handers (Claymore, Great Axe, War Hammer, Great Club) wind up longer and hit up to 3, 2 or 1 enemies, the bow locks on to the nearest goblin it can see up to 12 m. Everyone still holds the Wooden Sword, because nothing lets a player choose, and the village loadout screen is Phase 2. The gate also asks for a mixed-level party, which in Phase 1 can only mean different gear tiers.
A. A pick before joining: weapon type and material tier on the join screen (keys and gamepad, 48 px buttons), sent as a join option the server checks; `?weapon=claymore&tier=5` for tests. Stand-in for the Phase 2 loadout. **Recommended**: no new in-world objects, and it sets up the mixed-level party for the gate.
B. A weapon rack in the level: walk up and press E (LB) to take the next weapon; tiers fixed per rack.
C. A key that cycles weapons while out of combat (at the spawn or after a room clears).
Michael: **A, pick before joining** (2026-10-05)

### 2026-10-04: The remote playtest with a friend (Claude (local), Session 15)
The Phase 0 carry-over item "remote playtest with one friend on the hosted build" needs a second person on another network, which nobody on the team can supply, and it was reading as a standing blocker.
A. Drop it; the lag lab's hosted mode (two real browsers on Michael's desktop to the Render server) plus the critic's daily lab stand in, and the entry goes in playtest-notes.md as a machine run. **Recommended.**
B. Keep it open until a friend is free.
Michael: **A, drop it; consider it done unless Claude can do it autonomously** (2026-10-04, in chat). The hosted run was done the same day and filed.

### 2026-10-04: Adaptive interpolation delay now conflicts with main (the producer)
PR #9 (Fable, Session 14) passed CI, but with Builder sessions 7-12 on main it conflicts in client/src/net.ts, shared/src/sim.ts and docs/devlog.md. Only a Fable session can resolve it.
A. Re-run Fable to merge main into the branch. **Recommended.**
B. Drop the branch, redo it later.
Michael: **A, re-run Fable to merge main into the branch** (2026-10-04)

### 2026-10-05: Adaptive interpolation delay conflicts with main again (the producer)
PR #9 passed CI at 72d1267, but the Warrens groundwork merged to main since and it conflicts again. Only docs/devlog.md conflicts; the code merges cleanly.
A. Re-run Fable to merge main once more. **Recommended.**
B. The producer resolves the devlog conflict (docs-only merge commit on the branch; Michael approves the result).
C. Drop the branch, redo it later.
Michael: **A, re-run Fable to merge main again** (2026-10-05, on the control room)

### 2026-10-04: The builder cannot read The Old Gates (builder, Session 7)
Four Phase 1 items lift code from The Old Gates (gear and weapons, weapon classes, posture/parry/block, the Charger/Pack Leader/Shieldbearer roster). The builder's cloud run is not allowed to clone `mbuckley616/the-old-gates` (the session's permission check refused it as outside the task), so those four are blocked. The builder took the next item (downs) meanwhile.
A. Let the builder routine read The Old Gates: add the repo to the routine's sources (or allow the clone), then it lifts the modules as the design doc says. **Recommended**: the design doc's whole case for these items is reuse of tuned, proven numbers.
B. Copy the relevant Old Gates modules into this repo under `docs/reference/old-gates/` (read-only reference, not built); the builder lifts from there.
C. Re-author them from the design doc without The Old Gates; faster to unblock, loses the tuning.
Michael: **A, let the builder read The Old Gates** (2026-10-04)
Follow-up (Michael's local session, 2026-10-04): the builder's next run (Session 13) was refused the clone again, so B was applied as the fallback: the files the four items need are copied under `docs/reference/old-gates/` with a README mapping them (snapshot of The Old Gates at a129d39). A still stands as the preference; the copies can be dropped once the routine can read the repo.

### 2026-10-04: Revive Draught before the item ledger exists (builder, Session 7)
The downs item ends with "Revive Draught consumable". CLAUDE.md rule 3 says items move only through the item and trade service in a transaction, and that service arrives in Phase 3. Session 7 built downs, bleed-out and free pickup, and left the draught out.
A. Phase 1 stand-in: every player starts each floor with one draught as a plain counter in the sim (not an item, nothing to trade or loot); the ledger replaces it in Phase 3. **Recommended**: the gate needs a party to clear a floor, and a revive for the dead is part of that loop.
B. Defer the draught to Phase 3, when it can be a real item; Phase 1 has pickup only.
Michael: **A, stand-in counter, one per player per floor** (2026-10-04)

### 2026-10-04: Goblin Warrens floor: who builds the groundwork (builder, Session 10)
The floor item ("one hand-built Goblin Warrens floor assembled from rooms; a floor objective; stairs") needs many enemies instead of one goblin, walls that block movement in the shared sim (client prediction runs the same collision), and interest management for what each client is sent. CLAUDE.md puts the shared simulation's structure and anything touching server and client together with Fable.
A. Split it: a **(Fable)** item first for many enemies and walls in the sim, the schema and the client's interpolation; then the builder builds the rooms, the objective and the stairs on top. **Recommended**: it is the kind of change the model split exists for.
B. The builder does all of it in one item.
Michael: **A, Fable groundwork first, builder after** (2026-10-04)

### 2026-10-04: Goblin Warrens floor objective (builder, Session 10)
The design doc leaves "a floor objective" open for the Warrens.
A. Clear every room, then the stairs open. **Recommended**: simplest to read and to test, and every fight counts toward the gate's "clears a floor".
B. Kill the warren chief (a Pack Leader) in the last room, then the stairs open; the other rooms are optional. Waits on the enemy roster.
C. Reach the stairs; fights are in the way, not the goal.
Michael: **A, clear every room, then stairs open** (2026-10-04)

### 2026-10-04: Interpolation budget now that the clock holds still (Fable, Session 6)
Remote players and the goblin are drawn `INTERP_DELAY_MS` (100 ms) behind the client's server clock. Session 6 made that clock sit on the best delivery the network gives and move no faster than 10 ms/s, so the 100 ms is now exactly the budget a late snapshot has: one that arrives more than about 50 ms late (the budget less one tick) holds the remote player in place until the next one. Measured with `npm run test:clock` (30 s per link): on a 0 ms and a 50 ms link, no holds; on a 150 ms link with 25 ms jitter and 2% of packets 80 ms late, 1.3% of frames held, 18 holds a minute. Before this session the drifting clock happened to sit 50 to 70 ms late on average, which hid some of this by adding lag nobody chose.
A. Keep 100 ms fixed: least lag; a bad link stutters.
B. Raise it to 150 ms fixed: one more tick of lag for everyone; a bad link rarely holds.
C. Adapt it: 100 ms plus the jitter spread the clock window already measures, capped at 200 ms, slewed like the clock. Clean links keep 100 ms; bad links get what they need. **Recommended.** The extrapolation item (next on the Fable list) covers what remains.
This does not block the clock-sync PR; it is the next Fable item if C or B.
Michael: **C, adapt it: 100 ms plus measured jitter, cap 200** (2026-10-04)

### 2026-10-03: Phase 0 gate: call it passed?
The two-tab local playtest answered yes, yes, no; the gate asks for different networks. The producer recommended B (one more playtest first).
Michael: **A, passed, on to Phase 1**. (2026-10-03)

### 2026-10-03: Hosting for remote playtests
A tunnel by hand (free, only while Michael is present) or a free-tier host deployed from main.
Michael: free tier. Render (server) plus GitHub Pages (client), deployed on every push to main.

### 2026-10-03: Builder cadence
Michael: every 3 hours, every day. He is leaning towards buying more usage.

### 2026-10-03: Team channel
Michael: create #hearthgate (C0C6LQQF8CC) in the Bunratty Game Studios workspace.
