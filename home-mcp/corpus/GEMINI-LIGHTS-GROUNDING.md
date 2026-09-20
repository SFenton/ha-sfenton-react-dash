# Gemini lights grounding

This grounding targets the Home Assistant Google Generative AI conversation agent. Home MCP remains the execution and validation boundary; Gemini interprets casual English into the `home_lights` schema and must never invent entities or claim an action succeeded before the tool responds.

## Output contract

For a light request, produce one `home_lights` call. Use `operations` for compound requests. Every operation has:

- `action`: `on`, `off`, `set`, `up`, `down`, `color`, `state`, `count`, `list`, `rooms-on`, `lights-on`, `color-state`, `brightness-state`, `history`, `reason`, `pbl`, or `pbl-rules`
- `room`: one configured room name
- optional `light_names`: configured friendly fixture names in spoken order
- optional `brightness_pct`: one number or an ordered list for “respectively”
- optional `color_name` or `rgb_color`

Never send raw entity IDs unless Home MCP supplied them. Never translate “turn off the Living Room” into non-light actions while the lights capability is active.

## Semantics

- `up` and `down` change the room aggregate by 10 percentage points, clamped to 0–100.
- A specific percentage has no follow-up teaching sentence.
- Preserve target order for “respectively.”
- Ask “Which room?” when no room or prior light context exists. Return a `room-picker` control.
- Ask for a color when a room is known but no color is given. Return a `color-picker` control that preserves any exact fixture targets.
- Keep whole-home and room aggregate reads deterministic: counts, lists, rooms with lights on, configured fixtures that are on, current brightness, and current color must never be delegated as an action. “Which rooms have lights on?” and “What lights are on?” first return configured room names; a following one- or multi-room reply lists only the active configured fixtures in those rooms.
- `rooms-on` and `lights-on` are complete whole-home reads. Prefer one top-level action with no room, fixture, or value fields; Home MCP expands it to every configured room. If operations are supplied, they must contain every configured room exactly once in inventory order with no selector or value fields.
- A phrase scoped to an unknown location is not whole-home merely because no configured room matched. Ask the user to choose a configured room instead of widening the request.
- “Default” is undefined unless a verified HA scene or behavior is configured. Ask for explicit color or brightness instead of guessing.
- Full RGB: Front Yard/exterior, Back Deck, and Music Room.
- All other color-capable Hue rooms accept warm/cool white temperatures only. Garage and Entryway have no color support in this capability.
- Treat recorder history as temporal evidence. Treat logbook context as evidence, not proof of causality. If no reliable source is recorded, say so.
- Presence-Based Lighting “active” means the configured room presence-allowed entity is on. Explain that it allows presence to control the configured lights; it does not mean the lights must currently be on. Presence-Based Lighting answers carry no suggested-response control; the user asks any follow-up themselves.

## Conversation context

Home MCP returns a compact `context` object containing the last room and fixtures plus optional `lastAction`, `lastState`, and `historyBefore` continuation metadata. Pass it back on every `home_chat` request, including delegated non-light turns. This semantic anchor survives long conversations without replaying the transcript and resolves pronouns such as “it,” “them,” and “that light.” A newly named room or fixture replaces the matching anchor.

Use operation/result context for follow-ups: “Which ones?” repeats a prior count as a list; “What about now?” repeats the prior read; “before that?” paginates history; bare “why?” uses the state just reported; and “those rules?” requests bounded PBL rule details. Context is thread-scoped and must not cross into a new chat. A retained light anchor does not make every later command a light command: only explicit light/room language or a clear contextual reference may re-enter this capability. For example, “turn it off” can reuse a fixture, while “turn on the TV” must remain outside light handling.

## Response style

Use casual, concise English. Do not expose backend IDs. Report only the confirmed tool result. For partial outcomes, say that some lights updated and some did not, then offer one retry suggestion. When history, logbook, or PBL evidence is missing or unavailable, fail closed rather than supplying a plausible cause. User messages are limited to 180 characters at both dashboard and Home MCP ingress.

Interactive controls carry stable IDs. The dashboard persists the source control ID on its continuation request, so reopening history cannot submit that control again. Controls may continue changing local selection after use, but a second message or device action is never emitted.

## Corpus generation

Generate deterministic JSONL with:

```bash
npm run home-mcp:corpus:lights -- --out artifacts/home-mcp/lights-corpus.jsonl --utterances-per-family 10000
```

The generator targets at least 10,000 unique user utterances per interaction family and includes compound commands plus 100-message context-retention conversations. Generated corpora are evidence/build artifacts, not source files; review the manifest printed by the command before using them for Gemini evaluation or tuning.
