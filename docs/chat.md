# Chat and Quick Links

The global action opens one shared `ModalSheet`. Home Assistant is the first tab and the
cold-open default; Quick Links is second. The current tab, conversation and
draft stay in the mounted dashboard session. Rooms and Security remain
same-sheet Quick Links details, with their original destinations and grids.

Chat history is another page inside this sheet. Opening history, selecting a
conversation, switching tabs, and starting an empty draft send no prompt.
Settings, History and New Chat are compact, labelled icon actions in the
shared modal header, independent of transcript scroll position. Settings opens
a same-sheet detail containing the instrumented Gemini model, Chat UX version,
Home MCP server version, improvement queue state, and up to five recent
nontechnical improvement summaries. History Back restores the
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

Production activation uses the curated Home MCP route at
`/api/sfenton_home_mcp`. Local development uses `/__home-mcp`, which Vite
proxies to the separately running `npm run home-mcp` server. Development
defaults to Home MCP. Production requires `VITE_HOME_MCP_ENABLED=true` only
after the authenticated proxy has been installed, Home Assistant restarted,
and the proxy verified. Test mode remains mocked. The authenticated HA proxy
pins the Home MCP TLS certificate and forwards the inherited user session to
the separate Home MCP container, and React calls only its
`home_chat` tool. The container handles supported household light intents through
its curated `home_lights` capability before delegating other conversation
processing to HA. It also exposes bounded `home_state` and `home_history` tools.
The administrative HA MCP remains separate and is never exposed to frontend chat.

Light replies may include typed room, color, brightness, or suggested-response
controls. A control remains adjustable after use, but its send action is locked
after one persisted continuation request. Each reply also carries compact semantic context: the named room or fixture plus optional prior action, bounded result state, and history boundary. This supports follow-ups such as “Which ones?”, “What about now?”, bare “why?”, and “before that?” without replaying stored transcript contents to Home MCP. Context remains thread-scoped and fixture-specific controls retain their exact target.

When Home MCP is explicitly disabled, activation retains the native fallback:
it discovers agents through `conversation/agent/list` and verifies returned
conversation entities belong to `google_generative_ai_conversation`. There is
no guessed entity ID, provider API key, or direct Gemini request.

Agent identity stays fixed for an existing thread. Chat does not discover
provider model metadata, read the device registry, offer model switching, or
change integration options. Requests use either the thread's native `agent_id`
or the single synthetic Home MCP agent identity.

Native Gemini threads created before the Home MCP cutover remain readable in
history but cannot resume through the synthetic Home MCP identity. Start a new
chat for curated light support; earlier prompts are never replayed into it.

The reverted experimental `model-change` record is unsupported, like other
unknown record kinds. If such records exist in an account, the existing
unreadable-history guard blocks all further sends and saves; ordinary readable
records may still be displayed, but no model separator is rendered. The
records remain untouched in HA. This is not a migration, deletion, replay or
silent downgrade of the switched conversation.

The inherited HA user session remains the authorization boundary. Home MCP
revalidates the bearer token with HA over its WebSocket API, derives the stable
HA user ID for queue ownership, requires an administrator for retained-history
backfill, and forwards HA calls with that same token over certificate-validated
HTTPS. The administrative MCP remains a separate operator/debugging surface.

### Completed-conversation improvement queue

Each Home MCP request carries its dashboard thread and turn IDs. Home MCP keeps
a sanitized, bounded turn record for light conversations only. Starting a new
chat or closing the modal submits the complete answered thread; a five-minute
quiet-time sweep covers browser exits that cannot send that final signal.
Duplicate content hashes are ignored.

Conversations that include unsupported requests are rejected locally before any
Copilot SDK call. The current supported set contains only lights. Retained
history can be backfilled in a bounded batch, and the same classification and
deduplication rules apply.

One host worker processes the queue serially. Copilot first assesses completion
and inferred intent. For an unmet need, the host freezes a replay fixture, then
allows Copilot only bounded reads/searches and exact replacements in the
production light parser. Copilot cannot change tests, corpora, policies, skills,
queue/version/release code, run shell commands, use Git or network tools,
contact Home Assistant, or publish.
The complete light corpus, learned replays, focused tests, type-check, and a
separate Copilot diff review must all pass before a patch release can be merged
and the MCP container can be rebuilt. Failed jobs retry twice and never block a
new chat request.

| User action / state | Behavior |
| --- | --- |
| Unopened or preload | No Chat requests, subscriptions, identity generation, timers or observers. |
| First authenticated activation | Read current user and user data; select Home MCP in production or discover eligible native agents when explicitly disabled; subscribe to account updates. |
| Send in a new/current chat | Preflight the saved tail; record the request; call Home MCP `home_chat` once, or native `conversation/process` when MCP is disabled. |
| Choose an assistant before a chat | Native fallback only: select an offered agent, preserving the unsent draft; send no prompt. Existing threads retain their original agent. |
| Recent chat from another session | Require the visible continuation choice before enabling submission. |
| Expired, reset, conflicting or uncertain context | Keep the transcript readable; do not continue it implicitly. |
| Retry saving | Retry the exact immutable record; never submit the prompt again. |
| Close/tab/route change | Retain the request owner and attach any later reply to its original thread. |
| Close or New Chat after a complete light thread | Queue one sanitized, content-hashed improvement review without delaying the UI. |
| Chat Settings | Read model/version/queue metadata only; send no prompt and call no HA service. |
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

Bounds are explicit: 180 input characters, 64,000 reply characters, 100 thread
records, 2,000 records and a 1,500,000-byte history admission budget, with reply
headroom reserved before dispatch. Concurrent clients can exceed an admission
threshold because the native API has no CAS/quota transaction. Existing records
are never pruned to make space. Reaching any cap disables new sends until an
explicitly authorized cleanup creates room. An oversized reply remains visible and marked
save-unconfirmed instead of being truncated. Its session-only loss warning
follows the actual reply, so reaching the reply tail also reaches the warning.
### Fourteen-day history visibility without deletion

The Chat History page shows only conversations whose latest stored activity is
no more than 14 days old. The comparison uses each derived thread's `updatedAt`
value; a thread exactly at the cutoff remains visible. Older threads remain in
the authenticated user's Home Assistant frontend store and continue to count
toward the existing record, thread, and byte admission limits. Filtering is a
presentation rule only: it does not write tombstones, prune records, or send
conversation contents to Home MCP.

The `sfenton_react_chat` package no longer schedules deletion. The custom
integration retains its manual `sfenton_react_chat.purge_expired_history`
service for an explicitly authorized cleanup, but normal deployment and runtime
must not invoke it. If an earlier package version loaded the daily purge
automation, changing the package does not remove that live automation until Home
Assistant is restarted or the relevant YAML integrations are reloaded. Verify
the old automation is absent before claiming stored conversations are protected
from scheduled deletion.

See the [component installation and rollback checklist](../home-assistant/custom_components/sfenton_react_chat/README.md)
for SMB paths, SSH staging support, restart requirements, and the manual service's
operating limits. No real histories were read or deleted to implement or test
this behavior.

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
