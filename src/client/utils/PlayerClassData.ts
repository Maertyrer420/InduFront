import { PlayerClass } from "@openfront/engine-api/game/GameTypes";
import { html, TemplateResult } from "lit";
import { translateText } from "../Utils";

export interface PlayerClassMeta {
  id: PlayerClass;
  name: string;
  role: string;
  buffs: string[];
  debuffs: string[];
  color: string;
  badgeClasses: string;
  icon: (cssClass?: string) => TemplateResult;
}

const FALLBACK_CLASS_TEXT_DE: Record<string, string> = {
  "player_classes.title": "Klassenspezialisierung",
  "player_classes.selected": "Ausgewählt",
  "player_classes.industrialist_name": "Industrieller",
  "player_classes.industrialist_role": "Standard • Wirtschaft & Produktion",
  "player_classes.industrialist_buff_1": "+25% Minen-Rohstoffförderung",
  "player_classes.industrialist_buff_2":
    "+20% Schmelz- und Raffinerie-Durchsatz",
  "player_classes.industrialist_debuff_1": "-15% Landangriffs-Effektivität",
  "player_classes.industrialist_debuff_2": "+15% Flotten-Treibstoffverbrauch",
  "player_classes.infantry_name": "Infanterie",
  "player_classes.infantry_role": "Masse • Offensive & Truppen",
  "player_classes.infantry_buff_1": "+20% Bevölkerungswachstum",
  "player_classes.infantry_buff_2": "-20% Verluste bei Landangriffen",
  "player_classes.infantry_debuff_1": "-10% Goldeinkommen",
  "player_classes.infantry_debuff_2": "-20% Flottengeschwindigkeit",
  "player_classes.infantry_debuff_3": "-25% Urananreicherungs-Durchsatz",
  "player_classes.marine_name": "Marine",
  "player_classes.marine_role": "Seeherrschaft • Flotte & Reparatur",
  "player_classes.marine_buff_1": "+30% Flottengeschwindigkeit",
  "player_classes.marine_buff_2": "-30% Flotten-Treibstoffverbrauch",
  "player_classes.marine_buff_3": "+50% Werft- & Schiff-Reparaturradius",
  "player_classes.marine_debuff_1": "-15% Minenförderung auf Land",
  "player_classes.marine_debuff_2": "+30% Baukosten für Bunker & Festungen",
  "player_classes.iron_dome_name": "Eiserne Kuppel",
  "player_classes.iron_dome_role": "Verteidigung • Flugabwehr & Festungen",
  "player_classes.iron_dome_buff_1": "+20% SAM-Abfangreichweite",
  "player_classes.iron_dome_buff_2": "+30% SAM-Nachladen (6 Raketen Magazin)",
  "player_classes.iron_dome_buff_3": "+50% stärkere Bunker- & Festungsabwehr",
  "player_classes.iron_dome_debuff_1": "-20% Land-Eroberungsgeschwindigkeit",
  "player_classes.iron_dome_debuff_2": "-15% Flottengeschwindigkeit",
  "player_classes.iron_dome_debuff_3": "+25% Baukosten für Atomwaffen",
  "player_classes.scientist_name": "Wissenschaftler",
  "player_classes.scientist_role": "Hochtechnologie • Nuklear & Strahlenschutz",
  "player_classes.scientist_buff_1": "+40% Zentrifugen-Anreicherungstempo",
  "player_classes.scientist_buff_2":
    "-20% Ressourcenkosten für Silos & Nuklearwaffen",
  "player_classes.scientist_buff_3": "-60% Verstrahlungs- & Fallout-Verluste",
  "player_classes.scientist_debuff_1": "-15% Bevölkerungskapazität",
  "player_classes.scientist_debuff_2": "-20% Gebäude-Haltbarkeit gegen Treffer",
};

