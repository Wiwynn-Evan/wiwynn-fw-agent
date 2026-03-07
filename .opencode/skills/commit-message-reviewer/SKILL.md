---
name: commit-message-reviewer
description: 'Review git commit messages against EF1900 firmware department conventions. Automatically detects platform (GitHub=Meta oBMC, Gerrit=LF oBMC) and validates format, completeness, and quality. Use when reviewing commit messages, PRs, or CLs. Provides actionable feedback with specific improvement suggestions.'
license: MIT
---

# Commit Message Reviewer - EF1900 韌體部門

## 概述 (Overview)

根據 EF1900 韌體部門的 commit conventions 審查 commit message，提供詳細的合規性檢查與改進建議。

## 適用情境 (When to Use)

- 審查 Pull Request 或 Change List 的 commit message
- 檢查 commit message 是否符合部門規範
- 提供 commit message 改進建議
- 驗證 commit message 完整性

## 規則選擇 (Rule Selection)

### 自動偵測平台

```bash
# 從 URL 判斷適用規則
if [[ $url == *"github.com"* ]]; then
  RULE="Meta oBMC"
elif [[ $url == *"gerrit"* ]]; then
  RULE="LF oBMC"
fi
```

- **GitHub URL** → 遵循 **Meta oBMC** 規則
- **Gerrit URL** → 遵循 **LF oBMC** 規則

---

## Rule 1: LF oBMC (Gerrit) 檢查項目

### 基本格式檢查

```
<type>(<scope>): <subject>     # <= 50 字元
                                # 空行
<body>                          # 每行 <= 72 字元，說明 "為什麼"
                                # 空行
<footer>                        # 相關 issue/ticket
```

### 必檢項目 (MUST Check)

| 檢查項目 | 規則 | 示例 |
|---------|------|------|
| **標題行格式** | `<type>(<scope>): <subject>` | `fix(auth): resolve session timeout` |
| **使用祈使句** | Add/Fix/Update (不是 Added/Fixed) | ✅ `Add feature` ❌ `Added feature` |
| **首字母大寫** | 標題首字母大寫，不加句號 | ✅ `Fix bug` ❌ `fix bug.` |
| **Type 有效性** | 必須是有效的 Conventional Commits type | `feat`, `fix`, `docs`, `style`, etc. |
| **Body 存在** | 複雜變更必須有 body 說明 "為什麼" | 不能只有標題行 |
| **原子性** | 一個 commit 只做一件事 | 不可混合多個不相關變更 |

### Conventional Commits Types

| Type | 用途 | 範例 |
|------|------|------|
| `feat` | 新功能 | `feat(api): add user authentication` |
| `fix` | 修復 bug | `fix(auth): resolve session timeout on mobile` |
| `docs` | 文件變更 | `docs(readme): update installation steps` |
| `style` | 格式調整 (不影響邏輯) | `style(sensor): fix code indentation` |
| `refactor` | 重構 | `refactor(gpio): simplify init sequence` |
| `perf` | 效能優化 | `perf(i2c): reduce polling interval` |
| `test` | 測試相關 | `test(sensor): add temperature reading test` |
| `build` | 建置系統/依賴項 | `build(deps): update OpenBMC to v2.15` |
| `ci` | CI/設定檔變更 | `ci(jenkins): add cppcheck stage` |
| `chore` | 建置工具、雜項 | `chore(scripts): update deploy script` |
| `revert` | 還原 commit | `revert: revert commit abc123` |

### Footer 用法

```
Fixes #123          # 關閉 issue
Closes #456         # 關閉 PR
Related to #789     # 相關 issue

BREAKING CHANGE: API endpoint changed from /v1 to /v2
```

### 範例：GOOD vs BAD

```
# ❌ BAD
fixed stuff
Update code
added new feature and fixed bug and updated docs
```

```
# ✅ GOOD
fix(auth): resolve session timeout on mobile

Users were logged out after 5 minutes due to incorrect
timeout calculation in session middleware.

Fixes #234
```

---

## Rule 2: Meta oBMC (GitHub) 檢查項目

### Subject Line 必檢項目

