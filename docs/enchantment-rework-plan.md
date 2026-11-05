# Enchantment rework plan (from Zeven, 2026-11-05)

Status: collecting ideas. Nothing built.

## Gear tiers and max levels
- Normal gear: 10x vanilla max. Galaxium: 50x. Two future sets (not created yet): 75x and 100x.
- The reworks below are designed so their full value is reached on the 100x set.
- PROBLEM: Minecraft 1.21.1 stores enchantment levels 1-255 only. Galaxium is capped at 255 today.
  At 75x/100x, every enchantment with vanilla max 3+ goes above 255 (e.g. Smite 100x = 500).
  DECIDED (option B): raise the limit above 255 (patch item saving). Risky: test in a world copy first; check /enchant, other mods, tooltips.

## Smite
- Each hit on ANY mob heals the attacker 0.005 HP per level (decided).
- Max values: normal 50 = 0.25 HP, Galaxium 250 = 1.25 HP, 100x set 500 = 2.5 HP (needs >255).
- Open: keep vanilla +2.5 damage per level vs undead?

## Knockback
- +0.05 blocks reach per level, for attacking AND breaking/placing blocks (decided).
- Max values: normal 20 = +1, Galaxium 100 = +5, 100x set 200 = +10 blocks.
- Open: still push mobs back? Stacks with Galaxium tools' +75% reach?

## Aqua Affinity
- +0.75% damage reduction per level while fully underwater (decided).
- Max values: normal 10 = 7.5%, Galaxium 50 = 37.5%, 100x set 100 = 75%.
- Applied AFTER all other damage reduction (decided): it takes its % off the damage that is left.
  Example: 100 damage -> 80% armor -> 20 left -> Aqua 75% -> 5 taken (95% total). With Protection 99%: 99.75% total.
- Open: helmet only? Keep vanilla underwater mining speed?

## Multishot (bug)
- Galaxium Crossbow stops at 5; must follow the 50x rule = 50. Waiting for the jar upload.
