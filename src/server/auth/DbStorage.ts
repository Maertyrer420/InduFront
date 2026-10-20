import pg from "pg";
import { UserRecord } from "./AuthStore";

let pool: pg.Pool | null = null;
let dbInitialized = false;

export function getDbPool(): pg.Pool | null {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) return null;
  if (!pool) {
    try {
      const isLocal = connStr.includes("localhost") || connStr.includes("127.0.0.1");
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
        CREATE TABLE IF NOT EXISTS indufront_social (
          key TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at BIGINT NOT NULL
        );
      `);
      dbInitialized = true;
      console.log("[db] PostgreSQL connected and tables initialized successfully!");
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
         password_hash = EXCLUDED.password_hash,
         google_id = EXCLUDED.google_id,
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
    await p.query("DELETE FROM indufront_sessions WHERE user_id = $1", [userId]);
  } catch (err: any) {
    console.warn("[db] dbDeleteUser failed:", err.message);
  }
}

export async function dbLoadSocialData(): Promise<any | null> {
  const p = getDbPool();
  if (!p) return null;
  try {
    await initDbTables();
    const res = await p.query("SELECT data FROM indufront_social WHERE key = 'social_main'");
    if (res.rows.length > 0) {
      return res.rows[0].data;
    }
    return null;
  } catch (err: any) {
    console.warn("[db] dbLoadSocialData failed:", err.message);
    return null;
  }
}

export async function dbSaveSocialData(data: any): Promise<void> {
  const p = getDbPool();
  if (!p) return;
  try {
    await initDbTables();
    await p.query(
      `INSERT INTO indufront_social (key, data, updated_at)
       VALUES ('social_main', $1, $2)
       ON CONFLICT (key) DO UPDATE SET
         data = EXCLUDED.data,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(data), Date.now()],
    );
  } catch (err: any) {
    console.warn("[db] dbSaveSocialData failed:", err.message);
  }
}
