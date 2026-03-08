# wiwynn-fw-agent

An [OhMyOpenCode (OMO)](https://opencode.dev) configuration project that automates end-to-end firmware development workflows for Wiwynn BMC/BIC platforms. This repo contains **no application source code** — everything is defined as Markdown skill files, agent definitions, slash commands, and Python utility scripts under `.opencode/`.

## What It Does

Given a **JIRA ticket** or **GitHub Issue URL**, the `/fw-dev` command orchestrates a fully automated pipeline:

```
JIRA Key / GitHub Issue URL
  → Issue Analysis          (understand the problem)
  → Code Research           (find relevant source code)
  → Code Writing            (generate unified diff)
  → Commit Message          (EF1900-compliant format)
  → PR Creation             (with AI Agent markings)
  → PR Review Loop          (7-dimension quality gate, iterate until APPROVE)
```

The pipeline supports two firmware platforms:

| Platform | Ecosystem | SoC | Repo |
|----------|-----------|-----|------|
| GC2 oBMC (Grand Canyon 2) | OpenBMC Linux | AST2600 | `facebook/openbmc` `meta-facebook/meta-grandcanyon/` |
| YV4 oBMC (Yosemite V4) | OpenBMC Linux | AST2600 | `facebook/openbmc` `meta-facebook/meta-yosemite4/` |
| gc2-es OpenBIC | Zephyr RTOS | AST1030 | `facebook/OpenBIC` `src/platform/gc2-es/` |

---

## OhMyOpenCode Architecture

This project extends the [OhMyOpenCode](https://opencode.dev) AI coding platform with three types of components:

### Commands

Slash commands that users invoke directly in the OMO chat interface.

| Command | File | Description |
|---------|------|-------------|
| `/fw-dev` | `.opencode/commands/fw-dev.md` | End-to-end firmware development orchestrator. Accepts a JIRA key or GitHub Issue URL, then delegates to agents and skills through a multi-step pipeline with built-in safety guardrails. |

### Agents

Specialized AI agents with dedicated models, each optimized for a specific role in the pipeline.

| Agent | Model | Role |
|-------|-------|------|
| `fw-analyst-codex` | GPT-5.3 Codex (high reasoning) | Deep structural analysis of JIRA tickets and GitHub issues with enhanced reasoning capability. Routes issues to the correct platform (oBMC Linux vs OpenBIC Zephyr). |
| `fw-coder` | GPT-5.3 Codex | Firmware code writer. Reads source files, generates unified diffs preserving existing code style. |
| `fw-reviewer-sonnet` | Claude Sonnet 4.6 | Fast iterative PR reviewer. Evaluates diffs across 7 quality dimensions and outputs structured feedback. |
| `fw-analyst-opus` | Claude Opus 4.6 | Deep structural analysis of JIRA tickets and GitHub issues. Routes issues to the correct platform (oBMC Linux vs OpenBIC Zephyr). |

### Skills

Domain knowledge modules that agents load on demand. Each skill is a self-contained Markdown document with rules, templates, and examples.

| Skill | Description |
|-------|-------------|
| `jira-deep-analysis` | Analyzes JIRA tickets and GitHub issues. Routes by platform (oBMC/OpenBIC/GitHub). Includes Python scripts for GitHub Search API, file fetching, and JIRA API integration. |
| `fw-code-researcher` | Searches openbmc/OpenBIC repos to locate target files and functions. Produces a structured modification plan (which files to change, how, and why). |
| `fw-code-writer` | Reads original source files and writes C/C++ firmware code. Outputs unified diffs that can be directly `git apply`'d. Follows platform-specific coding conventions. |
| `fw-commit-generator` | Generates commit messages following EF1900 department conventions. Supports Meta oBMC (GitHub) and LF oBMC (Gerrit) formats, with `[AI Agent]` section for AI-generated commits. |
| `fw-pr-reviewer` | Reviews PR diffs across 7 dimensions: Coding Style, Error Handling, Memory Safety, Commit Message, Platform Isolation, Logic Correctness, Test Coverage. Outputs APPROVE or structured REQUEST_CHANGES. |
| `commit-message-reviewer` | Standalone commit message linter. Auto-detects platform (GitHub=Meta oBMC, Gerrit=LF oBMC) and validates format, structure, and completeness. |

---

## How the Pipeline Works

```
┌──────────────────────────────────────────────────────────────┐
│  User: /fw-dev GC20T5T7-1234                                │
│         (or: /fw-dev https://github.com/.../issues/9)       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 1: Issue Analysis (fw-analyst-codex + jira-deep-analysis│
│  → Parse issue, identify platform, scope, requirements       │
│  → Route: A=oBMC Linux, B=OpenBIC/Zephyr, G=GitHub Issue    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 2: Code Research (fw-analyst-opus + fw-code-researcher)│
│  → Search repos → grep files → fetch source                 │
│  → Output: structured modification plan with line numbers    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 3: Code Writing (fw-coder + fw-code-writer)            │
│  → Read original files, write code, produce unified diff     │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 4: Commit Message (fw-coder + fw-commit-generator)     │
│  → Generate EF1900-compliant commit message                  │
│  → [Task Description] [Motivation] [Design] [Test Log]      │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 5: PR Creation                                        │
│  → Create branch, commit, push, open PR                     │
│  → Title with (Agent) suffix, body with AI disclaimer       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 6–7: Review Loop                                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  fw-reviewer-sonnet + fw-pr-reviewer                  │  │
│  │  → 7-dimension review                                 │  │
│  │  → APPROVE? → Done ✅                                  │  │
│  │  → REQUEST_CHANGES? → fw-coder fixes → re-review ↻    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## /fw-dev Step Summary (Model & Variant)

The following table summarizes the models and reasoning variants used at each stage of the `/fw-dev` pipeline.

| Step | Purpose | Agent / Tool | Model | Variant / Reasoning Policy |
|---|---|---|---|---|
| 1 | Issue Analysis | `fw-analyst-codex` | GPT-5.3 Codex | High reasoning (deep issue analysis) |
| 2 | Code Research | `fw-analyst-opus` | Claude Opus 4.6 | No explicit variant in command |
| 3 | Code Writing | `fw-coder` | GPT-5.3 Codex | High reasoning (complex multi-repo logic) |
| 4 | Commit Message | `fw-coder` | GPT-5.3 Codex | Medium reasoning (concise EF1900 format) |
| 5 | PR Creation | Atlas | Direct (Bash) | N/A (Policy-based execution) |
| 6 | PR Review | `fw-reviewer-sonnet`| Claude Sonnet 4.6| No explicit variant in command |
| 7 | Fix Loop | `fw-coder` | GPT-5.3 Codex | Reuse Step 3/4/6 policies for iterations |

---

## Repository Structure

```
wiwynn-fw-agent/
├── .opencode/                          # OhMyOpenCode platform configuration
│   ├── agents/                         # Custom agent definitions
│   │   ├── fw-analyst-codex.md          #   Issue analyzer (GPT-5.3 Codex, high reasoning)
│   │   ├── fw-coder.md                 #   Code writer (GPT-5.3 Codex)
│   │   └── fw-reviewer-sonnet.md       #   PR reviewer (Claude Sonnet)
│   ├── commands/
│   │   └── fw-dev.md                   # /fw-dev slash command (pipeline orchestrator)
│   ├── skills/                         # Domain knowledge modules
│   │   ├── commit-message-reviewer/    #   Commit message linter
│   │   ├── fw-code-researcher/         #   Code search & modification planner
│   │   ├── fw-code-writer/             #   Unified diff generator
│   │   ├── fw-commit-generator/        #   Commit message generator
│   │   ├── fw-pr-reviewer/             #   7-dimension PR reviewer
│   │   └── jira-deep-analysis/         #   Issue analyzer + Python API scripts
│   │       └── scripts/
│   │           ├── fetch_github_file.py #     Fetch file content from GitHub
│   │           ├── fetch_jira.py        #     Fetch JIRA ticket details
│   │           ├── grep_github_file.py  #     Search within GitHub files
│   │           └── search_github.py     #     GitHub code search API
│   ├── config.json                     # Bash permission rules
│   └── package.json                    # OMO node dependencies
├── .env.example                        # Required environment variables
├── opencode.json                       # MCP server configuration (JIRA)
└── README.md
```

---

## Getting Started

### Prerequisites

- [OhMyOpenCode](https://opencode.dev) installed and configured
- [Bun](https://bun.sh) runtime (for JIRA MCP server)
- GitHub personal access token
- JIRA API token (if using JIRA integration)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Wiwynn/wiwynn-fw-agent.git
   cd wiwynn-fw-agent
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in your credentials:
   ```env
   # GitHub API Token (for repo access and Python scripts)
   GITHUB_TOKEN=your_github_token_here

   # JIRA API credentials (for jira-deep-analysis skill)
   JIRA_URL=https://your-company.atlassian.net
   JIRA_USERNAME=your.email@company.com
   JIRA_API_TOKEN=your_jira_api_token_here
   ```

3. **Install dependencies**
   ```bash
   cd .opencode && bun install && cd ..
   ```

4. **Open the project in OhMyOpenCode**
   ```bash
   opencode
   ```

### Usage

In the OhMyOpenCode chat, run:

```
# From a JIRA ticket
/fw-dev GC20T5T7-1234

# From a GitHub Issue
/fw-dev https://github.com/Wiwynn/gc2-bmc-collection-script/issues/9
```

The pipeline will automatically:
1. Analyze the issue and identify the target platform
2. Search the codebase for relevant files and patterns
3. Generate a code diff implementing the fix/feature
4. Create a properly formatted commit message
5. Open a PR with AI Agent markings
6. Review the PR and iterate until all quality checks pass

---

## Safety Guardrails

The `/fw-dev` command enforces strict repository policies:

| Action | Allowed Repos |
|--------|---------------|
| Create PR + Issue | `Wiwynn/gc2-bmc-collection-script` only |
| Create branches (no PR/Issue) | `facebookexternal/openbmc.wiwynn`, `Wiwynn/OpenBIC` |
| **Forbidden** (auto-blocked) | `facebook/openbmc`, `facebook/OpenBIC` |

If the pipeline detects a forbidden target repo, it stops immediately and reports a policy violation.

---

## Coding Conventions (Firmware Targets)

The agents and skills enforce platform-specific conventions:

| | oBMC (OpenBMC) | OpenBIC (Zephyr) |
|---|---|---|
| Language | C | C |
| API prefix | `pal_*` | `plat_*` |
| Indent | 4-space | Tab |
| Error logging | `syslog(LOG_ERR, "%s() ...", __func__, ...)` | `LOG_ERR()` / `LOG_WRN()` / `LOG_INF()` |
| Return on failure | `return -1` | `return -1` |
| Buffer writes | `snprintf(buf, sizeof(buf), ...)` (never `sprintf`) | Same |
| Commit format | `<platform>: <description>` + `[Task Description]`/`[Motivation]`/`[Design]`/`[Test Log]` | Same |

---

## License

Internal use — Wiwynn Corporation.
