import "@polymer/app-route/app-location";
import { html, property, PropertyValues } from "lit-element";
import { navigate } from "../common/navigate";
import { getStorageDefaultPanelUrlPath } from "../data/panel";
import "../resources/custom-card-support";
import { HassElement } from "../state/hass-element";
import { HomeAssistant, Route } from "../types";
import {
  registerServiceWorker,
  supportsServiceWorker,
} from "../util/register-service-worker";
import "./ha-init-page";
import "./home-assistant-main";

export class HomeAssistantAppEl extends HassElement {
  @property() private _route?: Route;

  @property() private _error = false;

  @property() private _panelUrl?: string;

  private _haVersion?: string;

  protected render() {
    const hass = this.hass;

    return html`
      <app-location
        @route-changed=${this._routeChanged}
        ?use-hash-as-path=${__DEMO__}
      ></app-location>
      ${this._panelUrl === undefined || this._route === undefined
        ? ""
        : hass && hass.states && hass.config && hass.services
        ? html`
            <home-assistant-main
              .hass=${this.hass}
              .route=${this._route}
            ></home-assistant-main>
          `
        : html` <ha-init-page .error=${this._error}></ha-init-page> `}
    `;
  }

  protected firstUpdated(changedProps) {
    super.firstUpdated(changedProps);
    this._initialize();
    setTimeout(() => registerServiceWorker(this), 1000);
    /* polyfill for paper-dropdown */
    import(
      /* webpackChunkName: "polyfill-web-animations-next" */ "web-animations-js/web-animations-next-lite.min"
    );
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (changedProps.has("_panelUrl")) {
      this.panelUrlChanged(this._panelUrl!);
      this._updateHass({ panelUrl: this._panelUrl });
    }
    if (changedProps.has("hass")) {
      this.hassChanged(
        this.hass!,
        changedProps.get("hass") as HomeAssistant | undefined
      );
    }
  }

  protected hassConnected() {
    super.hassConnected();
    // @ts-ignore
    this._loadHassTranslations(this.hass!.language, "state");
  }

  protected hassReconnected() {
    super.hassReconnected();

    // If backend has been upgraded, make sure we update frontend
    if (this.hass!.connection.haVersion !== this._haVersion) {
      if (supportsServiceWorker()) {
        navigator.serviceWorker.getRegistration().then((registration) => {
          if (registration) {
            registration.update();
          } else {
            location.reload(true);
          }
        });
      } else {
        location.reload(true);
      }
    }
  }

  protected async _initialize() {
    try {
      let result;

      if (window.hassConnection) {
        result = await window.hassConnection;
      } else {
        // In the edge case that
        result = await new Promise((resolve) => {
          window.hassConnectionReady = resolve;
        });
      }

      const { auth, conn } = result;
      this._haVersion = conn.haVersion;
      this.initializeHass(auth, conn);
    } catch (err) {
      this._error = true;
    }
  }

  private async _routeChanged(ev) {
    // routeChangged event listener is called while we're doing the fist render,
    // causing the update to be ignored. So delay it to next task (Lit render is sync).
    await new Promise((resolve) => setTimeout(resolve, 0));

    const route = ev.detail.value as Route;
    // If it's the first route that we process,
    // check if we should navigate away from /
    if (
      this._route === undefined &&
      (route.path === "" || route.path === "/")
    ) {
      navigate(window, `/${getStorageDefaultPanelUrlPath()}`, true);
      return;
    }

    this._route = route;

    const dividerPos = route.path.indexOf("/", 1);
    this._panelUrl =
      dividerPos === -1
        ? route.path.substr(1)
        : route.path.substr(1, dividerPos - 1);
  }
}

customElements.define("home-assistant", HomeAssistantAppEl);
