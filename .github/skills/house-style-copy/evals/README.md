# House Style Copy Evals

This suite evaluates the `house-style-copy` contract without repository
mutation, Home Assistant access, network tools, or participant file writes.

## Layout

- `cases.public.json`: 42 calibration cases.
- `cases.holdout.json`: 18 anti-overfit cases.
- `candidates.json`: exact candidate profiles and pricing snapshot.
- `model-pin.json`: launcher-enforced profile. It is provisional until the
  benchmark passes.
- `plans/`: calibration, rule-tuning, frozen public qualification, holdout, and
  singleton-latency plans.
- `schemas/`: request, response, and case contracts.
- `rubric.md`: hard gates, quality threshold, and model-selection rule.
- `bin/`: static checks, isolated runner, scorer, summarizer, and pin selector.

## Static validation

Run before any model call:

```bash
node .github/skills/house-style-copy/evals/bin/static-check.mjs
```

The command validates all 60 cases, corpus records, context coverage, plans,
candidate ordering, pin shape, boundaries, and script contracts.

Every plan uses a 30-credit per-call safety cap because the Copilot CLI rejects
lower values. This is a ceiling, not expected spend; scoring records measured
or estimated usage for actual cost comparison.

## Calibration

```bash
node .github/skills/house-style-copy/evals/bin/run.mjs \
  --plan .github/skills/house-style-copy/evals/plans/calibration.json \
  --out artifacts/house-style-copy-evals/calibration-<run-id>

node .github/skills/house-style-copy/evals/bin/score.mjs \
  --run artifacts/house-style-copy-evals/calibration-<run-id>

node .github/skills/house-style-copy/evals/bin/summarize.mjs \
  --run artifacts/house-style-copy-evals/calibration-<run-id>
```

The runner performs one real no-tool availability preflight per profile and
fails closed on silent model substitution. Calibration, tuning, and holdout
plans pack multiple logical batches into one model invocation to reduce calls
without mixing cases inside a logical context. Every logical batch contains one
exact context and at most six cases. Singleton latency plans do not pack calls.

Projected model calls for the documented five-plan benchmark: **221**. This
planner-derived total includes availability preflights, every configured
candidate and repeat, packed launch units, and singleton controls.

## Rule tuning

Pass a small explicit candidate list:

```bash
node .github/skills/house-style-copy/evals/bin/run.mjs \
  --plan .github/skills/house-style-copy/evals/plans/rule-tuning.json \
  --models gpt-5.6-luna-low,gpt-5-mini-low \
  --out artifacts/house-style-copy-evals/rule-tuning-<run-id>
```

Only one prompt/rule-tuning rerun is permitted before holdout.

## Frozen public qualification

After tuning is frozen, run the final three candidates on the dedicated public
qualification plan. Rule-tuning output is never accepted as qualification
evidence.

```bash
node .github/skills/house-style-copy/evals/bin/run.mjs \
  --plan .github/skills/house-style-copy/evals/plans/qualification.json \
  --models gpt-5.6-luna-low,grok-4.5-low,gpt-5.6-terra-low \
  --out artifacts/house-style-copy-evals/qualification-<run-id>
```

## Holdout and latency

Run the top three through three independently shuffled holdout repeats:

```bash
node .github/skills/house-style-copy/evals/bin/run.mjs \
  --plan .github/skills/house-style-copy/evals/plans/holdout.json \
  --models <candidate-a>,<candidate-b>,<candidate-c> \
  --out artifacts/house-style-copy-evals/holdout-<run-id>
```

Run the top two through production-shaped singleton latency cases:

```bash
node .github/skills/house-style-copy/evals/bin/run.mjs \
  --plan .github/skills/house-style-copy/evals/plans/latency.json \
  --models <candidate-a>,<candidate-b> \
  --out artifacts/house-style-copy-evals/latency-<run-id>
```

If singleton score trails batch score by more than four points, model selection
uses singleton evidence.

## Selecting and writing the pin

```bash
node .github/skills/house-style-copy/evals/bin/select-model.mjs \
  --runs artifacts/house-style-copy-evals/qualification-<run-id>,artifacts/house-style-copy-evals/holdout-<run-id>,artifacts/house-style-copy-evals/latency-<run-id>
```

Add `--write-pin` only after reviewing the result. The selector never chooses
Auto and never admits a profile that fails the quality gate. Selection also
requires calibration, holdout, and singleton-latency runs from the current
skill, corpus, cases, plans, candidate list, and pricing snapshot; stale or
mixed-hash evidence fails closed.

`--pinned` runs fail while `model-pin.json` is provisional. The escape hatch
`--allow-provisional-pin` exists only for an explicit launcher test and must
not be used as release evidence.

## Latest qualification

The machine-readable result is
[`latest-results.json`](latest-results.json). It is excluded from the
execution hash so recording a completed benchmark does not invalidate the
evidence it describes. `model-pin.json` remains the launcher authority and
stays provisional whenever the latest result has no qualified profile.

## Reproducibility

Each artifact run records:

- Copilot CLI and git versions;
- exact launcher model, effort, and context plus runtime model-call evidence;
- prompt, skill, case, corpus, plan, and pricing hashes;
- strict JSON event output and parsed response;
- tool/write audits;
- timestamps and wall-clock latency;
- available usage/token/AI-credit fields;
- deterministic score and hard failures.

Artifacts remain under the gitignored
`artifacts/house-style-copy-evals/` directory. The runner passes
`--disallow-temp-dir` and does not use temporary directories.

Candidate token prices come from GitHub's official
[Models and pricing for GitHub Copilot](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)
table for the recorded `pricingAsOf` date.
