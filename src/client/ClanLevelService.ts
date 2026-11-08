import { SteelStoreService } from "./SteelStore";

export interface ClanLevelData {
  level: number;
  steelProgress: number;
  steelDonated: number;
  nextCost: number;
  maxMembers: number;
}

const STORAGE_KEY_CLAN_LEVELS = "indufront_clan_levels";

// Pre-seeded initial levels for notable clans to populate leaderboards realistically
const INITIAL_SEED: Record<string, { level: number; progress: number }> = {
  DEV: { level: 5, progress: 1200 },
  GER: { level: 4, progress: 850 },
  USA: { level: 4, progress: 400 },
  NATO: { level: 3, progress: 900 },
  POL: { level: 3, progress: 150 },
  FRA: { level: 2, progress: 600 },
};

export class ClanLevelService {
  private static listeners = new Set<() => void>();

  public static getNextLevelCost(level: number): number {
    const safeLevel = Math.max(1, Math.floor(level));
    return 1000 * Math.pow(2, safeLevel - 1);
  }

  public static getMaxMembers(level: number): number {
    const safeLevel = Math.max(1, Math.floor(level));
    return 30 + (safeLevel - 1);
  }

  private static getAllLevels(): Record<
    string,
    { level: number; steelProgress: number; steelDonated: number }
  > {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CLAN_LEVELS);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore JSON parse error
    }

    // Initialize with seed
    const initial: Record<
      string,
      { level: number; steelProgress: number; steelDonated: number }
    > = {};
    for (const [tag, data] of Object.entries(INITIAL_SEED)) {
      initial[tag.toUpperCase()] = {
        level: data.level,
        steelProgress: data.progress,
        steelDonated: data.progress,
      };
    }
    this.saveAllLevels(initial);
    return initial;
  }

  private static saveAllLevels(
    data: Record<
      string,
      { level: number; steelProgress: number; steelDonated: number }
    >,
  ): void {
    try {
      localStorage.setItem(STORAGE_KEY_CLAN_LEVELS, JSON.stringify(data));
    } catch {
      // storage unavailable
    }
  }

  public static getClanLevelData(tag: string): ClanLevelData {
    if (!tag) {
      return {
        level: 1,
        steelProgress: 0,
        steelDonated: 0,
        nextCost: 1000,
        maxMembers: 30,
      };
    }

    const normTag = tag.toUpperCase().trim();
    const all = this.getAllLevels();
    const entry = all[normTag] ?? {
      level: 1,
      steelProgress: 0,
      steelDonated: 0,
    };
    const level = Math.max(1, entry.level || 1);
    const steelProgress = Math.max(0, entry.steelProgress || 0);
    const steelDonated = Math.max(0, entry.steelDonated || 0);

    return {
      level,
      steelProgress,
      steelDonated,
      nextCost: this.getNextLevelCost(level),
      maxMembers: this.getMaxMembers(level),
    };
  }

  public static donateSteel(
    tag: string,
    amount: number,
  ): { success: boolean; newLevel: number; error?: string } {
    if (!tag)
      return { success: false, newLevel: 1, error: "Ungültiger Clan-Tag" };
    const donateAmount = Math.floor(amount);
    if (donateAmount <= 0) {
      return {
        success: false,
        newLevel: 1,
        error: "Spendenbetrag muss größer als 0 sein",
      };
    }

    const currentBalance = SteelStoreService.getBalance();
    if (currentBalance < donateAmount) {
      const isEn = (document.documentElement.lang || navigator.language || "en")
        .toLowerCase()
        .startsWith("en");
      return {
        success: false,
        newLevel: 1,
        error: isEn
          ? `Not enough Steel! Balance: ${currentBalance}, Required: ${donateAmount}`
          : `Nicht genug Stahl! Guthaben: ${currentBalance}, Benötigt: ${donateAmount}`,
      };
    }

    // Deduct player balance
    SteelStoreService.setBalance(currentBalance - donateAmount);

    const normTag = tag.toUpperCase().trim();
    const all = this.getAllLevels();
    const entry = all[normTag] ?? {
      level: 1,
      steelProgress: 0,
      steelDonated: 0,
    };

    let level = Math.max(1, entry.level || 1);
    let steelProgress = Math.max(0, entry.steelProgress || 0) + donateAmount;
    const steelDonated = Math.max(0, entry.steelDonated || 0) + donateAmount;

    let nextCost = this.getNextLevelCost(level);
    while (steelProgress >= nextCost) {
      steelProgress -= nextCost;
      level += 1;
      nextCost = this.getNextLevelCost(level);
    }

    all[normTag] = {
      level,
      steelProgress,
      steelDonated,
    };
    this.saveAllLevels(all);
    this.notify();

    return { success: true, newLevel: level };
  }

  public static subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private static notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error("ClanLevelService listener error", e);
      }
    }
    window.dispatchEvent(new CustomEvent("indufront_clan_level_updated"));
  }
}
