// Siembra artistas españoles reales y los vincula al festival demo.
// Uso: node scripts/seed-artists.mjs <email> <password>
const base = process.env.SEED_BASE || "http://127.0.0.1:3116";
const [email, password] = process.argv.slice(2);
if (!email || !password) throw new Error("Uso: node scripts/seed-artists.mjs <email> <password>");
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
const txt = readFileSync(".env.local", "utf8");
let url = "";
for (const l of txt.split("\n")) { const m = l.match(/^DATABASE_URL=(.*)$/); if (m) url = m[1].trim(); }
const sql = neon(url);
const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
if (!login.ok) throw new Error("login fallido");
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const ev = await sql`SELECT id FROM events WHERE slug='festival-horizonte' LIMIT 1`;
for (const name of ["Rosalía", "Alejandro Sanz", "Aitana", "Manuel Carrasco", "David Bisbal"]) {
  const s = await fetch(base + "/api/panel/artists/search?q=" + encodeURIComponent(name), { headers: { cookie } });
  const j = await s.json();
  const first = (j.artists || [])[0];
  if (!first) { console.log("SIN RESULTADO:", name); continue; }
  const a = await fetch(base + "/api/panel/artists/attach", {
    method: "POST", headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ eventId: ev[0].id, mbid: first.mbid, name: first.name, genre: first.genre }),
  });
  console.log("ATTACH", name, "->", first.name, a.status);
}
const n = await sql`SELECT COUNT(*) AS n FROM artists`;
console.log("ARTISTAS TOTAL:", n[0].n);
