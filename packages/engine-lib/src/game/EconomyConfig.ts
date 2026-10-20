import {
  RefinedType,
  ResourceType,
  UnitType,
} from '@openfront/engine-api/game/GameTypes';
import { pow as detPow } from '../DetMath';

// Economy balancing parameters
export const DEMOGRAPHIC_GROWTH_RATE = 0.05; // r = 0.05
export const GOLD_ALPHA = 0.02; // alpha * Territory
export const GOLD_BETA = 0.10; // beta * Population
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

export function getUnitResourceCost(type: UnitType): {
  gold: number;
  steel: number;
  fuel: number;
  enrichedUranium: number;
} {
  switch (type) {
    case UnitType.AtomBomb:
      return MILITARY_UNIT_COSTS.atomBomb;
    case UnitType.HydrogenBomb:
      return MILITARY_UNIT_COSTS.hydrogenBomb;
    case UnitType.MIRV:
      return MILITARY_UNIT_COSTS.mirv;
    case UnitType.ICBM:
      return MILITARY_UNIT_COSTS.icbm;
    case UnitType.CruiseMissile:
      return MILITARY_UNIT_COSTS.cruiseMissile;
    case UnitType.Bunker:
      return { gold: 250, steel: 35, fuel: 0, enrichedUranium: 0 };
    case UnitType.Radar:
      return { gold: 1000, steel: 80, fuel: 0, enrichedUranium: 15 };
    case UnitType.SAMLauncher:
      return { gold: 800, steel: 60, fuel: 20, enrichedUranium: 0 };
    case UnitType.MissileSilo:
      return { gold: 2000, steel: 150, fuel: 50, enrichedUranium: 0 };
    case UnitType.Warship:
      return MILITARY_UNIT_COSTS.warship;
    case UnitType.Destroyer:
      return MILITARY_UNIT_COSTS.destroyer;
    case UnitType.Submarine:
      return MILITARY_UNIT_COSTS.submarine;
    case UnitType.Battleship:
      return MILITARY_UNIT_COSTS.battleship;
    default:
      return { gold: 0, steel: 0, fuel: 0, enrichedUranium: 0 };
  }
}

// Fuel consumption rates
export const FUEL_CONSUMPTION = {
  tankPerMove: 0.5,
  landingCraftPerTick: 0.15,
  warshipPerTick: 0.4,
  destroyerPerTick: 1.2,
  submarinePerTick: 0.5,
  battleshipPerTick: 2.0,
  fighterPerMission: 1.5,
  bomberPerMission: 3.0,
};

// Mine Base Yields (per tick at H = 1.0)
export const MINE_BASE_YIELDS: Record<ResourceType, number> = {
  ironOre: 2.5,
  coal: 2.5,
  crudeOil: 2.2,
  uraniumOre: 0.6,
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
  count: number
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
