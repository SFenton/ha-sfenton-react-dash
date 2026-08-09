---
description: "Use when editing the simulated user panel skill or its supporting resources."
applyTo: ".github/skills/simulated-user-panel/SKILL.md,.github/skills/simulated-user-panel/**/*.md"
---

# Simulated user panel instructions

- Keep the coordinator pinned to `gpt-5.6-sol`, reasoning effort `max`, and
  context tier `long_context`.
- Keep all operator-requested core personas in the default panel and preserve
  the exact model, effort, and context settings unless a change is supported by
  measured panel calibration.
- Keep participant agents read-only. They must not edit files, write code, read
  secrets, use browser tools directly, call Home Assistant services, mutate
  external systems, or spawn agents.
- Keep interaction mock-first. Live Home Assistant is observation-only inside
  a panel run; participant-driven device actuation is not supported. Require
  the localhost mock URL and `window.__mockHass` preflight before guided tasks.
- Keep persona definitions behavioral and explicitly synthetic. Do not claim
  demographic authenticity, equate model cost with human intelligence, or
  generalize findings to real groups.
- Keep independent first passes, evidence-backed consensus, adversarial
  cross-critique, calibration of model-sensitive findings, and Sol
  adjudication.
- Keep implementation closed unless the original invocation explicitly asks
  for changes. Implementation is Sol-only and does not imply permission for
  Home Assistant mutation, commit, push, deployment, or restart.
- Keep reports privacy-sanitized. Never print or persist tokens, credentials,
  live camera images, household task text, names, URLs, coordinates, or volatile
  entity attributes.
- Do not add package scripts, dependencies, or app/manual source merely to run
  this skill. Follow the full App Manual gate whenever a later panel-driven
  implementation changes user-visible or Home Assistant-backed behavior.
