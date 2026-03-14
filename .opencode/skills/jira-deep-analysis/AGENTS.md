# jira-deep-analysis — BMC/Firmware Issue Analysis Skill

## OVERVIEW

The most complex skill in this repo (787 lines, v2.3.0-wiwynn). Dual-platform router: auto-detects OpenBMC Linux (Route A) vs OpenBIC/Zephyr (Route B) vs GitHub Issues (Route G) and runs platform-specific analysis phases.

## STRUCTURE

```
jira-deep-analysis/
├── SKILL.md                # Main skill (710 lines) — all analysis logic
└── scripts/                # Python API helpers (shared with fw-code-researcher)
    ├── fetch_jira.py        # JIRA REST API client
    ├── fetch_github_file.py # Fetch file slice from GitHub (±N lines around target)
    ├── grep_github_file.py  # Regex grep inside a GitHub file → line numbers
    ├── search_github.py     # GitHub Code Search API
    ├── .env                 # Credentials (gitignored)
    └── .env.example         # Template: GITHUB_TOKEN, JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN
```

## ROUTING LOGIC (Phase 0)

| Input | Route | Platform |
|-------|-------|----------|
| JIRA `GC20T5T7-*` | A | GC2 oBMC Linux (AST2600) |
| JIRA `YV4T1M-*` | A | YV4 oBMC Linux (AST2600) |
| JIRA `GC2-*` / `GC2ES-*` | B | gc2-es OpenBIC (AST1030/Zephyr) |
| `https://github.com/{owner}/{repo}/issues/{N}` | G → A or B | GitHub Issue → re-detect platform from content |
| Unclear | Ask user | — |

## ROUTE A PHASES

```
A-0: Fetch JIRA → A-1: 4-6 parallel agents search → A-2: Evidence matrix
→ A-3: 5-Whys root cause → A-4: Solution design → A-5: Report (.md file)
```

**Special flow**: If JIRA type=`FEATURE_REQUEST` → skip A-1 through A-5 → use Phase A-FR (same-platform pattern priority rules FR-1/FR-2/FR-3).

## ROUTE B HANDLERS

| Handler | Trigger |
|---------|---------|
| `handleGc2esSensorVrIssue` | Sensor value wrong, VR config, ADC scaling |
| `handleCommonCodeDependency` | Bug suspected in `common/` module |
| `handleGc2esInterruptSmi` | SMI stuck-low, ISR not firing |
| `handleGc2esGeneralCrash` | Hard Fault, z_fatal_error, watchdog |

## CONVENTIONS

- Scripts auto-load `.env` from their own directory (`os.path.dirname(__file__)`)
- `grep_github_file.py` uses **Python regex** syntax (NOT shell glob): `func_a|func_b` not `func_a\|func_b`
- PAL files are 4000+ lines — always use search → grep → fetch (3-step), never fetch blindly
- Evidence matrix format: file path + code block + strength (🔴/🟡/🟢) required for every finding

## ANTI-PATTERNS

- **DO NOT** conclude before all parallel agents finish (premature conclusion = most common failure)
- **DO NOT** copy PMBus register offsets from another platform without datasheet cross-check (FR-3)
- **DO NOT** modify `common/` in OpenBIC directly — add `#ifdef CONFIG_GC2ES` override in `plat_xxx.c` first
- **DO NOT** remove existing workarounds without hardware evidence (e.g. `== 1` checks may target edge cases)
