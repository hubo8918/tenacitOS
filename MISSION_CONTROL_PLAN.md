# Mission Control Plan

_Last updated: 2026-03-13_

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
  - `reportsTo`
  - `canReviewFor`
  - `canDelegateTo`

#### Agents
- Better first paint and trust semantics landed earlier:
  - SSR initial data
  - unavailable state instead of misleading empty page
  - delayed-sync banner
- Agents now has a first true Mission Control config surface for planning metadata:
  - `canLead`
  - `canReview`
  - `canExecute`
  - `workTypes`
- Runtime fields are still intentionally read-only.

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
- first true task-intake flow now landed for:
  - title
  - status
  - priority
  - project
  - due date
  - initial owner
- row actions already support status updates and delete
- row-level details editing now supports:
  - title
  - project
  - due date
  - status
  - priority
- row actions now handle status/delete more honestly:
  - delete confirmation
  - explicit backend error handling
  - no silent false-success path for status/delete actions
- visible project linkage now exists from each task row, and task-origin project jumps now open a focused Projects view for the matching title when one exists
- board-level attention summary now also surfaces project-label / project-title mismatches before operators have to open individual task rows, and mismatched rows now expose a direct cleanup CTA into the existing details editor
- dependency editing now exists with:
  - blocker selection
  - cycle guards
  - stale/completed blocker cleanup filtering
- **Still missing richer linked-task/project editing and broader dependency-management UX.**

#### Projects
- SSR initial data
- unreadable stored data no longer masquerades as an empty portfolio
- first true project-intake flow now saves:
  - title
  - description
  - status
  - priority
  - initial owner
- the project planning editor now supports title, description, status, priority, owner, participating agents, and current phase edits in one surface
- participating-agent visibility now reads directly on each project card, and the planning editor can now update participating-agent assignments
- current-phase dependency visibility now reads directly on each project card
- the project planning editor can now edit the current phase's dependency links against other tracked phases, while keeping missing/stale dependency ids explicit until an operator removes them
- the project planning editor can now append one additional tracked phase per save, so dependency selection no longer dead-ends once a project already has a first saved phase
- project ↔ task linkage now reads directly on each project card as a Tasks summary, and each card can now create a new linked task with the stable project id already attached
- the project planning editor can now also remove an existing linked task from the current project without pretending Projects owns the rest of that task's fields
- the project planning editor can now also attach an existing unlinked or unresolved task to the current project by saving the stable project id, without silently stealing tasks from another live project
- the project planning editor can now also move a task here from another live project with explicit source/target copy, by rewriting only that task's saved project linkage instead of pretending the rest of the task is editable inline
- the project delete flow can now optionally detach currently linked tasks by clearing their saved `project` / `projectId` fields in the same explicit confirmation step
- linked task summaries now call out blocked/overdue attention without pretending Projects owns task editing
- zero-linked projects now include a focused Tasks-board handoff instead of reading like a dead-end empty state
- the project planning editor can now delete a selected tracked phase when no other saved phase still depends on it, and it blocks that delete with named dependency refs instead of silently creating missing sequencing data
- **Manual tracked-phase reordering still has no clear product meaning because the card's current-phase summary is driven by live phase status first; treat broader phase-list ordering as a later schema/product decision, not unfinished fake CRUD.**

#### Calendar
- SSR initial task-backed calendar data
- **Still mostly a read-only workload/due-date view.**

#### Files
- Real CRUD/edit/upload flows already exist
- browse / write / download now share a unified workspace path resolver
- file editing now supports workspace-relative, absolute, and `~` paths that still resolve inside known workspaces
- create-file/create-folder no longer fake success when the backend rejects the request
- directory-load failures now preserve backend error detail and give the operator retry / go-up recovery
- upload failures now surface explicit backend error messages, and invalid upload paths no longer fake success
- Files Phase 2.5 trust/stability pass is now at a clean stopping point

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
- foundational schema work landed and is no longer the immediate focus
- task/project data and API contracts preserve first-pass orchestration fields
- Tasks page exposes the first safe routing edit flow for assignee / reviewer / handoff metadata

### Next micro-step
- keep downstream UI flows honest as later phases build on this schema; do not widen Phase 1 for its own sake

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
- **Phase 3 honest exit criteria are now met for core Tasks/Projects operations**
- Files trust/stability pass is complete enough to widen back into Tasks
- Tasks now has true create/edit/delete/assign/dependency/project-linkage flows
- Projects now has true create/edit/delete/owner/participant/phase/link-management flows
- Manual tracked-phase reordering is not part of the core exit and now looks like a later product decision because current-phase summaries are status-driven rather than manually ordered

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
1. Deepen Tasks CRUD one honest step at a time (next best candidate: keep task/project coordination flows honest without widening into fake automation)
2. Deepen Projects one honest step at a time beyond owner/phase editing and read-only coordination visibility
3. Keep Project ↔ Task linkage honest; only widen beyond read-only visibility when the backing linkage model is stable enough for real editing

### P1
4. Strengthen Agents runtime/delegate-matrix clarity without pretending runtime config is more editable than it is
5. Turn Calendar into a clearer workload/planning surface
6. Add execution/run history layer only after the coordination surfaces stay trustworthy

### P2
7. Add execution/run history layer
8. Add Henry-led orchestration hooks only after Phases 1–5 are stable
9. Broaden Team/Agents relationship metadata only if the narrower flows prove useful in practice

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

### 2026-03-11 00:18
- Step: File browser create-flow trust fix
- Files:
  - `src/components/FileBrowser.tsx`
- Validation:
  - `npx eslint src/components/FileBrowser.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(files): respect create errors in file browser`)
- Result:
  - New file and new folder actions now respect backend error responses instead of treating any completed fetch like success.
  - If the API rejects a bad path, the create UI stays open, the editor does not launch against a non-existent file, and the returned server error is surfaced to the operator.
  - This keeps the newly hardened write-path trust boundary honest during real use instead of failing one step later in a confusing way.
- Next:
  - if Files gets one more trust pass, give directory-load/upload failures the same explicit error treatment before widening back into broader product work.

### 2026-03-11 18:13
- Step: Plan refresh after overnight Mission Control work
- Files:
  - `MISSION_CONTROL_PLAN.md`
- Validation:
  - manual plan consistency pass against current checkpoint log + `memory/2026-03-11.md`
