import { ResourceType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { renderNumber } from "@openfront/engine-lib/Format";
import { calculateBuildingCost } from "@openfront/engine-lib/game/EconomyConfig";
import { EventBus } from "@openfront/shared/EventBus";
import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { ToggleGeologicalScoutingEvent } from "../../InputHandler";
import { GeologicalDataService } from "../../render/gl/utils/GeologicalDataService";
import { BuildUnitIntentEvent } from "../../Transport";
import { GameView } from "../../view";
import {
  bunkerIcon,
  centrifugeIcon,
  coalMineIcon,
  factoryIcon,
  goldCoinIcon,
  ironMineIcon,
  oilRigIcon,
  radarIcon,
  refineryIcon,
  residentialIcon,
  steelMillIcon,
  uraniumMineIcon,
} from "../HotbarIcons";

export interface MineBuildingInfo {
  type: UnitType;
  title: string;
  category: "extraction" | "refinement" | "civil" | "defense";
  icon: string;
  description: string;
  yieldInfo: string;
  baseCost: number;
  refinedCost?: { steel?: number; fuel?: number; enrichedUranium?: number };
}

export const MINE_BUILDINGS: MineBuildingInfo[] = [
  // Tier 1 Raw Extraction
  {
    type: UnitType.IronMine,
    title: "Eisenmine (Iron Mine)",
    category: "extraction",
    icon: ironMineIcon,
    description: "Fördert Eisenerz auf geologischen Fe-Clustern.",
    yieldInfo: "+6 Fe / Sekunde (Basis)",
    baseCost: 200,
  },
  {
    type: UnitType.CoalMine,
    title: "Kohlemine (Coal Mine)",
    category: "extraction",
    icon: coalMineIcon,
    description: "Fördert Kohle auf geologischen C-Clustern.",
    yieldInfo: "+5 Kohle / Sekunde (Basis)",
    baseCost: 150,
  },
  {
    type: UnitType.OilRig,
    title: "Ölturm / Bohrinsel (Oil Rig)",
    category: "extraction",
    icon: oilRigIcon,
    description: "Fördert Rohöl auf Land- oder Offshore-Vorkommen.",
    yieldInfo: "+4 Rohöl / Sekunde (Basis)",
    baseCost: 350,
  },
  {
    type: UnitType.UraniumMine,
    title: "Uranmine (Uranium Mine)",
    category: "extraction",
    icon: uraniumMineIcon,
    description: "Fördert seltenes Uranerz auf Hochenergie-Vorkommen.",
    yieldInfo: "+1.5 Uran / Sekunde (Basis)",
    baseCost: 800,
  },
  // Tier 2 Refinement
  {
    type: UnitType.SteelMill,
    title: "Stahl-Schmelzwerk (Steel Mill)",
    category: "refinement",
    icon: steelMillIcon,
    description: "Schmilzt Eisenerz und Kohle zu Panzer- und Rumpfstahl.",
    yieldInfo: "Rezept: 2 Fe + 1 Kohle ➔ 1 Stahl",
    baseCost: 400,
  },
  {
    type: UnitType.Refinery,
    title: "Treibstoff-Raffinerie (Refinery)",
    category: "refinement",
    icon: refineryIcon,
    description:
      "Destilliert Rohöl zu Treibstoff für Panzer, Schiffe & Flotte.",
    yieldInfo: "Rezept: 2 Rohöl ➔ 1 Treibstoff (Fuel)",
    baseCost: 500,
  },
  {
    type: UnitType.Centrifuge,
    title: "Uran-Zentrifuge (Centrifuge)",
    category: "refinement",
    icon: centrifugeIcon,
    description: "Reichert Uranerz für nukleare Waffen & Hochtechnologie an.",
    yieldInfo: "Rezept: 4 Uran + 2 Kohle ➔ 1 Spaltmaterial (U_ref)",
    baseCost: 1200,
  },
  // Civilian & Defense
  {
    type: UnitType.Residential,
    title: "Wohnviertel (Residential)",
    category: "civil",
    icon: residentialIcon,
    description: "Erhöht das demografische Bevölkerungslimit der Nation.",
    yieldInfo: "+500 Bevölkerungskapazität (Kp)",
    baseCost: 100,
  },
  {
    type: UnitType.Bunker,
    title: "Stahlbunker (Bunker)",
    category: "defense",
    icon: bunkerIcon,
    description: "Schwer befestigte Verteidigungsposition.",
    yieldInfo: "Verteidigungsbonus 1.8x (Lanchester)",
    baseCost: 150,
    refinedCost: { steel: 10 },
  },
  {
    type: UnitType.Radar,
    title: "Radarstation (Early Warning)",
    category: "defense",
    icon: radarIcon,
    description:
      "Frühwarnung (R=30), Sonar gegen U-Boote, +50% SAM-Reichweite.",
    yieldInfo: "Sensor-Netzwerk & SAM-Kopplung (12➔18)",
    baseCost: 800,
    refinedCost: { steel: 40, enrichedUranium: 5 },
  },
];

@customElement("mining-economy-panel")
export class MiningEconomyPanel extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state()
  private _isOpen: boolean = false;

  @state()
  private _activeTab: "all" | "extraction" | "refinement" | "defense" = "all";

  @state()
  private _activeScouting: ResourceType | "none" = "none";

  static styles = css`
    :host {
      display: block;
      font-family: inherit;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: fadeIn 0.15s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .panel-container {
      background: #141c15;
      border: 1px solid rgba(114, 165, 93, 0.25);
      border-radius: 1rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 20px rgba(93, 150, 81, 0.15);
      width: 100%;
      max-width: 900px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: #fff;
    }
    .header-strip {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #172118;
    }
    .tabs-bar {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: #121813;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .tab-btn {
      padding: 0.4rem 0.9rem;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 0.5rem;
      border: 1px solid transparent;
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .tab-btn.active {
      background: #46783d;
      color: #fff;
      border-color: #5d9651;
    }
    .cards-grid {
      padding: 1.25rem 1.5rem;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
    }
    .building-card {
      background: #19221a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0.75rem;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s;
      position: relative;
    }
    .building-card:hover {
      border-color: rgba(114, 165, 93, 0.35);
      transform: translateY(-2px);
    }
      position: relative;
    }
    .building-card:hover {
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
    }
    .card-top {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .card-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 0.5rem;
      background: rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .card-icon-box img {
      width: 28px;
      height: 28px;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
    }
    .building-name {
      font-size: 0.95rem;
      font-weight: 700;
      color: #f3f4f6;
      line-height: 1.2;
    }
    .building-desc {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-bottom: 0.5rem;
      line-height: 1.4;
    }
    .yield-badge {
      font-size: 0.72rem;
      font-weight: 600;
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      border: 1px solid rgba(34, 197, 94, 0.3);
      margin-bottom: 0.75rem;
      display: inline-block;
    }
    .cost-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.8rem;
      font-weight: 700;
      padding-top: 0.6rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      margin-top: auto;
    }
    .cost-badge {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: #fbbf24;
    }
    .btn-build {
      background: #2563eb;
      color: #fff;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.35rem 0.75rem;
      border-radius: 0.375rem;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-build:hover:not(:disabled) {
      background: #1d4ed8;
    }
    .btn-build:disabled {
      background: #374151;
      color: #9ca3af;
      cursor: not-allowed;
    }
    .count-chip {
      position: absolute;
      top: 0.6rem;
      right: 0.6rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      font-size: 0.68rem;
      font-weight: 700;
      padding: 0.1rem 0.45rem;
      border-radius: 9999px;
      color: #e5e7eb;
    }
    .scouting-footer {
      padding: 1rem 1.5rem;
      background: #151822;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .scouting-btns {
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }
    .scout-btn {
      padding: 0.3rem 0.6rem;
      border-radius: 0.375rem;
      font-size: 0.72rem;
      font-weight: 700;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: #1e261f;
      color: #d1d5db;
      cursor: pointer;
      transition: all 0.15s;
    }
    .scout-btn:hover {
      background: #28362a;
      color: #fff;
    }
    .scout-btn.active {
      border-color: #5d9651;
      background: #46783d;
      color: #fff;
    }
    .info-footer-text {
      font-size: 0.7rem;
      color: #9ca3af;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
  `;

  init(): void {}

  tick(): void {
    if (this._isOpen) {
      this.requestUpdate();
    }
  }

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

  private toggleScouting(mode: ResourceType | "none"): void {
    this._activeScouting = mode;
    const densityData =
      mode !== "none"
        ? GeologicalDataService.getDensityData(this.game, mode)
        : undefined;
    this.eventBus?.emit(new ToggleGeologicalScoutingEvent(mode, densityData));
    this.requestUpdate();
  }

  private getBuildingCount(type: UnitType): number {
    const player = this.game?.myPlayer();
    if (!player) return 0;
    return player.totalUnitLevels(type);
  }

  private getPlayerGold(): bigint {
    const player = this.game?.myPlayer();
    if (!player) return 0n;
    return player.gold();
  }

  private async buildStructure(type: UnitType): Promise<void> {
    const player = this.game?.myPlayer();
    if (!player || !player.isAlive()) return;

    try {
      const borders = await player.borderTiles();
      if (borders && borders.borderTiles && borders.borderTiles.size > 0) {
        const targetTile = borders.borderTiles.values().next().value;
        if (targetTile !== undefined) {
          this.eventBus?.emit(new BuildUnitIntentEvent(type, targetTile));
        }
      }
    } catch {
      // ignore
    }
    this.requestUpdate();
  }

  render() {
    if (!this._isOpen) return html``;

    const playerGold = this.getPlayerGold();
    const filteredBuildings = MINE_BUILDINGS.filter(
      (b) => this._activeTab === "all" || b.category === this._activeTab,
    );

    return html`
      <div
        class="modal-backdrop"
        @click=${(e: MouseEvent) => {
          if (e.target === e.currentTarget) this.close();
        }}
      >
        <div
          class="panel-container"
          @click=${(e: MouseEvent) => e.stopPropagation()}
        >
          <!-- Header -->
          <div class="header-strip">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <img
                src=${factoryIcon}
                width="28"
                height="28"
                style="object-fit: contain;"
              />
              <div>
                <h2
                  style="font-size: 1.15rem; font-weight: 800; margin: 0; color: #fff; letter-spacing: -0.01em;"
                >
                  INDUSTRIE & BERGBAU-VERWALTUNG
                </h2>
                <div
                  style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.15rem;"
                >
                  Rohstoff-Extraktion, Veredelungswerke & Geologische Heatmap
                </div>
              </div>
            </div>
            <button
              style="background: transparent; border: none; color: #9ca3af; font-size: 1.5rem; cursor: pointer; padding: 0.2rem 0.5rem; border-radius: 0.375rem;"
              @click=${this.close}
              title="Schließen (Esc)"
            >
              ✕
            </button>
          </div>

          <!-- Filter Tabs -->
          <div class="tabs-bar">
            <button
              class="tab-btn ${this._activeTab === "all" ? "active" : ""}"
              @click=${() => {
                this._activeTab = "all";
              }}
            >
              Alle Bauten
            </button>
            <button
              class="tab-btn ${this._activeTab === "extraction"
                ? "active"
                : ""}"
              @click=${() => {
                this._activeTab = "extraction";
              }}
            >
              Minen (Tier 1)
            </button>
            <button
              class="tab-btn ${this._activeTab === "refinement"
                ? "active"
                : ""}"
              @click=${() => {
                this._activeTab = "refinement";
              }}
            >
              Veredelung (Tier 2)
            </button>
            <button
              class="tab-btn ${this._activeTab === "defense" ? "active" : ""}"
              @click=${() => {
                this._activeTab = "defense";
              }}
            >
              Verteidigung & Radar
            </button>
          </div>

          <!-- Cards Grid -->
          <div class="cards-grid">
            ${filteredBuildings.map((building) => {
              const count = this.getBuildingCount(building.type);
              const costObj = calculateBuildingCost(building.type, count);
              const canAfford = playerGold >= BigInt(costObj.gold);

              return html`
                <div class="building-card">
                  <div class="count-chip" title="Aktive Anzahl">
                    ${count}x Aktiv
                  </div>
                  <div>
                    <div class="card-top">
                      <div class="card-icon-box">
                        <img src=${building.icon} alt=${building.title} />
                      </div>
                      <div>
                        <div class="building-name">${building.title}</div>
                      </div>
                    </div>
                    <div class="building-desc">${building.description}</div>
                    <div class="yield-badge">${building.yieldInfo}</div>
                  </div>

                  <div class="cost-row">
                    <div class="cost-badge" title="Baukosten (Gold)">
                      <img
                        src=${goldCoinIcon}
                        width="14"
                        height="14"
                        alt="Gold"
                      />
                      <span>${renderNumber(costObj.gold)}</span>
                      ${costObj.steel > 0
                        ? html`<span
                            style="color: #60a5fa; font-size: 0.7rem; margin-left: 0.25rem;"
                            >+${costObj.steel} Stahl</span
                          >`
                        : ""}
                      ${costObj.fuel > 0
                        ? html`<span
                            style="color: #a855f7; font-size: 0.7rem; margin-left: 0.25rem;"
                            >+${costObj.fuel} Fuel</span
                          >`
                        : ""}
                      ${costObj.enrichedUranium > 0
                        ? html`<span
                            style="color: #34d399; font-size: 0.7rem; margin-left: 0.25rem;"
                            >+${costObj.enrichedUranium} Spalt</span
                          >`
                        : ""}
                    </div>
                    <button
                      class="btn-build"
                      ?disabled=${!canAfford}
                      @click=${() => this.buildStructure(building.type)}
                      title=${canAfford ? "Bauen" : "Nicht genug Gold"}
                    >
                      Bauen
                    </button>
                  </div>
                </div>
              `;
            })}
          </div>

          <!-- Geological Scouting Footer -->
          <div class="scouting-footer">
            <div class="scouting-btns">
              <span
                style="font-size: 0.72rem; font-weight: 700; color: #9ca3af; text-transform: uppercase;"
              >
                Geologisches Scouting:
              </span>
              <button
                class="scout-btn ${this._activeScouting === "none"
                  ? "active"
                  : ""}"
                @click=${() => this.toggleScouting("none")}
              >
                Normal
              </button>
              <button
                class="scout-btn ${this._activeScouting === "ironOre"
                  ? "active"
                  : ""}"
                style="${this._activeScouting === "ironOre"
                  ? "background: #d97706; border-color: #f59e0b;"
                  : ""}"
                @click=${() => this.toggleScouting("ironOre")}
              >
                Fe (Eisen)
              </button>
              <button
                class="scout-btn ${this._activeScouting === "coal"
                  ? "active"
                  : ""}"
                style="${this._activeScouting === "coal"
                  ? "background: #4b5563; border-color: #6b7280;"
                  : ""}"
                @click=${() => this.toggleScouting("coal")}
              >
                C (Kohle)
              </button>
              <button
                class="scout-btn ${this._activeScouting === "crudeOil"
                  ? "active"
                  : ""}"
                style="${this._activeScouting === "crudeOil"
                  ? "background: #7e22ce; border-color: #a855f7;"
                  : ""}"
                @click=${() => this.toggleScouting("crudeOil")}
              >
                Oil (Rohöl)
              </button>
              <button
                class="scout-btn ${this._activeScouting === "uraniumOre"
                  ? "active"
                  : ""}"
                style="${this._activeScouting === "uraniumOre"
                  ? "background: #059669; border-color: #10b981;"
                  : ""}"
                @click=${() => this.toggleScouting("uraniumOre")}
              >
                U (Uran)
              </button>
            </div>

            <div class="info-footer-text">
              <span>ℹ️</span>
              <span
                >Dynamische Erschöpfung: Cluster fördern unendlich mit
                15%-Basis-Tiefenförderung fort.</span
              >
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
