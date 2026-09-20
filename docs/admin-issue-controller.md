# Admin issue controller

The Admin issue controller mirrors new Home Assistant Admin To-Do items into
GitHub issues and runs one serialized, resumable Copilot lifecycle for each
issue. The controller is intentionally separate from the dashboard deployment
runner: deployment remains owned by the protected `master` workflow.

## Authority boundary

The host controller owns every privileged action:

- reads and completes Admin To-Do items through Home Assistant;
- creates and updates GitHub issues;
- creates worktrees, installs the trusted base dependencies, commits, pushes,
  opens and merges pull requests;
- verifies protected checks and the exact deployment receipt;
- closes the GitHub issue and removes the worktree.

Copilot receives no Home Assistant token and no GitHub mutation tool. Its only
repository tool is `admin_issue_workspace`, implemented by the project
asset in `ops/admin-issue-controller/worker-extension.mjs`. Each command runs in Docker
with no network, a read-only root filesystem, dropped capabilities,
`no-new-privileges`, resource limits, a writable issue worktree, and read-only
Git metadata. The extension accepts only an immutable Docker image ID.
The controller rejects changes outside the auto-deployed dashboard surfaces:
`src/`, `public/`, `e2e/`, and the root `index.html`.
Repository env and package-credential files are masked with `/dev/null`, and
build caches use per-command tmpfs mounts, so model commands cannot read local
tokens or persist a cache that influences trusted validation.

The controller passes `GH_TOKEN` to Copilot only so the CLI can authenticate
its model session. The variable is declared secret and is not requested by the
extension or mounted into its containers.

The dedicated worker home and Copilot home are seeded with the reviewed
`ops/admin-issue-controller/tandem-research/SKILL.md`; it does not inherit
mutable user extensions or unrelated personal skills.

## Lifecycle

1. Poll `todo.groceries` and ignore the UIDs captured by the one-time baseline.
2. Create one GitHub issue carrying a stable Admin To-Do UID marker.
3. Apply later Admin To-Do edits to the issue and queue them as a new input
   revision.
4. Accept follow-up comments only when the numeric user ID, login, and
   `OWNER` association all match the pinned repository owner.
5. Create or resume the stable named Copilot session with `gpt-5.6-sol`,
   `max` effort, and `/tandem-research`.
6. Post a structured question and pause when a consequential decision remains.
7. Otherwise validate the isolated worktree, commit and push it, open a pull
   request, and repair failed protected checks up to the configured limit.
8. Merge only the recorded head SHA after every required check succeeds.
9. Require the successful v2 deployment artifact for the exact merge SHA,
   including accepted disposition, verified paths, panel registration, and
   released deployment lease.
10. Post the completion evidence, close the issue, complete the Home Assistant
    item, verify its completion receipt, and remove the issue worktree.

A manually closed issue pauses automation and does not complete Home
Assistant. Reopening it creates a new worktree generation while retaining the
stable Copilot session. A worker-classified iOS/WebKit fix remains open after
deployment with a manual-device follow-up comment.

## Installation

Prerequisites:

- the repository checkout is on `master` and can push to GitHub over its
  configured HTTPS credential helper;
- `gh auth status` succeeds for the pinned repository owner;
- Docker and Copilot CLI are available to the user service;
- Node 22 is installed at `~/.local/bin/node`;
- `.env.development` supplies the existing Home Assistant URL and token;
- the worker image contains Node 22 and the Playwright 1.60 browser/runtime
  dependencies required by this repository.

Pull the chosen image and record its immutable local image ID:

```bash
docker pull mcr.microsoft.com/playwright:v1.60.0-noble
docker image inspect \
  --format '{{.Id}}' \
  mcr.microsoft.com/playwright:v1.60.0-noble
```

Build and install the controller:

```bash
npm run admin:issue:bundle
install -d -m 0700 \
  "$HOME/.local/share/admin-issue-controller" \
  "$HOME/.local/share/admin-issue-controller/tandem-research" \
  "$HOME/.local/state/admin-issue-controller" \
  "$HOME/.config/admin-issue-controller" \
  "$HOME/.config/systemd/user"
install -m 0600 \
  .admin-issue-controller-build/controller.mjs \
  "$HOME/.local/share/admin-issue-controller/controller.mjs"
install -m 0600 \
  .admin-issue-controller-build/worker-extension.mjs \
  "$HOME/.local/share/admin-issue-controller/worker-extension.mjs"
install -m 0600 \
  .admin-issue-controller-build/tandem-research/SKILL.md \
  "$HOME/.local/share/admin-issue-controller/tandem-research/SKILL.md"
install -m 0600 \
  ops/admin-issue-controller/controller.json.example \
  "$HOME/.config/admin-issue-controller/controller.json"
install -m 0600 \
  ops/admin-issue-controller/admin-issue-controller.service \
  "$HOME/.config/systemd/user/admin-issue-controller.service"
```

Confirm that `workerImageId` in the installed JSON matches the exact
`sha256:...` result. Update it whenever the pinned worker image changes, and
keep the configuration mode `0600`.

Before starting the service, baseline every pre-existing Admin To-Do item.
This is a mandatory fail-closed migration step:

```bash
node "$HOME/.local/share/admin-issue-controller/controller.mjs" \
  baseline \
  "$HOME/.config/admin-issue-controller/controller.json"
systemctl --user daemon-reload
systemctl --user enable --now admin-issue-controller.service
```

## Operation and recovery

```bash
systemctl --user status admin-issue-controller.service
journalctl --user -u admin-issue-controller.service -f
node "$HOME/.local/share/admin-issue-controller/controller.mjs" \
  status \
  "$HOME/.config/admin-issue-controller/controller.json"
```

State is an atomic `0600` JSON journal under
`~/.local/state/admin-issue-controller`. Worker JSON event logs are retained in
its `worker-logs` child directory. Stable issue, comment, branch, session, PR,
merge, deployment, Home Assistant receipt, and worktree receipts make retries
idempotent.

Do not delete or edit the journal while the service runs. If intervention is
required, stop the service first and retain the journal and worker logs for
diagnosis.
