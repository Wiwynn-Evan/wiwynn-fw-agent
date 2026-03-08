---
name: fw-pr-reviewer
description: '審查韌體 PR 的程式碼品質，根據 7 個維度（Coding Style、Error Handling、Memory Safety、Commit Message、Platform Isolation、邏輯正確性、測試覆蓋）給出 APPROVE 或 REQUEST_CHANGES 判定，並產出結構化的 review 結果讓 fw-code-writer 可自動修正。適用於 Meta oBMC (OpenBMC) 與 OpenBIC (Zephyr) 韌體專案。'
license: MIT
version: 1.0.0
---

# fw-pr-reviewer — 韌體 PR 審查 Skill

## 概述

本 Skill 負責對韌體 Pull Request 進行系統化的程式碼審查，涵蓋 **七大審查維度**，最終給出明確的 **APPROVE** 或 **REQUEST_CHANGES** 判定。

**設計目標**：
- 所有判定基於**具體規則**，不含主觀評價
- REQUEST_CHANGES 輸出結構化格式，讓 `fw-code-writer` Skill 可自動解析並修正
- 支援兩大韌體平台：**Meta oBMC**（OpenBMC Linux / AST2600）與 **OpenBIC**（Zephyr / AST1030）
- 與 `/fw-dev` command 整合，形成 Review Loop 直到 APPROVE

**不在本 Skill 職責範圍內**：
- 程式碼撰寫（由 `fw-code-writer` 負責）
- JIRA 分析（由 `jira-deep-analysis` 負責）
- 程式碼搜尋與修改方案（由 `fw-code-researcher` 負責）

---

## 輸入（PR diff + commit messages）

本 Skill 接收以下資訊進行審查：

### 必要輸入

```yaml
pr_diff: |
  # unified diff 格式的 PR 變更內容
  # 包含所有修改的檔案及其 diff hunks

commit_messages: |
  # PR 中所有 commit 的 message 列表

target_platform: "obmc" | "openbic"
  # 目標平台，影響 coding style 和 naming convention 檢查規則

target_repo: "facebook/openbmc" | "facebook/OpenBIC" | ...
  # 目標 repository
```

### 選擇性輸入

```yaml
jira_issue: "YV4T1M-xxxx" | "GC2-xxxx" | null
  # 關聯的 JIRA issue（用於維度 6: 邏輯正確性檢查）

issue_description: |
  # JIRA / GitHub Issue 的需求描述（用於驗證修改是否正確解決問題）

test_log: |
  # 測試日誌（用於維度 7: 測試覆蓋檢查）
```

---

## 七大審查維度

### 維度 1: Coding Style 合規

檢查程式碼風格是否符合平台慣例。

#### oBMC (OpenBMC) 規則

| 檢查項目 | 規則 | 範例 |
|---------|------|------|
| **縮排** | 4-space indent（禁止 tab） | `if (ret < 0) {` |
| **命名慣例** | PAL API 函式使用 `pal_xxx` 命名 | `pal_get_sensor_reading()` |
| **Header Guard** | `#ifndef / #define / #endif` 或 `#pragma once` | `#ifndef __PAL_H__` |
| **大括號** | 函式定義的 `{` 放新行，`if/for/while` 的 `{` 同行 | K&R style |
| **行寬** | 每行不超過 80 字元（建議），120 字元（硬限） | — |
| **檔案位置** | 平台程式碼在 `meta-facebook/meta-{platform}/` 下 | `meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c` |

#### OpenBIC (Zephyr) 規則

| 檢查項目 | 規則 | 範例 |
|---------|------|------|
| **縮排** | 4-space indent（禁止 tab） | `if (ret < 0) {` |
| **命名慣例** | 平台函式使用 `plat_xxx` 命名 | `plat_sensor_init()`, `plat_class_init()` |
| **Header Guard** | `#ifndef / #define / #endif` | `#ifndef PLAT_CLASS_H` |
| **檔案位置** | 平台程式碼在 `src/platform/{platform}/` 下 | `src/platform/gc2-es/plat_class.c` |
| **Common 引用** | 引用 `common/` 的 header 使用正確路徑 | `#include "util_worker.h"` |

#### 共通規則

- 變數命名：`snake_case`（C 韌體慣例）
- 常數 / Macro：`UPPER_SNAKE_CASE`
- struct 命名：`snake_case_t`（帶 `_t` 後綴）
- 禁止 magic number：必須使用 `#define` 或 `enum`

---

### 維度 2: Error Handling

檢查所有函式呼叫是否有適當的錯誤處理。

#### 必檢規則

