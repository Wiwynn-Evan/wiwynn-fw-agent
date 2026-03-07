---
name: fw-commit-generator
description: 'Generate git commit messages for OpenBMC/OpenBIC firmware (C/C++) repositories, following EF1900 department conventions for both Meta oBMC (GitHub) and LF oBMC (Gerrit) platforms. Automatically reads staged diff via `git diff --cached`. Use when writing or improving commit messages for firmware changes.'
license: MIT
---

# Firmware Commit Message Generator - EF1900 韌體部門

## 概述 (Overview)

為 OpenBMC / OpenBIC (C/C++) 韌體工程師生成符合部門規範的 Commit Message。
此 Skill 專為 **EF1900 韌體部門**的 Meta oBMC (GitHub) 與 LF oBMC (Gerrit) 平台設計。

## 適用範疇 (Scope)

- **語言**: C, C++（偶爾 Python/Shell）
- **生態系**: OpenBMC, OpenBIC, Zephyr RTOS
- **平台**: Meta oBMC (yosemite4, fby4, grandteton, gc2-es, minerva-ag) / LF oBMC
- **不適用**: 本 Automation Repo 本身的 commit（請改用 `commit-message-reviewer`）

---

## 自動執行步驟 (Autonomous Workflow)

當使用者未直接提供 diff 時，**自動執行以下步驟**，無需詢問：

```bash
# Step 1: 取得 staged 變更
git diff --cached

# Step 2: 若 staged 為空，改讀最新 commit
git log -1 --format="%s%n%n%b"
git diff HEAD~1 HEAD
```

若兩者皆為空，提示使用者：「請先 `git add` 你的變更，或提供 diff 內容。」

---

## 輸入參數 (Input)

| 參數 | 必要性 | 說明 |
|------|:------:|------|
| **DIFF** | 自動讀取 | `git diff --cached` 輸出；若使用者貼入則優先使用 |
| **PLATFORM** | 選填 | `GitHub (Meta)` / `Gerrit (LF)` / **自動判斷**（預設） |
| **CHANGE_TYPE** | 選填 | `Feature` / `Bug Fix` / `Refactor` / **自動判斷**（預設） |
| **JIRA_ID** | 選填 | 例如 `YV4T1M-1234`；若無則填 `N/A` |
| **LANGUAGE** | 選填 | `繁體中文` / `English` / **自動判斷**（預設：繁體中文） |

---

## 領域知識 (BMC Domain Knowledge)

生成時請正確使用下列術語：

- **通訊協定**: I2C, SMBus, IPMI, MCTP, D-Bus, Redfish, PLDM, NC-SI
- **核心概念**: Sensor (Thresholds, SDR), SEL (System Event Log), FRU, Watchdog, Crashdump, RAS, BIOS-to-BMC communication
- **平台名稱**: yosemite4 (YV4), fby4, grandteton, bletchley, gc2-es, minerva-ag, at-cb, at-mc
- **常見組件**: Entity Manager, dbus-sensors, phosphor-sel-logger, bmcweb, OpenBIC
- **常用工具**: `busctl`, `ipmitool`, `sensor-util`, `fw-util`, `bic-util`

---

## 規範選擇 (Platform Rules)

### 1. Meta oBMC (GitHub) 規範

**Subject 格式**:
- 單一平台: `<platform>: <改動內容>`
- 多層 prefix: `meta-<layer>: <platform>: <change>`
- 共用程式: `common: <change>`

**範例**:
- `yosemite4: add CPU temperature monitoring`
- `meta-facebook: gc2-es: fix sensor reading issue`
- `common: add new I2C driver support`

**Feature Body 必要區段** (`[META_BODY_FEATURE]`):

| 區段 | 要求 |
|------|------|
| `[Task Description]` | 描述工作目的，需包含 JIRA ID |
| `[Motivation]` | 說明為什麼需要這個功能 |
| `[Design]` | 說明新增或修改了什麼機制和流程 |
| `[Test Log]` 或 `[Test Result]` | **必須包含具體的驗證指令與結果** |

**Bug Fix Body 必要區段** (`[META_BODY_BUGFIX]`):

格式 A（標準）:

| 區段 | 要求 |
|------|------|
| `[Issue Description]` | 描述問題現象與影響，需包含 JIRA ID |
| `[Root Cause]` | 說明問題發生的根本原因 |
| `[Solution]` | 說明做了什麼改動以修復問題 |
| `[Test Log]` | **必須包含具體的驗證指令與結果** |

格式 B（替代，與 Feature 相同結構）:
- `[Task Description]` / `[Motivation]` / `[Design]` / `[Test Result]`

---

### 2. LF oBMC (Gerrit) 規範

**Subject 格式**: `<type>(<scope>): <subject>`

**有效 Type**:

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修復 bug |
| `docs` | 文件變更 |
| `style` | 格式調整（不影響邏輯） |
| `refactor` | 重構 |
| `test` | 測試相關 |
| `chore` | 建置工具、雜項 |

