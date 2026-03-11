# Mission Control Plan

_Last updated: 2026-03-10_

This file is the working plan for turning Mission Control from a mostly read-only dashboard into a real multi-agent operations tool.

Use it as the source of truth for:
- what the target product is
- which phase is current
- what has already shipped
- what the next micro-step is
- what still blocks true multi-agent collaboration

---

## North Star

Mission Control should let Bo:
1. configure agents, their roles, capabilities, and relationships
2. create/edit/delete tasks, projects, calendar items, and files from the UI
3. assign work across multiple agents
4. track ownership, blockers, review, handoff, and progress
5. eventually let a lead agent (for example Henry) coordinate other agents on project phases

---

## Execution Rules

To avoid fake progress or silent drift:

1. **One micro-step per checkpoint**
   - one meaningful change
   - smallest useful scope
   - no giant mixed batches

2. **Every micro-step must end with validation**
   - targeted eslint for touched files
   - `npm run build` when UI/API behavior changes
   - optional smoke check when relevant

3. **Every completed micro-step must update this file**
   - mark status
   - add commit hash
   - record what changed
   - record next step

4. **No fake UI**
   - if a page cannot really save data, do not present it as editable
   - runtime/config semantics must stay honest

5. **Coordination before automation**
   - first model the workflow correctly
   - then add execution hooks
   - only then connect to real cross-agent orchestration

---

## Current State Snapshot

### Already improved

#### Team
- Team page bootstrap no longer requires manual pre-seeded overlay rows.
- Team cards can edit:
  - identity fields
  - tier
  - badge
  - tags

#### Agents
- Better first paint and trust semantics landed earlier:
  - SSR initial data
  - unavailable state instead of misleading empty page
  - delayed-sync banner
- **Still not a true config surface yet.**

#### Tasks
- SSR initial data
- better trust copy
- urgency-based ordering
- due-date timezone fix
- blocked/overdue summary
- improved empty/no-match states
- **Still missing full create/edit/delete/assign UI.**

#### Projects
- SSR initial data
- unreadable stored data no longer masquerades as an empty portfolio
- **Still missing full operational CRUD + ownership flow.**

#### Calendar
- SSR initial task-backed calendar data
- **Still mostly a read-only workload/due-date view.**

#### Files
- Real CRUD/edit/upload flows already exist
- may still need stability/polish work later

#### Platform stability
- OpenClaw upgraded to `2026.3.8`
- Windows main instance memory backend switched from `qmd` to `builtin`
- stale QMD collection-name residue cleaned up to reduce future conflicts

---

## Product Phases

## Phase 1 — Orchestration Data Model
**Goal:** Teach Mission Control how to represent multi-agent work before exposing more UI.

### Scope
Add/normalize fields for:
- agent role and capability metadata
- agent relationships
- project phases
- task orchestration metadata
- run history / execution metadata

### Desired entities

#### Agent profile
- `id`
- `role`
- `specialties`
- `canLead`
- `canReview`
- `canExecute`
- `workTypes`

#### Agent relationship
- `reportsTo`
- `canDelegateTo[]`
- `canReviewFor[]`
- `preferredCollaborators[]`

#### Project phase
- `id`
- `title`
- `ownerAgentId`
- `status`
- `dependsOnPhaseIds[]`

#### Task orchestration fields
- `assigneeAgentId`
- `reviewerAgentId`
- `blockedByTaskIds[]`
- `handoffToAgentId`
- `executionMode` (`manual` | `agent-run`)
- `runStatus`
- `deliverable`

#### Run history
- `id`
- `agentId`
- `taskId`
- `projectId`
- `startedAt`
- `endedAt`
- `status`
- `summary`

### Status
- **Current phase**
- **Started**
- Task/project data and API contracts now preserve first-pass orchestration fields

### Next micro-step
- Expose the first minimal UI entry point for these new task/project orchestration fields, starting with task assignment/ownership metadata.

---

## Phase 2 — Team and Agents become real configuration surfaces
**Goal:** Let Bo configure team structure and agent operational roles from the UI.

### Team page target
Make Team the organization/relationship surface:
- role
- tier
- badge
- tags
- `reportsTo`
- `canDelegateTo`
- `canReviewFor`
- collaboration metadata

### Agents page target
Make Agents the runtime/capability surface:
- capability profile
- can lead / review / execute
- accepted work types
- delegate matrix (display and later config wiring)
- stable save/error UX

### Status
- **Partially started**
- Team identity/tier/badge/tags are editable
- Agents page is still mostly read-only

