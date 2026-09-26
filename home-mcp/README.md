# Home MCP server

This is the narrow app-facing household adapter. It exposes MCP over JSON-RPC HTTP while the existing HA admin/debug MCP remains separate.

## Run locally

```bash
HOME_MCP_HA_URL=https://homeassistant.sfenton-server.com npm run home-mcp
```

The health endpoint is `GET /health`; the MCP endpoint is `POST /mcp`. Callers forward their current Home Assistant access token at runtime, so no HA credential is embedded in a frontend build or stored by this server. Home MCP validates that token with Home Assistant before every cached authorization window. HA remains the authorization and service owner.

Optional settings:

- `HOME_MCP_HOST` / `HOME_MCP_PORT`: bind address and port; the defaults are `127.0.0.1:8787`.
- `HOME_MCP_ALLOWED_ORIGINS`: comma-separated exact browser origins for a direct cross-origin deployment. Prefer a same-origin authenticated reverse proxy.
- `HOME_MCP_TLS_CERT` / `HOME_MCP_TLS_KEY`: enable HTTPS. Production requires the pinned certificate/key pair.

The authenticated `/api/sfenton_home_mcp` HA proxy remains available to Home
MCP clients. It pins `home-mcp-server.crt` and forwards the inherited token over
HTTPS; Home MCP forwards HA calls only to the configured certificate-validated
HTTPS HA URL. The administrative HA MCP remains separate.

## Tools

- `home_info`: read the MCP version and supported household capabilities through the authenticated proxy.
- `home_state`: bounded current-state reads for up to 50 entity IDs.
- `home_history`: recorder history for up to 20 entity IDs and at most seven days.
- `home_lights`: household room/group/fixture-aware light actions and queries. It supports ordered compound operations, on/off, exact or relative brightness, configured RGB/white-temperature colors, whole-home lists of configured lights that are on, current state, seven-day last-off history, cautious cause evidence, and Presence-Based Lighting status.

`home_lights` takes a structured light action and returns confirmed results
with optional typed clarification or retry controls. Home MCP no longer offers
free-text chat or calls Home Assistant's conversation agent.

## Retired completed-conversation feedback

This server no longer exposes `home_chat`, records chat turns, queues completed
conversations, or analyzes them for automatic changes to light handling. The
`home_chat_end` and `home_chat_review` feedback tools are gone; `home_info`
remains an authenticated version/capability check. Legacy
`HOME_MCP_IMPROVEMENT_*` and `HOME_MCP_AUTO_PUBLISH` settings have no effect on
this server.

The previously installed `home-mcp-improver.path`, `.timer`, and `.service` are
host-owned and can continue running an older managed clone independently of
this source. The release owner must stop and disable the path/timer, check for
an active worker and queued jobs, and decide how to retain the queue data
before treating the live automation as retired. Do not delete the persisted
data as part of source cleanup.

The separate `npm run home-mcp:publish` command remains available for an
explicitly authorized, restart-aware deployment of the general Home MCP
service; it is not a feedback worker or an automatic publishing trigger.

## Typed light capability

`lights-config.ts` is the reviewed household room, group, fixture, alias, PBL,
dimming, and color-capability map. `light-skill.ts` validates structured tool
arguments against it; `app.ts` checks executable plans again and calls Home
Assistant for live state and service effects. The focused light and app tests
cover supported actions, unauthorized or unconfigured targets, whole-home
reads, partial failures, and unavailable Home Assistant evidence.

## Host deployment and lifecycle

The production container definition is deployed at `/home/sfenton/Docker/home-mcp/docker-compose.yml`. The current Compose template still mounts the retired queue's `./data` bind and sets legacy improvement flags; update that deployment configuration separately without deleting stored data. The container root remains read-only. The pinned private key lives under `/home/sfenton/Docker/home-mcp/tls` and is never committed. The host's `homelab-orchestrator.service` starts the `home-mcp` Compose project before starting the `homeassistant` libvirt VM, and stops the VM before stopping Home MCP during shutdown. The service listens with HTTPS on `192.168.1.155:8787` and has an internal Docker healthcheck on `/health`.

Home MCP clients reach the container through Home Assistant's authenticated `/api/sfenton_home_mcp` view. Direct LAN health validation must use the committed CA certificate; do not expose port `8787` outside the trusted LAN.
