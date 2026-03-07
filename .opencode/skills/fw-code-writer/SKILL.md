---
name: fw-code-writer
description: '接收 fw-code-researcher 產出的修改方案，讀取原始檔案，撰寫實際的 C/C++ 程式碼，產出可直接 apply 的 unified diff。支援 OpenBMC (Meta oBMC sublayer) 和 OpenBIC (Zephyr RTOS) 兩大平台的 coding style 與命名慣例。產出的 diff 可直接 git apply，搭配 fw-commit-generator 完成完整的 commit 流程。'
license: MIT
version: 1.0.0
---

# Firmware Code Writer — 韌體程式碼撰寫

## 概述

`fw-code-writer` 是 BMC/BIC 韌體開發工作流程的**程式碼撰寫層 Skill**，位於 `fw-code-researcher`（程式碼研究）之後、`fw-commit-generator`（Commit 生成）之前。

**職責範圍**：
- **接收** `fw-code-researcher` 產出的結構化修改方案（檔案清單、diff-like 修改內容、修改理由）
- **讀取** 目標檔案的原始程式碼（使用 `fetch_github_file.py`）
- **撰寫** 符合平台 coding style 的 C/C++ 程式碼
- **產出** 可直接 `git apply` 的 unified diff（每個 hunk 附修改理由）
- **觸發** `fw-commit-generator` skill 產出對應的 commit message

**不負責**：
- 程式碼搜尋與定位（由 `fw-code-researcher` 處理）
- JIRA Issue 解析（由 `jira-deep-analysis` 處理）
- PR 審查（由 `fw-pr-reviewer` 處理）
- `git push`（由 `/fw-dev` command 控制）

---

## 輸入（來自 fw-code-researcher 的修改方案）

本 Skill 接收 `fw-code-researcher` 產出的修改方案作為輸入，格式如下：

```markdown
# {JIRA-KEY} 修改方案

**分析來源**: jira-deep-analysis 報告
**目標 Repository**: {repo}（如 facebook/openbmc, facebook/OpenBIC）
**目標平台**: {platform}（如 grandcanyon, yosemite4, gc2-es）
**日期**: {YYYY-MM-DD}

## 摘要
[一段話描述需要做什麼修改、為什麼]

## 需修改的檔案清單

| # | 檔案路徑 | 變更類型 | 說明 |
|---|---------|---------|------|
| 1 | `path/to/file.h` | 修改 | 新增 enum 定義 |
| 2 | `path/to/file.c` | 修改 | 新增函式實作 |

## 各檔案具體修改

### 1. `path/to/file.h`
**修改理由**：[為什麼需要修改此檔案]
**參考來源**：[參考了哪個平台/函式的 pattern]

[diff-like 修改內容]

## 修改依賴順序
1. header (.h) → 2. implementation (.c) → 3. caller

## 潛在風險
[風險評估表]
```

> **重要**：不要自行搜尋程式碼，直接使用 `fw-code-researcher` 提供的修改方案和檔案路徑。

---

## 程式碼撰寫規範

### OpenBMC C Coding Style

適用於 `facebook/openbmc` repo（Meta oBMC sublayer 架構）。

#### 縮排與格式
- **4-space indent**（不使用 tab）
- 大括號獨立成行（K&R style 變體）：
  ```c
  int pal_get_fru_name(uint8_t fru, char *name)
  {
      if (fru >= FRU_CNT) {
          return -1;
      }
      // ...
  }
  ```
- 每行不超過 80 字元（儘量遵守，長 string literal 可例外）
- function 之間空一行

#### PAL API 命名慣例
- PAL（Platform Abstraction Layer）函式命名：`pal_xxx`
  - 例：`pal_get_fru_name()`, `pal_set_server_power()`, `pal_get_sensor_reading()`
- PAL header：`#include "pal.h"`
- PAL 實作檔案位置：`meta-facebook/meta-{platform}/recipes-{platform}/plat-libs/files/pal/pal.c`
- PAL 函式常 4000+ 行，修改時只取相關函式的上下文

