# GC20T5T7-63 Deep Analysis Report

**Issue**: BMC records `Unknown (0x10)` SEL when server board discrete sensor events are triggered
**Platform**: GC2 oBMC (Grand Canyon 2.0)
**Date**: 2026-03-15

---

## Section A — Platform Identification

| Field | Value |
|-------|-------|
| Platform | GC2 oBMC (Grand Canyon 2.0) |
| SoC | AST2600 |
| JIRA Project Prefix | `GC20T5T7-` |
| Meta Layer | `meta-facebook/meta-grandcanyon/` |
| Sub-Layer (GC2.0) | `meta-facebook/meta-grandcanyon/meta-grandcanyon2/` |
| Build Flag | `-DCONFIG_GRANDCANYON2` (added via `.bbappend` files in `meta-grandcanyon2/`) |
| Reference Repo | `facebook/openbmc` (read-only local clone at `bmc_fw_code/facebook_openbmc/`) |
| Target Repo (for fix) | `facebookexternal/openbmc.wiwynn` (branch only, no PR) |

### GC2.0 Sub-Layer Architecture

`meta-grandcanyon2/` contains **NO `.c` or `.h` files** — only `.bbappend` files that inject `-DCONFIG_GRANDCANYON2` into CFLAGS. GC2.0-specific behavior is controlled via `#ifdef CONFIG_GRANDCANYON2` guards in the shared source files under `meta-grandcanyon/`.

---

## Section B — Root Cause Hypothesis

### Problem Statement

When a BIC (Bridge IC) sends a discrete sensor event with sensor number `0x10` to the BMC, the BMC logs it as `"Unknown (0x10)"` in the SEL (System Event Log) because sensor number `0x10` has no name mapping in the code.

### Root Cause

Sensor number `0x10` is a **new discrete sensor introduced in GC2.0** that is missing from both lookup tables in the SEL sensor name resolution chain:

1. **Platform-specific lookup** — `pal_get_custom_event_sensor_name()` in `pal.c` line 3021
   - For `FRU_SERVER`, only maps 3 sensor numbers: `0xB4` (VR_HOT), `0x46` (SYSTEM_STATUS), `0x65` (PROC_FAIL)
   - **`0x10` is NOT listed** → hits `default:` at line 3041 → returns `"Unknown"` with `PAL_ENOTSUP`

2. **Common x86 fallback lookup** — `pal_get_x86_event_sensor_name()` in `obmc-pal.c` line 1532
   - Maps ~30 standard x86 event sensor numbers (SYSTEM_EVENT=0xE9, CATERR_B=0xEB, etc.)
   - **`0x10` is NOT in this enum** (confirmed by reading `obmc-pal.h` lines 351-389)
   - Hits `default:` at line 1639 → returns `"Unknown"`

### Call Chain

```
pal_get_event_sensor_name() [pal.c:3090]
  └─ checks snr_type: if OS_BOOT → "OS"
  └─ calls pal_get_custom_event_sensor_name() [pal.c:3110]
       └─ FRU_SERVER switch: 0xB4/0x46/0x65 only
       └─ default → "Unknown", returns PAL_ENOTSUP
  └─ if PAL_ENOTSUP, falls through to pal_get_x86_event_sensor_name() [pal.c:3117]
       └─ x86 enum: no 0x10 entry
       └─ default → "Unknown"   ← FINAL RESULT
```

### Confidence: HIGH

The code path is deterministic and fully traced. The fix is mechanical — add the sensor mapping.

---

## Section C — Affected Files (with line numbers)

### Must Modify

| # | File | Lines | Function / Section | Change Required |
|---|------|-------|--------------------|-----------------|
| 1 | `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.h` | 216-221 | `//Server board Discrete/SEL Sensors` enum | Add `BIC_SENSOR_<NAME> = 0x10` to the enum |
| 2 | `meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c` | 3029-3044 | `pal_get_custom_event_sensor_name()` → `FRU_SERVER` switch | Add `case BIC_SENSOR_<NAME>: snprintf(name, MAX_SNR_NAME, "<SENSOR_NAME>"); break;` |

### May Need Modification (depending on sensor event data requirements)

| # | File | Lines | Function | Condition |
|---|------|-------|----------|-----------|
| 3 | `pal.c` | 3230-3323 | `pal_parse_sel()` | If sensor 0x10 has specific event data bytes that need human-readable parsing |
| 4 | `pal.c` | 2452-2527 | `pal_bic_sel_handler()` | If sensor 0x10 should trigger specific BMC-side error handling (e.g., LED, GPIO, critical action) |

### Read-Only Reference (DO NOT MODIFY)

