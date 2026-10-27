# Bringing the combat slice into Hearthgate: the plan

> **Superseded on 27 Oct 2026** by `docs/slice-transplant-plan.md`: after step 1, Michael chose to move the slice over whole, with its `HostSession` on Hearthgate's server, instead of porting it a system at a time. Section 3a (progression to 50 and champion points) still stands and the new plan points to it; the rest is history.

Written 26 Oct 2026 by a local session; Michael approved it the same day (answers below and in `decisions.md`). Hearthgate was read at `main` d83aef0 (Session 50); the combat slice at `363b726`, its handoff doc. The slice lives at `C:\Users\mbuck\OneDrive\Documents\GitHub\combat-slice`, a sibling checkout on Michael's desktop, and since 27 Oct on GitHub as the private repo `mbuckley616/combat-slice` (`main`), which cloud sessions can read. The desktop folder stays the working copy and slice changes are pushed to the repo. Start with its `docs/handoff.md`.

## In short

Hearthgate and the slice share a lot: TypeScript, Three.js, Vite, and a fight that is plain data stepped on a fixed clock. That shared design is what makes the port possible. The big difference is **who runs the fight**. In the slice, the host's browser runs it. In Hearthgate, a Node server (Colyseus) runs it, because items, trading and hirelings have to live there (design doc, Technical architecture; CLAUDE.md rule 1).

**Recommendation:** keep Hearthgate's server and its netcode, which has been tested in the lag lab and on the hosted build. Replace Hearthgate's combat simulation with the slice's, and run the slice's sim on the server. The slice's `HostSession` becomes the server room, and its `ClientSession` prediction is replaced by Hearthgate's `net.ts`, which already does the same job with more care: clock sync, adaptive interpolation, extrapolation and eased corrections. The slice's rendering, camera, effects, input layer, tuning file and debug panel come across almost as they are.

One consequence is good news. In Hearthgate every step is online from the start, so the slice's "co-op" milestone mostly dissolves. Each step below is played on the hosted build and checked in the lag lab, not only solo.

**Michael's answers (26 Oct 2026):** 1A 2A 3A 4B 5A 7A 8A 9A 10A, as recommended. For 6 (progression), his own answer: keep the slice's progression as built, with style levels to 50 and a point every level, then champion points in the style of Elder Scrolls Online, so a player builds a specific character, works alongside gear, and grows slightly stronger over time. Section 3a sets out how that would work. The questions below are kept as they were asked.

**Re-planned 27 Oct 2026:** the slice's look comes first (step 2), the server stays as designed, and dungeons are generated from a kit of hand-built pieces (step 6). Section 4 has the new order.

---

## 1. How Hearthgate is built, and how well the slice fits

