# Deterministic Retrieval

## Corpus record

Every record contains:

- stable `id`
- `text`
- `contextClass`
- measured `band`
- `ownership`
- `quality`: `canonical`, `current`, or `avoid`
- exact `placeholders`
- normalized `intentTags`
- `namespace`
- `surface`
- `provenance`

Optional records may set `restyle: false`. They remain in the bounded corpus
for census/provenance purposes but are never returned as generation, rewrite,
audit, or variant exemplars.

## Ranking

Filter before scoring:

1. Exclude App Manual provenance.
2. Exclude `restyle: false` records for rewrite/create requests.
3. Notification contexts keep only the identical notification context.
4. Positive examples use `canonical` or `current`; negative examples use
   `avoid`.
5. Prefer the same measured length band. Never mix `long` and `micro`.

Score remaining records:

- exact context: 60
- exact band: 15
- exact namespace: 8
- exact surface: 7
- shared intent tags: up to 5
- identical placeholder shape: 5

Tie-break by:

1. higher score;
2. `canonical` before `current`;
3. smaller absolute character-length difference;
4. stable record ID.

Return no more than five positive and two negative examples. Deduplicate exact
text. Retrieval is deterministic and uses no network, embedding service, or
model call.

## Broadening

When exact context has no positive records:

- short controls may broaden only to a documented sibling short-control
  context;
- prose may broaden only to a sibling prose context in the same band;
- notification contexts do not broaden;
- cross-ownership broadening is forbidden.

If no safe examples remain, return an empty exemplar list and lower
confidence. Do not scan or paste unrelated corpus content.
