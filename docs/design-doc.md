# Hearthgate — Game Design Document

Exported from the live design doc on 3 Oct 2026. The live doc (claude.ai) is the source of truth; refresh this copy when it changes.

## Vision and pillars

Hearthgate is a browser-based co-op fantasy game for 1 to 8 players: a village you own, portals into short dungeon runs, and an economy that rewards visiting and trading with other players. It plays like a cosy RuneScape-flavoured dungeon crawler where helping friends at any level is always worth your time.

Every design decision is tested against five pillars:

1. **Friends at any level play together.** Progression is sideways (more tools, not bigger numbers), gear is capped by dungeon tier, and veterans gain a Guide role and Warden renown for running with newer players. If a feature only works when everyone is the same level, it is cut.
2. **Short runs, long game.** A dungeon run is 15 to 25 minutes with a clear go-deeper-or-go-home choice. The long game lives in the village, your skills, your hirelings and your trade network.
3. **Tactical, readable, casual.** Combat has real decisions (positioning, states, combos) but a controller-sized loadout, telegraphed attacks and no hidden math. A friend can join cold and contribute in their first run.
4. **Your village is yours; other villages are worth visiting.** The host owns the hub and its growth. Region-exclusive resources, items and dungeons mean no single village has everything, so visiting and trading are part of the loop rather than optional.
5. **Reach the friends who do not have a gaming PC.** Browser-first, fully playable on a laptop without a mouse, and designed so a touch layout is possible later without rebuilding the UI.

## Core loop

A session is a series of 15 to 25 minute runs that start and end in the host's village, with one decision repeated every floor: go deeper for better loot or go home and bank it.

*(Diagram in the live doc: Village → Portal shrine → Dungeon floor → "Go deeper?" → yes: bank at the rest room and take the next floor; no: Return home, loot banked, village grows → back to Village.)*

Each floor ends in a rest room where the party banks what it has; going deeper risks only the loot since the last bank, never progress. Going home turns the run into village resources, so even a short run leaves the hub visibly better.

**Session shape.** A typical evening is three to five runs: a warm-up at a low tier with the whole group, a push at the group's best tier, and a Warden run where veterans take newer friends somewhere easy for renown. Between runs, players shop, craft, trade and tinker with loadouts in the village.

## Players, parties and hirelings

A session belongs to one host; up to 8 players run together, and empty slots are filled by hirelings so a solo player always has a full party.

**Sessions.** The host opens their village; friends join by invite code or friends list and arrive in the host's village. Only the host's village exists in the session, but every player keeps their own character, inventory and skills. Visitors' gains persist to their own account.

**Party size.** 4 to 8 players per dungeon run. Rooms, enemy counts and boss health scale with party size so 4 and 8 both feel right. Below 4, hirelings top the party up to 4 by default; the host can raise that cap.

**Hirelings (Guild Wars model).** Hirelings are recruited in the village tavern, which unlocks more and better hirelings as the village levels.

| Tavern tier | Hirelings available | What changes |
| --- | --- | --- |
| 1 to 7 | One per tier, up to 7 | Roster grows; Henchmen (fixed kit) at tiers 1 to 3, Heroes (full customisation) from tier 4, Companions (skill tree, loyalty, signature ability) from tier 7 |
| 8 to 9 | 7 | Damage, reaction speed and combo awareness scale up |
| 10 | 7 | Comparable to a real player in damage output and decision-making |

**Upgrading hirelings.** A maximum of 7 hirelings can be recruited, and each is a small build of its own: a style, a weapon, three abilities, gear slots filled from your stash, and a skill level that rises with the runs they join. Tavern training spends coin and materials to raise a hireling's skill directly. A player who prefers ranged can run with a melee frontline of three Companions they kitted out themselves, and the full roster is the solo player's long-term progression.

Below Tavern tier 10, hirelings are noticeably worse than a competent human: slower to react to telegraphs, limited combo awareness, no banking judgement. A friend joining always feels like an upgrade. At tier 10 they match a player in output, so a maxed village can run top-tier content solo; a friend still brings what a hireling never can: trade, renown and someone reading the room with you. When a player joins mid-session, they replace a hireling at the next safe point (village or a dungeon rest room).

