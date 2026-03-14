# tools/ — Utility Scripts

## OVERVIEW

Standalone utility scripts for maintaining the local firmware code clones. Run from project root only.

## SCRIPTS

### `sync_repos.sh`

Pulls latest commits on both local firmware reference clones.

```bash
# Pull current branch of both clones
bash tools/sync_repos.sh

# Switch to <branch> then pull (applied to both repos)
bash tools/sync_repos.sh <branch>
```

| Clone directory | Remote source |
|----------------|--------------|
| `bic_fw_code/facebook_openbic` | `https://github.com/facebook/OpenBIC` |
| `bmc_fw_code/facebook_openbmc` | `https://github.com/facebook/openbmc` |

**Exit codes**: `0` = all synced, `N` = N repos failed.

**Prereqs**: Git installed; credentials with read access to both repos; both clone directories must already exist (run `git clone` manually to initialize).

## ANTI-PATTERNS

- **DO NOT** run `sync_repos.sh` from a subdirectory — paths are relative to project root
- **DO NOT** push to `bic_fw_code/` or `bmc_fw_code/` — they are read-only reference clones
- **DO NOT** delete these clone directories — agents rely on them for local code search
