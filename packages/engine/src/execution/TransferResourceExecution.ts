import {
  MessageType,
  PlayerType,
  RefinedType,
  ResourceType,
} from "@openfront/engine-api/game/GameTypes";
import { TransferResourceIntent } from "@openfront/engine-api/Schemas";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { EconomyExecution } from "./EconomyExecution";

export class TransferResourceExecution implements Execution {
  private active = false;

  constructor(
    private readonly sender: Player,
    private readonly intent: TransferResourceIntent,
    private readonly economyExec?: EconomyExecution,
  ) {}

  public init(mg: Game, _ticks: number): void {
    const targetPlayer = mg.player(this.intent.targetPlayerID);
    if (!targetPlayer || !targetPlayer.isAlive() || !this.sender.isAlive()) {
      return;
    }

    const { resource, amount } = this.intent;
    if (amount <= 0) return;

    if (resource === "gold") {
      if (this.sender.gold() >= BigInt(amount)) {
        this.sender.removeGold(BigInt(amount));
        targetPlayer.addGold(BigInt(amount));
      }
    } else if (this.economyExec) {
      const senderEcon =
        this.economyExec.playerEconomies.get(this.sender.smallID()) ??
        this.economyExec.initPlayerEconomy(this.sender);
      const targetEcon =
        this.economyExec.playerEconomies.get(targetPlayer.smallID()) ??
        this.economyExec.initPlayerEconomy(targetPlayer);

      let transferred = false;
      if (senderEcon && targetEcon) {
        if (resource in senderEcon.resources) {
          const resKey = resource as ResourceType;
          if ((senderEcon.resources[resKey] || 0) >= amount) {
            senderEcon.resources[resKey] -= amount;
            targetEcon.resources[resKey] =
              (targetEcon.resources[resKey] || 0) + amount;
            transferred = true;
          }
        } else if (resource in senderEcon.refined) {
          const refKey = resource as RefinedType;
          if ((senderEcon.refined[refKey] || 0) >= amount) {
            senderEcon.refined[refKey] -= amount;
            targetEcon.refined[refKey] =
              (targetEcon.refined[refKey] || 0) + amount;
            transferred = true;
          }
        }
      }

      if (transferred) {
        // Notification for human receiver when receiving aid/trade
        if (targetPlayer.type() === PlayerType.Human) {
          mg.displayMessage(
            "events_display.received_resource_from_player",
            MessageType.DONATION_RECEIVED,
            targetPlayer.id(),
            undefined,
            {
              name: this.sender.displayName(),
              resource,
              amount,
            },
            undefined,
            this.sender.id(),
          );
        }

        // Diplomacy relation boost if human donates to an AI ally
        if (
          this.sender.type() === PlayerType.Human &&
          targetPlayer.type() === PlayerType.Bot
        ) {
          const relBoost = Math.min(25, Math.max(5, Math.floor(amount / 5)));
          targetPlayer.updateRelation(this.sender, relBoost);
        }
      }
    }
  }

  public tick(_ticks: number): void {}

  public isActive(): boolean {
    return this.active;
  }

  public activeDuringSpawnPhase(): boolean {
    return false;
  }

  public snapshot(_w: SnapshotWriter): ExecRecord {
    return TransferResourceExecutionSnapshot.write({
      active: this.active,
    });
  }

  public restoreSnapshot(s: TransferResourceState, _r: SnapshotReader): void {
    this.active = s.active;
  }
}

const TransferResourceStateSchema = z.object({
  active: z.boolean(),
});
type TransferResourceState = z.infer<typeof TransferResourceStateSchema>;

export const TransferResourceExecutionSnapshot = execSnapshotType({
  name: "TransferResource",
  version: 1,
  schema: TransferResourceStateSchema,
  cls: () => TransferResourceExecution,
});