| 檢查項目 | 規則 | 嚴重程度 |
|---------|------|---------|
| **返回值檢查** | 所有可能失敗的函式呼叫必須檢查回傳值 | Critical |
| **`if (ret < 0)` pattern** | 使用 `if (ret < 0)` 或 `if (ret != 0)` 檢查錯誤 | Critical |
| **Error Log** | 錯誤路徑必須有 log 輸出 | Critical |
| **oBMC Log 函式** | 使用 `syslog(LOG_ERR, ...)` 記錄錯誤 | Major |
| **OpenBIC Log 函式** | 使用 `LOG_ERR(...)` / `LOG_WRN(...)` 記錯誤 | Major |
| **每個 return path 都要 log** | 函式中所有錯誤回傳路徑都必須有對應的 log | Critical |
| **資源清理** | 錯誤路徑中必須釋放已取得的資源（fd, memory） | Critical |

#### 常見違規範例

```c
// ❌ BAD — 缺少 error handling 和 error log
ret = pal_get_sensor_reading(snr_num, &value);
use_value(value);

// ✅ GOOD — 完整的 error handling
ret = pal_get_sensor_reading(snr_num, &value);
if (ret < 0) {
    syslog(LOG_ERR, "%s(): Failed to get sensor %d reading, ret=%d",
           __func__, snr_num, ret);
    return ret;
}
```

---

### 維度 3: Memory Safety

檢查記憶體操作的安全性。

#### 必檢規則

| 檢查項目 | 規則 | 嚴重程度 |
|---------|------|---------|
| **malloc/free 配對** | 每個 `malloc` 必須有對應的 `free`，包含所有 error path | Critical |
| **Buffer Overflow** | 使用 `strncpy` 而非 `strcpy`，使用 `snprintf` 而非 `sprintf` | Critical |
| **Pointer Null Check** | 解引用前必須檢查 pointer 是否為 NULL | Critical |
| **Array Bounds** | 陣列索引必須做邊界檢查 | Critical |
| **Stack Buffer Size** | 避免在 stack 上宣告過大的 buffer（>4KB 應用 malloc） | Major |
| **Use-After-Free** | 確保 `free()` 後不再使用該 pointer | Critical |
| **Double Free** | 確保不會重複 `free()` 同一塊記憶體 | Critical |

#### 常見違規範例

```c
// ❌ BAD — buffer overflow 風險
char buf[64];
sprintf(buf, "sensor_%d_value_%s", snr_num, long_string);

// ✅ GOOD — 使用 snprintf 防止 overflow
char buf[64];
snprintf(buf, sizeof(buf), "sensor_%d_value_%s", snr_num, long_string);

// ❌ BAD — 未檢查 malloc 回傳值
char *data = malloc(size);
memcpy(data, src, size);

// ✅ GOOD — null check + error path
char *data = malloc(size);
if (data == NULL) {
    syslog(LOG_ERR, "%s(): malloc(%zu) failed", __func__, size);
    return -ENOMEM;
}
memcpy(data, src, size);
```

---

### 維度 4: Commit Message 品質

引用 `commit-message-reviewer` Skill 的規則進行檢查。

#### 平台偵測

```bash
# 自動偵測適用的 commit message 規則
if [[ $repo_url == *"github.com"* ]]; then
  RULE="Meta oBMC"     # GitHub → Meta oBMC 規則
elif [[ $repo_url == *"gerrit"* ]]; then
  RULE="LF oBMC"       # Gerrit → LF oBMC 規則
fi
```

#### Meta oBMC (GitHub) 規則摘要

| 檢查項目 | 規則 | 嚴重程度 |
|---------|------|---------|
| **Platform 前綴** | Subject 必須以 `<platform>:` 開頭 | Major |
| **Body 結構** | Feature 需包含 `[Task Description]`, `[Motivation]`, `[Design]`, `[Test Log]` | Major |
| **JIRA 關聯** | `[Task Description]` 中應包含 JIRA number | Minor |
| **Test Log** | 必須包含 `[Test Log]` 區段和實際測試結果 | Major |
| **AI Agent 標記** | 若 PR 由 AI Agent 建立，commit body 必須包含 `[AI Agent]` 區段，且 PR title 必須以 `(Agent)` 結尾 | Major |

#### LF oBMC (Gerrit) 規則摘要

