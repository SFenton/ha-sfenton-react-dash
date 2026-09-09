# House Style Copy Evals

This suite evaluates the `house-style-copy` contract without repository
mutation, Home Assistant access, network tools, or participant file writes.

## Layout

- `cases.public.json`: 41 calibration cases.
- `cases.holdout.json`: 18 anti-overfit cases.
- `candidates.json`: exact candidate profiles and pricing snapshot.
- `../assets/corpus/qualified/current.json`: atomic pointer to the exact
  production and evaluation bundle.
- `../assets/corpus/qualified/<snapshot-id>.jsonl` and
  `<snapshot-id>.manifest.json`: hash-versioned corpus plus clean-input
  provenance.
- `runtime-routing.json`: current provisional default plus the trigger-gated
  critical adjudicator.
- `model-pin.json`: preserved historical validated max/long selection evidence;
  it is not the routine launcher profile.
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

The command validates all 59 cases, qualified corpus records and manifest,
live-corpus drift status, context coverage, plans,
candidate ordering, pin shape, boundaries, and script contracts.
It also guards source namespace distribution so camel/Pascal component names
cannot silently collapse nearly all retrieval evidence into `common`.

Every plan uses a 30-credit per-call safety cap because the Copilot CLI rejects
lower values. This is a ceiling, not expected spend; scoring records measured
or estimated usage for actual cost comparison.

## Qualified corpus lifecycle

Generation and every pin-producing evaluation use the exact pointer-selected
qualified snapshot; they never rebuild or silently fall back to live app copy.
Mandatory refusals are deterministic local results and are removed before
participant prompt construction. Ordinary source or catalog changes are
reported as live drift and do not invalidate a valid pin.

When new repository copy should become retrieval evidence, refresh explicitly:

```bash
node .github/skills/house-style-copy/scripts/snapshot-corpus.mjs
node .github/skills/house-style-copy/evals/bin/static-check.mjs
```

The refresh rejects dirty corpus input paths by default. It stages a complete
hash-named bundle, validates it, atomically renames `current.json`, and then
removes superseded bundles. `--allow-dirty` is for maintenance previews only;
restore and review clean inputs before release qualification.

If the snapshot changes, its corpus hash and the enclosing skill hash change.
Fresh qualification, holdout, latency, selection, and pin validation are then
mandatory. Do not manually change hashes in `model-pin.json`.

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

Projected model calls for the documented five-plan benchmark: **211**. This
planner-derived total includes availability preflights, every configured
candidate and repeat, model-bound packed launch units, and singleton controls.
Local mandatory refusals consume no model call.

## Rule tuning

Pass a small explicit candidate list:

```bash
node .github/skills/house-style-copy/evals/bin/run.mjs \
  --plan .github/skills/house-style-copy/evals/plans/rule-tuning.json \
  --models gpt-5.6-terra-low,gpt-5.6-sol-max-long \
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
  --models claude-sonnet-5-low,gpt-5.6-terra-low,gpt-5.6-sol-max-long \
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

Add `--write-pin` only after reviewing the result. It atomically stages
`model-pin.json` and `latest-results.json` through one rollback-protected
workflow, so both record the same winner, runs, date, and finalist metrics. The selector never chooses
Auto and never admits a profile that fails the quality gate. Selection also
requires qualification, holdout, and singleton-latency runs from the current
skill, corpus, cases, plans, candidate list, and pricing snapshot; stale or
mixed-hash evidence fails closed.

For the current exact finalist plans, run and score:

```bash
node .github/skills/house-style-copy/evals/bin/run.mjs \
  --plan .github/skills/house-style-copy/evals/plans/qualification.json \
  --models claude-sonnet-5-low,gpt-5.6-terra-low,gpt-5.6-sol-max-long \
  --out artifacts/house-style-copy-evals/qualification-<run-id>
node .github/skills/house-style-copy/evals/bin/score.mjs \
  --run artifacts/house-style-copy-evals/qualification-<run-id>

node .github/skills/house-style-copy/evals/bin/run.mjs \
  --plan .github/skills/house-style-copy/evals/plans/holdout.json \
  --models claude-sonnet-5-low,gpt-5.6-terra-low,gpt-5.6-sol-max-long \
  --out artifacts/house-style-copy-evals/holdout-<run-id>
node .github/skills/house-style-copy/evals/bin/score.mjs \
  --run artifacts/house-style-copy-evals/holdout-<run-id>

node .github/skills/house-style-copy/evals/bin/run.mjs \
  --plan .github/skills/house-style-copy/evals/plans/latency.json \
  --models gpt-5.6-terra-low,gpt-5.6-sol-max-long \
  --out artifacts/house-style-copy-evals/latency-<run-id>
node .github/skills/house-style-copy/evals/bin/score.mjs \
  --run artifacts/house-style-copy-evals/latency-<run-id>

node .github/skills/house-style-copy/evals/bin/select-model.mjs \
  --runs artifacts/house-style-copy-evals/qualification-<run-id>,artifacts/house-style-copy-evals/holdout-<run-id>,artifacts/house-style-copy-evals/latency-<run-id>
# Review the passing gates and winner, then repeat the same command with:
# --write-pin

node .github/skills/house-style-copy/scripts/check-pin.mjs \
  --model gpt-5.6-terra --effort low --context default
```

For conditional copy-safety adjudication, pass an exact
`copy-safety-conflict` trigger receipt and the historical max/long profile.
Routine generation never selects the historical pin.

## Latest qualification

The machine-readable historical result is
[`latest-results.json`](latest-results.json). It remains paired with
`model-pin.json` as evidence of the prior validated selection.
`runtime-routing.json` is the current launcher authority and explicitly makes
no new qualification claim for the measured non-max finalist.

## Reproducibility

Each artifact run records the qualified corpus verbatim and:

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

## Runtime launcher

`scripts/generate.mjs` resolves mandatory refusals locally. Only remaining
requests validate the current pin and qualified snapshot before launching the
exact pinned profile with mutation, shell, URL, MCP, remote, and
custom-instruction access disabled. This prevents private refusal input from
entering participant prompts while retaining the qualified profile for safe
copy requests.
