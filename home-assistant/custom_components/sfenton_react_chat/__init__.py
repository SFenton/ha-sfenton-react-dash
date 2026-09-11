"""Optional manual cleanup for React dashboard conversation history."""

import asyncio
import logging

import voluptuous as vol

from homeassistant.components.frontend.storage import async_user_store
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.util import dt as dt_util

from .retention import select_expired_records

DOMAIN = "sfenton_react_chat"
CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)
_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the manual cleanup service; the package does not schedule it."""
    lock = asyncio.Lock()

    async def purge_expired_history(call: ServiceCall) -> None:
        async with lock:
            now_ms = dt_util.utcnow().timestamp() * 1000
            users = await hass.auth.async_get_users()
            threads = records = changed = 0
            for user in users:
                try:
                    store = await async_user_store(hass, user.id)
                    keys, _ = select_expired_records(store.data, now_ms)
                    selected = [(key, store.data[key]) for key in keys]
                    for key, original in selected:
                        # Frontend writes may replace a record while a save yields.
                        if store.data.get(key) is not original:
                            changed += 1
                            continue
                        await store.async_set_item(key, None)
                        records += 1
                        threads += original["kind"] == "thread"
                except (HomeAssistantError, OSError, ValueError):
                    _LOGGER.error("Chat retention failed; some payloads may already be cleared")
                    raise HomeAssistantError("Chat retention did not complete") from None
            _LOGGER.info(
                "Chat retention completed: users=%d threads=%d records=%d changed=%d",
                len(users), threads, records, changed,
            )

    hass.services.async_register(
        DOMAIN, "purge_expired_history", purge_expired_history, schema=vol.Schema({})
    )
    return True
