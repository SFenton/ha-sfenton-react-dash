"""Delegate Xbox application credentials to the built-in integration."""

from homeassistant.components.xbox.application_credentials import (
    async_get_authorization_server as async_get_authorization_server,
)

__all__ = ["async_get_authorization_server"]
