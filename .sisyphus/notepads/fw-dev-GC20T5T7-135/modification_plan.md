# 修改方案：GC20T5T7-135
**分析來源**: jira-deep-analysis 報告 (analysis.md)
**目標 Repository**: facebook/openbmc
**目標平台**: Grand Canyon 2.0 (GC2.0) oBMC Linux
**日期**: 2026-03-10
**修復策略**: 方案 2 — 啟用 bic_health + 修復 PAL 層容錯 + 重設後冷卻期

---

## 摘要

GC2.0 平台的 BIC health monitoring 功能目前被禁用（`bic_health.enabled = false`）。啟用後，healthd 的 `bic_health_monitor` thread 可能因為：(1) KV store 未初始化時 `pal_is_bic_heartbeat_ok()` 直接返回 false，(2) BIC 被重設後缺乏冷卻期導致重設死循環，而意外觸發 BIC 硬體重設。

本修改方案包含三個修改點：
1. **啟用 bic_health** — 修改 GC2.0 healthd-config.json
2. **修復 KV store 容錯** — 修改 `pal_is_bic_heartbeat_ok()` 使 KV 讀取失敗時返回 true（寬容）
3. **增加重設後冷卻期** — 修改 `pal_bic_hw_reset()` 記錄重設時間，`pal_is_bic_heartbeat_ok()` 在冷卻期內返回 true

---

## 需修改的檔案清單

| # | 檔案路徑 | 變更類型 | 說明 |
|---|---------|---------|------|
| 1 | `meta-facebook/meta-grandcanyon/meta-grandcanyon2/recipes-grandcanyon2/healthd/files/healthd-config.json` | 修改 | `bic_health.enabled`: false → true |
| 2 | `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c` | 修改 | 增強 `pal_is_bic_heartbeat_ok()` 容錯 + 增加 `pal_bic_hw_reset()` 冷卻機制 |

---

## 各檔案具體修改

### 1. `meta-facebook/meta-grandcanyon/meta-grandcanyon2/recipes-grandcanyon2/healthd/files/healthd-config.json`

**修改理由**: GC2.0 overlay 目前禁用了 BIC health monitoring。Issue GC20T5T7-135 的目標是讓此功能在 GC2.0 上正常運作。GC2 base layer 已啟用此功能（`enabled: true`），GC2.0 overlay 刻意覆蓋為 `false`。
**參考來源**: GC2 base layer `meta-facebook/meta-grandcanyon/recipes-grandcanyon/healthd/files/healthd-config.json` (line 91-95) 已啟用。

#### 原始程式碼（line 91-95）

```json
  "bic_health": {
    "enabled": false,
    "fru": [1],
    "monitor_interval": 60
  },
```

#### 修改後

```diff
   "bic_health": {
-    "enabled": false,
+    "enabled": true,
     "fru": [1],
     "monitor_interval": 60
   },
```

---

### 2. `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c`

本檔案需要兩處修改：

#### 2A. 修改 `pal_is_bic_heartbeat_ok()` — 增加 KV store 容錯 + 重設後冷卻期

**修改理由**:
- **KV 容錯**: 原始實作在 `kv_get(KV_KEY_BIC_HEARTBEAT, val, NULL, 0)` 失敗時直接返回 `false`。healthd 啟動早期、front-paneld 尚未寫入初始值時，KV key 不存在導致 `kv_get` 返回 -1，`pal_is_bic_heartbeat_ok` 返回 false，healthd 誤判為 heartbeat failure。連續 3 次（3 × 60s = 180s）即觸發 BIC 硬體重設。
- **冷卻期**: BIC 被 `pal_bic_hw_reset()` 重設後需要時間 boot（通常 30-60 秒）。在此期間，heartbeat 的 KV 值不會更新，healthd 會再次偵測到 failure。雖然 `is_already_reset` flag 防止立即再次重設，但一旦 BIC 短暫恢復後 `is_already_reset` 被清除，如果 heartbeat 更新仍不穩定，就會進入重設死循環。
- **front-paneld 更新頻率確認**: `MONITOR_HB_HEALTH_INTERVAL = 5 秒`，front-paneld 每 5 秒呼叫 `pal_is_heartbeat_ok(HEARTBEAT_BIC)` 更新 KV。healthd 每 60 秒檢查一次。正常情況下，60 秒內 front-paneld 會更新 12 次 KV，頻率足夠。問題僅在 KV 尚未初始化或 BIC 重設後的過渡期。

