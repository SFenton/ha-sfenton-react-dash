# Optional manual chat-history cleanup

Local source only until installed and restarted. Requires HA Core 2026.8's
frontend `async_user_store` / `UserStore.async_set_item` API. No pip requirements.

The package loads this integration through `async_setup`, but it does not
schedule deletion. React hides conversations whose latest activity is older
than 14 days while leaving every record in the authenticated user's Home
Assistant frontend store. Retained records remain available for future analysis
and continue to count toward frontend chat storage limits.

The integration retains `sfenton_react_chat.purge_expired_history` only as an
explicitly invoked maintenance service. Do not call it without deletion
authorization. If invoked, its legacy fixed policy enumerates users sequentially
and selects valid v1 threads at `createdAt <= now - 14 days`. It clears their
valid current-schema records, including pending, unknown, and not-sent outcomes.
Unknown schemas, malformed records, unrelated settings, and recent orphans remain
untouched. Children are cleared before thread metadata; overlapping calls are
serialized and repeated calls are idempotent.

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
or later client write can reintroduce a payload after a manually authorized
sweep. A late orphan with a recent timestamp does not qualify for that call.
This service is not a strict TTL or an anti-resurrection write barrier. Records
replaced while a prior save yields are skipped and counted as changed, so the
sweep does not overwrite a replacement selected from stale metadata.

## Installation / release checklist

Do not claim scheduled deletion is paused from a React/HMR or asset deployment alone.

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
   Verify the prior daily purge automation is absent. The manual service may
   remain registered, but calling it deletes eligible real payloads and needs
   separate authorization.
5. Confirm old records remain in a synthetic or explicitly authorized account
   snapshot while the React history page omits activity older than 14 days.

`scripts/deploy.ts` stages and compares these exact files alongside the panel,
backs up changed existing files as `.bak`, validates staged configuration, and
attempts to restore every changed file on staging/validation failure. It reports
rollback failures and does not restart HA or prove removal of a loaded automation.
Asset upload is not rolled back. Removed/renamed component files are not pruned;
future migrations must explicitly handle them. SMB copies require the manual
backup/rollback steps above. `deploy:sync` alone only synchronizes dashboard hosts.

Local tests: `python -m unittest discover -s scripts/chat-retention -p 'test_*.py'`.
No HA runtime or user data is needed.
