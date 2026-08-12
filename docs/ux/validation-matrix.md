# Current UX Validation Matrix

Validation protects the single current dashboard experience and its shared
Home Assistant behavior. No step here authorizes deployment or Home Assistant
mutation.

| Gate | Current UX requirement | Evidence |
| --- | --- | --- |
| Architecture | One React tree, visual system, route meaning, entity subscription path, optimistic state path, and service callback. | Source review and focused behavior tests. |
| Interaction semantics | Every interactive surface has the correct `ControlSemantics`; only modal and navigation actions use chevrons. | Primitive/component tests and design checker. |
| HA behavior | State/service matrices cover every displayed-state branch without duplicating HA-owned side effects. | Focused mocked HAKit tests; no live service call. |
| Visual system | Established materials, density, type, state treatment, safe areas, scrolling, and stable dimensions remain intact. | Same-viewport screenshots and computed-style/DOM evidence. |
| Interaction feedback | No press-only visual `:active` feedback; persistent dragging and state feedback remain. | Design checker, unit coverage, and touch/keyboard browser pass. |
| Accessibility | Names, roles, focus order, target size, checked/selected state, keyboard behavior, and unavailable state remain valid. | Unit/accessibility assertions plus browser pass. |
| Copy/i18n | Static visible copy stays catalog-backed with no stale keys. | `npm run i18n:check` and focused i18n tests when copy changes. |
| Static design rules | Baseline debt does not increase for raw colors, undefined `--rd-*`, direct disclosure imports, or visual `:active` rules. | `npm run design:check` and `npm run test:design`. |
| Unit tests | Changed primitives, semantics, service behavior, and modal lifecycle pass. | Smallest relevant Vitest selection, then repository checks when required. |
| E2E | Affected routes, modal opener families, navigation, and action exceptions retain behavior on mobile first. | Smallest relevant Playwright selection. |
| Release boundary | Validation performs no deployment, HA mutation, commit, or push without separate authorization. | Completion report states what was not performed. |

## Design baseline policy

`npm run design:sync` is prune-only: it may remove resolved debt but must reject
new or increased violations. `npm run design:refresh-baseline` is reserved for
an intentional scanner-rule or reviewed migration change. Review the complete
baseline diff; never use either command to hide a regression.

## Browser policy

Compare at a mobile viewport first, normally `393x852`, then wider layouts as
needed. Keep route, state, scroll position, and authentication conditions
equivalent. Use the existing authorized review environment; do not start,
stop, deploy, or mutate external systems unless the task separately permits
it. Report visual evidence as unverified when safe browser comparison is
unavailable.

## Existing failures

A pre-existing failure may be reported only with the exact command, test title,
project, failure signature, and evidence that the changed files cannot affect
it. Do not weaken assertions, delete coverage, refresh evidence blindly, or
broaden an allowlist to manufacture a pass.