#### Error Handling
- 所有 PAL 函式回傳 `int`，`0` 為成功，`-1` 為失敗
- 錯誤路徑必須記錄 syslog：
  ```c
  if (ret < 0) {
      syslog(LOG_ERR, "%s() Failed to get fru %u name, ret=%d", __func__, fru, ret);
      return -1;
  }
  ```
- 使用 `__func__` macro 標注函式名稱（不要手動打函式名）
- syslog level：`LOG_ERR`（錯誤）、`LOG_WARNING`（警告）、`LOG_INFO`（資訊）

#### 常見 Pattern
- **FRU 相關**：以 `uint8_t fru` 為第一參數，用 switch-case 分派
- **Sensor 相關**：以 `uint8_t fru, uint8_t sensor_num` 辨識 sensor
- **Power control**：以 `uint8_t slot_id, uint8_t cmd` 控制電源狀態
- **Guard clause**：函式開頭先驗參數，無效直接 return -1

---

### OpenBIC / Zephyr Coding Style

適用於 `facebook/OpenBIC` repo（Zephyr RTOS 環境、AST1030 Arm Cortex-M）。

#### 縮排與格式
- **Tab indent**（Zephyr 預設，部分 OpenBIC 平台用 tab）
- Linux kernel style 大括號
- struct/enum 命名使用 snake_case

#### 平台函式命名慣例
- 平台函式命名：`plat_xxx`
  - 例：`plat_class_init()`, `plat_sensor_read()`, `plat_ipmb_init()`
- 平台檔案位於：`src/platform/{platform}/` 目錄下
  - `plat_class.c` — 平台識別、初始化
  - `plat_sensor_table.c` — sensor 定義表
  - `plat_hook.c` — 平台特定 hook functions
  - `plat_ipmb.c` — IPMB 通訊設定

#### Logging
- 使用 Zephyr log macro，**不使用** `syslog`：
  ```c
  LOG_ERR("Failed to read sensor %d, ret=%d", sensor_num, ret);
  LOG_WRN("Unexpected board revision: 0x%x", rev);
  LOG_INF("Platform init complete, %d sensors registered", count);
  ```
- 設定 log module：
  ```c
  #include <logging/log.h>
  LOG_MODULE_REGISTER(plat_class, LOG_LEVEL_DBG);
  ```

#### common/ 目錄意識
- `common/lib/` — 跨平台工具庫（`util_worker`, `libutil`）
- `common/service/` — 服務層（`ipmb`, `ipmi`, `mctp`, `pldm`）
- `common/dev/` — 設備抽象（`fru` 等）
- 修改 `plat_xxx` 函式前，確認是否有對應的 `common/` shared function
- 若功能屬於通用邏輯，優先修改 `common/` 而非平台程式碼

#### 常見 Pattern
- **Sensor table**：以 `sensor_cfg` struct 定義 sensor 列表
- **Init sequence**：`plat_class_init()` → `plat_sensor_init()` → `plat_ipmb_init()`
- **I2C 操作**：使用 Zephyr `i2c_transfer()` API 搭配 device tree binding
- **GPIO 操作**：使用 Zephyr GPIO API（`gpio_pin_configure()`, `gpio_pin_get_raw()`）

---

### 常見修改類型模板

以下為常見的修改 pattern，撰寫程式碼時參考對應模板。

#### 模板 A：新增 Sensor（OpenBIC）

```c
// plat_sensor_table.c — 在 sensor_config[] 陣列中新增 entry
{
    .num = SENSOR_NUM_XXX,
    .type = SENSOR_TYPE_TEMPERATURE,
    .port = I2C_BUS_X,
    .target_addr = DEVICE_ADDR,
    .offset = 0x00,
    .access_check = SENSOR_ACCESS_CHECK_FUNC,
    .arg0 = 0,
    .arg1 = 0,
    .sample_count = SAMPLE_COUNT_DEFAULT,
    .cache = SENSOR_INIT_STATUS,
    .cache_status = SENSOR_INIT_STATUS,
    .pre_sensor_read_hook = NULL,
    .pre_sensor_read_args = NULL,
    .post_sensor_read_hook = NULL,
    .post_sensor_read_args = NULL,
},
```

#### 模板 B：修改 GPIO Map（OpenBIC）

