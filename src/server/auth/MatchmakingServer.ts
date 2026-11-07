import { CloseCode } from "@openfront/shared/CloseCodes";
import { type importJWK, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { RankedMode } from "../RankedCheckin";
import type { GameSocialStore } from "./GameSocialStore";

export type VerifyKey = Awaited<ReturnType<typeof importJWK>>;

export interface QueuedPlayer {
  ws: WebSocket;
  publicId: string;
  username: string;
  elo: number;
  gamesPlayed: number;
  joinedAt: number;
  mode: RankedMode;
  clanTag?: string;
  version?: string;
  site?: string;
}

export interface MatchmakingAssignment {
  players: string[];
  teams?: string[][];
  clanTags?: string[];
}

export class MatchmakingServer {
  private wss: WebSocketServer;
  private queues: Map<RankedMode, QueuedPlayer[]> = new Map([
    ["1v1", []],
    ["2v2", []],
    ["ffa", []],
    ["clanwars", []],
  ]);
  private playerSockets: Map<string, WebSocket> = new Map();
  private broadcastInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly socialStore: GameSocialStore,
    private readonly verifyKey: VerifyKey,
    private readonly issuer: string,
    private readonly audience: string,
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupWss();
    this.startHeartbeatBroadcast();
  }

  public attachToHttpServer(server: Server): void {
    server.on("upgrade", (req: IncomingMessage, socket, head) => {
      const url = req.url ?? "";
      if (
        url.startsWith("/matchmaking/join") ||
        url.startsWith("/idp/matchmaking/join")
      ) {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit("connection", ws, req);
        });
      }
    });
  }

  private setupWss(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const parsedUrl = new URL(req.url ?? "", "http://localhost");
      const rawMode = parsedUrl.searchParams.get("mode") ?? "1v1";
      const mode: RankedMode =
        rawMode === "2v2" || rawMode === "ffa" || rawMode === "clanwars"
          ? rawMode
          : "1v1";
      const version = parsedUrl.searchParams.get("version") ?? undefined;
      const site = parsedUrl.searchParams.get("site") ?? undefined;

      let player: QueuedPlayer | null = null;

      ws.on("message", async (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "join") {
            const { jwt, clanTag } = msg;
            if (!jwt) {
              ws.close(1008, "missing_token");
              return;
            }

            let publicId = "";
            let username = "Player";

            // Verify JWT
            try {
              const { payload } = await jwtVerify(jwt, this.verifyKey, {
                algorithms: ["EdDSA"],
                issuer: this.issuer,
                audience: this.audience,
              });
              publicId = String(
                payload.publicId ?? payload.sub ?? randomUUID(),
              );
              username = String(payload.username ?? "Player");
            } catch {
              // Tolerant fallback for persistent ID in local/dev environments
              if (
                typeof jwt === "string" &&
                jwt.length > 0 &&
                !jwt.includes(".")
              ) {
                publicId = jwt;
                username = "Commander";
              } else {
                ws.close(1008, "invalid_jwt");
                return;
              }
            }

            // Close existing connection for this account if duplicate tab/session
            const existingSocket = this.playerSockets.get(publicId);
            if (
              existingSocket &&
              existingSocket !== ws &&
              existingSocket.readyState === WebSocket.OPEN
            ) {
              existingSocket.close(CloseCode.Normal, "replaced");
            }

            // Fetch current stats & rating
            const stats = this.socialStore.getOrCreatePlayerStats(
              publicId,
              username,
            );
            const elo =
              mode === "1v1"
                ? stats.elo1v1
                : mode === "2v2"
                  ? stats.elo2v2
                  : stats.eloFfa;

            player = {
              ws,
              publicId,
              username,
              elo,
              gamesPlayed: stats.games,
              joinedAt: Date.now(),
              mode,
              clanTag: clanTag ?? undefined,
              version,
              site,
            };

            this.playerSockets.set(publicId, ws);
            const q = this.queues.get(mode) ?? [];
            // Remove any stale entries for this publicId
            const filtered = q.filter((p) => p.publicId !== publicId);
            filtered.push(player);
            this.queues.set(mode, filtered);

            // Immediately send current queue size
            this.sendQueueSizeToPlayer(player);
          }
        } catch (err) {
          console.error("[Matchmaking] Error handling message:", err);
        }
      });

      const cleanup = () => {
        if (player) {
          this.removePlayerFromQueue(player);
          if (this.playerSockets.get(player.publicId) === ws) {
            this.playerSockets.delete(player.publicId);
          }
          player = null;
        }
      };

      ws.on("close", cleanup);
      ws.on("error", cleanup);
    });
  }

  private removePlayerFromQueue(player: QueuedPlayer): void {
    const q = this.queues.get(player.mode);
    if (q) {
      this.queues.set(
        player.mode,
        q.filter((p) => p !== player && p.publicId !== player.publicId),
      );
    }
  }

  private sendQueueSizeToPlayer(player: QueuedPlayer): void {
    if (player.ws.readyState !== WebSocket.OPEN) return;
    const q = this.queues.get(player.mode) ?? [];
    let clanCount: number | undefined;
    if (player.mode === "clanwars" && player.clanTag) {
      clanCount = q.filter(
        (p) => p.clanTag?.toUpperCase() === player.clanTag?.toUpperCase(),
      ).length;
    }
    player.ws.send(
      JSON.stringify({
        type: "queue-size",
        count: q.length,
        ...(clanCount !== undefined ? { clanCount } : {}),
      }),
    );
  }

  private startHeartbeatBroadcast(): void {
    this.broadcastInterval = setInterval(() => {
      for (const [mode, q] of this.queues.entries()) {
        const alivePlayers: QueuedPlayer[] = [];
        for (const p of q) {
          if (p.ws.readyState === WebSocket.OPEN) {
            alivePlayers.push(p);
            this.sendQueueSizeToPlayer(p);
          }
        }
        this.queues.set(mode, alivePlayers);
      }
    }, 2500);
  }

  public stop(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    this.wss.close();
  }

  /**
   * Called by POST /matchmaking/checkin when a game server worker is ready to host a match.
   */
  public handleCheckin(
    mode: RankedMode,
    gameId: string,
    _workerId: number,
  ): MatchmakingAssignment | null {
    const q = (this.queues.get(mode) ?? []).filter(
      (p) => p.ws.readyState === WebSocket.OPEN,
    );
    this.queues.set(mode, q);

    if (mode === "1v1") {
      if (q.length < 2) return null;

      // Oldest waiting player
      q.sort((a, b) => a.joinedAt - b.joinedAt);
      const p1 = q[0];

      // Find closest Elo opponent
      let bestIdx = 1;
      let minEloDiff = Math.abs(q[1].elo - p1.elo);
      for (let i = 2; i < q.length; i++) {
        const diff = Math.abs(q[i].elo - p1.elo);
        if (diff < minEloDiff) {
          minEloDiff = diff;
          bestIdx = i;
        }
      }
      const p2 = q[bestIdx];

      // Remove from queue
      this.queues.set(
        mode,
        q.filter((p) => p !== p1 && p !== p2),
      );

      // Notify clients
      this.notifyMatchAssigned([p1, p2], gameId);

      return {
        players: [p1.publicId, p2.publicId],
        teams: [[p1.publicId], [p2.publicId]],
      };
    }

    if (mode === "2v2") {
      if (q.length < 4) return null;

      q.sort((a, b) => a.joinedAt - b.joinedAt);
      const candidates = q.slice(0, 4);

      // Balanced snake draft by rating
      candidates.sort((a, b) => b.elo - a.elo);
      const team1 = [candidates[0], candidates[3]];
      const team2 = [candidates[1], candidates[2]];

      this.queues.set(
        mode,
        q.filter((p) => !candidates.includes(p)),
      );

      this.notifyMatchAssigned(candidates, gameId);

      return {
        players: candidates.map((p) => p.publicId),
        teams: [team1.map((p) => p.publicId), team2.map((p) => p.publicId)],
      };
    }

    if (mode === "ffa") {
      if (q.length < 2) return null;

      q.sort((a, b) => a.joinedAt - b.joinedAt);
      const oldestWait = Date.now() - q[0].joinedAt;

      // Start match if at least 4 players or wait time > 10s
      if (q.length >= 4 || oldestWait >= 10000) {
        const matchCount = Math.min(8, q.length);
        const candidates = q.slice(0, matchCount);

        this.queues.set(
          mode,
          q.filter((p) => !candidates.includes(p)),
        );

        this.notifyMatchAssigned(candidates, gameId);

        return {
          players: candidates.map((p) => p.publicId),
          teams: candidates.map((p) => [p.publicId]),
        };
      }
      return null;
    }

    if (mode === "clanwars") {
      if (q.length < 2) return null;

      // Find two players from different clans
      let p1: QueuedPlayer | null = null;
      let p2: QueuedPlayer | null = null;
      for (let i = 0; i < q.length; i++) {
        for (let j = i + 1; j < q.length; j++) {
          if (
            q[i].clanTag &&
            q[j].clanTag &&
            q[i].clanTag?.toUpperCase() !== q[j].clanTag?.toUpperCase()
          ) {
            p1 = q[i];
            p2 = q[j];
            break;
          }
        }
        if (p1 && p2) break;
      }

      if (!p1 || !p2) return null;

      this.queues.set(
        mode,
        q.filter((p) => p !== p1 && p !== p2),
      );

      this.notifyMatchAssigned([p1, p2], gameId);

      return {
        players: [p1.publicId, p2.publicId],
        teams: [[p1.publicId], [p2.publicId]],
        clanTags: [p1.clanTag!, p2.clanTag!],
      };
    }

    return null;
  }

  private notifyMatchAssigned(players: QueuedPlayer[], gameId: string): void {
    const message = JSON.stringify({
      type: "match-assignment",
      gameId,
    });
    for (const p of players) {
      if (p.ws.readyState === WebSocket.OPEN) {
        try {
          p.ws.send(message);
        } catch (err) {
          console.warn(
            "[Matchmaking] Failed to send assignment to player:",
            err,
          );
        }
      }
    }
  }

  public getQueueStats(): Record<RankedMode, number> {
    return {
      "1v1": this.queues.get("1v1")?.length ?? 0,
      "2v2": this.queues.get("2v2")?.length ?? 0,
      ffa: this.queues.get("ffa")?.length ?? 0,
      clanwars: this.queues.get("clanwars")?.length ?? 0,
    };
  }
}
