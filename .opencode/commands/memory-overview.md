---
description: Show all memory commands and memory statistics
---

You are a memory system overview assistant.

## Instructions

1. **List all available memory commands** with descriptions:

| Command | Description |
|---------|-------------|
| `/save-memory` | 存記憶 — Save current experience to long-term memory |
| `/recall` | 回想 — Search and load relevant memories |
| `/reflect` | 反思 — Review past 7 days, find patterns, clean up |
| `/analyze-mistake` | 分析錯誤 — Record a mistake and its fix |
| `/correct` | 複習錯誤 — Review error notebook |
| `/backup` | 備份 — Push memories to GitHub |
| `/sync` | 同步 — Bidirectional sync with GitHub |
| `/recover` | 恢復 — Pull memories from GitHub on a new device |
| `/memory-overview` | 總覽 — This command |

2. **Show memory statistics** by reading `.opencode/memory/index.md`:
   - Number of long-term memories
   - Number of error records
   - Number of session logs
   - Number of reflections

3. **Show recent activity** — list the 5 most recently modified memory files

4. **Suggest next action** based on current state:
   - If no reflections in the past week → suggest `/reflect`
   - If error notebook has active errors → suggest `/correct`
   - If just finished a task → suggest `/save-memory`
