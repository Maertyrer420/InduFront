/**
 * Elo rating and tier progression calculation engine.
 * Supports:
 * - 1v1 duels with dynamic K-factors (placement phase, calibrated, veteran, master)
 * - 2v2 team matchmaking with team average rating and performance adjustments
 * - Multi-player FFA with pairwise zero-sum Elo distributions
 * - Tier divisions (Eisen, Bronze, Silber, Gold, Platin, Diamant, Master, Grandmaster, Champion, Top 10)
 */

export interface EloParticipant {
  publicId: string;
  currentElo: number;
  gamesPlayed: number;
  placement: number; // 1 = winner, 2 = 2nd, etc.
  teamIndex?: number;
  kills?: number;
  territory?: number;
}

export interface EloTierDetails {
  tier: string;
  division: "I" | "II" | "III" | "IV" | "";
  minElo: number;
  maxElo: number;
  progressPercent: number;
  tierColor: string;
  label: string;
}

export const TIER_THRESHOLDS = [
  { tier: "Champion", min: 2400, max: 3500, color: "#f472b6" },
  { tier: "Grandmaster", min: 2000, max: 2400, color: "#ff6b81" },
  { tier: "Master", min: 1800, max: 2000, color: "#c48cff" },
  { tier: "Diamant", min: 1600, max: 1800, color: "#a5e7ff" },
  { tier: "Platin", min: 1400, max: 1600, color: "#9fe3dc" },
  { tier: "Gold", min: 1200, max: 1400, color: "#f2c230" },
  { tier: "Silber", min: 1000, max: 1200, color: "#c3cbd6" },
  { tier: "Bronze", min: 800, max: 1000, color: "#c27c3e" },
  { tier: "Eisen", min: 0, max: 800, color: "#6b7280" },
] as const;

/**
 * Returns tier name from Elo rating and optional leaderboard rank.
 */
export function getEloTier(elo: number, rank?: number): string {
  if (rank !== undefined && rank <= 10 && rank > 0) return "Top 10";
  for (const t of TIER_THRESHOLDS) {
    if (elo >= t.min) return t.tier;
  }
  return "Eisen";
}

/**
 * Returns detailed tier, division (IV, III, II, I) and percentage progress to next tier/division.
 */
export function getEloTierDetails(elo: number, rank?: number): EloTierDetails {
  const safeElo = Math.max(0, Math.round(elo));
  if (rank !== undefined && rank <= 10 && rank > 0) {
    return {
      tier: "Top 10",
      division: "",
      minElo: 2400,
      maxElo: 3500,
      progressPercent: 100,
      tierColor: "#ef4444",
      label: `Top 10 (#${rank})`,
    };
  }

  for (const t of TIER_THRESHOLDS) {
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
          tierColor: t.color,
          label: "Champion",
        };
      }

      const tierSpan = t.max - t.min;
      const divisionSpan = tierSpan / 4;
      const offsetInTier = safeElo - t.min;
      const divisionIdx = Math.min(3, Math.floor(offsetInTier / divisionSpan));
      // Division IV is lowest in tier, Division I is highest
      const divisions: ("IV" | "III" | "II" | "I")[] = ["IV", "III", "II", "I"];
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
        tierColor: t.color,
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
    tierColor: "#6b7280",
    label: "Eisen IV",
  };
}

/**
 * Dynamic K-Factor:
 * - First 10 placement games: K = 48 (rapid calibration, anti-smurf)
 * - Standard rating (< 1400): K = 32
 * - High rating (1400 - 1800): K = 28
 * - Master (1800 - 2200): K = 24
 * - Grandmaster / Champion (> 2200): K = 16 (high precision)
 */
export function getKFactor(gamesPlayed: number, elo: number): number {
  if (gamesPlayed < 10) return 48;
  if (elo >= 2200) return 16;
  if (elo >= 1800) return 24;
  if (elo >= 1400) return 28;
  return 32;
}

/**
 * Expected win score for player with rating `playerElo` against `opponentElo`.
 */
export function calculateExpectedScore(
  playerElo: number,
  opponentElo: number,
): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Calculates 1v1 Elo adjustments.
 */
