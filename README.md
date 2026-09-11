# HASS React Dashboard

## Home Assistant deployment

The production build currently ships to two Home Assistant sidebar hosts:

- `/sfenton-react-dash/home` — the existing storage-mode Lovelace wrapper.
- `/sfenton-react-panel` — an embedded `panel_custom` host that keeps the React iframe outside Lovelace card rebuilds.

Both hosts use the same files under `/local/ha-sfenton-react-dash/`. Use `npm run deploy:both` for the SSH build/deploy/sync flow, or copy `dist/` over SMB and then run `npm run deploy:sync`. Include the chat history component/package installation below in either flow. Deployment sync also keeps the legacy `sfenton-react-app-card` resource on the repository-owned, versioned module instead of an out-of-band inline resource. The custom-panel registration is versioned in `home-assistant/packages/sfenton_react_panel.yaml`; changes to that package/bridge or the chat history component/package require an explicitly approved Home Assistant restart, unlike asset-only updates.

Both iframe hosts explicitly dispose the React root before replacing an app frame. Frame removal normally cleans up through non-BFCache `pagehide`; host `disconnectedCallback` is a best-effort fallback, and a newly mounted frame disposes any stale prior generation if the browser skipped teardown. Current lifecycle state is exposed on `window.top.__sfentonReactDashboardLifecycle`; the bounded primitive-only event history is stored as JSON in `window.top.__sfentonReactDashboardLifecycleHistory` for device diagnostics.

The install hook applies a fail-closed compatibility patch to `home-assistant-js-websocket@9.6.0`: it removes the exact `ready` callback that was registered, and embedded collections tear down synchronously before their iframe timer realm disappears.

The experimental custom panel keeps Home Assistant's native sidebar on desktop; mobile remains full-viewport. This avoids unsupported top-window styling while the two hosts are evaluated in parallel.

The production `wake_light` custom integration, config-flow prerequisites,
PBL lease contract, Master Bedroom target evidence, service API, sensor schema,
and local validation steps are documented in
[`docs/wake-light-integration.md`](docs/wake-light-integration.md).

### Home Assistant chat history

The dashboard hides conversations whose latest activity is older than 14 days,
but keeps their records in each authenticated user's Home Assistant frontend
store. The `sfenton_react_chat` package no longer schedules deletion. Its manual
purge service remains available only for a separately authorized cleanup.

For the preferred SMB flow, back up and copy
`home-assistant/custom_components/sfenton_react_chat/` to
`\\192.168.1.22\config\custom_components\sfenton_react_chat\`, and
`home-assistant/packages/sfenton_react_chat.yaml` to
`\\192.168.1.22\config\packages\sfenton_react_chat.yaml`. The SSH deployment
script stages these files with backups alongside the panel. Configuration-check
after staging; restore prior files on failure. When either chat component or
package changes, restart HA only with explicit approval. After restart, verify
the prior daily purge automation is absent. Never invoke the manual purge
service during verification without explicit deletion authorization.

**React assets, `deploy:sync`, and HMR do not remove a previously loaded purge
automation.** Preserve both dashboard hosts and their existing deployment and
cache-busting rules. See [Chat](docs/chat.md) and the
[installation/rollback checklist](home-assistant/custom_components/sfenton_react_chat/README.md)
for visibility, storage, and activation details.

## UX review and governance

Run the review workspace on the fixed local port:

```bash
npm run dev:review
```

Then open `http://127.0.0.1:5176/at-a-glance/overview`. See
`docs/ux/current-ux-contract.md`,
`.github/instructions/interaction-semantics.instructions.md`, and
`docs/ux/validation-matrix.md` before changing shared UX. The complete
Playwright spec corpus and responsive ownership map are documented in
`docs/ux/playwright-coverage.md`. Run `npm run test:e2e:fast` for the complete
mobile-project pass, or `npm run test:e2e:changed` while iterating on changed
test files. Run `npm run test:e2e:coverage` to detect inventory drift,
`npm run test:e2e:responsive` for the responsive release corpus, and
`npm run check` for the design, lint, unit, i18n, and build gates. The full
Playwright suite runs as four parallel shards in GitHub Actions.

## Autonomous Admin executor

The repository includes an explicit `autonomous-hass-admin-executor` skill and a canonical 13-phase roadmap at `docs/autonomous-admin-roadmap.md`. Each phase maps to one immutable Home Assistant item UID from `todo.groceries`.

The launcher fails closed unless routine coordination runs with
`gpt-5.6-sol`, `medium` reasoning effort, and `default` context. Sol
`max`/`long_context` is conditional on an evidence-bound trigger receipt for
`ha-physical-action-conflict`, `ha-credential-exposure-conflict`, or
`ha-release-rollback-or-host-conflict` receipt; it is not normal phase
residency. The launcher holds an exclusive repository run lock, runs one phase
per Copilot session, sends the phase report by SMTP, then calls the HA-owned
`script.complete_admin_todo_item` for accepted work. Home Assistant completes
the item without a phone notification and records the task UID in
`input_text.admin_todo_completion_receipt`; the runner requires both completion
and receipt before advancing. Rejected or blocked phases are emailed but remain
open.

```bash
npm run autonomous:admin:audit
npm run autonomous:admin:verify-hass
npm run autonomous:admin:sync-descriptions
npm run autonomous:admin:email:check
npm run autonomous:admin:run
```

`VITE_HA_URL` and `VITE_HA_TOKEN` are loaded from `.env.development`/`.env`. Email settings use the `HASS_AUTONOMY_EMAIL_*` variables documented in `.env.example`; for this workstation, the tooling also imports only `DAY_TRADER_EMAIL_*` values from `../day-trader-agent/.env` without copying or printing unrelated secrets. Override that fallback with `--email-env <path>`.

Runtime checkpoints, reports, and dry-run outbox files live under `.autonomous/` and are not committed. The runner never commits, pushes, or deploys phase changes.

The exclusive lock is `.autonomous/admin-run.lock/owner.json`. If a process is killed before cleanup, confirm the recorded PID is no longer running before removing that lock directory.

## Local recipe development

Recipe pages normally use `evershelf.recipe_query` through Home Assistant. When
HA has not installed that integration release yet, the Vite development server
falls back to its same-origin `EVERSHELF_DEV_URL` proxy. The browser never
receives an EverShelf API token; run an isolated updated EverShelf instance at
that URL. Production builds never use this fallback.

Recipe detail mutations use Home Assistant response services only:

- uncertain ingredients render as blank unchecked rows and open an inventory
  product picker without writing;
- explicit Back submits `assume_have`, while X/backdrop/Escape/swipe/hash close
  and tab navigation cancel without a write;
- product selection and exact-match rejection use the single atomic
  `evershelf.recipe_ingredient_decision` service with reusable idempotency keys;
- Cookidoo keeps official instructions external-only;
- “Open in Cookidoo” is separate from the default-off account-level “Add to My
  Week” date planner, which uses `evershelf.recipe_planner_add`.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
