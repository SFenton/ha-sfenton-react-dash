# Design-system checker

The checker scans runtime files under `src/` and prevents growth in four
repository design debts:

- a raw CSS color literal outside the owned token definition files;
- a used but undefined `--rd-*` variable;
- a direct `ModalDisclosureIcon` import outside
  `src/components/core/SurfaceAccessory.tsx`;
- a `:active` rule that changes transform, opacity, background, filter, or
  border.

Tests, stories, `src/test/`, and `__tests__` are excluded because the rules
govern runtime source.

## Check mode

```bash
./node_modules/.bin/tsx scripts/design-system/check.ts --check
```

Omitting `--check` has the same behavior. The command exits nonzero when a
violation has a new identity or exceeds its per-record occurrence limit in
`baseline.json`. Paying down an existing record passes.

## Baseline write mode

```bash
./node_modules/.bin/tsx scripts/design-system/check.ts --write
git diff -- scripts/design-system/baseline.json
```

`--write` deterministically prunes the baseline to the current scan. Use it
only after cleanup; it rejects new or increased debt.

An explicit reviewed scanner or migration change may use:

```bash
./node_modules/.bin/tsx scripts/design-system/check.ts --refresh-baseline
git diff -- scripts/design-system/baseline.json
```

`--refresh-baseline` can absorb debt, so it requires review of the complete
baseline diff. It is not a repair command.

The package exposes `design:check`, `design:sync`,
`design:refresh-baseline`, and `test:design`.
