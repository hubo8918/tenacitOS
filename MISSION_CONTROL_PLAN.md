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
- first safe routing editor now landed for:
  - assignee / owner
  - reviewer
  - handoff target
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
- Tasks page now exposes the first safe routing edit flow for assignee/reviewer/handoff metadata

### Next micro-step
- Build on the new Agents capability profile by surfacing relationship/delegation metadata next, or shift to the Team relationship editor now that Agents has its first real editable config flow.

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
- Team page now also supports the first reporting-line relationship field through editable `reportsTo` metadata
- Team page now also supports review-coverage metadata through editable `canReviewFor`
- Team page now also supports delegation-path metadata through editable `canDelegateTo`
- Agents page now has its first true editable capability/config flow for Mission Control planning metadata (`canLead`, `canReview`, `canExecute`, `workTypes`)
- Runtime fields on Agents remain read-only and explicitly labeled as such

### Exit criteria
- ✅ At least one true editable/savable config flow on Agents page
- ✅ Team page can represent agent relationships, not just identity (`reportsTo`, `canReviewFor`, and `canDelegateTo` now exist as narrow editable fields)

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
- Commit: `8bcc9fc`
- Result:
  - tasks now preserve orchestration fields such as assignee/reviewer/blockers/handoff/execution status/deliverable
  - projects now preserve owner/participants/phases metadata
  - existing stored JSON remains backward-compatible via normalization
- Next:
  - expose the first safe UI editing surface for task ownership/orchestration metadata

