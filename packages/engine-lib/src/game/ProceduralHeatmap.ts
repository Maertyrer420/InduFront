import {
  ResourceCluster,
  ResourceDeposit,
  ResourceType,
} from "@openfront/engine-api/game/GameTypes";
import {
  DEPLETION_EPSILON,
  MINE_BASE_YIELDS,
  RESOURCE_DENSITIES,
} from "./EconomyConfig";

class Mulberry32PRNG {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed >>> 0;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

const GRAD2 = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0, 1],
  [0, -1],
];

export class SimplexNoise2D {
  private p: Uint8Array = new Uint8Array(256);
  private perm: Uint8Array = new Uint8Array(512);
  private permMod12: Uint8Array = new Uint8Array(512);

  constructor(seed: number = 1337) {
    const rng = new Mulberry32PRNG(seed);
    for (let i = 0; i < 256; i++) {
      this.p[i] = i;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const tmp = this.p[i];
      this.p[i] = this.p[j];
      this.p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  public noise(xin: number, yin: number): number {
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (GRAD2[gi0][0] * x0 + GRAD2[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (GRAD2[gi1][0] * x1 + GRAD2[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (GRAD2[gi2][0] * x2 + GRAD2[gi2][1] * y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }

  public normalized(xin: number, yin: number): number {
    const v = (this.noise(xin, yin) + 1.0) * 0.5;
    return Math.max(0.0, Math.min(1.0, v));
  }
}

export interface GeneratedResourceMap {
  clusters: Map<string, ResourceCluster>;
  tileDeposits: Map<number, Partial<Record<ResourceType, ResourceDeposit>>>;
}

export class ProceduralHeatmapGenerator {
  public static generate(
    width: number,
    height: number,
    _spawnPositions: Array<{ x: number; y: number; id: string }>,
    seed: number = 2026,
    isLand?: (tile: number) => boolean,
  ): GeneratedResourceMap {
    const clusters = new Map<string, ResourceCluster>();
    const tileDeposits = new Map<
      number,
      Partial<Record<ResourceType, ResourceDeposit>>
    >();

    const resKeys: ResourceType[] = [
      "ironOre",
      "coal",
      "crudeOil",
      "uraniumOre",
    ];
    const rng = new Mulberry32PRNG(seed);
    let clusterCounter = 0;

    // 1. Initialize multi-frequency Simplex noise generators per resource
    const noises: Record<
      ResourceType,
      { macro: SimplexNoise2D; meso: SimplexNoise2D }
    > = {
      ironOre: {
        macro: new SimplexNoise2D(seed + 101),
        meso: new SimplexNoise2D(seed + 102),
      },
      coal: {
        macro: new SimplexNoise2D(seed + 201),
        meso: new SimplexNoise2D(seed + 202),
      },
      crudeOil: {
        macro: new SimplexNoise2D(seed + 301),
        meso: new SimplexNoise2D(seed + 302),
      },
      uraniumOre: {
        macro: new SimplexNoise2D(seed + 401),
        meso: new SimplexNoise2D(seed + 402),
      },
    };

    // 2. Generate natural continuous geological base field across all land tiles.
    // In real life, minerals and ores exist everywhere in the continental crust with smooth geological gradients.
    for (let y = 0; y < height; y++) {
      const yOff = y * width;
      for (let x = 0; x < width; x++) {
        const idx = yOff + x;
        if (isLand && !isLand(idx)) continue;

        const dep: Partial<Record<ResourceType, ResourceDeposit>> = {};

        // Iron Ore: widespread continental band (0.22 - 0.58 base)
        const feMacro = noises.ironOre.macro.normalized(x / 140, y / 140);
        const feMeso = noises.ironOre.meso.normalized(x / 50, y / 50);
        const feVal = 0.22 + (feMacro * 0.7 + feMeso * 0.3) * 0.36;
        dep.ironOre = { resource: "ironOre", intensity: feVal, clusterId: "" };

        // Coal: extensive sedimentary layers (0.20 - 0.54 base)
        const cMacro = noises.coal.macro.normalized(x / 125, y / 125);
        const cMeso = noises.coal.meso.normalized(x / 45, y / 45);
        const cVal = 0.2 + (cMacro * 0.7 + cMeso * 0.3) * 0.34;
        dep.coal = { resource: "coal", intensity: cVal, clusterId: "" };

        // Crude Oil: natural organic sedimentary basins (0.16 - 0.56 base)
        const oilMacro = noises.crudeOil.macro.normalized(x / 160, y / 160);
        const oilMeso = noises.crudeOil.meso.normalized(x / 60, y / 60);
        const oilVal = 0.16 + (oilMacro * 0.75 + oilMeso * 0.25) * 0.4;
        dep.crudeOil = {
          resource: "crudeOil",
          intensity: oilVal,
          clusterId: "",
        };

        // Uranium Ore: subtle deep geological veins (0.10 - 0.42 base)
        const uMacro = noises.uraniumOre.macro.normalized(x / 190, y / 190);
        const uMeso = noises.uraniumOre.meso.normalized(x / 70, y / 70);
        const uVal = 0.1 + (uMacro * 0.8 + uMeso * 0.2) * 0.32;
        dep.uraniumOre = {
          resource: "uraniumOre",
          intensity: uVal,
          clusterId: "",
        };

        tileDeposits.set(idx, dep);
      }
    }

    // 3. Superimpose broad, organic geological provinces / rich mineral lodes with zero hard edges.
    // Uses smooth quintic/hermite falloff: (1 - (d/R)^2)^2 which reaches 0 at edge with 0 derivative.
    for (const res of resKeys) {
      const clusterCount = res === "uraniumOre" ? 20 : 32;
      const density = RESOURCE_DENSITIES[res];

      for (let c = 0; c < clusterCount; c++) {
        let cx = Math.floor(rng.next() * (width - 60)) + 30;
        let cy = Math.floor(rng.next() * (height - 60)) + 30;
        if (isLand) {
          for (let attempt = 0; attempt < 12; attempt++) {
            const tileIdx = cy * width + cx;
            if (isLand(tileIdx)) break;
            cx = Math.floor(rng.next() * (width - 60)) + 30;
            cy = Math.floor(rng.next() * (height - 60)) + 30;
          }
          if (!isLand(cy * width + cx)) continue;
        }

        // Broader, softer radius for organic geological provinces
        const radius = 28 + Math.floor(rng.next() * 32);
        const clusterId = `cluster_province_${res}_${clusterCounter++}`;
        const totalReserve = 120000 + Math.floor(rng.next() * 200000);

        const cluster: ResourceCluster = {
          id: clusterId,
          resource: res,
          centerX: cx,
          centerY: cy,
          radius,
          totalReserve,
          currentReserve: totalReserve,
          density,
        };
        clusters.set(clusterId, cluster);

        const r2 = radius * radius;
        for (let dy = -radius; dy <= radius; dy++) {
          const y = cy + dy;
          if (y < 0 || y >= height) continue;
          const yOff = y * width;
          for (let dx = -radius; dx <= radius; dx++) {
            const x = cx + dx;
            if (x < 0 || x >= width) continue;
            const d2 = dx * dx + dy * dy;
            if (d2 < r2) {
              const idx = yOff + x;
              const dep = tileDeposits.get(idx);
              if (!dep) continue;

              const t = Math.sqrt(d2) / radius;
              // Hermite smooth falloff: (1 - t^2)^2 gives perfectly smooth transitions without hard borders
              const falloff = (1.0 - t * t) * (1.0 - t * t);
              const bonus = falloff * 0.38;

              const existing = dep[res];
              if (existing) {
                existing.intensity = Math.min(1.0, existing.intensity + bonus);
                if (!existing.clusterId || bonus > 0.15) {
                  existing.clusterId = clusterId;
                }
              }
            }
          }
        }
      }
    }

    // 4. Ensure every tile deposit has a valid regional cluster reference for reserve depletion
    const firstClusterByRes: Partial<Record<ResourceType, string>> = {};
    for (const [id, cl] of clusters.entries()) {
      firstClusterByRes[cl.resource] ??= id;
    }
    for (const dep of tileDeposits.values()) {
      for (const res of resKeys) {
        const item = dep[res];
        if (item && !item.clusterId) {
          item.clusterId = firstClusterByRes[res] ?? "";
        }
      }
    }

    return { clusters, tileDeposits };
  }

  /**
   * Calculates mine output with guaranteed baseline production + hotspot bonus
   */
  public static calculateMineOutput(
    resource: ResourceType,
    intensity: number,
    cluster?: ResourceCluster,
  ): number {
    const baseYield = MINE_BASE_YIELDS[resource];
    let ratio = 1.0;
    if (cluster && cluster.totalReserve > 0) {
      ratio = Math.max(0, cluster.currentReserve / cluster.totalReserve);
    }
    const yieldFactor = DEPLETION_EPSILON + (1.0 - DEPLETION_EPSILON) * ratio;
    // Guaranteed baseline (0.6 * baseYield) plus hotspot bonus multiplier
    return baseYield * (0.6 + intensity * 1.8 * yieldFactor);
  }

  /**
   * Generates a normalized Float32Array [0, 1] texture for WebGL thermal rendering.
   * Supports specific resource type or 'all' to show the highest concentration.
   */
  public static generateDensityTexture(
    resource: ResourceType | "all",
    width: number,
    height: number,
    tileDeposits: Map<number, Partial<Record<ResourceType, ResourceDeposit>>>,
    isLand?: (tile: number) => boolean,
  ): Float32Array {
    const out = new Float32Array(width * height);
    const totalTiles = width * height;

    for (let idx = 0; idx < totalTiles; idx++) {
      if (isLand && !isLand(idx)) {
        continue;
      }
      const dep = tileDeposits.get(idx);
      if (dep) {
        if (resource === "all") {
          out[idx] = Math.max(
            dep.ironOre?.intensity ?? 0.22,
            dep.coal?.intensity ?? 0.2,
            dep.crudeOil?.intensity ?? 0.18,
            dep.uraniumOre?.intensity ?? 0.12,
          );
        } else {
          out[idx] = dep[resource]?.intensity ?? 0.2;
        }
      } else {
        out[idx] = 0.2;
      }
    }
    return out;
  }
}
