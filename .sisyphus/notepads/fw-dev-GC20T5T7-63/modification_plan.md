# Modification Plan: GC20T5T7-63

**Issue**: BMC logs `Unknown (0x10)` SEL for sensor number 0x10 from the BIC
**Platform**: GC2 oBMC (Grand Canyon 2.0)
**Target Repository**: `facebookexternal/openbmc.wiwynn` (branch only)
**Date**: 2026-03-15

---

## Summary

Sensor number `0x10` is `SENSOR_NUM_SYSTEM_STATUS` in the gc2-es BIC firmware (`plat_sensor_table.h:121`). The BMC's SEL name lookup (`pal_get_custom_event_sensor_name()`) has no case for `0x10` and falls through to `"Unknown"`. The fix adds the sensor mapping to **3 functions** across 2 files.

### Key Findings

1. **Naming conflict**: `BIC_SENSOR_SYSTEM_STATUS = 0x46` already exists in `pal.h:219`. Sensor `0x10` needs a **distinct name**: `BIC_SENSOR_SYSTEM_STATUS_GC2`.
2. **`#ifdef CONFIG_GRANDCANYON2` decision**: **YES, use ifdef**. Evidence:
   - `CONFIG_GRANDCANYON2` IS used in `pal.h:159` and `pal.c:4455` — the pattern exists in these files.
   - Sensor `0x10` is defined only in `gc2-es` BIC firmware — it's a GC2.0-only sensor.
   - The existing 3 sensors (0xB4, 0x46, 0x65) are GC1-era and remain valid for both GC1 and GC2.0.
   - Wrapping in `#ifdef` prevents GC1 builds from having a dangling sensor mapping for a sensor that doesn't exist on GC1 hardware.
3. **Event data compatibility**: Sensor `0x10` uses the SAME IPMI OEM sensor type (`0xC9`) and event data offset encoding as sensor `0x46`. The existing `pal_parse_sys_sts_event()` function handles all event data offsets that the gc2-es BIC sends with sensor 0x10. **Reuse is correct.**
4. **`pal_bic_sel_handler()` needs updating**: The existing handler at line 2479 dispatches `SYS_EVENT_HOST_STALL` for sensor `0x46`. While the gc2-es BIC doesn't currently send `SYS_EVENT_HOST_STALL` with sensor `0x10`, adding the same handler ensures consistency and future-proofing.

---

## Files to Modify

| # | File | Lines | Function/Section | Change |
|---|------|-------|------------------|--------|
| 1 | `pal.h` | 217-221 | `//Server board Discrete/SEL Sensors` enum | Add `BIC_SENSOR_SYSTEM_STATUS_GC2 = 0x10` inside `#ifdef CONFIG_GRANDCANYON2` |
| 2 | `pal.c` | 3030-3044 | `pal_get_custom_event_sensor_name()` FRU_SERVER switch | Add `case BIC_SENSOR_SYSTEM_STATUS_GC2:` inside `#ifdef CONFIG_GRANDCANYON2` |
| 3 | `pal.c` | 3254-3266 | `pal_parse_sel()` FRU_SERVER switch | Add `case BIC_SENSOR_SYSTEM_STATUS_GC2:` routing to `pal_parse_sys_sts_event()` inside `#ifdef CONFIG_GRANDCANYON2` |
| 4 | `pal.c` | 2479-2483 | `pal_bic_sel_handler()` switch | Add `case BIC_SENSOR_SYSTEM_STATUS_GC2:` with same `SYS_EVENT_HOST_STALL` handling, inside `#ifdef CONFIG_GRANDCANYON2` |

All paths relative to: `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/`

---

## Change 1: `pal.h` — Add enum value

**File**: `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.h`
**Function**: `//Server board Discrete/SEL Sensors` enum
**Line range**: 216-221
**Rationale**: Define the new sensor number constant so it can be used in switch cases in pal.c.

### Exact old code (lines 216-221):

```c
//Server board Discrete/SEL Sensors
enum {
  BIC_SENSOR_VRHOT = 0xB4,
  BIC_SENSOR_SYSTEM_STATUS = 0x46,
  BIC_SENSOR_PROC_FAIL = 0x65,
};
```

### Exact new code:

```c
//Server board Discrete/SEL Sensors
enum {
  BIC_SENSOR_VRHOT = 0xB4,
  BIC_SENSOR_SYSTEM_STATUS = 0x46,
  BIC_SENSOR_PROC_FAIL = 0x65,
#ifdef CONFIG_GRANDCANYON2
  BIC_SENSOR_SYSTEM_STATUS_GC2 = 0x10,
#endif
};
```

