---
name: host-web-app
description: Start, run, serve, host, open, or preview the current React worktree for manual, browser, responsive, phone, tablet, or LAN validation. Use after user-visible dashboard work that needs operator review, even when the prompt only says "start the dev server" and does not mention LAN or 0.0.0.0. Bind to 0.0.0.0, pick the first free port from 5176 upward, use the real Home Assistant backend, and report the exact runtime details.
metadata:
  model: gpt-5.4-mini
  reasoning_effort: low
  context_tier: default
---

# Host Web App

Use this skill whenever the operator asks to start, run, serve, host, open, or
preview the React app or dev server. LAN-specific wording is not required.
Also use it before handing off user-visible dashboard or UX work when the
operator would reasonably validate the result manually on a browser, phone, or
tablet, unless the operator opted out of hosting.

Explicit `/host-web-app` invocation always wins. Do not replace this workflow
with a bare `npm run dev`, a loopback-only server, or an already-running
unverified listener. Automated unit, build, mock, and Playwright validation do
not by themselves require a LAN server unless manual review is also expected.

This skill covers runtime hosting only; it does not authorize deployment, Home
Assistant configuration changes, commits, or pushes.

## Hard requirements

- Host the **current requested worktree** only. Never substitute a different
  checkout, a clean clone, or an old build artifact.
- Use the real app backend. Do not start a mock-only or test-mode server.
- Keep `VITE_HA_TOKEN` blank for the client-visible app host. Never embed a
  production token in the bundle or logs.
- Bind to `0.0.0.0` and use strict port binding.
- Start checking from port `5176` and pick the first free port.
- If a race claims the chosen port, advance to the next free port instead of
  killing another process.
- Keep the server attached by default. Only detach when the operator
  explicitly asks for survival after the CLI session ends.
- Default to the Vite development server with HMR/React Fast Refresh for LAN
  previews. Use production preview only when the operator explicitly requests
  it, and note that preview mode does not provide HMR.

## Coordinator contract

The coordinator MUST delegate this work with an exact cheap model pin:

- model: `gpt-5.4-mini`
- reasoning effort: `low`
- context tier: `default`

Use `functions.task` with a fully specified request, for example:

```json
{
  "description": "Host LAN preview",
  "agent_type": "general-purpose",
  "name": "host-web-app",
  "model": "gpt-5.4-mini",
  "reasoning_effort": "low",
  "context_tier": "default",
  "mode": "sync",
  "prompt": "Inspect the current requested worktree, verify the real preview server or launch one if needed, and report the exact LAN URL, PID, shell id, cwd, backend wiring, and login requirement."
}
```

Metadata alone does not switch runtime. If a worker is already running with
the pinned profile, it must execute directly rather than recursively
delegating. If the validated pin is unavailable, report that fact explicitly
and do not silently fall back to a costlier model.

## Workflow

1. Inspect `package.json`, `vite.config.ts`, `.env`, `.env.development`, and
   current listeners before starting. Read env values programmatically and
   extract only the HA URL and token override; never print or expose env
   contents.
2. Confirm the current working tree identity and the active repo path.
3. Start the server on the first available port at or above `5176`.
4. Prefer the Vite development server for LAN hosting so HMR/React Fast
   Refresh stays active. Launch with the requested worktree and an attached
   async bash command, for example:
   `cd <requested-worktree> && VITE_HA_TOKEN='' npm run dev -- --host 0.0.0.0 --port <port> --strictPort`
   If a requested port is free, honor it; otherwise choose and report the next
   free port from `5176` upward.
5. Use production preview only when explicitly requested. If you do launch
   preview, note that it does not provide HMR. If the preview bundle is stale,
   mock-only, or credential-bearing, rebuild with the existing production
   build flow and relaunch with `VITE_HA_TOKEN='' npm run build` explicitly,
   with the HA URL separately configured. Blanking the token at preview launch
   cannot remove credentials already compiled into `dist/`, so do not serve an
   old credential-bearing build while rebuilding.
6. Verify the route HTML, referenced assets, actual listener, HMR behavior,
   and real backend wiring. Same-machine LAN HTTP 200 is not proof that
   another device can traverse the firewall, so do not claim remote
   verification or change the firewall, router, or tunnel.
7. Confirm browser authentication still follows normal Home Assistant login
   behavior; do not inject an existing privileged token.
8. Record the exact PID, shell/session id, cwd, and chosen port in session
   state.
9. Confirm feature-module source is served as non-HTML content from the
   requested worktree before treating the runtime as valid.

## Verification checklist

- Listener bound to `0.0.0.0`
- Chosen port reachable on the LAN
- Served HTML/assets come from the current worktree
- Real Home Assistant backend is configured
- No secrets were printed
