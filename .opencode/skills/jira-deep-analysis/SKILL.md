---
name: jira-deep-analysis
description: 'Deep-dive analysis for BMC/firmware issues using evidence-based investigation. Handles TWO platforms: (1) OpenBMC Linux ecosystem (phosphor-*, bmcweb, entity-manager, oBMC kernel) via JIRA-driven parallel agent search — produces full root cause analysis reports; (2) OpenBIC/Zephyr gc2-es Bridge IC firmware (AST1030/Arm Cortex-M) via GDB/west runtime debugging — handles sensor/VR/thermal/SMI/crash issues with common/ shared-code awareness. Auto-routes based on issue context. Use for: complex JIRA bugs, cross-repo investigation, gc2-es plat_class/plat_ipmi debugging, OpenBIC common/ dependency issues, firmware regression analysis, platform porting problems.'
license: MIT
version: 2.3.0-wiwynn
---

# BMC/韌體深度分析 Skill (雙平台路由)

## 概述

此 Skill 整合兩種韌體分析模式，自動根據問題脈絡路由至正確的分析流程：

| | Route A | Route B |
|---|---|---|
| **平台** | OpenBMC (oBMC Linux) | OpenBIC (gc2-es / Zephyr) |
| **架構** | Linux-based BMC | Zephyr RTOS Bridge IC |
| **SoC** | AST2600 | AST1030 (Arm Cortex-M) |
| **入口** | JIRA Issue 調查 | 執行期 GDB/west 除錯 |
| **工具** | grep/webfetch/agent 平行搜尋 | west debug / OpenOCD / GDB |
| **輸出** | 完整 .md 分析報告 | 結構化除錯建議 |

---

## Phase 0: 平台偵測 (Universal Intake Gate)

接收到問題後，**先偵測平台**，再進入對應流程：

### JIRA Key 平台對照表（最優先判斷）

| JIRA Key 前綴 | 平台 | Repository | 說明 |
|---|---|---|---|
| `GC20T5T7-` | Grand Canyon 2 (GC2) | `facebook/openbmc` `meta-facebook/meta-grandcanyon/` | GC2 oBMC Linux — **不是** GC (Grand Canyon 1) |
| `YV4T1M-` | Yosemite V4 (YV4) | `facebook/openbmc` `meta-facebook/meta-yosemite4/` | YV4 oBMC Linux |
| `GC2-` / `GC2ES-` | GC2 OpenBIC (gc2-es) | `facebook/OpenBIC` `meta-facebook/gc2-es/` | GC2 Bridge IC — Zephyr/AST1030 |

> **重要**：`GC20T5T7` 是 Grand Canyon **2** (GC2) 的 JIRA project，不是 Grand Canyon 1。Grand Canyon 1 已 EOL。判斷平台時以 JIRA Key 前綴為最高優先依據。

### Meta oBMC 平台 Sublayer 架構（Route A 必讀）

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

**搜尋策略**：當 JIRA 指向特定平台時，search_github 應加上路徑篩選（如 `path:meta-grandcanyon`）以避免搜到其他平台的同名檔案。

### → Route B 信號（偵測到任何一個即路由至 Route B）
- JIRA Key: `GC2-`, `GC2ES-` 等 OpenBIC 專用 project
- 關鍵字: `OpenBIC`, `gc2-es`, `AST1030`, `Zephyr`, `BIC`, `OpenOCD`, `west debug`
- 檔案路徑: `plat_class.c`, `plat_ipmi.c`, `common/lib/`, `common/service/`, `plat_init.c`
- 症狀: BIC firmware crash, sensor scaling wrong, SMI stuck-low, util_worker issue

### → Route A 信號（偵測到任何一個即路由至 Route A）
- JIRA Key: `GC20T5T7-`, `YV4T1M-` 等 oBMC Linux project
- 關鍵字: `oBMC`, `phosphor-*`, `entity-manager`, `bmcweb`, `openbmc/*`, `D-Bus`, `Redfish`
- 關鍵字: `AST2600`（無 OpenBIC 脈絡）, Linux BMC, JIRA investigation
- 症狀: BMC reset 失效, sensor daemon 掛掉, FRU 讀取問題, platform identification wrong
- 症狀: `front-paneld` 錯誤、`enclosure-util` 異常、`fru-util` 問題、PAL API 相關

