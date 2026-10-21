import {
  PlayerEconomyState,
  RefinedType,
  ResourceCluster,
  ResourceDeposit,
  ResourceType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  BASE_POPULATION_CAP,
  DEMOGRAPHIC_GROWTH_RATE,
  DEPLETION_EPSILON,
  FUEL_CONSUMPTION,
  GOLD_ALPHA,
  GOLD_BETA,
  MINE_BASE_YIELDS,
  REFINERY_RECIPES,
  RESIDENTIAL_POP_BOOST,
} from "@openfront/engine-lib/game/EconomyConfig";
import { ProceduralHeatmapGenerator } from "@openfront/engine-lib/game/ProceduralHeatmap";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

export interface ResourceShipment {
  id: number;
  unitId: number;
  ownerSmallID: number;
  resource: ResourceType;
  amount: number;
  arrivalTick: number;
}

export class EconomyExecution implements Execution {
  private active = true;
  private mg: Game | null = null;
  private lastTickProcessed = -1;

  // Player economic states
  public playerEconomies = new Map<number, PlayerEconomyState>();

  // Geological clusters
  public clusters = new Map<string, ResourceCluster>();
  public tileDeposits = new Map<
    number,
    Partial<Record<ResourceType, ResourceDeposit>>
  >();

  // Logistics: shipments in transit and on-site mine buffers
  public shipments: ResourceShipment[] = [];
  private nextShipmentId = 1;
  public mineBuffers = new Map<
    number,
    { resource: ResourceType; amount: number }
  >();
  private latencyCache = new Map<
    number,
    { latency: number; cachedAtTick: number }
  >();

  constructor() {}

  public init(mg: Game, _ticks: number): void {
    this.mg = mg;

    // Generate geological clusters and deposits
    const spawnPositions = mg.players().map((p) => {
      const tile = p.spawnTile();
      return {
        x:
          tile !== null && tile !== undefined
            ? mg.x(tile)
            : Math.floor(mg.width() / 2),
        y:
          tile !== null && tile !== undefined
            ? mg.y(tile)
            : Math.floor(mg.height() / 2),
        id: p.id(),
      };
    });

    const resMap = ProceduralHeatmapGenerator.generate(
      mg.width(),
      mg.height(),
      spawnPositions,
      2026,
      (tile: number) => mg.isLand(tile as any),
    );
    this.clusters = resMap.clusters;
    this.tileDeposits = resMap.tileDeposits;

    // Initialize player economies
    for (const player of mg.players()) {
      this.initPlayerEconomy(player);
    }
  }

  public getEconomy(smallID: number): PlayerEconomyState | undefined {
    return this.playerEconomies.get(smallID);
  }

  public initPlayerEconomy(player: Player): PlayerEconomyState {
    const existing = this.playerEconomies.get(player.smallID());
    if (existing) return existing;

    const state: PlayerEconomyState = {
      resources: {
        ironOre: 20,
        coal: 20,
        crudeOil: 15,
        uraniumOre: 0,
      },
      refined: {
        steel: 20,
        fuel: 25,
        enrichedUranium: 0,
      },
      population: 500,
      maxPopulation: BASE_POPULATION_CAP,
      fuelStarved: false,
      buildingsCount: {},
    };
    this.playerEconomies.set(player.smallID(), state);
    return state;
  }