**參考來源**:
- weak default `obmc-pal.c:3574` 返回 `PAL_ENOTSUP`（非零 = true），代表未實作平台預設為 heartbeat OK
- GC2 `pal_is_heartbeat_ok()` at line 2916-2938 — 寫入 KV 的函式
- front-paneld `heartbeat_health_handler()` at line 285-376 — 每 5 秒呼叫 heartbeat 更新

#### 原始程式碼（line 3337-3363）

```c
bool
pal_is_bic_heartbeat_ok(uint8_t fru) {
  uint8_t power_status = 0, server_present = 0;
  int ret = 0;
  char val[MAX_VALUE_LEN] = {0};

  if (fru != FRU_SERVER) {
    syslog(LOG_WARNING, "%s(): FRU %x does not have BIC component", __func__, fru);
    return PAL_ENOTSUP;
  }

  ret = pal_is_fru_prsnt(fru, &server_present);
  if ((ret == 0) && (server_present == FRU_ABSENT)) {
    return true;
  }

  ret = pal_get_server_12v_power(fru, &power_status);
  if ((ret == 0) && (power_status == SERVER_12V_OFF)) {
    return true;
  }

  if (kv_get(KV_KEY_BIC_HEARTBEAT, val, NULL, 0)) {
    return false;
  }

  return atoi(val);
}
```

#### 修改後

```diff
+// Cooldown period after BIC HW reset (seconds).
+// During this window, pal_is_bic_heartbeat_ok() returns true
+// so healthd skips heartbeat check while BIC is rebooting.
+#define BIC_RESET_COOLDOWN_SEC  120
+
+static time_t last_bic_reset_ts = 0;
+
 bool
 pal_is_bic_heartbeat_ok(uint8_t fru) {
   uint8_t power_status = 0, server_present = 0;
   int ret = 0;
   char val[MAX_VALUE_LEN] = {0};
 
   if (fru != FRU_SERVER) {
     syslog(LOG_WARNING, "%s(): FRU %x does not have BIC component", __func__, fru);
     return PAL_ENOTSUP;
   }
 
   ret = pal_is_fru_prsnt(fru, &server_present);
   if ((ret == 0) && (server_present == FRU_ABSENT)) {
     return true;
   }
 
   ret = pal_get_server_12v_power(fru, &power_status);
   if ((ret == 0) && (power_status == SERVER_12V_OFF)) {
     return true;
   }
 
+  // Skip heartbeat check during BIC reset cooldown period
+  if (last_bic_reset_ts != 0) {
+    time_t now = time(NULL);
+    if ((now - last_bic_reset_ts) < BIC_RESET_COOLDOWN_SEC) {
+      return true;
+    }
+    last_bic_reset_ts = 0;  // Cooldown expired, resume normal check
+  }
+
   if (kv_get(KV_KEY_BIC_HEARTBEAT, val, NULL, 0)) {
-    return false;
+    syslog(LOG_WARNING, "%s(): failed to get %s from KV store, treating as OK",
+           __func__, KV_KEY_BIC_HEARTBEAT);
+    return true;  // KV not yet initialized, be tolerant
   }
 
   return atoi(val);
 }
```

**設計說明**:
1. **KV 容錯**: `kv_get` 失敗時改為返回 `true`（heartbeat OK），避免 healthd 誤判。增加 `syslog` 警告供 debug。這是安全的，因為如果 BIC 真的掛了，`pal_is_bic_ready()` 和 `pal_bic_self_test()` 這兩個前置檢查會先攔截到問題。
2. **冷卻期**: 使用 static 變數 `last_bic_reset_ts` 記錄最後重設時間。在 `BIC_RESET_COOLDOWN_SEC`（120 秒）內，直接返回 true。冷卻期結束後清除時間戳恢復正常檢查。120 秒足以涵蓋 BIC boot 時間（30-60 秒）加上 front-paneld 開始更新 KV 的時間。

---

#### 2B. 修改 `pal_bic_hw_reset()` — 記錄重設時間

**修改理由**: 配合 2A 的冷卻機制，在 BIC 硬體重設成功後記錄時間戳，讓 `pal_is_bic_heartbeat_ok()` 知道 BIC 正在 reboot。
**參考來源**: GC2 原始 `pal_bic_hw_reset()` at line 3365-3377

#### 原始程式碼（line 3365-3377）