### Exit criteria
- At least one true editable/savable config flow on Agents page
- Team page can represent agent relationships, not just identity

---

## Phase 3 — Tasks and Projects become operational boards
**Goal:** Turn Tasks/Projects into real work-management tools instead of mostly read views.

### Tasks target
Support full UI flow for:
- create
- edit
- delete
- assign
- review owner
- handoff target
- dependency tracking
- project linkage

### Projects target
Support full UI flow for:
- create
- edit
- delete
- owner assignment
- participating agents
- phase structure
- linked tasks

### Desired board semantics
Tasks should clearly show:
- who owns it
- who reviews it
- what blocks it
- who gets it next
- which project/phase it belongs to

### Status
- **In progress at the trust/perf layer**
- **Not done at the CRUD/orchestration layer**

### Exit criteria
- Tasks page supports true create/edit/delete/assign flows
- Projects page supports true create/edit/delete/owner flows
- Project ↔ task linkage is visible and editable

---

## Phase 4 — Calendar and work sequencing
**Goal:** Make Calendar useful as a workload/planning surface.

### Target
Calendar should reflect:
- task due dates
- project phase timing
- agent workload visibility
- blocked / overdue / upcoming work

### Status
- read-oriented

### Exit criteria
- Calendar is clearly tied to project/task scheduling
- can surface cross-agent workload and timing conflicts

---

## Phase 5 — Execution Layer
**Goal:** Connect structured Mission Control work to actual agent execution.

### First version
Support safe, semi-manual execution:
- generate agent work orders from tasks
- record run intent
- show run status/history
- capture result summaries

### Later version
Connect to real OpenClaw execution:
- `sessions_spawn`
- Henry as coordinator
- worker-agent delegation
- review / handoff tracking

### Status
- not started

### Exit criteria
- A project task can move from backlog -> assigned agent -> result summary in one coherent flow

---

## Phase 6 — Real Henry-led multi-agent coordination
**Goal:** Let Henry coordinate other agents from Mission Control instead of only from chat/manual instructions.

### Requirements later
- safe allowlist/delegation model
- session visibility model if needed
- explicit coordinator/worker relationships
- no uncontrolled swarm behavior

### Status
- deferred until Phases 1–5 are solid

---

## Immediate Priority Queue

### P0
1. Phase 1 data model for orchestration fields
2. First real editable flow on Agents page
3. First real task create/edit/assign flow

### P1
4. Team relationship editor
5. Project owner + phase model
6. Project ↔ task linkage

### P2
7. Calendar workload view
8. Execution/run history layer
9. Henry-led orchestration hooks

---

## Checkpoint Log

### 2026-03-10
- Stabilized host runtime before continuing product work:
  - OpenClaw upgraded to `2026.3.8`
  - main memory backend moved to `builtin`
  - stale QMD naming residue cleaned
- Team editor now supports:
  - tier
  - badge
  - tags
- Next intended product step:
  - **Phase 1 orchestration data model**
  - then first true Agents editable config flow

### 2026-03-10 18:xx
- Step: Phase 1 orchestration data model kickoff
- Files:
  - `src/lib/agent-tasks-data.ts`
  - `src/app/api/agent-tasks/route.ts`
  - `src/data/mockProjectsData.ts`
  - `src/lib/projects-data.ts`
  - `src/app/api/projects/route.ts`
- Validation:
  - `npx eslint src/lib/agent-tasks-data.ts src/app/api/agent-tasks/route.ts src/data/mockProjectsData.ts src/lib/projects-data.ts src/app/api/projects/route.ts`
  - `npm run build`
- Commit: pending
- Result:
  - tasks now preserve orchestration fields such as assignee/reviewer/blockers/handoff/execution status/deliverable
  - projects now preserve owner/participants/phases metadata
  - existing stored JSON remains backward-compatible via normalization
- Next:
  - expose the first safe UI editing surface for task ownership/orchestration metadata

---

## How to Update This File

After each completed micro-step, append:
- date/time
- step name
- files changed
- validation result
- commit hash
- next step

Suggested template:

```md
### YYYY-MM-DD HH:MM
- Step: <short name>
- Files: `a`, `b`
- Validation: eslint/build/<smoke>
- Commit: `<hash>`
- Result: <what became true>
- Next: <next micro-step>
```

---

## Current Focus

**Current focus:** Phase 1 orchestration data model

**Do next:**
1. extend task/project data shape with orchestration fields
2. update APIs to preserve those fields
3. then expose the first minimal UI that edits them safely