| | Hearthgate | Combat slice | Fit |
| --- | --- | --- | --- |
| Language and build | TypeScript 5.7 strict, npm workspaces `shared` / `server` / `client`, Vite 6, vitest, Playwright | TypeScript 7.0, one Vite 8 app | Good. Keep Hearthgate on TS 5.x: Colyseus schema needs `experimentalDecorators`. The slice's code is plain TS and should compile there with small fixes. |
| Rendering | Three.js 0.170, `client/src/render.ts` (964 lines), KayKit glTF models with `AnimationMixer` | Three.js 0.186, procedural IK rig, retro pixel and CRT pass | Raise Hearthgate to 0.186 first; it is a client-only bump. |
| Who runs the fight | Colyseus server, 20 Hz, locked to wall time | Host browser, 60 Hz; joiners via a relay | **The main change.** See question 1. |
| Sim shape | `shared/src/sim.ts` (1,953 lines), plain objects, time is a `now` argument in ms, timestamps such as `dodgeUntil` | `src/sim/` (about 3,300 lines), plain JSON state, `dt` steps, timers in seconds, seeded RNG in state | Both are deterministic and side-effect free. No `Math.random`, `Date.now` or DOM in the slice's sim (checked). The slice uses `dt` and seconds; Hearthgate's rule 2 says ms and `now` (question 2). |
| Tuning | Constants spread through `sim.ts` (`PLAYER`, `GUARD`, `CAMERA`, ...), no panel | One `tuning.ts` (1,475 lines) plus `tuningRanges` and a lil-gui panel | Adopt the slice's way. It becomes `shared/src/tuning.ts`. The panel's edits have to reach the server (see step 1). |
| Input | `client/src/input.ts`: keyboard, gamepad and pointer-lock mouse, straight into `InputFrame` | `src/input/`: named actions, binding tables, sources | Adopt the slice's layer with Hearthgate's bindings. The slice puts attack and guard on the mouse only and the arrow keys walk, which breaks Hearthgate rule 4 (keyboard-only). Fixing that is a binding-table change. |
| Camera | Over the shoulder (Dragonwilds), arrows and right stick turn it, optional mouse look, pulls in at walls | Orbit with sphere-cast collision, crane-up, pillar fade, lock-on framing, shake | Close already; the slice's is richer. Take the slice's, with Hearthgate's arrow-key turning. |
| Levels | `Level`: flat wall rectangles, waypoints, village, portal and stairs, room hand-off | One arena: box and cylinder colliders, ramps and ledges (height), sphere casts | Keep Hearthgate's levels and hand-off. Bring the slice's `geometry.ts` in for the camera and for height later. |
| Testing | Unit tests per system (226), `test:net` bot harness, lag lab, Playwright e2e, critic daily | Typecheck only, playtests | Every ported system gets unit tests in `shared/` as it lands, including a replay determinism test. |
| Saves | None yet (Phase 2 and 3: Postgres, item ledger) | localStorage profile | The slice's `Loadout` shape is kept and its storage is not. |

## 2. Each area: copy, adapt or rewrite

"Copy" means the file comes across nearly line for line. "Adapt" means the logic comes across with new seams. "Rewrite" means the slice is only the reference.

