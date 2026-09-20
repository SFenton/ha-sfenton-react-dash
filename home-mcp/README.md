# Home MCP server

This is the narrow app-facing household adapter. It exposes MCP over JSON-RPC HTTP while the existing HA admin/debug MCP remains separate.

## Run locally

```bash
HOME_MCP_HA_URL=https://homeassistant.sfenton-server.com npm run home-mcp
```

The health endpoint is `GET /health`; the MCP endpoint is `POST /mcp`. Browser requests forward the current inherited Home Assistant access token at runtime, so no HA credential is embedded in the React build or stored by this server. Home MCP validates that token with Home Assistant before every cached authorization window and derives the stable HA user ID from that validation. HA remains the authorization and service owner.

Optional settings:

- `HOME_MCP_AGENT_ID`: select a specific HA conversation agent.
- `HOME_MCP_CHAT_MODEL`: the instrumented model name shown in Chat Settings.
- `HOME_MCP_HOST` / `HOME_MCP_PORT`: bind address and port; the defaults are `127.0.0.1:8787`.
- `HOME_MCP_ALLOWED_ORIGINS`: comma-separated exact browser origins for a direct cross-origin deployment. Prefer a same-origin authenticated reverse proxy.
- `HOME_MCP_TLS_CERT` / `HOME_MCP_TLS_KEY`: enable HTTPS. Production requires the pinned certificate/key pair.
- `HOME_MCP_IMPROVEMENT_DATA_DIR`: persistent queue path shared with the host improvement worker.
- `HOME_MCP_IMPROVEMENT_ENABLED=true`: record and queue supported light conversations.
- `HOME_MCP_AUTO_PUBLISH=true`: report that validated changed candidates publish automatically.

Enable the React chat adapter in local development with:

```text
VITE_HOME_MCP_ENABLED=true
VITE_HOME_MCP_URL=/__home-mcp
HOME_MCP_DEV_URL=http://127.0.0.1:8787
```

Vite proxies `/__home-mcp` to `/mcp`. Production uses `/api/sfenton_home_mcp`, registered by the authenticated `sfenton_home_mcp_proxy` HA integration, only when the build explicitly sets `VITE_HOME_MCP_ENABLED=true`. The first rollout stages and restarts the proxy before enabling that build flag. The proxy pins `home-mcp-server.crt` and forwards the inherited token over HTTPS; Home MCP forwards HA calls only to the configured certificate-validated HTTPS HA URL. The administrative HA MCP remains separate.

## Tools

- `home_chat`: query or control the home through the configured HA conversation agent. React chat uses this tool.
- `home_chat_end`: mark a completed dashboard chat for queued improvement review.
- `home_chat_review`: enqueue a retained completed chat during bounded history backfill.
- `home_info`: read the configured model, MCP version, queue state, and five latest improvements.
- `home_state`: bounded current-state reads for up to 50 entity IDs.
- `home_history`: recorder history for up to 20 entity IDs and at most seven days.
- `home_lights`: household room/group/fixture-aware light actions and queries. It supports ordered compound operations, on/off, exact or relative brightness, configured RGB/white-temperature colors, whole-home room summaries with one- or multi-room fixture follow-ups, current state, seven-day history, cautious cause evidence, and Presence-Based Lighting status.

`home_chat` recognizes supported light requests before falling back to the configured Gemini conversation agent. Light responses use a structured envelope containing `text`, optional embedded `controls`, compact semantic `context`, and diagnostic `data`. The React chat persists the context and source control ID. This preserves named room/fixture references across long conversations without replaying the transcript and prevents an old embedded control from submitting twice.

User chat messages are limited to 180 characters at both the React and MCP boundaries.

## Automatic light-conversation improvement

Home MCP stores only sanitized supported-light evidence. Raw Home Assistant
tokens, entity IDs, URLs, service data, history payloads, and diagnostic data
are not written to the queue. A deterministic scope check rejects conversations
outside the currently supported lights capability before the Copilot SDK is
called.

Each Home MCP chat response carries an explicit routing marker, and each
retained turn records whether it was actually handled by Home MCP. Semantic
light context is not routing evidence; older records without the marker default
to not handled. The SDK receives that provenance plus the configured
room/fixture inventory. A supported turn from an older client that bypassed
Home MCP is classified as requiring a client refresh rather than being accepted
as a successful capability response or used to authorize a parser edit. Before
the transcript is removed from an improvement job, the worker persists a
conversation-hash-bound routing receipt; resumed merge or publish stages fail
closed when that receipt is absent or invalid.

Completed chats enter the queue when the user starts a new chat or closes the
modal. The server also queues a completed thread after the configured quiet
period, so a browser close does not lose the improvement opportunity. Content
hashes make repeated close, history backfill, and multi-device submission
idempotent.

The host worker processes one job at a time:

