---
name: release-dashboard
description: Explicitly invoked dashboard release workflow that commits only the approved change, pushes and merges a PR to master, builds merged master, deploys both Home Assistant hosts, and verifies the production release.
metadata:
  model: gpt-5.6-sol
  reasoning_effort: max
  context_tier: long_context
---

# Release Dashboard

Use this skill only when the operator invokes `release-dashboard` directly.
That invocation authorizes the current completed dashboard change to be
committed, pushed, merged to `master`, built, deployed, and verified. It does
not authorize committing unrelated work, rewriting history, deleting either
Home Assistant host, actuating devices, or restarting Home Assistant unless a
changed panel package requires a separately approved restart.

The disabled version 3 release machine is an experimental replacement for this
workflow. It must remain disabled until every registered driver is implemented
and fault-tested, but it does not block this established operator-authorized
release path.

## Required preflight

1. Read the repository instructions, `docs/ux/layouts.md`,
   `docs/ux/validation-matrix.md`, and every
   instruction file matching the release-owned files.
2. Inspect `git status`, the complete diff, the current branch, `origin/master`,
   GitHub CLI authentication, and open PRs.
3. Identify the exact release-owned files and hunks from the completed task.
   Preserve all unrelated staged, unstaged, and untracked work. When a file
   contains mixed changes, stage an exact patch rather than the whole file.
4. Confirm the task's required focused validation is complete. Before pushing,
   run every test file changed or added by the release scope after its final
   edit, using its owning runner and exact file paths. Use
   `npm run test:run -- <paths>` for Vitest files and
   `npm run test:e2e -- <paths>` for Playwright files. Re-run `npm run check` if
   the working tree changed after the last successful run. Do not run the
   unchanged full Playwright suite locally as a release or merge gate; the
   pull-request workflow owns that full-suite validation.
   Require `npm run test:change-policy` to pass for the exact release scope:
   behavior-bearing implementation changes must include a changed or added
   domain-appropriate test, and every changed Playwright spec must be included
   in the executed affected-spec set. Test ownership must be established by a
   same-stem path or exact `@covers` declaration.
   Require a successful current `layout:verify` assessment for the release-owned
   changes, including actual manual image/interaction review. Check source,
   fixture, build and served-asset fingerprints; replan when they changed.
   Release tests must own their build/server and must not enable
   `reuseExistingServer` or borrow an unowned port. Local mock acceptance does
   not satisfy real-device or production-host verification.
5. Never print tokens, passwords, private keys, or environment-file contents.

## Git and GitHub release

1. Create a descriptive `copilot/<topic>-release-<date>` branch from the
   current `master` worktree without discarding local changes.
2. Stage only the approved release scope. Review both `git diff --cached` and
   `git diff --cached --check`.
3. Commit with a concise message and this trailer:

   ```text
   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
   ```

4. Push the branch with upstream tracking.
5. Create a pull request targeting `master`, including behavior and validation
   evidence. Wait for its checks with `gh pr checks --watch --fail-fast`; do
   not merge while the changed-test policy or the `Playwright gate` check is
   pending or failing. Then merge it with a merge commit through `gh`.
6. Fetch `origin/master` and prove the release commit is an ancestor of the
   merged branch. Do not force-push, amend, or delete a checked-out branch that
   still carries unrelated work.

GitHub currently does not expose protected branches or required status checks
for this private repository's account plan. Until that changes, the release
workflow's explicit check wait is mandatory. If protected branches become
available, require the uniquely named `Playwright gate` status check on
`master`.

## Build the merged commit

Build and deploy from an isolated, detached worktree at the merged
`origin/master` commit so unrelated local changes cannot enter production.

1. Resolve and record one exact temporary worktree path.
2. Add the detached worktree at `origin/master`.
3. Reuse the primary worktree's installed `node_modules`. Link local env files
   only inside the temporary worktree when the deployment script needs them;
   never add them to Git.
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
after staging and obtain the separately required HA restart approval. After the
restart, verify an authenticated `/api/sfenton_home_mcp` `home_info` call. Only
then build with `VITE_HOME_MCP_ENABLED=true` and deploy the dashboard assets.
Never leave a build that defaults to a missing proxy in either dashboard host.
The SSH deploy command exits with status 2 after successful config staging so
automation cannot mistake the pre-restart phase for an asset deployment.

Chat history and the Home MCP proxy are separate HA runtime dependencies. Deploy the exact
`home-assistant/custom_components/sfenton_react_chat/` files and
`home-assistant/packages/sfenton_react_chat.yaml` following the component README.
SSH deployment compares/backs up those files and validates after staging, with
rollback on staging/validation failure; SMB requires the documented manual
backup, copy, validation and rollback steps. Changed component/package files
require a separately approved HA restart. After restart, verify the prior daily
purge automation is absent; asset deployment and `deploy:sync` do not remove an
already loaded automation. The manual purge service may remain registered, but
do not invoke it during release verification without explicit deletion
authorization.

## Production verification

1. Confirm the raw app, legacy wrapper, and custom panel load the merged
   production bundle.
2. Open the affected route at `393x852` first, rotate to `852x393`, and verify
   the relevant desktop/fine-pointer surface. For shell, grid, modal, or
   fixed-edge changes, inspect both mirrored landscape inset profiles and a
   zero-inset rectangular-phone profile before the real-device smoke.
3. Confirm the released behavior and modal access without calling live device
   services.
   For phone-landscape modals, confirm every affected intent uses the same
   exact padded safe rectangle. Within one intent, walk tabs/details/loading
   and result states and confirm no outer size drift; in portrait, verify
   literal accepted tile and safe-bottom metrics. Compare Quick Links,
   Summary, Climate, forms, and media against each other on tablet/desktop as
   well: all non-drawer frames are shared. Confirm complete landscape tile
   rows fill the available width while incomplete rows align left. Security
   control collections must fill the padded body on every opener path.
   Quick Links must match production's 120px standard portrait tiles and use
   text-aware, balanced non-final-row filling in centered layouts; do not
   validate it against the square-grid sizing oracle.
4. Compare the remote asset name or content to the clean worktree build and
   confirm the legacy wrapper cache-busting version is the merged commit.
5. On a real phone, confirm the raw app, legacy wrapper, and custom panel
   deliver non-obscured controls in both rotations. Record the outer document,
   bridge document, and React document safe-area variables without changing
   Home Assistant state. Open each Summary tab in portrait and rotate before
   touching any tabs; native typography and row wrapping must already match a
   direct landscape open. Linux WPE does not implement iOS text autosizing and
   cannot replace this check.
6. Remove the exact temporary worktree and local-only links after verification.

## Completion report

Report the branch, commit, PR, merge commit, production bundle, deployment
method, all three verified host URLs, whether Home Assistant was restarted,
and any intentionally preserved local changes. If any required step fails,
state the blocker and do not claim the release completed.