**Dropping in and out.** Players can join a session in the village at any time and join a run in progress at its next rest room. Leaving mid-run hands your slot to a hireling and you keep whatever loot was already banked at the last rest room.

## Progression

Progression runs on three layers that never let a high-level player trivialise a low-level friend's run: the player grows sideways, gear is capped by the portal, and the village grows for everyone.

**Layer 1: the player (sideways, and a little up).** Character level unlocks options first. Stats move a little, and only through points the player chooses (Michael, 26 Oct, plan 3a): a talent point per weapon level to 50, a specialization at 10 whose tree opens a choice at 20, 30 and 40 and a capstone at 50 (Michael, 28 Oct), then champion points without end, all of them together capped at +15% damage and +15% health. Each level grants one of: a weapon proficiency, a loadout slot, or a passive that changes how an existing ability behaves; the abilities themselves come from the Melee, Ranged and Magic skill trees. A level-50 player wins through knowledge and toolkit, not numbers.

- **Skills by use (RuneScape-style).** Melee, Ranged and Magic are the three combat skills and level by use; each unlocks that style's ability tree. Gathering, Crafting, Alchemy, Rune-crafting and Cooking level the same way. Skills gate recipes, abilities and village jobs, not dungeon access.
- **Mastery.** Each dungeon type has a mastery track (clears, no-death clears, depth reached). Mastery unlocks the Guide role for that dungeon type and cosmetic titles.

**Layer 2: gear (tier-capped).** Each portal tier caps gear power. A tier-5 sword entering a tier-1 portal performs as a strong tier-1 sword and keeps its special effect. The veteran is clearly better, never invincible. Gear sits on the foundation built for The Old Gates: weapon classes, two-handed and ranged types, affixes and upgrade paths, with the numbers re-tuned around tier caps.

**Layer 3: the village (shared).** Every run returns village resources (lumber, stone, coin, region materials). Buildings level up with them and improve things for the host and every visitor: better merchant stock, more hirelings, new crafting stations, higher portal tiers. Visitors see progress happen on the trip they joined.

**Guide role.** Reaching a dungeon type's mastery threshold lets a player enter it as Guide. Guide swaps one ability slot for a lantern kit: reveal the floor layout, mark elite enemies and their telegraphs, place a rally point that revives downed players once per floor, and a shared buff that scales with how many party members are below the dungeon's tier. Guide rewards are tied to party performance (floors cleared, deaths avoided), not kills.

**Warden renown.** Running a dungeon at least two tiers below your own cap with at least one player below the tier earns renown. Renown buys cosmetics, village decorations, hireling outfits and a small set of blueprints only available this way. Renown is the veteran's main reason to go back for friends.

**Shared credit.** Everyone in the run receives rewards from the dungeon's tier, scaled to their own level band, so a new player gets useful tier-1 gear from a tier-1 run while the veteran gets renown, materials and village resources. No one is a passenger and no one is a carry.

## Combat

Combat is third-person action with a controller-sized loadout, built around telegraphed attacks and a small state-and-combo system so that eight players on screen stays readable.

**Camera and readability.** An over-the-shoulder third-person camera in the manner of RuneScape: Dragonwilds (Michael, 2026-10-13, superseding a raised 30 to 40 degree camera): low and close behind the player, turned by the player with the arrow keys or the right stick, swinging gently in behind the player while they move, and framing the target when a lock-on is held. Enemy telegraphs are drawn on the ground as coloured shapes before every heavy attack. Party members have a coloured outline and a name tag; enemies are silhouette-readable at a glance. First person is out because co-op needs everyone to read positions.

**Combat triangle.** Three play styles, Melee, Ranged and Magic, each a skill levelled by use. They counter each other RuneScape-style: Melee beats Ranged (closes the gap, staggers), Ranged beats Magic (interrupts casts from a distance), Magic beats Melee (states and control ignore armour). Enemies have a style too, so a party that covers all three has an answer for every room, and a new friend who picks the style the group lacks is useful immediately.

**Abilities per style.** Special attacks are not the Magic school's alone. Each style has its own ability tree unlocked by that style's skill level, and every tree has a crowd answer, a single-target answer and a utility answer.