- Commit: current checkpoint commit (`docs(plan): refresh mission control priorities`)
- Result:
  - The current-state summary now reflects that Agents has a real capability-profile editor, Team has three relationship fields, and Files already received path-hardening + create-flow trust fixes.
  - Phase 1 and the immediate priority queue no longer point at work that has already shipped.
  - Current focus now explicitly points to finishing the Files trust/stability pass before widening back into Tasks/Projects.
- Next:
  - complete the remaining Files trust/stability pass, then return to the first real Tasks/Projects CRUD flows.

### 2026-03-11 18:3x
- Step: Files directory-load + upload failure trust pass
- Files:
  - `src/components/FileBrowser.tsx`
  - `src/app/api/files/upload/route.ts`
- Validation:
  - `npx eslint src/components/FileBrowser.tsx src/app/api/files/upload/route.ts`
  - `npm run build`
- Commit: current checkpoint commit (`fix(files): harden load and upload failure UX`)
- Result:
  - Directory-load failures now keep the backend error message visible and give the operator retry / go-up recovery instead of a vague dead-end state.
  - Upload failures now surface explicit backend errors in the Files UI instead of only logging to the console.
  - Invalid upload paths no longer fake success; the upload route now uses the shared workspace resolver and rejects unsafe paths honestly.
- Next:
  - begin Phase 3 with the first true Tasks CRUD milestone, preferably a real create flow that complements the existing routing editor.

### 2026-03-11 18:4x
- Step: Tasks create-flow kickoff
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`feat(tasks): add first real create flow`)
- Result:
  - Tasks now has its first true create flow from the board itself instead of relying on JSON edits.
  - New tasks can save title, status, priority, project, due date, and initial owner through the existing `/api/agent-tasks` path.
  - Reviewer and handoff stay in the existing row-level routing editor, which keeps the create scope honest instead of pretending the whole board is fully editable.
- Next:
  - either deepen Tasks with the first broader edit/delete trust pass, or move to the first real Projects owner/phase editing milestone if that stays cleaner.

### 2026-03-11 18:5x
- Step: Tasks row-level details editor
- Files:
  - `src/components/TaskRow.tsx`
- Validation:
  - `npx eslint src/components/TaskRow.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(tasks): add row-level details editor`)
- Result:
  - Tasks can now edit the core board fields directly from the row action menu instead of only creating tasks and changing routing.
  - The new details editor saves title, project, due date, status, and priority through the existing `/api/agent-tasks` path.
  - Reviewer and handoff remain in the separate routing editor, so the board gained broader edit coverage without pretending to be a giant all-fields form.
- Next:
  - give Tasks delete/status actions the same trust treatment with confirmation and real backend error handling, or move to visible project linkage if that lands cleaner.

### 2026-03-11 21:xx
- Step: Tasks row-action trust pass
- Files:
  - `src/components/TaskRow.tsx`
- Validation:
  - `npx eslint src/components/TaskRow.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): require status confirmation before row actions`)
- Result:
  - Task row actions now treat status changes with the same explicit confirmation pattern already used for deletes.
  - Status updates still go through the existing `/api/agent-tasks` path, but now make the change explicit before sending and preserve the returned backend error message if the update fails.
  - This keeps row actions honest: Mission Control no longer flips task state immediately from the menu while pretending every update succeeded.
- Next:
  - either expose visible project linkage on Tasks, or move to the first real Projects owner/phase editing flow if that lands cleaner.

### 2026-03-11 21:3x
- Step: Tasks visible project linkage
- Files:
  - `src/components/TaskRow.tsx`
- Validation:
  - `npx eslint src/components/TaskRow.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(tasks): add visible project linkage`)
- Result:
  - The Tasks board now treats the project field as a real navigation surface instead of dead text.
  - Each task row links the visible project name to the Projects page in a new tab and adds a small external-link affordance so the jump reads like navigation, not editing.
  - This keeps the trust boundary honest: Tasks now exposes project linkage more clearly without pretending Projects already has full CRUD or inline cross-page synchronization.
- Next:
  - move to the first real Projects owner/phase editing flow, or add dependency tracking if keeping momentum on Tasks stays cleaner.

### 2026-03-11 21:5x
- Step: Projects owner/phase editing flow v1
- Files:
  - `src/app/(dashboard)/agents/projects/page.tsx`
  - `src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx`
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx "src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx" "src/app/(dashboard)/agents/projects/page.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): add owner and phase editing flow`)
- Result:
  - Projects now exposes a first real planning editor for project owner and current phase metadata instead of only a generic status/progress tweak box.
  - Project cards now show owner and current-phase summaries inline, so the saved planning metadata is visible without opening the editor.
  - The edit flow uses real team options, updates the stored owner/phase metadata through `/api/projects`, and surfaces backend save errors instead of silently assuming success.
- Next:
  - either deepen Projects with participating-agent or dependency visibility, or return to Tasks for dependency tracking.

### 2026-03-11 22:0x
- Step: Tasks dependency visibility v1
- Files:
  - `src/components/TaskRow.tsx`
  - `src/data/mockTasksData.ts`
- Validation:
  - `npx eslint src/components/TaskRow.tsx src/data/mockTasksData.ts`
  - `npm run build`
- Commit: current checkpoint commit (`feat(tasks): expose dependency visibility`)
- Result:
  - Tasks now surfaces blocking-task metadata directly on the row instead of leaving dependency state hidden in stored fields.
  - Blocked tasks show a compact dependency summary inline plus a clear navigation affordance back to the Tasks board.
  - The status confirmation panel also reflects current dependency context, so blocked work reads more honestly without pretending there is already full dependency management UI.
- Next:
  - either turn dependency visibility into a true dependency editor, or deepen Projects with participating-agent / dependency visibility so cross-project coordination becomes more legible.

