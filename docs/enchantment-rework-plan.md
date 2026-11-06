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

## Multishot (bug)
- Galaxium Crossbow stops at 5; must follow the 50x rule = 50. Waiting for the jar upload.

## Still need a rework (16 untouched enchantments)
Max levels: normal 10x / Galaxium 50x / 75x set / 100x set.
- Levels do nothing (on/off only): Silk Touch (10/50/75/100), Curse of Binding (10/50/75/100), Curse of Vanishing (10/50/75/100).
- Stop helping early: Fire Protection, Blast Protection, Projectile Protection, Feather Falling (all 40/200/300/400; vanilla 80% cap, nothing past ~lvl 7-10),
  Breach (40/200/300/400; full armor ignore at 7), Thorns (30/150/225/300; chance full at 7, damage never grows).
- Grow forever, may break the game: Multishot (10/50/75/100; lag + cap bug), Punch (20/100/150/200; mobs fly away),
  Fortune (30/150/225/300; huge drop piles), Unbreaking (30/150/225/300; almost unbreakable), Luck of the Sea (30/150/225/300; all treasure).
- Work fine as they are (damage keeps growing): Impaling (50/250/375/500), Density (50/250/375/500).
