# Request And Response Contract

## Normalized request

```json
{
  "mode": "create",
  "contextClass": "button",
  "surface": "Recipe filters",
  "intent": "Apply the current filter draft",
  "ownership": "react",
  "maxCharacters": 20,
  "maxWords": 3,
  "requiredPlaceholders": [],
  "forbiddenTerms": ["Submit"],
  "stateMatrix": [],
  "outputCount": 1
}
```

Rules:

- `maxCharacters` and `maxWords` are integers or `null`.
- `requiredPlaceholders` contains the exact tokens that every candidate must
  preserve, including braces.
- `forbiddenTerms` is matched case-insensitively.
- `stateMatrix` records only supplied behavior. It never authorizes invented
  state or service behavior. Every nonempty entry must have one unique
  `variant`, `state`, or `id`, and `outputCount` must equal the family size.
- `success` copy requires an explicit `confirmed` state entry. Requested or
  optimistic state is not enough to claim completion.
- `outputCount` is between 1 and 5.

## Strict response

```json
{
  "status": "ok",
  "normalizedRequest": {
    "mode": "create",
    "contextClass": "button",
    "surface": "Recipe filters",
    "intent": "Apply the current filter draft",
    "ownership": "react",
    "maxCharacters": 20,
    "maxWords": 3,
    "requiredPlaceholders": [],
    "forbiddenTerms": ["Submit"],
    "stateMatrix": [],
    "outputCount": 1
  },
  "proposedKey": "recipes.filters.actions.apply",
  "rankedCandidates": [
    {
      "rank": 1,
      "text": "Apply Filters",
      "rationale": "Names the committed action and its object.",
      "variant": "default"
    }
  ],
  "exemplarsUsed": ["curated.action.apply-filters"],
  "checks": {
    "maxCharacters": true,
    "maxWords": true,
    "placeholders": true,
    "forbiddenTerms": true,
    "ownership": true,
    "style": true,
    "retrieval": true
  },
  "warnings": [],
  "refusal": null,
  "confidence": "high"
}
```

Allowed statuses:

- `ok`
- `needs-context`
- `refused`

`rankedCandidates` must be empty for `refused` and `needs-context`.

For `mode: "variants"` with an empty `stateMatrix`, `rankedCandidates` are
interchangeable wording alternatives. Return exactly `outputCount` candidates
with unique ranks and unique text. An exact canonical exemplar may appear only
once; remaining candidates must be distinct comparable alternatives.

For plural or state-matrix requests, each candidate may include `variant`
(`one`, `other`, `zero`, or the supplied state id). Those candidates are a
complete variant family rather than interchangeable wording alternatives.

Refusals use:

```json
{
  "code": "app-manual|proper-noun|react-notification|privacy|injection|unsafe",
  "reason": "Brief explanation."
}
```

Mandatory refusals use the exact deterministic reason returned by the boundary
detector. This keeps private source text and injected instructions out of the
response rather than paraphrasing or echoing them.

When a privacy refusal contains a credential, masked secret, private
attribute, or other sensitive source text, the returned `normalizedRequest`
must use the redacted surface `Private content request` and intent
`Private or sensitive content request`, with empty placeholders, forbidden
terms, and state matrix. Never echo the sensitive input.

The response must contain no additional top-level keys and must not be wrapped
in Markdown.

## Multiple string requests

An invocation may provide an array, or an object with a `requests` array. Each
entry is normalized independently. Return a JSON array containing one complete
strict response object per request in the same order. A single request retains
the single-object response shape.