```c
// plat_gpio.c — 在 gpio_cfg[] 中修改或新增 GPIO 定義
// 注意：GPIO number 和功能對應因平台而異，必須參考 hw spec
{
    .number = GPIO_NUM,
    .direction = GPIO_INPUT,    // 或 GPIO_OUTPUT
    .status = GPIO_LOW,         // 初始狀態
    .property = OPEN_DRAIN,     // 或 PUSH_PULL
    .int_type = GPIO_INT_DISABLE,
},
```

#### 模板 C：新增平台特定 PAL Function（OpenBMC）

```c
// pal.c — 新增 PAL function
int pal_get_new_feature(uint8_t fru, uint8_t *value)
{
    int ret;
    char path[MAX_PATH_LEN];

    if (fru >= FRU_CNT) {
        syslog(LOG_ERR, "%s() Invalid fru: %u", __func__, fru);
        return -1;
    }

    snprintf(path, sizeof(path), FRU_PATH_TEMPLATE, fru);
    ret = read_device(path, (int *)value);
    if (ret < 0) {
        syslog(LOG_ERR, "%s() Failed to read %s, ret=%d", __func__, path, ret);
        return -1;
    }

    return 0;
}
```

> **注意**：以上模板僅供參考結構與 pattern，具體的 sensor number、GPIO 編號、device address 等必須根據 `fw-code-researcher` 提供的修改方案和硬體規格填入，不要硬寫死。

---

## 自動執行步驟

收到 `fw-code-researcher` 的修改方案後，**自動執行以下步驟**，無需詢問：

### Step 1：讀取原始檔案

使用 `fetch_github_file.py` 讀取每個需要修改的檔案的原始內容。**必須讀取修改前的完整函式上下文**，確保 diff 正確。

```bash
# 讀取指定檔案的特定行號範圍（包含上下文）
python .opencode/skills/jira-deep-analysis/scripts/fetch_github_file.py \
    {repo} \
    {file_path} \
    {target_line} \
    --context 50 \
    --ref {branch}
```

**關鍵原則**：
- 每個要修改的函式，至少讀取函式開頭到結尾（`--context` 設大一些）
- 如果修改方案涉及多個函式，分別讀取每個函式
- `--ref` 使用目標分支（通常為 `main` 或平台分支）
- 讀取結果用於後續產生正確的 unified diff

### Step 2：撰寫 C/C++ 程式碼

根據 `fw-code-researcher` 的修改方案，撰寫符合平台 coding style 的程式碼：

1. **遵循平台慣例**：oBMC 用 `pal_` 命名 + 4-space indent + syslog；OpenBIC 用 `plat_` 命名 + LOG_ERR/LOG_WRN/LOG_INF
2. **保留原有 context**：不要改動修改方案未提及的程式碼行
3. **Error handling 完整**：所有 return path 都有對應的 error log
4. **命名一致**：新增的 function/variable/macro 命名須符合目標平台既有慣例
5. **記憶體安全**：malloc 有對應 free，或儘量使用 stack allocation

### Step 3：產出 Unified Diff

將修改結果輸出為標準 unified diff 格式。每個 hunk 附上修改理由 comment：

```diff
--- a/meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c
+++ b/meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c
@@ -1234,6 +1234,20 @@ int pal_get_fru_health(uint8_t fru, uint8_t *value)
     return 0;
 }
 
+// [修改理由]: 新增 FRU 狀態查詢函式，支援新硬體平台需求
+int pal_get_fru_status(uint8_t fru, uint8_t *status)
+{
+    if (fru >= FRU_CNT) {
+        syslog(LOG_ERR, "%s() Invalid fru: %u", __func__, fru);
+        return -1;
+    }
+
+    *status = get_fru_status_from_cache(fru);
+    return 0;
+}
+
```

**Diff 產出規則**：
- 使用標準 unified diff 格式：`--- a/path` / `+++ b/path` / `@@ -LINE,N +LINE,N @@`
- 每個 hunk 的 `@@` 行後保留原始函式名作為 context tag
- 每個 hunk 在修改行前加上 `// [修改理由]: ...` 註解，說明此處為何修改
- `+` 開頭為新增行、`-` 開頭為刪除行、空格開頭為 context（不變的行）
- Context 至少包含修改點前後各 3 行
- 多個檔案的修改產出各自獨立的 diff block

