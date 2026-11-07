import { EventBus } from "@openfront/shared/EventBus";
import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import {
  SendAllianceRequestIntentEvent,
  SendBreakAllianceIntentEvent,
} from "../../Transport";
import { renderDuration } from "../../Utils";
import { GameView, PlayerView } from "../../view";
import { allianceIcon } from "../HotbarIcons";

function renderNumber(val: number): string {
  return Number(val).toLocaleString();
}

@customElement("alliance-modal")
export class AllianceModal extends LitElement implements Controller {
  public game: GameView | null = null;
  public eventBus: EventBus | null = null;

  @state() private _isOpen = false;
  @state() private _searchQuery = "";

  init(): void {}

  tick(): void {
    if (this._isOpen) {
      this.requestUpdate();
    }
  }

  static styles = css`
    :host {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 9999;
      pointer-events: none;
      font-family: inherit;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(4px);
      pointer-events: auto;
      opacity: 0;
      transition: opacity 0.2s ease-out;
    }
    .backdrop.open {
      opacity: 1;
    }
    .panel {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.96);
      width: 95%;
      max-width: 820px;
      max-height: 85vh;
      background: #11141c;
      border: 1px solid rgba(99, 102, 241, 0.35);
      box-shadow:
        0 25px 60px rgba(0, 0, 0, 0.8),
        0 0 35px rgba(99, 102, 241, 0.15);
      border-radius: 1rem;
      color: #f3f4f6;
      display: flex;
      flex-direction: column;
      pointer-events: auto;
      opacity: 0;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }
    .panel.open {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    .header {
      padding: 1.25rem 1.5rem;
      background: linear-gradient(90deg, #181d2a 0%, #131722 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-title-wrap {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .header-icon {
      width: 32px;
      height: 32px;
      border-radius: 0.5rem;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-icon img {
      width: 20px;
      height: 20px;
    }
    .header-title {
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: #fff;
    }
    .header-subtitle {
      font-size: 0.75rem;
      color: #94a3b8;
    }
    .btn-close {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #9ca3af;
      width: 32px;
      height: 32px;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1.1rem;
      transition: all 0.15s;
    }
    .btn-close:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.4);
      color: #ef4444;
    }
    .body {
      padding: 1.25rem 1.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .status-card {
      padding: 1rem 1.25rem;
      border-radius: 0.75rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      font-size: 0.85rem;
      line-height: 1.45;
    }
    .status-card.top10 {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #fca5a5;
    }
    .status-card.eligible {
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.35);
      color: #c7d2fe;
    }
    .status-badge {
      font-weight: 800;
      font-size: 0.75rem;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }
    .status-badge.top10 {
      background: rgba(239, 68, 68, 0.25);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }
    .status-badge.eligible {
      background: rgba(99, 102, 241, 0.25);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.4);
    }
    .section-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: #e2e8f0;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .allies-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 0.75rem;
    }
    .ally-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0.75rem;
      padding: 0.85rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .ally-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .ally-name {
      font-weight: 700;
      color: #f8fafc;
      font-size: 0.9rem;
    }
    .partner-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.85rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 0.5rem;
      transition: background 0.15s;
    }
    .partner-row:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .btn-action {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.35rem 0.75rem;
      border-radius: 0.375rem;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }
    .btn-invite {
      background: #4f46e5;
      color: #fff;
    }
    .btn-invite:hover:not(:disabled) {
      background: #4338ca;
    }
    .btn-invite:disabled {
      background: #334155;
      color: #64748b;
      cursor: not-allowed;
    }
    .btn-break {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #ef4444;
    }
    .btn-break:hover {
      background: rgba(239, 68, 68, 0.3);
    }
    .search-bar {
      width: 100%;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 0.5rem;
      padding: 0.5rem 0.75rem;
      color: #fff;
      font-size: 0.8rem;
      outline: none;
    }
    .search-bar:focus {
      border-color: #6366f1;
    }
  `;

  public open(): void {
    this._isOpen = true;
    this.requestUpdate();
  }

