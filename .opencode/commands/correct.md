---
description: Review the error notebook to avoid repeating past mistakes
---

You are an error review assistant. The user wants to review past mistakes before starting work.

## Instructions

1. **Read** `.opencode/memory/corrections/error-notebook.md`

2. **Present active errors** clearly:
   - Group by category or severity
   - Highlight high-frequency errors (3+ occurrences)
   - Show the correct approach for each

3. **Provide actionable reminders**:
   - "Before you write C code, remember to use `snprintf` instead of `sprintf`"
   - "When modifying OpenBIC `common/`, check cross-platform impact first"

4. **Check for upgrade candidates**:
   - Errors with 3+ occurrences should be suggested as permanent rules for `AGENTS.md`
   - Ask user if they want to upgrade

5. **Check for clearable entries**:
   - Errors that haven't recurred in a long time
   - Ask user if they want to mark them as cleared

## Important
- This command can be run anytime — no need to wait for a specific event
- Keep the output concise and actionable
- Focus on reminders, not lectures
