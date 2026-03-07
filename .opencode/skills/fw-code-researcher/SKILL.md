---
name: fw-code-researcher
description: '接收 jira-deep-analysis 的分析報告，在 openbmc/OpenBIC repos 搜尋相關程式碼，定位目標檔案與函式，產出具體的修改方案（哪些檔案要改、怎麼改、改什麼）。支援 Meta oBMC sublayer 架構和 OpenBIC 平台程式碼研究。不負責 JIRA 解析（由 jira-deep-analysis 處理）也不負責撰寫程式碼（由 fw-code-writer 處理），僅產出結構化修改方案。'
license: MIT
version: 1.0.0
---

## 概述

`fw-code-researcher` 是 BMC/BIC 韌體開發工作流程的**中間層 Skill**，銜接 `jira-deep-analysis`（問題分析）和 `fw-code-writer`（程式碼撰寫）之間的程式碼研究階段。

**職責範圍**：
- **接收** `jira-deep-analysis` 產出的分析報告（包含問題分類、Root Cause、受影響的 repos/檔案）
- **搜尋** `facebook/openbmc` 和 `facebook/OpenBIC` 中的相關程式碼
- **定位** 需要修改的具體檔案、函式、行號
- **研究** 目標平台既有的 pattern（同類功能的實作方式）
- **產出** 結構化的修改方案（檔案清單、diff-like 修改內容、修改理由、風險評估）

**不負責**：
- JIRA Issue 解析（由 `jira-deep-analysis` 處理）
- 實際程式碼撰寫（由 `fw-code-writer` 處理）
- Commit message 生成（由 `fw-commit-generator` 處理）

---

## 輸入格式（來自 jira-deep-analysis 的分析報告）

本 Skill 接收 `jira-deep-analysis` 產出的分析報告作為輸入。報告格式因分類不同而異：

### BUG 報告輸入

```markdown
# {JIRA-KEY} Root Cause Analysis
**分類**: BUG
**Platform**: {platform-name}（如 grandcanyon, yosemite4, gc2-es）
**Repository**: {repo}（如 facebook/openbmc, facebook/OpenBIC）

## Root Cause
[問題根因描述]

## 受影響檔案
[已知受影響的檔案路徑、函式名]

## 建議修復方向
[初步的修復建議]
```

### FEATURE_REQUEST 報告輸入

```markdown
# {JIRA-KEY} 功能實作分析報告
**分類**: FEATURE_REQUEST
**Platform**: {platform-name}
**Repository**: {repo}

## 問題描述
[功能需求描述]

## Pattern 分析
[目標平台找到的同類功能既有 pattern]

## 實作計畫
[初步的實作方向]

## 修改檔案清單
| 檔案 | 變更類型 | 說明 |
|------|---------|------|
```

> **重要**：不需要自行解析 JIRA Issue，直接使用報告中的結構化資訊開始程式碼搜尋。

---

## 流程

### Step 1: 解析分析報告

從 `jira-deep-analysis` 的分析報告中提取關鍵資訊：

1. **判斷 Repository**：確認目標是 `facebook/openbmc`（oBMC Linux）還是 `facebook/OpenBIC`（Zephyr BIC）
2. **判斷平台**：提取平台名稱（grandcanyon, yosemite4, gc2-es 等），確定搜尋範圍
3. **提取關鍵字**：從報告中提取函式名、變數名、錯誤訊息、PAL API 名稱等搜尋關鍵字
4. **確認問題分類**：BUG（修復既有問題）或 FEATURE_REQUEST（新增功能），決定後續搜尋策略

**BUG 類型** → 聚焦定位 Root Cause 涉及的程式碼位置
**FEATURE_REQUEST 類型** → 聚焦搜尋同平台既有的同類功能 pattern

---

### Step 2: 定位目標程式碼（三步驟搜尋）

使用三個 Python scripts 的 **search → grep → fetch** 工作流程，逐步縮小搜尋範圍：

#### Step A: search_github.py — 找到目標檔案

根據報告中的關鍵字搜尋目標 repo，找出相關檔案清單。

