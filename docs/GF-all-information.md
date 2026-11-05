# Genesis Forge (GF) - ALL information

Compiled 2026-11-05 from the project docs. GF only (no GTS).


---

<!-- PAGE: core-forge -->

# Core Forge & Soul System

> The central machinery of the mod: craft spawn eggs using soul energy and mob loot, upgrade tiered spawners, capture creatures, and automate mining.

[← Back to index](../PROJECT.md)

## Overview
Genesis Forge revolves around harvesting and spending soul charge. Players craft a Genesis Forge block, power it with High Concentrated Soul Orbs, and use it to synthesize spawn eggs, duplicate captured mobs, or access high-capacity deep-storage blocks. Spawners come in four tiers, obey strict line-of-sight checks to prevent wall glitches, and can be toggled on or off with a sneak-click.

## Elements
| Element | Status | Added | Last changed | What it does |
|---|---|---|---|---|
| Genesis Forge | ✅ Active | 2026-10-21 | 2026-11-01 | Main machine block: crafts spawn eggs, clones Soul Balls, and holds storage. |
| High Concentrated Soul Orb | ✅ Active | 2026-10-21 | 2026-11-01 | Soul fuel item providing 25 charge to forges, or right-clicked for 0–75 XP levels. |
| Tier 1 Spawner (Iron) | ✅ Active | 2026-10-21 | 2026-10-30 | Base spawner crafted with iron bars and a soul orb. |
| Tier 2 Spawner (Gold) | ✅ Active | 2026-10-21 | 2026-10-30 | Faster, wider-range spawner. |
| Tier 3 Spawner (Diamond) | ✅ Active | 2026-10-21 | 2026-10-30 | Rapid high-output spawner with a sneak-click toggle. |
| Tier 4 Spawner (Netherite) | ✅ Active | 2026-10-21 | 2026-10-30 | Ultra-fast spawner capable of spawning Galaxium mini-bosses. |
| Soul Ball | ✅ Active | 2026-10-21 | 2026-10-30 | Captures mobs while preserving names, gear, health, trades, and variants. |
| Super Soul Ball | ✅ Active | 2026-10-21 | 2026-10-30 | Captures and permanently tames mobs (or makes them friendly companions). |
| Abyssal Pocket (Pocket Hole) | ✅ Active | 2026-10-21 | 2026-10-30 | 19x15 portable extra inventory that cannot be destroyed and is kept on death. |
| Abyssal Chest | ✅ Active | 2026-10-21 | 2026-10-30 | Deep storage holding 19x90 stacks with built-in search, sorting, and scrolling. |
| Abyssal Furnace | ✅ Active | 2026-10-21 | 2026-10-30 | 50x speed furnace (25 in / 25 out) fed automatically by chests above and below. |
| Block Drill & Markers | ✅ Active | 2026-10-21 | 2026-10-30 | Quarry system excavating rectangular areas defined by 4 corner markers. |

## Element details

