import { ResourceType } from "@openfront/engine-api/game/GameTypes";
import { ProceduralHeatmapGenerator } from "@openfront/engine-lib/game/ProceduralHeatmap";
import type { GameView } from "../../../view/GameView";

export class GeologicalDataService {
  private static cachedKey: string = "";
  private static densityBuffers = new Map<string, Uint8Array>();

  /**
   * Pre-calculates the geological density buffers at load time directly as flat Uint8Arrays.
   * Completely eliminates runtime stutter and lag when players open or toggle the heatmap.
   */
  public static preload(game: GameView): void {
    const width = game.width();
    const height = game.height();
    const key = `${width}_${height}`;

    if (this.cachedKey === key && this.densityBuffers.size > 0) {
      return;
    }

    this.cachedKey = key;
    this.densityBuffers = ProceduralHeatmapGenerator.generateDensityBuffers(
      width,
      height,
      2026,
      (tile: number) => game.isLand(tile as any),
    );
  }

  public static getDensityData(
    game: GameView,
    resource: ResourceType | "all" | "none",
  ): Uint8Array | undefined {
    if (resource === "none") return undefined;

    this.preload(game);
    return this.densityBuffers.get(resource);
  }
}
