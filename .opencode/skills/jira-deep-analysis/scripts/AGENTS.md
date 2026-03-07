# scripts/ — GitHub & JIRA API Helpers

## OVERVIEW

4 Python CLI scripts. All output JSON to stdout. All auto-load `.env` from their own directory via `os.path.dirname(os.path.abspath(__file__))`. Shared by both `jira-deep-analysis` and `fw-code-researcher` skills.

**Requirements:** `pip install requests python-dotenv`

## SCRIPTS

### `fetch_jira.py`
```
python fetch_jira.py <ISSUE-KEY>
# e.g. python fetch_jira.py GC20T5T7-121
```
- Calls JIRA REST API v3 (`/rest/api/3/issue/{key}`)
- Returns: `key`, `summary`, `description`, `labels`, `components`, `issue_type`
- Parses Atlassian Document Format (ADF) recursively — description is plain text, truncated at 8000 chars
- Auth: `JIRA_URL` + `JIRA_USERNAME` + `JIRA_API_TOKEN` (Basic auth)

### `search_github.py`
```
python search_github.py <query> [--repos owner/repo ...] [--org ORG] [--ext EXT] [--per-page N] [--text-matches]
# e.g. python search_github.py "pal_get_fru_health" --repos facebook/openbmc --text-matches
```
- Calls GitHub Code Search API (`/search/code`)
- `--repos`: multiple repos → called sequentially, results merged
- `--org`: search whole org (mutually exclusive with `--repos`)
- `--text-matches`: adds code fragment context in results; uses `vnd.github.text-match+json` Accept header
- `--ext`: filters by file extension (e.g. `c`, `py`)
- Max 100 results per API call; default `--per-page 10`
- Exponential backoff on rate limit: 2s→4s→8s→16s→32s (5 retries max)
- Auth: `GITHUB_TOKEN`

### `grep_github_file.py`
```
python grep_github_file.py <owner/repo> <path> <pattern> [--context N] [--max-matches N] [--ref REF]
# e.g. python grep_github_file.py facebook/openbmc meta-facebook/meta-grandcanyon/.../pal.c "pal_get_fru_health"
```
- Fetches entire file via Contents API, then runs `re.compile(pattern).search()` line-by-line
- Returns matching line numbers + ±N context lines (default `--context 3`)
- ⚠️ **Pattern is Python regex** — NOT shell glob. Use `func_a|func_b`, not `func_a\|func_b`
- Default `--max-matches 50`; set `truncated: true` in output when hit
- `--ref`: specify branch/tag/SHA (default: repo default branch)
- Auth: `GITHUB_TOKEN`

### `fetch_github_file.py`
```
python fetch_github_file.py <owner/repo> <path> <line> [--context N] [--ref REF]
# e.g. python fetch_github_file.py facebook/openbmc some/file.c 42 --context 20
```
- Fetches file via Contents API; extracts ±N lines around target line (default `--context 10`)
- Returns: `start_line`, `end_line`, `total_lines`, `content` (the slice)
- Falls back to `download_url` if file too large for base64 API response
- `line` arg is 1-indexed; errors if `< 1`
- Auth: `GITHUB_TOKEN`

## STANDARD WORKFLOW

```
1. search_github.py  → find candidate files (repo + path + url)
2. grep_github_file.py  → locate exact line numbers in target file
3. fetch_github_file.py  → read code context around those lines
```
Never skip to step 3 — large files (e.g. `pal.c` at 4000+ lines) will exceed the base64 limit or return too much noise.

## ENV VARIABLES

| Variable | Used by | Notes |
|----------|---------|-------|
| `GITHUB_TOKEN` | all 3 GitHub scripts | PAT with `repo` read scope |
| `JIRA_URL` | `fetch_jira.py` | e.g. `https://your-company.atlassian.net` |
| `JIRA_USERNAME` | `fetch_jira.py` | email address |
| `JIRA_API_TOKEN` | `fetch_jira.py` | Atlassian API token (not password) |

## ANTI-PATTERNS

- **DO NOT** use shell glob syntax in `grep_github_file.py` pattern — it is Python `re.compile()`, not bash glob
- **DO NOT** call `fetch_github_file.py` without first grepping for the line number — blind fetches on large files waste context
- **DO NOT** set `--per-page` > 100 in `search_github.py` — GitHub API hard limit is 100
- **DO NOT** share `.env` between directories — each script loads from its own `__file__` directory