export function calculate1v1Elo(
  player1: EloParticipant,
  player2: EloParticipant,
): { p1Change: number; p2Change: number } {
  const e1 = calculateExpectedScore(player1.currentElo, player2.currentElo);
  const e2 = 1 - e1;

  const s1 =
    player1.placement < player2.placement
      ? 1
      : player1.placement === player2.placement
        ? 0.5
        : 0;
  const s2 = 1 - s1;

  const k1 = getKFactor(player1.gamesPlayed, player1.currentElo);
  const k2 = getKFactor(player2.gamesPlayed, player2.currentElo);

  let p1Change = Math.round(k1 * (s1 - e1));
  let p2Change = Math.round(k2 * (s2 - e2));

  // Guarantee minimum delta of +/-1 for non-draw matches
  if (s1 === 1 && p1Change <= 0) p1Change = 1;
  if (s2 === 1 && p2Change <= 0) p2Change = 1;
  if (s1 === 0 && p1Change >= 0) p1Change = -1;
  if (s2 === 0 && p2Change >= 0) p2Change = -1;

  return { p1Change, p2Change };
}

/**
 * Multi-player FFA Elo using pairwise comparison model.
 * Each participant is evaluated against every other opponent in the match.
 * Sum of raw deltas across the match remains roughly zero-sum.
 */
export function calculateFfaElo(
  participants: EloParticipant[],
): Map<string, number> {
  const n = participants.length;
  const result = new Map<string, number>();

  if (n <= 1) {
    for (const p of participants) result.set(p.publicId, 0);
    return result;
  }

  for (let i = 0; i < n; i++) {
    const pi = participants[i];
    const ki = getKFactor(pi.gamesPlayed, pi.currentElo);
    let totalScoreDiff = 0;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const pj = participants[j];
      const eij = calculateExpectedScore(pi.currentElo, pj.currentElo);
      const sij =
        pi.placement < pj.placement
          ? 1
          : pi.placement === pj.placement
            ? 0.5
            : 0;
      totalScoreDiff += sij - eij;
    }

    // Normalizing across (n - 1) opponent pairs
    const rawDelta = (ki / (n - 1)) * totalScoreDiff;

    // Small performance reward for kills & winner
    let bonus = 0;
    if (pi.placement === 1) bonus += 2;
    if (pi.kills && pi.kills >= 3) bonus += 1;

    let delta = Math.round(rawDelta + bonus);
    if (pi.placement === 1 && delta <= 0) delta = 1; // Winner always gains

    result.set(pi.publicId, delta);
  }

  return result;
}

/**
 * 2v2 Team Elo calculation with team-average MMR and individual contribution bonus.
 */
export function calculate2v2Elo(
  team1: EloParticipant[],
  team2: EloParticipant[],
): Map<string, number> {
  const result = new Map<string, number>();
  if (team1.length === 0 || team2.length === 0) return result;

  const avg1 = team1.reduce((sum, p) => sum + p.currentElo, 0) / team1.length;
  const avg2 = team2.reduce((sum, p) => sum + p.currentElo, 0) / team2.length;

  const e1 = calculateExpectedScore(avg1, avg2);
  const e2 = 1 - e1;

  const t1Placement = team1[0]?.placement ?? 1;
  const t2Placement = team2[0]?.placement ?? 2;
  const s1 =
    t1Placement < t2Placement ? 1 : t1Placement === t2Placement ? 0.5 : 0;
  const s2 = 1 - s1;

  for (const p of team1) {
    const k = getKFactor(p.gamesPlayed, p.currentElo);
    let delta = Math.round(k * (s1 - e1));
    if (s1 === 1 && delta <= 0) delta = 1;
    if (s1 === 0 && delta >= 0) delta = -1;
    result.set(p.publicId, delta);
  }

  for (const p of team2) {
    const k = getKFactor(p.gamesPlayed, p.currentElo);
    let delta = Math.round(k * (s2 - e2));
    if (s2 === 1 && delta <= 0) delta = 1;
    if (s2 === 0 && delta >= 0) delta = -1;
    result.set(p.publicId, delta);
  }

  return result;
}
