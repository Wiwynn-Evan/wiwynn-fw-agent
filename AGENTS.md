# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-15
**Commit:** 50f1d00
**Branch:** main

## OVERVIEW

`wiwynn-fw-agent` is an OhMyOpenCode (OMO) configuration project — AI skills, commands, and agents that automate end-to-end firmware development for Wiwynn BMC/BIC platforms (OpenBMC + OpenBIC/Zephyr). **No application source code here** — everything is Markdown skill files, agent definitions, slash commands, and Python API helpers under `.opencode/`.

## STRUCTURE

```
wiwynn-fw-agent/
├── .opencode/              # OMO platform config (skills, agents, commands, memory)
│   ├── agents/             # 4 agent definitions (fw-issue-analyst, fw-code-analyst, fw-coder, fw-reviewer-sonnet)
│   ├── commands/           # 10 slash commands (/fw-dev pipeline + 9 memory commands)
│   ├── plugins/            # memory-engine.ts — auto session/compaction memory
│   ├── memory/             # Persistent memory store (sessions/, long-term/, corrections/, reflections/)
│   ├── skills/             # 6 domain skills (SKILL.md each)
│   │   └── jira-deep-analysis/scripts/  # 4 Python GitHub/JIRA API helpers
│   ├── config.json         # OMO bash permissions (only rm -rf* denied)
│   └── package.json        # OMO node dependencies (bun)
├── bmc_fw_code/facebook_openbmc/   # Local clone of facebook/openbmc (READ-ONLY reference)
├── bic_fw_code/facebook_openbic/   # Local clone of facebook/OpenBIC (READ-ONLY reference)
├── tools/                  # sync_repos.sh — pull both fw clones
├── opencode.json           # MCP server config (JIRA bun server)
├── .env.example            # Required env vars: GITHUB_TOKEN, JIRA_*
└── README.md
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Run end-to-end firmware dev pipeline | `/fw-dev` → `.opencode/commands/fw-dev.md` |
| JIRA/GitHub issue analysis | `jira-deep-analysis` skill + `fw-issue-analyst` agent |
| Code search in openbmc/OpenBIC repos | `fw-code-researcher` skill + `fw-code-analyst` agent |
| Write C/C++ firmware diffs | `fw-code-writer` skill + `fw-coder` agent |
| Generate commit messages | `fw-commit-generator` skill |
| Review PRs/diffs (7-dimension) | `fw-pr-reviewer` skill + `fw-reviewer-sonnet` agent |
| Review commit messages only | `commit-message-reviewer` skill |
| Sync local fw code clones | `tools/sync_repos.sh` |
| Env credentials setup | `.env.example` → `.env` |
| Save/search/manage memories | `/save-memory`, `/recall`, `/reflect` → `.opencode/commands/` |
| Memory plugin auto-behaviors | `.opencode/plugins/memory-engine.ts` |
| JIRA MCP server config | `opencode.json` + `.opencode/package.json` |

## AGENTS

| Agent | Model | Skill Loaded | Role |
|-------|-------|-------------|------|
| `fw-issue-analyst` | `gpt-5.3-codex` (high reasoning + vision) | `jira-deep-analysis` | Step 1: parse JIRA/GitHub issue, extract images, route platform |
| `fw-code-analyst` | `claude-opus-4.6` | `fw-code-researcher` | Step 2: search repos → locate files → produce modification plan |
| `fw-coder` | `gpt-5.3-codex` (high reasoning) | `fw-code-writer` / `fw-commit-generator` | Step 3+4: write unified diff + EF1900 commit message |
| `fw-reviewer-sonnet` | `claude-sonnet-4.6` | `fw-pr-reviewer` | Step 6: 7-dimension review, APPROVE or REQUEST_CHANGES |

## FIRMWARE WORKFLOW (`/fw-dev`)

```
/fw-dev <JIRA-key | GitHub-Issue-URL>
  Step 1 → fw-issue-analyst   (jira-deep-analysis: platform routing, image extraction)
  Step 2 → fw-code-analyst    (fw-code-researcher: search → grep → fetch)
  Step 3 → fw-coder           (fw-code-writer: unified diff)
  Step 4 → fw-coder           (fw-commit-generator: EF1900 commit msg + [AI Agent] section)
  Step 5 → Atlas (bash)       (git/gh: create branch/PR per policy)
  Step 6 → fw-reviewer-sonnet (fw-pr-reviewer: 7-dimension review)
  Step 7 → loop (REQUEST_CHANGES → fw-coder fix → re-review until APPROVE)
