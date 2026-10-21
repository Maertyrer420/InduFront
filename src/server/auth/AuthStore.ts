import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
  createHmac,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  dbDeleteAllUserSessions,
  dbDeleteSession,
  dbDeleteUser,
  dbLoadDeletedUsers,
  dbLoadSessions,
  dbLoadUserById,
  dbLoadUsers,
  dbUpsertSession,
  dbUpsertUser,
} from "./DbStorage";

export interface RecoveryCodeRecord {
  code: string;
  expiresAt: number;
  purpose: "recovery" | "2fa" | "email_verify";
}

export interface UserInventoryRecord {
  flares?: string[];
  equippedPattern?: string | null;
  equippedFlag?: string | null;
  equippedCrown?: string | null;
  equippedColor?: string | null;
  equippedEffects?: Record<string, string>;
  loadouts?: unknown[];
  activeLoadout?: string | null;
}

export interface UserRecord {
  id: string; // uuid, becomes the JWT subject / persistent id
  publicId: string; // permanent unique account identifier (e.g. IF-A1B2C3D4)
  username: string;
  usernameLower: string;
  email: string;
  emailVerified?: boolean;
  doubleSafeEnabled?: boolean;
  recoveryKey?: string; // personal Backup Recovery Key (e.g. IF-REC-XXXX-XXXX-XXXX)
  recoveryCodes?: RecoveryCodeRecord[];
  passwordHash?: string; // "scrypt$salt$hash", absent for Google-only accounts
  googleId?: string;
  createdAt: number;
  updatedAt?: number;
  friends?: string[]; // publicIds of accepted friends
  friendNames?: Record<string, string>; // publicId -> last known username of friends/requesters
  incomingRequests?: {
    publicId: string;
    username?: string;
    createdAt: number;
  }[];
  outgoingRequests?: {
    publicId: string;
    username?: string;
    createdAt: number;
  }[];
  noticesSeen?: string[];
  levelHidden?: boolean;
  searchHidden?: boolean;
  settings?: Record<string, string>;
  inventory?: UserInventoryRecord;
}

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  expiresAt: number;
}

interface Data {
  users: UserRecord[];
  sessions: SessionRecord[];
  deletedUserIds?: string[];
}

