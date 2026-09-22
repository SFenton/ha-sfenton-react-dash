"""Validated temporary image storage for Admin To-Do reports."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import hashlib
import json
from pathlib import Path
import re
from uuid import UUID, uuid4

MAX_ATTACHMENTS = 4
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
ATTACHMENT_RETENTION = timedelta(days=14)
ATTACHMENT_ID_PATTERN = re.compile(
    r"^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ValidatedAttachment:
    """Validated image metadata and bytes."""

    attachment_id: str
    bytes: bytes
    media_type: str
    name: str
    sha256: str

    @property
    def size_bytes(self) -> int:
        """Return the exact payload size."""

        return len(self.bytes)

    def manifest_entry(self) -> dict[str, object]:
        """Return the public manifest metadata."""

        return {
            "id": self.attachment_id,
            "mediaType": self.media_type,
            "name": self.name,
            "sha256": self.sha256,
            "sizeBytes": self.size_bytes,
        }


def _media_type(payload: bytes) -> str:
    if (
        len(payload) >= 20
        and payload[:8] == b"\x89PNG\r\n\x1a\n"
        and payload[-8:] == b"IEND\xaeB`\x82"
    ):
        return "image/png"
    if (
        len(payload) >= 4
        and payload[:3] == b"\xff\xd8\xff"
        and payload[-2:] == b"\xff\xd9"
    ):
        return "image/jpeg"
    if (
        len(payload) >= 12
        and payload[:4] == b"RIFF"
        and payload[8:12] == b"WEBP"
        and int.from_bytes(payload[4:8], "little") + 8 == len(payload)
    ):
        return "image/webp"
    raise ValueError("unsupported_image_type")


def validate_attachment(
    payload: bytes,
    filename: str,
    declared_media_type: str | None,
) -> ValidatedAttachment:
    """Validate one bounded PNG, JPEG, or WebP image."""

    if not payload or len(payload) > MAX_ATTACHMENT_BYTES:
        raise ValueError("invalid_image_size")
    media_type = _media_type(payload)
    if declared_media_type and declared_media_type.lower() != media_type:
        raise ValueError("image_type_mismatch")
    name = Path(filename).name.strip().replace("--", "-")
    if not name or len(name) > 240 or "<" in name or ">" in name:
        raise ValueError("invalid_image_name")
    attachment_id = str(uuid4())
    return ValidatedAttachment(
        attachment_id=attachment_id,
        bytes=payload,
        media_type=media_type,
        name=name,
        sha256=hashlib.sha256(payload).hexdigest(),
    )


def attachment_manifest(attachments: list[ValidatedAttachment]) -> str:
    """Build the description marker consumed by the host controller."""

    if not 1 <= len(attachments) <= MAX_ATTACHMENTS:
        raise ValueError("invalid_attachment_count")
    payload = {
        "version": 1,
        "attachments": [attachment.manifest_entry() for attachment in attachments],
    }
    return f"<!-- admin-todo-attachments:{json.dumps(payload, separators=(',', ':'))} -->"


def attachment_path(root: Path, attachment_id: str) -> Path:
    """Resolve a validated attachment ID below the storage root."""

    if not ATTACHMENT_ID_PATTERN.fullmatch(attachment_id):
        raise ValueError("invalid_attachment_id")
    UUID(attachment_id)
    return root / attachment_id


def cleanup_expired(root: Path, current_time: datetime | None = None) -> list[Path]:
    """Delete expired regular files and return the removed paths."""

    if not root.exists():
        return []
    cutoff = (current_time or datetime.now(UTC)) - ATTACHMENT_RETENTION
    removed: list[Path] = []
    for path in root.iterdir():
        if not path.is_file() or path.is_symlink():
            continue
        modified = datetime.fromtimestamp(path.stat().st_mtime, UTC)
        if modified < cutoff:
            path.unlink()
            removed.append(path)
    return removed
