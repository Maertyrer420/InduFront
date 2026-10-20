import { ResourceType } from "@openfront/engine-api/game/GameTypes";
import {
  GeneratedResourceMap,
  ProceduralHeatmapGenerator,
} from "@openfront/engine-lib/game/ProceduralHeatmap";
import type { GameView } from "../../../view/GameView";

export class GeologicalDataService {
  private static cachedMap: GeneratedResourceMap | null = null;
  private static cachedKey: string = "";
  private static densityBuffers = new Map<string, Float32Array>();

  /**
   * Pre-calculates the geological cluster map at load time (takes ~50ms, zero heap bloat).
   */
  public static preload(game: GameView): void {
    const width = game.width();
    const height = game.height();
    const key = `${width}_${height}`;

    if (this.cachedKey === key && this.cachedMap) {
      return;
    }

    this.cachedKey = key;
    this.densityBuffers.clear();

    // Map generation is deterministic from map bounds & land mask
    this.cachedMap = ProceduralHeatmapGenerator.generate(
      width,
      height,
      [],
      2026,
      (tile: number) => game.isLand(tile as any),
    );
  }

  public static getDensityData(
    game: GameView,
    resource: ResourceType | "all" | "none",
  ): Float32Array | undefined {
    if (resource === "none") return undefined;

    this.preload(game);
    if (!this.cachedMap) return undefined;

    let buf = this.densityBuffers.get(resource);
    if (!buf) {
      buf = ProceduralHeatmapGenerator.generateDensityTexture(
        resource,
        game.width(),
        game.height(),
        this.cachedMap.tileDeposits,
        (tile: number) => game.isLand(tile as any),
      );
      this.densityBuffers.set(resource, buf);
    }
    return buf;
  }
}
