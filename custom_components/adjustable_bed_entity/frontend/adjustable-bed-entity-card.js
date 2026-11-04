/**
 * Adjustable Bed Entity Card
 *
 * Generic Lovelace card for the Adjustable Bed Entity Bridge integration.
 * It resolves the bed covers from a Home Assistant device ID or device name.
 * No entity IDs need to be configured manually.
 */

class AdjustableBedEntityCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._deviceId = null;
    this._covers = { head: null, foot: null };
  }

  setConfig(config) {
    if (!config || (!config.device && !config.device_name)) {
      throw new Error("Bitte 'device' oder 'device_name' in der Kartenkonfiguration angeben.");
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

    const wantedId = this._config.device;
    const wantedName = this._config.device_name;

    if (wantedId && hass.devices[wantedId]) {
      this._deviceId = wantedId;
      return;
    }

    if (wantedName) {
      const match = Object.values(hass.devices).find(
        (device) => device.name === wantedName
      );

      if (match) {
        this._deviceId = match.id;
        return;
      }
    }

    this._deviceId = null;
  }

  _deviceEntities() {
    const hass = this._hass;

    if (!hass || !this._deviceId) return [];

    return Object.values(hass.entities).filter(
      (entity) => entity.device_id === this._deviceId
    );
  }

  _resolveCovers() {
    const hass = this._hass;
    const covers = { head: null, foot: null };

    if (!hass) return covers;

    for (const entity of this._deviceEntities()) {
      if (entity.domain !== "cover") continue;

      const state = hass.states[entity.entity_id];

      if (!state) continue;

      const part = state.attributes.part;

      if (part === "head") {
        covers.head = entity.entity_id;
      } else if (part === "foot") {
        covers.foot = entity.entity_id;
      }
    }

    this._covers = covers;
    return covers;
  }

  _callCoverService(service, entityId, data = {}) {
    this._hass.callService("cover", service, {
      entity_id: entityId,
      ...data,
    });
  }

  _hold(entityId, direction) {
    if (!entityId) return;

    const service = direction === "up" ? "open_cover" : "close_cover";
    this._callCoverService(service, entityId);
  }

  _release(entityId) {
    if (!entityId) return;
    this._callCoverService("stop_cover", entityId);
  }

  update() {
    if (!this._hass || !this._config) return;

    const covers = this._resolveCovers();
    const headState = covers.head ? this._hass.states[covers.head] : null;
    const footState = covers.foot ? this._hass.states[covers.foot] : null;

    const headPosition = headState?.attributes.current_position ?? 0;
    const footPosition = footState?.attributes.current_position ?? 0;
    const headAngle = headState?.attributes.angle ?? "--";
    const footAngle = footState?.attributes.angle ?? "--";

    const headRotation = -headPosition * 0.6;
    const footRotation = footPosition * 0.45;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        ha-card {
          padding: 18px;
          border-radius: 16px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #111);
          box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,.12));
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
        }

        h3 {
          margin: 0 0 14px;
          font-size: 18px;
          font-weight: 600;
        }

        .bed {
          position: relative;
          height: 150px;
          margin-bottom: 18px;
        }

        .mattress {
          position: absolute;
          left: 10%;
          right: 10%;
          top: 55px;
          height: 34px;
          border-radius: 10px;
          background: var(--secondary-background-color, #eee);
        }

        .section {
          position: absolute;
          height: 30px;
          border-radius: 8px;
          background: var(--primary-color, #03a9f4);
          transform-origin: left center;
          transition: transform .25s ease;
        }

        .head {
          left: 10%;
          width: 30%;
          top: 57px;
        }

        .foot {
          left: 60%;
          width: 30%;
          top: 57px;
          transform-origin: right center;
        }

        .labels {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          opacity: .75;
          margin-bottom: 10px;
        }

        .controls {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        button {
          border: none;
          border-radius: 12px;
          padding: 12px 8px;
          font-size: 14px;
          background: var(--secondary-background-color, #f2f2f2);
          color: var(--primary-text-color, #111);
          cursor: pointer;
        }

        button:active {
          background: var(--primary-color, #03a9f4);
          color: white;
        }

        .stop {
          grid-column: span 3;
          background: var(--error-color, #db4437);
          color: white;
        }

        input[type=range] {
          width: 100%;
          margin: 8px 0 16px;
        }

        .empty {
          opacity: .7;
          font-size: 14px;
        }
      </style>

      <ha-card>
        <h3>${this._config.title || "Verstellbares Bett"}</h3>

        ${
          covers.head || covers.foot
            ? `
              <div class="labels">
                <span>Kopfteil: ${headPosition}% · ${headAngle}°</span>
                <span>Fußteil: ${footPosition}% · ${footAngle}°</span>
              </div>

              <div class="bed">
                <div class="mattress"></div>
                <div
                  class="section head"
                  style="transform: rotate(${headRotation}deg)"
                ></div>
                <div
                  class="section foot"
                  style="transform: rotate(${footRotation}deg)"
                ></div>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value="${headPosition}"
                id="head-slider"
              />

              <div class="controls">
                <button id="head-up">Kopf ↑</button>
                <button id="head-stop">Kopf Stop</button>
                <button id="head-down">Kopf ↓</button>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value="${footPosition}"
                id="foot-slider"
              />

              <div class="controls">
                <button id="foot-up">Fuß ↑</button>
                <button id="foot-stop">Fuß Stop</button>
                <button id="foot-down">Fuß ↓</button>
              </div>

              <button class="stop" id="all-stop">Alles stoppen</button>
            `
            : `
              <div class="empty">
                Keine passenden Kopf- oder Fußteil-Cover für dieses Gerät gefunden.
              </div>
            `
        }
      </ha-card>
    `;

    if (!covers.head || !covers.foot) return;

    const headUp = this.shadowRoot.getElementById("head-up");
    const headDown = this.shadowRoot.getElementById("head-down");
    const headStop = this.shadowRoot.getElementById("head-stop");
    const footUp = this.shadowRoot.getElementById("foot-up");
    const footDown = this.shadowRoot.getElementById("foot-down");
    const footStop = this.shadowRoot.getElementById("foot-stop");
    const allStop = this.shadowRoot.getElementById("all-stop");
    const headSlider = this.shadowRoot.getElementById("head-slider");
    const footSlider = this.shadowRoot.getElementById("foot-slider");

    headUp.addEventListener("pointerdown", () => this._hold(covers.head, "up"));
    headDown.addEventListener("pointerdown", () => this._hold(covers.head, "down"));
    headUp.addEventListener("pointerup", () => this._release(covers.head));
    headDown.addEventListener("pointerup", () => this._release(covers.head));
    headStop.addEventListener("click", () => this._release(covers.head));

    footUp.addEventListener("pointerdown", () => this._hold(covers.foot, "up"));
    footDown.addEventListener("pointerdown", () => this._hold(covers.foot, "down"));
    footUp.addEventListener("pointerup", () => this._release(covers.foot));
    footDown.addEventListener("pointerup", () => this._release(covers.foot));
    footStop.addEventListener("click", () => this._release(covers.foot));

    allStop.addEventListener("click", () => {
      this._release(covers.head);
      this._release(covers.foot);
    });

    headSlider.addEventListener("change", (event) => {
      this._callCoverService("set_cover_position", covers.head, {
        position: Number(event.target.value),
      });
    });

    footSlider.addEventListener("change", (event) => {
      this._callCoverService("set_cover_position", covers.foot, {
        position: Number(event.target.value),
      });
    });
  }
}

customElements.define(
  "adjustable-bed-entity-card",
  AdjustableBedEntityCard
);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "adjustable-bed-entity-card",
  name: "Adjustable Bed Entity Card",
  description: "Generische Karte für die Adjustable Bed Entity Bridge.",
});
