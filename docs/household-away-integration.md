# Solo Trip native architecture

Solo Trip is implemented in `home-assistant/packages/solo_trip.yaml` as a
native Home Assistant coordinator. It keeps the public
`sensor.household_away_status` contract at version 1, preserves the React
response shape, and removes any dependency on a `household_away` custom
integration. Home Assistant owns the lifecycle through exactly four Solo
helpers, retained MQTT journal/status sensors, two template gates, one queued
response-bearing `script.household_away_command`, and one reconciliation
automation.

## Contract ownership

The retained journal on `household_away/native/journal` becomes the authority
after writer claim. Every retained journal commit now publishes an unsigned
mapping, signs `sha256(to_json(sort_keys=true))` over that unsigned payload,
attaches `payload_checksum`, and waits for the diagnostic echo before any Wake
Light or SleepyPod side effects. The companion `solo_trip.jinja` template owns
the canonical signing, request-hash replay trimming, full schedule merge,
immutable restore, and ordered `alarm_rows` replacement helpers. SleepyPod
fingerprints intentionally exclude provider-generated alarm `id` values while
preserving every observable field and array order. The live adapter can add
those IDs after an otherwise exact restore; treating that enrichment as user
divergence caused a false restore barrier during testing.

The public sensor on `household_away/native/status` remains a redacted
projection. It exposes only `contract_version`, `revision`, `command_available`,
`mode`, `traveler`, `home_resident`, `starts_at`, `ends_at`, `blockers`,
`effects`, `restore_required`, `release_token`, and the entity state. Baseline
schedules, owner refs, request history, checksums, and pending payloads never
leave the journal.

## Lifecycle corrections

`script.household_away_command` stays the only native command boundary. It now:

1. Replays the latest matching `request_id` only when the canonical request
   hash matches, otherwise rejects `request_id_conflict`.
2. Parses local schedule edits into timestamps, rejects starts in the past, and
   rejects `end <= start` without lexicographic datetime comparisons.
3. Claims the writer, commits and echoes the exact away-side baseline, re-reads
   that baseline before effects, and mirrors the full home-side schedule onto
   the away side during activation.
4. Verifies the away-side overlay before ending, restores the immutable saved
   baseline with the current home side preserved, and routes divergence through
   `restore_required`.
5. Calls Wake Light with `profile_id: master-bedroom`, the current Wake
   revision, `request_id`, `operation`, `source_ref`, `suspended`, and
   `owner_ref`, requiring `accepted` or `no_change`.
6. Waits for exact journal/status echoes, plus full canonical SleepyPod
   schedule echoes for activation, restore, and schedule-writing commands.
7. Reserves internal replay/revision bypass for repository-represented writers
   such as `home-assistant/solo_trip/stage_schedule_writer_migration_v1.yaml`,
   which documents the exact migration from
   `automation.sleepypod_bed_stage_schedules_to_mqtt` MQTT writes to the
   single `script.household_away_command` boundary while preserving
   the existing complete `schedule_payload`, including its alarm arrays.

Any post-effect timeout or Wake ownership failure returns an indeterminate
result and holds or re-enters `restore_required` instead of faking success.

## SleepyPod policy

SleepyPod commands remain serialized through the same script. Idle and
scheduled requests stay side-scoped. `active` requests accept only the home
side and fan out to both sides. `activating`, `ending`, `degraded`, and
`restore_required` stay locked. `set_power` uses static
`climate.set_hvac_mode` `heat/off`, `set_outside_level` and
`set_tonight_level` call the exact resident scripts for each target side,
`set_stage_level` stages both resident helpers while active, `set_schedule`
merges side-scoped input into the current full schedule before active mirroring,
and `replace_alarms` rebuilds alarms from ordered `alarm_rows` without dynamic
service names. Tonight and outside target commands are rejected when the
selected side is not in the matching schedule phase rather than returning an
accepted no-effect result from an underlying script guard.

## Authorized live validation

The 2026-09-18 away-house test window exercised the package against the real
broker, Wake Light integration, SleepyPod adapter, and current React HMR
preview. The temporary package was configuration-checked before every load and
removed after validation.

- Retained journal/status bootstrap survived restart and produced one released
  idle writer with the direct response-bearing script available.
- A short Steph-away schedule moved through scheduled, activating, and active.
  Activation captured the complete right-side baseline, suspended only
  `sleepypod:right`, mirrored the complete left schedule to both sides, and
  reported all three effects only after the live schedule echo.
- Active outside-schedule target commands reached both sides, traveler-side
  commands were rejected read-only, request replay did not repeat device calls,
  and a reused request ID with different data returned
  `request_id_conflict`.
- Active Bedtime helper changes ran through the migrated stage writer, updated
  both helpers, mirrored the complete schedule, preserved alarm rows, and
  advanced the overlay fingerprint without changing the public revision.
- A deliberately unsupported alarm pattern was normalized by SleepyPod,
  correctly producing `restore_required`. `restore_saved` restored the exact
  observable five-alarm away baseline and cleared only the matching Wake owner.
- A separate normal end restored the away schedule, cleared Wake suspension,
  released the writer, and issued no immediate target or power command.
- Provider-generated alarm IDs appeared after restore. Observable
  canonicalization was updated and then verified against live macro evaluation
  so those IDs no longer create false divergence or echo timeouts.

All tested schedule fields, six stage helpers, both target levels, alarm states,
Vacation intent, and Wake ownership were restored to their pre-test values.
The stage automation was restored to its original MQTT action, retained test
topics were cleared, the package and custom template were removed from the
live host, and the ten restored test entities were removed from the entity
registry. The separately owned Wake Light source-suspension update remains
installed and validated.

## Deployment note

`scripts/deploy.ts` now treats `home-assistant/custom_templates/solo_trip.jinja`
and the stage-writer migration manifest as part of the Solo Trip native staging
set, backing them up and configuration checking them alongside the package and
Vacation migration manifest.

A production cutover is still blocked on applying and verifying the nine
operational Vacation-consumer migrations, coordinating the dashboard release so
old direct writers cannot coexist with the native writer, and repeating the
current-source layout/release gates. The live validation above did not commit,
push, merge, or deploy dashboard production assets.