### 2026-03-11 22:4x
- Step: Tasks dependency editor v1
- Files:
  - `src/components/TaskRow.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
  - `src/app/api/agent-tasks/route.ts`
- Validation:
  - `npx eslint src/components/TaskRow.tsx "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx" src/app/api/agent-tasks/route.ts src/data/mockTasksData.ts`
  - `npm run build`
- Commit: current checkpoint commit (`feat(tasks): add dependency editor`)
- Result:
  - Tasks row editing now supports saving blocking-task relationships instead of only exposing dependency state as read-only metadata.
  - The existing routing editor now includes a blocker picker with real task options, same-project tasks prioritized first, and the saved blocker list persists through `/api/agent-tasks`.
  - The API now rejects self-dependency on save, so the UI does not pretend dependency editing is wider or safer than it actually is.
- Next:
  - either deepen dependency editing with better filtering / cycle handling, or move to Projects participating-agent / dependency visibility.

### 2026-03-11 23:5x
- Step: Projects participating-agent visibility v1
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): expose participating agents`)
- Result:
  - Project cards now surface participating-agent metadata inline instead of leaving collaboration scope hidden in stored fields.
  - Cards show up to three agent avatars plus an overflow count so cross-project staffing reads at a glance without pretending Projects already has full participant editing.
  - This keeps the trust boundary honest: Projects is clearer about who is involved without pretending the page already has a full coordination matrix.
- Next:
  - either add project dependency visibility, or return to Tasks dependency-editor safety/filtering.

### 2026-03-12 00:25
- Step: Tasks dependency cycle guard v1
- Files:
  - `src/components/TaskRow.tsx`
  - `src/app/api/agent-tasks/route.ts`
- Validation:
  - `npx eslint src/components/TaskRow.tsx src/app/api/agent-tasks/route.ts`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): block dependency cycles`)
- Result:
  - The Tasks routing editor now disables blocker choices that would create a dependency cycle and explains why those options are unavailable.
  - Saving task blockers now gets the same trust guard on the backend, so `/api/agent-tasks` rejects cycles instead of persisting impossible dependency chains.
  - This keeps dependency editing honest without pretending Mission Control already has a full dependency-graph management surface.
- Next:
  - either add project dependency visibility on Projects, or improve task dependency filtering for stale/completed blockers.

### 2026-03-12 00:5x
- Step: Tasks stale/completed blocker cleanup filter
- Files:
  - `src/components/TaskRow.tsx`
  - `src/app/api/agent-tasks/route.ts`
- Validation:
  - `npx eslint src/components/TaskRow.tsx src/app/api/agent-tasks/route.ts`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): filter stale blockers from dependency saves`)
- Result:
  - The dependency picker now offers unfinished blockers for new selection and keeps completed or missing blockers visible only long enough to clean them up.
  - Existing stale/completed blockers now trigger explicit cleanup messaging in the Tasks routing editor instead of quietly reading like active blockers.
  - `/api/agent-tasks` now rejects stale or completed blocker saves, so the backend trust boundary matches the UI.
- Next:
  - either add project dependency visibility on Projects, or improve how Tasks surfaces stale blocker cleanup from the main board state.

### 2026-03-12 01:23
- Step: Tasks stale blocker cleanup board visibility
- Files:
  - `src/components/TaskRow.tsx`
- Validation:
  - `npx eslint src/components/TaskRow.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): surface blocker cleanup on board`)
- Result:
  - Task rows now flag missing or already-completed blockers directly in the main board state instead of hiding that cleanup need inside the routing editor.
  - The visible blocker summary now labels stale blocker state more honestly, and the row exposes a direct cleanup affordance back into the routing editor.
  - This keeps dependency state trustworthy without pretending stale blockers are still active work.
- Next:
  - either add project dependency visibility on Projects, or widen the Tasks board-level attention summary only if stale blocker cleanup still feels too easy to miss.

### 2026-03-12 01:55
- Step: Projects phase dependency visibility v1
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): surface phase dependency visibility`)
- Result:
  - Project cards now surface current-phase dependency metadata inline instead of leaving phase blockers hidden in stored fields.
  - Resolved dependency phases show their current status directly on the card, and unresolved dependency IDs are called out honestly instead of disappearing.
  - This keeps Projects clearer about sequencing without pretending dependency editing already exists.
- Next:
  - either add visible Project ↔ Task linkage from Projects, or add a narrower dependency editor only if the read-only summary proves useful.

### 2026-03-12 02:xx
- Step: Projects linked-task visibility v1
- Files:
  - `src/app/(dashboard)/agents/projects/page.tsx`
  - `src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx`
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/app/(dashboard)/agents/projects/page.tsx src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): surface linked task visibility`)
- Result:
  - Project cards now surface linked task summaries directly from the Tasks board instead of leaving Project ↔ Task linkage implicit.
  - The Projects page keeps this honest by treating the linkage as a read-only summary based on current task project labels, with editing still living on Tasks.
  - Tasks data load failure now shows as unavailable instead of quietly reading like zero linked work.
- Next:
  - either keep Project ↔ Task linkage read-only until a stable editing model exists, or return to the next tighter trust issue on Tasks/Projects.

### 2026-03-12 02:5x
- Step: Projects linked-task attention summary v1
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: `75a013b`
- Result:
  - Project cards now summarize open, blocked, and overdue linked-task counts directly in the read-only Tasks summary.
  - Visible linked tasks now flag overdue due dates on the card instead of making urgency hide inside the Tasks board.
  - This keeps Project ↔ Task linkage honest and more actionable without widening into task editing from Projects.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust step stays narrow, make read-only navigation between a project card and its linked tasks more direct.

### 2026-03-12 03:xx
- Step: Projects linked-task navigation focus v1
- Files:
  - `src/components/ProjectCard.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): add focused task navigation`)
- Result:
  - Project cards now open the Tasks board with a project-specific focus instead of sending operators to an unfiltered task list.
  - The Tasks page now makes that project focus explicit, preserves existing status filters inside the focused set, and offers a clear path back to the full board.
  - This keeps Project ↔ Task linkage read-only while making cross-page navigation more direct and honest.
- Next:
  - keep Project ↔ Task linkage read-only, then return to the next tighter trust issue on Tasks/Projects instead of widening into fake cross-page editing.

### 2026-03-12 03:5x
- Step: Tasks project-focus scoped board summaries
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): scope project-focused board summaries`)
- Result:
  - When Tasks opens from a Project-specific focus, the board summary, attention badges, and status-filter counts now stay scoped to that project instead of quietly mixing in global board counts.
  - This keeps the focused Project ↔ Task navigation honest: operators now see the state of the selected project's tasks rather than unrelated work from other projects.
  - The task rows still use the full board data for dependency context, so this narrows the visible trust boundary without widening into cross-page editing.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next step stays narrow, either add a clearer zero-linked-task affordance from Projects or return to the next tight Tasks/Projects trust issue.

### 2026-03-12 04:xx
- Step: Projects zero-linked-task handoff affordance
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): add zero-linked task handoff`)
- Result:
  - Project cards with no linked tasks now offer a direct focused jump into the Tasks board instead of stopping at a dead-end empty state.
  - The empty state explicitly says linkage editing still lives on Tasks, so Projects remains honest about its read-only trust boundary.
  - This keeps Project ↔ Task linkage read-only while making the zero-linked case actionable.