| Area (handoff table) | Verdict | Why |
| --- | --- | --- |
| Tuning (`tuning.ts`) | **Copy**, into `shared/src/tuning.ts` | Michael's tuned values are the point. Hearthgate's existing constants (`PLAYER`, `GUARD`, `CAMERA`, `INTERP` ...) move into it as their systems are replaced. The netcode ones (`INPUT_TIMING`, `CLOCK_SYNC`, `INTERP`) stay where they are and never go in the panel. |
| Sim core (`types.ts`, `world.ts`) | **Adapt** | `SimState`, `PlayerCommand` and `stepSim` replace `PlayerSim`, `InputFrame` and `stepEncounter`. The adaptations: `PlayerCommand` gains Hearthgate's `seq` and slot timing; the level is Hearthgate's `Level`; `run.ts` gives way to Hearthgate's rooms, stairs and portal. |
| Hero (`player.ts`) | **Copy** | Movement, sprint, jump, dodge and backstep, guard and parry, the 5-hit chains with buffering and cancels, lunge. This is the feel. Collision calls go through Hearthgate's `collideWalls`. Hearthgate's own jump (a pure function of time, Session 45) gives way to the slice's. |
| Combat (`combat.ts`, `projectiles.ts`, `abilities.ts`) | **Copy**, abilities depending on question 4 | Damage, poise, hitstop, knockback, parry and block, projectiles. Hearthgate's Cleave, Execute and Arrow rain either come across into the slice's ability framework or are retired. |
| Enemies (`enemies.ts`) | **Adapt** | The slice's AI, attack tokens and telegraphs replace Hearthgate's `stepEnemy`. Hearthgate's Shieldbearer, Charger and Pack Leader are rebuilt in that framework, because they are in the design doc. The Warden and the brute come across. Hearthgate's waypoint pathing replaces the slice's ramp navigation. |
| Progression (`talents.ts`, levels in `gear.ts`) | **Copy** (Michael, 6), plus a new perk-points layer | Style levels, unlocks and talent boards come across as built. A Champion-style perk system is added on top (section 3a). Pillar 1 changes from "barely move" to "move a little, and you choose how". |
| Gear and drops (`gear.ts` items, `drops.ts`) | **Fold into Hearthgate's `gear.ts`**; drops wait (7A) | The slice's slots, rarity and perks join Hearthgate's tier-capped definitions. Drops arrive with the Phase 3 item ledger (rule 3). |
| Run (`run.ts`) | **Leave behind** | Slice-only. Its ideas (heal between waves, wipe ends the run) are weighed one by one. |
| Co-op rules (`coop.ts`) | **Adapt** | The lag grace is exactly the "lag compensation of the defender" that Session 37 held over for the playtest. Take it. Revives depend on question 5. Hearthgate's own rules apply to joining and leaving (join in the village; join a run at a rest room). |
| Level data (`arena.ts`, `geometry.ts`) | `geometry.ts` **copy**; arena **leave** | Sphere casts and colliders serve the camera. Height and ramps in the server sim come later, if levels need them. |
| Input (`src/input/*`) | **Copy**, new binding tables | Small, and Hearthgate has no action layer. It is also where touch plugs in (Phase 5). |
| Netcode (`HostSession`, `ClientSession`, relay) | **Rewrite** onto Hearthgate's | Hearthgate's `SimRoom` and `net.ts` stay and step the new sim. The slice's notes (input cushion, a 120 ms correction ease, predicted hit events) are reference only. |
| Profile (`Profile.ts`) | **Leave**; keep the `Loadout` shape | Saving is Phase 2 and 3, on the server. |
| Camera (`OrbitCamera.ts`) | **Copy**, with Hearthgate's keyboard turn and swing-in-behind | The handoff says to match its behaviour closely. |
| Hero rendering (`HeroView`, `rig`, `outfits`, `props`) | **Copy** (question 8 decides whether it stays) | The poses and timing make the swings read. Steps 2 and 3 are gated side by side with the slice at 0.25×, and the KayKit clips cannot hit those key poses. |
| Enemy rendering (`EnemyView`) | **Copy** with the hero views | Plus figures for Hearthgate's three kinds in the same style. |
| Effects (`FxView`, trails, telegraphs, projectiles, ambient) | **Copy** | Engine code only. It replaces Hearthgate's flash-and-ring hit feedback. |
| Look (`SceneRenderer`, `RetroPass`, CRT, `RoomView`, decor, textures) | **Copy or skip** (question 8) | It sets the whole game's art direction, so it is Michael's decision. |
| UI (`src/ui/*`, theme) | **Adapt** | HUD in the corners, 48 px targets, everything reachable by keyboard and gamepad (rules 4 and 5). The slice's equip, talent and party screens are mouse-only (known gap), so they need gamepad navigation before they go in. |
| Audio (`Sfx`, `Music`) | **Copy** | All synthesised, no assets, and better than Hearthgate's `sound.ts`. It can land early whatever the art answer is. |
| Debug panel | **Copy**, host and dev only | It sends a `tune` message. The server applies it and rebroadcasts it, so everyone's prediction uses the same numbers. Slow motion becomes a server time scale, host only, as in the slice. |

## 3. Questions for Michael

Answer like "1A 2A 3B ...". Questions 1 to 3 block step 1. The others can wait until the step that needs them.

