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
- Team action prompts are still operator-driven one-off turns, not task-linked execution yet.

## Active Milestones

### 1. Task to Agent Run Contract
Status: In progress

Why now:
- This is the shortest path from dashboard polish to real operations.

Done when:
- a task can request an agent run with a clear operator packet
- the run captures agent, model, session, status, and summary
- the task can link to its latest run without fake "fully autonomous" claims

Next checkpoint:
- persist a first run envelope for Mission Control team actions
- attach structured action output to task or task-like context instead of raw free text only

Not now:
- hidden auto-delegation
- background automation
- bulk scheduling

### 2. Project Phase Coordination
Status: Next

Done when:
- each project phase has an explicit owner, dependency set, and next handoff
- Henry can inspect phase state and produce a clear review or coordination packet

Depends on:
- milestone 1 run envelope
- stable project to task linkage

### 3. Review and Handoff Workflow
Status: Queued

Done when:
- reviewer assignment is first-class in task and project flows
- handoff packets are explicit and inspectable
- blocked or review-needed work can be filtered without reading raw notes

## Current Focus

Move Mission Control out of the row-polish loop and into real execution semantics.

Priority now:
1. make agent interactions return structured operator packets
2. show the actual configured and recently used OpenClaw model story in Settings
3. wire the next task-facing run contract off that packet shape

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

## References

- `MISSION_CONTROL_LOG.md`
- `MISSION_CONTROL_BACKLOG.md`
