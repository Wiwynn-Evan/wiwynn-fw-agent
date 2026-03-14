#!/usr/bin/env bash
#
# sync_repos.sh — Pull latest code for bic_fw_code & bmc_fw_code repos
#
# Usage:
#   bash tools/sync_repos.sh          # pull both repos (default branch)
#   bash tools/sync_repos.sh <branch> # pull a specific branch for both repos
#

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

REPOS=(
  "bic_fw_code/facebook_openbic"
  "bmc_fw_code/facebook_openbmc"
)

BRANCH="${1:-}"   # optional: specify a branch to checkout & pull

# ─── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ─── Helper ─────────────────────────────────────────────────────────────────
log_info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ─── Main ───────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Wiwynn FW Agent — Repo Sync Tool"
echo "============================================"
echo ""

FAIL_COUNT=0

for repo in "${REPOS[@]}"; do
  REPO_PATH="$PROJECT_ROOT/$repo"

  log_info "Processing: ${CYAN}$repo${NC}"

  # Check if directory exists
  if [[ ! -d "$REPO_PATH" ]]; then
    log_err "Directory not found: $REPO_PATH"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo ""
    continue
  fi

  # Check if it is a git repo
  if [[ ! -d "$REPO_PATH/.git" ]]; then
    log_err "Not a git repository: $REPO_PATH"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo ""
    continue
  fi

  pushd "$REPO_PATH" > /dev/null

  # Optionally switch branch
  if [[ -n "$BRANCH" ]]; then
    log_info "Checking out branch: $BRANCH"
    if ! git checkout "$BRANCH" 2>&1; then
      log_err "Failed to checkout branch '$BRANCH' in $repo"
      popd > /dev/null
      FAIL_COUNT=$((FAIL_COUNT + 1))
      echo ""
      continue
    fi
  fi

  CURRENT_BRANCH=$(git branch --show-current)
  log_info "Current branch: ${YELLOW}$CURRENT_BRANCH${NC}"

  # Perform git pull
  log_info "Running git pull..."
  if git pull 2>&1; then
    log_ok "$repo synced successfully."
  else
    log_err "git pull failed for $repo"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  popd > /dev/null
  echo ""
done

# ─── Summary ────────────────────────────────────────────────────────────────
echo "============================================"
if [[ $FAIL_COUNT -eq 0 ]]; then
  log_ok "All repos synced successfully!"
else
  log_warn "$FAIL_COUNT repo(s) failed to sync."
fi
echo "============================================"

exit $FAIL_COUNT
