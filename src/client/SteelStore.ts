import { getApiBase, getUserMe } from "./Api";

export interface SteelItem {
  id: string;
  category: "titel" | "badges" | "skins" | "sounds";
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
    icon: "🏭",
  },
  {
    id: "title:front_veteran",
    category: "titel",
    name: "Front-Veteran",
    description: "Erfahrener Kämpfer aus zahllosen siegreichen Schlachten.",
    cost: 750,
    icon: "🎖️",
  },
  {
    id: "title:panzer_general",
    category: "titel",
    name: "Panzer-General",
    description: "Meister der gepanzerten Durchbrüche und Stoßtrupps.",
    cost: 1500,
    icon: "🛡️",
  },
  {
    id: "title:industrie_pionier",
    category: "titel",
    name: "Industrie-Pionier",
    description: "Erbauer moderner Bergwerke, Eisenbahnen und Raffinerien.",
    cost: 500,
    icon: "⛏️",
  },
  {
    id: "title:wirtschafts_gigant",
    category: "titel",
    name: "Wirtschafts-Gigant",
    description: "Unermesslicher Reichtum und unaufhaltsame Ressourcenmacht.",
    cost: 2000,
    icon: "📈",
  },
  {
    id: "title:unbesiegbar",
    category: "titel",
    name: "Unbesiegbar",
    description: "Prestige-Titel für die wahrhaft ungeschlagenen Legenden.",
    cost: 3000,
    icon: "👑",
  },

  // --- BADGES ---
  {
    id: "badge:stahl_krone",
    category: "badges",
    name: "Stahl-Krone",
    description: "Königliches Wappen aus hochfestem Panzerstahl.",
    cost: 800,
    icon: "⚙️",
    previewColor: "#cbd5e1",
  },
  {
    id: "badge:nuklear_schild",
    category: "badges",
    name: "Nuklear-Schild",
    description: "Bunkerfeste Verteidigung gegen jede Art von Vernichtung.",
    cost: 1500,
    icon: "☢️",
    previewColor: "#facc15",
  },
  {
    id: "badge:stern_front",
    category: "badges",
    name: "Stern der Front",
    description: "Strahlender Stern für herausragende Verdienste im Feld.",
    cost: 2500,
    icon: "⭐",
    previewColor: "#38bdf8",
  },
  {
    id: "badge:schmelztiegel",
    category: "badges",
    name: "Schmelztiegel-Held",
    description: "Im sengenden Feuer der Schwerindustrie geschmiedet.",
    cost: 1000,
    icon: "🔥",
    previewColor: "#f97316",
  },

  // --- SKINS / CAMO ---
  {
    id: "skin:wuestenfuchs",
    category: "skins",
    name: "Wüstenfuchs Tarnung",
    description: "Sandig-matte Wüstentarnung für Panzer und Befestigungen.",
    cost: 600,
    icon: "🏜️",
    previewColor: "#d97706",
  },
  {
    id: "skin:arktis",
    category: "skins",
    name: "Arktis-Panzerung",
    description: "Kaltes Eisblau und Schnee-Camo für kalte Regionen.",
    cost: 900,
    icon: "❄️",
    previewColor: "#38bdf8",
  },
  {
    id: "skin:nachtjaeger",
    category: "skins",
    name: "Nachtjäger Camo",
    description: "Tiefschwarze Legierung mit dezent leuchtenden Akzenten.",
    cost: 1400,
    icon: "🌑",
    previewColor: "#6366f1",
  },
  {
    id: "skin:goldener_sturm",
    category: "skins",
    name: "Goldenes Gefecht",
    description: "Prunkvoller Goldschimmer für dominierende Feldherren.",
    cost: 2000,
    icon: "✨",
    previewColor: "#eab308",
  },

  // --- CUSTOM SOUNDS ---
  {
    id: "sound:siegesfanfare",
    category: "sounds",
    name: "Epische Siegesfanfare",
    description: "Triumphaler Fanfarenklang beim Rundenabschluss.",
    cost: 800,
    icon: "🎺",
  },
  {
    id: "sound:fliegeralarm",
    category: "sounds",
    name: "Fliegeralarm Sirene",
    description: "Einschüchterndes Heulen bei ankommenden Raketenangriffen.",
    cost: 600,
    icon: "🚨",
  },
  {
    id: "sound:geschuetz",
    category: "sounds",
    name: "Schweres Geschütz-Echo",
    description: "Wuchtiger Bass-Donner bei Artillerie- und Bombentreffern.",
    cost: 700,
    icon: "💥",
  },
  {
    id: "sound:trommelwirbel",
    category: "sounds",
    name: "Trommelwirbel der Front",
    description: "Rhythmischer Militärmarsch zum Beginn des Großangriffs.",
    cost: 900,
    icon: "🥁",
  },
];

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
    return this.getUnlockedIds().has(id);
  }

  public static unlock(id: string): void {
    const unlocked = this.getUnlockedIds();
    unlocked.add(id);
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
    this.notify();
  }
}
