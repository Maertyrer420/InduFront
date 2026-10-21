import net from "node:net";
import tls from "node:tls";
import pg from "pg";
import type { SessionRecord, UserRecord } from "./AuthStore";
import type {
  ClanRecord,
  DirectChatMessage,
  GlobalChatMessage,
  MatchRecord,
  PlayerStatsRecord,
} from "./GameSocialStore";

let pool: pg.Pool | null = null;
let dbInitialized = false;

export function getDbPool(): pg.Pool | null {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) return null;
  if (!pool) {
    try {
      const isLocal =
        connStr.includes("localhost") || connStr.includes("127.0.0.1");
      pool = new pg.Pool({
        connectionString: connStr,
        ssl: isLocal ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      pool.on("error", (err) => {
        console.warn("[db] Postgres pool error:", err.message);
      });
    } catch (err) {
      console.warn("[db] Failed to create Postgres pool:", err);
      pool = null;
    }
  }
  return pool;
}

export async function initDbTables(): Promise<boolean> {
  const p = getDbPool();
  if (!p) return false;
  if (dbInitialized) return true;

  try {
    const client = await p.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS indufront_users (
          id TEXT PRIMARY KEY,
          public_id TEXT UNIQUE NOT NULL,
          username TEXT NOT NULL,
          username_lower TEXT NOT NULL,
          email TEXT,
          password_hash TEXT,
          google_id TEXT,
          created_at BIGINT,
          data JSONB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS indufront_sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS indufront_deleted_users (
          user_id TEXT PRIMARY KEY,
          deleted_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS indufront_social (
          key TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS indufront_clans (
          tag TEXT PRIMARY KEY,
          owner_public_id TEXT NOT NULL,
          elo INTEGER NOT NULL DEFAULT 1000,
          data JSONB NOT NULL,
          updated_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS indufront_player_stats (
          public_id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          qp INTEGER NOT NULL DEFAULT 0,
          elo_1v1 INTEGER NOT NULL DEFAULT 1000,
          elo_2v2 INTEGER NOT NULL DEFAULT 1000,
          elo_ffa INTEGER NOT NULL DEFAULT 1000,
          data JSONB NOT NULL,
          updated_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS indufront_match_history (
          game_id TEXT PRIMARY KEY,
          created_at BIGINT NOT NULL,
          data JSONB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS indufront_chats (
          id TEXT PRIMARY KEY,
          channel TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          target_id TEXT,
          created_at BIGINT NOT NULL,
          data JSONB NOT NULL
        );
      `);
      dbInitialized = true;
      console.log(
        "[db] PostgreSQL connected and all persistent tables initialized successfully!",
      );
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn("[db] Could not initialize PostgreSQL tables:", err.message);
    return false;
  }
}

export async function dbLoadUsers(): Promise<UserRecord[] | null> {
  const p = getDbPool();
  if (!p) return null;
  try {
    await initDbTables();
    const res = await p.query("SELECT data FROM indufront_users");
    return res.rows.map((r) => r.data as UserRecord);
  } catch (err: any) {
    console.warn("[db] dbLoadUsers failed:", err.message);
    return null;
  }
}

export async function dbLoadUserById(
  userId: string,
): Promise<UserRecord | null> {
  const p = getDbPool();
  if (!p) return null;
  try {
    await initDbTables();
    const res = await p.query(
      "SELECT data FROM indufront_users WHERE id = $1 LIMIT 1",
      [userId],
    );
    if (res.rows.length > 0) {
      return res.rows[0].data as UserRecord;
    }
    return null;
  } catch (err: any) {
    console.warn("[db] dbLoadUserById failed:", err.message);
    return null;
  }
}

export async function dbUpsertUser(u: UserRecord): Promise<void> {
  const p = getDbPool();
  if (!p) return;
  try {
    await initDbTables();
    await p.query(
      `INSERT INTO indufront_users (id, public_id, username, username_lower, email, password_hash, google_id, created_at, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         public_id = EXCLUDED.public_id,
         username = EXCLUDED.username,
         username_lower = EXCLUDED.username_lower,
         email = EXCLUDED.email,
         password_hash = COALESCE(EXCLUDED.password_hash, indufront_users.password_hash),
         google_id = COALESCE(EXCLUDED.google_id, indufront_users.google_id),
         data = EXCLUDED.data`,
      [
        u.id,
        u.publicId,
        u.username,
        u.usernameLower,
        u.email,
        u.passwordHash ?? null,
        u.googleId ?? null,
        u.createdAt,
        JSON.stringify(u),
      ],
    );
  } catch (err: any) {
    console.warn("[db] dbUpsertUser failed:", err.message);
  }
}

export async function dbDeleteUser(userId: string): Promise<void> {
  const p = getDbPool();
  if (!p) return;
  try {
    await initDbTables();
    await p.query("DELETE FROM indufront_users WHERE id = $1", [userId]);
    await p.query("DELETE FROM indufront_sessions WHERE user_id = $1", [
      userId,
    ]);
    await p.query(
      `INSERT INTO indufront_deleted_users (user_id, deleted_at)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET deleted_at = EXCLUDED.deleted_at`,
      [userId, Date.now()],
    );
  } catch (err: any) {
    console.warn("[db] dbDeleteUser failed:", err.message);
  }
}

export async function dbLoadDeletedUsers(): Promise<string[] | null> {
  const p = getDbPool();
  if (!p) return null;
  try {
    await initDbTables();
    const res = await p.query("SELECT user_id FROM indufront_deleted_users");
    return res.rows.map((r) => String(r.user_id));
  } catch (err: any) {
    console.warn("[db] dbLoadDeletedUsers failed:", err.message);
    return null;
  }
}

export async function dbLoadSessions(): Promise<SessionRecord[] | null> {
  const p = getDbPool();
  if (!p) return null;
  try {
    await initDbTables();
    const now = Date.now();
    await p.query("DELETE FROM indufront_sessions WHERE expires_at < $1", [
      now,
    ]);
    const res = await p.query(
      "SELECT token_hash, user_id, expires_at FROM indufront_sessions",
    );
    return res.rows.map((r) => ({
      tokenHash: String(r.token_hash),
      userId: String(r.user_id),
      expiresAt: Number(r.expires_at),
    }));
  } catch (err: any) {
    console.warn("[db] dbLoadSessions failed:", err.message);
    return null;
  }
}

export async function dbUpsertSession(s: SessionRecord): Promise<void> {
  const p = getDbPool();
  if (!p) return;
  try {
    await initDbTables();
    await p.query(
      `INSERT INTO indufront_sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (token_hash) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         expires_at = EXCLUDED.expires_at`,
      [s.tokenHash, s.userId, s.expiresAt],
    );
  } catch (err: any) {
    console.warn("[db] dbUpsertSession failed:", err.message);
  }
}

export async function dbDeleteSession(tokenHash: string): Promise<void> {
  const p = getDbPool();
  if (!p) return;
  try {
    await initDbTables();
    await p.query("DELETE FROM indufront_sessions WHERE token_hash = $1", [
      tokenHash,
    ]);
  } catch (err: any) {
    console.warn("[db] dbDeleteSession failed:", err.message);
  }
}

export async function dbDeleteAllUserSessions(userId: string): Promise<void> {
  const p = getDbPool();
  if (!p) return;
  try {
    await initDbTables();
    await p.query("DELETE FROM indufront_sessions WHERE user_id = $1", [
      userId,
    ]);
  } catch (err: any) {
    console.warn("[db] dbDeleteAllUserSessions failed:", err.message);
  }
}

export interface FullSocialDbData {
  clans: ClanRecord[];
  playerStats: Record<string, PlayerStatsRecord>;
  matches: MatchRecord[];
  globalChat: GlobalChatMessage[];
  directChat: DirectChatMessage[];
}

export async function dbLoadSocialData(): Promise<FullSocialDbData | null> {
  const p = getDbPool();
  if (!p) return null;
  try {
    await initDbTables();
    const mainRes = await p.query(
      "SELECT data FROM indufront_social WHERE key = 'social_main'",
    );
    const baseData: Partial<FullSocialDbData> =
      mainRes.rows.length > 0 ? mainRes.rows[0].data : {};

    const clansRes = await p.query("SELECT data FROM indufront_clans");
    const statsRes = await p.query(
      "SELECT public_id, data FROM indufront_player_stats",
    );
    const matchesRes = await p.query(
      "SELECT data FROM indufront_match_history ORDER BY created_at ASC LIMIT 1000",
    );
    const chatsRes = await p.query(
      "SELECT channel, data FROM indufront_chats ORDER BY created_at ASC LIMIT 1500",
    );

    const clansMap = new Map<string, ClanRecord>();
    for (const c of baseData.clans ?? []) {
      clansMap.set(c.tag.toUpperCase(), c);
    }
    for (const r of clansRes.rows) {
      const c = r.data as ClanRecord;
      if (c && c.tag) clansMap.set(c.tag.toUpperCase(), c);
    }

    const playerStats: Record<string, PlayerStatsRecord> = {
      ...(baseData.playerStats ?? {}),
    };
    for (const r of statsRes.rows) {
      const st = r.data as PlayerStatsRecord;
      if (st && st.publicId) {
        playerStats[st.publicId.toLowerCase()] = st;
      }
    }

    const matchesMap = new Map<string, MatchRecord>();
    for (const m of baseData.matches ?? []) {
      matchesMap.set(m.gameId, m);
    }
    for (const r of matchesRes.rows) {
      const m = r.data as MatchRecord;
      if (m && m.gameId) matchesMap.set(m.gameId, m);
    }

    const globalChatMap = new Map<string, GlobalChatMessage>();
    for (const msg of baseData.globalChat ?? []) {
      globalChatMap.set(msg.id, msg);
    }
    const directChatMap = new Map<string, DirectChatMessage>();
    for (const msg of baseData.directChat ?? []) {
      directChatMap.set(msg.id, msg);
    }
    for (const r of chatsRes.rows) {
      if (r.channel === "global") {
        const msg = r.data as GlobalChatMessage;
        if (msg?.id) globalChatMap.set(msg.id, msg);
      } else if (r.channel === "direct") {
        const msg = r.data as DirectChatMessage;
        if (msg?.id) directChatMap.set(msg.id, msg);
      }
    }

    return {
      clans: Array.from(clansMap.values()),
      playerStats,
      matches: Array.from(matchesMap.values()).slice(-1000),
      globalChat: Array.from(globalChatMap.values()).slice(-500),
      directChat: Array.from(directChatMap.values()).slice(-1000),
    };
  } catch (err: any) {
    console.warn("[db] dbLoadSocialData failed:", err.message);
    return null;
  }
}

export async function dbSaveSocialData(data: FullSocialDbData): Promise<void> {
  const p = getDbPool();
  if (!p) return;
  try {
    await initDbTables();
    const now = Date.now();
    await p.query(
      `INSERT INTO indufront_social (key, data, updated_at)
       VALUES ('social_main', $1, $2)
       ON CONFLICT (key) DO UPDATE SET
         data = EXCLUDED.data,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(data), now],
    );

    // Sync individual relational tables for clans & leaderboard stats
    for (const c of data.clans ?? []) {
      await p.query(
        `INSERT INTO indufront_clans (tag, owner_public_id, elo, data, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tag) DO UPDATE SET
           owner_public_id = EXCLUDED.owner_public_id,
           elo = EXCLUDED.elo,
           data = EXCLUDED.data,
           updated_at = EXCLUDED.updated_at`,
        [c.tag, c.ownerPublicId, c.elo ?? 1000, JSON.stringify(c), now],
      );
    }

    for (const st of Object.values(data.playerStats ?? {})) {
      await p.query(
        `INSERT INTO indufront_player_stats (public_id, username, qp, elo_1v1, elo_2v2, elo_ffa, data, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (public_id) DO UPDATE SET
           username = EXCLUDED.username,
           qp = EXCLUDED.qp,
           elo_1v1 = EXCLUDED.elo_1v1,
           elo_2v2 = EXCLUDED.elo_2v2,
           elo_ffa = EXCLUDED.elo_ffa,
           data = EXCLUDED.data,
           updated_at = EXCLUDED.updated_at`,
        [
          st.publicId.toLowerCase(),
          st.username,
          st.qp ?? 0,
          st.elo1v1 ?? 1000,
          st.elo2v2 ?? 1000,
          st.eloFfa ?? 1000,
          JSON.stringify(st),
          now,
        ],
      );
    }
  } catch (err: any) {
    console.warn("[db] dbSaveSocialData failed:", err.message);
  }
}

export async function dbDeleteClan(tag: string): Promise<void> {
  const p = getDbPool();
  if (!p) return;
  try {
    await initDbTables();
    await p.query("DELETE FROM indufront_clans WHERE tag = $1", [
      tag.toUpperCase(),
    ]);
  } catch (err: any) {
    console.warn("[db] dbDeleteClan failed:", err.message);
  }
}

export async function dbInsertMatch(match: MatchRecord): Promise<void> {
  const p = getDbPool();
  if (!p) return;
  try {
    await initDbTables();
    const ts = Date.parse(match.timestamp) || Date.now();
    await p.query(
      `INSERT INTO indufront_match_history (game_id, created_at, data)
       VALUES ($1, $2, $3)
       ON CONFLICT (game_id) DO UPDATE SET data = EXCLUDED.data`,
      [match.gameId, ts, JSON.stringify(match)],
    );
  } catch (err: any) {
    console.warn("[db] dbInsertMatch failed:", err.message);
  }
}

export async function dbInsertChat(
  channel: "global" | "direct",
  id: string,
  senderId: string,
  targetId: string | null,
  msgData: GlobalChatMessage | DirectChatMessage,
): Promise<void> {
  const p = getDbPool();
  if (!p) return;
  try {
    await initDbTables();
    await p.query(
      `INSERT INTO indufront_chats (id, channel, sender_id, target_id, created_at, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [id, channel, senderId, targetId, Date.now(), JSON.stringify(msgData)],
    );
  } catch (err: any) {
    console.warn("[db] dbInsertChat failed:", err.message);
  }
}

/**
 * Sends a real verification / password recovery email via Resend HTTP API or SMTP (e.g. Gmail).
 * Never exposes the code in HTTP responses.
 */
export async function sendAuthEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ delivered: boolean; provider: string }> {
  const fromEmail = process.env.EMAIL_FROM ?? "droxyplayzz@gmail.com";
  const resendKey = process.env.RESEND_API_KEY;

  // 1. Try Resend HTTP API if configured
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: `InduFront Security <${fromEmail}>`,
          to: [opts.to],
          subject: opts.subject,
          text: opts.text,
          html:
            opts.html ??
            `<pre style="font-family:sans-serif">${opts.text}</pre>`,
        }),
      });
      if (res.ok) {
        return { delivered: true, provider: "resend" };
      }
      console.warn(
        `[email] Resend API returned ${res.status}: ${await res.text()}`,
      );
    } catch (err: any) {
      console.warn("[email] Resend API failed:", err.message);
    }
  }

  // 2. Try native TLS SMTP (e.g. smtp.gmail.com:465 with SMTP_USER & SMTP_PASS)
  const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT ?? 465);
  const smtpUser = process.env.SMTP_USER ?? fromEmail;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      await sendSmtpMail({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        from: fromEmail,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
      });
      return { delivered: true, provider: "smtp" };
    } catch (err: any) {
      console.warn("[email] SMTP delivery failed:", err.message);
    }
  }

  console.log(
    `[email-fallback] (Kein SMTP_PASS/RESEND_API_KEY gesetzt) E-Mail an ${opts.to} | Betreff: ${opts.subject}`,
  );
  return { delivered: false, provider: "none" };
}

function sendSmtpMail(cfg: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const useTls = cfg.port === 465;
    const socket = useTls
      ? tls.connect({
          host: cfg.host,
          port: cfg.port,
          servername: cfg.host,
          rejectUnauthorized: false,
        })
      : net.connect({ host: cfg.host, port: cfg.port });

    let step = 0;
    let buffer = "";
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("SMTP timeout"));
    }, 10000);

    const sendLine = (line: string) => {
      socket.write(line + "\r\n");
    };

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.length < 3) continue;
        // Wait until multiline response finishes (4th char is space, not '-')
        if (line[3] === "-") continue;
        const code = parseInt(line.slice(0, 3), 10);
        if (code >= 400) {
          clearTimeout(timeout);
          socket.destroy();
          reject(new Error(`SMTP error ${code}: ${line}`));
          return;
        }

        if (step === 0 && code === 220) {
          step = 1;
          sendLine(`EHLO indufront.local`);
        } else if (step === 1 && code === 250) {
          step = 2;
          sendLine("AUTH LOGIN");
        } else if (step === 2 && code === 334) {
          step = 3;
          sendLine(Buffer.from(cfg.user, "utf8").toString("base64"));
        } else if (step === 3 && code === 334) {
          step = 4;
          sendLine(Buffer.from(cfg.pass, "utf8").toString("base64"));
        } else if (step === 4 && code === 235) {
          step = 5;
          sendLine(`MAIL FROM:<${cfg.from}>`);
        } else if (step === 5 && code === 250) {
          step = 6;
          sendLine(`RCPT TO:<${cfg.to}>`);
        } else if (step === 6 && code === 250) {
          step = 7;
          sendLine("DATA");
        } else if (step === 7 && code === 354) {
          step = 8;
          const msg = [
            `From: "InduFront Security" <${cfg.from}>`,
            `To: <${cfg.to}>`,
            `Subject: =?UTF-8?B?${Buffer.from(cfg.subject, "utf8").toString("base64")}?=`,
            `MIME-Version: 1.0`,
            `Content-Type: text/plain; charset=UTF-8`,
            `Date: ${new Date().toUTCString()}`,
            ``,
            cfg.text.replace(/\r?\n/g, "\r\n"),
            `.`,
          ].join("\r\n");
          sendLine(msg);
        } else if (step === 8 && code === 250) {
          step = 9;
          sendLine("QUIT");
          clearTimeout(timeout);
          socket.end();
          resolve();
        }
      }
    });
  });
}
