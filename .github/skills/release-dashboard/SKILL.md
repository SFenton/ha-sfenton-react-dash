---
name: release-dashboard
description: Explicitly invoked dashboard release scope-review workflow for the operator-authorized deterministic release machine; it does not itself commit, push, merge, deploy, or mutate Home Assistant.
metadata:
  model: gpt-5.6-sol
  reasoning_effort: medium
  context_tier: default
---

# Release Dashboard

Use this skill only when the operator invokes `release-dashboard` directly.
That invocation requests release scope review. It does not itself create the
operator authorization receipt required by the deterministic release machine
and never grants a model permission to commit, push, merge, deploy, mutate Home
Assistant, or restart it.

The version 3 `release-machine.json` is disabled while any required GitHub, HA,
production verification, rollback or cleanup driver remains disabled. Until
all deterministic drivers are implemented and fault-tested, the skill must
stop after local read-only scope review and deterministic preflight, emit a
blocked result, and leave the worktree unchanged. Routine scope review uses the
release opportunity's Sol medium/default reviewer.
`gpt-5.6-sol` max/long-context may review only an evidence-bound
`ha-release-rollback-or-host-conflict` trigger after the preceding release
receipt. No model runs build, Git/PR, deployment, verification, rollback, or
cleanup steps on behalf of the deterministic machine.

## Required preflight

1. Read the repository instructions, `docs/ux/layouts.md`,
   `docs/ux/validation-matrix.md`, and every
   instruction file matching the release-owned files.
2. Inspect local `git status`, the complete diff, and the current branch.
   Remote, GitHub, Home Assistant, and production reads remain machine-owned.
3. Identify the exact release-owned files and hunks from the completed task.
   Preserve all unrelated staged, unstaged, and untracked work. Record exact
   patch boundaries for mixed files without changing the index or worktree.
4. Confirm the task's required validation is complete. Re-run `npm run check`
   and the smallest affected Playwright release gates if the working tree
   changed after the last successful run.
   Require a successful current `layout:verify` assessment for the release-owned
   changes, including actual manual image/interaction review. Check source,
   fixture, build and served-asset fingerprints; replan when they changed.
   Release tests must own their build/server and must not enable
   `reuseExistingServer` or borrow an unowned port. Local mock acceptance does
   not satisfy real-device or production-host verification.
5. Never print tokens, passwords, private keys, or environment-file contents.

## Disabled-machine stop gate

The checked-in machine is currently disabled. After the preflight above:

1. Confirm `release-machine.json` is version 3 and `enabled` is `false`.
2. Confirm every GitHub, build, deploy, verification, rollback, and cleanup
   driver referenced by the machine remains disabled.
3. Record the exact reviewed scope and validation evidence without staging,
   committing, contacting GitHub or Home Assistant, or changing production.
4. Return `blocked: release-machine-disabled`.

Do not fall back to the former manual Git/PR/deploy procedure. A medium model
cannot substitute for a disabled deterministic driver.

## Enabled deterministic-machine contract

Only a separately reviewed change may enable the machine after every driver is
implemented, fake-driver fault-tested, and covered by exact rollback and
cleanup receipts. The enabled machine, not this model, must then:

- validate and stage only the authorized scope;
- commit, push, create and merge the PR through registered GitHub drivers;
- build the exact merged commit in an isolated worktree;
- deploy the same production bundle to the raw app, legacy wrapper, and custom
  panel while preserving both Home Assistant hosts;
- update the legacy cache-busting version;
- validate changed HA packages before any separately authorized restart;
- verify the required mobile, rotation, desktop, and real-device evidence;
- rollback and clean up deterministically on failure.

Every run requires a separate operator authorization receipt bound to the
project, release opportunity, repository, exact revision, scope, side-effect
class, and registered tool IDs. A failed rollback or contradictory host
evidence may request max/long review only through
`ha-release-rollback-or-host-conflict`.

## Completion report

While the machine is disabled, report the reviewed scope, local validation,
disabled driver IDs, preserved changes, and the exact blocked reason. After a
future authorized deterministic run, report only receipt-backed branch,
commit, PR, merge, bundle, deployment, host verification, restart, rollback,
and cleanup outcomes. Never claim completion from model prose.
