import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, LitElement, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getApiBase } from "../Api";
import { getAuthHeader } from "../Auth";
import { NavNotificationsController } from "./NavNotificationsController";

const MOBILE_ITEM =
  "nav-menu-item block w-full text-left font-bold uppercase tracking-[0.05em] " +
  "text-white/70 transition-all duration-200 cursor-pointer " +
  "hover:text-malibu-blue hover:translate-x-2.5 " +
  "hover:drop-shadow-[0_0_20px_rgba(104,152,86,0.5)] " +
  "[&.active]:text-malibu-blue [&.active]:translate-x-2.5 " +
  "[&.active]:drop-shadow-[0_0_20px_rgba(104,152,86,0.5)] " +
  "text-[clamp(18px,2.8vh,32px)] py-[clamp(0.2rem,0.8vh,0.75rem)]";

@customElement("mobile-nav-bar")
export class MobileNavBar extends LitElement {
  private _notifications = new NavNotificationsController(this);

  @state() private onlineCount = 1;
  @state() private onlineFriendsCount = 0;
  private presenceInterval: any = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("showPage", this._onShowPage);

    const current = window.currentPageId;
    if (current) {
      this.updateComplete.then(() => {
        this._updateActiveState(current);
      });
    }

    this.fetchPresence();
    this.presenceInterval = setInterval(() => this.fetchPresence(), 10000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("showPage", this._onShowPage);
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
  }

  private async fetchPresence() {
    try {
      const auth = await getAuthHeader();
      if (auth) {
        const res = await fetch(`${getApiBase()}/presence/summary`, {
          headers: { Accept: "application/json", Authorization: auth },
        });
        if (res.ok) {
          const data = await res.json();
          this.onlineCount = Math.max(1, data.onlineCount ?? 1);
          this.onlineFriendsCount = (data.onlineFriends ?? []).length;
          return;
        }
      }
      const res = await fetch(`${getApiBase()}/api/online_count`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        this.onlineCount = Math.max(1, data.online ?? 1);
      }
    } catch {
      /* ignore online count fetch error */
    }
  }

  private _onShowPage = (e: Event) => {
    const pageId = (e as CustomEvent).detail;
    this._updateActiveState(pageId);
  };

  private _updateActiveState(pageId: string) {
    this.querySelectorAll(".nav-menu-item").forEach((el) => {
      const inner = el.querySelector("button");
      if ((el as HTMLElement).dataset.page === pageId) {
        el.classList.add("active");
        inner?.classList.add("active");
      } else {
        el.classList.remove("active");
        inner?.classList.remove("active");
      }
    });
  }

  private _renderDot(color: string): TemplateResult {
    return html`<span class="relative ml-2 shrink-0 -mt-2 w-2 h-2">
      <span class="absolute inset-0 ${color} rounded-full animate-ping"></span>
      <span class="absolute inset-0 ${color} rounded-full"></span>
    </span>`;
  }

  render() {
    window.currentPageId ??= "page-play";
    const currentPage = window.currentPageId;

    return html`
      <!-- Border Segments (Custom right border with gap for button) -->
      <div
        class="absolute right-0 top-0 w-px bg-transparent"
        style="height: calc(50% - 64px)"
      ></div>
      <div
        class="absolute right-0 bottom-0 w-px bg-transparent"
        style="height: calc(50% - 64px)"
      ></div>

      <div
        class="flex-1 w-full flex flex-col justify-start overflow-y-auto lg:pt-[clamp(1rem,3vh,4rem)] lg:pb-[clamp(0.5rem,2vh,2rem)] lg:px-[clamp(1rem,1.5vw,2rem)] pt-4 pb-4 px-5 gap-4 lg:gap-[clamp(1rem,3vh,3rem)]"
      >
        <!-- Logo + Menu -->
        <div
          class="flex flex-col text-malibu-blue mb-4 ml-[clamp(0.2rem,0.4vw,0.4vh)]"
        >
          <div class="flex flex-col items-center gap-1">
            <img
              src=${assetUrl("images/InduFrontLogo.svg")}
              alt="InduFront"
              class="w-auto h-auto max-w-[220px] max-h-[4.5rem]"
            />
            <div
              id="game-version"
              class="l-header__highlightText text-center"
            ></div>
          </div>
        </div>
        <!-- Mobile Navigation Menu Items (same order as the desktop bar) -->
        <button
          class="${MOBILE_ITEM} ${currentPage === "page-play" ? "active" : ""}"
          data-page="page-play"
          data-i18n="main.play"
        ></button>
        <button
          class="${MOBILE_ITEM}"
          data-page="page-leaderboard"
          data-i18n="main.leaderboard"
        ></button>
        <button
          class="${MOBILE_ITEM}"
          data-page="page-inventory"
          data-i18n="main.inventory"
        ></button>
        <button
          class="no-game-portal ${MOBILE_ITEM}"
          data-page="page-clan"
          data-i18n="main.clans"
        ></button>
        <button
          class="${MOBILE_ITEM} flex items-center justify-between"
          data-page="page-chat"
        >
          <span>💬 Chat</span>
        </button>
        <button
          class="${MOBILE_ITEM} flex items-center justify-between"
          data-page="page-friends"
        >
          <span>👥 Freunde</span>
          ${this.onlineFriendsCount > 0
            ? html`<span
                class="px-2 py-0.5 bg-malibu-blue text-white text-xs font-bold rounded-full"
                >${this.onlineFriendsCount}</span
              >`
            : ""}
        </button>

        <div
          class="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-white/80"
        >
          <span
            class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"
          ></span>
          <span class="font-bold text-emerald-400">${this.onlineCount}</span>
          <span>Spieler online</span>
        </div>

        <div
          class="flex flex-col w-full mt-auto [.in-game_&]:hidden items-end justify-end pt-4 border-t border-white/10"
        ></div>
      </div>
    `;
  }
}
