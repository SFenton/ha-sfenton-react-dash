---
name: release-dashboard
description: Explicitly invoked dashboard release workflow that commits only the approved change, waits for protected CI, merges to master, builds merged master, deploys both Home Assistant hosts, and verifies production.
metadata:
  model: gpt-5.4
  reasoning_effort: medium
  context_tier: default
---

# Release Dashboard

Use this skill only when the operator invokes `release-dashboard` directly or
explicitly instructs the agent to commit, push, merge, and deploy the completed
dashboard change. That instruction authorizes those release operations for the
current approved scope. It does not authorize unrelated work, history rewrites,
deleting either Home Assistant host, actuating devices, or restarting Home
Assistant unless changed HA runtime files require separately approved restart.

The disabled version 3 release machine is an experimental shadow replacement
for this workflow. It must remain disabled until every registered driver is
implemented and fault-tested, but it does not replace or block this established
operator-authorized release path.

## Required preflight

1. Read the repository instructions, `docs/ux/layouts.md`,
   `docs/ux/validation-matrix.md`, and every instruction file matching the
   release-owned files.
2. Inspect `git status`, the complete diff, the current branch, `origin/master`,
   GitHub CLI authentication, and open pull requests.
3. Identify the exact release-owned files and hunks. Preserve all unrelated
   staged, unstaged, and untracked work. When a file contains mixed changes,
   stage an exact patch rather than the whole file.
4. Before pushing, run `npm run test:change-policy` for the exact release scope
   and run every changed or added test file after its final edit using exact
   paths. Use `npm run test:run -- <paths>` for Vitest files and
   `npm run test:e2e -- <paths>` for Playwright files.
5. Do not make `npm run check`, unchanged tests, full Playwright, production
   builds, or layout automation local pre-push gates. The protected pull-request
   workflow owns broad deterministic validation. Task-specific development
   evidence may already include additional focused checks; do not rerun it
   merely because release started.
6. Never print tokens, passwords, private keys, or environment-file contents.

## Git, pull request, and CI

1. Create a descriptive `copilot/<topic>-release-<date>` branch without
   discarding local changes.
2. Stage only the approved release scope. Review both `git diff --cached` and
   `git diff --cached --check`.
3. Commit with a concise message and this trailer:

   ```text
   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
   ```

4. Push the branch with upstream tracking.
5. Create a pull request targeting `master` with the changed-test and focused
   validation evidence.
6. Wait with `gh pr checks --watch --fail-fast`. Do not merge while any check
   is pending or failing. The protected `Playwright gate` aggregate includes:
   changed-test policy, lint, unit and contract checks, a production build,
   automated affected-layout evidence, and the sharded full Playwright suite.
7. For a layout-sensitive release, inspect the `layout-automation` Action
   artifact after the automated gate passes. View its requested unnormalized
   screenshots with an image-capable tool, perform the listed interactions
   against an owned preview of the exact pull-request head, and record truthful
   observations tied to the artifact checkpoints and hashes. This human review
   is a post-push release acceptance gate, not a pre-push local gate. A
   `non-layout` Action classification or a zero-item manual worklist requires
   no manual layout review.
8. Merge with a merge commit through `gh`, fetch `origin/master`, and prove the
   release commit is an ancestor of the merged branch. Do not force-push,
   amend, or delete a checked-out branch that still carries unrelated work.

`master` is protected for administrators and requires the strict
`Playwright gate`. Force-push and branch deletion remain disabled.

## Build the merged commit

Build and deploy from an isolated, detached worktree at the merged
`origin/master` commit so unrelated local changes cannot enter production.

1. Resolve and record one exact temporary worktree path.
2. Add the detached worktree at the merged `origin/master` revision.
3. Reuse the primary worktree's installed `node_modules`. Link local env files
   only inside the temporary worktree when deployment needs them; never add
   them to Git.
4. Run `npm run build` in the detached worktree and verify the generated app
   bundle and `dist/index.html`.

## Deploy both Home Assistant hosts

Prefer the repository's documented SMB copy when the share is available.
Otherwise use the configured SSH fallback from the clean worktree:

```bash
npm run deploy:both
```

The deployment must:

- upload the production `dist/` contents;
- keep both `/sfenton-react-dash/home` and `/sfenton-react-panel`;
- update the legacy wrapper URL with a unique merged-commit version;
- verify the custom panel remains registered;
- configuration-check a changed panel package before staging it;
- avoid a Home Assistant restart when the panel package and bridge are
  unchanged.

For a Home MCP or proxy change, publish the exact merged Home MCP commit first.
The container must use its pinned TLS certificate, validate each inherited HA
token, and report the expected MCP version. Stage and configuration-check the
HA proxy before replacing React assets. If the proxy is new or changed, stop
after staging and obtain the separately required HA restart approval. After
the restart, verify an authenticated `/api/sfenton_home_mcp` `home_info` call.
Only then build with `VITE_HOME_MCP_ENABLED=true` and deploy the dashboard
assets. Never leave a build that defaults to a missing proxy in either host.
The SSH deploy command exits with status 2 after successful config staging so
automation cannot mistake the pre-restart phase for asset deployment.

Chat history and the Home MCP proxy are separate HA runtime dependencies.
Deploy the exact `home-assistant/custom_components/sfenton_react_chat/` files
and `home-assistant/packages/sfenton_react_chat.yaml` following the component
README. SSH deployment compares and backs up those files and validates after
staging, with rollback on staging or validation failure; SMB requires the
documented manual backup, copy, validation, and rollback steps. Changed
component or package files require a separately approved HA restart. After a
restart, verify the prior daily purge automation is absent. The manual purge
service may remain registered, but do not invoke it during release verification
without explicit deletion authorization.

## Production verification

1. Confirm the raw app, legacy wrapper, and custom panel load the merged
   production bundle.
2. Open the affected route at `393x852`, rotate to `852x393`, and verify the
   relevant desktop/fine-pointer surface. For shell, grid, modal, or fixed-edge
   changes, inspect both mirrored landscape inset profiles and a zero-inset
   rectangular-phone profile before the real-device smoke.
3. Confirm the released behavior and modal access without calling live device
   services. For phone-landscape modals, confirm every affected intent uses the
   same exact padded safe rectangle. Within one intent, walk tabs, details,
   loading, and result states and confirm no outer size drift.
4. Compare the remote asset name or content to the clean merged build and
   confirm the legacy wrapper cache-busting version is the merge commit.
5. On a real phone, confirm the raw app, legacy wrapper, and custom panel
   deliver non-obscured controls in both rotations. Record the outer document,
   bridge document, and React document safe-area variables without changing
   Home Assistant state.
6. Remove the exact temporary worktree and local-only links after verification.

## Completion report

Report the branch, commit, pull request, merge commit, production bundle,
deployment method, all three verified host URLs, whether Home Assistant was
restarted, the CI and manual layout evidence used, and any intentionally
preserved local changes. If a required step fails, state the blocker and do not
claim the release completed.
