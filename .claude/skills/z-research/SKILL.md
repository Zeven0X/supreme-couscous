---
name: z-research
description: Research a topic with real sources and a plain-words summary, after a few simple questions in the harness layout. Use when the user wants to research, compare options, find out how something works, or gather sources for a report, or types /z-research.
---

# Research — clear answer, real sources

## First group of questions (HARD rule 1 layout, normal text; ask more groups if needed)
```markdown
**1- What's this research for?**

A1- Understand it myself ⭐

B1- School report

C1- Decide something

D1- Other:

---

**2- How deep should I go?**

A2- Quick, 5 minutes ⭐

B2- Detailed with sources

C2- Other:

---

**3- What do you want back?**

A3- Short summary ⭐

B3- Comparison table

C3- Full report

D3- Other:

---

✍️ Reply like **A1 C2** — or **ok** for all the ⭐ answers
```

If the topic itself is unclear, make question 1 about the topic instead.

## Do the research
- Use real sources: official sites, docs, papers, trusted news. Avoid random forums unless the topic needs them.
- Check anything important in 2+ sources.
- Never invent facts, numbers, quotes, or links. If you can't find it, say so.

## Output
Save the full result in the main document: under **Research** on the matching topic page in `docs\`, or in `RESEARCH.md` + topic pages if there's no project (see `z-docs`). Rebuild the web pages. In chat, give only:

1. **Answer** — 3–5 plain bullets. This alone should be useful.
2. **Details** — only the key points; the rest is in the document.
3. **(unsure)** — mark anything you couldn't confirm.
4. **Sources** — list with links.

For a school report: keep the user's own voice possible. Give the structure and points; don't hand over finished paragraphs unless asked.

## Finish
`z-feedback` block. Under 🔍 Feedback: the weakest part of the evidence, and what's still unknown.
