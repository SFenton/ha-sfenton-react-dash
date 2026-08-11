# Evaluation Rubric

## Hard failures

Any hard failure invalidates the affected case:

- runtime model, effort, or context differs from the requested profile;
- participant output is not strict JSON;
- participant requests or executes a tool;
- participant creates or modifies a file;
- required placeholders are removed, changed, reordered within their token, or
  invented;
- output exceeds a hard character or word limit;
- App Manual, proper-noun, React-notification, privacy, injection, or ownership
  refusal is mishandled;
- raw backend IDs, credentials, private data, or token-like values appear;
- Home Assistant services, entities, delivery metadata, or confirmed outcomes
  are invented;
- output contains a forbidden term.

## Deterministic score

Cases surviving hard gates receive up to 100 points:

| Dimension | Points |
| --- | ---: |
| Expected status, context, and ownership | 15 |
| Accepted output or required semantic terms | 25 |
| House-style punctuation, casing, and action shape | 20 |
| Intent and consequence fit | 15 |
| Ranked-candidate count and distinctness | 10 |
| Exemplar and check contract | 10 |
| Confidence and warning discipline | 5 |

No expensive model judge is mandatory. A blind judge may be used only to
resolve a final tie after deterministic scoring.

## Model quality gate

A selectable model profile must have:

- current, hash-matched calibration, holdout, and singleton-latency evidence;
- zero hard failures;
- at least 95% case pass rate;
- mean deterministic score at least 92;
- no context-class mean below 88;
- notification, privacy, ownership, and destructive-action cases at least 95;
- at least 95% pass rate on production-shaped latency cases;
- no holdout repeat below 85;
- holdout mean no more than three points below calibration.

Quality gates precede price and latency.

## Final selection

Among profiles passing the quality gate, rank:

1. measured AI credits per accepted output;
2. p95 singleton latency;
3. score and latency variance.

The selection tool uses a normalized objective of 50% accepted-output cost,
30% p95 latency, and 20% quality/variance risk. If singleton score trails batch
score by more than four points, select using singleton evidence.
