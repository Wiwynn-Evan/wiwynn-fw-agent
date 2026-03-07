# wiwynn-fw-agent: 韌體開發自動化 Agent Workflow

## TL;DR

> **Quick Summary**: 在 `wiwynn-fw-agent` repo 建立一套 OmO (Oh My OpenCode) Skills + Command，自動化韌體開發全流程：GitHub/JIRA Issue 分析 → openbmc/OpenBIC 程式碼研究 → 程式碼撰寫 → PR 提交 → 自動審查迴圈 → 迭代直到 Approve。
> 
> **Deliverables**:
> - `.opencode/` 完整目錄結構 (config, skills, commands, agents)
> - `jira-deep-analysis` Skill（從 EF1900_Dep_Automation 複製 + 適配）
> - `fw-code-researcher` Skill（新建：程式碼搜尋 + 修改方案設計）
> - `fw-code-writer` Skill（新建：根據分析結果撰寫程式碼）
> - `fw-pr-reviewer` Skill（新建：韌體 PR 審查 + APPROVE/REQUEST_CHANGES）
> - `fw-commit-generator` Skill（從 EF1900 複製）
> - `commit-message-reviewer` Skill（從 EF1900 複製）
> - `/fw-dev` Command（串接完整流程的 slash command）
> - `fw-coder` Custom Agent（綁定 code-writing 專用 model）
> - 測試用 GitHub Issue 建立 + 端對端驗證
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 2 → Task 5 → Task 8 → Task 10 → Task 11 → Final Verification

---

## Context

### Original Request
用戶（Evan，Wiwynn 資深韌體工程師）希望建立一個 AI agent workflow，在 OmO 環境內自動化韌體開發的 7 個步驟：
1. JIRA/GitHub Issue 解析
2. openbmc/OpenBIC 程式碼分析
3. 程式碼撰寫
4. 提交 PR
5. 自動審查
6. 迭代修改
7. 直到 APPROVE

### Interview Summary
**Key Discussions**:
- **IT 限制**: Wiwynn IT 限制的是 AI model 選擇（非 GitHub API），PAT 可正常呼叫 GitHub API，但 Copilot 可用的 model 受限。OmO 的價值在於自由選擇 model。
- **Python scripts**: 保留 4 個 Python scripts 作為資料抓取工具（fetch_jira.py, search_github.py, grep_github_file.py, fetch_github_file.py），分析交給 OmO agents。
- **Review Loop 架構**: 分散式 Skills + Slash Command 並存。先建獨立 Skills，再用 `/fw-dev` 串接。
- **jira-deep-analysis 搬遷**: 從 EF1900_Dep_Automation 複製，之後各自獨立維護。
- **測試策略**: 使用 `Wiwynn/gc2-bmc-collection-script` 私有 repo，搭配 GitHub Issues（非 JIRA）做端對端測試。
- **Model 路由**: Claude Opus 4.6 用於分析/審查，GPT-5.3-codex 用於寫 code。OmO 的 command frontmatter `model:` 欄位可強制指定 model。

**Research Findings**:
- **OmO Command 格式**: YAML frontmatter (`description`, `agent`, `model`, `subtask`) + 自由格式 markdown body。`model:` 優先序：command.model > command.agent.model > session.model
- **OmO Custom Agent**: `.opencode/agents/fw-coder.md` 可用 frontmatter 的 `model:` 綁定特定 model
- **Skill 載入機制**: `skill({name: "xxx"})` 會將整個 SKILL.md body 注入 context → 不應一次載入所有 Skill（context budget）
- **subtask: false** 在當前 session 執行（保留對話上下文），**subtask: true** 建立 child session

### Metis Review
**Identified Gaps** (addressed):
- **Model routing 機制未完全釐清** → 已確認：用 command frontmatter `model:` + custom agent `model:` 欄位實現
- **Skill 不支援 model 欄位** → 已確認：model 綁定只能在 command 或 agent 層級，不能在 skill 層級
- **Context budget 風險** → 已確認：Skills 按需載入（一次一個），不要同時載入所有 Skill
- **/fw-dev command 的 $ARGUMENTS 支援** → 已確認：command body 可用 `$ARGUMENTS`, `$1`, `$2` 做參數模板
- **GitHub Issue vs JIRA 雙來源** → 已確認：jira-deep-analysis 需要適配，支援 GitHub Issues URL 作為輸入（不只 JIRA key）

---

## Work Objectives

### Core Objective
在 `wiwynn-fw-agent` repo 建立完整的 OmO Skills + Command + Agent 架構，實現從 Issue 到 PR Approval 的全自動化韌體開發流程。

### Concrete Deliverables
- `.opencode/config.json` — 權限與基本設定
- `.opencode/skills/jira-deep-analysis/` — 完整目錄（SKILL.md + scripts/ + .env.example）
- `.opencode/skills/fw-code-researcher/SKILL.md` — 程式碼研究 Skill
- `.opencode/skills/fw-code-writer/SKILL.md` — 程式碼撰寫 Skill
- `.opencode/skills/fw-pr-reviewer/SKILL.md` — PR 審查 Skill
- `.opencode/skills/fw-commit-generator/SKILL.md` — Commit message 生成（複製自 EF1900）
- `.opencode/skills/commit-message-reviewer/SKILL.md` — Commit message 審查（複製自 EF1900）
- `.opencode/commands/fw-dev.md` — 全流程 slash command
- `.opencode/agents/fw-coder.md` — code-writing 專用 agent（綁定 GPT-5.3-codex）
- `.env.example` — 環境變數範本（repo 根目錄）
- 測試用 GitHub Issue（在 gc2-bmc-collection-script repo）
- 端對端測試證據

### Definition of Done
- [ ] 所有 Skill 檔案存在且 frontmatter 格式正確（`name`, `description`, `license`）
- [ ] Python scripts 可正常執行（`python fetch_jira.py GC20T5T7-121` 回傳 JSON）
- [ ] `/fw-dev` command 可被 OmO 識別（出現在 autocomplete）
- [ ] `fw-coder` agent 綁定正確 model
- [ ] 端對端測試：從 GitHub Issue → 分析 → 產出修改建議（至少走完 Step 1-2）

### Must Have
- jira-deep-analysis 完整複製（683 行 SKILL.md + 4 個 Python scripts + .env.example）
- 所有新 Skill 的 SKILL.md 遵循現有 EF1900 Skills 的格式慣例（frontmatter + 概述 + 流程 + 範例 + 版本歷史）
- `/fw-dev` command 支援 `$ARGUMENTS` 傳入 JIRA key 或 GitHub Issue URL
- fw-pr-reviewer 能輸出明確的 APPROVE / REQUEST_CHANGES 判定
- Python scripts 的 `.env` 使用獨立的 `.env`（在 scripts/ 目錄下，非 repo root 的 `.env`）

### Must NOT Have (Guardrails)
- ❌ 不修改 OmO 核心程式碼
- ❌ 不建立自己的 LLM routing 系統（使用 OmO 原生的 command `model:` + agent `model:`）
- ❌ 不在 Skill frontmatter 加 `model:` 欄位（Skill 不支援此欄位）
- ❌ 不同時載入多個大型 Skill（context budget 限制）
- ❌ 不在 `.opencode/` 裡放 `node_modules/`（加入 .gitignore）
- ❌ 不提交 `.env` 到 Git（只提交 `.env.example`）
- ❌ 不直接修改 EF1900_Dep_Automation 的任何檔案（複製後獨立維護）
- ❌ 不使用過度抽象的架構（每個 Skill 保持獨立、self-contained）
- ❌ 不在 commit message/PR 中包含機敏資訊（API tokens, 內部 IP）

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO（新 repo，無測試框架）
- **Automated tests**: None（Skill 是 Markdown prompt，無法 unit test；用 QA Scenario 驗證）
- **Framework**: N/A
- **Verification approach**: Agent-Executed QA Scenarios（直接執行 Skill、跑 Python scripts、用 gh CLI 操作）

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Python Scripts**: Use Bash — `python script.py <args>` → assert JSON output fields
- **Skill Format**: Use Bash — 驗證 frontmatter 格式（`grep` SKILL.md for required fields）
- **Command/Agent**: Use Bash — 驗證檔案存在且 frontmatter 正確
- **End-to-End**: Use Bash — `gh issue create`, then manually invoke skill flow, capture output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 基礎設施 + 複製現有 Skills):
├── Task 1: .opencode/ 目錄結構 + config.json + .env.example [quick]
├── Task 2: 複製 jira-deep-analysis（完整目錄）[quick]
├── Task 3: 複製 fw-commit-generator [quick]
├── Task 4: 複製 commit-message-reviewer [quick]

Wave 2 (After Wave 1 — 新 Skills 開發，MAX PARALLEL):
├── Task 5: 建立 fw-code-researcher Skill (depends: 1, 2) [deep]
├── Task 6: 建立 fw-code-writer Skill (depends: 1) [deep]
├── Task 7: 建立 fw-pr-reviewer Skill (depends: 1) [deep]

Wave 3 (After Wave 2 — Orchestration + Agent):
├── Task 8: 建立 fw-coder custom agent (depends: 6) [quick]
├── Task 9: 建立 /fw-dev slash command (depends: 5, 6, 7, 8) [deep]
├── Task 10: 適配 jira-deep-analysis 支援 GitHub Issues (depends: 2) [unspecified-high]

