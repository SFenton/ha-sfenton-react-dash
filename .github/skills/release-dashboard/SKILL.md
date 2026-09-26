---
name: release-dashboard
description: Explicitly invoked dashboard release workflow that commits only the approved change, waits for protected CI, merges to master, builds merged master, deploys both Home Assistant hosts, and verifies production.
metadata:
  model: gpt-5.6-luna
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
3. Confirm the change was implemented in its own branch-backed worktree created
   from `master` before the first code edit. Do not release from the primary
   checkout or an unrelated reused worktree; reconstruct the change in a clean
   compliant worktree first if necessary.
4. Identify the exact release-owned files and hunks. Preserve all unrelated
   staged, unstaged, and untracked work. When a file contains mixed changes,
   stage an exact patch rather than the whole file.
5. Before pushing, run `npm run test:change-policy` for the exact release scope
   and run every changed or added test file after its final edit using exact
   paths. Use `npm run test:run -- <paths>` for Vitest files and
   `npm run test:e2e -- <paths>` for Playwright files.
6. Do not make `npm run check`, unchanged tests, full Playwright, production
   builds, or layout automation local pre-push gates. The protected pull-request
   workflow owns broad deterministic validation. Task-specific development
   evidence may already include additional focused checks; do not rerun it
   merely because release started.
7. Never print tokens, passwords, private keys, or environment-file contents.

## Git, pull request, and CI

1. Confirm the implementation worktree is on a descriptive
   `copilot/<topic>-release-<date>` branch without discarding local changes.
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
   changed-test policy, lint, unit and contract checks, a production build, and
   the sharded full Playwright suite. Automated layout runs after the merge on
   protected `master`.
7. Merge with a merge commit through `gh`, fetch `origin/master`, and prove the
   release commit is an ancestor of the merged branch. Do not force-push,
   amend, or delete a checked-out branch that still carries unrelated work.
8. If the merged release changed
   `.github/workflows/deploy-dashboard.yml`, compute the SHA-256 of that exact
   merged blob, atomically update only `workflowSha256` in the private
   `ha-dashboard-runner` controller config, preserve mode `0600`, restart its
   user service, and verify it is active before waiting for the deployment.
   Never rotate trust to an unmerged candidate or PR head.
9. Start the merged build and deployment after proving the merge; do not insert
   a post-merge layout wait. Post-merge layout automation is asynchronous
   regression detection. Do not wait for its completion or artifact before
   building, deploying, or completing a release. A failed run automatically
   files one deduplicated investigation issue for the merged commit; the run,
   artifact, and any manual review are follow-up evidence, not release gates.
   If its status is already available without delaying the release, report it;
   otherwise report it as pending. Do not use `gh run watch` or download the
   `layout-automation` artifact as a prerequisite to the remaining release
   steps.
10. For a frontend-only merge accepted by `.github/workflows/deploy-dashboard.yml`,
   wait for that exact merge SHA's **Deploy dashboard** workflow and inspect its
   sanitized deployment receipt. This deployment wait is independent of the
   post-merge layout workflow. Do not also build or deploy locally after the
   automated receipt succeeds.
11. If the automatic workflow fails closed because the cumulative deployed
    range includes Home Assistant runtime, Home MCP, or custom-panel bridge
    changes, use the restart-aware manual build/deploy path below. Never weaken
    the automatic classifier merely to avoid the manual release.

`master` is protected for administrators and requires the strict pull-request
`Playwright gate`. The post-merge layout result is monitoring only. Force-push
and branch deletion remain disabled.

## Manual fallback: build the merged commit

Use this section only when the automatic frontend workflow is unavailable or
correctly requires the restart-aware manual path. Build and deploy from an
isolated, detached worktree at the merged
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
The Home MCP proxy is retained for independent tools; the dashboard no longer
uses frontend chat. Do not enable or restore browser chat through a build flag.
Deploy dashboard assets only after any required proxy/runtime checks.
The SSH deploy command exits with status 2 after successful config staging so
automation cannot mistake the pre-restart phase for asset deployment.

The retired chat-history component is not managed by the ongoing SSH deploy
script. Its one-time removal requires an exact backup of the installed package
and component outside active HA paths, a fresh configuration check, an approved
HA restart, and proof its manual purge service is no longer registered. Never
invoke that service or delete existing per-user histories as part of chat
retirement. Follow `docs/deployment.md` for the staging and rollback boundary.

Admin To-Do image filing is another restart-aware HA runtime dependency.
Deploy the exact `home-assistant/custom_components/sfenton_admin_todo/` files
and `home-assistant/packages/sfenton_admin_todo.yaml` with backup, config
validation, and rollback before replacing React assets. Stop after staging and
obtain separate restart approval. After restart, verify authenticated
admin-only image POST/GET/DELETE behavior before deploying the image-enabled
dashboard.

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
6. Remove the exact temporary build worktree and local-only links after
   verification.
7. From another registered worktree, remove the implementation worktree unless
   the user explicitly asked to keep it. Never force-remove uncommitted work,
   and do not delete the implementation branch without separate authorization.
   Report any blocked cleanup instead of claiming the release is complete.

## Completion report

Report the branch, commit, pull request, merge commit, production bundle,
deployment method, all three verified host URLs, whether Home Assistant was
restarted, protected pull-request CI, the post-merge layout status if already
known (`pending` is valid), any auto-filed layout issue, implementation and
temporary worktree cleanup status, and any intentionally preserved local
changes. If the user requested that the implementation worktree be retained,
report its exact path. Do not wait solely to replace a pending layout status.
If another required step fails, state the blocker and do not claim the release
completed.
