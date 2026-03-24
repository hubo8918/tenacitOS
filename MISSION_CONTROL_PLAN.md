# Mission Control Plan

_Last updated: 2026-03-24_

This is the active execution plan for Mission Control. Keep this file short, current, and honest.

Detailed checkpoint history belongs in `MISSION_CONTROL_LOG.md`.
Deferred work belongs in `MISSION_CONTROL_BACKLOG.md`.

## North Star

Mission Control should let Bo run real multi-agent work from one surface:
1. define agents, roles, capabilities, and relationships
2. create and route tasks and projects with explicit owners, reviewers, blockers, and handoffs
3. launch agent work from task context without pretending automation already exists
4. inspect runs, outputs, and review state from the same task or project record
5. let Henry coordinate project phases through real task packets and review handoffs

## Product Truths

- Team and Agents are real configuration surfaces for planning metadata.
- Tasks and Projects support real create and edit flows plus first-pass routing metadata.
- Files supports real CRUD inside the workspace.
- Calendar is still a workload and handoff view, not a full editing surface.
- Team action prompts now support task-linked and phase-linked operator packets, but they are still explicit one-off turns rather than background automation.
- Project phases now support explicit owner, reviewer, handoff, dependency, coordination, and review metadata in the same saved record.

## Active Milestones

### 1. Task to Agent Run Contract
Status: Complete

Why now:
- This is the shortest path from dashboard polish to real operations.

Done when:
- a task can request an agent run with a clear operator packet
- the run captures agent, model, session, status, and summary
- the task can link to its latest run without fake "fully autonomous" claims

Completed:
- persisted a first task-linked run envelope for Mission Control team actions
- attached structured action output to task context instead of raw free text only

Not now:
- hidden auto-delegation
- background automation
- bulk scheduling

### 2. Project Phase Coordination
Status: Complete

Done when:
- each project phase has an explicit owner, dependency set, and next handoff
- Henry can inspect phase state and produce a clear review or coordination packet

Depends on:
- milestone 1 run envelope
- stable project to task linkage

### 3. Review and Handoff Workflow
Status: Complete

Done when:
- reviewer assignment is first-class in task and project flows
- handoff packets are explicit and inspectable
- blocked or review-needed work can be filtered without reading raw notes

Completed:
- Tasks and Projects now surface review-needed work as an explicit queue instead of burying it in packet text
- task and phase review decisions now support explicit approve / rework / blocked actions with persisted run history

### 4. Henry Review Inbox
Status: Complete

Done when:
- Henry can see task and phase review-needed work from one place
- review actions do not require opening each task or project card one at a time
- review handoff decisions are visible as queue state, not only history

Depends on:
- milestone 3 review workflow

Completed so far:
- Team now exposes a reviewer-focused unified inbox that combines task and phase review queues
- inbox links now open Tasks and Projects directly into `review=1` queue views
- inbox items now support direct approve / rework / blocked actions for both tasks and project phases

### 5. Review Operations Hardening
Status: Complete

Done when:
- inbox links land directly on the exact task row or project phase that needs attention
- review decisions can carry richer rationale than a status badge alone
- handoff and approval changes stay visible without digging through raw history entries

## Current Focus

Move Mission Control out of the row-polish loop and into real execution semantics.

Priority now:
1. turn the hardened review flows into a clearer Henry operating model for assigning, approving, and rerouting work
2. keep shrinking the gap between a saved task or phase record and the exact OpenClaw run/session it produced
3. resist slipping back into copy polish when execution semantics are the real product work

## Rules

1. One milestone-advancing checkpoint per commit.
2. No more than two consecutive polish-only checkpoints unless they unblock a broken flow.
3. If a surface cannot really save or launch work, label it honestly.
4. Any UI or API behavior change must end with targeted lint plus `npm run build`.
5. Keep detailed checkpoint history out of this file.

## Latest Checkpoint

### 2026-03-24

- reset the planning docs into active plan, backlog, and log files
- upgraded team action prompts from loose chat to structured operator packets
- fixed Settings to read the real OpenClaw model configuration instead of an unrelated fallback
- wired task-linked owner packets into execution history with session, model, and structured field capture
- fixed execution history so task rows read the real task data source and only show attempts for the current task
- added phase-linked coordination packets, history, and current-phase packet badges to Projects
- added project-phase reviewer and handoff metadata plus first-pass review packets with decision and handoff fields
- surfaced task and project review-needed work as explicit review queue filters instead of raw note hunting
- added manual approve / rework / blocked decisions for both project phases and tasks, including handoff-aware state transitions
- added a reviewer-focused unified review inbox on Team plus deep links into `review=1` Tasks and Projects queue views
- added direct task and phase review actions inside the Team review inbox so Henry no longer has to open each card to decide
- added a recent review decisions strip so approvals, rework calls, and handoffs stay visible after items leave the active queue
- tightened review semantics so `needs_review` now means "waiting on reviewer" instead of mixing in rework or blocked states
- moved Team recent decisions to real review-history sources, so approvals survive later owner check-ins
- added reviewer note + handoff composers to Team, Tasks, and Projects instead of one-click badge-only decisions
- tightened Team review focus to `all / unassigned / explicit reviewer`, with no fallback-to-owner queue pollution
- added `phaseId` deep links plus project-card highlighting so Team inbox can land on the exact project phase that needs action
- split selected-phase operations from current-phase summary inside Project cards and fixed the phase-owner editor bug
- synced Team profile edit drafts from current data and added required-field validation before save

## References

- `MISSION_CONTROL_LOG.md`
- `MISSION_CONTROL_BACKLOG.md`
