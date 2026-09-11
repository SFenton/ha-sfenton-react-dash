# Home MCP capability template

## Capability

- Device family:
- User goals:
- Explicit exclusions:
- Physical/security risk:
- Gemini conversation agent:

## Inventory evidence

| Room / scope | Group target | Leaf targets | Friendly aliases | Integration | Supported features | Query evidence |
|---|---|---|---|---|---|---|

## Intent taxonomy

| Intent | Example | Required slots | Clarification | Tool operation |
|---|---|---|---|---|

Include direct actions, relative actions, exact values, named subsets, compound operations, current state, history, evidence/why, integration-owned mode/status, and meaning/explanation.

## State/service matrix

| Displayed state | Semantic | User event | HA target/service | Optimistic intent | Unavailable/error behavior |
|---|---|---|---|---|---|

## Structured response

```json
{
  "status": "success | answer | clarify | unsupported | failed | partial",
  "text": "User-visible English response",
  "controls": [],
  "context": {
    "domain": "capability-family",
    "roomId": null,
    "entityIds": [],
    "names": [],
    "lastAction": null,
    "lastState": null,
    "historyBefore": null
  },
  "data": {}
}
```

List every control variant and its one-send continuation message.

| Control variant | Exact targets | Capability intersection | Initial read-only value | Local draft owner/key | Send continuation | Unsupported behavior |
|---|---|---|---|---|---|---|

Custom editors must stage values without HA calls, remain within the mounted sheet when they are detail views, preserve the draft after Back, and submit only through the owning response instance's one-send continuation. Test all-capable, mixed-capability, unavailable-current-state, repeated-control, and legacy-record cases.

Response invariants: aggregate room subjects such as “Living Room lights” use plural agreement (`are`). Group same-state rooms with natural `both`/`all` wording, and coordinate mixed-state groups without repeating unnecessary articles. A confirmed command failure is a conversational answer: retain its conversation ID and operation/result context so follow-up messages remain sendable; reserve error/unknown states for transport or persistence failures.

## Corpus families

| Family | Applicable scopes / targets | Target unique user utterances | Single / multi-turn | Compound coverage | Unsupported / failure coverage |
|---|---|---:|---|---|---|

Required baseline: 10,000 user utterances per family, casual English, <=180 characters, Gemini-bound expected tool schema, and long-context reference tests. Document why any room, alias, target, or capability is excluded.

### Generator invariants

- Loop ordering keeps the target-sized prefix balanced across applicable rooms and targets.
- Prefix and postfix phrasal forms are represented where natural.
- Canonical names and approved aliases are represented.
- Impossible capability combinations produce explicit unsupported examples.
- Fixture names that contain room aliases and room aliases that contain action-like words have collision examples.
- Temporal/politeness fragments cannot create contradictory or repetitive wording.

## Corpus oracle

| Assertion | Required evidence / command |
|---|---|
| Family count and minimum utterances | |
| Unique IDs and schemas | |
| Every applicable room/alias/target covered | |
| Expected action and ordered operations | |
| Expected values, colors, and unsupported result | |
| Clarification control kind and context | |
| Long-context target retention | |
| User messages within limit | |

## Real conversation replay

| Persisted failure / expected outcome | Required noun context | Required operation/result context | Focused regression | Generated replay family |
|---|---|---|---|---|

Replay the complete failed turn sequence. Verify that a new chat has no inherited context, reads never become actions, and clarification controls retain the exact target.

## Automatic improvement contract

| Gate | Required behavior |
|---|---|
| End detection | Explicit close/new-chat plus bounded idle expiry; content-hash deduplication |
| Supported scope | Deterministic capability classifier runs before any model request |
| Privacy | Sanitize secrets, URLs, backend IDs, service/history payloads; delete queued transcript after terminal result |
| Queue | One job at a time with bounded retries |
| Analysis | Copilot SDK returns strict met-needs / inferred-intent / generalized non-verbatim regression JSON |
| Frozen evidence | Host writes the regression fixture before implementation; model cannot edit it |
| Model tools | Bounded capability read/search; exact replacement only in the production parser; no test/corpus/policy/skill, shell, Git, network, HA, queue, version, publish, or deployment authority |
| Regression gate | Learned replay + full existing corpus + focused tests + type-check |
| Review | Separate Copilot diff review after deterministic validation |
| Publish | Patch version, required PR checks, merge, identical clean merged validation, exact health-version verification, health-checked rollback on failure |
| UI metadata | Instrumented model, UX version, MCP version, queue state, and five nontechnical improvement summaries |

## Gemini audit

- Balanced sample recipe:
- Families represented:
- Applicable rooms/targets represented:
- Semantic failures and IDs:
- Naturalness failures and IDs:
- Revisions made and rerun result:

## Skill learning log

| Discovery | General rule promoted to skill/template | Regression evidence |
|---|---|---|

## Validation

- [ ] Exact inventory/config evidence captured
- [ ] Pure intent/planner tests
- [ ] Mocked HA service/state/history tests
- [ ] Partial and total failure tests
- [ ] Structured response parser tests
- [ ] Multi-target controls expose only the shared capability intersection
- [ ] Custom values stage locally with no HA service call before explicit send
- [ ] Same-sheet Back preserves the owning response instance's draft and focus target
- [ ] Embedded-control lock is scoped to its owning response instance
- [ ] Repeated control in the same thread remains independently usable
- [ ] Same semantic control in a new chat remains usable
- [ ] 180-character boundary tests
- [ ] Exhaustive corpus oracle passes every generated example
- [ ] Corpus count, uniqueness, schema, room/target coverage, and message-length checks
- [ ] Balanced Gemini-via-Copilot semantics and naturalness audit completed
- [ ] Focused React/i18n/design/build checks
- [ ] Source-bound layout plan/run/manual review/verify when visible UX changes
- [ ] Inventory and capability-authoring skill/template updated with reusable lessons
- [ ] No live actuation, deployment, commit, or push without authorization
