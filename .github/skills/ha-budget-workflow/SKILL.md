---
name: ha-budget-workflow
description: Thin HA React adapter for budget-aware research, implementation, testing and authorized release; preserves dashboard contracts and layout evidence.
---

# HA budget workflow

Use the global `budget-workflow` skill if installed; its executable tools live
under `$HOME/.copilot/skills/budget-workflow/scripts/`. If unavailable, use the
same direct, bounded workflow below without installing an external service.

Research uses `evidence/research.mjs plan` and the adapter's `evidencePolicy`.
Choose repository-only for local component/service logic, hybrid for external
React/HA guidance that must fit existing owners, or neutral external-only when
the app is irrelevant. Prefer current-owner `init`/`evidence`; no reader agent.
Hybrid orientation establishes a small source-backed contract before external
gaps, then returns to local applicability. Source-only findings never establish
visual parity, device state or measured rendering cost.

1. Read `.github/agent-budget.json`. For dashboard behavior or release work,
   read `.github/reference/dashboard-contract.md` in full and matching scoped
   instructions. Pure tooling/documentation work need not load camera/UX prose.
2. Classify the task before research. Known local fixes use exact source and
   tests; novel runtime behavior or physical-device semantics need primary
   evidence and frontier reasoning. Do not spawn the simulated panel or tandem.
3. Reuse existing components, HA action mappings, and targeted tests.
   For UI work invoke `dashboard-ux-authoring`, including house-style copy when
   relevant. Do not replace actual browser inspection with model confidence.
4. Run the smallest relevant Vitest selectors together. UX work uses the
   executable layout plan and its mandatory manual review. Treat inaccessible
   evidence as blocked. A non-UX tooling change does not need a full UI suite.
5. Revise once from concrete failures, then escalate an unresolved reasoning
   issue once. Do not rerun broad suites or regenerate screenshots speculatively.
6. Release only when explicitly requested, through `release-dashboard`.
   Preserve its current model contract and both HA hosts.

The project adapter selects evidence and commands; it does not grant permissions
or certify a cheaper model as equivalent to independent frontier research.
