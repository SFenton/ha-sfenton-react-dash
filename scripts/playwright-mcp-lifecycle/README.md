# Playwright MCP lifecycle proxy

The proxy keeps Playwright tools registered with Copilot while starting the
real `@playwright/mcp` process only when a browser tool is called.

- `tools/list` uses a cached schema and does not start Playwright.
- `browser_close` stops the backend after active calls finish.
- Ten minutes without a browser tool call stops the backend.
- The next browser call transparently starts a fresh backend.
- Closing Copilot closes every proxy-owned backend and browser process.

Install or update it from the repository root:

```bash
npm run playwright:mcp:install
```

The installer pins the MCP packages, preserves the existing Playwright command
arguments, adds `--no-sandbox` when needed on this host, refreshes the tool
schema cache, backs up `~/.copilot/mcp-config.json`, and activates the user-level
proxy. Existing Copilot sessions must be restarted to load the new command.

Set `PLAYWRIGHT_MCP_IDLE_MS` on the MCP entry to override the default 600,000ms
idle timeout.