```bash
# oBMC: 搜尋特定平台目錄下的 PAL 函式
python search_github.py "pal_get_fru_health" --repos facebook/openbmc --ext c --text-matches

# oBMC: 加路徑篩選避免搜到其他平台
python search_github.py "pal_get_fru_health path:meta-grandcanyon" --repos facebook/openbmc

# OpenBIC: 搜尋平台程式碼
python search_github.py "plat_class" --repos facebook/OpenBIC --ext c

# OpenBIC: 搜尋 common/ 共用模組
python search_github.py "util_worker" --repos facebook/OpenBIC --ext c --ext h
```

**輸出**：檔案路徑清單（repo, path, name, url），搭配 `--text-matches` 可看到匹配的程式碼片段。

**策略**：
- 使用 `--text-matches` 在大量結果中快速判斷哪個檔案是目標
- oBMC 搜尋時加 `path:meta-{platform}` 篩選特定平台
- OpenBIC 搜尋時區分 `src/platform/{platform}/` 和 `common/`

#### Step B: grep_github_file.py — 定位行號

找到目標檔案後，在檔案內搜尋精確位置（尤其 4000+ 行的大型 PAL 檔案）。

```bash
# 在 oBMC PAL 大檔案中搜尋函式定義
python grep_github_file.py facebook/openbmc meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c "pal_get_fru_health"

# 在 OpenBIC 搜尋 device init 邏輯
python grep_github_file.py facebook/OpenBIC src/platform/gc2-es/plat_class.c "init_hsc_module|init_vr_module" --context 5

# 搜尋 common/ 的 shared functions
python grep_github_file.py facebook/OpenBIC common/lib/util_worker.c "util_init_worker" --context 3
```

**輸出**：匹配行號、行內容、上下文（`{ "match_count", "matches": [{ "line", "content", "context" }] }`）。

> **注意**：pattern 使用 **Python regex** 語法。用 `init_hsc|init_vr` 而非 `init_hsc\|init_vr`；特殊字元如 `(`、`)` 需用 `\` 跳脫。

#### Step C: fetch_github_file.py — 讀取完整函式

根據 grep 定位的行號，取得完整的函式實作和上下文。

```bash
# 取得 oBMC PAL 函式完整內容（±30 行）
python fetch_github_file.py facebook/openbmc meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c 2651 --context 30

# 取得 OpenBIC init 函式
python fetch_github_file.py facebook/OpenBIC src/platform/gc2-es/plat_class.c 150 --context 40

# 取得 common/ 共用函式
python fetch_github_file.py facebook/OpenBIC common/service/ipmb/ipmb.c 200 --context 20

# 指定特定 branch（如需參考特定 PR 或 WIP branch）
python fetch_github_file.py facebook/OpenBIC src/platform/gc2-es/plat_class.c 100 --context 20 --ref Jim/fbgc2-es/some-branch
```

**輸出**：`{ "repo", "path", "start_line", "end_line", "total_lines", "content": "..." }`

**典型完整流程範例**：

```bash
# 1. 搜尋找到 pal.c
python search_github.py "pal_get_fru_health" --repos facebook/openbmc --text-matches
# → 找到 meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c

# 2. 定位行號
python grep_github_file.py facebook/openbmc meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c "pal_get_fru_health"
# → line 2651

# 3. 取得完整函式
python fetch_github_file.py facebook/openbmc meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c 2651 --context 30
# → 完整函式實作內容
```

---

### Step 3: 搜尋參考 Pattern

確定修改策略前，搜尋目標平台和其他平台的同類功能作為參考：

#### BUG 修復時

1. **搜尋同一函式在其他平台的實作**：確認 bug 是否為平台特定或跨平台共通問題
2. **搜尋 common/ 對應模組**：確認 bug 是否源於 shared function
3. **搜尋 git history**（如有對應 commit reference）：了解函式的演變脈絡

```bash
# 比對其他平台的同名函式實作
python search_github.py "pal_get_fru_health" --repos facebook/openbmc --text-matches
# → 比較 meta-grandcanyon/ 和 meta-yosemite4/ 的實作差異
```

#### FEATURE_REQUEST 時

1. **同平台 Pattern 優先**：先搜尋目標平台自身目錄中既有的同類功能
2. **跨平台參考**：目標平台無匹配時，才參考其他平台的實作
3. **交叉驗證**：device-specific 細節（PMBus commands、register offsets）必須查證，不可直接照搬

```bash
# 同平台優先：gc2-es 已有哪些 init 函式？
python grep_github_file.py facebook/OpenBIC src/platform/gc2-es/plat_class.c "init_.*_module" --context 5

