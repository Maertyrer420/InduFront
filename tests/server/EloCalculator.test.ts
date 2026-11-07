import { describe, expect, it } from "vitest";
import {
  calculate1v1Elo,
  calculate2v2Elo,
  calculateFfaElo,
  getEloTier,
  getEloTierDetails,
  getKFactor,
} from "../../src/server/auth/EloCalculator";

describe("EloCalculator", () => {
  describe("getEloTier and getEloTierDetails", () => {
    it("assigns correct tiers based on rating", () => {
      expect(getEloTier(500)).toBe("Eisen");
      expect(getEloTier(850)).toBe("Bronze");
      expect(getEloTier(1000)).toBe("Silber");
      expect(getEloTier(1250)).toBe("Gold");
      expect(getEloTier(1500)).toBe("Platin");
      expect(getEloTier(1700)).toBe("Diamant");
      expect(getEloTier(1900)).toBe("Master");
      expect(getEloTier(2100)).toBe("Grandmaster");
      expect(getEloTier(2500)).toBe("Champion");
    });

    it("prioritizes top 10 rank", () => {
      expect(getEloTier(1500, 3)).toBe("Top 10");
      expect(getEloTier(2500, 10)).toBe("Top 10");
      expect(getEloTier(2500, 11)).toBe("Champion");
    });

    it("calculates divisions and progression percentage", () => {
      // Gold is 1200 - 1400 (50 points per division: 1200-1250: IV, 1250-1300: III, 1300-1350: II, 1350-1400: I)
      const g4 = getEloTierDetails(1225);
      expect(g4.tier).toBe("Gold");
      expect(g4.division).toBe("IV");
      expect(g4.progressPercent).toBe(50);

      const g2 = getEloTierDetails(1325);
      expect(g2.tier).toBe("Gold");
      expect(g2.division).toBe("II");
      expect(g2.progressPercent).toBe(50);

      const champ = getEloTierDetails(2450);
      expect(champ.tier).toBe("Champion");
      expect(champ.division).toBe("");
    });
  });

  describe("K-factor calibration", () => {
    it("gives higher K-factor during placement matches (<10 games)", () => {
      expect(getKFactor(2, 1000)).toBe(48);
      expect(getKFactor(9, 1500)).toBe(48);
      expect(getKFactor(15, 1000)).toBe(32);
      expect(getKFactor(15, 1500)).toBe(28);
      expect(getKFactor(15, 1900)).toBe(24);
      expect(getKFactor(15, 2300)).toBe(16);
    });
  });

  describe("1v1 Elo calculation", () => {
    it("gives equal and opposite rating changes for equal opponents", () => {
      const p1 = {
        publicId: "p1",
        currentElo: 1000,
        gamesPlayed: 20,
        placement: 1,
      };
      const p2 = {
        publicId: "p2",
        currentElo: 1000,
        gamesPlayed: 20,
        placement: 2,
      };
      const { p1Change, p2Change } = calculate1v1Elo(p1, p2);

      expect(p1Change).toBe(16); // 32 * (1 - 0.5)
      expect(p2Change).toBe(-16);
      expect(p1Change + p2Change).toBe(0);
    });

    it("gives underdog larger gain on victory", () => {
      const underdog = {
        publicId: "p1",
        currentElo: 1000,
        gamesPlayed: 20,
        placement: 1,
      };
      const favorite = {
        publicId: "p2",
        currentElo: 1400,
        gamesPlayed: 20,
        placement: 2,
      };
      const { p1Change, p2Change } = calculate1v1Elo(underdog, favorite);

      expect(p1Change).toBeGreaterThan(25);
      expect(p2Change).toBeLessThan(-20);
    });

    it("awards larger shift during placement matches", () => {
      const novice = {
        publicId: "p1",
        currentElo: 1000,
        gamesPlayed: 2,
        placement: 1,
      };
      const vet = {
        publicId: "p2",
        currentElo: 1000,
        gamesPlayed: 50,
        placement: 2,
      };
      const { p1Change, p2Change } = calculate1v1Elo(novice, vet);

      expect(p1Change).toBe(24); // K=48 * 0.5
      expect(p2Change).toBe(-16); // K=32 * -0.5
    });
  });

  describe("FFA Multi-player Elo calculation", () => {
    it("rewards higher placements and penalizes lower placements", () => {
      const players = [
        { publicId: "p1", currentElo: 1000, gamesPlayed: 20, placement: 1 },
        { publicId: "p2", currentElo: 1000, gamesPlayed: 20, placement: 2 },
        { publicId: "p3", currentElo: 1000, gamesPlayed: 20, placement: 3 },
        { publicId: "p4", currentElo: 1000, gamesPlayed: 20, placement: 4 },
      ];

      const deltas = calculateFfaElo(players);
      expect(deltas.get("p1")!).toBeGreaterThan(0);
      expect(deltas.get("p2")!).toBeGreaterThan(0);
      expect(deltas.get("p3")!).toBeLessThan(0);
      expect(deltas.get("p4")!).toBeLessThan(0);

      expect(deltas.get("p1")!).toBeGreaterThan(deltas.get("p2")!);
      expect(deltas.get("p3")!).toBeGreaterThan(deltas.get("p4")!);
    });
  });

  describe("2v2 Team Elo calculation", () => {
    it("updates team ratings based on expected matchup", () => {
      const team1 = [
        { publicId: "t1a", currentElo: 1100, gamesPlayed: 20, placement: 1 },
        { publicId: "t1b", currentElo: 1100, gamesPlayed: 20, placement: 1 },
      ];
      const team2 = [
        { publicId: "t2a", currentElo: 1100, gamesPlayed: 20, placement: 2 },
        { publicId: "t2b", currentElo: 1100, gamesPlayed: 20, placement: 2 },
      ];

      const deltas = calculate2v2Elo(team1, team2);
      expect(deltas.get("t1a")!).toBe(16);
      expect(deltas.get("t1b")!).toBe(16);
      expect(deltas.get("t2a")!).toBe(-16);
      expect(deltas.get("t2b")!).toBe(-16);
    });
  });
});