**Subject 規則**:
- 50 字元以內
- 使用祈使句（`Add` 而非 `Added`）
- 首字母大寫，結尾不加句號

**Body 規則**:
- 每行不超過 72 字元
- 解釋「為什麼」而非「怎麼做」

---

## 約束條件 (Constraints)

1. **禁止模糊的 Test Log**: `[Test Log]` / `[Test Result]` 不可為 "Tested and verified" 或空白。必須描述具體指令（如 `busctl`, `ipmitool`, `sensor-util`）與預期結果。
2. **禁止機敏資訊**: 嚴禁包含 API Keys、密碼、內部伺服器 IP 或個人隱私。
3. **語言規則**:
   - 繁體中文：內文使用繁體中文 (zh-TW)，技術術語保留英文
   - English：全英文（適用於開源專案如 OpenBIC、OpenBMC）
   - 自動判斷：根據 DIFF 中的註解語言決定
4. **時態**: LF 規範嚴禁使用過去式動詞（`Added` → `Add`）。

---

## 範例 (Examples)

### Meta oBMC Feature (PASS)

```
yosemite4: implement fan fail-safe mechanism

[Task Description]
- Related to YV4T1M-5678
- Implement a fail-safe mechanism that sets fans to 100% PWM when sensor data is invalid.

[Motivation]
- Prevent system overheating when thermal sensors fail or D-Bus service crashes.

[Design]
- Add a watchdog timer to the fan-control service.
- If no valid temperature update is received within 30 seconds, trigger fail-safe mode.
- Set all fan PWM outputs to 255 (100%).

[Test Log]
- Stop `dbus-sensors` service and verify fans ramp up to 100% within 30s.
- Restart service and verify fans return to normal PID control.
```

### Meta oBMC Bug Fix - 格式 A (PASS)

```
fby4: fix I2C timeout causing sensor service crash

[Issue Description]
- Related to YV4T1M-2456
- sensor-monitor service crashes when I2C communication timeout occurs.

[Root Cause]
- Exception thrown by I2C read operation is not caught.

[Solution]
- Add try-catch block around I2C read operations.

[Test Log]
- Simulate I2C bus hang and verify service continues running.
```

### Meta oBMC Bug Fix - 格式 B / 多層 prefix (PASS)

```
meta-facebook: gc2-es: fix MB_E1S_TEMP_C sensor showing NA issue

[Task Description]
- Related to GC20T5T7-40
- Fix MB_E1S_TEMP_C (SENSOR_NUM_TEMP_SSD0) sensor showing NA issue.

[Motivation]
- Fix MB_E1S_TEMP_C temperature sensor access control to prevent NA readings.
- Remove unnecessary pre-read function and mux configuration that caused sensor access issues.

[Design]
- Remove pre_nvme_read function from sensor configuration.
- Remove mux_conf_addr_0xe2[1] configuration.

[Test Result]
Verified on GC2-ES platform using sensor-util:
root@bmc-oob:~# sensor-util server --thr | grep MB_E1S_TEMP_C
MB_E1S_TEMP_C (0xD) : 37.000 C | (ok) | UCR: 75.000
```

### LF oBMC Refactor (PASS)

```
refactor(sensors): use JSON config instead of hardcoded values

Replace hardcoded sensor configuration with JSON-based config file
to improve maintainability and allow runtime updates without
recompilation.
```

### 違規範例 (FAIL)

```
# FAIL - 違反 META_SUBJECT_FORMAT（缺少 platform prefix）
Add new sensor support

# FAIL - 違反 LF_SUBJECT_RULES（過去式 + 首字母未大寫）
fixed the i2c timeout issue
```

---

## 自我驗證清單 (Self-Verification)

輸出前逐一確認：

1. [ ] 是否符合目標平台的 Subject 格式（單層或多層 prefix）？
2. [ ] 是否包含所有 MUST 區段（Task/Issue, Motivation/Root Cause, Design/Solution, Test Log/Result）？
3. [ ] Test Log / Test Result 是否足夠具體（包含指令與預期輸出）？
4. [ ] 是否誤用了過去式（針對 LF）？
5. [ ] 是否包含機敏資訊？
6. [ ] 術語是否正確（I2C, IPMI, D-Bus 等）？
7. [ ] 語言是否符合 LANGUAGE 選項要求？

---

## 輸出格式 (Output)

**直接輸出 Commit Message，不要包含任何額外的解釋或對話。**

若有多個合理的平台或類型選擇，可在 Commit Message 後附加一行說明（例如：`> 注意：若為 LF oBMC 平台，可改用 feat(sensors): ... 格式`）。

---

## 版本歷史 (Changelog)

- **v1.0.0** (2026-03-07): 初始版本，從 `ai-prompts/commit-message-generator.md` 轉換為 OpenCode Skill
  - 支援 Meta oBMC 與 LF oBMC 雙平台規範
  - 新增自動讀取 `git diff --cached` 功能
  - 明確標記適用範疇為 OpenBMC/OpenBIC C/C++ 韌體開發
