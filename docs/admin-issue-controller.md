# Admin issue controller

The Admin issue controller mirrors new Home Assistant Admin To-Do items into
GitHub issues and also adopts trusted workflow-filed layout and deployment
issues. It runs one serialized, resumable Copilot lifecycle for each issue.
Issue workers may run independently up to the configured cap, while one host
controller serializes their protected release decisions. The controller is
intentionally separate from the dashboard deployment runner: deployment
remains owned by the protected `master` workflow.

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
Trusted deployment-failure issues have a separate narrow exception for
`.github/workflows/deploy-dashboard.yml`,
`scripts/deploy-dashboard-ci.ts`, and its directly owned test. Exact nested
mounts make only those paths writable; controller implementation, other
workflows, packages, credentials, and Home Assistant files remain protected.
Trusted layout-failure issues have a separate narrow exception for
`scripts/layout/` and the generated `docs/ux/layouts.md` contract. Those paths
are read-only for ordinary issue workers and writable only when the issue was
adopted from the exact GitHub Actions layout-failure marker. The host rechecks
the same scope before committing the candidate. After merge, these issues bind
completion to the exact merge SHA's successful protected `Playwright` push
workflow, which includes the `Automated layout` job; they do not wait for or
claim a dashboard deployment.
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
That controller-local skill pairs Sol with non-Claude Luna for independent
research. It is not the global guarded Sol/Opus tandem and must not claim
independent Opus confirmation when the guarded evidence reader is unavailable.

## Lifecycle

1. Poll `todo.groceries` and ignore the UIDs captured by the one-time baseline.
   Also discover open GitHub Actions issues carrying the exact trusted layout
   or deployment-failure marker.
2. Create one GitHub issue carrying a stable Admin To-Do UID marker. A task
   filed with images uses the authenticated `sfenton_admin_todo` endpoint,
   which validates and temporarily stores up to four PNG, JPEG, or WebP files.
   The host validates their hashes and bytes, uploads them to GitHub, embeds
   them in the initial issue body, and copies them into the worker's ignored
   issue artifact directory. The controller deletes the HA source copy after
   durable journal persistence; a daily HA cleanup removes abandoned files
   after 14 days.
3. Apply later Admin To-Do edits to the issue and queue them as a new input
   revision.
4. Accept follow-up comments only when the numeric user ID, login, and
   `OWNER` association all match the pinned repository owner. Read embedded
   GitHub uploads from raw issue bodies and owner comments, including HTML
   images, Markdown images and links, and standalone video URLs. Track comment
   edits rather than treating a numeric comment cursor as proof that the
   content has not changed.
5. Create or resume the stable UUID-bound Copilot session with `gpt-5.6-sol`,
   `max` effort, `/tandem-research`, the isolated repository tool, and the
   operator's configured `hass` MCP server. Legacy named sessions are resolved
   once and persisted by UUID; an empty duplicate name cannot stall the queue.
   Re-read the owner- and UID-bound original GitHub issue body before each
   worker run so long Admin To-Do summaries survive the 240-character issue
   title limit and are included in the worker's canonical input.
6. Gather available repository and live Home Assistant evidence, then post a
   structured question only when a consequential decision still remains.
   Explicit "research and propose, do not implement yet" instructions remain
   research-only: Docker mounts the assigned worktree read-only, Copilot
   permission grants only dedicated HASS read tools, and the host requires a
   clean worktree with a `needs_input` or `blocked` response. It cannot propose
   a PR, close the issue, or mutate HA through the allowed tool set. A later
   trusted owner approval is required to lift that issue-specific restriction.
7. If verified Home Assistant work fully resolves the issue, or no repository
   change is appropriate, require a clean untouched worktree, post the
   resolution and verification, close the GitHub issue, and complete the Admin
   To-Do when one exists. GitHub-only issues skip Home Assistant completion.
