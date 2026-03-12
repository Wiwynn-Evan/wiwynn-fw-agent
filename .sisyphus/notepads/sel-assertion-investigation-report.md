# SEL Assertion 異常調查報告

**日期**: 2026-03-09
**事件時間窗口**: 2026-03-09 00:41:18 ~ 00:41:19
**調查狀態**: 研究完成，待實機驗證

---

## 一、現象解讀

### 1.1 原始 SEL 事件

在約 **1 秒** 的時間窗口內，出現兩類 SEL 事件密集連發：

| Sensor | Sensor Number | Event Data | 顯示文字 |
|--------|--------------|------------|----------|
| Unknown | 0x10 | 02FFFF | Unknown Assertion |
| CPU0_THERM_STATUS | 0x1C | 01FFFF | PROCHOT# Assertion/Deassertion |

### 1.2 解碼後的真實含義

經過 OpenBMC 原始碼比對，**兩個事件的實際意義已確認**：

- **Sensor 0x10** = `BIC_SENSOR_SYSTEM_STATUS`（BIC 離散型感測器）
  - 定義於 `common/recipes-lib/obmc-pal/files/obmc-pal.h` 第 367 行+
  - 跨平台一致：fby2、fby35、grandcanyon、cloudripper、wedge400、minipack、fuji 均定義 `BIC_SENSOR_SYSTEM_STATUS = 0x10`
  - Event Data Byte 1 = `0x02` → **`SOC_Throttle`**（CPU 被節流）
  - 解析邏輯見 `meta-facebook/meta-cloudripper/.../pal.c` 第 743 行：
    ```c
    case BIC_SENSOR_SYSTEM_STATUS:
      switch (ed[0] & 0x0F) {
        case 0x00: "SOC_Thermal_Trip"   // CPU 熱跳脫
        case 0x01: "SOC_FIVR_Fault"     // 電壓調節器故障
        case 0x02: "SOC_Throttle"       // ← 我們的事件！CPU 節流
        case 0x03: "PCH_HOT"            // PCH 過熱
      }
    ```
  - SEL 工具顯示 "Unknown" 是因為**平台 SDR 缺少此 Sensor 的人類可讀名稱映射**，不代表事件本身未知

- **Sensor 0x1C** = `CPU0_THERM_STATUS`（CPU 熱狀態感測器）
  - 定義於 `common/recipes-lib/obmc-pal/files/obmc-pal.h`：`CPU0_THERM_STATUS = 0x1C`
  - Event Data Byte 1 = `0x01` → **PROCHOT# Assertion**（CPU 透過 PROCHOT# 引腳發出熱節流信號）

- **`FFFF`**（Event Data Byte 2-3）= **未使用/未指定** — 離散型感測器的標準 IPMI 行為，僅 Byte 1 攜帶實際資訊

### 1.3 因果關聯

**這兩個事件描述的是同一個物理現象**，透過兩條不同的感測器路徑上報：

```
CPU 溫度超過閾值
  ├─→ CPU 硬體拉低 PROCHOT# 引腳
  │     ├─→ BMC gpiod 偵測 GPIO 變化 → 記錄 SEL (Sensor 0x1C: PROCHOT# Assertion)
  │     └─→ BIC 偵測到 SOC_Throttle → 記錄 SEL (Sensor 0x10: SOC_Throttle)
  └─→ CPU 自動降頻節流
```

兩個事件在 **1 秒內連發** 的原因：
1. PROCHOT# 是硬體信號，GPIO 輪詢與 BIC 偵測幾乎同時觸發
2. 溫度在閾值邊界**振盪**（oscillation）時，會反覆 assert/deassert，產生大量事件
3. GPIO 輪詢間隔（通常 1 秒）加上 BIC 上報延遲，使事件集中在同一秒

---

## 二、假設與證據（Top 3 根因排名）

### RC1（最可能 ~60%）：開機/上電暫態熱衝擊

**假設**: 在 POST 或上電過程中，CPU 瞬間電流突增導致溫度暫時超過 PROCHOT 閾值，觸發短暫節流，隨後溫度回落。

**支持證據**:
- 事件時間 `00:41:18` 可能對應開機/重啟時間點
- 事件在 1 秒內即停止 → 暫態現象，非持續過熱
- PROCHOT# 出現 Assertion **和** Deassertion → 溫度快速回落到閾值以下
- 開機時 VR（電壓調節器）啟動瞬間電流最大，是已知的暫態熱峰值來源

**反對證據**:
- 需確認 `00:41:18` 是否確實為開機時間（查 `last reboot` 或 power-on SEL）
- 如果系統已穩定運行數小時後出現，則此假設不成立

