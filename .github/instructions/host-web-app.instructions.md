---
description: "Use when implementing or operating LAN hosting for the React app, including port selection, dev/preview startup, backend wiring, and verification."
applyTo: ".github/skills/host-web-app/**,.github/instructions/host-web-app.instructions.md,.github/copilot-instructions.md,.github/reference/dashboard-contract.md"
---

# Host Web App

Use this instruction for repo-owned hosting tasks that expose the React app to
other devices on the LAN. It is read-only guidance for the host workflow and
does not authorize deployment, commits, or Home Assistant mutation.

## Required scope

- Host the **current requested worktree** only. Do not silently fall back to a
  different checkout or a clean copy.
- Prefer the real app backend, not `vite --mode test` or any mock-only server.
- Never print or commit secrets. `VITE_HA_TOKEN` must remain blank for the
  client-visible hosted app.
- Do not kill existing listeners unless you can prove ownership and the task
  explicitly requires cleanup.

## Runtime contract

1. Inspect the repo scripts, env files, and current listeners.
   Read env values programmatically and extract only the HA URL and token
   override; never print or expose env contents.
2. Confirm the current working tree identity and the active repo path before
   launching anything.
3. Start from port `5176` and select the first free port.
4. Prefer the Vite development server for LAN access so HMR/React Fast Refresh
   stays active. Use an attached async bash launch in the requested worktree,
   for example:
   `cd <requested-worktree> && VITE_HA_TOKEN='' npm run dev -- --host 0.0.0.0 --port <port> --strictPort`
   If the requested port is free, honor it; otherwise choose and report the
   next free port from `5176` upward.
5. Use production preview only when explicitly requested. If you do launch
   preview, note that it does not provide HMR. If the preview bundle is stale,
   mock-only, or credential-bearing, rebuild with the existing production
   build flow and launch with
   `VITE_HA_TOKEN='' npm run build` explicitly, with the HA URL separately
   configured. Blanking the token at preview launch cannot remove credentials
   already compiled into `dist/`, so do not serve an old credential-bearing
   build while rebuilding.
6. Verify the route HTML, referenced assets, actual listener, HMR behavior,
   and real backend wiring. Same-machine HTTP 200 is not proof that another
   LAN device can traverse the firewall, so do not claim remote verification
   or change the firewall, router, or tunnel.
7. Verify the browser still uses normal Home Assistant login/auth behavior; do
   not inject an existing privileged token.
8. Record the exact PID, shell/session id, cwd, and chosen port in session
   state.
9. Confirm feature-module source is served as non-HTML content from the
   requested worktree before treating the runtime as valid.

## Model pin for delegated execution

When the coordinator delegates hosting work to a task agent, it must use:

- model: `gpt-5.4-mini`
- reasoning effort: `low`
- context tier: `default`

This is a repository-level execution requirement for deterministic hosting
tasks. It does not imply automatic escalation to larger models. If the exact
hosted runtime cannot be verified, report the limitation instead of guessing.

## Verification

- Confirm the listener is bound to `0.0.0.0`.
- Confirm the app serves real assets and the current backend route.
- Record the exact PID, shell/session identifier, cwd, and port in session
  state.
- Return the final LAN URL and whether browser clients will still need a Home
  Assistant login.