```c
int
pal_bic_hw_reset(void) {
  if (gpio_set_value_by_shadow(fbgc_get_gpio_name(GPIO_UIC_COMP_BIC_RST_N), GPIO_VALUE_LOW) < 0) {
    syslog(LOG_WARNING, "%s(): failed to reset BIC by hardware", __func__);
    return -1;
  }
  sleep(1);
  if (gpio_set_value_by_shadow(fbgc_get_gpio_name(GPIO_UIC_COMP_BIC_RST_N), GPIO_VALUE_HIGH) < 0) {
    syslog(LOG_WARNING, "%s(): failed to reset BIC by hardware", __func__);
    return -1;
  }

  return 0;
}
```

#### 修改後

```diff
 int
 pal_bic_hw_reset(void) {
   if (gpio_set_value_by_shadow(fbgc_get_gpio_name(GPIO_UIC_COMP_BIC_RST_N), GPIO_VALUE_LOW) < 0) {
     syslog(LOG_WARNING, "%s(): failed to reset BIC by hardware", __func__);
     return -1;
   }
   sleep(1);
   if (gpio_set_value_by_shadow(fbgc_get_gpio_name(GPIO_UIC_COMP_BIC_RST_N), GPIO_VALUE_HIGH) < 0) {
     syslog(LOG_WARNING, "%s(): failed to reset BIC by hardware", __func__);
     return -1;
   }
 
+  // Record reset timestamp for cooldown mechanism in pal_is_bic_heartbeat_ok()
+  last_bic_reset_ts = time(NULL);
+
   return 0;
 }
```

---

## 需要新增的 include（確認）

檢查 pal.c 的現有 includes（line 35-43）：

```c
#include <pthread.h>
#include <math.h>
#include <openbmc/obmc-sensors.h>
#include <openbmc/libgpio.h>
#include <openbmc/phymem.h>
#include <openbmc/obmc-i2c.h>
#include <facebook/fbgc_gpio.h>
#include <sys/un.h>
#include "pal.h"
```

`time()` 函式需要 `<time.h>`。檢查是否已存在：pal.c 開頭的 includes 列表中**沒有** `<time.h>`，但 `<time.h>` 通常已被其他 header 間接引入（如 `<pthread.h>` 或系統標準 header）。然而，為了明確性和可移植性，建議確認是否需要新增。

**建議**: 在 pal.c 中 `<time.h>` 可能已通過 `<pthread.h>` 間接引入。如果編譯報錯 `time()` 未宣告，則需新增 `#include <time.h>`。

---

## 修改依賴順序

1. **pal.c** — 先修改 PAL 函式（`pal_is_bic_heartbeat_ok` + `pal_bic_hw_reset`），確保容錯邏輯就緒
2. **healthd-config.json** — 再啟用 `bic_health`，此時 PAL 層已有防護

> 注意：雖然兩個修改在不同檔案中，理論上可同時 commit。但測試時建議先驗證 PAL 修改的編譯正確性，再啟用 config。

---

## 完整原始碼參考

### pal_is_bic_heartbeat_ok() — 完整原始碼（line 3337-3363）

```c
bool
pal_is_bic_heartbeat_ok(uint8_t fru) {
  uint8_t power_status = 0, server_present = 0;
  int ret = 0;
  char val[MAX_VALUE_LEN] = {0};

  if (fru != FRU_SERVER) {
    syslog(LOG_WARNING, "%s(): FRU %x does not have BIC component", __func__, fru);
    return PAL_ENOTSUP;
  }

  ret = pal_is_fru_prsnt(fru, &server_present);
  if ((ret == 0) && (server_present == FRU_ABSENT)) {
    return true;
  }

  ret = pal_get_server_12v_power(fru, &power_status);
  if ((ret == 0) && (power_status == SERVER_12V_OFF)) {
    return true;
  }

  if (kv_get(KV_KEY_BIC_HEARTBEAT, val, NULL, 0)) {
    return false;
  }

  return atoi(val);
}
```

### pal_bic_hw_reset() — 完整原始碼（line 3365-3377）

```c
int
pal_bic_hw_reset(void) {
  if (gpio_set_value_by_shadow(fbgc_get_gpio_name(GPIO_UIC_COMP_BIC_RST_N), GPIO_VALUE_LOW) < 0) {
    syslog(LOG_WARNING, "%s(): failed to reset BIC by hardware", __func__);
    return -1;
  }
  sleep(1);
  if (gpio_set_value_by_shadow(fbgc_get_gpio_name(GPIO_UIC_COMP_BIC_RST_N), GPIO_VALUE_HIGH) < 0) {
    syslog(LOG_WARNING, "%s(): failed to reset BIC by hardware", __func__);
    return -1;
  }

  return 0;
}
```

