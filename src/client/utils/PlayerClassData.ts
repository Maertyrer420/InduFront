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

export function getAllPlayerClasses(): PlayerClassMeta[] {
  return [
    {
      id: PlayerClass.Industrialist,
      name: translateText("player_classes.industrialist_name"),
      role: translateText("player_classes.industrialist_role"),
      color: "#f59e0b",
      badgeClasses: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      buffs: [
        translateText("player_classes.industrialist_buff_1"),
        translateText("player_classes.industrialist_buff_2"),
      ],
      debuffs: [
        translateText("player_classes.industrialist_debuff_1"),
        translateText("player_classes.industrialist_debuff_2"),
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
      name: translateText("player_classes.infantry_name"),
      role: translateText("player_classes.infantry_role"),
      color: "#ef4444",
      badgeClasses: "bg-red-500/15 text-red-300 border-red-500/30",
      buffs: [
        translateText("player_classes.infantry_buff_1"),
        translateText("player_classes.infantry_buff_2"),
      ],
      debuffs: [
        translateText("player_classes.infantry_debuff_1"),
        translateText("player_classes.infantry_debuff_2"),
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
      name: translateText("player_classes.marine_name"),
      role: translateText("player_classes.marine_role"),
      color: "#0ea5e9",
      badgeClasses: "bg-sky-500/15 text-sky-300 border-sky-500/30",
      buffs: [
        translateText("player_classes.marine_buff_1"),
        translateText("player_classes.marine_buff_2"),
        translateText("player_classes.marine_buff_3"),
      ],
      debuffs: [
        translateText("player_classes.marine_debuff_1"),
        translateText("player_classes.marine_debuff_2"),
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
      name: translateText("player_classes.iron_dome_name"),
      role: translateText("player_classes.iron_dome_role"),
      color: "#10b981",
      badgeClasses: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      buffs: [
        translateText("player_classes.iron_dome_buff_1"),
        translateText("player_classes.iron_dome_buff_2"),
        translateText("player_classes.iron_dome_buff_3"),
      ],
      debuffs: [
        translateText("player_classes.iron_dome_debuff_1"),
        translateText("player_classes.iron_dome_debuff_2"),
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
      name: translateText("player_classes.scientist_name"),
      role: translateText("player_classes.scientist_role"),
      color: "#a855f7",
      badgeClasses: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      buffs: [
        translateText("player_classes.scientist_buff_1"),
        translateText("player_classes.scientist_buff_2"),
        translateText("player_classes.scientist_buff_3"),
      ],
      debuffs: [
        translateText("player_classes.scientist_debuff_1"),
        translateText("player_classes.scientist_debuff_2"),
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
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4"
          transform="rotate(-30 12 12)"
        />
      </svg>`,
    },
  ];
}

export function getPlayerClassMeta(cls?: PlayerClass): PlayerClassMeta {
  const classes = getAllPlayerClasses();
  return (
    classes.find((c) => c.id === cls) ??
    classes[0] // fallback to Industrialist
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
    size === "xs"
      ? "text-[10px]"
      : size === "sm"
        ? "text-[11px]"
        : "text-xs";
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
