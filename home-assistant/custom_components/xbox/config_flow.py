"""Delegate Xbox config flows to the built-in integration."""

from homeassistant.components.xbox.config_flow import (
    FriendSubentryFlowHandler as FriendSubentryFlowHandler,
    OAuth2FlowHandler as OAuth2FlowHandler,
)

__all__ = ["FriendSubentryFlowHandler", "OAuth2FlowHandler"]
