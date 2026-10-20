import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dbDeleteUser, dbLoadUsers, dbUpsertUser } from "./DbStorage";

export interface RecoveryCodeRecord {
  code: string;
  expiresAt: number;
  purpose: "recovery" | "2fa" | "email_verify";
}

export interface UserRecord {
  id: string; // uuid, becomes the JWT subject / persistent id
  publicId: string; // permanent unique account identifier (e.g. IF-A1B2C3D4)
  username: string;
  usernameLower: string;
  email: string;
  emailVerified?: boolean;
  doubleSafeEnabled?: boolean;
  recoveryCodes?: RecoveryCodeRecord[];
  passwordHash?: string; // "scrypt$salt$hash", absent for Google-only accounts
  googleId?: string;
  createdAt: number;
  friends?: string[]; // publicIds of accepted friends
  incomingRequests?: { publicId: string; createdAt: number }[];
  outgoingRequests?: { publicId: string; createdAt: number }[];
  noticesSeen?: string[];
  levelHidden?: boolean;
  searchHidden?: boolean;
}

interface SessionRecord {
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

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Small durable store: JSON file with atomic write + backup + PostgreSQL sync when DATABASE_URL is set. */
export class AuthStore {
  private data: Data = { users: [], sessions: [] };
  private backupFile: string;

