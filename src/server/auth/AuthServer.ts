import type { UserMeResponse } from "@openfront/shared/ApiSchemas";
import { uuidToBase64url } from "@openfront/shared/Base64";
import * as dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { exportJWK, importJWK, jwtVerify, JWK, SignJWT } from "jose";
import {
  randomBytes,
  randomUUID,
  createHash,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  AuthStore,
  hashPassword,
  UserRecord,
  verifyPassword,
} from "./AuthStore";
import {
  GameSocialStore,
  ClanRole,
  getEloTier,
  calculateQpPoints,
} from "./GameSocialStore";

dotenv.config();

// The issuer/audience the game server (ServerEnv.jwtIssuer / jwtAudience)
// expects for local dev. Do not change without changing both sides.
const ISSUER = process.env.AUTH_ISSUER ?? "http://localhost:8787";
const AUDIENCE = process.env.DOMAIN ?? "localhost";
const PORT = Number(process.env.AUTH_PORT ?? 8787);
const PUBLIC_URL = (
  process.env.PUBLIC_URL ??
  process.env.RENDER_EXTERNAL_URL ??
  "http://localhost:9000"
).replace(/\/$/, "");
const DATA_DIR = process.env.AUTH_DATA_DIR ?? path.resolve("data/auth");
const ACCESS_TTL_S = 3600;
const COOKIE = "refresh_token";
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const googleEnabled = GOOGLE_ID !== "" && GOOGLE_SECRET !== "";

const store = new AuthStore(path.join(DATA_DIR, "users.json"));
const socialStore = new GameSocialStore(path.join(DATA_DIR, "social.json"));

type Keys = { privateJwk: JWK; publicJwk: JWK };
const AUTH_SECRET =
  process.env.AUTH_SECRET ?? "indufront_persistent_auth_secret_v1_2026";

async function loadKeys(): Promise<Keys> {
  const file = path.join(DATA_DIR, "keys.json");
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      /* ignore corrupted keys and regenerate */
    }
  }
  // Generate deterministic Ed25519 keypair based on AUTH_SECRET so restarts never invalidate active sessions
  const seed = createHash("sha256").update(AUTH_SECRET).digest();
  const privKeyObj = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      seed,
    ]),
    format: "der",
    type: "pkcs8",
  });
  const pubKeyObj = createPublicKey(privKeyObj);
  const keys: Keys = {
    privateJwk: { ...(await exportJWK(privKeyObj)), alg: "EdDSA" },
    publicJwk: { ...(await exportJWK(pubKeyObj)), alg: "EdDSA" },
  };
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  } catch {
    /* ignore write error */
  }
  return keys;
}

function cookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0)
      out[part.slice(0, i).trim()] = decodeURIComponent(
        part.slice(i + 1).trim(),
      );
  }
  return out;
}