# 跨平台參考：其他平台如何實作類似功能？
python search_github.py "init_hsc_module" --repos facebook/OpenBIC --text-matches
```

---

### Step 4: 產出修改方案

綜合 Step 1-3 的研究結果，產出結構化的修改方案。方案必須包含完整資訊，使 `fw-code-writer` 可以直接據此撰寫程式碼。

**產出原則**：
- 每個修改項目必須有**完整路徑**、**具體修改內容**（diff-like）、**修改理由**
- 若涉及多個檔案，按**依賴順序**排列（header → implementation → caller）
- 標注**參考來源**（哪個平台的哪個函式作為 pattern 參考）
- 評估**潛在風險**和建議的測試方式

---

## 工具使用指南（Python scripts）

### Scripts 位置

所有 scripts 位於 `skills/jira-deep-analysis/scripts/` 目錄（與 `jira-deep-analysis` Skill 共用）：

```
skills/jira-deep-analysis/scripts/
├── search_github.py      ← GitHub Code Search API
├── grep_github_file.py   ← 檔案內 pattern 搜尋
├── fetch_github_file.py  ← 取得檔案程式碼片段
├── fetch_jira.py         ← JIRA API（本 Skill 不使用）
├── .env.example           ← 環境變數範本
└── .env                   ← 實際環境變數（不進 git）
```

### 環境設定

Scripts 需要 `.env` 中的 `GITHUB_TOKEN`。在 `scripts/` 目錄建立 `.env`：

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
```

> Scripts 使用 `os.path.dirname(os.path.abspath(__file__))` 讀取 `.env`，路徑是相對的，無需額外設定。

### search_github.py 參數速查

| 參數 | 說明 | 範例 |
|------|------|------|
| `query` (positional) | 搜尋關鍵字 | `"pal_get_fru_health"` |
| `--repos` | 指定 repo（可多個） | `--repos facebook/openbmc facebook/OpenBIC` |
| `--org` | 搜尋整個 org | `--org openbmc` |
| `--ext` | 篩選副檔名 | `--ext c --ext h` |
| `--per-page` | 每頁結果數 | `--per-page 20` |
| `--text-matches` | 回傳匹配程式碼片段 | `--text-matches` |

**路徑篩選技巧**：query 本身可包含 `path:` qualifier，例如：
```bash
python search_github.py "pal_sensor_read path:meta-grandcanyon" --repos facebook/openbmc
```

### grep_github_file.py 參數速查

| 參數 | 說明 | 範例 |
|------|------|------|
| `repo` (positional) | GitHub repo | `facebook/openbmc` |
| `path` (positional) | 檔案路徑 | `meta-facebook/.../pal.c` |
| `pattern` (positional) | Python regex pattern | `"pal_get_fru_health"` |
| `--context` | 上下文行數 | `--context 5` |
| `--max-matches` | 最大匹配數 | `--max-matches 20` |
| `--ref` | branch/tag/commit | `--ref some-branch` |

> **重要**：pattern 使用 Python regex 語法，非 shell glob。用 `func_a|func_b` 而非 `func_a\|func_b`。

### fetch_github_file.py 參數速查

| 參數 | 說明 | 範例 |
|------|------|------|
| `repo` (positional) | GitHub repo | `facebook/openbmc` |
| `path` (positional) | 檔案路徑 | `meta-facebook/.../pal.c` |
| `line` (positional) | 中心行號 | `2651` |
| `--context` | 前後行數（預設 10） | `--context 30` |
| `--ref` | branch/tag/commit | `--ref main` |

---

## Domain Knowledge

### Meta oBMC Sublayer 架構（facebook/openbmc）

Meta 的 `facebook/openbmc` 使用 sublayer 架構，每個平台有獨立的 `meta-facebook/meta-{platform}/` 目錄：

