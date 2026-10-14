# Hearthgate: art direction style guide (draft)

Draft for Michael to edit. Drawn from the design doc's Art and audio direction, Combat, Dungeons, Hub and Regions sections. Part 1 is the guide itself; Part 2 is five ChatGPT prompts that turn it into dense concept sheets in the same numbered-panel board format as The Old Gates' O10 sheet.

---

## Part 1: The guide

### The one-line pitch

Cosy low-poly fantasy: a warm, sunlit village you own, and portals into torch-lit dungeons that are spooky-fun, never scary. Bright, chunky and readable from an over-the-shoulder camera on a laptop or a phone.

### The biggest difference from The Old Gates

The Old Gates boards are painterly and near-realistic: textured cloth, brushed metal, cinematic lighting, parchment UI. Hearthgate is not that. Every image should look like a real-time low-poly 3D game: flat-shaded facets, solid colour per face, simple shapes, no painted texture. If a generated image could pass for a fantasy book cover, it is off-style.

### Style rules

1. **Low-poly, flat-shaded.** Visible facets, one colour per face, a little vertex-colour gradient (lighter at the top of a mesh, darker at the base). No photographic or hand-painted textures, no normal-map detail, no fur strands, no wood grain.
2. **Exaggerated silhouettes.** Big shoulders, big hands, wide weapons, oversized props (a mug the size of a head, a key the size of a forearm). Everything must read as a shape from across a dungeon room, seen from just behind the player's shoulder.
3. **Chunky proportions.** Characters about 4.5 heads tall: big head and hands, short legs, broad torso. Friendly, not chibi, not heroic-realistic.
4. **Shared neutrals, regional colour.** Stone, wood and metal use the same neutral palette everywhere; each region adds one saturated palette on top. A Verdant village and a Frostmere village must look like the same game.
5. **Two moods.** Village and overworld: warm sun, soft shadows, long sightlines, high saturation, calm. Dungeons: darker and cooler, torchlight, blue-green shadows, low fog, one accent colour per dungeon type. Spooky-fun like a Saturday-morning cartoon, never gore, never horror.
6. **Readability over detail.** Enemy attacks show as bright coloured shapes on the floor before they land. Party members wear a coloured outline and a name tag. Every enemy has one obvious tell and one visible weakness.
7. **Gear changes the silhouette.** Five gear slots (head, chest, legs, weapon, back) and each one visibly changes the outline, so friends can read each other's loadouts at a glance.
8. **Built cheaply.** Detail that a small team, asset packs and a freelancer can produce: low triangle counts, instanced props, no post-processing tricks the image depends on.

### Camera

Over the shoulder, in the manner of RuneScape: Dragonwilds (Michael, 2026-10-13; `decisions.md`): low and close behind the player, a little above head height, looking past the shoulder into the room, turned by the player. The horizon and the far wall are usually in view. Not top-down, not isometric, not a raised strategy view like Diablo or Baldur's Gate, not first person. Gameplay screenshots in the sheets should use this camera; sheet 06 is the reference for it, and the gameplay shots on sheets 01 to 05 sit too high.

### Palette

**Shared neutrals (every region)**

| Name | Hex | Use |
| --- | --- | --- |
| Hearthstone | `#8A8578` | Walls, paving, dungeon stone |
| Shadowstone | `#4E4A44` | Stone in shade, foundations |
| Oak | `#8B5A2B` | Beams, furniture, handles |
| Dark timber | `#5A3A22` | Roofs' undersides, doors |
| Thatch | `#D9B26A` | Roofs, hay, rope |
| Iron | `#6E7378` | Blades, armour, fittings |
| Brass | `#C99A3B` | Trims, coins, lanterns |
| Bone | `#EFE3C6` | Paper, banners, UI panels |
| Ink | `#2A2622` | Outlines, UI text, deepest shade |

**Region palettes (one per village, on top of the neutrals)**

