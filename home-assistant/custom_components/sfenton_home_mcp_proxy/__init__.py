"""Authenticated same-origin proxy for the app-facing Home MCP service."""

from functools import partial
import logging
from pathlib import Path
import ssl

import voluptuous as vol
from aiohttp import ClientError, ClientTimeout, web

from homeassistant.components.http import HomeAssistantView
from homeassistant.components.http.const import KEY_HASS_USER
from homeassistant.const import CONF_URL
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.typing import ConfigType

DOMAIN = "sfenton_home_mcp_proxy"
DEFAULT_URL = "https://192.168.1.155:8787/mcp"
MAX_BODY_BYTES = 1_000_000
PINNED_CERTIFICATE = Path(__file__).with_name("home-mcp-server.crt")
CONFIG_SCHEMA = vol.Schema(
    {
        DOMAIN: vol.Schema(
            {vol.Optional(CONF_URL, default=DEFAULT_URL): cv.url}
        )
    },
    extra=vol.ALLOW_EXTRA,
)
_LOGGER = logging.getLogger(__name__)


class HomeMcpProxyView(HomeAssistantView):
    """Forward authenticated dashboard requests to the narrow MCP service."""

    url = "/api/sfenton_home_mcp"
    name = "api:sfenton_home_mcp"
    requires_auth = True

    def __init__(
        self, hass: HomeAssistant, upstream_url: str, ssl_context: ssl.SSLContext
    ) -> None:
        self._session = async_get_clientsession(hass)
        self._upstream_url = upstream_url
        self._ssl_context = ssl_context

    async def post(self, request: web.Request) -> web.Response:
        authorization = request.headers.get("Authorization")
        user = request.get(KEY_HASS_USER)
        if not authorization or user is None:
            raise web.HTTPUnauthorized()
        if request.content_length is not None and request.content_length > MAX_BODY_BYTES:
            raise web.HTTPRequestEntityTooLarge(
                max_size=MAX_BODY_BYTES, actual_size=request.content_length
            )

        try:
            payload = await request.read()
            if len(payload) > MAX_BODY_BYTES:
                raise web.HTTPRequestEntityTooLarge(
                    max_size=MAX_BODY_BYTES, actual_size=len(payload)
                )
            async with self._session.post(
                self._upstream_url,
                data=payload,
                headers={
                    "Authorization": authorization,
                    "Content-Type": "application/json",
                },
                ssl=self._ssl_context,
                timeout=ClientTimeout(total=65),
            ) as response:
                body = await response.read()
                return web.Response(
                    body=body,
                    status=response.status,
                    content_type="application/json",
                )
        except (ClientError, TimeoutError):
            _LOGGER.warning("Home MCP upstream request failed")
            raise web.HTTPBadGateway(text="Home MCP is unavailable") from None


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the authenticated proxy endpoint."""
    upstream_url = str(config[DOMAIN][CONF_URL])
    ssl_context = await hass.async_add_executor_job(
        partial(ssl.create_default_context, cafile=PINNED_CERTIFICATE)
    )
    hass.http.register_view(HomeMcpProxyView(hass, upstream_url, ssl_context))
    return True
