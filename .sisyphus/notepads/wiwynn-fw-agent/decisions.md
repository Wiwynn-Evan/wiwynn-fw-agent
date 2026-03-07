# Decisions — wiwynn-fw-agent

## [2026-03-07] Architectural Decisions (ALL FINAL — do not re-ask)

1. Python scripts: Keep as data-fetching tools, called via bash in Skills. Analysis by OmO agents.
2. Skills deployment: Project-level (.opencode/skills/ in wiwynn-fw-agent)
3. Review Loop: Distributed Skills + Slash Command coexist
4. Tool layer: Python scripts for data fetching, OmO agents for analysis
5. jira-deep-analysis migration: Copy from EF1900_Dep_Automation, independent maintenance
6. Target repos: facebook/openbmc, facebook/OpenBIC + Wiwynn private forks
7. Test strategy: E2E test with Wiwynn/gc2-bmc-collection-script using GitHub Issues
8. Model routing: command.model > agent.model > session.model (OmO native)
9. fw-coder agent: Custom agent at .opencode/agents/fw-coder.md with model: for GPT-5.3-codex
10. /fw-dev command: subtask: false (runs in current session), supports $ARGUMENTS
11. Skills load on-demand (one at a time) to preserve context budget

## [2026-03-07] Commit Strategy
- Wave 1: `feat(opencode): scaffold .opencode directory and migrate existing skills`
- Wave 2: `feat(skills): add fw-code-researcher, fw-code-writer, fw-pr-reviewer skills`
- Wave 3: `feat(orchestration): add fw-coder agent, /fw-dev command, GitHub Issue support`
- Wave 4: `test(e2e): add end-to-end test with gc2-bmc-collection-script`
