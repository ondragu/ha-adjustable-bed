"""Preset and memory-position button entities."""

from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CONF_NAME,
    CONF_PRESETS,
    DOMAIN,
    SIDE_LEFT,
)

LOGGER = logging.getLogger(__name__)


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


class AdjustableBedPresetButton(ButtonEntity):
    """A preset or memory position backed by a user-selected entity."""

    _attr_should_poll = False
    _attr_has_entity_name = True

    def __init__(
        self,
        entry: ConfigEntry,
        index: int,
        preset: dict,
    ) -> None:
        self._entry = entry
        self._index = index
        self._preset = preset

        self._attr_name = preset["name"]
        self._attr_unique_id = f"{entry.entry_id}_preset_{index}"

        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_{SIDE_LEFT}")},
            name=entry.data[CONF_NAME],
            manufacturer="Entity Bridge",
            model="Relay-controlled adjustable bed",
        )

    @property
    def extra_state_attributes(self) -> dict:
        """Expose the configured target entity for diagnostics."""
        return {
            "preset": True,
            "preset_index": self._index,
            "target_entity": self._preset["entity"],
        }

    async def async_press(self) -> None:
        """Trigger the configured preset entity."""
        entity_id = self._preset["entity"]
        domain = entity_id.split(".")[0]

        if domain == "button":
            service = "press"
        elif domain in ("script", "scene", "switch"):
            service = "turn_on"
        else:
            raise HomeAssistantError(
                f"Nicht unterstützter Entitätstyp für Preset: {entity_id}"
            )

        await self.hass.services.async_call(
            domain,
            service,
            {"entity_id": entity_id},
            blocking=True,
        )
