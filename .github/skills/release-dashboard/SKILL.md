---
name: release-dashboard
description: Explicitly invoked dashboard release scope-review workflow for the operator-authorized deterministic release machine; it does not itself commit, push, merge, deploy, or mutate Home Assistant.
metadata:
  model: gpt-5.6-luna
  reasoning_effort: medium
  context_tier: default
---

# Release Dashboard

Use this skill only when the operator invokes `release-dashboard` directly.
That invocation requests release scope review. It does not itself create the
operator authorization receipt required by the deterministic release machine
and never grants a model permission to commit, push, merge, deploy, mutate Home
Assistant, or restart it.

The invariant is exact: the version 3 `release-machine.json` is disabled and
remains `enabled: false`; invoking `release-dashboard` never authorizes release;
and external, GitHub, production, deployment, rollback, verification, and
other mutation drivers remain disabled or otherwise unavailable until they are
separately qualified and operator-authorized. GitHub mutation and rollback drivers stay disabled.
Registered deterministic local validation and build tools may remain active in
`.github/agent-tools.json` for workspace-only preflight and shadow planning,
but their presence never grants a model permission to commit, push, merge,
deploy, mutate Home Assistant, or restart it. GitHub mutation steps stay unavailable
while the machine is disabled and review-only invocation never authorizes
release. Actual release prerequisites that reach Home Assistant, production
capture, deployment, production verification, production rollback, rollback
verification, cleanup, or other provider-backed side effects must remain
disabled or otherwise unavailable until they are separately operator-authorized
and qualified.
Routine scope review uses the release opportunity's `gpt-5.6-luna` medium/default
reviewer. `gpt-5.6-sol` high/default research may review only an evidence-
bound `ha-release-rollback-or-host-conflict` trigger after the preceding
release receipt. No model runs build, Git/PR, deployment, verification,
rollback, or cleanup steps on behalf of the deterministic machine.

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
2. Confirm every release-machine tool reference still resolves through
   `.github/agent-tools.json`. Deterministic validation, build, and
   Git-orchestration command tools may remain registered, but `enabled: false`
   keeps the full release flow unavailable and never authorizes GitHub
   mutation. Every production capture, deploy, verification, rollback,
   rollback-verification, cleanup, or other provider-backed driver required
   for an actual release must still resolve to disabled tooling until
   separately qualified and operator-authorized.
3. Record the exact reviewed scope and validation evidence without staging,
   committing, contacting GitHub or Home Assistant, or changing production.
4. Return `blocked: release-machine-disabled`.

Do not fall back to the former manual Git/PR/deploy procedure. A medium model
cannot substitute for a disabled deterministic driver.

## Enabled deterministic-machine contract

Only a separately reviewed change may enable the machine after every actual
release prerequisite driver is implemented, fake-driver fault-tested,
qualified, and covered by exact rollback and cleanup receipts. The enabled
machine, not this model, must then:

- validate and stage only the authorized scope while preserving unrelated
  staged, unstaged, and untracked work;
- create and merge the exact `master` pull request through registered GitHub
  drivers without force-push or history rewrite;
- build the merged `origin/master` revision in an isolated temporary worktree
  that reuses installed `node_modules` and links local env files only inside
  that temporary tree when deployment requires them;
- deploy the same production bundle to the raw app, legacy wrapper, and custom
  panel while preserving both Home Assistant hosts and updating the legacy
  wrapper cache-busting version;
- prefer the documented SMB copy path and use the configured SSH fallback only
  when the share is unavailable;
- stage changed `home-assistant/packages/sfenton_react_panel.yaml`,
  `home-assistant/custom_components/sfenton_react_chat/`, and
  `home-assistant/packages/sfenton_react_chat.yaml` with documented backup,
  validation, rollback, and separate restart approval gates;
- avoid a Home Assistant restart when the panel package, bridge, and chat
  runtime files are unchanged;
- after any separately approved restart, verify the prior daily chat purge
  automation is absent without invoking the manual purge service;
- verify the affected route at `393x852`, `852x393`, mirrored landscape inset
  profiles, zero-inset rectangular-phone, desktop/fine-pointer surfaces, and
  real-phone raw app, legacy wrapper, and custom panel behavior without live
  device-service calls;
- compare deployed asset identity to the clean merged build, record the outer
  document, bridge document, and React document safe-area variables, and then
  remove exact temporary release artifacts.

Every run requires a separate operator authorization receipt bound to the
project, release opportunity, repository, exact revision, scope, side-effect
class, and registered tool IDs. A failed rollback or contradictory host
evidence may request receipt-bound Sol research only through
`ha-release-rollback-or-host-conflict`.

## Completion report

While the machine is disabled, report the reviewed scope, local validation,
the disabled machine state, the disabled or unavailable release-driver IDs that
block actual side effects, preserved changes, and the exact blocked reason.
After a future authorized deterministic run, report only receipt-backed branch,
commit, PR, merge, bundle, deployment, host verification, restart, rollback,
and cleanup outcomes. Never claim completion from model prose.
