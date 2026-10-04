import { getDb } from "@/lib/db";

// Rate limiting persistente simple por clave + ventana.
export async function checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY, count INT NOT NULL DEFAULT 0, window_start TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  const rows = await sql`SELECT count, window_start FROM rate_limits WHERE key=${key} LIMIT 1`;
  const now = Date.now();
  if (!rows[0]) {
    await sql`INSERT INTO rate_limits (key, count) VALUES (${key}, 1)
      ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1`;
    return true;
  }
  const start = new Date(rows[0].window_start as string).getTime();
  if (now - start > windowSec * 1000) {
    await sql`UPDATE rate_limits SET count=1, window_start=now() WHERE key=${key}`;
    return true;
  }
  if (Number(rows[0].count) >= limit) return false;
  await sql`UPDATE rate_limits SET count = count + 1 WHERE key=${key}`;
  return true;
}
