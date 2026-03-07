# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-08
**Commit:** fdbfb83
**Branch:** main

## OVERVIEW

`wiwynn-fw-agent` is an OhMyOpenCode (OMO) configuration project — a collection of AI skills, commands, and agents that automate end-to-end firmware development workflows for Wiwynn BMC/BIC platforms (OpenBMC + OpenBIC/Zephyr). There is **no application source code** in this repo; everything lives as Markdown skill files and Python utility scripts under `.opencode/`.

## STRUCTURE

```
wiwynn-fw-agent/
├── .opencode/              # OMO platform config (skills, agents, commands)
│   ├── agents/             # Custom agent definitions (fw-coder)
│   ├── commands/           # Slash commands (/fw-dev)
│   ├── skills/             # 6 domain skills (SKILL.md each)
│   │   └── jira-deep-analysis/scripts/  # 4 Python GitHub/JIRA API helpers
│   ├── config.json         # OMO permissions (only rm -rf* denied)
│   └── package.json        # OMO node dependencies
├── .env.example            # Required env vars: GITHUB_TOKEN, JIRA_*
├── .gitignore
└── README.md
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Start a firmware dev workflow | `/fw-dev` → `.opencode/commands/fw-dev.md` |
| JIRA/GitHub issue analysis | `jira-deep-analysis` skill |
| Code search in openbmc/OpenBIC repos | `fw-code-researcher` skill + `jira-deep-analysis/scripts/` |
| Write C/C++ firmware diffs | `fw-code-writer` skill + `fw-coder` agent |
| Generate commit messages | `fw-commit-generator` skill |
| Review PRs/diffs | `fw-pr-reviewer` skill |
| Review commit messages only | `commit-message-reviewer` skill |
| Env credentials setup | `.env.example` → `.env` |

## FIRMWARE WORKFLOW (`/fw-dev`)

```
JIRA key / GitHub Issue URL
  → jira-deep-analysis  (Route A=oBMC Linux, Route B=OpenBIC/Zephyr, Route G=GitHub Issue)
  → fw-code-researcher  (search → grep → fetch 3-step workflow)
  → fw-coder agent + fw-code-writer  (unified diff output)
  → fw-commit-generator  (EF1900 conventions: Meta oBMC or LF oBMC)
  → fw-pr-reviewer  (7-dimension review loop until APPROVE)
```

## TARGET REPOS (HARDCODED POLICY)

```
ALLOWED to create PR/issue:
  Wiwynn/gc2-bmc-collection-script

ALLOWED to create branches only (no PR/issue):
  facebookexternal/openbmc.wiwynn
  Wiwynn/OpenBIC

FORBIDDEN (policy violation → stop):
  facebook/openbmc
  facebook/OpenBIC
```

## PLATFORMS SUPPORTED

| Platform | Repo | SoC | Key files |
|----------|------|-----|-----------|
| GC2 oBMC (Grand Canyon 2) | `facebook/openbmc` `meta-facebook/meta-grandcanyon/` | AST2600 | `pal.c` (4000+ lines) |
| YV4 oBMC (Yosemite V4) | `facebook/openbmc` `meta-facebook/meta-yosemite4/` | AST2600 | `pal.c` |
| gc2-es OpenBIC | `facebook/OpenBIC` `src/platform/gc2-es/` | AST1030 (Zephyr) | `plat_class.c`, `plat_sensor_table.c` |

## CODING CONVENTIONS (FIRMWARE TARGETS, NOT THIS REPO)

- **oBMC**: C, `pal_*` API prefix, 4-space indent, `syslog(LOG_ERR, "%s() ...", __func__, ...)`, return `-1` on failure
- **OpenBIC**: C/Zephyr, `plat_*` prefix, `LOG_ERR()`/`LOG_WRN()`/`LOG_INF()` macros, tab indent
- **Commit format (Meta oBMC GitHub)**: `<platform>: <description>` + `[Task Description]`/`[Motivation]`/`[Design]`/`[Test Log]`
- **Commit format (LF oBMC Gerrit)**: `<type>(<scope>): <subject>` — Conventional Commits

## ANTI-PATTERNS (THIS PROJECT)

- **DO NOT** create PRs or issues against `facebook/openbmc` or `facebook/OpenBIC` — policy violation
- **DO NOT** modify `common/` in OpenBIC without evaluating cross-platform impact
- **DO NOT** copy device-specific values (PMBus register offsets) across platforms without datasheet verification
- **DO NOT** use `sprintf` — use `snprintf(buf, sizeof(buf), ...)` in generated C code
- **DO NOT** write vague Test Log sections ("Tested and verified" is explicitly rejected)

## ENV SETUP

```bash
cp .env.example .env
# Fill: GITHUB_TOKEN, JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN
```

Python scripts in `.opencode/skills/jira-deep-analysis/scripts/` auto-load `.env` from their own directory.

## NOTES

- JIRA key prefix determines platform: `GC20T5T7-` = GC2 oBMC, `GC2-`/`GC2ES-` = OpenBIC, `YV4T1M-` = YV4 oBMC
- GitHub Issue URL (`https://github.com/{owner}/{repo}/issues/{N}`) also accepted by `/fw-dev` → Route G
- No build system, no test framework in this repo — it is pure configuration
- `.opencode/config.json` only denies `rm -rf *` via bash permissions
