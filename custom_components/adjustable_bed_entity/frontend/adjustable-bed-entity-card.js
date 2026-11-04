/**
 * Adjustable Bed Entity Card
 *
 * Generic Lovelace card for the Adjustable Bed Entity Bridge integration.
 * Automatically resolves bed covers and preset buttons from a device.
 * Supports one or two independently configured bed sides.
 */

class AdjustableBedEntityCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._deviceId = null;
  }

  setConfig(config) {
    if (!config || (!config.device && !config.device_name)) {
      throw new Error("Bitte 'device' oder 'device_name' angeben.");
    }
    this._config = config;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this._resolveDevice();
    this.update();
  }

  getCardSize() {
    return 8;
  }

  _resolveDevice() {
    const hass = this._hass;
    if (!hass || !hass.devices) return;

    if (this._config.device && hass.devices[this._config.device]) {
      this._deviceId = this._config.device;
      return;
    }

    if (this._config.device_name) {
      const match = Object.values(hass.devices).find(
        (device) => device.name === this._config.device_name
      );
      if (match) this._deviceId = match.id;
    }
  }

  _deviceEntities() {
    if (!this._hass || !this._deviceId) return [];
    return Object.values(this._hass.entities).filter(
      (entity) => entity.device_id === this._deviceId
    );
  }

  _resolveEntities() {
    const hass = this._hass;
    const result = { sides: {}, presets: [] };
    if (!hass) return result;

    for (const entity of this._deviceEntities()) {
      const state = hass.states[entity.entity_id];
      if (!state) continue;

      if (entity.domain === "cover") {
        const side = state.attributes.side || "left";
        const part = state.attributes.part;

        result.sides[side] = result.sides[side] || {
          head: null,
          foot: null,
        };

        if (part === "head") result.sides[side].head = entity.entity_id;
        if (part === "foot") result.sides[side].foot = entity.entity_id;
      }

      if (
        entity.domain === "button" &&
        state.attributes.preset === true
      ) {
        result.presets.push({
          entity_id: entity.entity_id,
          name: state.attributes.friendly_name || entity.entity_id,
        });
      }
    }

    return result;
  }

  _cover(service, entityId, data = {}) {
    this._hass.callService("cover", service, {
      entity_id: entityId,
      ...data,
    });
  }

  _hold(entityId, direction) {
    this._cover(direction === "up" ? "open_cover" : "close_cover", entityId);
  }

  _release(entityId) {
    this._cover("stop_cover", entityId);
  }

  _sideHtml(sideId, side) {
    const head = side.head ? this._hass.states[side.head] : null;
    const foot = side.foot ? this._hass.states[side.foot] : null;

    const headPos = head?.attributes.current_position ?? 0;
    const footPos = foot?.attributes.current_position ?? 0;
    const headAngle = head?.attributes.angle ?? "--";
    const footAngle = foot?.attributes.angle ?? "--";

    const title =
      Object.keys(this._entities.sides).length > 1
        ? sideId === "left"
          ? "Linke Seite"
          : "Rechte Seite"
        : "";

    return `
      <div class="side">
        ${title ? `<h4>${title}</h4>` : ""}

        <div class="labels">
          <span>Kopfteil: ${headPos}% · ${headAngle}°</span>
          <span>Fußteil: ${footPos}% · ${footAngle}°</span>
        </div>

        <div class="bed">
          <div class="mattress"></div>
          <div class="section head" style="transform: rotate(${-headPos * 0.6}deg)"></div>
          <div class="section foot" style="transform: rotate(${footPos * 0.45}deg)"></div>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value="${headPos}"
          data-side="${sideId}"
          data-part="head"
        />

        <div class="controls">
          <button data-side="${sideId}" data-part="head" data-direction="up">Kopf ↑</button>
          <button data-side="${sideId}" data-part="head" data-action="stop">Kopf Stop</button>
          <button data-side="${sideId}" data-part="head" data-direction="down">Kopf ↓</button>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value="${footPos}"
          data-side="${sideId}"
          data-part="foot"
        />

        <div class="controls">
          <button data-side="${sideId}" data-part="foot" data-direction="up">Fuß ↑</button>
          <button data-side="${sideId}" data-part="foot" data-action="stop">Fuß Stop</button>
          <button data-side="${sideId}" data-part="foot" data-direction="down">Fuß ↓</button>
        </div>

        <button
          class="stop"
          data-side="${sideId}"
          data-action="stop-all"
        >
          Seite stoppen
        </button>
      </div>
    `;
  }

  update() {
    if (!this._hass || !this._config) return;

    this._entities = this._resolveEntities();
    const sides = this._entities.sides;
    const hasCovers = Object.values(sides).some(
      (side) => side.head || side.foot
    );

    const sideHtml = Object.entries(sides)
      .map(([sideId, side]) => this._sideHtml(sideId, side))
      .join("");

    const presetHtml = this._entities.presets.length
      ? `<div class="presets">${this._entities.presets
          .map(
            (preset) =>
              `<button class="preset" data-entity="${preset.entity_id}">${preset.name}</button>`
          )
          .join("")}</div>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 18px; border-radius: 16px; }
        h3 { margin: 0 0 14px; }
        h4 { margin: 18px 0 8px; font-size: 15px; }
        .bed { position: relative; height: 130px; margin-bottom: 12px; }
        .mattress { position: absolute; left: 10%; right: 10%; top: 50px; height: 30px; border-radius: 10px; background: var(--secondary-background-color, #eee); }
        .section { position: absolute; height: 26px; border-radius: 8px; background: var(--primary-color, #03a9f4); transition: transform .25s ease; }
        .head { left: 10%; width: 30%; top: 52px; transform-origin: left center; }
        .foot { left: 60%; width: 30%; top: 52px; transform-origin: right center; }
        .labels { display: flex; justify-content: space-between; font-size: 12px; opacity: .75; margin-bottom: 8px; }
        .controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        button { border: none; border-radius: 12px; padding: 11px 8px; cursor: pointer; background: var(--secondary-background-color, #f2f2f2); }
        .stop { grid-column: span 3; margin-top: 8px; background: var(--error-color, #db4437); color: white; }
        .presets { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
        .preset { padding: 10px 14px; }
        input[type=range] { width: 100%; margin: 6px 0 12px; }
        .empty { opacity: .7; }
      </style>
      <ha-card>
        <h3>${this._config.title || "Verstellbares Bett"}</h3>
        ${hasCovers ? sideHtml : `<div class="empty">Keine passenden Cover gefunden.</div>`}
        ${presetHtml}
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll("button[data-side]").forEach((button) => {
      const sideId = button.dataset.side;
      const part = button.dataset.part;
      const direction = button.dataset.direction;
      const action = button.dataset.action;
      const side = this._entities.sides[sideId];

      button.addEventListener("click", () => {
        if (action === "stop-all") {
          if (side.head) this._release(side.head);
          if (side.foot) this._release(side.foot);
          return;
        }

        const entityId = side[part];
        if (!entityId) return;

        if (action === "stop") {
          this._release(entityId);
        } else if (direction) {
          this._hold(entityId, direction);
        }
      });
    });

    this.shadowRoot.querySelectorAll("input[type=range]").forEach((slider) => {
      const sideId = slider.dataset.side;
      const part = slider.dataset.part;
      const entityId = this._entities.sides[sideId]?.[part];

      if (!entityId) return;

      slider.addEventListener("change", (event) => {
        this._cover("set_cover_position", entityId, {
          position: Number(event.target.value),
        });
      });
    });

    this.shadowRoot.querySelectorAll("button.preset").forEach((button) => {
      button.addEventListener("click", () => {
        this._hass.callService("button", "press", {
          entity_id: button.dataset.entity,
        });
      });
    });
  }
}

customElements.define("adjustable-bed-entity-card", AdjustableBedEntityCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "adjustable-bed-entity-card",
  name: "Adjustable Bed Entity Card",
  description: "Generische Karte für die Adjustable Bed Entity Bridge.",
});
