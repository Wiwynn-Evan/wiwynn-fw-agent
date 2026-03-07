# skills/ — Firmware Development Skill Library

## OVERVIEW

Six OMO skills forming a complete firmware dev pipeline. Each is a standalone Markdown instruction document in its own subdirectory. No code except `jira-deep-analysis/scripts/`.

## SKILL MAP

| Skill | Version | Role in Pipeline | Input | Output |
|-------|---------|-----------------|-------|--------|
| `jira-deep-analysis` | 2.3.0-wiwynn | Step 1: Issue analysis | JIRA key / GitHub Issue URL | Structured analysis report |
| `fw-code-researcher` | 1.0.0 | Step 2: Code location | Analysis report | Modification plan (file list + diff-like) |
| `fw-code-writer` | 1.0.0 | Step 3: Code generation | Modification plan | Unified diff (git-apply ready) |
| `fw-commit-generator` | — | Step 4: Commit msg | `git diff --cached` | EF1900-compliant commit message |
| `fw-pr-reviewer` | 1.0.0 | Step 5: Review loop | PR diff + commit msg | APPROVE or REQUEST_CHANGES |
| `commit-message-reviewer` | — | Standalone | Commit message | Compliance report |

## WHERE TO LOOK

| Need | Go to |
|------|-------|
| JIRA platform routing rules | `jira-deep-analysis/SKILL.md` Phase 0 |
| Route A (oBMC Linux) analysis | `jira-deep-analysis/SKILL.md` Phase A-* |
| Route B (OpenBIC/Zephyr) debugging | `jira-deep-analysis/SKILL.md` Route B handlers |
| Route G (GitHub Issues) | `jira-deep-analysis/SKILL.md` Phase 0 → Route G |
| GitHub code search scripts | `jira-deep-analysis/scripts/` |
| 3-step search workflow | `fw-code-researcher/SKILL.md` Steps A-B-C |
| C coding templates | `fw-code-writer/SKILL.md` Templates A/B/C |
| 7-dimension PR review rules | `fw-pr-reviewer/SKILL.md` |
| EF1900 commit format | `fw-commit-generator/SKILL.md` or `commit-message-reviewer/SKILL.md` |

## ANTI-PATTERNS

- Each skill has a strict responsibility boundary — don't load multiple overlapping skills for the same step
- `fw-code-researcher` does NOT write code; `fw-code-writer` does NOT search code — pipeline is linear
- `commit-message-reviewer` is for reviewing commits in **this automation repo**; use `fw-commit-generator` for firmware target repos
