---
name: z-start
description: Kick off any new task or project by asking the user a few simple questions in the harness layout before doing any work. Use when a request is new, vague, or bigger than a quick fix, or when the user types /z-start.
---

# Start — simple questions before building

The user answers slowly and wants to get it right. Ask as many questions as needed, but each one must be beginner-simple.

## Steps
1. **Pick the type** and say it in one line: game, mod, research, creative, or other code.
   - Game or mod → switch to the `z-game` skill.
   - Research → switch to the `z-research` skill.
   - Reel, post, or client job → switch to the `z-brief` skill.
   - The idea is fuzzy ("something like…", "I don't know") → use the `z-idea` skill first.
2. **Look first.** Check project files and the request so you don't ask what you can find.
3. **Ask the first group (up to 4 questions)** in the HARD rule 1 layout (normal text, not a code block):

```markdown
**1- What should it do first?**

A1- <option> ⭐

B1- <option>

C1- <option>

D1- Other:

---

**2- How big should the first version be?**

A2- Tiny, just the main idea ⭐

B2- Small but complete

C2- Other:

---

**3- Who will use it?**

A3- Just me ⭐

B3- Friends

C3- Everyone online

D3- Other:

---

✍️ Reply like **A1 C2** — or **ok** for all the ⭐ answers
```

4. **Stop and wait.**
5. Keep asking groups (up to 4 each, same layout) until you truly understand. Most important first.
6. After answers: repeat the plan back in ≤ 5 short bullets, then use `z-plan`.

## Question rules
- Follow the HARD rule 1 layout exactly: bold `1-` question, `A1-` options, blank line between options, `---` between questions, last option always `Other:`, one ⭐.
- Everyday words, no jargon. One idea per question.
- `ok` = all ⭐ answers. Missing answers = ⭐.

## Before handing off
Quick honest take on the idea: one strength, one risk, one suggestion. One line each.
