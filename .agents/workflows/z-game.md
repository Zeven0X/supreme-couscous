---
description: Start or grow a game or mod project - simple questions in the harness layout, then a playable-first plan built one feature at a time. Use for any game, game mod (Minecraft, etc.), game feature, or fun interactive project, or when the user types /z-game.
---

# Game & mod builder — playable first

**Fuzzy idea?** Use `z-idea` first to shape it.

**First:** read `PROJECT.md` (the index) and only the topic pages you need (see `z-docs`). Don't ask what they already answer. No `PROJECT.md` yet → create it after the questions.

## First group of questions (HARD rule 1 layout, normal text)
```markdown
**1- Is this a new project or an old one?**

A1- Brand new ⭐

B1- Add to existing

C1- Fix something

D1- Other:

---

**2- What does the player do most?**

A2- <best guess from request> ⭐

B2- <option>

C2- <option>

D2- Other:

---

**3- How big should the first version be?**

A3- Tiny, playable today ⭐

B3- Small, a few features

C3- Other:

---

✍️ Reply like **A1 C2** — or **ok** for all the ⭐ answers
```

## Next groups — keep asking until it's clear (skip anything the files already show)
Topics to ask about, each as its own question in the layout (⭐ = usual best pick):
**Games:**
- Engine/tool: Unity ⭐ · Minecraft mod (NeoForge) · Something simpler
- Art: You make simple art ⭐ · I make my own · Both
- Plays on: PC ⭐ · Browser · Phone

**Mods:**
- Minecraft version (changes per project): <found in gradle.properties> ⭐ · another version — confirm the **exact** one
- Mod loader: NeoForge ⭐
- Mod type: New items/blocks ⭐ · New mob · Gameplay change

Never guess the game version or mod loader. If the project files show them, say what you found instead of asking.

## Plan (show it, wait for "go")
1. **Core loop** — the one thing the player does, working with placeholder art.
2. **Win / lose / goal** — why keep playing.
3. **One feature at a time** — each with a "how to test" line.
4. **Juice** — sound, effects, polish — only after it's fun.

Each step ≤ 1 line. Max 8 steps.

## While building
- After every feature: run it if you can, then **STOP** with the feature-done block from HARD rule 2: what you did step by step, how to try it (1–3 exact steps, e.g. "Launch the game, press E, the orb should glow"), and the "What next?" question in the layout. Wait for the reply.
- Teach as you go (HARD rule 5): explain each new file and idea in beginner words, plus one "💡 Learn:" point.
- Keep tweakable numbers (speed, damage, spawn rate, drop chance) in one config spot.
- After each feature, update the right topic page in `docs\`, the index, and rebuild the web pages (`z-docs` rules: never erase history; removed = ❌ with reason).
- Zip backup to `%USERPROFILE%\ZevenBackups\<project>\` before risky changes (no Git; keep every backup; see HARD rule 3).
- Mods: check every class/method against the exact version's API. Version mixups are the #1 mod bug.
- If something isn't fun, suggest 2–3 small tweaks to try before any rewrite.

## Finish
Use the `z-feedback` block. Under 🔍 Feedback, include one honest line on **fun**: what will likely feel boring or frustrating to a player, and why.