| Style | Crowd ability | Single-target ability | Utility ability |
| --- | --- | --- | --- |
| Melee | Cleave: a wide swing that staggers everything in front | Execute: heavy damage on a staggered target | Shield charge: close the gap and knock one enemy down |
| Ranged | Arrow rain: arrows fall on a marked area | Piercing shot: passes through a line of enemies | Snare: roots a target for the party |
| Magic | Magic missile: hits up to 5 enemies once each | Shatter: bursts a chilled target | Ward: a barrier that absorbs one heavy hit for an ally |

**Loadout.** One weapon set (a weapon and, for a one-handed weapon, an off-hand), three ability slots on 1, 2 and 3, one consumable slot, plus a dodge and a block or parry depending on the weapon. The weapon set is chosen on the hero screen outside a fight and does not change mid-fight (Michael, 28 Oct), so cross-style combos come from a friend or a henchman. There are no classes: role comes from the loadout, and loadouts can be changed in the village or at rest rooms. A controller or keyboard-only player uses face buttons or four keys for everything.

**Builds (Michael, 28 Oct; `decisions.md`, "Combat depth").** Seven layers, lowest first:
- **Weapon family.** Each style has several, each with its own chain and heavies: melee sword, warhammer, mace, axe, daggers; ranged shortbow, crossbow, longbow, throwing knives; magic staff, wand, sceptre. The family sets the damage's shape (slash, pierce, arcane).
- **Off-hand.** One-handed families take one and it brings the third ability: shield (bash), tome (a spell), focus orb, parrying dagger; for ranged, a second hand crossbow or knife (dual-wield) or a buckler. Two-handed families take none and hit about 20% harder. Arrow types go in an ammo slot.
- **Specialization,** one of three per style from level 10: Paladin, Spellblade, Rogue; Ranger, Scout, Assassin; Sorcerer, Warlock, Druid, with the Necromancer later. It sets the element (fire, frost, earth, air, shadow, holy, nature), which colours every attack and leaves a state; it reshapes the style's abilities, adds a signature mechanic and a tree at 20, 30, 40 and a Crescendo at 50.
- **Light and heavy strings.** Tap for light, hold for heavy (two charge levels). The five-hit light chain stays; heavies open, carry and end other strings (heavy-light-light, heavy-heavy-heavy), each a named move.
- **Runes.** A weapon has 0 to 2 sockets by rarity; a rune changes the light finisher or every heavy (extra spectral blades, a fire whip, orbs that drain or split).
- **Flow.** A personal rhythm meter: hits on the beat, perfect parries and dodges, and varied strings fill it; a hit taken costs a tier. Three tiers, each hotter on screen and in the music, then a Crescendo. Two players at Flow III together turn on the distinct-player bonus for combos (Harmony).
- **Combo mastery.** Every payoff landed counts toward that combo's rank, I to V; rank V is shaped by the payer's specialization.

**Carried from The Old Gates.** Posture and stagger, parry with a timing window, blocking, backstab, two-handed weapons, bow and aiming, and enemy archetypes such as the Charger, Pack Leader and Shieldbearer bash. These are simplified for crowds: shorter animations, bigger telegraphs, more generous parry windows.

**States and combos.** Every ability either applies a state or consumes one. States are the glue that makes mixed-level parties work, because a tier-1 setup feeds a tier-5 payoff.

| State | Applied by | Consumed by | Payoff |
| --- | --- | --- | --- |
| Soaked | Water abilities, Tidewater consumables | Lightning, Frost | Chain damage or freeze |
| Staggered | Heavy hits, Shieldbearer-style bash | Backstab, Execute | Crit and knockdown |
| Marked | Guide lantern, Hunter abilities | Any party member | Bonus damage from everyone |
| Burning | Fire, Emberreach consumables | Oil, Wind | Spread to a group |
| Rooted | Vines, Verdant abilities | Area attacks | Enemies cannot dodge the area |
| Chilled | Frost, Frostmere consumables | Shatter | Big single-target burst |

Combo payoffs scale with how many *different* players took part, not with their levels. Two players setting up and a third finishing is always worth more than one veteran doing it alone.