### → Route G: GitHub Issue Mode（Wiwynn 擴充）

若輸入符合 **GitHub Issue URL 格式** `https://github.com/{owner}/{repo}/issues/{number}`，則啟動 GitHub Issue mode：

```bash
# 取得 GitHub Issue 完整資料（JSON 格式）
gh issue view {URL} --json title,body,labels,assignees,comments
```

**偵測邏輯**：
```
if input matches: https://github.com/{owner}/{repo}/issues/{number}
  → Route G: GitHub Issue mode
  → 使用 gh issue view {URL} --json title,body,labels,assignees,comments 取得 issue 資料
  → 提取: title, body, labels, assignees, comments
  → 繼續走 Route A 分析流程（以 GitHub Issue 資料取代 JIRA Issue 資料）
else if input matches JIRA key (ABC-123) or JIRA URL:
  → Route A / Route B（依 JIRA Key 前綴判斷，同上方邏輯）
```

**適用情境**：Wiwynn `gc2-bmc-collection-script` 等 GitHub private repo 的 issue 調查（`/fw-dev` slash command 接受 JIRA key 或 GitHub Issue URL）。

**注意**：Route G 取得 issue 資料後，平台路由（Route A vs Route B）仍依 issue 內容中的關鍵字判斷（如 labels、body 提及 OpenBIC/Zephyr 或 OpenBMC/Linux）。

---

### → 無法判斷時
詢問用戶：**「這個 issue 是在 OpenBIC (Zephyr, BIC firmware) 還是 OpenBMC (Linux, host BMC) 環境？」**

---

---

## ═══ ROUTE A: oBMC Linux 深度分析 ═══

> ⚠️ **Route A (oBMC Linux)**: 使用 OpenBMC repos 和 Linux kernel 工具。**不要**套用 GDB/Zephyr/OpenBIC patterns。

**核心精神**: 證據優先、平行搜尋、多維度驗證、資深工程師視角

```
Phase A-0: 理解 JIRA Issue    → Phase A-1: 平行搜尋 (4-6 agents)
         → Phase A-2: 證據整合 → Phase A-3: 根因分析
         → Phase A-4: 方案設計 → Phase A-5: 報告產出
```

---

### Phase A-0: 理解 JIRA Issue

```bash
webfetch(url="https://{jira-domain}/browse/{ISSUE-KEY}")
```

提取：Summary、Description、Affects Version、Components/Labels、Attachments、Comments

初步分類：`BUG_FIX` | `INVESTIGATION` | `PLATFORM_PORTING` | `FEATURE_REQUEST`

