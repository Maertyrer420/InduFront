import {
  isGrantedSubscription,
  UserMeResponse,
} from "@openfront/shared/ApiSchemas";
import {
  CosmeticPack,
  Cosmetics,
  Product,
  Subscription,
} from "@openfront/shared/CosmeticSchemas";
import type { PropertyValues, TemplateResult } from "lit";
import { html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { BaseModal } from "./components/BaseModal";
import "./components/CosmeticCard";
import { cosmeticSelectionLabel } from "./components/CosmeticPresentation";
import { isPreviewableCosmetic } from "./components/CosmeticPreviewBubble";
import "./components/CosmeticPreviewModal";
import "./components/CurrencyDisplay";
import "./components/CustomCurrencyCard";
import "./components/EffectsGrid";
import type { InlineCheckout } from "./components/InlineCheckout";
import "./components/NotLoggedInWarning";
import "./components/PackContentsDialog";
import { ProgressiveList } from "./components/ProgressiveList";
import "./components/PurchaseButton";
import { alignPurchaseRows } from "./components/PurchaseButton";
import "./components/TribesPanel";
import { modalHeader } from "./components/ui/ModalHeader";
import {
  fetchCosmetics,
  findPackItem,
  groupCosmeticVariants,
  ownedPackItems,
  purchaseCosmetic,
  resolveCosmetics,
  ResolvedCosmetic,
} from "./Cosmetics";
import { matchesStoreItem } from "./EquippedCosmetics";
import {
  priceStringToCents,
  reportPendingSteamAuthorizations,
} from "./Payments";
import { STEEL_CATALOG, SteelStoreService } from "./SteelStore";
import { lastUserMeResponse } from "./UserMeBroadcast";
import { translateText } from "./Utils";

// Matches the API's formatting of `product.price`, so a tier priced from its
// own cents reads the same as one priced from its Stripe listing.
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatUsdCents(cents: number): string {
  return usdFormatter.format(cents / 100);
}

type StoreTab =
  | "steel_shop"
  | "cosmetics"
  | "bundles"
  | "effects"
  | "tribes"
  | "packs"
  | "subscriptions";

const COSMETICS_SUB_TABS = ["patterns", "flags", "crowns"] as const;
type CosmeticsSubTab = (typeof COSMETICS_SUB_TABS)[number];

/** Sub-tab holding the catalog item a store deep link points at. */
export function subTabForItem(itemKey: string): CosmeticsSubTab {
  if (itemKey.startsWith("crown:")) return "crowns";
  if (itemKey.startsWith("flag:")) return "flags";
  return "patterns";
}

interface StoreBrowserOptions {
  emptyTranslationKey: string;
  userHasSubscription?: boolean;
  trailingContent?: TemplateResult;
  gridClass?: string;
  cardClass?: string;
  previewSize?: "card" | "detail";
  emptyClass?: string;
}

@customElement("store-modal")
export class StoreModal extends BaseModal {
  protected routerName = "store";
  private cosmetics: Cosmetics | null = null;
  private affiliateCode: string | null = null;
  private userMeResponse: UserMeResponse | false = false;
  // `userMeResponse` starts at `false`, which is also what "no session" looks
  // like, so a tab that renders a sign-in prompt on `false` would show it to a
  // logged-in player for the whole window before Main's first userMeResponse
  // broadcast (a Steam ticket exchange on desktop). This distinguishes the
  // two: nothing is asserted about the session until it has actually settled.
  // Reactive on its own, unlike `userMeResponse`: onUserMe() only calls
  // refresh() after the catalog fetch, and a settled no-session result must
  // not wait on a slow catalog before it may say so.
  @state() private authSettled = false;
  @state() private steelCategoryFilter: string = "all";
  private cosmeticsSubTab: CosmeticsSubTab = "patterns";
  // Item the URL asked for (`#modal=store&item=<key>`). Held until its group
  // is visible, then inspected so the store opens on that item.
  private requestedItem: string | null = null;
  private inspected: ResolvedCosmetic | null = null;
  private previewingCosmetic: ResolvedCosmetic | null = null;
  private visibleGroups: readonly (readonly ResolvedCosmetic[])[] = [];
  /** The bundle whose contents dialog is open, if any. */
  private openedPack: ResolvedCosmetic | null = null;
  private readonly pages = new ProgressiveList(this);
  private requestedLegacyTab?: string;

  public override open(args?: Record<string, unknown>): void {
    if (typeof args?.tab === "string") {
      this.requestedLegacyTab = args.tab;
    }
    super.open(args);
  }

  public override setActiveTab(key: string): void {
    this.requestedLegacyTab = key;
    super.setActiveTab(key);
  }

  protected modalConfig() {
    if (this.affiliateCode) {
      // Affiliate mode: hide tabs, show only items associated with the code.
      return {};
    }
    const userTabs = [
      { key: "steel_shop", label: "Stahl-Shop" },
      { key: "tribes", label: translateText("store.tribes") },
    ];
    const legacyCandidates = [
      "packs",
      "subscriptions",
      "bundles",
      "cosmetics",
      "effects",
    ];
    const activeLegacy = legacyCandidates.filter(
      (k) => this.activeTab === k || this.requestedLegacyTab === k,
    );
    if (activeLegacy.length > 0) {
      return {
        tabs: [
          ...userTabs,
          ...activeLegacy.map((key) => ({
            key,
            label: translateText(`store.${key}`) || key,
          })),
        ],
      };
    }
    return {
      tabs: userTabs,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("userMeResponse", this.onUserMeEvent);
    // The store loads on demand, usually after Main's broadcast went out.
    const last = lastUserMeResponse();
    if (last !== null) void this.onUserMe(last.response);
    this.addEventListener("open-cosmetic-preview", this.onOpenCosmeticPreview);
    // Rows re-wrap on resize, so which currencies share a row changes with it.
    if (typeof ResizeObserver !== "undefined") {
      this.rowObserver ??= new ResizeObserver(() => alignPurchaseRows(this));
      this.rowObserver.observe(this);
    }
  }

  disconnectedCallback() {
    document.removeEventListener("userMeResponse", this.onUserMeEvent);
    this.removeEventListener(
      "open-cosmetic-preview",
      this.onOpenCosmeticPreview,
    );
    this.rowObserver?.disconnect();
    if (this.alignFrame !== null) cancelAnimationFrame(this.alignFrame);
    this.alignFrame = null;
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    // The cards are nested components, so their purchase buttons only exist
    // (and only have positions) after their own updates commit — a frame later.
    alignPurchaseRows(this);
    if (typeof requestAnimationFrame === "undefined") return;
    this.alignFrame ??= requestAnimationFrame(() => {
      this.alignFrame = null;
      alignPurchaseRows(this);
    });
  }

  private onUserMeEvent = (event: Event) => {
    const customEvent = event as CustomEvent<UserMeResponse | false>;
    this.onUserMe(customEvent.detail);
  };

  private onOpenCosmeticPreview = (event: Event) => {
    const customEvent = event as CustomEvent<ResolvedCosmetic>;
    this.previewingCosmetic = customEvent.detail;
    this.requestUpdate();
  };

  private rowObserver: ResizeObserver | null = null;
  private alignFrame: number | null = null;

  async onUserMe(userMeResponse: UserMeResponse | false) {
    this.userMeResponse = userMeResponse;
    this.authSettled = true;
    this.cosmetics = await fetchCosmetics();
    this.selectVisible(this.groupsForTab(this.activeTab));
    await this.refresh();
  }

  private renderHeader(): TemplateResult {
    const currency =
      this.userMeResponse === false
        ? undefined
        : this.userMeResponse.player.currency;
    return modalHeader({
      title: translateText("store.title"),
      onBack: () => this.close(),
      ariaLabel: translateText("common.back"),
      rightContent: html`<div class="flex items-center gap-3">
        <div
          class="flex items-center gap-1.5 bg-slate-900/90 border border-cyan-400/50 px-3 py-1 rounded-full text-xs font-bold text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.2)]"
          title="Dein gesammelter Stahl aus gespielten Runden"
        >
          <span>⚙️</span>
          <span class="tabular-nums font-extrabold"
            >${SteelStoreService.getBalance()}</span
          >
          <span class="text-white/70">Stahl</span>
        </div>
        ${currency
          ? html`<currency-display
              .hard=${currency.hard}
              .soft=${currency.soft}
            ></currency-display>`
          : ""}
        <not-logged-in-warning></not-logged-in-warning>
      </div>`,
    });
  }

  private resolvedPurchasables(): ResolvedCosmetic[] {
    return resolveCosmetics(
      this.cosmetics,
      this.userMeResponse,
      this.affiliateCode,
    ).filter((resolved) => resolved.relationship === "purchasable");
  }

  private cosmeticsGroups(
    tab: CosmeticsSubTab,
  ): readonly (readonly ResolvedCosmetic[])[] {
    const items = this.resolvedPurchasables();
    if (tab === "flags") {
      return items
        .filter((resolved) => resolved.type === "flag")
        .map((r) => [r]);
    }
    if (tab === "crowns") {
      return items
        .filter((resolved) => resolved.type === "crown")
        .map((r) => [r]);
    }
    return groupCosmeticVariants(
      items.filter(
        (resolved) => resolved.type === "pattern" || resolved.type === "skin",
      ),
    );
  }

  private groupsForTab(tab: string): readonly (readonly ResolvedCosmetic[])[] {
    if (this.affiliateCode) {
      return groupCosmeticVariants(
        this.resolvedPurchasables().filter((resolved) => {
          const c = resolved.cosmetic;
          return (
            c !== null &&
            "affiliateCode" in c &&
            c.affiliateCode === this.affiliateCode
          );
        }),
      );
    }
    if (tab === "cosmetics") {
      return this.cosmeticsGroups(this.cosmeticsSubTab);
    }
    if (tab === "effects") {
      return this.resolvedPurchasables()
        .filter((resolved) => resolved.type === "effect")
        .map((resolved) => [resolved]);
    }
    if (tab === "packs") {
      return this.resolvedPurchasables()
        .filter((resolved) => resolved.type === "pack")
        .map((resolved) => [resolved]);
    }
    if (tab === "bundles") {
      // Owned and partially owned bundles stay listed (as a status, not a
      // buy button) so the player can see why one isn't for sale to them.
      return resolveCosmetics(
        this.cosmetics,
        this.userMeResponse,
        this.affiliateCode,
      )
        .filter(
          (resolved) =>
            resolved.type === "cosmeticPack" &&
            (resolved.relationship !== "blocked" ||
              this.ownedPackItemNames(resolved).length > 0),
        )
        .map((resolved) => [resolved]);
    }
    if (tab === "subscriptions") {
      return resolveCosmetics(
        this.cosmetics,
        this.userMeResponse,
        this.affiliateCode,
      )
        .filter(
          (resolved) =>
            resolved.type === "subscription" &&
            (resolved.relationship === "purchasable" ||
              resolved.relationship === "owned"),
        )
        .map((resolved) => [resolved]);
    }
    return [];
  }

  private inspect(resolved: ResolvedCosmetic): void {
    this.inspected = resolved;
    this.requestUpdate();
  }

  // Activating a bundle also opens its contents: the card only has room to
  // tile a few items, so the dialog is where each one is shown with its name.
  private activate(resolved: ResolvedCosmetic): void {
    if (resolved.type === "cosmeticPack") this.openedPack = resolved;
    if (isPreviewableCosmetic(resolved)) this.previewingCosmetic = resolved;
    this.inspect(resolved);
  }

  private closePack(): void {
    this.openedPack = null;
    this.requestUpdate();
  }

  private reconcileInspection(
    groups: readonly (readonly ResolvedCosmetic[])[],
  ): void {
    const visible = groups.flat();
    const wanted = this.requestedItem;
    if (wanted !== null) {
      const match = visible.find((item) => matchesStoreItem(item.key, wanted));
      // The catalog loads after open, so keep the request until its item shows.
      if (match !== undefined) {
        this.requestedItem = null;
        this.inspected = match;
        return;
      }
    }
    const current = visible.find((item) => item.key === this.inspected?.key);
    this.inspected = current ?? groups[0]?.[0] ?? null;
  }

  private selectVisible(
    groups: readonly (readonly ResolvedCosmetic[])[],
  ): void {
    this.visibleGroups = groups;
    this.reconcileInspection(groups);
  }

  protected onTabEnter(key: string): void {
    this.selectVisible(this.groupsForTab(key));
    this.requestUpdate();
  }

  private setCosmeticsSubTab(tab: CosmeticsSubTab): void {
    this.cosmeticsSubTab = tab;
    this.selectVisible(this.cosmeticsGroups(tab));
    this.requestUpdate();
  }

  /** Display names of the bundle's items the player already owns. */
  private ownedPackItemNames(resolved: ResolvedCosmetic): string[] {
    return ownedPackItems(
      resolved.cosmetic as CosmeticPack,
      this.userMeResponse,
    ).map((item) => {
      const found = findPackItem(item, resolved.packItems ?? []);
      return found ? cosmeticSelectionLabel(found) : item.name;
    });
  }

  // Same box as a purchase button (w-full, min-h-11, text-base) so an owned
  // tier or bundle reads as a peer of its neighbours' buy action instead of
  // a small tag tucked to one side of the card.
  private renderStatus(text: string, muted = false): TemplateResult {
    return html`<span
      data-store-status
      class="mt-2 flex min-h-11 w-full items-center justify-center rounded-lg border px-2 py-1.5 text-center font-bold ${muted
        ? "border-white/15 bg-white/5 text-xs text-white/60"
        : "border-emerald-500/40 bg-emerald-500/15 text-base text-emerald-300"}"
      >${text}</span
    >`;
  }

  private renderCardAction(
    active: ResolvedCosmetic,
    userHasSubscription: boolean,
  ): TemplateResult {
    if (active.type === "subscription" && active.relationship === "owned") {
      return this.renderStatus(translateText("store.subscribed"));
    }
    if (active.type === "cosmeticPack") {
      if (active.relationship === "owned") {
        return this.renderStatus(translateText("store.pack_owned"));
      }
      if (active.relationship === "blocked") {
        return this.renderStatus(
          translateText("store.pack_partially_owned", {
            items: this.ownedPackItemNames(active).join(", "),
          }),
          true,
        );
      }
    }
    return this.renderPurchaseAction(active, userHasSubscription);
  }

  private renderCosmeticCards(
    groups: readonly (readonly ResolvedCosmetic[])[] = this.visibleGroups,
    userHasSubscription = false,
    cardClass = "block h-full min-w-0",
    previewSize: "card" | "detail" = "card",
  ): TemplateResult {
    return html`${groups.map((group) => {
      const focused = group.find((item) => item.key === this.inspected?.key);
      const active = focused ?? group[0];
      const action = this.renderCardAction(active, userHasSubscription);
      return html`<cosmetic-card
        data-store-product
        data-cosmetic-key=${group[0].key}
        class=${cardClass}
        previewSize=${previewSize}
        .resolved=${group[0]}
        .variants=${group.length > 1 ||
        group[0].type === "pattern" ||
        group[0].type === "skin"
          ? group
          : []}
        .activeVariantKey=${active.key}
        .actionContent=${action}
        state=${focused ? "focused" : "idle"}
        .onActivate=${(resolved: ResolvedCosmetic) => this.activate(resolved)}
        .onVariantActivate=${(resolved: ResolvedCosmetic) =>
          this.inspect(resolved)}
      ></cosmetic-card>`;
    })}`;
  }

  private renderPurchaseAction(
    resolved: ResolvedCosmetic,
    userHasSubscription: boolean,
  ): TemplateResult {
    const priced = resolved.cosmetic as {
      name?: string;
      product?: Product | null;
      priceHard?: number;
      priceSoft?: number;
      rarity?: string;
    } | null;
    const isPurchasable = resolved.relationship === "purchasable";
    // Only packs and subscriptions still check out in USD; cosmetics are
    // currency-only (their catalog product is always null now, but a cached
    // cosmetics.json may still carry one — never render a dollar button).
    const product =
      isPurchasable &&
      (resolved.type === "pack" || resolved.type === "subscription")
        ? (priced?.product ?? null)
        : null;
    // A tier with no Stripe listing (sold only on Steam) has no `product`;
    // its price is the tier's own, in cents.
    const subscriptionDollarPrice =
      isPurchasable && resolved.type === "subscription" && product === null
        ? formatUsdCents((resolved.cosmetic as Subscription).priceMonthly)
        : "";
    const priceHard = isPurchasable ? priced?.priceHard : undefined;
    const priceSoft = isPurchasable ? priced?.priceSoft : undefined;
    const purchase = (method: "dollar" | "hard" | "soft") =>
      purchaseCosmetic(resolved, method);
    // Currency packs check out inline (wallet button / in-page card form)
    // when the display price parses; anything else — including subscriptions,
    // which are recurring and not a PaymentIntent — keeps the redirect flow,
    // which is also what an unparseable price degrades to.
    const amountCents =
      resolved.type === "pack" && product !== null && priced?.name !== undefined
        ? priceStringToCents(product.price)
        : null;
    const inlineCheckout =
      amountCents !== null
        ? {
            request: {
              kind: "currency_pack" as const,
              packName: priced!.name!,
            },
            amountCents,
            successMessageKey: "store.currency_pack_purchase_success",
          }
        : null;
    // Reserved currency lines are assigned per visual row by
    // alignPurchaseRows() once the grid has laid out.
    return html`<purchase-button
      .product=${product}
      .dollarPrice=${subscriptionDollarPrice}
      .inlineCheckout=${inlineCheckout}
      .priceHard=${priceHard ?? null}
      .priceSoft=${priceSoft ?? null}
      .rarity=${priced?.rarity ?? "common"}
      .itemName=${cosmeticSelectionLabel(resolved)}
      .dollarLabelKey=${resolved.type === "subscription" && userHasSubscription
        ? "store.switch_button"
        : ""}
      .priceSuffix=${resolved.type === "subscription"
        ? translateText("store.price_per_month")
        : ""}
      .onPurchaseDollar=${product || subscriptionDollarPrice
        ? () => purchase("dollar")
        : undefined}
      .onPurchaseHard=${priceHard !== undefined
        ? () => purchase("hard")
        : undefined}
      .onPurchaseSoft=${priceSoft !== undefined
        ? () => purchase("soft")
        : undefined}
    ></purchase-button>`;
  }

  private renderBrowserLayout(
    cards: TemplateResult,
    gridClass = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4",
  ): TemplateResult {
    return html`<div data-store-browser class="grid grid-cols-1 gap-4 p-3">
      <div data-store-grid class=${gridClass}>${cards}</div>
    </div>`;
  }

  private renderBrowser(
    groups: readonly (readonly ResolvedCosmetic[])[],
    options: StoreBrowserOptions,
  ): TemplateResult {
    const page = this.pages.page(
      "store-grid",
      `${this.affiliateCode ?? ""}:${this.activeTab}:${this.cosmeticsSubTab}`,
      groups,
    );
    const cards =
      groups.length === 0
        ? options.trailingContent
          ? html``
          : html`<div
              class=${`${options.emptyClass ?? "col-span-full"} py-8 text-center text-sm font-bold uppercase tracking-wider text-white/40`}
            >
              ${translateText(options.emptyTranslationKey)}
            </div>`
        : this.renderCosmeticCards(
            page.items,
            options.userHasSubscription,
            options.cardClass,
            options.previewSize,
          );
    return this.renderBrowserLayout(
      html`${cards}${page.more}${options.trailingContent ?? ""}`,
      options.gridClass,
    );
  }

  // Skins / Flags / Crowns grouped under one top-level tab; a sub-tab bar
  // (styled like effects-grid's) picks which grid shows.
  private renderCosmeticsPanel(): TemplateResult {
    const emptyKey =
      this.cosmeticsSubTab === "flags"
        ? "store.no_flags"
        : this.cosmeticsSubTab === "crowns"
          ? "store.no_crowns"
          : "store.no_skins";
    return html`
      <div
        class="flex items-center justify-center gap-6 border-b border-white/10 px-4"
      >
        ${COSMETICS_SUB_TABS.map((tab) => {
          const active = this.cosmeticsSubTab === tab;
          return html`<button
            class="-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${active
              ? "border-malibu-blue text-aquarius"
              : "border-transparent text-white/40 hover:text-white/70"}"
            @click=${() => this.setCosmeticsSubTab(tab)}
          >
            ${translateText(`store.${tab}`)}
          </button>`;
        })}
      </div>
      ${this.renderBrowser(this.visibleGroups, {
        emptyTranslationKey: emptyKey,
      })}
    `;
  }

  private renderEffectGrid(): TemplateResult {
    // A sub-tab per effectType (Boat Trail / Nuke Trail); each tab opens that
    // type's grid. Tabs are always present, even when a type has nothing to buy.
    return html`<effects-grid
      mode="purchase"
      tabbed
      .cosmetics=${this.cosmetics}
      .userMeResponse=${this.userMeResponse}
      .affiliateCode=${this.affiliateCode}
      .focusedKey=${this.inspected?.key ?? null}
      .onPurchaseFocus=${(item: ResolvedCosmetic) => this.activate(item)}
      .renderPurchaseAction=${(item: ResolvedCosmetic) =>
        this.renderPurchaseAction(item, false)}
      .onVisiblePurchaseItemsChange=${(items: readonly ResolvedCosmetic[]) => {
        this.selectVisible(items.map((item) => [item]));
        this.requestUpdate();
      }}
    ></effects-grid>`;
  }

  private renderPackGrid(): TemplateResult {
    // The custom-amount card is always purchasable (priced inline server-side,
    // no catalog entry), and follows the fixed packs at the end of the grid.
    // On BOTH rails: the Steam rail sells custom amounts since OPE-337, so
    // there is no longer a rail on which this card is a dead button.
    return this.renderBrowser(this.visibleGroups, {
      emptyTranslationKey: "store.no_packs",
      trailingContent: html`<custom-currency-card
        class="block w-[calc(50%-0.5rem)] max-w-48 shrink-0 sm:w-48"
      ></custom-currency-card>`,
      gridClass:
        "flex flex-wrap items-stretch justify-center content-start gap-4 p-4 sm:p-8",
      cardClass: "block w-[calc(50%-0.5rem)] max-w-48 shrink-0 sm:w-48",
      emptyClass:
        "w-full py-8 text-center text-sm font-bold uppercase tracking-wider text-white/40",
    });
  }

  private renderBundleGrid(): TemplateResult {
    return html`${this.renderBrowser(this.visibleGroups, {
      emptyTranslationKey: "store.no_bundles",
    })}${this.openedPack && !this.previewingCosmetic
      ? // The dialog is portaled above the modal's stacking context, so a
        // preview opened from one of its items would render underneath it.
        // Yield to the preview; the dialog comes back when it closes.
        html`<pack-contents-dialog
          .pack=${this.openedPack}
          .actionContent=${this.renderCardAction(this.openedPack, false)}
          @close=${() => this.closePack()}
        ></pack-contents-dialog>`
      : ""}`;
  }

  private renderSubscriptionGrid(): TemplateResult {
    // Drives the "Switch" label on the other tiers' buy buttons. A granted
    // player is deliberately NOT counted (OPE-440): they have nothing to
    // switch from — nobody is billing them — so every tier, theirs included,
    // is a first purchase and reads as a plain price.
    const sub =
      this.userMeResponse === false
        ? null
        : this.userMeResponse.player.subscription;
    const userHasSubscription = sub !== null && !isGrantedSubscription(sub);
    // The Steam store lists one tier; a lone card in the narrow tile column
    // reads as a cramped list, so it gets a wider card and a larger preview.
    const lone = this.visibleGroups.length === 1;
    return this.renderBrowser(this.visibleGroups, {
      emptyTranslationKey: "store.no_subscriptions",
      userHasSubscription,
      gridClass:
        "flex flex-wrap items-stretch justify-center content-start gap-4 p-4 sm:p-8",
      cardClass: lone
        ? "block w-full max-w-xs shrink-0"
        : "block w-[calc(50%-0.5rem)] max-w-48 shrink-0 sm:w-48",
      previewSize: lone ? "detail" : "card",
      emptyClass:
        "w-full py-8 text-center text-sm font-bold uppercase tracking-wider text-white/40",
    });
  }

  protected renderHeaderSlot() {
    return html`${this.renderHeader()}
    ${this.previewingCosmetic
      ? html`<cosmetic-preview-modal
          .resolved=${this.previewingCosmetic}
          @close-preview=${() => {
            this.previewingCosmetic = null;
            this.requestUpdate();
          }}
        ></cosmetic-preview-modal>`
      : ""}`;
  }

  protected renderBody(key: string): TemplateResult {
    if (this.affiliateCode) {
      return this.renderAffiliateGrid();
    }
    switch (key as StoreTab) {
      case "steel_shop":
        return this.renderSteelShop();
      case "cosmetics":
        return this.renderCosmeticsPanel();
      case "bundles":
        return this.renderBundleGrid();
      case "effects":
        return this.renderEffectGrid();
      case "subscriptions":
        return this.renderSubscriptionGrid();
      case "tribes":
        return this.renderTribeGrid();
      case "packs":
      default:
        return this.renderPackGrid();
    }
  }

  private renderSteelShop(): TemplateResult {
    const balance = SteelStoreService.getBalance();
    const equipped = SteelStoreService.getEquipped();
    const categories: { key: string; label: string }[] = [
      { key: "all", label: "Alle" },
      { key: "titel", label: "Titel" },
      { key: "badges", label: "Abzeichen (Badges)" },
      { key: "skins", label: "Skins & Tarnungen" },
      { key: "sounds", label: "Custom Sounds" },
    ];

    const items = STEEL_CATALOG.filter(
      (item) =>
        this.steelCategoryFilter === "all" ||
        item.category === this.steelCategoryFilter,
    );

    return html`
      <div class="flex flex-col gap-4 p-4 sm:p-6 max-w-5xl mx-auto w-full">
        <!-- Banner -->
        <div
          class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-cyan-500/30 shadow-lg text-white"
        >
          <div class="flex items-center gap-3.5">
            <div
              class="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center text-cyan-400"
            >
              <svg
                class="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                />
              </svg>
            </div>
            <div>
              <div class="text-base sm:text-lg font-black tracking-tight">
                Stahl-Belohnungssystem
              </div>
              <div class="text-xs text-slate-300">
                Sammle Stahl in jeder Runde (1. Platz: 1000 · 2. Platz: 750 · 3.
                Platz: 500) und schalte exklusive Kosmetika frei!
              </div>
            </div>
          </div>
          <div
            class="flex items-center gap-2 bg-black/40 border border-cyan-400/50 px-4 py-2 rounded-lg font-black text-cyan-300 text-sm shrink-0"
          >
            <span>Verfügbar:</span>
            <span class="text-base text-white tabular-nums">${balance}</span>
            <span>Stahl</span>
          </div>
        </div>

        <!-- Filter Sub-Tabs -->
        <div
          class="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3"
        >
          ${categories.map(
            (cat) => html`
              <button
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${this
                  .steelCategoryFilter === cat.key
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"}"
                @click=${() => {
                  this.steelCategoryFilter = cat.key;
                  this.requestUpdate();
                }}
              >
                ${cat.label}
              </button>
            `,
          )}
        </div>

        <!-- Catalog Grid -->
        <div
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          ${items.map((item) => {
            const isUnlocked = SteelStoreService.isUnlocked(item.id);
            const isEquipped = equipped[item.category] === item.id;
            const canAfford = balance >= item.cost;

            return html`
              <div
                class="flex flex-col justify-between p-4 rounded-xl bg-[#141824] border ${isEquipped
                  ? "border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : isUnlocked
                    ? "border-indigo-500/40"
                    : "border-white/10"} transition-all hover:-translate-y-1 hover:border-white/20"
              >
                <div>
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <span class="text-3xl">${item.icon}</span>
                    <span
                      class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${isEquipped
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : isUnlocked
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          : "bg-white/10 text-gray-400"}"
                    >
                      ${item.category}
                    </span>
                  </div>
                  <div class="text-sm font-bold text-white mb-1">
                    ${item.name}
                  </div>
                  <div class="text-xs text-gray-400 mb-3 leading-relaxed">
                    ${item.description}
                  </div>
                </div>

                <div class="mt-auto pt-3 border-t border-white/5">
                  <div
                    class="flex items-center justify-between text-xs font-bold mb-2.5"
                  >
                    <span class="text-gray-400">Preis:</span>
                    <span
                      class="flex items-center gap-1 font-black ${isUnlocked
                        ? "text-emerald-400"
                        : "text-cyan-300"}"
                    >
                      ${isUnlocked ? "Im Besitz" : `${item.cost} Stahl`}
                    </span>
                  </div>

                  ${isEquipped
                    ? html`
                        <button
                          disabled
                          class="w-full py-1.5 rounded-lg text-xs font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default"
                        >
                          ✓ Aktiviert
                        </button>
                      `
                    : isUnlocked
                      ? html`
                          <button
                            class="w-full py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-sm"
                            @click=${() => {
                              SteelStoreService.equip(item.category, item.id);
                              this.requestUpdate();
                            }}
                          >
                            Ausrüsten
                          </button>
                        `
                      : html`
                          <button
                            ?disabled=${!canAfford}
                            class="w-full py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${canAfford
                              ? "bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                              : "bg-gray-800 text-gray-500 border border-gray-700/50 cursor-not-allowed"}"
                            @click=${() => {
                              const res = SteelStoreService.buyItem(item);
                              if (res.success) {
                                this.requestUpdate();
                              }
                            }}
                          >
                            ${canAfford
                              ? `Für ${item.cost} Stahl kaufen`
                              : `Fehlt ${item.cost - balance} Stahl`}
                          </button>
                        `}
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private renderTribeGrid(): TemplateResult {
    // The panel's `false` branch is a sign-in prompt, i.e. a logged-out
    // state; hold it back until the session is known (see authSettled).
    if (!this.authSettled) return html``;
    return html`<tribes-panel
      .userMeResponse=${this.userMeResponse}
    ></tribes-panel>`;
  }

  private renderAffiliateGrid(): TemplateResult {
    return this.renderBrowser(this.visibleGroups, {
      emptyTranslationKey: "store.no_affiliate_items",
    });
  }

  protected async onOpen(args?: Record<string, unknown>) {
    // Drain any Steam overlay approval parked before this UI existed. The
    // main process's "something arrived" nudge is contentless, so one that
    // fired with no window listening is heard by nobody and sits parked until
    // something drains it -- which makes this required on every open, not an
    // optimisation.
    void reportPendingSteamAuthorizations();
    const affiliate =
      typeof args?.affiliateCode === "string" ? args.affiliateCode : null;
    this.affiliateCode = affiliate;
    this.requestedItem = typeof args?.item === "string" ? args.item : null;
    if (this.requestedItem !== null) {
      this.cosmeticsSubTab = subTabForItem(this.requestedItem);
    }
    this.cosmetics ??= await fetchCosmetics();
    this.selectVisible(this.groupsForTab(this.activeTab));
    await this.refresh();
  }

  protected onClose(): void {
    // The store hides via CSS (inline modal), so the tiles never disconnect
    // and an open card-payment modal — portaled to <body> — would float over
    // the play page after Escape closes the store. Close it explicitly.
    for (const inline of this.querySelectorAll<InlineCheckout>(
      "inline-checkout",
    )) {
      inline.closeCardModal();
    }
    this.affiliateCode = null;
    this.openedPack = null;
    this.previewingCosmetic = null;
    this.pages.reset();
    this.requestedItem = null;
    this.selectVisible(this.groupsForTab(this.activeTab));
  }

  public async refresh() {
    this.requestUpdate();
  }
}
