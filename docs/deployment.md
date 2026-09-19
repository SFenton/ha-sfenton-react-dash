# Dashboard deployment automation

Every push to protected `master` starts `.github/workflows/deploy-dashboard.yml`.
The post-merge layout workflow is independent regression monitoring: dashboard
deployment neither depends on nor waits for its jobs or artifacts.

## Trust boundary

The workflow separates build and deployment:

- GitHub-hosted `Build dashboard artifact` checks out the exact push SHA,
  receives no Home Assistant or SSH credential, forces
  `VITE_HOME_MCP_ENABLED=false`, and never receives `VITE_HA_TOKEN`.
- `Deploy dashboard` uses a unique per-run label and a one-job JIT runner.
  The runner is absent until the host controller validates the exact workflow,
  event, branch, SHA, job, workflow digest, and local runner-image digest.
- The runner initially has only an allowlisted GitHub proxy. The controller
  grants access to HA-specific SSH and API proxies only after GitHub reports
  that the expected job is bound to the generated runner ID and name.
- Production credentials live in the GitHub `production` environment, which is
  restricted to `master`. They are not stored on the runner host or mounted
  into the runner container.

The repository is public. Do not replace this design with a persistent
repository runner, generic runner labels, host networking, a Docker socket
mount, or access to the operator's home directory.

## Automatic deployment scope

The automatic path publishes frontend assets only. It:

1. verifies the artifact manifest and full source SHA;
2. verifies the currently deployed wrapper SHA is an ancestor of the candidate;
3. processes every queued master push in FIFO order, even when a newer merge
   has already advanced `master`, and checks the complete
   deployed-to-candidate range;
4. refuses Home Assistant runtime changes under `home-assistant/`, Home MCP
   changes under `home-mcp/`, or a changed `sfenton-react-panel.js` bridge;
5. captures production, acquires the durable release lease, overlays the new
   build while retaining prior hashed assets, and uses the tested transactional
   directory swap;
6. updates the legacy wrapper and card resource to the full commit SHA;
7. verifies exact remote and HTTP bytes plus the embedded panel registration;
8. rolls back assets and metadata on failure.

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

Successful runs upload a sanitized deployment receipt keyed by the full merge
SHA and run attempt. A receipt proves the artifact manifest, exact remote and
HTTP bytes, wrapper/resource versions, panel registration, and rollback status.
It contains no token, host name, IP address, browser storage, or screenshot.

An incomplete rollback deliberately leaves the remote lease, journal, and
backup in place. Do not delete them blindly; inspect the failed run and recover
the captured prior state before allowing another production deployment.
