"""Delegate Xbox diagnostics to the built-in integration."""

from homeassistant.components.xbox.diagnostics import (
    async_get_config_entry_diagnostics as async_get_config_entry_diagnostics,
)

__all__ = ["async_get_config_entry_diagnostics"]