8. Otherwise create a local candidate commit, authorize its complete committed
   diff, and validate that exact clean commit in the isolated runner. Rename
   the GitHub issue to the accepted PR title while preserving the complete
   original report in the issue body.
9. Require one to four issue-scoped proposed-behavior images only when the
   worker classifies a meaningful visible React result or the candidate changes
   CSS or visual assets. Logic-only focus/accessibility, Home Assistant,
   test-only, documentation-only, controller-only, and other non-demonstrable
   changes may use an empty evidence set with a specific reason. When required,
   bind image hashes to the committed-diff manifest, upload them to GitHub, and
   render them inline in both review surfaces.
10. Merge current `origin/master` into a stale candidate only through a
   controller-journaled, conflict-free normal merge. Every new candidate is
   revalidated before a normal push.
11. Require the live pull request repository, base, branch, head SHA, and every
   persisted visual-evidence URL to match the candidate. Bind protected checks
   from the pinned GitHub App to that exact SHA and merge with
   `--match-head-commit`.
12. When the exact reviewed candidate changed the protected deployment
    workflow, fetch and prove the merge commit on current `origin/master`,
    atomically rotate only the local JIT controller's trusted workflow digest,
    restart that controller, and verify it is active. A failed rotation restores
    the prior private config and blocks rather than leaving an unexplained queued
    deployment.
13. Require a successful v2 deployment artifact with accepted disposition,
    verified paths, panel registration, and a released deployment lease. The
    normal path binds the exact merge SHA. If that exact run failed before
    deployment, a later successful `master` deployment may recover the issue
    only after the controller verifies the newer receipt and proves with Git
    ancestry that its deployed SHA contains the issue merge.
14. Post the completion evidence, close the issue, complete the Home Assistant
    item, verify its completion receipt, and remove the issue worktree.

A protected-check failure first receives one host-owned rerun of the failed
jobs for that candidate SHA. The controller summarizes failing assertions and
tail output rather than leading setup logs. If the rerun still fails, the
stable worker receives that exact evidence once. Returning the same unchanged
candidate into the same failure blocks instead of consuming repeated repair
turns.

A completed deployment workflow with a non-success conclusion blocks the
original issue once and releases the serialized queue. The workflow files one
trusted deployment-failure issue containing the sanitized receipt. Subsequent
safe no-mutation receipts with the same error, deployed baseline, disposition,
and rollback result are appended to that open canonical issue instead of
launching duplicate tandem sessions. Materially different failures and receipts
whose mutation safety is uncertain still receive their own issue. A newly filed
issue enters the same tandem-research pipeline with the narrow deployment repair
scope. At
a bounded polling cadence, the controller checks the latest completed
`master` deployment. A failed or in-progress run leaves the record blocked. A
successful run can recover it only when the receipt satisfies the full v2
contract, the workflow and deployed SHAs remain on current `master`, the
deployed SHA descends from the verified issue merge, and the retained worker
outcome still matches the authorized visual evidence. This also lets an iOS
follow-up reuse the verified descendant deployment without consulting the
failed exact run again. Recovery asks GitHub for the latest successful
protected deployment, so newer fail-closed runs cannot hide an earlier
descendant deployment that already contains the issue's verified merge.
If a verification-only worker correctly reports that no additional repository
change is needed after an existing issue PR merged, the controller uses a
dedicated existing-release terminal path instead of rewriting old candidate
receipts or demanding a fabricated second pull request. It requires an
unchanged retained worktree, the latest worker's no-change outcome, the
controller-owned merged PR identity, the final PR head's protected checks, the
merge on current `master`, the original issue and PR visual evidence when the
candidate was visual, and a successful descendant deployment receipt. It then
posts an **Existing release verified** receipt, closes the issue, verifies the
applicable Admin To-Do completion boundary, and removes the retained worktree.

