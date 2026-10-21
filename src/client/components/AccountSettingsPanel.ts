import { UserMeResponse } from "@openfront/shared/ApiSchemas";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { isSteamPrimaryUser } from "../AccountIdentity";
import {
  deleteAccount,
  setLevelVisibility,
  setMarketingConsent,
  setSearchVisibility,
  type SetVisibilityResult,
} from "../Api";
import { getApiBase } from "../ApiBase";
import {
  clearLocalSession,
  linkGoogle,
  sendMagicLink,
  userAuth,
} from "../Auth";
import { isDesktopShell } from "../DesktopShell";
import { gamePortal } from "../GamePortal";
import { showInGameAlert } from "../InGameModal";
import { refreshOwnHiddenLevelBadge } from "../OwnLevelBadge";
import { steamSDK } from "../SteamSDK";
import { translateText } from "../Utils";
import "./baseComponents/Button";
import "./DeleteAccountDialog";
import "./IdentityTokenCard";
import "./LevelBadge";
import { googleLinkButton } from "./ui/GoogleLinkButton";

type UserMePlayer = UserMeResponse["player"];
type UserMeUser = UserMeResponse["user"];

const de = (navigator.language || "en").toLowerCase().startsWith("de");
const t = (deText: string, enText: string) => (de ? deText : enText);

// The /users/@me privacy flags the Privacy card toggles, each with the request
// that stores it and the alert shown when that request fails.
type PrivacyField = "levelHidden" | "searchHidden";
const PRIVACY_SETTINGS: Record<
  PrivacyField,
  { save: (hidden: boolean) => Promise<SetVisibilityResult>; failedKey: string }
> = {
  levelHidden: {
    save: (hidden) => setLevelVisibility(hidden),
    failedKey: "account_modal.level_visibility_failed",
  },
  searchHidden: {
    save: (hidden) => setSearchVisibility(hidden),
    failedKey: "account_modal.search_visibility_failed",
  },
};

/**
 * Account settings: marketing-consent control (with the bind-an-email flow when
 * the account has no verified email), privacy ("hide my level", "keep my
 * profile out of search engines"), third-party identity tokens and
 * self-service account deletion.
 *
 * Extracted from AccountModal so the standalone account-settings modal opened
 * from the nav profile menu and the account modal's settings tab render the
 * exact same controls.
 */
@customElement("account-settings-panel")
export class AccountSettingsPanel extends LitElement {
  @property({ attribute: false }) player: UserMePlayer | null = null;
  @property({ attribute: false }) user: UserMeUser | null = null;

  @state() private email: string = "";
  @state() private idCopied = false;
  @state() private safeEmail = "";
  @state() private verifyCodeInput = "";
  @state() private safeBusy = false;
  @state() private safeCodeSent = false;
  @state() private safeError = "";
  @state() private safeSuccess = "";
  @state() private doubleSafeActive: boolean | null = null;
  @state() private emailVerifiedActive: boolean | null = null;
  @state() private currentPassword = "";
  @state() private newPassword = "";
  @state() private showCurrentPassword = false;
  @state() private showNewPassword = false;
  @state() private passwordChangeBusy = false;
  @state() private passwordChangeError = "";
  @state() private passwordChangeSuccess = "";
  @state() private consentBusy: boolean = false;
  // Per setting, so one switch's request in flight never locks the other.
  @state() private privacyBusy: Record<PrivacyField, boolean> = {
    levelHidden: false,
    searchHidden: false,
  };
  @state() private deleteDialogOpen: boolean = false;
  @state() private deleteBusy: boolean = false;

  createRenderRoot() {
    return this;
  }

  /**
   * Dismiss the delete confirmation. The dialog portals to document.body, so a
   * host that merely hides itself (inline modals) must call this on close or
   * the dialog outlives the modal.
   */
  public closeDialogs(): void {
    this.deleteDialogOpen = false;
  }

  disconnectedCallback(): void {
    this.closeDialogs();
    super.disconnectedCallback();
  }

  // Steam is the primary (and only, in v1) identity for a Steam user — no
  // linking UI (email/Google) is offered for them.
  private isSteamPrimary(): boolean {
    return isSteamPrimaryUser(this.user ?? undefined);
  }

