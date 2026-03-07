# Learnings — wiwynn-fw-agent

## [2026-03-07] Session: ses_33760d856ffeqjObsZkKlvkrOB — Initialization

### Worktree
- Main repo at: `D:\Antigravity_project\wiwynn_fw_agent\wiwynn-fw-agent`
- Branch: `main` (HEAD: ab37acf)
- Currently has: only `README.md`

### Architecture (confirmed)
- Model routing: command.model > agent.model > session.model
- Skill frontmatter does NOT support `model:` field
- `subtask: false` = run in current session (preserve context)
- Skills loaded on-demand via `skill({name: "..."})` — don't load multiple at once
- Custom agents at `.opencode/agents/fw-coder.md` — supports `model:` frontmatter

### Source Files (READ-ONLY — DO NOT MODIFY)
- EF1900 source: `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\`
  - `jira-deep-analysis\SKILL.md` — 683 lines, v2.2.0
  - `jira-deep-analysis\scripts\` — 4 Python scripts + .env.example
  - `fw-commit-generator\SKILL.md` — 257 lines
  - `commit-message-reviewer\SKILL.md` — 432 lines
  - EF1900 config.json — 7 lines

### Target Paths (wiwynn-fw-agent)
- `.opencode/config.json`
- `.opencode/.gitignore`
- `.opencode/skills/jira-deep-analysis/` (full copy)
- `.opencode/skills/fw-code-researcher/SKILL.md` (NEW)
- `.opencode/skills/fw-code-writer/SKILL.md` (NEW)
- `.opencode/skills/fw-pr-reviewer/SKILL.md` (NEW)
- `.opencode/skills/fw-commit-generator/SKILL.md` (copy)
- `.opencode/skills/commit-message-reviewer/SKILL.md` (copy)
- `.opencode/commands/fw-dev.md` (NEW)
- `.opencode/agents/fw-coder.md` (NEW)
- `.env.example` (repo root)

### Python Script Behavior
- All 4 scripts use `os.path.dirname(os.path.abspath(__file__))` to locate .env
- No path changes needed after copying to new repo
- fetch_jira.py: JIRA REST API v3, ADF parsing, outputs JSON
- search_github.py: GitHub Code Search with exponential backoff, --repos/--org/--ext
- grep_github_file.py: file-level grep, returns line numbers + context
- fetch_github_file.py: file snippet fetcher, base64 decode, line ± context

## [2026-03-07] Task 1 Complete: .opencode/ Scaffold

### What Was Created
- `.opencode/config.json` - JSON configuration with bash permissions deny rule for `rm -rf *`
- `.opencode/.gitignore` - Excludes node_modules/ from git tracking
- `.opencode/skills/`, `.opencode/commands/`, `.opencode/agents/` - Empty placeholder directories with .gitkeep
- `.env.example` - Template with GITHUB_TOKEN, JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN placeholders
- Updated `README.md` - 20-line project description with OhMyOpenCode and skills overview
- Updated root `.gitignore` - Added `.opencode/node_modules/` entry

### Key Patterns
- All directories created with .gitkeep to ensure git tracks empty folders
- config.json format matches reference file from EF1900_Dep_Automation exactly
- .env.example uses placeholder values, not actual credentials
- README follows OhMyOpenCode project conventions with Overview, Skills, and Getting Started sections

### Verification Passed
- All 6 expected files/directories exist
- config.json has valid JSON structure with permissions.bash deny rule
- .env.example contains all 4 required variables with placeholders
- .gitignore entries confirmed for .env and .opencode/node_modules/
- README.md contains "skill", "OpenCode", and "OMO" references
- Evidence files saved to .sisyphus/evidence/task-1-*.txt


## Task 4: commit-message-reviewer SKILL Copy ✓

**Status**: COMPLETE

**Actions**:
- Created target directory: `wiwynn-fw-agent/.opencode/skills/commit-message-reviewer/`
- Copied SKILL.md from EF1900_Dep_Automation source
- Verified file exists with correct frontmatter (`name: commit-message-reviewer`)
- Confirmed file is exactly 432 lines
- Validated byte-for-byte identity with source (diff shows no differences)

**Evidence**: `.sisyphus/evidence/task-4-commit-reviewer.txt`

**Result**: `wiwynn-fw-agent/.opencode/skills/commit-message-reviewer/SKILL.md` is ready for use.

## Task 2: jira-deep-analysis Skill Copy ✓

**Status**: COMPLETE

**Actions**:
- Copied entire `jira-deep-analysis/` directory from `EF1900_Dep_Automation/.opencode/skills/`
- Directory structure: SKILL.md + scripts/ subdirectory with 4 Python scripts
- Created `.gitignore` in scripts/ containing `.env` to prevent secrets commit
- Removed `.env` file if present (secrets protection)
- All Python scripts remain executable (rwxr-xr-x permissions preserved)

**Files Verified**:
- `SKILL.md`: 683 lines, name: jira-deep-analysis
- `scripts/fetch_jira.py`: 4854 bytes, executable
- `scripts/search_github.py`: 11003 bytes, executable  
- `scripts/grep_github_file.py`: 5695 bytes, executable
- `scripts/fetch_github_file.py`: 6029 bytes, executable
- `scripts/.env.example`: 878 bytes, present
- `scripts/.env`: NOT present (verified safe)
- `scripts/.gitignore`: 5 bytes, contains `.env`

**Python Scripts Tested**:
- fetch_jira.py: Outputs usage help correctly
- search_github.py: --help returns argument parser info
- grep_github_file.py: --help returns argument parser info
- fetch_github_file.py: --help returns argument parser info

**Evidence**: `.sisyphus/evidence/task-2-file-integrity.txt`, `.sisyphus/evidence/task-2-scripts-executable.txt`

**Result**: `wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/` ready for use; no secrets leaked.

## Task 3: fw-commit-generator SKILL Copy ✓

**Status**: COMPLETE

**Actions**:
- Created target directory: `wiwynn-fw-agent/.opencode/skills/fw-commit-generator/`
- Copied SKILL.md from EF1900_Dep_Automation source
- Verified file exists with correct frontmatter (`name: fw-commit-generator`)
- Confirmed file is exactly 257 lines
- Validated byte-for-byte identity with source (diff shows no differences)

**Evidence**: `.sisyphus/evidence/task-3-commit-generator.txt`

**Result**: `wiwynn-fw-agent/.opencode/skills/fw-commit-generator/SKILL.md` is ready for use.

## Task 5: fw-code-researcher SKILL.md (NEW) ✓

**Status**: COMPLETE

**Actions**:
- Created new Skill: `wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md`
- 495 lines, v1.0.0, written in 繁體中文 (matching jira-deep-analysis style)
- Frontmatter: name, description, license (MIT), version — NO model: field

**Key Design Decisions**:
- Middle-layer Skill: receives jira-deep-analysis output → produces modification plan → consumed by fw-code-writer
- Three-step search workflow: search_github.py → grep_github_file.py → fetch_github_file.py
- Shares Python scripts with jira-deep-analysis (located in `skills/jira-deep-analysis/scripts/`)
- Domain knowledge covers both oBMC sublayer (meta-facebook) and OpenBIC (common/ directory)
- Output format is structured diff-like modification plan with file list, diffs, rationale, risks

**Sections**:
- 概述, 輸入格式, 流程 (Steps 1-4), 工具使用指南, Domain Knowledge, 輸出格式, 最佳實踐, 版本歷史

**QA Verification** (all PASS):
- `name: fw-code-researcher` frontmatter ✓
- No `model:` field ✓
- search_github.py: 11 references ✓
- grep_github_file.py: 8 references ✓
- fetch_github_file.py: 8 references ✓
- meta-facebook: 9 references ✓
- common/: 18 references ✓

**Evidence**: `.sisyphus/evidence/task-5-code-researcher-format.txt`

**Result**: `wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md` is ready for use.

## Task 6: fw-code-writer SKILL.md (NEW) ✓

**Status**: COMPLETE

**Actions**:
- Created new Skill: `wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md`
- 405 lines, v1.0.0, written in 繁體中文
- Frontmatter: name, description, license (MIT), version — NO model: field

**Key Design Decisions**:
- Code-writing layer Skill: receives fw-code-researcher modification plan → writes C/C++ code → outputs unified diff
- Uses `fetch_github_file.py` (4 references) to read original source before writing diffs
- Does NOT reference `search_github.py` (code search is fw-code-researcher's responsibility)
- Covers both OpenBMC (pal_ naming, 4-space indent, syslog) and OpenBIC (plat_ naming, LOG_ERR/WRN/INF, Zephyr patterns)
- Includes 3 modification templates: new sensor, GPIO map change, new PAL function
- Unified diff output with `// [修改理由]:` comments per hunk
- Step 4 triggers fw-commit-generator for commit message (no git push)

