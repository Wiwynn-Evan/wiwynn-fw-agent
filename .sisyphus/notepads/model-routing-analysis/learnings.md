
---
## Research Entry: msitarzewski/agency-agents
**Date:** 2026-03-08  
**Commit SHA:** cb8e568bdaa4e9e44e5932e63f66169d631bbc40  
**Repo:** https://github.com/msitarzewski/agency-agents  

---

### WHAT THIS REPO ACTUALLY IS

**Hard Fact (README.md L29-35):** This is a *pure prompt library* — a collection of Markdown `.md` files targeting the `~/.claude/agents/` directory used by Claude Code (Anthropic's coding assistant). There is **no code runtime**, no orchestration engine, no model-routing logic. Everything is personality/workflow instructions embedded in Markdown frontmatter + prose.

**Evidence:** The entire repo is Markdown files. File tree:
```
.opencode/ — does NOT exist
No package.json, no Python, no TypeScript source
All content is under: engineering/, design/, testing/, specialized/, strategy/
```

---

### ARCHITECTURE SUMMARY

#### 1. Agent Format (Unit of Configuration)

Every agent is a single `.md` file with YAML frontmatter:

```markdown
---
name: Frontend Developer
description: Expert frontend developer...
color: cyan
---
# Role Prose + Workflow Instructions
```

**Evidence:** `engineering/engineering-frontend-developer.md` L1-5, `testing/testing-reality-checker.md` L1-5, `specialized/agentic-identity-trust.md` L1-5

**Key fields:**
- `name`: Display name for Claude Code agent picker
- `description`: Used by Claude Code to auto-select agent via task description matching
- `color`: UI color in Claude Code interface

There is **no** `model:`, `provider:`, `temperature:`, `tools:` field in any agent frontmatter.

#### 2. Orchestrator Agent (`specialized/agents-orchestrator.md`)

The orchestrator is itself just another `.md` agent file. Its "pipeline control" is entirely achieved through **prompt instructions** — it tells a Claude instance to:
- Spawn other agents by name (e.g., "Please spawn a project-manager-senior agent")
- Wait for outputs
- Make PASS/FAIL decisions
- Loop back with feedback

**Evidence (agents-orchestrator.md L53-106):**
```markdown
# Phase 1: Project Analysis & Planning
"Please spawn a project-manager-senior agent to read the specification file..."

# Phase 3: Development-QA Continuous Loop
"Please spawn appropriate developer agent (Frontend Developer, Backend Architect...)"
"Please spawn an EvidenceQA agent to test TASK 1..."
IF QA = PASS: Move to Task 2
IF QA = FAIL: Loop back to developer with QA feedback
```

This is natural language orchestration — no programmatic framework backing it.

#### 3. The NEXUS Strategy Layer (`strategy/nexus-strategy.md`)

The `strategy/` directory contains a 7-phase pipeline doctrine called **NEXUS** (Network of EXperts, Unified in Strategy). This adds:
- Phase gates (quality checkpoints between phases)
- Handoff templates (structured context-passing between agents)
- Agent assignment matrix by task type
- Dev↔QA retry loops (max 3 attempts, then escalation)

**Evidence (nexus-strategy.md L77-93):**
```
Phase 0: DISCOVER → Phase 1: STRATEGIZE → Phase 2: SCAFFOLD → Phase 3: BUILD → Phase 4: HARDEN → Phase 5: LAUNCH → Phase 6: OPERATE
◆ Quality Gate between every phase
◆ Parallel tracks within phases
```

**Command structure (nexus-strategy.md L97-116):**
```
Agents Orchestrator (Pipeline Controller)
  → Studio Producer (Portfolio)
  → Project Shepherd (Execution)
  → Senior Project Manager (Task Scoping)
    → Division Leads (per phase)
```

#### 4. Handoff Templates (`strategy/coordination/handoff-templates.md`)

7 structured handoff types:
1. Standard agent-to-agent handoff (From/To/Phase/Task/Context/Deliverable)
2. QA PASS verdict
3. QA FAIL verdict + retry instructions
4. Escalation Report (after 3 retries)
5. Phase Gate Handoff
6. Sprint Handoff
7. Incident Handoff

**Evidence:** `strategy/coordination/handoff-templates.md` — entire file

#### 5. Memory / Session Model

**Hard Fact:** There is **no persistent memory system** in this repo. Each agent file contains a `## 🧠 Your Identity & Memory` section that tells the LLM to *behave as if* it has memory (e.g., "You remember pipeline patterns, bottlenecks..."). This is simulated memory via prompt priming, not state persistence.

**Evidence (agents-orchestrator.md L12-15):**
```markdown
- **Memory**: You remember pipeline patterns, bottlenecks, and what leads to successful delivery
- **Experience**: You've seen projects fail when quality loops are skipped
```

Context is passed between agents via the Handoff Templates — each handoff document carries the accumulated context forward explicitly.

#### 6. Tool System

**Hard Fact:** There is **no tool system defined in this repo**. Tool access is implicitly whatever Claude Code provides (file read/write, bash, etc.). Some agents reference specific tools by name (Playwright screenshots via `./qa-playwright-capture.sh`), but these are runtime assumptions, not configured here.

**Evidence (testing-reality-checker.md L41-53):**
```bash
ls -la resources/views/
./qa-playwright-capture.sh http://localhost:8000 public/qa-screenshots
```

---

### MODEL ROUTING DETAILS

#### Where model/provider is bound

**Hard Fact: NOWHERE in this repo.** Not a single agent file contains a model or provider binding.

Search evidence: Grep for `model:`, `provider:`, `gpt`, `claude`, `anthropic`, `openai` in agent frontmatter = zero results in any `.md` YAML header.

All agents run on whatever model is loaded in Claude Code at the time of invocation. There is no per-agent model assignment mechanism.

#### Runtime model switching

**Hard Fact: NOT SUPPORTED by this repo's design.**

The orchestrator spawns agents by name (e.g., "spawn a Frontend Developer agent"), but Claude Code's agent spawning mechanism determines which model runs — and this repo provides no mechanism to vary that per agent. Every spawned agent runs on the same model as the orchestrator.

**Interpretation (not hard fact):** One could *manually* select different Claude Code agent configurations with different models, but the repo provides no framework for this. The `description:` field in frontmatter is used for *auto-selection* of agent persona, not model routing.

#### Agent handoff mechanism

**Hard Fact:** Handoffs are achieved through **structured Markdown documents** passed as context. The receiving agent is given the full handoff document and instructed to continue work. There is no programmatic message bus, no API call, no async queue.

**Evidence (strategy/coordination/handoff-templates.md L11-45):** Standard Handoff Template is pure Markdown with `From`, `To`, `Context`, `Deliverable Request`, `Quality Expectations` fields.

---

### CONCRETE WORKFLOW EXAMPLES

#### Example 1: Dev↔QA Loop (from agents-orchestrator.md + nexus-strategy.md)

```
1. Orchestrator reads task list
2. Spawns: Frontend Developer → "implement TASK 1 ONLY"
3. Frontend Developer implements, marks complete
4. Orchestrator spawns: Evidence Collector → "test TASK 1, provide PASS/FAIL"
5. Evidence Collector takes screenshots, evaluates
   → IF PASS: Orchestrator marks task done, moves to Task 2
   → IF FAIL (attempt 1 of 3): Orchestrator sends QA failure feedback back to Frontend Developer
6. Frontend Developer fixes, resubmits
7. Repeat up to 3 attempts
8. If 3 failures: Escalation Report → Studio Producer decides
```

**Evidence:** `agents-orchestrator.md` L77-106, `nexus-strategy.md` L292-314, `strategy/coordination/handoff-templates.md` L96-144

#### Example 2: Nexus Spatial 8-Agent Parallel Discovery (from examples/nexus-spatial-discovery.md)

8 agents ran **simultaneously** (not sequentially) on a single opportunity evaluation:
- Product Trend Researcher → Market validation
- Backend Architect → System architecture
- Brand Guardian → Brand strategy
- Growth Hacker → GTM plan
- Support Responder → Support blueprint
- UX Researcher → Personas + design principles
- Project Shepherd → 35-week timeline + 65 sprint tickets
- XR Interface Architect → Spatial UI spec

Each produced a full domain deliverable. A Cross-Agent Synthesis section (Section 10) noted where agents independently converged on the same conclusions ("2D-first, spatial-second" — all 8 arrived i

ndependently).

**Duration recorded:** ~10 minutes wall-clock time (nexus-spatial-discovery.md L6)

---

### FEATURE MATRIX

| Feature | Support Level | Evidence |
|---------|--------------|----------|
| **Model binding per agent** | NOT SUPPORTED | No  field in any agent YAML. All agents use whatever model runs Claude Code. |
| **Runtime model switching** | NOT SUPPORTED | No mechanism to swap model between agent invocations within a pipeline run. |
| **Agent handoff (sequential)** | SUPPORTED via prompts | Orchestrator spawns agents by name with context; NEXUS Handoff Template carries state. agents-orchestrator.md L57-106 |
| **Agent handoff (parallel)** | SUPPORTED | Nexus discovery example: 8 agents simultaneously. nexus-spatial-discovery.md L6-8 |
| **Review loops (Dev-QA)** | SUPPORTED | Evidence Collector - PASS/FAIL - retry up to 3 times. nexus-strategy.md L291-314 |
| **Approval gating** | SUPPORTED | Phase gates with named gatekeepers (Reality Checker as sole authority for Phase 4-5). nexus-strategy.md L706-715 |
| **Tool system** | IMPLICIT ONLY | No defined tool registry. Tools referenced are assumed Claude Code capabilities (bash, file I/O, Playwright). |
| **Memory/session persistence** | NO REAL PERSISTENCE | Simulated via prompt priming ("you remember...") + explicit handoff context passing. |
| **Configurable retry count** | FIXED AT 3 | Max 3 retries before escalation. Hard-coded in NEXUS protocol. nexus-strategy.md L54 |
| **Escalation path** | DEFINED | Escalation Report - Agents Orchestrator - Studio Producer. handoff-templates.md L149-202 |
| **Cross-agent context passing** | STRUCTURED | NEXUS Handoff Document format with metadata, context, deliverable, quality expectations. |
| **Quality gates** | 6 NAMED GATES | One between each of the 7 phases. Different gatekeepers per gate. nexus-strategy.md L704-715 |

---

### MAPPING TO OPENCODE / OH-MY-OPENCODE

#### What transfers directly (OMO already has this or equivalent):

1. **Agent-as-Markdown-file format** - OMO .opencode/skills/ and .opencode/agents/ use exactly this pattern. The frontmatter format is identical to what OMO uses.

2. **Orchestrator-as-agent** - OMO's /fw-dev command and jira-deep-analysis skill already implement multi-agent orchestration via natural language delegation. The NEXUS orchestrator adds no new mechanism.

3. **Sequential handoff** - OMO skill chain (jira-deep-analysis -> fw-code-researcher -> fw-code-writer -> fw-commit-generator -> fw-pr-reviewer) is architecturally identical to NEXUS sequential handoffs.

4. **Quality gate / review loop** - OMO's fw-pr-reviewer with "7-dimension review loop until APPROVE" is equivalent to the NEXUS Dev-QA loop.

5. **Phase-based workflow** - OMO's /fw-dev implements the same phased progression concept.

#### What agency-agents has that OMO does NOT:

1. **Parallel agent execution** - NEXUS explicitly supports spawning 8 agents simultaneously. OMO's current skill chain is sequential. (OMO tool calls can be parallelized within a single skill, which partially covers this.)

2. **Formalized handoff templates** - NEXUS defines 7 typed handoff document formats with structured fields. OMO passes context implicitly. This is a real gap for complex multi-step workflows.

3. **Escalation chains** - NEXUS: Orchestrator -> Studio Producer when tasks fail 3 times. OMO's fw-pr-reviewer loops but doesn't define an explicit escalation/human-approval path.

#### THE CRITICAL ANSWER: Mixed-model iterative PR workflows

**Hard Fact:** agency-agents provides ZERO model-routing capabilities. It cannot run Agent A on Claude Opus and Agent B on GPT-4. All agents run on the same model.

**Implication for OMO:** To get mixed-model iterative PR workflows, NOTHING from agency-agents can be ported -- it simply does not have that feature. The capability must be built directly in OMO via:
- OpenCode's background task system (each task() call potentially targeting different models if platform supports it)
- Explicit model parameter in skill/agent frontmatter (not currently in OMO spec or agency-agents)
- External orchestration (different OpenCode sessions with different model configs)

**What IS worth porting from agency-agents to OMO:**
- The Handoff Template patterns (especially structured PASS/FAIL QA feedback format) address context loss at handoff boundaries
- The Escalation Report pattern for when fw-pr-reviewer loops forever
- The phase gate concept with named gatekeepers for firmware workflow checkpoints

---

## Execution: Model-Bound Agent Routing Implementation
**Date:** 2026-03-08
**Commit SHA:** (pending)

### What was implemented

Created two new model-bound agent definitions to enable explicit model routing in `/fw-dev` command:

1. **fw-analyst-opus.md** (`anthropic/claude-opus-4-6`)
   - Handles Steps 1–2: JIRA analysis + code research
   - Routed via YAML frontmatter `model:` field
   - Purpose: Deep complexity reasoning for multi-file dependency chains

2. **fw-reviewer-sonnet.md** (`anthropic/claude-sonnet-4-6`)
   - Handles Step 6–7: PR review + iteration loop
   - Routed via YAML frontmatter `model:` field
   - Purpose: Fast turnaround on 7-dimension verification (cost-effective for loops)

3. **fw-dev.md updated**
   - Step 1: "切換到 `fw-analyst-opus` agent（使用 Claude Opus 4.6 進行深度分析）"
   - Step 2: "繼續使用 `fw-analyst-opus` agent（保持 Claude Opus 上下文）"
   - Step 6: "切換到 `fw-reviewer-sonnet` agent（使用 Claude Sonnet 4.6 進行快速迭代審查）"
   - Step 7 loop: "繼續使用 fw-reviewer-sonnet 進行審查"

### Pattern discovered

**OMO model routing architecture:**
- Agent files live in `.opencode/agents/{name}.md` with YAML frontmatter
- `name:` field identifies the agent; `model:` field binds to a specific model ID
- Commands like `/fw-dev` explicitly switch agents via text like "切換到 `{agent-name}` agent"
- Context is passed implicitly through orchestrator narrative (no programmatic state bus)
- Handoff boundaries happen when agent switching occurs; context carryover is orchestrator's responsibility

### Key insight: Implicit handoff vs. explicit routing

Unlike agency-agents (which has NO model binding at all), OMO's agent definition includes `model:` in frontmatter. This enables:
- Per-agent model selection at definition time (not runtime)
- Predictable model assignment (no "whatever Claude Code loads" non-determinism)
- Cost optimization: Opus for complexity, Sonnet for iterations

The `/fw-dev` command text explicitly names agent switches to make routing visible to users and orchestrators.

### Validation

All three files verified:
- fw-analyst-opus.md: Frontmatter complete, workflow clear
- fw-reviewer-sonnet.md: Frontmatter complete, 7-dimension review documented
- fw-dev.md: All steps explicitly mention agent names; Safety Gate unchanged; Chinese wording preserved

No changes to forbidden repo policy. Step 3 (fw-coder) remains unchanged.

---