  public close(): void {
    this._isOpen = false;
    this.requestUpdate();
  }

  public toggle(): void {
    this._isOpen = !this._isOpen;
    this.requestUpdate();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && this._isOpen) {
      this.close();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.handleKeyDown);
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.handleKeyDown);
    super.disconnectedCallback();
  }

  private isPlayerInTop10(p: PlayerView, allSorted: PlayerView[]): boolean {
    const alive = allSorted.filter((x) => x.isAlive());
    const rank = alive.indexOf(p);
    const threshold =
      alive.length > 10 ? 10 : Math.max(1, Math.floor(alive.length * 0.4));
    return rank !== -1 && rank < threshold;
  }

  private getPlayerRank(p: PlayerView, allSorted: PlayerView[]): number {
    const alive = allSorted.filter((x) => x.isAlive());
    const rank = alive.indexOf(p);
    return rank === -1 ? 999 : rank + 1;
  }

  private sendAlliance(other: PlayerView) {
    const myPlayer = this.game?.myPlayer();
    if (!this.eventBus || !myPlayer) return;
    this.eventBus.emit(new SendAllianceRequestIntentEvent(myPlayer, other));
    this.requestUpdate();
  }

  private breakAlliance(other: PlayerView) {
    const myPlayer = this.game?.myPlayer();
    if (!this.eventBus || !myPlayer) return;
    this.eventBus.emit(new SendBreakAllianceIntentEvent(myPlayer, other));
    this.requestUpdate();
  }

  render() {
    if (!this.game) return html``;
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return html``;

    const allPlayers = [...this.game.playerViews()].filter((p) => p.isAlive());
    allPlayers.sort(
      (a, b) =>
        b.numTilesOwned() - a.numTilesOwned() ||
        Number(b.troops() - a.troops()),
    );

    const isMyTop10 = this.isPlayerInTop10(myPlayer, allPlayers);
    const myRank = this.getPlayerRank(myPlayer, allPlayers);
    const totalAlive = allPlayers.length;

    // Current alliances
    const myAlliances = myPlayer.alliances() || [];

    // Potential partners: alive, not me, not already allied, not in top 10
    const currentAllyIds = new Set(myAlliances.map((a: any) => a.other));
    const potentialPartners = allPlayers.filter((p) => {
      if (p === myPlayer) return false;
      if (currentAllyIds.has(p.id())) return false;
      if (this.isPlayerInTop10(p, allPlayers)) return false;
      if (
        this._searchQuery.trim().length > 0 &&
        !p.name().toLowerCase().includes(this._searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    return html`
      <div
        class="backdrop ${this._isOpen ? "open" : ""}"
        @click=${() => this.close()}
      ></div>
      <div class="panel ${this._isOpen ? "open" : ""}">
        <!-- Header -->
        <div class="header">
          <div class="header-title-wrap">
            <div class="header-icon">
              <img src=${allianceIcon} alt="Alliance" />
            </div>
            <div>
              <div class="header-title">Diplomatie & Koalitionen</div>
              <div class="header-subtitle">
                Anti-Großmacht-Bündnissystem für kleine Staaten
              </div>
            </div>
          </div>
          <button class="btn-close" @click=${() => this.close()}>✕</button>
        </div>

        <!-- Body -->
        <div class="body">
          <!-- Status Banner -->
          <div class="status-card ${isMyTop10 ? "top10" : "eligible"}">
            <span class="status-badge ${isMyTop10 ? "top10" : "eligible"}">
              ${isMyTop10 ? "Großmacht (Top 10)" : "Koalitionsfähig"}
            </span>
            <div>
              ${isMyTop10
                ? html`
                    <strong>Bündnissperre aktiv (Rang #${myRank}):</strong> Du
                    gehörst zu den Top 10 Großmächten der Welt! Um faire
                    Kräfteverhältnisse zu sichern, dürfen Supermächte keine
                    Allianzen eingehen. Kleinere Staaten können sich gegen dich
                    verbünden.
                  `
                : html`
                    <strong
                      >Bündnis berechtigt (Rang #${myRank} von
                      ${totalAlive}):</strong
                    >
                    Du kannst dich mit anderen kleineren Ländern verbünden, um
                    gemeinsam gegen die Top 10 Großmächte anzutreten.
                    <span class="text-indigo-300 font-semibold"
                      >Steigt ein Partner in die Top 10 auf, wird das Bündnis
                      automatisch aufgelöst.</span
                    >
                  `}
            </div>
          </div>

          <!-- Aktive Allianzen -->
          <div>
            <div class="section-title">
              <span>🤝</span>
              <span>Aktive Koalitionen (${myAlliances.length})</span>
            </div>
            ${myAlliances.length === 0
              ? html`
                  <div
                    class="text-xs text-gray-400 bg-black/20 p-3 rounded-lg border border-white/5 text-center"
                  >
                    Keine bestehenden Bündnisse. Schließe dich mit Verbündeten
                    zusammen!
                  </div>
                `
              : html`
                  <div class="allies-grid">
                    ${myAlliances.map((a: any) => {
                      const other = this.game?.player(a.other);
                      if (!other) return html``;
                      const remTicks = Math.max(
                        0,
                        a.expiresAt - this.game!.ticks(),
                      );
                      const remSec = Math.floor(remTicks / 10);
                      return html`
                        <div class="ally-card">
                          <div class="ally-header">
                            <span class="ally-name">${other.name()}</span>
                            <span class="text-[11px] font-bold text-indigo-400">
                              Rang #${this.getPlayerRank(other, allPlayers)}
                            </span>
                          </div>
                          <div
                            class="text-[11px] text-gray-400 flex justify-between"
                          >
                            <span
                              >Gebiet:
                              ${renderNumber(other.numTilesOwned())}</span
                            >
                            <span
                              >Truppen: ${renderNumber(other.troops())}</span
                            >
                          </div>
                          <div
                            class="text-[11px] font-semibold text-emerald-400"
                          >
                            Restdauer: ${renderDuration(remSec)}
                          </div>
                          <button
                            class="btn-action btn-break mt-1"
                            @click=${() => this.breakAlliance(other)}
                          >
                            Bündnis beenden
                          </button>
                        </div>
                      `;
                    })}
                  </div>
                `}
          </div>

          <!-- Potenzielle Partner -->
          <div>
            <div class="section-title flex justify-between items-center">
              <div class="flex items-center gap-2">
                <span>🌐</span>
                <span>Verfügbare Koalitionspartner</span>
              </div>
              <input
                type="text"
                class="search-bar !w-48 text-xs py-1"
                placeholder="Land suchen..."
                .value=${this._searchQuery}
                @input=${(e: any) => {
                  this._searchQuery = e.target.value;
                  this.requestUpdate();
                }}
              />
            </div>

            <div class="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
              ${potentialPartners.length === 0
                ? html`
                    <div
                      class="text-xs text-gray-400 bg-black/20 p-3 rounded-lg border border-white/5 text-center"
                    >
                      Keine verfügbaren Koalitionspartner gefunden.
                    </div>
                  `
                : potentialPartners.map((partner) => {
                    const rank = this.getPlayerRank(partner, allPlayers);
                    return html`
                      <div class="partner-row">
                        <div class="flex items-center gap-2.5">
                          <div class="text-xs font-bold text-indigo-300 w-12">
                            #${rank}
                          </div>
                          <div>
                            <div class="text-xs font-bold text-white">
                              ${partner.name()}
                            </div>
                            <div class="text-[11px] text-gray-400">
                              ${renderNumber(partner.numTilesOwned())} Land ·
                              ${renderNumber(partner.troops())} Truppen
                            </div>
                          </div>
                        </div>

                        <button
                          class="btn-action btn-invite"
                          ?disabled=${isMyTop10}
                          @click=${() => this.sendAlliance(partner)}
                        >
                          ${isMyTop10
                            ? "Gesperrt (Top 10)"
                            : "Allianz vorschlagen"}
                        </button>
                      </div>
                    `;
                  })}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
