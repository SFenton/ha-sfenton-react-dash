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
  unit, build, and full Playwright gates; the post-merge master workflow owns
  automated layout. Human layout review for affected UX is post-push release
  acceptance, not a pre-push gate.
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
| Release explicitly requested | `release-dashboard`; explicit authorization gates remain unchanged and the coordinating profile is `gpt-5.6-luna` medium/default |
| Generic research/implementation/testing | Native project rules, direct tools, and bounded non-Claude evidence delegation when useful |

Local layout validation is mock-only and provenance-bound. It does not
authorize live HA probes or certify production parity. Actual image inspection
and manual interaction remain necessary for plan review items.

Start narrow: symbol lookup, exact source ranges, and targeted existing commands.
Do not invoke tandem, the simulated user panel, or the autonomous admin
executor unless explicitly requested. Unknown or consequential architectural
questions need strong evidence, not a cheap summary. The current main model
owns task meaning and final intent coverage; delegates gather bounded evidence
without rewriting the task. Use no Claude models.

For a named recurring household system, integration, feature, or entity, search
relevant Copilot session history with the operator's original nouns before
diagnosing it. Preserve the operator's exact wording until evidence establishes
the owning layer. Load `dashboard-ux-authoring` only after confirming the issue
belongs to React UX rather than Home Assistant or a physical device.

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

Opportunity, packet, receipt, staged-worker, and learning-policy files are
optional tooling only. They do not route ordinary work or grant authority.
Repository prompt hooks are session-end observability only.
