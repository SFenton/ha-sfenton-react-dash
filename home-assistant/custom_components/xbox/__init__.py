"""Temporary Xbox integration wrapper for Home Assistant 2026.8."""

from pythonxbox.api.provider.smartglass.models import (
    CommandDestination,
    CommandResponse,
)

# Xbox Network can return a successful command response with no destination.
# python-xbox 0.2.1 fixes optional fields inside the destination object but
# still requires the object itself, so relax that one response field locally.
destination_field = CommandResponse.model_fields["destination"]
destination_field.annotation = CommandDestination | None
destination_field.default = None
CommandResponse.model_rebuild(force=True)

from homeassistant.components.xbox import (
    CONFIG_SCHEMA as CONFIG_SCHEMA,
    PLATFORMS as PLATFORMS,
    async_migrate_entry as async_migrate_entry,
    async_setup_entry as async_setup_entry,
    async_unload_entry as async_unload_entry,
)

__all__ = [
    "CONFIG_SCHEMA",
    "PLATFORMS",
    "async_migrate_entry",
    "async_setup_entry",
    "async_unload_entry",
]
