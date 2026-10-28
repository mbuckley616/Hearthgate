# The combat slice, whole, on Hearthgate's server: the plan

Written 27 Oct 2026 by a local session, after Michael played step 1 of the earlier port on the hosted build: "It feels okay but clearly not the full combat slice ported over ... I fear we're going to end up with a watered down version of the combat slice." He chose to move the slice over whole instead (`decisions.md`, 27 Oct). This plan **replaces** `docs/combat-port-plan.md`, which is kept for its history and for section 3a (progression), still current.

The slice is the private repo `mbuckley616/combat-slice` (`main`, 363b726), with its working copy on Michael's desktop at `C:\Users\mbuck\OneDrive\Documents\GitHub\combat-slice`. Read its `docs/handoff.md` and `CLAUDE.md` first.

## The idea

The slice already splits the fight from everything else, and that split is what makes a whole move possible:

- The fight is one pure function, `stepSim(state, commands, dt)` (`src/sim/world.ts`), over plain JSON state, with no Three.js, DOM or wall clock in it (`src/sim/`, `src/config/tuning.ts`, `src/level/`).
- `HostSession` (`src/game/HostSession.ts`) runs that function for everyone, takes each player's numbered inputs and sends the whole state 30 times a second. In the slice it runs in the host player's browser.
- `ClientSession` (`src/game/ClientSession.ts`) is how a joiner plays: it predicts its own hero with the slice's `stepPlayer`, replays the inputs the host has not applied yet, and eases any difference out.
- Everything you see and hear (`src/render/`, `src/camera/`, `src/ui/`, `src/audio/`) only reads what a session gives it.

So: **copy the slice as it is, and change one thing: `HostSession` runs on Hearthgate's server instead of in a browser.** Every player, the one who would have hosted included, plays through `ClientSession`, as a joiner does in the slice today. The slice's relay (`server/relay.ts`, `src/net/RelayClient.ts`) is replaced by a Colyseus room. Nothing in the fight, the look or the feel is rewritten.

Then Hearthgate's own game is rebuilt on top of the slice, in the slice's code and look: the village, the portal, the generated dungeons, progression to level 50 and champion points.

## What Hearthgate keeps