**Sections**:
- 概述, 輸入, 程式碼撰寫規範 (OpenBMC C / OpenBIC Zephyr / 常見修改類型模板), 自動執行步驟, 輸出格式（Unified Diff）, 品質檢查, 版本歷史

**QA Verification** (all PASS):
- `name: fw-code-writer` frontmatter ✓
- No `model:` field ✓
- fetch_github_file.py: 4 references ✓
- diff: 22 references ✓
- PAL/pal_: 15 references ✓
- coding style/convention: 7 references ✓
- search_github.py: 0 references ✓ (not this skill's responsibility)
- All 10 required sections present ✓

**Evidence**: `.sisyphus/evidence/task-6-code-writer-format.txt`

**Result**: `wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md` is ready for use.

## Task 7: fw-pr-reviewer SKILL.md (NEW) ✓

**Status**: COMPLETE

**Actions**:
- Created new Skill: `wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md`
- 533 lines, v1.0.0, written in 繁體中文
- Frontmatter: name, description, license (MIT), version — NO model: field

**Key Design Decisions**:
- Quality gate Skill: receives PR diff + commit messages → performs 7-dimension review → outputs APPROVE or REQUEST_CHANGES
- Seven review dimensions: Coding Style, Error Handling, Memory Safety, Commit Message Quality, Platform Isolation, Logic Correctness, Test Coverage
- REQUEST_CHANGES output is structured (Issue N with file path, problem description, diff suggestion) for fw-code-writer auto-parsing
- Integrates with /fw-dev command via Review Loop: REQUEST_CHANGES → fw-code-writer fixes → re-review until APPROVE
- References commit-message-reviewer Skill for Dimension 4 (platform detection: GitHub=Meta oBMC, Gerrit=LF oBMC)
- Platform Isolation covers both oBMC sublayer (meta-facebook/meta-{platform}/) and OpenBIC (src/platform/{platform}/)
- APPROVE output includes mandatory Minor Suggestions section (no hidden issues)

**Sections**:
- 概述, 輸入, 七大審查維度 (7 subsections), 審查流程, 判定標準, 輸出格式 (APPROVE/REQUEST_CHANGES templates), Review Loop 整合說明, 版本歷史

**QA Verification** (all 12 checks PASS):
- `name: fw-pr-reviewer` frontmatter ✓
- No `model:` field ✓
- APPROVE: 16 references ✓ (>= 2)
- REQUEST_CHANGES: 13 references ✓ (>= 2)
- Error Handling: 10 references ✓
- Memory Safety: 6 references ✓
- Platform Isolation/sublayer: 10 references ✓
- All 10 required sections present ✓
- description, license: MIT, version: 1.0.0 in frontmatter ✓

**Evidence**: `.sisyphus/evidence/task-7-pr-reviewer-format.txt`

**Result**: `wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md` is ready for use.

## [2026-03-07] Task 8: fw-coder Agent ✓

**Status**: COMPLETE

**Actions**:
- Created custom OmO agent: `wiwynn-fw-agent/.opencode/agents/fw-coder.md`
- 50 lines total (under 100-line limit)
- Frontmatter: name: fw-coder, description, model: gpt-5.3-codex

**Key Design Decisions**:
- Custom agent (not Skill) — supports `model:` field for model binding
- Model binding: gpt-5.3-codex (Codex family for firmware coding, bypasses IT Copilot restrictions)
- Embedded system prompt defines firmware code writer role targeting OpenBMC (C, pal_, 4-space, syslog) and OpenBIC (Zephyr, plat_, LOG_ERR/WRN/INF)
- Instructions to load `fw-code-writer` Skill on-demand via `skill({name: "fw-code-writer"})`
- Emphasizes unified diff output, style preservation, no functional regressions
- Used by `/fw-dev` command when code writing is needed

**Verification** (all 4 checks PASS):
- `name: fw-coder` frontmatter ✓
- `description:` field present ✓
- `model: gpt-5.3-codex` field present ✓
- gpt-5.3-codex reference confirmed ✓
- Line count: 50 lines (< 100) ✓

**Evidence**: `.sisyphus/evidence/task-8-fw-coder-agent.txt`

**Result**: `wiwynn-fw-agent/.opencode/agents/fw-coder.md` is ready for use. Agent binds Codex model for firmware development tasks.

## [2026-03-07] Task 10: jira-deep-analysis GitHub Issue Support ✓

Added GitHub Issue URL support to the wiwynn copy of jira-deep-analysis (v2.3.0-wiwynn):
- Phase 0 新增 "Route G: GitHub Issue Mode" 段落，detection pattern: `https://github.com/{owner}/{repo}/issues/{number}`
- Fetch command: `gh issue view {URL} --json title,body,labels,assignees,comments`
- After fetching GitHub Issue data, continues with existing Route A analysis flow
- Supports /fw-dev slash command accepting both JIRA keys and GitHub Issue URLs
- Version bumped from 2.2.0 → 2.3.0-wiwynn in frontmatter
- Version history entry added
- EF1900 original UNCHANGED (still 683 lines)
