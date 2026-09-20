---
name: home-mcp-capability-authoring
description: Plans, implements, compares, grounds, and validates household device and integration capabilities for Home MCP.
---

# Home MCP capability authoring

Use this skill when the operator proposes a new household device/integration capability for `home-mcp`, asks to compare an implementation plan with their own, or asks to extend an existing Home MCP capability.

The skill automates evidence collection, contract design, corpus planning, implementation scaffolding, and targeted validation. It does not authorize live Home Assistant service calls, deployment, restart, commit, push, or release.

## Required inputs

- The operator’s example utterances, expected replies, ambiguity rules, and known safety boundaries.
- `home-mcp/HASS-INVENTORY.md` for the latest registry snapshot.
- Live read-only HA evidence when the snapshot may be stale: devices, entities, integration entries, group membership, supported features, and relevant history/configuration.
- Existing dashboard controls for the same device family, so the MCP and React UI share semantics rather than creating a second behavior layer.

## Workflow

1. **Classify the capability.** Name the device family, operations, queries, ambiguity states, partial failures, context anchors, and whether any action has physical/security consequences.
2. **Collect bounded evidence.** Resolve exact room/group/leaf entity IDs, friendly names, aliases, areas, supported modes, unavailable behavior, relevant HA-owned scripts/services, and integration status. Never guess IDs or capabilities.
3. **Write the state/service matrix.** Use [references/capability-template.md](references/capability-template.md). Every displayed state and user action needs one HA target/service, optimistic intent if any, and failure behavior. React never duplicates HA-owned cascades.
4. **Design one structured contract.** Extend the shared response envelope (`status`, `text`, `controls`, `context`, `data`) and a single MCP tool. Compound requests use ordered `operations`; do not create one tool per phrase.
5. **Design clarification controls.** Reuse current dashboard primitives. Compute allowed choices from the capability intersection of every selected target; never expose an option that only some targets support. Stage custom values locally, initialize them from bounded current-state reads when available, and perform no HA action until the user sends the continuation. Same-sheet detail pages keep their draft with the owning response instance. Controls embedded in assistant messages remain adjustable after use but may submit at most one continuation message. Persist the source control ID with that request so reopening history cannot resend it.
6. **Preserve context cheaply.** Return compact typed noun context (device family, room, selected entities/names) plus operation/result context needed by follow-ups (`lastAction`, bounded result state, and pagination boundary). Pass it on each request; do not replay hundreds of transcript messages. Persisted-record parsers must retain new optional fields while accepting older records.
7. **Build deterministic corpora.** Create generators, not committed giant static files. Target at least 10,000 unique English user utterances per interaction family unless the proposal specifies otherwise. Cover every applicable room, canonical name, operator-approved alias, leaf target, group, prefix/postfix phrasal form, compound operation, ambiguity, unsupported capability, partial/total failure, and 100-message reference-retention conversation. Order generator loops so a target-sized prefix is balanced across rooms and fixtures instead of exhausting one room first. Keep impossible combinations in explicit unsupported families rather than labeling them as successful tool calls. Bind examples to the actual Gemini tool schema and never treat generated expected output as runtime proof.
8. **Build an executable corpus oracle.** Run every generated example through the production parser/planner and compare action, room, ordered targets, values, colors, clarification controls, context, and expected unsupported/failure text. Assert family counts, unique IDs, room/fixture coverage, postfix forms, and the message limit. A schema/count check alone is insufficient. Preserve the validator as a repository command and focused test so future grammar changes rerun the same contract.
9. **Implement with one owner.** Keep entity maps in capability constants, pure parsing/planning separate from HA execution, and backend response formatting separate from React rendering. Treat room aliases that appear inside fixture names, trailing phrases, and overlapping aliases as parser collision cases. Segment compound commands only at conjunctions that introduce a new action; do not split merely because an action-like word appears inside a room alias. Observe HA service errors and distinguish total from partial success.
10. **Instance interactive controls.** Server control IDs describe semantics, not a globally unique rendered occurrence. Persist a response-instance-unique control ID or bind replay checks to both the source control ID and owning response. Verify that the original control remains locked, a repeated control in the same thread remains usable, and the same semantic control in a new chat remains usable.
11. **Validate with deterministic and Gemini evidence.** Treat failed persisted conversations as first-class evaluation evidence: replay each complete multi-turn path with its stored context and add it to focused regressions and generated replay families. Run pure planner tests, mocked HA execution tests, response-record parser tests, one-send control tests, 180-character boundary tests, the exhaustive corpus oracle, focused React tests, i18n/design checks, build, and the executable layout plan for affected chat states. Then create a balanced Gemini-via-Copilot audit sample spanning every family and every applicable room, not a hand-picked smoke list. Audit semantics and naturalness separately, record every failing example ID, revise the generator/parser, regenerate the sample, and rerun until accepted or explicitly blocked. The operator separately owns app testing with their configured Gemini key.
12. **Update inventory and this skill.** Mark an inventory item complete only when actions, queries, ambiguity, failures, context, corpus, and UI controls are all covered—not merely because generic state access exists. At the end of each capability phase, record reusable discoveries in this skill/template: parser collision classes, generator coverage rules, control-lifecycle invariants, validation commands, and Gemini defects. Do not leave learned rules only in task notes or a one-off test.
13. **Preserve the automatic improvement boundary.** Completed conversations may enter the improvement queue only after a deterministic supported-capability check. Sanitize raw evidence before persistence, process one job at a time, and delete queued transcript content after a terminal result. The Copilot SDK analysis must emit a strict intent/regression contract with a generalized, non-verbatim reproduction. A host-owned frozen replay fixture precedes implementation; the model cannot edit it. Implementation sessions receive bounded read/search access but exact-replacement authority only for the production capability parser—never tests, corpus generators, policies, skills, shell, Git, network, Home Assistant, deployment, queue, version, or release code. Require the learned replay, complete existing corpus, focused tests, changed-test policy, required PR checks, merged-commit revalidation, separate diff review, and exact versioned health check before an automatic publish.