```
facebook/openbmc/
├── common/                                    ← 跨平台共用
├── meta-facebook/
│   ├── meta-grandcanyon/                      ← GC2 (Grand Canyon 2)
│   │   └── recipes-grandcanyon/
│   │       └── plat-libs/files/pal/pal.c      ← GC2 的 PAL 實作（常 4000+ 行）
│   ├── meta-yosemite4/                        ← YV4 (Yosemite V4)
│   │   └── recipes-yosemite4/
│   │       └── plat-libs/files/pal/pal.c      ← YV4 的 PAL 實作
│   └── meta-{other-platform}/
└── ...
```

**搜尋要點**：
- 搜尋時加路徑篩選（如 `path:meta-grandcanyon`）避免搜到其他平台的同名檔案
- 每個平台的 `pal.c` 都非常大（4000+ 行），務必用 grep → fetch 工作流程定位
- PAL API 命名慣例：`pal_get_fru_health`, `pal_sensor_read`, `pal_get_platform_id` 等

### OpenBIC 平台架構（facebook/OpenBIC）

```
facebook/OpenBIC/
├── common/                            ← 跨平台共用模組
│   ├── lib/                           ← util_worker, libutil（工具庫）
│   ├── service/                       ← ipmb, ipmi, mctp, pldm（服務層）
│   └── dev/                           ← fru 等（設備抽象）
└── src/platform/
    ├── gc2-es/                        ← Grand Canyon 2 ES 平台
    │   ├── plat_class.c               ← platform identification, device init
    │   ├── plat_sensor_table.c        ← sensor definitions, VR/thermal/HSC
    │   ├── plat_hook.c                ← sensor read hooks, pre/post actions
    │   ├── plat_init.c                ← platform initialization sequence
    │   └── plat_ipmi.c                ← IPMI command handlers
    ├── op2-op/                        ← 其他平台
    └── {other-platform}/
```

#### common/ 目錄角色（非常重要）

`common/` 是跨平台共用程式碼的核心目錄：

```
common/
├── lib/        → util_worker, libutil（跨平台工具庫）
├── service/    → ipmb, ipmi, mctp, pldm（服務層）
└── dev/        → fru 等（設備抽象）
```

- 平台程式碼大量 `#include` common/ header 並直接呼叫其 functions
- 近期 refactor 趨勢：plat_class / plat_sensor / plat_sdr 常從 common/ 提取 shared functions
- **研究原則**：如果修改的函式邏輯看起來很 generic → **先檢查 common/ 的對應 module** 是否已有實作或需要 override

#### OpenBIC 關鍵檔案定位

| 檔案 | 功能定位 | 常見修改場景 |
|------|---------|-------------|
| `plat_class.c` | platform identification, device init/detection | 新增 device 偵測、module init、platform config |
| `plat_sensor_table.c` | sensor definitions, thresholds | 新增/修改 sensor 定義、threshold 調整 |
| `plat_hook.c` | sensor read hooks, pre/post actions | sensor 讀取前後處理、數值轉換 |
| `plat_init.c` | platform initialization sequence | 開機初始化順序、GPIO 設定 |
| `plat_ipmi.c` | IPMI command handlers | IPMI OEM command 新增/修改 |
| `plat_class.h` | enum, struct, function declarations | type 定義、function prototype |

#### PAL API 命名慣例（oBMC）

oBMC 的 Platform Abstraction Layer (PAL) API 使用 `pal_` 前綴：

| API Pattern | 用途 |
|-------------|------|
| `pal_get_fru_health` | FRU 健康狀態查詢 |
| `pal_sensor_read` | Sensor 讀取 |
| `pal_get_platform_id` | 平台識別 |
| `pal_set_key_value` | Key-value 持久化儲存 |
| `pal_get_fru_name` | FRU 名稱查詢 |
| `pal_is_fru_prsnt` | FRU 存在偵測 |

---

## 輸出格式

### 修改方案報告

本 Skill 的最終輸出是一份結構化修改方案，格式如下：