| Kept | Why |
| --- | --- |
| The repo, `CLAUDE.md`'s rules, the design doc, `decisions.md`, the backlog and devlog, the cloud team, the control room and Slack | The project and its way of working. The rules hold: the server is the only truth (now the slice's `HostSession` on the server), the sim stays deterministic, keyboard-only works, nothing blocks touch. |
| Render hosting (`render.yaml`), the server package, Colyseus matchmaking and rooms | Where the fight runs. Colyseus carries the slice's messages; its schema state is no longer used (see below). |
| The 60 Hz pump in `SimRoom` (locked to wall time, catching up through stalls) and the input rate limit | Step 1's server work; the slice's host loop moves onto it. |
| The room hand-off (`SimRoom.handOffParty`, `Net.handoff`'s pattern) and `filterBy(["level"])` | How the party moves from the village into a dungeon and back. Rebuilt for the new rooms in step T3. |
| The tuning panel's path through the server (`tune` message, applied and rebroadcast) | The slice's panel applies edits locally; with the fight on the server, edits must go through it, as step 1 already does. |
| The lag lab (`tests/lab/`), the bot harness idea, Playwright and CI | How every step is measured. The harness is rewritten to speak the slice's messages. |
| The design: the village you own, the portal into dungeons, runs of 3 to 5 generated floors with rest rooms, the generator answers (`decisions.md`), the economy | What the game is. |
| `shared/src/gear.ts` (The Old Gates' tiers and materials) | Kept on the shelf for Phase 3's tier caps; the slice's gear runs the game until then. |
| `shared/src/clock.ts` and `interp.ts` (clock sync, adaptive delay, projection) | Kept on the shelf. The slice's own netcode goes first; these return only where the lab's numbers ask for them (T2). |

## What goes

| Goes | Replaced by |
| --- | --- |
| `shared/src/sim.ts` (Hearthgate's combat, enemies, abilities, guard and posture, downs, encounters), `states.ts`, `feedback.ts`, `inputs.ts`, `camera.ts`, `geometry.ts`, step 1's `tuning.ts`, and their ~230 unit tests | The slice's `src/sim/`, `src/config/tuning.ts` and `src/level/`, with new tests (below). |
| The client: `render.ts`, `figures.ts`, `models.ts`, `dungeon.ts`, `net.ts`, `hud.ts`, `join.ts`, `sound.ts`, `orbit.ts`, `debug.ts`, `input/`, the art tools (`turnaround`, `tavern-test`) | The slice's `src/game/`, `render/`, `camera/`, `ui/`, `audio/`, `input/`, `debug/`, its theme and title screen. |
| The KayKit packs (18 MB) and the art spikes' images | The slice's home-made look (decision 8A). |
| The Colyseus schema (`DungeonState.ts`) and patch broadcasting | The slice's snapshot message (its whole state as JSON, 30 a second, with acks and events). |
| The Goblin Warrens, the yard, the field and the cellar | The slice's antechamber and arena first; generated floors in T4. |
| Hearthgate's own fight rules: Cleave, Execute, Arrow rain, the Revive Draught, the bleed-out downs, the Shieldbearer, Charger and Pack Leader | The slice's chains, abilities, revives and enemies. Hearthgate's three enemy kinds can return later, built in the slice's framework, if Michael wants them. |
| Step 1's ports of the slice's movement, camera and keys | The slice's originals. |

Step 1 was not wasted: the 60 Hz server, the stall fixes the lab found, the tuning path through the server and the lessons about a 60 Hz link carry over. Its copies of the slice's code are replaced by the code itself.

## The order

Each step ends in Michael's playtest on the hosted build and does not start before the previous gate passes.

**T1. The transplant: the slice runs on Hearthgate's server.**
- The slice's engine-free code (`src/sim/`, `src/config/tuning.ts`, `src/level/`) goes into `shared/` as it is; everything else into `client/`. Hearthgate's old sim and client go in the same change, so nothing half-old is left.
- The server gets one room that is the slice's `HostSession`: it steps `stepSim` on the 60 Hz pump, takes `hello`, `input` and `loadout` messages, and sends the slice's `snap` 30 times a second. The slice's run flow comes with it (antechamber, the gate, the waves, the Warden), since that is what the gate compares.
- The client is the slice's `Game` with `ClientSession` for every player, its relay replaced by the Colyseus room. The title screen's Play and Invite join or share a room. Solo is a room of one.
- The debug panel's edits go through the server. The slice's cheat buttons (skip a wave, spawn, XP, god mode) go through it too, behind a dev flag.
- The slice's progression and loot come as they are, saved in the browser (its `Profile`), and the server takes each player's loadout when they join, as the slice's host did. A cheat could edit that save; that is accepted until Phase 2 brings real saves and Phase 3 the item ledger (rule 3).
- **Tests:** a parity test that feeds the same commands through the slice's own `stepSim` (from the slice repo) and Hearthgate's copy and checks the states match exactly; unit tests for the server room's input queue and acks; the bot harness and lab speaking the new messages; a Playwright smoke test of solo, two players and the run's gate.
- Toolchain: Three.js goes to 0.186 (client only). The slice is written for TypeScript 7 and Vite 8, Hearthgate uses 5.7 and 6; whichever way is less work is taken here, since Colyseus schema decorators (the reason to stay on 5.x) are no longer used.
- `CLAUDE.md`'s netcode and code-style sections are rewritten for the new shape when T1 lands.
- *Gate:* side by side with the slice on Michael's desktop, solo on the hosted build feels the same: movement, the chains at 0.25×, hit feel, the look, the sound. Then two players on the hosted build through a whole run with no snap. Lab numbers at 0, 50 and 150 ms filed.

**T2. Netcode from the lab.** The slice's netcode was tested only on one machine with up to 60 ms of fake lag. The lab on the hosted build decides what comes next: deltas or a lower snapshot rate if bandwidth bites (a snapshot is about 5.6 KB, roughly 170 KB/s a player), and Hearthgate's clock sync, adaptive interpolation delay or input slots where corrections or snaps show up. Nothing changes here without a number asking for it.
*Gate:* the lab is no worse than Hearthgate's last numbers (8 / 3 / 1 corrections a minute over 10 cm, no snaps; Michael, 27 Oct, decisions.md: the small eases of a swing stay), and a remote friend or the lab against the hosted build at 150 ms plays a run without a visible snap.

**T3. The village and the portal.** The village as a level in the slice's code, graded warm and bright in its pipeline, with its four buildings, villagers who answer F, and the portal shrine. Walking onto the portal together hands the party to a dungeon room (Hearthgate's hand-off), and the end of a run brings them back. The slice's antechamber and arena become the first dungeon.
*Gate:* village to dungeon and back with two players on the hosted build, nobody stranded, and the village looks like it belongs to the slice.

**T4. The dungeon generator** (`decisions.md`, 27 Oct). A kit of pieces written in code (hallway, corner, junction, staircase, small, medium and large rooms, open arenas like the slice's, rest room, boss room) with doorway sockets, joined by a seeded generator on the server into floors of 10 to 50 pieces, more with tier and level, branching and looping, never one corridor. Staircases climb or drop to rooms at other heights on the slice's ramps and walkable surfaces. Every room is visible; a minimap sits in a HUD corner. Enemies are placed per room from a budget; a run is 3 to 5 floors with a rest room between, where the party banks loot and chooses to go deeper or go home.
*Gate:* five floors from five seeds, small and large, each a different shape with a climb or drop, none broken, readable, the minimap showing where you are.
**T4b. A dungeon editor:** a page where Michael lays out the kit's pieces by hand and saves a dungeon the portal can offer.

**T5. Party rules and the Phase 1 gate.** Michael's answers (decisions.md, 27 Oct, T5):
- **One hero, any weapon.** The weapon in hand sets the style (sword, bow, staff), and its abilities and levels are that weapon's, as the slice's style levels already are. The hero keeps one look.
- **A bag and a body.** A bag with a fixed number of free spaces, as RuneScape's, and gear worn on a body silhouette (the slice's weapon and body slots fold in). Armour leans melee, ranged or magic; worn with a weapon of another kind it makes the hero less effective, never forbidden. Changing weapon from the bag is allowed anywhere, so the gear, not a rule, is what keeps a role in a dungeon. Items stay in the browser's save until Phase 3's ledger (rule 3, the accepted risk above); drops stay the slice's.
- **Hearthgate's downs (5A):** crawl, 30 s bleed-out, out until the room is cleared, hold F for 3 s to revive, a Revive Draught per floor.
- **A party of 4** for Phase 1, with the slice's scaling; 8 waits for Phase 2's measurement. Hirelings later (9A).
- **Mixed levels:** nothing extra; the gate shows whether it is enough.
Order:
- **T5a, the downs** (built 27 Oct): behind `coop.bleedOut`; the parity test plays the slice's downs, so it still proves every other rule is the slice's.
- **T5b, the bag and the body** (decisions.md, 27 Oct, the bag and the body): an item catalogue in code, each item a slot, a kind (melee, ranged, magic, or none for capes, necks and rings), a material tier and its stats. A 28-space bag and RuneScape's ten body slots (head, cape, neck, body, legs, hands, feet, ring, shield, weapon) in the browser's save, replacing the slice's four slots; the weapon in hand sets the style (1/2/3 take the best weapon of that kind from the bag). Each worn armour piece of another kind than the weapon costs 5% damage. Bows and staves take both hands, so a shield is slung on the back and gives nothing while one is held. Drops roll from the catalogue behind `gear.catalogue`, which the parity test keeps off (the slice's loot is rolled in the fight). An equip screen with a body silhouette, keyboard and pad first. A new hero starts with a plain weapon of each kind and no armour.
- **T5c, the look**: every piece drawn on the hero as itself (an iron helm as an iron helm, a black platebody as black plate), from the piece's shape and its material, on the slice's code-drawn figure. Built 27 Oct (`client/src/render/wardrobe.ts`; the look travels in the loadout and the snapshot).
- Then the Phase 1 gate.
*Gate:* **the Phase 1 gate** (design doc), filed in `playtest-notes.md`: a mixed-level party clears a generated floor and a combo bonus is visible.

**T6. Progression to 50, then champion points** (`combat-port-plan.md` section 3a, decision 6): style levels to 50 with a talent point a level, the milestone rows, then three constellations of champion points under one ceiling.
*Gate:* you want to start a second run right away; with a character past 50, you can plan a build and feel it, and a lower-level friend still pulls their weight.
*Steps* (Michael, 27 Oct): **T6a** levels to 50 with a milestone row every ten levels (built); **T6b** champion points' passive perks under a +15% damage and +15% health ceiling, shared across characters (built); **T6c** the four slotted perks.

The slice already brings its look, sound and music, so the old port's "look" and "music" steps are gone.

## Who runs it

T1 to T3 in local sessions with Michael (the gates are his eye and the slice's desktop copy is the side-by-side reference). From T4, the deep-work routine can take steps from cards, reading the slice from its repo; the builder returns once there are contained jobs (more kit pieces, enemy variants, the minimap's polish). FREEZE issue #63 stays open until T1 lands, since T1 replaces the shared sim outright.

## Risks

| Risk | Answer |
| --- | --- |
| The slice's netcode is untested over a real link and with more than two players. | T2 is a step of its own, measured by the lab against the hosted build before anything is built on it. Hearthgate's netcode pieces are on the shelf, ready. |
| Whole-state snapshots: about 170 KB/s a player mid-wave, more at 8 players and bigger floors. | Measured in T1's lab run. Deltas (only what changed) are the first fix; the state is plain data, so a diff is straightforward. |
| The transplant is one big change. | It is mostly copying, the parity test proves the fight is the slice's to the bit, and the gate is the slice side by side. No old system survives beside a new one. |
| Progression and loot live in each player's browser until Phase 2 and 3, so they can be edited. | Accepted for Phase 1 among friends; the item ledger (rule 3) is still the gate for trading. |
| The slice was built for 2 to 4 players; Hearthgate's design says 4 to 8. | T5 settles scaling with the real fight; the server's snapshot cost at 8 is measured in T2. |
| Hearthgate's tests mostly go with its sim. | T1 replaces them: the parity test, the room tests, the lab and the browser smoke tests; each later step adds its own. |
