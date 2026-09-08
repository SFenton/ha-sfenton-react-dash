"""Run without Home Assistant dependencies or access to user data."""

import importlib.util
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[2] / "home-assistant/custom_components/sfenton_react_chat/retention.py"
SPEC = importlib.util.spec_from_file_location("retention", SOURCE)
retention = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(retention)
NOW = retention.RETENTION_MS * 2
CUTOFF = NOW - retention.RETENTION_MS


def record(kind="thread", id="thread", created_at=CUTOFF, **extra):
    value = dict(version=1, kind=kind, id=id, createdAt=created_at)
    if kind == "thread":
        value.update(agentId="conversation.test", agentName="Test")
    else:
        value.update(threadId="thread")
    if kind == "request":
        value.update(parentId=None, clientId="client", text="Question", conversationId=None)
    if kind == "result":
        value.update(text="Reply", conversationId=None, response="answer", contextReset=False)
    value.update(extra)
    return value


def data(*values):
    return {f"{retention.PREFIX}{v['kind']}.{v['id']}": v for v in values}


class RetentionTests(unittest.TestCase):
    def test_boundary_and_creation_not_activity(self):
        for offset, count in [(-1, 1), (0, 1), (1, 0)]:
            with self.subTest(offset=offset):
                keys, threads = retention.select_expired_records(data(record(created_at=CUTOFF + offset)), NOW)
                self.assertEqual(len(keys), count)
                self.assertEqual(threads, count)
        records = data(record(), *(record(kind=k, id="turn", created_at=NOW) for k in (
            "request", "result", "pending", "unknown", "not-sent"
        )))
        keys, threads = retention.select_expired_records(records, NOW)
        self.assertEqual(len(keys), 6)
        self.assertEqual(threads, 1)
        self.assertEqual(keys[-1], retention.PREFIX + "thread.thread")
        for key in keys:
            records[key] = None
        self.assertEqual(retention.select_expired_records(records, NOW), ([], 0))

    def test_foreign_malformed_unknown_and_tombstones(self):
        valid = record()
        records = {"theme": "dark", "react-dash.chat.v2.thread.thread": valid,
                   "react-dash.chat.v1.thread.wrong": valid, "react-dash.chat.v1.thread.null": None}
        mutations = [
            {"version": 2}, {"version": True}, {"createdAt": True}, {"createdAt": float("nan")},
            {"createdAt": float("inf")}, {"createdAt": -1}, {"createdAt": "0"},
            {"createdAt": 8_640_000_000_000_001}, {"agentId": "wrong"}, {"agentName": ""},
            {"kind": "future"}, {"id": "bad.id"},
        ]
        for mutation in mutations:
            malformed = record(**mutation)
            self.assertEqual(retention.select_expired_records(data(malformed), NOW), ([], 0))
        self.assertEqual(retention.select_expired_records(records, NOW), ([], 0))
        for kind in ("request", "result"):
            malformed = record(kind=kind)
            del malformed["conversationId"]
            self.assertEqual(retention.select_expired_records(data(malformed), NOW), ([], 0))

    def test_orphans_and_malformed_parent(self):
        for kind in ("request", "result", "pending", "unknown", "not-sent"):
            for offset, expected in [(0, 1), (1, 0)]:
                records = data(record(kind=kind, created_at=CUTOFF + offset))
                self.assertEqual(len(retention.select_expired_records(records, NOW)[0]), expected)
                records[retention.PREFIX + "thread.thread"] = {"malformed": True}
                self.assertEqual(retention.select_expired_records(records, NOW), ([], 0))
                records[retention.PREFIX + "thread.thread"] = None
                self.assertEqual(len(retention.select_expired_records(records, NOW)[0]), expected)

    def test_expired_thread_does_not_authorize_unknown_or_malformed_children(self):
        records = data(
            record(), record(kind="pending", id="valid"),
            record(kind="model-change", id="future"),
            record(kind="result", id="invalid", contextReset="false"),
        )
        keys, count = retention.select_expired_records(records, NOW)
        self.assertEqual(count, 1)
        self.assertEqual(set(keys), {
            retention.PREFIX + "thread.thread", retention.PREFIX + "pending.valid",
        })

    def test_users_do_not_share_thread_identity(self):
        old_user = data(record(), record(kind="pending", created_at=NOW))
        young_user = data(record(created_at=NOW), record(kind="pending", created_at=0))
        self.assertEqual(len(retention.select_expired_records(old_user, NOW)[0]), 2)
        self.assertEqual(retention.select_expired_records(young_user, NOW), ([], 0))
        self.assertEqual(retention.select_expired_records({}, NOW), ([], 0))

    def test_invalid_clock_fails_closed(self):
        with self.assertRaises(ValueError):
            retention.select_expired_records(data(record()), float("nan"))


if __name__ == "__main__":
    unittest.main()
