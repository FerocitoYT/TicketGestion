const base = "http://127.0.0.1:3122";
for (let i = 0; i < 30; i++) {
  try { const r = await fetch(base + "/"); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { createHmac, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
const txt = readFileSync(".env.local", "utf8");
let url = "", secret = "";
for (const l of txt.split("\n")) { let m = l.match(/^DATABASE_URL=(.*)$/); if (m) url = m[1].trim(); m = l.match(/^AUTH_SECRET=(.*)$/); if (m) secret = m[1].trim(); }
const sql = neon(url);
const sig = (c) => createHmac("sha256", secret).update(`ticket|${c}`).digest("base64url").slice(0, 16);
const org = await sql`SELECT id FROM orgs WHERE slug='demo-promotora' LIMIT 1`;
const evA = await sql`SELECT id FROM events WHERE slug='concierto-demo-headliners' LIMIT 1`;
const zA = await sql`SELECT id FROM zones WHERE event_id=${evA[0].id} ORDER BY price_cents LIMIT 1`;
const email = `off-${Date.now()}@example.com`;
const u = await sql`INSERT INTO users (name, email, password_hash) VALUES ('Off', ${email}, ${await bcrypt.hash("password123", 10)}) RETURNING id`;
await sql`INSERT INTO memberships (user_id, org_id, role) VALUES (${u[0].id}, ${org[0].id}, 'scanner')`;
await sql`INSERT INTO event_staff (event_id, user_id) VALUES (${evA[0].id}, ${u[0].id})`;
const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "password123" }) });
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
// ticket + manifest + ics + reminders endpoint reachability
const code = "OF" + randomBytes(3).toString("hex").toUpperCase();
const o = await sql`INSERT INTO orders (event_id, zone_id, buyer_name, buyer_email, qty, total_cents, status, idempotency_key) VALUES (${evA[0].id}, ${zA[0].id}, 'Off', 'off@example.com', 1, 1000, 'paid', ${randomBytes(16).toString("hex")}) RETURNING id`;
await sql`INSERT INTO tickets (order_id, event_id, zone_id, code, holder_name) VALUES (${o[0].id}, ${evA[0].id}, ${zA[0].id}, ${code}, 'Off')`;
const lista = await fetch(base + "/api/puerta/lista", { headers: { cookie } });
const lj = await lista.json();
console.log("LISTA:", lista.status, lj.tickets?.length, "entradas;", lj.tickets?.some((t) => t.code === code) ? "INCLUYE-QR-OK" : "FALTA-QR");
const payload = `${code}.${sig(code)}`;
const s1 = await fetch(base + "/api/puerta/sync", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ items: [{ payload, at: new Date().toISOString() }] }) });
console.log("SYNC 1:", s1.status, JSON.stringify(await s1.json()).slice(0, 120));
const s2 = await fetch(base + "/api/puerta/sync", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ items: [{ payload, at: new Date().toISOString() }] }) });
const j2 = await s2.json();
console.log("SYNC 2 (duplicado):", s2.status, "confirmed:", j2.confirmed, "detail:", j2.results?.[0]?.detail?.slice(0, 60));
const ics = await fetch(base + `/api/tickets/${code}/ics`, { headers: { cookie }, redirect: "manual" });
console.log("ICS:", ics.status, (await ics.text()).includes("BEGIN:VEVENT") ? "OK" : "FALLO");
const man = await fetch(base + "/manifest.webmanifest");
console.log("MANIFEST:", man.status);
const sw = await fetch(base + "/sw.js");
console.log("SW:", sw.status);
// limpieza
await sql`DELETE FROM tickets WHERE order_id=${o[0].id}`;
await sql`DELETE FROM orders WHERE id=${o[0].id}`;
await sql`UPDATE zones SET sold = GREATEST(0, sold - 1) WHERE id=${zA[0].id}`;
await sql`DELETE FROM scans WHERE scanned_by=${u[0].id}`;
await sql`DELETE FROM event_staff WHERE user_id=${u[0].id}`;
await sql`DELETE FROM memberships WHERE user_id=${u[0].id}`;
await sql`DELETE FROM users WHERE id=${u[0].id}`;
console.log("E2E PACK2 OK");