```

## TARGET REPOS (HARDCODED POLICY)

```
ALLOWED — full PR + issue:     Wiwynn/gc2-bmc-collection-script
ALLOWED — branch only, no PR:  facebookexternal/openbmc.wiwynn  |  Wiwynn/OpenBIC
FORBIDDEN (policy violation → stop immediately):
  facebook/openbmc  |  facebook/OpenBIC
```

## PLATFORMS SUPPORTED

| Platform | Reference Repo | SoC | Key files |
|----------|---------------|-----|-----------|
| GC2 oBMC | `facebook/openbmc` `meta-facebook/meta-grandcanyon/` | AST2600 | `pal.c` (4000+ lines) |
| YV4 oBMC | `facebook/openbmc` `meta-facebook/meta-yosemite4/` | AST2600 | `pal.c` |
| gc2-es OpenBIC | `facebook/OpenBIC` `src/platform/gc2-es/` | AST1030 | `plat_class.c`, `plat_sensor_table.c` |

## CODING CONVENTIONS (FIRMWARE TARGETS, NOT THIS REPO)

- **oBMC**: C, `pal_*` prefix, 4-space indent, `syslog(LOG_ERR, "%s() ...", __func__, ...)`, `return -1` on failure
- **OpenBIC**: C/Zephyr, `plat_*` prefix, `LOG_ERR()`/`LOG_WRN()`/`LOG_INF()` macros, tab indent
- **Commit (Meta oBMC GitHub)**: `<platform>: <desc>` + `[Task Description]`/`[Motivation]`/`[Design]`/`[Test Log]` + `[AI Agent]` section
- **Commit (LF oBMC Gerrit)**: `<type>(<scope>): <subject>` — Conventional Commits

## MEMORY SYSTEM

Plugin `.opencode/plugins/memory-engine.ts` auto-manages persistence:
- **session.created** → load index + recent sessions into context
- **session.idle** → auto-create skeleton in `.opencode/memory/sessions/<YYYY-MM-DD-HH-MM>.md`
- **compaction** → inject error-notebook + recent session + decisions.md into output.context
- **write guard** → warns on direct writes to `memory/index.md`

Memory commands: `/save-memory` `/recall` `/reflect` `/analyze-mistake` `/correct` `/backup` `/sync` `/recover` `/memory-overview`

## ANTI-PATTERNS (THIS PROJECT)

- **DO NOT** create PRs/issues against `facebook/openbmc` or `facebook/OpenBIC` — policy violation → stop
- **DO NOT** modify `common/` in OpenBIC without `#ifdef CONFIG_GC2ES` override in `plat_xxx.c` first
- **DO NOT** copy PMBus register offsets across platforms without datasheet cross-check
- **DO NOT** use `sprintf` — use `snprintf(buf, sizeof(buf), ...)` in all generated C code
- **DO NOT** write vague Test Log sections ("Tested and verified" is explicitly rejected)
- **DO NOT** add `subtask: true` to `/fw-dev` command — breaks pipeline architecture
- **DO NOT** store credentials in any `.md` file — all secrets go in `.env` (gitignored)
- **DO NOT** conclude jira-deep-analysis before all parallel agents finish — premature conclusion is the #1 failure mode

## ENV SETUP

```bash
cp .env.example .env
# Fill: GITHUB_TOKEN, JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN
cd .opencode && bun install   # install JIRA MCP server deps
```

Python scripts auto-load `.env` from `.opencode/skills/jira-deep-analysis/scripts/`.

## NOTES

- JIRA key prefix → platform: `GC20T5T7-` = GC2 oBMC, `GC2-`/`GC2ES-` = OpenBIC, `YV4T1M-` = YV4 oBMC
- `bmc_fw_code/` and `bic_fw_code/` are **read-only local clones** of upstream repos; use `tools/sync_repos.sh` to update
- No build system, no test framework — pure configuration project
- `opencode.json` configures a local bun JIRA MCP server (`jira-mcp-server/dist/index.js`)