| Region | Look | Swatches |
| --- | --- | --- |
| Verdant Vale | Forest, meadows, mossy stone, amber | Meadow `#6DBE45`, Moss `#3F7D3A`, Amber `#E8A33C`, Heartwood `#A0522D`, Blossom `#F2A7B8`, Spring sky `#8FD3F4` |
| Emberreach | Volcanic hills, dwarven stonework, gems | Ember `#F26B1D`, Lava `#FF3D1F`, Basalt `#3B3236`, Obsidian `#4B2E5C`, Ash `#B8ADA6`, Gold ore `#F4C542` |
| Tidewater | Coast, harbours, coral, pearls | Sea teal `#1FA3A0`, Deep water `#145C7A`, Coral `#FF7F6A`, Pearl `#F4EFE6`, Sand `#E8D3A2`, Kelp `#4F8A5B` |
| Frostmere | Tundra, pine, standing stones, runes | Glacier `#9FD8F0`, Snow `#E6F6FF`, Pine `#2F5D50`, Rune violet `#7B6FD6`, Fur `#B08D6A`, Slate `#5B6B7A` |

**Dungeons**

| Space | Base | Accent |
| --- | --- | --- |
| Shared dungeon base | Stone `#3A3F44`, fog `#5C7A78`, shadow teal `#1E3B3F`, torch `#FFB347` | One per type, below |
| Goblin Warrens | Mud `#6B5434` | Grub green `#A5C83A` |
| Haunted Crypt | Grave stone `#4A4E57` | Spectral cyan `#6FE3D0` |
| Ruined Wizard Tower | Plum stone `#4A3B55` | Arcane magenta `#C04FD8` |
| Bandit Fort | Weathered timber `#6A5442` | Banner red `#C8372D` |
| Regional dungeons | Neutral base | The region's accent at full strength: lava glow, ice blue, deep teal, mossy green |
| Boss rooms | One dramatic light source | The dungeon's accent at full saturation |

**Combat readability**

| Element | Hex | Shape (colour is never the only cue) |
| --- | --- | --- |
| Enemy telegraph | `#FF4A3D` at ~40% fill, solid rim | Cone, circle, line or ring on the floor, filling inward as it charges |
| Soaked | `#2F8CFF` | Water droplets |
| Staggered | `#FFD23F` | Spinning stars over the head |
| Marked | `#FF4FA3` | Lantern sigil floating above |
| Burning | `#FF7A1A` | Small flames licking the edges |
| Rooted | `#5CBF3A` | Vines around the feet |
| Chilled | `#BDEBFF` | Frost crystals, a pale icy rim |
| Party outlines (up to 8) | `#3FA9F5` `#F5C93F` `#9B5DE5` `#2EC4B6` `#FF8C42` `#F15BB5` `#B5E655` `#FFFFFF` | Thin rim around the whole figure, name tag above |

### Lighting

- **Village by day:** warm key sun `#FFE3A3` from high and to one side, soft sky-blue fill `#BFE3FF`, short soft shadows, a little haze at distance.
- **Village at dusk and night:** amber window glow, lanterns along paths, deep blue sky `#22305A`, the Portal Shrine as the brightest thing in town.
- **Dungeons:** torches as warm pools of light, everything between them in cool blue-green shadow, low fog on the floor; a cap of a few lights per room.

### UI direction

- Warm wood and bone-coloured panels with chunky rounded corners and an ink outline; flat colour, no parchment grain, no photo textures.
- A chunky, friendly serif for titles; a clean rounded sans for numbers and small labels.
- HUD lives in the four corners; the centre third of the screen stays clear.
- Every button at least 48 px; every prompt shows a keyboard key and a gamepad button (`E` / RT), never a mouse cursor or a hover tooltip.
- Menus are lists and grids moved through with arrows or a D-pad, with a bold highlighted selection.

### Do and do not

