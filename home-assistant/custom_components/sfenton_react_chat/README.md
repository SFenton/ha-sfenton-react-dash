# Home Assistant-owned chat retention

Local source only until installed and restarted. Requires HA Core 2026.8's
frontend `async_user_store` / `UserStore.async_set_item` API. No pip requirements.

The package loads this integration through `async_setup` and calls
`sfenton_react_chat.purge_expired_history` daily at **03:15 HA local time**.
The same service can be called manually, without arguments. Its policy is
fixed at 14 days; there is no configurable shorter or longer retention period.

The service enumerates `hass.auth.async_get_users()` sequentially, including
accounts that never reopen React. HA's UTC clock defines the cutoff.
A valid v1 thread expires when `createdAt <= now - 14 days` (milliseconds).
All valid current-schema records scoped to it are cleared, including pending,
unknown and not-sent outcomes, even if their own timestamps are recent.
This is retention, not cancellation, retry or resubmission.
Daily scheduling normally purges within 24 hours after the age threshold;
HA downtime or a failed run delays cleanup until a successful run.

Only exact `react-dash.chat.v1.<kind>.<id>` records matching the frontend
schema qualify. Unknown schemas, malformed records and unrelated settings are
untouched. Orphans qualify only when their own valid creation time has expired
and their thread key is missing/null, not when that key contains malformed data.
Each account is selected independently. Empty/missing stores are safe no-ops.
Children are cleared before thread metadata to retain scope across failed runs.
Overlapping service invocations are serialized; repeated runs are idempotent.

## Storage and acknowledgement limits

Clearing uses only `await store.async_set_item(key, None)`. This saves through
HA and emits normal frontend subscription events. It **removes payloads, not
keys**: null tombstones remain because this API has no deletion method. The
React parser excludes owned current-schema tombstones from history and quotas.
No private `_store` access, mutation of `store.data`, or direct `.storage`
edits are used. This does not erase backups, provider history or active native
conversation memory.

Exposed load/save errors fail the service rather than logging success. Earlier
clears may already have succeeded; retry is safe. Logs contain aggregate counts
only, not account IDs, record keys or message content. HA Store itself may
internally log and swallow disk `WriteError`; inherited API acknowledgement
therefore cannot prove durable deletion on disk.

There is no transactional lock against frontend writes. A concurrently arriving
or later client write can reintroduce a payload; a later sweep clears valid
expired threads/orphans according to this same policy. A late orphan with a
recent timestamp waits for its own 14-day cutoff. This service is not a strict
continuous TTL or an anti-resurrection write barrier.
Records replaced while a prior save yields are skipped and counted as changed,
so the sweep does not overwrite a replacement selected from stale metadata.

## Installation / release checklist

Do not claim retention active from a React/HMR or asset deployment alone.

1. Back up existing `config/packages/sfenton_react_chat.yaml` and every existing
   file under `config/custom_components/sfenton_react_chat/`.
2. Preferred SMB: copy the repo's `home-assistant/custom_components/sfenton_react_chat/`
   files to `\\192.168.1.22\config\custom_components\sfenton_react_chat\`,
   and `home-assistant/packages/sfenton_react_chat.yaml` to
   `\\192.168.1.22\config\packages\sfenton_react_chat.yaml`.
   Keep the existing panel package and both dashboard hosts.
3. Ensure the existing HA `homeassistant: packages:` inclusion loads the package.
   Run HA configuration validation after staging. On failure restore all prior
   files and remove only newly introduced files; do not restart invalid config.
4. With explicit approval, restart HA after any component/package change.
   Verify the service exists and the daily automation is loaded and enabled.
   Calling the service deletes eligible real payloads and needs authorization.
5. Monitor the next scheduled run for errors. Registration/config validation is
   not proof of successful retention or disk durability.

`scripts/deploy.ts` stages and compares these exact files alongside the panel,
backs up changed existing files as `.bak`, validates staged configuration, and
attempts to restore every changed file on staging/validation failure. It reports
rollback failures and does not restart HA or claim retention runtime activation.
Asset upload is not rolled back. Removed/renamed component files are not pruned;
future migrations must explicitly handle them. SMB copies require the manual
backup/rollback steps above. `deploy:sync` alone only synchronizes dashboard hosts.

Local tests: `python -m unittest discover -s scripts/chat-retention -p 'test_*.py'`.
No HA runtime or user data is needed.
