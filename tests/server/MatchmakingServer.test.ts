import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { MatchmakingServer } from "../../src/server/auth/MatchmakingServer";

function createMockSocket(): any {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};
  return {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn((event: string, fn: (...args: any[]) => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(fn);
    }),
    emit: (event: string, ...args: any[]) => {
      listeners[event]?.forEach((fn) => fn(...args));
    },
  };
}

describe("MatchmakingServer", () => {
  it("initializes and handles queue stats", () => {
    const mockSocialStore: any = {
      getOrCreatePlayerStats: vi.fn().mockReturnValue({
        elo1v1: 1000,
        elo2v2: 1000,
        eloFfa: 1000,
        games: 10,
      }),
    };
    const server = new MatchmakingServer(
      mockSocialStore,
      "dummy-key" as any,
      "http://localhost:8787",
      "localhost",
    );

    expect(server.getQueueStats()).toEqual({
      "1v1": 0,
      "2v2": 0,
      ffa: 0,
      clanwars: 0,
    });

    server.stop();
  });

  it("assigns 1v1 match when 2 players check in", () => {
    const mockSocialStore: any = {
      getOrCreatePlayerStats: vi.fn().mockReturnValue({
        elo1v1: 1200,
        games: 20,
      }),
    };
    const server = new MatchmakingServer(
      mockSocialStore,
      "dummy-key" as any,
      "http://localhost:8787",
      "localhost",
    );

    const s1 = createMockSocket();
    const s2 = createMockSocket();

    // Directly simulate queued players by mocking internal queue
    (server as any).queues.set("1v1", [
      {
        ws: s1,
        publicId: "player1",
        username: "P1",
        elo: 1200,
        gamesPlayed: 10,
        joinedAt: 1000,
        mode: "1v1",
      },
      {
        ws: s2,
        publicId: "player2",
        username: "P2",
        elo: 1250,
        gamesPlayed: 10,
        joinedAt: 1005,
        mode: "1v1",
      },
    ]);

    const assignment = server.handleCheckin("1v1", "game-123", 0);
    expect(assignment).not.toBeNull();
    expect(assignment?.players).toEqual(["player1", "player2"]);
    expect(assignment?.teams).toEqual([["player1"], ["player2"]]);

    expect(s1.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "match-assignment", gameId: "game-123" }),
    );
    expect(s2.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "match-assignment", gameId: "game-123" }),
    );

    // Queue should now be empty
    expect(server.getQueueStats()["1v1"]).toBe(0);

    server.stop();
  });

  it("returns null when not enough players for 1v1", () => {
    const mockSocialStore: any = { getOrCreatePlayerStats: vi.fn() };
    const server = new MatchmakingServer(
      mockSocialStore,
      "dummy-key" as any,
      "http://localhost:8787",
      "localhost",
    );

    const s1 = createMockSocket();
    (server as any).queues.set("1v1", [
      {
        ws: s1,
        publicId: "player1",
        username: "P1",
        elo: 1200,
        gamesPlayed: 10,
        joinedAt: 1000,
        mode: "1v1",
      },
    ]);

    const assignment = server.handleCheckin("1v1", "game-123", 0);
    expect(assignment).toBeNull();
    expect(s1.send).not.toHaveBeenCalled();

    server.stop();
  });

  it("balances teams for 2v2 matches with snake draft", () => {
    const mockSocialStore: any = { getOrCreatePlayerStats: vi.fn() };
    const server = new MatchmakingServer(
      mockSocialStore,
      "dummy-key" as any,
      "http://localhost:8787",
      "localhost",
    );

    const s1 = createMockSocket();
    const s2 = createMockSocket();
    const s3 = createMockSocket();
    const s4 = createMockSocket();

    (server as any).queues.set("2v2", [
      { ws: s1, publicId: "p1", elo: 1800, joinedAt: 1, mode: "2v2" },
      { ws: s2, publicId: "p2", elo: 1600, joinedAt: 2, mode: "2v2" },
      { ws: s3, publicId: "p3", elo: 1400, joinedAt: 3, mode: "2v2" },
      { ws: s4, publicId: "p4", elo: 1200, joinedAt: 4, mode: "2v2" },
    ]);

    const assignment = server.handleCheckin("2v2", "game-2v2", 0);
    expect(assignment).not.toBeNull();
    expect(assignment?.players).toHaveLength(4);
    // Snake draft: [p1(1800), p4(1200)] avg 1500, [p2(1600), p3(1400)] avg 1500
    expect(assignment?.teams).toEqual([
      ["p1", "p4"],
      ["p2", "p3"],
    ]);

    server.stop();
  });
});