- Next:
  - keep Project ↔ Task linkage read-only, then return to the next tight Tasks/Projects trust issue instead of widening into fake cross-page editing.

### 2026-03-12 05:xx
- Step: Tasks project-focused create-form defaults
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): prefill project-focused task intake`)
- Result:
  - When Tasks is opened from a Project-specific focus, the create form now starts with that project label instead of asking the operator to retype it.
  - The create-flow copy now says that default is coming from the current project focus and stays editable, so the handoff remains explicit instead of silently locking the field.
  - This keeps Project ↔ Task linkage read-only on Projects while making the focused handoff into real task creation more direct.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next step stays narrow, add a focused create-task CTA when a project-filtered board currently shows zero visible tasks.

### 2026-03-12 05:3x
- Step: Tasks project-focused empty-state intake CTA
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): add focused empty-state intake CTA`)
- Result:
  - A project-focused Tasks board now offers a direct create-task CTA when the current focus/filter combination shows zero visible tasks.
  - The focused empty state now distinguishes between "filter is hiding linked tasks" and "this project has no linked tasks yet" instead of collapsing both cases into the same vague message.
  - The CTA opens the existing intake form with the focused project label prefilled, keeping Project ↔ Task linkage read-only on Projects while making the handoff into real task creation more direct.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next step stays narrow, tighten the zero-linked Projects handoff copy so it explicitly points at the now-prefilled focused task intake.

### 2026-03-12 05:5x
- Step: Projects zero-linked handoff copy points to focused intake
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): clarify focused intake handoff copy`)
- Result:
  - The zero-linked state on Project cards now explicitly tells operators to open the focused Tasks view for that project and use the existing New task flow there.
  - The handoff copy now says that the task intake form starts with the project label prefilled, so the read-only Projects trust boundary stays clear while the next action is easier to discover.
  - This keeps Project ↔ Task linkage read-only on Projects and tightens the cross-page handoff instead of widening into fake inline editing.
- Next:
  - keep Project ↔ Task linkage read-only, then return to the next tight Tasks/Projects trust issue instead of widening into fake cross-page editing.

### 2026-03-12 06:20
- Step: Tasks → Projects focused navigation
- Files:
  - `src/components/TaskRow.tsx`
  - `src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx`
- Validation:
  - `npx eslint src/components/TaskRow.tsx "src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): focus Projects navigation from task rows`)
- Result:
  - Task-row project links now open Projects with a project-specific focus instead of dropping operators onto the full portfolio and making the jump feel less specific than it really is.
  - The Projects page now makes that focus explicit, scopes its summary counts to the matching project cards, and shows an honest mismatch state if a task label does not exactly match any tracked project title.
  - This keeps Project ↔ Task linkage read-only while tightening the reciprocal navigation path between Tasks and Projects.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust step stays narrow, surface task-label/project-title mismatches directly from Tasks before operators have to discover them through navigation.

### 2026-03-12 06:5x
- Step: Tasks project-label mismatch visibility
- Files:
  - `src/app/(dashboard)/agents/tasks/page.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
  - `src/components/TaskRow.tsx`
- Validation:
  - `npx eslint src/app/(dashboard)/agents/tasks/page.tsx "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx" src/components/TaskRow.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): surface project label mismatches inline`)
- Result:
  - Tasks now checks saved task project labels against current Projects titles and flags exact-title mismatches directly on the task row instead of making operators discover the problem only after clicking through.
  - Mismatched task project labels keep their existing focused Projects navigation path, but the row now warns that the jump will land in a mismatch state until titles line up.
  - This keeps Project ↔ Task linkage read-only while surfacing cross-page label drift earlier and more honestly.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust step stays narrow, add a board-level mismatch attention summary so label drift is visible before opening individual rows.

### 2026-03-12 07:xx
- Step: Tasks board-level project-label mismatch summary
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): add board-level mismatch summary`)
- Result:
  - The Tasks board-level attention summary now includes project-label / project-title mismatches instead of hiding that drift inside individual task rows.
  - The mismatch summary stays scoped to the currently visible board set, so a project-focused Tasks view does not quietly mix in unrelated global mismatch counts.
  - The summary also names the affected saved labels, which keeps Project ↔ Task navigation read-only but more honest before operators click into row-level details.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust step stays narrow, add a mismatch-only board filter or quick-jump affordance instead of widening into fake cross-page editing.

### 2026-03-12 08:xx
- Step: Tasks mismatch-only board filter
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): add mismatch-only board filter`)
- Result:
  - The Tasks attention banner can now switch the board into a mismatch-only view, so operators can isolate task/project title drift without manually scanning every row.
  - Turning that filter on resets the board to all statuses, keeps the scope inside the current project focus when one is active, and clearly marks when the board is filtered to mismatches only.
  - This keeps Project ↔ Task linkage read-only while making label-cleanup work more direct instead of widening into fake cross-page editing.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust step stays narrow, add a quick-jump affordance from the mismatch summary into the first affected row instead of widening into fake cross-page editing.

### 2026-03-12 08:20
- Step: Tasks mismatch-summary quick jump
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
  - `src/components/TaskRow.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx" src/components/TaskRow.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): jump from mismatch summary to first affected row`)
- Result:
  - The Tasks mismatch summary can now jump straight into the first affected row instead of making operators scan the board after seeing label drift.
  - That jump also turns on the mismatch-only view and clears status filtering first, so the handoff lands on a visible affected row instead of pretending hidden rows are already in view.
  - This keeps Project ↔ Task linkage read-only while making mismatch cleanup faster and more honest.
- Next:
  - keep Project ↔ Task linkage read-only, then reassess the next tight Tasks/Projects trust issue instead of widening into fake cross-page editing.

### 2026-03-12 08:5x
- Step: Projects mismatch cleanup handoff
- Files:
  - `src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx" "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): hand off label drift to Tasks mismatch view`)
