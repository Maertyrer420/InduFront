import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { UserRecord } from "./AuthStore";
import { dbLoadSocialData, dbSaveSocialData } from "./DbStorage";

export type ClanRole = "Owner" | "Admin" | "Supporter" | "Mitglied";

export interface ClanMemberRecord {
  publicId: string;
  username: string;
  role: ClanRole;
  joinedAt: string;
  stats?: {
    total: { wins: number; losses: number };
  };
  eloContributed?: number;
}

export interface ClanJoinRequestRecord {
  publicId: string;
  username: string;
  createdAt: string;
}

export interface ClanBanRecord {
  publicId: string;
  username: string;
  bannedBy: string;
  bannedByUsername: string;
}

export interface ClanChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: ClanRole;
  text: string;
  timestamp: string;
}

export interface ClanRecord {
  tag: string;
  name: string;
  description: string;
  isOpen: boolean;
  createdAt: string;
  ownerPublicId: string;
  members: ClanMemberRecord[];
  requests: ClanJoinRequestRecord[];
  bans: ClanBanRecord[];
  chat: ClanChatMessage[];
  wins: number;
  losses: number;
  games: number;
  elo: number;
}

export interface PlayerStatsRecord {
  publicId: string;
  username: string;
  qp: number; // Quickplay Punkte
  elo1v1: number;
  elo2v2: number;
  eloFfa: number;
  peakElo: number;
  wins: number;
  losses: number;
  games: number;
  level: number;
  lastPlayedAt?: string;
}

export interface MatchHistoryPlayer {
  publicId: string;
  username: string;
  placement: number;
  winner: boolean;
  kills: number;
  territory: number;
  qpEarned: number;
  eloChange: number;
}

export interface MatchRecord {
  gameId: string;
  timestamp: string;
  gameType: string;
  rankedType: string;
  durationSeconds: number;
  players: MatchHistoryPlayer[];
}

export interface GlobalChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderClan?: string;
  senderTier: string;
  text: string;
  timestamp: string;
}

export interface DirectChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  text: string;
  timestamp: string;
}

export interface TribeLeaderboardEntry {
  rank: number;
  tribe: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  rating: number;
}

export function getEloTier(elo: number, rank?: number): string {
  if (rank !== undefined && rank <= 10 && rank > 0) return "Top 10";
  if (elo >= 2000) return "Elite";
  if (elo >= 1800) return "Expert";
  if (elo >= 1600) return "Diamond";
  if (elo >= 1400) return "Platinum";
  if (elo >= 1200) return "Gold";
  if (elo >= 1000) return "Silber";
  if (elo >= 800) return "Bronze";
  return "Wood";
}

export function calculateQpPoints(placement: number): number {
  switch (placement) {
    case 1:
      return 100;
    case 2:
      return 65;
    case 3:
      return 45;
    case 4:
      return 30;
    case 5:
      return 20;
    case 6:
      return 12;
    case 7:
      return 7;
    case 8:
      return 4;
    case 9:
      return 2;
    case 10:
      return 1;
    default:
      return 0;
  }
}

interface StoreData {
  clans: ClanRecord[];
  playerStats: Record<string, PlayerStatsRecord>;
  matches: MatchRecord[];
  globalChat: GlobalChatMessage[];
  directChat: DirectChatMessage[];
}

export class GameSocialStore {
  private data: StoreData = {
    clans: [],
    playerStats: {},
    matches: [],
    globalChat: [],
    directChat: [],
  };

  // In-memory heartbeat tracker: publicId -> timestamp
  private presence = new Map<string, number>();
  private backupPath: string;

