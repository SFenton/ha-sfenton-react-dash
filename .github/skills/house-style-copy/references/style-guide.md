# House Style

## Short copy

- Use Title Case for short labels, titles, tabs, chips, and statuses.
- Do not end short copy with a period.
- Prefer one clear noun phrase or a verb plus explicit object.
- Buttons and actions are verb-first: `Apply Filters`, `Start Area Clean`.
- Destructive actions name the object: `Delete Task`, not `Delete`.
- Do not use `Click Here`, `Submit`, `OK`, `More`, or similarly vague actions
  when a specific action fits.

## Prose

- Use sentence case and terminal punctuation.
- State the fact or effect first.
- Add a consequence, next action, or recovery only when useful.
- Errors say what failed and what the user can safely do next.
- Never blame the user.
- Do not expose implementation details, entity IDs, service names, or raw
  exception text in household copy.
- Do not claim that Home Assistant completed a change until confirmed state is
  available.

## Progress and punctuation

- Use Unicode ellipsis `…` only for genuine ongoing progress:
  `Loading Recipe Details…`.
- Do not use three periods for an ellipsis.
- Use `·` between a topic/location and a compact state/event.
- Use `•` between compact metrics.
- Use an en dash for numeric and time ranges.
- Avoid em dashes in compact UI copy.

## Forms and accessibility

- A placeholder supplements a visible or accessible label; it never replaces
  one.
- Form hints explain format, consequence, or selection behavior rather than
  restating the field label.
- Validation messages identify the field requirement and correction.
- Accessible names use action plus target and do not append the role:
  `Back to Alarms`, not `Back to Alarms button`.

## Empty, error, loading, and success

- Empty titles describe absence: `No Items Found`.
- Empty bodies may provide the next safe action.
- Errors remain factual and provide recovery when one exists.
- Loading labels identify the target.
- Success copy is used only for confirmed completion.

## Notifications

- Home Assistant owns notification delivery.
- Titles follow `<Topic/Location> · <State/Event>`.
- Bodies describe the event and the next action, if one is needed.
- Action labels are short and verb-first.
- Avoid `click here`; name the destination or action.
- Preserve Jinja placeholders exactly.
- Stable tags, groups, URLs, sounds, and delivery metadata are behavior, not
  copy, and must not be invented.

## Proper nouns and source text

- Preserve approved brands and fixed terms exactly.
- Do not restyle household names, live friendly names, task text, recipe text,
  or HA-mirrored proper nouns.
- Treat current source copy as evidence, not automatic authority. Corpus
  records marked `avoid` are negative examples.

## Plurals and state variants

- Use the exact `{{count}}` placeholder for plural families.
- Produce every requested `one`, `other`, or explicit zero/state variant.
- Keep variant keys semantically paired; do not encode the English number in
  the base key.
- Ranked variant candidates are a complete family, not interchangeable
  alternatives.