A manually closed issue pauses automation and does not complete Home
Assistant. Reopening it creates a new worktree generation while retaining the
stable Copilot session. Manual iOS follow-up remains open after deployment only
when the canonical issue names platform-specific browser behavior, the
candidate changes a browser-facing surface, and the follow-up reason identifies
the behavior that local evidence cannot certify. Persisted follow-up gates are
rechecked against that policy before finalization, so a legacy overbroad gate
cannot keep an otherwise verified issue and Admin To-Do item open. Canonical
text comes from the current issue report and substantive owner follow-ups;
controller receipts, repair-policy handoffs, CI diagnostics, and proposed
behavior evidence cannot create an iOS requirement merely by mentioning a
platform or viewport.

If the local receipt predates a remotely created stable session, the first
named launch may report that the UUID already resolves remotely. The controller
records that proof and immediately retries the same UUID without `--name`,
preserving the conversation instead of creating a duplicate.

On Linux, every bounded host command runs in its own process group. Timeout and
output-limit enforcement kill the launcher and its local descendants together,
so a Copilot core or Docker client cannot retain the controller's output pipe
after the launcher exits. On startup, after acquiring the exclusive lock,
the controller removes stale labeled containers. A failed worker removes only
its own UID-labeled containers, never its active peers.
Workflow-authenticated layout workers use changed tests and focused
provenance-bound mixed-context runs for local acceptance. They must not turn a
full historical or full-known-mock replay into a pre-PR gate; the protected
post-merge `Automated layout` job owns exact full-corpus evidence.

## Independent intake and bounded workers

The long-running service holds one exclusive host-controller lock. It polls
Admin To-Do items, owner comments and trusted workflow issues on its own
cadence even while issue workers or the protected release lane are waiting.
Every new eligible UID is admitted dynamically, not only the issues that
were present when the supervisor started. An eleventh issue waits for a free
slot without delaying its GitHub issue or attached image publication.
The state journal has one synchronous writer; intake callbacks cannot overlap.
One failing todo records a hashed diagnostic and cannot prevent subsequent
items from being mirrored. An attempted GitHub image upload is journaled
before the request; a confirmed asset URL is persisted before issue creation.
Retries reuse confirmed uploads. An interrupted upload with unknown outcome
is explicitly held for reconciliation rather than claiming success or
uploading a duplicate. Source images are deleted only after the issue input
has been durably journaled.
Each intake cycle shares one complete open-issue snapshot between workflow
adoption and tracked-issue reconciliation. Open issues still fetch comments on
every poll, including edits with unchanged comment IDs and embedded media.
Manually closed, paused issues need no per-issue reads until they reappear in
the open snapshot; controller-owned close windows and other unexpectedly
closed active issues retain direct lookup and completion repair. This keeps
the normal polling cadence without spending GitHub requests on unchanged
closed issues.

Controller-owned issue closure records intent before the GitHub PATCH, and
trusted owner comments remain ingestible during that close window even when
GitHub already reports the issue closed. A durable close-intent or closure
receipt is required; a historical completion comment alone cannot turn a
manual closure into a controller-owned close. The current completion marker
identifies which interrupted path to resume; manual closures still pause
automation. The serialized intake refreshes immediately
before and after issue closure, on both sides of the HA-owned completion script,
and after worktree cleanup before the final `completed` phase. It checks the
exact HA UID, content fingerprint, status and completion receipt, not merely
the last journaled input revision. If an edit arrives while completion is in
flight, it uses the native `todo.update_item` service to restore that UID to
`needs_action`, verifies the state, reopens the controller-closed GitHub issue
and queues a fresh generation. If edited media cannot be journaled, the
source-drift receipt prevents stale completion until intake succeeds. Unknown
outcomes retain an explicit completion-attempt receipt for the one release
lane to reconcile before any worker resumes; they are never success-shaped
fallbacks.