### pal_is_heartbeat_ok() — 完整原始碼（line 2916-2938, KV writer）

```c
bool
pal_is_heartbeat_ok(uint8_t component) {
  char label[MAX_PWM_LABEL_LEN] = {0};
  char kv_value[MAX_VALUE_LEN] = {0};
  float hb_val = 0;
  bool is_read = false;

  snprintf(label, sizeof(label), "fan%d", component);

  // get heartbeat from tacho driver
  if (sensors_read_fan(label, &hb_val) < 0) {
    syslog(LOG_WARNING, "%s(): fail to get heartbeat, component = %d", __func__, component);
  } else if (hb_val != 0) {
    is_read = true;
  }

  if (component == HEARTBEAT_BIC) { // cache BIC heartbeat reading for healthd
    snprintf(kv_value, sizeof(kv_value), "%d", is_read);
    kv_set(KV_KEY_BIC_HEARTBEAT, kv_value, 0, 0);
  }

  return is_read;
}
```

### healthd-config.json (GC2.0) — 完整檔案（102 lines）

```json
{
  "version": "1.0",
  "log_rearm": true,
  "heartbeat": {
    "interval": 25
  },
  "bmc_cpu_utilization" : {
    "enabled": true,
    "window_size": 120,
    "monitor_interval": 1,
    "threshold": [
      {
        "value": 85.0,
        "hysteresis" : 5.0,
        "action": ["log-warning", "bmc-error-trigger"]
      }
    ]
  },
  "bmc_mem_utilization" : {
    "enabled": true,
    "enable_panic_on_oom": true,
    "window_size": 120,
    "monitor_interval": 1,
    "threshold": [
      {
        "value": 70.0,
        "hysteresis" : 5.0,
        "action": ["log-critical", "bmc-error-trigger"]
      },
      {
        "value": 95.0,
        "hysteresis" : 5.0,
        "action": ["log-critical", "bmc-error-trigger", "reboot"]
      }
    ]
  },
  "i2c": {
    "enabled": false,
    "busses": [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
  },
  "ecc_monitoring" : {
    "enabled": true,
    "ecc_address_log": true,
    "monitor_interval": 2,
    "recov_max_counter": 255,
    "unrec_max_counter": 15,
    "recov_threshold": [
      {
        "value": 0.0,
        "action": ["log-warning", "bmc-error-trigger"]
      },
      {
        "value": 2.0,
        "action": ["log-critical"]
      },
      {
        "value": 50.0,
       "action": ["log-critical"]
      },
      {
        "value": 90.0,
        "action": ["log-critical"]
      }
    ],
    "unrec_threshold": [
      {
        "value": 0.0,
        "action": ["log-critical", "bmc-error-trigger"]
      },
      {
        "value": 50.0,
        "action": ["log-critical"]
      },
      {
        "value": 90.0,
        "action": ["log-critical"]
      }
    ]
  },
  "bmc_health": {
    "enabled": false,
    "monitor_interval": 2,
    "regenerating_interval": 1200
  },
  "verified_boot": {
    "enabled": true
  },
  "bmc_timestamp": {
    "enabled": true
  },
  "bic_health": {
    "enabled": false,
    "fru": [1],
    "monitor_interval": 60
  },
  "nm_monitor": {
    "enabled": false,
    "retry_threshold": 2,
    "nm_transmission_via_bic": true
  }
}
```

### front-paneld heartbeat_health_handler() — 關鍵時序常數

```c
#define MONITOR_HB_HEALTH_INTERVAL        5 //second
#define HEARTBEAT_TIMEOUT                 180 // second = 3 mins
```

front-paneld 每 5 秒呼叫 `pal_is_heartbeat_ok(HEARTBEAT_BIC)` → 讀取 fan1 tacho → 更新 `bic_hb_status` KV。

### bic_health_monitor() — healthd 完整程式碼（line 1816-1905）

