"""Config flow for the Adjustable Bed Entity Bridge integration."""

from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    SelectSelector,
    SelectSelectorConfig,
    TextSelector,
)

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
    CONF_PRESETS,
    CONF_SIDES,
    DOMAIN,
    MAX_PRESETS,
    SIDE_LEFT,
    SIDE_RIGHT,
)

SWITCH = EntitySelector(EntitySelectorConfig(domain="switch"))
SENSOR = EntitySelector(EntitySelectorConfig(domain="sensor"))
PRESET_ENTITY = EntitySelector(
    EntitySelectorConfig(domain=["button", "script", "scene", "switch"])
)

ANGLE = NumberSelector(
    NumberSelectorConfig(min=-90, max=90, step=0.1, mode="box")
)

SIDE_SELECTOR = SelectSelector(
    SelectSelectorConfig(
        options=["one", "two"],
        translation_key="sides",
    )
)


def side_schema(data: dict | None = None) -> vol.Schema:
    """Build the entity-selection schema for one bed side."""
    data = data or {}

    return vol.Schema(
        {
            vol.Required(CONF_HEAD_UP, default=data.get(CONF_HEAD_UP)): SWITCH,
            vol.Required(CONF_HEAD_DOWN, default=data.get(CONF_HEAD_DOWN)): SWITCH,
            vol.Required(CONF_HEAD_SENSOR, default=data.get(CONF_HEAD_SENSOR)): SENSOR,
            vol.Required(CONF_HEAD_MIN, default=data.get(CONF_HEAD_MIN, 0)): ANGLE,
            vol.Required(CONF_HEAD_MAX, default=data.get(CONF_HEAD_MAX, 60)): ANGLE,
            vol.Required(CONF_FOOT_UP, default=data.get(CONF_FOOT_UP)): SWITCH,
            vol.Required(CONF_FOOT_DOWN, default=data.get(CONF_FOOT_DOWN)): SWITCH,
            vol.Required(CONF_FOOT_SENSOR, default=data.get(CONF_FOOT_SENSOR)): SENSOR,
            vol.Required(CONF_FOOT_MIN, default=data.get(CONF_FOOT_MIN, 0)): ANGLE,
            vol.Required(CONF_FOOT_MAX, default=data.get(CONF_FOOT_MAX, 45)): ANGLE,
        }
    )


def presets_schema(data: list | None = None) -> vol.Schema:
    """Build the optional preset and memory-position schema."""
    data = data or []
    schema = {}

    for index in range(MAX_PRESETS):
        existing = data[index] if index < len(data) else {}

        schema[
            vol.Optional(
                f"preset_{index}_name",
                default=existing.get("name", ""),
                description="Name",
            )
        ] = TextSelector()

        schema[
            vol.Optional(
                f"preset_{index}_entity",
                default=existing.get("entity"),
                description="Entität",
            )
        ] = PRESET_ENTITY

    return vol.Schema(schema)


def parse_presets(user_input: dict) -> list[dict]:
    """Convert preset form fields into a compact configuration list."""
    presets = []

    for index in range(MAX_PRESETS):
        name = user_input.get(f"preset_{index}_name", "").strip()
        entity = user_input.get(f"preset_{index}_entity")

        if name and entity:
            presets.append({"name": name, "entity": entity})

    return presets


class AdjustableBedEntityConfigFlow(
    config_entries.ConfigFlow, domain=DOMAIN
):
    """Handle the generic entity-based bed configuration flow."""

    VERSION = 1

    def __init__(self) -> None:
        self._name: str | None = None
        self._two_sides = False
        self._left: dict | None = None

    async def async_step_user(self, user_input=None):
        """Handle the initial bed configuration."""
        if user_input is not None:
            self._name = user_input[CONF_NAME]
            self._two_sides = user_input["side_count"] == "two"
            return await self.async_step_side_left()

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_NAME, default="Verstellbares Bett"
                    ): TextSelector(),
                    vol.Required("side_count", default="one"): SIDE_SELECTOR,
                }
            ),
        )

    async def async_step_side_left(self, user_input=None):
        """Configure the left bed side."""
        if user_input is not None:
            self._left = user_input

            if self._two_sides:
                return await self.async_step_side_right()

            return await self.async_step_presets()

        return self.async_show_form(
            step_id="side_left",
            data_schema=side_schema(),
        )

    async def async_step_side_right(self, user_input=None):
        """Configure the right bed side."""
        if user_input is not None:
            self._right = user_input
            return await self.async_step_presets()

        return self.async_show_form(
            step_id="side_right",
            data_schema=side_schema(),
        )

    async def async_step_presets(self, user_input=None):
        """Configure optional presets and memory positions."""
        if user_input is not None:
            sides = {SIDE_LEFT: self._left}

            if self._two_sides:
                sides[SIDE_RIGHT] = self._right

            return self.async_create_entry(
                title=self._name,
                data={
                    CONF_NAME: self._name,
                    CONF_SIDES: sides,
                    CONF_PRESETS: parse_presets(user_input),
                },
            )

        return self.async_show_form(
            step_id="presets",
            data_schema=presets_schema(),
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return OptionsFlow(config_entry)


class OptionsFlow(config_entries.OptionsFlow):
    """Handle options for an existing bed configuration."""

    def __init__(self, config_entry) -> None:
        self.entry = config_entry

    async def async_step_init(self, user_input=None):
        """Edit optional presets and memory positions."""
        if user_input is not None:
            return self.async_create_entry(
                title="",
                data={CONF_PRESETS: parse_presets(user_input)},
            )

        return self.async_show_form(
            step_id="presets",
            data_schema=presets_schema(self.entry.data.get(CONF_PRESETS, [])),
        )
