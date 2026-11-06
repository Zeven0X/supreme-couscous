# Plan: build everything decided for Genesis Forge (2026-11-05/06)

## Context
Over this session Zeven decided: one bug fix (Multishot cap), a tree bone-meal change, a level limit above 255
with 75x/100x tiers, 13 enchantment reworks, and a new Galaxium Fishing Rod. All decisions are in
`docs/enchantment-rework-plan.md`, `CLAUDE.md`, and `docs/GF-all-information.md` in this repo.
Nothing is built yet because the mod's source code is not here (the old `/tmp/gf` project is gone).
Goal: a new `genesisforge-1.0.0.jar` with all of it, verified as far as possible before Zeven tests in game.

## Blockers (must be solved first)
1. **The jar**: Zeven uploads `genesisforge-1.0.0.jar` (~26.8 MB) from
   `C:\Users\USER\curseforge\minecraft\Instances\5423\mods\`.
2. **Network**: this environment blocks the NeoForge and Mojang servers a mod build needs
   (`maven.neoforged.net` answered 403). I will ask (approval prompt) to allow exactly:
   `maven.neoforged.net`, `libraries.minecraft.net`, `piston-meta.mojang.com`, `piston-data.mojang.com`,
   `resources.download.minecraft.net`.

## Approach
Rebuild the mod from the jar as real source, then change the source.
- Decompile the jar with Vineflower into a standard NeoForge 1.21.1 ModDevGradle project in this repo
  (`genesisforge/`), resources copied as-is.
- Fix decompile errors until it compiles, then **prove the rebuild equals the original**: same class list,
  same resources, same mixin config, jar size check, server starts. Only then change anything.
- Commit the recovered source, so the code can never be lost again.
- Fallback if the decompiled code can't be made to compile cleanly: a small separate add-on mod that
  depends on Genesis Forge and changes it through mixins. (I'd tell Zeven before switching.)

Many reworks can be data files instead of code (1.21.1 enchantments are JSON): I'll use data overrides
where they give exactly the decided behaviour, and code (event handlers / mixins) elsewhere.

## Phases (in order, each = backup -> change -> verify -> commit)

### Phase 0 - Setup and recovery
- Network approval, jar upload, decompile, compile, equality checks above.
- Recreate the checks the old project had: resource integrity (blockstates/models/lang match),
  mixin target check, jar size < 30 MB.

### Phase 1 - Bug fix and audit
- Find where the Omni Nexus sets max enchant levels; fix Multishot on Galaxium (5 -> 50).
- Check all 42 enchantments against the rule (normal 10x, Galaxium 50x); show Zeven the list of wrong caps
  before fixing the rest.
- Giant/mega tree bone meal: replace the fixed 8 / 24 with 8x / 24x one sapling's average per tree type
  (Apple 72/216 ... Galaxium 888/2,664; enchanted trees from their own slowness).

### Phase 2 - Level limit above 255 + tiers (risky, isolated)
- Mixins so enchantment levels above 255 save, load, sync and show correctly (item save format,
  network sync, tooltip numbers, `/enchant`).
- Nexus caps by gear tier: normal 10x, Galaxium 50x (no longer capped at 255), 75x and 100x tiers ready
  for the future sets (empty until those sets exist).
- Test on a COPY of a world: enchant above 255, save, reload, check the item.

### Phase 3 - Enchantment reworks
Data overrides (JSON):
- **Knockback / Silk Touch reach**: +0.05 / +0.1 attack + block reach per level, held item only
  (naturally no stacking). Must give 3 x 1.75 + 10 = 15.25: check how the Galaxium +75% is done in the jar;
  if attribute order gives 22.75 instead, do it in code.
- **Feather Falling**: +0.25 safe-fall blocks per level (adds to Galaxium Boots' 15).
- **Impaling**: +0.5 damage per level vs every mob, thrown + melee; vanilla aquatic bonus kept.
- **Punch**: allowed on the Galaxium Crossbow (plus the gravity code below).
Code:
- **Smite**: every hit heals the attacker 0.005 HP per level; vanilla undead bonus kept.
- **Aqua Affinity**: helmet, fully underwater, 0.75%/level, applied after all other reduction.
- **Blast / Projectile Protection**: extra reduction, levels summed over 4 pieces, 90% at 1600, applied after.
- **Fire Protection**: longer gap between fire-related damage hits (all fire, lava, Purple Cosmic Fire),
  up to 4x at 1600 summed levels; hit size unchanged.
- **Punch**: projectile gravity -0.4%/level (80% at 200), bows + Galaxium Crossbow, knockback kept.
- **Multishot**: no arrow cap below 75; at 75+ shooting 75 degrees up -> arrow vanishes, ~1 s later one fast
  arrow falls on every target in 25 (+1 per level, 50 at 100) blocks, full crossbow damage incl. Power/Flame/
  cosmic fire; skips the shooter's own tamed pets and companions.
- **Fortune 200+**: auto-smelt all smeltable ores (incl. modded, copper), Fortune multiplies, smelting XP;
  ancient debris -> netherite scrap like diamond ore; switch in the item settings menu; Silk Touch wins.
- **Luck of the Sea 50+** (Galaxium Fishing Rod): Nether lava fishing loot table - blaze rod, magma cream,
  ghast tear, quartz, glowstone dust, gold nugget, netherite scrap, ancient debris 10% each;
  Netherite Apple sapling 2.5%, Enchanted Netherite Apple sapling 0.5%; 17% empty.
- Every new perk gets an on/off switch in the Galaxium item settings menu, like the existing perks.
Not included: Breach, Thorns (Zeven says already reworked, no record - waiting for details).

### Phase 4 - Galaxium Fishing Rod
- Item: 320 durability, 2.5x faster catches (Lure stacks), 5x cast distance, fire/lava/explosion proof
  (`#genesisforge:blast_proof`), bobber floats on lava.
- Settings menu switch: strong mob pull (all the way to the player, any pullable mob) or grapple
  (bobber sticks to any block, pulls the player; no extra fall protection).
- Recipe: smithing table, Fishing Rod + Galaxium Ingot + Galaxium Upgrade Template.
- Art: the approved concept B on the vanilla rod shape - 128px, 60-frame seamless animation (item + cast),
  `.mcmeta` with width/height, comet bobber texture, models using the vanilla rod hand position, lang.
  Generator: `tools/concept-render/fishing_rod_texture.py` extended to 60 frames.

### Phase 5 - Docs
- Update `docs/GF-Enchantments.pdf`, the text summary for other chats, `GF-all-information.md`
  (copy back to Obsidian), and `CLAUDE.md`.

## Verification
- After every phase: compile, resource + mixin checks, jar < 30 MB, dedicated server starts with the mod.
- Automated NeoForge GameTests on a test server for the testable logic: damage reduction maths, fire
  interval, smite heal, bone meal counts, lava fishing loot, auto-smelt drops, arrow-rain targets
  (pets skipped), level 300 enchant survives save/reload.
- Zeven's in-game checklist per phase (feel, visuals, lag with Multishot 100 = 201 arrows).
- Every report says clearly: compiled / tested on server / NOT yet tested in the game client.
- Install rule: back up the old jar, never replace it while Minecraft runs.

## Delivery
One new jar per phase, sent here, plus a short "what to test" list. Zeven tests, then I start the next phase.
