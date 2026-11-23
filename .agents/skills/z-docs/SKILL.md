---
name: z-docs
description: Create, read, and update the project's main document - PROJECT.md (the index) plus one page per big topic in the docs folder, each element with its own history. Use at the start of every project task, after every finished feature, after research, or when the user types /z-docs.
---

# Main project document — index + topic pages

The project's whole story lives in one place, split like a book:

```
PROJECT.md                      ← the index (home page)
docs\
  enchantment-rework.md         ← one page per big topic
  mobs.md
  ui-and-menus.md
```

## How the AI uses it (every task)
1. Read `PROJECT.md` first: quick facts, the list of pages, where we stopped.
2. Open **only the page(s)** the task is about. Don't read every page.
3. Don't ask questions the pages already answer.

## Page rules
- **One page = one big topic** (e.g. Enchantments, Mobs, World generation, UI), with many elements inside.
- **File names never change and never contain numbers**: `docs\enchantment-rework.md`. This keeps links working.
- **Page numbers are not fixed.** The number is just the row's position in the index table. Put pages in a sensible order (core gameplay first) and renumber freely when pages are added.
- New topic → new page + new row in the index.
- A page gets too long (about 15+ elements) → split it into two pages, link them to each other, update the index.
- A whole topic removed → keep the page, mark it ❌ Removed in the index with the reason, move its row to the bottom.

## Element rules (inside a page)
- New element → row in the page's Elements table (🧪 In progress → ✅ Active) + a details section.
- Changed element → update its row and details, add a dated line to **its own** History. Big redesign = 🔄 Reworked, with "Before:" saying how it used to work.
- Removed element → **never delete it.** ❌ Removed, date, and reason. Keep its details and history.
- Using any free asset (art, sound, code) → add its author, license, and link to "Before publishing" in the index.
- Every change also goes as one line in the page's **Topic history** and in the index's **Recent changes**.
- The user reads these pages, not the code: "How it works" must explain the logic in simple words.
- Simple words only. Explain technical words in brackets. Never invent facts; write `(unsure)` if unsure.

## Index template — `PROJECT.md`
```markdown
# <Project name>

> <One sentence: what this project is.>

## Quick facts
| | |
|---|---|
| Type | <Unity game / Minecraft mod / other> |
| Game or engine version | <e.g. Minecraft 1.21.1, Unity 6000.0> |
| Mod loader | <e.g. NeoForge 21.1.x, or n/a> |
| Language | <C# / Java / Python> |
| Art plan | <Agent makes simple art / I make my own / both> |
| Status | <Idea / Playable / Polishing / Finished> |

## How to run it
1. <exact step>

## Where we stopped
- **Last done:** <one line>
- **Next up:** <one line>
- **Open questions:** <one line, or "none">

## Pages
| # | Page | What's inside | Status | Last changed |
|---|---|---|---|---|
| 1 | [Core gameplay](docs/core-gameplay.md) | <one line> | ✅ Active | <YYYY-MM-DD> |
| 2 | [Enchantment rework](docs/enchantment-rework.md) | <one line> | 🔄 Reworked | <YYYY-MM-DD> |

## Recent changes
- <YYYY-MM-DD> — [<Page>](docs/<page>.md) — Added/Changed/Removed: <one line>

## Known problems
- <problem> — <workaround if any>

## Ideas for later
- <idea> (only ideas that fit the project's goal)

## Before publishing (later)
- Asset credits: <every free asset used, its author, license, link>
- License for this project: <not chosen yet>
- Store page notes: <short description, screenshots to take>
```

## Topic page template — `docs\<topic>.md`
```markdown
# <Topic name>

> <One sentence: what this topic is about, in simple words.>

[← Back to index](../PROJECT.md)

## Overview
<2–4 simple sentences: how this part of the game works overall.>

## Elements
| Element | Status | Added | Last changed | What it does |
|---|---|---|---|---|
| <name> | ✅ Active | <YYYY-MM-DD> | <YYYY-MM-DD> | <one line> |

## Element details
### <Element name>
- **What it does:** <simple words>
- **How it works:** <simple step-by-step explanation of the code behind it, so the user never needs to read the code>
- **How to try it:** <exact steps>
- **Files:** `<path>` — <what this file is for>
- **Settings you can tweak:** <name = value, where>
- **Before:** <only if reworked>
- **History:**
  - <YYYY-MM-DD> — Added: <...>
  - <YYYY-MM-DD> — Changed: <old> → <new> (<why>)

## Related pages
- [<Other topic>](<other-topic>.md) — <how they connect>

## Topic history
- <YYYY-MM-DD> — <Element>: Added/Changed/Removed — <one line>

## Research
### <Question> (<YYYY-MM-DD>)
- **Answer:** <3–5 simple bullets>
- **Sources:** <links>
```

## Make the colorful pages
After every update, rebuild the web pages (index + every topic page, with a menu of all pages on each one). From the project folder run:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.zeven-harness\make-project-page.ps1"
```
- It creates `PROJECT.html` and `docs\<topic>.html`. The user opens `PROJECT.html` in Chrome.
- Never edit the `.html` files by hand. If the tool is missing, tell the user to re-run the harness installer.
- Research with no project: write `RESEARCH.md` (same layout as the index, topics as pages) and run the tool with `-Index RESEARCH.md`.

## Then tell the user in chat
Under "📘 Project doc updated", one or two lines naming the pages, e.g. "Enchantment rework: added Frost Edge, changed Fire Aspect damage 4 → 6. Open PROJECT.html to see it."
