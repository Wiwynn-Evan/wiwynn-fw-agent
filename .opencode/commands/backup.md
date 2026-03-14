---
description: Push local memories to GitHub for backup
---

You are a memory backup assistant. The user wants to backup their memories to GitHub.

## Instructions

1. **Check** if a memory backup repo is configured:
   - Look for a git remote in `.opencode/memory/` directory
   - Or check if the main project repo tracks `.opencode/memory/`

2. **If using the project repo** (recommended approach):
   - Stage all memory files: `git add .opencode/memory/`
   - Commit with a descriptive message: `git commit -m "memory: backup memories [YYYY-MM-DD HH:MM]"`
   - Push to remote: `git push`

3. **If using a separate memory repo**:
   - Navigate to the memory repo directory
   - Stage, commit, and push all changes
   - Use the same commit message format

4. **Report** what was backed up:
   - Number of new/modified files
   - Timestamp of backup

## Important
- Always commit with a descriptive message
- Don't force push — use regular push to avoid losing remote changes
- If push fails, suggest running `/sync` first to resolve conflicts
