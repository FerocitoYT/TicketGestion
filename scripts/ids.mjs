import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
const txt = readFileSync(".env.local", "utf8");
let url = "";
for (const l of txt.split("\n")) {
  const m = l.match(/^DATABASE_URL=(.*)$/);
  if (m) url = m[1].trim();
}
const sql = neon(url);
const z = await sql`SELECT z.event_id AS "eventId", z.id AS "zoneId" FROM zones z JOIN events e ON e.id=z.event_id WHERE e.slug='concierto-demo-headliners' ORDER BY z.price_cents LIMIT 1`;
process.stdout.write(JSON.stringify(z[0]));