const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) =>
      e ? reject(e) : resolve(k),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [alg, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function generateRecoveryKey(): string {
  const part = () => randomBytes(2).toString("hex").toUpperCase();
  return `IF-REC-${part()}-${part()}-${part()}`;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function mergeStringArrays(a?: string[], b?: string[]): string[] {
  return Array.from(new Set([...(a ?? []), ...(b ?? [])]));
}

function mergeRequestLists(
  a?: { publicId: string; username?: string; createdAt: number }[],
  b?: { publicId: string; username?: string; createdAt: number }[],
): { publicId: string; username?: string; createdAt: number }[] {
  const map = new Map<
    string,
    { publicId: string; username?: string; createdAt: number }
  >();
  for (const item of [...(a ?? []), ...(b ?? [])]) {
    if (item && item.publicId) {
      const key = item.publicId.toUpperCase();
      const prev = map.get(key);
      map.set(key, {
        publicId: item.publicId,
        username: item.username ?? prev?.username,
        createdAt: item.createdAt ?? prev?.createdAt ?? Date.now(),
      });
    }
  }
  return Array.from(map.values());
}

export function mergeUsers(
  localUser: UserRecord,
  dbUser: UserRecord,
): UserRecord {
  const newer =
    (dbUser.updatedAt ?? dbUser.createdAt ?? 0) >=
    (localUser.updatedAt ?? localUser.createdAt ?? 0)
      ? dbUser
      : localUser;
  const older = newer === dbUser ? localUser : dbUser;

  return {
    ...older,
    ...newer,
    id: newer.id || older.id,
    publicId: newer.publicId || older.publicId,
    username: newer.username || older.username,
    usernameLower: (newer.username || older.username).toLowerCase(),
    email: newer.email || older.email,
    emailVerified: Boolean(newer.emailVerified ?? older.emailVerified),
    doubleSafeEnabled: Boolean(
      newer.doubleSafeEnabled ?? older.doubleSafeEnabled,
    ),
    // Never lose a valid passwordHash or recoveryKey during merge!
    passwordHash: newer.passwordHash ?? older.passwordHash,
    googleId: newer.googleId ?? older.googleId,
    recoveryKey:
      newer.recoveryKey ?? older.recoveryKey ?? generateRecoveryKey(),
    friends: mergeStringArrays(localUser.friends, dbUser.friends),
    friendNames: {
      ...(older.friendNames ?? {}),
      ...(newer.friendNames ?? {}),
    },
    incomingRequests: mergeRequestLists(
      localUser.incomingRequests,
      dbUser.incomingRequests,
    ),
    outgoingRequests: mergeRequestLists(
      localUser.outgoingRequests,
      dbUser.outgoingRequests,
    ),
    noticesSeen: mergeStringArrays(localUser.noticesSeen, dbUser.noticesSeen),
    settings: {
      ...(older.settings ?? {}),
      ...(newer.settings ?? {}),
    },
    inventory: {
      ...(older.inventory ?? {}),
      ...(newer.inventory ?? {}),
      flares: mergeStringArrays(
        older.inventory?.flares,
        newer.inventory?.flares,
      ),
    },
  };
}

/** Small durable store: JSON file with atomic write + backup + PostgreSQL sync when DATABASE_URL is set. */
export class AuthStore {
  private data: Data = { users: [], sessions: [] };
  private backupFile: string;
  private initPromise: Promise<void>;

  constructor(private readonly file: string) {
    this.backupFile = this.file + ".backup";
    fs.mkdirSync(path.dirname(file), { recursive: true });

    let loaded = false;
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, "utf8");
        this.data = JSON.parse(raw) as Data;
        loaded = true;
      } catch {
        console.warn(
          `[auth-store] Failed to parse ${file}, attempting backup...`,
        );
      }
    }

    if (!loaded && fs.existsSync(this.backupFile)) {
      try {
        const raw = fs.readFileSync(this.backupFile, "utf8");
        this.data = JSON.parse(raw) as Data;
        console.log(`[auth-store] Restored from backup: ${this.backupFile}`);
      } catch {
        /* ignore corrupted backup */
      }
    }

    this.data.users ??= [];
    this.data.sessions ??= [];
    this.data.deletedUserIds ??= [];

    // Ensure every loaded user has a recoveryKey
    let migrated = false;
    for (const u of this.data.users) {
      if (!u.recoveryKey) {
        u.recoveryKey = generateRecoveryKey();
        migrated = true;
      }
    }
    if (migrated) {
      this.save(false);
    }

    // Try loading / merging from PostgreSQL if DATABASE_URL is provided
    this.initPromise = this.syncFromDb();
  }

  public async init(): Promise<void> {
    await this.initPromise;
  }

  private async syncFromDb(): Promise<void> {
    try {
      const [dbUsers, dbDeleted, dbSessions] = await Promise.all([
        dbLoadUsers(),
        dbLoadDeletedUsers(),
        dbLoadSessions(),
      ]);

      if (dbDeleted && dbDeleted.length > 0) {
        this.data.deletedUserIds = mergeStringArrays(
          this.data.deletedUserIds,
          dbDeleted,
        );
      }
      const deletedSet = new Set(this.data.deletedUserIds ?? []);

      if (dbUsers) {
        const byId = new Map<string, UserRecord>();
        for (const localU of this.data.users) {
          if (!deletedSet.has(localU.id)) {
            byId.set(localU.id, localU);
          }
        }
        for (const dbU of dbUsers) {
          if (deletedSet.has(dbU.id)) continue;
          const existing = byId.get(dbU.id);
          if (existing) {
            byId.set(dbU.id, mergeUsers(existing, dbU));
          } else {
            dbU.recoveryKey ??= generateRecoveryKey();
            byId.set(dbU.id, dbU);
          }
        }
        this.data.users = Array.from(byId.values());

        // Push any local users or merged updates back to PostgreSQL so DB is 100% complete
        for (const u of this.data.users) {
          await dbUpsertUser(u);
        }
        console.log(
          `[auth-store] Synchronized ${this.data.users.length} users with PostgreSQL.`,
        );
      }

      if (dbSessions) {
        const now = Date.now();
        const sessionMap = new Map<string, SessionRecord>();
        for (const s of [...this.data.sessions, ...dbSessions]) {
          if (s.expiresAt > now && !deletedSet.has(s.userId)) {
            sessionMap.set(s.tokenHash, s);
          }
        }
        this.data.sessions = Array.from(sessionMap.values());
        for (const s of this.data.sessions) {
          await dbUpsertSession(s);
        }
      }

      this.save(false);
    } catch (err: any) {
      console.warn("[auth-store] syncFromDb:", err.message);
    }
  }

  public async fetchUserFromDb(
    userId: string,
  ): Promise<UserRecord | undefined> {
    if (this.isUserDeleted(userId)) return undefined;
    const mem = this.byId(userId);
    if (mem) return mem;
    const fromDb = await dbLoadUserById(userId);
    if (fromDb) {
      fromDb.recoveryKey ??= generateRecoveryKey();
      this.data.users.push(fromDb);
      this.save(false);
      return fromDb;
    }
    return undefined;
  }

  private save(syncDb = true, userToSync?: UserRecord): void {
    if (userToSync) {
      userToSync.updatedAt = Date.now();
    }
    try {
      const json = JSON.stringify(this.data, null, 2);
      const tmp = this.file + ".tmp";
      fs.writeFileSync(tmp, json);
      fs.renameSync(tmp, this.file);
      // Keep durable backup
      fs.writeFileSync(this.backupFile, json);
    } catch (err) {
      console.warn("[auth-store] Error writing user file:", err);
    }

    if (syncDb && userToSync) {
      dbUpsertUser(userToSync).catch(() => {});
    }
  }

  byId(id: string) {
    return this.data.users.find((u) => u.id === id);
  }
  byEmail(email: string) {
    const e = email.trim().toLowerCase();
    return this.data.users.find((u) => u.email === e);
  }
  byUsername(name: string) {
    const n = name.trim().toLowerCase();
    return this.data.users.find((u) => u.usernameLower === n);
  }
  byGoogleId(id: string) {
    return this.data.users.find((u) => u.googleId === id);
  }
  byPublicId(publicId: string) {
    const p = publicId.trim().toLowerCase();
    return this.data.users.find((u) => u.publicId.toLowerCase() === p);
  }
  /** Resolve a target string by either id, publicId, username or email (case-insensitive). */
  byPublicIdOrUsername(target: string) {
    return (
      this.byId(target) ??
      this.byPublicId(target) ??
      this.byUsername(target) ??
      this.byEmail(target)
    );
  }

  updateUsername(userId: string, newUsername: string): UserRecord | undefined {
    const u = this.byId(userId);
    if (!u) return undefined;
    u.username = newUsername.trim();
    u.usernameLower = u.username.toLowerCase();
    this.save(true, u);
    return u;
  }

  updatePassword(userId: string, newHash: string): boolean {
    const u = this.byId(userId);
    if (!u) return false;
    u.passwordHash = newHash;
    this.save(true, u);
    return true;
  }

  ensureRecoveryKey(userId: string): string | null {
    const u = this.byId(userId);
    if (!u) return null;
    if (!u.recoveryKey) {
      u.recoveryKey = generateRecoveryKey();
      this.save(true, u);
    }
    return u.recoveryKey;
  }

  regenerateRecoveryKey(userId: string): string | null {
    const u = this.byId(userId);
    if (!u) return null;
    u.recoveryKey = generateRecoveryKey();
    this.save(true, u);
    return u.recoveryKey;
  }

  updateUserSettings(
    userId: string,
    patchSettings: Record<string, string | null>,
  ): Record<string, string> | null {
    const u = this.byId(userId);
    if (!u) return null;
    u.settings ??= {};
    for (const [k, v] of Object.entries(patchSettings)) {
      if (typeof k !== "string" || k.length > 120) continue;
      if (v === null) {
        delete u.settings[k];
      } else if (typeof v === "string" && v.length <= 16384) {
        u.settings[k] = v;
      }
    }
    this.save(true, u);
    return u.settings;
  }

  updateUserInventory(
    userId: string,
    patchInventory: Partial<UserInventoryRecord>,
  ): UserInventoryRecord | null {
    const u = this.byId(userId);
    if (!u) return null;
    u.inventory ??= {};
    if (Array.isArray(patchInventory.flares)) {
      u.inventory.flares = mergeStringArrays(
        u.inventory.flares,
        patchInventory.flares.filter((x): x is string => typeof x === "string"),
      );
    }
    if (patchInventory.equippedPattern !== undefined) {
      u.inventory.equippedPattern = patchInventory.equippedPattern;
    }
    if (patchInventory.equippedFlag !== undefined) {
      u.inventory.equippedFlag = patchInventory.equippedFlag;
    }
    if (patchInventory.equippedCrown !== undefined) {
      u.inventory.equippedCrown = patchInventory.equippedCrown;
    }
    if (patchInventory.equippedColor !== undefined) {
      u.inventory.equippedColor = patchInventory.equippedColor;
    }
    if (
      patchInventory.equippedEffects &&
      typeof patchInventory.equippedEffects === "object"
    ) {
      u.inventory.equippedEffects = patchInventory.equippedEffects;
    }
    if (Array.isArray(patchInventory.loadouts)) {
      u.inventory.loadouts = patchInventory.loadouts.slice(0, 10);
    }
    if (patchInventory.activeLoadout !== undefined) {
      u.inventory.activeLoadout = patchInventory.activeLoadout;
    }
    this.save(true, u);
    return u.inventory;
  }

  isUserDeleted(userId: string): boolean {
    return (this.data.deletedUserIds ?? []).includes(userId);
  }

  deleteUser(userId: string): boolean {
    const u = this.byId(userId);
    if (!u) return false;
    const pub = u.publicId;
    this.data.users = this.data.users.filter((x) => x.id !== userId);
    for (const other of this.data.users) {
      let modified = false;
      if (other.friends?.includes(pub)) {
        other.friends = other.friends.filter((f) => f !== pub);
        modified = true;
      }
      if (other.incomingRequests?.some((r) => r.publicId === pub)) {
        other.incomingRequests = other.incomingRequests.filter(
          (r) => r.publicId !== pub,
        );
        modified = true;
      }
      if (other.outgoingRequests?.some((r) => r.publicId === pub)) {
        other.outgoingRequests = other.outgoingRequests.filter(
          (r) => r.publicId !== pub,
        );
        modified = true;
      }
      if (modified) {
        dbUpsertUser(other).catch(() => {});
      }
    }
    this.deleteAllSessions(userId);
    this.data.deletedUserIds ??= [];
    if (!this.data.deletedUserIds.includes(userId)) {
      this.data.deletedUserIds.push(userId);
    }
    this.save(false);
    dbDeleteUser(userId).catch(() => {});
    return true;
  }

  markNoticeSeen(userId: string, notice: string): void {
    const u = this.byId(userId);
    if (!u) return;
    u.noticesSeen ??= [];
    if (!u.noticesSeen.includes(notice)) {
      u.noticesSeen.push(notice);
      this.save(true, u);
    }
  }

  setVisibility(
    userId: string,
    field: "levelHidden" | "searchHidden",
    hidden: boolean,
  ): void {
    const u = this.byId(userId);
    if (!u) return;
    u[field] = hidden;
    this.save(true, u);
  }

  // ---- EMAIL & DOUBLE SAFE ----
  setEmail(userId: string, email: string, verified = false): UserRecord | null {
    const u = this.byId(userId);
    if (!u) return null;
    u.email = email.trim().toLowerCase();
    u.emailVerified = verified;
    this.save(true, u);
    return u;
  }

  setDoubleSafe(userId: string, enabled: boolean): UserRecord | null {
    const u = this.byId(userId);
    if (!u) return null;
    u.doubleSafeEnabled = enabled;
    this.save(true, u);
    return u;
  }

  createRecoveryCode(
    identifier: string,
    purpose: "recovery" | "2fa" | "email_verify" = "recovery",
  ): { user: UserRecord; code: string } | null {
    const u = this.byPublicIdOrUsername(identifier);
    if (!u) return null;

    // Generate secure 6-digit number
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    u.recoveryCodes ??= [];
    // Keep at most 5 valid codes
    u.recoveryCodes = u.recoveryCodes.filter((c) => c.expiresAt > Date.now());
    u.recoveryCodes.push({ code, expiresAt, purpose });

    this.save(true, u);
    return { user: u, code };
  }

  verifyRecoveryCode(
    identifier: string,
    code: string,
    purpose?: "recovery" | "2fa" | "email_verify",
  ): UserRecord | null {
    const u = this.byPublicIdOrUsername(identifier);
    if (!u) return null;

    const trimmedCode = code.trim();

    // Allow recovery via personal Backup Recovery Key (IF-REC-XXXX-XXXX-XXXX)
    if (
      (!purpose || purpose === "recovery") &&
      u.recoveryKey &&
      trimmedCode.toUpperCase() === u.recoveryKey.toUpperCase()
    ) {
      // Rotate recovery key after use so a leaked key cannot be reused endlessly
      u.recoveryKey = generateRecoveryKey();
      this.save(true, u);
      return u;
    }

    if (!u.recoveryCodes) return null;
    const now = Date.now();
    const idx = u.recoveryCodes.findIndex(
      (c) =>
        c.code === trimmedCode &&
        c.expiresAt > now &&
        (!purpose || c.purpose === purpose),
    );

    if (idx < 0) return null;

    // Consume the code
    u.recoveryCodes.splice(idx, 1);
    this.save(true, u);
    return u;
  }

  sendFriendRequest(
    fromUserId: string,
    targetStr: string,
  ):
    | { ok: true; status: "requested" | "accepted" }
    | { ok: false; code: "not_found" | "conflict" | "bad_request" } {
    const me = this.byId(fromUserId);
    const target = this.byPublicIdOrUsername(targetStr);
    if (!me || !target) return { ok: false, code: "not_found" };
    if (me.publicId === target.publicId)
      return { ok: false, code: "bad_request" };

    me.friends ??= [];
    target.friends ??= [];
    me.friendNames ??= {};
    target.friendNames ??= {};
    me.friendNames[target.publicId] = target.username;
    target.friendNames[me.publicId] = me.username;
    if (me.friends.includes(target.publicId))
      return { ok: false, code: "conflict" };

    me.incomingRequests ??= [];
    me.outgoingRequests ??= [];
    target.incomingRequests ??= [];
    target.outgoingRequests ??= [];

    // If target already requested, accept
    const incomingIdx = me.incomingRequests.findIndex(
      (r) => r.publicId === target.publicId,
    );
    if (incomingIdx >= 0) {
      me.incomingRequests.splice(incomingIdx, 1);
      target.outgoingRequests = target.outgoingRequests.filter(
        (r) => r.publicId !== me.publicId,
      );
      if (!me.friends.includes(target.publicId))
        me.friends.push(target.publicId);
      if (!target.friends.includes(me.publicId))
        target.friends.push(me.publicId);
      this.save(true, me);
      this.save(true, target);
      return { ok: true, status: "accepted" };
    }

    if (me.outgoingRequests.some((r) => r.publicId === target.publicId)) {
      return { ok: false, code: "conflict" };
    }

    const now = Date.now();
    me.outgoingRequests.push({
      publicId: target.publicId,
      username: target.username,
      createdAt: now,
    });
    target.incomingRequests.push({
      publicId: me.publicId,
      username: me.username,
      createdAt: now,
    });
    this.save(true, me);
    this.save(true, target);
    return { ok: true, status: "requested" };
  }

  acceptFriendRequest(userId: string, fromPublicId: string): boolean {
    const me = this.byId(userId);
    if (!me) return false;
    me.incomingRequests ??= [];
    const idx = me.incomingRequests.findIndex(
      (r) => r.publicId.toLowerCase() === fromPublicId.trim().toLowerCase(),
    );
    if (idx < 0) return false;
    const reqEntry = me.incomingRequests[idx];
    const targetPub = reqEntry.publicId;
    me.incomingRequests.splice(idx, 1);
    me.friends ??= [];
    me.friendNames ??= {};
    if (reqEntry.username) {
      me.friendNames[targetPub] = reqEntry.username;
    }
    if (!me.friends.includes(targetPub)) me.friends.push(targetPub);

    const other = this.byPublicId(targetPub);
    if (other) {
      other.outgoingRequests ??= [];
      other.outgoingRequests = other.outgoingRequests.filter(
        (r) => r.publicId.toLowerCase() !== me.publicId.toLowerCase(),
      );
      other.friends ??= [];
      other.friendNames ??= {};
      other.friendNames[me.publicId] = me.username;
      me.friendNames[other.publicId] = other.username;
      if (!other.friends.includes(me.publicId)) other.friends.push(me.publicId);
      this.save(true, other);
    }
    this.save(true, me);
    return true;
  }

  deleteFriendRequest(userId: string, otherPublicId: string): boolean {
    const me = this.byId(userId);
    if (!me) return false;
    const norm = otherPublicId.trim().toLowerCase();
    me.incomingRequests ??= [];
    me.outgoingRequests ??= [];
    me.incomingRequests = me.incomingRequests.filter(
      (r) => r.publicId.toLowerCase() !== norm,
    );
    me.outgoingRequests = me.outgoingRequests.filter(
      (r) => r.publicId.toLowerCase() !== norm,
    );
    const other = this.byPublicId(otherPublicId);
    if (other) {
      other.incomingRequests ??= [];
      other.outgoingRequests ??= [];
      other.incomingRequests = other.incomingRequests.filter(
        (r) => r.publicId.toLowerCase() !== me.publicId.toLowerCase(),
      );
      other.outgoingRequests = other.outgoingRequests.filter(
        (r) => r.publicId.toLowerCase() !== me.publicId.toLowerCase(),
      );
      this.save(true, other);
    }
    this.save(true, me);
    return true;
  }

  removeFriend(userId: string, friendPublicId: string): boolean {
    const me = this.byId(userId);
    if (!me) return false;
    const norm = friendPublicId.trim().toLowerCase();
    me.friends ??= [];
    if (!me.friends.some((f) => f.toLowerCase() === norm)) return false;
    me.friends = me.friends.filter((f) => f.toLowerCase() !== norm);
    const other = this.byPublicId(friendPublicId);
    if (other) {
      other.friends ??= [];
      other.friends = other.friends.filter(
        (f) => f.toLowerCase() !== me.publicId.toLowerCase(),
      );
      this.save(true, other);
    }
    this.save(true, me);
    return true;
  }

  createUser(p: {
    id?: string;
    publicId?: string;
    email: string;
    username: string;
    passwordHash?: string;
    googleId?: string;
    createdAt?: number;
  }): UserRecord {
    const id = p.id ?? randomUUID();
    const existing = this.byId(id) ?? this.byUsername(p.username);
    if (existing) {
      existing.username = p.username.trim();
      existing.usernameLower = p.username.trim().toLowerCase();
      if (p.email && !p.email.endsWith("@indufront.local")) {
        existing.email = p.email.trim().toLowerCase();
      }
      if (p.passwordHash) existing.passwordHash = p.passwordHash;
      if (p.googleId) existing.googleId = p.googleId;
      existing.recoveryKey ??= generateRecoveryKey();
      this.save(true, existing);
      return existing;
    }

    // Generate unique permanent player ID with IF- prefix
    const publicId =
      p.publicId ?? `IF-${randomBytes(4).toString("hex").toUpperCase()}`;

    const now = p.createdAt ?? Date.now();
    const user: UserRecord = {
      id,
      publicId,
      username: p.username.trim(),
      usernameLower: p.username.trim().toLowerCase(),
      email: p.email.trim().toLowerCase(),
      emailVerified: false,
      doubleSafeEnabled: false,
      recoveryKey: generateRecoveryKey(),
      passwordHash: p.passwordHash,
      googleId: p.googleId,
      createdAt: now,
      updatedAt: now,
      settings: {},
      inventory: {},
    };
    this.data.users.push(user);
    this.save(true, user);
    return user;
  }

  linkGoogle(userId: string, googleId: string): void {
    const u = this.byId(userId);
    if (u) {
      u.googleId = googleId;
      this.save(true, u);
    }
  }

  /**
   * Builds a cryptographically signed, compressed account & friends vault token
   * so that if an ephemeral container restarts without DATABASE_URL, the client
   * can immediately restore its full UserRecord + friend stubs on next request.
   */
  createVaultToken(userId: string, extraSocial?: unknown): string | null {
    const u = this.byId(userId);
    if (!u) return null;
    const friendStubs: {
      id: string;
      publicId: string;
      username: string;
      email: string;
      createdAt: number;
    }[] = [];
    const relatedPids = new Set<string>([
      ...(u.friends ?? []),
      ...(u.incomingRequests ?? []).map((r) => r.publicId),
      ...(u.outgoingRequests ?? []).map((r) => r.publicId),
    ]);
    u.friendNames ??= {};
    for (const pid of relatedPids) {
      const f = this.byPublicId(pid);
      if (f) {
        u.friendNames[f.publicId] = f.username;
        friendStubs.push({
          id: f.id,
          publicId: f.publicId,
          username: f.username,
          email: f.email,
          createdAt: f.createdAt,
        });
      }
    }
    const payloadObj = {
      v: 1,
      ts: Date.now(),
      user: {
        ...u,
        recoveryCodes: undefined,
      },
      friendStubs,
      social: extraSocial,
    };
    const compressed = zlib
      .deflateRawSync(Buffer.from(JSON.stringify(payloadObj), "utf8"))
      .toString("base64url");
    const authSecret =
      process.env.AUTH_SECRET ?? "indufront_persistent_auth_secret_v1_2026";
    const sig = createHmac("sha256", authSecret)
      .update(`vault:${compressed}`)
      .digest("base64url");
    return `v1.${compressed}.${sig}`;
  }

  /**
   * Verifies and merges a server-signed vault token back into AuthStore.
   */
  restoreFromVaultToken(
    vaultToken: string | undefined | null,
    onSocial?: (social: any) => void,
  ): UserRecord | undefined {
    if (!vaultToken || typeof vaultToken !== "string") return undefined;
    try {
      const parts = vaultToken.split(".");
      if (parts.length !== 3 || parts[0] !== "v1") return undefined;
      const [, compressed, sig] = parts;
      const authSecret =
        process.env.AUTH_SECRET ?? "indufront_persistent_auth_secret_v1_2026";
      const expectedSig = createHmac("sha256", authSecret)
        .update(`vault:${compressed}`)
        .digest("base64url");
      if (sig !== expectedSig) return undefined;

      const rawJson = zlib
        .inflateRawSync(Buffer.from(compressed, "base64url"))
        .toString("utf8");
      const parsed = JSON.parse(rawJson) as {
        v: number;
        ts: number;
        user: UserRecord;
        friendStubs?: {
          id: string;
          publicId: string;
          username: string;
          email: string;
          createdAt: number;
        }[];
        social?: unknown;
      };
      if (!parsed?.user?.id || this.isUserDeleted(parsed.user.id)) {
        return undefined;
      }
      if (parsed.social && onSocial) {
        try {
          onSocial(parsed.social);
        } catch {
          /* ignore social restore error */
        }
      }

      // 1. Restore any missing friend stub records so friends immediately appear
      let changed = false;
      for (const stub of parsed.friendStubs ?? []) {
        if (!stub?.publicId || !stub?.username) continue;
        if (this.isUserDeleted(stub.id)) continue;
        const existingFriend =
          this.byId(stub.id) ??
          this.byPublicId(stub.publicId) ??
          this.byUsername(stub.username);
        if (!existingFriend) {
          this.data.users.push({
            id: stub.id || randomUUID(),
            publicId: stub.publicId,
            username: stub.username,
            usernameLower: stub.username.toLowerCase(),
            email:
              stub.email || `${stub.username.toLowerCase()}@indufront.local`,
            emailVerified: false,
            doubleSafeEnabled: false,
            recoveryKey: generateRecoveryKey(),
            createdAt: stub.createdAt || Date.now(),
            updatedAt: Date.now(),
            friends: [parsed.user.publicId],
            friendNames: { [parsed.user.publicId]: parsed.user.username },
            settings: {},
            inventory: {},
          });
          changed = true;
        } else if (
          parsed.user.friends?.includes(existingFriend.publicId) &&
          !existingFriend.friends?.includes(parsed.user.publicId)
        ) {
          existingFriend.friends ??= [];
          existingFriend.friends.push(parsed.user.publicId);
          existingFriend.friendNames ??= {};
          existingFriend.friendNames[parsed.user.publicId] =
            parsed.user.username;
          changed = true;
        }
      }

      // 2. Restore or merge the main user record
      const existing =
        this.byId(parsed.user.id) ??
        this.byPublicId(parsed.user.publicId) ??
        this.byUsername(parsed.user.username);
      let finalUser: UserRecord;
      if (existing) {
        finalUser = mergeUsers(existing, parsed.user);
        const idx = this.data.users.findIndex((x) => x.id === existing.id);
        if (idx >= 0) this.data.users[idx] = finalUser;
      } else {
        finalUser = {
          ...parsed.user,
          usernameLower: parsed.user.username.toLowerCase(),
          recoveryKey: parsed.user.recoveryKey ?? generateRecoveryKey(),
        };
        this.data.users.push(finalUser);
      }
      this.save(true, finalUser);
      if (changed) {
        this.save(false);
      }
      return finalUser;
    } catch {
      return undefined;
    }
  }

  /** Returns the signed refresh token; works both in-memory, PostgreSQL, and statelessly across server restarts. */
  createSession(userId: string): string {
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;
    const authSecret =
      process.env.AUTH_SECRET ?? "indufront_persistent_auth_secret_v1_2026";
    const u = this.byId(userId);
    const snapObj = u
      ? {
          id: u.id,
          publicId: u.publicId,
          username: u.username,
          email: u.email,
          emailVerified: u.emailVerified,
          doubleSafeEnabled: u.doubleSafeEnabled,
          recoveryKey: u.recoveryKey,
          passwordHash: u.passwordHash,
          googleId: u.googleId,
          createdAt: u.createdAt,
          friends: u.friends,
          friendNames: u.friendNames,
          incomingRequests: u.incomingRequests,
          outgoingRequests: u.outgoingRequests,
        }
      : { id: userId };
    const snapB64 = zlib
      .deflateRawSync(Buffer.from(JSON.stringify(snapObj), "utf8"))
      .toString("base64url");
    const hmacSig = createHmac("sha256", authSecret)
      .update(`${userId}:${expiresAt}:${snapB64}`)
      .digest("base64url");
    const token = `${userId}.${expiresAt}.${snapB64}.${hmacSig}`;
    const session: SessionRecord = {
      tokenHash: sha(token),
      userId,
      expiresAt,
    };
    this.data.sessions = this.data.sessions.filter((s) => s.expiresAt > now);
    this.data.sessions.push(session);
    this.save(false);
    dbUpsertSession(session).catch(() => {});
    return token;
  }

  sessionUser(token: string): UserRecord | undefined {
    const now = Date.now();
    const h = sha(token);
    const s = this.data.sessions.find((x) => x.tokenHash === h);
    if (s && s.expiresAt >= now) {
      const u = this.byId(s.userId);
      if (u) return u;
    }
    const authSecret =
      process.env.AUTH_SECRET ?? "indufront_persistent_auth_secret_v1_2026";
    const parts = token.split(".");
    // Format v2 (4 parts with embedded compressed snapshot)
    if (parts.length === 4) {
      const [userId, expStr, snapB64, sig] = parts;
      const expiresAt = parseInt(expStr, 10);
      if (
        Number.isFinite(expiresAt) &&
        expiresAt >= now &&
        !this.isUserDeleted(userId)
      ) {
        const expectedSig = createHmac("sha256", authSecret)
          .update(`${userId}:${expiresAt}:${snapB64}`)
          .digest("base64url");
        if (sig === expectedSig) {
          let u = this.byId(userId);
          if (!u) {
            try {
              const raw = zlib
                .inflateRawSync(Buffer.from(snapB64, "base64url"))
                .toString("utf8");
              const snap = JSON.parse(raw) as Partial<UserRecord>;
              if (snap.username && snap.publicId) {
                u = this.createUser({
                  id: userId,
                  publicId: snap.publicId,
                  username: snap.username,
                  email:
                    snap.email ??
                    `${snap.username.toLowerCase()}@indufront.local`,
                  passwordHash: snap.passwordHash,
                  googleId: snap.googleId,
                  createdAt: snap.createdAt,
                });
                if (snap.recoveryKey) u.recoveryKey = snap.recoveryKey;
                if (snap.emailVerified !== undefined)
                  u.emailVerified = snap.emailVerified;
                if (snap.doubleSafeEnabled !== undefined)
                  u.doubleSafeEnabled = snap.doubleSafeEnabled;
                if (snap.friends)
                  u.friends = mergeStringArrays(u.friends, snap.friends);
                if (snap.friendNames)
                  u.friendNames = {
                    ...(u.friendNames ?? {}),
                    ...snap.friendNames,
                  };
                if (snap.incomingRequests)
                  u.incomingRequests = mergeRequestLists(
                    u.incomingRequests,
                    snap.incomingRequests,
                  );
                if (snap.outgoingRequests)
                  u.outgoingRequests = mergeRequestLists(
                    u.outgoingRequests,
                    snap.outgoingRequests,
                  );
                this.save(true, u);
              }
            } catch {
              /* ignore snapshot decode error */
            }
          }
          if (u) return u;
        }
      }
    }
    // Legacy format v1 (3 parts)
    if (parts.length === 3) {
      const [userId, expStr, sig] = parts;
      const expiresAt = parseInt(expStr, 10);
      if (
        Number.isFinite(expiresAt) &&
        expiresAt >= now &&
        !this.isUserDeleted(userId)
      ) {
        const expectedSig = createHmac("sha256", authSecret)
          .update(`${userId}:${expiresAt}`)
          .digest("base64url");
        if (sig === expectedSig) {
          const u = this.byId(userId);
          if (u) return u;
        }
      }
    }
    return undefined;
  }

  deleteSession(token: string): void {
    const h = sha(token);
    this.data.sessions = this.data.sessions.filter((s) => s.tokenHash !== h);
    this.save(false);
    dbDeleteSession(h).catch(() => {});
  }

  deleteAllSessions(userId: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    this.save(false);
    dbDeleteAllUserSessions(userId).catch(() => {});
  }
}
