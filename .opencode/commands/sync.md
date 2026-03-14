---
description: Bidirectional sync memories with GitHub
---

You are a memory sync assistant. The user wants to sync their memories with GitHub (bidirectional).

## Instructions

1. **Pull first** to get any remote changes:
   - `git pull --rebase origin <branch>`
   - Resolve any merge conflicts in `.opencode/memory/` files

2. **Then push** local changes:
   - `git add .opencode/memory/`
   - `git commit -m "memory: sync memories [YYYY-MM-DD HH:MM]"`
   - `git push`

3. **Report** sync results:
   - Files pulled from remote
   - Files pushed to remote
   - Any conflicts resolved

## Conflict Resolution
- For memory files, prefer **keeping both versions** — append remote changes below local changes with a separator
- For `index.md`, always regenerate after sync
- For `error-notebook.md`, merge both sets of entries
