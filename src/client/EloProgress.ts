export interface ClientEloTierDetails {
  tier: string;
  division: "I" | "II" | "III" | "IV" | "";
  minElo: number;
  maxElo: number;
  progressPercent: number;
  color: string;
  label: string;
}

export function getClientEloTierDetails(elo: number): ClientEloTierDetails {
  const safeElo = Math.max(0, Math.round(elo));
  const tiers = [
    { tier: "Champion", min: 2400, max: 3500, color: "#f472b6" },
    { tier: "Grandmaster", min: 2000, max: 2400, color: "#ff6b81" },
    { tier: "Master", min: 1800, max: 2000, color: "#c48cff" },
    { tier: "Diamant", min: 1600, max: 1800, color: "#a5e7ff" },
    { tier: "Platin", min: 1400, max: 1600, color: "#9fe3dc" },
    { tier: "Gold", min: 1200, max: 1400, color: "#f2c230" },
    { tier: "Silber", min: 1000, max: 1200, color: "#c3cbd6" },
    { tier: "Bronze", min: 800, max: 1000, color: "#c27c3e" },
    { tier: "Eisen", min: 0, max: 800, color: "#6b7280" },
  ];

  for (const t of tiers) {
    if (safeElo >= t.min) {
      if (t.tier === "Champion") {
        const progress = Math.min(
          100,
          Math.round(((safeElo - 2400) / 600) * 100),
        );
        return {
          tier: "Champion",
          division: "",
          minElo: 2400,
          maxElo: 3500,
          progressPercent: progress,
          color: t.color,
          label: "Champion",
        };
      }
      const tierSpan = t.max - t.min;
      const divisionSpan = tierSpan / 4;
      const offsetInTier = safeElo - t.min;
      const divisionIdx = Math.min(3, Math.floor(offsetInTier / divisionSpan));
      const divisions = ["IV", "III", "II", "I"] as const;
      const division = divisions[divisionIdx];
      const offsetInDivision = offsetInTier - divisionIdx * divisionSpan;
      const progressPercent = Math.min(
        100,
        Math.max(0, Math.round((offsetInDivision / divisionSpan) * 100)),
      );

      return {
        tier: t.tier,
        division,
        minElo: t.min,
        maxElo: t.max,
        progressPercent,
        color: t.color,
        label: `${t.tier} ${division}`,
      };
    }
  }

  return {
    tier: "Eisen",
    division: "IV",
    minElo: 0,
    maxElo: 800,
    progressPercent: 0,
    color: "#6b7280",
    label: "Eisen IV",
  };
}
