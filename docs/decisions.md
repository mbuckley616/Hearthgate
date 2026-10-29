# Decisions

Questions for Michael and his answers. Nothing is a spec without a `Michael:` line.
Agents write questions under **Pending** with lettered options and a recommendation; the
producer carries them to Michael (Slack #hearthgate or the control room) and writes the
answer here. Answered entries override the backlog.

## Pending

## Answered

### 2026-10-28: After playing D1: healing, aiming, dropping (Claude (local))
Michael played the denser fights ("plays pretty well"; leave the spawns until bigger rooms and harder dungeons come) and sent eight notes, filed as backlog items D7 to D12. Three needed a rule, so they were asked in chat as three cards. Recommendations were: rest rooms heal and potions are found; ranged weapons aim over the shoulder; a dropped item lands on the floor for its owner.
Michael (2026-10-28, in chat): all three as recommended.
- **No heal after each room.** A rest room heals to full; D4's smashables sometimes drop a health potion, drunk on a key. Revives stay as they are. This answers D4's potion question: a health potion.
- **Free aim, over the shoulder.** With a bow, staff, crossbow or wand out, the hero faces where the camera looks and shots fly through the reticle, up and down too. Lock-on keeps today's aim at the target's chest.
- **Dropping puts the item on the floor,** a pickup only its owner sees and can take back, gone when they leave the floor or village. Handing an item to a friend is a trade and waits for Phase 3's item ledger.

Taken from the same notes without a question: the doors stay open (no locking a party in), rooms big enough for four (into D2), a shorter dodge recovery that shortens further with levels and perks, a downed hero who lies still, a "You died" / "Your party was defeated" card with a button home, and a reticle shaped by the weapon.

### 2026-10-28: After the feel-pass playtest: what a wipe costs, finds worn mid-run, what comes next (Claude (local))
Michael played the feel pass ("a ton of fun") and sent a quality-of-life list (built the same day on `auto/local-qol`: Tab for the hero screen, item icons, levels on the Talents tab only, a level line over the health bar, the hero drawn on the bag tab, wheel zoom) and a list of ideas. Three of the ideas change rules already built, so they were asked in chat as three cards. Recommendations were: the bag at risk with a safe pocket; a find worn mid-run stays at risk until banked; the dungeon's feel before the village.
Michael (2026-10-28, in chat): all three as recommended.
- **What a wipe costs: the bag, extraction-style (as Arc Raiders).** On a run everything in the bag is at risk until it is stored in the village stash. Worn gear is never lost. A small safe pocket (3 spaces to start, growing with the Storehouse's tier) keeps what is in it whatever happens. This replaces P1's rule (only finds since the last bank are lost) and makes the Storehouse's stash part of the loop.
- **A find can be worn straight away,** outside a fight, but it stays marked as carried, and a wipe takes it, until a rest room or the ring home banks it. Wearing a find is never a way round the risk.
- **Next: the dungeon's feel, before the village.** Denser enemies, bigger rooms, crates and barrels that smash for lumber, stone and now and then a potion, and the two rules above. Then the village save and the stash, then the henchmen.

Taken from the same list as backlog items, not yet asked: knocking small enemies flying on death, with a flying corpse hurting what it hits (a bigger launch as a perk, perhaps the blunt weapons' own); a double jump unlocked at a level; an air dodge; a jump that counts as a dodge, as in Elden Ring; rooms that need jumping (a chasm across a hall, lava with safe stones); many more enemy kinds, in themes and roles.

### 2026-10-28: Combat depth: builds, strings, Flow, weapons (Claude (local))
Michael asked for a design conversation about combat: combos that will go stale after an hour or two, wanting their effects to evolve (more reach, extra swords on a spin, orbs that do different things), a rhythm with a reward for sustained chains, damage types, heavy attacks mixed with light, specializations per style (tank, fighter, rogue; sorcerer, warlock, necromancer, druid; ranger, scout, assassin) whose choices colour the attacks, more weapon families per style, and an off-hand. A local session drew it up as an interactive page (the control room's sibling artifact "Hearthgate Combat Builds", https://claude.ai/artifact/1FRPyQGdtA9URnN8D8WaLR) and Michael marked every piece Keep, Unsure or Cut (43 marks, read back from its `reactions` store).
Michael (2026-10-28, on the page): **Keep** on everything below except where noted.
- **Damage types: both.** The weapon sets the shape (slash, pierce, arcane: armour, poise, the combat triangle); the specialization sets the element (fire, frost, earth, air, shadow, holy, nature, steel), which colours every attack and leaves a state. Enemies are weak to one element and resist one.
- **Specializations:** one of three per style, required once that style reaches level 10, changed freely in the village or a rest room (coin later). Melee: Paladin (holy), Spellblade (see below), Rogue (shadow or nature). Ranged: Ranger (nature or earth), Scout (air), Assassin (shadow or nature). Magic: Sorcerer (Fire, Frost, Earth or Air), Warlock (shadow), Druid (nature or earth). Each turns its style's two abilities into its own versions, has a signature mechanic, and a tree: a choice of two at 20, 30 and 40 and a Crescendo capstone at 50.
- **T6a's milestone rows fold into the specialization trees.** Weight, Finisher, Riposte, Second wind and Mastery become options inside the trees where they fit.
- **Light and heavy strings.** Hold attack for a heavy, two charge levels, the same on mouse, keyboard and pad. Michael's note: "I do like the current light combo. I wouldn't want to break that, just add more variants onto the combo chain depending on the attack timing (Heavy followed by two light is a combo, Heavy-Heavy-Heavy is a combo, etc.)" So today's five-hit light chain stays exactly as it is, and heavies may open, carry and end a string.
- **Flow:** a personal rhythm meter (on-beat hits, perfect parries and dodges, varied strings fill it; a hit taken costs a tier), three tiers and a Crescendo; **Harmony** when two players are at Flow III together turns on the distinct-player bonus for combo payoffs. Judged on the server by the tick an input was made for.
- **Ten states and their payoffs**, Shatter, Skewer and Detonate being the first three; **combo mastery** I to V by payoffs landed, rank V shaped by the payer's specialization.
- **Weapon families**, any family usable with any specialization of its style: melee sword, warhammer, mace, axe, daggers; ranged shortbow, crossbow, longbow, throwing knives; magic staff, wand, sceptre. One-handed families take an off-hand; two-handed ones take none and hit about 20% harder.
- **The off-hand slot** replaces the shield slot and brings the third ability the design doc always had: shield (bash), tome (a spell), focus orb, parrying dagger.
- **Necromancer** as a fourth magic specialization, after the henchmen exist (its summons are henchmen with a short life). Michael's note: "necromancer progression should allow them to summon stronger henchmen as they advance."

Four marks pulled against others; asked in chat the same day, Michael chose:
- **Weapons change only in the inventory** (not the recommended hotbar). One weapon set (a weapon and its off-hand) per outing, chosen on the hero screen outside a fight; no swapping mid-fight. 1, 2 and 3 become the three ability keys. Cross-style combos then come from a friend or a henchman, which is pillar 1's point. The slice's mid-fight swap goes behind a switch the parity test turns back on.
- **Ranged off-hands, RuneScape's way** (recommended): a second hand crossbow or knife (dual-wielding, as RS3) or a buckler (a light ranged shield, as OSRS). Arrow types (fire, frost, barbed) go in a new ammo slot, RuneScape's eleventh, not the off-hand. Michael had marked the quiver off-hand Unsure: "doesn't really make sense as an offhand."
- **Imbues are runes socketed in the weapon** (recommended): 0 to 2 sockets by rarity, runes that drop or are crafted, each saying what it changes (the light finisher, or every heavy). The specialization tree's 20 and 40 give other choices instead of sockets. Michael had marked the chain sockets Unsure: "not sure where the imbue sockets go exactly."
- **The feel pass goes in Phase 2, after P1** (recommended): heavies and strings, Flow, one weapon set per outing, the off-hand slot and the first three new families (warhammer, crossbow, wand), before the henchmen, so henchmen learn the new moves once. The builds pass (specializations, elements, runes, states and mastery, the rest of the roster, the Necromancer) comes after.

Taken as read from the marks (raised in chat, not overruled):
- **Specialization per style, not per weapon:** with families, a Paladin may hold a sword or a mace; levels are already per style.
- **The Fighter becomes the Spellblade**, choosing Fire, Frost, Earth or Air as the Sorcerer does, from Michael's note on elements: "I also like these elements possibly being applied to melee attacks as well, if there is a 'magical' tree or like a 'spellsword' specialization."

### 2026-10-28: Phase 2's shape (Claude (local))
Asked in chat as four cards when planning Phase 2 from the design doc. Recommendations were: keep saves in the browser until Phase 3's item ledger brings the server database; henchmen only (Tavern tiers 1 to 3, fixed kits); the four starting buildings at tiers 1 to 4, with new buildings left for Phase 3's materials; and a portal board with tiers and two modifiers.
Michael (2026-10-28, in chat): all four as recommended.
- **Saves: the browser until Phase 3.** The village joins the hero in the browser's save; the host's browser sends it and the server checks it, as with the loadout. The server database arrives with the ledger. It is free, where a hosted database is about $7 a month.
- **Hirelings: henchmen only.** Three with fixed kits (sword, bow, staff), run by the server, topping a party up to four, clearly worse than a friend. Heroes and Companions come later.
- **Village: the four starting buildings, tiers 1 to 4.** Runs bring home lumber, stone and coin. Coin also pays champion respecs. The Forge, Apothecary and the rest wait for Phase 3's materials.
- **Portal: tiers plus two modifiers.** A board of three portals, each with a tier (1 to 5, capped by the shrine) and sometimes Cursed (no revives, double loot) or Haunted (enemies get up once). The other modifiers need states the slice lacks.

### 2026-10-28: T6c: the slotted perks (Claude (local))
Asked in chat as three cards before building T6c (plan 3a gave four slots, chosen in the village or a rest room, and three example perks). Recommendations were: a slotted perk opens by points spent in its constellation, as in ESO, at 5, 10 and 15; nine perks, three per constellation, drawn from the plan's examples and the fight's existing mechanics; and slots changed only in the village and rest rooms, enforced by the server.
Michael (2026-10-28, in chat): all three as recommended.
- **Unlock: points in the constellation.** Its three slotted perks open at 5, 10 and 15 points spent there (`champion.slotUnlockStep`). No extra cost.
- **The nine:**
  - Offence: Wide shatter (Shatter splashes twice as far), Teamwork (a combo an ally set up hits 20% harder), Deep wounds (bleeds last twice as long).
  - Defence: Counterstep (a parry gives back a dodge charge), Bulwark (blocked hits chip half as much), Lifeline (a friend you revive gets up with twice the health).
  - Utility: Long fuse (combos you set up stay open 50% longer), Momentum (a combo payoff takes 2 s off your ability cooldowns), Magnet (pick up drops from twice as far).
- **Changing them:** in the village, a rest room the party has reached, and the arena's antechamber. Elsewhere the server keeps the hero's four.

### 2026-10-27: T6: champion points' two details, and how to build it (Claude (local))
Asked in chat as four cards before building T6 (plan section 3a left two details for this step). Recommendations were: a ceiling of about +15% damage and +15% health on all passive perks together, and no tier cap on perks; champion points shared across a player's characters, as in ESO; resetting them free until Phase 2 brings coin; and three steps, each a PR to try.
Michael (2026-10-27, in chat): all four as recommended.
- **Ceiling: +15% damage and +15% health** from all passive perks together. One rule; a portal's tier caps gear only.
- **Shared** across a player's characters. A browser has one hero today, so this changes nothing until a second character exists; the points sit beside the hero in the save, not inside it.
- **Respec: free for now**, between runs. In Phase 2 it costs coin at the village shrine, as planned.
- **Three steps:** T6a, levels to 50 with milestone rows on the talent boards; T6b, champion points' passive perks; T6c, the four slotted perks.

### 2026-10-27: The Phase 1 gate without a second player (Claude (local))
The gate asks for a mixed-level party to clear a floor with the combo bonus visible. Michael has nobody to play it with. Offered: a machine stand-in (a mixed-level party of bots on the hosted build, the way CLAUDE.md lets the lag lab stand in for a second person), recommended; or waive the party half outright.
Michael (2026-10-27, in chat): "Can we bypass that and just assume it works?", then, offered the two: **"Play it with bots for me please!"** The gate is met by `npm run gate:party` against the hosted build: four bots of levels 10, 4, 1 and 1 in gear of their tiers take the village's ring and clear floor 1 to its rest room with no cheats; the server's combo events (the Shatter, Skewer and Detonate callouts every player's HUD draws) are counted, with the downs and revives. Filed in `playtest-notes.md` with the numbers in place of feelings.

Michael (2026-10-27, in chat), shown the three hosted runs: **"I'm good to close it and move on!"** Phase 1 is closed on the stand-in. Phase 2 (village and loop) is current, and T6 (progression to 50) carries over as its first item. Going down and reviving were not exercised by the runs (nobody went down); Michael closed the phase without a harder floor.

### 2026-10-27: T5: the bag and the body (Claude (local))
Asked in chat as four cards before building the bag and body: the bag's size (28 as RuneScape, recommended; 20; 40), the body's slots (6: head, body, legs, hands, feet and the weapon, recommended; 4; RuneScape's full set), the cost of armour of another kind than the weapon (per piece, -5% damage each, recommended; a flat -25%; -10% a piece), and the hero's look (follows the armour, each piece drawn as the slice's figure for its kind, recommended; one figure for all, tinted).
Michael (2026-10-27, in chat):
- **Bag: 28 spaces**, as RuneScape. Worn gear takes none.
- **Body: RuneScape's full set**: head, cape, neck, body, legs, hands, feet, ring, shield, and the weapon.
- **Mismatch: per piece**, -5% damage for each worn armour piece of another kind than the weapon in hand (a full wrong set, -25%).
- **Look: every piece its own.** "Every armor piece should be custom & show up uniquely on the hero. An Iron Helm and a Black Platebody should show exactly as that on their hero model when the hero has them equipped."
Planned as two steps (slice-transplant-plan.md, T5b and T5c): an item catalogue, the bag, the ten slots and the equip screen first; then each piece drawn on the hero.

### 2026-10-27: T5: party rules (Claude (local))
Asked in chat as four cards, with a follow-up on the first. Recommendations were: one hero with three weapons (4B), Hearthgate's downs (5A), a party of 4 for Phase 1, nothing extra for mixed levels. The follow-up asked how to lock a role in a dungeon: pick at the ring and change only in rest rooms (recommended), two weapons a run, or slow swaps with a cooldown.
Michael (2026-10-27, in chat):
- **Heroes: one hero, any weapon.** "A player should be able to use any weapon, but they level up their abilities/skills depending on the weapon they use. So, closer to One Hero, 3 Weapons." Roles should be "somewhat 'locked' when in a dungeon", so nobody flips role constantly. **The lock is gear, not a rule:** "We should have a bag / inventory system, similar to Runescape. You have free inventory space, and can equip/unequip gear to the body silhouette. Wearing melee gear does not prohibit you from using ranged or magic weapons, but you will be less effective." Supersedes 4B's "swaps them live (1/2/3)" as the whole answer: a weapon can still be changed in a dungeon (from the bag), and the armour worn is what makes a role.
- **Downs: Hearthgate's (5A).** Crawl, 30 s bleed-out, out until the room is cleared, hold F (or A) for 3 s to revive, a Revive Draught per floor (the 4 Oct stand-in counter).
- **Party size: 4 for Phase 1**, with today's scaling (+60% enemy health and more enemies per extra player); 8 waits until Phase 2 measures the netcode cost.
- **Mixed levels: nothing extra yet.** Floors already grow with the party's average level; the gate shows whether a lower-level friend keeps up before T6.
Left for the build, to ask then: the bag's size (RuneScape's is 28), the body's slots, and how much less effective mismatched armour makes you (a number in tuning).

### 2026-10-27: T4b: where hand-built dungeons are kept, and how the portal offers them (Claude (local))
Asked in chat before building T4b. Where saved dungeons live: A. in the browser, playable at once, with an Export file that ships to everyone once committed to the repo (survives server restarts until Phase 2's database); B. on the server, for everyone at once, but lost on every redeploy of the free Render server. How the village's portal offers one: A. Keeper Wren picks where the one ring leads; B. a second ring beside the shrine.
Michael (2026-10-27, in chat): **A and A.** Built as: the editor saves to the browser and exports a file; files in `shared/src/level/dungeons/` ship with the game (The Old Cellar is the first). F to Keeper Wren says where the ring opens; F again while she speaks turns it to the next (a new generated dungeon, then the hand-built ones this browser can play); the server checks the layout, and the ring's label shows the whole party where it leads.

### 2026-10-27: T4: must a floor be cleared before the way down opens? (Claude (local))
Built as: the rest room's two rings are open as soon as the party reaches it, so a party can run past fight rooms; only the rooms they walk into shut on them. The 4 Oct answer for the old Warrens floor was "clear every room, then the stairs open".
A. Keep it: the rings are open on arrival; fights are the rooms you walk into. **Recommended** for now: a 40-piece floor has a dozen fight rooms, and clearing all of them on every one of five floors makes a run long.
B. The deeper ring opens only once every fight room on the floor is cleared (the home ring stays open).
C. In between: the deeper ring opens once the rooms on the way (the shortest path from the entrance) are cleared.
Michael (2026-10-27, in chat): **A, open on arrival.** "You should be able to skip rooms and rush the dungeon. You don't have to clear everything!" Built that way in T4 (PR #71).

### 2026-10-27: T3: the way home and the village's light (Claude (local))
Asked in chat before building T3: how does the party get back to the village after a run (A: the end screen's F takes everyone home; B: a portal opens in the arena and the party stands in it together), and what time of day is the village (golden afternoon, bright midday, or dusk with lanterns; golden afternoon recommended).
Michael (2026-10-27, in chat): **a portal in the arena**, and **golden afternoon**. Built as: a ring opens in the antechamber when a run is won or lost, and everyone standing inside it for 2 s goes home to the village they came from (downed heroes get up a few seconds after a run ends, so a wipe can walk out too); the village is lit by tuning.villageLook, a low warm sun from the west under a gold-to-blue sky.

### 2026-10-27: T1 and T2 closed on feel; lag testing waits, content first (Claude (local))
After playing the slice on the hosted build, Michael, in chat: **"Feels good. I'm honestly not concerned about testing for lag right now. I'd rather flesh out the content / the game first. Can we move on to what's next?"** (2026-10-27).
Recorded as: the T1 gate passes on his solo play; its two-player run and T2's open lab items (the 150 ms row above the gate, the lossy link's holds) wait until he wants lag tested again. T2 (PR #68) ships as it is once approved. The plan moves to T3, the village and the portal.

### 2026-10-27: T2: the small corrections in a fight (Claude (local))
The lab on T1 (local, 60 s a row) counts 59 / 71 / 93 corrections a minute at 0 / 50 / 150 ms, against Hearthgate's old 8 / 3 / 1. None of them snaps. Each is a few centimetres to about 20 cm, eased out over 120 ms (`coop.correctionBlendMs`). They are not network trouble: with no enemies there are none, and enemies that never swing change nothing. They come from your own swings. A melee swing's lunge stretches to reach its soft target, and the soft target turns you toward it. Your browser measures both against the enemy where the last snapshot had it, and the server measures them a few ticks later, when the enemy has moved. In the slice this only happened to joiners; now solo is a joiner too. The T1 gate is where you will feel whether they matter.
A. Leave them. They are the slice's own joiner feel; judge them at the T1 gate side by side. T2's gate then reads "no network snaps, and corrections over 10 cm no worse than 8 / 3 / 1 a minute" instead of every correction over 2 cm, and the lab reports both. If you feel them at the gate, this comes back as B. _(recommended: nothing changes in the fight, and the parity test stays exact)_
B. Lag-compensate the swing. Your browser sends the soft target it chose and where it saw it, and the server takes your lunge and turn from that, within limits. Corrections in a fight drop toward zero. But the fight is no longer the slice's to the bit (the parity hashes are re-recorded on purpose), and on a slow link a lunge can reach an enemy that has already stepped away.
C. Let the server decide the lunge and the turn alone, and have your browser not predict them; you see them a round trip late. Fewer corrections, but swings feel less immediate. Not recommended.

Michael: **A** (2026-10-27, in chat with the local session, after playing T1 solo on the hosted build: "Gameplay looks good"). The corrections stay as the slice's own feel. T2's gate becomes: no network snaps, and corrections over 10 cm no worse than 8 / 3 / 1 a minute; the lab reports both counts. If they show at a later playtest, this comes back as B.

### 2026-10-27: Move the combat slice over whole, on the server (Claude (local))
Michael played step 1 of the port on the hosted build: "It feels okay but clearly not the full combat slice ported over. The combat is still like the original. And movement feels similar but with different animations and meshes it's hard to tell. ... I fear we're going to end up with a watered down version of the combat slice." Proposed in chat: the slice's fight is already one pure function (`stepSim`) with `HostSession` running it and `ClientSession` predicting for joiners, so copy the slice as it is and change one thing, `HostSession` running on Hearthgate's server, every player joining through `ClientSession`; keep Hearthgate's server, hosting, hand-off, lab, team and design; replace its sim, client, schema, levels and KayKit look.
Michael: **"Yes: move the slice over whole on the server."** (2026-10-27, in chat.) `docs/slice-transplant-plan.md` has the plan, what is kept and what goes; it replaces `docs/combat-port-plan.md` except that plan's section 3a (progression). Decisions 4B (one character, three weapons) and 5A (Hearthgate's downs) are reopened for step T5, with the slice's versions in play until then; 1A, 2A, 6, 7A, 8A, 9A and the 27 Oct generator answers stand.

### 2026-10-27: The port's direction after step 1: the slice's look first, the server, generated dungeons (Claude (local))
After step 1 Michael asked why Hearthgate still had its old look, and whether to restart from the combat slice instead, since he disliked the old look and feel. Asked in chat whether that meant only the look and feel or the game around the fights, and whether the fight should run on the host's browser instead of a server (less to maintain). The trade-off given: the design doc's economy (characters and items carried between villages, the seven-day trade board, offline visits, "duplication is impossible by construction") needs an always-on server either way, and a host that decides hits and drops can cheat loot into that economy; host-based only fits if trading is cut to trusted friends.
Michael (2026-10-27, in chat):
- **The server stays as designed.** The fight runs on the server; trading as the design doc has it.
- **The slice's look and gameplay feel replace Hearthgate's**: that is what he disliked. The look moves from the port's last step to step 2, all at once, with the KayKit packs and the old figures deleted.
- **The village and the portal into various dungeons stay.**
- **Dungeons are not single rooms or one long corridor:** "a dungeon builder / generator that makes unique dungeon configurations based on a set of pre built components (i.e. dungeon hallway, dungeon staircase, dungeon small room, dungeon medium room, etc.)", with open rooms like the slice's arena among them. Step 6 of the re-planned port.
`docs/combat-port-plan.md` section 4 has the new order.
Who runs the steps (asked the same day): pushing the slice to a private GitHub repo now, steps 2 and 3 in local sessions with Michael, the deep-work routine from step 4. Michael approved; the slice is `mbuckley616/combat-slice` (`main`, 363b726 when pushed), and the desktop folder stays the working copy.
Michael, on step 6's questions (2026-10-27, in chat):
- **Staircases** go up or down and connect to another room at a different height: "just to prevent a single dungeon from feeling flat." A staircase is a connector piece within the floor, not the way to the next floor.
- **Size:** a floor (Michael: "I guess AKA a Dungeon") is 10 to 50 distinct rooms and pieces, growing with the dungeon's difficulty and level. The design doc's run of 3 to 5 floors with a rest room between stands: each floor is one generated layout of 10 to 50 pieces (Michael, confirmed the same day: "Let's stick to that").
- **Unexplored rooms are not hidden.** A minimap is wanted instead.
- **Pieces are authored in code**, and a small editor where Michael can build a dungeon by hand "would be awesome."

### 2026-10-26: Bringing the combat slice into Hearthgate (Claude (local))
Michael's combat slice (a separate repo, M0 to M6 passed on 26 Oct) is the reference for Hearthgate's combat. `docs/combat-port-plan.md` has the plan, ten questions with the options as asked, and the porting order. In short: Hearthgate's server and netcode stay, and the slice's simulation, tuning file, debug panel, input layer, camera, views, effects and sound come across in seven steps, each with a playtest gate.
Michael: **1A 2A 3A 4B 5A 7A 8A 9A 10A** (2026-10-26, in chat), and his own answer to 6. Spelled out:
1. The server runs the slice's sim at 60 Hz and sends 30 patches a second; inputs are sent at 60 Hz and the lag lab re-baselines.
2. CLAUDE.md rule 2 becomes "time comes from the tick count; no wall clock in the sim", so the slice's `dt` steps and seconds come across as they are.
3. The port is Phase 1's remaining work, one **(Fable)** item per step, run in interactive local sessions on `auto/local-combat-<step>`. A `FREEZE:` issue is open while the shared sim is replaced. The Phase 1 gate is played at the end of step 5, on the ported combat.
4. One character of your own carries three weapons (sword, bow, staff) and swaps them live (1/2/3). The style follows the weapon, the slice's two abilities belong to each weapon, and there are no classes.
5. Hearthgate's downs stay (crawl, 30 s bleed-out, dead until the room clears, the Revive Draught), and the pickup becomes the slice's hold-to-revive: hold the interact key or A for 3 s.
6. The slice's progression as built (style levels from damage dealt, unlocks, talent boards with free respec), with style levels going to **50**, not 5, and a talent point every level. From level 50, champion points in the style of Elder Scrolls Online: three constellations (Offence, Defence, Utility) with ranked passive perks, slotted build-defining perks, small gains under one overall ceiling, working with gear's own perks. Michael: "it should be a way to slightly improve your character over time." Plan section 3a. Two details wait for step 6: points per character or shared across characters, and the ceiling's size.
7. No drops until the Phase 3 item ledger; the slice's gear slots and perks fold into `shared/src/gear.ts`, and the debug panel equips gear for testing.
8. The slice's look everywhere, home-made only: the pixel and CRT pipeline, the village graded warm and bright, the KayKit packs taken out. Supersedes the 14 Oct art answers below; the design doc's art section and the style guide are rewritten when step 7 lands.
9. Hirelings, when they come, are heroes driven by a server-side brain writing the same per-tick commands, counting as party members for attack tokens, revives and scaling.
10. The slice's controls (Ctrl dodge, Space jump, Shift sprint, left click attack, right click guard, Q/E abilities, 1/2/3 weapons, Tab lock-on, F interact), plus keyboard-only keys: J attack, L guard, arrows turn the camera.

### 2026-10-15: "Stuck after the portal": what did the HUD read? (the critic)
Your report (backlog, Found in play) is not reproduced: in three two-player runs today, both players arrived in the Warrens and could move, including with a key held through the hand-off. What I did see on this box: the Warrens draw at 2 to 5 frames a second here, the player moves in 1.2 m lurches at about a quarter of run speed, and the HUD's ping reads 0.8 to 1.6 s on a perfect link. When it happened to you, what did the top-right panel say: the ping, and "N unconfirmed"? Also, did the player move at all after a few seconds of holding a key, and was this the hosted build or `npm run dev`?
A. The ping read high (half a second or more), and the player crept or lurched: slow frames. The frame-budget proposal in proposals.md fixes it.
B. The ping looked normal, and nothing moved at all however long I held a key: a real hand-off bug. The critic tries again on the hosted build.
C. I don't remember. Look out for it at the gate playtest.

Michael: **B** — As soon as i spawned, the player model was at an angle, and I was completely unable to move. Everything otherwise looked normal. (2026-10-15)

### 2026-10-14: Jump, sprint and a separate dodge: how they play and which buttons (Fable, Session 44)
Your note asks for Space to jump, a sprint you can jump out of, and dodge on a button of its own. Today Space attacks (as does J), Shift or K dodges, and the gamepad's A dodges. Walls in the simulation are flat footprints with no height (the 3.2 m dungeon walls and the yard's "low wall" are only drawn tall or short), and a dodge makes you untouchable for its 220 ms. All three answers change the shared movement, so the server, the prediction and the replay change together. Three parts; answer like "1A 2A 3A".

**1. The jump.**
A. A hop for feel and getting around: about 0.6 m high and half a second in the air, carrying the speed you took off with (walk 2.9 m, sprint 4.4 m), a little steering. It clears nothing (walls block as now) and protects from nothing; no swing, dodge or block in the air. **Recommended:** it is the smallest change that feels like a jump, and B or C can follow a playtest.
B. As A, and it clears low cover: walls get a height, the low ones (under about 0.8 m: the yard's low wall, crates, barrels) can be hopped over. Enemies still walk round them. About one more session, and every level needs its heights set.
C. As A, and it is a defence: in the air you are safe from ground attacks (the Charger's rush, sweeps), like a second dodge. A rule of combat; it changes what the telegraphs teach.

**2. The sprint.**
A. Free: hold to run at 1.5× (9 m/s) for as long as you like. Swinging, blocking or using an ability stops it; a dodge from a sprint is the same dodge. Nothing new on the HUD. **Recommended:** it is what makes the village and the halls quicker, and a cost can be added if the playtest says sprint-kiting is too easy.
B. Stamina: one bar that sprint drains and a dodge spends (the dodge's 0.9 s cooldown is replaced by its cost), refilling when you stop. The Dragonwilds and Souls way; a new bar in a HUD corner, and it changes how often you can dodge.
C. Free, but only out of combat (no awake enemy within about 15 m); in a fight you walk.

**3. The buttons** (rule 4: a key and a gamepad button before any mouse binding).
A. Keyboard: Space jumps, hold Shift sprints, K or C dodges; J (and the left mouse button, when mouse look lands) attacks. Gamepad: A jumps, B dodges, clicking the left stick sprints until you stop moving; ability slot 2 moves from B to RT, which with a bow stays the lock-on cycle (the bow has no slot 2). **Recommended:** the usual layout for this kind of game.
B. As A on the keyboard; on the gamepad the existing buttons stay: dodge stays on A, jump goes on a left-stick click, and you sprint by pushing the left stick all the way. Fewer changes, but a jump on a stick click is awkward mid-fight.
Michael: **1A 2A 3A** (2026-10-15, on the control room): a hop that clears nothing, a free sprint, the usual layout. Built in Session 45.

### 2026-10-14: Mouse look and mouse buttons (the producer)
Michael wants the mouse to aim and turn the camera, left button to attack and right to block, with WASD to move. Keyboard-only play must keep working (rule 4).
Michael: **A: Mouse look with pointer lock, LMB attack, RMB block** — keyboard and gamepad bindings stay as they are. (2026-10-14)

### 2026-10-14: The art spike's verdict: keep, one more pass, a pack, or hire? (Claude (local))
Session 39's turnarounds (`docs/art/spike/`) get the palette and readability right, but the adventurer reads boxy beside its reference: small hands, long thin legs, little charm. The goblin is closer.
A. An asset pack for the characters: KayKit Adventurers (CC0, chunky low-poly, rigged with 130+ animations in its companion pack, glTF), by the same artist as the KayKit dungeon and village kits, so the game matches. No commission. **Recommended.**
B. One more agent pass on the adventurer with the specific fixes.
C. Hire a freelancer to the reference, as first planned.
Michael: **A, an asset pack (KayKit Adventurers)** (2026-10-14, in chat). The environment pack: he asked for a comparison of packs first. The style guide is trimmed to one page; the concept-sheet notes and prompts moved to `docs/art/concept/README.md`.

### 2026-10-14: The dungeon kit, the village buildings and the goblins (Claude (local))
The comparison of packs (https://claude.ai/artifact/QqeTEhWyfe9tcpeQFpPyjH) left three picks. 1: the dungeon kit, A. KayKit Dungeon Pack free tier, B. its Extra tier now ($7.95). 2: the village buildings, A. test a scaled-up KayKit Medieval Hexagon tavern from the game camera first, Quaternius Medieval Village MegaKit as the fallback, B. the Quaternius kit, C. keep the greybox until Phase 2. 3: the goblins, A. keep the spike's agent-built goblin, restyled to sit beside the pack, B. a KayKit orc (Mystery Monthly Series 6, $19.99), C. Quaternius Bestiary (QAL licence, other rig). A was recommended in each.
Michael: **1A 2A 3A** (2026-10-14, in chat).

### 2026-10-13: Can a Claude agent model and animate instead of a freelancer? (Claude (local))
The design doc's asset plan has packs for environment and props, a freelancer for characters and signature enemies, and Claude-authored procedural pieces for layouts, terrain and scatter. Michael asked whether an agent could do the modelling and animating. The flat-shaded low-poly style suits code-built models, an agent can render and compare its own work, and rigid-part animation fits the chunky style; the risk is charm (faces, organic shapes) and smooth skinned animation.
A. Hire the freelancer as planned.
B. A spike first: an agent builds the base adventurer and the goblin to match the reference models, with a walk and a swing, and renders them beside the references; Michael judges. If it holds up, an Artist agent joins the team and the freelancer is kept for hero pieces at most. **Recommended.**
Michael: **B, set up the spike** (2026-10-13, in chat). The asset plan in the design doc changes only if the spike passes his look.

### 2026-10-13: The style guide's three reference models (Claude (local))
The style guide asks for three reference models to gate the commission and the asset-pack purchase; the concept sheets offered candidates.
Michael: **the base adventurer (sheet 02 panel 1), the basic goblin (sheet 03 panel 2) and the regional building (sheet 04 panel 3)** (2026-10-13, in chat).

### 2026-10-13: The camera: raised third person or over the shoulder? (Claude (local))
Session 29 built the design doc's camera: 35 degrees above the player at 12 m, turning on its own toward the fight. Looking at the concept sheets, Michael asked for it to play "more third-person / WoW style ... rather than top-down / birds-eye like in Baldur's Gate or Diablo", and on the question of how a keyboard player turns, answered: "I really just want it to be like Runescape Dragonwilds". Dragonwilds is a free-look over-the-shoulder camera: low and close behind the character, the player turns it (mouse or right stick), movement is relative to it, with target lock-on and dodge-cancel combat.
Michael: **Over the shoulder, like RuneScape: Dragonwilds** (2026-10-13, in chat). Read as: the camera sits low and close behind the player and the player turns it; WASD and the left stick move relative to it; arrow keys and the right stick turn and tilt it (keyboard-only still works, CLAUDE.md rule 4); an optional mouse look can come later but is never required; the auto-rotation toward the fight is replaced by a gentle swing in behind the player while they move, and by the existing lock-on when one is held. Sheet 06 in `docs/art/concept/` is the picture of it. Supersedes the design doc's "30 to 40 degrees with auto-rotation".

### 2026-10-09: Fable credits are out: how does the input fix land? (the producer)
The input-loop Fable card has sat queued with no branch since 6 Oct and the weekly Fable credits are out. Options: A. wait for the weekly credit reset; B. Claude (local) does the input fix on auto/local-input-timing; C. the builder takes it.
Michael: **A. Wait for the weekly credit reset** — answered on the control room. (2026-10-10) The card stays queued and the builder idles on that item.
Superseded 2026-10-12: Michael moved the lane off Fable to an Opus deep-work session (same routine, same cards), which took the card that day (Session 36, PR #37). Michael, 2026-10-14: "We should not be blocked on Fable." CLAUDE.md's Model split says so.

### 2026-10-08: The Fable routine is not taking the input card (the producer)
The input-loop card sat queued from 6 Oct with no branch; FREEZE #27 was closed so the builder runs again. Options: A. check the Fable routine and run it once by hand; B. Claude (local) does the input fix; C. the builder takes it.
Michael: **A. Check the Fable routine, run it once by hand** — We are out of fable credits for the week. That may be the problem. (2026-10-09)

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
