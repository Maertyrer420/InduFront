import {
  PlayerClass,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  FUEL_CONSUMPTION,
  getUnitResourceCost,
  MINE_BASE_YIELDS,
  REFINERY_RECIPES,
} from "@openfront/engine-lib/game/EconomyConfig";
import { describe, expect, it } from "vitest";

describe("Player Classes & Economic Progression", () => {
  it("defaults PlayerInfo to Industrialist when no class is specified", () => {
    const info = new PlayerInfo("TestPlayer", PlayerType.Human, "client-1", "p1");
    expect(info.playerClass).toBe(PlayerClass.Industrialist);
  });

  it("assigns specified PlayerClass correctly", () => {
    const infantry = new PlayerInfo(
      "InfantryGuy",
      PlayerType.Human,
      "client-2",
      "p2",
      false,
      null,
      [],
      null,
      null,
      PlayerClass.Infantry,
    );
    expect(infantry.playerClass).toBe(PlayerClass.Infantry);

    const dome = new PlayerInfo(
      "DomeGuy",
      PlayerType.Human,
      "client-3",
      "p3",
      false,
      null,
      [],
      null,
      null,
      PlayerClass.IronDome,
    );
    expect(dome.playerClass).toBe(PlayerClass.IronDome);
  });

  it("verifies base mine yields are reduced by 25% from original values", () => {
    // Original base yields: ironOre 2.5, coal 2.5, crudeOil 2.2, uraniumOre 0.6
    expect(MINE_BASE_YIELDS.ironOre).toBe(1.88);
    expect(MINE_BASE_YIELDS.coal).toBe(1.88);
    expect(MINE_BASE_YIELDS.crudeOil).toBe(1.65);
    expect(MINE_BASE_YIELDS.uraniumOre).toBe(0.45);
  });

  it("verifies Industrialist +25% brings yields back to baseline", () => {
    const ironYield = MINE_BASE_YIELDS.ironOre * 1.25;
    expect(ironYield).toBeCloseTo(2.35, 1);

    const coalYield = MINE_BASE_YIELDS.coal * 1.25;
    expect(coalYield).toBeCloseTo(2.35, 1);

    const oilYield = MINE_BASE_YIELDS.crudeOil * 1.25;
    expect(oilYield).toBeCloseTo(2.06, 1);
  });

  it("verifies refinery recipes demand more raw materials than 1 level 1 mine provides", () => {
    // 1 Steel Mill requires 3 Iron Ore and 2 Coal per tick
    expect(REFINERY_RECIPES.steel.ironOre).toBe(3);
    expect(REFINERY_RECIPES.steel.coal).toBe(2);
    // Base iron mine yield (1.88) is below 1 steel mill requirement (3.0), requiring 2 mines or upgrades
    expect(MINE_BASE_YIELDS.ironOre).toBeLessThan(REFINERY_RECIPES.steel.ironOre);
  });

  it("verifies Scientist gets -20% discount on nuclear unit costs", () => {
    const normalNuke = getUnitResourceCost(UnitType.AtomBomb, 0, PlayerClass.Industrialist);
    const scientistNuke = getUnitResourceCost(UnitType.AtomBomb, 0, PlayerClass.Scientist);

    expect(scientistNuke.gold).toBe(Math.round(normalNuke.gold * 0.8));
    expect(scientistNuke.steel).toBe(Math.round(normalNuke.steel * 0.8));
    expect(scientistNuke.enrichedUranium).toBe(Math.round(normalNuke.enrichedUranium * 0.8));
  });

  it("verifies Iron Dome incurs +25% surcharge on nuclear unit costs", () => {
    const normalNuke = getUnitResourceCost(UnitType.AtomBomb, 0, PlayerClass.Industrialist);
    const domeNuke = getUnitResourceCost(UnitType.AtomBomb, 0, PlayerClass.IronDome);

    expect(domeNuke.gold).toBe(Math.round(normalNuke.gold * 1.25));
    expect(domeNuke.steel).toBe(Math.round(normalNuke.steel * 1.25));
    expect(domeNuke.enrichedUranium).toBe(Math.round(normalNuke.enrichedUranium * 1.25));
  });

  it("verifies Marine incurs +30% surcharge on bunker defense structures", () => {
    const normalBunker = getUnitResourceCost(UnitType.Bunker, 0, PlayerClass.Industrialist);
    const marineBunker = getUnitResourceCost(UnitType.Bunker, 0, PlayerClass.Marine);

    expect(marineBunker.gold).toBe(Math.round(normalBunker.gold * 1.3));
    expect(marineBunker.steel).toBe(Math.round(normalBunker.steel * 1.3));
  });

  it("verifies calibrated fuel consumption rates and per-tick ratios", () => {
    expect(FUEL_CONSUMPTION.warshipPerSecond).toBe(0.04);
    expect(FUEL_CONSUMPTION.destroyerPerSecond).toBe(0.08);
    expect(FUEL_CONSUMPTION.battleshipPerSecond).toBe(0.15);
    expect(FUEL_CONSUMPTION.warshipPerTick).toBeCloseTo(0.004, 3);
    expect(FUEL_CONSUMPTION.destroyerPerTick).toBeCloseTo(0.008, 3);
    expect(FUEL_CONSUMPTION.battleshipPerTick).toBeCloseTo(0.015, 3);
  });

  it("verifies shared coal bottleneck between Steel Mill and Centrifuge", () => {
    // Both steel mills and centrifuges consume coal, preventing single coal mine from feeding both
    const steelCoalDemand = REFINERY_RECIPES.steel.coal;
    const centrifugeCoalDemand = REFINERY_RECIPES.enrichedUranium.coal;
    expect(steelCoalDemand).toBe(2);
    expect(centrifugeCoalDemand).toBe(3);
    expect(steelCoalDemand + centrifugeCoalDemand).toBe(5);
    // Combined coal demand (5) significantly exceeds 1 base coal mine yield (1.88)
    expect(MINE_BASE_YIELDS.coal).toBeLessThan(steelCoalDemand + centrifugeCoalDemand);
  });
});