`maxConcurrentWorkers` accepts integers from 1 through 10 and defaults to
**1** for existing installations. Each admitted issue has its own UUID-bound
claim, worktree, Docker container label and private Copilot home with only
the configured HASS MCP entry. Pending owner edits retain their input revision
while a worker is in flight, and a restart clears only claims from the
previous locked controller after its stale containers are removed. Failed
workers retry with a bounded backoff or become explicitly blocked; awaiting
user, paused, blocked and completed issues occupy no worker slot. A separate
single-slot lane owns candidate publication, protected checks, normal merge,
deployment verification, HA completion and worktree cleanup. It never
auto-merges a PR from an author other than `SFenton`.
Before a merge, new owner input interrupts protected publication. After the
merge, the release lane continues waiting for that exact deployment or layout
run despite new input; it then keeps the issue and Admin To-Do item open and
routes the update into a fresh worktree generation. A changed phase, generation,
merge identity, or pending completion repair still interrupts the wait.

The protected Playwright workflow queues up to GitHub's supported maximum
of 100 runs per ref, without cancelling a prior merged commit's layout
evidence. CI and layout capacity therefore remain independent of the ten
*issue-worker* ceiling. Do not treat a queued layout run as a release gate;
monitor its exact result after merge. Runtime activation is separate from
source merge: with operator approval, drain the installed worker, back up the
matching bundle and private journal, install the new bundle and worker
extension, then stage `maxConcurrentWorkers` from 1 to 2, 5 and at most 10
as resource use and intake latency allow. Do not roll an old binary forward
over an active new worker claim even when the additive journal fields remain
at state version 3.

## Reconsidering unavailable workflow evidence

A restricted worker has no direct GitHub Actions or host-network access.
For a trusted layout-failure issue paused solely on the exact original
CI-evidence question, the host controller binds the issue's commit and run
link to the failed `master` push workflow, its failed `Automated layout` job,
and the unexpired `layout-automation` artifact. A separate one-slot diagnostic
lane retrieves the failed-job log and ZIP without delaying new todo intake.
It verifies repository/run/attempt/artifact identities and inspects only the
assessment, WebKit, and optional non-WebKit execution JSON entries.
Signed artifact redirects never receive the GitHub authorization header.
The measured original #235 ZIP requires a 512-MiB compressed limit, 10,000
safe entries, 768 MiB of declared expanded data, 80 MiB per entry and 10 MiB
per selected JSON; all other entries, including screenshots, remain
unextracted. The worker receives only test locations/browser/failure
categories, checkpoint and browser-attempt counts, hashes and run provenance.
It cannot read raw logs, screenshots or signed URLs from that packet.
Missing checkpoints are not passes. Malformed, expired, oversized or
mismatched evidence leaves the question open and records an explicit error.

Only the single evidence-availability question, including its exact legacy
wording, can receive one fingerprinted `workflow-evidence` input and resume
the existing session. An operator-authorization or product-decision question
cannot be answered by automation. A worker may close without a pull request
only after proving the original failure genuinely needs no further action;
passing later tests or finding no proposed code diff is not sufficient.

For a trusted deployment-failure issue still awaiting restart authorization,
the host may separately observe a later accepted v2 frontend deployment
whose verified deployed SHA contains the originally failed commit on current
`master`. It posts one frontend-only status receipt but does not requeue the
worker, infer a Home Assistant restart or endpoint-health result, authorize
manual deployment, or close the issue. A source merge alone does not activate
these host-controller changes: installing and restarting its separately
managed bundle requires separate operator approval.

## Candidate provenance

Controller state version 3 uses one provenance record as the sole lifecycle
authority. It keeps the prepared base, current candidate head and tree,
committed-diff manifest, validation receipt, protected-check runs, PR merge
receipt, deployment binding, and optional visual-evidence receipts distinct.
Each visual receipt records the relative artifact path, media type, byte size,
SHA-256, committed-diff manifest, and GitHub attachment URL. Timestamp receipts
remain useful for audit but cannot authorize a merge or completion.

