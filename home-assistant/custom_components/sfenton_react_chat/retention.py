"""Conservative, dependency-free selection of current chat history payloads."""

import math
import re
from collections.abc import Mapping

PREFIX = "react-dash.chat.v1."
RETENTION_MS = 14 * 24 * 60 * 60 * 1000
_IDENTIFIER = re.compile(r"[a-zA-Z0-9_-]{1,100}", re.ASCII)
_AGENT = re.compile(r"conversation\.[a-z0-9_]+", re.ASCII)


def _identifier(value):
    return isinstance(value, str) and _IDENTIFIER.fullmatch(value) is not None


def _timestamp(value):
    return (
        type(value) in (int, float)
        and 0 <= value <= 8_640_000_000_000_000
        and math.isfinite(value)
    )


def _nullable_string(value):
    return value is None or isinstance(value, str)


def valid_record(key, value):
    """Mirror the v1 frontend parser, including the exact key/record identity."""
    if not isinstance(key, str) or not key.startswith(PREFIX):
        return False
    if not isinstance(value, dict) or type(value.get("version")) not in (int, float) or value["version"] != 1:
        return False
    if not _identifier(value.get("id")) or not _timestamp(value.get("createdAt")):
        return False
    kind = value.get("kind")
    if key != f"{PREFIX}{kind}.{value['id']}":
        return False
    if kind == "thread":
        return (
            isinstance(value.get("agentId"), str)
            and _AGENT.fullmatch(value["agentId"]) is not None
            and isinstance(value.get("agentName"), str)
            and bool(value["agentName"].strip())
        )
    if not _identifier(value.get("threadId")):
        return False
    if kind == "request":
        return (
            "parentId" in value
            and (value["parentId"] is None or _identifier(value["parentId"]))
            and _identifier(value.get("clientId"))
            and isinstance(value.get("text"), str)
            and bool(value["text"].strip())
            and "conversationId" in value
            and _nullable_string(value["conversationId"])
        )
    if kind == "result":
        return (
            "text" in value and _nullable_string(value["text"])
            and "conversationId" in value and _nullable_string(value["conversationId"])
            and value.get("response") in ("answer", "error", "empty")
            and type(value.get("contextReset")) is bool
        )
    return kind in ("pending", "unknown", "not-sent")


def select_expired_records(data: Mapping, now_ms: float) -> tuple[list[str], int]:
    """Select payloads at least fourteen days old, never unknown/malformed data."""
    if not _timestamp(now_ms):
        raise ValueError("Invalid retention clock")
    cutoff = now_ms - RETENTION_MS
    records = {key: value for key, value in data.items() if valid_record(key, value)}
    expired = {
        value["id"] for value in records.values()
        if value["kind"] == "thread" and value["createdAt"] <= cutoff
    }
    selected = []
    for key, value in records.items():
        if value["kind"] == "thread":
            continue
        thread_id = value["threadId"]
        thread_key = f"{PREFIX}thread.{thread_id}"
        # A malformed/unknown thread is not an orphan we can safely identify.
        orphan = thread_key not in data or data[thread_key] is None
        if thread_id in expired or (orphan and value["createdAt"] <= cutoff):
            selected.append(key)
    # Keep thread metadata until its children are cleared so retries retain scope.
    selected.extend(
        key for key, value in records.items()
        if value["kind"] == "thread" and value["id"] in expired
    )
    return selected, len(expired)
