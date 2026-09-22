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

Copilot receives Home Assistant capabilities through only the configured
`hass` MCP server, while the model and Docker workspace receive no raw Home
Assistant credential or GitHub mutation tool. Before each run, the controller
copies only that server entry from the operator's private MCP configuration into the dedicated worker home;
it does not inherit Playwright, Plex, UniFi, ARR, GitHub, or other user MCP
servers. The model can use the same guarded Home Assistant tools available to
the operator for issue-scoped state, history, trace, configuration, service,
and validation work, while the MCP server retains its own safety contracts and
secret handling.

The worker's only repository tool remains `admin_issue_workspace`, implemented
by the project asset in `ops/admin-issue-controller/worker-extension.mjs`.
Each repository command runs in Docker with no network, a read-only root filesystem, dropped capabilities,
`no-new-privileges`, resource limits, a writable issue worktree, and read-only
Git metadata. The extension accepts only an immutable Docker image ID.
The controller rejects changes outside the auto-deployed dashboard surfaces:
`src/`, `public/`, `e2e/`, and the root `index.html`.
Repository env and package-credential files are masked with `/dev/null`, and
build caches use per-command tmpfs mounts, so model commands cannot read local
tokens or persist a cache that influences trusted validation.
Non-policy hooks are disabled, user plugins/hooks/instructions are removed from
the dedicated Copilot home before each run, and the controller refuses to start
a worker when project extensions or machine policy hooks are present.

The controller passes `GH_TOKEN` to Copilot only so the CLI can authenticate
its model session. The variable is declared secret and is not requested by the
extension or mounted into its containers. The private HASS MCP endpoint remains
in a `0600` MCP configuration file outside the worktree; neither it nor the HA
token is mounted into the Docker workspace or included in worker prompts and
logs.

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
   `max` effort, `/tandem-research`, the isolated repository tool, and the
   operator's configured `hass` MCP server.
6. Gather available repository and live Home Assistant evidence, then post a
   structured question only when a consequential decision still remains.
7. Otherwise create a local candidate commit, authorize its complete committed
   diff, and validate that exact clean commit in the isolated runner.
8. For a candidate that changes production dashboard runtime files, validate
   one to four issue-scoped PNG, JPEG, or WebP images of the proposed fixed
   behavior, bind their hashes to the committed-diff manifest, upload them to
   GitHub, and render them inline in both the pull-request body and the
   controller's GitHub issue update. Test-only,
   documentation-only, Home Assistant-only, and controller-only outcomes are
   exempt.
9. Merge current `origin/master` into a stale candidate only through a
   controller-journaled, conflict-free normal merge. Every new candidate is
   revalidated before a normal push.
10. Require the live pull request repository, base, branch, head SHA, and every
   persisted visual-evidence URL to match the candidate. Bind protected checks
   from the pinned GitHub App to that exact SHA and merge with
   `--match-head-commit`.
11. Require the successful v2 deployment artifact for the exact merge SHA,
   including accepted disposition, verified paths, panel registration, and
   released deployment lease.
12. Post the completion evidence, close the issue, complete the Home Assistant
    item, verify its completion receipt, and remove the issue worktree.

A manually closed issue pauses automation and does not complete Home
Assistant. Reopening it creates a new worktree generation while retaining the
stable Copilot session. A worker-classified iOS/WebKit fix remains open after
deployment with a manual-device follow-up comment.

## Candidate provenance

Controller state version 2 uses one provenance record as the sole lifecycle
authority. It keeps the prepared base, current candidate head and tree,
committed-diff manifest, validation receipt, protected-check runs, PR merge
receipt, deployment binding, and optional visual-evidence receipts distinct.
Each visual receipt records the relative artifact path, media type, byte size,
SHA-256, committed-diff manifest, and GitHub attachment URL. Timestamp receipts
remain useful for audit but cannot authorize a merge or completion.

The following rules are fail closed:

- ancestry never substitutes for exact candidate SHA equality;
- validation runs after the local commit and checks the same clean `HEAD` and
  tree before and after every isolated command;
- committed scope is calculated from the candidate tree against its current
  authorized target base, so upstream changes inherited from `master` are not
  attributed to the worker;
- the live PR must remain in this repository, target `master`, use the recorded
  controller branch, and expose the exact candidate head;
- when owner feedback produces a replacement candidate for an existing PR, the
  controller first verifies that PR against the prior candidate and its
  published images, then replaces the authorization with the new committed
  revision;
- dashboard runtime candidates cannot advance without valid issue-scoped image
  files. The controller rejects traversal, symlinks, mismatched extensions or
  magic bytes, duplicate content, files above 10 MiB, and captions that omit
  mock/live provenance;
