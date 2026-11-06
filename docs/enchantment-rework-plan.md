# Enchantment rework plan (from Zeven, 2026-11-05)

Status: Smite, Knockback, Aqua Affinity fully decided. More reworks coming. Nothing built (needs the jar).

## Gear tiers and max levels
- Normal gear: 10x vanilla max. Galaxium: 50x. Two future sets (not created yet): 75x and 100x.
- The reworks below are designed so their full value is reached on the 100x set.
- PROBLEM: Minecraft 1.21.1 stores enchantment levels 1-255 only. Galaxium is capped at 255 today.
  At 75x/100x, every enchantment with vanilla max 3+ goes above 255 (e.g. Smite 100x = 500).
  DECIDED (option B): raise the limit above 255 (patch item saving). Risky: test in a world copy first; check /enchant, other mods, tooltips.

## Smite
- Each hit on ANY mob heals the attacker 0.005 HP per level (decided).
- Max values: normal 50 = 0.25 HP, Galaxium 250 = 1.25 HP, 75x set 375 = 1.875 HP, 100x set 500 = 2.5 HP (needs >255).
- Keeps vanilla +2.5 damage per level vs undead (decided).

## Knockback
- +0.05 blocks reach per level, for attacking AND breaking/placing blocks (decided).
- Max values: normal 20 = +1, Galaxium 100 = +5, 75x set 150 = +7.5, 100x set 200 = +10 blocks.
- Still pushes mobs back as vanilla (decided). Adds on top of the Galaxium tools' +75% reach (decided).

## Aqua Affinity
- +0.75% damage reduction per level while fully underwater (decided).
- Max values: normal 10 = 7.5%, Galaxium 50 = 37.5%, 75x set 75 = 56.25%, 100x set 100 = 75%.
- Applied AFTER all other damage reduction (decided): it takes its % off the damage that is left.
  Example: 100 damage -> 80% armor -> 20 left -> Aqua 75% -> 5 taken (95% total). With Protection 99%: 99.75% total.
- Helmet only (decided). Keeps vanilla faster underwater mining (decided).

## Punch (decided 2026-11-06)
- Each level lowers gravity on the projectile by 0.4%, up to 80% less gravity at level 200 (100x set).
  Normal 20 = 8% | Galaxium 100 = 40% | 75x 150 = 60% | 100x 200 = 80%.
- Keeps the vanilla arrow knockback.
- Punch can now also go on crossbows (arrows and fireworks).
- Only the Galaxium Crossbow can take Punch (decided). Normal crossbows stay vanilla.

