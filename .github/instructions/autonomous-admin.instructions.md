---
applyTo: ".github/skills/autonomous-hass-admin-executor/SKILL.md,scripts/autonomous-admin*.ts,scripts/agent-report-email.ts,scripts/lib/*.ts,docs/autonomous-admin-roadmap.md"
---

# Autonomous Admin tooling instructions

- Keep the roadmap profile pinned to `gpt-5.6-sol`, `max`, and `long_context`.
- Keep exactly one queue between the autonomous queue markers and exactly one phase per Home Assistant Admin todo UID.
- Statuses are limited to `pending`, `in_progress`, `accepted`, `rejected`, `hard_blocked`, and `superseded`.
- Fail closed on profile mismatch, duplicate task ids or todo UIDs, unknown dependencies, cycles, multiple in-progress tasks, HA queue drift, missing SMTP readiness, missing phase reports, or unreceipted delivery claims.
- The runner must send and receipt phase email before it completes an accepted HA todo item.
- Accepted completion must call the HA-owned `script.complete_admin_todo_item`; it completes the item and records a receipt without sending a phone notification. Do not duplicate its completion side effects in Node or React.
- Require both completed todo state and `input_text.admin_todo_completion_receipt` matching the task UID before finalizing the HA boundary.
- Hold one exclusive repository run lock for the entire launcher process so parallel runners cannot duplicate work, email, or completions.
- Pass the Copilot child an explicit environment allowlist; never inherit the full parent or shared day-trader environment.
- After each Copilot phase, require the roadmap content to equal exactly one allowed terminal status transition for the selected task.
- Never print HA tokens or SMTP credentials. Child Copilot processes must not receive SMTP passwords.
- Do not add automatic commit, push, deployment, or destructive HA behavior.
- Require an App Manual Impact report section and successful manual app/HA/screenshot gates before an accepted phase can transition.
- Add focused tests for parser, transition, HA request, sender, or React completion-path changes.
