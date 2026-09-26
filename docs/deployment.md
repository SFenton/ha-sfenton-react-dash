# Dashboard deployment automation

Every push to protected `master` starts `.github/workflows/deploy-dashboard.yml`.
The post-merge layout workflow is independent regression monitoring: dashboard
deployment neither depends on nor waits for its jobs or artifacts.

If the protected build or deployment job fails, the workflow downloads its
sanitized receipt when available. Every report carries the exact
`dashboard-deployment-failure-run-<run>-<attempt>` marker. A receipt that proves
no mutation, lease release, and no required rollback also carries a stable
failure-signature marker that excludes the run and source SHA. If an open issue
already has that exact signature, the workflow appends the new run to the
canonical issue instead of filing another investigation. Different errors,
deployed baselines, or uncertain mutation/rollback states always file a new
issue. The Admin issue controller adopts a newly filed issue, runs tandem
research, and may change only the deployment workflow,
`scripts/deploy-dashboard-ci.ts`, and its directly owned test in addition to
ordinary dashboard paths. The failed deployment itself still performs no
success-shaped mutation or automatic Home Assistant restart.

Admin To-Do issue automation is operated by a separate controller and does not
change deployment ownership. See
[Admin issue controller](./admin-issue-controller.md) for its installation,
isolation boundary, protected-merge flow, and deployment-receipt verification.

## Trust boundary

The workflow separates build and deployment:

- GitHub-hosted `Build dashboard artifact` checks out the exact push SHA,
  receives no Home Assistant or SSH credential, and never receives
  `VITE_HA_TOKEN`. Its dormant `VITE_HOME_MCP_ENABLED=false` environment
  guard does not enable frontend chat.
- `Deploy dashboard` uses a unique per-run label and a one-job JIT runner.
  The runner is absent until the host controller validates the exact workflow,
  event, branch, SHA, job, workflow digest, and local runner-image digest.
- The deploy workflow's first runner step is an admission gate that runs before
  artifact download and before any HA-secret-bearing step. Rejected production
  attempts write a sanitized receipt and fail without HA proxy access.
- The runner initially has only an allowlisted GitHub proxy. The controller
  grants access to HA-specific SSH and API proxies only after GitHub reports
  that the expected job is bound to the generated runner ID and name.
- The read-only runner uses an anonymous Docker volume for its runtime files;
  the controller removes that volume with the one-job container.
- Production credentials live in the GitHub `production` environment, which is
  restricted to `master`. They are not stored on the runner host or mounted
  into the runner container.

The repository is public. Do not replace this design with a persistent
repository runner, generic runner labels, host networking, a Docker socket
mount, or access to the operator's home directory.

## Automatic deployment scope

The automatic path publishes frontend assets only. It:

1. verifies the artifact manifest and full source SHA;
2. uses attempt-scoped run/job discovery (paginated, deduplicated, and
   exact-label) and rejects ambiguous runnable states instead of choosing by
   timestamp;
   waiting/requested/pending jobs behind the concurrency holder are
   non-runnable, while any other matching status fails closed;
3. classifies each candidate under the production lease with monotonic
   dispositions:
   - `forward`: deployed SHA is an ancestor of candidate and candidate is on
     current `master`;
   - `already-current`: candidate equals deployed;
   - `superseded`: candidate is an ancestor of a verified deployed SHA that is
     still on current `master`;
   - divergent/unverifiable states fail closed;
4. treats successful `already-current`/`superseded` outcomes as verified no-op
   completions (no asset or metadata mutation) and emits truthful v2 receipts;
5. requires a successful same-attempt build for the active deploy attempt.
   Unsupported deploy-only/partial reruns are rejected as
   `full-rerun-required`; operators must re-run all jobs for the workflow run;
6. refuses Home Assistant runtime changes under `home-assistant/`, Home MCP
   changes under `home-mcp/`, or a changed `sfenton-react-panel.js` bridge;
7. captures production, acquires the durable release lease before reading
   disposition state, overlays the new build while retaining prior hashed
   assets, and uses the tested transactional directory swap;
8. writes a durable deployment record (`deployment.json` v2) only after
   verified deployment. The record includes full SHA provenance, canonical
   deployed file hashes (excluding `deployment.json`), exact host metadata, and
   a canonical deployment hash;
9. treats v1 deployment records as migration-only:
   - forward deploys upgrade to v2;
   - equal SHA on v1 requires a real re-attestation/deployment;
   - older candidates against v1 fail closed until a forward v2 deployment exists;
10. updates the legacy wrapper and card resource to the full commit SHA;
11. verifies exact remote and HTTP bytes plus the embedded panel registration;
12. rolls back assets and metadata on failure.

Blocked Home Assistant runtime changes use the restart-aware manual release;
the automatic job never stages HA packages/components and never restarts HA.

Both dashboard hosts remain required:

- `/sfenton-react-dash/home`
- `/sfenton-react-panel`

## Controller installation

Build and bundle from the reviewed implementation worktree:

```bash
npm run deploy:runner:bundle
docker build \
  --tag ha-sfenton-dashboard-runner:20260919 \
  --file ops/ha-deploy-runner/Dockerfile \
  .
```

