import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getApiBase } from "../ApiBase";
import { googleLogin } from "../Auth";

type Mode = "login" | "register";

const de = (navigator.language || "en").toLowerCase().startsWith("de");
const t = (deText: string, enText: string) => (de ? deText : enText);

const ERRORS: Record<string, [string, string]> = {
  invalid_credentials: ["E-Mail/Name oder Passwort falsch.", "Wrong email/name or password."],
  invalid_email: ["Ungültige E-Mail-Adresse.", "Invalid email address."],
  invalid_username: [
    "Benutzername: 3–20 Zeichen, nur Buchstaben, Zahlen und _.",
    "Username: 3–20 characters, letters, numbers and _ only.",
  ],
  weak_password: ["Passwort: mindestens 8 Zeichen.", "Password: at least 8 characters."],
  email_taken: ["Diese E-Mail ist bereits registriert.", "This email is already registered."],
  username_taken: ["Dieser Benutzername ist vergeben.", "This username is taken."],
  too_many_requests: ["Zu viele Versuche. Bitte später erneut.", "Too many attempts. Try again later."],
};

/** Real email/password sign-in and registration against the auth server. */
@customElement("auth-form")
export class AuthForm extends LitElement {
  @state() private mode: Mode = "login";
  @state() private identifier = "";
  @state() private email = "";
  @state() private username = "";
  @state() private password = "";
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
              ? { email: this.email, username: this.username, password: this.password }
              : { identifier: this.identifier, password: this.password },
          ),
        },
      );
      if (res.ok) {
        // Turn on the verified account username by default on sign-in / registration
        // so the player immediately plays under their registered account name.
        localStorage.setItem("useVerifiedName", "true");
        // The refresh cookie is set; a reload runs the normal startup auth.
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
          ? html`
              ${this.field(t("E-Mail", "Email"), "email", this.email, (v) => (this.email = v), "email")}
              ${this.field(t("Benutzername", "Username"), "text", this.username, (v) => (this.username = v), "username")}
            `
          : this.field(
              t("E-Mail oder Benutzername", "Email or username"),
              "text",
              this.identifier,
              (v) => (this.identifier = v),
              "username",
            )}
        ${this.field(
          t("Passwort", "Password"),
          "password",
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