Wave 4 (After Wave 3 — 測試 + 驗證):
├── Task 11: 建立測試用 GitHub Issue + 端對端測試 (depends: 9, 10) [deep]
├── Task 12: Git commit + push (depends: 11) [quick]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
├── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 2 → Task 5 → Task 9 → Task 11 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2, 3, 4, 5, 6, 7 | 1 |
| 2 | 1 | 5, 10 | 1 |
| 3 | 1 | — | 1 |
| 4 | 1 | — | 1 |
| 5 | 1, 2 | 9 | 2 |
| 6 | 1 | 8, 9 | 2 |
| 7 | 1 | 9 | 2 |
| 8 | 6 | 9 | 3 |
| 9 | 5, 6, 7, 8 | 11 | 3 |
| 10 | 2 | 11 | 3 |
| 11 | 9, 10 | 12 | 4 |
| 12 | 11 | F1-F4 | 4 |
| F1-F4 | 12 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: **4 tasks** — T1 → `quick`, T2 → `quick`, T3 → `quick`, T4 → `quick`
- **Wave 2**: **3 tasks** — T5 → `deep`, T6 → `deep`, T7 → `deep`
- **Wave 3**: **3 tasks** — T8 → `quick`, T9 → `deep`, T10 → `unspecified-high`
- **Wave 4**: **2 tasks** — T11 → `deep`, T12 → `quick`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. 建立 .opencode/ 目錄結構 + config.json + .env.example

  **What to do**:
  - 在 `wiwynn-fw-agent/` repo 根目錄建立 `.opencode/` 目錄結構：
    ```
    wiwynn-fw-agent/
    ├── .opencode/
    │   ├── config.json
    │   ├── skills/          (空目錄，後續 task 填入)
    │   ├── commands/        (空目錄，後續 task 填入)
    │   ├── agents/          (空目錄，後續 task 填入)
    │   └── .gitignore       (忽略 node_modules/)
    ├── .env.example         (repo 根目錄的環境變數範本)
    ├── .gitignore           (已存在，需確認包含 .env 和 .opencode/node_modules/)
    └── README.md            (更新：加入專案說明)
    ```
  - `config.json` 內容參考 EF1900_Dep_Automation 的格式：
    ```json
    {
      "permissions": {
        "bash": {
          "rm -rf *": "deny"
        }
      }
    }
    ```
  - `.env.example`（repo 根目錄）列出所有需要的環境變數：
    ```
    # GitHub API Token (for Python scripts + OmO private repo access)
    GITHUB_TOKEN=your_github_token_here
    # JIRA API (for jira-deep-analysis skill)
    JIRA_URL=https://your-company.atlassian.net
    JIRA_USERNAME=your.email@company.com
    JIRA_API_TOKEN=YOUR_JIRA_API_TOKEN_HERE
    ```
  - `.opencode/.gitignore` 加入 `node_modules/`
  - 更新 `.gitignore`（repo root）確認包含 `.env` 和 `.opencode/node_modules/`
  - 更新 `README.md` 加入專案概述（1-2 段，說明這是什麼 + 如何開始使用）

  **Must NOT do**:
  - 不要建立 `package.json` 或 `bun.lock`（除非後續確認需要 @opencode-ai/sdk）
  - 不要安裝任何 npm 套件
  - 不要提交 `.env` 到 git

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 純粹的目錄建立和設定檔建立，不需要複雜邏輯
  - **Skills**: []
    - No skills needed — simple file creation
  - **Skills Evaluated but Omitted**:
    - `git-master`: 不在此 task commit，commit 在 Task 12

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4) — 但 Tasks 2-4 depend on this task
  - **Blocks**: Tasks 2, 3, 4, 5, 6, 7
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\config.json` — 完整的 config.json 格式參考（7 行，只有 permissions.bash deny 規則）
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\.gitignore` — .opencode 目錄的 .gitignore 參考

  **External References**:
  - OmO Configuration Reference: `https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/refs/heads/dev/docs/reference/configuration.md`

  **WHY Each Reference Matters**:
  - `config.json`: 必須遵循 OmO 的 config schema，EF1900 的已驗證可用
  - `.gitignore`: 確保 node_modules 不被提交

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 目錄結構完整性驗證
    Tool: Bash
    Preconditions: wiwynn-fw-agent repo 已 clone
    Steps:
      1. ls -la wiwynn-fw-agent/.opencode/ → 確認 config.json, skills/, commands/, agents/, .gitignore 存在
      2. cat wiwynn-fw-agent/.opencode/config.json → 確認 JSON 格式正確且包含 permissions.bash
      3. cat wiwynn-fw-agent/.env.example → 確認包含 GITHUB_TOKEN, JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN
      4. grep ".env" wiwynn-fw-agent/.gitignore → 確認 .env 在 gitignore 中
      5. grep "node_modules" wiwynn-fw-agent/.opencode/.gitignore → 確認 node_modules 在 .opencode gitignore 中
    Expected Result: 所有目錄和檔案存在，JSON 格式正確，.env.example 包含 4 個環境變數
    Failure Indicators: 任何目錄缺失、JSON parse error、.env.example 缺少變數
    Evidence: .sisyphus/evidence/task-1-directory-structure.txt

  Scenario: README 更新驗證
    Tool: Bash
    Preconditions: README.md 已更新
    Steps:
      1. cat wiwynn-fw-agent/README.md → 確認不再只有 "# wiwynn-fw-agent"
      2. grep -i "skill" wiwynn-fw-agent/README.md → 確認提到 Skills
      3. grep -i "opencode\|omo" wiwynn-fw-agent/README.md → 確認提到 OmO/OpenCode
    Expected Result: README 包含專案說明、提到 Skills 和 OmO
    Failure Indicators: README 仍然只有一行標題
    Evidence: .sisyphus/evidence/task-1-readme-check.txt
  ```

  **Commit**: YES (groups with Tasks 2, 3, 4 — Wave 1 commit)
  - Message: `feat(opencode): scaffold .opencode directory and migrate existing skills`
  - Files: `.opencode/config.json`, `.opencode/.gitignore`, `.env.example`, `.gitignore`, `README.md`

- [x] 2. 複製 jira-deep-analysis Skill（完整目錄）

  **What to do**:
  - 從 `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\` 複製整個目錄到 `wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/`
  - 複製內容包含：
    - `SKILL.md` (683 行, v2.3.0)
    - `scripts/fetch_jira.py` (158 行)
    - `scripts/search_github.py` (286 行)
    - `scripts/grep_github_file.py` (158 行)
    - `scripts/fetch_github_file.py` (176 行)
    - `scripts/.env.example` (19 行)
  - **不要複製** `scripts/.env`（包含實際 token，不能進 git）
  - 複製後在 `scripts/.gitignore` 加入 `.env`（確保 scripts 目錄下的 .env 不被提交）
  - 驗證 Python scripts 的 import 路徑無須修改（scripts 用 `os.path.dirname(os.path.abspath(__file__))` 定位 .env，路徑是相對的）

  **Must NOT do**:
  - 不要修改 EF1900_Dep_Automation 的原始檔案
  - 不要複製 `scripts/.env`（機敏資訊）
  - 不要在此 task 修改 SKILL.md 內容（GitHub Issue 適配在 Task 10）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 純粹的檔案複製操作，無需分析或創作
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: 複製操作不需要 git expertise

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1 (with Tasks 3, 4)
  - **Blocks**: Tasks 5, 10
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md` — 完整的 683 行 SKILL.md（v2.3.0），包含雙平台路由、Phase A-0~A-5 oBMC 分析流程、Route B gc2-es debugger、4 個 Python script 使用說明、品質檢查清單。這是要被完整複製的主檔案。
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\scripts\fetch_jira.py` — JIRA REST API v3 fetcher（158 行），從 .env 讀取 JIRA_URL/USERNAME/API_TOKEN，輸出 JSON（key, summary, description, labels, components, issue_type）。支援 ADF (Atlassian Document Format) 遞迴解析。
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\scripts\search_github.py` — GitHub Code Search（286 行），支援 --repos/--org/--ext/--per-page/--text-matches，內建 exponential backoff，從 .env 讀取 GITHUB_TOKEN。
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\scripts\grep_github_file.py` — GitHub 檔案內 grep（158 行），支援 Python regex，回傳行號+上下文，支援 --ref 指定 branch。
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\scripts\fetch_github_file.py` — GitHub 檔案片段讀取（176 行），指定行號 ± context 行數，支援 --ref，base64 解碼 + download_url fallback。
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\scripts\.env.example` — 環境變數範本（19 行），列出 GITHUB_TOKEN、JIRA_URL、JIRA_USERNAME、JIRA_API_TOKEN。

  **WHY Each Reference Matters**:
  - 這些是要被完整複製的源檔案。Executor 需要知道源路徑和目標路徑。
  - Python scripts 的 .env loading 使用相對路徑（`os.path.dirname(os.path.abspath(__file__))`），複製後不需修改路徑。

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 檔案完整性驗證
    Tool: Bash
    Preconditions: Task 1 已完成，.opencode/skills/ 目錄存在
    Steps:
      1. ls -la wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/ → 確認 SKILL.md 和 scripts/ 目錄存在
      2. ls -la wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/scripts/ → 確認 4 個 .py 檔案和 .env.example 存在
      3. wc -l wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md → 確認約 683 行
      4. test ! -f wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/scripts/.env → 確認 .env 未被複製（exit 0）
      5. grep "^name: jira-deep-analysis" wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md → 確認 frontmatter name 正確
    Expected Result: 所有檔案存在、行數正確、.env 未被複製、frontmatter 正確
    Failure Indicators: 缺少檔案、行數差異過大、.env 被複製
    Evidence: .sisyphus/evidence/task-2-file-integrity.txt

  Scenario: Python scripts 可執行性驗證
    Tool: Bash
    Preconditions: Python 3 + requests + python-dotenv 已安裝
    Steps:
      1. python wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/scripts/fetch_jira.py 2>&1 → 確認顯示用法說明（非 ImportError）
      2. python wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/scripts/search_github.py --help → 確認顯示 help 說明
      3. python wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/scripts/grep_github_file.py --help → 確認顯示 help 說明
      4. python wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/scripts/fetch_github_file.py --help → 確認顯示 help 說明
    Expected Result: 4 個 scripts 都能執行且顯示用法說明，無 ImportError
    Failure Indicators: ImportError、ModuleNotFoundError、SyntaxError
    Evidence: .sisyphus/evidence/task-2-scripts-executable.txt
  ```

  **Commit**: YES (groups with Tasks 1, 3, 4)
  - Message: `feat(opencode): scaffold .opencode directory and migrate existing skills`
  - Files: `.opencode/skills/jira-deep-analysis/*`

