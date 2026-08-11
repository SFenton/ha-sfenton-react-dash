# Context Classes

Use exactly one context class per requested string.

| Context | Purpose | Default shape |
| --- | --- | --- |
| `button` | Ordinary button label | Title Case, 1-3 words |
| `action` | Command label outside a conventional button | Verb-first, 1-4 words |
| `destructive-action` | Irreversible or cancelling command | Explicit verb and object |
| `chip` | Compact selectable or summary chip | Title Case, no period |
| `status` | Short current-state label | Title Case, no period |
| `tab` | Tab label | Title Case, 1-3 words |
| `section-title` | Section heading | Title Case, no period |
| `card-title` | Card or tile heading | Title Case, no period |
| `page-title` | Route/page heading | Title Case, no period |
| `modal-title` | Sheet/dialog heading | Title Case, no period |
| `modal-description` | Modal explanatory prose | Sentence case and punctuation |
| `modal-action` | Modal footer or in-body command | Verb-first |
| `description` | Longer explanatory product copy | Sentence case and punctuation |
| `help` | Hint, supporting instruction, or consequence | Sentence case and punctuation |
| `empty-title` | Empty-state heading | Title Case, no period |
| `empty-body` | Empty-state explanation or next action | Sentence case and punctuation |
| `error` | Failure plus safe recovery | Factual, non-blaming, punctuated |
| `loading` | Genuine ongoing progress | Action + target + Unicode ellipsis |
| `success` | Confirmed completed result | Factual and punctuated |
| `form-label` | Input/select/fieldset label | Title Case, concise |
| `form-placeholder` | Example or search affordance | Concise; never substitutes for label |
| `form-hint` | Format, consequence, or selection guidance | Sentence case and punctuation |
| `form-validation` | Correctable validation failure | Specific and non-blaming |
| `a11y` | Accessible name or description | Action + target; omit role name |
| `confirmation` | Consequence and confirm/cancel decision | Explicit effect and recovery |
| `separator` | Standalone visual punctuation | `·`, `•`, or en dash by context |
| `compound-metric` | Compact joined values | Stable order and preserved placeholders |
| `notification-title` | HA notification title | `<Topic/Location> · <State/Event>` |
| `notification-body` | HA notification message | Factual event plus next action |
| `notification-action` | HA notification action button | Verb-first, generally 1-3 words |

## Length bands

The deterministic retriever assigns bands from measured rendered text:

- `micro`: at most 20 characters and at most 3 words
- `short`: at most 60 characters and at most 10 words
- `long`: everything else

Retrieval never mixes `long` prose with `micro` strings. It may broaden from
`micro` to `short`, or from `short` to the nearest measured band, only after
exact-context and same-band candidates are exhausted. Notification contexts
never broaden outside their own notification context.
