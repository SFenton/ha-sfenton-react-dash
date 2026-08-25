# HASS React Dashboard

## Home Assistant deployment

The production build currently ships to two Home Assistant sidebar hosts:

- `/sfenton-react-dash/home` — the existing storage-mode Lovelace wrapper.
- `/sfenton-react-panel` — an embedded `panel_custom` host that keeps the React iframe outside Lovelace card rebuilds.

Both hosts use the same files under `/local/ha-sfenton-react-dash/`. Use `npm run deploy:both` for the SSH build/deploy/sync flow, or copy `dist/` over SMB and then run `npm run deploy:sync`. The custom-panel registration is versioned in `home-assistant/packages/sfenton_react_panel.yaml`; Home Assistant only needs a restart when that package or its bridge version changes.

The experimental custom panel keeps Home Assistant's native sidebar on desktop; mobile remains full-viewport. This avoids unsupported top-window styling while the two hosts are evaluated in parallel.

## UX review and governance

Run the review workspace on the fixed local port:

```bash
npm run dev:review
```

Then open `http://127.0.0.1:5176/at-a-glance/overview`. See
`docs/ux/current-ux-contract.md`,
`.github/instructions/interaction-semantics.instructions.md`, and
`docs/ux/validation-matrix.md` before changing shared UX. Run `npm run check`
for the design, lint, unit, i18n, and build gates.

## Autonomous Admin executor

The repository includes an explicit `autonomous-hass-admin-executor` skill and a canonical 13-phase roadmap at `docs/autonomous-admin-roadmap.md`. Each phase maps to one immutable Home Assistant item UID from `todo.groceries`.

The launcher fails closed unless Copilot runs with `gpt-5.6-sol`, `max` reasoning effort, and `long_context`. It holds an exclusive repository run lock, runs one phase per Copilot session, sends the phase report by SMTP, then calls the HA-owned `script.complete_admin_todo_item` for accepted work. Home Assistant completes the item without a phone notification and records the task UID in `input_text.admin_todo_completion_receipt`; the runner requires both completion and receipt before advancing. Rejected or blocked phases are emailed but remain open.

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