## Lessons promoted from lights

These are now defaults for every capability unless verified device semantics require a narrower rule:

- **Coverage is configuration-shaped.** Generate against the canonical household map, including aliases and individual targets; a large count without complete configured-scope coverage is not comprehensive.
- **Target prefixes must stay balanced.** The first requested 10,000 examples must span applicable rooms/targets. Loop ordering is part of corpus correctness.
- **Unsupported behavior is training data.** Non-dimmable, non-color, unavailable, ambiguous, and partially successful cases need dedicated expected contracts.
- **Naturalness is a separate gate.** A semantically correct corpus can still contain synthetic repetition, conflicting suffixes, wrong spatial prepositions, missing head nouns, or overly technical verbs. Gemini audits must score both semantics and wording.
- **Generated corpora test production code.** Every example must round-trip through the real deterministic parser/planner; failures often reveal grammar precedence, overlapping aliases, or action segmentation bugs.
- **Explicit scope beats embedded names.** “Gym Light in the Hallway” targets Hallway, and trailing words such as “exterior right now” must not become an Exterior Right fixture. Prefer explicit `in/on/of <room>` scope and stop fixture matching at that boundary.
- **Values outrank generic change verbs.** “Change the lights to 30%” is brightness, not a missing-color clarification. Resolve exact values before generic change/color prompts.
- **Control replay belongs to a response instance.** Reused semantic control IDs must never lock a later assistant response or a new chat.
- **Model review is sampled; deterministic review is exhaustive.** Run the oracle over the complete corpus, then give Gemini a balanced, reproducible sample with family/room coverage and retain its exact defect IDs.
- **Noun context is insufficient.** “Which ones?”, “what about now?”, “before that?”, and bare “why?” require the prior operation and bounded result metadata, not only the room or fixture.
- **Real conversations are regression fixtures.** Persisted failures must become exact multi-turn tests and generated replay families; generated single turns cannot prove conversational closure.
- **Plural aggregate copy is semantic, not cosmetic.** Room-level subjects such as “Living Room lights” always take plural agreement (`are`); grouped state answers should combine same-state rooms naturally (`both` for two, `all` for three or more) and coordinate mixed groups without per-room article noise.
- **Command failures remain conversational.** A confirmed Home MCP failure is an answer with failure text and optional retry controls, not a transport error: preserve its conversation ID/context so the user can continue without an expiry or forced new chat.
- **Clarification controls preserve exact targets.** A fixture-level color or brightness question must encode that fixture in the control continuation rather than widening to its room.
- **Multi-target controls use capability intersection.** Derive the selectable mode from every target: full RGB is valid only when all targets support RGB; otherwise narrow to the shared temperature range or report unsupported. The canonical capability map, not React inference, owns this decision.
- **Custom controls stage before command.** Current state may initialize a picker through bounded read-only enrichment, but editing, Back navigation, and preview changes remain local. Only the explicit send action creates one continuation message; React never calls HA while the value is being composed.
- **Same-sheet drafts belong to response instances.** Keep custom-detail state in the mounted sheet owner and key it by the rendered response/control occurrence so Back preserves the exact draft without leaking it to repeated controls or new chats.
- **Whole-home reads never delegate.** Bounded aggregate questions such as rooms-on, counts, and lists must remain deterministic so a read cannot be misrepresented as an action.
- **Whole-home reads summarize before drilling down.** “Which rooms have lights on?” and “What lights are on?” first return configured room names. A following one- or multi-room reply lists only the active configured fixtures in those rooms and persists bounded per-room fixture context for safe next actions. Neither stage may fall through to generic HA entities, indicators, or decorative helpers.
- **Aggregate reads require complete intent and inventory shape.** Match only unscoped or explicit whole-home language; an unknown location must clarify rather than widen. Aggregate plans and learned fixtures include every configured room exactly once, in canonical order, with no narrowed targets or value payloads.
- **Routing provenance is evaluation evidence.** Persist an explicit server routing marker for each turn; never infer handling from semantic context that a delegated response may retain. Records without the marker fail safe as not handled. Ground SDK review in the canonical inventory, and classify old-client bypasses as requiring a refresh rather than `met-needs` or a model-authorized parser edit.
- **Release resumption retains provenance.** Before dropping sanitized conversation text, persist a non-sensitive routing receipt bound to the conversation hash. Every resumed merge or publish stage must require that receipt; missing legacy evidence fails closed instead of inheriting trust.
- **Learning scope is deterministic before model review.** Unsupported-device conversations never reach the Copilot SDK merely because a prior turn carried capability context.
- **Ended-chat delivery is idempotent.** Explicit close/new-chat submission and idle expiry may race; content hashing must collapse them to one queue job.
- **The model cannot authorize its own application.** Copilot may analyze and propose bounded capability edits, but host-owned fixtures, deterministic tests, a separate review, Git merge, and exact health verification remain independent gates.
- **Improvement history is user-facing release data.** Keep at most five patch versions with short nontechnical bullets; never expose raw prompts, entity IDs, tool traces, or failure logs in Chat Settings.
- **Merged validation failure rolls back source, not just deployment.** If the exact merged commit fails its bound gates, create and merge a checked revert before processing another improvement.
- **Queue receipts are bounded operational data.** Recover stale claims with the same attempt ceiling, retain terminal dedupe records for a finite window, and expose only classified errors to frontend users.

The lights reference implementation is `home-mcp/corpus/generate-lights.ts` plus `home-mcp/corpus/validate-lights.ts`; its exhaustive gate is:

```bash
npm run home-mcp:corpus:lights:validate -- --utterances-per-family 10000
```

New capabilities should add an analogous generator, oracle, focused test, and package command rather than weakening or overloading the lights validator.

## Plan comparison output

When the operator supplies their own proposal, return a compact comparison table:

| Area | Operator proposal | Skill-derived plan | Reconciliation |
|---|---|---|---|

Cover scope, entity semantics, service ownership, response language, controls, context, corpus, failures, tests, and release gates. Preserve operator decisions unless they conflict with verified HA behavior or repository safety.

## Non-negotiable boundaries

- Do not actuate live devices during discovery or validation unless separately authorized.
- Do not expose the administrative HA MCP or credentials to frontend chat.
- Do not claim recorder/logbook evidence proves causality.
- Do not use generic entity-name substring matching as the production room map.
- Do not allow an old embedded control to send twice.
- Do not commit or deploy generated corpora by default.
- Keep user messages at or below the configured chat limit.
- Keep both production dashboard hosts maintained; release requires the separate `release-dashboard` workflow and explicit authorization.
