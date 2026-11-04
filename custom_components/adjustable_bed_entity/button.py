"""Preset and memory-position button entities."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CONF_NAME,
    CONF_PRESETS,
    CONF_SIDES,
    DOMAIN,
    SIDE_LEFT,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up preset buttons from a config entry."""
    presets = entry.data.get(CONF_PRESETS, [])

    if not presets:
        return

    async_add_entities(
        [
            AdjustableBedPresetButton(entry, index, preset)
            for index, preset in enumerate(presets)
        ]
    )


class AdjustableBedPresetButton(BaseException):
    pass