```markdown
# 修改方案：{JIRA-KEY}
**分析來源**: jira-deep-analysis 報告
**目標 Repository**: {repo}
**目標平台**: {platform}
**日期**: {YYYY-MM-DD}

## 摘要
[一段話描述需要做什麼修改、為什麼]

## 需修改的檔案清單

| # | 檔案路徑 | 變更類型 | 說明 |
|---|---------|---------|------|
| 1 | `src/platform/{platform}/plat_class.h` | 修改 | 新增 enum 定義 |
| 2 | `src/platform/{platform}/plat_class.c` | 修改 | 新增 detection function |
| 3 | `src/platform/{platform}/plat_sensor_table.c` | 修改 | 更新 sensor config |

## 各檔案具體修改

### 1. `src/platform/{platform}/plat_class.h`

**修改理由**：[為什麼需要修改此檔案]
**參考來源**：[參考了哪個平台/函式的 pattern，附路徑和行號]

```diff
 // 在既有的 enum 定義後新增
 enum {
     EXISTING_DEVICE_A = 0,
     EXISTING_DEVICE_B,
+    NEW_DEVICE_C,
     DEVICE_MAX,
 };

+// 新增 detection function declaration
+bool detect_new_device(void);
```

### 2. `src/platform/{platform}/plat_class.c`

**修改理由**：[為什麼需要修改此檔案]
**參考來源**：[參考 pattern 的來源，如 `gc2-es/plat_class.c:150 init_hsc_module()`]

```diff
+bool detect_new_device(void)
+{
+    // Implementation based on {reference_pattern}
+    // ...
+}

 void init_platform(void)
 {
     init_hsc_module();
     init_vr_module();
+    detect_new_device();
 }
```

## 修改依賴順序

1. 先修改 header（`.h`）— 定義 type 和 function declaration
2. 再修改 implementation（`.c`）— 實作函式
3. 最後修改 caller — 在 init 函式中呼叫

## 潛在風險

| 風險 | 影響 | 緩解方式 |
|------|------|---------|
| [風險描述] | [影響範圍] | [建議的緩解或測試方式] |

## 建議測試方式

- [ ] 編譯驗證：`bitbake {recipe}` / `west build -b ast1030_evb`
- [ ] 單元測試：[具體測試項目]
- [ ] 功能測試：[在實機或模擬環境驗證的步驟]
```

---

## 最佳實踐

### 搜尋策略

1. **先窄後寬**：先用精確的函式名搜尋，無結果再擴大搜尋範圍
2. **路徑篩選**：oBMC 搜尋務必加 `path:meta-{platform}` 避免搜到其他平台
3. **text-matches 先行**：用 `--text-matches` 快速篩選，再 grep → fetch 精確定位
4. **common/ 意識**：修改 OpenBIC 平台程式碼前，先確認 common/ 是否有對應的 shared function

### Pattern 研究

1. **同平台 Pattern 優先**：實作新功能時，優先搜尋目標平台自身的同類功能
2. **跨平台參考次之**：目標平台無匹配時，才參考其他平台
3. **不盲目照搬**：device-specific 細節（PMBus commands、register offsets、init sequences）必須交叉驗證，不同 device 的實作細節可能不同

### 修改方案品質

1. **完整路徑**：所有檔案必須包含完整的 repo 內相對路徑
2. **diff 格式**：使用標準 diff 格式（`+` 新增、`-` 刪除、空格不變）清楚表示修改內容
3. **參考溯源**：每個修改項目標注參考來源（平台/檔案/行號），使 reviewer 可以追溯
4. **風險評估**：誠實評估潛在風險，不隱藏不確定性
5. **依賴順序**：多檔案修改時，按依賴順序排列（header → impl → caller）
6. **命名一致**：新增的 function/variable/macro 命名須符合目標平台既有慣例

### 避免的常見錯誤

1. ❌ 搜到其他平台的同名函式，誤認為目標平台的實作
2. ❌ 直接複製其他平台的 device-specific 實作，未驗證 IC datasheet
3. ❌ 忽略 common/ 已有的 shared function，在平台層重複實作
4. ❌ 修改 common/ 的 shared function 但未評估對其他平台的影響
5. ❌ PAL 大檔案（4000+ 行）未用 grep 定位就直接 fetch，浪費 API quota

---

## 版本歷史

| 版本 | 日期 | 變更說明 |
|------|------|---------|
| 1.0.0 | 2026-03-07 | 初版：建立 fw-code-researcher Skill，定義三步驟搜尋工作流程和修改方案輸出格式 |