- [x] 3. 複製 fw-commit-generator Skill

  **What to do**:
  - 從 `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\fw-commit-generator\SKILL.md` 複製到 `wiwynn-fw-agent/.opencode/skills/fw-commit-generator/SKILL.md`
  - 驗證 frontmatter 格式正確（`name: fw-commit-generator`, `description: ...`, `license: MIT`）
  - 此 Skill 在 review loop 中用於生成符合 Meta oBMC / LF oBMC 規範的 commit message

  **Must NOT do**:
  - 不修改內容（直接複製）
  - 不修改 EF1900 原始檔案

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 單一檔案複製
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1 (with Tasks 2, 4)
  - **Blocks**: None (downstream tasks don't strictly depend on this)
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\fw-commit-generator\SKILL.md` — 完整的 257 行 SKILL.md，包含 Meta oBMC (GitHub) 和 LF oBMC (Gerrit) 雙平台 commit message 規範。自動讀取 `git diff --cached`，支援 Feature/Bug Fix body 模板，含 [Task Description]/[Motivation]/[Design]/[Test Log] 必要區段。

  **WHY Each Reference Matters**:
  - 這是要被完整複製的源檔案。fw-code-writer (Task 6) 寫完 code 後需要用這個 Skill 生成 commit message。

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Skill 檔案驗證
    Tool: Bash
    Preconditions: Task 1 已完成
    Steps:
      1. test -f wiwynn-fw-agent/.opencode/skills/fw-commit-generator/SKILL.md → 確認檔案存在
      2. grep "^name: fw-commit-generator" wiwynn-fw-agent/.opencode/skills/fw-commit-generator/SKILL.md → 確認 frontmatter name
      3. wc -l wiwynn-fw-agent/.opencode/skills/fw-commit-generator/SKILL.md → 確認約 257 行
    Expected Result: 檔案存在、frontmatter 正確、行數匹配
    Failure Indicators: 檔案缺失、frontmatter 錯誤
    Evidence: .sisyphus/evidence/task-3-commit-generator.txt

  Scenario: 確認未修改 EF1900 原始檔
    Tool: Bash
    Preconditions: 複製完成
    Steps:
      1. diff "D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\fw-commit-generator\SKILL.md" wiwynn-fw-agent/.opencode/skills/fw-commit-generator/SKILL.md → 確認檔案完全相同
    Expected Result: diff 無輸出（檔案完全相同）
    Failure Indicators: diff 有差異輸出
    Evidence: .sisyphus/evidence/task-3-diff-check.txt
  ```

  **Commit**: YES (groups with Tasks 1, 2, 4)
  - Message: `feat(opencode): scaffold .opencode directory and migrate existing skills`
  - Files: `.opencode/skills/fw-commit-generator/SKILL.md`

- [x] 4. 複製 commit-message-reviewer Skill

  **What to do**:
  - 從 `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\commit-message-reviewer\SKILL.md` 複製到 `wiwynn-fw-agent/.opencode/skills/commit-message-reviewer/SKILL.md`
  - 驗證 frontmatter 格式正確（`name: commit-message-reviewer`, `description: ...`, `license: MIT`）
  - 此 Skill 在 review loop 中用於審查 commit message 是否符合 EF1900 韌體部門規範

  **Must NOT do**:
  - 不修改內容（直接複製）
  - 不修改 EF1900 原始檔案

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 單一檔案複製
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\commit-message-reviewer\SKILL.md` — 完整的 432 行 SKILL.md，包含 Meta oBMC (GitHub) 和 LF oBMC (Gerrit) 雙平台審查規則。自動偵測平台（GitHub URL → Meta 規則，Gerrit URL → LF 規則），逐項檢查 Subject/Body 必要區段，提供合規性評分和改進建議，支援從 git diff 推測補全建議。

  **WHY Each Reference Matters**:
  - 這是要被完整複製的源檔案。fw-pr-reviewer (Task 7) 會參考此 Skill 的 commit message 審查邏輯。

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Skill 檔案驗證
    Tool: Bash
    Preconditions: Task 1 已完成
    Steps:
      1. test -f wiwynn-fw-agent/.opencode/skills/commit-message-reviewer/SKILL.md → 確認檔案存在
      2. grep "^name: commit-message-reviewer" wiwynn-fw-agent/.opencode/skills/commit-message-reviewer/SKILL.md → 確認 frontmatter name
      3. wc -l wiwynn-fw-agent/.opencode/skills/commit-message-reviewer/SKILL.md → 確認約 432 行
    Expected Result: 檔案存在、frontmatter 正確、行數匹配
    Failure Indicators: 檔案缺失、frontmatter 錯誤
    Evidence: .sisyphus/evidence/task-4-commit-reviewer.txt
  ```

  **Commit**: YES (groups with Tasks 1, 2, 3)
  - Message: `feat(opencode): scaffold .opencode directory and migrate existing skills`
  - Files: `.opencode/skills/commit-message-reviewer/SKILL.md`

- [x] 5. 建立 fw-code-researcher Skill

  **What to do**:
  - 建立 `wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md`
  - 此 Skill 的職責：接收 Issue 分析結果（來自 jira-deep-analysis 的輸出），在 openbmc/OpenBIC repos 中搜尋相關程式碼，產出**具體的修改方案**（哪些檔案要改、怎麼改、改什麼）
  - SKILL.md 結構（遵循 jira-deep-analysis 的格式慣例）：

  ```markdown
  ---
  name: fw-code-researcher
  description: '...'
  license: MIT
  version: 1.0.0
  ---

  # 韌體程式碼研究 Skill

  ## 概述
  ## 輸入
  ## 流程
  ## 輸出格式
  ## 最佳實踐
  ## 版本歷史
  ```

  - **核心流程**:
    1. **接收分析報告**: 從 jira-deep-analysis 產出的分析報告中提取：root cause、受影響的檔案路徑、相關函式名
    2. **定位目標程式碼**: 使用 Python scripts（search_github.py → grep_github_file.py → fetch_github_file.py）三步驟定位目標程式碼
    3. **搜尋參考 Pattern**: 在同平台或其他平台搜尋類似修改的先例（commit history、similar fixes）
    4. **產出修改方案**: 輸出結構化的修改建議，包含：
       - 需修改的檔案清單（完整路徑）
       - 每個檔案的具體修改內容（diff-like 格式）
       - 修改的理由和參考來源
       - 潛在風險和建議測試方式

  - **Skill 必須包含的 domain knowledge**:
    - OpenBMC 的 `meta-facebook/meta-{platform}/` sublayer 架構
    - OpenBIC 的 `src/platform/{platform}/` 結構 + `common/` 共用程式碼角色
    - PAL API 的常見 pattern（`pal_get_fru_health`, `pal_sensor_read` 等）
    - 參考 jira-deep-analysis SKILL.md 的 Phase A-1 平行搜尋策略和 Route B pre-knowledge

  - **Python scripts 使用指南**: 在 SKILL.md 中記錄如何呼叫 Python scripts（bash 指令格式），包含完整的三步驟工作流程：
    ```
    1. search_github.py "keyword" --repos facebook/openbmc → 找到檔案
    2. grep_github_file.py facebook/openbmc path/to/file.c "function_name" → 定位行號
    3. fetch_github_file.py facebook/openbmc path/to/file.c LINE --context 30 → 讀取完整函式
    ```

  **Must NOT do**:
  - 不要在 SKILL.md 中加 `model:` frontmatter（Skill 不支援）
  - 不要包含 jira-deep-analysis 已涵蓋的 JIRA 解析邏輯（職責分離）
  - 不要寫死特定平台名稱（應支援所有 Meta oBMC 和 OpenBIC 平台）
  - 不要包含程式碼撰寫邏輯（那是 fw-code-writer 的職責）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要深入理解韌體開發 domain knowledge，設計搜尋策略，撰寫詳細的 SKILL.md prompt
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `jira-deep-analysis`: Executor 應直接讀取源檔案作為參考，不需載入 skill

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:250-285` — Phase A-1 平行搜尋策略（4-agent 組合：kernel/driver + daemon/service + Meta platform + librarian），這是 fw-code-researcher 搜尋策略的核心參考
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:39-57` — Meta oBMC sublayer 架構說明（`meta-facebook/meta-{platform}/` 結構），fw-code-researcher 需要理解此結構來正確搜尋
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:107-171` — Phase A-FR FEATURE_REQUEST 工作流程（同平台 Pattern 優先、檔案組織一致性、交叉驗證 Device 細節），這是搜尋參考 pattern 的方法論
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:175-248` — Python scripts 用法和三步驟工作流程（search → grep → fetch），fw-code-researcher 會重複使用這些 scripts
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:438-468` — Route B gc2-es/OpenBIC pre-knowledge（platform 結構、common/ 模組角色、key files），fw-code-researcher 需要此 domain knowledge 來正確搜尋 OpenBIC repos

  **API/Type References**:
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\scripts\search_github.py` — 完整的 search_github.py API（286 行），支援 --repos/--org/--ext/--per-page/--text-matches，fw-code-researcher 需要引用此 API
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\scripts\grep_github_file.py` — grep_github_file.py API（158 行），搜尋檔案內 pattern 回傳行號
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\scripts\fetch_github_file.py` — fetch_github_file.py API（176 行），取得檔案片段

  **WHY Each Reference Matters**:
  - Phase A-1 和 A-FR 提供搜尋方法論 → fw-code-researcher 的核心流程設計
  - Python scripts 提供實際的搜尋工具 → fw-code-researcher 的工具層
  - Route B pre-knowledge 提供 OpenBIC domain knowledge → 正確搜尋 OpenBIC repos
  - sublayer 架構說明 → 避免搜尋到錯誤平台的同名檔案

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: SKILL.md 格式和內容完整性
    Tool: Bash
    Preconditions: Task 1 已完成
    Steps:
      1. test -f wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md → 檔案存在
      2. grep "^name: fw-code-researcher" wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md → frontmatter name 正確
      3. grep "^description:" wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md → 有 description
      4. grep "^license:" wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md → 有 license
      5. grep "^version:" wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md → 有 version
      6. grep -c "search_github.py" wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md → 至少提及 1 次
      7. grep -c "grep_github_file.py" wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md → 至少提及 1 次
      8. grep -c "fetch_github_file.py" wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md → 至少提及 1 次
      9. grep -c "meta-facebook" wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md → 提及 oBMC sublayer
      10. grep -c "common/" wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md → 提及 OpenBIC common
    Expected Result: 所有 frontmatter 欄位存在，3 個 Python scripts 都被引用，domain knowledge 包含 oBMC sublayer 和 OpenBIC common
    Failure Indicators: 缺少 frontmatter、未引用 Python scripts、缺少 domain knowledge
    Evidence: .sisyphus/evidence/task-5-code-researcher-format.txt

  Scenario: 確認不包含 model frontmatter
    Tool: Bash
    Preconditions: SKILL.md 已建立
    Steps:
      1. grep "^model:" wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md → 不應有 model 欄位
    Expected Result: grep 回傳 exit 1（無匹配）
    Failure Indicators: grep 回傳匹配（Skill 不支援 model 欄位）
    Evidence: .sisyphus/evidence/task-5-no-model-field.txt
  ```

  **Commit**: YES (groups with Tasks 6, 7 — Wave 2 commit)
  - Message: `feat(skills): add fw-code-researcher, fw-code-writer, fw-pr-reviewer skills`
  - Files: `.opencode/skills/fw-code-researcher/SKILL.md`

- [x] 6. 建立 fw-code-writer Skill

  **What to do**:
  - 建立 `wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md`
  - 此 Skill 的職責：接收 fw-code-researcher 的修改方案，根據方案撰寫實際的 C/C++ 程式碼，產出可直接 apply 的 patch / diff
  - SKILL.md 結構（遵循現有 Skills 的格式慣例）：

  ```markdown
  ---
  name: fw-code-writer
  description: '...'
  license: MIT
  version: 1.0.0
  ---

  # 韌體程式碼撰寫 Skill

  ## 概述
  ## 輸入（來自 fw-code-researcher 的修改方案）
  ## 程式碼撰寫規範
  ## 自動執行步驟
  ## 輸出格式
  ## 品質檢查
  ## 版本歷史
  ```

  - **核心流程**:
    1. **解析修改方案**: 從 fw-code-researcher 的輸出中提取：需修改的檔案清單、每個檔案的修改內容、修改理由
    2. **讀取目標檔案**: 使用 Python scripts（fetch_github_file.py）取得需修改的原始檔案完整內容
    3. **撰寫程式碼**: 根據修改方案撰寫 C/C++ 程式碼，遵循目標 repo 的 coding style
    4. **產出 diff/patch**: 以 unified diff 格式輸出修改，標註每個 hunk 的修改理由
    5. **自動 stage + commit**: 使用 `git add` + 觸發 `fw-commit-generator` skill 產出 commit message

  - **Skill 必須包含的 domain knowledge**:
    - OpenBMC C coding style（4-space indent、PAL API 命名慣例 `pal_`、error handling pattern `if (ret < 0)`）
    - OpenBIC C coding style（Zephyr 慣例、`LOG_ERR/LOG_WRN/LOG_INF` macro、`platform_sensor_init()` pattern）
    - 常見修改類型的模板：新增 sensor、修改 GPIO map、新增 platform-specific PAL function
    - Meta oBMC 和 LF oBMC 的 repo clone + build 前置知識（不需要 Skill 去 build，但要知道 file 結構）

  - **Python scripts 使用**: SKILL.md 中記錄如何用 fetch_github_file.py 取得修改前的原始碼做 diff 比對

  **Must NOT do**:
  - 不要在 SKILL.md 中加 `model:` frontmatter（Skill 不支援）
  - 不要包含程式碼搜尋邏輯（那是 fw-code-researcher 的職責）
  - 不要包含 PR 審查邏輯（那是 fw-pr-reviewer 的職責）
  - 不要硬寫死任何特定平台的程式碼片段（應保持通用 pattern）
  - 不要在 Skill 裡直接 `git push`（push 操作由使用者或 /fw-dev command 控制）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要深入理解韌體程式碼的 coding conventions、設計多步驟的 code generation workflow、撰寫含 domain knowledge 的 SKILL.md prompt
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `fw-commit-generator`: 此 task 是建立 Skill 本身（寫 SKILL.md），不是實際寫 firmware code，不需要載入 commit 生成 skill

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7)
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:1-6` — SKILL.md frontmatter 格式範例（name, description, license, version），fw-code-writer 的 frontmatter 需遵循此格式
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:39-57` — Meta oBMC sublayer 架構說明（`meta-facebook/meta-{platform}/` 結構），fw-code-writer 需理解此結構來正確定位要修改的檔案
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:438-468` — Route B OpenBIC pre-knowledge（platform 結構、common/ 模組角色），fw-code-writer 需此 domain knowledge 來遵循 OpenBIC coding conventions
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\fw-commit-generator\SKILL.md:1-30` — fw-commit-generator 的 Skill 結構參考：frontmatter + 概述 + 適用範疇 + 自動執行步驟的格式
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\fw-commit-generator\SKILL.md:23-30` — 自動執行 `git diff --cached` 的 workflow 設計 pattern，fw-code-writer 可參考此「自動執行步驟」section 的撰寫方式

  **API/Type References**:
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\scripts\fetch_github_file.py` — fetch_github_file.py API（176 行），fw-code-writer 需要引用此 script 來讀取修改前的原始檔案內容做 diff

  **WHY Each Reference Matters**:
  - frontmatter 格式：確保所有 Skills 格式一致
  - sublayer 架構 + OpenBIC pre-knowledge：fw-code-writer 撰寫的程式碼必須放在正確的 sublayer 位置
  - fw-commit-generator 結構：作為同類型 Skill 的格式參考
  - fetch_github_file.py：讀取原始碼做 before/after diff 比對

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: SKILL.md 格式和內容完整性
    Tool: Bash
    Preconditions: Task 1 已完成
    Steps:
      1. test -f wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md → 檔案存在
      2. grep "^name: fw-code-writer" wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md → frontmatter name 正確
      3. grep "^description:" wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md → 有 description
      4. grep "^license:" wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md → 有 license
      5. grep "^version:" wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md → 有 version
      6. grep -c "fetch_github_file.py" wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md → 至少提及 1 次
      7. grep -c "diff" wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md → 至少提及 2 次（unified diff 格式）
      8. grep -c "PAL\|pal_" wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md → 提及 PAL API pattern
      9. grep -c "coding style\|coding convention" wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md → 提及 coding conventions
    Expected Result: 所有 frontmatter 欄位存在，引用 fetch_github_file.py，包含 diff 產出說明和 coding conventions
    Failure Indicators: 缺少 frontmatter、未引用 Python scripts、無 coding convention 指引
    Evidence: .sisyphus/evidence/task-6-code-writer-format.txt

  Scenario: 確認不包含 model frontmatter 且不包含搜尋邏輯
    Tool: Bash
    Preconditions: SKILL.md 已建立
    Steps:
      1. grep "^model:" wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md → 不應有 model 欄位
      2. grep -c "search_github.py" wiwynn-fw-agent/.opencode/skills/fw-code-writer/SKILL.md → 不應引用搜尋 script（那是 fw-code-researcher 的職責）
    Expected Result: 無 model 欄位 (grep exit 1)；search_github.py 出現次數為 0（或僅在背景說明中簡短提及）
    Failure Indicators: 有 model 欄位、大量引用 search_github.py（職責越界）
    Evidence: .sisyphus/evidence/task-6-no-model-no-search.txt
  ```

  **Commit**: YES (groups with Tasks 5, 7 — Wave 2 commit)
  - Message: `feat(skills): add fw-code-researcher, fw-code-writer, fw-pr-reviewer skills`
  - Files: `.opencode/skills/fw-code-writer/SKILL.md`

- [x] 7. 建立 fw-pr-reviewer Skill

  **What to do**:
  - 建立 `wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md`
  - 此 Skill 的職責：審查韌體 PR 的程式碼品質，根據 openbmc/OpenBIC 的 coding standards 和 EF1900 部門規範給出 APPROVE 或 REQUEST_CHANGES 判定
  - SKILL.md 結構：

  ```markdown
  ---
  name: fw-pr-reviewer
  description: '...'
  license: MIT
  version: 1.0.0
  ---

  # 韌體 PR 審查 Skill

  ## 概述
  ## 輸入（PR diff + commit messages）
  ## 審查維度
  ## 審查流程
  ## 判定標準
  ## 輸出格式
  ## 版本歷史
  ```

  - **審查維度（7 個）**:
    1. **Coding Style 合規**: 4-space indent、命名慣例（oBMC: `pal_xxx`、OpenBIC: `plat_xxx`）、header guard
    2. **Error Handling**: `if (ret < 0)` pattern、必須有 error log（`syslog`/`LOG_ERR`）
    3. **Memory Safety**: malloc/free 配對、buffer overflow 檢查、pointer null check
    4. **Commit Message 品質**: 調用 commit-message-reviewer skill 的規則做交叉驗證
    5. **Platform Isolation**: 確認修改在正確的 sublayer（不應改到其他平台的程式碼）
    6. **邏輯正確性**: 根據 JIRA/Issue 描述的需求，驗證修改邏輯是否正確解決問題
    7. **測試覆蓋**: 是否有對應的 test case 或 test log

  - **判定標準**:
    - **APPROVE**: 所有 7 個維度通過，或僅有 minor suggestions（不影響功能）
    - **REQUEST_CHANGES**: 任何 1 個以上的 critical issue（Error Handling 缺失、Memory Safety 問題、邏輯錯誤）
    - 輸出格式必須包含：判定結果 + 每個維度的評估 + 具體 line comment + 修改建議

  - **Review Loop 支援**: Skill 輸出的 REQUEST_CHANGES 結果必須結構化，讓 fw-code-writer 可以解析並自動修正：
    ```
    ## REQUEST_CHANGES
    ### Issue 1: [維度] [嚴重程度]
    - 檔案: path/to/file.c:LINE
    - 問題: [具體描述]
    - 建議修改: [具體 code diff]
    ```

  **Must NOT do**:
  - 不要在 SKILL.md 中加 `model:` frontmatter
  - 不要包含程式碼撰寫邏輯（那是 fw-code-writer 的職責）
  - 不要包含 JIRA 分析邏輯（那是 jira-deep-analysis 的職責）
  - 不要在判定中加入主觀評價（必須基於具體規則）
  - 不要在 APPROVE 時隱瞞 minor issues（應列出但標示 severity）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要設計多維度的審查邏輯、定義精確的判定標準、確保輸出格式讓 review loop 可解析
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `commit-message-reviewer`: Executor 應讀取此 Skill 作為 commit message 審查維度的參考，但不需要在建立 fw-pr-reviewer 時載入

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 9
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\commit-message-reviewer\SKILL.md:1-432` — 完整的 432 行 commit-message-reviewer SKILL.md。fw-pr-reviewer 的「Commit Message 品質」審查維度應引用此 Skill 的規則（Meta oBMC vs LF oBMC 平台偵測、Subject 格式、Body 必要區段）。這是審查維度 #4 的核心參考。
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:39-57` — Meta oBMC sublayer 架構。fw-pr-reviewer 用此驗證 Platform Isolation（審查維度 #5）：修改是否在正確的 `meta-{platform}/` 目錄下。
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:438-468` — OpenBIC platform 結構 + `common/` 共用程式碼角色。fw-pr-reviewer 用此驗證 OpenBIC 的 Platform Isolation。
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:1-6` — SKILL.md frontmatter 格式範例，fw-pr-reviewer 的 frontmatter 需遵循此格式

  **External References**:
  - OpenBMC coding style: `https://github.com/openbmc/docs/blob/master/CONTRIBUTING.md` — 官方貢獻指南中的 coding style 要求
  - OpenBIC coding conventions: `https://github.com/facebook/OpenBIC/blob/main/CONTRIBUTING.md` — OpenBIC 的貢獻規範

  **WHY Each Reference Matters**:
  - commit-message-reviewer：fw-pr-reviewer 的 commit message 審查維度必須與現有 Skill 一致，避免衝突
  - sublayer 架構 + OpenBIC 結構：Platform Isolation 審查需要知道目錄結構才能判斷是否改錯位置
  - frontmatter 格式：統一所有 Skills 的 metadata 格式

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: SKILL.md 格式和審查維度完整性
    Tool: Bash
    Preconditions: Task 1 已完成
    Steps:
      1. test -f wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 檔案存在
      2. grep "^name: fw-pr-reviewer" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → frontmatter name 正確
      3. grep "^description:" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 有 description
      4. grep "^license:" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 有 license
      5. grep "^version:" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 有 version
      6. grep -c "APPROVE" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 至少提及 2 次
      7. grep -c "REQUEST_CHANGES" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 至少提及 2 次
      8. grep -c "Error Handling\|error handling" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 包含 error handling 審查維度
      9. grep -c "Memory Safety\|memory safety" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 包含 memory safety 審查維度
      10. grep -c "Platform Isolation\|platform isolation\|sublayer" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 包含 platform isolation 審查維度
    Expected Result: 所有 frontmatter 存在，APPROVE/REQUEST_CHANGES 判定標準存在，7 個審查維度都被涵蓋
    Failure Indicators: 缺少 frontmatter、缺少判定標準、審查維度不完整
    Evidence: .sisyphus/evidence/task-7-pr-reviewer-format.txt

  Scenario: REQUEST_CHANGES 輸出格式可被解析
    Tool: Bash
    Preconditions: SKILL.md 已建立
    Steps:
      1. grep -A5 "REQUEST_CHANGES" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 確認包含結構化輸出範例
      2. grep "Issue.*維度\|Issue.*嚴重\|Issue.*severity" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 確認每個 issue 標註維度和嚴重程度
      3. grep "建議修改\|suggested fix\|修改建議" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 確認包含修改建議
    Expected Result: REQUEST_CHANGES 輸出為結構化格式，每個 issue 有維度、嚴重程度、修改建議
    Failure Indicators: 輸出格式不結構化（無法被 fw-code-writer 解析）
    Evidence: .sisyphus/evidence/task-7-output-format.txt

  Scenario: 確認不包含 model frontmatter
    Tool: Bash
    Preconditions: SKILL.md 已建立
    Steps:
      1. grep "^model:" wiwynn-fw-agent/.opencode/skills/fw-pr-reviewer/SKILL.md → 不應有 model 欄位
    Expected Result: grep 回傳 exit 1（無匹配）
    Failure Indicators: grep 回傳匹配（Skill 不支援 model 欄位）
    Evidence: .sisyphus/evidence/task-7-no-model-field.txt
  ```

  **Commit**: YES (groups with Tasks 5, 6 — Wave 2 commit)
  - Message: `feat(skills): add fw-code-researcher, fw-code-writer, fw-pr-reviewer skills`
  - Files: `.opencode/skills/fw-pr-reviewer/SKILL.md`

- [x] 8. 建立 fw-coder Custom Agent

  **What to do**:
  - 建立 `wiwynn-fw-agent/.opencode/agents/fw-coder.md`
  - 此 Agent 的職責：綁定 GPT-5.3-codex model，專用於程式碼撰寫階段
  - Agent 檔案格式（OmO custom agent）：

  ```markdown
  ---
  name: fw-coder
  description: '...'
  model: gpt-5.3-codex
  ---

  You are a firmware code writer specialized in OpenBMC (C/Linux) and OpenBIC (C/Zephyr RTOS).

  ## Your Role
  - Write production-ready C/C++ code for BMC/BIC firmware
  - Follow Meta oBMC and OpenBIC coding conventions strictly
  - Generate unified diff patches that can be applied directly

  ## Coding Standards
  [核心 coding conventions 摘要]

  ## Workflow
  When asked to write code:
  1. Load the fw-code-writer skill for detailed guidance
  2. Read the modification plan from fw-code-researcher
  3. Fetch original source files
  4. Write code following platform conventions
  5. Generate commit message using fw-commit-generator skill
  ```

  - **關鍵 frontmatter 欄位**:
    - `name: fw-coder` — agent 名稱
    - `description:` — 簡短描述，OmO 用於 autocomplete
    - `model: gpt-5.3-codex` — **這是 model binding 的核心**。讓 /fw-dev command 在寫 code 階段切換到此 agent 時自動使用 codex model
  - **Agent body**: 包含簡短的 system prompt，定義 agent 的角色和基本行為。詳細的 code writing 邏輯在 fw-code-writer Skill 中（agent 載入 skill 時注入）
  - **不要在 agent body 重複 Skill 的完整內容**（context budget）

  **Must NOT do**:
  - 不要把 fw-code-writer Skill 的完整內容複製到 agent body（應載入 skill，不是內嵌）
  - 不要在 agent 中定義審查邏輯（那是 fw-pr-reviewer 的職責）
  - 不要硬寫 specific file paths 到 agent body（應保持通用）
  - 不要在 agent body 超過 100 行（保留 context budget 給 Skill 注入）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 建立一個短小的 agent markdown 檔案，主要是 frontmatter + 簡短 system prompt，不需要複雜分析
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 6)
  - **Parallel Group**: Wave 3 (with Tasks 9, 10)
  - **Blocks**: Task 9
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - OmO Orchestration Guide: `https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/refs/heads/dev/docs/guide/orchestration.md` — Custom agent 的建立方式、frontmatter 欄位（name, description, model）、agent body 的用途。這是建立 fw-coder agent 的唯一權威參考。
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\fw-commit-generator\SKILL.md:1-6` — frontmatter 格式參考（雖然是 Skill 不是 Agent，但 name/description/license 的 YAML 寫法一致）

  **WHY Each Reference Matters**:
  - OmO Orchestration Guide：唯一定義 custom agent 格式的文件。必須確認 `model:` 欄位的正確 key name 和用法
  - fw-commit-generator frontmatter：確保 YAML frontmatter 風格一致

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Agent 檔案格式驗證
    Tool: Bash
    Preconditions: Task 1 已完成（.opencode/agents/ 目錄存在）
    Steps:
      1. test -f wiwynn-fw-agent/.opencode/agents/fw-coder.md → 檔案存在
      2. grep "^name: fw-coder" wiwynn-fw-agent/.opencode/agents/fw-coder.md → frontmatter name 正確
      3. grep "^description:" wiwynn-fw-agent/.opencode/agents/fw-coder.md → 有 description
      4. grep "^model:" wiwynn-fw-agent/.opencode/agents/fw-coder.md → 有 model 欄位
      5. grep "gpt-5.3-codex\|codex" wiwynn-fw-agent/.opencode/agents/fw-coder.md → model 指向 codex
      6. wc -l wiwynn-fw-agent/.opencode/agents/fw-coder.md → 行數 < 100
    Expected Result: Agent 檔案存在、frontmatter 正確、model 綁定 codex、body 簡短（< 100 行）
    Failure Indicators: 檔案缺失、無 model 欄位、body 過長（> 100 行可能重複了 Skill 內容）
    Evidence: .sisyphus/evidence/task-8-fw-coder-agent.txt

  Scenario: 確認 agent body 不內嵌完整 Skill 內容
    Tool: Bash
    Preconditions: fw-coder.md 已建立
    Steps:
      1. wc -l wiwynn-fw-agent/.opencode/agents/fw-coder.md → 確認 < 100 行
      2. grep -c "fetch_github_file.py\|search_github.py\|grep_github_file.py" wiwynn-fw-agent/.opencode/agents/fw-coder.md → 不應大量引用 Python scripts（那是 Skill 的內容）
    Expected Result: 行數 < 100，Python scripts 引用次數 ≤ 1（僅概述提及）
    Failure Indicators: 行數 > 100 或 Python scripts 大量出現（表示 Skill 內容被內嵌）
    Evidence: .sisyphus/evidence/task-8-agent-size-check.txt
  ```

  **Commit**: YES (groups with Tasks 9, 10 — Wave 3 commit)
  - Message: `feat(orchestration): add fw-coder agent, /fw-dev command, GitHub Issue support`
  - Files: `.opencode/agents/fw-coder.md`

- [x] 9. 建立 /fw-dev Slash Command

  **What to do**:
  - 建立 `wiwynn-fw-agent/.opencode/commands/fw-dev.md`
  - 此 Command 的職責：串接完整的韌體開發流程（Issue 分析 → 程式碼研究 → 撰寫 → PR → 審查 → 迭代），是整個 wiwynn-fw-agent 的入口指令
  - Command 檔案格式（OmO slash command）：

  ```markdown
  ---
  description: '...'
  subtask: false
  ---

  [Command body — orchestration prompt]
  ```

  - **關鍵設計決策**:
    - `subtask: false`（或省略）：在當前 session 執行，保留完整對話上下文。這是核心需求——「單一對話 session 內完成」
    - **不設 `model:`**：orchestration 由 session default model (Claude Opus 4.6) 執行，只在寫 code 階段切換到 fw-coder agent
    - **支援 `$ARGUMENTS`**：使用者傳入 JIRA key 或 GitHub Issue URL

  - **Command body 的 orchestration 流程**:
    ```
    /fw-dev GC20T5T7-121
    /fw-dev https://github.com/Wiwynn/gc2-bmc-collection-script/issues/1
    ```

    1. **Step 1 - Issue 分析**: `skill({name: "jira-deep-analysis"})` → 分析 $ARGUMENTS 傳入的 issue
    2. **Step 2 - 程式碼研究**: `skill({name: "fw-code-researcher"})` → 根據分析結果搜尋相關程式碼，產出修改方案
    3. **Step 3 - 程式碼撰寫**: 切換到 `fw-coder` agent → `skill({name: "fw-code-writer"})` → 根據修改方案撰寫程式碼
    4. **Step 4 - Commit**: `skill({name: "fw-commit-generator"})` → 產出 commit message
    5. **Step 5 - 提交 PR**: 使用 `gh pr create` 提交 PR
    6. **Step 6 - 審查**: `skill({name: "fw-pr-reviewer"})` → 審查 PR
    7. **Step 7 - 迭代**: 如果 REQUEST_CHANGES → 回到 Step 3 → 重複直到 APPROVE

  - **Command body 撰寫原則**:
    - 使用自然語言 prompt 描述每個 step 的流程
    - 使用 `$ARGUMENTS` 接收使用者輸入的 issue key/URL
    - 在 Step 3 明確指示切換到 fw-coder agent（model routing）
    - 在 Step 7 明確描述 review loop 的進入/退出條件
    - 不要在 command body 重複 Skills 的詳細邏輯（用 `skill()` 載入）

  **Must NOT do**:
  - 不要在 command 中加 `model:` frontmatter（orchestration 用 session default model）
  - 不要設 `subtask: true`（需要保留對話上下文）
  - 不要在 command body 內嵌 Skill 完整內容（應用 `skill()` 載入）
  - 不要寫死特定 repo URL（應從 issue 分析結果動態判斷）
  - 不要在 command 中 hardcode review loop 的最大迭代次數（由使用者控制）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要設計完整的多步驟 orchestration 流程、正確使用 OmO 的 skill() 呼叫語法和 agent 切換機制、確保 review loop 邏輯正確
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - 所有 fw-* skills：此 task 是建立 Command（orchestration layer），不是執行 Skill

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential — depends on Tasks 5, 6, 7, 8)
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 5, 6, 7, 8

  **References**:

  **Pattern References**:
  - OmO Orchestration Guide: `https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/refs/heads/dev/docs/guide/orchestration.md` — Command 的完整格式規範（frontmatter: description, model, subtask, agent），body 支援 `$ARGUMENTS`, `$1`, `$2`, `!`shell cmd`` shell 插值, `@file` 檔案注入。這是建立 /fw-dev command 的核心參考。
  - OmO Overview: `https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/refs/heads/dev/docs/guide/overview.md` — `skill()` 呼叫語法和 agent 切換機制的概述

  **API/Type References**:
  - `D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md:1-3` — jira-deep-analysis 的 name 和 description（用於 command body 中的 `skill({name: "jira-deep-analysis"})` 呼叫）
  - 新建的 `fw-code-researcher`, `fw-code-writer`, `fw-pr-reviewer` Skills（Tasks 5, 6, 7 的產出）— command body 中需要正確引用這些 skill names

  **WHY Each Reference Matters**:
  - OmO Orchestration Guide：Command 格式的唯一權威。必須確認 $ARGUMENTS 語法、subtask 行為、agent 切換方式
  - Skill names：command body 中的 `skill()` 呼叫需使用正確的 skill name

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Command 檔案格式和 frontmatter 驗證
    Tool: Bash
    Preconditions: Tasks 5-8 已完成
    Steps:
      1. test -f wiwynn-fw-agent/.opencode/commands/fw-dev.md → 檔案存在
      2. grep "^description:" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 有 description
      3. grep "subtask:" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 如果有 subtask 欄位，值必須是 false
      4. grep "^model:" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 不應有 model frontmatter（用 session default）
    Expected Result: 檔案存在、有 description、無 model（或有但指向分析模型）、subtask 不是 true
    Failure Indicators: 檔案缺失、subtask: true（會建立隔離 session 失去上下文）
    Evidence: .sisyphus/evidence/task-9-fw-dev-format.txt

  Scenario: Command body 流程完整性驗證
    Tool: Bash
    Preconditions: fw-dev.md 已建立
    Steps:
      1. grep -c "ARGUMENTS\|\\$1" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 支援參數傳入
      2. grep -c "jira-deep-analysis" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 引用 Issue 分析 Skill
      3. grep -c "fw-code-researcher" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 引用程式碼研究 Skill
      4. grep -c "fw-code-writer" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 引用程式碼撰寫 Skill
      5. grep -c "fw-pr-reviewer" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 引用 PR 審查 Skill
      6. grep -c "fw-commit-generator" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 引用 Commit 生成 Skill
      7. grep -c "fw-coder" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 引用 code-writing agent
      8. grep -c "APPROVE\|approve" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 包含 review loop 退出條件
      9. grep -c "REQUEST_CHANGES\|request.changes" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 包含 review loop 進入條件
    Expected Result: 所有 6 個 Skills + 1 個 Agent 都被引用，review loop 有明確的進入/退出條件
    Failure Indicators: 缺少任何 Skill 引用、無 review loop 邏輯
    Evidence: .sisyphus/evidence/task-9-fw-dev-flow.txt

  Scenario: 確認不使用 subtask: true
    Tool: Bash
    Preconditions: fw-dev.md 已建立
    Steps:
      1. grep "subtask: true" wiwynn-fw-agent/.opencode/commands/fw-dev.md → 不應出現
    Expected Result: grep 回傳 exit 1（無匹配）— 確保在當前 session 執行
    Failure Indicators: 出現 subtask: true（會失去對話上下文，違反「單一對話 session」需求）
    Evidence: .sisyphus/evidence/task-9-no-subtask-true.txt
  ```

  **Commit**: YES (groups with Tasks 8, 10 — Wave 3 commit)
  - Message: `feat(orchestration): add fw-coder agent, /fw-dev command, GitHub Issue support`
  - Files: `.opencode/commands/fw-dev.md`

- [x] 10. 適配 jira-deep-analysis 支援 GitHub Issues

  **What to do**:
  - 修改 `wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md`（注意：修改的是 wiwynn-fw-agent 的副本，不是 EF1900 的原始檔）
  - 目標：讓 jira-deep-analysis 能接受 GitHub Issue URL 作為輸入（原本只支援 JIRA key），因為測試階段會用 GitHub Issue 而非 JIRA
  - **適配範圍**:
    1. **Phase 0（平台偵測）新增 GitHub Issue URL 解析**:
       - 當輸入是 `https://github.com/{owner}/{repo}/issues/{number}` 格式時，使用 `gh issue view` 或 GitHub API 取得 issue 內容
       - 從 issue body/labels/title 推斷平台（保留原有的 JIRA Key 平台對照表邏輯）
       - 如果 repo 本身就是目標 repo（如 gc2-bmc-collection-script），直接跳過平台偵測

    2. **新增 GitHub Issue 解析區段**:
       - 在 Phase 0 之前或之內加入 GitHub Issue URL 偵測邏輯：
         ```
         如果輸入是 GitHub Issue URL:
           1. gh issue view {URL} --json title,body,labels,assignees
           2. 解析 issue body（Markdown 格式，不需 ADF 解析）
           3. 從 labels/title/body 推斷 root cause 方向
           4. 進入 Phase A-1（或對應的分析流程）
         ```
       - 保留原有 JIRA 解析邏輯（雙來源並存）

    3. **Python scripts 不需修改**: fetch_jira.py 只處理 JIRA，GitHub Issue 的解析由 `gh` CLI 或直接用 fetch_github_file.py 處理。不需新增 Python script。

  - **修改策略**: 最小化修改。在現有的 Phase 0 區段中加入 GitHub Issue URL 判斷分支，其餘流程（Phase A-1~A-5）保持不變。

  **Must NOT do**:
  - 不要修改 EF1900_Dep_Automation 的原始 jira-deep-analysis（那個 repo 的 Skill 獨立維護）
  - 不要刪除 JIRA 相關邏輯（雙來源並存）
  - 不要修改 Python scripts（GitHub Issue 用 `gh` CLI 處理）
  - 不要更改版本號格式（但應把 version 改為 2.3.0-wiwynn 或類似標記以區分 fork）
  - 不要大幅重寫 Phase A-1~A-5 流程（GitHub Issue 的分析結果進入相同的下游流程）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 需要理解現有 683 行 SKILL.md 的結構來做精準修改，修改範圍需控制在最小，避免破壞現有邏輯
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `jira-deep-analysis`: 不能載入自己要修改的 Skill（循環依賴），executor 應直接讀取檔案

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 2)
  - **Parallel Group**: Wave 3 (with Tasks 8, 9) — 注意：此 task 只依賴 Task 2，不依賴 Tasks 5-7，所以可以在 Wave 3 平行
  - **Blocks**: Task 11
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md:25-60` — Phase 0 平台偵測區段（Task 2 複製後的版本）。這是要被修改的核心區段，需在此加入 GitHub Issue URL 解析邏輯。
  - `wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md:175-248` — Python scripts 用法說明。確認 GitHub Issue 解析不需要新 Python script，用 `gh issue view` CLI 即可。

  **External References**:
  - `gh issue view` CLI: `https://cli.github.com/manual/gh_issue_view` — GitHub CLI 的 issue view 命令，支援 `--json` 輸出格式化 JSON

  **WHY Each Reference Matters**:
  - Phase 0 區段：是修改的精確插入點，executor 需要讀取上下文來決定在哪裡加入分支
  - Python scripts 用法：確認不需修改 scripts，避免多餘工作
  - gh CLI：GitHub Issue 解析的工具選擇

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: GitHub Issue URL 解析邏輯存在
    Tool: Bash
    Preconditions: Task 2 已完成（jira-deep-analysis 已複製）
    Steps:
      1. grep -c "github.com.*issues" wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md → 至少 2 次（URL 格式說明 + 解析邏輯）
      2. grep -c "gh issue view\|gh issue" wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md → 至少 1 次（使用 gh CLI）
      3. grep "GitHub Issue\|github issue" wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md → 有 GitHub Issue 相關說明
    Expected Result: SKILL.md 包含 GitHub Issue URL 偵測和解析邏輯
    Failure Indicators: 無 GitHub Issue 相關內容（適配未完成）
    Evidence: .sisyphus/evidence/task-10-github-issue-support.txt

  Scenario: JIRA 邏輯未被破壞
    Tool: Bash
    Preconditions: 適配完成
    Steps:
      1. grep -c "fetch_jira.py" wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md → 仍然引用 JIRA fetcher
      2. grep -c "JIRA" wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md → JIRA 相關邏輯仍大量存在
      3. grep "GC20T5T7\|YV4T1M" wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md → JIRA Key 對照表仍存在
    Expected Result: 所有 JIRA 相關邏輯保留完整（fetch_jira.py 引用、JIRA Key 對照表、JIRA 分析流程）
    Failure Indicators: JIRA 引用減少、對照表被刪除
    Evidence: .sisyphus/evidence/task-10-jira-preserved.txt

  Scenario: 確認 EF1900 原始檔未被修改
    Tool: Bash
    Preconditions: 適配完成
    Steps:
      1. wc -l "D:\Antigravity_project\EF1900_Dep_Automation\.opencode\skills\jira-deep-analysis\SKILL.md" → 仍為 683 行（原始未改）
    Expected Result: EF1900 的 SKILL.md 行數未變（683 行）
    Failure Indicators: 行數不是 683（原始檔被意外修改）
    Evidence: .sisyphus/evidence/task-10-ef1900-untouched.txt
  ```

  **Commit**: YES (groups with Tasks 8, 9 — Wave 3 commit)
  - Message: `feat(orchestration): add fw-coder agent, /fw-dev command, GitHub Issue support`
  - Files: `.opencode/skills/jira-deep-analysis/SKILL.md` (modified)

- [x] 11. 建立測試用 GitHub Issue + 端對端測試

  **What to do**:
  - 在 `Wiwynn/gc2-bmc-collection-script` repo 建立一個測試用 GitHub Issue
  - 使用建立好的 Skill 流程做端對端測試（至少完成 Step 1-2：Issue 分析 + 程式碼研究）
  - **測試 Issue 設計**:
    - Title: `[Test] BMC script enhancement - add platform detection logic`（或類似的可測試需求）
    - Body: 描述一個簡單但有意義的需求（如：新增一個 shell function 做平台偵測），讓 jira-deep-analysis 有足夠內容可分析
    - Labels: `enhancement` 或 `test`

  - **端對端測試流程**:
    1. **建立 Issue**: `gh issue create --repo Wiwynn/gc2-bmc-collection-script --title "..." --body "..." --label "test"`
    2. **Step 1 測試 - Issue 分析**: 模擬 `skill({name: "jira-deep-analysis"})` 的行為：
       - 使用 `gh issue view` 取得 issue 內容
       - 驗證 jira-deep-analysis 的 GitHub Issue 適配能正確解析
       - 捕獲分析輸出
    3. **Step 2 測試 - 程式碼研究**: 模擬 `skill({name: "fw-code-researcher"})` 的行為：
       - 使用 search_github.py 搜尋 gc2-bmc-collection-script repo
       - 驗證 Python scripts 能正確呼叫 GitHub API（PAT 有效）
       - 捕獲搜尋結果
    4. **驗證證據收集**: 將所有輸出保存到 `.sisyphus/evidence/` 目錄

  - **測試範圍限制**: 端對端測試只需走完 Step 1-2（Issue 分析 + 程式碼研究），不需要實際寫 code、提 PR、做 review（因為 gc2-bmc-collection-script 是 Shell repo，不是 C/C++ firmware repo，完整流程在實際韌體 repo 上才有意義）

  **Must NOT do**:
  - 不要在測試中實際推 PR 到 gc2-bmc-collection-script（只做 Issue 建立和分析）
  - 不要修改 gc2-bmc-collection-script 的任何程式碼
  - 不要使用真實的 JIRA key 做測試（用 GitHub Issue URL）
  - 不要建立大量測試 Issues（1 個就夠）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要理解完整的 Skill 流程、正確使用 gh CLI 和 Python scripts、產出有意義的測試證據
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `jira-deep-analysis`: Executor 不應載入此 Skill（它在測試 Skill 的行為，不是使用 Skill），應直接讀取 SKILL.md 來理解預期行為

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (with Task 12 — sequential)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 9, 10

  **References**:

  **Pattern References**:
  - `wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/SKILL.md` — 完整的 jira-deep-analysis Skill（含 GitHub Issue 適配，Task 10 的產出），executor 需要讀取此檔案來理解 Issue 分析的預期輸入/輸出格式
  - `wiwynn-fw-agent/.opencode/skills/fw-code-researcher/SKILL.md` — fw-code-researcher Skill（Task 5 的產出），executor 需要理解程式碼研究的預期流程

  **API/Type References**:
  - `wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/scripts/search_github.py` — 搜尋 gc2-bmc-collection-script repo 用的 Python script
  - `gh issue create` CLI: 建立測試 Issue
  - `gh issue view` CLI: 驗證 Issue 內容可被正確讀取

  **External References**:
  - Test target repo: `https://github.com/Wiwynn/gc2-bmc-collection-script` — Shell-based private repo，有 `README.md` 和多個 `.sh` scripts

  **WHY Each Reference Matters**:
  - jira-deep-analysis SKILL.md：定義 Issue 分析的預期行為，測試需要驗證實際行為與此一致
  - fw-code-researcher SKILL.md：定義程式碼研究的預期行為
  - search_github.py：實際的測試工具，驗證 GitHub API 連線正常
  - gc2-bmc-collection-script：測試目標 repo，需要確認 PAT 有 private repo 存取權

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: GitHub Issue 建立成功
    Tool: Bash
    Preconditions: gh CLI 已認證、有 Wiwynn/gc2-bmc-collection-script 存取權
    Steps:
      1. gh issue create --repo Wiwynn/gc2-bmc-collection-script --title "[Test] BMC script enhancement - add platform detection" --body "## Description\nAdd a platform detection function..." --label "test" → 取得 issue URL
      2. gh issue view {URL} --json title,body,labels → 確認 issue 內容正確
    Expected Result: Issue 建立成功，回傳有效的 issue URL，issue 內容可被讀取
    Failure Indicators: 403 Forbidden（無存取權）、422 Validation Failed（label 不存在）
    Evidence: .sisyphus/evidence/task-11-issue-created.txt

  Scenario: Step 1 - Issue 分析端對端測試
    Tool: Bash
    Preconditions: 測試 Issue 已建立（Scenario 1 完成）
    Steps:
      1. gh issue view {URL} --json title,body,labels,assignees → 取得 issue JSON
      2. 驗證 JSON 包含 title、body 欄位
      3. 記錄分析輸入（issue 內容）和預期分析方向
    Expected Result: Issue 內容成功取得，JSON 格式正確，可作為 jira-deep-analysis 的輸入
    Failure Indicators: JSON parse error、欄位缺失
    Evidence: .sisyphus/evidence/task-11-step1-issue-analysis.txt

  Scenario: Step 2 - 程式碼搜尋端對端測試
    Tool: Bash
    Preconditions: Python 3 + requests + python-dotenv 已安裝，.env 有 GITHUB_TOKEN
    Steps:
      1. python wiwynn-fw-agent/.opencode/skills/jira-deep-analysis/scripts/search_github.py "platform" --repos Wiwynn/gc2-bmc-collection-script --per-page 5 → 搜尋結果
      2. 驗證回傳 JSON 包含 items 欄位（可能為空陣列，但不應是 error）
    Expected Result: search_github.py 成功呼叫 GitHub API，回傳 JSON（即使搜尋結果為空）
    Failure Indicators: 401 Unauthorized（token 無效）、ConnectionError、Python exception
    Evidence: .sisyphus/evidence/task-11-step2-code-search.txt
  ```

  **Commit**: YES (groups with Task 12 — Wave 4 commit)
  - Message: `test(e2e): add end-to-end test with gc2-bmc-collection-script`
  - Files: `.sisyphus/evidence/task-11-*`

- [x] 12. Git Commit + Push 所有變更

  **What to do**:
  - 執行 4 次 commit（對應 4 個 Wave 的 commit strategy）：
    1. **Wave 1 commit**: `feat(opencode): scaffold .opencode directory and migrate existing skills`
       - 包含：.opencode/config.json, .opencode/.gitignore, .env.example, .gitignore, README.md, jira-deep-analysis/*, fw-commit-generator/*, commit-message-reviewer/*
    2. **Wave 2 commit**: `feat(skills): add fw-code-researcher, fw-code-writer, fw-pr-reviewer skills`
       - 包含：fw-code-researcher/SKILL.md, fw-code-writer/SKILL.md, fw-pr-reviewer/SKILL.md
    3. **Wave 3 commit**: `feat(orchestration): add fw-coder agent, /fw-dev command, GitHub Issue support`
       - 包含：agents/fw-coder.md, commands/fw-dev.md, jira-deep-analysis/SKILL.md (modified)
    4. **Wave 4 commit**: `test(e2e): add end-to-end test with gc2-bmc-collection-script`
       - 包含：.sisyphus/evidence/task-11-*, README 更新

  - **注意**: 如果前面的 tasks 在執行時已經個別 commit 了（每個 Wave 完成後 commit），此 task 只需要做最後的 push：
    ```bash
    git push origin main
    ```
  - 如果前面的 tasks 沒有 commit（全部在最後一次處理），此 task 負責全部 4 次 commit + 最終 push

  - **Push 前檢查**:
    - `git status` 確認 working tree clean
    - `git log --oneline -5` 確認 commit history 正確
    - 確認 `.env` 不在 staged files 中
    - 確認沒有意外的大型檔案

  **Must NOT do**:
  - 不要 `git push --force`（正常 push 即可）
  - 不要提交 `.env` 檔案（機敏資訊）
  - 不要提交 `node_modules/`
  - 不要提交 `.sisyphus/` 目錄到 remote（除非用戶明確要求）
  - 不要修改 git config（user.name, user.email）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 純粹的 git 操作（add, commit, push），無需複雜分析
  - **Skills**: [`git-master`]
    - `git-master`: 確保 commit message 格式正確、commit 操作安全
  - **Skills Evaluated but Omitted**:
    - 其他 skills 不相關

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after Task 11)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 11

  **References**:

  **Pattern References**:
  - `wiwynn-fw-agent/.gitignore` — 確認 .env 和 node_modules 在 gitignore 中
  - Commit Strategy section of this plan — 4 次 commit 的 message 和包含檔案

  **WHY Each Reference Matters**:
  - .gitignore：最後一道防線，確保機敏檔案不會被提交
  - Commit Strategy：定義 4 次 commit 的精確範圍和 message

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Commit history 驗證
    Tool: Bash
    Preconditions: 所有 Tasks 1-11 已完成
    Steps:
      1. git -C wiwynn-fw-agent log --oneline -5 → 確認最近 4-5 個 commit message 符合 Commit Strategy
      2. git -C wiwynn-fw-agent status → 確認 working tree clean
      3. git -C wiwynn-fw-agent diff --cached → 確認無 staged 但未 commit 的變更
    Expected Result: 有 4 個新 commit（feat(opencode), feat(skills), feat(orchestration), test(e2e)），working tree clean
    Failure Indicators: commit 數量不對、working tree 有未提交變更
    Evidence: .sisyphus/evidence/task-12-commit-history.txt

  Scenario: Push 成功驗證
    Tool: Bash
    Preconditions: commit 完成
    Steps:
      1. git -C wiwynn-fw-agent push origin main → push 到 remote
      2. git -C wiwynn-fw-agent log --oneline origin/main -5 → 確認 remote 有最新 commit
    Expected Result: push 成功，remote 的 main branch 包含所有新 commit
    Failure Indicators: push rejected（需 pull）、authentication error
    Evidence: .sisyphus/evidence/task-12-push-success.txt

  Scenario: 確認未提交機敏檔案
    Tool: Bash
    Preconditions: push 完成
    Steps:
      1. git -C wiwynn-fw-agent log --all --diff-filter=A --name-only --pretty="" | grep -E "\.env$|\.env\.local$" → 不應有 .env 被 commit
      2. git -C wiwynn-fw-agent log --all --diff-filter=A --name-only --pretty="" | grep "node_modules" → 不應有 node_modules 被 commit
    Expected Result: 無 .env 或 node_modules 出現在 commit history 中
    Failure Indicators: grep 找到匹配（機敏檔案被提交）
    Evidence: .sisyphus/evidence/task-12-no-secrets.txt
  ```

  **Commit**: N/A（此 task 本身就是做 commit + push）

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, check content). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Review all SKILL.md files for: consistent frontmatter format, no placeholder text, no `TODO` markers left behind, no AI slop (excessive comments, over-abstraction). Check Python scripts for: proper error handling, .env loading, JSON output format consistency. Verify .gitignore includes `.env` and `node_modules/`.
  Output: `Skills [N clean/N issues] | Scripts [N clean/N issues] | Config [PASS/FAIL] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Run each Python script with test args. Verify SKILL.md frontmatter is parseable. Verify `/fw-dev` command file has correct frontmatter. Test the adapted jira-deep-analysis with a GitHub Issue URL. Save evidence to `.sisyphus/evidence/final-qa/`.
  Output: `Scripts [N/N pass] | Skills [N/N valid] | Command [PASS/FAIL] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual files created. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Flag unaccounted files.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1 完成後**: `feat(opencode): scaffold .opencode directory and migrate existing skills` — .opencode/config.json, skills/jira-deep-analysis/*, skills/fw-commit-generator/*, skills/commit-message-reviewer/*, .env.example
- **Wave 2 完成後**: `feat(skills): add fw-code-researcher, fw-code-writer, fw-pr-reviewer skills` — skills/fw-code-researcher/*, skills/fw-code-writer/*, skills/fw-pr-reviewer/*
- **Wave 3 完成後**: `feat(orchestration): add fw-coder agent, /fw-dev command, GitHub Issue support` — agents/fw-coder.md, commands/fw-dev.md, jira-deep-analysis 適配
- **Wave 4 完成後**: `test(e2e): add end-to-end test with gc2-bmc-collection-script` — 測試結果 + README 更新

---

## Success Criteria

### Verification Commands
```bash
# Skill 檔案存在且 frontmatter 正確
grep -c "^name:" .opencode/skills/*/SKILL.md                    # Expected: 6 (每個 Skill 一個)
grep -c "^description:" .opencode/skills/*/SKILL.md              # Expected: 6

# Python scripts 可執行
python .opencode/skills/jira-deep-analysis/scripts/fetch_jira.py --help  # Expected: 用法說明
python .opencode/skills/jira-deep-analysis/scripts/search_github.py --help  # Expected: 用法說明

# Command 檔案存在
cat .opencode/commands/fw-dev.md | head -5                       # Expected: YAML frontmatter

# Agent 檔案存在
cat .opencode/agents/fw-coder.md | head -5                       # Expected: YAML frontmatter with model

# .env.example 存在
test -f .opencode/skills/jira-deep-analysis/scripts/.env.example  # Expected: exit 0

# .gitignore 包含 .env
grep ".env" .gitignore                                            # Expected: .env
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All Python scripts execute without import errors
- [ ] All SKILL.md frontmatter parseable
- [ ] /fw-dev command file has correct frontmatter
- [x] fw-coder agent has model field
- [ ] .env.example has all required variables
- [ ] No .env files committed to git