- Result:
  - The Projects board now surfaces task/project title drift at the board level instead of silently leaving mismatched task labels invisible from the project side.
  - That banner links straight into the existing Tasks mismatch-only view, and the Tasks board now honors a `?mismatch=1` handoff without pretending Projects can repair linkage inline.
  - This keeps Project ↔ Task linkage read-only while making orphaned task labels easier to discover and clean up honestly.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust pass stays narrow, make the Projects mismatch handoff land on the first affected task row instead of only opening mismatch-only mode.

### 2026-03-12 09:24
- Step: Projects mismatch handoff lands on first affected task row
- Files:
  - `src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx" "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): jump mismatch handoff to affected task`)
- Result:
  - The Projects mismatch banner now hands off to Tasks with both mismatch-only mode and a specific mismatched task id, instead of only opening the broad mismatch view.
  - The Tasks board now honors that task-id handoff and scrolls directly to the requested mismatched row once the filtered board is visible.
  - This keeps Project ↔ Task linkage read-only while making label-drift cleanup more direct instead of pretending Projects can repair linkage inline.
- Next:
  - keep Project ↔ Task linkage read-only, then reassess the next tight Tasks/Projects trust issue instead of widening into fake cross-page editing.

### 2026-03-12 09:50
- Step: Tasks mismatched-row cleanup CTA
- Files:
  - `src/components/TaskRow.tsx`
- Validation:
  - `npx eslint src/components/TaskRow.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): add direct mismatch cleanup CTA`)
- Result:
  - Task rows with a project-label / project-title mismatch now expose a direct "Fix label" action right beside the mismatch badge instead of hiding cleanup behind the overflow menu.
  - The CTA opens the existing task-details editor, so Mission Control still uses the real saved project field instead of pretending Projects can repair linkage inline.
  - This keeps Project ↔ Task linkage read-only while making mismatch cleanup faster after the new Projects → Tasks handoff lands on an affected row.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust step stays narrow, make the mismatch-only Tasks view explain when the handoff landed on a specific row that already has a direct fix path.

### 2026-03-12 10:xx
- Step: Tasks targeted mismatch handoff explanation
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): explain targeted mismatch handoff`)
- Result:
  - The mismatch-only Tasks view now explains when Projects handed off to a specific mismatched row instead of only dropping the operator into filtered mode.
  - That notice explicitly points at the existing `No exact match` badge and row-level `Fix label` action, so cleanup still happens through the real saved task project field instead of pretending Projects can repair linkage inline.
  - This keeps Project ↔ Task linkage read-only while making the handoff state more legible once the board scrolls to the requested row.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust step stays narrow, make the targeted mismatch handoff easier to re-find after scrolling away from the requested row.

### 2026-03-12 10:53
- Step: Tasks targeted mismatch re-focus CTA
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): add mismatch re-focus CTA`)
- Result:
  - The targeted mismatch handoff notice now includes a direct jump-back control, so operators can re-center the requested mismatched row after scrolling elsewhere on the board.
  - The re-focus action re-applies the mismatch-only scope and scroll target instead of pretending the requested row should stay mentally tracked after the initial handoff.
  - This keeps Project ↔ Task linkage read-only while making the existing Tasks-side cleanup path easier to recover without widening into inline Project repairs.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust step stays narrow, briefly highlight the requested mismatched row after a targeted handoff or re-focus jump so the cleanup CTA is easier to spot.

### 2026-03-12 11:2x
- Step: Tasks targeted mismatch row highlight
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
  - `src/components/TaskRow.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx" src/components/TaskRow.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): highlight targeted mismatch handoff row`)
- Result:
  - A Projects → Tasks targeted mismatch handoff now briefly highlights the requested mismatched row after the board scrolls into place.
  - The same highlight also reappears when operators use the Tasks-side re-focus control, so the `No exact match` badge and row-level `Fix label` action are easier to spot after navigation.
  - This keeps Project ↔ Task linkage read-only while making the existing cleanup path easier to see instead of widening into inline Project repairs.
- Next:
  - keep Project ↔ Task linkage read-only, then reassess the next tight Tasks/Projects trust issue instead of widening into fake cross-page editing.

### 2026-03-12 11:5x
- Step: Projects linked-task targeted handoff
- Files:
  - `src/components/ProjectCard.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx" src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): target linked-task handoff into Tasks`)
- Result:
  - Linked task titles on Project cards now open the focused Tasks view on that specific task instead of only dropping operators onto the broader project board.
  - The Tasks board now honors that targeted handoff even outside mismatch cleanup, briefly highlighting the requested row and giving operators a jump-back control if they scroll away.
  - This keeps Project ↔ Task linkage read-only while making the existing cross-page navigation more direct for real blocked/overdue task follow-up.
- Next:
  - keep Project ↔ Task linkage read-only, then reassess the next tight Tasks/Projects trust issue instead of widening into fake cross-page editing.

### 2026-03-12 12:24
- Step: Tasks missing targeted-handoff state
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): clarify missing targeted handoff state`)
- Result:
  - A Projects → Tasks targeted handoff now stays honest when the requested task no longer belongs to the focused project label or has disappeared from the board.
  - The Tasks page explains why the requested row is missing instead of quietly dropping operators onto a misleading focused board that looks like the handoff still succeeded.
  - When the task still exists under a different saved project label, the page now offers a direct path into that task's current Tasks view without pretending Projects can repair the linkage inline.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust step stays narrow, add the same honest missing-target explanation for mismatch-specific handoffs after cleanup removes the requested row.

### 2026-03-12 13:xx
- Step: Tasks missing mismatch-handoff state
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): explain missing mismatch handoff state`)
- Result:
  - A Projects → Tasks mismatch-only handoff now stays honest when the requested cleanup row no longer appears because the label drift was already fixed or the task disappeared.
  - The Tasks page now explains that missing mismatch-target state instead of quietly leaving operators in mismatch-only mode with no indication of what changed.
  - When the task still exists outside mismatch-only cleanup, the page offers a direct path into that task's current Tasks view without pretending Projects can repair linkage inline.
- Next:
  - keep Project ↔ Task linkage read-only, then reassess the next tight Tasks/Projects trust issue instead of widening into fake cross-page editing.

### 2026-03-12 13:53
- Step: Projects mismatch-focus recovery handoff
- Files:
  - `src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx`
  - `src/components/TaskRow.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx" src/components/TaskRow.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): preserve requested task in mismatch focus`)