function setCookie(
  req: Request,
  res: Response,
  name: string,
  value: string,
  maxAgeS: number,
) {
  const isHttps =
    req.secure ||
    req.headers["x-forwarded-proto"] === "https" ||
    PUBLIC_URL.startsWith("https://");
  const secure = isHttps ? "; Secure" : "";
  res.append(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${secure}`,
  );
}

const validEmail = (e: unknown): e is string =>
  typeof e === "string" &&
  e.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validUsername = (u: unknown): u is string =>
  typeof u === "string" && /^[A-Za-z0-9_]{3,20}$/.test(u);
const validPassword = (p: unknown): p is string =>
  typeof p === "string" && p.length >= 8 && p.length <= 128;

function userMe(u: UserRecord): UserMeResponse {
  const stats = socialStore.getOrCreatePlayerStats(u.publicId, u.username);
  const clans = socialStore.getClansForUser(u.publicId).map((c) => ({
    tag: c.tag,
    name: c.name,
    role:
      c.members.find(
        (m) => m.publicId.toLowerCase() === u.publicId.toLowerCase(),
      )?.role ?? "Mitglied",
  }));
  return {
    user: {
      publicId: u.publicId,
      email: u.email,
      emailVerified: u.emailVerified ?? false,
      doubleSafeEnabled: u.doubleSafeEnabled ?? false,
      ...(u.googleId ? { google: { email: u.email } } : {}),
    },
    steamLicence: false,
    steamLicenceSince: null,
    noticesSeen: u.noticesSeen ?? [],
    player: {
      publicId: u.publicId,
      adfree: false,
      canCreatePublicLobbies: true,
      trustTier: "trusted",
      username: u.username,
      usernameBase: u.username,
      usernameDiscriminator: "0001",
      usernameStatus: "premium",
      achievements: { singleplayerMap: [], player: [] },
      friends: u.friends ?? [],
      clans: clans as any,
      subscription: null,
      levelHidden: u.levelHidden ?? false,
      searchHidden: u.searchHidden ?? false,
      qp: stats.qp,
      elo: stats.eloFfa,
      tier: getEloTier(stats.eloFfa),
    },
  } as UserMeResponse;
}

function playerProfile(u: UserRecord) {
  const stats = socialStore.getOrCreatePlayerStats(u.publicId, u.username);
  const clans = socialStore.getClansForUser(u.publicId).map((c) => ({
    tag: c.tag,
    name: c.name,
    role:
      c.members.find(
        (m) => m.publicId.toLowerCase() === u.publicId.toLowerCase(),
      )?.role ?? "Mitglied",
  }));
  return {
    createdAt: new Date(u.createdAt).toISOString(),
    username: u.username,
    publicId: u.publicId,
    stats: {
      games: stats.games,
      wins: stats.wins,
      losses: stats.losses,
      qp: stats.qp,
      elo1v1: stats.elo1v1,
      elo2v2: stats.elo2v2,
      eloFfa: stats.eloFfa,
      tier: getEloTier(stats.eloFfa),
      level: stats.level,
    },
    clans,
    displayClanTag: clans[0]?.tag ?? null,
  };
}

async function main() {
  const keys = await loadKeys();
  const signKey = await importJWK(keys.privateJwk, "EdDSA");
  const verifyKey = await importJWK(keys.publicJwk, "EdDSA");

  async function issueAccessToken(u: UserRecord): Promise<string> {
    return new SignJWT({
      role: "player",
      provider: u.googleId ? "google" : "password",
      username: u.username,
      email: u.email,
      publicId: u.publicId,
    })
      .setProtectedHeader({ alg: "EdDSA" })
      .setJti(randomUUID())
      .setSubject(uuidToBase64url(u.id))
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_S}s`)
      .sign(signKey);
  }

  async function startSession(req: Request, res: Response, u: UserRecord) {
    const token = store.createSession(u.id);
    setCookie(req, res, COOKIE, token, 30 * 24 * 3600);
    const jwt = await issueAccessToken(u);
    return {
      jwt,
      refreshToken: token,
      expiresIn: ACCESS_TTL_S,
      user: {
        id: u.id,
        username: u.username,
        email: u.email,
        publicId: u.publicId,
        emailVerified: u.emailVerified ?? false,
        doubleSafeEnabled: u.doubleSafeEnabled ?? false,
      },
    };
  }

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "16kb" }));

  // Allow direct cross-origin use (e.g. the page on :9000 talking to :8787).
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "authorization, content-type",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,DELETE,OPTIONS",
      );
    }
    if (req.method === "OPTIONS") return void res.sendStatus(204);
    next();
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "too_many_requests" },
  });

  app.get("/.well-known/jwks.json", (_req, res) => {
    res.json({
      keys: [{ ...keys.publicJwk, alg: "EdDSA", crv: "Ed25519", kty: "OKP" }],
    });
  });

  app.get("/auth/providers", (_req, res) => {
    res.json({ password: true, google: googleEnabled });
  });

  app.post("/auth/register", authLimiter, async (req, res) => {
    const { email, password, username } = req.body ?? {};
    if (!validUsername(username))
      return void res.status(400).json({ error: "invalid_username" });
    if (!validPassword(password))
      return void res.status(400).json({ error: "weak_password" });
    if (email && !validEmail(email))
      return void res.status(400).json({ error: "invalid_email" });
    if (email && store.byEmail(email))
      return void res.status(409).json({ error: "email_taken" });
    if (store.byUsername(username))
      return void res.status(409).json({ error: "username_taken" });
    const effectiveEmail =
      typeof email === "string" && email.trim()
        ? email.trim()
        : `${username.toLowerCase()}@indufront.local`;
    const user = store.createUser({
      email: effectiveEmail,
      username,
      passwordHash: await hashPassword(password),
    });
    res.json(await startSession(req, res, user));
  });

  app.post("/auth/login", authLimiter, async (req, res) => {
    const { identifier: rawId, username, password } = req.body ?? {};
    const identifier = rawId ?? username;
    if (typeof identifier !== "string" || typeof password !== "string") {
      return void res.status(400).json({ error: "invalid_request" });
    }
    const user = identifier.includes("@")
      ? store.byEmail(identifier)
      : store.byUsername(identifier);
    // Same work and same answer whether or not the account exists.
    const ok =
      user?.passwordHash !== undefined
        ? await verifyPassword(password, user.passwordHash)
        : (await verifyPassword(password, "scrypt$00$00"), false);
    if (!user || !ok)
      return void res.status(401).json({ error: "invalid_credentials" });
    res.json(await startSession(req, res, user));
  });

  app.post("/auth/refresh", async (req, res) => {
    const headerToken =
      (req.headers["x-refresh-token"] as string) || req.body?.refreshToken;
    const cookieToken = cookies(req)[COOKIE];
    const token = cookieToken || headerToken;
    const user = token ? store.sessionUser(token) : undefined;
    if (!user) {
      setCookie(req, res, COOKIE, "", 0);
      return void res.sendStatus(401);
    }
    const jwt = await issueAccessToken(user);
    res.json({ jwt, refreshToken: token, expiresIn: ACCESS_TTL_S });
  });

  // ---- Account Recovery & Double Safe ----
  app.post("/auth/recover/request", authLimiter, (req, res) => {
    const { identifier } = req.body ?? {};
    if (typeof identifier !== "string" || !identifier.trim()) {
      return void res.status(400).json({ error: "invalid_identifier" });
    }
    const recovery = store.createRecoveryCode(identifier.trim(), "recovery");
    if (!recovery) {
      return void res.json({
        ok: true,
        message:
          "Falls dieser Account existiert, wurde ein 6-stelliger Wiederherstellungscode erstellt.",
      });
    }
    console.log(
      `[auth] Account recovery requested for ${recovery.user.username} (${recovery.user.email}). Code: ${recovery.code}`,
    );
    res.json({
      ok: true,
      message:
        "Wiederherstellungscode generiert. Bitte Code und neues Passwort eingeben.",
      code: recovery.code,
    });
  });

  app.post("/auth/recover/verify", authLimiter, async (req, res) => {
    const { identifier, code, newPassword } = req.body ?? {};
    if (!identifier || !code || !validPassword(newPassword)) {
      return void res.status(400).json({ error: "weak_password" });
    }
    const user = store.verifyRecoveryCode(
      String(identifier),
      String(code),
      "recovery",
    );
    if (!user) {
      return void res.status(400).json({ error: "invalid_code" });
    }
    store.updatePassword(user.id, await hashPassword(newPassword));
    store.deleteAllSessions(user.id);
    const session = await startSession(req, res, user);
    res.json({ ok: true, session });
  });

  app.post("/auth/magic-link", authLimiter, (req, res) => {
    const { email } = req.body ?? {};
    if (!email) return void res.status(400).json({ error: "missing_email" });
    const recovery = store.createRecoveryCode(String(email), "recovery");
    res.json({ ok: true, sent: true, code: recovery?.code });
  });

  app.post("/auth/email/send-code", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { email } = req.body ?? {};
    if (!validEmail(email))
      return void res.status(400).json({ error: "invalid_email" });
    store.setEmail(u.id, email, false);
    const recovery = store.createRecoveryCode(u.id, "email_verify");
    console.log(
      `[auth] Email verification code for ${u.username} (${email}): ${recovery?.code}`,
    );
    res.json({ ok: true, message: "Code gesendet", code: recovery?.code });
  });

  app.post("/auth/email/verify-code", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { code } = req.body ?? {};
    if (!code) return void res.status(400).json({ error: "missing_code" });
    const verified = store.verifyRecoveryCode(
      u.id,
      String(code),
      "email_verify",
    );
    if (!verified) return void res.status(400).json({ error: "invalid_code" });
    store.setEmail(u.id, verified.email, true);
    store.setDoubleSafe(u.id, true);
    res.json({ ok: true, emailVerified: true, doubleSafeEnabled: true });
  });

  app.post("/auth/double-safe/toggle", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { enabled } = req.body ?? {};
    store.setDoubleSafe(u.id, Boolean(enabled));
    res.json({ ok: true, doubleSafeEnabled: Boolean(enabled) });
  });

  app.post("/auth/logout", (req, res) => {
    const token = cookies(req)[COOKIE];
    if (token) store.deleteSession(token);
    setCookie(req, res, COOKIE, "", 0);
    res.sendStatus(200);
  });

  app.post("/auth/revoke", (req, res) => {
    const token = cookies(req)[COOKIE];
    const user = token ? store.sessionUser(token) : undefined;
    if (user) store.deleteAllSessions(user.id);
    setCookie(req, res, COOKIE, "", 0);
    res.sendStatus(200);
  });

  // ---- Google OAuth (real; only active when credentials are configured) ----
  const callbackUrl = `${PUBLIC_URL}/idp/auth/callback/google`;
  const allowedOrigins = new Set(
    [PUBLIC_URL, ...(process.env.ALLOWED_ORIGINS ?? "").split(",")]
      .map((s) => s.trim())
      .filter(Boolean),
  );

  app.get("/auth/login/google", (req, res) => {
    if (!googleEnabled)
      return void res.status(501).json({ error: "google_not_configured" });
    const redirect = String(req.query.redirect_uri ?? PUBLIC_URL);
    let target: URL;
    try {
      target = new URL(redirect);
    } catch {
      return void res.status(400).json({ error: "bad_redirect" });
    }
    if (!allowedOrigins.has(target.origin)) {
      return void res.status(400).json({ error: "redirect_not_allowed" });
    }
    const state = randomBytes(16).toString("hex");
    setCookie(req, res, "oauth_state", `${state}|${target.toString()}`, 600);
    const q = new URLSearchParams({
      client_id: GOOGLE_ID,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
  });

  app.get("/auth/callback/google", async (req, res) => {
    if (!googleEnabled) return void res.status(501).end();
    const [state, redirect] = (cookies(req).oauth_state ?? "").split("|");
    setCookie(req, res, "oauth_state", "", 0);
    if (
      !state ||
      req.query.state !== state ||
      typeof req.query.code !== "string"
    ) {
      return void res.status(400).send("Invalid OAuth state");
    }
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: req.query.code,
          client_id: GOOGLE_ID,
          client_secret: GOOGLE_SECRET,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
      const { access_token } = (await tokenRes.json()) as {
        access_token: string;
      };
      const infoRes = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${access_token}` },
        },
      );
      const info = (await infoRes.json()) as {
        sub: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
      };
      if (!info.sub || !info.email || info.email_verified !== true) {
        return void res
          .status(403)
          .send("Google account has no verified email");
      }
      let user = store.byGoogleId(info.sub) ?? store.byEmail(info.email);
      if (user && !user.googleId) store.linkGoogle(user.id, info.sub);
      if (!user) {
        const base =
          (info.name ?? info.email.split("@")[0])
            .replace(/[^A-Za-z0-9_]/g, "")
            .slice(0, 14) || "player";
        let name = base.length >= 3 ? base : base + "_pl";
        while (store.byUsername(name))
          name = base + Math.floor(Math.random() * 9999);
        user = store.createUser({
          email: info.email,
          username: name,
          googleId: info.sub,
        });
      }
      setCookie(req, res, COOKIE, store.createSession(user.id), 30 * 24 * 3600);
      res.redirect(redirect || PUBLIC_URL);
    } catch (e) {
      console.error("Google OAuth failed", e);
      res.status(502).send("Google sign-in failed");
    }
  });

  // ---- Authenticated profile ----
  async function authed(req: Request, res: Response, next: NextFunction) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
    if (!m) return void res.sendStatus(401);
    try {
      const { payload } = await jwtVerify(m[1], verifyKey, {
        algorithms: ["EdDSA"],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      const { base64urlToUuid } = await import("@openfront/shared/Base64");
      const userId = base64urlToUuid(String(payload.sub));
      if (store.isUserDeleted(userId)) {
        return void res.sendStatus(401);
      }
      let user = store.byId(userId);
      // Ephemeral disk reboot recovery: reconstruct user record from cryptographically verified token
      if (!user && payload.username && payload.email) {
        user = store.createUser({
          id: userId,
          username: String(payload.username),
          email: String(payload.email),
          publicId: payload.publicId ? String(payload.publicId) : undefined,
        });
      }
      if (!user) return void res.sendStatus(401);
      socialStore.recordPing(user.publicId);
      (req as Request & { user: UserRecord }).user = user;
      next();
    } catch {
      res.sendStatus(401);
    }
  }

  app.post("/auth/sync", async (req, res) => {
    const rawToken =
      req.body?.jwt ??
      (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!rawToken) return void res.status(400).json({ error: "missing_token" });
    try {
      const { payload } = await jwtVerify(rawToken, verifyKey, {
        algorithms: ["EdDSA"],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      const { base64urlToUuid } = await import("@openfront/shared/Base64");
      const userId = base64urlToUuid(String(payload.sub));
      if (store.isUserDeleted(userId)) {
        return void res.sendStatus(401);
      }
      let user = store.byId(userId);
      if (!user && payload.username && payload.email) {
        user = store.createUser({
          id: userId,
          username: String(payload.username),
          email: String(payload.email),
          publicId: payload.publicId ? String(payload.publicId) : undefined,
        });
      }
      if (!user) return void res.status(404).json({ error: "not_found" });
      res.json({ ok: true, user: userMe(user) });
    } catch {
      res.status(401).json({ error: "invalid_token" });
    }
  });

  app.get("/users/@me", authed, (req, res) => {
    res.json(userMe((req as Request & { user: UserRecord }).user));
  });

  app.delete("/users/@me", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    store.deleteUser(u.id);
    setCookie(req, res, COOKIE, "", 0);
    res.sendStatus(200);
  });

  app.put("/users/@me/username", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const raw = req.body?.username;
    if (!validUsername(raw)) {
      return void res.status(400).json({ reason: "invalid_username" });
    }
    const existing = store.byUsername(raw);
    if (existing && existing.id !== u.id) {
      return void res.status(409).json({ error: "username_taken" });
    }
    const updated = store.updateUsername(u.id, raw)!;
    res.json({
      username: updated.username,
      base: updated.username,
      discriminator: "0001",
      usernameStatus: "premium",
      nextUsernameChangeAt: null,
      bareClaim: "claimed",
    });
  });

  const handlePasswordChange = async (req: Request, res: Response) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { currentPassword, newPassword } = req.body ?? {};
    if (!validPassword(newPassword)) {
      return void res.status(400).json({
        error: "weak_password",
        reason: "Min. 8 Zeichen erforderlich",
      });
    }
    if (u.passwordHash) {
      if (
        typeof currentPassword !== "string" ||
        !(await verifyPassword(currentPassword, u.passwordHash))
      ) {
        return void res.status(401).json({
          error: "incorrect_password",
          reason: "Aktuelles Passwort falsch",
        });
      }
    }
    const newHash = await hashPassword(newPassword);
    store.updatePassword(u.id, newHash);
    res.json({ ok: true });
  };

  app.put("/users/@me/password", authed, handlePasswordChange);
  app.post("/auth/change-password", authed, handlePasswordChange);

  app.post("/users/@me/notices", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const notice = req.body?.notice;
    if (
      typeof notice === "string" &&
      notice.length > 0 &&
      notice.length <= 64
    ) {
      store.markNoticeSeen(u.id, notice);
    }
    res.sendStatus(200);
  });

  app.put("/users/@me/level_visibility", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const hidden = Boolean(req.body?.hidden);
    store.setVisibility(u.id, "levelHidden", hidden);
    res.json({ hidden });
  });

  app.put("/users/@me/search_visibility", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const hidden = Boolean(req.body?.hidden);
    store.setVisibility(u.id, "searchHidden", hidden);
    res.json({ hidden });
  });

  // ---- Player profiles & game history ----
  app.get("/player/:publicId", authed, (req, res) => {
    const u = store.byPublicId(String(req.params.publicId));
    if (!u) return void res.status(404).json({ error: "not_found" });
    res.json(playerProfile(u));
  });

  app.get("/public/player/:publicId", (req, res) => {
    const u = store.byPublicId(String(req.params.publicId));
    if (!u) return void res.status(404).json({ error: "not_found" });
    res.json(playerProfile(u));
  });

  app.get("/public/player/:publicId/games", (req, res) => {
    const games = socialStore.getPlayerMatches(String(req.params.publicId));
    res.json({ results: games, nextCursor: null });
  });

  // ---- Match Records Ingestion & History ----
  app.post("/game/:gameId", async (req, res) => {
    try {
      const gameRecord = req.body ?? {};
      const gameId = String(
        req.params.gameId ?? gameRecord.info?.gameID ?? randomUUID(),
      );
      const playersObj = gameRecord.players ?? {};
      const winnerId = gameRecord.winner;
      const rankedType = String(gameRecord.info?.rankedType ?? "ffa");
      const gameType = String(gameRecord.info?.gameType ?? "Public");

      const playerList: any[] = [];
      let rankCounter = 1;

      for (const [clientId, p] of Object.entries<any>(playersObj)) {
        const isWinner =
          clientId === winnerId ||
          (p.teamIndex !== undefined && p.teamIndex === winnerId);
        const publicId = p.persistentID ?? clientId;
        const username = p.username ?? "Player";
        const kills = p.stats?.kills ?? 0;
        const territory = p.stats?.territory ?? 0;
        playerList.push({
          publicId,
          username,
          winner: isWinner,
          kills,
          territory,
          placement: isWinner ? 1 : ++rankCounter,
        });
      }

      playerList.sort((a, b) =>
        a.winner ? -1 : b.winner ? 1 : a.placement - b.placement,
      );
      playerList.forEach((pl, idx) => {
        pl.placement = idx + 1;
        pl.qpEarned = calculateQpPoints(pl.placement);
        pl.eloChange = pl.winner ? 25 : -15;
      });

      socialStore.recordFinishedMatch({
        gameId,
        timestamp: new Date().toISOString(),
        gameType,
        rankedType,
        durationSeconds: Number(gameRecord.info?.turns?.length ?? 120),
        players: playerList,
      });

      res.json({ ok: true });
    } catch (e) {
      console.error("Failed to archive game in socialStore", e);
      res.status(500).json({ error: "archive_failed" });
    }
  });

  app.get("/game/:gameId", (req, res) => {
    const matches = socialStore.getPlayerMatches("");
    const g = matches.find((m) => m.gameId === req.params.gameId);
    if (!g) return void res.status(404).json({ error: "not_found" });
    res.json(g);
  });

  // ---- Leaderboards ----
  app.get("/leaderboard/ranked", (req, res) => {
    const ladder1v1 = socialStore.getRankedLeaderboard("1v1");
    const ladder2v2 = socialStore.getRankedLeaderboard("2v2");
    const ladderFfa = socialStore.getRankedLeaderboard("ffa");
    const ladderQp = socialStore.getRankedLeaderboard("qp");

    res.json({
      "1v1": ladder1v1,
      "2v2": ladder2v2,
      ffa: ladderFfa,
      qp: ladderQp,
    });
  });

  app.get("/public/clans/leaderboard", (_req, res) => {
    res.json({
      start: new Date(Date.now() - 7 * 86400000).toISOString(),
      end: new Date().toISOString(),
      clans: socialStore.getClanLeaderboard(),
    });
  });

  app.get("/leaderboard/tribes", (_req, res) => {
    res.json({
      start: new Date(Date.now() - 7 * 86400000).toISOString(),
      end: new Date().toISOString(),
      tribes: socialStore.getTribeLeaderboard(),
    });
  });

  // ---- Clans API ----
  app.get("/clans", (req, res) => {
    const search = String(req.query.search ?? "").toLowerCase();
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.max(
      1,
      Math.min(100, Number(req.query.limit ?? 20) || 20),
    );
    let list = socialStore.getClans();
    if (search) {
      list = list.filter(
        (c) =>
          c.tag.toLowerCase().includes(search) ||
          c.name.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search),
      );
    }
    const total = list.length;
    const start = (page - 1) * limit;
    const results = list.slice(start, start + limit).map((c) => ({
      tag: c.tag,
      name: c.name,
      description: c.description,
      isOpen: c.isOpen,
      createdAt: c.createdAt,
      memberCount: c.members.length,
      softBalance: "0",
      hardBalance: "0",
      boosted: false,
      boostEndsAt: null,
    }));
    res.json({ results, total, page, limit });
  });

  app.post("/clans", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { tag, name, description, isOpen } = req.body ?? {};
    const result = socialStore.createClan(u, {
      tag,
      name,
      description,
      isOpen,
    });
    if (!result.ok) {
      return void res.status(400).json({ error: result.error });
    }
    res.json(result.clan);
  });

  app.get("/clans/:tag", (req, res) => {
    const clan = socialStore.getClan(String(req.params.tag));
    if (!clan) return void res.status(404).json({ error: "not_found" });
    res.json({
      tag: clan.tag,
      name: clan.name,
      description: clan.description,
      isOpen: clan.isOpen,
      createdAt: clan.createdAt,
      memberCount: clan.members.length,
      softBalance: "0",
      hardBalance: "0",
      boosted: false,
      boostEndsAt: null,
    });
  });

  app.patch("/clans/:tag", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const result = socialStore.updateClan(
      u,
      String(req.params.tag),
      req.body ?? {},
    );
    if (!result.ok) {
      return void res.status(400).json({ error: result.error });
    }
    res.json(result.clan);
  });

  app.delete("/clans/:tag", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const result = socialStore.disbandClan(u, String(req.params.tag));
    if (!result.ok) {
      return void res.status(403).json({ error: result.error });
    }
    res.sendStatus(200);
  });

  app.get("/clans/:tag/members", (req, res) => {
    const clan = socialStore.getClan(String(req.params.tag));
    if (!clan) return void res.status(404).json({ error: "not_found" });
    const results = clan.members.map((m) => ({
      role: m.role,
      joinedAt: m.joinedAt,
      publicId: m.publicId,
      username: m.username,
      stats: m.stats,
      eloContributed: m.eloContributed ?? 0,
    }));
    res.json({
      results,
      total: results.length,
      page: 1,
      limit: 100,
      pendingRequests: clan.requests.length,
    });
  });

  app.post("/clans/:tag/join", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const result = socialStore.joinOrRequestClan(u, String(req.params.tag));
    if (!result.ok) {
      return void res.status(409).json({ message: result.error });
    }
    res.json({ status: result.status });
  });

  app.post("/clans/:tag/leave", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const result = socialStore.leaveClan(u, String(req.params.tag));
    if (!result.ok) {
      return void res.status(400).json({ error: result.error });
    }
    res.sendStatus(200);
  });

  app.post("/clans/:tag/kick", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { targetPublicId } = req.body ?? {};
    const result = socialStore.kickMember(
      u,
      String(req.params.tag),
      String(targetPublicId),
    );
    if (!result.ok) {
      return void res.status(403).json({ error: result.error });
    }
    res.sendStatus(200);
  });

  app.post("/clans/:tag/promote", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { targetPublicId } = req.body ?? {};
    const clan = socialStore.getClan(String(req.params.tag));
    if (!clan) return void res.status(404).json({ error: "not_found" });
    const target = clan.members.find(
      (m) => m.publicId.toLowerCase() === String(targetPublicId).toLowerCase(),
    );
    if (!target) return void res.status(404).json({ error: "not_found" });
    let nextRole: ClanRole = "Supporter";
    if (target.role === "Supporter") nextRole = "Admin";
    else if (target.role === "Admin") {
      return void res
        .status(400)
        .json({ error: "Höchster Rang erreicht (Owner ist unübertragbar)" });
    }
    const result = socialStore.changeMemberRole(
      u,
      String(req.params.tag),
      String(targetPublicId),
      nextRole,
    );
    if (!result.ok) return void res.status(403).json({ error: result.error });
    res.sendStatus(200);
  });

  app.post("/clans/:tag/demote", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { targetPublicId } = req.body ?? {};
    const clan = socialStore.getClan(String(req.params.tag));
    if (!clan) return void res.status(404).json({ error: "not_found" });
    const target = clan.members.find(
      (m) => m.publicId.toLowerCase() === String(targetPublicId).toLowerCase(),
    );
    if (!target) return void res.status(404).json({ error: "not_found" });
    let nextRole: ClanRole = "Mitglied";
    if (target.role === "Admin") nextRole = "Supporter";
    const result = socialStore.changeMemberRole(
      u,
      String(req.params.tag),
      String(targetPublicId),
      nextRole,
    );
    if (!result.ok) return void res.status(403).json({ error: result.error });
    res.sendStatus(200);
  });

  app.post("/clans/:tag/role", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { targetPublicId, role } = req.body ?? {};
    const result = socialStore.changeMemberRole(
      u,
      String(req.params.tag),
      String(targetPublicId),
      role as ClanRole,
    );
    if (!result.ok) return void res.status(403).json({ error: result.error });
    res.sendStatus(200);
  });

  app.get("/clans/:tag/requests", authed, (req, res) => {
    const clan = socialStore.getClan(String(req.params.tag));
    if (!clan) return void res.status(404).json({ error: "not_found" });
    res.json({
      results: clan.requests,
      total: clan.requests.length,
      page: 1,
      limit: 100,
    });
  });

  app.post("/clans/:tag/requests/approve", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { targetPublicId } = req.body ?? {};
    const result = socialStore.approveRequest(
      u,
      String(req.params.tag),
      String(targetPublicId),
    );
    if (!result.ok) return void res.status(403).json({ error: result.error });
    res.sendStatus(200);
  });

  app.post("/clans/:tag/requests/deny", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { targetPublicId } = req.body ?? {};
    const result = socialStore.denyRequest(
      u,
      String(req.params.tag),
      String(targetPublicId),
    );
    if (!result.ok) return void res.status(403).json({ error: result.error });
    res.sendStatus(200);
  });

  // Persistent Clan Chat
  app.get("/clans/:tag/chat", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const chat = socialStore.getClanChat(u, String(req.params.tag));
    if (chat === null)
      return void res.status(403).json({ error: "not_member" });
    res.json({ messages: chat });
  });

  app.post("/clans/:tag/chat", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { text } = req.body ?? {};
    const msg = socialStore.addClanChatMessage(
      u,
      String(req.params.tag),
      String(text ?? ""),
    );
    if (!msg) return void res.status(400).json({ error: "failed_to_send" });
    res.json({ message: msg });
  });

  // ---- Global & Direct Chat ----
  app.get("/chat/global", (_req, res) => {
    res.json({ messages: socialStore.getGlobalChat(100) });
  });

  app.post("/chat/global", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const { text } = req.body ?? {};
    const msg = socialStore.addGlobalChatMessage(u, String(text ?? ""));
    if (!msg) return void res.status(400).json({ error: "failed_to_send" });
    res.json({ message: msg });
  });

  app.get("/friends/chat/:friendPublicId", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const friendId = String(req.params.friendPublicId);
    const messages = socialStore.getDirectChat(u.publicId, friendId, 100);
    res.json({ messages });
  });

  app.post("/friends/chat/:friendPublicId", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const friendId = String(req.params.friendPublicId);
    const otherUser = store.byPublicId(friendId);
    const { text } = req.body ?? {};
    const msg = socialStore.addDirectChatMessage(
      u,
      friendId,
      otherUser?.username ?? "Friend",
      String(text ?? ""),
    );
    if (!msg) return void res.status(400).json({ error: "failed_to_send" });
    res.json({ message: msg });
  });

  // ---- Presence & Online Count ----
  app.get("/api/online_count", (_req, res) => {
    const online = socialStore.getOnlineCount();
    res.json({ online, inGame: Math.floor(online * 0.7) });
  });

  app.get("/presence/summary", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    socialStore.recordPing(u.publicId);
    const onlineFriends = socialStore.getOnlineFriends(u.friends ?? []);
    res.json({
      onlineCount: socialStore.getOnlineCount(),
      onlineFriends,
    });
  });

  app.post("/presence/ping", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    socialStore.recordPing(u.publicId);
    res.json({ ok: true, onlineCount: socialStore.getOnlineCount() });
  });

  // ---- Friends API ----
  app.get("/friends", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.max(
      1,
      Math.min(100, Number(req.query.limit ?? 20) || 20),
    );
    const allIds = u.friends ?? [];
    const entries = allIds
      .map((pid) => {
        const friend = store.byPublicId(pid);
        if (!friend) return null;
        return {
          publicId: friend.publicId,
          username: friend.username,
          createdAt: new Date(friend.createdAt).toISOString(),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const start = (page - 1) * limit;
    res.json({
      results: entries.slice(start, start + limit),
      total: entries.length,
      page,
      limit,
    });
  });

  app.get("/friends/requests", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const mapReq = (
      list: { publicId: string; createdAt: number }[] | undefined,
    ) =>
      (list ?? [])
        .map((r) => {
          const other = store.byPublicId(r.publicId);
          if (!other) return null;
          return {
            publicId: other.publicId,
            username: other.username,
            createdAt: new Date(r.createdAt).toISOString(),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    res.json({
      incoming: mapReq(u.incomingRequests),
      outgoing: mapReq(u.outgoingRequests),
    });
  });

  app.post("/friends/requests/:target", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    const result = store.sendFriendRequest(u.id, String(req.params.target));
    if (!result.ok) {
      const code =
        result.code === "not_found"
          ? 404
          : result.code === "conflict"
            ? 409
            : 400;
      return void res.status(code).json({ error: result.code });
    }
    res.json({ status: result.status });
  });

  app.post("/friends/requests/:publicId/accept", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    if (!store.acceptFriendRequest(u.id, String(req.params.publicId))) {
      return void res.status(404).json({ error: "not_found" });
    }
    res.sendStatus(200);
  });

  app.delete("/friends/requests/:publicId", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    if (!store.deleteFriendRequest(u.id, String(req.params.publicId))) {
      return void res.status(404).json({ error: "not_found" });
    }
    res.sendStatus(200);
  });

  app.delete("/friends/:publicId", authed, (req, res) => {
    const u = (req as Request & { user: UserRecord }).user;
    if (!store.removeFriend(u.id, String(req.params.publicId))) {
      return void res.status(404).json({ error: "not_found" });
    }
    res.sendStatus(200);
  });

  // ---- Public JSON endpoints so client polling does not log 404s ----
  // An empty servers map makes ServerList.ts record the backend as reachable
  // without overriding BOOTSTRAP_CONFIG's same-origin fallback.
  app.get("/cluster.json", (_req, res) => {
    res.json({ servers: {} });
  });

  app.get("/cosmetics.json", (_req, res) => {
    const p = path.resolve("resources/cosmetics/cosmetics.json");
    if (fs.existsSync(p)) {
      res.setHeader("Content-Type", "application/json");
      return void fs.createReadStream(p).pipe(res);
    }
    res.json({ patterns: {}, flags: {} });
  });

  app.get("/reserved_clan_tags", (_req, res) => {
    res.json([]);
  });

  app.get("/news.json", (_req, res) => {
    const p = path.resolve("resources/news.json");
    if (fs.existsSync(p)) {
      res.setHeader("Content-Type", "application/json");
      return void fs.createReadStream(p).pipe(res);
    }
    res.json([]);
  });

  app.get("/streams.json", (_req, res) => {
    res.json({ verifiedAt: new Date().toISOString(), featured: [], live: [] });
  });

  app.post("/matchmaking/checkin", (_req, res) => {
    res.json({ assignment: null });
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use((_req, res) => res.status(404).json({ error: "not_found" }));

  app.listen(PORT, () => {
    console.log(
      `[auth] listening on :${PORT} issuer=${ISSUER} public=${PUBLIC_URL} google=${googleEnabled}`,
    );
  });
}

main().catch((e) => {
  console.error("[auth] failed to start", e);
  process.exit(1);
});
