"""Delegate the Xbox media source to the built-in integration."""

from homeassistant.components.xbox.media_source import (
    async_get_media_source as async_get_media_source,
)

__all__ = ["async_get_media_source"]