**1. Who runs the fight, and how fast.** The slice's feel lives at 60 Hz: a 60 ms hitstop, a 200 ms parry window, input buffers. Hearthgate's server ticks at 20 Hz (50 ms a tick).
- A. Hearthgate's server runs the slice's sim at 60 Hz and sends 30 patches a second (the slice's own rates). Inputs are sent 60 times a second, and the lag lab re-baselines. **Recommended:** it keeps Michael's tuning exact and the server stays the only truth. The sim is small enough that 60 Hz is cheap even on Render's free plan.
- B. 60 Hz sim with patches at 20 a second, as today. Less bandwidth, but remote players are drawn about 30 ms further in the past.
- C. Adopt the slice's model, where the host's browser runs the fight. This breaks rule 1 and the plan for items, trading and server-side hirelings. Not recommended.

**2. Rule 2's wording.** CLAUDE.md says "time is always a `now` argument in ms". The slice's sim counts ticks and steps `dt` in seconds. It is just as deterministic, but it breaks the letter of the rule.
- A. Amend the rule to "time comes from the tick count; no wall clock in the sim" and keep the slice's code as it is. **Recommended.**
- B. Convert the slice's timers to ms timestamps as they come across. More rewriting, and more risk of the feel drifting.

**3. How the port runs alongside the team.** Phase 1's backlog is empty, and its gate playtest has not been filed yet. The port touches server, client and the shared sim together.
- A. The port becomes Phase 1's remaining work: one backlog item per step, each marked **(Fable)**, run in interactive local sessions (`auto/local-combat-<step>`) as the slice was. A `FREEZE:` issue stays open while the sim is replaced, so the builder idles. The critic keeps running the lab. The Phase 1 gate is played at the end of step 5 against the ported combat. **Recommended:** it is how the slice got built, and it keeps the merge approval path.
- B. Play the Phase 1 gate on today's combat first, then start the port.
- C. Queue the steps as deep-work cards for the cloud lane. Cheaper on attention, but the slow-motion gates are things Michael has to feel himself.

**4. Characters, styles and swapping.** The slice has three heroes (knight, ranger, sorceress) swapped live with 1/2/3; the solo combos depend on swapping. Hearthgate's design has no classes: the weapon picked in the village sets your style for the run, every player is the same Knight, and three ability slots take any unlocked ability.
- A. The slice's way: three heroes, one per style, live swap, two abilities each (Q/E). The design doc's loadout section changes to match.
- B. A middle way: one character of your own, who carries three weapons and swaps them live (1/2/3). The style follows the weapon, the slice's abilities belong to the weapon, and there are no classes. **Recommended:** it keeps the slice's play (swaps, solo combos) and Hearthgate's "you are one character" without three separate models per player.
- C. Hearthgate's way: one weapon per run, no live swap, three free slots. The slice's solo combos would need another trigger.

**5. Downs and revives.** Hearthgate: a downed player crawls with a 30 s bleed-out, and a teammate picks them up free by standing next to them for 1.5 s (mid-fight). If the bleed-out runs out they are dead until the room clears, unless someone uses a Revive Draught. Slice: downed players wait for an ally to hold F for 3 s, with no bleed-out; a wipe ends the run. (The free recovery of the dead is Hearthgate's out-of-combat rule; mid-fight pickups of the downed are allowed in both.)
- A. Hearthgate's rules, with the slice's hold-to-revive as the pickup action (hold E or A for 3 s instead of standing nearby for 1.5 s). **Recommended:** the bleed-out and the draught give the Guide role and the Apothecary their jobs later, and holding a button reads better in a crowd.
- B. The slice's rules: no bleed-out, no dead state, no draught.
- C. Hearthgate's rules exactly as they are.

**6. Progression.** The slice gives levels per style from damage dealt, a talent board with flat stat points (might, haste, armour), and +10% damage at level 4. Hearthgate's pillar 1 says progression is sideways: "health and base damage barely move", and gear is capped by the portal's tier.
- A. Keep the slice's levels and unlocks (abilities, chain steps 4 and 5, the glow), but replace its flat stat talents and the +10% with sideways choices (an ability variant, a passive that changes how something works). Pillar 1 stands. **Recommended.**
- B. Take the slice's progression as it is and soften pillar 1.
- C. Leave progression out of the port and design it with Phase 2's village and loop.

**7. Gear and drops.** The slice drops items in the fight (personal loot), keeps them in localStorage, and uses slots plus perks. Hearthgate's rule 3: items arrive in Phase 3 and only move through the item ledger. Hearthgate's `gear.ts` holds the tier caps.
- A. No drops until the ledger exists. The slice's slots and perks are folded into Hearthgate's `gear.ts` as definitions; the debug panel equips gear for testing; drops and saving come with Phase 3. **Recommended.**
- B. Allow run-only drops now (never saved, gone when the run ends) so runs feel rewarding before the ledger.

**8. The look.** The slice (26 Oct) went to home-made assets: dark-fantasy pixel art on a CRT, purple shadows against firelight, code-built heroes and skeletons. Hearthgate (14 Oct) chose KayKit packs: the Knight for every player, the dungeon kit on the Warrens, a Hexagon tavern test, and the design doc's cosy, colourful RuneScape/WoW look ("never frightening").
- A. The slice's look everywhere, home-made only: the KayKit packs come out (18 MB), the village uses the same pixel pipeline graded warm and bright, and dungeons stay as the slice has them. The design doc's art section and style guide are rewritten to match. **Recommended:** it is Michael's latest call, the swings' readability depends on the slice's rig, and the design doc's tone split still holds through the colour grade.
- B. The slice's hero and enemy rig and its effects, but keep the KayKit environment and Hearthgate's brighter, unpixelated render.
- C. Port the slice's views for now and decide the look after step 3, from side-by-side shots.

**9. Hirelings later.** In the slice, a hero is driven only by one `PlayerCommand` per tick. That makes a hireling a server-side brain that writes commands for a hero with no client: same rig, same rules, no lag grace. This needs no work now, only care not to tie a hero to a connection.
- A. Yes: hirelings are heroes driven by a server brain, and they count as party members for attack tokens, revives and enemy scaling. **Recommended.**
- B. Hirelings are a simpler kind of their own, not full heroes.

**10. Controls.** The slice: Ctrl dodge, Space jump, left click attack, right click guard, Q/E abilities, 1/2/3 swap, Tab lock-on, F interact. Hearthgate: J attack, K or C dodge, Space jump, Shift sprint, 1/2/3 abilities, L or Q block, E interact, Tab or R lock-on, arrows turn the camera. The slice has no keyboard key for attack or guard, so it fails rule 4.
- A. The slice's layout, plus keyboard-only keys: J attack, L guard, arrows turn the camera. **Recommended** if 4A or 4B.
- B. Hearthgate's layout with the slice's mouse and gamepad buttons added.

## 3a. Progression: the slice's system plus champion points (Michael, 6)

Michael, 26 Oct: style levels go to **50**, not 5 (the slice already ran to 20 for talent points). Every level earns a point, and Champion-style points carry on from the cap. This is ESO's shape: skill points up to 50, then Champion Points without end.

Three layers, each with its own job:

| Layer | What it gives | Where it comes from | How fast |
| --- | --- | --- | --- |
| **Style levels, 1 to 50** | The slice's early unlocks stay early, so the first evening still feels them: the second ability (2), chain step 4 (3), step 5 (4). Milestones at 10, 20, 30, 40 and 50 open a new row on that style's talent board. The weapon glow moves to 25, and 50 brings a cosmetic of its own. | The slice's XP from damage dealt, with its curve stretched (`progression.maxLevel` 50, gaps growing per level) | Level 3 in about one run as now; around 10 after an evening; 50 is weeks of play. All tunable. |
| **Talent points, one per level** | Spent on that style's board: the slice's might, haste, armour, fleet foot, focus and ability upgrades, plus the milestone rows. That makes about 49 points per style, where the slice's board holds 27, so the board grows. Free respec between runs. | The slice's boards, extended | Moves with style levels |
| **Champion points, after 50** (new) | Small, permanent gains plus a few build-defining perks | New, in the style of ESO's Champion Points | Slow and endless: the long game |

The slice's flat +10% damage at level 4 becomes a might-style rank on the board, so all raw stats come through points the player chooses. The per-rank numbers are re-tuned so that a full board at 50 is a modest gain, not a multiplier.

**How champion points would work**
- **When they start:** once a character reaches level 50 in any style. From then on, every *N* XP from any style earns one champion point. The cost rises slowly and never stops, so there is always a next point.
- **Three constellations**, so a build is a choice of where to lean:
  - **Offence:** damage per style, finisher and poise damage, crits.
  - **Defence:** health, block chip, parry window, dodge recharge, revive speed.
  - **Utility:** ability cooldowns, combo windows and payoffs, sprint, pickup radius. The trade and gathering perks of later phases also land here.
- **Two kinds of perk in each constellation:**
  - **Passive perks** take points in ranks, each rank a small gain with diminishing returns, and each perk capped (for example +1% damage a rank, 10 ranks). These are the "slightly stronger over time".
  - **Slotted perks** need points to unlock, but only a few can be active at once (ESO's slottable stars): for example, "a parry refunds a dodge charge", "Shatter splashes twice as far", "each different ally in a combo adds 10%". Four slots, chosen in the village or at a rest room. These are what make *a build*.
- **Working with gear:** gear sets the base (weapon damage, armour, capped by the portal's tier) and brings its own perk, as the slice's items do. Champion points amplify themes rather than repeat gear's numbers. For example, a bleed weapon plus the "bleeds last longer" slotted perk is a build; neither is one alone. Later, set bonuses can point at constellations.
- **Respec:** talents stay free between runs, as in the slice. Champion points respec for coin at the village shrine: a cost, but no punishment for experimenting.
- **Keeping mixed-level parties fair (pillar 1):** all passive perks together are capped. A suggested ceiling is about +15% damage and +15% health, so a veteran is clearly stronger but a tier-1 friend still matters. The real gap between players is in the slotted perks and their knowledge, which is sideways power. The portal's tier cap stays on gear only.
- **Saving:** levels, talents and champion points are character state, not items, so rule 3's ledger does not cover them. Until Phase 2's server saves exist, the browser keeps them and sends them on join, and the server checks that the points spent are no more than the XP has earned. In Phase 2 they move to the server's database. This is a stopgap that a player could edit, which is harmless before launch.

**To settle before step 6** (my recommendation first):
- Are champion points per character, or shared across a player's characters as in ESO? Shared is my pick, because the design doc makes a second character the way to get a second region, and shared points keep that from feeling like starting over.
- Does the ~15% ceiling sound right, or should a portal's tier also cap perk bonuses, as it caps gear? My pick is the ceiling alone: one rule is easier to read than two.

**Docs that change with it:** the design doc's pillar 1 and its Progression section, which gains talent and champion-point layers beside skills and gear; `decisions.md` records the answer.

## 4. The porting order

**Re-planned 27 Oct 2026** (Michael, in chat; `decisions.md`). After step 1 he asked why the game still looked like old Hearthgate: the slice's look and feel should replace it, not arrive last. The server stays as designed. Dungeons become generated floors built from a kit of hand-built pieces, not one hand-made floor. So the look moves up to step 2, and a dungeon generator gets a step of its own before the Phase 1 gate. The order as first approved is kept in git history (`1eb829d`).

Each step is small, ends with a playtest Michael can run on the hosted build, and does not start until the previous gate passes (the slice's rule). Every step also keeps Hearthgate's own checks green: `npm run check` and `npm run test:net`, plus the lag lab against the hosted build at 0, 50 and 150 ms.

**Step 1: Foundation** (built 27 Oct). The tuning file and debug panel, the input action layer with the keys of question 10, the slice's orbit camera, the server at 60 Hz (question 1), and the slice's hero movement (run, sprint, jump, dodge, backstep) behind `applyInput`. Today's combat stays in place underneath.
*Gate:* run around the Warrens on the hosted build. It feels like the slice, the camera never clips, the panel tunes it live, keyboard-only works, and the lab is no worse than before.

**Step 2: The slice's look, everywhere.** Everything the player sees and hears, in one go: the slice's renderer with its pixel and CRT pass (with an off switch for the mobile tier), palette and lighting, the UI theme, the slice's hero rig drawing today's moves, its grunt for the goblin and the other kinds restyled to match, its stone and torchlight on today's floors, the village graded warm and bright, and the slice's synthesised sound effects. The KayKit packs (18 MB) and the old figures are deleted, not kept beside it. Draw-only: the server and `shared/` do not change.
*Gate:* the Warrens and the village look like the slice, and the frame time on a laptop is measured.

**Step 3: The sword's combat.** The 5-hit chain with buffering and cancels, guard and parry, poise and hitstop, and the hit feel (trail, sparks, numbers, shake, sound). Today's swing, Cleave and Execute are retired or moved per question 4.
*Gate:* side by side with the slice at 0.25× slow motion, it feels the same. Then a two-player fight on the hosted build with no snap.

**Step 4: All three styles.** Bow and staff chains, projectiles, abilities, soft targeting, lock-on, and swapping on 1, 2 and 3 (question 4). This is where Hearthgate's Magic finally arrives.
*Gate:* each style feels distinct, and swapping mid-fight is natural.

**Step 5: Enemies.** The slice's archer, brute and the Warden; Hearthgate's Shieldbearer, Charger and Pack Leader rebuilt in the slice's framework; attack tokens and floor telegraphs.
*Gate:* in an open room like the slice's arena, each enemy is readable and a mixed pack is tense and winnable solo.

**Step 6: The dungeon generator** (Michael, 27 Oct). A kit of hand-built pieces (hallway, corner, junction, staircase, small, medium and large rooms, open arena rooms like the slice's, a rest room and a boss room), each with doorway sockets, and a seeded generator that joins them into a floor: branching, with loops and side rooms, never one long corridor. The server generates the floor from the run's seed and sends the seed, so every client builds the same floor and the same walls; enemies are placed per room from a budget, and the stairs or the rest room close the floor. The portal picks the dungeon type, tier and seed, and a run is 3 to 5 floors (the design doc's Dungeons section already describes this: "floors are assembled from hand-built rooms ... joined by a procedural layout"). Staircases are connector pieces that climb or drop to a room at another height, so a floor is never flat; that brings height into collision (the slice's ramps and ledges), which the sim's walls do not have yet. A floor is 10 to 50 pieces, more with the dungeon's tier and level. Every room is visible from the start, and a minimap in a HUD corner shows the floor's layout and the party on it. Pieces are written in code; a small dungeon editor, where Michael lays pieces out by hand and saves a dungeon the portal can offer, is a follow-on once the generator works. The Warrens floor of today retires.
*Gate:* five floors in a row from five seeds, small and large, each a different shape with at least one climb or drop, none broken or unreachable, readable from the camera, and the minimap shows where you are. (Michael's answers to its questions: `decisions.md`, 27 Oct.)

**Step 7: Party rules.** Lag grace, downs and revives (question 5), the cross-style combos expressed as Hearthgate's states (Shatter on Chilled, Skewer on Staggered, Detonate on Marked) with the payoff scaling by distinct contributors, and enemy scaling by party size.
*Gate:* **the Phase 1 gate itself**, filed in `playtest-notes.md`: a mixed-level party clears a generated floor and the combo bonus is visible.

**Step 8a: The slice's progression.** Style levels and unlocks, talent boards and the talent screen (with keyboard and gamepad navigation), slots and perks folded into `gear.ts`, and the browser save checked by the server (section 3a).
*Gate:* "you want to start a second run right away."

**Step 8b: Champion points.** The three constellations, passive and slotted perks, the overall ceiling, the perk screen, and respec at the shrine. The XP curve and every perk's numbers go in `tuning.ts` and the debug panel, so Michael can tune them live.
*Gate:* with a character taken past level 50 by the debug panel's XP grant, you can plan a build, feel it working in a fight, and a lower-level friend still pulls their weight beside you.

**Step 9: Music and finish.** Music, and whatever of the look the earlier steps left rough. The design doc's art section and the style guide are rewritten to match the slice (question 8).
*Gate:* a 60-second clip of a generated floor and the village that Michael would show someone.

## 5. Risks

| Risk | Mitigation |
| --- | --- |
| Moving to 60 Hz unsettles the netcode that took Sessions 6 to 50 to get right (input slots, clock sync, interpolation, the rate limit of 25 inputs a second, the jump's "ten ticks"). | It is step 1's first job, behind the lag lab, before any feel work. The netcode constants are rewritten in ticks of the new rate, not guessed. |
| Prediction disagrees more with the slice's richer hero (hitstop, buffered presses, lunges toward a soft target that is interpolated in the past). | The slice already predicted these against snapshots and reported no corrections at 60 ms. Hearthgate's lab measures corrections and snaps per minute at every step; any new snap has to be explained or fixed before the gate. |
| Bandwidth at 8 players and 30 enemies. | Colyseus sends deltas, not the slice's 5.6 KB whole states. Measure in the stress harness (`STRESS_BOTS=8`) at step 4. |
| The feel drifts in translation (seconds to ms, the slice's collision to Hearthgate's walls). | Copy, don't rewrite. Hold the step 2 gate side by side at 0.25×. A determinism test replays the same commands through server and client copies. |
| Keyboard-only and touch-later (rules 4 and 5) get lost, since the slice is mouse-first. | Binding tables per device from step 1. Every new screen gets a gamepad and keyboard path before it merges. |
| The look question reopens decisions Michael made on 14 Oct, so the KayKit work is thrown away. | Ask once (question 8), early. If the answer is A, the KayKit removal is one commit in step 2. |
| Frame time on integrated graphics: the slice's retro pass was about 3 ms a frame but was never measured on a laptop GPU. | The critic's lab pages report frame time. Hearthgate's design doc wants no post-processing on the mobile tier, so the pass needs an off switch. |
| Scope: the slice has things Hearthgate's later phases own (drops, saves, the equip screen). | Question 7 holds drops to Phase 3. Steps 6a and 6b use a browser save checked by the server until Phase 2. |
| Talent and champion points widen the gap between veterans and new friends (pillar 1). | One overall ceiling on passive perks, tuned live; step 6b's gate is played with a mixed-level party. |

## 6. What the first step would change

With Michael's answers 1A, 2A, 3A and 10A.

- **Docs:** CLAUDE.md's rule 2 wording and its netcode section (60 Hz, 30 patches a second); the backlog's Phase 1 gets the seven steps; `decisions.md` gets these answers; a devlog entry.
- **`shared/`:** a new `tuning.ts` (the slice's file, minus the run and debug cheats); `TICK_RATE` 60 and the netcode constants re-expressed for it; the slice's movement and dodge from `player.ts` behind `applyInput`'s signature; `geometry.ts`; tests for movement, dodge and jump, and a determinism replay.
- **`server/`:** `SimRoom` steps at 60 Hz and patches every second tick; the input rate limit is raised to match; a dev and host-only `tune` message.
- **`client/`:** Three.js 0.186 and lil-gui; `client/src/input/` (the slice's action layer with Hearthgate's keys); the slice's `OrbitCamera` with arrow-key turning; the debug panel (backtick).
- **Untouched:** combat, enemies, levels, the village, the portal, the hand-off and the art. Today's figures keep drawing the new movement.
- **Branch:** `auto/local-combat-foundation`, one PR for Michael to approve, after `npm run check`, `npm run test:net` and a hosted lab run.