The expected remote head of a replacement candidate comes from the last
verified published head, not merely the previous local commit. New candidates
record that no push was attempted; the controller journals push intent before
the network call and records the published head only after confirming the exact
remote SHA. Retries preserve the confirmed publication and reject deleted or
divergent published branches. A pre-upgrade candidate with validation but no
publication evidence fails closed rather than assuming its branch was never
published; an owner comment can start a fresh generation.

Input media is separate from proposed fixed-behavior images. The controller
records each source occurrence, stable GitHub URL (never a signed redirect),
type, byte count and SHA-256, or an explicit unsupported reason. It scans up to
32 references, downloads at most 10 MiB per GitHub upload and 32 MiB per
input, and passes at most eight current verified files into one worker run.
Only PNG, JPEG, GIF and WebP use Copilot CLI's native `--attachment`
input. A synthetic check confirmed image recognition in fresh and resumed
`gpt-5.6-sol` sessions; PDF did not reach that pinned model without granting
host file-read permission, so it is explicitly unsupported. Animated GIF and
WebP files are also reported as unsupported; a static-frame check does not
certify motion. GitHub-supported
video, audio, SVG, bitmap/TIFF, Office, text and
archive uploads are still discovered, but a worker cannot claim to have
inspected their content; it must request a supported image, PDF or description
before the controller can approve a fix. Unknown external or signed URLs are
never fetched. Authentication goes only to the first approved GitHub origin;
bounded GitHub-managed redirects receive no Authorization header. The
controller verifies local media bytes again before copying them into the
networkless, ignored worker artifact directory.

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
- candidates classified as visibly changing React, plus every CSS or visual
  asset candidate, cannot advance without valid issue-scoped image files. The
  controller rejects traversal, symlinks, mismatched extensions or magic
  bytes, duplicate content, files above 10 MiB, and captions that omit
  mock/live provenance;
- uploaded attachment URLs must use GitHub's user-attachment host and every URL
  must remain embedded under `## Proposed fixed behavior` in both the live PR
  body and the controller-owned issue update before checks are accepted and
  again before merge;
- checks must be the latest successful runs for the exact candidate and pinned
  GitHub App;
- already-merged PRs pass the same provenance guard and must report a
  two-parent merge commit containing the exact authorized base and candidate;
- the normal deployment workflow `head_sha` and receipt `sourceSha` must both
  equal the verified merge commit. A recovery binding may use a later workflow
  head only when the controller records a separate descendant-coverage
  verification and the receipt's deployed SHA contains the merge on current
  `master`;

Strict branch protection can make a valid candidate stale while checks run.
The controller permits at most two base synchronizations per generation. Each
attempt is journaled before Git mutation, uses a normal merge and normal
fast-forward push, invalidates old checks, and reruns committed-diff
authorization plus trusted validation. Rebase, amend, reset, force push, and
force-with-lease are not recovery mechanisms.

After a synchronized branch push, GitHub's pull-request API may briefly report
the exact prior head even though the remote ref already has the new commit. The
controller tolerates only that one expected stale head for a bounded
propagation window; any other SHA, repository, base, branch, or URL still fails
closed.

If the controller was stopped or upgraded during a journaled nonterminal base
transition, it resumes that transition before dispatching new work. A
controller-generated retry revision may reauthorize the exact same clean head,
but it rebuilds the diff receipt for the new revision and discards prior
validation, checks, and image receipts so they must be established again.
During that evidence-refresh handoff, the existing PR must still match the
exact synchronized repository, branch, base, URL, and head. Its old image block
is not treated as evidence for the new candidate; advancement remains blocked
until fresh receipts are validated, uploaded, and embedded in both surfaces.

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
Keep `runnerControllerConfigPath` pointed at the private deployment-runner
config and `runnerControllerService` set to its exact user service. Those
settings let a merged, protected deployment repair rotate the workflow digest
without granting the worker access to the host config or systemd.

