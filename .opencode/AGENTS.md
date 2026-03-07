# .opencode/ — OMO Platform Configuration

## OVERVIEW

All OhMyOpenCode (OMO) platform definitions for wiwynn-fw-agent: agents, commands, skills, and permissions. No application code here — all files are Markdown instruction documents + node config.

## STRUCTURE

```
.opencode/
├── agents/
│   └── fw-coder.md         # Specialized C/Zephyr diff-writer agent (model: gpt-5.3-codex)
├── commands/
│   └── fw-dev.md           # /fw-dev slash command — full pipeline orchestrator (subtask: false)
├── skills/
│   ├── commit-message-reviewer/SKILL.md
│   ├── fw-code-researcher/SKILL.md
│   ├── fw-code-writer/SKILL.md
│   ├── fw-commit-generator/SKILL.md
│   ├── fw-pr-reviewer/SKILL.md
│   └── jira-deep-analysis/ # Most complex skill — has scripts/ subdirectory
├── config.json             # Bash permissions: only "rm -rf *" denied
└── package.json            # OMO node dependencies
```

## WHERE TO LOOK

| What | File |
|------|------|
| Policy: which repos allowed | `commands/fw-dev.md` Safety Gate section |
| fw-coder agent capabilities | `agents/fw-coder.md` |
| Skill loading (how `/fw-dev` calls skills) | `commands/fw-dev.md` Steps 1–6 |
| OMO bash permission rules | `config.json` |

## CONVENTIONS

- Every skill lives in its own subdirectory: `skills/{skill-name}/SKILL.md`
- Every agent lives in `agents/{name}.md` with YAML frontmatter (`name`, `description`, `model`)
- Commands use `subtask: false` frontmatter — prevents accidental recursive spawning
- Skills are loaded with `skill({name: "skill-name"})` inside command flow, not pre-loaded

## ANTI-PATTERNS

- **DO NOT** add `subtask: true` to `/fw-dev` — would break the pipeline architecture
- **DO NOT** store credentials in any `.md` file — all secrets go in `.env` (gitignored)
- **DO NOT** put platform-specific code logic in commands — commands orchestrate, skills implement