**Downs, revives and wipes.** A player at zero health is downed, not dead: they crawl, cannot fight, and a bleed-out timer starts (30 seconds to begin with, tuned in playtests). Any teammate who reaches them before the timer ends picks them up with a short channel at no cost. If the timer runs out they are dead for the fight. A dead player can be brought back mid-fight with a Revive Draught, an uncommon drop and a moderately expensive Apothecary item, or by the Guide's rally point once per floor. Once the room is clear, dead players recover for free. Revive is also a mid-to-late Magic ability unlock, which makes a high-level mage the party's safety net. If every player is downed or dead at the same time, the squad is wiped: the run ends and everyone returns to the village.

**What a wipe costs.** Equipped gear is never lost. Everything in the backpack that was not banked at a rest room is lost on a full wipe, so the go-deeper choice is a real gamble and banking is a real decision. Skills, renown and village progress are never lost. Each dungeon tier adds enemy abilities and modifiers rather than bigger health bars.

**Enemy design rules.**

- Every enemy has one obvious tell and one thing it is weak to.
- Elites combine two basic enemy behaviours; bosses have three phases with new telegraphs each phase.
- Enemy groups are built to reward splitting a party's attention: a Pack Leader buffing a crowd, a Shieldbearer protecting a caster.

## Dungeons

A dungeon is a portal choice (type, tier, modifier) that generates a run of 3 to 5 floors, each 4 to 6 minutes, with a rest room between floors where the party banks loot and decides whether to go deeper.

