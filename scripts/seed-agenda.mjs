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
const org = await sql`SELECT id FROM orgs WHERE slug='demo-promotora' LIMIT 1`;
const orgId = org[0]?.id;
if (!orgId) throw new Error("falta seed base (seed.mjs)");
const v = await sql`SELECT id FROM venues WHERE org_id=${orgId} LIMIT 1`;
const venueId = v[0]?.id || null;
const day = 864e5;
const now = Date.now();
const demo = [
  ["Derbi de la ciudad: Rojos vs Azules", "derbi-rojos-vs-azules", "deporte", "El partido del año en casa. Ambiente garantizado.", 12, [["Tribuna Baja", 4500, 8000], ["Fondo Norte", 2500, 6000], ["VIP Palco", 12000, 500]]],
  ["Noche de teatro: La casa de Bernarda", "teatro-casa-bernarda", "teatro", "Clásico imprescindible con la compañía nacional.", 20, [["Platea", 2800, 400], ["Anfiteatro", 1800, 300]]],
  ["Festival Horizonte 3 días", "festival-horizonte", "festival", "Tres días, cuatro escenarios y más de 40 artistas.", 45, [["Abono General", 9900, 10000], ["Abono VIP", 19900, 1500]]],
  ["Gira acústica: Marina Sol", "marina-sol-acustico", "concierto", "Concierto íntimo en formato acústico.", 8, [["Pista", 3000, 1200], ["Balcón", 4200, 400]]],
];
for (const [title, slug, cat, desc, inDays, zones] of demo) {
  const starts = new Date(now + inDays * day).toISOString();
  const ev = await sql`
    INSERT INTO events (org_id, venue_id, title, slug, description, category, starts_at, status)
    VALUES (${orgId}, ${venueId}, ${title}, ${slug}, ${desc}, ${cat}, ${starts}, 'published')
    ON CONFLICT (slug) DO UPDATE SET status='published', starts_at=EXCLUDED.starts_at RETURNING id`;
  const eventId = ev[0].id;
  const existing = await sql`SELECT COUNT(*) AS n FROM zones WHERE event_id=${eventId}`;
  if (Number(existing[0].n) === 0) {
    for (const [name, price, cap] of zones) {
      await sql`INSERT INTO zones (event_id, name, price_cents, capacity) VALUES (${eventId}, ${name}, ${price}, ${cap})`;
    }
  }
  console.log("OK", slug);
}
console.log("Seed agenda OK");