Install the controller bundle, example config, and user service under:

```text
~/.local/share/ha-dashboard-runner/controller.mjs
~/.config/ha-dashboard-runner/controller.json
~/.config/systemd/user/ha-dashboard-runner-controller.service
```

Populate the config with the GitHub repository ID, repository runner-group ID
(`1` for this personal repository's default group), the SHA-256 of the merged
workflow file, and the exact local Docker image ID. Start with `"mode":
"smoke-only"`. The service runs as the operator's lingering user and uses that
user's authenticated `gh` and Docker clients; its GitHub credential must never
be copied into a workflow secret or runner container.

The workflow digest is a deliberate trust boundary. After protected checks
pass and a merge commit is proven on `origin/master`, any release that changed
`.github/workflows/deploy-dashboard.yml` must atomically replace only
`workflowSha256` with the exact merged blob digest, preserve mode `0600`,
restart `ha-dashboard-runner-controller.service`, and verify it is active
before waiting for the deployment job. Never authorize a candidate or pull
request head before merge. The Admin issue controller performs this rotation
for deployment-repair pull requests it merges; other release coordinators own
the same post-merge step for their releases.

The smoke dispatch must prove:

- the job receives only its unique label;
- GitHub reports the expected runner ID/name binding;
- no deployment secret exists;
- HA proxy names are unreachable;
- the container and repository runner registration disappear afterward.

Only then change the controller to `"mode": "production"` and restart it.

## GitHub environment

Create a `production` environment restricted to protected `master`, with
administrator environment-rule bypass disabled. Configure:

- secret `HA_DEPLOY_TOKEN`
- secret `HA_DEPLOY_SSH_PRIVATE_KEY`
- variable `HA_DEPLOY_SSH_HOST_KEY_SHA256`

Derive the host-key digest from the existing trusted `known_hosts` entry and
confirm the live key still matches before storing it. Never bootstrap trust
from an unchecked `ssh-keyscan`.

## Verification and recovery

Runs upload a sanitized deployment receipt keyed by the full merge SHA and run
attempt whenever admission or deployment reaches receipt generation. Receipts
are v2 and include disposition
(`forward`/`already-current`/`superseded`/`full-rerun-required`), deployment
hash provenance when available, exact verification scope, and rollback status.
They contain no token, host name, IP address, browser storage, or screenshot.

Controller startup is fail-closed. It uses an exclusive process lock and an
active-operation journal. On restart it can clean a proven unassigned pre-HA
attempt and terminal exact resources; it blocks on ambiguity, post-HA
uncertainty, unresolved lease ownership, or incomplete cleanup until operator
recovery.

An incomplete rollback deliberately leaves the remote lease, journal, and
backup in place. Do not delete them blindly; inspect the failed run and recover
the captured prior state before allowing another production deployment.

## One-time retirement of dashboard Chat

The app no longer opens Chat or sends conversation feedback. Home MCP continues
to serve authenticated `home_info`, `home_state`, `home_history`, and
`home_lights`; the HA proxy and both dashboard hosts remain maintained.
Production `sfenton_react_chat.purge_expired_history` remains registered until
Home Assistant restarts even if the repository files have been removed.
Do **not** invoke that service or clear user frontend-history records.

1. Stop and disable only `home-mcp-improver.path` and
   `home-mcp-improver.timer` after confirming no worker job is in flight.
   Preserve the existing improvement queue and its data directory as private
   evidence; do not publish a queued patch or erase the queue to make the
   worker appear idle. Build the exact merged Home MCP source, publish it with
   the pinned TLS material, then verify an authenticated `home_info` response
   with the expected version and no `home_chat` tool.
2. Capture the **installed** `packages/sfenton_react_chat.yaml` and the exact
   files beneath `custom_components/sfenton_react_chat/` into a private,
   mode-`0700` backup **outside** `packages/` and `custom_components/`.
   Inspect unknown files or references rather than deleting them by wildcard.
   Remove only the confirmed chat package/component files from active HA
   configuration. `scripts/deploy.ts` intentionally does not stage or delete
   them; merely shipping new assets cannot unload the Python service.
3. Stage the reviewed panel package with its new module URL and any other
   separately approved HA runtime changes. Run HA configuration validation.
   If invalid, restore the exact captured files and prior package immediately,
   recheck configuration, and stop before restarting or replacing dashboard
   assets. A backup does not make an invalid restart safe.
4. Restart HA once with explicit approval and verify it is responsive, the
   `sfenton_react_chat.purge_expired_history` service is absent, and the
   authenticated Home MCP proxy still reaches the TLS-pinned server. A
   restored/unavailable registry entry for an old daily purge automation does
   not prove that the automation is running; inspect it separately. Existing
   per-user frontend storage is left untouched.
5. Build from the exact protected merged `master`, then publish the same
   `dist/` to the raw app, legacy wrapper, and embedded panel; update the
   wrapper URL to the merge SHA and verify both hosts, panel bridge cache
   version, and authenticated `home_info`. Retain the private rollback backup
   until the release and host checks are complete.
