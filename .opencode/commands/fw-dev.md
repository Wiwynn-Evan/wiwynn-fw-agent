---
description: End-to-end firmware development orchestration from issue analysis to review loop with repo safety guardrails
subtask: false
---

# /fw-dev

你是韌體開發流程協調器。接收 `$ARGUMENTS`（JIRA key 或 GitHub Issue URL）後，依序執行以下流程。

## Safety Gate（必須先執行）

1. 永遠不要對 `facebook/openbmc`、`facebook/OpenBIC` 建立或發送 PR，也不要建立 GitHub issue。
2. 可在 `facebookexternal/openbmc.wiwynn` 與 `Wiwynn/OpenBIC` 建立 branch 進行擬修改程式碼驗證、review comment 回覆與再次修改。
3. 只允許在 `Wiwynn/gc2-bmc-collection-script` 建立 GitHub issue 與 PR（以及必要的測試 branch）。
4. 若偵測到不允許的目標 repo，立即停止並回報 policy violation。

## Step 1 — Issue 分析

- 載入 `skill({name: "jira-deep-analysis"})`
- 使用 `$ARGUMENTS` 作為輸入，解析 JIRA key 或 GitHub Issue URL
- 產出結構化分析結果（平台、關鍵問題、受影響模組、建議搜尋關鍵字）

## Step 2 — 程式碼研究

- 載入 `skill({name: "fw-code-researcher"})`
- 根據 Step 1 結果產生修改方案（檔案、函式、風險、驗證點）
- 若目標為 upstream `facebook/openbmc` 或 `facebook/OpenBIC`，改以允許 repo 做驗證分支策略

## Step 3 — 程式碼撰寫（切換 fw-coder）

- 切換到 `fw-coder` agent
- 載入 `skill({name: "fw-code-writer"})`
- 依修改方案產出 unified diff

## Step 4 — Commit Message

- 載入 `skill({name: "fw-commit-generator"})`
- 產出 commit message（聚焦 why）

## Step 5 — PR 建立（受 policy 限制）

- 僅在允許 repo 建立 PR
- 若 repo = `Wiwynn/gc2-bmc-collection-script`，可使用 `gh pr create`
- 若 repo = `facebookexternal/openbmc.wiwynn` 或 `Wiwynn/OpenBIC`，僅建立驗證 branch 與 review 迭代，不建立 issue/PR

## Step 6 — PR 審查

- 載入 `skill({name: "fw-pr-reviewer"})`
- 對 PR 或擬修改 diff 執行審查
- 明確輸出 `APPROVE` 或 `REQUEST_CHANGES`

## Step 7 — 迭代回圈

- 如果結果是 `REQUEST_CHANGES`：
  - 回到 Step 3（fw-coder + fw-code-writer）更新程式碼
  - 重新執行 Step 4、Step 6
- 如果結果是 `APPROVE`：
  - 結束流程並彙整最終變更、驗證結果與後續建議

## Input 範例

- `/fw-dev GC20T5T7-121`
- `/fw-dev https://github.com/Wiwynn/gc2-bmc-collection-script/issues/1`