| 檢查項目 | 規則 | 嚴重程度 |
|---------|------|---------|
| **Conventional Commits** | `<type>(<scope>): <subject>` 格式 | Major |
| **標題長度** | Subject <= 50 字元 | Minor |
| **祈使句動詞** | 使用 Add/Fix/Update（非 Added/Fixed） | Minor |
| **Body 說明** | 複雜變更必須有 body 說明 "為什麼" | Major |
| **原子性** | 一個 commit 只做一件事 | Major |

> 詳細規則請參考 `commit-message-reviewer` Skill。

---

### 維度 5: Platform Isolation

確認 PR 的修改範圍在正確的平台 sublayer 內，不應影響到其他平台的程式碼。

#### Meta oBMC sublayer 架構

```
facebook/openbmc/
├── common/                                    ← 跨平台共用
├── meta-facebook/
│   ├── meta-grandcanyon/                      ← GC2 (Grand Canyon 2)
│   │   └── recipes-grandcanyon/
│   │       └── plat-libs/files/pal/pal.c      ← GC2 的 PAL 實作
│   ├── meta-yosemite4/                        ← YV4 (Yosemite V4)
│   │   └── recipes-yosemite4/
│   │       └── plat-libs/files/pal/pal.c      ← YV4 的 PAL 實作
│   └── meta-{other-platform}/
└── ...
```

#### OpenBIC 平台結構

```
OpenBIC/
├── common/
│   ├── lib/        → util_worker, libutil (跨平台工具庫)
│   ├── service/    → ipmb, ipmi, mctp, pldm (服務層)
│   └── dev/        → fru 等 (設備抽象)
├── src/platform/
│   ├── gc2-es/
│   │   ├── plat_class.c         ← 平台識別 / sensor / ADC config
│   │   ├── plat_sensor_table.c  ← sensor 定義表
│   │   ├── plat_hook.c          ← hook functions
│   │   └── plat_ipmi.c          ← IPMI command handlers
│   └── {other-platform}/
└── ...
```

#### 檢查規則

| 檢查項目 | 規則 | 嚴重程度 |
|---------|------|---------|
| **跨平台汙染** | PR 不應修改非目標平台的 `meta-{platform}/` 目錄 | Critical |
| **Common 修改審慎** | 修改 `common/` 目錄需特別審查影響範圍 | Major |
| **正確的 sublayer** | 修改在正確的 `meta-facebook/meta-{platform}/` 或 `src/platform/{platform}/` 下 | Critical |
| **不影響其他平台** | 確認 `common/` 修改不會影響其他平台的行為 | Critical |

#### 常見違規

- PR 目標是 `yosemite4`，但修改了 `meta-grandcanyon/` 下的檔案
- 修改 `common/lib/` 的函式但未確認對其他平台的副作用
- OpenBIC PR 修改了非目標平台的 `src/platform/{other}/` 檔案

---

### 維度 6: 邏輯正確性

根據 JIRA/Issue 描述的需求，驗證 PR 修改邏輯是否正確解決問題。

#### 檢查規則

| 檢查項目 | 規則 | 嚴重程度 |
|---------|------|---------|
| **需求對應** | 修改內容必須與 JIRA/Issue 描述的問題對應 | Critical |
| **完整性** | 修改是否涵蓋所有需要變更的地方 | Major |
| **副作用** | 修改是否引入新的問題（race condition、deadlock 等） | Critical |
| **邊界條件** | 特殊值（0, -1, MAX, NULL）是否正確處理 | Major |
| **數值正確性** | sensor threshold、scaling factor、GPIO pin 等數值是否正確 | Critical |
| **Register 操作** | read-modify-write 是否正確，bit mask 是否正確 | Critical |
| **狀態機** | 狀態轉換是否完整，是否有遺漏的 transition | Major |

#### 審查方式

1. 閱讀 JIRA/Issue 描述，理解需求和問題根因
2. 逐檔案審查 diff，確認修改邏輯是否正確解決問題
3. 檢查是否有遺漏的修改（如：修改了 sensor table 但忘了改 threshold）
4. 驗證數值計算邏輯（如：溫度轉換公式、電壓 scaling）

---

### 維度 7: 測試覆蓋

檢查 PR 是否有對應的測試或測試日誌。

#### 檢查規則

| 檢查項目 | 規則 | 嚴重程度 |
|---------|------|---------|
| **Test Log 存在** | Commit message 或 PR description 中必須包含 test log | Major |
| **Test 完整性** | Test log 必須覆蓋修改的功能 | Major |
| **Test Case** | 若有 test framework，應有對應的 test case 更新 | Minor |
| **負面測試** | 應包含 error case 的測試結果 | Minor |
| **實機驗證** | 韌體變更建議包含實機測試結果 | Major |

#### 可接受的測試形式

