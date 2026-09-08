# Chat and Quick Links

The global action opens one shared `ModalSheet`. Home Assistant is the first tab and the
cold-open default; Quick Links is second. The current tab, conversation and
draft stay in the mounted dashboard session. Rooms and Security remain
same-sheet Quick Links details, with their original destinations and grids.

Chat history is another page inside this sheet. Opening history, selecting a
conversation, switching tabs, and starting an empty draft send no prompt.
History and New Chat are compact, labelled icon actions in the shared modal
header, independent of transcript scroll position. History Back restores the
reading position and header trigger focus. This deliberately moves these
first-class actions out of the body flow without adding a tall fixed row.
The composer is above the bottom tab navigator. Enter sends; Shift+Enter
inserts a line break. IME composition and held-key repeats never submit.
The composer measures actual wrapped text and expands from one line to two,
then shrinks again when text is removed or a wider viewport removes wrapping.
The textarea and blue send visual animate for this explicit user-requested
exception to stable composer height; the outer modal remains fixed. Longer
text scrolls inside the two-line cap with no scrollbar chrome. The send visual
is 32px at one line and 44px at two, always inside a 44px hit target. Reduced
motion disables the transition properties. The button is vertically centered inside the rounded entry,
inset from its right edge with the textarea to its left. Bubble speakers remain
accessible article names without visible role headings.
Each text line is 24px. The input's 12px vertical breathing room belongs to its
associated label wrapper, outside the textarea scrollport, so a two-line entry
cannot paint a partial third line through scrolling padding. Clicking that
padding still focuses the native textarea. Entry heights are 50px and 74px
including its border.
Explicit submission follows the new turn. Incoming replies follow only when
the reader is already at the end; older reading positions are not displaced.
The optional latest-message action is retained in `ChatPanel` for reuse, but
the global modal never displays it. Header actions reuse the Close control's
38px visual size and expanded hit area; Chat/Quick Links/details keep the same
header height.

The modal and tab reuse the canonical `common.app.title` product name.
The empty conversation says “Home Assistant Agent” and “Ask a question or give
a command to Home Assistant.” A single configured agent's name is not shown;
the original assistant selector remains when multiple agents require a choice.
Initial history loading and request-save progress remain accessible statuses
without visible storage chatter. Empty history omits the account-sharing
description. Actual load/save failures, unknown execution and context warnings
remain intact; none of these presentation changes asserts successful storage.

## Native Home Assistant integration

`useDashboardChat` owns a `ChatClient` above the portal content, using the
existing HAKit connection and authenticated user. Closing the sheet or
navigating the dashboard does not cancel or detach an outstanding turn.
Changing connection/account ownership disposes subscriptions, cancels metadata
deadlines, clears private in-memory content, and ignores stale completions.

Activation discovers agents through `conversation/agent/list` and reads
registry entries only for the returned conversation entities. Eligible agents
must belong to `google_generative_ai_conversation` and not be disabled.
One eligible agent is selected; multiple eligible agents require an explicit
choice in the empty-chat assistant selector. There is no guessed entity ID, default-agent fallback,
provider API key, direct Gemini request, or frontend HASS MCP bridge.

Agent identity stays fixed for an existing thread. Chat does not discover
provider model metadata, read the device registry, offer model switching, or
change integration options. Requests use the thread's native `agent_id`.

The reverted experimental `model-change` record is unsupported, like other
unknown record kinds. If such records exist in an account, the existing
unreadable-history guard blocks all further sends and saves; ordinary readable
records may still be displayed, but no model separator is rendered. The
records remain untouched in HA. This is not a migration, deletion, replay or
silent downgrade of the switched conversation.

The agent's tools and entity exposure remain configured and authorized by HA.
Agent identity discovery does not audit or change its configured LLM tools.
Production integration review should confirm those exposures are appropriate;
administrative MCP and a future house-specific orchestrator are separate work.

