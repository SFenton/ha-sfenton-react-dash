---
description: "Use when editing the simulated user panel skill or its supporting resources."
applyTo: ".github/skills/simulated-user-panel/SKILL.md,.github/skills/simulated-user-panel/**/*.md"
---

# Simulated user panel instructions

- Keep routine/standard coordination pinned to `gpt-5.6-sol`, reasoning effort
  `medium`, and context tier `default`. Sol `max`/`long_context` is conditional
  on an evidence-bound `panel-deep-safety-adjudication` or
  `panel-material-disagreement-adjudication` receipt.
- Keep all operator-requested core personas in the default panel and preserve
  the exact model, effort, and context settings unless a change is supported by
  measured panel calibration.
- Keep participant agents read-only. They must not edit files, write code, read
  secrets, use browser tools directly, call Home Assistant services, mutate
  external systems, or spawn agents. Launch them through isolated
  non-interactive Copilot sessions with tool filtering and explicit deny rules;
  block the run instead of falling back to shell-capable participant agents.
- Keep interaction mock-first. Live Home Assistant is observation-only inside
  a panel run; participant-driven device actuation is not supported. Require
  the no-proxy eval preview config, localhost URL, fresh browser context,
  network audit, and `window.__mockHass` preflight before guided tasks. Do not
  use `npm run dev:mock` or the repository's default preview config for panel
  interaction because both inherit live proxy routes.
- Keep persona definitions behavioral and explicitly synthetic. Do not claim
  demographic authenticity, equate model cost with human intelligence, or
  generalize capabilities or preferences to real groups. Require interface
  properties and mechanisms instead of demographic capability claims.
- Keep independent first passes, evidence-backed consensus, adversarial
  cross-critique, calibration of model-sensitive findings, and trigger-scaled
  Sol adjudication.
- Keep participant output strict JSON with exact allowlisted surface ids,
  non-empty evidence for every finding, lens attestation, severity
  justification, and explicit out-of-scope notes.
- Keep severity anchored. Unknown evidence gaps cannot be high or blocker, and
  missing packet evidence is not a product blocker.
- Keep calibration and adversarial review cross-vendor when practical, and keep
  specialist selection deterministic with omitted-trigger reporting.
- Keep implementation closed unless the original invocation explicitly asks
  for changes. Follow-on work resolves through the hierarchical project
  pipeline and does not imply permission for Home Assistant mutation, commit,
  push, deployment, or restart.
- Keep reports privacy-sanitized. Never print or persist tokens, credentials,
  live camera images, household task text, names, URLs, coordinates, or volatile
  entity attributes.
- Do not add package scripts, dependencies, or app source merely to run
  this skill. Keep eval assets under the skill's `evals/` directory and
  artifacts under ignored `artifacts/`.