```c
static void *
bic_health_monitor(void* bic_fru_id) {
  int err_cnt = 0;
  int i = 0;
  uint8_t status = 0;
  uint8_t err_type[BIC_RESET_ERR_CNT] = {0};
  uint8_t type = 0;
  const char* err_str[BIC_ERR_TYPE_CNT] = {
    "heartbeat", "IPMB/PLDM", "BIC ready"
  };
  char err_log[MAX_LOG_SIZE] = "\0";
  char bic_health_key[MAX_KEY_LEN] = "\0";
  bool is_already_reset = false;
  bool is_log = false;

  uint8_t fru = *((uint8_t *) bic_fru_id);

  // set flag to notice BMC healthd bic_health_monitor is ready
  snprintf(bic_health_key, sizeof(bic_health_key), "flag_healthd_bic_fru%u_health", fru);
  kv_set(bic_health_key, "1", 0, 0);

  while (1) {
    if ((pal_get_server_12v_power(fru, &status) < 0) || (status == SERVER_12V_OFF)) {
      goto next_run;
    }

    // Check if bic is updating
    if (pal_is_fw_update_ongoing(fru) == true) {
      err_cnt = 0;
      sleep(bic_monitor_interval);
      continue;
    }

    // Read BIC ready pin to check BIC boots up completely
    if ((pal_is_bic_ready(fru, &status) == PAL_EOK) && (status == false)) {
      err_type[err_cnt++] = BIC_READY_ERR;
      goto next_run;
    }

    // Check whether BIC heartbeat works
    if (pal_is_bic_heartbeat_ok(fru) == false) {
      err_type[err_cnt++] = BIC_HB_ERR;
      goto next_run;
    }

    // Send a IPMB/PLDM command to check IPMB/PLDM service works normal
    if (pal_bic_self_test(fru) < 0) {
      err_type[err_cnt++] = BIC_IPMB_PLDM_ERR;
      goto next_run;
    }
    // if all check pass, clear error counter and reset flag
    err_cnt = 0;
    is_already_reset = false;

    // The ME commands are transmit via BIC on Grand Canyon, so check ME health when BIC health is good.
    if ((nm_monitor_enabled == true) && (nm_transmission_via_bic == true)) {
      nm_selftest(fru);
    }
next_run:
    if ((err_cnt >= BIC_RESET_ERR_CNT) && (is_already_reset == false) && (is_log == false)) {
      // if error counter over 3, reset BIC by hardware
      memset(err_log, 0, sizeof(err_log));
      strcat(err_log, "ERR Order: ");
      for (i = 0; i < BIC_RESET_ERR_CNT; i++) {
        type = err_type[i];
        strcat(err_log, err_str[type]);
        if (i != BIC_RESET_ERR_CNT - 1) { // last one
          strcat(err_log, ", ");
        }
      }
      // Support BIC HW RESET
      if (pal_bic_hw_reset() == PAL_EOK) {
        syslog(LOG_CRIT, "ASSERT: FRU: %u BIC_HEALTH, BIC HW RESET, %s", fru, err_log);
        err_cnt = 0;
        is_already_reset = true;
        // Not Support BIC HW RESET, Print SEL
      } else if (pal_bic_hw_reset() == PAL_ENOTSUP) {
        syslog(LOG_CRIT, "ASSERT: FRU: %u BIC_HEALTH, %s", fru, err_log);
        is_log = true;
      } else {
        syslog(LOG_CRIT, "ASSERT: FRU: %u BIC_HEALTH, BIC HW RESET Failed, %s", fru, err_log);
      }
    }
    sleep(bic_monitor_interval);
  }

  return NULL;
}
```

### healthd 關鍵常數

```c
#define BIC_HEALTH_INTERVAL 60 //seconds
#define BIC_RESET_ERR_CNT   3
```

healthd 每 60 秒檢查一次，連續 3 次失敗觸發 BIC 硬體重設。

---

## 潛在風險