  constructor(private readonly filePath: string) {
    this.backupPath = this.filePath + ".backup";
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    let loaded = false;
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        this.data = JSON.parse(raw);
        loaded = true;
      } catch {
        console.warn(
          `[social-store] Failed to parse ${filePath}, checking backup...`,
        );
      }
    }

    if (!loaded && fs.existsSync(this.backupPath)) {
      try {
        const raw = fs.readFileSync(this.backupPath, "utf8");
        this.data = JSON.parse(raw);
        console.log(`[social-store] Restored from backup: ${this.backupPath}`);
      } catch {
        /* ignore corrupted backup */
      }
    }

    this.data.clans ??= [];
    this.data.playerStats ??= {};
    this.data.matches ??= [];
    this.data.globalChat ??= [];
    this.data.directChat ??= [];

    this.seedDefaultBotTribes();
    void this.syncFromDb();
  }

  private async syncFromDb(): Promise<void> {
    try {
      const dbData = await dbLoadSocialData();
      if (dbData) {
        if (dbData.clans && dbData.clans.length > 0)
          this.data.clans = dbData.clans;
        if (dbData.playerStats && Object.keys(dbData.playerStats).length > 0) {
          this.data.playerStats = {
            ...this.data.playerStats,
            ...dbData.playerStats,
          };
        }
        if (dbData.matches && dbData.matches.length > 0)
          this.data.matches = dbData.matches;
        if (dbData.globalChat && dbData.globalChat.length > 0)
          this.data.globalChat = dbData.globalChat;
        if (dbData.directChat && dbData.directChat.length > 0)
          this.data.directChat = dbData.directChat;
        this.save(false);
        console.log("[social-store] Synchronized social data from PostgreSQL.");
      }
    } catch (err: any) {
      console.warn("[social-store] syncFromDb:", err.message);
    }
  }

  private save(syncDb = true): void {
    try {
      const json = JSON.stringify(this.data, null, 2);
      const tmp = this.filePath + ".tmp";
      fs.writeFileSync(tmp, json);
      fs.renameSync(tmp, this.filePath);
      fs.writeFileSync(this.backupPath, json);
    } catch (err) {
      console.warn("[social-store] Error writing file:", err);
    }
    if (syncDb) {
      dbSaveSocialData(this.data).catch(() => {});
    }
  }

  // ---- PRESENCE TRACKING ----
  public recordPing(publicId: string): void {
    if (!publicId) return;
    this.presence.set(publicId.toLowerCase(), Date.now());
  }

  public getOnlineCount(): number {
    const now = Date.now();
    let count = 0;
    for (const lastSeen of this.presence.values()) {
      if (now - lastSeen < 120_000) count++;
    }
    // Return at least 1 when active, plus a realistic baseline if few players
    return Math.max(count, 1);
  }

  public getOnlineFriends(friendPublicIds: string[]): string[] {
    const now = Date.now();
    const online: string[] = [];
    for (const fid of friendPublicIds) {
      const lastSeen = this.presence.get(fid.toLowerCase());
      if (lastSeen && now - lastSeen < 120_000) {
        online.push(fid);
      }
    }
    return online;
  }

  // ---- CLANS ----
  public getClans(): ClanRecord[] {
    return this.data.clans;
  }

  public getClan(tag: string): ClanRecord | undefined {
    const t = tag.trim().toUpperCase();
    return this.data.clans.find((c) => c.tag === t);
  }

  public getClansForUser(publicId: string): ClanRecord[] {
    const p = publicId.toLowerCase();
    return this.data.clans.filter((c) =>
      c.members.some((m) => m.publicId.toLowerCase() === p),
    );
  }

  public createClan(
    user: UserRecord,
    opts: { tag: string; name: string; description: string; isOpen?: boolean },
  ): { ok: true; clan: ClanRecord } | { ok: false; error: string } {
    const tag = opts.tag.trim().toUpperCase();
    if (tag.length < 2 || tag.length > 5 || !/^[A-Z0-9]+$/.test(tag)) {
      return { ok: false, error: "Ungültiger Clan-Tag (2-5 Zeichen A-Z, 0-9)" };
    }
    if (this.getClan(tag)) {
      return { ok: false, error: "Clan-Tag existiert bereits" };
    }
    const name = opts.name.trim();
    if (name.length < 3 || name.length > 35) {
      return { ok: false, error: "Clan-Name muss 3-35 Zeichen lang sein" };
    }

    const clan: ClanRecord = {
      tag,
      name,
      description: (opts.description ?? "").slice(0, 200),
      isOpen: opts.isOpen ?? true,
      createdAt: new Date().toISOString(),
      ownerPublicId: user.publicId,
      members: [
        {
          publicId: user.publicId,
          username: user.username,
          role: "Owner",
          joinedAt: new Date().toISOString(),
          stats: { total: { wins: 0, losses: 0 } },
          eloContributed: 0,
        },
      ],
      requests: [],
      bans: [],
      chat: [
        {
          id: randomUUID(),
          senderId: "system",
          senderName: "System",
          senderRole: "Owner",
          text: `Clan [${tag}] wurde von ${user.username} gegründet! Willkommen!`,
          timestamp: new Date().toISOString(),
        },
      ],
      wins: 0,
      losses: 0,
      games: 0,
      elo: 1000,
    };

    this.data.clans.push(clan);
    this.save();
    return { ok: true, clan };
  }

  public updateClan(
    user: UserRecord,
    tag: string,
    patch: { name?: string; description?: string; isOpen?: boolean },
  ): { ok: true; clan: ClanRecord } | { ok: false; error: string } {
    const clan = this.getClan(tag);
    if (!clan) return { ok: false, error: "Clan nicht gefunden" };
    const member = clan.members.find(
      (m) => m.publicId.toLowerCase() === user.publicId.toLowerCase(),
    );
    if (!member || (member.role !== "Owner" && member.role !== "Admin")) {
      return {
        ok: false,
        error: "Nur Owner und Admin dürfen Clan-Einstellungen ändern",
      };
    }

    if (patch.name && patch.name.trim().length >= 3) {
      clan.name = patch.name.trim().slice(0, 35);
    }
    if (patch.description !== undefined) {
      clan.description = patch.description.trim().slice(0, 200);
    }
    if (patch.isOpen !== undefined) {
      clan.isOpen = Boolean(patch.isOpen);
    }

    this.save();
    return { ok: true, clan };
  }

  public changeMemberRole(
    user: UserRecord,
    tag: string,
    targetPublicId: string,
    newRole: ClanRole,
  ): { ok: true } | { ok: false; error: string } {
    const clan = this.getClan(tag);
    if (!clan) return { ok: false, error: "Clan nicht gefunden" };

    const caller = clan.members.find(
      (m) => m.publicId.toLowerCase() === user.publicId.toLowerCase(),
    );
    if (!caller || (caller.role !== "Owner" && caller.role !== "Admin")) {
      return { ok: false, error: "Keine Berechtigung zum Ändern von Rängen" };
    }

    // Owner cannot be assigned to anyone else! Only creator is Owner.
    if (newRole === "Owner") {
      return {
        ok: false,
        error:
          "Owner-Rang kann nicht vergeben werden (nur der Clan-Gründer ist Owner)",
      };
    }

    const target = clan.members.find(
      (m) => m.publicId.toLowerCase() === targetPublicId.toLowerCase(),
    );
    if (!target) return { ok: false, error: "Mitglied nicht gefunden" };

    if (target.role === "Owner") {
      return {
        ok: false,
        error: "Der Rang des Clan-Owners kann nicht geändert werden",
      };
    }

    // Admins cannot change other Admins or demote without being Owner
    if (
      caller.role === "Admin" &&
      target.role === "Admin" &&
      caller.publicId !== target.publicId
    ) {
      return {
        ok: false,
        error: "Admins können andere Admins nicht bearbeiten",
      };
    }

    target.role = newRole;
    this.save();
    return { ok: true };
  }

  public kickMember(
    user: UserRecord,
    tag: string,
    targetPublicId: string,
  ): { ok: true } | { ok: false; error: string } {
    const clan = this.getClan(tag);
    if (!clan) return { ok: false, error: "Clan nicht gefunden" };

    const caller = clan.members.find(
      (m) => m.publicId.toLowerCase() === user.publicId.toLowerCase(),
    );
    if (!caller)
      return { ok: false, error: "Du bist kein Mitglied dieses Clans" };

    const target = clan.members.find(
      (m) => m.publicId.toLowerCase() === targetPublicId.toLowerCase(),
    );
    if (!target) return { ok: false, error: "Zielspieler nicht im Clan" };

    if (target.role === "Owner") {
      return { ok: false, error: "Der Owner kann nicht gekickt werden" };
    }

    // Permissions:
    // Owner & Admin: can kick Admin, Supporter, Mitglied
    // Supporter: can kick ONLY Mitglied
    // Mitglied: cannot kick
    if (caller.role === "Supporter") {
      if (target.role !== "Mitglied") {
        return {
          ok: false,
          error: "Supporter können nur normale Mitglieder kicken",
        };
      }
    } else if (caller.role === "Admin") {
      if (target.role === "Admin" && caller.publicId !== target.publicId) {
        return { ok: false, error: "Admins können andere Admins nicht kicken" };
      }
    } else if (caller.role !== "Owner") {
      return { ok: false, error: "Keine Berechtigung zum Kicken" };
    }

    clan.members = clan.members.filter(
      (m) => m.publicId.toLowerCase() !== targetPublicId.toLowerCase(),
    );
    this.save();
    return { ok: true };
  }

  public joinOrRequestClan(
    user: UserRecord,
    tag: string,
  ):
    | { ok: true; status: "joined" | "requested" }
    | { ok: false; error: string } {
    const clan = this.getClan(tag);
    if (!clan) return { ok: false, error: "Clan nicht gefunden" };

    const p = user.publicId.toLowerCase();
    if (clan.members.some((m) => m.publicId.toLowerCase() === p)) {
      return { ok: false, error: "Bereits Mitglied im Clan" };
    }
    if (clan.bans.some((b) => b.publicId.toLowerCase() === p)) {
      return { ok: false, error: "Du bist aus diesem Clan gebannt" };
    }

    if (clan.isOpen) {
      clan.members.push({
        publicId: user.publicId,
        username: user.username,
        role: "Mitglied",
        joinedAt: new Date().toISOString(),
        stats: { total: { wins: 0, losses: 0 } },
        eloContributed: 0,
      });
      clan.requests = clan.requests.filter(
        (r) => r.publicId.toLowerCase() !== p,
      );
      this.save();
      return { ok: true, status: "joined" };
    } else {
      if (clan.requests.some((r) => r.publicId.toLowerCase() === p)) {
        return { ok: false, error: "Beitrittsanfrage läuft bereits" };
      }
      clan.requests.push({
        publicId: user.publicId,
        username: user.username,
        createdAt: new Date().toISOString(),
      });
      this.save();
      return { ok: true, status: "requested" };
    }
  }

  public leaveClan(
    user: UserRecord,
    tag: string,
  ): { ok: true } | { ok: false; error: string } {
    const clan = this.getClan(tag);
    if (!clan) return { ok: false, error: "Clan nicht gefunden" };
    const p = user.publicId.toLowerCase();
    const member = clan.members.find((m) => m.publicId.toLowerCase() === p);
    if (!member) return { ok: false, error: "Nicht im Clan" };

    if (member.role === "Owner") {
      return {
        ok: false,
        error: "Als Owner musst du den Clan auflösen, um ihn zu verlassen",
      };
    }

    clan.members = clan.members.filter((m) => m.publicId.toLowerCase() !== p);
    this.save();
    return { ok: true };
  }

  public approveRequest(
    user: UserRecord,
    tag: string,
    targetPublicId: string,
  ): { ok: true } | { ok: false; error: string } {
    const clan = this.getClan(tag);
    if (!clan) return { ok: false, error: "Clan nicht gefunden" };

    const caller = clan.members.find(
      (m) => m.publicId.toLowerCase() === user.publicId.toLowerCase(),
    );
    // Owner, Admin, and Supporter can approve join requests
    if (
      !caller ||
      (caller.role !== "Owner" &&
        caller.role !== "Admin" &&
        caller.role !== "Supporter")
    ) {
      return {
        ok: false,
        error: "Keine Berechtigung zum Annehmen von Anfragen",
      };
    }

    const reqIdx = clan.requests.findIndex(
      (r) => r.publicId.toLowerCase() === targetPublicId.toLowerCase(),
    );
    if (reqIdx < 0) return { ok: false, error: "Anfrage nicht gefunden" };

    const req = clan.requests[reqIdx];
    clan.requests.splice(reqIdx, 1);

    if (
      !clan.members.some(
        (m) => m.publicId.toLowerCase() === targetPublicId.toLowerCase(),
      )
    ) {
      clan.members.push({
        publicId: req.publicId,
        username: req.username,
        role: "Mitglied",
        joinedAt: new Date().toISOString(),
        stats: { total: { wins: 0, losses: 0 } },
        eloContributed: 0,
      });
    }
    this.save();
    return { ok: true };
  }

  public denyRequest(
    user: UserRecord,
    tag: string,
    targetPublicId: string,
  ): { ok: true } | { ok: false; error: string } {
    const clan = this.getClan(tag);
    if (!clan) return { ok: false, error: "Clan nicht gefunden" };

    const caller = clan.members.find(
      (m) => m.publicId.toLowerCase() === user.publicId.toLowerCase(),
    );
    if (
      !caller ||
      (caller.role !== "Owner" &&
        caller.role !== "Admin" &&
        caller.role !== "Supporter")
    ) {
      return {
        ok: false,
        error: "Keine Berechtigung zum Ablehnen von Anfragen",
      };
    }

    clan.requests = clan.requests.filter(
      (r) => r.publicId.toLowerCase() !== targetPublicId.toLowerCase(),
    );
    this.save();
    return { ok: true };
  }

  public disbandClan(
    user: UserRecord,
    tag: string,
  ): { ok: true } | { ok: false; error: string } {
    const clan = this.getClan(tag);
    if (!clan) return { ok: false, error: "Clan nicht gefunden" };
    if (clan.ownerPublicId.toLowerCase() !== user.publicId.toLowerCase()) {
      return { ok: false, error: "Nur der Clan-Owner kann den Clan auflösen" };
    }

    this.data.clans = this.data.clans.filter((c) => c.tag !== clan.tag);
    this.save();
    return { ok: true };
  }

  // ---- PERSISTENT CLAN CHAT ----
  public getClanChat(user: UserRecord, tag: string): ClanChatMessage[] | null {
    const clan = this.getClan(tag);
    if (!clan) return null;
    const member = clan.members.find(
      (m) => m.publicId.toLowerCase() === user.publicId.toLowerCase(),
    );
    if (!member) return null;
    return clan.chat ?? [];
  }

  public addClanChatMessage(
    user: UserRecord,
    tag: string,
    text: string,
  ): ClanChatMessage | null {
    const clan = this.getClan(tag);
    if (!clan) return null;
    const member = clan.members.find(
      (m) => m.publicId.toLowerCase() === user.publicId.toLowerCase(),
    );
    if (!member) return null;

    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return null;

    clan.chat ??= [];
    const msg: ClanChatMessage = {
      id: randomUUID(),
      senderId: user.publicId,
      senderName: user.username,
      senderRole: member.role,
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    clan.chat.push(msg);
    if (clan.chat.length > 500) {
      clan.chat = clan.chat.slice(-500);
    }
    this.save();
    return msg;
  }

  // ---- GLOBAL & DIRECT CHAT ----
  public getGlobalChat(limit = 50): GlobalChatMessage[] {
    return this.data.globalChat.slice(-limit);
  }

  public addGlobalChatMessage(
    user: UserRecord,
    text: string,
  ): GlobalChatMessage | null {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return null;

    const stats = this.getOrCreatePlayerStats(user.publicId, user.username);
    const userClans = this.getClansForUser(user.publicId);
    const clanTag = userClans.length > 0 ? userClans[0].tag : undefined;
    const tier = getEloTier(stats.eloFfa);

    const msg: GlobalChatMessage = {
      id: randomUUID(),
      senderId: user.publicId,
      senderName: user.username,
      senderClan: clanTag,
      senderTier: tier,
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    this.data.globalChat.push(msg);
    if (this.data.globalChat.length > 500) {
      this.data.globalChat = this.data.globalChat.slice(-500);
    }
    this.save();
    return msg;
  }

  public getDirectChat(
    userPublicId: string,
    friendPublicId: string,
    limit = 50,
  ): DirectChatMessage[] {
    const u1 = userPublicId.toLowerCase();
    const u2 = friendPublicId.toLowerCase();
    return this.data.directChat
      .filter(
        (m) =>
          (m.fromId.toLowerCase() === u1 && m.toId.toLowerCase() === u2) ||
          (m.fromId.toLowerCase() === u2 && m.toId.toLowerCase() === u1),
      )
      .slice(-limit);
  }

  public addDirectChatMessage(
    user: UserRecord,
    targetPublicId: string,
    targetUsername: string,
    text: string,
  ): DirectChatMessage | null {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return null;

    const msg: DirectChatMessage = {
      id: randomUUID(),
      fromId: user.publicId,
      fromName: user.username,
      toId: targetPublicId,
      toName: targetUsername,
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    this.data.directChat.push(msg);
    if (this.data.directChat.length > 1000) {
      this.data.directChat = this.data.directChat.slice(-1000);
    }
    this.save();
    return msg;
  }

  // ---- PLAYER STATS, MATCH HISTORY & LEADERBOARDS ----
  public getOrCreatePlayerStats(
    publicId: string,
    username: string,
  ): PlayerStatsRecord {
    const key = publicId.toLowerCase();
    if (!this.data.playerStats[key]) {
      this.data.playerStats[key] = {
        publicId,
        username,
        qp: 0,
        elo1v1: 1000,
        elo2v2: 1000,
        eloFfa: 1000,
        peakElo: 1000,
        wins: 0,
        losses: 0,
        games: 0,
        level: 1,
      };
      this.save();
    }
    return this.data.playerStats[key];
  }

  public getPlayerMatches(publicId: string): MatchRecord[] {
    const p = publicId.toLowerCase();
    return this.data.matches
      .filter((m) => m.players.some((pl) => pl.publicId.toLowerCase() === p))
      .slice(-10)
      .reverse();
  }

  public recordFinishedMatch(match: MatchRecord): void {
    this.data.matches.push(match);
    if (this.data.matches.length > 1000) {
      this.data.matches = this.data.matches.slice(-1000);
    }

    // Update player records
    for (const p of match.players) {
      const stats = this.getOrCreatePlayerStats(p.publicId, p.username);
      stats.games++;
      if (p.winner) {
        stats.wins++;
      } else {
        stats.losses++;
      }
      stats.qp += p.qpEarned;
      stats.lastPlayedAt = match.timestamp;

      // Update ranked elo according to match type
      if (match.rankedType === "1v1") {
        stats.elo1v1 = Math.max(100, stats.elo1v1 + p.eloChange);
        stats.peakElo = Math.max(stats.peakElo, stats.elo1v1);
      } else if (match.rankedType === "2v2") {
        stats.elo2v2 = Math.max(100, stats.elo2v2 + p.eloChange);
        stats.peakElo = Math.max(stats.peakElo, stats.elo2v2);
      } else {
        // Default FFA / Quickplay
        stats.eloFfa = Math.max(100, stats.eloFfa + p.eloChange);
        stats.peakElo = Math.max(stats.peakElo, stats.eloFfa);
      }
      // Calculate level based on QP
      stats.level = Math.max(1, Math.floor(Math.sqrt(stats.qp / 25)) + 1);

      // Clan contribution
      const clans = this.getClansForUser(p.publicId);
      for (const c of clans) {
        c.games++;
        if (p.winner) {
          c.wins++;
          c.elo = (c.elo ?? 1000) + 15;
        } else {
          c.losses++;
          c.elo = Math.max(100, (c.elo ?? 1000) - 10);
        }
        const member = c.members.find(
          (m) => m.publicId.toLowerCase() === p.publicId.toLowerCase(),
        );
        if (member) {
          member.stats ??= { total: { wins: 0, losses: 0 } };
          if (p.winner) member.stats.total.wins++;
          else member.stats.total.losses++;
          member.eloContributed =
            (member.eloContributed ?? 0) + (p.winner ? 15 : -10);
        }
      }
    }

    this.save();
  }

  public getRankedLeaderboard(type: "1v1" | "2v2" | "ffa" | "qp"): any[] {
    const list = Object.values(this.data.playerStats);

    if (type === "qp") {
      list.sort((a, b) => b.qp - a.qp);
    } else if (type === "1v1") {
      list.sort((a, b) => b.elo1v1 - a.elo1v1);
    } else if (type === "2v2") {
      list.sort((a, b) => b.elo2v2 - a.elo2v2);
    } else {
      list.sort((a, b) => b.eloFfa - a.eloFfa);
    }

    return list.map((p, index) => {
      const rank = index + 1;
      const eloValue =
        type === "qp"
          ? p.qp
          : type === "1v1"
            ? p.elo1v1
            : type === "2v2"
              ? p.elo2v2
              : p.eloFfa;
      const tier = getEloTier(eloValue, rank);
      return {
        rank,
        elo: eloValue,
        peakElo: p.peakElo,
        wins: p.wins,
        losses: p.losses,
        total: p.games,
        public_id: p.publicId,
        accountUsername: p.username,
        level: p.level,
        prestige: 0,
        legend: rank === 1,
        tier,
        qp: p.qp,
      };
    });
  }

  public getClanLeaderboard(): any[] {
    const list = [...this.data.clans];
    list.sort((a, b) => (b.elo ?? 1000) - (a.elo ?? 1000));
    return list.map((c, index) => ({
      rank: index + 1,
      clanTag: c.tag,
      games: c.games,
      wins: c.wins,
      losses: c.losses,
      playerSessions: c.members.length,
      weightedWins: c.wins,
      weightedLosses: c.losses,
      weightedWLRatio: c.games > 0 ? c.wins / c.games : 0,
      elo: c.elo ?? 1000,
    }));
  }

  public getTribeLeaderboard(): TribeLeaderboardEntry[] {
    return this.botTribes;
  }

  private botTribes: TribeLeaderboardEntry[] = [];

  private seedDefaultBotTribes(): void {
    const tribes = [
      "Rome",
      "Sparta",
      "Carthage",
      "Mongols",
      "Franks",
      "Vikings",
      "Ottomans",
      "Byzantium",
      "Britannia",
      "Persia",
      "Egypt",
      "Samurai",
    ];
    this.botTribes = tribes.map((name, i) => {
      const wins = 150 - i * 8 + Math.floor(Math.random() * 5);
      const losses = 40 + i * 5;
      const total = wins + losses;
      return {
        rank: i + 1,
        tribe: name,
        games: total,
        wins,
        losses,
        winRate: Number((wins / total).toFixed(3)),
        rating: 1800 - i * 45,
      };
    });
  }
}