  public tick(ticks: number): void {
    if (!this.mg) return;
    if (ticks === this.lastTickProcessed) return;
    this.lastTickProcessed = ticks;

    const mg = this.mg;

    // 0. Arrive in-transit shipments
    const survivingShipments: ResourceShipment[] = [];
    for (const s of this.shipments) {
      if (ticks >= s.arrivalTick) {
        const recipientEcon = this.playerEconomies.get(s.ownerSmallID);
        if (recipientEcon) {
          recipientEcon.resources[s.resource] =
            (recipientEcon.resources[s.resource] || 0) + s.amount;
        }
      } else {
        survivingShipments.push(s);
      }
    }
    this.shipments = survivingShipments;

    // 1. Process player economies, buildings, mines, refineries, and fuel in a consolidated pass
    const clusterDrains = new Map<string, number>();

    for (const player of mg.players()) {
      if (!player.isAlive()) continue;
      const econ = this.initPlayerEconomy(player);
      econ.buildingsCount = {};

      const ships: Unit[] = [];

      // Single pass over units for building counts, mines, and ship tracking
      for (const unit of player.units()) {
        const type = unit.type();
        econ.buildingsCount[type] = (econ.buildingsCount[type] ?? 0) + 1;

        let minedRes: ResourceType | null = null;
        if (type === UnitType.IronMine) minedRes = "ironOre";
        else if (type === UnitType.CoalMine) minedRes = "coal";
        else if (type === UnitType.OilRig) minedRes = "crudeOil";
        else if (type === UnitType.UraniumMine) minedRes = "uraniumOre";

        if (minedRes) {
          const tile = unit.tile();
          const depMap = this.tileDeposits.get(tile);
          const deposit = depMap ? depMap[minedRes] : null;

          const baseYield = MINE_BASE_YIELDS[minedRes];
          let minedAmount = baseYield * 0.6;

          if (deposit) {
            const cluster = this.clusters.get(deposit.clusterId);
            let ratio = 1.0;
            if (cluster && cluster.totalReserve > 0) {
              ratio = Math.max(
                0,
                cluster.currentReserve / cluster.totalReserve,
              );
            }
            const yieldFactor =
              DEPLETION_EPSILON + (1.0 - DEPLETION_EPSILON) * ratio;
            minedAmount =
              baseYield * (0.6 + deposit.intensity * 1.8 * yieldFactor);
            clusterDrains.set(
              deposit.clusterId,
              (clusterDrains.get(deposit.clusterId) ?? 0) + minedAmount,
            );
          }

          const latency = this.getLogisticsLatency(player, unit, minedRes);
          if (latency === 0) {
            econ.resources[minedRes] =
              (econ.resources[minedRes] || 0) + minedAmount;
          } else {
            const buf = this.mineBuffers.get(unit.id()) ?? {
              resource: minedRes,
              amount: 0,
            };
            buf.amount += minedAmount;
            buf.resource = minedRes;

            // Dispatch a shipment every 3 ticks or when accumulated amount >= 8
            if (buf.amount >= 8 || ticks % 3 === 0) {
              this.shipments.push({
                id: this.nextShipmentId++,
                unitId: unit.id(),
                ownerSmallID: player.smallID(),
                resource: minedRes,
                amount: buf.amount,
                arrivalTick: ticks + latency,
              });
              buf.amount = 0;
            }
            this.mineBuffers.set(unit.id(), buf);
          }
        } else if (
          type === UnitType.Warship ||
          type === UnitType.Destroyer ||
          type === UnitType.Battleship ||
          type === UnitType.Submarine ||
          type === UnitType.TransportShip
        ) {
          ships.push(unit);
        }
      }

      // Demographic cap K_P = base (1000) + residential * 500
      const residentialCount = econ.buildingsCount[UnitType.Residential] ?? 0;
      econ.maxPopulation =
        BASE_POPULATION_CAP + residentialCount * RESIDENTIAL_POP_BOOST;

      // Demographic Growth: P_{t+1} = P + r * P * (1 - P / K_P)
      if (econ.population < econ.maxPopulation) {
        const growth =
          DEMOGRAPHIC_GROWTH_RATE *
          econ.population *
          (1.0 - econ.population / econ.maxPopulation);
        econ.population = Math.min(
          econ.maxPopulation,
          Math.max(10, Math.round(econ.population + Math.max(1, growth))),
        );
      }

      // Gold Income: G_tick = floor(alpha * T + beta * P)
      const numTiles = player.numTilesOwned();
      const goldIncome = Math.floor(
        GOLD_ALPHA * numTiles + GOLD_BETA * econ.population,
      );
      if (goldIncome > 0) {
        player.addGold(BigInt(goldIncome));
      }

      // Process Refineries (O(1) direct multiplication instead of unneeded for-loop iterations)
      // Steel Mill: 2 Fe + 1 C -> 1 Steel
      const steelMills = econ.buildingsCount[UnitType.SteelMill] ?? 0;
      if (steelMills > 0) {
        const maxConversions = Math.min(
          steelMills,
          Math.floor(econ.resources.ironOre / REFINERY_RECIPES.steel.ironOre),
          Math.floor(econ.resources.coal / REFINERY_RECIPES.steel.coal),
        );
        if (maxConversions > 0) {
          econ.resources.ironOre -=
            maxConversions * REFINERY_RECIPES.steel.ironOre;
          econ.resources.coal -= maxConversions * REFINERY_RECIPES.steel.coal;
          econ.refined.steel =
            (econ.refined.steel ?? 0) +
            maxConversions * REFINERY_RECIPES.steel.output;
        }
      }

      // Refinery: 2 Crude Oil -> 1 Fuel
      const refineries = econ.buildingsCount[UnitType.Refinery] ?? 0;
      if (refineries > 0) {
        const maxConversions = Math.min(
          refineries,
          Math.floor(econ.resources.crudeOil / REFINERY_RECIPES.fuel.crudeOil),
        );
        if (maxConversions > 0) {
          econ.resources.crudeOil -=
            maxConversions * REFINERY_RECIPES.fuel.crudeOil;
          econ.refined.fuel =
            (econ.refined.fuel ?? 0) +
            maxConversions * REFINERY_RECIPES.fuel.output;
        }
      }

      // Centrifuge: 4 Uranium Ore + 2 Coal -> 1 Enriched Uranium
      const centrifuges = econ.buildingsCount[UnitType.Centrifuge] ?? 0;
      if (centrifuges > 0) {
        const maxConversions = Math.min(
          centrifuges,
          Math.floor(
            econ.resources.uraniumOre /
              REFINERY_RECIPES.enrichedUranium.uraniumOre,
          ),
          Math.floor(
            econ.resources.coal / REFINERY_RECIPES.enrichedUranium.coal,
          ),
        );
        if (maxConversions > 0) {
          econ.resources.uraniumOre -=
            maxConversions * REFINERY_RECIPES.enrichedUranium.uraniumOre;
          econ.resources.coal -=
            maxConversions * REFINERY_RECIPES.enrichedUranium.coal;
          econ.refined.enrichedUranium =
            (econ.refined.enrichedUranium ?? 0) +
            maxConversions * REFINERY_RECIPES.enrichedUranium.output;
        }
      }

      // Fuel Drain & Starvation
      let fuelDrain = 0;
      fuelDrain +=
        (econ.buildingsCount[UnitType.Warship] ?? 0) *
        FUEL_CONSUMPTION.warshipPerTick;
      fuelDrain +=
        (econ.buildingsCount[UnitType.Destroyer] ?? 0) *
        FUEL_CONSUMPTION.destroyerPerTick;
      fuelDrain +=
        (econ.buildingsCount[UnitType.Battleship] ?? 0) *
        FUEL_CONSUMPTION.battleshipPerTick;
      fuelDrain +=
        (econ.buildingsCount[UnitType.Submarine] ?? 0) *
        FUEL_CONSUMPTION.submarinePerTick;
      fuelDrain +=
        (econ.buildingsCount[UnitType.TransportShip] ?? 0) *
        FUEL_CONSUMPTION.landingCraftPerTick;

      if (econ.refined.fuel >= fuelDrain) {
        econ.refined.fuel -= fuelDrain;
      } else {
        econ.refined.fuel = 0;
      }

      econ.fuelStarved = econ.refined.fuel <= 0.05;

      // 5% hull attrition on ships if fuel starved (paced to once every 10 ticks to avoid spamming unit updates).
      // Fuel starvation damage cannot sink ships directly; minimum health floor is 1 HP.
      if (econ.fuelStarved && ticks % 10 === 0 && ships.length > 0) {
        for (const ship of ships) {
          if (ship.isActive() && ship.health() > 1) {
            const damage = Math.min(10, ship.health() - 1);
            if (damage > 0) {
              ship.modifyHealth(-damage);
            }
          }
        }
      }
    }

    // Drain clusters
    for (const [clusterId, drain] of clusterDrains.entries()) {
      const cluster = this.clusters.get(clusterId);
      if (cluster) {
        cluster.currentReserve = Math.max(0, cluster.currentReserve - drain);
      }
    }
  }

