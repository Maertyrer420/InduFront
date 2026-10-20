import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getApiBase } from "../ApiBase";
import { googleLogin } from "../Auth";

type Mode = "login" | "register";

const de = (navigator.language || "en").toLowerCase().startsWith("de");
const t = (deText: string, enText: string) => (de ? deText : enText);

const ERRORS: Record<string, [string, string]> = {
  invalid_credentials: ["Benutzername oder Passwort falsch.", "Wrong username or password."],
  invalid_username: [
    "Benutzername: 3–20 Zeichen, nur Buchstaben, Zahlen und _.",
    "Username: 3–20 characters, letters, numbers and _ only.",
  ],
  weak_password: ["Passwort: mindestens 8 Zeichen.", "Password: at least 8 characters."],
  username_taken: ["Dieser Benutzername ist bereits vergeben.", "This username is already taken."],
  too_many_requests: ["Zu viele Versuche. Bitte später erneut.", "Too many attempts. Try again later."],
};

/** Username & password sign-in and registration with visibility toggle. */
@customElement("auth-form")
export class AuthForm extends LitElement {
  @state() private mode: Mode = "login";
  @state() private identifier = "";
  @state() private username = "";
  @state() private password = "";
  @state() private showPassword = false;
  @state() private error = "";
  @state() private busy = false;
  @state() private googleAvailable = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    fetch(`${getApiBase()}/auth/providers`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        this.googleAvailable = p?.google === true;
      })
      .catch(() => {});
  }

  private async submit(e: Event) {
    e.preventDefault();
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    const register = this.mode === "register";
    try {
      const res = await fetch(
        `${getApiBase()}/auth/${register ? "register" : "login"}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            register
              ? { username: this.username.trim(), password: this.password }
              : { identifier: this.identifier.trim(), password: this.password },
          ),
        },
      );
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.jwt) {
          localStorage.setItem("indufront_jwt", body.jwt);
        }
        const effectiveName = register ? this.username.trim() : (body?.user?.username || this.identifier.trim());
        if (effectiveName) {
          localStorage.setItem("username", effectiveName);
        }
        localStorage.setItem("useVerifiedName", "true");
        window.location.reload();
        return;
      }
      const body = await res.json().catch(() => ({}));
      const m = ERRORS[body?.error as string];
      this.error = m
        ? t(m[0], m[1])
        : t("Anmeldung fehlgeschlagen.", "Sign-in failed.");
    } catch {
      this.error = t(
        "Login-Server nicht erreichbar.",
        "Cannot reach the login server.",
      );
    } finally {
      this.busy = false;
    }
  }

  private field(
    label: string,
    type: string,
    value: string,
    set: (v: string) => void,
    autocomplete: string,
  ) {
    return html`<label class="block">
      <span class="text-xs font-semibold text-white/60">${label}</span>
      <input
        type=${type}
        .value=${value}
        autocomplete=${autocomplete}
        required
        @input=${(e: Event) => set((e.target as HTMLInputElement).value)}
        class="mt-1 w-full px-3.5 py-2.5 bg-white/5 border border-white/15 focus:border-white/50 rounded-xl text-white text-sm outline-none"
      />
    </label>`;
  }

  private passwordField(
    label: string,
    value: string,
    set: (v: string) => void,
    autocomplete: string,
  ) {
    return html`<label class="block">
      <span class="text-xs font-semibold text-white/60">${label}</span>
      <div class="relative mt-1">
        <input
          type=${this.showPassword ? "text" : "password"}
          .value=${value}
          autocomplete=${autocomplete}
          required
          @input=${(e: Event) => set((e.target as HTMLInputElement).value)}
          class="w-full pl-3.5 pr-10 py-2.5 bg-white/5 border border-white/15 focus:border-white/50 rounded-xl text-white text-sm outline-none"
        />
        <button
          type="button"
          @click=${() => (this.showPassword = !this.showPassword)}
          aria-label=${this.showPassword ? t("Passwort verbergen", "Hide password") : t("Passwort anzeigen", "Show password")}
          class="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white transition-colors"
        >
          ${this.showPassword
            ? html`<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>`
            : html`<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>`}
        </button>
      </div>
    </label>`;
  }

  render() {
    const register = this.mode === "register";
    return html`
      <form class="space-y-4" @submit=${(e: Event) => this.submit(e)}>
        <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5">
          ${(["login", "register"] as Mode[]).map(
            (m) => html`<button
              type="button"
              @click=${() => {
                this.mode = m;
                this.error = "";
              }}
              class="py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${this.mode === m
                ? "bg-white text-black"
                : "text-white/60 hover:text-white"}"
            >
              ${m === "login"
                ? t("Anmelden", "Sign in")
                : t("Registrieren", "Register")}
            </button>`,
          )}
        </div>

        ${register
          ? this.field(
              t("Benutzername", "Username"),
              "text",
              this.username,
              (v) => (this.username = v),
              "username",
            )
          : this.field(
              t("Benutzername", "Username"),
              "text",
              this.identifier,
              (v) => (this.identifier = v),
              "username",
            )}

        ${this.passwordField(
          t("Passwort", "Password"),
          this.password,
          (v) => (this.password = v),
          register ? "new-password" : "current-password",
        )}

        ${this.error
          ? html`<div class="text-xs text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg">
              ${this.error}
            </div>`
          : nothing}

        <button
          type="submit"
          ?disabled=${this.busy}
          class="w-full px-6 py-3 text-sm font-bold uppercase tracking-wider rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white transition-colors"
        >
          ${register
            ? t("Konto erstellen", "Create account")
            : t("Anmelden", "Sign in")}
        </button>

        ${this.googleAvailable
          ? html`<button
              type="button"
              @click=${() => googleLogin()}
              class="w-full px-6 py-3 text-sm font-bold rounded-xl bg-white hover:bg-[#f7f8f8] text-[#1f1f1f] border border-[#dadce0]"
            >
              ${t("Mit Google anmelden", "Sign in with Google")}
            </button>`
          : nothing}
      </form>
    `;
  }
}
