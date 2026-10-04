import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
function loadEnv() {
  try {
    const txt = readFileSync(".env.local", "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();
const sql = neon(process.env.DATABASE_URL);
const org = await sql`INSERT INTO orgs (name, slug) VALUES ('Demo Promotora', 'demo-promotora') ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`;
const orgId = org[0].id;
const venue = await sql`INSERT INTO venues (org_id, name, city, address, capacity) VALUES (${orgId}, 'WiZink Center Demo', 'Madrid', 'Av. Felipe II s/n', 15000) RETURNING id`;
const starts = new Date(Date.now() + 30 * 864e5).toISOString();
const ev = await sql`
  INSERT INTO events (org_id, venue_id, title, slug, description, category, starts_at, status)
  VALUES (${orgId}, ${venue[0].id}, 'Concierto Demo: Los Headliners', 'concierto-demo-headliners', 'Concierto de ejemplo con dos zonas y código promo EARLY10.', 'concierto', ${starts}, 'published')
  ON CONFLICT (slug) DO UPDATE SET status='published', starts_at=EXCLUDED.starts_at RETURNING id`;
const eventId = ev[0].id;
await sql`DELETE FROM zones WHERE event_id=${eventId}`;
await sql`INSERT INTO zones (event_id, name, price_cents, capacity) VALUES
  (${eventId}, 'Pista General', 3500, 5000),
  (${eventId}, 'Grada Premium', 6500, 2000)`;
await sql`INSERT INTO promo_codes (event_id, code, pct_off, max_uses) VALUES (${eventId}, 'EARLY10', 10, 200) ON CONFLICT (event_id, code) DO NOTHING`;
console.log("Seed OK org=", orgId, "event=", eventId);