- uploaded attachment URLs must use GitHub's user-attachment host and every URL
  must remain embedded under `## Proposed fixed behavior` in both the live PR
  body and the controller-owned issue update before checks are accepted and
  again before merge;
- checks must be the latest successful runs for the exact candidate and pinned
  GitHub App;
- already-merged PRs pass the same provenance guard and must report a
  two-parent merge commit containing the exact authorized base and candidate;
- deployment workflow `head_sha` and receipt `sourceSha` must both equal the
  verified merge commit.

Strict branch protection can make a valid candidate stale while checks run.
The controller permits at most two base synchronizations per generation. Each
attempt is journaled before Git mutation, uses a normal merge and normal
fast-forward push, invalidates old checks, and reruns committed-diff
authorization plus trusted validation. Rebase, amend, reset, force push, and
force-with-lease are not recovery mechanisms.

An interrupted `gh pr merge` response is reconciled before any stale-base
decision. The controller waits for GitHub's PR metadata and, if necessary,
recognizes an exact two-parent `[base, candidate]` merge already visible in
`master` as incomplete observation rather than permission to resynchronize.

If a base merge conflicts, the controller records bounded diagnostics, runs
`git merge --abort`, and verifies the exact prior clean head and tree. The
generation blocks after successful restoration. An unexplained local or remote
head, an ambiguous crash after local commit creation, failed abort, or any
restoration mismatch quarantines the worktree; it is not dispatched to the
worker or cleaned automatically.

## Installation

Prerequisites:

- the repository checkout is on `master` and can push to GitHub over its
  configured HTTPS credential helper;
- `gh auth status` succeeds for the pinned repository owner;
- Docker and Copilot CLI are available to the user service;
- Node 22 is installed at `~/.local/bin/node`;
- `.env.development` supplies the existing Home Assistant URL and token;
- `~/.copilot/mcp-config.json` contains an enabled `hass` MCP server and is
  readable only by the owning user;
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
keep the configuration mode `0600`. Keep `hassMcpConfigPath` pointed at the
operator's private MCP configuration and `hassMcpServerName` matched to the
trusted Home Assistant server entry. The controller fails closed if the file
is not private, the server is missing, or the transport is malformed.

Before starting the service, baseline every pre-existing Admin To-Do item.
This is a mandatory fail-closed migration step:

```bash
node "$HOME/.local/share/admin-issue-controller/controller.mjs" \
  baseline \
  "$HOME/.config/admin-issue-controller/controller.json"
systemctl --user daemon-reload
systemctl --user enable --now admin-issue-controller.service
```

Upgrading an existing controller from state version 1 is a separate operational
rollout. Stop the old service first and retain its state. The first locked
version-2 `once` or `run` invocation validates the version-1 journal, writes a
mode-`0600` backup, and atomically migrates it. In-flight records with prior
worktrees, PRs, or authorization-like receipts become `legacy-untrusted` and
cannot continue until an owner comment starts a fresh generation. Completed
history and pristine queued records remain readable, but no legacy SHA or
timestamp is promoted into trusted provenance. Version-1 binaries reject the
new journal; rollback requires stopping the service and explicitly restoring
the retained backup.

Visual-evidence enforcement is additive within state version 2. Existing
runtime candidates without a complete attachment receipt cannot pass live-PR
verification or finalization. An owner comment starts a fresh worker revision
that can generate the required issue-scoped images; existing non-runtime
candidates remain exempt. Uploaded URLs are journaled one at a time so a
restart does not duplicate successful uploads, while the local source images
remain in the ignored worktree artifact directory until normal issue cleanup.
Controller issue comments are upserted by their stable receipt marker, so a
retry or corrected candidate replaces stale text or images instead of leaving
the bug with an outdated evidence comment.

## Operation and recovery

```bash
systemctl --user status admin-issue-controller.service
journalctl --user -u admin-issue-controller.service -f
node "$HOME/.local/share/admin-issue-controller/controller.mjs" \
  status \
  "$HOME/.config/admin-issue-controller/controller.json"
```

State is an atomic, strictly validated version-2 `0600` JSON journal under
`~/.local/state/admin-issue-controller`. Worker JSON event logs are retained in
its `worker-logs` child directory. Stable issue, comment, branch, session, PR,
merge, deployment, Home Assistant receipt, and worktree receipts make retries
idempotent.

Do not delete or edit the journal while the service runs. If intervention is
required, stop the service first and retain the journal and worker logs for
diagnosis. The `status` command intentionally refuses to migrate version-1
state outside the controller lock.