- Result:
  - Task-row project links now carry the originating task id into Projects, so an exact-title mismatch focus can stay anchored to the requested task instead of dead-ending on a generic empty state.
  - When that focused Projects view has no matching card, it now points operators back to the requested task's real Tasks-side cleanup flow instead of pretending Projects can repair linkage inline.
  - This keeps Project ↔ Task linkage read-only while tightening the recovery path after a Tasks → Projects mismatch handoff.
- Next:
  - keep Project ↔ Task linkage read-only, then reassess the next tight Tasks/Projects trust issue instead of widening into fake cross-page editing.

### 2026-03-12 14:23
- Step: Projects linked-task preview prioritizes urgent work
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): prioritize urgent linked-task previews`)
- Result:
  - Project cards still keep Project ↔ Task linkage read-only, but the visible three-task preview no longer depends on raw task array order.
  - Blocked and overdue linked tasks now rise to the top of the card preview before less urgent or completed work, so the preview better matches the card's existing blocked/overdue attention summary.
  - This keeps the Projects linkage summary honest and more actionable without widening into inline task editing.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust step stays narrow, surface when additional urgent linked tasks still exist beyond the three-row preview.

### 2026-03-12 15:xx
- Step: Projects urgent linked-task overflow summary
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): surface urgent task overflow beyond preview`)
- Result:
  - Project cards now stay honest when more blocked or overdue linked tasks exist beyond the visible three-row preview.
  - The linked-task section now calls out that hidden urgent overflow explicitly and links operators into the focused Tasks view instead of implying the preview already shows all urgent work.
  - This keeps Project ↔ Task linkage read-only while making urgent follow-up easier without widening into inline task editing.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust pass stays narrow, make the urgent-overflow handoff jump to the first hidden urgent task instead of only opening the focused Tasks view.

### 2026-03-12 15:20
- Step: Projects urgent-overflow targeted handoff
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): target urgent-overflow handoff`)
- Result:
  - The urgent-overflow CTA on Project cards now opens the focused Tasks view on the first hidden blocked or overdue task instead of only landing on the broader project board.
  - This reuses the existing targeted Tasks handoff and row highlight flow, so urgent follow-up lands on a real task without pretending Projects can edit linked tasks inline.
  - This keeps Project ↔ Task linkage read-only while making hidden urgent work faster to reach from Projects.
- Next:
  - keep Project ↔ Task linkage read-only, then reassess the next tight Tasks/Projects trust issue instead of widening into fake cross-page editing.

### 2026-03-12 15:5x
- Step: Tasks urgent-overflow handoff explanation
- Files:
  - `src/components/ProjectCard.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): explain urgent-overflow handoff target`)
- Result:
  - Project-card linked-task handoffs now label whether a targeted Tasks jump came from the visible preview or from the urgent-overflow CTA.
  - When Tasks opens from urgent overflow, the page now explicitly says the handoff picked the first hidden blocked or overdue task beyond the three-row preview instead of making that target feel arbitrary.
  - Missing-target fallback copy for that urgent-overflow path now stays honest about why the shortcut no longer has a live row to land on.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust step stays narrow, consider making the Projects-side urgent-overflow summary name the first hidden urgent task before the handoff.

### 2026-03-12 16:xx
- Step: Projects urgent-overflow target naming
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): name urgent overflow handoff target`)
- Result:
  - The urgent-overflow summary on Project cards now names the first hidden blocked or overdue task before operators click through to Tasks.
  - The CTA title now points at that same task, so the Projects-side summary makes the targeted handoff feel intentional instead of arbitrary.
  - This keeps Project ↔ Task linkage read-only while making hidden urgent work easier to identify before leaving Projects.
- Next:
  - keep Project ↔ Task linkage read-only, then reassess the next tight Tasks/Projects trust issue instead of widening into fake cross-page editing.

### 2026-03-12 17:xx
- Step: Tasks urgent-overflow missing-target recovery
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`fix(tasks): recover urgent-overflow handoff when target moves`)
- Result:
  - If a Projects urgent-overflow handoff opens Tasks after the originally targeted hidden urgent task moved away or disappeared, the Tasks view now stays honest without dead-ending.
  - When another hidden blocked or overdue task still exists beyond the reconstructed three-row Projects preview for that focused project, Tasks now offers a direct jump to that current urgent row instead of pretending the original shortcut still has a live target.
  - This keeps Project ↔ Task linkage read-only while making the urgent-overflow recovery path more useful and explicit.
- Next:
  - keep Project ↔ Task linkage read-only, and if the next trust pass stays narrow, surface the same recovery option from the Projects-side urgent-overflow summary when the original target is already gone.

### 2026-03-12 17:20
- Step: Projects urgent-overflow recovery copy
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): clarify urgent-overflow recovery handoff`)
- Result:
  - The Projects-side urgent-overflow summary now names the current hidden urgent target and explicitly says the shortcut retargets if an earlier hidden urgent task already moved or disappeared.
  - The CTA copy now points at the current urgent handoff instead of reading like a generic review link, so the recovery path visible on Tasks is also legible before leaving Projects.
  - This keeps Project ↔ Task linkage read-only while making urgent-overflow follow-up more honest from the Projects card itself.
- Next:
  - keep Project ↔ Task linkage read-only, then reassess the next tight Tasks/Projects trust issue instead of widening into fake cross-page editing.

### 2026-03-12 18:23
- Step: Projects create-flow kickoff
- Files:
  - `src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx`
  - `src/app/api/projects/route.ts`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx" src/app/api/projects/route.ts`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): add first real create flow`)
- Result:
  - Projects now has its first true create flow from the board itself instead of relying on stored JSON or pre-seeded data.
  - New projects can save title, description, status, priority, and initial owner through `/api/projects`, with duplicate-title slug collisions rejected honestly instead of creating ambiguous project ids.
  - Current phase, participating agents, delete coverage, and linked-task editing still remain separate steps, so this intake stays narrow instead of pretending Projects CRUD is complete.
- Next:
  - either add the next honest Projects CRUD step (most likely delete coverage or broader edit management), or stop and explicitly call out that stable Project ↔ Task editing needs a real schema decision before widening.

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

### 2026-03-12 19:09
- Step: Projects delete coverage
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): add honest delete flow`)
- Result:
  - The Projects planning editor now includes a real delete flow with explicit confirmation instead of leaving project removal to stored JSON edits.
  - The delete copy stays honest about the trust boundary: deleting a project removes the project record only, while linked task labels still need cleanup from Tasks instead of pretending cross-page linkage updates automatically.
  - Save and delete actions now disable each other while in flight, and backend delete errors stay visible in the editor instead of failing silently.
