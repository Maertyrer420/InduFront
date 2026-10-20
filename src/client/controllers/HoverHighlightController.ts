/**
 * HoverHighlightController — pushes the cursor's tile-owner to the WebGL
 * view so the territory + border passes can highlight the hovered player.
 *
 * Replaces the hover path inside the renderer's MapInteraction class (which
 * was bound to the WebGL canvas; that canvas has pointer-events: none in the
 * current input architecture so its listeners never fired). All input flows
 * through InputHandler → MouseMoveEvent on the EventBus, so we just listen.
 */

import { Structures, UnitType } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { Controller } from "../Controller";
import { MouseMoveEvent, ToggleEraserModeEvent } from "../InputHandler";
import { MapRenderer } from "../render/gl";
import { OWNER_MASK } from "../render/gl/utils/TileCodec";
import { TransformHandler } from "../TransformHandler";
import { UIState } from "../UIState";
import { GameView, UnitView } from "../view";

export class HoverHighlightController implements Controller {
  private lastOwnerID = 0;
  private lastDemolishHoverUnitId: number | null = null;

  constructor(
    private game: GameView,
    private eventBus: EventBus,
    private transformHandler: TransformHandler,
    private view: MapRenderer,
    private uiState?: UIState,
  ) {}

  init() {
    this.eventBus.on(MouseMoveEvent, (e) => this.onMouseMove(e));
    this.eventBus.on(ToggleEraserModeEvent, (e) => {
      if (!this.uiState?.isEraserMode || e.enabled === false) {
        if (this.lastDemolishHoverUnitId !== null) {
          this.lastDemolishHoverUnitId = null;
          this.view.setDemolishHover(null);
        }
      }
    });
  }

  private navalHighlightEnabled(): boolean {
    // getSettings() returns {} while the renderer is absent (before init, or
    // after a lost WebGL context), so mapOverlay may be missing.
    return this.view.getSettings().mapOverlay?.navalHighlight ?? false;
  }

  private onMouseMove(e: MouseMoveEvent): void {
    const world = this.transformHandler.screenToWorldCoordinatesFloat(e.x, e.y);
    this.view.setMouseWorldPos(world.x, world.y);

    if (this.uiState?.isEraserMode) {
      const myPlayer = this.game.myPlayer();
      let hoveredUnitId: number | null = null;
      if (myPlayer) {
        let minDistSq = 2.25; // within 1.5 tiles radius
        for (const u of myPlayer.units(...Structures.types)) {
          const ux = this.game.x(u.tile()) + 0.5;
          const uy = this.game.y(u.tile()) + 0.5;
          const distSq = (world.x - ux) * (world.x - ux) + (world.y - uy) * (world.y - uy);
          if (distSq < minDistSq) {
            minDistSq = distSq;
            hoveredUnitId = u.id();
          }
        }
      }
      if (hoveredUnitId !== this.lastDemolishHoverUnitId) {
        this.lastDemolishHoverUnitId = hoveredUnitId;
        this.view.setDemolishHover(hoveredUnitId);
      }
    } else if (this.lastDemolishHoverUnitId !== null) {
      this.lastDemolishHoverUnitId = null;
      this.view.setDemolishHover(null);
    }

    const cell = this.transformHandler.screenToWorldCoordinates(e.x, e.y);
    if (!this.game.isValidCoord(cell.x, cell.y)) {
      if (this.lastOwnerID !== 0) {
        this.lastOwnerID = 0;
        this.view.setHighlightOwner(0);
      }
      return;
    }
    let ownerID = 0;

    const ref = this.game.ref(cell.x, cell.y);
    if (this.game.isLand(ref)) {
      ownerID = this.game.tileState(ref) & OWNER_MASK;
    } else if (this.navalHighlightEnabled()) {
      // Avoid square root for performance; 50 tile radius = 2500 tiles²
      let closestUnit: UnitView | null = null;
      let closestDistSquared = 2500;
      for (const u of this.game.units(
        UnitType.Warship,
        UnitType.TradeShip,
        UnitType.TransportShip,
      )) {
        const distSquared = this.game.euclideanDistSquared(ref, u.tile());
        if (distSquared < closestDistSquared) {
          closestDistSquared = distSquared;
          closestUnit = u;
        }
      }
      if (closestUnit !== null) {
        ownerID = closestUnit.owner().smallID();
      }
    }

    if (ownerID === this.lastOwnerID) return;
    this.lastOwnerID = ownerID;
    this.view.setHighlightOwner(ownerID);
  }
}
