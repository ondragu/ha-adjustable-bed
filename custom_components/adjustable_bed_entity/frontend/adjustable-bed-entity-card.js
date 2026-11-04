/**
 * Adjustable Bed Entity Card
 *
 * Generic Lovelace card for the Adjustable Bed Entity Bridge integration.
 * It resolves bed covers and preset buttons from a Home Assistant device.
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
    return 6;
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
    const result = { head: null, foot: null, presets: [] };
    if (!hass) return result;

    for (const entity of this._deviceEntities()) {
      const state = hass.states[entity.entity_id];
      if (!state) continue;

      if (entity.domain === "cover") {
        if (state.attributes.part === "head") result.head = entity.entity_id;
        if (state.attributes.part === "foot") result.foot = entity.entity_id;
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

  update() {
    if (!this._hass || !this._config) return;

    const entities = this._resolveEntities();
    const head = entities.head ? this._hass.states[entities.head] : null;
    const foot = entities.foot ? this._hass.states[entities.foot] : null;

    const headPos = head?.attributes.current_position ?? 0;
    const footPos = foot?.attributes.current_position ?? 0;
    const headAngle = head?.attributes.angle ?? "--";
    const footAngle = foot?.attributes.angle ?? "--";

    const presetHtml = entities.presets.length
      ? `<div class="presets">${entities.presets
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
        .bed { position: relative; height: 150px; margin-bottom: 16px; }
        .mattress { position: absolute; left: 10%; right: 10%; top: 55px; height: 34px; border-radius: 10px; background: var(--secondary-background-color, #eee); }
        .section { position: absolute; height: 30px; border-radius: 8px; background: var(--primary-color, #03a9f4); transition: transform .25s ease; }
        .head { left: 10%; width: 30%; top: 57px; transform-origin: left center; }
        .foot { left: 60%; width: 30%; top: 57px; transform-origin: right center; }
        .labels { display: flex; justify-content: space-between; font-size: 12px; opacity: .75; margin-bottom: 10px; }
        .controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        button { border: none; border-radius: 12px; padding: 12px 8px; cursor: pointer; background: var(--secondary-background-color, #f2f2f2); }
        .stop { grid-column: span 3; background: var(--error-color, #db4437); color: white; }
        .presets { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
        .preset { padding: 10px 14px; }
        input[type=range] { width: 100%; margin: 8px 0 16px; }
        .empty { opacity: .7; }
      </style>
      <ha-card>
        <h3>${this._config.title || "Verstellbares Bett"}</h3>
        ${
          entities.head || entities.foot
            ? `
              <div class="labels">
                <span>Kopfteil: ${headPos}% · ${headAngle}°</span>
                <span>Fußteil: ${footPos}% · ${footAngle}°</span>
              </div>
              <div class="bed">
                <div class="mattress"></div>
                <div class="section head" style="transform: rotate(${-headPos * 0.6}deg)"></div>
                <div class="section foot" style="transform: rotate(${footPos * 0.45}deg)"></div>
              </div>
              <input type="range" min="0" max="100" value="${headPos}" id="head-slider" />
              <div class="controls">
                <button id="head-up">Kopf ↑</button>
                <button id="head-stop">Kopf Stop</button>
                <button id="head-down">Kopf ↓</button>
              </div>
              <input type="range" min="0" max="100" value="${footPos}" id="foot-slider" />
              <div class="controls">
                <button id="foot-up">Fuß ↑</button>
                <button id="foot-stop">Fuß Stop</button>
                <button id="foot-down">Fuß ↓</button>
              </div>
              <button class="stop" id="all-stop">Alles stoppen</button>
              ${presetHtml}
            `
            : `<div class="empty">Keine passenden Cover gefunden.</div>`
        }
      </ha-card>
    `;

    if (!entities.head || !entities.foot) return;

    const bind = (id, event, handler) => {
      const element = this.shadowRoot.getElementById(id);
      if (element) element.addEventListener(event, handler);
    };

    bind("head-up", "pointerdown", () => this._hold(entities.head, "up"));
    bind("head-down", "pointerdown", () => this._hold(entities.head, "down"));
    bind("head-up", "pointerup", () => this._release(entities.head));
    bind("head-down", "pointerup", () => this._release(entities.head));
    bind("head-stop", "click", () => this._release(entities.head));

    bind("foot-up", "pointerdown", () => this._hold(entities.foot, "up"));
    bind("foot-down", "pointerdown", () => this._hold(entities.foot, "down"));
    bind("foot-up", "pointerup", () => this._release(entities.foot));
    bind("foot-down", "pointerup", () => this._release(entities.foot));
    bind("foot-stop", "click", () => this._release(entities.foot));

    bind("all-stop", "click", () => {
      this._release(entities.head);
      this._release(entities.foot);
    });

    bind("head-slider", "change", (event) =>
      this._cover("set_cover_position", entities.head, {
        position: Number(event.target.value),
      })
    );

    bind("foot-slider", "change", (event) =>
      this._cover("set_cover_position", entities.foot, {
        position: Number(event.target.value),
      })
    );

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
