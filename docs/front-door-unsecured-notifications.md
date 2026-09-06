# Front-door unsecured notifications

Home Assistant owns this lifecycle. React only displays existing guest/security
controls and responds to dashboard navigation. No guest aggregate sensor or
client-side notification producer is introduced.

## Canonical source and ownership

- `scripts/lib/frontDoorUnsecuredConfig.ts`: native helper/automation definitions.
- `scripts/lib/frontDoorUnsecuredCopy.ts`: HA notification wording generated
  through the validated house-style launcher; existing jam wording is retained.
- `scripts/lib/frontDoorCoordinatorTransform.ts`: strict, idempotent removal of
  the routine-unsecured subtype from both front-entry coordinator passes.
- `scripts/sync-front-door-unsecured.ts`: read-only planning, staged installation,
  checked activation, verification, and object-level rollback.

Managed automations:

- `automation.front_door_unsecured_lifecycle`
- `automation.front_door_unsecured_reconcile`

The existing `automation.front_entry_journey_classifier_shadow` keeps all
unrelated visitor, journey, jam, failed-lock, and door-left-open behavior.
Its misleading historical entity name is not renamed.

## Policy and state/service matrix

An exposure starts after residents are stably away for 30 seconds. Initial
notification additionally requires the front door to remain explicitly unlocked
and its contact closed for 35 seconds.

| State/event | Notification/command behavior |
| --- | --- |
| Any guest stay helper on | One passive, explicitly silent notice. |
| All guest stay helpers explicitly off | One time-sensitive, noncritical notice. |
| Guest state uncertain, none on | Passive uncertainty-aware notice. |
| Alarm explicitly armed Away | May consume the exposure's one time-sensitive attention alert despite guest mode. |
| Alarm triggered | Existing alarm notification owns urgency. |
| Guest/alarm policy changes | Replace the same tag; no second attention alert once its reservation is consumed. |
| Contact reopens/recloses | Preserve exposure; no command while open; material updates are silent. |
| Lock unknown/unavailable/locking/unlocking | Never start an unlocked accusation or issue a lock command; preserve an existing exposure. |
| Confirmed locked | Clear the exact stored tag; retire and invalidate its action. |
| Residents home for 30 seconds | Clear the away exposure without claiming the door is locked. |
| Later departure while lock remains unlocked | New exposure, new identifier, new notification budget. |
| Authenticated current lock action | Fixed `lock.lock` on the U400, never toggle or unlock. |
| Already locked when the action arrives | Recall only; no lock service call. |
| Open/unknown contact, wrong user, expired/stale/replayed action | Reject without operating the door. |
| No lock confirmation within 20 seconds | One passive failure update; no automatic retry. |
| Conditions change while consuming the action | Recheck immediately before dispatch; cancel without sending a lock command or restoring the consumed action. |
| Action reaches 30-minute expiry | Replace silently without the lock action; keep Open Security. |

The guest helpers express stay intent, not verified physical occupancy.
Notification text therefore says residents are away, not that nobody is home.
The explicit command does not set either shared Auto-Lock helper. Stephanie's
ordinary lock-status notification remains unchanged.

## Persistence, concurrency, and recovery

Seven restoring helpers hold phase, immutable incident ID, opened epoch,
phase-specific wake deadline, attention reservation, presentation fingerprint,
and the most recently retired ID. Do not add reset-on-restart `initial` values.
Unknown new metadata helpers are initialized once during disabled staging because
HA may otherwise leave them unknown. Running partial controllers are rejected
before initialization.

The controller is queued. It reads current state inside execution while keeping
the source timestamp for terminal-event fencing. A queued old lock/home event
must not clear a newer exposure. The controller does not wait in its queue for
phone input or hardware confirmation. The persisted deadline changes purpose
with the phase: 35-second qualification, 30-minute action validity, or 20-second
lock confirmation.

Initial qualification also checks a continuous 65-second away minimum, so
delayed presence events cannot reuse an old deadline to bypass the sequential
30-second away and 35-second door windows.

An attention reservation and presentation fingerprint are recorded before
submission, with an immediate `homeassistant.save_persistent_states` request.
Unchanged submissions are suppressed. Source changes observed before submission
release an unused reservation and reconcile/requalify rather than publish stale
facts.

The restart/reload reconciler runs immediately and after 30 seconds. It never
replays a lock command, resets an incident, or creates a fresh audible recovery
notice. Confirmed locking and valid return-home retire an exposure; motion,
camera enrichment, 95-second journey rollover, guest toggles, and availability
blips do not.

This is at-most-once attention intent, not a distributed exactly-once delivery
claim. Restore-state storage errors and push-delivery uncertainty cannot be
made transactional with APNs. Preserve diagnostics and fail closed on incomplete
active metadata.

## Companion behavior and navigation

Each incident uses `sfenton-front-door-unsecured-<incident-id>`, with the same
Stephen-only endpoint for send and `clear_notification`.

The action identifier is incident-bound. Home Assistant compares the event's
authenticated registration-user context to the intended recipient's configured
person user ID. No user ID is committed or accepted from action data.
`authenticationRequired: true` requires device unlock; it does not guarantee
a fresh biometric challenge on an already-unlocked device.

After persisting action consumption, the controller rechecks terminal resolution,
contact/lock safety, recipient identity, and the original action expiry immediately
before dispatch. Cancellation is distinct from a sent command's timeout.

