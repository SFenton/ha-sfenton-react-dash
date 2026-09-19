# Household user personalization

Read this reference before changing UI, copy, controls, summaries, forms, or
modals that directly identify a household resident.

## Identity source

- Resolve the viewer only from the signed-in Home Assistant user ID through
  `src/constants/householdResidents.ts`.
- Do not infer the viewer from a display name, URL parameter, person state,
  device ownership, location, or Solo Trip state.
- A missing or unknown user ID must preserve the configured proper-name
  fallback. Never guess which resident is viewing.

## Display rules

For a known viewer:

| Surface | Viewer | Other resident |
|---|---|---|
| Resident selector | `You` | `Steph` / `Stephen` |
| Chores | `Your Chores` | `Steph's Chores` / `Stephen's Chores` |
| Bed overview | `Your Side` | `Steph's Side` / `Stephen's Side` |
| Office PC | `Your PC` | `Steph's PC` / `Stephen's PC` |
| Nightstand | `Your Nightstand` | `Steph Nightstand` / `Stephen Nightstand` |
| Summary | `Your Summary` | `Steph's Summary` / `Stephen's Summary` |
| Task assignee | `You` | `Steph` / `Stephen` |

- Use `you` and `your` only when the resolved viewer is the referenced
  resident.
- Use the other resident's configured name when the subject is not the viewer.
- Keep sentences truthful about ownership. For example, when the traveler is
  viewing Solo Trip, use `While you are away...` and name the home resident as
  the whole-bed controller.
- Personalization changes presentation only. It must not change entity IDs,
  service targets, optimistic state, permissions, side ownership, task
  ownership, or Home Assistant behavior.

## Stable proper-name exceptions

Keep proper names when they are required to identify a stable subject rather
than address the viewer:

- backend entity IDs, route paths, source refs, service payloads, and numeric
  assignee values;
- Home Assistant friendly names, task text, provider content, and other live
  backend values;
- explicitly selected other-person values;
- unknown-viewer fallbacks;
- detailed physical-side and alarm-source titles where the resident name
  disambiguates the controlled bed side, alarm, or editor.

Do not mechanically replace every name-shaped string. Classify whether the
text addresses the viewer, identifies another resident, is a stable physical
owner label, or is non-UI data.

## Implementation pattern

- Keep resident metadata declarative on configuration objects.
- Resolve viewer-relative display labels at render time; do not mutate the
  shared configuration object.
- Put new static wording in the narrowest i18n catalog and interpolate resident
  names from the shared registry.
- Preserve preload inertness. Reading the existing authenticated user context
  must not add runtime I/O.

## Required checks

For every affected surface, test:

1. Stephen as the signed-in viewer.
2. Steph as the signed-in viewer.
3. An unknown or missing viewer.
4. Visible and accessible labels.
5. Unchanged entity IDs, navigation destinations, and service payloads.
6. Relevant phone portrait, phone landscape, and desktop layout.

Use real-backend visual evidence for the available signed-in account and mocked
evidence for the complementary resident and unknown-user states. Do not mutate
Home Assistant merely to validate wording.