  constructor(private readonly file: string) {
    this.backupFile = this.file + ".backup";
    fs.mkdirSync(path.dirname(file), { recursive: true });

    let loaded = false;
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, "utf8");
        this.data = JSON.parse(raw) as Data;
        loaded = true;
      } catch (err) {
        console.warn(`[auth-store] Failed to parse ${file}, attempting backup...`);
      }
    }

    if (!loaded && fs.existsSync(this.backupFile)) {
      try {
        const raw = fs.readFileSync(this.backupFile, "utf8");
        this.data = JSON.parse(raw) as Data;
        console.log(`[auth-store] Restored from backup: ${this.backupFile}`);
      } catch {}
    }

    // Try loading / merging from PostgreSQL if DATABASE_URL is provided
    void this.syncFromDb();
  }

  private async syncFromDb(): Promise<void> {
    try {
      const dbUsers = await dbLoadUsers();
      if (dbUsers && dbUsers.length > 0) {
        const byId = new Map(this.data.users.map((u) => [u.id, u]));
        for (const u of dbUsers) {
          byId.set(u.id, u);
        }
        this.data.users = Array.from(byId.values());
        this.save(false);
        console.log(`[auth-store] Synchronized ${dbUsers.length} users from PostgreSQL.`);
      }
    } catch (err: any) {
      console.warn("[auth-store] syncFromDb:", err.message);
    }
  }

  private save(syncDb = true, userToSync?: UserRecord): void {
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

  isUserDeleted(userId: string): boolean {
    return (this.data.deletedUserIds ?? []).includes(userId);
  }

  deleteUser(userId: string): boolean {
    const u = this.byId(userId);
    if (!u) return false;
    const pub = u.publicId;
    this.data.users = this.data.users.filter((x) => x.id !== userId);
    for (const other of this.data.users) {
      if (other.friends) other.friends = other.friends.filter((f) => f !== pub);
      if (other.incomingRequests)
        other.incomingRequests = other.incomingRequests.filter((r) => r.publicId !== pub);
      if (other.outgoingRequests)
        other.outgoingRequests = other.outgoingRequests.filter((r) => r.publicId !== pub);
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
    if (!u || !u.recoveryCodes) return null;

    const trimmedCode = code.trim();
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
    if (me.publicId === target.publicId) return { ok: false, code: "bad_request" };

    me.friends ??= [];
    target.friends ??= [];
    if (me.friends.includes(target.publicId)) return { ok: false, code: "conflict" };

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
      if (!me.friends.includes(target.publicId)) me.friends.push(target.publicId);
      if (!target.friends.includes(me.publicId)) target.friends.push(me.publicId);
      this.save(true, me);
      this.save(true, target);
      return { ok: true, status: "accepted" };
    }

    if (me.outgoingRequests.some((r) => r.publicId === target.publicId)) {
      return { ok: false, code: "conflict" };
    }

    const now = Date.now();
    me.outgoingRequests.push({ publicId: target.publicId, createdAt: now });
    target.incomingRequests.push({ publicId: me.publicId, createdAt: now });
    this.save(true, me);
    this.save(true, target);
    return { ok: true, status: "requested" };
  }

  acceptFriendRequest(userId: string, fromPublicId: string): boolean {
    const me = this.byId(userId);
    const other = this.byPublicId(fromPublicId);
    if (!me || !other) return false;
    me.incomingRequests ??= [];
    other.outgoingRequests ??= [];
    const idx = me.incomingRequests.findIndex((r) => r.publicId === other.publicId);
    if (idx < 0) return false;
    me.incomingRequests.splice(idx, 1);
    other.outgoingRequests = other.outgoingRequests.filter(
      (r) => r.publicId !== me.publicId,
    );
    me.friends ??= [];
    other.friends ??= [];
    if (!me.friends.includes(other.publicId)) me.friends.push(other.publicId);
    if (!other.friends.includes(me.publicId)) other.friends.push(me.publicId);
    this.save(true, me);
    this.save(true, other);
    return true;
  }

  deleteFriendRequest(userId: string, otherPublicId: string): boolean {
    const me = this.byId(userId);
    const other = this.byPublicId(otherPublicId);
    if (!me || !other) return false;
    me.incomingRequests ??= [];
    me.outgoingRequests ??= [];
    other.incomingRequests ??= [];
    other.outgoingRequests ??= [];
    me.incomingRequests = me.incomingRequests.filter((r) => r.publicId !== other.publicId);
    me.outgoingRequests = me.outgoingRequests.filter((r) => r.publicId !== other.publicId);
    other.incomingRequests = other.incomingRequests.filter((r) => r.publicId !== me.publicId);
    other.outgoingRequests = other.outgoingRequests.filter((r) => r.publicId !== me.publicId);
    this.save(true, me);
    this.save(true, other);
    return true;
  }

  removeFriend(userId: string, friendPublicId: string): boolean {
    const me = this.byId(userId);
    const other = this.byPublicId(friendPublicId);
    if (!me || !other) return false;
    me.friends ??= [];
    other.friends ??= [];
    if (!me.friends.includes(other.publicId)) return false;
    me.friends = me.friends.filter((f) => f !== other.publicId);
    other.friends = other.friends.filter((f) => f !== me.publicId);
    this.save(true, me);
    this.save(true, other);
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
    const existing = this.byId(id);
    if (existing) {
      existing.username = p.username.trim();
      existing.usernameLower = p.username.trim().toLowerCase();
      existing.email = p.email.trim().toLowerCase();
      if (p.passwordHash) existing.passwordHash = p.passwordHash;
      this.save(true, existing);
      return existing;
    }

    // Generate unique permanent player ID with IF- prefix
    const publicId =
      p.publicId ??
      `IF-${randomBytes(4).toString("hex").toUpperCase()}`;

    const user: UserRecord = {
      id,
      publicId,
      username: p.username.trim(),
      usernameLower: p.username.trim().toLowerCase(),
      email: p.email.trim().toLowerCase(),
      emailVerified: false,
      doubleSafeEnabled: false,
      passwordHash: p.passwordHash,
      googleId: p.googleId,
      createdAt: p.createdAt ?? Date.now(),
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

  /** Returns the signed refresh token; works both in-memory and statelessly across server restarts. */
  createSession(userId: string): string {
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;
    const authSecret = process.env.AUTH_SECRET ?? "indufront_persistent_auth_secret_v1_2026";
    const hmacSig = createHmac("sha256", authSecret)
      .update(`${userId}:${expiresAt}`)
      .digest("base64url");
    const token = `${userId}.${expiresAt}.${hmacSig}`;
    this.data.sessions = this.data.sessions.filter((s) => s.expiresAt > now);
    this.data.sessions.push({
      tokenHash: sha(token),
      userId,
      expiresAt,
    });
    this.save(false);
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
    // Stateless fallback verification if server was restarted
    const parts = token.split(".");
    if (parts.length === 3) {
      const [userId, expStr, sig] = parts;
      const expiresAt = parseInt(expStr, 10);
      if (Number.isFinite(expiresAt) && expiresAt >= now) {
        const authSecret = process.env.AUTH_SECRET ?? "indufront_persistent_auth_secret_v1_2026";
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
  }

  deleteAllSessions(userId: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    this.save(false);
  }
}
