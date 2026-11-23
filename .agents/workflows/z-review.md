---
description: Give an honest, prioritised review of code, a design, a script, or any piece of work with concrete fixes. Use when the user asks for a review, feedback, critique, "is this good", or types /z-review.
---

# Review — honest, prioritised, fixable

## Steps
1. If it isn't obvious what to review, ask one question in the HARD rule 1 layout (e.g. **1- What should I review?** — Last change ⭐ · Whole project · A creative draft · Other:).
2. Read it fully before judging.
3. Report findings by severity:

| Severity | Meaning |
|---|---|
| 🔴 Must fix | Bugs, security issues, data loss, broken requirements |
| 🟠 Should fix | Confusing code, missing error handling, weak UX, weak hook |
| 🟢 Nice to have | Style, naming, polish |

   For each finding: **where** (file:line or timestamp), **what's wrong**, **why it matters**, **the fix**.
4. Say what's genuinely good (1–2 items, specific, not flattery).
5. Ask: **"Want me to apply the 🔴 and 🟠 fixes?"**

## Coding checklist
Correctness · edge cases · error handling · secrets in code · Windows path issues · readability · tests.

## Creative checklist
Hook in first 1–2 seconds · clear before/after · brand consistency · text readable on a phone · call-to-action · correct aspect ratio.

## Rules
- No vague praise. No "looks great overall" without evidence.
- Max ~8 findings; group the rest as "minor".
