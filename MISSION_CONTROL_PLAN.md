# Mission Control Plan

_Last updated: 2026-03-23_

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
Status: In progress

Done when:
- each project phase has an explicit owner, dependency set, and next handoff
- Henry can inspect phase state and produce a clear review or coordination packet

Depends on:
- milestone 1 run envelope
- stable project to task linkage

Next checkpoint:
- extend the phase packet into Henry review and handoff flow
- keep phase owner, dependency, and linked-task context visible from Projects without opening Tasks first

### 3. Review and Handoff Workflow
Status: Queued

Done when:
- reviewer assignment is first-class in task and project flows
- handoff packets are explicit and inspectable
- blocked or review-needed work can be filtered without reading raw notes

## Current Focus

Move Mission Control out of the row-polish loop and into real execution semantics.

Priority now:
1. keep project phases on the same structured run envelope as tasks
2. turn phase packets into Henry review and handoff workflow instead of standalone status pings
3. surface review-needed work without reading raw packet text

## Rules

1. One milestone-advancing checkpoint per commit.
2. No more than two consecutive polish-only checkpoints unless they unblock a broken flow.
3. If a surface cannot really save or launch work, label it honestly.
4. Any UI or API behavior change must end with targeted lint plus `npm run build`.
5. Keep detailed checkpoint history out of this file.

## Latest Checkpoint

### 2026-03-23

- reset the planning docs into active plan, backlog, and log files
- upgraded team action prompts from loose chat to structured operator packets
- fixed Settings to read the real OpenClaw model configuration instead of an unrelated fallback
- wired task-linked owner packets into execution history with session, model, and structured field capture
- fixed execution history so task rows read the real task data source and only show attempts for the current task
- added phase-linked coordination packets, history, and current-phase packet badges to Projects

## References

- `MISSION_CONTROL_LOG.md`
- `MISSION_CONTROL_BACKLOG.md`
