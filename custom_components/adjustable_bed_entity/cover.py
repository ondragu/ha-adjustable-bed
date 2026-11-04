"""Cover entities for relay-controlled adjustable beds."""

from __future__ import annotations

import asyncio
import logging

from homeassistant.components.cover import (
    CoverDeviceClass,
    CoverEntity,
    CoverEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CONF_FOOT_DOWN,
    CONF_FOOT_MAX,
    CONF_FOOT_MIN,
    CONF_FOOT_SENSOR,
    CONF_FOOT_UP,
    CONF_HEAD_DOWN,
    CONF_HEAD_MAX,
    CONF_HEAD_MIN,
    CONF_HEAD_SENSOR,
    CONF_HEAD_UP,
    CONF_NAME,
    CONF_SIDES,
    DOMAIN,
    FOOT,
    HEAD,
    SIDE_LEFT,
)

LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up bed covers from a config entry."""
    entities = []

    for side_id, side in entry.data[CONF_SIDES].items():
        prefix = "" if side_id == SIDE_LEFT else f"{side_id.capitalize()} "

        entities.extend(
            [
                AdjustableBedCover(
                    entry,
                    side_id,
                    HEAD,
                    f"{prefix}Kopfteil",
                    side[CONF_HEAD_UP],
                    side[CONF_HEAD_DOWN],
                    side[CONF_HEAD_SENSOR],
                    side[CONF_HEAD_MIN],
                    side[CONF_HEAD_MAX],
                ),
                AdjustableBedCover(
                    entry,
                    side_id,
                    FOOT,
                    f"{prefix}Fußteil",
                    side[CONF_FOOT_UP],
                    side[CONF_FOOT_DOWN],
                    side[CONF_FOOT_SENSOR],
                    side[CONF_FOOT_MIN],
                    side[CONF_FOOT_MAX],
                ),
            ]
        )

    async_add_entities(entities)


class AdjustableBedCover(CoverEntity):
    """A bed part controlled by relay switches and measured by an angle sensor."""

    _attr_should_poll = False
    _attr_device_class = CoverDeviceClass.DAMPER
    _attr_supported_features = (
        CoverEntityFeature.OPEN
        | CoverEntityFeature.CLOSE
        | CoverEntityFeature.STOP
        | CoverEntityFeature.SET_POSITION
    )

    def __init__(
        self,
        entry: ConfigEntry,
        side_id: str,
        kind: str,
        name: str,
        up_switch: str,
        down_switch: str,
        sensor_entity: str,
        angle_min: float,
        angle_max: float,
    ) -> None:
        self._entry = entry
        self._side_id = side_id
        self._kind = kind
        self._up_switch = up_switch
        self._down_switch = down_switch
        self._sensor_entity = sensor_entity
        self._angle_min = angle_min
        self._angle_max = angle_max

        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_{side_id}_{kind}"
        self._attr_has_entity_name = True

        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_{side_id}")},
            name=f"{entry.data[CONF_NAME]} {side_id.capitalize()}",
            manufacturer="Entity Bridge",
            model="Relay-controlled adjustable bed",
        )

        self._move_task: asyncio.Task | None = None

    async def async_will_remove_from_hass(self) -> None:
        """Stop movement when the entity is removed."""
        await self.async_stop_cover()

    @property
    def angle(self) -> float | None:
        """Return the current measured angle."""
        state = self.hass.states.get(self._sensor_entity)

        if state is None or state.state in ("unknown", "unavailable"):
            return None

        try:
            return float(state.state)
        except (TypeError, ValueError):
            return None

    @property
    def current_cover_position(self) -> int | None:
        """Return the current position as a percentage."""
        angle = self.angle

        if angle is None:
            return None

        span = self._angle_max - self._angle_min

        if span <= 0:
            return 0

        return max(0, min(100, round((angle - self._angle_min) / span * 100)))

    @property
    def is_opening(self) -> bool | None:
        """Return whether the up relay is active."""
        return self._is_switch_on(self._up_switch)

    @property
    def is_closing(self) -> bool | None:
        """Return whether the down relay is active."""
        return self._is_switch_on(self._down_switch)

    @property
    def is_open(self) -> bool | None:
        """Return whether the bed part is not flat."""
        position = self.current_cover_position
        return None if position is None else position > 0

    @property
    def is_closed(self) -> bool | None:
        """Return whether the bed part is flat."""
        position = self.current_cover_position
        return None if position is None else position == 0

    @property
    def extra_state_attributes(self) -> dict:
        """Return useful diagnostic attributes."""
        return {
            "side": self._side_id,
            "part": self._kind,
            "angle": self.angle,
            "angle_min": self._angle_min,
            "angle_max": self._angle_max,
            "up_switch": self._up_switch,
            "down_switch": self._down_switch,
        }

    def _is_switch_on(self, entity_id: str) -> bool:
        state = self.hass.states.get(entity_id)
        return state is not None and state.state == "on"

    async def _set_switch(self, entity_id: str, turn_on: bool) -> None:
        """Turn a motor relay on or off."""
        service = "turn_on" if turn_on else "turn_off"

        await self.hass.services.async_call(
            "switch",
            service,
            {"entity_id": entity_id},
            blocking=False,
        )

    async def async_open_cover(self, **kwargs) -> None:
        """Move the bed part up while the relay remains on."""
        await self._start_move("up")

    async def async_close_cover(self, **kwargs) -> None:
        """Move the bed part down while the relay remains on."""
        await self._start_move("down")

    async def async_stop_cover(self, **kwargs) -> None:
        """Stop both relays for this bed part."""
        if self._move_task and not self._move_task.done():
            self._move_task.cancel()

        await self._set_switch(self._up_switch, False)
        await self._set_switch(self._down_switch, False)

    async def async_set_cover_position(self, **kwargs) -> None:
        """Move to a target percentage using the angle sensor."""
        target = kwargs.get("position")

        if target is None:
            return

        await self._start_move(None, target)

    async def _start_move(
        self,
        direction: str | None,
        target: int | None = None,
    ) -> None:
        """Start a directional or target-position movement."""
        await self.async_stop_cover()

        if direction == "up":
            await self._set_switch(self._up_switch, True)
            return

        if direction == "down":
            await self._set_switch(self._down_switch, True)
            return

        if target is not None:
            self._move_task = self.hass.async_create_task(
                self._move_to_position(target)
            )

    async def _move_to_position(self, target: int) -> None:
        """Move until the measured position reaches the requested target."""
        current = self.current_cover_position

        if current is None:
            return

        if target > current:
            move_switch = self._up_switch
            increasing = True
        elif target < current:
            move_switch = self._down_switch
            increasing = False
        else:
            return

        await self._set_switch(move_switch, True)

        try:
            while True:
                await asyncio.sleep(0.2)

                position = self.current_cover_position

                if position is None:
                    break

                if increasing and position >= target:
                    break

                if not increasing and position <= target:
                    break
        except asyncio.CancelledError:
            pass
        finally:
            await self._set_switch(self._up_switch, False)
            await self._set_switch(self._down_switch, False)
            self.async_write_ha_state()
