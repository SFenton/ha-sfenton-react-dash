---
description: "Use when editing the house-style-copy skill, its corpus, retrieval tooling, evals, or model pin."
applyTo: ".github/skills/house-style-copy/**"
---
# House-style copy skill

- Keep the skill read-only by default. It generates, rewrites, audits, or ranks copy; it never edits app, catalog, Home Assistant, or external-system files.
- Keep implementation authorization separate from model role. A copy response is not permission to modify repository or Home Assistant state; follow-on edits use the hierarchical project route.
- Keep Home Assistant notification delivery HA-owned. Notification requests may return sanitized `home-assistant-reference` wording only and must never instruct React to send notifications.
- Keep household names, HA-mirrored proper nouns, live entity friendly names, task text, recipe text, identifiers, tokens, and private attributes out of the corpus. Proper-noun restyling requests must be refused.
- Preserve required placeholders byte-for-byte. Never invent placeholders, services, entities, state transitions, delivery behavior, or confirmed outcomes.
- Keep retrieval deterministic: exact context first, same length band, then same namespace/surface. Notification contexts may retrieve only notification peers. Return no more than five positive and two negative exemplars.
- Keep every response strict JSON using the documented response contract. Invalid JSON, model substitution, tool use, writes, privacy leakage, ownership violations, and placeholder drift are hard eval failures.
- Keep all skill eval tooling under `.github/skills/house-style-copy/evals/`. Repository-wide i18n tooling belongs elsewhere and is outside this instruction's scope.
- Keep routine runtime routing in `evals/runtime-routing.json`. The existing
  validated Sol max/long `evals/model-pin.json` is historical evidence and may
  be used only for an evidence-bound `copy-safety-conflict` adjudication
  receipt. The launcher must enforce the selected route; skill metadata is
  descriptive only.
- Conditional adjudication must validate the trigger against the complete
  canonical current-policy pipeline prefix, including repository, revision,
  scope, phase order, role, profile, authority, tool, usage, and predecessor
  hashes, and bind it to the complete ordered model prompt payload, redacted
  locally resolved batch identity, and freshness window.
- Do not weaken hard gates or quality thresholds merely to make a cheaper model pass.
- Keep eval artifacts under the ignored `artifacts/house-style-copy-evals/` tree and never use temporary directories.
