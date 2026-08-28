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

## Required preflight

1. Read the repository instructions, `docs/ux/validation-matrix.md`, and every
   instruction file matching the release-owned files.
2. Inspect `git status`, the complete diff, the current branch, `origin/master`,
   GitHub CLI authentication, and open PRs.
3. Identify the exact release-owned files and hunks from the completed task.
   Preserve all unrelated staged, unstaged, and untracked work. When a file
   contains mixed changes, stage an exact patch rather than the whole file.
4. Confirm the task's required validation is complete. Re-run `npm run check`
   and the smallest affected Playwright release gates if the working tree
   changed after the last successful run.
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
   evidence, then merge it with a merge commit through `gh`.
6. Fetch `origin/master` and prove the release commit is an ancestor of the
   merged branch. Do not force-push, amend, or delete a checked-out branch that
   still carries unrelated work.

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

## Production verification

1. Confirm the raw app, legacy wrapper, and custom panel load the merged
   production bundle.
2. Open the affected route at `393x852` first, then verify the relevant
   desktop/fine-pointer surface.
3. Confirm the released behavior and modal access without calling live device
   services.
4. Compare the remote asset name or content to the clean worktree build and
   confirm the legacy wrapper cache-busting version is the merged commit.
5. Remove the exact temporary worktree and local-only links after verification.

## Completion report

Report the branch, commit, PR, merge commit, production bundle, deployment
method, all three verified host URLs, whether Home Assistant was restarted,
and any intentionally preserved local changes. If any required step fails,
state the blocker and do not claim the release completed.