| # | 風險 | 影響 | 緩解方式 |
|---|------|------|---------|
| 1 | KV 容錯可能掩蓋真正的 heartbeat failure | 如果 KV store 持續讀取失敗（非正常情況），heartbeat 檢查形同虛設 | `pal_is_bic_ready()` 和 `pal_bic_self_test()` 是前置檢查，會先攔截 BIC 真正掛掉的情況。加上 syslog 警告，長期 KV 異常會被 log 記錄 |
| 2 | 120 秒冷卻期太長/太短 | 太長：BIC 真的異常時無法及時偵測。太短：BIC 還沒完全啟動就恢復檢查 | 120 秒是保守值（BIC boot 約 30-60 秒 + buffer）。冷卻期內 `pal_bic_self_test()` 和 `pal_is_bic_ready()` 仍正常運作，僅跳過 heartbeat 檢查 |
| 3 | `static time_t last_bic_reset_ts` 在多 FRU 場景下共用 | GC2 只有 `FRU_SERVER` 一個 BIC（`"fru": [1]`），不存在多 FRU 衝突 | 如果未來擴展為多 FRU，需改為 per-FRU 的時間戳陣列 |
| 4 | `time()` 在 BMC 啟動初期可能返回錯誤時間 | BMC 可能還沒 NTP sync，時間戳不準確 | `time()` 即使不準，`time(NULL) - last_bic_reset_ts` 的差值仍是正確的（因為兩者都基於同一系統時鐘） |
| 5 | healthd.c 的 double-call bug 未修復 | `pal_bic_hw_reset()` 若第一次返回 -1，else if 會再次呼叫造成第二次 GPIO toggle | 此為方案 3 範圍（修改 common/healthd.c），本次方案 2 不納入。但因 GC2 的 GPIO 操作通常成功（第一次返回 0），此 bug 被觸發的概率低 |

---

## 不在本次修改範圍的項目

以下項目屬方案 3 或超出當前 scope，**不應在本次修改中實作**：

| 項目 | 理由 |
|------|------|
| 修改 `common/recipes-core/healthd/files/healthd.c` 的 double-call bug | 屬方案 3，修改 common/ 需要 upstream review，影響所有平台 |
| 修改 `pal_bic_self_test()` 增加 retry | 超出方案 2 scope，且 IPMB command 已有內建 retry |
| 修改 front-paneld 的 heartbeat 更新頻率 | 目前 5 秒已足夠，不需要調整 |

---

## 建議測試方式

### 編譯驗證
- [ ] `bitbake fbgc-image` — 確認 GC2.0 image 編譯成功
- [ ] 確認 `pal_is_bic_heartbeat_ok` 和 `pal_bic_hw_reset` 無編譯警告

### 功能驗證
- [ ] 啟用 `bic_health` 後，healthd 正常啟動且 `flag_healthd_bic_fru1_health` 設為 "1"
- [ ] BIC 正常運行時，healthd 不觸發 BIC 重設（持續運行 24hr+）
- [ ] `kv get bic_hb_status` 值被 front-paneld 正常更新（值為 "1"）
- [ ] 手動清除 KV (`kv del bic_hb_status`) → healthd 不觸發重設，syslog 出現 WARNING

### 異常場景驗證
- [ ] healthd 啟動時 front-paneld 尚未更新 heartbeat → 不應觸發 BIC 重設（KV 容錯生效）
- [ ] BIC FW update 期間 → healthd 應跳過檢查（`pal_is_fw_update_ongoing` = true）
- [ ] 12V power off 時 → healthd 應跳過檢查
- [ ] BIC 真的掛掉時 → healthd 應成功重設 BIC 一次，冷卻期 120 秒內不再重設
- [ ] 冷卻期結束後 BIC 已恢復 → heartbeat 正常，不再觸發重設

### Log 驗證
- [ ] 正常運行時無 `BIC_HEALTH` 相關 CRIT log
- [ ] KV 容錯觸發時出現 `WARNING: pal_is_bic_heartbeat_ok(): failed to get bic_hb_status from KV store, treating as OK`
- [ ] BIC 重設時出現 `CRIT: ASSERT: FRU: 1 BIC_HEALTH, BIC HW RESET, ERR Order: ...`
- [ ] 重設後冷卻期內，heartbeat 檢查被跳過（可透過增加 debug log 確認）

---

## 供 fw-code-writer 的完整修改說明

### 修改 1: healthd-config.json
- **檔案**: `meta-facebook/meta-grandcanyon/meta-grandcanyon2/recipes-grandcanyon2/healthd/files/healthd-config.json`
- **行號**: 92
- **變更**: 將 `"enabled": false` 改為 `"enabled": true`
- **無其他變更**

### 修改 2: pal.c — 新增定義和 static 變數
- **檔案**: `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c`
- **位置**: 在 `pal_is_bic_heartbeat_ok()` 函式定義之前（line 3336 和 3337 之間）
- **新增內容**:
  ```c
  // Cooldown period after BIC HW reset (seconds).
  // During this window, pal_is_bic_heartbeat_ok() returns true
  // so healthd skips heartbeat check while BIC is rebooting.
  #define BIC_RESET_COOLDOWN_SEC  120

  static time_t last_bic_reset_ts = 0;
  ```

