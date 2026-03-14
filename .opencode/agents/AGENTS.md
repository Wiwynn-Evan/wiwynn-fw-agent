# agents/ — Firmware Pipeline Agents

## OVERVIEW

4 specialized agents. Each has YAML frontmatter (`name`, `description`, `model`). Loaded by `/fw-dev` via `task()` calls — not invoked directly by users (except `fw-reviewer-sonnet` which can be called standalone for review loops).

## AGENT TABLE

| Agent | Model | Reasoning | Skill Loaded | Pipeline Step |
|-------|-------|-----------|-------------|---------------|
| `fw-issue-analyst` | `gpt-5.3-codex` | high + vision | `jira-deep-analysis` | Step 1: Issue analysis |
| `fw-code-analyst` | `claude-opus-4.6` | default | `fw-code-researcher` | Step 2: Code research |
| `fw-coder` | `gpt-5.3-codex` | high (Step 3), medium (Step 4) | `fw-code-writer` + `fw-commit-generator` | Steps 3+4+7: Write diff + commit |
| `fw-reviewer-sonnet` | `claude-sonnet-4.6` | default | `fw-pr-reviewer` | Step 6: PR review |

## AGENT DETAILS

### `fw-issue-analyst`
- **Input**: JIRA key (e.g. `GC20T5T7-121`) or GitHub Issue URL
- **Output**: Structured analysis report — platform, root cause, scope, image extraction results
- **Key behavior**: MUST complete image extraction (structured_events, confidence, unknowns) before pipeline continues
- **Vision**: Processes JIRA attachments / GitHub issue images

### `fw-code-analyst`
- **Input**: Analysis report from fw-issue-analyst
- **Output**: Modification plan — target files, functions, line numbers, what to change and why
- **Key behavior**: 3-step search (search_github → grep → fetch); never fetches large files blindly

### `fw-coder`
- **Input (Step 3)**: Modification plan → **Output**: Unified diff (git-apply ready)
- **Input (Step 4)**: Staged diff → **Output**: EF1900-compliant commit message with `[AI Agent]` section
- **Input (Step 7)**: Review feedback → **Output**: Fixed unified diff
- **Reasoning switch**: `high` for code writing (Step 3/7), `medium` for commit message (Step 4)

### `fw-reviewer-sonnet`
- **Input**: PR diff + commit message + original issue context
- **Output**: `APPROVE` or `REQUEST_CHANGES` with 7-dimension analysis
- **7 dimensions**: Coding Style, Error Handling, Memory Safety, Commit Message, Platform Isolation, Logic Correctness, Test Coverage
- **Speed**: Sonnet chosen for fast iterative loop turnaround

## ANTI-PATTERNS

- **DO NOT** invoke `fw-coder` with `subtask: true` — fw-coder.md explicitly sets `subtask: false`
- **DO NOT** skip `fw-issue-analyst` image extraction — pipeline may proceed on incomplete context
- **DO NOT** reuse a previous agent session for a new JIRA issue — always spawn fresh task()