- Next:
  - either add the next honest Projects CRUD/edit-management step, or stop and explicitly call out that stable Project ↔ Task editing needs a real schema decision before widening.

### 2026-03-12 19:55
- Step: Projects participating-agent editor
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): add participating-agent editor`)
- Result:
  - The existing Projects planning editor now saves participating-agent assignments instead of treating staffing as read-only card metadata.
  - Owner, participating agents, current phase, status, and progress now live in one honest project-planning surface, while linked-task cleanup still stays on Tasks.
  - This advances real Projects management without pretending project-title/linkage edits are already safe.
- Next:
  - either add the next narrow Projects management step, or explicitly call out that project-title linkage edits need a schema decision before widening.

### 2026-03-12 20:33
- Step: Stable Project ↔ Task linkage foundation
- Files:
  - `src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
  - `src/app/api/agent-tasks/route.ts`
  - `src/components/ProjectCard.tsx`
  - `src/components/TaskRow.tsx`
  - `src/data/mockTasksData.ts`
  - `src/lib/agent-tasks-data.ts`
  - `src/lib/project-task-linkage.ts`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx" "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx" src/app/api/agent-tasks/route.ts src/components/ProjectCard.tsx src/components/TaskRow.tsx src/data/mockTasksData.ts src/lib/agent-tasks-data.ts src/lib/project-task-linkage.ts`
  - `npm run build`
- Commit: current checkpoint commit (`feat(tasks): add stable project-id linkage`)
- Result:
  - Tasks now persist an optional `projectId` resolved from live project records, and existing task data backfills that id on load instead of staying title-string-only forever.
  - Project-focused views and linked-task previews now resolve via stable project ids first with legacy title fallback, so honest cross-board handoffs no longer depend only on exact title matches.
  - Task/project mismatch UI now flags only rows that truly fail to resolve to a live Projects record; broader project-title editing and richer link-management UX still remain separate follow-on work.
- Next:
  - use this stable linkage model for the next honest editable task/project management step instead of widening into fake cross-page editing.

### 2026-03-12 21:xx
- Step: Tasks tracked-project linkage editor
- Files:
  - `src/components/TaskRow.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint "src/components/TaskRow.tsx" "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`feat(tasks): add tracked project selector in task editor`)
- Result:
  - The task details editor now uses a real tracked-project selector for live Projects records instead of relying only on a free-typed project field.
  - Operators can still deliberately keep or repair an unresolved custom project label, but Mission Control now makes that trust boundary explicit instead of hiding it inside plain text input.
  - This is the first honest editable task ↔ project assignment flow built on the new stable `projectId` model, without pretending Projects can edit linked tasks inline.
- Next:
  - either apply the same stable tracked-project assignment model to task intake, or take the next narrow Projects CRUD step if that lands cleaner.

### 2026-03-12 21:xx
- Step: Tasks tracked-project intake selector
- Files:
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx" src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(tasks): use tracked project linkage in intake`)
- Result:
  - The New task intake flow now uses the same tracked-project vs custom-label model as the task details editor instead of falling back to a free-typed project field.
  - When Tasks opens from a live Projects focus, intake now defaults to the tracked project by stable id; custom/unresolved labels remain an explicit choice instead of hidden title matching.
  - This widens the honest editable Project ↔ Task linkage model without pretending Projects can edit linked tasks inline or that unresolved labels have become automatic linkage.
- Next:
  - take the next narrow Projects CRUD/project-management step, unless a deeper Project ↔ Task or dependency flow clearly requires a schema/product decision first.

### 2026-03-12 22:xx
- Step: Projects planning editor broadens core edit coverage
- Files:
  - `src/components/ProjectCard.tsx`
  - `src/app/api/projects/route.ts`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx src/app/api/projects/route.ts`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): edit core project fields`)
- Result:
  - The existing Projects planning editor now supports title, description, and priority edits instead of leaving those core project-management fields trapped in create-only flow.
  - Project updates now validate non-empty title/description plus duplicate-title conflicts on save, so broadened editing stays honest instead of silently creating ambiguous project records.
  - Tracked task links still ride the stable project-id model, while unresolved/custom task labels remain an explicit Tasks-side cleanup boundary instead of pretending every saved task label is rewritten automatically.
- Next:
  - take the next narrow Projects or dependency-management step, unless deeper phase/dependency editing first needs an explicit schema/product decision.

### 2026-03-12 22:xx
- Step: Projects card linked-task intake
- Files:
  - `src/components/ProjectCard.tsx`
  - `src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx "src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): add linked task intake to cards`)
- Result:
  - Each Project card can now create a new linked task directly from Projects, with the current project title plus stable `projectId` saved together instead of forcing every linkage change through a read-only summary and cross-page handoff.
  - Existing linked-task summaries and task-row navigation still stay honest about their trust boundary: editing or cleaning up existing task links remains on the Tasks board.
  - The Projects page now refetches both Projects and Tasks after a card-side linked-task create so the linkage summary updates immediately instead of looking stale.
- Next:
  - take the next narrow Projects or dependency-management step, unless deeper phase/dependency editing first needs an explicit schema/product decision.

### 2026-03-12 23:xx
- Step: Projects linked-task remove-link flow
- Files:
  - `src/components/ProjectCard.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): add linked-task remove flow`)
- Result:
  - The Projects planning editor can now remove an existing task link by clearing that task's saved `project`/`projectId` assignment from the project side instead of forcing every existing-link cleanup back through Tasks.
  - This widens the stable Project ↔ Task linkage model into a real editable remove-link path on Projects while keeping the trust boundary explicit: reassigning a task to a different project or editing the rest of the task still stays on Tasks.
  - Tasks-side handoff copy now reflects that Projects can add/remove links without pretending the project card has become a full inline task editor.
- Next:
  - take the next narrow dependency-management or linked-task reassignment step, unless deeper phase/dependency editing first needs an explicit schema/product decision.

