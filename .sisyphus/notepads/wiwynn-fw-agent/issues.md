# Issues — wiwynn-fw-agent

## [2026-03-07] Known Minor Issues (all pre-resolved)

1. model: gpt-5.3-codex — exact model string may need adjustment to match OmO's available model list. Executor should use best available codex/code-specialized model if exact string doesn't match.
2. GitHub Issue label "test" — may not exist on gc2-bmc-collection-script. Create without label if 422 error. QA scenario accounts for this.
3. jira-deep-analysis version fork — use "2.3.0-wiwynn" or similar to mark as fork of v2.2.0.
4. .sisyphus/ directory — do NOT push to remote git repo.
