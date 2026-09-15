---
description: "Use when editing the house-style-copy skill, its corpus, retrieval tooling, evals, or model pin."
applyTo: ".github/skills/house-style-copy/**"
---
# House-style copy skill

- Keep the skill read-only by default. It generates, rewrites, audits, or ranks copy; it never edits app, catalog, Home Assistant, or external-system files.
- Keep implementation authorization separate and `gpt-5.4`-owned. A copy response is not permission to modify repository or Home Assistant state.
- Keep Home Assistant notification delivery HA-owned. Notification requests may return sanitized `home-assistant-reference` wording only and must never instruct React to send notifications.
- Keep household names, HA-mirrored proper nouns, live entity friendly names, task text, recipe text, identifiers, tokens, and private attributes out of the corpus. Proper-noun restyling requests must be refused.
- Preserve required placeholders byte-for-byte. Never invent placeholders, services, entities, state transitions, delivery behavior, or confirmed outcomes.
- Keep retrieval deterministic: exact context first, same length band, then same namespace/surface. Notification contexts may retrieve only notification peers. Return no more than five positive and two negative exemplars.
- Keep every response strict JSON using the documented response contract. Invalid JSON, model substitution, tool use, writes, privacy leakage, ownership violations, and placeholder drift are hard eval failures.
- Keep all skill eval tooling under `.github/skills/house-style-copy/evals/`. Repository-wide i18n tooling belongs elsewhere and is outside this instruction's scope.
- Keep the exact pinned model, effort, and context in `evals/model-pin.json` when a qualified non-frontier non-Claude profile exists. Otherwise fail closed with a blocked pin instead of falling back to Sol or Claude. The launcher must enforce the runtime profile; skill metadata is descriptive only.
- Do not weaken hard gates or quality thresholds merely to make a cheaper model pass.
- Keep eval artifacts under the ignored `artifacts/house-style-copy-evals/` tree and never use temporary directories.
