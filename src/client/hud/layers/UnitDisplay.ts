import {
  BuildableUnit,
  BuildMenus,
  Gold,
  PlayerBuildableUnitType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { renderNumber } from "@openfront/engine-lib/Format";
import {
  BUILDING_BASE_COSTS,
  calculateBuildingCost,
  getUnitResourceCost,
} from "@openfront/engine-lib/game/EconomyConfig";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import {
  ToggleEraserModeEvent,
  ToggleStructureEvent,
} from "../../InputHandler";
import { UIState } from "../../UIState";
import { UserSettings } from "../../UserSettings";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import {
  atomBombIcon,
  bunkerIcon,
  centrifugeIcon,
  cityIcon,
  coalMineIcon,
  cruiseMissileIcon,
  defensePostIcon,
  destroyerIcon,
  factoryIcon,
  goldCoinIcon,
  hydrogenBombIcon,
  ironMineIcon,
  mirvIcon,
  missileSiloIcon,
  oilRigIcon,
  portIcon,
  radarIcon,
  refineryIcon,
  repairShipIcon,
  samLauncherIcon,
  steelMillIcon,
  uraniumMineIcon,
  warshipIcon,
  buildIcon,
  targetIcon,
  eraserIcon,
} from "../HotbarIcons";
import { TutorialHighlight, TutorialHighlightEvent } from "../Tutorial";

export interface UnitConfigItem {
  type: PlayerBuildableUnitType;
  icon: string;
  name: string;
  description: string;
  yieldInfo?: string;
  defaultHotkey: string;
  structureKey: string;
}

@customElement("unit-display")
export class UnitDisplay extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;

  @state()
  private activeTab: "buildings" | "actives" = "buildings";

  private playerBuildables: BuildableUnit[] | null = null;
  private keybinds: Record<string, { value: string; key: string }> = {};

  // Building counts
  private _cities = 0;
  private _ironMines = 0;
  private _coalMines = 0;
  private _oilRigs = 0;
  private _uraniumMines = 0;
  private _factories = 0;
  private _steelMills = 0;
  private _refineries = 0;
  private _centrifuges = 0;
  private _defensePost = 0;
  private _bunkers = 0;
  private _radars = 0;
  private _samLauncher = 0;
  private _missileSilo = 0;
  private _ports = 0;

  // Active / Military counts
  private _warships = 0;
  private _destroyers = 0;
  private _submarines = 0;
  private _battleships = 0;

  private allDisabled = false;
  private _hoveredUnit: PlayerBuildableUnitType | null = null;
  private tutorialHighlight: PlayerBuildableUnitType | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.onGlobalKeyDown);
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.onGlobalKeyDown);
    super.disconnectedCallback();
  }

  private onGlobalKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    if (e.code === "Tab") {
      e.preventDefault();
      this.activeTab = this.activeTab === "buildings" ? "actives" : "buildings";
      if (this.uiState) {
        this.uiState.activeHotbarTab = this.activeTab;
      }
      this.requestUpdate();
    }
  };

  init() {
    const config = this.game.config();
    const userSettings = new UserSettings();

    this.keybinds = userSettings.parsedUserKeybinds();
    this.allDisabled = BuildMenus.types.every((u) => config.isUnitDisabled(u));

    if (this.uiState) {
      this.uiState.activeHotbarTab = this.activeTab;
    }

    const highlightUnits: Partial<
      Record<TutorialHighlight, PlayerBuildableUnitType>
    > = {
      city: UnitType.City,
      port: UnitType.Port,
      defense_post: UnitType.DefensePost,
      factory: UnitType.Factory,
      warship: UnitType.Warship,
      silo: UnitType.MissileSilo,
      atom: UnitType.AtomBomb,
      hydrogen: UnitType.HydrogenBomb,
      mirv: UnitType.MIRV,
      sam: UnitType.SAMLauncher,
    };
    this.eventBus.on(TutorialHighlightEvent, (e) => {
      this.tutorialHighlight = (e.target && highlightUnits[e.target]) ?? null;
      this.requestUpdate();
    });
    this.eventBus.on(ToggleEraserModeEvent, () => {
      this.requestUpdate();
    });
    this.requestUpdate();
  }

  private unitCount(type: UnitType): number {
    const player = this.game?.myPlayer();
    if (!player) return 0;
    return player.totalUnitLevels(type);
  }

  private cost(item: UnitType): Gold {
    for (const bu of this.playerBuildables ?? []) {
      if (bu.type === item) {
        return bu.cost;
      }
    }
    const base = BUILDING_BASE_COSTS[item];
    if (base) {
      const count = this.unitCount(item);
      return BigInt(calculateBuildingCost(item, count).gold);
    }
    const mil = getUnitResourceCost(item);
    if (mil && mil.gold > 0) {
      return BigInt(mil.gold);
    }
    return 0n;
  }

  private resourceCosts(item: UnitType): {
    steel: number;
    fuel: number;
    enrichedUranium: number;
  } {
    const base = BUILDING_BASE_COSTS[item];
    if (base) {
      const count = this.unitCount(item);
      const calc = calculateBuildingCost(item, count);
      return {
        steel: calc.steel,
        fuel: calc.fuel,
        enrichedUranium: calc.enrichedUranium,
      };
    }
    const mil = getUnitResourceCost(item);
    return {
      steel: mil.steel,
      fuel: mil.fuel,
      enrichedUranium: mil.enrichedUranium,
    };
  }

  private canBuild(item: UnitType): boolean {
    if (this.game?.config().isUnitDisabled(item)) return false;
    const player = this.game?.myPlayer();
    if (!player || !player.isAlive()) return false;

    // Check gold
    if (this.cost(item) > player.gold()) return false;

    const costs = this.resourceCosts(item);
    const eco = (player as any).economy?.() ?? (player.state as any)?.economy;

    // Check refined resources
    if (costs.steel > 0 && (eco?.refined?.steel ?? 0) < costs.steel) {
      return false;
    }
    if (costs.fuel > 0 && (eco?.refined?.fuel ?? 0) < costs.fuel) {
      return false;
    }
    if (
      costs.enrichedUranium > 0 &&
      (eco?.refined?.enrichedUranium ?? 0) < costs.enrichedUranium
    ) {
      return false;
    }

    // Unit-specific prerequisite checks
    switch (item) {
      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb:
      case UnitType.MIRV:
      case UnitType.ICBM:
        return (
          (player.units(UnitType.MissileSilo).length ?? 0) > 0 &&
          (eco?.refined?.enrichedUranium ?? 0) >= costs.enrichedUranium
        );
      case UnitType.CruiseMissile:
        return (
          (eco?.refined?.steel ?? 0) >= costs.steel &&
          (eco?.refined?.fuel ?? 0) >= costs.fuel
        );
      case UnitType.Warship:
      case UnitType.Destroyer:
      case UnitType.Submarine:
      case UnitType.Battleship:
        return (player.units(UnitType.Port).length ?? 0) > 0;
      default:
        return true;
    }
  }

  tick() {
    const player = this.game?.myPlayer();
    if (!player) return;
    player.buildables(undefined, BuildMenus.types).then((buildables) => {
      this.playerBuildables = buildables;
    });

    this._cities = player.totalUnitLevels(UnitType.City);
    this._ironMines = player.totalUnitLevels(UnitType.IronMine);
    this._coalMines = player.totalUnitLevels(UnitType.CoalMine);
    this._oilRigs = player.totalUnitLevels(UnitType.OilRig);
    this._uraniumMines = player.totalUnitLevels(UnitType.UraniumMine);
    this._factories = player.totalUnitLevels(UnitType.Factory);
    this._steelMills = player.totalUnitLevels(UnitType.SteelMill);
    this._refineries = player.totalUnitLevels(UnitType.Refinery);
    this._centrifuges = player.totalUnitLevels(UnitType.Centrifuge);
    this._defensePost = player.totalUnitLevels(UnitType.DefensePost);
    this._bunkers = player.totalUnitLevels(UnitType.Bunker);
    this._radars = player.totalUnitLevels(UnitType.Radar);
    this._samLauncher = player.totalUnitLevels(UnitType.SAMLauncher);
    this._missileSilo = player.totalUnitLevels(UnitType.MissileSilo);
    this._ports = player.totalUnitLevels(UnitType.Port);

    this._warships = player.totalUnitLevels(UnitType.Warship);
    this._destroyers = player.totalUnitLevels(UnitType.Destroyer);
    this._submarines = player.totalUnitLevels(UnitType.Submarine);
    this._battleships = player.totalUnitLevels(UnitType.Battleship);

    this.requestUpdate();
  }

  // Row 1: Infrastructure & Defense (Port belongs in Gebäude!)
  public get infrastructureUnits(): UnitConfigItem[] {
    return [
      {
        type: UnitType.City,
        icon: cityIcon,
        name: "Wohnstadt",
        description: "Erhöht Bevölkerungswachstum und generiert Steuern.",
        defaultHotkey: "1",
        structureKey: "city",
      },
      {
        type: UnitType.Factory,
        icon: factoryIcon,
        name: "Fabrik / Industrie",
        description: "Erweitert Bahnnetze und logistische Verbindungen.",
        defaultHotkey: "2",
        structureKey: "factory",
      },
      {
        type: UnitType.Port,
        icon: portIcon,
        name: "Marinehafen / Werft",
        description: "Küsteneinrichtung zum Bau und Versorgen von Schiffen.",
        defaultHotkey: "3",
        structureKey: "port",
      },
      {
        type: UnitType.DefensePost,
        icon: defensePostIcon,
        name: "Verteidigungsposten",
        description: "Schützt angrenzende Provinzen vor Vorstößen.",
        defaultHotkey: "4",
        structureKey: "defense_post",
      },
      {
        type: UnitType.MissileSilo,
        icon: missileSiloIcon,
        name: "Raketensilo",
        description: "Startplattform für strategische Nuklearwaffen.",
        defaultHotkey: "5",
        structureKey: "missile_silo",
      },
      {
        type: UnitType.SAMLauncher,
        icon: samLauncherIcon,
        name: "Flugabwehr / SAM",
        description: "Schießt feindliche Raketen und Flugkörper ab.",
        defaultHotkey: "6",
        structureKey: "sam_launcher",
      },
      {
        type: UnitType.Bunker,
        icon: bunkerIcon,
        name: "Stahlbunker",
        description: "Schwere Panzerfestung (+80% Lanchester-Verteidigung).",
        yieldInfo: "Benötigt 10 Stahl",
        defaultHotkey: "7",
        structureKey: "bunker",
      },
      {
        type: UnitType.Radar,
        icon: radarIcon,
        name: "Radarstation",
        description:
          "Frühwarn-Sensornetzwerk (R=30), erhöht SAM-Reichweite um +50%.",
        yieldInfo: "SAM 12 ➔ 18 Kacheln",
        defaultHotkey: "8",
        structureKey: "radar",
      },
    ];
  }

  // Row 2: Mining & Refining
  public get economyUnits(): UnitConfigItem[] {
    return [
      {
        type: UnitType.IronMine,
        icon: ironMineIcon,
        name: "Eisenmine",
        description: "Fördert Eisenerz (Fe) auf Erz-Clustern.",
        yieldInfo: "+2.5 Fe / Sekunde",
        defaultHotkey: "Shift+1",
        structureKey: "iron_mine",
      },
      {
        type: UnitType.CoalMine,
        icon: coalMineIcon,
        name: "Kohlemine",
        description: "Fördert Kohle (C) für Stahlwerke & Zentrifugen.",
        yieldInfo: "+2.5 C / Sekunde",
        defaultHotkey: "Shift+2",
        structureKey: "coal_mine",
      },
      {
        type: UnitType.OilRig,
        icon: oilRigIcon,
        name: "Ölturm / Bohrinsel",
        description: "Fördert Rohöl (Oil) auf Land- oder Offshore-Feldern.",
        yieldInfo: "+1.8 Öl / Sekunde",
        defaultHotkey: "Shift+3",
        structureKey: "oil_rig",
      },
      {
        type: UnitType.UraniumMine,
        icon: uraniumMineIcon,
        name: "Uranmine",
        description: "Fördert seltenes Uranerz (U) für die Nuklearindustrie.",
        yieldInfo: "+0.6 Uran / Sekunde",
        defaultHotkey: "Shift+4",
        structureKey: "uranium_mine",
      },
      {
        type: UnitType.SteelMill,
        icon: steelMillIcon,
        name: "Stahlwerk",
        description: "Schmilzt Eisenerz und Kohle zu Panzerstahl.",
        yieldInfo: "Rezept: 3 Fe + 2 C ➔ 1 Stahl",
        defaultHotkey: "Shift+5",
        structureKey: "steel_mill",
      },
      {
        type: UnitType.Refinery,
        icon: refineryIcon,
        name: "Raffinerie",
        description: "Raffiniert Rohöl zu Treibstoff für Schiffe & Flotte.",
        yieldInfo: "Rezept: 3 Öl ➔ 1 Treibstoff",
        defaultHotkey: "Shift+6",
        structureKey: "refinery",
      },
      {
        type: UnitType.Centrifuge,
        icon: centrifugeIcon,
        name: "Uran-Zentrifuge",
        description: "Reichert Uranerz zu waffenfähigem Spaltmaterial an.",
        yieldInfo: "Rezept: 5 U + 3 C ➔ 1 U_ref",
        defaultHotkey: "Shift+7",
        structureKey: "centrifuge",
      },
    ];
  }

  // Actives tab: Fleet & Strategic Weapons
  public get activeUnits(): UnitConfigItem[] {
    return [
      {
        type: UnitType.Warship,
        icon: warshipIcon,
        name: "Kriegsschiff",
        description: "Patrouilliert Seegebiete und bombardiert Küsten.",
        yieldInfo: "Kosten: 40 Stahl, 50 Treibstoff",
        defaultHotkey: "1",
        structureKey: "warship",
      },
      {
        type: UnitType.Destroyer,
        icon: destroyerIcon,
        name: "Zerstörer",
        description:
          "Booster-Eskorte: Erhöht Kriegsschiff-Schaden in der Nähe um +10% pro Zerstörer (max 30%). Hoher Treibstoffverbrauch.",
        yieldInfo: "Kosten: 50 Stahl, 150 Treibstoff",
        defaultHotkey: "2",
        structureKey: "destroyer",
      },
      {
        type: UnitType.Submarine,
        icon: repairShipIcon,
        name: "Reparaturschiff",
        description:
          "Heilt in Intervallen nahe Kriegsschiffe & Zerstörer (+10 HP). Kann selbst nicht repariert werden (40 HP).",
        yieldInfo: "Kosten: 80 Stahl, 120 Treibstoff",
        defaultHotkey: "3",
        structureKey: "submarine",
      },
      {
        type: UnitType.CruiseMissile,
        icon: cruiseMissileIcon,
        name: "Marschflugkörper / Rakete",
        description:
          "Konventioneller taktischer Präzisionsschlag mit kleinem Radius (R=3). Kein Uran erforderlich!",
        yieldInfo: "Kosten: 40 Stahl, 120 Treibstoff (0 Uran)",
        defaultHotkey: "4",
        structureKey: "cruise_missile",
      },
      {
        type: UnitType.AtomBomb,
        icon: atomBombIcon,
        name: "Atombombe (A-Bombe)",
        description: "Nuklearschlag mittlerer Reichweite. Verwüstet Provinzen.",
        yieldInfo: "Kosten: 200 Uran, 200 Stahl, 150 Treibstoff",
        defaultHotkey: "5",
        structureKey: "atom_bomb",
      },
      {
        type: UnitType.HydrogenBomb,
        icon: hydrogenBombIcon,
        name: "Wasserstoffbombe (H-Bombe)",
        description:
          "Thermonukleare Vernichtungswaffe mit großem Explosionsradius.",
        yieldInfo: "Kosten: 450 Uran, 400 Stahl, 300 Treibstoff",
        defaultHotkey: "6",
        structureKey: "hydrogen_bomb",
      },
      {
        type: UnitType.MIRV,
        icon: mirvIcon,
        name: "MIRV Mehrfachsprengkopf",
        description:
          "Strategische Interkontinentalrakete mit bis zu 8 Sprengköpfen.",
        yieldInfo: "Kosten: 1000 Uran, 800 Stahl, 500 Treibstoff",
        defaultHotkey: "7",
        structureKey: "mirv",
      },
    ];
  }

  private getUnitCount(type: UnitType): number | null {
    switch (type) {
      case UnitType.City:
        return this._cities;
      case UnitType.IronMine:
        return this._ironMines;
      case UnitType.CoalMine:
        return this._coalMines;
      case UnitType.OilRig:
        return this._oilRigs;
      case UnitType.UraniumMine:
        return this._uraniumMines;
      case UnitType.Factory:
        return this._factories;
      case UnitType.SteelMill:
        return this._steelMills;
      case UnitType.Refinery:
        return this._refineries;
      case UnitType.Centrifuge:
        return this._centrifuges;
      case UnitType.DefensePost:
        return this._defensePost;
      case UnitType.Bunker:
        return this._bunkers;
      case UnitType.Radar:
        return this._radars;
      case UnitType.SAMLauncher:
        return this._samLauncher;
      case UnitType.MissileSilo:
        return this._missileSilo;
      case UnitType.Port:
        return this._ports;
      case UnitType.Warship:
        return this._warships;
      case UnitType.Destroyer:
        return this._destroyers;
      case UnitType.Submarine:
        return this._submarines;
      case UnitType.Battleship:
        return this._battleships;
      default:
        return null;
    }
  }

  render() {
    const myPlayer = this.game?.myPlayer();
    if (
      !this.game ||
      !myPlayer ||
      this.game.inSpawnPhase() ||
      !myPlayer.isAlive()
    ) {
      return null;
    }
    if (this.allDisabled) {
      return null;
    }

    const buildingTotal =
      this._cities +
      this._ironMines +
      this._coalMines +
      this._oilRigs +
      this._uraniumMines +
      this._factories +
      this._steelMills +
      this._refineries +
      this._centrifuges +
      this._defensePost +
      this._bunkers +
      this._radars +
      this._samLauncher +
      this._missileSilo +
      this._ports;

    const activeTotal =
      this._warships + this._destroyers + this._submarines + this._battleships;

    return html`
      <div
        class="border-t border-white/10 w-full bg-slate-950/90 backdrop-blur-md select-none overflow-visible relative"
      >
        <!-- Hotbar Tabs Switcher (No Emojis) -->
        <div
          class="flex items-center justify-between px-2.5 py-1 bg-slate-900/95 border-b border-white/10"
        >
          <div class="flex items-center gap-1.5">
            <button
              class="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold transition-all ${this
                .activeTab === "buildings"
                ? "bg-[#46783d] text-white shadow-md border-b-2 border-[#8ebf7e]"
                : "text-slate-300 hover:text-white hover:bg-slate-800"}"
              @click=${() => {
                this.activeTab = "buildings";
                if (this.uiState) this.uiState.activeHotbarTab = "buildings";
                this.requestUpdate();
              }}
            >
              <img src=${buildIcon} class="w-3.5 h-3.5 object-contain" />
              <span>Gebäude</span>
              <span
                class="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full font-mono"
                >${buildingTotal}</span
              >
            </button>
            <button
              class="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold transition-all ${this
                .activeTab === "actives"
                ? "bg-[#46783d] text-white shadow-md border-b-2 border-[#8ebf7e]"
                : "text-slate-300 hover:text-white hover:bg-slate-800"}"
              @click=${() => {
                this.activeTab = "actives";
                if (this.uiState) this.uiState.activeHotbarTab = "actives";
                this.requestUpdate();
              }}
            >
              <img src=${targetIcon} class="w-3.5 h-3.5 object-contain" />
              <span>Actives</span>
              <span
                class="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full font-mono"
                >${activeTotal}</span
              >
            </button>
          </div>
          <div class="flex items-center gap-2">
            <!-- Radierer / Abriss-Tool Toggle Button -->
            <button
              class="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold transition-all border ${this
                .uiState?.isEraserMode
                ? "bg-red-600 text-white shadow-md border-red-300 ring-2 ring-red-500/80 animate-pulse"
                : "text-red-300/90 hover:text-white hover:bg-red-950/60 border-red-800/40 bg-red-950/20"}"
              title="Radierer: Gebäude abreißen (Klicke auf eigene Gebäude zum Entfernen)"
              @click=${() => {
                if (this.uiState) {
                  this.uiState.isEraserMode = !this.uiState.isEraserMode;
                  if (this.uiState.isEraserMode) {
                    this.uiState.ghostStructure = null;
                  }
                  this.eventBus?.emit(
                    new ToggleEraserModeEvent(this.uiState.isEraserMode),
                  );
                  this.requestUpdate();
                }
              }}
            >
              <img src=${eraserIcon} class="w-3.5 h-3.5 object-contain" />
              <span>Radierer</span>
            </button>
            <div
              class="flex items-center gap-1 text-[11px] text-slate-400 font-mono hidden sm:flex"
            >
              <span
                class="px-1.5 py-0.5 bg-black/40 rounded border border-white/10 text-slate-300"
                >Tab</span
              >
              <span>Wechseln</span>
            </div>
          </div>
        </div>

        <!-- Hotbar Grid (Compact, overflow-visible for tooltips) -->
        <div
          class="px-1 py-1 w-full flex flex-col items-center gap-1 overflow-visible"
        >
          ${this.activeTab === "buildings"
            ? html`
                <!-- Row 1: Infrastruktur & Verteidigung -->
                <div
                  class="flex items-center justify-center gap-1 w-full overflow-visible py-0.5"
                >
                  ${this.infrastructureUnits.map((u) => {
                    const hotkey =
                      this.keybinds[`build${u.type.replace(/\s+/g, "")}`]
                        ?.key ?? u.defaultHotkey;
                    return this.renderUnitItem(
                      u.icon,
                      this.getUnitCount(u.type),
                      u.type,
                      u.structureKey,
                      hotkey,
                      u.name,
                      u.description,
                      u.yieldInfo,
                    );
                  })}
                </div>
                <!-- Row 2: Bergbau & Veredelung -->
                <div
                  class="flex items-center justify-center gap-1 w-full overflow-visible py-0.5"
                >
                  ${this.economyUnits.map((u) => {
                    const hotkey =
                      this.keybinds[`build${u.type.replace(/\s+/g, "")}`]
                        ?.key ?? u.defaultHotkey;
                    return this.renderUnitItem(
                      u.icon,
                      this.getUnitCount(u.type),
                      u.type,
                      u.structureKey,
                      hotkey,
                      u.name,
                      u.description,
                      u.yieldInfo,
                    );
                  })}
                </div>
              `
            : html`
                <!-- Actives: Flotte & Nuklearwaffen -->
                <div
                  class="flex items-center justify-center gap-1 w-full overflow-visible py-0.5"
                >
                  ${this.activeUnits.map((u) => {
                    const hotkey =
                      this.keybinds[`build${u.type.replace(/\s+/g, "")}`]
                        ?.key ?? u.defaultHotkey;
                    return this.renderUnitItem(
                      u.icon,
                      this.getUnitCount(u.type),
                      u.type,
                      u.structureKey,
                      hotkey,
                      u.name,
                      u.description,
                      u.yieldInfo,
                    );
                  })}
                </div>
              `}
        </div>
      </div>
    `;
  }

  private renderUnitItem(
    icon: string,
    number: number | null,
    unitType: PlayerBuildableUnitType,
    structureKey: string,
    hotkey: string,
    customName?: string,
    customDesc?: string,
    yieldInfo?: string,
  ) {
    if (this.game.config().isUnitDisabled(unitType)) {
      return html``;
    }
    const selected = this.uiState?.ghostStructure === unitType;
    const hovered = this._hoveredUnit === unitType;
    const displayHotkey = hotkey
      .replace("Digit", "")
      .replace("Key", "")
      .toUpperCase();

    const costs = this.resourceCosts(unitType);
    const goldCost = this.cost(unitType);
    const player = this.game?.myPlayer();
    const eco = (player as any)?.economy?.() ?? (player?.state as any)?.economy;
    const curUranium = Math.round(eco?.refined?.enrichedUranium ?? 0);
    const curSteel = Math.round(eco?.refined?.steel ?? 0);
    const curFuel = Math.round(eco?.refined?.fuel ?? 0);

    const isNuke =
      unitType === UnitType.AtomBomb ||
      unitType === UnitType.HydrogenBomb ||
      unitType === UnitType.MIRV;

    const hasSilo = (player?.units(UnitType.MissileSilo).length ?? 0) > 0;
    const hasPort = (player?.units(UnitType.Port).length ?? 0) > 0;
    const missingUranium = isNuke && curUranium < costs.enrichedUranium;
    const curGold = player?.gold() ?? 0n;
    const missingGold = curGold < goldCost;

    const displayName =
      customName ??
      (hasOwnTranslation("unit_type." + structureKey)
        ? translateText("unit_type." + structureKey)
        : unitType);

    const displayDesc =
      customDesc ??
      (hasOwnTranslation("build_menu.desc." + structureKey)
        ? translateText("build_menu.desc." + structureKey)
        : "");

    const canBuildNow = this.canBuild(unitType);

    return html`
      <div
        class="flex flex-col items-center relative shrink-0"
        @mouseenter=${() => {
          this._hoveredUnit = unitType;
          this.requestUpdate();
        }}
        @mouseleave=${() => {
          this._hoveredUnit = null;
          this.requestUpdate();
        }}
      >
        ${hovered
          ? html`
              <div
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 text-gray-200 text-center w-max min-w-[200px] max-w-[310px] text-xs bg-gray-950/95 backdrop-blur-md rounded-lg p-2.5 z-[100] shadow-2xl border border-gray-700 pointer-events-none"
              >
                <div class="font-bold text-sm mb-1 text-emerald-400">
                  ${displayName}
                  <span class="text-gray-400 font-mono text-xs"
                    >[${displayHotkey}]</span
                  >
                </div>
                <div class="text-[11px] text-gray-300 mb-1.5 leading-tight">
                  ${displayDesc}
                </div>
                ${yieldInfo
                  ? html`<div
                      class="text-[11px] font-semibold text-amber-300 bg-amber-950/40 border border-amber-800/40 rounded px-1.5 py-0.5 mb-1.5"
                    >
                      ${yieldInfo}
                    </div>`
                  : null}

                <!-- Requirements & Warnings (No Emojis) -->
                ${isNuke && !hasSilo
                  ? html`<div
                      class="text-[11px] font-bold text-red-400 bg-red-950/50 border border-red-800/40 rounded px-1.5 py-0.5 mb-1"
                    >
                      [Voraussetzung: Raketensilo]
                    </div>`
                  : null}
                ${missingUranium
                  ? html`<div
                        class="text-[11px] font-bold text-red-400 bg-red-950/50 border border-red-800/40 rounded px-1.5 py-0.5 mb-1"
                      >
                        Spaltmaterial fehlt: ${costs.enrichedUranium} U_ref
                        benötigt (Vorhanden: ${curUranium})
                      </div>
                      <div class="text-[10px] text-amber-400 mb-1">
                        Fördere Uran mit Uranminen & reichere es in Zentrifugen
                        an!
                      </div>`
                  : null}
                ${(unitType === UnitType.Warship ||
                  unitType === UnitType.Destroyer ||
                  unitType === UnitType.Submarine) &&
                !hasPort
                  ? html`<div
                      class="text-[11px] font-bold text-red-400 bg-red-950/50 border border-red-800/40 rounded px-1.5 py-0.5 mb-1"
                    >
                      [Voraussetzung: Marinehafen]
                    </div>`
                  : null}

                <!-- Costs Breakdown with SVG icons & Clear Header -->
                <div
                  class="flex flex-col gap-1 pt-1.5 border-t border-gray-700/80 text-xs"
                >
                  <div
                    class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold"
                  >
                    Baukosten
                  </div>
                  <div
                    class="flex items-center justify-center gap-2 font-medium flex-wrap"
                  >
                    <div
                      class="flex items-center gap-1 ${missingGold
                        ? "text-red-400 font-bold bg-red-950/40"
                        : "text-yellow-300 bg-yellow-950/40"} px-1.5 py-0.5 rounded border border-white/10"
                      title="Gold"
                    >
                      <img src=${goldCoinIcon} width="13" height="13" />
                      <span>${renderNumber(goldCost)} Gold</span>
                    </div>
                    ${costs.steel > 0
                      ? html`<div
                          class="flex items-center gap-1 ${curSteel <
                          costs.steel
                            ? "text-red-400 font-bold bg-red-950/40"
                            : "text-cyan-300 bg-cyan-950/40"} px-1.5 py-0.5 rounded border border-white/10"
                          title="Stahl"
                        >
                          <img src=${steelMillIcon} width="13" height="13" />
                          <span>${costs.steel} Stahl</span>
                        </div>`
                      : null}
                    ${costs.fuel > 0
                      ? html`<div
                          class="flex items-center gap-1 ${curFuel < costs.fuel
                            ? "text-red-400 font-bold bg-red-950/40"
                            : "text-orange-400 bg-orange-950/40"} px-1.5 py-0.5 rounded border border-white/10"
                          title="Treibstoff"
                        >
                          <img src=${refineryIcon} width="13" height="13" />
                          <span>${costs.fuel} Fuel</span>
                        </div>`
                      : null}
                    ${costs.enrichedUranium > 0
                      ? html`<div
                          class="flex items-center gap-1 ${missingUranium
                            ? "text-red-400 font-bold bg-red-950/40"
                            : "text-lime-300 bg-lime-950/40"} px-1.5 py-0.5 rounded border border-white/10"
                          title="Spaltmaterial"
                        >
                          <img src=${centrifugeIcon} width="13" height="13" />
                          <span>${costs.enrichedUranium} U_ref</span>
                        </div>`
                      : null}
                  </div>
                </div>
              </div>
            `
          : null}
        <div
          class="${canBuildNow ? "" : "opacity-40 cursor-not-allowed"} 
                 border border-slate-700/80 rounded relative flex items-center justify-center cursor-pointer transition-all
                 w-[48px] h-[32px] shrink-0
                 ${selected
            ? "bg-emerald-600/30 border-emerald-400 shadow-md ring-1 ring-emerald-400"
            : "hover:bg-slate-800 bg-slate-900/90"}
                 text-white
                 ${this.tutorialHighlight === unitType
            ? "tutorial-highlight"
            : ""}"
          @click=${() => {
            if (this.uiState?.isEraserMode) {
              this.uiState.isEraserMode = false;
              this.eventBus?.emit(new ToggleEraserModeEvent(false));
            }
            if (selected) {
              this.uiState.ghostStructure = null;
            } else if (canBuildNow) {
              this.uiState.ghostStructure = unitType;
            }
            this.requestUpdate();
          }}
          @mouseenter=${() => {
            switch (unitType) {
              case UnitType.AtomBomb:
              case UnitType.HydrogenBomb:
              case UnitType.MIRV:
              case UnitType.CruiseMissile:
                this.eventBus?.emit(
                  new ToggleStructureEvent([
                    UnitType.MissileSilo,
                    UnitType.SAMLauncher,
                  ]),
                );
                break;
              case UnitType.Warship:
              case UnitType.Destroyer:
              case UnitType.Submarine:
                this.eventBus?.emit(new ToggleStructureEvent([UnitType.Port]));
                break;
              default:
                this.eventBus?.emit(new ToggleStructureEvent([unitType]));
            }
          }}
          @mouseleave=${() =>
            this.eventBus?.emit(new ToggleStructureEvent(null))}
        >
          <!-- Hotkey Badge (Top-Left) -->
          <span
            class="absolute top-0.5 left-0.5 text-[8px] font-mono font-bold text-gray-400 bg-black/70 px-0.5 rounded leading-none pointer-events-none z-10"
          >
            ${displayHotkey.replace("SHIFT+", "S")}
          </span>

          <!-- Unit / Building Icon (Centered & Clear) -->
          <img
            src=${icon}
            alt=${structureKey}
            class="w-5 h-5 object-contain filter drop-shadow z-0"
          />

          <!-- Count Badge (Bottom-Right, if owned) -->
          ${number !== null && number > 0
            ? html`<span
                class="absolute bottom-0.5 right-0.5 text-[8.5px] font-bold font-mono tabular-nums leading-none text-emerald-300 bg-black/80 px-1 py-0.5 rounded-sm shadow-sm pointer-events-none z-10"
                >${renderNumber(number)}</span
              >`
            : null}
        </div>
      </div>
    `;
  }
}

function hasOwnTranslation(arg0: string) {
  try {
    const t = translateText(arg0);
    return t !== arg0;
  } catch {
    return false;
  }
}