  render(): TemplateResult {
    return html`
      <div class="flex flex-col gap-6">
        ${this.renderPlayerIdCard()} ${this.renderDoubleSafeCard()}
        ${this.renderPasswordChangeCard()} ${this.renderMarketingCard()}
        ${this.renderPrivacyCard()}
        <identity-token-card></identity-token-card>
        ${this.renderDeleteAccountCard()}
      </div>
    `;
  }

  private renderPlayerIdCard(): TemplateResult {
    const rawId =
      this.user?.publicId ??
      this.player?.publicId ??
      (this.player as { id?: string } | null)?.id ??
      "—";
    return html`
      <div class="bg-white/5 rounded-xl border border-white/10 p-6">
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <div
              class="text-white font-medium text-base flex items-center gap-2"
            >
              <span class="text-xl">🆔</span>
              <span>${t("Deine Spieler-ID", "Your Player ID")}</span>
            </div>
            <div class="text-white/50 text-sm mt-1">
              ${t(
                "Sämtliche Statistiken, Match-History (letzte 10 Spiele), Chats und Clans sind dauerhaft an diese eindeutige ID gebunden.",
                "All stats, match history (last 10 games), chats, and clans are permanently tied to this unique ID.",
              )}
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span
              class="font-mono font-bold text-yellow-300 text-sm sm:text-base bg-black/40 border border-white/20 px-3 py-1.5 rounded-lg tracking-widest select-all"
            >
              ${rawId}
            </span>
            <button
              type="button"
              @click=${() => {
                if (rawId && rawId !== "—") {
                  navigator.clipboard.writeText(rawId);
                  this.idCopied = true;
                  setTimeout(() => (this.idCopied = false), 2500);
                }
              }}
              class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              ${this.idCopied
                ? t("Kopiert! ✓", "Copied! ✓")
                : t("Kopieren", "Copy")}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderDoubleSafeCard(): TemplateResult | typeof nothing {
    if (isSteamPrimaryUser(this.user)) return nothing;
    const isVerified =
      this.emailVerifiedActive ?? this.user?.emailVerified ?? false;
    const isDoubleSafe =
      this.doubleSafeActive ?? this.user?.doubleSafeEnabled ?? false;
    const currentEmail =
      this.safeEmail.length > 0 ? this.safeEmail : (this.user?.email ?? "");

    return html`
      <div class="bg-white/5 rounded-xl border border-white/10 p-6">
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div class="flex-1">
            <div
              class="text-white font-medium text-base flex items-center gap-2"
            >
              <span class="text-xl">🛡️</span>
              <span
                >${t(
                  "Account-Wiederherstellung & Double Safe",
                  "Account Recovery & Double Safe",
                )}</span
              >
            </div>
            <div class="text-white/50 text-sm mt-1">
              ${t(
                "Verknüpfe deine E-Mail-Adresse für Passwort-Reset und aktiviere Double Safe für doppelten Kontoschutz.",
                "Link your email for password recovery and activate Double Safe for enhanced account protection.",
              )}
            </div>
          </div>
          ${isVerified
            ? html`
                <div
                  class="flex items-center gap-3 bg-black/30 px-3.5 py-2 rounded-xl border border-white/10 shrink-0"
                >
                  <span class="text-xs text-white/80 font-medium"
                    >Double Safe:</span
                  >
                  <button
                    role="switch"
                    aria-checked=${isDoubleSafe ? "true" : "false"}
                    ?disabled=${this.safeBusy}
                    @click=${() => this.toggleDoubleSafe(!isDoubleSafe)}
                    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-malibu-blue/50 disabled:opacity-60 ${isDoubleSafe
                      ? "bg-green-600 shadow-md"
                      : "bg-white/15"}"
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${isDoubleSafe
                        ? "translate-x-6"
                        : "translate-x-1"}"
                    ></span>
                  </button>
                </div>
              `
            : nothing}
        </div>

        <div class="mt-4 pt-4 border-t border-white/10 space-y-3">
          <div class="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              .value=${currentEmail}
              @input=${(e: Event) =>
                (this.safeEmail = (e.target as HTMLInputElement).value)}
              placeholder="deine-email@beispiel.de"
              ?disabled=${this.safeBusy}
              class="flex-1 px-3.5 py-2.5 bg-white/5 border border-white/15 focus:border-white/50 rounded-xl text-white text-sm outline-none"
            />
            <button
              type="button"
              ?disabled=${this.safeBusy || !currentEmail}
              @click=${() => this.handleSendSafeCode(currentEmail)}
              class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
            >
              ${this.safeBusy
                ? t("Senden...", "Sending...")
                : t("Code anfordern", "Send Code")}
            </button>
          </div>

          ${this.safeCodeSent || !isVerified
            ? html`
                <div class="flex flex-col sm:flex-row gap-2 items-center">
                  <input
                    type="text"
                    maxlength="6"
                    .value=${this.verifyCodeInput}
                    @input=${(e: Event) =>
                      (this.verifyCodeInput = (
                        e.target as HTMLInputElement
                      ).value)}
                    placeholder="6-stelliger Code"
                    class="w-full sm:w-48 px-3.5 py-2.5 font-mono tracking-widest text-center bg-white/5 border border-white/15 focus:border-white/50 rounded-xl text-white text-sm outline-none"
                  />
                  <button
                    type="button"
                    ?disabled=${this.safeBusy ||
                    this.verifyCodeInput.trim().length !== 6}
                    @click=${this.handleVerifySafeCode}
                    class="w-full sm:w-auto px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white transition-colors"
                  >
                    ${t("Code bestätigen", "Verify Code")}
                  </button>
                  <span class="text-xs text-white/50">
                    ${isVerified
                      ? html`<span class="text-green-400 font-medium"
                          >✓ ${t("E-Mail verifiziert", "Email verified")}</span
                        >`
                      : t("E-Mail noch nicht bestätigt", "Email not verified")}
                  </span>
                </div>
              `
            : html`
                <div
                  class="text-xs text-green-400 font-medium flex items-center gap-1.5"
                >
                  <span>✓</span>
                  <span
                    >${t(
                      "E-Mail ist verifiziert und geschützt.",
                      "Email is verified and secured.",
                    )}</span
                  >
                  ${isDoubleSafe
                    ? html`<span class="text-blue-300 font-semibold"
                        >• Double Safe AKTIV</span
                      >`
                    : html`<span class="text-yellow-400"
                        >• Double Safe inaktiv</span
                      >`}
                </div>
              `}
          ${this.safeError
            ? html`<div
                class="text-xs text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg"
              >
                ${this.safeError}
              </div>`
            : nothing}
          ${this.safeSuccess
            ? html`<div
                class="text-xs text-green-400 bg-green-500/10 border border-green-500/30 px-3 py-2 rounded-lg"
              >
                ${this.safeSuccess}
              </div>`
            : nothing}
        </div>
      </div>
    `;
  }

  private handleSendSafeCode = async (email: string): Promise<void> => {
    if (!email || !email.includes("@")) {
      this.safeError = t(
        "Bitte gib eine gültige E-Mail-Adresse ein.",
        "Please enter a valid email address.",
      );
      return;
    }
    const auth = await userAuth();
    if (!auth) {
      this.safeError = t("Nicht eingeloggt.", "Not logged in.");
      return;
    }
    this.safeBusy = true;
    this.safeError = "";
    this.safeSuccess = "";
    try {
      const res = await fetch(`${getApiBase()}/auth/email/send-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.jwt}`,
        },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        this.safeCodeSent = true;
        this.safeSuccess = t(
          data.code
            ? `Code generiert: ${data.code} (in Server-Logs & für Tests hinterlegt).`
            : "Bestätigungscode wurde gesendet! Bitte prüfe dein Postfach.",
          "Verification code sent! Please check your inbox.",
        );
      } else {
        this.safeError = t(
          "Fehler beim Senden des Codes.",
          "Failed to send verification code.",
        );
      }
    } catch {
      this.safeError = t(
        "Verbindungsfehler zum Server.",
        "Connection error to server.",
      );
    } finally {
      this.safeBusy = false;
    }
  };

  private handleVerifySafeCode = async (): Promise<void> => {
    const code = this.verifyCodeInput.trim();
    if (code.length !== 6) {
      this.safeError = t(
        "Der Code muss 6 Ziffern lang sein.",
        "Code must be 6 digits.",
      );
      return;
    }
    const auth = await userAuth();
    if (!auth) {
      this.safeError = t("Nicht eingeloggt.", "Not logged in.");
      return;
    }
    this.safeBusy = true;
    this.safeError = "";
    this.safeSuccess = "";
    try {
      const res = await fetch(`${getApiBase()}/auth/email/verify-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.jwt}`,
        },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        this.emailVerifiedActive = true;
        this.doubleSafeActive = true;
        this.safeSuccess = t(
          "E-Mail erfolgreich verifiziert! Double Safe wurde automatisch aktiviert.",
          "Email successfully verified! Double Safe has been enabled.",
        );
        this.verifyCodeInput = "";
      } else {
        this.safeError = t(
          "Ungültiger oder abgelaufener Code.",
          "Invalid or expired code.",
        );
      }
    } catch {
      this.safeError = t(
        "Verbindungsfehler zum Server.",
        "Connection error to server.",
      );
    } finally {
      this.safeBusy = false;
    }
  };

  private toggleDoubleSafe = async (enabled: boolean): Promise<void> => {
    const auth = await userAuth();
    if (!auth) return;
    this.safeBusy = true;
    try {
      const res = await fetch(`${getApiBase()}/auth/double-safe/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.jwt}`,
        },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        this.doubleSafeActive = enabled;
        this.safeSuccess = enabled
          ? t("Double Safe aktiviert.", "Double Safe enabled.")
          : t("Double Safe deaktiviert.", "Double Safe disabled.");
      }
    } catch {
      this.safeError = t(
        "Fehler beim Ändern von Double Safe.",
        "Failed to toggle Double Safe.",
      );
    } finally {
      this.safeBusy = false;
    }
  };

  // Persistent marketing-consent control (client-driven consent). Mirrors the
  // post-login toast: a player can turn email updates on/off any time here, or
  // — when there's no verified email on the account — is told to link one.
  private renderMarketingCard(): TemplateResult | typeof nothing {
    const consent = this.player?.marketingConsent;
    // The API didn't return consent state (older backend). Nothing to
    // configure, so no card rather than a misleading "link an email" prompt.
    if (!consent) return nothing;
    const hasEmail = consent.hasEmail;
    const on = consent.consented === "approved";
    // Steam is primary and there's no email on the account: renderEmailBinding()
    // is suppressed below (no linking UI for Steam in v1), so this is the one
    // combination with no route to ever get an email. The toggle still renders
    // — disabled, not omitted — so the card isn't just a heading and a
    // description with nothing where the control belongs (OPE-397).
    const steamNoEmail = !hasEmail && this.isSteamPrimary();
    return html`
      <div class="bg-white/5 rounded-xl border border-white/10 p-6">
        <!-- Centred against the title+description block, like the delete card. -->
        <div class="flex items-center justify-between gap-4">
          <div class="flex-1">
            <div class="text-white font-medium">
              ${translateText("account_modal.marketing_title")}
            </div>
            <div class="text-white/50 text-sm mt-1">
              ${hasEmail
                ? translateText("account_modal.marketing_desc")
                : steamNoEmail
                  ? translateText("account_modal.marketing_no_email_steam")
                  : translateText("account_modal.marketing_no_email")}
            </div>
          </div>
          ${hasEmail || steamNoEmail
            ? html`<button
                role="switch"
                aria-checked=${on ? "true" : "false"}
                aria-label=${translateText("account_modal.marketing_title")}
                ?disabled=${this.consentBusy || steamNoEmail}
                @click=${() => this.setConsent(!on)}
                class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-malibu-blue/50 disabled:opacity-60 ${on
                  ? "bg-malibu-blue shadow-[var(--shadow-malibu-blue-pill)]"
                  : "bg-white/15"}"
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${on
                    ? "translate-x-6"
                    : "translate-x-1"}"
                ></span>
              </button>`
            : nothing}
        </div>
        ${hasEmail || this.isSteamPrimary()
          ? nothing
          : this.renderEmailBinding()}
      </div>
    `;
  }

  // Privacy: "Show my level to other players" and "Show my profile in search
  // engines". Each row only when /users/@me carries its setting at all, and
  // the card only when it carries either — an older API without them gets no
  // card.
  private renderPrivacyCard(): TemplateResult | typeof nothing {
    const levelHidden = this.player?.levelHidden;
    const searchHidden = this.player?.searchHidden;
    if (levelHidden === undefined && searchHidden === undefined) {
      return nothing;
    }
    return html`
      <div class="bg-white/5 rounded-xl border border-white/10 p-6">
        <div
          class="text-xs text-white/40 uppercase tracking-widest font-bold mb-4"
        >
          ${translateText("account_modal.privacy_title")}
        </div>
        ${levelHidden === undefined
          ? nothing
          : html`${this.renderPrivacySwitchRow(
              translateText("account_modal.level_visibility_title"),
              translateText("account_modal.level_visibility_desc"),
              !levelHidden,
              this.privacyBusy.levelHidden,
              (shown) => this.setPrivacyShown("levelHidden", shown),
            )}
            ${this.renderLevelPreview(!levelHidden)}`}
        ${searchHidden === undefined
          ? nothing
          : html`<div
              class=${levelHidden === undefined
                ? ""
                : "mt-4 pt-4 border-t border-white/10"}
            >
              ${this.renderPrivacySwitchRow(
                translateText("account_modal.search_visibility_title"),
                translateText("account_modal.search_visibility_desc"),
                !searchHidden,
                this.privacyBusy.searchHidden,
                (shown) => this.setPrivacyShown("searchHidden", shown),
              )}
            </div>`}
      </div>
    `;
  }

  // One Privacy row: title, description and the same role="switch" toggle as
  // the email-updates card. On = shown.
  private renderPrivacySwitchRow(
    title: string,
    description: string,
    shown: boolean,
    busy: boolean,
    setShown: (shown: boolean) => void,
  ): TemplateResult {
    return html`
      <div class="flex items-center justify-between gap-4">
        <div class="flex-1">
          <div class="text-white font-medium">${title}</div>
          <div class="text-white/50 text-sm mt-1">${description}</div>
        </div>
        <button
          role="switch"
          aria-checked=${shown ? "true" : "false"}
          aria-label=${title}
          ?disabled=${busy}
          @click=${() => setShown(!shown)}
          class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-malibu-blue/50 disabled:opacity-60 ${shown
            ? "bg-malibu-blue shadow-[var(--shadow-malibu-blue-pill)]"
            : "bg-white/15"}"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${shown
              ? "translate-x-6"
              : "translate-x-1"}"
          ></span>
        </button>
      </div>
    `;
  }

  // "Others see": the player's name as other players get it — with their
  // level badge, or without it and marked hidden. Decorative (the switch
  // carries the state), so hidden from assistive tech. Needs the player's
  // level, so it is left out when progression is off.
  private renderLevelPreview(shown: boolean): TemplateResult | typeof nothing {
    const progress = this.player?.progress;
    if (progress === undefined) return nothing;
    return html`
      <div
        class="level-visibility-preview mt-4 flex items-center gap-3 rounded-lg bg-black/20 border border-white/5 px-4 py-3"
        aria-hidden="true"
      >
        <span
          class="text-[10px] uppercase tracking-widest font-bold text-white/40"
          >${translateText("account_modal.level_visibility_others_see")}</span
        >
        <span class="flex items-center gap-1.5 text-white font-semibold">
          ${shown
            ? html`<level-badge
                class="shrink-0"
                .level=${progress.level}
                .prestige=${progress.prestige}
                ?legend=${progress.legend}
                size="24"
              ></level-badge>`
            : nothing}
          ${this.player?.username ?? ""}
        </span>
        ${shown
          ? nothing
          : html`<span class="ml-auto text-xs text-white/40"
              >${translateText("account_modal.level_visibility_hidden")}</span
            >`}
      </div>
    `;
  }

  // No verified email on the account yet. Offer both ways to attach one:
  // a magic link to a plain email (the backend associates a not-yet-registered
  // email with the current session — the "new-association" path), or linking a
  // Google account.
  private renderEmailBinding(): TemplateResult {
    return html`
      <div class="mt-4 space-y-3">
        ${this.renderEmailField()}
        <div class="flex items-center gap-4 py-1">
          <div class="h-px bg-white/10 flex-1"></div>
          <span
            class="text-[10px] uppercase tracking-widest text-white/30 font-bold"
          >
            ${translateText("account_modal.or")}
          </span>
          <div class="h-px bg-white/10 flex-1"></div>
        </div>
        ${this.user?.google
          ? nothing
          : googleLinkButton(
              this.handleLinkGoogle,
              // The shell sends the player to the website for this (see
              // linkGoogle in Auth.ts); the caption has to say so.
              isDesktopShell()
                ? "account_modal.link_google_on_web"
                : "account_modal.link_google",
            )}
      </div>
    `;
  }

  private renderEmailField(): TemplateResult {
    return html`
      <input
        type="email"
        .value=${this.email}
        @input=${this.handleEmailInput}
        placeholder=${translateText("account_modal.email_placeholder")}
        class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-malibu-blue/50 focus:border-malibu-blue/50 transition-all font-medium hover:bg-white/10"
      />
      <o-button
        variant="primary"
        width="block"
        size="md"
        translationKey="account_modal.get_magic_link"
        @click=${this.handleSubmit}
      ></o-button>
    `;
  }

  private renderPasswordChangeCard(): TemplateResult | typeof nothing {
    if (isSteamPrimaryUser(this.user)) return nothing;
    return html`
      <div class="bg-white/5 rounded-xl border border-white/10 p-6">
        <div class="text-white font-medium text-base">
          ${t("Passwort ändern", "Change Password")}
        </div>
        <div class="text-white/50 text-sm mt-1">
          ${t(
            "Aktualisiere dein Passwort für diesen Account (mind. 8 Zeichen).",
            "Update your account password (at least 8 characters).",
          )}
        </div>

        <form class="mt-4 space-y-3" @submit=${this.handlePasswordChangeSubmit}>
          <label class="block">
            <span class="text-xs font-semibold text-white/60"
              >${t("Aktuelles Passwort", "Current Password")}</span
            >
            <div class="relative mt-1">
              <input
                type=${this.showCurrentPassword ? "text" : "password"}
                .value=${this.currentPassword}
                autocomplete="current-password"
                required
                @input=${(e: Event) =>
                  (this.currentPassword = (e.target as HTMLInputElement).value)}
                class="w-full pl-3.5 pr-10 py-2.5 bg-white/5 border border-white/15 focus:border-white/50 rounded-xl text-white text-sm outline-none"
              />
              <button
                type="button"
                @click=${() =>
                  (this.showCurrentPassword = !this.showCurrentPassword)}
                aria-label=${this.showCurrentPassword
                  ? t("Passwort verbergen", "Hide password")
                  : t("Passwort anzeigen", "Show password")}
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white transition-colors"
              >
                ${this.showCurrentPassword
                  ? html`<svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                      />
                    </svg>`
                  : html`<svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>`}
              </button>
            </div>
          </label>

          <label class="block">
            <span class="text-xs font-semibold text-white/60"
              >${t("Neues Passwort", "New Password")}</span
            >
            <div class="relative mt-1">
              <input
                type=${this.showNewPassword ? "text" : "password"}
                .value=${this.newPassword}
                autocomplete="new-password"
                required
                @input=${(e: Event) =>
                  (this.newPassword = (e.target as HTMLInputElement).value)}
                class="w-full pl-3.5 pr-10 py-2.5 bg-white/5 border border-white/15 focus:border-white/50 rounded-xl text-white text-sm outline-none"
              />
              <button
                type="button"
                @click=${() => (this.showNewPassword = !this.showNewPassword)}
                aria-label=${this.showNewPassword
                  ? t("Passwort verbergen", "Hide password")
                  : t("Passwort anzeigen", "Show password")}
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white transition-colors"
              >
                ${this.showNewPassword
                  ? html`<svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                      />
                    </svg>`
                  : html`<svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>`}
              </button>
            </div>
          </label>

          ${this.passwordChangeError
            ? html`<div
                class="text-xs text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg"
              >
                ${this.passwordChangeError}
              </div>`
            : nothing}
          ${this.passwordChangeSuccess
            ? html`<div
                class="text-xs text-green-400 bg-green-500/10 border border-green-500/30 px-3 py-2 rounded-lg"
              >
                ${this.passwordChangeSuccess}
              </div>`
            : nothing}

          <div class="pt-2">
            <button
              type="submit"
              ?disabled=${this.passwordChangeBusy}
              class="px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white transition-colors"
            >
              ${this.passwordChangeBusy
                ? t("Wird gespeichert...", "Saving...")
                : t("Passwort speichern", "Update Password")}
            </button>
          </div>
        </form>
      </div>
    `;
  }

  private handlePasswordChangeSubmit = async (e: Event): Promise<void> => {
    e.preventDefault();
    if (this.passwordChangeBusy) return;
    this.passwordChangeError = "";
    this.passwordChangeSuccess = "";

    if (this.newPassword.length < 8) {
      this.passwordChangeError = t(
        "Das neue Passwort muss mindestens 8 Zeichen lang sein.",
        "New password must be at least 8 characters.",
      );
      return;
    }

    const auth = await userAuth();
    if (!auth) {
      this.passwordChangeError = t("Nicht eingeloggt.", "Not logged in.");
      return;
    }

    this.passwordChangeBusy = true;
    try {
      const res = await fetch(`${getApiBase()}/users/@me/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.jwt}`,
        },
        body: JSON.stringify({
          currentPassword: this.currentPassword,
          newPassword: this.newPassword,
        }),
      });

      if (res.ok) {
        this.passwordChangeSuccess = t(
          "Passwort erfolgreich aktualisiert!",
          "Password updated successfully!",
        );
        this.currentPassword = "";
        this.newPassword = "";
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error === "incorrect_password") {
          this.passwordChangeError = t(
            "Aktuelles Passwort ist nicht korrekt.",
            "Current password is incorrect.",
          );
        } else if (data.error === "weak_password") {
          this.passwordChangeError = t(
            "Das neue Passwort ist zu schwach (mind. 8 Zeichen).",
            "New password is too short (at least 8 characters).",
          );
        } else {
          this.passwordChangeError = t(
            "Passwort konnte nicht geändert werden.",
            "Failed to change password.",
          );
        }
      }
    } catch {
      this.passwordChangeError = t(
        "Verbindungsfehler zum Server.",
        "Connection error to server.",
      );
    } finally {
      this.passwordChangeBusy = false;
    }
  };

  // Self-service account deletion (DELETE /users/@me). A valid request queues
  // the deletion for 24 hours later and logs the player out everywhere, so the
  // button opens a hard confirm (typed confirmation). Hidden on portals and
  // Steam: the endpoint's credential is the refresh cookie, which isn't usable
  // there (cross-site — see Auth.ts), so the request could never succeed.
  private renderDeleteAccountCard(): TemplateResult | typeof nothing {
    if (gamePortal.isOnGamePortal() || steamSDK.isOnSteam()) return nothing;
    return html`
      <div class="bg-white/5 rounded-xl border border-red-500/30 p-6">
        <!-- The button is one line against a two-line block, so centre it
             rather than pinning it to the first line. -->
        <div class="flex items-center justify-between gap-4">
          <div class="flex-1">
            <div class="text-white font-medium">
              ${translateText("account_modal.delete_account_title")}
            </div>
            <div class="text-white/50 text-sm mt-1">
              ${translateText("account_modal.delete_account_desc")}
            </div>
          </div>
          <o-button
            variant="danger"
            size="sm"
            translationKey="account_modal.delete_account_title"
            .disable=${this.deleteBusy}
            @click=${() => {
              this.deleteDialogOpen = true;
            }}
          ></o-button>
        </div>
      </div>
      ${this.deleteDialogOpen
        ? html`<delete-account-dialog
            @confirm=${this.handleDeleteAccount}
            @cancel=${() => {
              this.deleteDialogOpen = false;
            }}
          ></delete-account-dialog>`
        : nothing}
    `;
  }

  private handleDeleteAccount = async (): Promise<void> => {
    this.deleteDialogOpen = false;
    if (this.deleteBusy) return;

    this.deleteBusy = true;
    const result = await deleteAccount();
    this.deleteBusy = false;

    if (result.ok) {
      // 204: the deletion is queued for 24 hours from now, not done — say so,
      // and point at support since cancelling is a support action (there is
      // no self-service cancel). Every session is already revoked and the
      // refresh cookie cleared, so only local state is left to drop; calling
      // /auth/logout here would be wrong (the credential no longer exists).
      // Drop local state before the alert: it resolves only when the player
      // clicks Close, and closing the tab instead must not leave the revoked
      // session looking signed in on the next launch.
      clearLocalSession();
      await showInGameAlert(
        translateText("account_modal.delete_account_scheduled"),
      );
      // Navigate to the homepage rather than reloading in place: reloading
      // keeps the #modal=account-settings hash, which reopens a login-gated
      // modal for a now-logged-out player.
      window.location.replace("/");
      return;
    }
    if (result.code === "logged_out") {
      // 401: the session was already gone and the cookie is cleared. Nothing
      // was queued; drop local state so the player can sign in and retry.
      clearLocalSession();
      window.location.replace("/");
      return;
    }
    if (result.code === "forbidden" && result.message !== undefined) {
      // Server's player-facing refusal (root player / banned account).
      await showInGameAlert(result.message);
    } else if (result.code === "rate_limited") {
      await showInGameAlert(
        translateText("account_modal.delete_account_rate_limited"),
      );
    } else {
      await showInGameAlert(
        translateText("account_modal.delete_account_failed"),
      );
    }
  };

  private async setConsent(consented: boolean): Promise<void> {
    const consent = this.player?.marketingConsent;
    // No email to subscribe means no consent request to make — belt-and-
    // braces alongside the `disabled` attribute on the Steam-no-email toggle.
    if (!consent || !consent.hasEmail || this.consentBusy) return;
    const previous = consent.consented;
    const next = consented ? "approved" : "denied";
    if (previous === next) return;

    // Optimistic: reflect the new state immediately, revert if the request fails.
    this.consentBusy = true;
    consent.consented = next;
    this.requestUpdate();

    const ok = await setMarketingConsent(consented);
    if (!ok) {
      consent.consented = previous;
    }
    this.consentBusy = false;
    this.requestUpdate();
  }

  // One handler for every Privacy switch: the field, its busy flag, its
  // request and its error text all come from PRIVACY_SETTINGS[field], so a
  // toggle can only ever read and write its own setting.
  private async setPrivacyShown(
    field: PrivacyField,
    shown: boolean,
  ): Promise<void> {
    const player = this.player;
    if (!player || player[field] === undefined) return;
    if (this.privacyBusy[field]) return;
    const previous = player[field];
    const hidden = !shown;
    if (previous === hidden) return;

    // Optimistic, like the consent toggle: `player` is the cached /users/@me
    // profile, so this also keeps every other reader of it consistent. The
    // switch is disabled until the server answers; a failure puts it back.
    const setting = PRIVACY_SETTINGS[field];
    this.privacyBusy = { ...this.privacyBusy, [field]: true };
    player[field] = hidden;

    const result = await setting.save(hidden);
    player[field] = result.ok ? result.hidden : previous;
    this.privacyBusy = { ...this.privacyBusy, [field]: false };
    // The viewer's own-badge fallback (lobby roster, in-game panel) reads the
    // same cached profile: re-read it now so a level change shows without
    // waiting for the next lobby.
    if (result.ok && field === "levelHidden") {
      void refreshOwnHiddenLevelBadge();
    }

    // 401: logOut() has already run and the signed-out state takes over —
    // nothing to tell the player here.
    if (!result.ok && result.code === "failed") {
      await showInGameAlert(translateText(setting.failedKey));
    }
  }

  private handleEmailInput = (e: Event): void => {
    this.email = (e.target as HTMLInputElement).value;
  };

  private handleSubmit = async (): Promise<void> => {
    if (!this.email) {
      await showInGameAlert(translateText("account_modal.enter_email_address"));
      return;
    }

    const success = await sendMagicLink(this.email);
    await showInGameAlert(
      success
        ? translateText("account_modal.recovery_email_sent", {
            email: this.email,
          })
        : translateText("account_modal.failed_to_send_recovery_email"),
    );
  };

  private handleLinkGoogle = async (): Promise<void> => {
    // On success linkGoogle navigates to Google; the result comes back as a
    // `link=...` router arg handled by the account modal. A false return means
    // we couldn't start it.
    const started = await linkGoogle();
    if (!started) {
      await showInGameAlert(translateText("account_modal.link_google_failed"));
    }
  };
}