| File | Lines | Purpose |
|------|-------|---------|
| `common/recipes-lib/obmc-pal/files/obmc-pal.c` | 1532-1647 | `pal_get_x86_event_sensor_name()` — common x86 fallback (sensor 0x10 is NOT a standard x86 sensor, should NOT be added here) |
| `common/recipes-lib/obmc-pal/files/obmc-pal.h` | 350-389 | x86 event sensor number enum — confirms 0x10 not present |

---

## Section D — Search Keywords (for fw-code-researcher)

### Primary Keywords
- `pal_get_custom_event_sensor_name`
- `pal_get_event_sensor_name`
- `pal_get_x86_event_sensor_name`
- `BIC_SENSOR_VRHOT`
- `BIC_SENSOR_SYSTEM_STATUS`
- `BIC_SENSOR_PROC_FAIL`
- `Server board Discrete`
- `0x10` / `0x10` in sensor context
- `snr_num`
- `pal_parse_sel`
- `pal_bic_sel_handler`

### File Path Patterns
- `meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c`
- `meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.h`
- `common/recipes-lib/obmc-pal/files/obmc-pal.c`

### Cross-Reference Keywords
- `CONFIG_GRANDCANYON2` — if the fix should be GC2.0-only
- `meta-grandcanyon2` — for bbappend layer structure
- `MAX_SNR_NAME` — buffer size for sensor name strings

---

## Section E — Cross-Platform Risk Assessment

### Risk Level: LOW

| Dimension | Assessment |
|-----------|------------|
| **Common code impact** | NONE — fix is entirely in platform-specific `pal.c` and `pal.h` under `meta-grandcanyon/`. No changes to `common/` required. |
| **Other platforms** | NOT affected — `pal_get_custom_event_sensor_name()` is platform-specific. Each platform (fby35, fby3, etc.) has its own implementation. |
| **GC1 vs GC2.0 risk** | LOW but needs consideration — the enum in `pal.h` and the switch in `pal.c` are shared between GC1 and GC2.0. If sensor 0x10 is GC2.0-only, the fix should be wrapped in `#ifdef CONFIG_GRANDCANYON2`. If it applies to both GC1 and GC2.0, no ifdef needed. |
| **BIC firmware dependency** | The BIC must already be sending sensor 0x10 events (confirmed by the JIRA: events ARE arriving, just unnamed). The BMC-side fix is purely adding the name mapping. |
| **ABI/interface risk** | NONE — adding a new `case` to an existing `switch` and a new value to an `enum` are purely additive. No existing behavior changes. |

### GC2.0-Specific Decision Point

**Key question**: Is sensor 0x10 a new sensor in GC2.0 only, or does it exist in GC1 as well?
- If **GC2.0 only**: Wrap the new enum value and switch case in `#ifdef CONFIG_GRANDCANYON2`
- If **both GC1 and GC2.0**: Add directly without `#ifdef` guard
- **This must be confirmed with the BIC team or hardware spec before implementation**

---

## Section F — Verification Checklist

### Before Implementation
- [ ] **Confirm the actual sensor name for 0x10** — the JIRA says "server board discrete sensor" but does not specify the exact human-readable name (e.g., is it `POWER_ERR`, `CPU_DIMM_HOT`, `SSD_HOT`, etc.?). Must get this from BIC firmware spec or BIC team.
- [ ] **Confirm GC1/GC2 scope** — is sensor 0x10 present on both GC1 and GC2.0 BIC firmware? Determines whether `#ifdef CONFIG_GRANDCANYON2` is needed.
- [ ] **Check if sensor 0x10 has event data parsing requirements** — does the BIC send meaningful event data bytes that should be parsed in `pal_parse_sel()`?
- [ ] **Check if sensor 0x10 requires BMC-side error handling** — should it trigger any action in `pal_bic_sel_handler()`?