### Verification:
- Enum value `0x10` does not collide with existing values (0xB4, 0x46, 0x65).
- Name `BIC_SENSOR_SYSTEM_STATUS_GC2` is distinct from `BIC_SENSOR_SYSTEM_STATUS`.
- `#ifdef` ensures GC1 builds are unaffected.

---

## Change 2: `pal.c` — Add sensor name mapping

**File**: `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c`
**Function**: `pal_get_custom_event_sensor_name()`
**Line range**: 3030-3044
**Rationale**: Map sensor 0x10 to human-readable name "SYSTEM_STATUS" in SEL output. This is the PRIMARY fix for the JIRA issue.

### Exact old code (lines 3030-3044):

```c
        case BIC_SENSOR_VRHOT:
          snprintf(name, MAX_SNR_NAME, "VR_HOT");
          break;
        case BIC_SENSOR_SYSTEM_STATUS:
          snprintf(name, MAX_SNR_NAME, "SYSTEM_STATUS");
          break;
        case BIC_SENSOR_PROC_FAIL:
          snprintf(name, MAX_SNR_NAME, "PROC_FAIL");
          break;
        default:
          snprintf(name, MAX_SNR_NAME, "Unknown");
          ret = PAL_ENOTSUP;
          break;
```

### Exact new code:

```c
        case BIC_SENSOR_VRHOT:
          snprintf(name, MAX_SNR_NAME, "VR_HOT");
          break;
        case BIC_SENSOR_SYSTEM_STATUS:
          snprintf(name, MAX_SNR_NAME, "SYSTEM_STATUS");
          break;
        case BIC_SENSOR_PROC_FAIL:
          snprintf(name, MAX_SNR_NAME, "PROC_FAIL");
          break;
#ifdef CONFIG_GRANDCANYON2
        case BIC_SENSOR_SYSTEM_STATUS_GC2:
          snprintf(name, MAX_SNR_NAME, "SYSTEM_STATUS");
          break;
#endif
        default:
          snprintf(name, MAX_SNR_NAME, "Unknown");
          ret = PAL_ENOTSUP;
          break;
```

### Verification:
- Inserted BEFORE `default:` so the case is reachable.
- Uses same sensor name string `"SYSTEM_STATUS"` — both 0x46 and 0x10 are SYSTEM_STATUS sensors from different BIC firmware versions.
- `#ifdef` ensures GC1 builds see no change (0x10 falls through to `"Unknown"` as before).

---

## Change 3: `pal.c` — Add event data parsing

**File**: `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c`
**Function**: `pal_parse_sel()`
**Line range**: 3254-3266
**Rationale**: Parse the event data bytes for sensor 0x10 using the SAME `pal_parse_sys_sts_event()` function used by sensor 0x46. Both sensors use identical IPMI OEM event data offset encoding (`IPMI_OEM_SENSOR_TYPE_SYS_STA = 0xC9`).

### Exact old code (lines 3254-3266):

```c
        case BIC_SENSOR_VRHOT:
          pal_parse_vr_event(event_data, error_log);
          is_parsed = true;
          break;
        case BIC_SENSOR_SYSTEM_STATUS:
          pal_parse_sys_sts_event(event_data, error_log);
          is_parsed = true;
          break;
        case BIC_SENSOR_PROC_FAIL:
          pal_parse_proc_fail(event_data, error_log);
          is_parsed = true;
          break;
```

### Exact new code:

```c
        case BIC_SENSOR_VRHOT:
          pal_parse_vr_event(event_data, error_log);
          is_parsed = true;
          break;
        case BIC_SENSOR_SYSTEM_STATUS:
#ifdef CONFIG_GRANDCANYON2
        case BIC_SENSOR_SYSTEM_STATUS_GC2:
#endif
          pal_parse_sys_sts_event(event_data, error_log);
          is_parsed = true;
          break;
        case BIC_SENSOR_PROC_FAIL:
          pal_parse_proc_fail(event_data, error_log);
          is_parsed = true;
          break;
```

