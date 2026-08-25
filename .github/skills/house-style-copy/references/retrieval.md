# Deterministic Retrieval

## Production authority

Runtime generation, default retrieval, qualification, holdout, latency, and
selection follow `assets/corpus/qualified/current.json` to one complete,
hash-versioned JSONL/manifest bundle. The pointer, target names, manifest,
record count, corpus hash, deterministic source-input/status hashes, and bundle
inventory are validated. Runtime never rebuilds or silently falls back to the
live app corpus.

`buildCorpus(root)` remains the live source/catalog builder for maintenance.
Use `scripts/retrieve.mjs --live` to preview live retrieval without changing
production authority. Ordinary app copy and source changes therefore appear as
live drift but do not invalidate a qualified pin.

Refresh authority deliberately with:

```bash
node .github/skills/house-style-copy/scripts/snapshot-corpus.mjs
```

Refresh rejects dirty `src/**`, i18n inventory/catalog, curated, or notification
inputs by default. It stages and validates hash-named files before atomically
renaming the current pointer, so interruption before pointer publication leaves
the old authority valid. Superseded and staged files are removed deterministically.
`--allow-dirty` is maintenance-only and cannot produce release-qualified
evidence without restoring and reviewing clean captured inputs.

A changed snapshot changes both corpus and skill hashes and requires fresh
qualification, holdout, latency, model selection, and pin validation. Never
copy a live hash into `model-pin.json` or edit pin hashes manually.

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

1. Exclude `restyle: false` records for rewrite/create requests.
2. Notification contexts keep only the identical notification context.
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

Source-derived namespaces tokenize camelCase, PascalCase, acronym-to-word, and
letter/number boundaries before lowercased whole-token matching. Component
paths such as `VacuumCard.tsx` and `HumidifierModalContent.tsx` therefore keep
their domain namespace instead of collapsing into `common`.

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