## Multishot (decided 2026-11-06)
- Below level 75: vanilla, +2 arrows per level, NO cap (Zeven's choice; lvl 50 = 101 arrows, lvl 100 = 201: watch for lag).
- From level 75 (75x and 100x sets only; Galaxium max 50 never gets it): shooting 75 degrees or more upward
  makes the arrow vanish, and about 1 second later arrows fall fast onto every target within 25 blocks.
- +1 block radius per level above 75, up to 50 blocks at level 100.
- ONE arrow per target. Each arrow does the crossbow's normal damage, with Power, Flame and cosmic fire.
- Hits everyone NOT tamed by the shooter: hostile mobs, animals, villagers, other players.
  Skips the shooter's own tamed pets (and Super Soul Ball companions, assumed).

## Fortune (decided 2026-11-06)
- From level 200 (75x and 100x sets only): every smeltable ore is smelted instantly, 100% of the time,
  including copper and other mods' ores. Ores that already drop an item (diamond, coal...) are unchanged.
- Fortune still multiplies the smelted drops. Smelting XP is given.
- Ancient debris drops netherite scrap with the same Fortune maths as diamond ore
  (vanilla: 1 x random 1..level+1, so about 100 scrap per block on average at level 200).
- All of it can be switched on/off in the Galaxium item settings menu.
  If Silk Touch is also on, Silk Touch wins (block drops itself) (decided).

## Luck of the Sea (decided 2026-11-06)
- From level 50: fishing in Nether lava (Nether dimension only) catches Nether loot.
- Needs a NEW item: Galaxium Fishing Rod (normal rods max at 30).
  Look chosen 2026-11-06: concept B (glowing violet line + comet bobber) on the vanilla rod shape, 128px Galaxium texture
  (preview: docs/concepts/galaxium-fishing-rod-B.png; in-hand: docs/concepts/galaxium-fishing-rod-hand-*.png).
  Abilities (decided 2026-11-06):
  - 2.5x faster catches. 5x casting distance.
  - Durability = 5x a normal fishing rod (vanilla 64 -> 320). Not unbreakable.
  - Usual Galaxium protection (fire/lava/explosion proof, never despawns); bobber floats on lava.
  - Strong pull on hooked mobs.
  - Item settings menu switch: PULL MOBS to the player, or PULL THE PLAYER to the bobber (grappling hook).
  Pull details (decided 2026-11-06):
  - Grapple mode: the bobber sticks to any block it hits (walls, ceilings, cliffs) and pulls the player to it.
  - NO fall-damage protection from the grapple (normal Galaxium Boots fall protection still applies).
  - Mob pull is strong: brings the mob all the way to the player in one pull.
  - Works on any mob that can be pulled (no extra exclusions decided; bosses and players only if they can be moved normally).
  - Lure stacks with the 2.5x faster catches.
  Recipe (decided): smithing table = normal Fishing Rod + Galaxium Ingot + Galaxium Upgrade Template.
- Loot, 10% each: blaze rod, magma cream, ghast tear, Nether quartz, glowstone dust, gold nugget,
  netherite scrap, ancient debris. Plus Netherite Apple Tree sapling 2.5%, Enchanted Netherite Apple Tree sapling 0.5%.
  The remaining 17% = empty catch for now (slots kept for future loot).
- Higher levels give better chances for the rare loot; exact numbers to be redesigned later, once more
  (future) items are added to the list.

## Fire / Blast / Projectile Protection and Feather Falling (decided 2026-11-06)
Max levels per piece: 40 / 200 / 300 / 400 (normal / Galaxium / 75x / 100x).
- The levels of all 4 armor pieces ADD UP. Maximum value needs 1600 total (400 on each of the 4 pieces).
  So the numbers below are for a full set with the same level on every piece (one piece gives a quarter).
- Fire Protection: burning damage is slowed up to 4x at 1600 total. Each hit stays the same size; the
  INTERVAL between damage ticks gets longer (up to 4x). Applies to all fire, including Purple Cosmic Fire
  (still 5% of max health per hit, but only every 4 s instead of every 1 s at max).
  ASSUMED linear: interval = 1 + 3 x (total / 1600).
  Full set: 40 each = 1.3x | 200 each = 2.5x | 300 each = 3.25x | 400 each = 4x.
- Blast Protection: extra reduction vs explosions, 90% at 1600 total, applied after all other reduction (stacks).
  ASSUMED linear. Full set: 9% | 45% | 67.5% | 90% (per level per piece: 0.05625%).
- Projectile Protection: same, vs projectiles.
- Feather Falling (boots only, so 400 on the boots is the max): +0.25 safe-fall blocks per level, up to +100 at 400
  (+10 | +50 | +75 | +100). Adds on top of the normal 3 and the Galaxium Boots' 15 (max 3 + 15 + 100 = 118 blocks).
- Open: does the longer interval also apply to lava damage? (Zeven answered "increase the interval between damages".)

## Multishot (bug)
- Galaxium Crossbow stops at 5; must follow the 50x rule = 50. Waiting for the jar upload.

## Still need a rework (16 untouched enchantments)
Max levels: normal 10x / Galaxium 50x / 75x set / 100x set.
- Levels do nothing (on/off only): Silk Touch (10/50/75/100), Curse of Binding (10/50/75/100), Curse of Vanishing (10/50/75/100).
- Stop helping early: Fire Protection, Blast Protection, Projectile Protection, Feather Falling (all 40/200/300/400; vanilla 80% cap, nothing past ~lvl 7-10),
  Breach (40/200/300/400; full armor ignore at 7), Thorns (30/150/225/300; chance full at 7, damage never grows).
- Grow forever, may break the game: Unbreaking (30/150/225/300; almost unbreakable).
  (Multishot, Punch, Fortune and Luck of the Sea now have reworks, see above.)
- Work fine as they are (damage keeps growing): Impaling (50/250/375/500), Density (50/250/375/500).
