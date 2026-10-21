import { assetUrl } from "@openfront/shared/AssetUrls";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getApiBase } from "../Api";
import { getAuthHeader } from "../Auth";
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
            : ""} text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue"
          data-page="page-play"
          data-i18n="main.play"
        ></button>
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue"
          data-page="page-leaderboard"
          data-i18n="main.leaderboard"
        ></button>
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue"
          data-page="page-inventory"
          data-i18n="main.inventory"
        ></button>
        <button
          class="no-game-portal nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue"
          data-page="page-clan"
          data-i18n="main.clans"
        ></button>
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue flex items-center gap-1.5"
          data-page="page-chat"
        >
          <span>💬 Chat</span>
        </button>
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue flex items-center gap-1.5"
          data-page="page-friends"
        >
          <span>👥 Freunde</span>
          ${this.onlineFriendsCount > 0
            ? html`<span
                class="px-1.5 py-0.2 bg-malibu-blue text-white text-[11px] font-bold rounded-full animate-pulse"
                >${this.onlineFriendsCount}</span
              >`
            : ""}
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
