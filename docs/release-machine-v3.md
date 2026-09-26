# Release machine v3

The established, explicitly invoked `release-dashboard` workflow remains the
production release path. Version 3 is developed in shadow mode until every
side-effecting driver is implemented, fault-tested, and compared against real
manual releases. Its disabled state never blocks an explicitly authorized
manual release and does not add local pre-push validation requirements.

## Variants

| Variant | Purpose | Production mutation |
| --- | --- | --- |
| `repository-only` | Merge tooling, documentation, tests, and other changes that do not alter the deployed dashboard. | None |
| `dashboard-production` | Validate, merge, build, deploy, verify, and if necessary restore both Home Assistant dashboard hosts. | Explicitly authorized |

Both variants bind an exact base revision, scope hash, path inventory, branch,
and optional patch hash. The scope hash covers the complete normalized release
context rather than trusting a caller-provided label. Dashboard releases
additionally require an accepted layout run and an exact affected Playwright
spec list.

## Current implementation

- The shared v3 runner injects repository, base revision, scope, variant,
  workflow, plan, and authorization bindings only through fields explicitly
  allowed by each command tool. Ambient `RELEASE_AUTHORIZED_*` values are
  discarded, while GitHub-capable tools explicitly inherit `HOME` so `gh`
  authentication and its Git credential helper remain available. Dashboard
  drivers reject missing or mismatched trusted bindings.
- Typed context validation rejects secrets, traversal, duplicate paths, partial
  dashboard evidence, malformed revisions or hashes, unsafe worktree
  locations, and release/build/rollback worktree collisions.
- Scope validation rejects behavior-bearing implementation patches without a
  changed domain-appropriate test. Changed Playwright specs must also appear in
  the authorization-bound affected-spec list that the release executes.
- The shadow planner emits variant-specific steps and a stable plan hash.
- Every normal-step failure is simulated through its declared rollback and the
  unconditional cleanup step.
- Repository-only Git, pull-request, merged-build, Git rollback,
  rollback-verification, and cleanup drivers are implemented and exercised
  against a real local Git remote plus a fake GitHub CLI.
- Git and GitHub mutations use write-ahead state for commit preparation,
  pushes, pull-request creation, merges, and revert releases. Restart recovery
  reconciles authoritative branch and pull-request state before retrying.
- Release and revert pull requests are bound to their exact head and base OIDs.
  The resulting merge commit must have exactly the authorized base and release
  commit as its two parents, and builds use that recorded merge OID.
- Release and build worktrees use the exact authorized dependency worktree and
  verify the `node_modules` link target. Dependency-manifest changes fail
  closed until an isolated install driver is available.
- Dashboard layout verification, exact affected Playwright execution, scoped
  Git release, merged build, Git rollback, and cleanup now use those registered
  command drivers.
- Transactional production capture, deployment verification, exact asset and
  host-metadata restoration, and rollback verification are implemented against
  a local production adapter. Corrupted deploys and corrupted rollbacks fail
  closed.
- Production candidates pin the exact dashboard folder and SSH host-key digest,
  use workflow-unique upload-and-rename asset replacement, require signed
  operator review evidence, and refuse rollback after a divergent production
  change.
- A durable workflow- and authorization-bound production lease serializes
  mutation. Interrupted asset swaps restore the retained prior directory before
  retrying; the recovery directory and lease remain until the unconditional
  finalization step.
- `capture-production` precedes deployment so rollback never depends on an
  uncaptured prior bundle or wrapper version.
- Repository-only releases cannot invoke dashboard deployment or persistent
  user-level installers; those require separate operator authorization.

Run a shadow plan with:

```bash
npm run release:shadow -- /absolute/path/to/context.json
```

## Activation backlog

The production machine remains disabled until the remaining production drivers
exist and pass fake-driver fault tests:

1. Release and install the shared-runner authorization changes before any
   dashboard command driver can be enabled.
2. Qualify the real Home Assistant/SSH adapter in an authorized non-production
   fixture, including crash injection at each asset rename and idempotent
   lease/staging finalization. It captures and restores assets,
   wrapper/resource metadata and the exact supported panel configuration
   files with HA config checks.
3. Add a separately authorized Home Assistant restart driver and post-restart
   verification before permitting configuration release scopes.
4. Add an isolated dependency-install driver before permitting
   `package.json` or `package-lock.json` release scopes.
5. Verify the raw app, legacy wrapper, and custom panel without actuating
   devices.
6. Operate Ed25519-signed human attestations for real-phone rendering and
   visual judgment; deterministic checks cannot manufacture those observations.
7. Restore the complete prior production state after any failed deployment or
   verification, then verify the rollback.

After the drivers pass fault injection, run the machine in shadow mode beside
multiple manual releases. Enable it only when its plans and evidence match the
manual workflow and rollback has been exercised successfully.
