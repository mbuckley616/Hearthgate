# Hearthgate: art direction style guide

The one page that gates every asset purchase and every model made in house. Approved by Michael on 2026-10-13, trimmed to a page on 2026-10-14. Drawn from the design doc's Art and audio direction section. The concept sheets, what each is for, and the ChatGPT prompts that made them are in [docs/art/concept/README.md](art/concept/README.md).

## The one-line pitch

Cosy low-poly fantasy: a warm, sunlit village you own, and portals into torch-lit dungeons that are spooky-fun, never scary. Bright, chunky and readable from an over-the-shoulder camera on a laptop or a phone.

## The biggest difference from The Old Gates

The Old Gates boards are painterly and near-realistic: textured cloth, brushed metal, cinematic lighting, parchment UI. Hearthgate is not that. Every image should look like a real-time low-poly 3D game: flat-shaded facets, solid colour per face, simple shapes, no painted texture. If a generated image could pass for a fantasy book cover, it is off-style.

## Style rules

1. **Low-poly, flat-shaded.** Visible facets, one colour per face, a little vertex-colour gradient (lighter at the top of a mesh, darker at the base). No photographic or hand-painted textures, no normal-map detail, no fur strands, no wood grain. A small colour-swatch texture (a gradient atlas, as the KayKit packs use) is fine: on screen it reads as one colour per face.
2. **Exaggerated silhouettes.** Big shoulders, big hands, wide weapons, oversized props (a mug the size of a head, a key the size of a forearm). Everything must read as a shape from across a dungeon room, seen from just behind the player's shoulder.
3. **Chunky proportions.** Characters about 4.5 heads tall: big head and hands, short legs, broad torso. Friendly, not chibi, not heroic-realistic.
4. **Shared neutrals, regional colour.** Stone, wood and metal use the same neutral palette everywhere; each region adds one saturated palette on top. A Verdant village and a Frostmere village must look like the same game.
5. **Two moods.** Village and overworld: warm sun, soft shadows, long sightlines, high saturation, calm. Dungeons: darker and cooler, torchlight, blue-green shadows, low fog, one accent colour per dungeon type. Spooky-fun like a Saturday-morning cartoon, never gore, never horror.
6. **Readability over detail.** Enemy attacks show as bright coloured shapes on the floor before they land. Party members wear a coloured outline and a name tag. Every enemy has one obvious tell and one visible weakness.
7. **Gear changes the silhouette.** Five gear slots (head, chest, legs, weapon, back) and each one visibly changes the outline, so friends can read each other's loadouts at a glance.
8. **Built cheaply.** Detail that a small team and asset packs can produce: low triangle counts, instanced props, no post-processing tricks the image depends on.

## Camera

Over the shoulder, in the manner of RuneScape: Dragonwilds (Michael, 2026-10-13; `decisions.md`): low and close behind the player, a little above head height, looking past the shoulder into the room, turned by the player. The horizon and the far wall are usually in view. Not top-down, not isometric, not a raised strategy view like Diablo or Baldur's Gate, not first person. Sheet 06 is the picture of it; the gameplay shots on sheets 01 to 05 sit too high.

## Palette

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

## Lighting

- **Village by day:** warm key sun `#FFE3A3` from high and to one side, soft sky-blue fill `#BFE3FF`, short soft shadows, a little haze at distance.
- **Village at dusk and night:** amber window glow, lanterns along paths, deep blue sky `#22305A`, the Portal Shrine as the brightest thing in town.
- **Dungeons:** torches as warm pools of light, everything between them in cool blue-green shadow, low fog on the floor; a cap of a few lights per room.

## UI direction

- Warm wood and bone-coloured panels with chunky rounded corners and an ink outline; flat colour, no parchment grain, no photo textures.
- A chunky, friendly serif for titles; a clean rounded sans for numbers and small labels.
- HUD lives in the four corners; the centre third of the screen stays clear.
- Every button at least 48 px; every prompt shows a keyboard key and a gamepad button (`E` / RT), never a mouse cursor or a hover tooltip.
- Menus are lists and grids moved through with arrows or a D-pad, with a bold highlighted selection.

## Do and do not

| Do | Do not |
| --- | --- |
| Flat-shaded facets, solid colours | Painted textures, photorealism, brush strokes |
| Chunky, friendly, exaggerated shapes | Realistic anatomy, gritty grimdark armour |
| Warm, saturated villages | Desaturated, muddy overworld |
| Spooky-fun dungeons with torchlight and fog | Gore, blood, horror faces, body horror |
| Bright floor telegraphs, outlines, name tags | Effects that hide the characters |
| Corner HUD, big buttons, key and gamepad prompts | Mouse cursors, hover tooltips, centre-screen clutter |
| Its own look | Copying any existing game's characters, logos or UI |

## Reference models and sources

**The three reference models** (Michael, 2026-10-13), cropped in `docs/art/reference-models/`: the base adventurer ([adventurer](art/reference-models/adventurer.png), sheet 02 panel 1; only the turnaround on the left, not the class silhouettes beside it), the basic goblin ([goblin](art/reference-models/goblin.png), sheet 03 panel 2), and one building in its four regional styles ([regional building](art/reference-models/regional-building.png), sheet 04 panel 3). Anything that would sit badly beside these three is off-style.

**Where the art comes from**

| What | Source | Status |
| --- | --- | --- |
| Player characters | [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) (CC0, rigged and animated, glTF), with the [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-character-animations) pack | Michael, 2026-10-14: an asset pack instead of a commission. The agent-built spike (`docs/art/spike/`) read too boxy beside the reference. |
| Enemies | Open: the spike's goblin read closer to its reference than the adventurer did | To decide with the environment pack |
| Dungeon and village kit | Open: a comparison of packs for Michael to pick from | Michael, 2026-10-14: options first |
| Layouts, terrain, scatter | Built in code (`shared/src/level.ts`) to these rules | As the design doc plans |

A pack is on-style if it matches the rules above beside the reference models; its own palette is retinted toward the shared neutrals and the region swatches where it does not.