- `[Test Log]` 區段中的終端機輸出
- 實機測試截圖或 log
- 單元測試結果（若有 test framework）
- Code review 中的邏輯分析（僅適用於簡單變更）

---

## 審查流程

```
┌─────────────────────────────────────────────┐
│              輸入 PR diff + commits          │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Step 1: 偵測平台（oBMC / OpenBIC / LF）     │
│  → 根據 repo URL 和檔案路徑判斷             │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Step 2: 逐維度審查                          │
│  → 依序檢查 7 個維度                         │
│  → 每個維度記錄 findings                     │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Step 3: 分類 findings                       │
│  → Critical / Major / Minor                 │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Step 4: 判定                                │
│  → 有 Critical/Major → REQUEST_CHANGES      │
│  → 僅 Minor 或無 → APPROVE                  │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Step 5: 產出結構化審查結果                   │
│  → APPROVE 模板或 REQUEST_CHANGES 模板       │
└─────────────────────────────────────────────┘
```

---

## 判定標準

### APPROVE 條件

所有以下條件**同時成立**時，判定為 APPROVE：

1. **七大維度全部通過**：沒有 Critical 或 Major 等級的問題
2. **僅有 Minor suggestions**（不影響功能、安全性、正確性）
3. Minor suggestions 必須**全部列出**，不可隱瞞

> ⚠️ 即使判定 APPROVE，也必須列出所有 Minor suggestions，讓開發者知道可改進之處。

### REQUEST_CHANGES 條件

以下**任一條件成立**時，判定為 REQUEST_CHANGES：

1. 任何 **Critical** 等級的問題（Error Handling 缺失、Memory Safety 問題、邏輯錯誤、Platform Isolation 違規）
2. 任何 **Major** 等級的問題（Coding Style 嚴重違規、Commit Message 缺少必要結構、測試缺失）
3. 多個 Minor 問題累積，顯示整體品質不足

### 嚴重程度定義

| 等級 | 定義 | 影響 |
|------|------|------|
| **Critical** | 可能導致系統崩潰、資料損壞、安全漏洞 | 必須修正，阻擋 merge |
| **Major** | 違反團隊規範、可能導致維護困難或隱性 bug | 必須修正，阻擋 merge |
| **Minor** | 風格建議、可讀性改進、非必要的最佳實踐 | 建議修正，不阻擋 merge |

---

## 輸出格式

### APPROVE 輸出模板

```markdown
## APPROVE

所有審查維度通過。

### 審查摘要
| 維度 | 結果 | 備注 |
|------|------|------|
| Coding Style 合規 | ✅ Pass | 符合 {platform} 命名慣例與縮排規則 |
| Error Handling | ✅ Pass | 所有函式呼叫有完整的錯誤處理 |
| Memory Safety | ✅ Pass | 無 buffer overflow / null deref 風險 |
| Commit Message 品質 | ✅ Pass | 符合 {Meta oBMC / LF oBMC} 規則 |
| Platform Isolation | ✅ Pass | 修改範圍正確，未影響其他平台 |
| 邏輯正確性 | ✅ Pass | 修改邏輯正確解決 {JIRA} 描述的問題 |
| 測試覆蓋 | ✅ Pass | 包含完整的 [Test Log] |

### Minor Suggestions (非阻擋)
- [ ] `path/to/file.c:42` — 建議將 magic number `0x1F` 改為命名常數
- [ ] `path/to/file.c:87` — 可考慮提取重複的 error handling 邏輯為 helper function
```

### REQUEST_CHANGES 輸出模板

此模板的結構化格式設計讓 `fw-code-writer` Skill 可自動解析每個 Issue 並逐一修正。