On iOS, press and hold expands the notification, then the user chooses
**Confirm: Lock Front Door**. This is not a custom hold-duration action.
Android command authentication requires Android 12+ if an Android recipient is
introduced later; older versions should receive navigation-only fallback.

Body tap and Open Security use:

```text
/sfenton-react-dash/home?path=security
```

The supported panel equivalent is:

```text
/sfenton-react-panel?path=security
```

Neither has a camera fragment. Native HA `location-changed` events flow through
the same shared location subscription as app navigation, including hash-modal
closing without remounting the iframe.

iOS critical notices cannot be normally grouped/replaced and only the latest
critical notice for a tag is cleared. This lifecycle never uses critical.
Historic critical copies may require manual dismissal. Even noncritical remote
clearing is subject to platform background/recent-app-use restrictions.

References:

- <https://companion.home-assistant.io/docs/notifications/actionable-notifications/>
- <https://companion.home-assistant.io/docs/notifications/notifications-basic/#clearing>
- <https://companion.home-assistant.io/docs/notifications/critical-notifications/>

## Plan, stage, activate, and verify

Run from the clean release worktree. Authentication comes from local env files;
never pass a token as a command argument or print an env file. An optional
`HASS_ADMIN_API_URL` or `--ha-url=` changes only the admin API transport, not
the production app's URL.

The default command is read-only:

```bash
npm run ha:front-door
```

It validates emitted triggers/conditions/actions through HA's read-only
`validate_config`, checks ownership and protected automations, and prints a
stable plan fingerprint. No services or configuration writes are performed.
The fingerprint binds both the current objects and the desired definitions.

After isolated tests, review, PR merge, and merged-master build:

```bash
npm run ha:front-door -- --mode=stage --apply \
  --expect=<fresh-plan-fingerprint> \
  --snapshot-dir=artifacts/front-door-unsecured/<release>
```

Stage creates restoring helpers and disabled automations without changing the
coordinator. It saves private, credential-screened rollback data before writes.
Read the newly returned fingerprint, then:

```bash
npm run ha:front-door -- --mode=activate --apply \
  --expect=<fresh-staged-fingerprint> \
  --snapshot-dir=artifacts/front-door-unsecured/<release>
npm run ha:front-door -- --mode=verify
```

Activation temporarily stops in-flight coordinator execution, checks the current
object immediately before each write, removes only the delegated subtype,
validates/read-verifies configuration, restores the coordinator's previous
enabled state, enables the new lifecycle, and performs reconciliation. It never
unlocks/locks the physical door to test itself. No HA restart is expected.

Saved YAML readback is not sufficient: HA schedules configuration reload after
the write. Every write waits for the runtime `automation/config` fingerprint and
disabled state before another owner can be enabled. Successful final enablement
is explicitly persisted.

The local migration lock prevents two apply processes in the same worktree.
Fresh fingerprints and per-object checks protect against cross-worktree/config
drift. Do not force past a mismatch.

Publish/deploy the same merged production app to both supported hosts and
synchronize cache-busting through the normal deployment workflow. Do not retire
either host or change the panel bridge for this feature.

## Rollback

Capture the current coordinator fingerprint before rollback:

```bash
npm run ha:front-door -- --mode=rollback --apply \
  --expect-coordinator=<fresh-coordinator-fingerprint> \
  --snapshot-dir=artifacts/front-door-unsecured/<release>
```

The new command path is disabled first. Rollback refuses to overwrite concurrent
coordinator/protected-object changes. It restores a reviewed passive,
non-actionable routine-unsecured fallback rather than critical spam. Helpers are
retained for recovery/forensics. Do not use a full-home restore.
Managed automation disablement is also saved as `initial_state: false` and
runtime-verified, so stale restore-state data cannot resurrect the command path.
Helpers still have no reset-on-restart initial values.

On activation failure, verify live state and recorded snapshots before retrying.
An uncertain request outcome is not permission to replay it blindly. Snapshot
files are never overwritten; retries create additional checkpoints.

## Validation

Vitest executes the emitted native HA actions/conditions and Jinja expressions,
not a separate copy of the lifecycle decision logic. The harness disables
network access and records only mocked services. It requires Python 3 and Jinja2;
fresh test environments can install the small test-only requirement from
`scripts/fixtures/front-door-unsecured/requirements.txt` in their Python
environment.

```bash
npm run test:run -- scripts/lib/frontDoorUnsecuredConfig.test.ts \
  scripts/lib/frontDoorCoordinatorTransform.test.ts \
  scripts/lib/frontDoorUnsecuredSync.test.ts \
  src/hooks/dashboardLocation.test.tsx src/hooks/useDashboardRoute.test.ts
npm run test:e2e -- e2e/iframe-lifecycle.spec.ts --grep "notification landing"
```

Coverage includes the September 5 event replay, guest truth table, explicit lock
states, continuous qualification, new exposures, stale queued proofs,
reserve-before-send crashes, pre-submission state races, authenticated action
replay/expiry/failure, exact tag recall, drift guards, fallback/reapply, and
both cold/warm iframe hosts. Complete the repository's responsive/navigation
release gates when the shared location bridge changes.

Production verification must inspect configuration, preserved guest/Auto-Lock
state, traces, and both no-hash Security landings without actuating devices.
Physical iOS authentication, actual playback, and background recall remain
unverified until observed on the recipient device; server submissions are not
device-delivery receipts.
