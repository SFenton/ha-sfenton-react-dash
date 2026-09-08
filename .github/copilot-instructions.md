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

## Read only the relevant contract, but read it before acting

| Task | Required instructions |
|---|---|
| Dashboard code, HA services, ports, cameras, lifecycle, release | [.github/reference/dashboard-contract.md](reference/dashboard-contract.md), in full |
| UX, styling, visible copy, responsive behavior | Matching `.github/instructions/` files, `docs/ux/layouts.md`, and its executable plan |
| Port from Lovelace | `dashboard-ux-authoring` / HASS Porting; source config and real browser parity remain required |
| Release explicitly requested | `release-dashboard`; its pins and authorization gates remain unchanged |
| Generic research/implementation/testing | `.github/agent-budget.json` and `ha-budget-workflow` |

Local layout validation is mock-only and provenance-bound. It does not
authorize live HA probes or certify production parity. Actual image inspection
and manual interaction remain necessary for plan review items.

Start narrow: symbol lookup, exact source ranges, and targeted existing commands.
Do not invoke tandem, the simulated user panel, or the autonomous admin
executor unless explicitly requested. Unknown or consequential architectural
questions need frontier evidence, not a cheap summary. A model route never
changes repository safety or release requirements.