### RC2（中等可能 ~25%）：感測器去抖（Debounce）不足

**假設**: gpiod 對 PROCHOT# GPIO 的輪詢缺乏足夠的去抖機制，溫度在閾值邊界微小波動（±0.5°C）即產生大量 assert/deassert 事件。

**支持證據**:
- `gpiod.c` 中 `cpu_prochot_handler()` 在偵測到 GPIO 變化時直接記錄 SEL，無明顯去抖邏輯
- BIC 端同樣直接上報 `SOC_Throttle`，兩條路徑均無去抖
- 1 秒內多筆事件 → 典型的閾值邊界振盪行為

**反對證據**:
- 如果事件只出現一對（1 assert + 1 deassert），則不是去抖問題
- 需確認實際事件筆數（`ipmitool sel list | grep -c "0x10\|THERM"`)

### RC3（較低可能 ~15%）：VR 過熱或電源傳輸不穩

**假設**: 電壓調節器（VR）本身過熱或電源傳輸瞬間不穩，觸發 VRHOT 信號，間接引起 PROCHOT# 和 SOC_Throttle。

**支持證據**:
- `throttle-util.c`（meta-grandcanyon）顯示 PROCHOT 與 VRHOT 是相鄰信號（Bit 3 vs Bit 2）
- `prochot_reason()` 函式檢查多種原因：UV（欠壓）、OC（過流）、Timer 過期、PMBus Alert
- VR 過熱會同時觸發 PROCHOT# 和 SOC_Throttle

**反對證據**:
- 需要 VR 溫度感測器數據佐證（`ipmitool sensor list | grep -i vr`）
- 如果 VR 溫度正常，則此假設排除

---

## 三、驗證命令（實機操作步驟）

### 🔴 先做這三件事（Triage 優先順序）

**第一步：確認事件完整上下文**
```bash
# 列出完整 SEL，確認事件前後是否有 power-on/reset 事件
ipmitool sel list

# 計算 0x10 和 0x1C 事件的精確數量
ipmitool sel list | grep -c "0x10"
ipmitool sel list | grep -c "THERM_STATUS"

# 確認系統最近一次啟動時間
last reboot
uptime
```

**第二步：確認當前熱狀態**
```bash
# 讀取所有溫度相關感測器
ipmitool sensor list | grep -iE "temp|therm|prochot"

# 讀取 CPU 溫度（確認當前是否過熱）
ipmitool sdr list | grep -i cpu

# 讀取 VR 溫度（排除 RC3）
ipmitool sensor list | grep -iE "vr|volt|power"
```

**第三步：確認 PROCHOT GPIO 當前狀態**
```bash
# 查看 gpiod 日誌（確認 PROCHOT 處理流程）
journalctl -u gpiod --since "2026-03-09 00:41:00" --until "2026-03-09 00:42:00"

# 查看 dmesg 中的熱事件
dmesg | grep -iE "therm|prochot|throttl"

# 查看 BIC 相關日誌
journalctl | grep -i bic | tail -50
```

### 進階驗證

**驗證 RC1（開機暫態）**:
```bash
# 確認 00:41:18 是否為開機時間
ipmitool sel list | grep -iE "power|boot|reset" | head -20

# 查看系統啟動紀錄
journalctl --list-boots
journalctl -b 0 | head -30  # 最近一次啟動的最早日誌
```

**驗證 RC2（去抖不足）**:
```bash
# 確認事件是否為快速重複（同一秒內多筆）
ipmitool sel list | grep "00:41:1[89]"

# 如果有 raw SEL 存取能力，確認精確時間戳
ipmitool sel get <entry_id>  # 對每筆可疑事件
```

**驗證 RC3（VR 問題）**:
```bash
# 讀取 VR 相關感測器
ipmitool sensor list | grep -iE "vcore|pvccin|vr"

# 如果平台支援 throttle-util
throttle-util --read  # 讀取節流源控制暫存器
```

---

## 四、修復建議

### 4.1 即時緩解（Immediate Mitigation）

| 動作 | 優先級 | 說明 |
|------|--------|------|
| 確認散熱硬體 | P0 | 檢查 CPU 散熱器安裝、風扇轉速、散熱膏塗佈 |
| 調高 PROCHOT 閾值 | P1 | 如果是邊界振盪，適當調高 2-3°C 可避免誤觸發（需 BIOS 設定或 VR 配置） |
| 清除 SEL | P2 | 確認根因後清除歷史 SEL：`ipmitool sel clear` |

### 4.2 長期修復（Long-term Fix）

#### Fix 1：為 gpiod PROCHOT handler 加入去抖機制