> **路由規則**：若分類為 `FEATURE_REQUEST` → 跳至 [Phase A-FR](#phase-a-fr-feature_request-工作流程)，不走 Phase A-1 ~ A-5。

---

### Phase A-FR: FEATURE_REQUEST 工作流程

> **適用時機**：JIRA Issue 分類為 `FEATURE_REQUEST`（新功能實作、新 device 支援、2nd source 替換等）時，**取代** Phase A-1 ~ A-5 使用此流程。

---

#### Rule FR-1: 同平台 Pattern 優先 (Same-Platform Pattern Priority)

實作新功能時，**首先搜尋 TARGET 平台自身目錄**中既有的同類功能實作，再參考其他平台。

**流程**：
1. 找出目標平台目錄（如 `src/platform/gc2-es/`）
2. 搜尋平台內既有的同類功能（sensor swap、module detection、device init）
3. 只有在目標平台**無**匹配 pattern 時，才參考其他平台（op2-op、yv4 等）

**具體範例（gc2-es 2nd source sensor）**：
新增 SQ52205 作為 INA233 的 2nd source 時，**先於**檢查 op2-op 或其他平台，搜尋 gc2-es 自己的 `plat_class.c`、`plat_sensor_table.c`、`plat_hook.c` 中既有的 device-swap pattern（如 HSC module: ADM1278/MP5990/LTC4282/LTC4286 在 `init_hsc_module()` 的 separate config tables 模式）。

---

#### Rule FR-2: 檔案組織一致性 (File Organization Consistency)

新功能的**偵測邏輯和初始化函式**應放在與目標平台既有同類功能相同的檔案中。

**流程**：找出目標平台類似功能（HSC detection、VR detection）放在哪個檔案，新功能跟隨。

**具體範例（gc2-es）**：
gc2-es 的 `init_hsc_module()` 和 `init_vr_module()` 都在 `plat_class.c`。新增 `detect_e1s_boot_drive_module_via_pmbus()` 時，正確位置是 `plat_class.c`（而非 `plat_sensor_table.c`）。同理，enum 定義放 `plat_class.h`，extern 宣告放 `plat_hook.h`。

---

#### Rule FR-3: 交叉驗證 Device 細節 (Cross-Reference Validation)

對 device-specific 細節（PMBus commands、register offsets、init sequences），需驗證 device 的實際 datasheet 或既有 driver code，**不可直接照搬參考平台的不同 device 實作**。

**具體範例（PMBus identification）**：
PMBus 的 `MFR_ID` (0x99)、`MFR_MODEL` (0x9A)、`MFR_REVISION` (0x9B) 服務不同目的。op2-op 用 `MFR_ID` 偵測 HSC device type；gc2-es SQ52205 用 `MFR_MODEL` 做字串比對（回傳 "SQ52205"）。需查 IC datasheet 確認哪個 command 適合偵測 device type，而非從參考平台複製。

---

#### FEATURE_REQUEST 報告範本

```markdown
# {JIRA-KEY} 功能實作分析報告
**JIRA Issue**: [{JIRA-KEY}]({JIRA-URL})
**分析日期**: {YYYY-MM-DD}
**分類**: FEATURE_REQUEST

## 問題描述
[從 JIRA 提取的功能需求描述]

## Pattern 分析
[在目標平台找到的同類功能既有 pattern，含檔案路徑、函式名、程式碼結構]

## 實作計畫
[根據 Pattern 分析，按順序列出需修改的檔案和具體變更]

## 修改檔案清單
| 檔案 | 變更類型 | 說明 |
|------|---------|------|
| `plat_class.h` | 新增 | enum + function declaration |

## 命名規範注意事項
[檢查既有 macro/variable 是否含 vendor-specific 名稱，建議改為 generic 命名]
```

---

### 輔助 Scripts (Phase A-0 工具)

> 以下 scripts 位於 `skills/jira-deep-analysis/scripts/`，需先在該目錄建立 `.env` 檔（參考 `.env.example`）。

#### `fetch_jira.py` — 取得 JIRA Issue 詳細資訊

```bash
python fetch_jira.py GC20T5T7-119
# 輸出: { "key": "GC20T5T7-119", "summary": "...", "description": "...", "labels": [...], ... }
```

使用時機：無法直接 webfetch JIRA（需 API 認證）時，改用此 script。

#### `search_github.py` — 搜尋 GitHub Repos 程式碼

```bash
# 搜尋單一 repo
python search_github.py "enclosure_util" --repos facebook/openbmc --ext c

# 搜尋多個 repos
python search_github.py "sensor_read" --repos facebook/openbmc openbmc/openbmc

# 搜尋整個 org
python search_github.py "i2c_master_write" --org openbmc --ext c --per-page 20

# 搜尋並回傳匹配的 code fragment（可看到匹配上下文，用於判斷要 fetch 哪個結果）
python search_github.py "pal_get_fru_health" --repos facebook/openbmc --text-matches
```

輸出（預設）：`{ "total_count": N, "items": [{ "repo", "path", "name", "url" }], ... }`

輸出（`--text-matches`）：每個 item 額外包含 `text_matches` 陣列，內含 `fragment`（匹配上下文程式碼片段）和 `matches`（匹配位置）。用於在大量結果中快速判斷哪個檔案/位置是目標。

#### `grep_github_file.py` — 在 GitHub 檔案內搜尋 pattern（回傳行號）

```bash
# 在大型檔案中搜尋函式定義，直接取得行號
python grep_github_file.py facebook/openbmc meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c "pal_get_fru_health"

# 自訂上下文行數與最大匹配數
python grep_github_file.py facebook/OpenBIC src/platform/gc2-es/plat_class.c "plat_class" --context 5 --max-matches 20

# 指定 branch/tag/commit
python grep_github_file.py facebook/openbmc some/file.c "pattern" --ref some-branch
```

輸出：`{ "repo", "path", "pattern", "total_lines", "match_count", "truncated", "matches": [{ "line", "content", "context" }] }`

> **注意**：`pattern` 使用 **Python regex** 語法（非 shell glob 或 grep BRE）。例如用 `plat_class|plat_hook` 而非 `plat_class\|plat_hook`。特殊字元如 `(`、`)`、`.` 需用 `\` 跳脫。

**使用時機**：`search_github.py` 找到檔案後，不知道目標在第幾行（尤其 4000+ 行大檔案），用此工具直接定位行號，再用 `fetch_github_file.py` 取得完整上下文。

**典型工作流程**：
1. `search_github.py "pal_get_fru_health" --repos facebook/openbmc` → 找到 `pal.c`
2. `grep_github_file.py facebook/openbmc .../pal.c "pal_get_fru_health"` → 得到 line 2651
3. `fetch_github_file.py facebook/openbmc .../pal.c 2651 --context 30` → 讀取完整函式

#### `fetch_github_file.py` — 取得檔案程式碼片段

```bash
# 取得 facebook/openbmc 某檔案第 42 行附近 ±10 行
python fetch_github_file.py facebook/openbmc common/recipes-utils/enclosure-util/enclosure-util.c 42

# 自訂上下文行數
python fetch_github_file.py facebook/OpenBIC src/platform/plat_class.c 100 --context 20

# 指定 branch/tag/commit
python fetch_github_file.py facebook/OpenBIC src/platform/plat_class.c 100 --context 20 --ref Jim/fbgc2-es/some-branch
```

輸出：`{ "repo", "path", "start_line", "end_line", "total_lines", "content": "..." }`

> **注意**：scripts 使用 `.env` 中的 `JIRA_URL`、`JIRA_EMAIL`、`JIRA_API_TOKEN`、`GITHUB_TOKEN`。詳見 `.env.example`。

---

### Phase A-1: 平行搜尋策略

根據問題類型選擇策略，**同時啟動** 4-6 個 agents：

#### 策略 A: Kernel/Driver 問題
**症狀**: Watchdog、I2C、GPIO、Device Tree 相關
- `explore` → `AspeedTech-BMC/linux`, `openbmc/linux`：搜尋 driver 實作、device tree
- `librarian` → AST2600/AST1030 subsystem 架構文件

#### 策略 B: Daemon/Service 問題
**症狀**: entity-manager, dbus-sensors, bmcweb, phosphor-* 相關
- `explore` → `openbmc/entity-manager`, `openbmc/dbus-sensors`, `openbmc/bmcweb`：JSON configs、probe logic
- `librarian` → entity-manager probe logic 和 platform detection 架構

#### 策略 C: Meta/Facebook Platform 問題
**症狀**: Yosemite, Grand Canyon, fby4 等 Meta 平台
- `explore` → `facebook/openbmc`：FRU、platform ID、PAL
- `explore` → `meta-facebook/meta-{platform}/`：recipes、board utils

#### 推薦：不確定類型用 4-agent 標準組合

```typescript
// 同時啟動 4 個 agents (run_in_background=true)
task(subagent_type="explore", run_in_background=true,
  prompt="Search aspeed/linux and openbmc/linux for {keyword} — find drivers/, dts, platform patches")

task(subagent_type="explore", run_in_background=true,
  prompt="Search entity-manager, dbus-sensors, bmcweb for {platform} configs, probe logic, JSON configs")

task(subagent_type="librarian", run_in_background=true,
  prompt="Research {subsystem} architecture from aspeed/linux Documentation/")

task(subagent_type="librarian", run_in_background=true,
  prompt="Research entity-manager probe logic and platform detection mechanisms")
```

---

### Phase A-2: 證據整合

#### 2.1 建立證據矩陣

| 證據 # | 來源 | 檔案路徑 | 類型 | 強度 | 發現內容 |
|--------|------|---------|------|------|---------|
| E1 | explore-kernel | `drivers/watchdog/aspeed_wdt.c` | 程式碼 | 🔴 高 | ... |
| E2 | explore-daemon | `entity-manager/configurations/meta/fbtp.json` | 設定 | 🔴 高 | ... |

強度：🔴 高（程式碼實證、多來源）| 🟡 中（文件、單來源）| 🟢 低（間接、需驗證）

#### 2.2 建立證據鏈

```
E1: 根因線索 A → E2: 支持證據 → E3: 確認證據 → 推論 R1 → 結論 C1 → 症狀 S1 ✅ 符合
```

驗證：每個推論需 2+ 獨立證據、證據鏈解釋**所有**症狀、無未解釋矛盾

#### 2.3 識別證據缺口

列出「現場需驗證」vs「可再搜尋」的缺口，決定是否啟動額外 agents。

---

### Phase A-3: 根因分析

#### 5 Whys 框架
```
症狀: [症狀描述]
Why 1: 為什麼...？ → 因為...
Why 2-5: 持續追問...
ROOT CAUSE: [根本原因]
```

#### 多層次分析（必須挖到最深層）
```
Layer 1 (表面): 直接失效症狀
Layer 2 (直接): 直接技術原因
Layer 3 (系統): 系統邏輯錯誤
Layer 4 (架構): 架構設計缺陷
Layer 5 (根本): ROOT CAUSE ← 必須到達此層
```

#### 信心度評估表

| 根因假設 | 支持證據數 | 矛盾證據數 | 信心度 |
|---------|-----------|-----------|--------|
| 假設 A | N | 0 | 🔴 95% |
| 假設 B | N | 0 | 🟡 85% |

---

### Phase A-4: 方案設計

每個方案包含：

```markdown
## 方案 N: {名稱} (推薦/次選/備案)
**概述**: {一句話}
**修復層級**: 🟢 最小修正（只改必要項）| 🟡 完整修正（對齊參考平台）| 🔴 理想修正（含所有最佳實踐）
**實作步驟**: 1. ... 2. ... 3. ...
**優缺點**: ✅ 優點 / ❌ 缺點
**影響範圍**: 修改檔案數、影響平台、是否需硬體變更
**工時估算**: 開發 Xhr + 測試 Yhr + 部署 Zhr = 總計 Xhr (約 N 天)
**風險**: 🟢 低 / 🟡 中 / 🔴 高
**程式碼範例**: [相關 code snippet]
```

> 📌 **GC20T5T7-134 經驗**：報告推薦完整替換 `plat_hook.c`（理想修正），工程師採用最小修正（僅移除 negate、保留 `==1` workaround）。兩者皆為有效方案，應明確標示層級讓工程師自行判斷。

決策矩陣：用技術可行性、開發成本、風險、向後相容 4 維度評分排序。

---

### Phase A-5: 報告產出

#### 報告範本

```markdown
# {JIRA-KEY} 根因分析報告
**JIRA Issue**: [{JIRA-KEY}]({JIRA-URL})
**分析日期**: {YYYY-MM-DD}
**分析方法**: 證據導向多維度平行搜尋
**AI 版本**: Atlas + {N} parallel agents

## 📋 目錄
1. 問題描述
2. 調查方法
3. 根本原因分析
4. 關鍵證據（含程式碼片段）
5. 結論總覽
6. 解決方案（2-3 個）
7. 證據強度評估
8. 立即行動項目
9. 附錄：技術細節

## 問題描述
## 調查方法
## 根本原因分析
## 關鍵證據
## 結論總覽
## 解決方案
## 證據強度評估
## 立即行動項目
## 附錄：技術細節
```

**存檔路徑**: `{JIRA-KEY}_分析報告.md`

#### 品質檢查清單

```
□ 證據充分性: 搜尋 5+ repos、5+ 獨立證據、有程式碼層級證據
□ 根因可信度: 解釋所有症狀、無未解釋矛盾、信心度 >= 80%
□ 方案實用性: 2+ 方案、有工時估算、有程式碼範例
□ 報告完整性: 有立即行動項目、有技術細節附錄、有證據評估
□ 工程師可讀性: 有程式碼片段、有檔案路徑、無模糊描述
```

---

### Route A 最佳實踐

**DO** ✅: 平行啟動 4+ agents、程式碼優先、多來源驗證 2+、保守估計、每個證據附檔案路徑、工時實際、附範例程式碼

**DON'T** ❌: 無證據猜測、單一來源下結論、停在 Layer 1、忽略矛盾證據、過度承諾時程、隱藏方案風險、使用模糊詞彙（可能/或許）、在所有 agents 完成前下結論

**常見陷阱**:
- 過早下結論 → 等所有 agents 完成才分析
- 搜尋不足 → 至少覆蓋 kernel + daemons + Meta 三層
- 只有文字無程式碼 → 每個證據附 code block + 檔案路徑
- 方案不具體 → 提供實際 code example + 修改檔案清單 + 工時
- 忽略向後相容 → 說明受影響平台 + 提供回歸測試計畫

---

### Route A 常用 Repository 清單

**OpenBMC 官方**: `openbmc/openbmc`, `openbmc/linux`, `openbmc/entity-manager`, `openbmc/dbus-sensors`, `openbmc/bmcweb`, `openbmc/phosphor-logging`, `openbmc/sdbusplus`, `openbmc/phosphor-dbus-interfaces`

**Aspeed 官方**: `AspeedTech-BMC/linux`, `AspeedTech-BMC/u-boot`

**Meta/Facebook**: `facebook/openbmc`, `meta-facebook/meta-{platform}/`

---

---

## ═══ ROUTE B: gc2-es / OpenBIC Debugger ═══

> ⚠️ **Route B (gc2-es/OpenBIC)**: 使用 Zephyr 工具（west、GDB、OpenOCD）。**不要**套用 oBMC / entity-manager / phosphor patterns。

---

### Pre-knowledge: gc2-es 平台 + common/ 模組

#### 平台基本資訊
- **Repository**: `meta-facebook/OpenBIC` (facebook/OpenBIC)
- **Platform**: gc2-es (meta-facebook/gc2-es)
- **SoC**: AST1030 (Arm Cortex-M) — **非** AST2600
- **Key files**:
  - `src/platform/plat_class.c` — sensor/ADC config, platform identification
  - `src/ipmi/plat_ipmi.c` — IPMI command handlers
  - Sensor table — VR/thermal/HSC sensor definitions
- **常見問題**: Sensor scaling/threshold 錯誤、VR config 不對、thermal margin、SMI stuck-low、GPIO/ADC timing

#### common/ 目錄角色（非常重要！）

```
common/
├── lib/        → util_worker, libutil (跨平台工具庫)
├── service/    → ipmb, ipmi, mctp, pldm (服務層)
└── dev/        → fru 等 (設備抽象)
```

- gc2-es 的許多功能 `#include` common/ header 並直接呼叫其 functions
  - 例：`plat_init.c` include `util_worker.h`，`plat_ipmb.h` include `ipmb.h`
- 近期 refactor 趨勢：plat_class / plat_sensor / plat_sdr 常從 common/ 提取 shared functions
- **Debug 原則**: 如果 bug 在 plat_class.c / plat_ipmi.c，但邏輯看起來很 generic → **先檢查 common/ 的對應 module** 是否有已知 issue 或需要 override

---

### Step B-1: 問題分類

根據症狀分類，呼叫對應的 sub-prompt handler：

| 症狀特徵 | Handler |
|---------|---------|
| Sensor 讀值異常、VR 問題、ADC 不對、thermal | `handleGc2esSensorVrIssue` |
| Bug 疑似來自 common/ 模組（util_worker、ipmb 等） | `handleCommonCodeDependency` |
| SMI stuck-low、ISR 不觸發、interrupt 問題 | `handleGc2esInterruptSmi` |
| Crash、Hard Fault、z_fatal_error、watchdog | `handleGc2esGeneralCrash` |

若不確定：詢問 **「這段 code 是來自 plat_xxx 還是 include 的 common/？貼 log 或 snippet」**

---

### Step B-2: Sub-Prompt Handlers

---

#### Handler: handleGc2esSensorVrIssue

**觸發條件**: sensor 讀值不對、VR 設定問題、ADC scaling/threshold 異常

**除錯步驟**:
1. **檢查 plat_class.c**: 查看 sensor table 和 ADC_INFO 設定，確認 scaling factor 和 threshold 設定
2. **同類 Sensor 掃描 (Same-Class Sweep)**: 在 SDR/sensor table 中發現某個 sensor 有欄位錯誤（如 `sensor_unit1`、`UNRT`、threshold）時，**必須掃描同 table 中所有 sensor** 是否有相同 pattern 的問題。
   - 常見同類問題：`sensor_unit1` signed/unsigned 設定、threshold 值、scaling factor
   - 📌 **GC20T5T7-134 經驗**：修正 `MB_SOC_THERMAL_MARGIN_C` 的 `sensor_unit1` 時，`MB_INLET_TEMP_C` 也需要同樣修正（從 `0x00` 改為 `0x80`），但初次分析遺漏
   - 方法：`grep_github_file.py` 搜尋 `sensor_unit1` 或 `0x00` 在整個 `plat_sdr_table.c` 中的分佈
3. **確認 common/ 依賴**: 檢查是否使用 common/ plat_sensor functions（近期 refactor 後，scaling 邏輯可能已移至 common/）
   - 若是 → 先看 `common/service/` 對應模組是否有問題
4. **啟用 Logging**:
   ```
   CONFIG_LOG=y, level=4
   Shell 命令: sensor get
   Shell 命令: sensor read {sensor_name}
   ```
5. **GDB 驗證**:
   ```bash
   west debug  # 或 OpenOCD + GDB
   (gdb) x/4x &ADC_REG  # Dump ADC registers (volatile access)
   ```

**注意**: ADC register 為 volatile，GDB 讀取時不要讓編譯器 cache

---

#### Handler: handleCommonCodeDependency

**觸發條件**: Bug 疑似來自 common/ 模組，或 gc2-es 呼叫了 common/ 的 function

**除錯步驟**:
1. **識別 common/ 模組**: 確認是哪個 common/ 檔案/模組？
   - `common/lib/util_worker.c`？`common/service/ipmb.c`？其他？
2. **檢查 Override**: gc2-es 是否有正確 override？
   - `plat_init.c` 是否有 custom hook？
   - `plat_ipmi.c` 是否有特定處理？
3. **Debug 方法**:
   ```c
   // 在 common/ call site 加 logging（優先用 #ifdef 針對 gc2-es）
   #ifdef CONFIG_GC2ES
   LOG_WRN("gc2-es debug: %s val=%d", __func__, val);
   #endif
   ```
4. **解決方案方向**:
   - Bug **在 common/**：提議 upstream fix 或 local patch（不要直接改動 common/，先討論）
   - Bug **在 gc2-es 的使用方式**：在 plat_xxx.c 加 gc2-es specific override
5. **常見陷阱**:
   - `west update` 後 common/ 版本變了但 plat_xxx 沒更新 → 版本 mismatch
   - common/ header 缺少 include guard → 重複 include 問題

**原則**: 先在 gc2-es 加 log/test，**不要直接改 common/**，確認 root cause 後再決定修復位置

---

#### Handler: handleGc2esInterruptSmi

**觸發條件**: SMI stuck-low、ISR 不觸發、interrupt 相關問題

**除錯步驟**:
1. **定位 SMI handler**: 可能來自 `common/service/` 或 `plat_isr.c`
   - 搜尋: `grep -r "SMI" src/platform/ common/service/`
2. **GDB 除錯**:
   ```bash
   (gdb) break plat_isr.c:SMI_handler  # 在 ISR 設斷點
   (gdb) info registers  # 檢查 NVIC 狀態
   # 或直接讀 SCU/NVIC 暫存器
   (gdb) x/4x 0xE000E100  # NVIC ISER0
   ```
3. **Shared Code 確認**: 若 ISR 來自 common/
   - 確認 `irq_connect_dynamic()` 是否正確使用
   - 確認 IRQ priority 設定
4. **SMI 硬體確認**: 確認 GPIO/硬體端 SMI signal 是否真的被 assert

---

#### Handler: handleGc2esGeneralCrash

**觸發條件**: Hard Fault、z_fatal_error、panic、watchdog reset

**除錯步驟**:
1. **收集 Fault Log**:
   ```
   Shell: fault show    # 顯示上次 fault 資訊
   Shell: thread analyze  # 分析 thread 狀態
   CONFIG_LOG=y, level=4 → 找 "FATAL ERROR" 或 "ESF:"
   ```
2. **GDB 分析**:
   ```bash
   west debug
   (gdb) break z_fatal_error  # 抓 fault 觸發點
   (gdb) bt                    # backtrace
   (gdb) info registers        # 看 PC/SP/LR
   ```
3. **gc2-es 常見 Crash 原因**:
   - ADC/GPIO 初始化順序問題（common/ 先呼叫了 gc2-es 還沒準備好的資源）
   - Clock 設定錯誤導致 peripheral 存取 fault
   - Stack overflow（Zephyr thread stack 不夠）
   - volatile 問題：存取 ADC/GPIO register 時未用 volatile pointer

---

### Step B-3: 除錯工具參考

```bash
# Zephyr Logging
CONFIG_LOG=y
CONFIG_LOG_DEFAULT_LEVEL=4  # DEBUG level

# West Debug
west debug                   # 連接 OpenOCD + GDB
west build -b gc2_es         # 建置 gc2-es target

# OpenOCD + GDB (手動)
openocd -f interface/cmsis-dap.cfg -f target/ast1030.cfg &
arm-zephyr-eabi-gdb build/zephyr/zephyr.elf

# Zephyr Shell 命令
shell> thread analyze        # 查看所有 thread 狀態
shell> fault show            # 顯示上次 fault
shell> sensor get            # 列出所有 sensor
shell> sensor read <name>    # 讀取特定 sensor

# 常用 GDB 命令
(gdb) bt                     # backtrace
(gdb) info threads           # 所有 thread
(gdb) thread <N>             # 切換 thread
(gdb) x/4x <addr>           # 讀取記憶體（volatile 存取）
(gdb) set variable <var>=<val>  # 修改變數做測試
```

**OpenOCD 重試**: 若連線失敗 → 等 3 秒後重試（BIC reset 後需要時間 boot）

---

### Route B 最佳實踐

**DO** ✅:
- 先問清楚：code 是在 plat_xxx 還是 common/？
- 先加 log/確認，再動 code
- common/ 問題 → 先提議 upstream fix，不要直接改
- 使用 volatile 存取硬體 register
- GDB 設斷點前先確認 function 名稱（可能在 common/ 不在 plat/）

**DON'T** ❌:
- 未確認 root cause 就直接改 common/
- 忽略 `west update` 後的版本 mismatch
- 在 common/ 加 gc2-es specific hardcode（用 #ifdef 或 override）
- 假設 workaround 是不必要的 — 平台特有的 workaround（如 `==1` 檢查）可能是針對硬體邊際案例，未有硬體證據前不要建議移除

---

### Route B 品質檢查清單

□ 同類 sensor 掃描: SDR table 中其他 sensor 是否有相同 pattern 問題？
□ 跨平台對照: 至少比對 2+ 其他平台的對應 sensor/hook 實作
□ 修復層級標示: 方案是否清楚標示最小修正 vs 理想修正？
□ Workaround 評估: 現有 workaround 是否有保留的硬體理由？
□ common/ 影響: 修改是否涉及 common/ 模組？是否需要 upstream fix？

---

---

## 進階技巧 (兩條路由通用)

### 使用 session_id 持續追問

```typescript
// 初次搜尋結果不夠深入 → 繼續同一 session
task(
  session_id="ses_xxx",  // 重用同一個 session，保留 context
  prompt="Based on previous findings, now search deeper for GC2.0 specific FRU files"
)
```

### Route A 遇到複雜問題時升級

```typescript
task(subagent_type="oracle", prompt="Complex debugging: BMC reset not working on platform upgrade...")
task(subagent_type="artistry", prompt="Non-conventional approach needed: ...")
```

---

## 版本歷史

- **v2.3.0-wiwynn** (2026-03-07): [Wiwynn fork] 新增 Route G GitHub Issue URL 支援（`gh issue view {URL} --json title,body,labels,assignees,comments`）；Phase 0 加入 GitHub Issue 偵測邏輯，以支援 `/fw-dev` slash command 接受 GitHub Issue URL 作為入口
- **v2.3.0** (2026-03-05): 新增 Phase A-FR (FEATURE_REQUEST 工作流程) 含同平台 Pattern 優先、檔案組織一致性、交叉驗證三條規則 + 專用報告範本；新增 `grep_github_file.py` regex 語法備註
- **v2.2.0** (2026-03-05): 新增「同類 sensor 掃描」規則、「修復層級」方案標示、Route B 品質檢查清單；`fetch_github_file.py` 新增 `--ref` 支援；源自 GC20T5T7-134 delta 分析 (DISC-006)
- **v2.1.0** (2026-03-05): 新增 `grep_github_file.py` 工具、`search_github.py` 加入 `--text-matches` 支援、強化 Phase 0 平台偵測（JIRA Key 對照表 + sublayer 架構說明）
- **v2.0.0** (2026-03-05): 整合 gc2-es/OpenBIC debugger，雙平台路由架構
- **v1.0.0** (2026-03-03): 初始版本，基於 GC20T5T7-121 分析案例