```markdown
## REQUEST_CHANGES

共發現 {N} 個問題需要修正（{n_critical} Critical, {n_major} Major, {n_minor} Minor）。

### Issue 1: [Error Handling] [嚴重程度: Critical]
- 檔案: `meta-facebook/meta-yosemite4/recipes-yosemite4/plat-libs/files/pal/pal.c:1234`
- 問題: `pal_get_sensor_reading()` 呼叫缺少 error handling，若讀取失敗會使用未初始化的 `value`
- 建議修改:
  ```diff
  -  ret = pal_get_sensor_reading(snr_num, &value);
  -  use_value(value);
  +  ret = pal_get_sensor_reading(snr_num, &value);
  +  if (ret < 0) {
  +      syslog(LOG_ERR, "%s(): Failed to get sensor %d reading, ret=%d",
  +             __func__, snr_num, ret);
  +      return ret;
  +  }
  +  use_value(value);
  ```

### Issue 2: [Memory Safety] [嚴重程度: Critical]
- 檔案: `src/platform/gc2-es/plat_class.c:567`
- 問題: 使用 `sprintf` 寫入固定大小 buffer，存在 buffer overflow 風險
- 建議修改:
  ```diff
  -  sprintf(buf, "sensor_%d_%s", snr_num, name);
  +  snprintf(buf, sizeof(buf), "sensor_%d_%s", snr_num, name);
  ```

### Issue 3: [Platform Isolation] [嚴重程度: Critical]
- 檔案: `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c:89`
- 問題: 此 PR 目標為 yosemite4 平台，但修改了 grandcanyon 的 `pal.c`，違反 Platform Isolation
- 建議修改:
  移除對 `meta-grandcanyon/` 的修改，或在 PR description 說明為何需要跨平台修改。

### Issue 4: [Commit Message 品質] [嚴重程度: Major]
- 檔案: (commit message)
- 問題: Commit message 缺少 `[Test Log]` 區段，Meta oBMC (GitHub) 規則要求 feature commit 包含測試日誌
- 建議修改:
  在 commit message body 中新增 `[Test Log]` 區段，附上實機測試結果。

### 審查摘要
| 維度 | 結果 | Issues |
|------|------|--------|
| Coding Style 合規 | ✅ Pass | — |
| Error Handling | ❌ Fail | Issue 1 |
| Memory Safety | ❌ Fail | Issue 2 |
| Commit Message 品質 | ⚠️ Fail | Issue 4 |
| Platform Isolation | ❌ Fail | Issue 3 |
| 邏輯正確性 | ✅ Pass | — |
| 測試覆蓋 | ⚠️ Fail | Issue 4 |
```

---

## Review Loop 整合說明

本 Skill 設計為 `/fw-dev` command 工作流程中的**品質閘門**，與其他 Skill 形成自動化 Review Loop：

### 工作流程

```
┌──────────────────────────────────────────────────────────────┐
│                       /fw-dev Command                        │
│                                                              │
│  1. jira-deep-analysis  → 分析 JIRA issue                   │
│  2. fw-code-researcher  → 搜尋程式碼、制定修改方案            │
│  3. fw-code-writer      → 撰寫程式碼 (unified diff)          │
│  4. fw-commit-generator → 產生 commit message                │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │                    Review Loop                         │   │
│  │                                                       │   │
│  │  5. fw-pr-reviewer   → 審查 diff + commit message     │   │
│  │         │                                             │   │
│  │         ├── APPROVE → ✅ 結束，可提交 PR               │   │
│  │         │                                             │   │
│  │         └── REQUEST_CHANGES                           │   │
│  │              │                                        │   │
│  │              ▼                                        │   │
│  │         6. 將結構化 issues 傳給 fw-code-writer        │   │
│  │              │                                        │   │
│  │              ▼                                        │   │
│  │         7. fw-code-writer 修正 → 回到 Step 5          │   │
│  │              (循環直到 APPROVE)                        │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  8. 最終 APPROVE 後，fw-commit-generator 產生最終 commit     │
└──────────────────────────────────────────────────────────────┘
```

### Review Loop 機制

1. **自動觸發**：`/fw-dev` command 在 `fw-code-writer` 產生 diff 後，自動呼叫 `fw-pr-reviewer` 審查
2. **REQUEST_CHANGES 自動修正**：若判定 REQUEST_CHANGES，`/fw-dev` 會將結構化的 Issue 清單傳給 `fw-code-writer`，由其逐一修正
3. **迭代審查**：修正後的 diff 再次經過 `fw-pr-reviewer` 審查，循環直到 APPROVE
4. **終止條件**：`fw-pr-reviewer` 給出 APPROVE 判定
5. **防止無限循環**：建議設定最大迭代次數（預設 3 次），超過時停止並回報剩餘 issues

### fw-code-writer 整合格式

`fw-code-writer` 解析 REQUEST_CHANGES 輸出的方式：

1. 提取每個 `### Issue N:` 區塊
2. 從 `- 檔案:` 取得檔案路徑和行號
3. 從 `- 問題:` 理解需要修正的內容
4. 從 `- 建議修改:` 的 diff 區塊取得具體修改建議
5. 依序修正每個 issue，產出更新後的 unified diff

---

## 版本歷史

| 版本 | 日期 | 變更說明 |
|------|------|---------|
| 1.0.0 | 2026-03-07 | 初始版本：七大審查維度、APPROVE / REQUEST_CHANGES 判定、Review Loop 整合 |