| User action / state | Behavior |
| --- | --- |
| Unopened or preload | No Chat requests, subscriptions, identity generation, timers or observers. |
| First authenticated activation | Read current user, eligible agents and user data; subscribe to account updates. |
| Send in a new/current chat | Preflight the saved tail; record the request; call `conversation/process` once with explicit agent and native conversation ID. |
| Choose an assistant before a chat | Select an offered native agent, preserving the unsent draft; send no prompt. Existing threads retain their original agent. |
| Recent chat from another session | Require the visible continuation choice before enabling submission. |
| Expired, reset, conflicting or uncertain context | Keep the transcript readable; do not continue it implicitly. |
| Retry saving | Retry the exact immutable record; never submit the prompt again. |
| Close/tab/route change | Retain the request owner and attach any later reply to its original thread. |
| Account/connection ownership change | Clear private presentation state and invalidate old work. |

Only the native response's plain speech becomes an assistant message. System
prompts, tool calls, reasoning content and arbitrary HTML are not displayed or
stored. Model wording is not a verified device-action-success indicator.
The three-dot bubble represents a genuinely pending turn, has one accessible
status, and becomes static under reduced motion.

## Shared history is not persistent model memory

The native `frontend/get_user_data`, `frontend/set_user_data` and
`frontend/subscribe_user_data` APIs scope records to the authenticated HA user.
Completed recorded turns are available to that same account on other devices,
including a fresh browser after the original browser closes. The app does not
use localStorage, IndexedDB or a household-wide transcript store.

Records use the `react-dash.chat.v1.<kind>.<id>` namespace:

- `thread`: immutable agent identity and creation metadata;
- `request`: user text, client identity, predecessor and native context ID;
- `pending`: a request that was actually dispatched;
- `result`: actual plain response, returned context ID and reset/error flags;
- `unknown` / `not-sent`: explicit uncertain or unsubmitted outcomes.

Independent record keys avoid unrelated-client read/modify/write clobber.
There is no mutable archive, shared index, whole-thread snapshot, or
timestamp-based merge winner. Predecessors establish ordering; overlapping
tails are retained and stop continuation. This is not a distributed lock,
transactional quota, or exactly-once server execution guarantee.

HA's API has no prefix enumeration or subscription, so account snapshots are
filtered immediately. Unrelated preferences are never written back, logged,
or forwarded to an agent. Unknown schemas and changed immutable records remain
untouched and disable further sending rather than being silently discarded.
Empty metadata reservations are not presented as completed chats.

Reload and reconnect reconcile a fresh, schema-valid HA snapshot so an
externally repaired store can recover from format or admission-limit errors.
That snapshot replaces previously acknowledged cached records; it does not
delete or rewrite server data. Genuinely unsaved oversized, invalid or
conflicting records remain local and keep their warning. Reconciliation also
downgrades cached context confidence rather than implying that repaired
history restores assistant memory. Malformed/orphaned branches have
deterministic presentation order but remain read-only; ordering never resolves
a causal conflict.

Bounds are explicit: 4,000 input characters, 64,000 reply characters, 100 thread
records, 2,000 records and a 1,500,000-byte history admission budget, with reply
headroom reserved before dispatch. Concurrent clients can exceed an admission
threshold because the native API has no CAS/quota transaction. Existing records
are never pruned to make space. An oversized reply remains visible and marked
save-unconfirmed instead of being truncated. Its session-only loss warning
follows the actual reply, so reaching the reply tail also reaches the warning.
### Fourteen-day HA-owned retention

The local `sfenton_react_chat` custom integration registers
`sfenton_react_chat.purge_expired_history`. Its package invokes it daily at
03:15 HA local time. **Not active until the component and package are deployed,
HA is restarted, and service/automation registration is confirmed.** HMR,
React asset deployment, and `deploy:sync` alone do not activate retention.

The fixed cutoff uses HA time and the thread's creation age, not recent
activity: `createdAt <= now - 14 days`. Each HA user's frontend store is
processed sequentially, even if that user never reopens the dashboard.
All valid v1 records belonging to an expired thread are cleared, including
pending/unknown outcomes. This does not replay or cancel requests. Normal daily
runs purge within 24 hours after the threshold; downtime/failures delay cleanup.

