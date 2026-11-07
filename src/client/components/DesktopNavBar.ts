import { assetUrl } from "@openfront/shared/AssetUrls";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getApiBase } from "../Api";
import { getAuthHeader } from "../Auth";
import { translateText } from "../Utils";
import "./NavAccountMenu";
import { NavNotificationsController } from "./NavNotificationsController";
import "./NavUtilityIcons";

@customElement("desktop-nav-bar")
export class DesktopNavBar extends LitElement {
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
      // Wait for render
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
      if ((el as HTMLElement).dataset.page === pageId) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
  }

  render() {
    window.currentPageId ??= "page-play";
    const currentPage = window.currentPageId;

    return html`
      <nav
        class="hidden lg:flex w-full bg-[#131a14]/90 backdrop-blur-md items-center justify-center gap-6 py-4 shrink-0 z-50 relative border-b border-[#2a382b]/60"
      >
        <div class="flex flex-col items-center justify-center">
          <div class="h-8">
            <img
              class="block h-full aspect-[1364/259]"
              src=${assetUrl("images/InduFrontLogo.svg")}
              alt="InduFront"
            />
          </div>
          <div
            id="game-version"
            class="l-header__highlightText text-center"
          ></div>
        </div>
        <button
          class="nav-menu-item ${currentPage === "page-play"
            ? "active"
            : ""} text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue flex items-center gap-1.5"
          data-page="page-play"
        >
          <svg
            class="w-4 h-4 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84z"
            />
          </svg>
          <span data-i18n="main.play">${translateText("main.play")}</span>
        </button>
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue flex items-center gap-1.5"
          data-page="page-leaderboard"
        >
          <svg
            class="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
            <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
            <path d="M4 3h16v6a8 8 0 0 1-16 0V3z" />
            <path d="M12 17v4" />
            <path d="M8 21h8" />
          </svg>
          <span data-i18n="main.leaderboard"
            >${translateText("main.leaderboard")}</span
          >
        </button>
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue flex items-center gap-1.5"
          data-page="page-friends"
        >
          <svg
            class="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span data-i18n="main.friends">${translateText("main.friends")}</span>
          ${this.onlineFriendsCount > 0
            ? html`<span
                class="px-1.5 py-0.2 bg-malibu-blue text-white text-[11px] font-bold rounded-full animate-pulse"
                >${this.onlineFriendsCount}</span
              >`
            : ""}
        </button>
        <button
          class="no-game-portal nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue flex items-center gap-1.5"
          data-page="page-clan"
        >
          <svg
            class="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span data-i18n="main.clans">${translateText("main.clans")}</span>
        </button>
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue flex items-center gap-1.5"
          data-page="page-item-store"
        >
          <svg
            class="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <span data-i18n="main.store">${translateText("main.store")}</span>
        </button>
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue flex items-center gap-1.5"
          data-page="page-inventory"
        >
          <svg
            class="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
            />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
          </svg>
          <span data-i18n="main.inventory"
            >${translateText("main.inventory")}</span
          >
        </button>
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue flex items-center gap-1.5"
          data-page="page-chat"
        >
          <svg
            class="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
          <span data-i18n="main.chat">${translateText("main.chat")}</span>
        </button>

        <!-- Online Player Count -->
        <div
          class="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs text-white/80 shrink-0"
        >
          <span
            class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
          ></span>
          <span class="font-bold text-emerald-400">${this.onlineCount}</span>
          <span class="text-white/60">Spieler online</span>
        </div>

        <!-- Utility cluster: bell, help, settings and the profile control are
             account/notification/utility affordances rather than page links,
             so they sit tight together behind a divider instead of in the nav
             item list. -->
        <div class="flex items-center gap-1 pl-5 ml-1 border-l border-white/10">
          <nav-utility-icons size="desktop"></nav-utility-icons>
          <nav-account-menu variant="desktop"></nav-account-menu>
        </div>
      </nav>
    `;
  }
}
