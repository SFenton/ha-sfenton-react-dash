"""Delegate Xbox sensors to the built-in integration."""

from homeassistant.components.xbox.sensor import (
    PARALLEL_UPDATES as PARALLEL_UPDATES,
    async_setup_entry as async_setup_entry,
)

__all__ = ["PARALLEL_UPDATES", "async_setup_entry"]