| 檢查項目 | 狀態 | 規則 |
|---------|:----:|------|
| **包含 Platform Name** | MUST | 必須以 `<platform>:` 開頭 |
| **改動內容描述清楚** | MUST | 明確說明做了什麼 |
| **動詞不限** | MAY | 不強制使用特定動詞 |

**範例**:
- ✅ `yosemite4: support CXL crashdump collection via MCTP mailbox commands`
- ✅ `fby4: sd: fix power fault mechanism not triggered due to immediate DC off`
- ❌ `update sensor code` (缺少 platform name)

### Body 必檢項目 - Feature (新功能/增強)

| 區段 | 狀態 | 要求 |
|------|:----:|------|
| **[Task Description]** | MUST | 描述工作目的、使用情境、對系統的改善 |
| **[Task Description] - JIRA** | SHOULD | 包含 JIRA number (若無則標註 N/A) |
| **[Motivation]** | MUST | 說明為什麼需要這個功能 |
| **[Design]** | MUST | 說明新增或修改了什麼機制和流程 |
| **[Test Log]** | MUST | 包含驗證手法與測試結果 |

**Feature 範例**:
```
yosemite4: Support CXL crashdump collection via MCTP mailbox commands

[Task Description]
- Related to YV4T1M-1946
- Develop CXL mailbox command tool for device diagnostics via MCTP CCI
- Implement automated CXL mailbox information collection during RAS fatal errors

[Motivation]
- Enable comprehensive CXL device diagnostics and crashdump collection
- Provide automated capture of CXL device state during system fatal errors
- Enhance debugging capabilities for CXL-related system failures

[Design]
- Add cxl-mailbox tool with MCTP CCI support
  - Implement commands: get-fw-info, get-event-records, get-supported-logs, get-log
- Create cxl-mailbox-info-collect script for automated data gathering
  - Collect event records, logs, health counters, and membridge stats
  - Generate timestamped compressed archives
- Integrate with AMD RAS fatal error handler
  - Trigger collection on fatal errors with 60-second stabilization delay

[Test Log]
- Verify CXL mailbox command execution via MCTP for all supported operations
- Validate automated collection trigger on AMD RAS fatal errors
- Confirm archive generation with proper timestamps and content
```

### Body 必檢項目 - Bug Fix (修復)

| 區段 | 狀態 | 要求 |
|------|:----:|------|
| **[Issue Description]** | MUST | 描述問題現象、發生情境、對系統的影響 |
| **[Issue Description] - JIRA** | SHOULD | 包含 JIRA number (若無則標註 N/A) |
| **[Root Cause]** | MUST | 說明問題發生的根本原因 |
| **[Solution]** | MUST | 說明做了什麼改動以修復問題 |
| **[Test Log]** | MUST | 包含驗證手法與測試結果 |

**Bug Fix 範例**:
```
fby4: sd: Fix power fault mechanism not triggered due to immediate DC off

[Issue Description]
- Related to YV4T1M-2176
- When CPLD notifies SD BIC of a power fault via FM_SOL_UART_CH_SEL rising edge, 
  SD BIC checks DC status by reading PWRGD_CPU_LVC3 in the handler

[Root Cause]
- According to waveform analysis, PWRGD_CPU_LVC3 falls approximately 4μs after 
  FM_SOL_UART_CH_SEL rises
- This 4μs timing window is too short, causing PWRGD_CPU_LVC3 to already be LOW 
  when SD BIC performs the DC status check
- DC status check fails and power fault handler does not execute properly

[Solution]
- Remove the condition that checks DC status is on when handling 
  FM_SOL_UART_CH_SEL rising edge

[Test Log]
- Verify the power fault SELs are logged after manually inject PVDDCR_CPU0_OCP_N error
```

---

## 審查流程 (Review Workflow)

### Step 1: 獲取 Commit Message

```bash
# 從 PR/CL URL 獲取
gh pr view <pr-number> --json title,body

# 從本地 commit 獲取
git log -1 --format="%s%n%n%b"

# 從 commit hash 獲取
git show --format="%s%n%n%b" <commit-hash> --no-patch
```

### Step 2: 識別平台與類型

1. **判斷平台**：從 URL 或上下文判斷是 GitHub (Meta oBMC) 還是 Gerrit (LF oBMC)
2. **判斷類型**：
   - Meta oBMC: 從內容判斷是 Feature 還是 Bug Fix
   - LF oBMC: 從 type 欄位判斷

