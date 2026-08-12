---
name: autonomous-hass-admin-executor
description: Explicitly invoked autonomous executor for the HASS Admin To-Do roadmap. Runs one HA todo item per phase through implementation, validation, email reporting, and HA-owned completion.
metadata:
  model: gpt-5.6-sol
  reasoning_effort: max
  context_tier: long_context
---

# Autonomous HASS Admin Executor

Use this skill only when the operator invokes `autonomous-hass-admin-executor` directly or when the repository launcher invokes it for `docs/autonomous-admin-roadmap.md`.

The launcher is authoritative for execution profile selection. It must run this skill with:

- model `gpt-5.6-sol`
- reasoning effort `max`
- context tier `long_context`

If any profile value differs, stop before making changes.

## Scope

- The canonical source queue is the Home Assistant Admin list `todo.groceries`.
- The canonical execution plan is `docs/autonomous-admin-roadmap.md`.
- One roadmap phase maps to exactly one Home Assistant todo UID.
- Work only the dependency-ready phase selected by `npm run autonomous:admin:next`.
- Do not work a second phase in the same Copilot invocation.

## Required phase loop

1. Read the complete roadmap, the selected phase, repository instructions, and every instruction file that applies to files you may edit.
2. Inspect current git state and preserve unrelated user changes.
3. Diagnose before editing. Build an explicit behavior/service matrix when Home Assistant state changes behavior.
4. For Home Assistant config changes, call the Home Assistant best-practices skill before editing and use supported MCP/API configuration tools. Never edit `.storage` directly.
5. Keep Home Assistant as the source of truth for state and multi-entity side effects. React only signals HA and uses existing optimistic-state patterns.
6. For React UX changes, complete the repository's code/config comparison and Playwright live HASS-versus-React comparison, mobile first. If the visual comparison cannot run, report the blocker and do not claim visual acceptance.
7. Add focused tests for changed behavior and run the smallest existing validation commands that prove the phase gate.
8. Do not commit, push, deploy, complete the HA todo item, send phase email, or send phone notifications. The parent runner owns completion and email; phone notifications are disabled.
9. Transition the canonical task from `in_progress` to `accepted`, `rejected`, or `hard_blocked` with `npm run autonomous:admin:transition`. Never edit queue status text by hand.
10. Return a human-readable Markdown phase report with: Outcome, Work Completed, Home Assistant Changes, React Dashboard Changes, Validation Evidence, Files and Artifacts, Remaining Risks, and Up Next.

## Decision rules

- `accepted`: the implementation and required evidence satisfy the phase acceptance gate.
- `rejected`: a tested hypothesis or proposed change was intentionally not kept, with evidence explaining why.
- `hard_blocked`: the remaining step requires unavailable credentials, privileged access, unsafe live action, external approval, hardware access, or another true operator boundary.
- A failed test, incomplete visual comparison, missing evidence, or repairable configuration gap is not acceptance.
- Taskization is not completion. Insert and execute necessary subtasks inside the active phase before deciding its outcome.
- Do not silently continue through missing HA entities, failed service calls, stale source config, or incomplete browser evidence.

## Completion boundary

After the phase process exits, the parent runner:

1. validates the terminal roadmap decision;
2. sends and receipts the phase email;
3. for accepted phases only, calls `script.complete_admin_todo_item`;
4. lets Home Assistant mark the item complete and write the task UID to `input_text.admin_todo_completion_receipt`;
5. finalizes only after both the todo state and completion receipt are confirmed.

Rejected or blocked phases still receive phase email, but their Home Assistant todo item remains open.