### Verification:
- Uses **case fall-through** pattern: `BIC_SENSOR_SYSTEM_STATUS_GC2` falls through to the same parsing logic as `BIC_SENSOR_SYSTEM_STATUS`.
- This is correct because both sensors send events with the same `IPMI_OEM_SENSOR_TYPE_SYS_STA` event data format.
- Event data offsets confirmed matching between BIC's `libipmi.h` (0x00-0x20) and BMC's `SYS_*` enum in `pal.h` (0x00-0x20).
- GC2.0-specific events `SYS_FMTHROTTLE=0x10` and `SYS_MEMORY_THERMALTRIP=0x11` sent by gc2-es BIC will fall to the existing `default: "Undefined system event"` case in `pal_parse_sys_sts_event()` — acceptable for now, can be enhanced later.

---

## Change 4: `pal.c` — Add SEL handler

**File**: `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c`
**Function**: `pal_bic_sel_handler()`
**Line range**: 2479-2483
**Rationale**: Handle BMC-side actions for sensor 0x10 events. The existing handler dispatches `SYS_EVENT_HOST_STALL` for sensor 0x46. Add the same handling for sensor 0x10 for consistency.

### Exact old code (lines 2479-2483):

```c
    case BIC_SENSOR_SYSTEM_STATUS:
      if (event_data1 == SYS_EVENT_HOST_STALL) {
        pal_host_stall_handler(FRU_SERVER);
      }
      break;
```

### Exact new code:

```c
    case BIC_SENSOR_SYSTEM_STATUS:
#ifdef CONFIG_GRANDCANYON2
    case BIC_SENSOR_SYSTEM_STATUS_GC2:
#endif
      if (event_data1 == SYS_EVENT_HOST_STALL) {
        pal_host_stall_handler(FRU_SERVER);
      }
      break;
```

### Verification:
- Uses **case fall-through** pattern, same as Change 3.
- Ensures sensor 0x10 host stall events get the same BMC-side handling as sensor 0x46.
- No new behavior introduced — purely extends existing behavior to the new sensor number.

---

## Modification Dependency Order

1. **Change 1 (pal.h)** — Must be first. Defines `BIC_SENSOR_SYSTEM_STATUS_GC2` used by all other changes.
2. **Changes 2, 3, 4 (pal.c)** — Can be in any order within pal.c, all depend only on Change 1.

---

## Potential Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| GC1 build breakage | `BIC_SENSOR_SYSTEM_STATUS_GC2` undefined without `CONFIG_GRANDCANYON2` | All uses wrapped in `#ifdef CONFIG_GRANDCANYON2` — GC1 builds never see the symbol |
| Sensor name confusion in logs | Both 0x46 and 0x10 show as "SYSTEM_STATUS" | Acceptable — both ARE system status sensors. The SEL record includes the raw sensor number for disambiguation. |
| Missing event parsing for 0x10/0x11 offsets | gc2-es BIC sends `SYS_FMTHROTTLE=0x10` and `SYS_MEMORY_THERMALTRIP=0x11` which are NOT parsed by `pal_parse_sys_sts_event()` | Low impact — falls to `default: "Undefined system event"`. Can be enhanced in a follow-up JIRA. |
| Enum trailing comma after `#endif` | Compiler compatibility | C99 and later allow trailing commas in enums. GCC/Clang both handle this. |

---

## Verification Checklist

- [ ] `bitbake grandcanyon-image` (GC2.0 config with `-DCONFIG_GRANDCANYON2`) compiles clean
- [ ] `bitbake grandcanyon-image` (GC1 config without flag) compiles clean — sensor 0x10 remains "Unknown"
- [ ] SEL entry for sensor 0x10 shows `"SYSTEM_STATUS"` instead of `"Unknown (0x10)"`
- [ ] SEL event data for sensor 0x10 shows parsed strings (e.g., "VR WDT Assertion", "System thermal trip Assertion")
- [ ] Existing sensor 0x46 events still show `"SYSTEM_STATUS"` and parse correctly
- [ ] Existing sensor 0xB4/0x65 events unaffected
- [ ] Host stall handler triggers for both 0x46 and 0x10 on `SYS_EVENT_HOST_STALL`

---

## Execution Plan (for fw-code-writer)

| Task # | File | Change | Dependency |
|--------|------|--------|------------|
| T1 | `pal.h` | Add `BIC_SENSOR_SYSTEM_STATUS_GC2 = 0x10` in enum (Change 1) | None |
| T2 | `pal.c` | Add case in `pal_get_custom_event_sensor_name()` (Change 2) | T1 |
| T3 | `pal.c` | Add case in `pal_parse_sel()` (Change 3) | T1 |
| T4 | `pal.c` | Add case in `pal_bic_sel_handler()` (Change 4) | T1 |

**Single-file note**: T2, T3, T4 are all in `pal.c` — they can be applied as a single commit with T1.
