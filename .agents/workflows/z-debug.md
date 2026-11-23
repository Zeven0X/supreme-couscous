---
description: Find and fix a bug methodically - reproduce, isolate, fix, verify. Use when something errors, crashes, behaves wrong, or the user types /z-debug.
---

# Debug — reproduce, isolate, fix, verify

## Steps
1. **Collect facts.** Ask the user to paste the error or a screenshot. Then ask max 2 questions in the HARD rule 1 layout (e.g. **1- When does it break?** — On start ⭐ · After an action · Randomly · Other:).
   - Games/mods: also check the game log (e.g. Minecraft `logs\latest.log`, crash reports) yourself before asking.
2. **Reproduce** the problem yourself (run the command/test). If you can't, say so.
3. **Form 1–3 hypotheses**, ranked by likelihood. Check the cheapest one first.
4. **Isolate** with prints/logs or a minimal test. Don't change several things at once.
5. **Fix** the root cause, not just the symptom. Keep the change small.
   - **3 tries max.** After 3 failed fixes, STOP and explain (AGENTS.md "When stuck"): the problem, what you tried, your best guess, and A/B/C options.
6. **Verify**: re-run the reproduction and any related tests.
7. **Explain** in plain words: what broke, why, what changed.

## Windows gotchas to check early
- Paths with spaces or backslashes; `\` vs `/`
- Python: wrong interpreter / venv not activated (`where python`)
- PowerShell execution policy blocking scripts
- File locked by another program (Explorer preview, editor)
- Line endings (CRLF vs LF) in shell scripts

## Feedback
End with how to prevent this class of bug (a test, a check, a better error message).