### Step 3: 執行合規性檢查

根據平台與類型，逐項檢查必要欄位與格式。

**輸出格式**：
```markdown
## 🔍 Commit Message 審查報告

### 基本資訊
- **平台**: Meta oBMC (GitHub) / LF oBMC (Gerrit)
- **類型**: Feature / Bug Fix / Other
- **適用規則**: [規則名稱]

### 合規性檢查

| 檢查項目 | 狀態 | 說明 |
|---------|:----:|------|
| 包含 Platform Name | ✅ PASS | 標題包含 `yosemite4:` |
| [Task Description] 完整 | ❌ FAIL | 缺少工作目的說明 |
| [Motivation] 存在 | ✅ PASS | 清楚說明功能需求原因 |
| [Design] 完整 | ⚠️ WARNING | 實作細節較簡略 |
| [Test Log] 完整 | ✅ PASS | 包含具體驗證步驟 |
| JIRA 編號 | ⚠️ SHOULD | 建議加入 JIRA number |

### 整體評分
- **PASS**: 5/6 (83%)
- **總體評價**: 🟡 Acceptable with Minor Issues

### 改進建議
1. ❌ **[Task Description] 缺失工作目的**
   - 當前：僅列出相關 JIRA
   - 建議：補充「此功能如何改善系統」的說明
   
2. ⚠️ **[Design] 實作細節不足**
   - 當前：只有高層次描述
   - 建議：補充關鍵技術細節或流程圖參考

3. ⚠️ **缺少 JIRA 編號**
   - 建議：在 [Task Description] 中加入 `Related to YV4T1M-XXXX`
```

### Step 4: 提供改進建議

根據檢查結果，提供具體的補全模板。

---

## 補全建議指引 (Suggest from Changes)

當 Commit Log 缺失必要資訊時，應根據 `git diff` 內容提供補全建議。

### 對應範例 (Mapping Examples)

| 變更類型 | [Design] 建議 | [Test Log] 建議 |
|---------|---------------|----------------|
| **I2C 地址變更** | Update sensor I2C slave address from 0x40 to 0x41 to match hardware schematic | Verify sensor reading via `busctl` and confirm no I2C timeout errors |
| **新增 Sensor Table 條目** | Add TMP75 sensor configuration for new expansion board | Check `ipmitool sdr` to ensure new sensor is visible and reporting valid data |
| **新增偵測邏輯** | Implement GPIO-based presence detection for riser cards | Toggle GPIO and verify SEL events are generated correctly |
| **修改錯誤處理** | Add proper error handling for I2C timeout scenarios | Test with I2C bus failure injection and verify error logs |
| **優化輪詢頻率** | Reduce sensor polling interval from 1s to 5s to lower CPU usage | Monitor CPU usage with `top` and confirm < 5% utilization |

### 補全建議模板

```markdown
> 🔍 **偵測到您的 Commit Log 缺失必要區段**
> 
> 根據 git diff 分析，建議補全如下：
> 
> ```markdown
> [Motivation]
> - <根據變更推測：為什麼需要此變更？解決什麼問題？>
> 
> [Design]
> - <根據 diff 內容：具體修改了哪些檔案/函數/邏輯？>
> - <列出關鍵技術點：例如 I2C address 0x40 → 0x41>
> 
> [Test Log]
> - <建議驗證方式：例如執行 busctl 命令、檢查 SEL 日誌>
> - <預期結果：例如 sensor reading 正常，無 timeout error>
> ```
> 
> ### 📝 具體建議（根據您的變更）
> 
> #### [Design] 可補充
> - 修改檔案：`meta-xxx/recipes-xxx/xxx/xxx.c`
> - 變更內容：將 sensor I2C address 從 0x40 改為 0x41
> - 原因：配合 HW schematic Rev B 更新
> 
> #### [Test Log] 可補充
> - 驗證步驟：
>   ```bash
>   busctl tree xyz.openbmc_project.Hwmon
>   ipmitool sdr list
>   ```
> - 預期結果：Sensor 正常讀取，無 I2C timeout error
```

---

## Git Safety Protocol (安全守則)

執行 Git 操作時，務必遵守以下安全守則：

