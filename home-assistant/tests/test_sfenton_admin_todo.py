"""Admin To-Do attachment storage contract tests."""

# @covers home-assistant/custom_components/sfenton_admin_todo/__init__.py
# @covers home-assistant/custom_components/sfenton_admin_todo/attachment_store.py
# @covers home-assistant/custom_components/sfenton_admin_todo/manifest.json
# @covers home-assistant/packages/sfenton_admin_todo.yaml

from __future__ import annotations

from datetime import UTC, datetime, timedelta
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(
    0,
    str(
        Path(__file__).resolve().parents[1]
        / "custom_components"
        / "sfenton_admin_todo"
    ),
)

from attachment_store import (  # noqa: E402
    ATTACHMENT_RETENTION,
    MAX_ATTACHMENT_BYTES,
    attachment_manifest,
    attachment_path,
    cleanup_expired,
    validate_attachment,
)


PNG = (
    b"\x89PNG\r\n\x1a\n"
    + b"\x00" * 8
    + b"IEND\xaeB`\x82"
)


class AdminTodoAttachmentTests(unittest.TestCase):
    def test_home_assistant_endpoint_requires_admin_and_creates_the_targeted_todo(self) -> None:
        component_root = (
            Path(__file__).resolve().parents[1]
            / "custom_components"
            / "sfenton_admin_todo"
        )
        source = (component_root / "__init__.py").read_text()
        self.assertIn("if not user.is_admin:", source)
        self.assertIn('"todo",\n                "add_item"', source)
        self.assertIn('target={"entity_id": entity_id}', source)
        self.assertIn("MAX_REQUEST_BYTES", source)
        self.assertIn("async_track_time_interval", source)
        self.assertIn("timedelta(days=1)", source)
        manifest = json.loads((component_root / "manifest.json").read_text())
        self.assertEqual(manifest["domain"], "sfenton_admin_todo")
        self.assertIn("todo", manifest["dependencies"])

    def test_validates_image_bytes_and_builds_controller_manifest(self) -> None:
        attachment = validate_attachment(PNG, "reported-gap.png", "image/png")
        self.assertEqual(attachment.media_type, "image/png")
        self.assertEqual(attachment.name, "reported-gap.png")
        marker = attachment_manifest([attachment])
        self.assertTrue(marker.startswith("<!-- admin-todo-attachments:"))
        payload = json.loads(marker.removeprefix("<!-- admin-todo-attachments:").removesuffix(" -->"))
        self.assertEqual(payload["version"], 1)
        self.assertEqual(payload["attachments"][0]["sha256"], attachment.sha256)
        self.assertEqual(payload["attachments"][0]["sizeBytes"], len(PNG))

    def test_rejects_untrusted_type_size_and_name_inputs(self) -> None:
        with self.assertRaisesRegex(ValueError, "unsupported_image_type"):
            validate_attachment(b"not an image", "report.png", "image/png")
        with self.assertRaisesRegex(ValueError, "image_type_mismatch"):
            validate_attachment(PNG, "report.jpg", "image/jpeg")
        with self.assertRaisesRegex(ValueError, "invalid_image_size"):
            validate_attachment(b"x" * (MAX_ATTACHMENT_BYTES + 1), "report.png", None)
        with self.assertRaisesRegex(ValueError, "invalid_image_name"):
            validate_attachment(PNG, "../<report>.png", "image/png")

    def test_resolves_only_uuid_paths_and_cleans_expired_files(self) -> None:
        attachment = validate_attachment(PNG, "report.png", "image/png")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = attachment_path(root, attachment.attachment_id)
            path.write_bytes(PNG)
            current_time = datetime.now(UTC)
            old_time = current_time - ATTACHMENT_RETENTION - timedelta(seconds=1)
            timestamp = old_time.timestamp()
            path.touch()
            import os
            os.utime(path, (timestamp, timestamp))
            self.assertEqual(cleanup_expired(root, current_time), [path])
            self.assertFalse(path.exists())
            with self.assertRaisesRegex(ValueError, "invalid_attachment_id"):
                attachment_path(root, "../outside")


if __name__ == "__main__":
    unittest.main()
