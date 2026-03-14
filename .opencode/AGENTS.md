# .opencode/ — OMO Platform Configuration

## OVERVIEW

All OhMyOpenCode (OMO) platform definitions for wiwynn-fw-agent: agents, commands, skills, memory, and permissions. No application code — all files are Markdown instruction documents + node config.

## STRUCTURE

```
.opencode/
├── agents/                 # 4 specialized agents (see agents/AGENTS.md)
│   ├── fw-issue-analyst.md # gpt-5.3-codex, high reasoning + vision
│   ├── fw-code-analyst.md  # claude-opus-4.6
│   ├── fw-coder.md         # gpt-5.3-codex, high (code) / medium (commit)
│   └── fw-reviewer-sonnet.md # claude-sonnet-4.6
├── commands/               # 10 slash commands (1 pipeline + 9 memory)
│   ├── fw-dev.md           # /fw-dev — full pipeline orchestrator (subtask: false)
│   ├── save-memory.md      # /save-memory
│   ├── recall.md           # /recall
│   ├── reflect.md          # /reflect
│   ├── analyze-mistake.md  # /analyze-mistake
│   ├── correct.md          # /correct
│   ├── backup.md           # /backup
│   ├── sync.md             # /sync
│   ├── recover.md          # /recover
│   └── memory-overview.md  # /memory-overview
├── skills/                 # 6 domain skills (see skills/AGENTS.md)
├── memory/                 # Persistent memory store (see memory/AGENTS.md)
├── plugins/
│   └── memory-engine.ts    # Auto session/compaction memory plugin
├── config.json             # Bash permissions: only "rm -rf *" denied
└── package.json            # OMO node dependencies (bun, JIRA MCP server)
```

## WHERE TO LOOK

| What | File |
|------|------|
| Policy: which repos allowed | `commands/fw-dev.md` Safety Gate section |
| All 4 agents + models | `agents/AGENTS.md` |
| Memory schema + auto-behaviors | `memory/AGENTS.md` |
| Skill loading in pipeline | `commands/fw-dev.md` Steps 1–6 |
| OMO bash permission rules | `config.json` |

## CONVENTIONS

- Every skill lives in its own subdirectory: `skills/{skill-name}/SKILL.md`
- Every agent lives in `agents/{name}.md` with YAML frontmatter (`name`, `description`, `model`)
- Commands use `subtask: false` frontmatter — prevents accidental recursive spawning
- Skills are loaded with `skill({name: "skill-name"})` inside command/agent flow, not pre-loaded
- Memory files are auto-managed by `plugins/memory-engine.ts` — do not manually create session files

## ANTI-PATTERNS

- **DO NOT** add `subtask: true` to `/fw-dev` — would break the pipeline architecture
- **DO NOT** store credentials in any `.md` file — all secrets go in `.env` (gitignored)
- **DO NOT** put platform-specific code logic in commands — commands orchestrate, skills implement
- **DO NOT** edit `memory/index.md` directly — auto-managed by memory-engine.ts
