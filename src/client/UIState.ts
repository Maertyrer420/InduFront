import { PlayerBuildableUnitType } from "@openfront/engine-api/game/GameTypes";

export interface UIState {
  attackRatio: number;
  ghostStructure: PlayerBuildableUnitType | null;
  rocketDirectionUp: boolean;
  upgradeMultiplier: number;
  activeHotbarTab?: "buildings" | "actives";
  isEraserMode?: boolean;
  dontAskDemolishThisRound?: boolean;
}
