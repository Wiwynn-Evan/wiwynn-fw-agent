# memory/ — Persistent Memory Store

## OVERVIEW

Auto-managed persistent memory for the wiwynn-fw-agent session. All files are Markdown. **Do not manually create or edit files in this directory** — the memory-engine plugin handles lifecycle automatically.

## SCHEMA

```
memory/
├── index.md            # Auto-generated stats + recent session list (DO NOT edit)
├── long-term/          # Enduring knowledge: decisions, patterns, debugging tips
│   ├── decisions.md    # Key architectural decisions
│   ├── patterns.md     # Recurring code patterns and solutions
│   └── debugging.md    # Proven debugging techniques
├── corrections/
│   └── error-notebook.md  # Errors made + fixes. Each entry = ### heading block
├── sessions/           # Per-session logs (auto-created on session.idle)
│   └── YYYY-MM-DD-HH-MM.md
└── reflections/        # Periodic review outputs (created by /reflect command)
```

## PLUGIN BEHAVIORS (memory-engine.ts)

| Event | Action |
|-------|--------|
| `session.created` | Load `memory/index.md` + last 2 session logs into context |
| `session.idle` | Auto-create skeleton `sessions/<YYYY-MM-DD-HH-MM>.md` |
| `compaction` | Inject `corrections/error-notebook.md` + `long-term/decisions.md` + most recent session into output context |
| write guard | Warns if agent directly writes to `memory/index.md` |

## MEMORY COMMANDS

| Command | Action |
|---------|--------|
| `/save-memory` | Save key insight to long-term/ |
| `/recall` | Search memory store for relevant past knowledge |
| `/reflect` | Generate reflection report → reflections/ |
| `/analyze-mistake` | Document an error pattern → corrections/error-notebook.md |
| `/correct` | Update a previous error entry |
| `/backup` | Archive memory snapshot |
| `/sync` | Sync memory index.md from actual files |
| `/recover` | Restore memory from backup |
| `/memory-overview` | Print stats and recent entries |

## ANTI-PATTERNS

- **DO NOT** edit `index.md` directly — overwritten by memory-engine on every sync
- **DO NOT** create `sessions/` files manually — auto-created on session.idle; manual creates break timestamp format
- **DO NOT** store credentials or tokens in any memory file
- **DO NOT** add free-form text to `error-notebook.md` outside `### <heading>` blocks — parser expects structured entries
