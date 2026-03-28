# Mission Control Log

_Plan reset: 2026-03-23_

This file holds checkpoint summaries. Keep the active plan in `MISSION_CONTROL_PLAN.md`.

## Phase Summary

### Phase 1. Orchestration Schema Foundation

- task and project data now carries first-pass orchestration metadata
- Tasks already exposes assignee, reviewer, handoff, and dependency editing paths

### Phase 2. Team and Agents as Configuration Surfaces

- Team supports role, tier, badge, tags, reportsTo, canReviewFor, and canDelegateTo
- Agents exposes capability planning metadata such as canLead, canReview, canExecute, and workTypes

### Phase 3. Task Workflow Honesty

- real task intake and editing flows landed
- row-level status and delete actions are honest about failures
- dependency editing and project-linkage repair flows now exist

### Phase 4. Project Planning Surface

- real project intake and editing flows landed
- linked task attach, move, and detach flows now exist
- tracked phase dependencies are visible and editable
- phase-linked coordination packets now persist against current project phases
- tracked phases now carry reviewer and handoff metadata plus review packet history

### Phase 5. Platform and Trust Passes

- Files CRUD and path handling were stabilized
- Calendar and Tasks trust and wayfinding passes landed
- OpenClaw memory and qmd startup issues on Windows were cleaned up

## Recent Checkpoints

### 2026-03-28

- tightened Team inbox empty-state guidance so routing gaps now call out `Unassigned` review focus and explain that reviewer assignment plus `needs_review` is required before work can appear in Henry's queue
- added a small routing-status banner so Team and Projects can distinguish "needs setup" records from genuinely empty queues
- made Projects planning and phase-selection hints more explicit when a project has no phases, no reviewer, or no selected entity
- surfaced the active workspace in Files with a small auto-selected badge so the first-run file browser reads as loaded and scoped rather than empty

### 2026-03-25

- added persistent migration and normalization for legacy task and project JSON so runtime data now upgrades into the newer owner / reviewer / handoff / phase schema instead of only relying on loose type fallbacks
- seeded real project phases plus review-capable tasks into the default data set, which gives Team Inbox, Projects, and recent decisions honest first-load work instead of "nothing here" empty states
- simplified the Projects selection and draft state machine so project/phase clicks only hydrate drafts; dirty state now starts on actual edits, and create-phase drafts no longer lock the page
- stabilized Files first paint with a `loading -> resolved -> selected` workspace flow so auto-selected workspaces render the browser directly instead of flashing the "Select a workspace" empty state
- improved Team inbox empty-state guidance so it now explains the reviewer assignment plus `needs_review` run-status requirement
- widened dev proxy and Next dev origin allowances around internal HMR and font routes, and added `npm run test:migrations` plus migration regression coverage for legacy disk data
- verified fresh-start bootstrap behavior in a separate temp workspace so missing `projects.json` and `agent-tasks.json` now self-seed and persist without relying on cached module state
- removed generated Playwright audit output from the repo root and added `/output/` to `.gitignore` so browser test artifacts stay out of release commits
- introduced a shared file-system service so Files and Memory now resolve workspaces, paths, protection rules, uploads, downloads, and activity logging through one backend core
- replaced route-local workspace maps with shared registry lookups across `/api/browse`, `/api/files/*`, and the legacy memory facade
- standardized file API failures around `{ error, code }` so frontend error handling can distinguish invalid paths, missing paths, protected files, write denial, and workspace lookup failures
- Files now uses a shared client helper, inline error banners, confirm modals, and unsaved editor guards instead of `alert`-driven flows
- Memory now reuses the shared workspace loader and error client, supports nested `memory/**/*.md` trees, and keeps its allowlist limited to root memory docs plus markdown inside `memory/`
- added route-level tests covering workspace registry, traversal rejection, shared CRUD flow, and memory facade allowlist behavior
- closed the absolute-path workspace escape so file APIs now reject paths that point into another registered workspace even when the absolute path is valid on disk
- replaced markdown preview HTML injection with safe React Markdown rendering so workspace markdown no longer depends on `dangerouslySetInnerHTML`
- review attempts now persist reviewer id and reviewer name snapshots, keeping recent decisions and history tied to the reviewer who actually made the decision even after reassignment
- Team page server bootstrap now loads shared team data directly instead of self-fetching `/api/team` through host and cookie plumbing
- tightened `mkdir` semantics so folder names must be single path segments, then added tests for invalid names and cross-workspace absolute-path rejection
- targeted `eslint`, `npm run test:files`, and `npm run build` all passed after the filesystem hardening pass

### 2026-03-24

- introduced a unified work-item read/write layer so task and phase review flows now share `/api/work-items` and `/api/work-items/review`
- Team is now split into Inbox and Agents views; inbox now reads one combined task/phase queue instead of stitching together page-local review logic
- Tasks now uses summary rows plus a separate planning surface and shared work-item inspector instead of packing edit/review/history into each row
- Projects now uses summary cards plus separate project metadata, selected phase planning, and shared phase inspector panels
- Project cards no longer own linked-task attach/move/detach flows; linked task editing is now pushed back to the Tasks page where it belongs
- hardened review semantics so `needs_review` now only means "waiting for reviewer action"; rework maps back to running and block maps to failed
- Team review inbox now supports `all`, `unassigned`, and explicit-reviewer focus without fallbacking unassigned work onto owners
- Team recent decisions now read real task/phase review history instead of `latestRun`, so approve/rework/block decisions stay visible after later check-ins
- Team, Tasks, and Projects now all use the same review decision composer with required rationale for rework/block and optional handoff override
- Projects deep links now support `phaseId`, scroll to the target project card, and highlight it on arrival
- Project cards now keep current-phase summary separate from selected-phase actions, packets, history, and manual review decisions
- Project phase editing now has an explicit phase owner field and no longer overwrites phase ownership with the project owner
- Team profile editing now resets drafts from current props and blocks empty name/emoji/role/description saves before the request goes out
- targeted `eslint` passed and `npm run build` passed after the review-flow hardening pass

### 2026-03-23

- reset planning docs into plan, backlog, and log split
- upgraded team action prompts to structured operator packets
- fixed Settings model reporting to follow real OpenClaw config and recent session usage
- added the first task-linked owner packet flow from Tasks into persisted run history
- fixed execution history so task rows no longer read from the wrong task file or show unfiltered global attempts
- added the first phase-linked coordination packet flow from Projects into persisted phase run history
- Project cards now show current-phase packet badges plus recent phase packet history with model and session metadata
- Project phases now support reviewer / handoff routing and explicit review packets with decision + handoff fields
- Tasks and Projects now expose review-needed work as queue filters instead of requiring raw packet reading
- project phases now support manual approve / rework / blocked decisions with handoff-aware status changes
- Tasks now support manual approve / rework / blocked review decisions with task-linked execution history updates
- Team now exposes a reviewer-focused unified review inbox with task + phase links into `review=1` queue views
- Team review inbox now supports direct approve / rework / blocked actions for both task and phase items
- Team review inbox now keeps recent approve / rework / blocked decisions visible even after they leave the active queue
- recent Tasks and Calendar trust passes are now complete maintenance work, not the active milestone

### 2026-03-22

- task and project routing, linkage, and dependency improvements landed across Tasks and Projects

## Notes

- The detailed pre-reset checkpoint narrative is still available in git history if we need to trace a specific decision.
