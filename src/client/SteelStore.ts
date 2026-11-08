import Countries from "resources/countries.json" with { type: "json" };
import { getApiBase, getUserMe } from "./Api";

export interface SteelItem {
  id: string;
  category: "titel" | "badges" | "skins" | "sounds" | "flags";
  name: string;
  description: string;
  cost: number;
  icon: string;
  previewColor?: string;
}

export const STEEL_CATALOG: SteelItem[] = [
  // --- TITEL ---
  {
    id: "title:stahlbaron",
    category: "titel",
    name: "Stahlbaron",
    description: "Herrscher über die Hochöfen und gigantischen Panzerwerke.",
    cost: 1000,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-amber-400"><path d="M2 20h20M6 20V10l6 4V10l6 4V4h4v16"/></svg>`,
  },
  {
    id: "title:front_veteran",
    category: "titel",
    name: "Front-Veteran",
    description: "Erfahrener Kämpfer aus zahllosen siegreichen Schlachten.",
    cost: 750,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-yellow-400"><circle cx="12" cy="15" r="6"/><path d="M8.21 13.89 7 2l5 3 5-3-1.21 11.89"/></svg>`,
  },
  {
    id: "title:panzer_general",
    category: "titel",
    name: "Panzer-General",
    description: "Meister der gepanzerten Durchbrüche und Stoßtrupps.",
    cost: 1500,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-cyan-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  },
  {
    id: "title:industrie_pionier",
    category: "titel",
    name: "Industrie-Pionier",
    description: "Erbauer moderner Bergwerke, Eisenbahnen und Raffinerien.",
    cost: 500,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-amber-300"><path d="m14 10-8.5 8.5a2.12 2.12 0 1 0 3 3L17 13"/><path d="m21.5 7.5-6-6a1 1 0 0 0-1.4 0l-1.4 1.4a1 1 0 0 0 0 1.4l1.6 1.6-8.8 8.8a1 1 0 0 0 0 1.4l2.8 2.8a1 1 0 0 0 1.4 0l8.8-8.8 1.6 1.6a1 1 0 0 0 1.4 0l1.4-1.4a1 1 0 0 0 0-1.4z"/></svg>`,
  },
  {
    id: "title:wirtschafts_gigant",
    category: "titel",
    name: "Wirtschafts-Gigant",
    description: "Unermesslicher Reichtum und unaufhaltsame Ressourcenmacht.",
    cost: 2000,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-emerald-400"><path d="m3 3 18 18M18 17V9M13 17V5M8 17v-3"/></svg>`,
  },
  {
    id: "title:unbesiegbar",
    category: "titel",
    name: "Unbesiegbar",
    description: "Prestige-Titel für die wahrhaft ungeschlagenen Legenden.",
    cost: 3000,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-yellow-300"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5z"/></svg>`,
  },

  // --- BADGES ---
  {
    id: "badge:stahl_krone",
    category: "badges",
    name: "Stahl-Krone",
    description: "Königliches Wappen aus hochfestem Panzerstahl.",
    cost: 800,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-slate-300"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    previewColor: "#cbd5e1",
  },
  {
    id: "badge:nuklear_schild",
    category: "badges",
    name: "Nuklear-Schild",
    description: "Bunkerfeste Verteidigung gegen jede Art von Vernichtung.",
    cost: 1500,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-yellow-400"><circle cx="12" cy="12" r="2"/><path d="M12 2v6M4.93 6.93l4.24 4.24M2 12h6M6.93 19.07l4.24-4.24M12 22v-6M19.07 17.07l-4.24-4.24M22 12h-6M17.07 4.93l-4.24 4.24"/></svg>`,
    previewColor: "#facc15",
  },
  {
    id: "badge:stern_front",
    category: "badges",
    name: "Stern der Front",
    description: "Strahlender Stern für herausragende Verdienste im Feld.",
    cost: 2500,
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-sky-400"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    previewColor: "#38bdf8",
  },
  {
    id: "badge:schmelztiegel",
    category: "badges",
    name: "Schmelztiegel-Held",
    description: "Im sengenden Feuer der Schwerindustrie geschmiedet.",
    cost: 1000,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-orange-500"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-1.88-1.5-3.5-3.5-5.5-2 2-3.5 3.62-3.5 5.5Z"/><path d="M12 2c5.52 6 8 9.5 8 13a8 8 0 0 1-16 0c0-3.5 2.48-7 8-13Z"/></svg>`,
    previewColor: "#f97316",
  },

  // --- SKINS / CAMO ---
  {
    id: "skin:wuestenfuchs",
    category: "skins",
    name: "Wüstenfuchs Tarnung",
    description: "Sandig-matte Wüstentarnung für Panzer und Befestigungen.",
    cost: 600,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-amber-500"><circle cx="18" cy="6" r="3"/><path d="M2 20c3-3 7-4 10-1s7 2 10-1"/></svg>`,
    previewColor: "#d97706",
  },
  {
    id: "skin:arktis",
    category: "skins",
    name: "Arktis-Panzerung",
    description: "Kaltes Eisblau und Schnee-Camo für kalte Regionen.",
    cost: 900,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-sky-300"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14"/></svg>`,
    previewColor: "#38bdf8",
  },
  {
    id: "skin:nachtjaeger",
    category: "skins",
    name: "Nachtjäger Camo",
    description: "Tiefschwarze Legierung mit dezent leuchtenden Akzenten.",
    cost: 1400,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-indigo-400"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
    previewColor: "#6366f1",
  },
  {
    id: "skin:goldener_sturm",
    category: "skins",
    name: "Goldenes Gefecht",
    description: "Prunkvoller Goldschimmer für dominierende Feldherren.",
    cost: 2000,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-yellow-400"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
    previewColor: "#eab308",
  },

  // --- CUSTOM SOUNDS ---
  {
    id: "sound:siegesfanfare",
    category: "sounds",
    name: "Epische Siegesfanfare",
    description: "Triumphaler Fanfarenklang beim Rundenabschluss.",
    cost: 800,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-amber-400"><path d="M3 11v3a1 1 0 0 0 1 1h7l8 5V4L11 9H4a1 1 0 0 0-1 1zM21 8v8"/></svg>`,
  },
  {
    id: "sound:fliegeralarm",
    category: "sounds",
    name: "Fliegeralarm Sirene",
    description: "Einschüchterndes Heulen bei ankommenden Raketenangriffen.",
    cost: 600,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-red-500"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/></svg>`,
  },
  {
    id: "sound:geschuetz",
    category: "sounds",
    name: "Schweres Geschütz-Echo",
    description: "Wuchtiger Bass-Donner bei Artillerie- und Bombentreffern.",
    cost: 700,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-orange-400"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  },
  {
    id: "sound:trommelwirbel",
    category: "sounds",
    name: "Trommelwirbel der Front",
    description: "Rhythmischer Militärmarsch zum Beginn des Großangriffs.",
    cost: 900,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-red-400"><ellipse cx="12" cy="8" rx="8" ry="4"/><path d="M4 8v8c0 2.21 3.58 4 8 4s8-1.79 8-4V8"/></svg>`,
  },
];

// All non-country flags from countries.json cost 5000 Steel
export const SPECIAL_FLAG_ITEMS: SteelItem[] = Countries.filter(
  (c) => c.code.length !== 2 && c.code !== "xx" && !c.restricted,
).map((c) => ({
  id: `country:${c.code}`,
  category: "flags" as const,
  name: c.name,
  description: `Spezielle Flagge für Profil & Territorium (${c.name}).`,
  cost: 5000,
  icon: `/flags/${c.code}.svg`,
}));

export function getAllSteelCatalog(): SteelItem[] {
  return [...STEEL_CATALOG, ...SPECIAL_FLAG_ITEMS];
}

export function calculateSteelReward(placement: number): number {
  switch (placement) {
    case 1:
      return 1000;
    case 2:
      return 750;
    case 3:
      return 500;
    case 4:
      return 350;
    case 5:
      return 200;
    default:
      if (placement <= 10) return 100;
      return 50;
  }
}

const LOCAL_STORAGE_KEY_BALANCE = "indufront_steel_balance";
const LOCAL_STORAGE_KEY_UNLOCKED = "indufront_steel_unlocked";
const LOCAL_STORAGE_KEY_EQUIPPED = "indufront_steel_equipped";

export class SteelStoreService {
  private static listeners = new Set<() => void>();

  public static subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private static notify(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (e) {
        console.error("SteelStore listener error", e);
      }
    }
    window.dispatchEvent(new CustomEvent("indufront_steel_updated"));
  }

  public static getBalance(): number {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_BALANCE);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    // Initialer Willkommens-Bonus für alle Spieler
    return 500;
  }

  public static setBalance(val: number): void {
    localStorage.setItem(
      LOCAL_STORAGE_KEY_BALANCE,
      String(Math.max(0, Math.floor(val))),
    );
    this.notify();
  }

  public static award(amount: number, placement: number = 1): number {
    const current = this.getBalance();
    const updated = current + amount;
    this.setBalance(updated);

    // Sync mit Server im Hintergrund falls eingeloggt
    void (async () => {
      try {
        const me = await getUserMe();
        if (me && me.player) {
          await fetch(`${getApiBase()}/api/steel/award`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publicId: me.player.publicId,
              username: me.player.username,
              placement,
              amount,
            }),
          });
        }
      } catch {
        /* ignore offline sync */
      }
    })();

    return updated;
  }

  public static getUnlockedIds(): Set<string> {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_UNLOCKED);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {
      /* ignore */
    }
    return new Set<string>();
  }

  public static isUnlocked(id: string): boolean {
    const unlocked = this.getUnlockedIds();
    return (
      unlocked.has(id) ||
      (id.startsWith("country:") &&
        unlocked.has(id.replace("country:", "flag:"))) ||
      (id.startsWith("flag:") && unlocked.has(id.replace("flag:", "country:")))
    );
  }

  public static unlock(id: string): void {
    const unlocked = this.getUnlockedIds();
    unlocked.add(id);
    if (id.startsWith("country:")) {
      unlocked.add(id.replace("country:", "flag:"));
    } else if (id.startsWith("flag:")) {
      unlocked.add(id.replace("flag:", "country:"));
    }
    localStorage.setItem(
      LOCAL_STORAGE_KEY_UNLOCKED,
      JSON.stringify(Array.from(unlocked)),
    );
    this.notify();
  }

  public static buyItem(item: SteelItem): { success: boolean; error?: string } {
    if (this.isUnlocked(item.id)) {
      return { success: false, error: "Bereits im Besitz" };
    }
    const balance = this.getBalance();
    if (balance < item.cost) {
      return {
        success: false,
        error: `Nicht genug Stahl! Benötigt: ${item.cost}, Guthaben: ${balance}`,
      };
    }

    this.setBalance(balance - item.cost);
    this.unlock(item.id);

    // Automatisch ausrüsten
    this.equip(item.category, item.id);

    // Sync mit Server im Hintergrund
    void (async () => {
      try {
        const me = await getUserMe();
        if (me && me.player) {
          await fetch(`${getApiBase()}/api/steel/buy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publicId: me.player.publicId,
              itemId: item.id,
              cost: item.cost,
            }),
          });
        }
      } catch {
        /* ignore offline sync */
      }
    })();

    return { success: true };
  }

  public static getEquipped(): Record<string, string> {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_EQUIPPED);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return {};
  }

  public static equip(category: string, id: string): void {
    const equipped = this.getEquipped();
    equipped[category] = id;
    localStorage.setItem(LOCAL_STORAGE_KEY_EQUIPPED, JSON.stringify(equipped));

    if (category === "flags") {
      try {
        localStorage.setItem("user_settings:flag", id);
        window.dispatchEvent(
          new CustomEvent("user_settings_changed:flag", { detail: id }),
        );
      } catch {
        /* ignore */
      }
    }

    this.notify();
  }
}

export const SteelStore = SteelStoreService;
