import {
  GetMyTribeNamesResponse,
  TribeName,
  TribeNameStatus,
  UserMeResponse,
} from "@openfront/shared/ApiSchemas";
import { Cosmetics } from "@openfront/shared/CosmeticSchemas";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  boostTribeName,
  getMyTribeNames,
  getUserMe,
  invalidateUserMe,
  purchaseTribeName,
  type PurchaseTribeNameResult,
} from "../Api";
import { fetchCosmetics, InsufficientCurrency } from "../Cosmetics";
import { showInGameConfirm } from "../InGameModal";
import { SteelStoreService } from "../SteelStore";
import { translateText } from "../Utils";
import { renderLoadingSpinner } from "./BaseModal";
import "./InsufficientCurrencyDialog";
import "./PlutoniumIcon";
import "./TribeStatsView";

export interface CommunityTribe {
  id: string;
  name: string;
  creator: string;
  createdAt: number;
}

export const COMMUNITY_TRIBES_STORAGE_KEY = "indufront_community_tribes";
export const TRIBE_NAME_STEEL_PRICE = 1_000_000;

export function getStoredCommunityTribes(): CommunityTribe[] {
  try {
    const raw = localStorage.getItem(COMMUNITY_TRIBES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* ignore */
  }
  const defaults: CommunityTribe[] = [
    {
      id: "tribe_alpha",
      name: "Eiserne Legion",
      creator: "KruppStahl",
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: "tribe_beta",
      name: "Nordfront Pioniere",
      creator: "GeneralPanzer",
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: "tribe_gamma",
      name: "Schwerindustrie Kollektiv",
      creator: "Stahlbaron",
      createdAt: Date.now() - 86400000 * 1,
    },
  ];
  try {
    localStorage.setItem(COMMUNITY_TRIBES_STORAGE_KEY, JSON.stringify(defaults));
  } catch {
    /* ignore */
  }
  return defaults;
}

export function saveStoredCommunityTribes(tribes: CommunityTribe[]): void {
  try {
    localStorage.setItem(COMMUNITY_TRIBES_STORAGE_KEY, JSON.stringify(tribes));
  } catch {
    /* ignore */
  }
}

// A name goes live in games as soon as it's bought; review happens afterwards
// and can only take a bad name down. So players only care about two states:
// active (pending or live) or rejected (rejected or revoked).
type TribeDisplayState = "active" | "rejected";

const DISPLAY_STATE: Record<TribeNameStatus, TribeDisplayState> = {
  pending: "active",
  live: "active",
  rejected: "rejected",
  revoked: "rejected",
};

const STATE_META: Record<
  TribeDisplayState,
  { labelKey: string; classes: string }
> = {
  active: {
    labelKey: "store.tribe_status_active",
    classes: "bg-green-500/20 text-green-300 border-green-500/30",
  },
  rejected: {
    labelKey: "store.tribe_status_rejected",
    classes: "bg-red-500/20 text-red-300 border-red-500/30",
  },
};

// The store's Tribes tab: buy a custom bot tribe name and see the ones you own.
// Self-contained (fetches its own list) like <effects-grid>; the store passes
// in the logged-in user so the panel can gate on login and refresh the header
// balance after a purchase.
@customElement("tribes-panel")
export class TribesPanel extends LitElement {
  @property({ attribute: false }) userMeResponse: UserMeResponse | false =
    false;

  // null = not loaded yet; false = load failed; otherwise the fetched data.
  @state() private data: GetMyTribeNamesResponse | false | null = null;
  @state() private purchasing = false;
  @state() private notice: { kind: "success" | "error"; text: string } | null =
    null;
  // Boost pricing from cosmetics.json; null hides boost purchasing entirely
  // (an older cosmetics.json without the tribeNames block).
  @state() private tribeNamesConfig: NonNullable<
    Cosmetics["tribeNames"]
  > | null = null;
  // id of the name whose boost purchase is in flight (all boost buttons
  // disable while set, preventing the double-submit the API doc warns about).
  @state() private boostingId: string | null = null;
  @state() private boostNotice: {
    kind: "success" | "error";
    text: string;
  } | null = null;
  @state() private insufficientInfo: InsufficientCurrency | null = null;
  // Name whose stats page is open in place of the list; null shows the list.
  @state() private statsName: string | null = null;

  @query("#tribe-name-input") private input?: HTMLInputElement;

  // Fetch once, the first time we know the user is logged in.
  private loadStarted = false;

  createRenderRoot() {
    return this;
  }

  protected updated() {
    if (!this.loadStarted && this.userMeResponse !== false) {
      this.loadStarted = true;
      void this.load();
    }
  }

  private async load() {
    const [data, cosmetics] = await Promise.all([
      getMyTribeNames(),
      fetchCosmetics(), // cached after the first call
    ]);
    this.data = data;
    this.tribeNamesConfig = cosmetics?.tribeNames ?? null;
  }

  // Name purchase price from cosmetics.json — the only source; the button
  // stays disabled when the tribeNames block is absent.
  private get price(): number | null {
    return this.tribeNamesConfig?.priceHard ?? null;
  }

  private get hardBalance(): number {
    if (this.userMeResponse === false) return 0;
    return this.userMeResponse.player.currency?.hard ?? 0;
  }

  private submit = async (e: Event) => {
    e.preventDefault();
    if (this.purchasing) return;
    const name = this.input?.value.trim() ?? "";
    if (name.length < 3) {
      this.notice = {
        kind: "error",
        text: "Der Tribe-Name muss mindestens 3 Zeichen lang sein.",
      };
      return;
    }
    if (name.length > 30) {
      this.notice = {
        kind: "error",
        text: "Der Tribe-Name darf maximal 30 Zeichen lang sein.",
      };
      return;
    }

    const steelBalance = SteelStoreService.getBalance();
    if (steelBalance < TRIBE_NAME_STEEL_PRICE) {
      this.notice = {
        kind: "error",
        text: `Nicht genug Stahl! Du benötigst 1.000.000 Stahl (dein Guthaben: ${steelBalance.toLocaleString()} Stahl).`,
      };
      return;
    }

    this.purchasing = true;
    this.notice = null;

    try {
      SteelStoreService.setBalance(steelBalance - TRIBE_NAME_STEEL_PRICE);

      const community = getStoredCommunityTribes();
      const creator =
        this.userMeResponse !== false
          ? (this.userMeResponse.player.username ??
            this.userMeResponse.player.publicId)
          : (localStorage.getItem("username") ?? "Rekrut");

      const newTribe: CommunityTribe = {
        id: `tribe_${Date.now()}`,
        name,
        creator,
        createdAt: Date.now(),
      };
      community.unshift(newTribe);
      saveStoredCommunityTribes(community);

      if (this.input) this.input.value = "";
      this.notice = {
        kind: "success",
        text: `Tribe "${name}" erfolgreich für 1.000.000 Stahl registriert! Er ist nun permanent in der Bot-Rotation aller Spiele verfügbar.`,
      };

      void purchaseTribeName(name);
      await this.refreshAfterPurchase();
    } finally {
      this.purchasing = false;
      this.requestUpdate();
    }
  };

  // A purchase spends plutonium and adds a pending name, so refresh both the
  // list and the store header's balance (re-broadcast /users/@me like Main.ts).
  // Returns the fresh profile so callers can read the new balance directly:
  // the broadcast only reaches `this.userMeResponse` once the Store re-renders
  // and re-binds it, which is not guaranteed to have happened by the time this
  // resolves.
  private async refreshAfterPurchase(): Promise<UserMeResponse | false> {
    await this.load();
    invalidateUserMe();
    const fresh = await getUserMe();
    // getUserMe returns false on any error, not just auth — broadcasting
    // that would flip the whole app to its logged-out UI right after a
    // successful purchase. A stale header balance is the better failure.
    if (fresh === false) return false;
    document.dispatchEvent(
      new CustomEvent("userMeResponse", {
        detail: fresh,
        bubbles: true,
        cancelable: true,
      }),
    );
    return fresh;
  }

  private static hardBalanceOf(res: UserMeResponse | false): number {
    return res === false ? 0 : (res.player.currency?.hard ?? 0);
  }

  // "Insufficient balance" covers three different situations once the real
  // balance is known, and they need three different messages. Shared by the
  // purchase and boost handlers so they cannot drift apart.
  private static balanceOutcome(
    balance: number,
    price: number,
  ): "debt" | "shortfall" | "unexplained" {
    // A chargeback landed since the pre-check: topping up cannot clear it.
    if (balance < 0) return "debt";
    // The re-read says they can afford it, so there is no shortfall to quote
    // and inventing one would send them to buy currency they already have.
    if (price - balance <= 0) return "unexplained";
    return "shortfall";
  }

  // Why the name itself was refused. Api.ts recognises each of the endpoint's
  // reasons and returns a code, so nothing here renders the server's English;
  // anything it did not recognise lands on the generic failure.
  private static refusalText(
    result: Exclude<PurchaseTribeNameResult, { ok: true }>,
  ): string {
    switch (result.code) {
      case "length":
        return translateText("store.tribe_name_length", {
          min: result.min,
          max: result.max,
        });
      case "invalid_charset":
        return translateText("store.tribe_name_charset");
      case "invalid_no_letter":
        return translateText("store.tribe_name_no_letter");
      case "not_allowed":
        return translateText("store.tribe_name_not_allowed");
      default:
        return translateText("store.purchase_failed");
    }
  }

  private debtText(debt: number): string {
    return translateText("store.pack_debt", { debt: String(debt) });
  }

  // `item` is what the player was trying to buy — a name they typed, or the
  // name they were boosting. `balance` is passed rather than read off
  // `this.userMeResponse` so a caller that has just refetched quotes the
  // shortfall against the balance the server actually refused on.
  private showInsufficient(item: string, price: number, balance: number) {
    this.insufficientInfo = {
      currency: translateText("cosmetics.hard"),
      shortfall: Math.max(1, price - balance),
      item,
      canTopUp: true,
    };
  }

  private boost = async (tribe: TribeName) => {
    const cfg = this.tribeNamesConfig;
    if (cfg === null || this.boostingId !== null) return;
    const price = cfg.boostPriceHard;

    // Debt first: a negative balance also fails the shortfall check below,
    // but topping up cannot clear it, so the top-up dialog would be the wrong
    // remedy dressed up as the right one.
    if (this.hardBalance < 0) {
      this.boostNotice = {
        kind: "error",
        text: this.debtText(-this.hardBalance),
      };
      return;
    }
    // Don't let the player submit into a guaranteed 400 — offer top-up.
    // Nothing has been refetched yet, so the bound balance is the right one.
    if (this.hardBalance < price) {
      this.showInsufficient(tribe.displayName, price, this.hardBalance);
      return;
    }

    const confirmed = await showInGameConfirm(
      translateText("store.tribe_boost_confirm", {
        name: tribe.displayName,
        price,
        days: cfg.boostDurationDays,
      }),
      {
        heading: translateText("store.tribe_boost_heading"),
        variant: "warning",
      },
    );
    if (!confirmed) return;

    this.boostingId = tribe.id;
    this.boostNotice = null;
    // Fresh key per user-initiated purchase. We never auto-retry (a retry of
    // this click would reuse it), so the key's job is to make an accidental
    // duplicate submit return the original boost instead of charging twice.
    const result = await boostTribeName(tribe.id, crypto.randomUUID());
    this.boostingId = null;

    if (result.ok) {
      this.boostNotice = {
        kind: "success",
        text: translateText("store.tribe_boost_success", {
          name: tribe.displayName,
        }),
      };
      await this.refreshAfterPurchase();
      return;
    }
    if (result.code === "debt") {
      // Negative wallet after a refund/chargeback. Not the same as being
      // short: buying more plutonium does not unblock this, so don't offer
      // the top-up dialog — the debt clears out of the next credit.
      this.boostNotice = {
        kind: "error",
        text: translateText("store.pack_debt", { debt: result.debt }),
      };
      await this.refreshAfterPurchase();
      return;
    }
    if (result.code === "insufficient_balance") {
      // The balance moved under us (another tab, another purchase) —
      // refresh it and show the top-up path.
      const fresh = await this.refreshAfterPurchase();
      // A failed refetch leaves the real balance unknown; a shortfall of the
      // full price would be a guess presented as a fact.
      if (fresh === false) {
        this.boostNotice = {
          kind: "error",
          text: translateText("store.tribe_boost_failed"),
        };
        return;
      }
      const balance = TribesPanel.hardBalanceOf(fresh);
      const outcome = TribesPanel.balanceOutcome(balance, price);
      if (outcome !== "shortfall") {
        this.boostNotice = {
          kind: "error",
          text:
            outcome === "debt"
              ? this.debtText(-balance)
              : translateText("store.tribe_boost_failed"),
        };
        return;
      }
      this.showInsufficient(tribe.displayName, price, balance);
      return;
    }
    if (result.code === "not_found") {
      // Taken down while the page was open; the refreshed list will come
      // back rejected/revoked with the review reason.
      this.boostNotice = {
        kind: "error",
        text: translateText("store.tribe_boost_gone"),
      };
      await this.load();
      return;
    }
    this.boostNotice = {
      kind: "error",
      text: translateText("store.tribe_boost_failed"),
    };
  };

  private renderLoginPrompt(): TemplateResult {
    return html`<div
      class="flex flex-col items-center justify-center gap-4 py-16 text-center"
    >
      <p class="text-white/60 font-medium">
        ${translateText("store.tribes_login_required")}
      </p>
      <button
        class="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-wider text-sm transition-colors cursor-pointer"
        @click=${() => window.showPage?.("page-account")}
      >
        ${translateText("main.sign_in")}
      </button>
    </div>`;
  }

  private renderPurchaseCard(): TemplateResult {
    const steelBalance = SteelStoreService.getBalance();
    const canAfford = steelBalance >= TRIBE_NAME_STEEL_PRICE;

    return html`<section
      class="bg-surface rounded-xl border border-white/10 p-5 sm:p-6 flex flex-col gap-4 shadow-lg"
    >
      <!-- Warning Banner -->
      <div
        class="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3"
      >
        <svg
          class="w-5 h-5 text-amber-400 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
          />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div class="space-y-0.5">
          <strong class="font-bold text-amber-300 block"
            >Inhalts-Richtlinie & Verhaltensregeln:</strong
          >
          <p class="leading-relaxed text-amber-200/90">
            Namen mit unangemessenen, beleidigenden, diskriminierenden oder
            anstößigen Begriffen werden ohne Rückerstattung und ohne Vorwarnung
            dauerhaft gelöscht!
          </p>
        </div>
      </div>

      <div
        class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
      >
        <div>
          <h3 class="text-lg font-bold text-white">
            Permanenten Bot-Tribe-Namen erstellen
          </h3>
          <p class="text-white/60 text-xs sm:text-sm mt-0.5">
            Für <strong>1.000.000 Stahl</strong> wird dein Wunschname dauerhaft
            registriert und von Bots in Matches getragen.
          </p>
        </div>
        <div
          class="px-3 py-1 rounded bg-black/40 border border-cyan-400/30 text-cyan-300 font-bold text-xs shrink-0"
        >
          Guthaben: ${steelBalance.toLocaleString()} Stahl
        </div>
      </div>

      <form class="flex flex-col sm:flex-row gap-2" @submit=${this.submit}>
        <label for="tribe-name-input" class="sr-only"
          >${translateText("store.tribe_name_placeholder")}</label
        >
        <input
          id="tribe-name-input"
          type="text"
          maxlength="30"
          placeholder="Tribe-Name eingeben (3-30 Zeichen)..."
          class="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
          ?disabled=${this.purchasing}
        />
        <button
          type="submit"
          class="flex items-center justify-center gap-2 font-bold rounded-lg px-5 py-2.5 text-sm whitespace-nowrap transition-colors cursor-pointer shadow-md ${canAfford
            ? "bg-cyan-600 hover:bg-cyan-500 text-white"
            : "bg-gray-800 text-gray-400 border border-gray-700 cursor-not-allowed"}"
          ?disabled=${this.purchasing || !canAfford}
        >
          ${this.purchasing
            ? "Wird gekauft..."
            : canAfford
              ? "Für 1.000.000 Stahl kaufen"
              : `Fehlt ${(TRIBE_NAME_STEEL_PRICE - steelBalance).toLocaleString()} Stahl`}
        </button>
      </form>
      ${this.notice
        ? html`<p
            class="text-xs sm:text-sm font-semibold ${this.notice.kind ===
            "success"
              ? "text-emerald-400"
              : "text-red-400"}"
          >
            ${this.notice.text}
          </p>`
        : ""}
    </section>`;
  }

  private renderCommunityTribes(): TemplateResult {
    const community = getStoredCommunityTribes();
    return html`
      <section class="flex flex-col gap-3">
        <div class="flex items-center justify-between px-1">
          <h3
            class="text-sm font-bold uppercase tracking-wider text-white/70 flex items-center gap-2"
          >
            <span>🌍 Community Bot-Tribes</span>
            <span class="text-xs font-normal text-cyan-300 font-mono"
              >(${community.length})</span
            >
          </h3>
          <span class="text-[11px] text-white/40">Permanent in Bot-Matches</span>
        </div>
        <div class="space-y-2">
          ${community.map(
            (t) => html`
              <div
                class="flex items-center justify-between gap-3 bg-surface rounded-xl border border-white/10 px-4 py-3 hover:border-white/20 transition-colors"
              >
                <div class="flex flex-col min-w-0">
                  <span
                    class="font-bold text-white text-sm sm:text-base truncate"
                    >${t.name}</span
                  >
                  <span class="text-[11px] text-white/50 mt-0.5">
                    Hinzugefügt von
                    <strong class="text-cyan-300 font-semibold"
                      >${t.creator}</strong
                    >
                    · ${new Date(t.createdAt).toLocaleDateString("de-DE")}
                  </span>
                </div>
                <span
                  class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shrink-0"
                >
                  ✓ Bot-Rotation
                </span>
              </div>
            `,
          )}
        </div>
      </section>
    `;
  }

  // "2 boosts · next boost expires Aug 5" under an actively boosted name.
  // The date is when the NEXT boost lapses (the API serves min(expiresAt)),
  // i.e. when the count drops — not when boosting ends entirely.
  private renderBoostStatus(tribe: TribeName): TemplateResult | typeof nothing {
    const boosts = tribe.activeBoosts ?? 0;
    if (boosts === 0) return nothing;
    const countText =
      boosts === 1
        ? translateText("store.tribe_boost_count")
        : translateText("store.tribe_boost_count_plural", { count: boosts });
    // The wire format has wobbled (ISO vs raw pg text); if this browser
    // can't parse it, show the count alone rather than "Invalid Date".
    const parsed = tribe.boostExpiresAt ? new Date(tribe.boostExpiresAt) : null;
    const until =
      parsed !== null && !Number.isNaN(parsed.getTime())
        ? parsed.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : null;
    return html`<span class="text-xs text-amber-300 mt-0.5">
      ${countText}${until
        ? html` ·
          ${translateText("store.tribe_boost_next_expiry", { date: until })}`
        : ""}
    </span>`;
  }

  private renderBoostButton(tribe: TribeName): TemplateResult | typeof nothing {
    const cfg = this.tribeNamesConfig;
    // Only active (pending/live) names can be boosted, and only when
    // cosmetics.json serves the price — never hardcode it.
    if (cfg === null || DISPLAY_STATE[tribe.status] !== "active") {
      return nothing;
    }
    return html`<button
      class="shrink-0 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded px-2.5 py-1.5 transition-colors cursor-pointer"
      ?disabled=${this.boostingId !== null}
      @click=${() => this.boost(tribe)}
    >
      ${translateText("store.tribe_boost_button")}
      <span class="flex items-center gap-0.5 normal-case">
        <plutonium-icon .size=${14}></plutonium-icon>${cfg.boostPriceHard}
      </span>
    </button>`;
  }

  // Rejected/revoked names deliberately 404 on the public stats endpoint,
  // so only active names get the button.
  private renderStatsButton(tribe: TribeName): TemplateResult | typeof nothing {
    if (DISPLAY_STATE[tribe.status] !== "active") return nothing;
    return html`<button
      class="shrink-0 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-bold uppercase tracking-wider rounded px-2.5 py-1.5 transition-colors cursor-pointer"
      @click=${() => (this.statsName = tribe.displayName)}
    >
      ${translateText("store.tribe_stats_button")}
    </button>`;
  }

  private renderTribeRow(tribe: TribeName): TemplateResult {
    const meta = STATE_META[DISPLAY_STATE[tribe.status]];
    return html`<div
      class="flex items-center justify-between gap-3 bg-surface rounded-lg border border-white/10 px-4 py-3"
    >
      <div class="flex flex-col min-w-0">
        <span class="font-bold text-white truncate">${tribe.displayName}</span>
        ${this.renderBoostStatus(tribe)}
        ${tribe.reviewReason
          ? html`<span class="text-xs text-white/50 mt-0.5"
              >${tribe.reviewReason}</span
            >`
          : ""}
      </div>
      <div class="shrink-0 flex items-center gap-2">
        ${this.renderStatsButton(tribe)} ${this.renderBoostButton(tribe)}
        <span
          class="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded border ${meta.classes}"
        >
          ${translateText(meta.labelKey)}
        </span>
      </div>
    </div>`;
  }

  private renderList(): TemplateResult {
    if (this.data === null) {
      return renderLoadingSpinner();
    }
    if (this.data === false) {
      return html`<p
        class="text-white/40 text-sm font-bold uppercase tracking-wider text-center py-8"
      >
        ${translateText("store.tribes_load_failed")}
      </p>`;
    }
    // Most-boosted names first. The sort is stable, so within equal boost
    // counts the API's newest-first order is preserved (unboosted and
    // rejected names all tie at 0 and keep their relative order).
    const names = [...this.data.names].sort(
      (a, b) => (b.activeBoosts ?? 0) - (a.activeBoosts ?? 0),
    );
    if (names.length === 0) {
      return html`<p
        class="text-white/40 text-sm font-bold uppercase tracking-wider text-center py-8"
      >
        ${translateText("store.no_tribes")}
      </p>`;
    }
    return html`<div class="flex flex-col gap-2">
      ${names.map((tribe) => this.renderTribeRow(tribe))}
    </div>`;
  }

  render(): TemplateResult {
    if (this.userMeResponse === false) {
      return this.renderLoginPrompt();
    }
    // The stats page takes over the whole tab, profile-modal style; its back
    // button returns to the list.
    if (this.statsName !== null) {
      return html`<div
        class="p-6 lg:p-8 flex flex-col gap-6 max-w-2xl mx-auto w-full"
      >
        <tribe-stats-view
          .tribeName=${this.statsName}
          @back=${() => (this.statsName = null)}
        ></tribe-stats-view>
      </div>`;
    }
    return html`<div
      class="p-6 lg:p-8 flex flex-col gap-6 max-w-2xl mx-auto w-full"
    >
      ${this.renderPurchaseCard()}
      ${this.renderCommunityTribes()}
      <section class="flex flex-col gap-3">
        <h3
          class="text-sm font-bold uppercase tracking-wider text-white/60 px-1"
        >
          ${translateText("store.your_tribes_heading")}
        </h3>
        ${this.boostNotice
          ? html`<p
              class="text-sm font-medium px-1 ${this.boostNotice.kind ===
              "success"
                ? "text-green-400"
                : "text-red-400"}"
            >
              ${this.boostNotice.text}
            </p>`
          : ""}
        ${this.renderList()}
      </section>
      <insufficient-currency-dialog
        .info=${this.insufficientInfo}
        @close=${() => (this.insufficientInfo = null)}
      ></insufficient-currency-dialog>
    </div>`;
  }
}
