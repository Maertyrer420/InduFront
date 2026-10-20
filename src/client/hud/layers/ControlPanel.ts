import { TileRef } from "@openfront/engine-api/game/GameMap";
import { GameMode, GameType, Gold, ResourceType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { ClientID } from "@openfront/engine-api/Schemas";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { renderNumber, renderTroops } from "@openfront/engine-lib/Format";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { EventBus } from "@openfront/shared/EventBus";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { Controller } from "../../Controller";
import { AttackRatioEvent, ToggleGeologicalScoutingEvent } from "../../InputHandler";
import { GeologicalDataService } from "../../render/gl/utils/GeologicalDataService";
import { UIState } from "../../UIState";
import { USER_SETTINGS_CHANGED_EVENT, UserSettings } from "../../UserSettings";
import { getGamesPlayed, translateText } from "../../Utils";
import { GameView } from "../../view";
import { PlayerView } from "../../view/PlayerView";
import {
  coalMineIcon,
  factoryIcon,
  goldCoinIcon,
  highlightIcon,
  ironMineIcon,
  oilRigIcon,
  populationIcon,
  refineryIcon,
  soldierIcon,
  steelMillIcon,
  uraniumMineIcon,
  centrifugeIcon,
} from "../HotbarIcons";
import { TutorialHighlight, TutorialHighlightEvent } from "../Tutorial";
const swordIcon = assetUrl("images/SwordIcon.svg");

@customElement("control-panel")
export class ControlPanel extends LitElement implements Controller {
  public game: GameView;
  public clientID: ClientID;
  public eventBus: EventBus;
  public uiState: UIState;

  @state()
  private attackRatio: number = 0.2;

  @state()
  private _maxTroops: number;

  @state()
  private troopRate: number;

  @state()
  private _troops: number;

  @state()
  private _isVisible = false;

  @state()
  private _notification: { type: "warning" | "info"; message: string } | null =
    null;

  @state()
  private _gold: Gold;

  @state()
  private _attackingTroops: number = 0;

  @state()
  private _goldGain: bigint | null = null;
  @state()
  private _goldGainPulseId: number = 0;
  private _goldGainTimeoutId: ReturnType<typeof setTimeout> | null = null;

  @state()
  private _tutorialHighlight: TutorialHighlight | null = null;

  @state()
  private _population: number = 1000;
  @state()
  private _maxPop: number = 2000;
  @state()
  private _iron: number = 0;
  @state()
  private _coal: number = 0;
  @state()
  private _oil: number = 0;
  @state()
  private _uranium: number = 0;
  @state()
  private _steel: number = 0;
  @state()
  private _fuel: number = 50;
  @state()
  private _enrichedUranium: number = 0;
  @state()
  private _activeScouting: ResourceType | "all" | "none" = "none";

  private _troopRateIsIncreasing: boolean = true;

  private _lastTroopIncreaseRate: number;

  // Border detection cache
  private _nearbyPlayerIDs: Set<number> = new Set();
  private _borderRefreshCounter: number = 0;
  private _borderTilesPromise: Promise<void> | null = null;
  // Track last attack tick per target player (for 15-second threshold)
  private _lastAttackTickByTarget: Map<number, number> = new Map();
  private static readonly BORDER_REFRESH_INTERVAL = 10; // recompute every 1s
  private static readonly ATTACK_THRESHOLD_TICKS = 15 * 10; // 15 seconds

  connectedCallback() {
    super.connectedCallback();
    // The attack ratio is cached below for the lifetime of the game, but the
    // settings modal is now reachable mid-match, so follow the stored value
    // when it changes there. (This panel's own slider is session-only: it
    // never writes UserSettings, so there is no loop.)
    globalThis.addEventListener(
      `${USER_SETTINGS_CHANGED_EVENT}:settings.attackRatio`,
      this.onAttackRatioSettingChanged,
    );
    window.addEventListener("keydown", this.onKeyDown);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    if (e.code === "KeyH") {
      this.toggleScouting(this._activeScouting === "none" ? "all" : "none");
    }
  };

  init() {
    this.attackRatio = new UserSettings().attackRatio();
    this.uiState.attackRatio = this.attackRatio;
    this.eventBus.on(TutorialHighlightEvent, (e) => {
      this._tutorialHighlight = e.target;
    });
    this.eventBus.on(AttackRatioEvent, (event) => {
      let newAttackRatio = this.attackRatio + event.attackRatio / 100;

      if (newAttackRatio < 0.01) {
        newAttackRatio = 0.01;
      }

      if (newAttackRatio > 1) {
        newAttackRatio = 1;
      }

      if (newAttackRatio === 0.11 && this.attackRatio === 0.01) {
        // If we're changing the ratio from 1%, then set it to 10% instead of 11% to keep a consistency
        newAttackRatio = 0.1;
      }

      this.attackRatio = newAttackRatio;
      this.onAttackRatioChange(this.attackRatio);
    });
  }

  tick() {
    if (!this._isVisible && !this.game.inSpawnPhase()) {
      this.setVisibile(true);
    }

    const player = this.game.myPlayer();
    if (player === null || !player.isAlive()) {
      this.setVisibile(false);
      return;
    }

    this.updateTroopIncrease();

    const eco = (player as any)?.economy?.() ?? (player.state as any)?.economy;
    if (eco) {
      this._population = Math.round(eco.population ?? this._population);
      this._maxPop = Math.round(eco.maxPopulation ?? this._maxPop);
      this._iron = Math.round(eco.resources?.ironOre ?? eco.iron ?? this._iron);
      this._coal = Math.round(eco.resources?.coal ?? eco.coal ?? this._coal);
      this._oil = Math.round(eco.resources?.crudeOil ?? eco.oil ?? this._oil);
      this._uranium = Math.round(eco.resources?.uraniumOre ?? eco.uranium ?? this._uranium);
      this._steel = Math.round(eco.refined?.steel ?? eco.steel ?? this._steel);
      this._fuel = Math.round(eco.refined?.fuel ?? eco.fuel ?? this._fuel);
      this._enrichedUranium = Math.round(eco.refined?.enrichedUranium ?? eco.enrichedUranium ?? this._enrichedUranium);
    }

    const config = this.game.config();
    this._maxTroops = config.maxTroops(player);
    this._gold = player.gold();
    this._troops = player.troops();
    this._attackingTroops = player
      .outgoingAttacks()
      .map((a) => a.troops)
      .reduce((a, b) => a + b, 0);
    this.troopRate = config.troopIncreaseRate(player) * 10;

    const helpEnabled = new UserSettings().helpMessages();

    // Don't target veteran players
    if (helpEnabled && getGamesPlayed() < 20) {
      // Track outgoing attacks for 15-second threshold
      this.trackOutgoingAttacks(player);

      // Refresh border detection cache periodically
      this.refreshNearbyPlayers(player);

      // Compute notification
      this._notification = this.computeNotification(player, config);
    }

    const updates = this.game.updatesSinceLastTick();
    if (updates) {
      const myID = player.id();
      const bonusEvents = updates[GameUpdateType.BonusEvent];
      if (bonusEvents) {
        for (const ev of bonusEvents) {
          if (ev.player === myID && ev.gold > 0) {
            this.addGoldGain(BigInt(ev.gold));
          }
        }
      }
      const conquestEvents = updates[GameUpdateType.ConquestEvent];
      if (conquestEvents) {
        for (const ev of conquestEvents) {
          if (ev.conquerorId === myID && ev.gold > 0n) {
            this.addGoldGain(ev.gold);
          }
        }
      }
      const donateEvents = updates[GameUpdateType.DonateEvent];
      if (donateEvents) {
        for (const ev of donateEvents) {
          if (
            ev.donationType === "gold" &&
            ev.recipientId === myID &&
            ev.amount > 0n
          ) {
            this.addGoldGain(ev.amount);
          }
        }
      }
    }

    this.requestUpdate();
  }

  // Last-wins: when multiple gold events arrive in one tick, the pip shows
  // only the most recent amount (not a sum) — each gain restarts the pulse.
  private addGoldGain(amount: bigint) {
    this._goldGain = amount;
    this._goldGainPulseId++;
    if (this._goldGainTimeoutId !== null) {
      clearTimeout(this._goldGainTimeoutId);
    }
    this._goldGainTimeoutId = setTimeout(() => {
      this._goldGain = null;
      this._goldGainTimeoutId = null;
      this.requestUpdate();
    }, 2000);
  }

  private trackOutgoingAttacks(player: PlayerView) {
    const currentTick = this.game.ticks();
    for (const attack of player.outgoingAttacks()) {
      if (attack.targetID !== 0 && !attack.retreating) {
        this._lastAttackTickByTarget.set(attack.targetID, currentTick);
      }
    }
    // Clean up old entries
    for (const [playerID, tick] of this._lastAttackTickByTarget.entries()) {
      if (currentTick - tick > ControlPanel.ATTACK_THRESHOLD_TICKS * 2) {
        this._lastAttackTickByTarget.delete(playerID);
      }
    }
  }

  private refreshNearbyPlayers(player: PlayerView) {
    this._borderRefreshCounter++;
    if (
      this._borderRefreshCounter < ControlPanel.BORDER_REFRESH_INTERVAL ||
      this._borderTilesPromise !== null
    ) {
      return;
    }
    this._borderRefreshCounter = 0;
    this._borderTilesPromise = player.borderTiles().then((bt) => {
      this._borderTilesPromise = null;
      const myID = player.smallID();
      const nearby = new Set<number>();
      for (const tile of bt.borderTiles) {
        for (const neighbor of this.game.neighbors(tile as TileRef)) {
          const ownerID = this.game.ownerID(neighbor);
          if (ownerID !== 0 && ownerID !== myID) {
            nearby.add(ownerID);
          }
        }
      }
      this._nearbyPlayerIDs = nearby;
    });
  }

  private computeNotification(
    player: PlayerView,
    config: Config,
  ): { type: "warning" | "info"; message: string } | null {
    const currentTick = this.game.ticks();

    // Army limit warning
    const { gameMode, gameType } = config.gameConfig();
    const isPublicTeamGame =
      gameMode === GameMode.Team && gameType === GameType.Public;
    const canDonateTroops = config.donateTroops();
    if (isPublicTeamGame && canDonateTroops) {
      const ratio = this._troops / Math.max(this._maxTroops, 1);
      if (ratio >= config.armyLimitWarningThreshold()) {
        return {
          type: "warning",
          message: "control_panel.army_limit_warning",
        };
      }
    }

    // Low troops (Less than 1k) warning
    if (this._troops < 10000 && this._troops > 0) {
      return { type: "warning", message: "control_panel.low_troops_warning" };
    }

    // Info messages: check nearby players for traitors, AFK allies, AFK teammates
    for (const nearbyID of this._nearbyPlayerIDs) {
      let other;
      try {
        other = this.game.playerBySmallID(nearbyID);
      } catch {
        continue;
      }
      if (!other.isPlayer() || !other.isAlive()) continue;

      const lastAttackTick = this._lastAttackTickByTarget.get(nearbyID) ?? -1;
      const secondsSinceAttack = (currentTick - lastAttackTick) / 10;
      const hasNotAttackedRecently =
        lastAttackTick < 0 || secondsSinceAttack > 15;

      if (!hasNotAttackedRecently) continue;

      if (other.isTraitor() && player.isAlliedWith(other)) {
        return { type: "info", message: "control_panel.traitor_neighbor_info" };
      }
      if (other.isDisconnected() && player.isAlliedWith(other)) {
        return {
          type: "info",
          message: "control_panel.allied_afk_neighbor_info",
        };
      }
      if (other.isDisconnected() && player.isOnSameTeam(other)) {
        return {
          type: "info",
          message: "control_panel.teammate_afk_neighbor_info",
        };
      }
    }

    return null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.onKeyDown);
    globalThis.removeEventListener(
      `${USER_SETTINGS_CHANGED_EVENT}:settings.attackRatio`,
      this.onAttackRatioSettingChanged,
    );
    if (this._goldGainTimeoutId !== null) {
      clearTimeout(this._goldGainTimeoutId);
      this._goldGainTimeoutId = null;
    }
  }

  private updateTroopIncrease() {
    const player = this.game?.myPlayer();
    if (player === null) return;
    const troopIncreaseRate = this.game.config().troopIncreaseRate(player);
    this._troopRateIsIncreasing =
      troopIncreaseRate >= this._lastTroopIncreaseRate;
    this._lastTroopIncreaseRate = troopIncreaseRate;
  }

  onAttackRatioChange(newRatio: number) {
    // The element outlives any one game; uiState only exists once init() ran.
    // Before that (the hidden slider on the lobby page) this.attackRatio holds
    // the value, and init() reloads it from UserSettings anyway.
    if (this.uiState === undefined) return;
    this.uiState.attackRatio = newRatio;
  }

  private onAttackRatioSettingChanged = () => {
    if (this.uiState === undefined) return;
    this.attackRatio = new UserSettings().attackRatio();
    this.onAttackRatioChange(this.attackRatio);
    this.requestUpdate();
  };

  private toggleScouting(res: ResourceType | "all" | "none") {
    if (this._activeScouting === res) {
      this._activeScouting = "none";
    } else {
      this._activeScouting = res;
    }
    const densityData =
      this._activeScouting !== "none"
        ? GeologicalDataService.getDensityData(this.game, this._activeScouting)
        : undefined;
    this.eventBus.emit(
      new ToggleGeologicalScoutingEvent(this._activeScouting, densityData),
    );
    this.requestUpdate();
  }

  private openEconomyPanel = () => {
    const panel = document.querySelector("mining-economy-panel") as any;
    if (panel) {
      panel.toggle();
    }
  };

  private setAttackRatioPreset(pct: number) {
    this.attackRatio = Math.max(0.01, Math.min(1.0, pct / 100));
    this.onAttackRatioChange(this.attackRatio);
    this.requestUpdate();
  }

  setVisibile(visible: boolean) {
    this._isVisible = visible;
    this.requestUpdate();
  }

  private handleRatioSliderInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const value = Number(input.value);
    this.attackRatio = value / 100;
    this.onAttackRatioChange(this.attackRatio);
  }

  private handleRatioSliderPointerUp(e: Event) {
    (e.target as HTMLInputElement).blur();
  }

  private calculateTroopBar(): { greenPercent: number; orangePercent: number } {
    const base = Math.max(this._maxTroops, 1);
    const greenPercentRaw = (this._troops / base) * 100;
    const orangePercentRaw = (this._attackingTroops / base) * 100;

    const greenPercent = Math.max(0, Math.min(100, greenPercentRaw));
    const orangePercent = Math.max(
      0,
      Math.min(100 - greenPercent, orangePercentRaw),
    );

    return { greenPercent, orangePercent };
  }

  private renderMobileTroopBar() {
    const { greenPercent, orangePercent } = this.calculateTroopBar();
    return html`
      <div
        class="w-full h-6 border border-gray-600 rounded-md bg-gray-900/60 overflow-hidden relative"
      >
        <div class="relative h-full">
          <div
            class="absolute inset-y-0 left-0 w-full origin-left bg-malibu-blue transition-transform duration-200 ease-out"
            style="transform: scaleX(${greenPercent / 100});"
          ></div>
          <div
            class="absolute inset-y-0 left-0 w-full origin-left bg-aquarius transition-transform duration-200 ease-out"
            style="transform: translateX(${greenPercent}%) scaleX(${orangePercent /
            100});"
          ></div>
        </div>
        <div
          class="absolute inset-0 flex items-center justify-between px-1.5 text-xs font-bold leading-none pointer-events-none"
          translate="no"
        >
          <span class="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
            >${renderTroops(this._troops)}</span
          >
          <span class="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
            >${renderTroops(this._maxTroops)}</span
          >
        </div>
        <div
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
          translate="no"
        >
          <div
            class="flex items-center gap-0.5 px-1 ${this.tutorialHighlightClass(
              "troop_rate",
            )}"
          >
            <img
              src=${soldierIcon}
              alt=""
              aria-hidden="true"
              width="12"
              height="12"
              class="brightness-0 invert drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
            />
            <span
              class="text-[10px] font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] ${this
                ._troopRateIsIncreasing
                ? "text-green-400"
                : "text-orange-400"}"
              >+${renderTroops(this.troopRate)}/s</span
            >
          </div>
        </div>
      </div>
    `;
  }

  private renderDesktopTroopBar() {
    const { greenPercent, orangePercent } = this.calculateTroopBar();
    return html`
      <div
        class="w-full h-6 border border-gray-600 rounded-md bg-gray-900/60 overflow-hidden relative"
      >
        <div class="relative h-full">
          <div
            class="absolute inset-y-0 left-0 w-full origin-left bg-malibu-blue transition-transform duration-200 ease-out"
            style="transform: scaleX(${greenPercent / 100});"
          ></div>
          <div
            class="absolute inset-y-0 left-0 w-full origin-left bg-aquarius transition-transform duration-200 ease-out"
            style="transform: translateX(${greenPercent}%) scaleX(${orangePercent /
            100});"
          ></div>
        </div>
        <div
          class="absolute inset-0 flex items-center text-lg font-bold leading-none pointer-events-none"
          translate="no"
        >
          <span class="flex-1 flex justify-end h-full items-center pr-0.5">
            <span class="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
              >${renderTroops(this._troops)}</span
            >
          </span>
          <span
            class="h-full flex items-center px-0.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
            >/</span
          >
          <span
            class="flex-1 flex justify-start h-full items-center pl-0.5 gap-0.5"
          >
            <span
              class="text-white tabular-nums w-[3.5rem] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
              >${renderTroops(this._maxTroops)}</span
            >
            <img
              src=${soldierIcon}
              alt=""
              aria-hidden="true"
              width="22"
              height="22"
              class="shrink-0 brightness-0 invert drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] ml-1.5"
            />
          </span>
        </div>
      </div>
    `;
  }

  private tutorialHighlightClass(target: TutorialHighlight): string {
    return this._tutorialHighlight === target ? "tutorial-highlight" : "";
  }

  private renderNotification() {
    if (!this._notification) return html``;
    const isWarning = this._notification.type === "warning";
    return html`
      <div
        class="flex items-center gap-1.5 px-1.5 py-1 rounded-md border text-xs font-medium mb-1 ${isWarning
          ? "border-orange-400/60 bg-orange-400/10 text-orange-300"
          : "border-blue-400/60 bg-blue-400/10 text-blue-300"}"
      >
        <span class="shrink-0">${isWarning ? "⚠" : "ℹ"}</span>
        <span>${translateText(this._notification.message)}</span>
      </div>
    `;
  }

  private renderDesktop() {
    return html`
      ${this.renderNotification()}

      <!-- Fuel Starvation Warning Banner -->
      ${this._fuel <= 0
        ? html`<div
            class="bg-red-600/90 text-white font-extrabold text-xs px-2 py-0.5 rounded text-center animate-pulse mb-1 border border-red-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
          >
            ⚠️ TREIBSTOFF-ENGPASS! (0 Fuel: -80% Speed, -50% Kampfkraft)
          </div>`
        : ""}

      <!-- High-Visibility Geological Scouting Heatmap Control -->
      <div class="flex items-center justify-between gap-1 mb-1 text-xs bg-slate-900/90 border border-slate-700/80 rounded px-2 py-1 shadow-md">
        <div class="flex items-center gap-1.5">
          <button
            class="flex items-center gap-1.5 px-3 py-1 rounded font-extrabold text-xs tracking-wide transition-all shadow-lg ${this._activeScouting !== "none"
              ? "bg-amber-400 text-slate-950 ring-2 ring-amber-300 ring-offset-1 ring-offset-slate-900 shadow-amber-500/50"
              : "bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700 hover:text-white"}"
            @click=${() => this.toggleScouting(this._activeScouting === "none" ? "all" : "none")}
            title="Rohstoff-Heatmap ein-/ausschalten (Taste: H)"
          >
            <img src=${highlightIcon} class="w-3.5 h-3.5 ${this._activeScouting !== "none" ? "filter invert" : ""}" />
            <span>HEATMAP: ${this._activeScouting !== "none" ? "AKTIV" : "AUS"}</span>
            <span class="text-[10px] opacity-75 font-mono px-1 py-0.2 bg-black/30 rounded text-white">[H]</span>
          </button>
        </div>

        <!-- High-Contrast Resource Filter Chips (No Emojis) -->
        <div class="flex items-center gap-1">
          <button
            class="flex items-center gap-1 px-2 py-0.5 rounded font-bold transition-all text-[11px] ${this._activeScouting === "all"
              ? "bg-cyan-500 text-slate-950 font-black shadow-md ring-1 ring-cyan-300"
              : "bg-slate-800/80 text-cyan-300 hover:bg-slate-700 border border-cyan-800/50"}"
            @click=${() => this.toggleScouting("all")}
            title="Alle Rohstoffe hervorheben"
          >
            <img src=${highlightIcon} class="w-3 h-3 ${this._activeScouting === "all" ? "filter invert" : ""}" />
            <span>Alle</span>
          </button>
          <button
            class="flex items-center gap-1 px-2 py-0.5 rounded font-bold transition-all text-[11px] ${this._activeScouting === "ironOre"
              ? "bg-amber-500 text-slate-950 font-black shadow-md ring-1 ring-amber-300"
              : "bg-slate-800/80 text-amber-300 hover:bg-slate-700 border border-amber-800/50"}"
            @click=${() => this.toggleScouting("ironOre")}
            title="Eisenerz-Vorkommen anzeigen"
          >
            <img src=${ironMineIcon} class="w-3 h-3 ${this._activeScouting === "ironOre" ? "filter invert" : ""}" />
            <span>Eisen</span>
          </button>
          <button
            class="flex items-center gap-1 px-2 py-0.5 rounded font-bold transition-all text-[11px] ${this._activeScouting === "coal"
              ? "bg-stone-300 text-slate-950 font-black shadow-md ring-1 ring-stone-100"
              : "bg-slate-800/80 text-stone-300 hover:bg-slate-700 border border-stone-700/50"}"
            @click=${() => this.toggleScouting("coal")}
            title="Kohle-Vorkommen anzeigen"
          >
            <img src=${coalMineIcon} class="w-3 h-3 ${this._activeScouting === "coal" ? "filter invert" : ""}" />
            <span>Kohle</span>
          </button>
          <button
            class="flex items-center gap-1 px-2 py-0.5 rounded font-bold transition-all text-[11px] ${this._activeScouting === "crudeOil"
              ? "bg-purple-500 text-white font-black shadow-md ring-1 ring-purple-300"
              : "bg-slate-800/80 text-purple-300 hover:bg-slate-700 border border-purple-800/50"}"
            @click=${() => this.toggleScouting("crudeOil")}
            title="Rohöl-Vorkommen anzeigen"
          >
            <img src=${oilRigIcon} class="w-3 h-3" />
            <span>Öl</span>
          </button>
          <button
            class="flex items-center gap-1 px-2 py-0.5 rounded font-bold transition-all text-[11px] ${this._activeScouting === "uraniumOre"
              ? "bg-emerald-400 text-slate-950 font-black shadow-md ring-1 ring-emerald-200"
              : "bg-slate-800/80 text-emerald-300 hover:bg-slate-700 border border-emerald-800/50"}"
            @click=${() => this.toggleScouting("uraniumOre")}
            title="Uranerz-Vorkommen anzeigen"
          >
            <img src=${uraniumMineIcon} class="w-3 h-3 ${this._activeScouting === "uraniumOre" ? "filter invert" : ""}" />
            <span>Uran</span>
          </button>
        </div>
      </div>

      <!-- Demographics & Economy Resource Bar -->
      <div class="flex flex-wrap items-center justify-between gap-1 mb-1 text-xs font-semibold bg-gray-950/80 border border-gray-700/60 rounded px-2 py-0.5">
        <!-- Demography -->
        <div class="flex items-center gap-1.5 text-sky-300 cursor-pointer hover:underline" @click=${this.openEconomyPanel} title="Bevölkerung / Limit (Klicken für Details)">
          <img src=${populationIcon} class="w-3.5 h-3.5 object-contain" />
          <span class="tabular-nums font-bold">${renderNumber(this._population)}</span>
          <span class="text-gray-400">/ ${renderNumber(this._maxPop)}</span>
        </div>

        <div class="h-3 w-px bg-gray-700"></div>

        <!-- Tier 1 Raw Resources -->
        <div class="flex items-center gap-2 cursor-pointer hover:brightness-125 transition-all" @click=${this.openEconomyPanel} title="Klicken für Bergbau & Minen-Verwaltung">
          <span class="text-amber-400 flex items-center gap-1" title="Eisenerz (Fe)">
            <img src=${ironMineIcon} class="w-3.5 h-3.5 object-contain" />
            <span class="font-bold">Fe:</span> <span class="tabular-nums">${renderNumber(this._iron)}</span>
          </span>
          <span class="text-stone-300 flex items-center gap-1" title="Kohle (C)">
            <img src=${coalMineIcon} class="w-3.5 h-3.5 object-contain" />
            <span class="font-bold">C:</span> <span class="tabular-nums">${renderNumber(this._coal)}</span>
          </span>
          <span class="text-purple-400 flex items-center gap-1" title="Rohöl (Oil)">
            <img src=${oilRigIcon} class="w-3.5 h-3.5 object-contain" />
            <span class="font-bold">Oil:</span> <span class="tabular-nums">${renderNumber(this._oil)}</span>
          </span>
          <span class="text-emerald-400 flex items-center gap-1" title="Uranerz (U)">
            <img src=${uraniumMineIcon} class="w-3.5 h-3.5 object-contain" />
            <span class="font-bold">U:</span> <span class="tabular-nums">${renderNumber(this._uranium)}</span>
          </span>
        </div>

        <div class="h-3 w-px bg-gray-700"></div>

        <!-- Tier 2 Refined Goods -->
        <div class="flex items-center gap-2 cursor-pointer hover:brightness-125 transition-all" @click=${this.openEconomyPanel} title="Klicken für Veredelung & Raffinerie-Details">
          <span class="text-cyan-300 flex items-center gap-1" title="Panzerstahl">
            <img src=${steelMillIcon} class="w-3.5 h-3.5 object-contain" />
            <span class="font-bold">Stahl:</span> <span class="tabular-nums">${renderNumber(this._steel)}</span>
          </span>
          <span class="text-orange-400 flex items-center gap-1" title="Treibstoff (Fuel)">
            <img src=${refineryIcon} class="w-3.5 h-3.5 object-contain" />
            <span class="font-bold">Fuel:</span> <span class="tabular-nums font-bold ${this._fuel <= 0 ? "text-red-400 animate-pulse" : ""}">${renderNumber(this._fuel)}</span>
          </span>
          <span class="text-lime-300 flex items-center gap-1" title="Spaltmaterial / Enriched Uranium">
            <img src=${centrifugeIcon} class="w-3.5 h-3.5 object-contain" />
            <span class="font-bold">U-Ref:</span> <span class="tabular-nums">${renderNumber(this._enrichedUranium)}</span>
          </span>
        </div>

        <div class="h-3 w-px bg-gray-700"></div>

        <!-- Open Mining & Economy Modal Button -->
        <button
          class="flex items-center gap-1.5 bg-[#4d8242] hover:bg-[#5d9651] text-white px-2 py-0.5 rounded text-[11px] font-bold transition-colors shadow-sm border border-[#72a55d]/40"
          @click=${this.openEconomyPanel}
          title="Bergbau & Industrie-Verwaltung öffnen"
        >
          <img src=${factoryIcon} class="w-3.5 h-3.5 object-contain" />
          <span>Minen & Industrie</span>
        </button>
      </div>

      <!-- Row 1: troop rate | troop bar | gold -->
      <div class="flex gap-1.5 items-center mb-1">
        <!-- Troop rate -->
        <div
          class="flex items-center gap-1 shrink-0 border rounded-md font-bold text-sm py-0.5 px-1 w-[5.5rem] ${this.tutorialHighlightClass(
            "troop_rate",
          )} ${this._troopRateIsIncreasing
            ? "border-green-400"
            : "border-orange-400"}"
          translate="no"
        >
          <img
            src=${soldierIcon}
            alt=""
            aria-hidden="true"
            width="13"
            height="13"
            class="shrink-0"
            style="filter: ${this._troopRateIsIncreasing
              ? "brightness(0) saturate(100%) invert(74%) sepia(44%) saturate(500%) hue-rotate(83deg) brightness(103%)"
              : "brightness(0) saturate(100%) invert(65%) sepia(60%) saturate(600%) hue-rotate(330deg) brightness(105%)"}"
          />
          <span
            class="text-sm font-bold tabular-nums ${this._troopRateIsIncreasing
              ? "text-green-400"
              : "text-orange-400"}"
            >+${renderTroops(this.troopRate)}/s</span
          >
        </div>
        <!-- Troop bar -->
        <div class="flex-1 ${this.tutorialHighlightClass("troops")}">
          ${this.renderDesktopTroopBar()}
        </div>
        <!-- Gold -->
        <div
          class="flex items-center gap-1 shrink-0 border rounded-md border-yellow-400 font-bold text-yellow-400 text-sm py-0.5 px-1 min-w-[4.5rem] relative ${this.tutorialHighlightClass(
            "gold",
          )}"
          translate="no"
        >
          ${this._goldGain !== null
            ? keyed(
                this._goldGainPulseId,
                html`<span
                  class="gold-gain-pop absolute -top-5 right-[5px] min-[1015px]:right-[9px] text-green-400 text-sm font-extrabold tabular-nums whitespace-nowrap pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]"
                  >+${renderNumber(this._goldGain)}</span
                >`,
              )
            : ""}
          <img src=${goldCoinIcon} width="13" height="13" class="shrink-0" />
          <span class="tabular-nums">${renderNumber(this._gold)}</span>
        </div>
      </div>
      <!-- Row 2: attack ratio | slider | presets -->
      <div
        class="flex items-center gap-1.5 ${this.tutorialHighlightClass(
          "attack_ratio",
        )}"
        translate="no"
      >
        <div
          class="flex items-center gap-1 shrink-0 border border-gray-600 rounded-md px-1 py-0.5 text-sm font-bold text-white cursor-pointer w-[8rem]"
        >
          <img
            src=${swordIcon}
            alt=""
            aria-hidden="true"
            width="12"
            height="12"
            style="filter: brightness(0) invert(1);"
          />
          <span
            >${(this.attackRatio * 100).toFixed(0)}%
            (${renderTroops(
              (this.game?.myPlayer()?.troops() ?? 0) * this.attackRatio,
            )})</span
          >
        </div>
        <input
          type="range"
          min="1"
          max="100"
          .value=${String(Math.round(this.attackRatio * 100))}
          @input=${(e: Event) => this.handleRatioSliderInput(e)}
          @pointerup=${(e: Event) => this.handleRatioSliderPointerUp(e)}
          class="flex-1 h-1.5 accent-aquarius cursor-pointer"
        />
        <div class="flex items-center gap-1 shrink-0 text-xs">
          <button
            class="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold"
            @click=${() => this.setAttackRatioPreset(20)}
          >20%</button>
          <button
            class="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold"
            @click=${() => this.setAttackRatioPreset(50)}
          >50%</button>
          <button
            class="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold"
            @click=${() => this.setAttackRatioPreset(100)}
          >100%</button>
        </div>
      </div>
    `;
  }

  private getMobileAttackRatioLabel(): string {
    const percent = (this.attackRatio * 100).toFixed(0);
    const troops = renderTroops(
      (this.game?.myPlayer()?.troops() ?? 0) * this.attackRatio,
    );
    const translated = translateText("control_panel.attack_ratio", {
      percent,
      troops,
    });
    return translated !== "control_panel.attack_ratio" &&
      translated.includes(percent)
      ? translated
      : `${percent}%\n(${troops})`;
  }

  private renderMobile() {
    return html`
      ${this.renderNotification()}
      <div class="flex gap-2 items-center">
        <!-- Gold -->
        <div
          class="flex items-center justify-center p-1 gap-0.5 border rounded-md border-yellow-400 font-bold text-yellow-400 text-xs w-1/5 shrink-0 relative ${this.tutorialHighlightClass(
            "gold",
          )}"
          translate="no"
        >
          ${this._goldGain !== null
            ? keyed(
                this._goldGainPulseId,
                html`<span
                  class="gold-gain-pop absolute -top-5 right-[5px] min-[1015px]:right-[9px] text-green-400 text-xs font-extrabold tabular-nums whitespace-nowrap pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]"
                  >+${renderNumber(this._goldGain)}</span
                >`,
              )
            : ""}
          <img src=${goldCoinIcon} width="13" height="13" />
          <span class="px-0.5">${renderNumber(this._gold)}</span>
        </div>
        <!-- Troop bar -->
        <div
          class="w-[40%] shrink-0 flex items-center ${this.tutorialHighlightClass(
            "troops",
          )}"
        >
          ${this.renderMobileTroopBar()}
        </div>
        <!-- Sword + % and troop count label -->
        <div class="flex flex-col items-center justify-center shrink-0">
          <div class="flex items-center gap-0.5">
            <img
              src=${swordIcon}
              alt=""
              aria-hidden="true"
              width="10"
              height="10"
              style="filter: brightness(0) invert(1);"
            />
            <span
              class="text-white text-[11px] font-bold tabular-nums text-center leading-tight whitespace-pre-wrap"
              >${this.getMobileAttackRatioLabel()}</span
            >
          </div>
        </div>
        <!-- Attack ratio slider -->
        <div
          class="flex-1 min-w-0 ${this.tutorialHighlightClass("attack_ratio")}"
          translate="no"
        >
          <input
            type="range"
            min="1"
            max="100"
            .value=${String(Math.round(this.attackRatio * 100))}
            @input=${(e: Event) => this.handleRatioSliderInput(e)}
            @pointerup=${(e: Event) => this.handleRatioSliderPointerUp(e)}
            class="w-full h-1.5 accent-aquarius cursor-pointer"
          />
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <style>
        @keyframes gold-gain-pop {
          0% {
            transform: translateY(4px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .gold-gain-pop {
          animation: gold-gain-pop 0.25s ease-out;
        }
      </style>
      <div
        class="relative pointer-events-auto ${this._isVisible
          ? "relative w-full text-sm px-2 py-1"
          : "hidden"}"
        @contextmenu=${(e: MouseEvent) => e.preventDefault()}
      >
        <div class="lg:hidden">${this.renderMobile()}</div>
        <div class="hidden lg:block">${this.renderDesktop()}</div>
      </div>
    `;
  }

  createRenderRoot() {
    return this; // Disable shadow DOM to allow Tailwind styles
  }
}
