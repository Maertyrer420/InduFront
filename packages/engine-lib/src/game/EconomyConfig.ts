import {
  PlayerClass,
  ResourceType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { pow as detPow } from "../DetMath";

// Economy balancing parameters
export const DEMOGRAPHIC_GROWTH_RATE = 0.02; // r = 0.02 per second
export const GOLD_ALPHA = 0.02; // alpha * Territory
export const GOLD_BETA = 0.1; // beta * Population
export const BASE_POPULATION_CAP = 1000;
export const RESIDENTIAL_POP_BOOST = 500;
export const EXPONENTIAL_COST_BASE = 1.15; // Cost(n) = BaseCost * (1.15)^(n-1)

// Base costs in Gold (strictly civilian & infrastructure)
export const BUILDING_BASE_COSTS: Record<
  string,
  { gold: number; steel?: number; fuel?: number; enrichedUranium?: number }
> = {
  [UnitType.Residential]: { gold: 100 },
  [UnitType.CoalMine]: { gold: 150 },
  [UnitType.IronMine]: { gold: 200 },
  [UnitType.OilRig]: { gold: 350 },
  [UnitType.UraniumMine]: { gold: 800 },
  [UnitType.SteelMill]: { gold: 400 },
  [UnitType.Refinery]: { gold: 500 },
  [UnitType.Centrifuge]: { gold: 1200 },
  [UnitType.Shipyard]: { gold: 600 },
  [UnitType.Airbase]: { gold: 750 },
  [UnitType.Bunker]: { gold: 250, steel: 35 },
  [UnitType.Radar]: { gold: 1000, steel: 80, enrichedUranium: 15 },
  [UnitType.SAMLauncher]: { gold: 800, steel: 60, fuel: 20 },
  [UnitType.MissileSilo]: { gold: 2000, steel: 150, fuel: 50 },
};

// Unit & Strike Costs
export const MILITARY_UNIT_COSTS = {
  tank: { gold: 250, steel: 20, fuel: 0, enrichedUranium: 0 },
  landingCraft: { gold: 100, steel: 5, fuel: 0, enrichedUranium: 0 },
  warship: { gold: 500, steel: 40, fuel: 50, enrichedUranium: 0 },
  destroyer: { gold: 600, steel: 50, fuel: 150, enrichedUranium: 0 },
  submarine: { gold: 500, steel: 80, fuel: 120, enrichedUranium: 0 },
  battleship: { gold: 1500, steel: 150, fuel: 200, enrichedUranium: 0 },
  fighter: { gold: 300, steel: 15, fuel: 30, enrichedUranium: 0 },
  bomber: { gold: 600, steel: 45, fuel: 60, enrichedUranium: 0 },
  cruiseMissile: { gold: 600, steel: 40, fuel: 120, enrichedUranium: 0 },
  atomBomb: { gold: 5000, steel: 200, fuel: 150, enrichedUranium: 200 },
  hydrogenBomb: { gold: 10000, steel: 400, fuel: 300, enrichedUranium: 450 },
  mirv: { gold: 20000, steel: 800, fuel: 500, enrichedUranium: 1000 },
  icbm: { gold: 30000, steel: 1200, fuel: 800, enrichedUranium: 1500 },
  samReload: { gold: 100, steel: 10, fuel: 10, enrichedUranium: 0 },
};

export function getUnitResourceCost(
  type: UnitType,
  existingCount: number = 0,
  playerClass?: PlayerClass,
): {
  gold: number;
  steel: number;
  fuel: number;
  enrichedUranium: number;
} {
  let cost: { gold: number; steel: number; fuel: number; enrichedUranium: number };
  switch (type) {
    case UnitType.AtomBomb:
      cost = { ...MILITARY_UNIT_COSTS.atomBomb };
      break;
    case UnitType.HydrogenBomb:
      cost = { ...MILITARY_UNIT_COSTS.hydrogenBomb };
      break;
    case UnitType.MIRV:
      cost = { ...MILITARY_UNIT_COSTS.mirv };
      break;
    case UnitType.ICBM:
      cost = { ...MILITARY_UNIT_COSTS.icbm };
      break;
    case UnitType.CruiseMissile:
      cost = { ...MILITARY_UNIT_COSTS.cruiseMissile };
      break;
    case UnitType.Bunker: {
      const steelCost = Math.round(
        100 * detPow(1.6, Math.min(10, existingCount)),
      );
      cost = { gold: 500, steel: steelCost, fuel: 0, enrichedUranium: 0 };
      break;
    }
    case UnitType.Radar:
      cost = { gold: 1000, steel: 80, fuel: 0, enrichedUranium: 15 };
      break;
    case UnitType.SAMLauncher:
      cost = { gold: 800, steel: 60, fuel: 20, enrichedUranium: 0 };
      break;
    case UnitType.MissileSilo:
      cost = { gold: 2000, steel: 150, fuel: 50, enrichedUranium: 0 };
      break;
    case UnitType.Warship:
      cost = { ...MILITARY_UNIT_COSTS.warship };
      break;
    case UnitType.Destroyer:
      cost = { ...MILITARY_UNIT_COSTS.destroyer };
      break;
    case UnitType.Submarine:
      cost = { ...MILITARY_UNIT_COSTS.submarine };
      break;
    case UnitType.Battleship:
      cost = { ...MILITARY_UNIT_COSTS.battleship };
      break;
    default:
      cost = { gold: 0, steel: 0, fuel: 0, enrichedUranium: 0 };
      break;
  }

  if (playerClass === PlayerClass.Scientist) {
    if (
      type === UnitType.AtomBomb ||
      type === UnitType.HydrogenBomb ||
      type === UnitType.MIRV ||
      type === UnitType.ICBM ||
      type === UnitType.MissileSilo
    ) {
      return {
        gold: Math.round(cost.gold * 0.8),
        steel: Math.round(cost.steel * 0.8),
        fuel: Math.round(cost.fuel * 0.8),
        enrichedUranium: Math.round(cost.enrichedUranium * 0.8),
      };
    }
  } else if (playerClass === PlayerClass.IronDome) {
    if (
      type === UnitType.AtomBomb ||
      type === UnitType.HydrogenBomb ||
      type === UnitType.MIRV ||
      type === UnitType.ICBM
    ) {
      return {
        gold: Math.round(cost.gold * 1.25),
        steel: Math.round(cost.steel * 1.25),
        fuel: Math.round(cost.fuel * 1.25),
        enrichedUranium: Math.round(cost.enrichedUranium * 1.25),
      };
    }
  } else if (playerClass === PlayerClass.Marine) {
    if (type === UnitType.Bunker) {
      return {
        gold: Math.round(cost.gold * 1.3),
        steel: Math.round(cost.steel * 1.3),
        fuel: cost.fuel,
        enrichedUranium: cost.enrichedUranium,
      };
    }
  }

  return cost;
}

// Fuel consumption rates (calibrated per second at 10 ticks/s)
export const FUEL_CONSUMPTION = {
  tankPerMove: 0.5,
  landingCraftPerSecond: 0.02,
  warshipPerSecond: 0.04,
  destroyerPerSecond: 0.08,
  submarinePerSecond: 0.05,
  battleshipPerSecond: 0.15,
  fighterPerMission: 1.5,
  bomberPerMission: 3.0,
  landingCraftPerTick: 0.002,
  warshipPerTick: 0.004,
  destroyerPerTick: 0.008,
  submarinePerTick: 0.005,
  battleshipPerTick: 0.015,
};

// Mine Base Yields (per tick at H = 1.0) - reduced by 25% from baseline (Industrialist restores to base)
export const MINE_BASE_YIELDS: Record<ResourceType, number> = {
  ironOre: 1.88,
  coal: 1.88,
  crudeOil: 1.65,
  uraniumOre: 0.45,
};

// Refinery Recipes
export const REFINERY_RECIPES = {
  steel: { ironOre: 3, coal: 2, output: 1 },
  fuel: { crudeOil: 3, output: 1 },
  enrichedUranium: { uraniumOre: 5, coal: 3, output: 1 },
};

// Depletion parameters
export const DEPLETION_EPSILON = 0.15; // 15% guaranteed deep extraction floor
export const RESOURCE_DENSITIES: Record<ResourceType, number> = {
  ironOre: 50000,
  coal: 40000,
  crudeOil: 30000,
  uraniumOre: 10000,
};

// Macro Cluster Procedural Noise Parameters
export const NOISE_PARAMS: Record<
  ResourceType,
  { lambda: number; theta: number; gamma: number }
> = {
  ironOre: { lambda: 80, theta: 0.55, gamma: 1.5 },
  coal: { lambda: 70, theta: 0.5, gamma: 1.4 },
  crudeOil: { lambda: 120, theta: 0.7, gamma: 2.2 },
  uraniumOre: { lambda: 180, theta: 0.82, gamma: 3.0 },
};

// Sensor and weapon ranges
export const RADAR_RADIUS = 30; // 30 tiles sensor
export const SAM_BASE_RADIUS = 12; // 12 tiles base
export const SAM_RADAR_BOOST_MULTIPLIER = 1.5; // +50% -> 18 tiles
export const SAM_RELOAD_TIME_TICKS = 10;
export const SAM_MAX_AMMO = 4;
export const CRUISE_MISSILE_RADIUS = 3;
export const ICBM_RADIUS = 12;
export const ICBM_RADIATION_DURATION_TICKS = 120; // 120s fallout

// Defense & Combat bonuses
export const DEF_BONUS_PLAIN = 1.0;
export const DEF_BONUS_MOUNTAIN = 1.2;
export const DEF_BONUS_BUNKER = 1.8;
export const TANK_EFFECTIVENESS = 5.0; // 5x breakthrough power

/**
 * Calculates exponential building cost: Cost(n) = BaseCost * (1.15)^(n - 1)
 */
export function calculateBuildingCost(
  type: UnitType,
  count: number,
): { gold: number; steel: number; fuel: number; enrichedUranium: number } {
  const base = BUILDING_BASE_COSTS[type] || { gold: 100 };
  const mult = detPow(EXPONENTIAL_COST_BASE, Math.max(0, count));
  const gold = Math.round(base.gold * mult);
  const steel = base.steel ? Math.round(base.steel * mult) : 0;
  const fuel = base.fuel ? Math.round(base.fuel * mult) : 0;
  const enrichedUranium = base.enrichedUranium
    ? Math.round(base.enrichedUranium * mult)
    : 0;

  return { gold, steel, fuel, enrichedUranium };
}
