---
name: home-mcp-capability-authoring
description: Plans, implements, compares, grounds, and validates household device and integration capabilities for Home MCP.
---

# Home MCP capability authoring

Use when the operator proposes or changes a **structured** Home MCP household
device capability. The React dashboard Chat, `home_chat` endpoint, free-text
Gemini parser/corpus, and automatic conversation feedback worker have been
retired. Do not restore them as part of a device capability. This skill does
not authorize live device actions, repository publication, deployment, or
Home Assistant restart.

## Evidence and contract

1. Read `home-mcp/HASS-INVENTORY.md`, the relevant device integration and
   dashboard behavior contracts, and the current `home-mcp/app.ts` tool schema.
   Refresh stale inventory with read-only Home Assistant device, entity,
   history, and configuration queries. Never guess entity IDs or supported
   features from names alone.
2. Classify exact structured tool arguments, outputs, unavailable states,
   ambiguity, partial/total failure, and physical or security consequences.
   Use [the capability template](references/capability-template.md) to record
   each displayed state, command, HA target/service, and safe failure.
3. Keep the existing bearer-token validation and one Home Assistant behavior
   layer. The server derives targets from trusted configuration and validates
   every requested entity, room, mode, and value before making a service call.
   Use one ordered operation list for compound light commands instead of an
   unbounded free-text interpreter. Preserve `home_info`, `home_state`,
   `home_history`, and `home_lights` unless the operator explicitly changes
   their ownership.
4. Put room/fixture aliases and supported ranges in typed capability
   configuration. Compute multi-target choices from the intersection of
   every target's capabilities. Unknown, stale, ambiguous, or unavailable
   targets fail explicitly; do not broaden to all-home actions or report
   success from an unverified HA service result.
5. Add genuine directly owned tests for schema validation, authorization,
   safe target resolution, read-only queries, exact service calls, unavailable
   states, partial/total failures, and tool discovery. Run the focused tests,
   `npm run home-mcp:check`, `npm run test:change-policy`, and the applicable
   protected PR checks. Do not reinstate a deleted conversation corpus,
   automatic analyzer, queue worker, or Gemini audit as a substitute.
6. Update the inventory and this template after each accepted capability
   phase with the reusable behavior boundary and regression evidence. Keep
   the manual `home-mcp:publish` path independent of automatic feedback.

When comparing an operator proposal, report scope, verified HA semantics,
tool schema, failure behavior, test coverage, and release dependencies. Do
not treat a passing mock as proof of a live device action or a production
release.

## Non-negotiable boundaries

- Do not actuate devices during discovery or validation without specific
  authorization. Read current state before any separately approved mutation.
- Never expose administrative HA MCP credentials through the dashboard or
  treat arbitrary user text as a service name, entity ID, or permission grant.
- Preserve both dashboard hosts and the authenticated Home MCP proxy. Runtime
  changes require the repository's protected release and health verification.
- No chat-history purge, automatic learning, or conversation-data deletion
  follows from a device capability change.
