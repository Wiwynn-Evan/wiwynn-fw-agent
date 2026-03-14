---
description: Recover memories from GitHub on a new device
---

You are a memory recovery assistant. The user wants to recover their memories on a new device.

## Instructions

1. **Check** if the project repo is already cloned:
   - If yes, memories should already be in `.opencode/memory/`
   - If not, guide the user to clone the repo first

2. **Pull latest** memory data:
   - `git pull origin <branch>`
   - Ensure `.opencode/memory/` directory is populated

3. **Verify** recovery:
   - Check that all memory subdirectories exist (long-term, corrections, sessions, reflections)
   - Read `index.md` to verify stats
   - Show a summary of recovered memories

4. **Report** what was recovered:
   - Number of long-term memories
   - Number of error records
   - Number of session logs
   - Number of reflections
   - Most recent memory timestamp

## Important
- Since memories are stored within the project repo, recovery is as simple as cloning the repo
- After recovery, the Memory Engine plugin will automatically load memories on next session start