const FALLBACK_CLASS_TEXT_EN: Record<string, string> = {
  "player_classes.title": "Class Specialization",
  "player_classes.selected": "Selected",
  "player_classes.industrialist_name": "Industrialist",
  "player_classes.industrialist_role": "Default • Economy & Industry",
  "player_classes.industrialist_buff_1": "+25% Mine Resource Yield",
  "player_classes.industrialist_buff_2": "+20% Smelting & Refining Throughput",
  "player_classes.industrialist_debuff_1": "-15% Land Attack Efficacy",
  "player_classes.industrialist_debuff_2": "+15% Ship Fuel Consumption",
  "player_classes.infantry_name": "Infantry",
  "player_classes.infantry_role": "Manpower • Land Offense",
  "player_classes.infantry_buff_1": "+20% Population Growth",
  "player_classes.infantry_buff_2": "-20% Land Assault Casualties",
  "player_classes.infantry_debuff_1": "-10% Gold Income",
  "player_classes.infantry_debuff_2": "-20% Fleet Movement Speed",
  "player_classes.infantry_debuff_3": "-25% Uranium Enrichment Throughput",
  "player_classes.marine_name": "Marine",
  "player_classes.marine_role": "Naval Dominance • Fleet & Repair",
  "player_classes.marine_buff_1": "+30% Fleet Movement Speed",
  "player_classes.marine_buff_2": "-30% Fleet Fuel Consumption",
  "player_classes.marine_buff_3": "+50% Ship Repair Pulse Radius",
  "player_classes.marine_debuff_1": "-15% Inland Mining Yield",
  "player_classes.marine_debuff_2": "+30% Bunker Construction Cost",
  "player_classes.iron_dome_name": "Iron Dome",
  "player_classes.iron_dome_role": "Defense • Air Defense & Fortresses",
  "player_classes.iron_dome_buff_1": "+20% SAM Interception Range",
  "player_classes.iron_dome_buff_2": "+30% SAM Reload Speed (6 Missiles Cap)",
  "player_classes.iron_dome_buff_3": "+50% Stronger Bunker & Outpost Defense",
  "player_classes.iron_dome_debuff_1": "-20% Land Conquest Speed",
  "player_classes.iron_dome_debuff_2": "-15% Fleet Movement Speed",
  "player_classes.iron_dome_debuff_3": "+25% Nuclear Weapon Resource Cost",
  "player_classes.scientist_name": "Scientist",
  "player_classes.scientist_role": "High-Tech • Nuclear & Radiation Defense",
  "player_classes.scientist_buff_1": "+40% Centrifuge Enrichment Speed",
  "player_classes.scientist_buff_2": "-20% Resource Cost for Nukes & Silos",
  "player_classes.scientist_buff_3": "-60% Fallout & Radiation Casualties",
  "player_classes.scientist_debuff_1": "-15% Population Capacity",
  "player_classes.scientist_debuff_2":
    "-20% Structure Durability against Strikes",
};

function isGermanLocale(): boolean {
  try {
    const saved =
      typeof localStorage !== "undefined" ? localStorage.getItem("lang") : null;
    if (saved) return saved.toLowerCase().startsWith("de");
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language.toLowerCase().startsWith("de");
    }
  } catch {
    /* ignore storage/navigator errors */
  }
  return false;
}

export function resolvePlayerClassText(
  key: string,
  translated: string,
): string {
  if (
    translated &&
    translated !== key &&
    !translated.startsWith("player_classes.")
  ) {
    return translated;
  }
  const map = isGermanLocale()
    ? FALLBACK_CLASS_TEXT_DE
    : FALLBACK_CLASS_TEXT_EN;
  return map[key] ?? FALLBACK_CLASS_TEXT_EN[key] ?? translated;
}