**Portal choice.** The village portal shrine offers a rotating board of 3 to 5 open portals. Each lists its dungeon type, tier (1 to 5, capped by the shrine's level), modifier, and bonus reward. The board refreshes daily; the host can spend a key to reroll it.

**Floor structure.** Floors are assembled from hand-built rooms (combat arena, corridor, puzzle, treasure, shrine) joined by a procedural layout. Each floor has one objective (clear the warren, light the braziers, escort the prisoner, survive the ritual) before the stairs open. The last floor of a run is a boss or an elite gauntlet.

**Rest rooms.** Between floors: a campfire, a shared stash, a loadout swap, and the choice. Going home banks everything; going deeper raises drop quality and village resources by about 30% per floor but risks the unbanked loot from the floors since the last bank.

**Modifiers.** One per run, drawn from a pool: Flooded (soaked state everywhere), Cursed (no revives, double loot), Haunted (enemies return once), Overgrown (rooted hazards), Fogbound (Guide bonuses doubled), Festival (comedic enemy variants, cosmetic drops). Modifiers are the main source of replay variety at a given tier.

**Dungeon catalogue.** Tone leans RuneScape: goblins, crypts, ruined towers and strange cults, never real horror.

| Dungeon type | Flavour | Signature enemies | Home region |
| --- | --- | --- | --- |
| Goblin Warrens | Mud tunnels, loot piles, traps | Goblin packs, Pack Leader, war pig | Any |
| Haunted Crypt | Stone halls, candlelight | Skeleton Shieldbearers, wraiths, the Barrows-style brothers | Any |
| Ruined Wizard Tower | Vertical, puzzle rooms | Animated armour, imps, a rogue apprentice | Any |
| Bandit Fort | Palisades, courtyards (reuses fort generation) | Archers, Chargers, a bandit captain | Any |
| Overgrown Druid Ruins | Vines, standing stones | Treants, boars, rooted cultists | Verdant Vale |
| Forge-Depths | Lava channels, dwarven machinery | Fire elementals, forge golems | Emberreach |
| Drowned Temple | Flooded chambers, coral | Sirens, crab knights, the Tide Priest | Tidewater |
| Frozen Barrows | Ice tombs, wind | Frost wights, mammoth skeletons | Frostmere |

The four shared types are available in every village. The four regional types only appear on the portal board of a village in that region, which is one of the main reasons to visit other players.

**Drops.** Each dungeon type has its own loot table theme (crypt: enchanting materials; tower: rune and spellbooks; fort: weapons and armour) so that choosing a portal is also choosing what you are farming.

## Hub and village

The village is owned by the host, grows with every run and every visitor's purchase, and is the only place where merchants, crafting, hirelings and portals live.

**Ownership.** Each character has exactly one village in their chosen region. The host's village is the hub for the session. The host decides building placement and upgrade order; visitors use everything but cannot spend the host's village resources.

**Tone.** Warm light, slow day-night cycle, music and ambient sound (birds, a river, a forge). The village is the calm between runs; nothing in it can hurt you.

**Unlocking buildings.** A new village starts with four buildings: Portal Shrine, General Store, Storehouse and Tavern. Every other building must be unlocked by delivering a build order of materials. Basic buildings need home-region materials; advanced ones need materials from all four regions, so the strongest services in any village exist only because its owner has traded or travelled.

**Tiers.** Each building has 10 tiers funded by coin, village resources and region materials. Tier 1 to 4 need home-region materials, 5 to 7 add one other region, 8 to 10 need all four. Tiers unlock stock, services and recipes for everyone in the session.

| Building | Unlock | Grows with tiers |
| --- | --- | --- |
| Portal Shrine | Starts unlocked | Max dungeon tier, portals on the board, reroll keys |
| Tavern | Starts unlocked | Roster size up to 7, hireling quality and training |
| General Store | Starts unlocked | Stock size, daily restock, rare rolls |
| Storehouse | Starts unlocked | Capacity, remote banking from rest rooms |
| Forge | Home ore and stone | Max upgrade tier, affix choice, reforging |
| Apothecary | Home herbs or fish | Recipe list, potency, Revive Draught at tier 3 |
| Enchanter | Home runestones or gems | Enchant tiers, slot count |
| Market Hall | Materials from two regions | Trade slots, async offers, lower tax |
| Home | Lumber and stone | Decorations, trophies, hireling quarters |
| Guild Hall | Materials from all four regions | Companion hirelings, cross-region recipes, Warden board |
| Grand Bazaar | Materials from all four regions | Travelling merchant stays longer, foreign stock rolls |

**Merchant stock.** Every merchant has a limited, visible inventory that restocks daily. Stock size and quality rise with building level. The host sets no prices; instead, the village has a wealth score that rises when visitors buy, and wealth unlocks rare stock rolls and reduces upgrade costs.

**What visitors get.** Access to the host's merchants, crafting stations, hirelings and portal board (including the region-exclusive dungeon), and the right to trade with the host and other visitors in the Market Hall. Anything they craft, buy or earn is theirs.

**What the host gets.** Wealth from visitor purchases, a cut of Market Hall trades, village resources from every run that starts in their village regardless of who ran it, and a visitor log that unlocks decorations and titles at milestones (first 10 visitors, first visitor from each region).

**Offline visits (later).** The save data is designed so a village can be entered while the host is offline for shopping and trading only (no runs). This is a later milestone, not a launch feature, but nothing in the village design should block it.

## Regions and trading economy

Each character picks one of four home regions at creation, and that choice decides which resources, merchant exclusives and dungeon type their village has, so no village is complete on its own and trading with real players is the best route to the strongest recipes.

**Region choice.** Permanent per character; a second character is how you get a second region (the Pokémon two-cartridges model). Region affects the village's look, its gatherable resources, one exclusive dungeon type, and a short list of key items its merchants can never stock.

| Region | Biome and look | Exclusive resources | Exclusive dungeon | Crafting lean |
| --- | --- | --- | --- | --- |
| Verdant Vale | Forest, meadows, mossy stone | Rare herbs, heartwood, amber | Overgrown Druid Ruins | Alchemy, fletching |
| Emberreach | Volcanic hills, dwarven stonework | Ores, gems, obsidian | Forge-Depths | Smithing, heavy armour |
| Tidewater | Coast, harbours, coral | Pearls, coral, deep fish | Drowned Temple | Cooking, enchanting |
| Frostmere | Tundra, pine, standing stones | Furs, runestones, frost crystal | Frozen Barrows | Rune-crafting, light armour |

**Cross-region recipes.** The strongest recipes need materials from two or more regions. Examples: an Emberreach blade etched with a Frostmere rune; a Verdant herb and Tidewater pearl potion that cures all states; Frostmere fur lined with Verdant heartwood for the best cloak. A single-region character can reach high tiers with region-pure gear, but the best-in-slot items are always mixed.

**Key items.** Each region has 6 to 10 key items (blueprints, hireling unlocks, portal keys for the exclusive dungeon, cosmetic sets) that are never sold by that region's merchants. They drop in the region's own dungeon or appear in its merchants' stock, so a Tidewater player's shop sells the thing a Verdant player cannot get at home.

**Trade routes, best to worst.** The design keeps player trading on top without making other regions unreachable for a small group:

1. **Direct trade** in any village's Market Hall: both players present, items swap instantly, the host takes a small cut.
2. **Visiting and buying** from another region's merchants with your own coin; the host gains wealth.
3. **Trade board** (asynchronous): post an offer in a village's Market Hall; it stays up for seven days and anyone who visits can fill it, even when you are not there.
4. **Travelling merchant**: visits every village for one day a week with a small, expensive, random selection of other regions' goods.
5. **Rare foreign drops**: shared dungeons have a roughly 2% chance per run to drop a foreign-region material.

**Economy safeguards.** The server owns every item, so duplication is impossible by construction. Coin sinks (upgrades, rerolls, hireling wages, trade tax) keep gold meaningful. Region materials are tradeable; renown and mastery are not.

## Platform and controls

Hearthgate is a browser game first: fully playable on a laptop with keyboard only, with a gamepad as the preferred input, and designed so a touch layout can be added later without redesigning the UI.

**Target platforms, in priority order.**

1. Desktop and laptop browser (Chrome, Edge, Safari, Firefox), keyboard-only and gamepad.
2. Laptop with trackpad: must be playable, mouse never required.
3. Mobile browser and a home-screen install (PWA): a later milestone, but no decision before then may block it.

**Why keyboard-only forces good design.** A game that works on four keys and a dodge works on a gamepad and on touch. The controls therefore have no mouse-aim, no click-to-move and no right-click menus.

| Action | Keyboard | Gamepad | Touch (later) |
| --- | --- | --- | --- |
| Move | WASD | Left stick | Left virtual stick |
| Turn and tilt the camera | Arrow keys (mouse look optional, never required) | Right stick | Drag on the right half |
| Attack | J or Space | X | Tap right side |
| Abilities 1 to 3 | K, L, ; (or 1, 2, 3) | Y, B, RB | Three buttons, right side |
| Dodge | Shift | A | Swipe or button |
| Block or parry | Hold or tap Ctrl | LB | Button |
| Interact | E | Right trigger | Tap prompt |
| Consumable | Q | D-pad | Button |

**Targeting.** Soft auto-targeting: attacks aim at the nearest enemy in the facing cone, and the Guide's marks and ranged weapons use a lock-on cycle rather than free aim. The bow from The Old Gates becomes lock-on with a charge timing, which keeps skill without needing a mouse.

**UI rules for touch later.**

- Every interactive element is at least 48 pixels and reachable by a D-pad or tab cycle.
- Menus are lists and grids, never hover-dependent.
- The HUD lives in the corners; the centre third of the screen stays clear for thumbs.
- Text sizes scale with the viewport; chat is optional and never required to play.

**Performance budget.** Target 60 fps on an integrated-graphics laptop and 30 fps on a mid-range phone from the last three years. That means instanced low-poly meshes, baked or vertex lighting in the village, a hard cap on dynamic lights in dungeons, and no post-processing on the mobile tier.

**Mobile-specific risks.** Battery and heat on long sessions, 8-player netcode over cellular, and virtual sticks for precise dodging. Mobile is designed-for-later, not promised; the rule is only that nothing built now rules it out.

## Art and audio direction

Lightweight low-poly fantasy with flat or lightly gradient shading: inspired by the colour and variety of RuneScape 3 and World of Warcraft, not a copy of either, and built so one person plus commissioned packs can produce it.

**Style rules.**

- Low-poly meshes with flat-shaded faces and a touch of vertex colour; no realistic textures.
- Exaggerated silhouettes: big shoulders, wide weapons, oversized props, so everything reads from the over-the-shoulder camera across a room and on a phone screen.
- One saturated palette per region plus a shared neutral palette for stone, wood and metal, so a Verdant village and a Frostmere village look like the same game.
- Detail level similar to The Old Gates, but starting fresh on assets rather than reusing its procedural primitives; its gear and weapon models are the exception where they fit the new style.

**Tone split.** The overworld and villages are pleasant and calming: warm sun, soft shadows, long sightlines, gentle music. Dungeons are darker and cooler (torchlight, blue-green shadows, fog) but never frightening or gory. The reference is RuneScape's dungeons and Barrows, not a horror game.

| Space | Light | Palette | Music |
| --- | --- | --- | --- |
| Village and overworld | Warm directional sun, slow day-night | Region palette, high saturation | Melodic, acoustic, slow tempo |
| Shared dungeons | Torches and fog, limited dynamic lights | Desaturated with one accent colour per type | Low drones with percussion on combat |
| Regional dungeons | As above with a regional accent (lava glow, ice blue, deep teal, mossy green) | Region accent on neutral base | Regional instrument motif |
| Boss rooms | One dramatic light source | Accent colour at full saturation | Full theme |

**Asset plan.** Three sources: stylised low-poly asset packs for environment and props, commissioned characters and signature enemies from a freelancer who matches the style guide, and in-house (Claude-authored) procedural pieces for layouts, terrain and decoration scatter. A one-page style guide with palette swatches and three reference models is the first art deliverable and gates every later purchase or commission.

**Characters.** Simple body with swappable gear slots (head, chest, legs, weapon, back). Gear changes silhouette visibly so friends can read each other's loadouts. Hirelings use the same rig.

**Audio.** A short musical motif per region that appears in its village theme, its dungeon and its merchant stingers. Combat audio does the readability work: every telegraph has a sound, every state has a distinct hit sound, and combos have an escalating chime. A composer is a planned commission; placeholder tracks until then.

## Technical architecture

Hearthgate is server-authoritative from the first prototype: the browser renders and sends input, a Node game server simulates every run and owns every item, and a database persists characters, villages and the item ledger.

*(Diagram in the live doc: Browser clients (1 to 8; Three.js render, input, prediction, no game truth) ⇄ WebSocket ⇄ Game server (Node, Colyseus: Village room per host, Dungeon room per run at 20 ticks/s, Item and trade service) ⇄ Postgres (accounts, characters, villages, item ledger, trade board, skills, renown).)*

Two arrows carry everything: players talk to the server over WebSockets, and the server is the only thing that reads or writes the database.

**Recommended stack.**

| Layer | Choice | Why |
| --- | --- | --- |
| Client | TypeScript, Three.js, Vite build | Known engine; a real build replaces the single file so the client can be split into modules |
| Netcode | Colyseus (Node) | Rooms, state sync, matchmaking and reconnection out of the box; TypeScript shared with the client |
| Simulation | Shared deterministic game logic package | The server runs it as truth; the client runs it for prediction |
| Database | Postgres (SQLite for the local prototype) | Transactions for the item ledger and trades |
| Hosting | One small VPS or a managed Node host plus static hosting for the client | Cheap to start; a second server instance only if rooms fill |
| Auth | Invite codes at prototype; email or OAuth login at first playable | No accounts needed for the first friend group |

**Rooms.** A village room lives as long as the host is online and holds hub state, party formation and the portal board. Each run spawns a dungeon room that owns the combat simulation; players move between the two rooms at the portal and the exit. Hirelings are server-side agents inside the dungeon room.

**Simulation and tick rate.** The dungeon room steps the simulation at 20 ticks a second and broadcasts state deltas; the client interpolates other players and predicts its own movement and attacks, then reconciles. Hits, states, combos, downs and loot are decided only on the server. This is the single biggest change from The Old Gates, where the browser was the whole game.

**Items and trading.** Every item is a row in the ledger with an owner; the item and trade service is the only code that creates, moves or destroys one, inside a database transaction. Direct trades are two-sided commits; the trade board is an escrow row. Duplication is impossible by design rather than by detection.

**Persistence.** Character skills, inventory and renown save on every bank event and on leaving a room. Village state saves on every upgrade and purchase. The save format includes everything an offline visit would need (buildings, stock, trade board) so that feature can be added without migration.

**Testing.** Playwright drives headless clients against a local server for smoke runs; the shared simulation package gets unit tests for combat and states; a bot harness can fill a room with eight scripted clients to test scaling and readability.

## What to reuse from The Old Gates

The Old Gates gives Hearthgate a proven combat and gear foundation; its world, story and single-file structure stay behind.

| System | Decision | Why |
| --- | --- | --- |
| Gear and weapons (classes, two-handed, bow, affixes, upgrades) | Reuse heavily, re-tune for tier caps | The strongest foundation in the codebase |
| Combat feel (posture, parry, block, backstab, telegraphs) | Reuse, simplify for crowds | Proven, but tuned for one player |
| Enemy archetypes (Charger, Pack Leader, Shieldbearer) | Reuse as the first shared-dungeon roster | Already designed around tells and counters |
| Fort interior and exterior generation | Reuse for the Bandit Fort dungeon | Direct fit |
| Village builder | Reuse the placement logic, new building set | Hub needs building levels and ownership rules |
| Day-night cycle | Reuse in the village | Sets the calm tone cheaply |
| Procedural primitive art | Do not reuse | New style; models from packs and commissions |
| Continent, nations, lore canon, Varek | Do not reuse | Different game; Hearthgate's lore stays light and regional |
| Single HTML file | Do not reuse | Multiplayer needs a client build plus a server package |
| Workflow (devlog, backlog, Playwright tests, CLAUDE.md, GitHub repo) | Reuse the conventions in a new repo | Known to work; add server tests |

**Lift approach.** Rather than forking the whole file, lift the combat and gear modules into a shared package that both games could in principle import. That forces the clean module boundaries the multiplayer client needs anyway, and keeps The Old Gates untouched.

## Milestones

The build runs in six phases, each ending in one playtest gate; no dates are set until Phase 0 shows how fast networked work goes.

*(Diagram in the live doc: six phases in order, each gated: 0 netcode spike → gate: feels responsive on a laptop over a real connection; 1 combat slice → gate: a mixed-level party clears a floor and the combo bonus is visible; 2 village and loop → gate: a full solo evening of runs with hirelings holds up; 3 regions and trade → gate: two villages trade a key item with no duplication path; 4 first playable → gate: the friend group plays three sessions unprompted; 5 touch layout.)*

Phase 0 is deliberately tiny and deliberately first: if two browsers cannot fight one enemy together and feel good, nothing else matters. Everything after it adds content to a loop that already works.

**Working conventions.** New GitHub repo with client, server and a shared simulation package; devlog, backlog and playtest notes as in The Old Gates; Playwright smoke tests plus simulation unit tests in CI. The model split stays the same: Fable for cross-cutting architecture (netcode, the shared package, the ledger), Opus for contained features and bug hunts. The style guide and the first commissioned models are ordered during Phase 1 so art lands by Phase 2.

## Risks and open questions

The two risks that could sink the project are multiplayer networking and art production; everything else is tuning.

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Networking is new ground | Every prior project ran entirely in the browser; a server, rooms, persistence and sync touch every system | Prototype 0 is two players in one room before any content; server-authoritative from day one |
| Art production volume | Low-poly fantasy with four regions and eight dungeon types is a lot of models | Style guide first; packs for environment; commission only characters and signature enemies |
| Small player pool for trading | Region exclusives assume you can find a trade partner | Trade board, travelling merchant and rare foreign drops keep every region reachable, slowly |
| Host-online requirement | Friends cannot visit a village whose owner is offline | Save format designed for offline visits later |
| 8-player readability | Eight characters, hirelings and effects can turn to soup | Hard caps on particles, outline colours, ground telegraphs, state icons |
| Hosting cost | A real server costs money monthly | Start on a single small VPS or a free tier; scale only if the player count justifies it |
| Scope creep from The Old Gates habits | Continent-scale thinking does not fit a hub game | The village is the only overworld at launch; no open world |

**Open questions.**

- [ ] Should a character be able to change region once, at a high cost, or is a second character the only route?
- [ ] Is the Guide role per dungeon type or a single unlock?
- [ ] Do hirelings earn skills over time (Companion track) or is that too much simulation for a hub game?
- [ ] How much lore: a page of regional myth per region, or none?
- [ ] Does the game need accounts and login at launch, or do invite codes plus a local save suffice for the first friend group?
- [ ] Which server host and stack: see the architecture section's recommendation, to be confirmed by the prototype.
