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

## Current state (2026-11-05)
- Awaiting in-game tests: giant 2x2 / mega 3x3 trees (8 / 24 bone meal), fruiting log, spawner 24-spot line-of-sight, T3/T4 sneak toggle, dispensers firing Galaxium eggs, bow Piercing, Nexus brewing + 256-block beacon.
- New ideas (not built): Galaxium final boss (summon after 8 mini-bosses), 10th Omni Nexus tab, new Galaxium weapon/tool, more enchantment reworks (e.g. Unbreaking, Efficiency, Fortune, Thorns).