| 規則 | 說明 |
|------|------|
| **禁止修改 git config** | 不要隨意更改全域或專案的 git 設定 |
| **禁止破壞性指令** | 未經明確要求，不得執行 `--force`、`hard reset` 等指令 |
| **禁止跳過 hooks** | 除非使用者明確要求，否則不得使用 `--no-verify` |
| **禁止強制推送 main/master** | 永遠不要對主分支執行 `force push` |
| **Hook 失敗處理** | 若 commit 因 hooks 失敗，應修正問題後建立新 commit（不要 amend） |

---

## 輸出格式 (Output Format)

### 簡要模式 (Quick Summary)
```
✅ PASS: Meta oBMC Feature Format (5/5 checks passed)
⚠️ MINOR ISSUES: Missing JIRA number (SHOULD have)
📊 Score: 90%
```

### 詳細模式 (Detailed Report)
使用上述 **Step 3** 的表格格式，提供完整的檢查項目與改進建議。

---

## 最佳實踐 (Best Practices)

1. **自動化檢查**：可整合進 PR review 流程或 pre-commit hook
2. **具體建議**：不只指出問題，還要提供可行的改進範例
3. **平台感知**：自動偵測 GitHub/Gerrit，套用正確規則
4. **寬嚴並濟**：MUST 項目嚴格檢查，SHOULD 項目給予警告但不阻擋
5. **上下文理解**：結合 git diff 內容提供更精準的補全建議

---

## 參考資料 (References)

- **EF1900 Commit Conventions**: `commit-conventions/Git Commit Log rule.md`
- **Conventional Commits**: https://www.conventionalcommits.org/
- **Linux Kernel Commit Guidelines**: https://kernel.org/doc/html/latest/process/submitting-patches.html

---

## 使用範例 (Usage Examples)

### 範例 1: 審查 GitHub PR

```markdown
**使用者**: 請審查這個 PR 的 commit message: https://github.com/meta/openbmc/pull/12345

**AI 使用此 skill**:
1. 使用 `gh pr view 12345 --json title,body` 獲取 commit message
2. 偵測到 GitHub URL → 套用 Meta oBMC 規則
3. 檢查是否包含 platform name
4. 判斷類型 (Feature/Bug Fix)
5. 逐項檢查必要區段
6. 提供詳細審查報告與改進建議
```

### 範例 2: 審查本地 commit

```markdown
**使用者**: 請幫我檢查最新一筆 commit message 是否符合規範

**AI 使用此 skill**:
1. 使用 `git log -1 --format="%s%n%n%b"` 獲取 commit message
2. 從專案上下文判斷平台 (檢查 remote URL 是否包含 gerrit/github)
3. 套用對應規則進行檢查
4. 提供審查報告
```

### 範例 3: 提供補全建議

```markdown
**使用者**: 我的 commit message 缺少 [Test Log]，應該怎麼寫？

**AI 使用此 skill**:
1. 使用 `git diff HEAD~1` 獲取變更內容
2. 分析變更類型 (例如：修改 I2C address)
3. 根據「對應範例」提供具體的 [Test Log] 建議
4. 提供可執行的驗證命令範例
```

---

## 故障排除 (Troubleshooting)

| 問題 | 解決方案 |
|------|----------|
| 無法判斷平台 | 檢查 remote URL 或請使用者明確指定 |
| Type 不在列表中 | 檢查是否為自訂 type，若合理則給予 WARNING |
| 無法解析 commit message | 檢查格式是否正確，是否包含必要的空行 |
| Test Log 難以建議 | 從 diff 分析變更的檔案與函數，推測測試方式 |

---

## 限制與注意事項 (Limitations)

1. **無法判斷語意正確性**：只能檢查格式與完整性，無法判斷技術描述是否正確
2. **JIRA 編號格式多樣**：不同專案可能有不同的 JIRA 格式，需要調整正則表達式
3. **diff 分析局限**：複雜的變更可能難以自動推測 Test Log 內容
4. **語言限制**：目前主要支援繁體中文與英文

---

## 版本歷史 (Changelog)

- **v1.0.0** (2026-02-26): 初始版本
  - 支援 Meta oBMC 與 LF oBMC 雙平台規則
  - 提供詳細的合規性檢查
  - 根據 git diff 提供補全建議
