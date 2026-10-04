# Decisions

Questions for Michael and his answers. Nothing is a spec without a `Michael:` line.
Agents write questions under **Pending** with lettered options and a recommendation; the
producer carries them to Michael (Slack #hearthgate or the control room) and writes the
answer here. Answered entries override the backlog.

## Pending

### 2026-10-04: The builder cannot read The Old Gates (builder, Session 7)
Four Phase 1 items lift code from The Old Gates (gear and weapons, weapon classes, posture/parry/block, the Charger/Pack Leader/Shieldbearer roster). The builder's cloud run is not allowed to clone `mbuckley616/the-old-gates` (the session's permission check refused it as outside the task), so those four are blocked. The builder took the next item (downs) meanwhile.
A. Let the builder routine read The Old Gates: add the repo to the routine's sources (or allow the clone), then it lifts the modules as the design doc says. **Recommended**: the design doc's whole case for these items is reuse of tuned, proven numbers.
B. Copy the relevant Old Gates modules into this repo under `docs/reference/old-gates/` (read-only reference, not built); the builder lifts from there.
C. Re-author them from the design doc without The Old Gates; faster to unblock, loses the tuning.

### 2026-10-04: Revive Draught before the item ledger exists (builder, Session 7)
The downs item ends with "Revive Draught consumable". CLAUDE.md rule 3 says items move only through the item and trade service in a transaction, and that service arrives in Phase 3. Session 7 built downs, bleed-out and free pickup, and left the draught out.
A. Phase 1 stand-in: every player starts each floor with one draught as a plain counter in the sim (not an item, nothing to trade or loot); the ledger replaces it in Phase 3. **Recommended**: the gate needs a party to clear a floor, and a revive for the dead is part of that loop.
B. Defer the draught to Phase 3, when it can be a real item; Phase 1 has pickup only.

### 2026-10-04: Goblin Warrens floor: who builds the groundwork (builder, Session 10)
The floor item ("one hand-built Goblin Warrens floor assembled from rooms; a floor objective; stairs") needs many enemies instead of one goblin, walls that block movement in the shared sim (client prediction runs the same collision), and interest management for what each client is sent. CLAUDE.md puts the shared simulation's structure and anything touching server and client together with Fable.
A. Split it: a **(Fable)** item first for many enemies and walls in the sim, the schema and the client's interpolation; then the builder builds the rooms, the objective and the stairs on top. **Recommended**: it is the kind of change the model split exists for.
B. The builder does all of it in one item.

### 2026-10-04: Goblin Warrens floor objective (builder, Session 10)
The design doc leaves "a floor objective" open for the Warrens.
A. Clear every room, then the stairs open. **Recommended**: simplest to read and to test, and every fight counts toward the gate's "clears a floor".
B. Kill the warren chief (a Pack Leader) in the last room, then the stairs open; the other rooms are optional. Waits on the enemy roster.
C. Reach the stairs; fights are in the way, not the goal.

## Answered

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