Before starting the service, baseline every pre-existing Admin To-Do item.
This is a mandatory fail-closed migration step:

```bash
node "$HOME/.local/share/admin-issue-controller/controller.mjs" \
  baseline \
  "$HOME/.config/admin-issue-controller/controller.json"
systemctl --user daemon-reload
systemctl --user enable --now admin-issue-controller.service
```

Upgrading an existing controller from state version 1 or 2 is a separate
operational rollout. Stop the old service first and retain its state. The first
locked version-3 `once` or `run` invocation validates the old journal, writes
a mode-`0600` versioned backup, and atomically migrates it. A version-2 paused
issue retains its published PR, candidate provenance, input revisions and
manual-close receipt unchanged. Version-1 in-flight records with prior
worktrees, PRs, or authorization-like receipts become `legacy-untrusted` and
cannot continue until an owner comment starts a fresh generation. Completed
history and pristine queued records remain readable, but no legacy SHA or
timestamp is promoted into trusted provenance. Old binaries reject a version-3
journal. Before replay or any external side effect, rollback requires stopping
the service and restoring the matching old binary **and** its retained journal
backup. After replay or GitHub branch/PR changes, repair forward instead.

Visual-evidence enforcement remains additive within state version 3. Existing
runtime candidates without a complete attachment receipt cannot pass live-PR
verification or finalization. An owner comment starts a fresh worker revision
that can generate the required issue-scoped images; existing non-runtime
candidates remain exempt. Uploaded URLs are journaled one at a time so a
restart does not duplicate successful uploads, while the local source images
remain in the ignored worktree artifact directory until normal issue cleanup.
Controller issue comments are upserted by their stable receipt marker, so a
retry or corrected candidate replaces stale text or images instead of leaving
the bug with an outdated evidence comment.

Install `home-assistant/custom_components/sfenton_admin_todo` and
`home-assistant/packages/sfenton_admin_todo.yaml` before enabling dashboard
image filing. This is a Home Assistant Python integration change and requires
the normal separately authorized restart-aware release. Until it is installed,
text-only Admin To-Do filing continues to use `todo.add_item`; selecting images
fails visibly and does not silently create a task without them.

## Operation and recovery

```bash
systemctl --user status admin-issue-controller.service
journalctl --user -u admin-issue-controller.service -f
node "$HOME/.local/share/admin-issue-controller/controller.mjs" \
  status \
  "$HOME/.config/admin-issue-controller/controller.json"
```

State is an atomic, strictly validated version-3 `0600` JSON journal under
`~/.local/state/admin-issue-controller`. Worker JSON event logs are retained in
its `worker-logs` child directory. Stable issue, comment, branch, session, PR,
merge, deployment, Home Assistant receipt, and worktree receipts make retries
idempotent.

An owner comment on a quarantined issue starts a fresh generation. Archive any
unpublished local commits needed for diagnosis first: the controller removes the
old worktree and branch as part of that transition. Do not clear quarantine by
editing the journal or bypassing the remote-head guard.

To pause one running issue while keeping other issues available, stop the user
service first, preserve its journal and candidate, manually close the issue,
then restart and verify that its journal phase is `paused`, its PR has not merged
or enabled auto-merge, and Home Assistant has not completed its to-do. After
the new bundle is merged, installed and active, reopening first downloads the
current owner media into private receipts. Only after that succeeds does it
close the superseded PR, remove its worktree/branch and enqueue a new
media-bearing input **after** old input revisions are marked processed.
Uninterpretable or inaccessible media leaves the old candidate paused rather
than restarting blindly; a controller comment explains the blocker. Reopening
is not a reuse of the old PR's checks.

Do not delete or edit the journal while the service runs. If intervention is
required, stop the service first and retain the journal and worker logs for
diagnosis. The `status` command intentionally refuses to migrate older
state outside the controller lock.