### 修改 3: pal.c — 修改 pal_is_bic_heartbeat_ok()
- **檔案**: `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c`
- **行號**: 3355-3363（函式內部）
- **變更 A**: 在 12V power check 之後（line 3355 `return true;` 之後），`kv_get` 之前，插入冷卻期檢查：
  ```c
  // Skip heartbeat check during BIC reset cooldown period
  if (last_bic_reset_ts != 0) {
    time_t now = time(NULL);
    if ((now - last_bic_reset_ts) < BIC_RESET_COOLDOWN_SEC) {
      return true;
    }
    last_bic_reset_ts = 0;  // Cooldown expired, resume normal check
  }
  ```
- **變更 B**: 將 `kv_get` 失敗時的返回值從 `false` 改為 `true`，並增加 syslog：
  ```c
  if (kv_get(KV_KEY_BIC_HEARTBEAT, val, NULL, 0)) {
    syslog(LOG_WARNING, "%s(): failed to get %s from KV store, treating as OK",
           __func__, KV_KEY_BIC_HEARTBEAT);
    return true;  // KV not yet initialized, be tolerant
  }
  ```

### 修改 4: pal.c — 修改 pal_bic_hw_reset()
- **檔案**: `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c`
- **行號**: 3376（`return 0;` 之前）
- **變更**: 在 GPIO_VALUE_HIGH 成功後、`return 0` 之前，插入：
  ```c
  // Record reset timestamp for cooldown mechanism in pal_is_bic_heartbeat_ok()
  last_bic_reset_ts = time(NULL);
  ```

---

## 程式碼搜尋記錄

| Step | 工具 | 查詢 | 結果 |
|------|------|------|------|
| 2A | search_github.py | `pal_is_bic_heartbeat_ok` --repos facebook/openbmc | 3 results: obmc-pal.c (weak), pal.c (GC2), healthd.c (caller) |
| 2A | search_github.py | `pal_bic_hw_reset` --repos facebook/openbmc | 4 results: obmc-pal.c (weak), pal.c (GC2), healthd.c (caller), grandteton (PAL_ENOTSUP) |
| 2B | grep_github_file.py | pal.c `pal_is_bic_heartbeat_ok\|pal_bic_hw_reset` | line 3338, 3366 |
| 2B | grep_github_file.py | healthd-config.json (GC2.0) `bic_health\|enabled` | line 91-92 (bic_health: enabled=false) |
| 2B | grep_github_file.py | front-paneld.c `MONITOR_HB_HEALTH_INTERVAL` | line 45 (= 5 seconds) |
| 2B | grep_github_file.py | pal.c `KV_KEY_BIC_HEARTBEAT` | line 63 (define), 2934 (kv_set), 3358 (kv_get) |
| 2C | fetch_github_file.py | pal.c line 3338 ±30 | pal_is_bic_heartbeat_ok complete (line 3337-3363) |
| 2C | fetch_github_file.py | pal.c line 3366 ±20 | pal_bic_hw_reset complete (line 3365-3377) |
| 2C | fetch_github_file.py | healthd-config.json line 91 ±10 | bic_health section (line 91-95) |
| 2C | fetch_github_file.py | pal.c line 2916 ±25 | pal_is_heartbeat_ok complete (line 2916-2938) |
| 2C | fetch_github_file.py | front-paneld.c line 285 ±95 | heartbeat_health_handler complete (line 285-376) |
| 2C | fetch_github_file.py | healthd.c line 1816 ±90 | bic_health_monitor complete (line 1816-1905) |
| 3 | search_github.py | `pal_is_bic_heartbeat_ok` (all platforms) | Only GC2 has override; others use weak default |
| 3 | grep_github_file.py | obmc-pal.c weak defaults | line 3575 (returns PAL_ENOTSUP=true), 3580 (returns PAL_ENOTSUP) |
| 3 | grep_github_file.py | healthd.c full reset logic | Confirmed double-call at line 1886/1891 |

---

*修改方案生成完成。此分析基於 facebook/openbmc 程式碼搜尋（search → grep → fetch 三步驟工作流程），未涉及任何寫入操作。所有程式碼片段來自 commit eb22af03ba3e7b93e697bfe9b004d76f79177a46。*