  /**
   * Calculates logistics latency tau based on distance to nearest processing hub or capital.
   * tau = min(40, max(0, floor(minDistance / 4))) ticks.
   */
  public getLogisticsLatency(
    player: Player,
    mineUnit: Unit,
    res: ResourceType,
  ): number {
    if (!this.mg) return 0;
    this.latencyCache ??= new Map();
    const currentTick = this.mg.ticks();
    const cached = this.latencyCache.get(mineUnit.id());
    if (cached && currentTick - cached.cachedAtTick < 25) {
      return cached.latency;
    }

    const tile = mineUnit.tile();
    const mx = this.mg.x(tile);
    const my = this.mg.y(tile);

    let minDistance = Infinity;

    // Find nearest eligible processing hub owned by the player
    for (const unit of player.units()) {
      const type = unit.type();
      let isEligible = false;
      if (res === "ironOre") {
        isEligible = type === UnitType.SteelMill || type === UnitType.City;
      } else if (res === "coal") {
        isEligible =
          type === UnitType.SteelMill ||
          type === UnitType.Centrifuge ||
          type === UnitType.City;
      } else if (res === "crudeOil") {
        isEligible =
          type === UnitType.Refinery ||
          type === UnitType.Port ||
          type === UnitType.City;
      } else if (res === "uraniumOre") {
        isEligible = type === UnitType.Centrifuge || type === UnitType.City;
      }

      if (isEligible) {
        const uTile = unit.tile();
        const ux = this.mg.x(uTile);
        const uy = this.mg.y(uTile);
        const dx = mx - ux;
        const dy = my - uy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDistance) {
          minDistance = d;
        }
      }
    }