### After Implementation
- [ ] Verify `bitbake grandcanyon-image` compiles without errors
- [ ] Verify SEL entry shows the correct sensor name instead of "Unknown (0x10)"
- [ ] Verify existing sensor SEL entries (VR_HOT, SYSTEM_STATUS, PROC_FAIL) are not affected
- [ ] If `#ifdef CONFIG_GRANDCANYON2` used: verify GC1 build still works (sensor defaults to "Unknown" as before)
- [ ] Run `sensor-util server --history` to verify threshold sensor 0x10 (`ES_VR_FIVRA_TEMP_C`) is NOT affected (it's a different enum in `pal_sensors.h`, separate namespace)

### Test Log Template
```
[Test Log]
- Build: bitbake grandcanyon-image (GC2.0 config) — PASS
- Injected sensor 0x10 SEL event via BIC: <method>
- Verified SEL shows "<SENSOR_NAME>" instead of "Unknown (0x10)"
- Verified VR_HOT (0xB4), SYSTEM_STATUS (0x46), PROC_FAIL (0x65) SEL events unaffected
- (If GC2.0-only) Built GC1 config: sensor 0x10 shows "Unknown" as expected
```

---

## Open Questions — RESOLVED by fw-code-researcher

1. **What is the actual sensor name for 0x10?** — **RESOLVED**: `SENSOR_NUM_SYSTEM_STATUS` (confirmed in `plat_sensor_table.h:121`). Display name: `"SYSTEM_STATUS"`.
2. **Is sensor 0x10 GC2.0-only or shared with GC1?** — **RESOLVED**: GC2.0-only. Defined only in `gc2-es` BIC firmware. Use `#ifdef CONFIG_GRANDCANYON2`. Precedent: `pal.h:159` and `pal.c:4455` already use this pattern.
3. **Does sensor 0x10 need event data parsing?** — **RESOLVED**: YES. Uses same IPMI OEM event data format (`IPMI_OEM_SENSOR_TYPE_SYS_STA = 0xC9`) as sensor 0x46. Existing `pal_parse_sys_sts_event()` handles all gc2-es event offsets. Use case fall-through to reuse.
4. **Does sensor 0x10 require BMC-side actions?** — **RESOLVED**: YES (consistency). `pal_bic_sel_handler()` handles `SYS_EVENT_HOST_STALL` for 0x46 — add same case fall-through for 0x10.

**Detailed modification plan**: See `modification_plan.md` in this directory.

---

## Section G — Code Research Findings (2026-03-15)

### Event Data Offset Mapping (BIC → BMC)

The gc2-es BIC sends these event_data1 values with `SENSOR_NUM_SYSTEM_STATUS = 0x10`:

| BIC Event Offset (libipmi.h) | Value | BMC Enum (pal.h) | BMC Parsed? |
|------------------------------|-------|-------------------|-------------|
| `IPMI_OEM_EVENT_OFFSET_SYS_THERMAL_TRIP` | 0x00 | `SYS_THERM_TRIP` | ✓ |
| `IPMI_OEM_EVENT_OFFSET_SYS_PWROK_FAIL` | 0x01 | `SYS_FIVR_FAULT` | ✓ |
| `IPMI_OEM_EVENT_OFFSET_SYS_THROTTLE` | 0x02 | `SYS_SURGE_CURR` | ✓ |
| `IPMI_OEM_EVENT_OFFSET_SYS_PCHHOT` | 0x03 | `SYS_PCH_PROCHOT` | ✓ |
| `IPMI_OEM_EVENT_OFFSET_SYS_PMBUSALERT` | 0x05 | `SYS_OC_DETECT` | ✓ |
| `IPMI_OEM_EVENT_OFFSET_SYS_HSCTIMER` | 0x06 | `SYS_OCP_FAULT_WARN` | ✓ |
| `IPMI_OEM_EVENT_OFFSET_SYS_FIRMWAREASSERT` | 0x07 | `SYS_FW_TRIGGER` | ✓ |
| `IPMI_OEM_EVENT_OFFSET_SYS_VRWATCHDOG` | 0x0A | `SYS_VR_WDT_TIMEOUT` | ✓ |
| `IPMI_OEM_EVENT_OFFSET_SYS_SMI90s` | 0x0E | `SYS_SMI_STUCK_LOW` | ✓ |
| `IPMI_OEM_EVENT_OFFSET_SYS_FMTHROTTLE` | 0x10 | *not in pal.h* | ✗ (falls to "Undefined") |
| `IPMI_OEM_EVENT_OFFSET_SYS_MEMORY_THERMALTRIP` | 0x11 | *not in pal.h* | ✗ (falls to "Undefined") |

### CONFIG_GRANDCANYON2 Usage in pal.h/pal.c

- `pal.h:159` — `#ifdef CONFIG_GRANDCANYON2` for `BIOS_POST_CMPLT` value
- `pal.c:4455-4465` — `#ifdef CONFIG_GRANDCANYON2` for `pal_convert_to_dimm_str()`
- Pattern is established: GC2.0-only features ARE guarded with `#ifdef` in these files.

### Files Modified (4 changes, 2 files)

1. `pal.h:217-221` — Add `BIC_SENSOR_SYSTEM_STATUS_GC2 = 0x10` enum
2. `pal.c:3030-3044` — Add case in `pal_get_custom_event_sensor_name()`
3. `pal.c:3254-3266` — Add case fall-through in `pal_parse_sel()`
4. `pal.c:2479-2483` — Add case fall-through in `pal_bic_sel_handler()`
