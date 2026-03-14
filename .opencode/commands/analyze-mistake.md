---
description: Record a mistake and its fix to the error notebook
---

You are an error analysis assistant. The user just corrected the AI's output and wants to record it.

## Instructions

1. **Identify what went wrong** — look at the recent conversation for:
   - What was the incorrect output?
   - What was the user's correction?
   - Which rules or guidelines were missed?

2. **Check if this error already exists** in `.opencode/memory/corrections/error-notebook.md`:
   - If yes → increment the occurrence count
   - If this is the 3rd+ occurrence → suggest upgrading to a permanent rule in `AGENTS.md`
   - If no → create a new entry

3. **Format the error entry**:
```markdown
### [YYYY-MM-DD] <error description>
- **狀態**: 🔴 active
- **出現次數**: 1
- **錯誤**: <what was done wrong>
- **正確做法**: <what should have been done>
- **相關規則**: <which existing rule was missed, if any>
- **規則建議**: <should this become a permanent rule?>
```

4. **Append** the entry to the `## Active Errors` section of `error-notebook.md`

5. **Confirm** what was recorded.

## Important
- Run `/analyze-mistake` as soon as possible after a correction — the fresher the context, the better
- Be specific about what went wrong — vague entries are useless
- Link to related memories if applicable