    // Fallback: player's spawn tile (national capital)
    if (minDistance === Infinity) {
      const spawn = player.spawnTile();
      if (spawn !== null && spawn !== undefined) {
        const sx = this.mg.x(spawn);
        const sy = this.mg.y(spawn);
        const dx = mx - sx;
        const dy = my - sy;
        minDistance = Math.sqrt(dx * dx + dy * dy);
      }
    }

    let latency = 0;
    if (minDistance !== Infinity && minDistance > 5) {
      // Latency tau: gentle scaling (1 tick per 10 tiles), capped at 10 ticks
      latency = Math.min(10, Math.max(1, Math.floor(minDistance / 10)));
    }
    this.latencyCache.set(mineUnit.id(), {
      latency,
      cachedAtTick: currentTick,
    });
    return latency;
  }

  /**
   * Captures 80% of local buffered resources and interceptable shipments when a structure is captured.
   * 20% is lost/destroyed in the assault.
   */
  public onStructureCaptured(unit: Unit, newOwner: Player): void {
    const captorEcon =
      this.playerEconomies.get(newOwner.smallID()) ??
      this.initPlayerEconomy(newOwner);
    const unitId = unit.id();

    // 1. Loot 80% of local mine buffer
    const buf = this.mineBuffers.get(unitId);
    if (buf && buf.amount > 0) {
      const looted = Math.floor(buf.amount * 0.8);
      captorEcon.resources[buf.resource] =
        (captorEcon.resources[buf.resource] || 0) + looted;
      buf.amount = 0;
      this.mineBuffers.set(unitId, buf);
    }

    // 2. Intercept 80% of in-transit shipments originating from this captured facility
    const remaining: ResourceShipment[] = [];
    for (const s of this.shipments) {
      if (s.unitId === unitId) {
        const looted = Math.floor(s.amount * 0.8);
        captorEcon.resources[s.resource] =
          (captorEcon.resources[s.resource] || 0) + looted;
      } else {
        remaining.push(s);
      }
    }
    this.shipments = remaining;

    // 3. Established facility capture spoils (80% yield from seized on-site stockpile)
    const type = unit.type();
    if (type === UnitType.IronMine) {
      captorEcon.resources.ironOre = (captorEcon.resources.ironOre || 0) + 12; // 80% of 15
    } else if (type === UnitType.CoalMine) {
      captorEcon.resources.coal = (captorEcon.resources.coal || 0) + 12; // 80% of 15
    } else if (type === UnitType.OilRig) {
      captorEcon.resources.crudeOil = (captorEcon.resources.crudeOil || 0) + 8; // 80% of 10
    } else if (type === UnitType.UraniumMine) {
      captorEcon.resources.uraniumOre =
        (captorEcon.resources.uraniumOre || 0) + 4; // 80% of 5
    } else if (type === UnitType.SteelMill) {
      captorEcon.refined.steel = (captorEcon.refined.steel || 0) + 8; // 80% of 10
    } else if (type === UnitType.Refinery) {
      captorEcon.refined.fuel = (captorEcon.refined.fuel || 0) + 8; // 80% of 10
    } else if (type === UnitType.Centrifuge) {
      captorEcon.refined.enrichedUranium =
        (captorEcon.refined.enrichedUranium || 0) + 2; // 80% of 2.5
    }
  }

  /**
   * Conquering player seizes 80% of defeated nation's raw and refined reserves, plus en-route shipments.
   * 20% is lost to war devastation.
   */
  public onPlayerConquered(conqueror: Player, conquered: Player): void {
    const conqueredEcon = this.playerEconomies.get(conquered.smallID());
    const conquerorEcon =
      this.playerEconomies.get(conqueror.smallID()) ??
      this.initPlayerEconomy(conqueror);

    if (conqueredEcon && conquerorEcon) {
      // 80% of raw resources taken over, 20% destroyed
      for (const res of Object.keys(
        conqueredEcon.resources,
      ) as ResourceType[]) {
        const amt = conqueredEcon.resources[res] || 0;
        if (amt > 0) {
          const looted = Math.floor(amt * 0.8);
          conquerorEcon.resources[res] =
            (conquerorEcon.resources[res] || 0) + looted;
          conqueredEcon.resources[res] = 0;
        }
      }

      // 80% of refined resources taken over, 20% destroyed
      for (const res of Object.keys(conqueredEcon.refined) as RefinedType[]) {
        const amt = conqueredEcon.refined[res] || 0;
        if (amt > 0) {
          const looted = Math.floor(amt * 0.8);
          conquerorEcon.refined[res] =
            (conquerorEcon.refined[res] || 0) + looted;
          conqueredEcon.refined[res] = 0;
        }
      }

      // Intercept 80% of any surviving in-transit shipments belonging to conquered player
      const remaining: ResourceShipment[] = [];
      for (const s of this.shipments) {
        if (s.ownerSmallID === conquered.smallID()) {
          const looted = Math.floor(s.amount * 0.8);
          conquerorEcon.resources[s.resource] =
            (conquerorEcon.resources[s.resource] || 0) + looted;
        } else {
          remaining.push(s);
        }
      }
      this.shipments = remaining;
    }
  }

  public isActive(): boolean {
    return this.active;
  }

  public activeDuringSpawnPhase(): boolean {
    return true;
  }

  public snapshot(_w: SnapshotWriter): ExecRecord {
    return EconomyExecutionSnapshot.write({
      active: this.active,
      initialized: Boolean(this.mg),
      lastTickProcessed: this.lastTickProcessed,
      nextShipmentId: this.nextShipmentId,
      playerEconomies: Array.from(this.playerEconomies.entries()).sort(
        (a, b) => a[0] - b[0],
      ),
      clusters: Array.from(this.clusters.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      ),
      tileDeposits: Array.from(this.tileDeposits.entries()).sort(
        (a, b) => a[0] - b[0],
      ),
      shipments: this.shipments.map((s) => ({ ...s })),
      mineBuffers: Array.from(this.mineBuffers.entries()).sort(
        (a, b) => a[0] - b[0],
      ),
    });
  }

  public restoreSnapshot(s: EconomyState, r: SnapshotReader): void {
    this.active = s.active;
    this.mg = s.initialized ? r.game : null;
    this.lastTickProcessed = s.lastTickProcessed;
    this.nextShipmentId = s.nextShipmentId;
    this.playerEconomies = new Map(s.playerEconomies);
    this.clusters = new Map(s.clusters);
    this.tileDeposits = new Map(s.tileDeposits);
    this.shipments = s.shipments.map((x) => ({ ...x }));
    this.mineBuffers = new Map(s.mineBuffers);
    this.latencyCache = new Map();
  }
}

const EconomyStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  lastTickProcessed: z.number().int(),
  nextShipmentId: z.number().int(),
  playerEconomies: z.array(z.tuple([z.number().int(), z.any()])),
  clusters: z.array(z.tuple([z.string(), z.any()])),
  tileDeposits: z.array(z.tuple([z.number().int(), z.any()])),
  shipments: z.array(z.any()),
  mineBuffers: z.array(z.tuple([z.number().int(), z.any()])),
});
type EconomyState = z.infer<typeof EconomyStateSchema>;

export const EconomyExecutionSnapshot = execSnapshotType({
  name: "Economy",
  version: 1,
  schema: EconomyStateSchema,
  cls: () => EconomyExecution,
});
