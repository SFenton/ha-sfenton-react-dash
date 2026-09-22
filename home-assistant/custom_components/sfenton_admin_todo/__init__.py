"""Authenticated Admin To-Do creation with temporary image attachments."""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from pathlib import Path

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.components.http.const import KEY_HASS_USER
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.typing import ConfigType

from .attachment_store import (
    MAX_ATTACHMENTS,
    MAX_ATTACHMENT_BYTES,
    attachment_manifest,
    attachment_path,
    cleanup_expired,
    validate_attachment,
)

DOMAIN = "sfenton_admin_todo"
MAX_REQUEST_BYTES = MAX_ATTACHMENTS * MAX_ATTACHMENT_BYTES + 256 * 1024
CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)


def _require_admin(request: web.Request) -> None:
    user = request.get(KEY_HASS_USER)
    if user is None:
        raise web.HTTPUnauthorized()
    if not user.is_admin:
        raise web.HTTPForbidden()


class AdminTodoCreateView(HomeAssistantView):
    """Create one Admin To-Do item and its attachment manifest."""

    url = "/api/sfenton_admin_todo"
    name = "api:sfenton_admin_todo"
    requires_auth = True

    def __init__(self, hass: HomeAssistant, storage_root: Path) -> None:
        self._hass = hass
        self._storage_root = storage_root

    async def post(self, request: web.Request) -> web.Response:
        _require_admin(request)
        if request.content_length is not None and request.content_length > MAX_REQUEST_BYTES:
            raise web.HTTPRequestEntityTooLarge(
                max_size=MAX_REQUEST_BYTES,
                actual_size=request.content_length,
            )
        reader = await request.multipart()
        entity_id = ""
        item = ""
        attachments = []
        async for part in reader:
            if part.name == "entity_id":
                entity_id = (await part.text()).strip()
                continue
            if part.name == "item":
                item = (await part.text()).strip()
                continue
            if part.name != "images":
                continue
            if len(attachments) >= MAX_ATTACHMENTS:
                raise web.HTTPBadRequest(text="too_many_images")
            payload = bytearray()
            while chunk := await part.read_chunk():
                payload.extend(chunk)
                if len(payload) > MAX_ATTACHMENT_BYTES:
                    raise web.HTTPRequestEntityTooLarge(
                        max_size=MAX_ATTACHMENT_BYTES,
                        actual_size=len(payload),
                    )
            try:
                attachments.append(
                    validate_attachment(
                        bytes(payload),
                        part.filename or "",
                        part.headers.get("Content-Type"),
                    )
                )
            except ValueError as error:
                raise web.HTTPBadRequest(text=str(error)) from error

        if not entity_id.startswith("todo.") or not item or len(item) > 1000:
            raise web.HTTPBadRequest(text="invalid_task")
        if not attachments:
            raise web.HTTPBadRequest(text="images_required")

        stored_paths: list[Path] = []
        try:
            for attachment in attachments:
                path = attachment_path(self._storage_root, attachment.attachment_id)
                descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(descriptor, "wb") as target:
                    target.write(attachment.bytes)
                stored_paths.append(path)
            await self._hass.services.async_call(
                "todo",
                "add_item",
                {
                    "description": attachment_manifest(attachments),
                    "item": item,
                },
                blocking=True,
                target={"entity_id": entity_id},
            )
        except Exception:
            for path in stored_paths:
                path.unlink(missing_ok=True)
            raise

        return self.json(
            {
                "attachments": [
                    attachment.manifest_entry() for attachment in attachments
                ],
                "created": True,
            }
        )


class AdminTodoAttachmentView(HomeAssistantView):
    """Read or remove one validated temporary attachment."""

    url = "/api/sfenton_admin_todo/attachments/{attachment_id}"
    name = "api:sfenton_admin_todo_attachment"
    requires_auth = True

    def __init__(self, storage_root: Path) -> None:
        self._storage_root = storage_root

    async def get(
        self,
        request: web.Request,
        attachment_id: str,
    ) -> web.StreamResponse:
        _require_admin(request)
        try:
            path = attachment_path(self._storage_root, attachment_id)
        except ValueError as error:
            raise web.HTTPNotFound() from error
        if not path.is_file() or path.is_symlink():
            raise web.HTTPNotFound()
        return web.FileResponse(
            path,
            headers={
                "Cache-Control": "no-store",
                "Content-Disposition": "inline",
                "X-Content-Type-Options": "nosniff",
            },
        )

    async def delete(
        self,
        request: web.Request,
        attachment_id: str,
    ) -> web.Response:
        _require_admin(request)
        try:
            path = attachment_path(self._storage_root, attachment_id)
        except ValueError as error:
            raise web.HTTPNotFound() from error
        if not path.is_file() or path.is_symlink():
            raise web.HTTPNotFound()
        path.unlink()
        return web.Response(status=204)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register authenticated Admin To-Do attachment endpoints."""

    storage_root = Path(hass.config.path(".storage", "sfenton_admin_todo"))
    await hass.async_add_executor_job(storage_root.mkdir, 0o700, True, True)
    await hass.async_add_executor_job(cleanup_expired, storage_root)

    async def cleanup_stored_attachments(_now: datetime) -> None:
        await hass.async_add_executor_job(cleanup_expired, storage_root)

    async_track_time_interval(
        hass,
        cleanup_stored_attachments,
        timedelta(days=1),
    )
    hass.http.register_view(AdminTodoCreateView(hass, storage_root))
    hass.http.register_view(AdminTodoAttachmentView(storage_root))
    return True