### 2026-03-10 19:14
- Step: Tasks ownership editor
- Files:
  - `src/app/(dashboard)/agents/tasks/page.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
  - `src/components/TaskRow.tsx`
  - `src/data/mockTasksData.ts`
- Validation:
  - `npx eslint src/data/mockTasksData.ts src/app/(dashboard)/agents/tasks/page.tsx src/app/(dashboard)/agents/tasks/TasksPageClient.tsx src/components/TaskRow.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(tasks): add first ownership editor`)
- Result:
  - Tasks now loads real agent options server-side and exposes a per-task ownership editor from the existing row action menu.
  - The first safe UI editing surface is intentionally narrow: owner/assignee plus optional reviewer only.
  - Saves still go through the existing `/api/agent-tasks` path, and the row now surfaces reviewer metadata without pretending the broader orchestration model is finished.
- Next:
  - add one more narrowly-scoped task orchestration field only if needed, with handoff target as the cleanest next step.

### 2026-03-10 19:38
- Step: Tasks handoff target editor
- Files:
  - `src/components/TaskRow.tsx`
  - `src/data/mockTasksData.ts`
  - `src/app/api/agent-tasks/route.ts`
- Validation:
  - `npx eslint src/components/TaskRow.tsx src/data/mockTasksData.ts src/app/api/agent-tasks/route.ts`
  - `npm run build`
- Commit: current checkpoint commit (`feat(tasks): add handoff target editor`)
- Result:
  - Tasks now exposes a minimal handoff target selector alongside owner and reviewer in the existing row-level routing editor.
  - The row surfaces handoff metadata inline so the next responsible agent is visible without opening the editor.
  - Saves stay on `PUT /api/agent-tasks`, and both the UI and API now reject reviewer/owner or owner/handoff collisions.
- Next:
  - move back to Phase 2 and add the next true config/edit surface on Agents instead of widening Tasks into execution automation.

### 2026-03-10 23:08
- Step: Agents capability profile editor
- Files:
  - `src/app/(dashboard)/agents/AgentsPageClient.tsx`
  - `src/app/api/agents/route.ts`
  - `src/lib/agents-data.ts`
  - `src/lib/agent-capabilities-data.ts`
- Validation:
  - `npx eslint src/app/(dashboard)/agents/AgentsPageClient.tsx src/app/api/agents/route.ts src/lib/agents-data.ts src/lib/agent-capabilities-data.ts`
  - `npm run build`
- Commit: current checkpoint commit (`feat(agents): add capability profile editor`)
- Result:
  - Agents now exposes the first true editable/savable config flow on the page through a Mission Control capability profile editor.
  - The saved planning metadata is intentionally scoped to `canLead`, `canReview`, `canExecute`, and `workTypes`.
  - Runtime fields like model, workspace, DM policy, and active-session status remain read-only and are explicitly described as separate from planning metadata.
- Next:
  - either add relationship/delegation metadata on Agents, or move to Team relationship editing now that the first Agents config foothold exists.

### 2026-03-10 23:19
- Step: Team reporting-line editor
- Files:
  - `src/components/AgentCard.tsx`
  - `src/app/(dashboard)/agents/team/TeamPageClient.tsx`
  - `src/app/api/team/route.ts`
  - `src/data/mockTeamData.ts`
- Validation:
  - `npx eslint src/components/AgentCard.tsx src/app/(dashboard)/agents/team/TeamPageClient.tsx src/app/api/team/route.ts src/data/mockTeamData.ts`
  - `npm run build`
- Commit: current checkpoint commit (`feat(team): add reporting line editor`)
- Result:
  - Team now supports the first true relationship-editing flow via `reportsTo`.
  - Each team card can save an organizational reporting line, and the card now surfaces that relationship inline instead of leaving org structure hidden in future plans.
  - The editor explicitly labels this as Mission Control organizational metadata, not an execution-permission rule.
- Next:
  - add one more narrow relationship field (`canDelegateTo` or `canReviewFor`) without turning Team into a giant matrix editor.

### 2026-03-10 23:35
- Step: Team review-coverage editor
- Files:
  - `src/components/AgentCard.tsx`
  - `src/app/(dashboard)/agents/team/TeamPageClient.tsx`
  - `src/app/api/team/route.ts`
  - `src/data/mockTeamData.ts`
- Validation:
  - `npx eslint src/components/AgentCard.tsx src/app/(dashboard)/agents/team/TeamPageClient.tsx src/app/api/team/route.ts src/data/mockTeamData.ts`
  - `npm run build`
- Commit: current checkpoint commit (`feat(team): add review coverage editor`)
- Result:
  - Team now supports `canReviewFor` as the second narrow relationship field.
  - Each team card can save review coverage through a checkbox list and shows the saved review relationships inline.
  - The editor explicitly labels review coverage as planning metadata, not a runtime ACL or hidden execution rule.
- Next:
  - add `canDelegateTo` as the next narrow Team relationship field.

### 2026-03-11 00:00
- Step: Team delegation-path editor + file path hardening
- Files:
  - `src/components/AgentCard.tsx`
  - `src/app/(dashboard)/agents/team/TeamPageClient.tsx`
  - `src/app/api/team/route.ts`
  - `src/data/mockTeamData.ts`
  - `src/components/FileBrowser.tsx`
  - `src/app/api/browse/route.ts`
  - `src/app/api/files/write/route.ts`
  - `src/app/api/files/download/route.ts`
  - `src/lib/workspace-files.ts`
- Validation:
  - `npx eslint src/lib/workspace-files.ts src/app/api/browse/route.ts src/app/api/files/write/route.ts src/app/api/files/download/route.ts src/components/FileBrowser.tsx src/app/api/team/route.ts src/components/AgentCard.tsx src/app/(dashboard)/agents/team/TeamPageClient.tsx src/data/mockTeamData.ts`
  - `npm run build`
- Commit: current checkpoint commit (`feat(team): add delegation paths and harden file path handling`)
- Result:
  - Team now supports `canDelegateTo` as a third narrow relationship field, using the same honest checkbox-list pattern as review coverage.
  - Team cards now surface delegation paths inline instead of keeping handoff structure implicit.
  - Mission Control file browse/write/download routes now share a real workspace map, support absolute and `~` paths that resolve inside known workspaces, and return clearer save/load errors in the editor.
- Next:
  - keep these new Team relationship flows and the hardened file-edit path stable before widening into broader relationship matrices or automation.

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

**Current focus:** Phase 2 — turn Agents and Team into honest configuration surfaces

**Do next:**
1. keep the new Agents capability profile plus Team reporting-line / review-coverage / delegation flows stable and honest
2. harden the newly unified file-edit path with a small smoke test and any UX polish that falls out of real use
3. avoid widening into execution automation until more coordination metadata is truly editable
