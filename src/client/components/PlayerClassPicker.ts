import { PlayerClass } from "@openfront/engine-api/game/GameTypes";
import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { translateText } from "../Utils";
import { UserSettings } from "../UserSettings";
import {
  getAllPlayerClasses,
  getPlayerClassMeta,
  PlayerClassMeta,
} from "../utils/PlayerClassData";

@customElement("player-class-picker")
export class PlayerClassPicker extends LitElement {
  @property({ type: Boolean }) compact = false;
  @property({ type: Boolean }) showPerks = true;
  @state() private selectedClass: PlayerClass = PlayerClass.Industrialist;
  @state() private isExpanded = false;

  private userSettings = new UserSettings();
  private abortController: AbortController | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.abortController = new AbortController();
    this.selectedClass = this.userSettings.getPlayerClass();

    const handleClassChanged = (e: Event) => {
      const customEvent = e as CustomEvent<PlayerClass>;
      if (customEvent.detail) {
        this.selectedClass = customEvent.detail;
      } else {
        this.selectedClass = this.userSettings.getPlayerClass();
      }
    };

    document.addEventListener("player-class-changed", handleClassChanged, {
      signal: this.abortController.signal,
    });
    window.addEventListener("player-class-changed", handleClassChanged, {
      signal: this.abortController.signal,
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.abortController?.abort();
    this.abortController = null;
  }

  private pickClass(cls: PlayerClass) {
    this.selectedClass = cls;
    this.userSettings.setPlayerClass(cls);
  }

  private toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  render() {
    const classes = getAllPlayerClasses();
    const currentMeta = getPlayerClassMeta(this.selectedClass);

    return html`
      <div
        class="flex flex-col gap-2 p-3 bg-surface/90 border border-white/10 rounded-xl shadow-inner text-xs"
      >
        <!-- Header with current class preview and expand toggle -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <div class="p-1 rounded-md bg-white/5 text-amber-400 shrink-0">
              ${currentMeta.icon("w-4 h-4")}
            </div>
            <div class="min-w-0">
              <div class="font-bold text-gray-200 truncate flex items-center gap-2">
                <span>${translateText("player_classes.title")}</span>
                <span
                  class="px-2 py-0.5 rounded text-[11px] font-semibold border ${currentMeta.badgeClasses}"
                >
                  ${currentMeta.name}
                </span>
              </div>
              <div class="text-[10px] text-white/50 truncate">
                ${currentMeta.role}
              </div>
            </div>
          </div>

          <button
            type="button"
            @click=${this.toggleExpanded}
            class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1.5"
          >
            <span>${this.isExpanded ? "Schließen" : "Ändern"}</span>
            <svg
              class="w-3 h-3 transition-transform ${this.isExpanded ? "rotate-180" : ""}"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <!-- Class Selector Grid (Always visible if not compact, or when expanded) -->
        ${!this.compact || this.isExpanded
          ? html`
              <div
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-white/10"
              >
                ${classes.map((cls) => this.renderClassOption(cls))}
              </div>
            `
          : html`
              <!-- Full perks preview of selected class -->
              <div class="flex flex-col gap-1 pt-1.5 border-t border-white/10 text-[11px]">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div class="flex flex-col gap-0.5">
                    ${currentMeta.buffs.map(
                      (buff) => html`
                        <div class="flex items-start gap-1.5 text-emerald-400 leading-snug">
                          <span class="font-bold shrink-0">+</span>
                          <span>${buff}</span>
                        </div>
                      `,
                    )}
                  </div>
                  <div class="flex flex-col gap-0.5">
                    ${currentMeta.debuffs.map(
                      (debuff) => html`
                        <div class="flex items-start gap-1.5 text-red-400 leading-snug">
                          <span class="font-bold shrink-0">-</span>
                          <span>${debuff}</span>
                        </div>
                      `,
                    )}
                  </div>
                </div>
              </div>
            `}
      </div>
    `;
  }

  private renderClassOption(cls: PlayerClassMeta) {
    const isSelected = this.selectedClass === cls.id;

    return html`
      <div
        @click=${() => this.pickClass(cls.id)}
        class="relative flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all duration-200 select-none ${
          isSelected
            ? "bg-amber-500/15 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/50"
            : "bg-black/30 border-white/10 hover:border-white/30 hover:bg-white/5"
        }"
      >
        <div class="flex items-center justify-between gap-1.5 mb-1.5">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="p-1 rounded-md shrink-0 ${
                isSelected ? "bg-amber-400/20 text-amber-300" : "bg-white/5 text-white/60"
              }"
            >
              ${cls.icon("w-3.5 h-3.5")}
            </div>
            <div class="min-w-0">
              <div class="text-xs font-bold text-white truncate">
                ${cls.name}
              </div>
              <div class="text-[9px] text-white/50 truncate">
                ${cls.role}
              </div>
            </div>
          </div>
          ${isSelected
            ? html`<span
                class="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-amber-400 text-black tracking-wider shrink-0"
              >
                ${translateText("player_classes.selected")}
              </span>`
            : null}
        </div>

        ${this.showPerks
          ? html`
              <div class="flex flex-col gap-1 mt-1.5 pt-1.5 border-t border-white/10 text-[10px]">
                <div class="flex flex-col gap-0.5">
                  ${cls.buffs.map(
                    (buff) => html`
                      <div class="flex items-start gap-1 text-emerald-400 leading-snug">
                        <span class="font-bold shrink-0">+</span>
                        <span>${buff}</span>
                      </div>
                    `,
                  )}
                </div>
                <div class="flex flex-col gap-0.5 mt-0.5 pt-0.5 border-t border-white/5">
                  ${cls.debuffs.map(
                    (debuff) => html`
                      <div class="flex items-start gap-1 text-red-400 leading-snug">
                        <span class="font-bold shrink-0">-</span>
                        <span>${debuff}</span>
                      </div>
                    `,
                  )}
                </div>
              </div>
            `
          : null}
      </div>
    `;
  }
}
