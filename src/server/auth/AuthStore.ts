import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface UserRecord {
  id: string; // uuid, becomes the JWT subject / persistent id
  publicId: string;
  username: string;
  usernameLower: string;
  email: string;
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

/** Small durable store: one JSON file, written atomically. */
export class AuthStore {
  private data: Data = { users: [], sessions: [] };

  constructor(private readonly file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
      try {
        this.data = JSON.parse(fs.readFileSync(file, "utf8")) as Data;
      } catch {
        this.data = { users: [], sessions: [] };
      }
    }
  }

  private save(): void {
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
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
  /** Resolve a target string by either publicId or username (case-insensitive). */
  byPublicIdOrUsername(target: string) {
    return this.byPublicId(target) ?? this.byUsername(target);
  }

  updateUsername(userId: string, newUsername: string): UserRecord | undefined {
    const u = this.byId(userId);
    if (!u) return undefined;
    u.username = newUsername.trim();
    u.usernameLower = u.username.toLowerCase();
    this.save();
    return u;
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
    this.save();
    return true;
  }

  markNoticeSeen(userId: string, notice: string): void {
    const u = this.byId(userId);
    if (!u) return;
    u.noticesSeen ??= [];
    if (!u.noticesSeen.includes(notice)) {
      u.noticesSeen.push(notice);
      this.save();
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
    this.save();
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

    // If the target already requested us, auto-accept!
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
      this.save();
      return { ok: true, status: "accepted" };
    }

    if (me.outgoingRequests.some((r) => r.publicId === target.publicId)) {
      return { ok: false, code: "conflict" };
    }

    const now = Date.now();
    me.outgoingRequests.push({ publicId: target.publicId, createdAt: now });
    target.incomingRequests.push({ publicId: me.publicId, createdAt: now });
    this.save();
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
    if (!other.friends.includes(me.publicId)) targetPush(other.friends, me.publicId);
    this.save();
    return true;
  }

  deleteFriendRequest(userId: string, otherPublicId: string): boolean {
    const me = this.byId(userId);
    const other = this.byPublicId(otherPublicId);
    if (!me || !other) return false;
    const beforeIn = me.incomingRequests?.length ?? 0;
    const beforeOut = me.outgoingRequests?.length ?? 0;
    me.incomingRequests = (me.incomingRequests ?? []).filter(
      (r) => r.publicId !== other.publicId,
    );
    me.outgoingRequests = (me.outgoingRequests ?? []).filter(
      (r) => r.publicId !== other.publicId,
    );
    other.incomingRequests = (other.incomingRequests ?? []).filter(
      (r) => r.publicId !== me.publicId,
    );
    other.outgoingRequests = (other.outgoingRequests ?? []).filter(
      (r) => r.publicId !== me.publicId,
    );
    if (
      me.incomingRequests.length === beforeIn &&
      me.outgoingRequests.length === beforeOut
    ) {
      return false;
    }
    this.save();
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
    this.save();
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
      this.save();
      return existing;
    }
    const user: UserRecord = {
      id,
      publicId: p.publicId ?? randomBytes(5).toString("hex"),
      username: p.username.trim(),
      usernameLower: p.username.trim().toLowerCase(),
      email: p.email.trim().toLowerCase(),
      passwordHash: p.passwordHash,
      googleId: p.googleId,
      createdAt: p.createdAt ?? Date.now(),
    };
    this.data.users.push(user);
    this.save();
    return user;
  }

  linkGoogle(userId: string, googleId: string): void {
    const u = this.byId(userId);
    if (u) {
      u.googleId = googleId;
      this.save();
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
    this.save();
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
      if (expiresAt > now) {
        const authSecret = process.env.AUTH_SECRET ?? "indufront_persistent_auth_secret_v1_2026";
        const expectedSig = createHmac("sha256", authSecret)
          .update(`${userId}:${expiresAt}`)
          .digest("base64url");
        if (sig === expectedSig) {
          return this.byId(userId);
        }
      }
    }
    return undefined;
  }

  deleteSession(token: string): void {
    const h = sha(token);
    this.data.sessions = this.data.sessions.filter((s) => s.tokenHash !== h);
    this.save();
  }

  deleteAllSessions(userId: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    this.save();
  }
}

function targetPush(arr: string[], item: string) {
  if (!arr.includes(item)) arr.push(item);
}