### Genesis Forge
- **What it does:** The primary workstation block where spawn eggs and mod items are forged.
- **How it works:**
  - Has two main tabs: **Spawn Eggs** (crafts any creature's egg from loot, soul charge, and time; includes a 4-item queue and auto-craft toggle) and **Crafting** (all mod items).
  - Contains an internal 250 soul buffer charged by inserting Soul Orbs into the fuel slot.
  - Features 15 internal storage slots.
  - Can clone full Soul Balls: duplicating a captured creature costs 50 soul charge and takes 150 seconds.
- **Recipe (3x3):**
  - Top row: Beacon, Beacon, Beacon
  - Middle row: Sculk Catalyst, Enchanting Table, Sculk Catalyst
  - Bottom row: Netherite Block, Respawn Anchor, Netherite Block
- **Files:** `com.zeven.genesisforge.ForgeBlock`, `ForgeBlockEntity`, `ForgeMenu`, `client.ForgeScreen`.

### High Concentrated Soul Orb
- **What it does:** Currency item powering machines and granting player experience.
- **How it works:**
  - Placed in the fuel slot of the Genesis Forge, Omni Nexus, or Abyssal Furnace to give 25 soul charge.
  - Right-clicked by the player to release an XP orb granting equivalent to 0 to 75 experience levels.
- **Recipe (3x3):**
  - 5 Sculk Catalysts (corners and center) + 4 Nether Stars (edges). *(Updated 2026-11-01 from bottle of enchanting).*
- **Files:** `com.zeven.genesisforge.SoulOrbItem`.

### Tiered Spawners (Iron, Gold, Diamond, Netherite)
- **What they do:** Upgradable monster spawners with increased mob rates, larger limits, and smart positioning.
- **Stats by tier:**
  - **Tier 1 (Iron):** Range 16, 4 mobs per cycle, 200–800 ticks delay, spread 4, mob limit 6. *Recipe: 8 Iron Bars around 1 Soul Orb.*
  - **Tier 2 (Gold):** Range 24, 8 mobs per cycle, 100–400 ticks delay, spread 6, mob limit 12. *Recipe: 6 Gold Blocks + 2 Soul Orbs around Tier 1 Spawner.*
  - **Tier 3 (Diamond):** Range 32, 20 mobs per cycle, 40–160 ticks delay, spread 10, mob limit 32. Sneak + right-click toggles on/off. *Recipe: 4 Diamond Blocks (corners) + 4 Soul Orbs (edges) around Tier 2 Spawner.*
  - **Tier 4 (Netherite):** Range 48, 60 mobs per cycle, 14–54 ticks delay, spread 16, mob limit 96. Sneak + right-click toggles on/off. Has a 0.04% chance per spawn to roll a Galaxium mini-boss. *Recipe: 2 Netherite Blocks (top/bottom) + 6 Soul Orbs around Tier 3 Spawner.*
- **Line-of-Sight rules:** Every spawner (vanilla and tiered) performs raycasting. If a target position has no direct line-of-sight from the spawner block, it tests up to 24 adjacent free spots before canceling that individual mob spawn.
- **Safety:** Spawners cannot be destroyed by explosions and drop protected items.
- **Files:** `com.zeven.genesisforge.TieredSpawnerBlock`, `TieredSpawnerBlockEntity`, `SpawnerSwitch`, `mixin.BaseSpawnerMixin`.

### Soul Ball & Super Soul Ball
- **What it does:** Reusable mob containment spheres.
- **How it works:**
  - **Soul Ball:** Right-click any non-boss mob to capture it. Stores health, baby/adult status, variant, name, equipment, active potion effects, and villager trade data. Empty balls stack to 16. Right-click the ground to release, or right-click a spawner to place the mob inside.
  - **Super Soul Ball:** Same as Soul Ball, but releases the mob as a companion. Tameable creatures become tamed; untameable creatures are rendered permanently friendly, will never attack you, follow within 16 blocks, and fight hostiles for you.
  - **Restrictions:** Bosses, players, and Galaxium mobs cannot be captured. A configurable health limit is enforced.
- **Recipes:**
  - Soul Ball: 4 Tinted Glass + 4 Soul Orbs around 1 Sculk Catalyst.
  - Super Soul Ball: 4 Netherite Blocks + 4 Soul Orbs around 1 Soul Ball.
- **Files:** `com.zeven.genesisforge.SoulBallItem`, `SuperSoulBallItem`, `Companions`, `Tamer`.

### Abyssal Pocket, Chest & Furnace
- **Abyssal Pocket (Pocket Hole):**
  - Portable bag holding 19x15 slots (285 slots).
  - Blast-proof, lava-proof, fire-proof, never despawns, and remains in the player inventory across death. Empty ones stack to 64.
  - *Recipe:* 8 Super Soul Balls around 1 Ender Chest.
- **Abyssal Chest:**
  - Giant chest holding 19x90 slots (1,710 stacks).
  - Features real-time search, A-Z sorting, and smooth vertical scrolling.
  - Keeps all stored inventory intact when mined.
  - *Recipe:* 4 Netherite Blocks, 4 Abyssal Pockets, 1 Shulker Box (center).
- **Abyssal Furnace:**
  - High-speed smelting block with 25 input and 25 output slots.
  - Runs at 50x vanilla speed. Consumes 1 soul charge per 64 items smelted.
  - Automatically loads items from an Abyssal Chest placed directly above, and auto-ejects smelted items into an Abyssal Chest placed directly below.
  - Stores accumulated XP; pressing "Collect XP" spawns an orb containing all saved XP.
  - *Recipe:* 4 Netherite Blocks, 4 Abyssal Pockets, 1 Soul Campfire (center).
- **Files:** `com.zeven.genesisforge.PocketHoleItem`, `AbyssalChestBlock`, `AbyssalFurnaceBlock`.

### Block Drill & Drill Markers
- **What it does:** Large-scale automated area excavation.
- **How it works:**
  - Place 4 Drill Markers at the same Y level to define the corners of a rectangular region.
  - Place a Block Drill within 256 blocks of the markers.
  - The drill UI displays an interactive 3D rotation view of the selected zone, layer counts, and stop height settings.
  - Can drill downwards to bedrock or upwards to build height, in either normal or Silk Touch mode.
  - Excavation costs 1 soul charge per 256 blocks broken. Items automatically flow into adjacent chests, Abyssal Chests, or an Omni Nexus.
- **Recipes:**
  - Block Drill: 4 Respawn Anchors (corners), 4 Beacons (edges), 1 Abyssal Pocket (center).
  - Drill Markers (gives 4): Amethyst Shards + Crying Obsidian.
- **Files:** `com.zeven.genesisforge.DrillBlock`, `DrillMarkerBlock`, `DrillAreas`, `client.DrillRenderer`, `client.DrillScreen`.

### Settings Screen & Customize Tab
- **Settings Screen:** Accessed from the pause menu. Stores world-wide settings: crafting speed (25%–400%), soul cost percentage, ingredient amounts, allow bosses toggle, and maximum capture health. Also allows per-creature and per-spawner-tier overrides.
- **Customize Tab:** Inside the Genesis Forge. Allows modifying a captured mob inside a Soul Ball: alter equipment (25 charge/slot, 50 to lock drops), adjust health (25 charge), and apply potion effects up to level 255 with an option to hide particles.
- **Creature Registry (`creatures.json`):** Defines soul cost, time, and required loot items for all vanilla creatures; modded entities derive soul costs and crafting time dynamically based on max health.

## Related pages
- [Galaxium Material & Gear](./galaxium-gear.md) — Galaxium materials created using the high-tier soul infrastructure.
- [Omni Nexus](./omni-nexus.md) — The ultimate workstation that shares soul charge and storage compatibility.

## Topic history
- 2026-11-01 — High Concentrated Soul Orb: recipe updated to 5 Sculk Catalyst + 4 Nether Stars.
- 2026-10-30 — Spawners: implemented 24-spot raycasting line-of-sight check; added sneak-click on/off toggle for Tier 3 and 4.
- 2026-10-21 — Initial implementation of Forge, Soul Orbs, Spawners, Balls, and Abyssal Storage.


---

<!-- PAGE: omni-nexus -->

# Omni Nexus

> The ultimate monolithic station: combines and supersedes enchanting tables, anvils, grindstones, brewing stands, and beacons in a single 9-tab machine.

[← Back to index](../PROJECT.md)

## Overview
The Omni Nexus ("Stellar Atom" model surrounded by 7 orbiting cosmic rings) is an endgame multi-functional utility nexus. Powered by a stored reserve of up to 2,500 soul charge (fed using Soul Orbs), it offers deterministic high-level enchanting (up to level 255), free item renaming, complete durability restoration without anvil penalty caps, instant high-potency brewing, an unassisted 5-effect beacon, a massive 3,420-slot internal storage bank, and a 96-block mob suppression field.

## Elements
| Element | Status | Added | Last changed | What it does |
|---|---|---|---|---|
| Omni Nexus Block | ✅ Active | 2026-10-27 | 2026-11-01 | Main block; holds 3,420 items, suppresses mob spawns, and stores soul energy. |
| Enchant Tab | ✅ Active | 2026-10-27 | 2026-11-01 | Apply any enchantment up to level 255; can lower or remove levels. |
| Disenchant Tab | ✅ Active | 2026-10-27 | 2026-10-31 | Strips enchantments onto plain books or stores experience at 5x vanilla grindstone rates. |
| Repair Tab | ✅ Active | 2026-10-27 | 2026-10-30 | Completely repairs damaged items for soul charge without prior-work cost penalties. |
| Copy Book Tab | ✅ Active | 2026-10-27 | 2026-10-30 | Duplicates any enchanted book for its base soul creation cost. |
| Name Tab | ✅ Active | 2026-10-27 | 2026-10-30 | Renames any item for free (or clears custom names). |
| Brew Tab | ✅ Active | 2026-10-27 | 2026-10-31 | Instant-brews 8 potions of any vanilla or modded effect at levels I–V up to 10 minutes. |
| Arrows Tab | ✅ Active | 2026-10-27 | 2026-10-30 | Tips 16 arrows per potion with full duration. |
| Beacon Tab | ✅ Active | 2026-10-27 | 2026-10-30 | Emits up to 5 concurrent effects across a 256-block radius without requiring a mineral pyramid. |
| Craft Tab | ✅ Active | 2026-10-28 | 2026-11-01 | One-click crafting for all forge recipes and the 6 Enchanted Apple tiers. |

## Element details

### Omni Nexus Block & Features
- **Visual Design:** "Stellar Atom" with 7 rotating orbits.
- **Mob Suppression Zone:** Suppresses all natural hostile and passive mob spawns within a **96-block radius** around the block. Mob spawners, spawn eggs, and breeding remain fully functional within the field.
- **Soul Buffer:** Stores up to 2,500 soul charge (Soul Orbs placed in the slot or inside its storage add 25 charge each). Mining the Nexus preserves all stored soul charge and items intact.
- **Internal Storage:** Holds 3,420 slots (6 pages of 570 slots) equipped with full-text search, A-Z sorting, and smooth scrolling. The Nexus draws directly from its internal storage to supply ingredients for brewing, crafting, and book copying.
- **Recipe (3x3):**
  - Top row: Grindstone, Galaxium Ingot, Brewing Stand
  - Middle row: Galaxium Ingot, empty Abyssal Chest, Galaxium Ingot
  - Bottom row: Enchanting Table, Galaxium Ingot, Anvil
- **Files:** `com.zeven.genesisforge.nexus.OmniNexusBlock`, `OmniNexusBlockEntity`, `OmniNexusMenu`, `client.OmniNexusScreen`.

### Tab Breakdown

#### 1. Enchant
- Directly select any registered enchantment and target level without randomness.
- **Level Limits:** Up to 10x vanilla caps for standard gear, up to **50x vanilla caps (up to level 255)** on Galaxium gear. Modded enchantments maintain their own declared maximums.
- **Cost:** 1 soul charge per level for standard enchantments; 5 soul charge per level for treasure enchantments.
- **Modifying Levels:** Can de-level or completely remove an enchantment for 1 soul charge per level.
- **Conflict Handling:** Standard equipment respects vanilla conflict rules; Galaxium equipment permits conflicting enchantments (e.g., Silk Touch + Fortune, all Protections).

#### 2. Disenchant
- Free of soul charge.
- If a plain Book is provided in the book slot, the selected enchantment moves directly onto the book.
- If no book is present, the enchantment is dissolved into stored experience points at **5x the output of a vanilla grindstone**. Clicking "Collect XP" ejects all saved XP as a single combined experience orb.

#### 3. Repair
- Fully repairs any damaged tool or armor piece.
- Costs between 1 and 25 soul charge depending on missing durability.
- Eliminates the vanilla "Too Expensive" limit and does not increase the anvil prior-work penalty counter.

#### 4. Copy Book
- Place an enchanted book and a blank book to create an exact duplicate.
- Costs the same soul charge as enchanting the book from scratch in the Enchant tab.

#### 5. Name
- Allows renaming any item for free.
- Leaving the text box blank removes existing custom names and resets the item's original display name.

#### 6. Brew
- Select any active status effect, set potency from **Level I up to Level V**, and adjust duration up to **10 minutes** (1-minute steps with Shift).
- Chooses form factor: Drinkable, Splash, or Lingering.
- Produces **8 potions in 4 seconds**.
- **Cost:** 15 soul charge per potency level + 1 Galaxium Ingot + up to 8 glass bottles.

#### 7. Arrows
- Inserts any potion and normal arrows.
- 1 potion tips **16 arrows** at full duration without cauldron mechanics.

#### 8. Beacon
- Choose up to **5 concurrent status effects** (Speed, Haste, Resistance, Jump Boost, Strength, Regeneration, etc.).
- Covers a **256-block radius** affecting players, tamed pets, and companions.
- Requires no base pyramid.
- **Cost:** Consumes 10 soul charge per active effect immediately when engaged, and consumes maintenance charge once every 15 minutes.

#### 9. Craft
- Displays every Genesis Forge recipe and automates production using storage contents.
- Direct crafting station for the 6 Enchanted Apple variants:
  - Enchanted Golden Apple (100 charge)
  - Enchanted Iron Apple (50 charge)
  - Enchanted Emerald Apple (125 charge)
  - Enchanted Diamond Apple (250 charge)
  - Enchanted Netherite Apple (500 charge)
  - Enchanted Galaxium Apple (2,250 charge)

## Related pages
- [Galaxium Material & Gear](./galaxium-gear.md) — Galaxium gear relies on the Nexus for enchanting and repair.
- [Enchantment Reworks](./enchantment-reworks.md) — The mechanical overhauls enabled by Nexus high-level enchantments.

## Topic history
- 2026-11-01 — Enchanted Apple crafting recipes integrated into Nexus Craft tab.
- 2026-10-31 — Instant brewing system and arrow tipping station connected to Nexus storage.
- 2026-10-27 — Initial implementation of 9-tab Omni Nexus framework.


---

<!-- PAGE: galaxium-gear -->

# Galaxium Material & Gear

> The endgame cosmic tier: indestructible animated deep-space gear, multi-block vein miners, high-velocity weaponry, and the Galaxium Building Wand.

[← Back to index](../PROJECT.md)

## Overview
Galaxium represents the pinnacle tier above Netherite. Visually inspired by deep-space nebulas (navy/indigo base, violet wisps, magenta clouds, and glittering gold stars), every Galaxium item features a continuous 60-frame animation without harsh seams or mirrored textures. Galaxium tools and armor possess overwhelming power, built-in flight or immunities, customizable bonus switches, and complete immunity to despawning, fire, lava, and explosions.

## Elements
| Element | Status | Added | Last changed | What it does |
|---|---|---|---|---|
| Cosmic Converter | ✅ Active | 2026-10-23 | 2026-11-01 | One-use reactor that converts XP and soul charge into a Galaxium Ingot, then explodes. |
| Galaxium Ingot, Nugget & Block | ✅ Active | 2026-10-23 | 2026-10-30 | Core materials; block has 3,600,000 blast resistance and 4 rotatable seamless faces. |
| Galaxium Upgrade Template | ✅ Active | 2026-10-25 | 2026-11-01 | Smithing template dropped by Galaxium mini-bosses; upgrades Netherite to Galaxium. |
| Galaxium Armor Set | ✅ Active | 2026-10-25 | 2026-10-30 | Helmet (night vision), Chestplate (1.5x elytra + fire immunity), Leggings (uninhibited movement), Boots (fall protection). |
| Galaxium Tools (Pick, Axe, Shovel, Hoe) | ✅ Active | 2026-10-26 | 2026-10-31 | Vein mining up to 8,192 blocks, 3x3/5x5 break shapes, whole tree felling, and auto-replanting farmland. |
| Galaxium Weapons (Sword, Bow, Crossbow, Trident, Mace) | ✅ Active | 2026-10-26 | 2026-11-01 | High-base-damage weapons with custom animations, multi-rockets, chain lightning, and shockwaves. |
| Galaxium Building Wand | ✅ Active | 2026-10-28 | 2026-10-30 | Construction tool with Extend and Curve ramp modes fed directly from linked storage. |

## Element details

### Cosmic Converter
- **What it does:** The only machine capable of condensing energy into raw Galaxium.
- **How it works:**
  - Placed in the world and activated with a right-click.
  - Requires **500 player XP levels** and **250 soul charge** (fed via Soul Orbs).
  - Once started, initiates an unstoppable 30-second reaction with warning particles and sound.
  - At the end of 30 seconds, it **explodes** with an explosion power of 7.5 (damaging nearby entities and players) and drops exactly **one Galaxium Ingot**.
  - If broken mid-conversion, it immediately explodes with no ingot dropped.
- **Recipe:** 8 empty Abyssal Pockets around 1 Sculk Catalyst in the Genesis Forge.
- **Files:** `com.zeven.genesisforge.CosmicConverterBlock`, `CosmicConverterBlockEntity`, `CosmicConverterMenu`.

### Galaxium Ingot, Nugget & Block
- **Galaxium Ingot:** 128x128 animated texture, Epic rarity, fire/lava/explosion immune, never despawns.
- **Galaxium Nugget:** 9 craft into 1 ingot (and vice versa). Tagged under `#c:nuggets/galaxium`.
- **Galaxium Block:** Hardness 125, blast resistance 3,600,000, emits light level 12. Dragon-proof, wither-proof, piston-proof. Features 4 distinct procedural textures with mirrors and rotations so large walls have no tiling grid pattern.
- **Protection Rules:** Every Galaxium item, spawn egg, soul orb, and tiered spawner is tagged `#genesisforge:blast_proof`. Mobs cannot pick them up, and they will never be destroyed by world hazards.
- **Files:** `com.zeven.genesisforge.ModItems`, `ModBlocks`, `GfEvents`.

### Galaxium Upgrade Smithing Template
- **What it does:** Required component to upgrade Netherite gear to Galaxium in a smithing table.
- **Source:** Guaranteed drop from Galaxium mini-bosses (multiplied by Looting).
- **Duplication Recipe:** 7 Diamonds + 1 Galaxium Upgrade Template + 1 empty Abyssal Pocket gives 2 templates.
- **Upgrade Table Recipe:** Netherite piece (or Bow/Crossbow/Trident/Mace) + 1 Galaxium Ingot + 1 Template.

### Galaxium Armor
All armor pieces grant 2.5x netherite stats (Armor values: 7.5 / 20 / 15 / 7.5; total set armor 50, toughness 30, knockback resistance 100%). Total damage reduction caps at 80%.
- **Helmet:** Permanent clear Night Vision (applied without the screen icon or fog tint).
- **Chestplate:** Built-in Elytra flight with 1.5x glide speed; maintains climb momentum; permanent fire and lava immunity with clear vision through lava.
- **Leggings:** Immune to all movement slowdowns (cobwebs, sweet berry bushes, powder snow, soul sand, honey blocks, slime blocks).
- **Boots:** Safe falls up to 15 blocks; 75% reduction on any excess fall damage.
- **No Vanilla Tables:** Galaxium armor cannot be put in an Enchanting Table, Anvil, or Grindstone. All enchanting, renaming, and repairs must be performed in the Omni Nexus. Mending repairs Galaxium at 2.5x speed.
- **Files:** `com.zeven.genesisforge.GalaxiumArmor`, `GalaxiumArmorItem`, `client.GalaxiumArmorLayer`.

### Galaxium Tools & Weapons
Every tool features +75% attack/block reach (switchable) and a settings window opened with **Shift + Right-Click** in an inventory.
- **Galaxium Pickaxe:** 60 damage, 2.5x netherite mining speed. Built-in vein mining (connects up to 8,192 ores). With Efficiency 100+ mines in a 3x3 square; with Efficiency 200+ mines in a 5x5 square (both toggles independent).
- **Galaxium Shovel:** 50 damage. Excavates connected dirt and gravel pockets up to 256 blocks at once without damaging normal ground.
- **Galaxium Hoe:** 40 damage. Tills 3x3 areas into **Galaxium Farmland** (never dries out, cannot be trampled, crops grow 5x faster and drop 7.5x yields). Right-clicking ripe crops auto-harvests and replants connected crops of the same type.
- **Galaxium Axe:** 100 damage. Fells entire trees in a single strike (logs, leaves, vines, cocoa pods, bee nests, nether fungi, and giant mushrooms).
- **Galaxium Sword:** 75 damage. Sweep attack area expanded by 2.5x. Model has a sleek, lengthened blade.
- **Galaxium Bow:** 75 flat damage, draws 3.5x faster. Power enchantment adds +0.03x multiplier per level (at Power 250 deals 637.5 damage). Accepts Piercing and Infinity together.
- **Galaxium Crossbow:** 65 damage per arrow. Loads up to 12 arrows or fireworks simultaneously, reloads 2x faster, and fires up to 6 rounds per second. Firework rockets deal 15x damage and burst immediately on target impact.
- **Galaxium Trident (Blade Abyss):** 85 damage. Charges 3x faster, flies 5x faster. Riptide can be used anywhere (even mid-air in dry air). Thrown tridents return directly into their original inventory slot via Loyalty. Channeling triggers without thunderstorms, chaining lightning bolts to adjacent enemies.
- **Galaxium Mace (Abyss Fang):** 60 damage. Smash attack calculation counts every 0.35 block fallen as a full block step. Landed smashes unleash a shockwave dealing damage to every mob within a 5-block radius.
- **Files:** `com.zeven.genesisforge.tools.*`.

### Galaxium Building Wand
- **What it does:** Construction wand capable of placing hundreds of blocks in one action.
- **Modes:**
  - **Extend Mode:** Right-click a block face to duplicate that block layer across all adjacent identical blocks (up to 512 blocks).
  - **Curve Mode:** 3-click ramp builder. Click the base of a wall, click the top of the wall, then click the destination ground point to build a smooth concave ramp (up to 2,048 blocks changed).
- **Supply Linking:** Pulls construction blocks first from the player's inventory, then from any Abyssal Pockets in inventory, and finally from a linked Abyssal Chest or Omni Nexus up to 256 blocks away (Shift + Right-Click the target container to link).
- **Recipe:** 1 Galaxium Ingot centered above 2 Netherite Ingots.
- **Files:** `com.zeven.genesisforge.wand.GalaxiumWandItem`, `WandBuild`, `WandSupply`.

## Related pages
- [Omni Nexus](./omni-nexus.md) — Used for enchanting, repairing, and customizing Galaxium gear.
- [Enchantment Reworks](./enchantment-reworks.md) — The uncapped enchantments powering Galaxium's special abilities.

## Topic history
- 2026-11-01 — Piercing override added to allow bow usage.
- 2026-10-31 — Galaxium Mace shockwave fall step ratio tuned to 0.35 blocks.
- 2026-10-28 — Galaxium Building Wand Extend and Curve ramp modes finalized.
- 2026-10-25 — Full Galaxium armor and weapon suite implemented.


---

<!-- PAGE: galaxium-bosses -->

# Galaxium Mini Bosses

> Lethal variants of standard undead mobs equipped with maximum-tier Galaxium weaponry and armor, serving as the survival source for Galaxium Upgrade Templates.

[← Back to index](../PROJECT.md)

## Overview
Galaxium Mini Bosses are rare, dangerous endgame adversaries. They have a minute chance to emerge from Tier 4 Netherite Spawners or can be summoned directly in creative testing using specialized spawn eggs. Clad in complete Galaxium armor and wielding max-enchanted Galaxium swords or bows, they inflict terrifying cosmic fire burns and boast extensive health pools. Defeating one guarantees a Galaxium Upgrade Template drop.

## Elements
| Element | Status | Added | Last changed | What it does |
|---|---|---|---|---|
| Galaxium Zombie / Husk / Drowned / Zombie Villager | ✅ Active | 2026-10-29 | 2026-11-01 | Melee mini-bosses wielding Galaxium Swords with Sharpness 250 and cosmic fire. |
| Galaxium Skeleton / Stray / Bogged | ✅ Active | 2026-10-29 | 2026-11-01 | Ranged mini-bosses wielding Galaxium Bows with Power 250 and cosmic fire. |
| Galaxium Wither Skeleton | ✅ Active | 2026-10-29 | 2026-11-01 | Lethal Nether mini-boss wielding a Galaxium Sword with high reach. |
| Galaxium Boss Spawn Eggs (8 types) | ✅ Active | 2026-11-01 | 2026-11-01 | Creative-only items that spawn a full Galaxium mini-boss; dispenser compatible. |

## Element details

### Boss Encounter & Spawner Mechanics
- **Natural / Spawner Source:** A Tier 4 (Netherite) Spawner configured for any corresponding mob type has a **0.04% chance** per spawned entity to roll into a Galaxium Mini Boss instead (Zombified Piglins do not qualify).
- **Boss Atmosphere:** When a player comes within **48 blocks**, a purple boss health bar appears at the top of the HUD.
- **Persistence:** Galaxium mini-bosses will **never naturally despawn** under any circumstance.
- **Immunity to Capture:** Neither Soul Balls nor Super Soul Balls can capture a Galaxium mini-boss.

### Combat Stats & Gear
- **Health & Buffs:** Possesses **2.5x standard base mob health** along with permanent, un-clearable status effects:
  - **Speed II**
  - **Strength II**
  - **Resistance II**
- **Armor Loadout:** Equipped from head to toe in full Galaxium Armor (Helmet, Chestplate, Leggings, Boots). All armor is enchanted to the maximum Galaxium threshold:
  - Protection 200
  - Thorns 10 (no curses)
- **Weapon Loadouts:**
  - **Melee (Zombie, Husk, Drowned, Zombie Villager, Wither Skeleton):** Wields a Galaxium Sword enchanted with Sharpness 250 and Fire Aspect 100.
  - **Ranged (Skeleton, Stray, Bogged):** Wields a Galaxium Bow enchanted with Power 250 and Flame 100.
- **Cosmic Fire Hazard:** Their attacks inflict **Purple Cosmic Fire** lasting up to 400 seconds. Cosmic fire burns for 5% of max health per second, ignoring conventional armor and fire immunity.
  - *Counter:* Players must possess **Fire Resistance III or higher** (brewed via the Omni Nexus) to neutralize cosmic fire.

### Drops
- **Guaranteed Template:** Slaying a Galaxium mini-boss **always drops exactly 1 Galaxium Upgrade Smithing Template**.
  - The drop quantity can be multiplied by the player's weapon Looting enchantment level.
- **No Equipment Dropping:** Mini-bosses are strictly hardcoded to never drop their worn Galaxium weapons or armor upon death to prevent circumvention of the Cosmic Converter.

### Creative Spawn Eggs
- Added on 2026-11-01:
  1. `Galaxium Zombie Spawn Egg`
  2. `Galaxium Husk Spawn Egg`
  3. `Galaxium Drowned Spawn Egg`
  4. `Galaxium Zombie Villager Spawn Egg`
  5. `Galaxium Skeleton Spawn Egg`
  6. `Galaxium Stray Spawn Egg`
  7. `Galaxium Bogged Spawn Egg`
  8. `Galaxium Wither Skeleton Spawn Egg`
- **Behavior:**
  - Spawns the full adult mini-boss with complete equipment and stats (baby variations are forced into adults).
  - Can be used on land, in water, or loaded into automated dispensers.
  - Implemented as standalone items via `com.zeven.genesisforge.GalaxiumEggItem` (does not extend vanilla `SpawnEggItem`, ensuring it cannot be right-clicked onto spawners to alter spawner mob types).
  - Available exclusively in the Genesis Forge creative tab; cannot be crafted inside the forge or Omni Nexus.
- **Files:** `com.zeven.genesisforge.GalaxiumMobs`, `GalaxiumEggs`, `GalaxiumEggItem`.

## Related pages
- [Galaxium Material & Gear](./galaxium-gear.md) — The Galaxium Upgrade Templates dropped by mini-bosses are used to craft this gear.
- [Enchantment Reworks](./enchantment-reworks.md) — Explains the cosmic fire damage inflicted by mini-boss strikes.

## Topic history
- 2026-11-01 — Added 8 dedicated Galaxium mini-boss spawn eggs exclusively to the creative inventory.
- 2026-10-29 — Initial implementation of Galaxium mob overrides and Tier 4 spawner 0.04% chance roll.


---

<!-- PAGE: apple-trees -->

# Apple Trees & Wood Sets

> 13 custom orchard trees yielding edible metallic and cosmic apples, deep saturation reserves, full decorative wood sets, and flying or lava-sailing boats.

[← Back to index](../PROJECT.md)

## Overview
Genesis Forge introduces an entire botanical progression system built around specialized Apple Trees. From modest Iron Apple saplings found in abandoned mines to titanic 3x3 Mega Galaxium Apple trees, these trees continuously drop edible apples with powerful potion buffs. Surpassing vanilla hunger limits, any excess saturation gained from these apples is stored in a hidden saturation reserve that replenishes hunger as you take damage or sprint.

## Elements
| Element | Status | Added | Last changed | What it does |
|---|---|---|---|---|
| 13 Apple Tree Varieties | ✅ Active | 2026-10-22 | 2026-10-31 | Apple, Iron, Golden, Emerald, Diamond, Netherite, Galaxium + 6 Enchanted counterparts. |
| Metallic & Cosmic Apples (10 types) | ✅ Active | 2026-10-22 | 2026-11-01 | Consumable fruits providing high nutrition, multi-tier buffs, and saturation reserves. |
| Giant & Mega Trees (2x2 and 3x3) | ✅ Active | 2026-10-28 | 2026-10-31 | Multi-block sapling structures with massive trunks, broader crowns, and boosted apple yields. |
| Orchard Harvesting & Worldgen | ✅ Active | 2026-10-24 | 2026-10-30 | Natural plains tree replacement, structure loot chests, and persistent ground fruit drops. |
| Specialized Wood Sets & Boats | ✅ Active | 2026-10-26 | 2026-10-30 | Indestructible wood tiers, lava-sailing boats, and flying Galaxium vessels. |

## Element details

### The 13 Tree Varieties
1. **Apple Tree** (Vanilla-adjacent domestic apple wood)
2. **Iron Apple Tree**
3. **Golden Apple Tree**
4. **Emerald Apple Tree**
5. **Diamond Apple Tree**
6. **Netherite Apple Tree**
7. **Galaxium Apple Tree**
8. **Enchanted Iron Apple Tree**
9. **Enchanted Golden Apple Tree**
10. **Enchanted Emerald Apple Tree**
11. **Enchanted Diamond Apple Tree**
12. **Enchanted Netherite Apple Tree**
13. **Enchanted Galaxium Apple Tree**

Each variety features a full matching block suite: Log, Wood, Stripped Log, Stripped Wood, Planks, Stairs, Slab, Fence, Fence Gate, Door, Trapdoor, Button, Pressure Plate, Sign, Wall Sign, Hanging Sign, Leaves, Sapling, Potted Sapling, Boat, and Chest Boat.

### Apple Types, Nutrition & Potion Buffs
All apples can be consumed even when the player's hunger bar is completely full. Any excess saturation overflowing the food bar is automatically stored in a hidden **Saturation Reserve**, which feeds the player's stamina as needed.

| Apple | Hunger / Saturation | Potion Effects & Durations |
|---|---|---|
| **Iron Apple** | 4 / 7 | Speed I (30 s), Haste II (60 s) |
| **Emerald Apple** | 5 / 12 | Luck I, Hero of the Village II (60 s) |
| **Diamond Apple** | 6 / 16 | Resistance I (90 s), Strength I (30 s), Regeneration I (20 s) |
| **Netherite Apple** | 8 / 20 | Resistance I, Strength I, Regeneration II, Fire Resistance I |
| **Galaxium Apple** | 16 / 50 | Resistance II, Strength II, Regeneration II, Fire Resistance II, Speed II, Haste IV, Absorption V, Water Breathing, Saturation |
| **Enchanted Iron** | 4 / 25 | Speed II, Haste III, Jump Boost II, Water Breathing |
| **Enchanted Emerald** | 5 / 35 | Luck III, Hero of the Village V, Resistance III (300 s) |
| **Enchanted Diamond** | 6 / 50 | Resistance II, Strength II (300 s), Health Boost II |
| **Enchanted Netherite**| 8 / 100 | Resistance II (600 s), Strength II, Regeneration III, Health Boost III, Fire Resistance II (600 s) |
| **Enchanted Galaxium** | 16 / 250 | Resistance IV, Strength V, Regeneration IV, Fire Resistance V, Speed V, Absorption V, Haste IV, Health Boost V, Conduit Power V, Saturation V (900 s / 15 minutes) |

- **Crafting:** Standard metallic apples are crafted by surrounding a normal apple with 8 corresponding ingots or gems in a crafting table. Enchanted apples are crafted in the Omni Nexus Craft tab using soul charge.

### Growth Rates & World Generation
- **Growth Delays:** Trees grow slower than standard oak trees:
  - Apple: 2x slower
  - Iron: 3x slower
  - Golden / Emerald / Diamond: 5x slower
  - Netherite: 10x slower
  - Galaxium: 25x slower
  - Enchanted tiers: 20x to 150x slower
- **Bone Meal:** Bone meal accelerates growth with a success probability of `0.45 / slowness_multiplier`.
- **Dimension Tolerance:** Only Netherite and Galaxium trees can be planted and grown in the Nether and the End dimensions.
- **World Generation:** Approximately **35% of vanilla oak trees in Plains biomes** are replaced with standard Apple Trees.
- **Loot Distribution:** Rare saplings generate in dungeon chests, abandoned mineshafts, shipwrecks, buried treasure, nether fortresses, bastions, ancient cities, and ominous trial chambers.

### Fruit Drop Mechanics
- A naturally grown tree standing over clear grass continuously sheds fruit.
- **Normal Trees:** Requires a 5x5 grass clearing beneath the canopy; drops 0–3 apples every 60–180 seconds.
- **Enchanted Trees:** Drops 0–7 apples every 45–120 seconds (with a 20% chance of yielding an enchanted apple).
- **Despawn Protection:** Dropped apples from orchard trees are permanently protected and will **never despawn** on the ground.
- **Leaves:** Breaking leaves yields a 10% chance for an apple and a 2% chance for a sapling (multiplied by Fortune).

### Giant & Mega Trees
- **2x2 Giant Tree:**
  - Plant 4 saplings of the same type in a 2x2 square. Requires a 6x6 clear grass base.
  - Apply exactly **8 bone meal**. *(DECIDED 2026-11-05, not built yet: change to exactly 8x one sapling's average bone meal for that tree type, e.g. Apple 72, Netherite 352, Galaxium 888.)*
  - Grows an 8–10 block tall trunk with a wide domed canopy.
  - Yields **2.5x more apples** from passive drops and leaf shearing.
- **3x3 Mega Tree:**
  - Plant 9 saplings of the same type in a 3x3 square. Requires a 7x7 clear grass base.
  - Apply exactly **24 bone meal**. *(DECIDED 2026-11-05, not built yet: change to exactly 24x one sapling's average, e.g. Apple 216, Netherite 1,056, Galaxium 2,664.)*
  - Grows a 15–20 block tall trunk with an enormous canopy.
  - Yields **2x more apples** from passive drops.
- **Fruiting Log:** Giant and Mega trees register the north-west bottom trunk log as the dedicated fruiting origin to coordinate drop cycles.

### Wood Durability & Custom Boats
- **Hardness:** Wood block hardness scales proportionally: `oak_hardness * 2 * (material_hardness / 1.5)`. Enchanted Netherite, Galaxium, and Enchanted Galaxium logs/planks cannot be blown up, burned by fire, or shifted by pistons.
- **Lava Sailing:** Netherite and Galaxium boats sail smoothly across lava oceans; riders are completely protected from burning while seated inside.
- **Galaxium Flying Boat:** Features built-in slow falling; holding the **Spacebar** allows the boat to rise into the sky, granting controllable multi-passenger flight.

## Related pages
- [Core Forge & Soul System](./core-forge.md) — How saplings and fruits can be recycled or cloned.
- [Omni Nexus](./omni-nexus.md) — Crafting station for Enchanted Apples.

## Topic history
- 2026-11-01 — Enchanted Galaxium Apple: updated to grant Regeneration IV.
- 2026-10-31 — Giant trees: tuned bone meal consumption to 8 (for 2x2) and 24 (for 3x3); confirmed 15-20 trunk height for 3x3.
- 2026-10-30 — Implemented fruiting-log recovery and protected fruit drops.


---

<!-- PAGE: enchantment-reworks -->

# Enchantment Reworks

> Beyond vanilla constraints: uncapped levels up to 255, progressive tier-based perks, purple cosmic fire, and extensive quality-of-life enhancements.

[← Back to index](../PROJECT.md)

## Overview
Genesis Forge substantially expands the vanilla enchantment system. Rather than providing linear stat increases that break past level V, enchantments scale gracefully up to level 255 (when applied via the Omni Nexus). At high tiers, enchantments unlock completely new passive abilities such as swimming in lava, permanent stealth while sneaking, hunger suppression, and immunity from aquatic predators. Every Galaxium item includes an in-game settings screen allowing players to individually toggle each enchantment bonus on or off.

## Elements
| Element | Status | Added | Last changed | What it does |
|---|---|---|---|---|
| Mending Overhaul | ✅ Active | 2026-10-27 | 2026-10-31 | Multiplies incoming XP and enables instantaneous orb absorption. |
| Cosmic Fire & Fire Aspect / Flame | ✅ Active | 2026-10-27 | 2026-11-01 | Area sweep combustion and percentage-based purple cosmic burn. |
| Protection & Armor Reworks | ✅ Active | 2026-10-27 | 2026-10-30 | Percentage damage mitigation up to 99% and hunger drain reduction. |
| Movement Reworks (Depth Strider, Soul Speed) | ✅ Active | 2026-10-27 | 2026-10-30 | Lava mobility, soul-block regeneration, and clearing thick Nether fog. |
| Vision & Stealth (Respiration, Swift Sneak) | ✅ Active | 2026-10-27 | 2026-10-30 | Clear underwater sight, guardian pacification, and crouched mob invisibility. |
| Combat Reworks (Sharpness, Bane, Sweeping, Looting) | ✅ Active | 2026-10-27 | 2026-10-31 | Flat damage scaling, universal debuffs, wider sweeps, and uncapped loot multipliers. |
| Projectile Reworks (Infinity, Channeling, Piercing) | ✅ Active | 2026-10-27 | 2026-11-01 | Free tipped arrows/rockets, chain lightning, and bows accepting Piercing. |
| Diminishing Returns Conversions | ✅ Active | 2026-10-27 | 2026-10-30 | Riptide, Quick Charge, Wind Burst, Frost Walker, and Lure bonus conversions. |

## Element details

### Mending Overhaul
- **Weapon Bonus:** While holding a Mending tool/weapon in hand, gain **+0.5x additional XP** from mob kills and mined blocks per level.
- **Armor Bonus:** Each armor piece with Mending adds **+0.025x XP multiplier** to all collected experience orbs (all 4 pieces sum together). Weapon and armor bonuses multiply.
- **Rapid Pickup:** If all 4 equipped armor pieces possess Mending V or higher, the player absorbs nearby XP orbs **12.5x faster**, preventing orbs from bobbing or lagging behind when flying with an Elytra.

### Fire Aspect, Flame & Purple Cosmic Fire
- **Area Sweep Fire:** At **Level 25+**, Fire Aspect ignites every single mob struck within the sword's sweep radius.
- **Cosmic Fire Activation:** At **Fire Aspect 75+** or **Flame 50+**, burning changes to **Purple Cosmic Fire**.
- **Cosmic Fire Properties:**
  - Deals **5% of the entity's maximum health per second**.
  - Completely bypasses armor protection values and vanilla fire immunity (blazes, wither skeletons, and nether mobs take full damage).
  - Boss mobs (Ender Dragon, Wither, Elder Guardian) have a safeguard cap: they take at most 1% max health per burn tick for 20 seconds.
  - *Countermeasure:* Only **Fire Resistance III or higher** (brewed via the Omni Nexus) can extinguish or protect against cosmic fire.

### Protection & Bane of Arthropods
- **Protection:** Each level on an armor piece reduces final incoming damage by 0.05% (hard-capped at a maximum of 99% total damage reduction). Additionally reduces player hunger depletion by **-0.2% per level** across all armor pieces.
- **Bane of Arthropods:** Repurposed to affect **all mob types**, not just arthropods. Every strike inflicts Slowness or Weakness for 1 second per level. Potency escalates at levels 50, 100, 150, and 200+. Level 75+ adds a chance to inflict lethal Poison.

### Depth Strider & Soul Speed
- **Depth Strider:** Grants +0.02x swim speed per level. At **Level 25+**, walking through lava feels like walking through water. At **Level 150+**, the player can freely swim through lava as if it were water.
- **Soul Speed:** While walking on soul sand or soul soil, heals the player for **0.1 HP per second per level**. At **Level 25+**, completely lifts the thick red fog in the Nether dimension for crystal-clear vision.

### Respiration & Swift Sneak
- **Respiration:** At **Level 25+**, clears underwater murkiness for full day-like vision underwater. At **Level 100+**, grants **Sea Peace**: Guardians, Elder Guardians, and Drowned become passive toward the player, and Elder Guardians will not inflict Mining Fatigue.
- **Swift Sneak:** Reduces incoming damage by -0.2% per level while sneaking. At **Level 100+**, hostile mobs completely lose track of the player while crouching, allowing players to walk undetected past enemies.

### Weapon Enchantments (Sharpness, Sweeping, Looting)
- **Sharpness:** On Galaxium swords and axes, grants **+1 flat attack damage per level** (vanilla only gives +0.5).
- **Sweeping Edge:** Expands the sweep attack damage radius by **+0.025x per level**.
- **Looting:** Rare drop chances scale via `chance * (1 + 0.05 * level)`. At **Level 100+**, grants a scaling percentage chance to multiply dropped item stacks with no upper ceiling.

### Projectile Enchantments (Infinity, Channeling, Piercing)
- **Infinity:** Adds +1 damage per level to arrows. At **Level 10+**, the bow fires even if the player has 0 arrows in their inventory. At **Level 50+**, special ammunition (tipped arrows, spectral arrows, and crossbow fireworks) is not consumed when shot.
- **Channeling:** Triggers during clear weather without thunderstorms. Level 1 summons 1 bolt. Each additional level summons **+1 extra lightning bolt** (dealing 40% damage) that chains to the nearest mob within range.
- **Piercing:** Modified via a data override (`data/minecraft/enchantment/piercing.json`) so it can be legally applied to normal standard bows, not just crossbows.

### Capped Scaling Conversions
To prevent game-breaking physics at level 255, certain enchantments cap their primary mechanic and convert higher levels into direct stat bonuses:
- **Riptide:** Launch power caps at level 15; each level above adds +5% trident impact damage.
- **Quick Charge:** Instantaneous loading achieved at level 5; each level above adds +1% damage.
- **Lure:** Catch delay caps at level 5; each level above adds a 10% chance to haul up an extra item.
- **Wind Burst:** Smash launch height caps at level 5; each level above adds +1 block of fall distance tolerance before fall damage begins.
- **Frost Walker:** Ice radius caps at level 16; each level above increases movement speed while running across ice.

## Related pages
- [Omni Nexus](./omni-nexus.md) — The station used to reach levels up to 255.
- [Galaxium Material & Gear](./galaxium-gear.md) — Explains the in-inventory toggle panel for these perks.

## Topic history
- 2026-11-01 — Piercing: added data tag override enabling compatibility on bows.
- 2026-10-31 — Mending: implemented 12.5x fast pickup trigger when wearing full Mending V+ armor.
- 2026-10-27 — Full suite of uncapped enchantment perks and cosmic fire damage mechanics implemented.


---

<!-- PAGE: development-workflow -->

# Development & Workflow

> Technical specifications, asset pipeline, unit test suites, build scripts, and guidelines for maintaining Genesis Forge across sessions.

[← Back to index](../PROJECT.md)

## Overview
Genesis Forge is a high-complexity Java mod built on NeoForge 21.1.262 and Minecraft 1.21.1 utilizing MixinExtras and Mojang official mappings. The project contains approximately 182 Java source files and over 2,600 resources. Because files are deployed across development environments, strict file size, packaging, and texture constraints must be maintained.

## Elements
| Element | Status | Added | Last changed | What it does |
|---|---|---|---|---|
| Build & Packaging Pipeline | ✅ Active | 2026-10-21 | 2026-11-02 | Compiles Java classes, packs the jar with `zip -9`, and enforces the 30 MB bridge cap. |
| Verification Test Harness | ✅ Active | 2026-10-25 | 2026-11-02 | Standalone unit tests for tree geometry and crafting templates. |
| Texture & Data Generators | ✅ Active | 2026-10-24 | 2026-11-02 | Python scripts generating tree textures, Galaxium items, and data registries. |
| Working Guidelines & Quality Rules | ✅ Active | 2026-10-21 | 2026-11-02 | Core rules for texture design, user communication, and safe file deployment. |
| In-Game Testing Checklist | 🧪 In progress | 2026-10-30 | 2026-11-02 | List of newly added features awaiting live client verification. |

## Element details

### Build & Packaging Pipeline
- **Target Stack:** NeoForge 21.1.262, Minecraft 1.21.1, Java 21, Mojang official mappings.
- **Jar File Constraint:** The mod jar must remain strictly under the **30 MB device bridge upload limit** (current build: ~26.8 MB).
- **Packaging Steps:**
  1. Compile source files: `/tmp/gf/build.sh`.
  2. Optimize all PNG assets losslessly using `oxipng`.
  3. Package classes and assets with maximum compression:
     ```bash
     cd /tmp/gf/build/classes && rm -f genesisforge-1.0.0.jar && zip -qr -X -9 genesisforge-1.0.0.jar .
     ```
  4. Deploy to target mod directory: `C:\Users\USER\curseforge\minecraft\Instances\5423\mods\genesisforge-1.0.0.jar`.
- **Precaution:** Never replace or overwrite the jar file while the Minecraft client is currently running.

### Verification Test Harness
Automated checks must pass before producing a release build:
1. **Resource Integrity:** Run `res_check.py` to confirm all blockstates, models, and localization entries match.
2. **Tree Data Validator:** Run `treegen/check.py` to ensure configured feature JSON files correctly reference valid placed features.
3. **Mixin Check:** Run `verify_mixins.py` to verify that method targets and bytecode descriptors exist in NeoForge/Minecraft classes.
4. **Unit Tests (`/tmp/gf/test3`):**
   - Run tests with `CP=../build/classes:$(cat ../cp.txt):../test/stub:.`.
   - `GiantShape` tree math is pure logic and must be tested in isolation; **never** load Minecraft `Feature` classes inside standalone unit tests to prevent NeoForge `LoadingModList` NullPointerExceptions.
   - Run `TemplateRecipeTest` from the project root.

### Texture & Data Generation Pipeline
- **Generator Chain:**
  - `treegen/gen_tex.py` (generates bark, wood, and leaf textures)
  - `ench/galitems.py` (generates procedural 60-frame animated Galaxium textures)
  - `ench/boatgen.py` (generates boat texture models)
  - `oxipng` (lossless optimization)
- **Data Generators:**
  - `treegen/gen_data2.py`
  - `gen_lang.py`
  - `gen_loot.py`
- **Animated Texture Rule:** Every animated texture `.mcmeta` file must explicitly define width and height to prevent mipmapping texture tears.

### Working Guidelines (Zeven's Preferences)
1. **Show Concepts & Involve the User:** Present visual previews and clear choices; ask questions whenever requirements or numbers are fuzzy. Do not finalize or install unreviewed design overhauls without approval.
2. **Galaxium Aesthetic Standards:** Galaxium textures must have no harsh light or dark border seams, tiling lines, or mirrored faces.
3. **Symmetry & Smoothness:** Custom geometric designs and models must follow smooth, organic curvatures.
4. **Honesty Regarding In-Game Status:** Clearly communicate what was verified via compiler/unit tests versus what has not yet been launched and tested in an active Minecraft client.

### In-Game Testing Checklist (Untested in Client)
The following recently added mechanics pass compilation and unit tests, but require in-game survival verification:
- [x] Giant tree 2x2 growth — works (2026-11-05). CHANGE REQUESTED: bone meal must be 8x one sapling's average (see Giant & Mega Trees).
- [x] Mega tree 3x3 growth and 15–20 trunk height — works (2026-11-05). CHANGE REQUESTED: bone meal must be 24x one sapling's average.
- [x] North-west fruiting-log recovery and passive fruit drop cycles — works (2026-11-05).
- [x] Spawner 24-spot raycasting line-of-sight checks preventing wall spawning — works (2026-11-05).
- [x] Sneak-right-click on/off toggles on Diamond and Netherite spawners — works (2026-11-05).
- [ ] Dispensers correctly firing Galaxium mini-boss spawn eggs.
- [x] Bows shooting arrows with the overridden Piercing enchantment — works (2026-11-05).
- [x] Omni Nexus instant brewing and 256-block beacon coverage — works (2026-11-05).

## Related pages
- [Core Forge & Soul System](./core-forge.md) — The core machines built through this pipeline.
- [Galaxium Material & Gear](./galaxium-gear.md) — The gear set relying on the texture generator.

## Topic history
- 2026-11-02 — Full documentation index and topic pages established from master handoff doc.


---

<!-- PAGE: gf-new-ideas -->

# GF: New Ideas

> A starter page for new Genesis Forge features. Nothing here is built yet. Each idea gets its own page once we start building it.

[← Back to index](../PROJECT.md)

## Overview
These are 4 ideas the user picked on 2026-11-05. Each one is only a short note for now: what the idea is, one question we still need to answer, and its status. Later we fill in the details together, one idea at a time.

## Elements
| Element | Status | Added | Last changed | What it does |
|---|---|---|---|---|
| Galaxium Final Boss | 💡 Idea, not built | 2026-11-05 | 2026-11-05 | A big boss you can only summon after beating all 8 mini-bosses. |
| New Omni Nexus Tab | 💡 Idea, not built | 2026-11-05 | 2026-11-05 | A 10th tab for the Omni Nexus station. |
| New Galaxium Weapon or Tool | 💡 Idea, not built | 2026-11-05 | 2026-11-05 | One more item for the Galaxium gear set. |
| More Enchantment Reworks | 💡 Idea, not built | 2026-11-05 | 2026-11-05 | Rework more vanilla enchantments, like the ones already done. |

## Element details

### Galaxium Final Boss
- **Idea:** One big final boss. You can only summon it after you have beaten all 8 [Galaxium mini-bosses](./galaxium-bosses.md).
- **Open question:** How do you summon it? With an item made from the mini-bosses' drops, or with a special altar block?
- **Status:** 💡 Idea, not built

### New Omni Nexus Tab
- **Idea:** Add a 10th tab to the [Omni Nexus](./omni-nexus.md), which already has 9 tabs (enchant, disenchant, repair, brew, beacon and more).
- **Open question:** What should the new tab do?
- **Status:** 💡 Idea, not built

### New Galaxium Weapon or Tool
- **Idea:** One more item for the [Galaxium gear set](./galaxium-gear.md), next to the sword, bow, crossbow, trident, mace, the 4 tools and the Building Wand.
- **Open question:** Is it a weapon (for fighting) or a tool (for mining or building)?
- **Status:** 💡 Idea, not built

### More Enchantment Reworks
- **Idea:** Rework more vanilla enchantments in the same style as the ones on the [Enchantment Reworks](./enchantment-reworks.md) page (new powers at high levels, up to 255).
- **Open question:** Which enchantments come next? (For example Unbreaking, Efficiency, Fortune or Thorns.)
- **Status:** 💡 Idea, not built

## History
- 2026-11-05 — Page created with 4 starter ideas (final boss, new Nexus tab, new Galaxium item, more enchantment reworks).


---

<!-- PROJECT.md (index, full copy) -->

# Modpack 5423 — Main Project Index

> The unified development and design index for CurseForge Instance 5423, housing the two primary custom NeoForge mods: **Genesis Forge** and **GTS Giantess Mod**.

## Quick facts
| | |
|---|---|
| Project / Instance | CurseForge Instance 5423 |
| Game Version | Minecraft 1.21.1 |
| Mod Loader | NeoForge 21.1.262 |
| Active Custom Mods | `genesisforge-1.0.0.jar` & `gts-3.1.1-neoforge-1.21.1.jar` (build cuddle184) |
| Target Java | Java 21 |
| Status | Playable / Active Development (awaiting in-game test runs) |

## How to run it
1. In CurseForge, launch instance **5423** on Minecraft 1.21.1 with NeoForge 21.1.262.
2. Verify both custom mod jars are present in `mods/`:
   - `genesisforge-1.0.0.jar`
   - `gts-3.1.1-neoforge-1.21.1.jar`
3. Enter a test world to verify gameplay systems, spawn eggs, and custom UI screens.

## Where we stopped
- **Last done (2026-11-05):** Installed step 1 of the drool/spit BUILD PLAN into the GTS jar (textures only, no code): streaky drool layers 60% to 98% solid, saliva liquid that looks like the layers (slow sliding animation), new drool look on players/mobs for levels 1-5. Hash-checked; old jar backed up in `ZevenBackups\5423`.
- **Next up:** Test step 1 in game; then step 2 of the BUILD PLAN (sink into drool + slowness per layer). The full drool/spit design is decided — see "Ideas for later".
- **Before that:** Fixed the `RegisterEvent` crash in `TamedGtsDroolVein$VeinBlock.randomTick` (where an instance-method local variable shift `aload_1/aload_2` passed `BlockState` instead of `ServerLevel/BlockPos`, which also caused cascade `NullPointerException` errors in `sizeable_foliage`, `genesisforge`, and `antarchy` during block registration). Restored `TamedGtsDroolVein$VeinBlock.class` to its clean original bytecode (which already checks all 6 neighbor directions for connected saliva liquid) and verified all 54 mod jars in the pack.
- **Next up:** In-game test run in client to test the balanced grab, in-hand holding, stomach weapons, absorption hearts, and saliva-logged drool veins.
- **Open questions:** Confirm whether Mira's drone spawn should remain permanent spits; verify 30 MB jar bridge limit before pushing future Genesis Forge builds.

## Pages
| # | Page | What's inside | Status | Last changed |
|---|---|---|---|---|
| 1 | [GF: Core Forge & Soul System](./docs/core-forge.md) | Genesis Forge block, Soul Orbs, 4 Spawner tiers, Soul Balls, Abyssal Storage, and Block Drill | ✅ Active | 2026-11-02 |
| 2 | [GF: Galaxium Material & Gear](./docs/galaxium-gear.md) | Cosmic Converter, Galaxium ingots/blocks, complete armor & tool set, and Building Wand | ✅ Active | 2026-11-02 |
| 3 | [GF: Omni Nexus](./docs/omni-nexus.md) | 9-tab multi-station: enchant up to 255, disenchant to XP, repair, brew, beacon, and storage | ✅ Active | 2026-11-02 |
| 4 | [GF: Galaxium Mini Bosses](./docs/galaxium-bosses.md) | 8 mini-bosses in full Galaxium armor, Netherite spawner roll rates, boss gear, and spawn eggs | ✅ Active | 2026-11-02 |
| 5 | [GF: Enchantment Reworks](./docs/enchantment-reworks.md) | Overhauled Mending, Sharpness, Cosmic Fire, Depth Strider, Soul Speed, and bow Piercing | ✅ Active | 2026-11-02 |
| 6 | [GF: Apple Trees & Wood Sets](./docs/apple-trees.md) | 13 custom apple trees, food effects, saturation reserve, giant/mega trees, and boats | ✅ Active | 2026-11-02 |
| 7 | [GF: Development & Workflow](./docs/development-workflow.md) | Build scripts, jar size limits, texture generation pipeline, unit tests, and handoff notes | ✅ Active | 2026-11-02 |
| 8 | [GF: New Ideas](./docs/gf-new-ideas.md) | Starter page: Galaxium final boss, new Omni Nexus tab, new Galaxium item, more enchantment reworks (not built) | 💡 Ideas | 2026-11-05 |
| 9 | [GTS: Characters (Mira & Candy)](./docs/gts-characters.md) | Mira & Candy models, procedural lofted mesh, 8 outfits, 24 mouth stages, and lollipop staffs | ✅ Active | 2026-11-03 |
| 10 | [GTS: Obese Giantesses](./docs/gts-obese-giantesses.md) | 20% weight variant, micro-bikinis, 4.00s kneeling ground scoop & gulp eat (Option B capacity), belly jiggle physics, and combat stats | ✅ Active | 2026-11-03 |
| 11 | [GTS: Gameplay Systems](./docs/gts-gameplay-systems.md) | Taming, interaction menu, love meter, guard mode, hunting/addiction, cuddles, and mounts | ✅ Active | 2026-11-02 |
| 12 | [GTS: Stomach & Drool](./docs/gts-stomach-and-drool.md) | `gts:stomach` dimension, acid digestion, fighting back, external belly bulge, and drool veins | ✅ Active | 2026-11-03 |
| 13 | [GTS: Development & Builds](./docs/gts-development-and-builds.md) | Jar patching pipeline, ASM bytecode hooks, Python mesh tools, and cuddle1–184 build log | ✅ Active | 2026-11-02 |

## Recent changes
- 2026-11-05 — [GF: New Ideas](./docs/gf-new-ideas.md) — New starter page with 4 GF ideas (not built yet): Galaxium final boss, new Omni Nexus tab, new Galaxium weapon or tool, more enchantment reworks. Copy also in the GF Obsidian vault (`Pages\gf-new-ideas.md`).
- 2026-11-05 — [GTS: Stomach & Drool](./docs/gts-stomach-and-drool.md) — INSTALLED (14:32) smooth "streak" drool textures: 32px seamless tile, opacity by layer (1 = 60% ... 8 = 98%, more layers = less see-through). Only textures + 7 block models changed (`drool_layer_2..8` + `drool_vein.png`); zero `.class` files changed. Staged jar: `drool-update\gts-3.1.1-neoforge-1.21.1.jar`. Backup of the old jar: `%USERPROFILE%\ZevenBackups\5423\gts-3.1.1-neoforge-1.21.1-before-drool-2026-11-05-1234.jar`. Step 1 of the build plan, rebuilt 2026-11-05: the staged jar now also has the saliva liquid looking like the layers (32-frame sliding animation: still 32x1024, flow 64x2048) and the new player/mob drool textures `csd_mess_1..5` (128x128). Check: 966 files kept, 15 changed, 14 added, 0 `.class` files changed. Installed into `mods\` after the game closed (hash matches the checked build); not yet tested in game.
- 2026-11-05 — Built a knowledge graph of all 13 doc pages + 28 key config files (`graphify-out/`: `graph.html`, `GRAPH_REPORT.md`, and Obsidian note folders `obsidian/Genesis Forge` and `obsidian/GTS Giantess Mod`, each with a `Pages` folder holding copies of that mod's full doc pages + PROJECT.md — re-copy after doc changes). Obsidian 1.15.0 installed on the PC. Phone version (private): https://claude.ai/artifact/LZDcBRdaWrLVC2SPZKw9Ki. Left out on purpose: ~200 Infinite Dimensions worldgen data files.
- 2026-11-03 — [GTS: Stomach & Drool](./docs/gts-stomach-and-drool.md) & [GTS: Obese Giantesses](./docs/gts-obese-giantesses.md) — Fixed Crash 3 (JVM VerifyError in `TamedGtsStomach.canUseInside` and `TamedGtsGroupEat.dynamicSpot` caused by instructions following unconditional jumps without StackMap frames). Replaced dead paddings with branchless capacity arithmetic, preserved untouched methods, mutated return constants directly, and verified 100% of classes and StackMapTable frames in the live jar.
- 2026-11-03 — [GTS: Stomach & Drool](./docs/gts-stomach-and-drool.md) — Fixed JVM `VerifyError` (`StackMapTable error: bad offset` at bci @474) in `TamedGtsStomach.class` by relocating the absorption healing call to `digest(ServerPlayer, LivingEntity)` (offset 29054 + 469), restoring `onServerTick` to its pristine state. 100% of all StackMapTable frames verified valid in live mod jar.
- 2026-11-03 — [GTS: Stomach & Drool](./docs/gts-stomach-and-drool.md) — Fixed game startup crash caused by an ASM ClassReader label parsing error in `TamedGtsStomachMobs.class` by replacing the branch patch in `onServerTick` with 16 clean `NOP` opcodes; all 6 patched classes verified 100% clean in live mod jar.
- 2026-11-03 — [GTS: Stomach & Drool](./docs/gts-stomach-and-drool.md) & [GTS: Obese Giantesses](./docs/gts-obese-giantesses.md) — Balanced grab reach (0.6x height), added line-of-sight and floor checks (no cave grabbing), cupped prey in hands from floor to mouth (`dynamicSpot` + `SaddleSlot_pos`), matched drool vein texture to drool layer block, enabled saliva-logging and permanent drool layers touching saliva, extended stomach chunk loading (72k ticks), enabled 100% player weapon usage inside stomach (keeping damage reduction intact), and granted +0.5 absorption HP per 1 HP digestion damage (+3.0 HP normal heal).
- 2026-11-03 — [GTS: Obese Giantesses](./docs/gts-obese-giantesses.md) — Reworked obese eating into a 4.00s kneeling ground scoop & gulp: corrected Blockbench/GeckoLib arm and head rotation signs (`-69°..-109°` forward arm sweep, `-15°` head-back gulp), lowered torso bend to `13.5°` with a deep `-9.5` kneeling drop to prevent waist folding, held grabbed mobs cupped at mouth level (`0.66 × height`), and synchronized primary + group swallow to tick 54 (`2.70s`).
- 2026-11-03 — [GTS: Obese Giantesses](./docs/gts-obese-giantesses.md) & [GTS: Characters (Mira & Candy)](./docs/gts-characters.md) — Fixed multi-direction arm flailing and frame lag on Skinny Candy, Obese Candy, and Obese Mira by switching 10,367 Molang keyframes from `catmullrom` to linear interpolation and collapsing 18,475 duplicate keyframes across all 5 animation JSONs.
- 2026-11-02 — Established master root `PROJECT.md`, `PROJECT.html`, and complete documentation suite for both mods in `docs/`.
- 2026-11-02 — [GTS: Development & Builds](./docs/gts-development-and-builds.md) — Installed build `cuddle184-armfix` addressing wild hunting aquatic/flying pathing loops.
- 2026-11-01 — [GF: Galaxium Mini Bosses](./docs/galaxium-bosses.md) — Added 8 Galaxium mini-boss spawn eggs (creative tab only).
- 2026-11-01 — [GF: Enchantment Reworks](./docs/enchantment-reworks.md) — Bow Piercing override implemented.
- 2026-11-01 — [GF: Core Forge & Soul System](./docs/core-forge.md) — Changed High Concentrated Soul Orb recipe (5 Sculk Catalyst + 4 Nether Star).
- 2026-11-01 — [GF: Apple Trees & Wood Sets](./docs/apple-trees.md) — Enchanted Galaxium Apple updated to give Regeneration IV.
- 2026-11-01 — [GTS: Obese Giantesses](./docs/gts-obese-giantesses.md) — Added belly jiggle spring physics and 65% defense buff.

## Known problems
- **GTS cuddle184:** Needs in-game verification that wild hunting giantesses no longer get stuck chasing unreachable mobs.
- **Genesis Forge:** Giant tree growth and spawner line-of-sight mixin await in-game survival testing.

## Ideas for later
- **BUILD PLAN for the drool/spit work (updated 2026-11-05, user said go for step 1; each step = backup, change, verify, user tests in game):** 1) Textures, no code: layer look (streak, 60% to 98%), liquid looks like the layers (animated), new player/mob drool textures `csd_mess_1..5`. 2) Drool block basics: layers non-solid (sink), slowness per layer, liquid can't wash drool away, standing in drool = level-1 timer +(1 + layer/2) s every 0.65 s, max 5 min. 3) Layer 8 = saliva liquid: layers cap at 7, core grows with giantess size, spreads 1-2 blocks, sink slowly, drown ~15 s, drool layers block the liquid. 4) Drying: a puddle not connected to liquid loses 1 layer on every block together every 15 s. 5) Spit rules: hits everyone but giantesses; mobGriefing off = no layers/liquid/plant breaking; breaks flowers/grass/crops/leaves with drops on the hit block +1; vanishes in water/lava. 6) Drool on bodies: thin shell grows per level, player idle animation freezes at level 5, all mobs except bosses get the overlay; squish/drip/splat sounds + particles. 7) Shapes: slope pieces between layers, wall coat thickness, rounded inside/outside corners (neighbour-aware block code, biggest step). 8) Re-check random edges/droplets, one settings file for all numbers, final test.
- **OLD build order (replaced 2026-11-05):** 1) install the staged texture jar (60% to 98% opacity, streak look) + new player drool textures `csd_mess_1..5` (no code; game must be closed). 2) sink (layers 2-8 non-solid) + slowness per layer. 3) layer 8 becomes the saliva liquid (layers cap at 7, core grows with giantess size, spreads 1-2 blocks, drowns like water ~15 s). 4) puddle drying rule (all blocks lose a layer together when not connected to liquid). 5) spit destroys flowers/grass/crops/leaves with drops, hit block +1 (check Griefing Protection rule). 6) player drool shell grows per level (thin), idle animation freezes at level 5, mobs get the same overlay. 7) slope pieces + wall coat thickness (needs neighbour-aware block code). 8) re-check random edges/droplets (user said the cut edges looked bad with layers).
- **Spit work requested 2026-11-05 (nothing built yet):** (1) spit destroys flowers, grass, crops and leaves (hook point: `GiantessSpitHitsBlockProcedure`; check it against the Griefing Protection rule in the stomach page). (2) Retexture the drool on the player: new `csd_mess_1..5.png` (128x128, 5 levels = Cutie's Sticky Drool 1-5; draft textures in the session scratch folder `csd_new`, texture-only so no code) and make the drool grow bigger on the model each level (shell size per level; may need code, unsure if `TamedGtsGooLayer` already inflates). (3) Give mobs the same drool overlay (code: a render layer on mob renderers). Preview of player at each level was drawn and sent; user approved the look (2026-11-05) with tweaks already applied to the draft: thinner shell (+0.25 to +1.6 skin px) and less see-through at higher levels (level 5 almost opaque). Decisions: plants hit by the spit break NORMALLY WITH DROPS; area = the hit block + 1 around it; at drool level 5 the player's idle animation freezes (code). User also wants to change how the saliva liquid spawns from the spit (suggestions given, waiting for a pick). Facts read from the class files (read-only): spit landing makes a puddle whose size scales with the giantess size (`TamedGtsGooPuddle`), places drool veins + saliva fluid; `TamedGtsSpitStack` stores per-victim level/time/cooldown, washes off in water/rain/water potion, and puts mobs at max level on NoAI. User idea 2026-11-05: make drool layer 8 become the saliva liquid itself (layers 1-7 stay film, 8 = fluid; a water-style source is about 14 px tall, which matches layer 7). Not built; needs code (cap layers at 7, place saliva fluid instead) and spread/lag control. Decided so far: layer 8 = the existing saliva liquid (`girly_saliva`), and it spreads only 1-2 blocks from the spot. Further decisions 2026-11-05: the liquid STAYS FOREVER (no drying); inside it you sink slowly, swim up slowly and CAN drown; LOOK (updated 2026-11-05): the liquid must look the SAME as the drool layers (same streak texture, nearly solid) — retexture `girly_saliva_still/flow` (texture only; it was a cream-khaki, avg RGB ~199,196,165, same liquid as the spit bucket); concepts 1-4 approved (puddle side cut, drying, plant breaking, mob drool on zombie/skeleton/creeper/pig); liquid vs drool layers = BLOCK: drool layers act like a wall, the liquid cannot flow into them (today, untested, the drool block is marked "replaceable", so liquid might wash it away; must be changed); spit hits EVERYONE except giantesses (no owner/tamed protection); if `/gamerule mobGriefing` is false the spit builds NO drool layers or liquid and breaks no plants (it only hits entities); standing in drool layers gives only drool level 1, and thicker layers make that level-1 effect last longer; level 5 ends only by waiting it out or washing in water/rain (no struggle); while standing in drool, every 0.65 s the level-1 effect gets +(1 + layer/2) s more time (layer 7 = +4.5 s per 0.65 s; max 5 minutes in total); wall drool STAYS on the wall (it does not drip onto the floor); corners: ROUNDED for both inside corners (floor-wall, wall-ceiling, wall-wall) and outside corners (ledges, pillars), built from small 22.5/45-degree pieces (may look slightly faceted; 45-degree pieces are the fallback); spit that touches water or lava instantly disappears (water: dissolves, lava: sizzles away); all mobs can get the drool overlay except bosses (Wither, Ender Dragon); add sounds/particles: squish steps in drool, drips from entities at level 3+, splat when spit lands; core size = GROWS WITH THE GIANTESS SIZE (about 1 block small, 3x3 medium, round 5x5 big); drowning = same as water (about 15 s of air); lag control (user idea): the film/puddle DRIES TOGETHER with the liquid, i.e. once the liquid is removed from the spit puddle (scooped with the bucket) the rest of the puddle dries; DECIDED 2026-11-05: it dries layer by layer (one layer every 15 s, so a 7-layer puddle is gone in ~105 s), ALL blocks of the puddle losing one layer at the same time; a puddle (touching drool blocks) dries only when it is NOT CONNECTED to any liquid block (scooped, flowed away, or cut off by a gap; the whole core must be gone); no lag cap for now (test first). Docs say drool layers never dry while connected to or submerged in saliva, so this extends an existing rule (unsure how far the current neighbour check reaches). Because puddles stay forever, a lag guard (cap per area) is needed. Also decided: wall drool gets thickness with slope pieces (user chose yes), needs a new property, on hold with the other drool code work.
- **Drool block facts (read-only, 2026-11-05, from Antigravity's bytecode dump of `TamedGtsDroolVein$VeinBlock`; not re-checked in the live jar):** it extends `MultifaceBlock` (like sculk veins); property `LAYERS` 1-8 only matters on the floor face (`height()` = 0 without a DOWN face, so wall drool is a paper-thin sheet with no layers). Slowness ALREADY exists: `entityInside` calls `makeStuckInBlock` with a flat 0.65 speed factor (same for every layer); giantesses (`TamedGtsMode.isGiantess`) and spit-immune entities are skipped. Collision: layer 1 = none (you already sink), layers 2-8 = solid box 2 px per layer. So "sink" ~ make layers 2-8 non-solid, and "slowness per layer" ~ replace the flat 0.65 with a per-layer value: both are small changes inside methods that already exist (to confirm).
- **On hold (user chose textures only for now, 2026-11-05) — drool behaviour + corners.** Decided so far: entities SINK into drool (no collision, like powder snow) and are slowed per layer (medium: ~15% slower at layer 1 up to ~80% at layer 8); affects players and mobs but NOT giantesses. Randomized rounded outer corners (a different design per corner; user REJECTED the first previews (A4 rounded blobs / B4 splashes / C4 mix: too uniform). New look drawn 2026-11-05: random irregular edge along the WHOLE outer side + corners, 8 edge designs + 8 corner designs, each block picks at random, plus loose droplets and splash blobs (user asked for more droplets outside); inner notches stay square; caveat: a block's side walls cannot be ragged, so tall (layer 6-8) blocks on the outer ring would show straight walls under the ragged top — keep outer blocks thin or drop walls on open sides). 2026-11-05 user said the jagged cuts + tall layered boxes "look super bad". New direction (mock-up drawn): flat thin film (~2px, no stairs, no tall walls), layers shown only by opacity (60% to 98%), smooth round lobes + soft glossy rim + round droplets. Needs the flat-film model change AND the no-collision (sink) code change together, otherwise players would stand on invisible tall collision. Known flaw: opacity differences between neighbouring blocks show as square patches. User idea 2026-11-05: smaller slope layers between two layers — options drawn: tilted slope pieces (22.5/45 deg only, needs neighbour-aware code) or water-style smooth heights via a custom model (smoothest, biggest change)). All of this needs the drool block to know its neighbours = a code change in `TamedGtsDroolVein$VeinBlock` (new connection properties + blockstate corner pieces with weighted random variants). Risky; back up first.
- Refit held items (staffs, umbrellas, portals) for obese giantesses.
- Create more unlockable outfits for Candy.
- Add heavy footstep sound effects and screen shake for large giantesses.

## Before publishing (later)
- Keep `genesisforge-1.0.0.jar` strictly under 30 MB when recompiling.
- Confirm animated texture `.mcmeta` width and height dimensions are defined before running oxipng.

