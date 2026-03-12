# Learnings from Issue #5 Analysis (2026-03-08)

## Route G Workflow
- `gh issue view {URL} --json title,body,labels,assignees,comments` works well for private repos where webfetch returns 404
- `gh api repos/{owner}/{repo}/git/trees/{branch}?recursive=1 --jq ".tree[] | .path"` is the best way to get full repo structure for private repos
- `gh api repos/{owner}/{repo}/contents/{path} -H "Accept: application/vnd.github.v3.raw"` fetches raw file content

## GC2 Console Targets
- GC2 has 6 console targets: server, bic, scc_exp_smart, scc_exp_sdb, scc_ioc_smart, iocm_ioc_smart
- Each backed by mTerm service (mTerm_server) on specific UART port
- scc_exp_sdb = UART2 (/dev/ttyS2), scc_ioc_smart = UART3 (/dev/ttyS3)
- Defined in facebook/openbmc meta-facebook/meta-grandcanyon/recipes-grandcanyon/

## gc2-bmc-collection-script Repo
- Pure Shell (Bash), ~245KB
- Main script: gc2_bmc_collection.sh (~550 lines, 17KB)
- Has platform detection guard (detect_platform checks for "grandcanyon")
- 12 collection categories, console history is one of them
- Also contains run_test_2/ (BIC/BMC sanity test framework) and yv4-bmc-collection-script-master/
- Has sch/ directory with actual schematics (PDF) for GC2 DVT

# Learnings from Issue #7 Analysis (2026-03-08)

## FEATURE_REQUEST Analysis Pattern
- When Issue is classified as FEATURE_REQUEST, use Phase A-FR workflow (skip A-1~A-5)
- Key rules: FR-1 (Same-Platform Pattern Priority), FR-2 (File Organization Consistency), FR-3 (Cross-Reference Validation)
- For collection scripts: YV4 script in same repo is the BEST pattern reference (Rule FR-1)

## gc2_bmc_collection.sh Current Architecture
- VERSION="1.0.0" (SemVer) vs YV4's Version=7.02 (simple float)
- Has log_message() writing stdout + summary.log simultaneously
- Has execute_command() wrapper but output goes to individual category log files only
- Uses `set -uo pipefail` (no -e, intentionally)
- No Banner, no tee wrapping, no complete execution log

## YV4 Collection Script Patterns (Key Reference)
- Banner: `Wiwynn Corp. YV4 Collection Script v${Version}` in echo block
- Execution logging: `{ ... } | tee "$LOG_FILE"` wraps entire main() body
- Output dir: `yv4_bmc_log/{sub_dir}/script_output.log`
- Has retry mechanism (max_retries=3), SSH mode, periodic loop mode
- GC2 script was simplified from YV4: no retry, no SSH, no loop, no banner, no tee

## tee + pipefail Interaction
- When using `{ ... } | tee`, pipefail means if the left side of pipe fails, overall exit code reflects that
- For collection scripts this is usually fine since execute_command() always returns 0
- But need to be careful: tar command inside tee block means script_execution.log will be incomplete in the archive
- Solution: move tar AFTER tee block closes, or accept partial log in archive

## Background Agent Limitations
- explore/librarian agents cannot access private repos via webfetch (get 404)
- For private Wiwynn repos, use authenticated `gh` CLI directly instead of spawning explore agents
- `gh api` with `--jq` and `python -m base64 -d` is the reliable path for private repo file content

## [2026-03-08] Task: Round3-PR-Review

### PR #8 Round 3 Review - APPROVE

Third and final review iteration. Both Round 2 issues confirmed resolved:
1. [Test Log] banner: Now shows correct 55-char '=' separator, "Welcome to GC2 BMC Collection Script v1.0.0" + "Wiwynn Corp." - matches actual print_banner() output exactly
2. Success echo block: Now uses '} 2>&1 | tee -a "${SCRIPT_LOG}"' - consistent with error block

All 7 review dimensions passed:
- Coding Style: 4-space indent, snake_case, proper quoting - clean
- Error Handling: tar exit code checked, cd failure handled, error messages clear
- Memory Safety: N/A (bash script) - local keyword used, no global leakage
- Commit Message: Meta oBMC GitHub format with all 4 sections, imperative verb, accurate [Design] and [Test Log]
- Platform Isolation: Single-file change in GC2-specific repo, platform guard in script
- Logic Correctness: All 3 Issue #7 REQs satisfied (banner, version, log packaging). tee block ordering ensures complete log before tar.
- Test Coverage: 3 concrete test scenarios with actual terminal output covering all requirements

### Review Loop Convergence Pattern
- Round 1: 5 issues (archive log wrapping, tar exit code, local keyword, [Design] mismatch, double blank line)
- Round 2: 2 issues ([Test Log] banner mismatch, success echo block inconsistency)
- Round 3: 0 issues - APPROVE
- Total iterations: 3 (within recommended max of 3)
- Pattern: Issues decreased monotonically each round, no regressions introduced