### 2026-03-12 23:50
- Step: Projects existing-task attach flow
- Files:
  - `src/components/ProjectCard.tsx`
  - `src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx`
  - `src/app/(dashboard)/agents/tasks/TasksPageClient.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx "src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx" "src/app/(dashboard)/agents/tasks/TasksPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): attach existing unlinked tasks`)
- Result:
  - The Projects planning editor can now attach an existing task when that task currently has no live Projects record, covering both no-project rows and unresolved/custom-label rows.
  - Attaching saves the current project title plus stable `projectId`, so the Project ↔ Task model widens into a real editable attach flow instead of staying limited to new-task intake and remove-link cleanup.
  - Tasks already linked to another live project still stay out of scope here, so broader cross-project reassignment remains an explicit follow-on step instead of a hidden side effect.
- Next:
  - take the next narrow dependency-management or linked-task reassignment step, unless deeper phase/dependency editing first needs a schema/product decision.

### 2026-03-13 00:31
- Step: Projects cross-project task move flow
- Files:
  - `src/components/ProjectCard.tsx`
  - `src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx "src/app/(dashboard)/agents/projects/ProjectsPageClient.tsx"`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): move tracked tasks across projects`)
- Result:
  - The Projects planning editor can now explicitly move a task in from another live project instead of limiting project-side linkage edits to attach-unlinked/remove-link flows.
  - The move flow keeps the trust boundary narrow: it rewrites only the task's saved `project` / `projectId` linkage, names the current source project before save, and leaves the rest of the task editable only on Tasks.
  - This closes the honest cross-project reassignment gap in the stable Project ↔ Task model without pretending Projects has become a full inline task editor.
- Next:
  - take the next narrow dependency-management or phase-structure step, unless deeper phase/dependency editing first needs a schema/product decision.

### 2026-03-13 01:xx
- Step: Projects delete-time linked-task detach option
- Files:
  - `src/components/ProjectCard.tsx`
  - `src/app/api/projects/route.ts`
  - `src/lib/agent-tasks-data.ts`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx src/app/api/projects/route.ts src/lib/agent-tasks-data.ts`
  - `npm run build`
- Commit: current checkpoint commit (`fix(projects): allow delete-time task detachment`)
- Result:
  - The Projects delete flow can now explicitly clear saved task `project` / `projectId` linkage in the same confirmation step before removing the project record.
  - Delete copy now stays honest about loading/unavailable Tasks data, so the card only offers detachment when Mission Control can actually see the current linked tasks.
  - This advances the remaining Projects CRUD / project-management bucket without pretending broader task editing or dependency management moved onto Projects.
- Next:
  - take the next narrow phase/dependency step, unless that work first needs an explicit schema/product decision.

### 2026-03-13 02:24
- Step: Projects current-phase dependency editor
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): edit current phase dependencies`)
- Result:
  - The existing Projects planning editor can now change the current phase's saved `dependsOnPhaseIds` against other tracked phases instead of leaving dependency editing as read-only visibility.
  - Missing or stale dependency ids now stay explicit inside the editor until an operator removes them, so Mission Control does not quietly drop unresolved sequencing data.
  - This advances the broader dependency / linked-task UX bucket without pretending Projects already has full multi-phase structure management.
- Next:
  - decide whether the next honest Phase 3 step is a narrow phase-structure control, or explicitly stop and call out that broader phase-list management needs a schema/product decision before widening.

### 2026-03-13 03:xx
- Step: Projects add-phase append flow
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): append tracked phases from editor`)
- Result:
  - The Projects planning editor can now append one additional tracked phase per save instead of dead-ending once a project already has a first current phase.
  - The current-phase card now surfaces the saved tracked-phase count, so the new phase-structure step is visible without pretending Projects already has full multi-phase CRUD.
  - This advances the broader dependency / linked-task UX bucket honestly: dependency picks now have a real path to gain additional tracked phases, while reordering, deletion, and non-current dependency editing remain explicit follow-on work.
- Next:
  - decide whether the next honest Phase 3 step is a narrow non-current-phase editing control, or explicitly stop and call out that broader phase-list management still needs a schema/product decision before widening.

### 2026-03-13 03:xx
- Step: Projects tracked-phase selector editing
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): edit any tracked phase from planner`)
- Result:
  - The Projects planning editor can now target any saved tracked phase instead of only whichever phase the card currently treats as "current" by status order.
  - Title, status, and dependency edits now apply to the selected saved phase, which makes older phase dependency cleanup/editing real without pretending reordering or deletion already exists.
  - This advances the broader dependency / linked-task UX bucket honestly while keeping the card's current-phase summary and task trust boundaries explicit.
- Next:
  - take the next narrow phase-structure step (most likely tracked-phase deletion or reordering), unless that needs an explicit schema/product decision first.

### 2026-03-13 04:xx
- Step: Projects tracked-phase delete guard
- Files:
  - `src/components/ProjectCard.tsx`
- Validation:
  - `npx eslint src/components/ProjectCard.tsx`
  - `npm run build`
- Commit: current checkpoint commit (`feat(projects): add tracked-phase delete guard`)
- Result:
  - The Projects planning editor can now delete the selected saved phase when no other saved phase still depends on it.
  - If another saved phase still depends on that phase, delete stays blocked and names the dependent phases instead of silently creating missing dependency ids.
  - The delete copy explicitly says it discards unsaved planner edits and closes the editor after the narrow phase-delete step, which keeps the phase-structure trust boundary honest.
  - This closes the remaining honest Phase 3 phase-structure gap; manual phase reordering now looks like a separate product decision because current-phase summaries are status-driven.
- Next:
  - honest Phase 3 work now looks complete; stop widening here and only revisit manual phase ordering if Bo wants a product decision beyond Phase 3.

## Current Focus

**Current focus:** Phase 3 honest exit criteria now look complete. Mission Control has real Tasks create/edit/delete/assign/dependency/project-linkage flows, real Projects create/edit/delete/owner/participant/phase/link-management flows, stable `projectId`-backed Project ↔ Task editing, and a tracked-phase planner that now supports dependency editing, append, selection, and guarded deletion without faking cross-surface automation.

**Do next:**
1. stop widening Phase 3 here; this cron can disable itself after checkpointing because the remaining manual phase-order question now looks like a separate product decision
2. if Bo later wants manual tracked-phase ordering, treat it as a new schema/product call because current-phase summaries are status-driven rather than ordered by drag position
3. only move on to Phase 4 / Calendar or later execution work if Bo explicitly wants the next product phase
