"""Delegate Xbox remotes to the built-in integration."""

from homeassistant.components.xbox.remote import (
    PARALLEL_UPDATES as PARALLEL_UPDATES,
    async_setup_entry as async_setup_entry,
)

__all__ = ["PARALLEL_UPDATES", "async_setup_entry"]