**目標檔案**: `meta-facebook/meta-grandcanyon/recipes-grandcanyon/gpiod/files/gpiod.c`（或對應平台）

**修改方向**:
```c
// 現狀：偵測到 GPIO 變化即立刻記錄 SEL
static void cpu_prochot_handler(gpiopoll_pin_t *desc, gpio_value_t last, gpio_value_t curr) {
  syslog(LOG_CRIT, "PROCHOT %s", curr ? "DEASSERTED" : "ASSERTED");
  // 直接記錄，無去抖
}

// 建議：加入去抖計時器（500ms）
static void cpu_prochot_handler(gpiopoll_pin_t *desc, gpio_value_t last, gpio_value_t curr) {
  static struct timespec last_event = {0};
  struct timespec now;
  clock_gettime(CLOCK_MONOTONIC, &now);
  
  long diff_ms = (now.tv_sec - last_event.tv_sec) * 1000 +
                 (now.tv_nsec - last_event.tv_nsec) / 1000000;
  
  if (diff_ms < 500) return;  // 500ms 去抖窗口
  last_event = now;
  
  syslog(LOG_CRIT, "PROCHOT %s", curr ? "DEASSERTED" : "ASSERTED");
}
```

**注意**：此修改需走 `fw-code-researcher` → `fw-code-writer` → `fw-pr-reviewer` 完整流程。

#### Fix 2：修正 SDR 映射，消除 "Unknown" 顯示

**問題**: Sensor 0x10 (`BIC_SENSOR_SYSTEM_STATUS`) 在該平台的 SDR 中缺少人類可讀名稱
**目標**: 在對應平台的 `pal_get_sensor_name()` 或 SDR 定義中加入 0x10 的名稱映射

#### Fix 3：BIC 端 SOC_Throttle 上報增加去抖

**目標**: 在 OpenBIC 的 `plat_sensor_table.c` 或對應的離散感測器輪詢邏輯中，為 SOC_Throttle 事件加入去抖

---

## 五、風險與下一步

### 5.1 風險評估

| 風險 | 等級 | 說明 |
|------|------|------|
| 硬體過熱損壞 | 🔴 高 | 如果 PROCHOT 反映真實持續過熱，需立即處理 |
| SEL 溢出 | 🟡 中 | 大量重複事件可能填滿 SEL buffer，遺失重要事件 |
| 去抖修改遺漏真實事件 | 🟡 中 | 去抖窗口過大可能隱藏真正的熱問題 |
| 跨平台影響 | 🟡 中 | `BIC_SENSOR_SYSTEM_STATUS` 為跨平台定義，修改需評估影響範圍 |

### 5.2 下一步行動

1. **立即**（今天）：
   - 執行「先做這三件事」的驗證命令
   - 根據結果判斷是 RC1/RC2/RC3

2. **短期**（本週）：
   - 如確認為 RC2（去抖不足），開 JIRA ticket，走 `/fw-dev` 流程修改 `gpiod.c`
   - 如確認為 RC1（開機暫態），評估是否需要調整 PROCHOT 閾值

3. **長期**（本月）：
   - 修正 SDR 映射，消除 "Unknown" 顯示問題
   - 評估 BIC 端是否需要同步加入去抖機制
   - 建立 PROCHOT 事件的監控告警規則，區分暫態與持續性事件

### 5.3 調查所需但尚未取得的證據

- [ ] 完整 SEL dump（確認事件精確數量和時間分佈）
- [ ] 系統啟動時間紀錄（確認是否為開機暫態）
- [ ] CPU/VR 溫度感測器歷史數據
- [ ] 風扇轉速紀錄
- [ ] BIOS PROCHOT 閾值設定值
- [ ] 該平台的具體 SDR（確認為何 0x10 顯示 Unknown）

---

## 附錄：關鍵原始碼位置

| 用途 | 檔案路徑（facebook/openbmc） |
|------|------------------------------|
| Sensor 編號定義 | `common/recipes-lib/obmc-pal/files/obmc-pal.h` |
| BIC_SENSOR_SYSTEM_STATUS 事件解析 | `meta-facebook/meta-cloudripper/.../pal.c` L743+ |
| PROCHOT GPIO 處理 | `meta-facebook/meta-grandcanyon/.../gpiod.c` |
| 節流源暫存器讀取 | `meta-facebook/meta-grandcanyon/.../throttle-util.c` |
| BIC 感測器定義 | `meta-facebook/meta-fby35/.../pal_sensors.h` |
| OpenBIC 平台感測器表 | `facebook/OpenBIC` `src/platform/gc2-es/plat_sensor_table.c` |
