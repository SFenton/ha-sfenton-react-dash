# HA React dashboard

React 19 / TypeScript / Vite / HAKit. Home Assistant owns state changes and
multi-entity effects; React signals services/scripts/helpers and uses the shared
optimistic-state hook. EverShelf access goes only through HA `evershelf.*`
services. Keep entity IDs in constants and pages declarative.

## Unconditional safety

- Preserve unrelated work and secrets. Never print HA tokens or embed them in
  production. Do not commit, push, release, deploy, or mutate live HA unless
  explicitly authorized. Default branch: `master`.
- Keep both `/sfenton-react-dash/home` and `/sfenton-react-panel` maintained.
  Do not retire a host or change its ownership without explicit approval.
- Preserve `base: './'`, inherited HA authentication, and one HA behavior layer.
- Preload rendering performs no runtime I/O. Never bypass a missing visual,
  state, provenance, configuration, or deployment gate to reduce token usage.
- Use the smallest existing validation that covers the change. Do not install
  dependencies merely to inspect instructions or route a task.
- Before a release push, require only changed-test policy and every changed or
  added test file locally. The protected pull-request workflow owns broad lint,
  unit, build, automated layout, and full Playwright gates. Human layout review
  for affected UX is post-push release acceptance, not a pre-push gate.
- Treat any request to start, run, serve, host, open, or preview the React app
  as a `/host-web-app` trigger even when LAN or `0.0.0.0` is not mentioned.
  Before handing off user-visible dashboard or UX work for operator review,
  start or verify that compliant LAN runtime unless the operator opts out.

## Read only the relevant contract, but read it before acting

| Task | Required instructions |
|---|---|
| Dashboard code, HA services, ports, cameras, lifecycle, release | [.github/reference/dashboard-contract.md](reference/dashboard-contract.md), in full |
| UX, styling, visible copy, responsive behavior | Matching `.github/instructions/` files, `docs/ux/layouts.md`, and its executable plan |
| Port from Lovelace | `dashboard-ux-authoring` / HASS Porting; source config and real browser parity remain required |
| Release explicitly requested | `release-dashboard`; explicit authorization gates remain unchanged and the coordinating profile is `gpt-5.4` medium/default |
| Generic research/implementation/testing | `.github/agent-budget.json` and `ha-budget-workflow` |

Local layout validation is mock-only and provenance-bound. It does not
authorize live HA probes or certify production parity. Actual image inspection
and manual interaction remain necessary for plan review items.

Start narrow: symbol lookup, exact source ranges, and targeted existing commands.
Do not invoke tandem, the simulated user panel, or the autonomous admin
executor unless explicitly requested. Unknown or consequential architectural
questions need frontier evidence, not a cheap summary. A model route never
changes repository safety or release requirements.

Behavior-bearing implementation changes must include a changed or added test
in the same change set. Application behavior accepts a changed `src/**/*.test`
or Playwright spec; CSS behavior requires a changed Playwright spec; tooling
requires a changed `scripts/**/*.test`; Home Assistant behavior requires a
changed HA or scripts test. Documentation-only and test-only changes are
exempt. `npm run test:change-policy` is authoritative; do not edit an unrelated
test merely to satisfy it.
The test must either share the implementation file's repository-relative stem
(`Widget.tsx` / `Widget.test.tsx`, including `module.css`) or contain an exact
`@covers path/to/implementation` declaration. Non-colocated Playwright and HA
coverage must use `@covers`; the declaration is an auditable ownership claim,
not permission to cite an unrelated assertion.

The version 3 budget route is deterministic first. The interactive model may be
Sol, HydraFusion, or another model; identity never bypasses the exact
opportunity pin. A matching qualified model may fill the resolved role,
otherwise the router dispatches the project medium coordinator/reviewer.
Unqualified models may orchestrate and read evidence but gain no semantic,
repository-apply, Home Assistant, production, or release authority. Sol
max/long is conditional on a named trigger receipt, never routine residency.

The installed continuous-improvement observer is governed by
`.github/agent-learning.json`. It silently no-ops when no repeated reusable
pattern qualifies and grants no visual, HA, repository-apply or release
authority.