Only exact valid `react-dash.chat.v1.` records qualify. Unknown schemas,
malformed records and unrelated preferences remain untouched. Safely identified
orphans with missing/null threads expire by their own creation age. The service
uses `async_user_store` and public `async_set_item(key, None)`, never direct
storage-file writes or private-store mutation. Payloads are removed, but **null
key tombstones remain** and the frontend excludes them from history and quotas.

The API provides no atomic deletion/write barrier. Concurrent or late client
writes can reintroduce records until a later eligible sweep; a newly timestamped
orphan waits for its own cutoff. This is scheduled retention, not a continuous
TTL or guaranteed erasure of backups/provider data. Exposed save errors fail
the service; HA Store's internally swallowed disk-write errors remain an
inherited durability limitation.

See the [component installation and rollback checklist](../home-assistant/custom_components/sfenton_react_chat/README.md)
for SMB paths, SSH staging support, restart requirements and operating limits.
No real histories were read or deleted to implement or test this component.

Transport, authentication, schema and reported save failures surface in the UI.
Metadata requests have a 30-second deadline. HA Core's storage helper can log a
disk-write failure without propagating it through the frontend API, however;
an acknowledgement or read-back is **not** verified durable-disk storage.
This inherited limitation cannot be detected by a browser-only adapter.

Native HA chat contexts are held in memory with a five-minute idle threshold
and periodic cleanup. The dashboard conservatively treats older contexts as
archives. A saved conversation ID and `continue_conversation` do not certify
resumability. HA restart or cache loss can reset even a recent context. A
changed returned ID creates a visible boundary and disables further implicit
continuation. No saved prompt or service call is replayed to reconstruct it.

One active waiting turn owns the local busy state. After two minutes without a
reply, its outcome becomes uncertain, not cancelled, and releases that owner.
History reads and storage-only recovery are then available. Continuing the
uncertain thread remains blocked; a further prompt requires an explicit new
chat and submission. The original request can still finish, but its late
response/cleanup cannot release a newer operation or its deadline. The app
never retries the original prompt automatically. Closing the browser or
losing its connection before receiving the response can leave an incomplete
record: HA may have acted even though no reply was recorded. Recovering such
results independently of the requesting browser, authoritative context
preflight, and stronger persistence guarantees require a separately authorized
HA-owned capability, not administrative chat-log access from React.

## Validation

`e2e/chat-ux.spec.ts` uses genuinely shared per-user mock HA storage across
separate browser contexts. It covers fresh-device history, account isolation,
independent writes, conflicting tails, storage-only recovery, pending lifecycle,
long-message scrolling, reduced motion and synthetic keyboard contraction.
`e2e/chat-layout.ts` binds the full Chat state inventory to the executable
layout workflow and its canonical viewport/resize matrix.

Because Chat can be a reading-only body with all actions in the header/dock,
its layout facts explicitly select the real Chat content region as the
terminal target. The default control-bearing modal audit still rejects
missing controls. The Chat audit rejects missing/empty content and retains
the same strict intrinsic end-inset oracle; text is not reported as a control.

Use `docs/ux/layouts.md` for source-bound builds, baseline parity, native
fine-pointer/Chromium/WebKit evidence and actual manual image review. Synthetic
insets and WebKit/WPE do not certify physical cutouts, native iOS autosizing,
the real companion keyboard, or deployed HA iframe behavior. Local validation
does not authorize deployment, a live model prompt, or a device action.

Primary capability evidence:

- [HA Conversation API](https://developers.home-assistant.io/docs/intent_conversation_api/)
- [Core 2026.8.3 frontend storage](https://github.com/home-assistant/core/blob/2026.8.3/homeassistant/components/frontend/storage.py)
- [Core storage write-error handling](https://github.com/home-assistant/core/blob/2026.8.3/homeassistant/helpers/storage.py#L568-L589)
- [Native chat-session lifetime](https://github.com/home-assistant/core/blob/2026.8.3/homeassistant/helpers/chat_session.py)
