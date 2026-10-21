import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  COLOR_KEY,
  UserSettings,
  USER_SETTINGS_CHANGED_EVENT,
} from "../UserSettings";

export const PRESET_COLORS = [
  { hex: "#3b7a57", name: "Waldgrün / Moos" },
  { hex: "#10b981", name: "Smaragdgrün" },
  { hex: "#1d4ed8", name: "Marineblau" },
  { hex: "#06b6d4", name: "Cyan / Türkis" },
  { hex: "#dc2626", name: "Karminrot" },
  { hex: "#d97706", name: "Bernstein / Gold" },
  { hex: "#7c3aed", name: "Königsviolett" },
  { hex: "#475569", name: "Schiefergrau" },
] as const;

@customElement("color-palette-picker")
export class ColorPalettePicker extends LitElement {
  @state() private selectedColor: string | null = null;
  private userSettings = new UserSettings();
  private abort: AbortController | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.abort = new AbortController();
    this.selectedColor = this.userSettings.getPlayerColor();

    window.addEventListener(
      `${USER_SETTINGS_CHANGED_EVENT}:${COLOR_KEY}`,
      (e: any) => {
        this.selectedColor = e.detail ?? this.userSettings.getPlayerColor();
      },
      { signal: this.abort.signal },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.abort?.abort();
    this.abort = null;
  }

  private pickColor(hex: string | null) {
    this.selectedColor = hex;
    this.userSettings.setPlayerColor(hex);
  }

  private onCustomColorChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.value) {
      this.pickColor(input.value);
    }
  }

  render() {
    const isCustom =
      this.selectedColor !== null &&
      !PRESET_COLORS.some(
        (p) => p.hex.toLowerCase() === this.selectedColor?.toLowerCase(),
      );

    return html`
      <div
        class="flex flex-col gap-1.5 p-2 bg-surface/90 border border-white/10 rounded-xl shadow-inner text-xs"
      >
        <div
          class="flex items-center justify-between text-gray-300 font-medium px-0.5"
        >
          <span class="flex items-center gap-1.5">
            <svg
              class="w-3.5 h-3.5 text-emerald-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.22 19.58 10.57 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"
              />
            </svg>
            <span class="font-semibold text-gray-200"
              >Startfarbe der Nation:</span
            >
          </span>
          <button
            class="text-[10px] text-gray-400 hover:text-white transition-colors underline cursor-pointer"
            @click=${() => this.pickColor(null)}
            title="Auf Standard-Themenfarbe zurücksetzen"
          >
            Standard
          </button>
        </div>

        <div class="flex items-center gap-2 flex-wrap pt-0.5">
          ${PRESET_COLORS.map((preset) => {
            const active =
              this.selectedColor?.toLowerCase() === preset.hex.toLowerCase();
            return html`
              <button
                type="button"
                class="w-6 h-6 rounded-full transition-transform hover:scale-110 cursor-pointer relative shadow-md flex items-center justify-center border ${active
                  ? "ring-2 ring-white ring-offset-1 ring-offset-surface scale-110 border-white"
                  : "border-black/30 hover:border-white/50"}"
                style="background-color: ${preset.hex}"
                title="${preset.name}"
                @click=${() => this.pickColor(preset.hex)}
              >
                ${active
                  ? html`<svg
                      class="w-3.5 h-3.5 text-white drop-shadow"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>`
                  : null}
              </button>
            `;
          })}

          <!-- Custom Color Picker -->
          <label
            class="w-6 h-6 rounded-full transition-transform hover:scale-110 cursor-pointer relative shadow-md flex items-center justify-center border border-white/20 bg-gradient-to-br from-pink-500 via-emerald-400 to-cyan-500 overflow-hidden ${isCustom
              ? "ring-2 ring-white ring-offset-1 ring-offset-surface scale-110"
              : ""}"
            title="Eigene Farbe wählen"
          >
            <input
              type="color"
              class="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
              .value=${this.selectedColor ?? "#3b7a57"}
              @input=${this.onCustomColorChange}
            />
            <svg
              class="w-3.5 h-3.5 text-white drop-shadow pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
          </label>
        </div>
      </div>
    `;
  }
}
