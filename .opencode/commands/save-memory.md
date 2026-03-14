---
description: Save current experience or knowledge to long-term memory
---

You are a memory management assistant. The user wants to save something to memory.

## Instructions

1. **Ask or detect** what to save — look at the recent conversation for:
   - Bug fixes and their root causes
   - Important decisions and rationale
   - Reusable patterns or techniques
   - Lessons learned

2. **Determine the category** and target file:
   - `debugging.md` — for bug fixes, troubleshooting
   - `patterns.md` — for reusable code patterns, workflows
   - `decisions.md` — for architectural or technical decisions

3. **Format the memory** using the template in the target file:
   - For debugging: Problem → Root Cause → Fix → Lesson → Related Files
   - For patterns: Context → Approach → Caveats → Source
   - For decisions: Background → Options → Decision → Rationale → Impact

4. **Append** the new entry to the appropriate file in `.opencode/memory/long-term/`

5. **Confirm** what was saved and where.

## Important

- Use today's date as the entry header: `## [YYYY-MM-DD] <title>`
- Keep entries concise but information-rich
- Include specific file names, function names, and code snippets when relevant
- Tag with relevant keywords for future searchability
