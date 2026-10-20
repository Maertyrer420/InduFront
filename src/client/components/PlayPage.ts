import { UserMeResponse } from "@openfront/shared/ApiSchemas";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { hasLinkedIdentity } from "../AccountIdentity";
import { latestUserMeResponse } from "../NavAccountButton";
import "./CosmeticBackground";
import "./ColorPalettePicker";
import "./NavAccountMenu";
import "./NavUtilityIcons";
import "./NewsBox";
import "./SteamWishlist";
import "./StreamingNow";

const isDe = (navigator.language || "en").toLowerCase().startsWith("de");

@customElement("play-page")
export class PlayPage extends LitElement {
  @state() private userMe: UserMeResponse | false | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.userMe = latestUserMeResponse();
    document.addEventListener("userMeResponse", this.onUserMe as EventListener);
  }

  disconnectedCallback() {
    document.removeEventListener(
      "userMeResponse",
      this.onUserMe as EventListener,
    );
    super.disconnectedCallback();
  }

  private onUserMe = (e: CustomEvent<UserMeResponse | false>) => {
    this.userMe = e.detail;
  };

  private openAccount = (tab?: string) => {
    if (tab) {
      window.location.hash = `modal=account&tab=${tab}`;
    } else {
      window.showPage?.("page-account");
    }
  };

  private renderAuthBar() {
    const signedIn =
      this.userMe !== null &&
      this.userMe !== false &&
      hasLinkedIdentity(this.userMe.user);

    if (signedIn && this.userMe) {
      const username =
        this.userMe.player.username ?? this.userMe.player.publicId;
      const email = this.userMe.user.email ?? "";
      return html`
        <div
          class="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-surface/90 border border-emerald-500/30 text-sm"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
            ></span>
            <span class="text-white font-semibold truncate">${username}</span>
            ${email
              ? html`<span class="hidden sm:inline text-xs text-white/45 truncate"
                  >(${email})</span
                >`
              : null}
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              @click=${() => this.openAccount("friends")}
              class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              ${isDe ? "Freunde" : "Friends"}
            </button>
            <button
              type="button"
              @click=${() => this.openAccount()}
              class="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-semibold text-emerald-200 transition-colors cursor-pointer"
            >
              ${isDe ? "Konto" : "Account"}
            </button>
          </div>
        </div>
      `;
    }

    return html`
      <div
        class="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-surface/90 border border-malibu-blue/40 text-sm"
      >
        <div class="flex items-center gap-2 min-w-0 text-white/80">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="w-4 h-4 shrink-0 text-malibu-blue"
          >
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          <span class="truncate font-medium">
            ${isDe
              ? "Melde dich an oder erstelle ein Konto, um mit Freunden zu spielen"
              : "Sign in or register an account to play with friends"}
          </span>
        </div>
        <button
          type="button"
          @click=${() => this.openAccount()}
          class="shrink-0 px-3.5 py-1.5 rounded-lg bg-malibu-blue hover:bg-malibu-blue/90 text-xs font-bold uppercase tracking-wider text-slate-950 transition-colors cursor-pointer"
        >
          ${isDe ? "Login / Registrieren" : "Sign in / Register"}
        </button>
      </div>
    `;
  }

  render() {
    return html`
      <div
        id="page-play"
        class="flex flex-col gap-2 w-full px-0 lg:px-4 min-h-0"
      >
        <token-login class="absolute"></token-login>
        <rewards-modal class="absolute"></rewards-modal>

        <!-- Mobile: Fixed top bar -->
        <div
          class="lg:hidden fixed left-0 right-0 top-[var(--top-ad-height,0px)] z-40 pt-[env(safe-area-inset-top)] bg-surface border-b border-white/10"
        >
          <div
            class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center h-14 px-2 gap-2"
          >
            <button
              id="hamburger-btn"
              class="col-start-1 justify-self-start h-10 shrink-0 aspect-[4/3] flex text-white/90 rounded-md items-center justify-center transition-colors"
              data-i18n-aria-label="main.menu"
              aria-expanded="false"
              aria-controls="sidebar-menu"
              aria-haspopup="dialog"
              data-i18n-title="main.menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-8"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>

            <div
              class="col-start-2 flex items-center justify-center text-malibu-blue min-w-0"
            >
              <img
                src=${assetUrl("images/InduFrontLogo.svg")}
                alt="InduFront"
                class="h-full w-auto"
              />
            </div>

            <!-- Right slot: bell, help, settings and the profile control. The menu is
                 the account affordance on every platform now — on CrazyGames
                 its "Sign in" item hands off to their SDK prompt. -->
            <div
              class="col-start-3 justify-self-end shrink-0 flex items-center gap-0.5"
            >
              <nav-utility-icons size="mobile"></nav-utility-icons>
              <nav-account-menu variant="mobile"></nav-account-menu>
            </div>
          </div>
        </div>

        <!-- Top strip: news + identity on the left, Streaming Now on the right. The 2fr/1fr
             split only exists while the panel is live (.streaming-live via has-[]) —
             otherwise the left column takes the full row. -->
        <div
          class="w-full pb-4 lg:pb-0 flex flex-col gap-4 sm:-mx-4 sm:w-[calc(100%+2rem)] lg:mx-0 lg:w-full lg:grid lg:grid-cols-1 lg:has-[.streaming-live]:grid-cols-[2fr_1fr] lg:gap-4 lg:items-stretch"
        >
          <!-- Mobile: spacer for fixed top bar -->
          <div
            class="lg:hidden h-[calc(env(safe-area-inset-top)+56px)] -mb-4"
          ></div>

          <!-- Left column: news banner + identity row, stacked tight. -->
          <div class="flex flex-col gap-2 min-w-0">
            <news-box></news-box>

            ${this.renderAuthBar()}

            <!-- Identity row: username over the currently selected cosmetic background. -->
            <div
              class="relative bg-surface border-y border-white/10 overflow-visible flex items-center sm:min-h-[60px] sm:flex-1 sm:z-20 sm:border-y-0 sm:rounded-xl"
            >
              <!-- Selected skin/pattern fills the bubble like the player's territory in game. -->
              <cosmetic-background
                class="absolute inset-0 z-0 overflow-hidden sm:rounded-xl pointer-events-none"
              ></cosmetic-background>
              <div
                class="relative z-10 flex h-full w-full min-w-0 items-center bg-surface/80 p-1 sm:rounded-xl"
              >
                <username-input
                  class="flex-1 min-w-0 h-10 sm:h-[50px]"
                ></username-input>
              </div>
            </div>

            <!-- Starting nation color palette picker -->
            <color-palette-picker class="w-full"></color-palette-picker>
          </div>

          <!-- Right column: Streaming Now (desktop only), stretched to the left column's
               full height so the top strip has no dead space. -->
          <streaming-now
            class="hidden lg:flex lg:h-full lg:flex-col w-full min-w-0"
          ></streaming-now>
        </div>

        <game-mode-selector></game-mode-selector>
      </div>
    `;
  }
}