1. Copilot SDK evaluates whether the conversation met the user's needs and
   returns a strict intent/regression contract.
2. A frozen regression fixture is written by the host, not the model.
3. Copilot receives only bounded read/search tools plus exact replacement
   authority for `home-mcp/light-skill.ts`.
   Shell, Git, network, Home Assistant, deployment, and unrestricted filesystem
   tools are unavailable. Tests, corpus generators, policy, skills, versioning,
   release, and deployment files remain host-owned and read-only.
4. The candidate must pass the learned conversation fixtures, focused Home MCP
   tests, TypeScript, and the complete 10,000-utterance-per-family corpus.
5. A separate Copilot review must approve the validated diff.
6. Only then may the host bump the patch version and create an
   `auto/home-mcp-improvement-*` pull request. Required GitHub checks must pass
   before merge; the exact merged commit reruns the same gates before publish.

Failed jobs retry twice with a five-minute delay, still serially. Stale
processing claims recover after a worker crash. Analysis, merged-commit, and
published-version receipts make retries resume from the last durable stage
instead of creating duplicate PRs or releases. Terminal results retain only
hashes, status, version, and nontechnical summaries; the queued transcript is
removed.

Install the host queue worker after the merged repository is available:

```bash
npm run home-mcp:improvements:install
```

The installer creates a dedicated managed clone, verifies/provisions the
private half of the pinned TLS certificate, installs a user-level systemd
path/timer worker, and defaults unattended publishing off. Set
`HOME_MCP_AUTO_PUBLISH=true` explicitly for this operator-approved installation.
The production
publisher builds from a versioned source directory under
`/home/sfenton/Docker/home-mcp`, switches the source symlink atomically, starts
the container, verifies the exact `/health` version, and restores the prior
source and Compose file if the new container does not become healthy.

To enqueue up to ten recent retained chats after first installation:

```bash
npm run home-mcp:improvements:backfill -- --limit 10
```

The server performs the same light-only classification and deduplication for
history backfill as for newly completed chats.

## Gemini grounding and corpus

- `lights-config.ts` is the reviewed household room, group, fixture, alias, PBL, dimming, and color-capability map.
- `corpus/GEMINI-LIGHTS-GROUNDING.md` defines the Gemini interpretation and response contract.
- `corpus/generate-lights.ts` deterministically generates the training/evaluation JSONL rather than committing a large static corpus.

Generate at least 10,000 unique user utterances per interaction family with:

```bash
npm run home-mcp:corpus:lights -- \
  --out artifacts/home-mcp/lights-corpus.jsonl \
  --utterances-per-family 10000
```

The generated corpus covers 35 interaction families: prefix and postfix room/fixture on/off phrasing, aliases across every applicable room, exact and relative brightness, unsupported brightness, same-value and “respectively” multi-light brightness, supported/unsupported color, room and whole-home state/history/reason/PBL queries, one- and multi-room whole-home detail follow-ups, ambiguity controls, compound rooms, and reference retention after 100 intervening messages. The room-detail family requires 10,000 distinct user phrasings with balanced one-, two-, and three-room coverage. At the 10,000-utterance validation setting, the corpus contains 360,098 user utterances across 315,099 examples.

Validate every generated example against the deterministic light parser/planner, including expected actions, rooms, fixtures, brightness, colors, clarification controls, unsupported responses, room coverage, unique IDs, and the 180-character limit:

```bash
npm run home-mcp:corpus:lights:validate -- --utterances-per-family 10000
```

Validate every learned real-conversation fixture with:

```bash
npm run home-mcp:regressions:validate
```

Use `.github/skills/home-mcp-capability-authoring/SKILL.md` when planning the next device family. The skill turns operator examples plus live read-only inventory evidence into an intent taxonomy, state/service matrix, response/control contract, deterministic corpus families, implementation structure, and validation checklist.

During development, test representative utterances against Gemini through Copilot and record semantic mismatches as parser/grounding regressions. The operator separately tests the dashboard conversation path with their configured Gemini API key; repository automation must not read, print, or persist that key.

These tools establish the tailored MCP capability surface without exposing the administrative HA MCP to the app.

## Host deployment and lifecycle

The production container definition is deployed at `/home/sfenton/Docker/home-mcp/docker-compose.yml`. Its persistent `./data` bind owns the conversation queue while the container root remains read-only. The pinned private key lives under `/home/sfenton/Docker/home-mcp/tls` and is never committed. The host's `homelab-orchestrator.service` starts the `home-mcp` Compose project before starting the `homeassistant` libvirt VM, and stops the VM before stopping Home MCP during shutdown. The service listens with HTTPS on `192.168.1.155:8787` and has an internal Docker healthcheck on `/health`.

The dashboard reaches the container through Home Assistant's authenticated `/api/sfenton_home_mcp` view. Direct LAN health validation must use the committed CA certificate; do not expose port `8787` outside the trusted LAN.