| Do | Do not |
| --- | --- |
| Flat-shaded facets, solid colours | Painted textures, photorealism, brush strokes |
| Chunky, friendly, exaggerated shapes | Realistic anatomy, gritty grimdark armour |
| Warm, saturated villages | Desaturated, muddy overworld |
| Spooky-fun dungeons with torchlight and fog | Gore, blood, horror faces, body horror |
| Bright floor telegraphs, outlines, name tags | Effects that hide the characters |
| Corner HUD, big buttons, key and gamepad prompts | Mouse cursors, hover tooltips, centre-screen clutter |
| Its own look | Copying any existing game's characters, logos or UI |

### Reference sheets (2026-10-13)

Six sheets Michael generated in ChatGPT from the Part 2 prompts (the sixth from a follow-up prompt for what the first five missed), kept in `docs/art/concept/`. **They settle the look, not the content.** The style landed: faceted low-poly, chunky 4.5-head figures, warm saturated villages, torch-lit dungeons with one accent each, floor telegraphs, outlines and name tags. Where a sheet shows a feature, building, skill or control that the design doc does not have, the design doc wins; those are listed under each sheet so nobody builds from them by accident.

**[01: World, regions and mood](art/concept/01-world-regions.webp)**
- Use: the palette strips; the overall village rendering; dungeon entrances with their accents (panel 5); the dungeon interior mood (panel 6); morning and evening lighting (panel 7); the scale card (panel 9).
- Ignore: the building names (House, Blacksmith, Market, Farm are not the design's list; it has Home, Forge, Market Hall and no Farm); "Overworld exploration" (the village is the only overworld at launch); the regions drawn as castles and cities rather than the same village per region; the steep, near-isometric overview camera.

**[02: Characters, gear and hirelings](art/concept/02-characters-gear.webp)**
- Use: proportions and silhouettes (panel 1); the gear-slot grid showing each slot changing the outline (panel 3); the four regional armour sets (panel 4); the weapon line-up (panel 5); the party shot with outlines and name tags (panel 7); NPC villagers (panel 8).
- Ignore: Warrior, Ranger, Mage and Cleric as classes (Hearthgate has no classes; role comes from the weapon and loadout, and there is no healer style); the hireling roster is inspiration only, the pet-handler included.
- Missing: the Guide with the lantern, the sword at tiers 1 to 5, cross-region gear.

**[03: Enemies, combat and dungeons](art/concept/03-enemies-combat.webp)**
- Use: the archetype silhouettes (panel 1); the goblin family (panel 2: the Shaman reads as the Pack Leader's buff role, the Brute as a Charger); the per-dungeon line-ups (panel 3); the circle, cone and line telegraphs (panel 4, the strongest panel across all five sheets); the six states with their shapes; group combat (panel 7).
- Ignore: the Cave Golem labelled Verdant Vale (Verdant's dungeon is the Druid Ruins with treants; a golem belongs to Emberreach's Forge-Depths).
- Missing: the Shieldbearer by name, the war pig, the regional signature enemies, the combo strip, downed and revive.

**[04: The village and the run](art/concept/04-village-run.webp)**
- Use: one building across four upgrade levels (panel 2); the same building in each region's style (panel 3, exactly the "shared neutrals, regional colour" rule); village NPC life (panel 4); the portal shrine (panel 6); day and night (panel 8).
- Ignore: the building names again; "Gather" outdoors as step 1 of the loop (resources come from runs); level ranges such as "Lv 5 - 10" on portals (the design uses tiers 1 to 5).
- Missing: the rest room and the go-deeper-or-go-home choice, the core decision of every run; Market Hall trading; the travelling merchant; visitors arriving.

**[05: HUD, menus and interaction](art/concept/05-hud-menus.webp)**
- Use: the party frames and portrait style (panel 1); the inventory and gear screen (panel 2); the portal selection layout (panel 4); the crafting panel (panel 6); dialogue with numbered choices (panel 7); notification toasts (panel 9); settings toggles for telegraphs and outlines (panel 10).
- Ignore: the ability bar in the bottom centre with four abilities (the design has three slots plus attack, in the corners, centre third clear); the minimap; Acrobatics, jumping and the skill list (the design's skills are Melee, Ranged, Magic, Gathering, Crafting, Alchemy, Rune-crafting, Cooking); the world map and quest log (not in the design); "Party (1-4)" (up to 8); the controller mapping (the design doc's Platform and controls table is the binding one); "PC (keyboard & mouse)" (mouse is never required).
- Missing: the go-deeper choice screen, the trade window, the phone layout (all on sheet 06).

**[06: The run: choices, teamwork and trade](art/concept/06-run-choices.webp)**
- Use: all ten panels. The rest room with stash, gear rack, stairs down and portal home (panel 1); the go-deeper screen with the unbanked loot between the two choices (panel 2); the wipe (panel 3); the soak, freeze, shatter combo (panel 4); downed with the bleed-out ring and a teammate's pick-up bar (panel 5); the Guide's lantern, revealed floor, marked elite and rally point (panel 6); the corner HUD with three ability slots and the centre clear (panel 7); the Market Hall trade with two Ready toggles and the trade board (panel 9); the phone layout (panel 10).
- **The camera reference.** Its gameplay shots are low and close behind the players, the over-the-shoulder view Michael asked for on 2026-10-13. Where sheets 01 to 05 show gameplay from higher up, this sheet wins.
- **The controls reference.** Panel 8 is the design doc's control table; it replaces sheet 05 panel 8. Since 2026-10-13 the arrow keys turn the camera rather than move (design doc, Platform and controls).
- Fix when building: both go-deeper buttons show the same keys (E / A); each choice needs its own. A few small labels are garbled (panel 2's subtitle, panel 3's floor label). The 2% host cut is a placeholder; the design doc says only "a small cut".

**Candidates for the three reference models** (the guide's gate for the commission): the base adventurer from sheet 02 panel 1, the basic goblin from sheet 03 panel 2, and one building in its four regional styles from sheet 04 panel 3. Michael picks.

**Still missing after six sheets:** the Shieldbearer and war pig by name, the regional signature enemies, the Guide's lantern on the character sheet, a sword at tiers 1 to 5, cross-region gear, travelling merchant, visitors arriving. A seventh sheet could cover them with the same approach as sheet 6 (Part 2).

---

## Part 2: The prompts for ChatGPT

**How to use these.** Start a new ChatGPT conversation. Paste the master style block first, on its own, and send it. Then send one sheet prompt per message, in order. Ask for landscape, about 3:2. If an image drifts, reply with one of the fixes at the bottom rather than re-pasting everything.

A note on text: image models garble small text. The prompts keep labels to a few words each; expect to fix a few by hand or regenerate.

### Master style block (paste first)

```
I am making concept boards for HEARTHGATE, a browser co-op fantasy game for 1 to 8 friends: a cosy village you own, portals into short dungeon runs, and trading between four regions. I will send five sheet prompts, one at a time. Every image must follow this style:

FORMAT: one dense landscape concept board (about 3:2), dark warm-brown background (#2A2622) with thin brass (#C99A3B) dividers, a title banner across the top, and 8 to 10 numbered panels, each with a short title, a one-line subtitle and small captions under each picture, like a professional game art-direction sheet. Keep every label short (one to five words) and spelled correctly.

ART STYLE: real-time low-poly 3D game art. Flat-shaded faceted meshes, one solid colour per face, a slight vertex-colour gradient (lighter tops, darker bases). No painted textures, no photorealism, no brush strokes, no fine detail. Chunky, friendly proportions: characters about 4.5 heads tall with big heads, big hands, broad shoulders, short legs, oversized weapons and props. Exaggerated, instantly readable silhouettes.

MOOD: villages are warm, sunny, saturated and calm (warm sun #FFE3A3, soft sky-blue fill, soft short shadows). Dungeons are darker and cooler: torchlight pools, blue-green shadows, low floor fog, one accent colour per dungeon. Spooky-fun like a Saturday-morning cartoon. Never gore, never horror.

SHARED NEUTRALS for stone, wood and metal everywhere: Hearthstone #8A8578, Shadowstone #4E4A44, Oak #8B5A2B, Dark timber #5A3A22, Thatch #D9B26A, Iron #6E7378, Brass #C99A3B, Bone #EFE3C6, Ink #2A2622.

FOUR REGIONS, each one saturated palette on top of the neutrals:
- Verdant Vale (forest, meadows, mossy stone, amber): #6DBE45 #3F7D3A #E8A33C #A0522D #F2A7B8 #8FD3F4
- Emberreach (volcanic hills, dwarven stonework, gems): #F26B1D #FF3D1F #3B3236 #4B2E5C #B8ADA6 #F4C542
- Tidewater (coast, harbours, coral, pearls): #1FA3A0 #145C7A #FF7F6A #F4EFE6 #E8D3A2 #4F8A5B
- Frostmere (tundra, pine, standing stones, runes): #9FD8F0 #E6F6FF #2F5D50 #7B6FD6 #B08D6A #5B6B7A

CAMERA for gameplay shots: over-the-shoulder third person, low and close behind the player, a little above head height, looking past the shoulder into the scene with the far wall or horizon in view, like a modern action-adventure game. Not top-down, not isometric, not a high strategy view, not first person.

UI: warm wood and bone-coloured panels, chunky rounded corners, ink outlines, flat colour. HUD only in the four screen corners, centre kept clear. Buttons are big. Prompts show a keyboard key and a gamepad button, never a mouse cursor.

Do not copy any existing game's characters, logos or interface. Reply "Ready" and wait for the first sheet.
```

### Sheet 1: World and regions

```
SHEET 1. Title banner: "HEARTHGATE — 01: World, Regions & Mood". Tagline in the top-right corner: "Your village is yours. Other villages are worth visiting."

Panels:
1. VERDANT VALE VILLAGE — a wide establishing shot of a small village in a forest meadow: thatched cottages, mossy stone walls, amber lanterns, a river and mill, a glowing portal shrine at the centre. Caption: "Herbs, heartwood, amber".
2. EMBERREACH VILLAGE — the same village layout rebuilt in dwarven stone on volcanic hills, lava channels glowing in the distance, chimneys and forges. Caption: "Ores, gems, obsidian".
3. TIDEWATER VILLAGE — the same layout on a coastal harbour: piers, coral-pink roofs, fishing boats, pearl-white walls. Caption: "Pearls, coral, deep fish".
4. FROSTMERE VILLAGE — the same layout on snowy tundra among pines and standing stones with glowing violet runes. Caption: "Furs, runestones, frost crystal".
5. PALETTE STRIP — four columns of six colour swatches, one per region, with the region name above each, plus a row of nine shared neutral swatches labelled "Shared stone, wood, metal".
6. DAY TO NIGHT — one village shown in four small frames: morning, noon, dusk, night with warm window glow and the portal shrine shining. Caption: "Slow day-night cycle".
7. THE PORTAL SHRINE — a close-up of the shrine: a stone arch with a hearth-fire glow inside it opening onto a swirling dungeon view. Caption: "Every run starts and ends here".
8. MOOD SPLIT — a split image: the left half a sunny village path, the right half a torch-lit dungeon corridor with blue-green fog. Captions: "Calm between runs" / "Spooky-fun, never scary".
9. STYLE RULES — a small card of four icons with labels: "Flat-shaded facets", "Big silhouettes", "Shared neutrals", "No gore".
```

### Sheet 2: Characters, gear and hirelings

```
SHEET 2. Title banner: "HEARTHGATE — 02: Characters, Gear & Hirelings". Tagline: "Read your friends' loadouts at a glance."

Panels:
1. BASE CHARACTER — a turnaround (front, side, back) of one low-poly adventurer in plain clothes, about 4.5 heads tall, big hands and shoulders. Caption: "One simple rig for everyone".
2. GEAR SLOTS — the same character with five slots called out by arrows: Head, Chest, Legs, Weapon, Back. Caption: "Every slot changes the silhouette".
3. THREE STYLES — three characters side by side: Melee (sword and round shield), Ranged (bow and quiver), Magic (staff and floating rune). Caption: "Style comes from the weapon".
4. WEAPON CLASSES — a row of oversized low-poly weapons: one-handed sword, two-handed greatsword, war hammer, bow, staff, dagger. Short labels under each.
5. TIER PROGRESSION — one sword shown at five tiers, left to right, from a wooden practice sword to a glowing enchanted blade. Caption: "Tier 1 to 5".
6. REGIONAL SETS — four characters each wearing their home region's armour set: Verdant leaf-and-heartwood, Emberreach heavy plate with glowing seams, Tidewater coral-and-pearl, Frostmere fur with rune trims. Region names under each.
7. CROSS-REGION GEAR — a best-in-slot cloak of Frostmere fur lined with Verdant heartwood, and an Emberreach blade etched with a Frostmere rune. Caption: "The best gear is always mixed".
8. THE GUIDE — a veteran holding a big glowing lantern, a marked enemy icon floating nearby. Caption: "Veterans lead newer friends".
9. HIRELINGS — a tavern line-up of four hirelings on the same rig: a shieldbearer, an archer, a healer, a brawler, each with a small price tag. Caption: "Recruit at the tavern".
10. PARTY OF FOUR — an over-the-shoulder shot of four players in a dungeon, each with a different coloured outline (blue, gold, purple, teal) and a name tag above. Caption: "Outlines and name tags".
```

### Sheet 3: Enemies and combat readability

```
SHEET 3. Title banner: "HEARTHGATE — 03: Enemies & Combat Readability". Tagline: "Every enemy has one tell and one weakness."

Panels:
1. GOBLIN WARRENS LINE-UP — goblins small and hunched with huge ears and crude weapons, a taller Pack Leader with a banner, a war pig. Each labelled with its tell, for example "Banner glows: buffs the pack".
2. ARCHETYPES — three enemies with silhouettes alone, then coloured: the Shieldbearer behind a huge shield, the Charger heavy and low, the Pack Leader tall with a crest. Caption: "Readable as shapes first".
3. SHARED DUNGEON ENEMIES — skeleton shieldbearer and a wraith (Haunted Crypt), animated armour and an imp (Ruined Wizard Tower), a bandit archer (Bandit Fort). Cartoon-spooky, no gore.
4. REGIONAL SIGNATURES — a treant (Verdant), a forge golem with lava seams (Emberreach), a crab knight (Tidewater), a frost wight (Frostmere).
5. TELEGRAPHS — over-the-shoulder gameplay shot: a big enemy winding up while a red-orange cone fills inward on the floor in front of it, players dodging out. Caption: "Every heavy attack is drawn on the floor".
6. SIX STATES — six enemies or six icons, each with a colour and a shape: Soaked (blue droplets), Staggered (yellow stars), Marked (pink lantern sigil), Burning (orange flames), Rooted (green vines), Chilled (pale blue frost). Names under each.
7. COMBO — a three-step strip: one player soaks an enemy, a second freezes it, a third shatters it, with an escalating "COMBO x3" burst. Caption: "More friends, bigger payoff".
8. DOWNED AND REVIVE — a downed player crawling with a shrinking ring timer, a teammate kneeling to pick them up. Caption: "Downed, not dead".
9. HIT FEEDBACK — small frames of a white hit flash, a short knockback, chunky damage numbers, an enemy health bar over a head. Caption: "Clear, not cluttered".
10. BOSS ROOM — a large boss lit by one dramatic light source in the dungeon's accent colour, three phase icons below. Caption: "Three phases, new telegraphs each".
```

### Sheet 4: Village, buildings and the run loop

```
SHEET 4. Title banner: "HEARTHGATE — 04: The Village & The Run". Tagline: "Short runs, long game."

Panels:
1. STARTING VILLAGE — a raised view of a new village with only four buildings: Portal Shrine, General Store, Storehouse, Tavern, each labelled. Caption: "Day one".
2. GROWN VILLAGE — the same village much later: Forge, Apothecary, Enchanter, Market Hall, Guild Hall, Grand Bazaar added, banners, decorations, busy visitors. Caption: "Grows with every run".
3. BUILDING TIERS — one building (the Forge) shown at tier 1, tier 5 and tier 10, getting bigger, taller and more decorated. Caption: "Ten tiers per building".
4. BUILDING ICONS — a grid of eleven simple building icons with names: Portal Shrine, Tavern, General Store, Storehouse, Forge, Apothecary, Enchanter, Market Hall, Home, Guild Hall, Grand Bazaar.
5. PORTAL BOARD — the shrine with four floating portal cards, each showing a dungeon type, a tier number, a modifier icon and a bonus reward. Caption: "Pick a portal".
6. THE LOOP — a circular diagram: Village, Portal Shrine, Dungeon floor, "Go deeper?", Rest room, back to Village, with small pictures at each step.
7. REST ROOM — a party around a campfire in a dungeon alcove with a shared stash chest, two glowing choices: a staircase down labelled "Go deeper" and a portal home labelled "Bank & go home".
8. MARKET HALL TRADE — two players from different regions (their gear shows it) swapping items at a trade table, a trade board with pinned offers behind them. Caption: "Trade between regions".
9. TRAVELLING MERCHANT — a colourful cart with exotic goods from other regions arriving at the village gate. Caption: "One day a week".
10. VISITORS — a host welcoming three friends stepping out of a portal into their village, small region crests over the visitors' heads. Caption: "Friends visit your village".
```

### Sheet 5: HUD, menus and interaction

```
SHEET 5. Title banner: "HEARTHGATE — 05: HUD, Menus & Interaction". Tagline: "Four keys and a dodge. Big buttons, clear corners."

Panels:
1. COMBAT HUD — a full over-the-shoulder gameplay screenshot with the HUD only in the corners: top-left the player's health and party members' small bars; bottom-left the weapon and three ability slots with key labels (J, K, L, ;); bottom-right dodge, block and a potion slot; top-right floor number and a ping readout. Centre of the screen clear.
2. VILLAGE HUD — the same layout in the village, minimal: coin, region crest, an "E  Talk" prompt with a gamepad button next to it above an NPC.
3. CONTROLS — a clean card showing the keyboard (WASD, J, K, L, ;, Shift, Ctrl, E, Q) and a generic gamepad with the same actions labelled. Caption: "Keyboard or gamepad, no mouse needed".
4. INVENTORY — a chunky grid inventory with big square slots, the character in the middle with five gear slots, one item highlighted with a bold selection frame and its stats beside it. Caption: "Lists and grids, never hover".
5. ITEM CARD — one item card: a low-poly sword render, its name, tier badge, region tag, two stat lines and a cross-region recipe hint.
6. PORTAL BOARD MENU — a menu of four portal cards side by side, one selected and raised, with dungeon art, tier, modifier and reward.
7. GO DEEPER CHOICE — a two-button choice screen at a rest room: "Go deeper" (risk, +30% loot) and "Go home" (bank everything), with the unbanked loot shown between them.
8. TRADE WINDOW — two side-by-side panels of offered items, each with a big "Ready" toggle, region crests at the top.
9. NOTIFICATIONS — four small toast cards: "Combo x3", "Floor cleared", "Forge reached tier 3", "New visitor from Tidewater".
10. TOUCH LATER — a phone in landscape with the same HUD: a virtual stick bottom-left, three ability buttons bottom-right, every button at least 48 pixels. Caption: "Nothing blocks a touch layout".
```

### Sheet 6: The run, choices, teamwork and trade (follow-up)

Written after the first five came back, for what they missed, and updated here for the over-the-shoulder camera and its arrow-key binding. Send it in the same chat as the first five, or attach sheets 03 and 05 first in a new chat.

```
SHEET 6. Use the exact art style, board layout, fonts, colours and panel frames of the five Hearthgate sheets already made (dark board, cream panels with numbered tabs, faceted low-poly 3D, chunky 4.5-head characters, torch-lit dungeons with one accent colour). Title banner: "HEARTHGATE — H6 · THE RUN: CHOICES, TEAMWORK & TRADE". Tagline: "Go deeper, or go home?"

Gameplay shots use an over-the-shoulder camera, low and close behind the players. Party members always have a coloured outline and a name tag (Thorne blue, Lysa gold, Kael purple, Mara teal). Keep every label short and spelled exactly as written here.

Panels:
1. THE REST ROOM — a party of four around a campfire in a cosy dungeon alcove between floors: a shared stash chest, a weapon rack for swapping loadouts, and two glowing exits: a stone staircase leading down and a small portal home. Caption: "Bank, rest, decide".
2. GO DEEPER? — a choice screen over the rest room: on the left a big button "Go deeper" with a small note "+30% loot, risk unbanked loot"; on the right a big button "Go home" with "Bank everything". Between them a row of item icons labelled "Unbanked loot". Under each button its own keyboard key and gamepad button. Caption: "The decision every floor".
3. WIPE — the same party fading out of a dark dungeon and reappearing at the village portal shrine, a few loot icons crumbling to dust, the equipped weapons still in their hands. Caption: "Gear is kept, unbanked loot is lost".
4. COMBO — a three-step strip in one dungeon room: Lysa soaks a goblin brute with water (blue droplets), Kael freezes it (pale frost crystals), Thorne shatters it with a big swing; a bright burst reading "COMBO x3". Caption: "More friends, bigger payoff".
5. DOWNED & REVIVE — a downed player crawling on the floor with a shrinking ring timer around them, a teammate kneeling beside them with a short progress bar, and a small inset of a red "Revive Draught" potion. Caption: "Downed, not dead".
6. THE GUIDE — a veteran in a hooded coat holding a big glowing lantern; a faint map of the floor revealed in the air, a pink lantern sigil floating over an elite enemy, and a glowing banner planted on the floor labelled "Rally point". Caption: "Veterans lead newer friends".
7. CORNER HUD — a full gameplay screenshot with the HUD only in the corners and the centre third of the screen clear. Top-left: up to eight small party frames. Bottom-left: health bar and the weapon. Bottom-right: exactly three ability slots labelled K, L, ; with a dodge (Shift) and a potion slot (Q). Top-right: "Floor 2 / 4" and a small ping number. No minimap, no bottom-centre bar.
8. CONTROLS — a clean card with two columns, Keyboard and Gamepad: Move WASD / Left stick; Camera Arrow keys / Right stick; Attack J / X; Abilities K L ; / Y B RB; Dodge Shift / A; Block Ctrl / LB; Interact E / RT; Potion Q / D-pad. Caption: "No mouse needed".
9. MARKET HALL TRADE — two players from different regions (one in green Verdant gear, one in blue Tidewater gear) at a trade table; above them a trade window with two panels of offered items, a big "Ready" toggle under each, and a small "Host cut". Behind them a notice board with pinned offers labelled "Trade board". Caption: "Trade between regions".
10. PHONE LAYOUT — a phone held in landscape showing the same game: a virtual stick bottom-left, three large ability buttons and a dodge button bottom-right, party frames top-left, every button big and thumb-sized. Caption: "Touch later, nothing blocks it".

Do not add classes, jumping, a minimap, a world map, a quest log, level ranges, or a mouse cursor.
```

### Fixes when an image drifts

- **Too painterly or realistic:** "Too painterly. Redo as flat-shaded low-poly 3D: visible facets, one solid colour per face, no textures, no brush strokes."
- **Too dark or grim:** "Too grim. Villages are warm and saturated; dungeons are spooky-fun, not horror. Remove anything gory."
- **Wrong camera:** "Gameplay shots should be over the shoulder: low and close behind the player, looking past the shoulder into the room. Not top-down, not isometric, not a high view."
- **Garbled labels:** "Keep the same image but fix the labels; spell them exactly as: …"
- **Too sparse:** "Keep the style but fill every panel; this should be as dense as a professional art-direction sheet."