### Step 4：Stage 並觸發 Commit

產出 diff 後，依以下順序完成程式碼提交流程：

```bash
# 1. 將 diff 套用到工作目錄（如果是本地 repo）
git apply changes.diff

# 2. Stage 所有修改的檔案
git add {modified_files}

# 3. 觸發 fw-commit-generator skill 產出 commit message
# fw-commit-generator 會自動讀取 git diff --cached 並生成規範 commit message
```

> **注意**：只執行 `git add`，不執行 `git push`。Push 由 `/fw-dev` command 統一控制。

---

## 輸出格式（Unified Diff）

最終輸出的 unified diff 必須符合以下格式規範：

### 完整 diff 範例

```diff
--- a/path/to/file.c
+++ b/path/to/file.c
@@ -100,7 +100,12 @@ static int existing_function(void)
     int ret;
     char buf[64];
 
-    ret = old_api_call();
+    // [修改理由]: 替換已棄用的 API，使用新版本以支援擴展功能
+    ret = new_api_call(param1, param2);
+    if (ret < 0) {
+        syslog(LOG_ERR, "%s() new_api_call failed, ret=%d", __func__, ret);
+        return -1;
+    }
 
     return 0;
 }
```

### Diff 格式要求

1. **Header 行**：
   - `--- a/{file_path}` — 修改前的檔案路徑
   - `+++ b/{file_path}` — 修改後的檔案路徑
   - 路徑使用 repo 內的相對路徑（從 repo root 開始）

2. **Hunk header**：
   - `@@ -OLD_START,OLD_COUNT +NEW_START,NEW_COUNT @@ context_tag`
   - `context_tag` 通常是最近的函式名，方便 reviewer 定位
   - 行號必須準確，確保 `git apply` 能正確套用

3. **修改行**：
   - `+` 開頭：新增的程式碼行
   - `-` 開頭：刪除的程式碼行
   - ` `（空格）開頭：不變的 context 行
   - 修改理由以 `// [修改理由]:` 註解形式標注在對應的新增行前面

4. **多檔案 diff**：
   - 各檔案的 diff block 之間用空行分隔
   - 按修改依賴順序排列：header (.h) → implementation (.c) → caller
   - 每個檔案一個 `--- / +++` 區塊

---

## 品質檢查

產出 diff 前，逐項確認以下清單：

### 程式碼品質

- [ ] PAL API 命名遵循平台慣例（oBMC: `pal_`、OpenBIC: `plat_`）
- [ ] 所有 return path 都有 error log（oBMC: `syslog()`、OpenBIC: `LOG_ERR()`）
- [ ] malloc 有對應 free（或使用 stack allocation 避免動態配置）
- [ ] 修改在正確的 sublayer/platform 目錄（不要改錯平台的檔案）
- [ ] 新增的 #include 確認目標 header 存在
- [ ] 變數命名符合既有 coding convention（snake_case）
- [ ] 不引入 magic number（使用 #define 或 enum）

### Diff 格式品質

- [ ] 行號與原始檔案一致（使用 `fetch_github_file.py` 確認）
- [ ] Context 行完全匹配原始檔案內容
- [ ] 每個 hunk 有 `// [修改理由]:` 註解
- [ ] diff 格式可通過 `git apply --check` 驗證
- [ ] 多檔案修改按依賴順序排列

### 安全性檢查

- [ ] 不洩漏 credentials、API key、password
- [ ] 不修改 build system 核心配置（Makefile.am / CMakeLists.txt）除非方案明確要求
- [ ] 不移除既有的 error handling 或 boundary check
- [ ] Buffer size 足夠（snprintf 使用 sizeof）

---

## 版本歷史

| 版本 | 日期 | 說明 |
|------|------|------|
| 1.0.0 | 2026-03-07 | 初版：建立 fw-code-writer Skill，支援 OpenBMC/OpenBIC coding style 與 unified diff 輸出 |
