# Genesis Forge (GF) — session context

Full reference: `docs/GF-all-information.md` (copied from the user's Obsidian vault, 2026-11-05). Read it before changing any GF feature.
Scope: Genesis Forge only. GTS (Giantess mod) notes in that file are out of scope unless the user asks.

## Stack
- Minecraft 1.21.1, NeoForge 21.1.262, Java 21, Mojang mappings, MixinExtras.
- Jar: `genesisforge-1.0.0.jar` (~26.8 MB), must stay under 30 MB (device bridge limit).
- Package: `com.zeven.genesisforge` (~182 Java files, 2,600+ resources).
- Pack: CurseForge instance 5423 (`C:\Users\USER\curseforge\minecraft\Instances\5423\mods\`).
- Never overwrite the jar while Minecraft is running. Back up before installing.

## Build & checks
- Build: `/tmp/gf/build.sh` → `oxipng` on PNGs → `zip -qr -X -9` in `build/classes`.
- Before a release build: `res_check.py`, `treegen/check.py`, `verify_mixins.py`, unit tests in `test3` (`GiantShape`, `TemplateRecipeTest`).
- Do not load Minecraft `Feature` classes in standalone unit tests (LoadingModList NPE).
- Animated `.mcmeta` files must set width and height.

## Working rules (Zeven's preferences)
1. Show concepts and previews; ask when numbers or requirements are unclear. No unreviewed design overhauls.
2. Galaxium textures: no seams, tiling lines or mirrored faces.
3. Models and designs: smooth, organic curves.
4. Always say what was verified (compiled / unit tested) vs. not yet tested in the game client.

## Current state (in-game test results 2026-11-05)
- Passed in game: fruiting log / passive apple drops under giant+mega trees, spawner 24-spot line-of-sight, T3/T4 sneak toggle, bow Piercing, Nexus brewing + 256-block beacon.
- Trees work, but bone meal must change (DECIDED): giant 2x2 = exactly 8x and mega 3x3 = exactly 24x the bone meal one sapling of that type needs on average.
  One sapling ~ round(2 x slowness / 0.45): Apple 9, Iron 13, Golden/Emerald/Diamond 22, Netherite 44, Galaxium 111 (enchanted: from each tier's own slowness).
  So giant/mega: Apple 72/216, Iron 104/312, Gold/Emerald/Diamond 176/528, Netherite 352/1,056, Galaxium 888/2,664. Fixed count, not random. Not built yet (source code not in this repo).
- Not tested yet: dispensers firing Galaxium mini-boss eggs.
- Enchantment overview for reworks: `docs/GF-Enchantments.pdf` (21 reworked, 2 partly, 19 untouched; max = 10x vanilla normal gear, 50x capped 255 Galaxium).
- BUG (found in game 2026-11-05): Galaxium Crossbow Multishot stops at 5, should follow the 50x rule = 50 (DECIDED). Other enchantments may have the same wrong cap; to find them, read the jar (user will upload `genesisforge-1.0.0.jar`). Watch for lag: Multishot 50 = 101 arrows per shot.
- New ideas (not built): Galaxium final boss (summon after 8 mini-bosses), 10th Omni Nexus tab, new Galaxium weapon/tool, more enchantment reworks (e.g. Unbreaking, Efficiency, Fortune, Thorns).