export function getAllPlayerClasses(): PlayerClassMeta[] {
  return [
    {
      id: PlayerClass.Industrialist,
      name: resolvePlayerClassText(
        "player_classes.industrialist_name",
        translateText("player_classes.industrialist_name"),
      ),
      role: resolvePlayerClassText(
        "player_classes.industrialist_role",
        translateText("player_classes.industrialist_role"),
      ),
      color: "#f59e0b",
      badgeClasses: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      buffs: [
        resolvePlayerClassText(
          "player_classes.industrialist_buff_1",
          translateText("player_classes.industrialist_buff_1"),
        ),
        resolvePlayerClassText(
          "player_classes.industrialist_buff_2",
          translateText("player_classes.industrialist_buff_2"),
        ),
      ],
      debuffs: [
        resolvePlayerClassText(
          "player_classes.industrialist_debuff_1",
          translateText("player_classes.industrialist_debuff_1"),
        ),
        resolvePlayerClassText(
          "player_classes.industrialist_debuff_2",
          translateText("player_classes.industrialist_debuff_2"),
        ),
      ],
      icon: (css = "w-4 h-4") => html`<svg
        class="${css} shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"
        />
        <path d="M17 18h1" />
        <path d="M12 18h1" />
        <path d="M7 18h1" />
      </svg>`,
    },
    {
      id: PlayerClass.Infantry,
      name: resolvePlayerClassText(
        "player_classes.infantry_name",
        translateText("player_classes.infantry_name"),
      ),
      role: resolvePlayerClassText(
        "player_classes.infantry_role",
        translateText("player_classes.infantry_role"),
      ),
      color: "#ef4444",
      badgeClasses: "bg-red-500/15 text-red-300 border-red-500/30",
      buffs: [
        resolvePlayerClassText(
          "player_classes.infantry_buff_1",
          translateText("player_classes.infantry_buff_1"),
        ),
        resolvePlayerClassText(
          "player_classes.infantry_buff_2",
          translateText("player_classes.infantry_buff_2"),
        ),
      ],
      debuffs: [
        resolvePlayerClassText(
          "player_classes.infantry_debuff_1",
          translateText("player_classes.infantry_debuff_1"),
        ),
        resolvePlayerClassText(
          "player_classes.infantry_debuff_2",
          translateText("player_classes.infantry_debuff_2"),
        ),
        resolvePlayerClassText(
          "player_classes.infantry_debuff_3",
          translateText("player_classes.infantry_debuff_3"),
        ),
      ],
      icon: (css = "w-4 h-4") => html`<svg
        class="${css} shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
        <line x1="13" y1="19" x2="19" y2="13" />
        <line x1="16" y1="16" x2="20" y2="20" />
        <line x1="19" y1="21" x2="21" y2="19" />
        <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
        <line x1="5" y1="14" x2="9" y2="18" />
        <line x1="7" y1="17" x2="4" y2="20" />
        <line x1="3" y1="19" x2="5" y2="21" />
      </svg>`,
    },
    {
      id: PlayerClass.Marine,
      name: resolvePlayerClassText(
        "player_classes.marine_name",
        translateText("player_classes.marine_name"),
      ),
      role: resolvePlayerClassText(
        "player_classes.marine_role",
        translateText("player_classes.marine_role"),
      ),
      color: "#0ea5e9",
      badgeClasses: "bg-sky-500/15 text-sky-300 border-sky-500/30",
      buffs: [
        resolvePlayerClassText(
          "player_classes.marine_buff_1",
          translateText("player_classes.marine_buff_1"),
        ),
        resolvePlayerClassText(
          "player_classes.marine_buff_2",
          translateText("player_classes.marine_buff_2"),
        ),
        resolvePlayerClassText(
          "player_classes.marine_buff_3",
          translateText("player_classes.marine_buff_3"),
        ),
      ],
      debuffs: [
        resolvePlayerClassText(
          "player_classes.marine_debuff_1",
          translateText("player_classes.marine_debuff_1"),
        ),
        resolvePlayerClassText(
          "player_classes.marine_debuff_2",
          translateText("player_classes.marine_debuff_2"),
        ),
      ],
      icon: (css = "w-4 h-4") => html`<svg
        class="${css} shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="5" r="3" />
        <line x1="12" y1="22" x2="12" y2="8" />
        <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
      </svg>`,
    },
    {
      id: PlayerClass.IronDome,
      name: resolvePlayerClassText(
        "player_classes.iron_dome_name",
        translateText("player_classes.iron_dome_name"),
      ),
      role: resolvePlayerClassText(
        "player_classes.iron_dome_role",
        translateText("player_classes.iron_dome_role"),
      ),
      color: "#10b981",
      badgeClasses: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      buffs: [
        resolvePlayerClassText(
          "player_classes.iron_dome_buff_1",
          translateText("player_classes.iron_dome_buff_1"),
        ),
        resolvePlayerClassText(
          "player_classes.iron_dome_buff_2",
          translateText("player_classes.iron_dome_buff_2"),
        ),
        resolvePlayerClassText(
          "player_classes.iron_dome_buff_3",
          translateText("player_classes.iron_dome_buff_3"),
        ),
      ],
      debuffs: [
        resolvePlayerClassText(
          "player_classes.iron_dome_debuff_1",
          translateText("player_classes.iron_dome_debuff_1"),
        ),
        resolvePlayerClassText(
          "player_classes.iron_dome_debuff_2",
          translateText("player_classes.iron_dome_debuff_2"),
        ),
        resolvePlayerClassText(
          "player_classes.iron_dome_debuff_3",
          translateText("player_classes.iron_dome_debuff_3"),
        ),
      ],
      icon: (css = "w-4 h-4") => html`<svg
        class="${css} shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>`,
    },
    {
      id: PlayerClass.Scientist,
      name: resolvePlayerClassText(
        "player_classes.scientist_name",
        translateText("player_classes.scientist_name"),
      ),
      role: resolvePlayerClassText(
        "player_classes.scientist_role",
        translateText("player_classes.scientist_role"),
      ),
      color: "#a855f7",
      badgeClasses: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      buffs: [
        resolvePlayerClassText(
          "player_classes.scientist_buff_1",
          translateText("player_classes.scientist_buff_1"),
        ),
        resolvePlayerClassText(
          "player_classes.scientist_buff_2",
          translateText("player_classes.scientist_buff_2"),
        ),
        resolvePlayerClassText(
          "player_classes.scientist_buff_3",
          translateText("player_classes.scientist_buff_3"),
        ),
      ],
      debuffs: [
        resolvePlayerClassText(
          "player_classes.scientist_debuff_1",
          translateText("player_classes.scientist_debuff_1"),
        ),
        resolvePlayerClassText(
          "player_classes.scientist_debuff_2",
          translateText("player_classes.scientist_debuff_2"),
        ),
      ],
      icon: (css = "w-4 h-4") => html`<svg
        class="${css} shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M3.5 12a8.5 8.5 0 0 1 17 0c0 4.69-3.81 8.5-8.5 8.5a8.5 8.5 0 0 1-8.5-8.5"
        />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)" />
      </svg>`,
    },
  ];
}

export function getPlayerClassMeta(cls?: PlayerClass): PlayerClassMeta {
  const classes = getAllPlayerClasses();
  return (
    classes.find((c) => c.id === cls) ?? classes[0] // fallback to Industrialist
  );
}

export function renderPlayerClassBadge(
  cls?: PlayerClass,
  options: { showName?: boolean; size?: "xs" | "sm" | "md" } = {},
): TemplateResult {
  const meta = getPlayerClassMeta(cls ?? PlayerClass.Industrialist);
  const showName = options.showName ?? true;
  const size = options.size ?? "sm";
  const iconSize =
    size === "xs" ? "w-3 h-3" : size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const textSize =
    size === "xs" ? "text-[10px]" : size === "sm" ? "text-[11px]" : "text-xs";
  const padding = size === "xs" ? "px-1.5 py-0.5" : "px-2 py-0.5";

  return html`
    <span
      class="inline-flex items-center gap-1.5 ${padding} rounded-md border font-semibold select-none ${textSize} ${meta.badgeClasses}"
      title="${meta.name}: ${meta.role}"
    >
      ${meta.icon(iconSize)}
      ${showName ? html`<span class="tracking-tight">${meta.name}</span>` : ""}
    </span>
  `;
}
