# Structured Home MCP capability template

## Scope

- Device family and exact supported Home MCP tool:
- Operator goal and explicit exclusions:
- Physical/security consequences:
- HA integration and current runtime version:

## Inventory evidence

| Area / room | Group or leaf IDs | Supported features | HA owner / service | Live-state evidence |
|---|---|---|---|---|

## Input and output contract

| Structured argument / operation | Valid values and bounds | Target resolution | Response fields | Invalid or unavailable result |
|---|---|---|---|---|

Include explicit multi-target ordering and any supported state, history,
action, or status query. The server validates the whole request before
dispatch; unsupported targets never become whole-home fallbacks.

## State/service matrix

| Displayed state | Semantic | Request | HA target/service | Verification | Unavailable/error behavior |
|---|---|---|---|---|---|

Do not duplicate Home Assistant-owned cascading effects. A read has no service
side effects; a write distinguishes complete success, partial success, and
failure using the actual HA response.

## Regression evidence

- [ ] Exact inventory and config-entry ownership verified read-only.
- [ ] Authorized and unauthorized bearer tokens tested separately.
- [ ] Typed schema rejects missing, malformed, extra, and out-of-range fields.
- [ ] Every configured room and leaf target has positive and negative cases.
- [ ] Unknown aliases, overlaps, and unavailable states fail explicitly.
- [ ] Multi-target requests use only shared capabilities and preserve order.
- [ ] HA service calls and partial/total failures tested with mocked responses.
- [ ] `home_info`, `home_state`, `home_history`, and unrelated device tools
      remain available unless explicitly changed.
- [ ] Directly owned changed tests, `home-mcp:check`, changed-test policy,
      protected CI, and exact deployed health are recorded.

## Learning log

| Discovery | Reusable boundary | Exact regression test |
|---|---|---|
