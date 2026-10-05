const base = "http://127.0.0.1:3123";
for (let i = 0; i < 30; i++) {
  try { const r = await fetch(base + "/"); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
const txt = readFileSync(".env.local", "utf8");
let url = "";
for (const l of txt.split("\n")) { const m = l.match(/^DATABASE_URL=(.*)$/); if (m) url = m[1].trim(); }
const sql = neon(url);
const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@admin.es", password: "admin123" }) });
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const ev = await sql`SELECT id FROM events WHERE slug='teatro-casa-bernarda' LIMIT 1`;
const sess = await sql`SELECT id FROM sessions WHERE event_id=${ev[0].id} ORDER BY starts_at LIMIT 1`;
const zf = new FormData();
zf.set("eventId", ev[0].id); zf.set("sessionId", sess[0].id);
zf.set("name", "Zona Hold"); zf.set("price", "15"); zf.set("capacity", "12");
zf.set("seatRows", "3"); zf.set("seatCols", "4");
await fetch(base + "/api/panel/zones", { method: "POST", headers: { cookie }, body: zf, redirect: "manual" });
const z = await sql`SELECT id FROM zones WHERE event_id=${ev[0].id} AND name='Zona Hold' LIMIT 1`;
const zid = z[0].id;
const hold = async (seats) => {
  const r = await fetch(base + "/api/holds", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ zoneId: zid, seats }) });
  return { status: r.status, body: await r.json() };
};
const h1 = await hold(["A1", "A2"]);
console.log("1. HOLD A1,A2:", h1.status, h1.body.ok ? "OK exp:" + h1.body.expiresAt.slice(11, 16) : JSON.stringify(h1.body));
console.log("2. HOLD rival A1:", JSON.stringify(await hold(["A1"])));
const map = await (await fetch(base + `/api/zones/${zid}/seats`)).json();
console.log("3. MAPA held:", JSON.stringify(map.held));
async function buy(seats, email, holdId) {
  const f = new FormData();
  f.set("eventId", ev[0].id); f.set("zoneId", zid);
  f.set("buyerName", "Hold"); f.set("buyerEmail", email);
  f.set("qty", String(seats.length)); f.set("seats", JSON.stringify(seats));
  if (holdId) f.set("holdId", holdId);
  f.set("holders", "Hold Uno | 11111111A\nHold Dos | 22222222B");
  const r = await fetch(base + "/api/checkout", { method: "POST", body: f, redirect: "manual" });
  return { status: r.status, body: (await r.text()).slice(0, 90) };
}
console.log("4. COMPRA sin hold:", JSON.stringify(await buy(["B1"], "a@example.com", "")));
console.log("5. COMPRA con hold:", JSON.stringify(await buy(["A1", "A2"], "hold@example.com", h1.body.holdId)));
const tk = await sql`SELECT seat FROM tickets t JOIN orders o ON o.id=t.order_id WHERE o.buyer_email='hold@example.com' ORDER BY seat`;
console.log("6. TICKETS:", JSON.stringify(tk.map((t) => t.seat)));
const hh = await sql`SELECT COUNT(*) AS n FROM seat_holds WHERE hold_id=${h1.body.holdId}`;
console.log("7. HOLD consumida:", hh[0].n === 0 || hh[0].n === "0" ? "OK" : "FALLO");
// caducidad: nueva reserva, expirar a mano, re-reservar
const h2 = await hold(["B1", "B2"]);
await sql`UPDATE seat_holds SET expires_at = now() - interval '1 minute' WHERE hold_id=${h2.body.holdId}`;
const h3 = await hold(["B1", "B2"]);
console.log("8. RE-HOLD tras caducar:", h3.status, "(200 esperado)");
await fetch(base + "/api/holds", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ holdId: h3.body.holdId }) });
// limpieza
const ord = await sql`SELECT o.id, o.zone_id, o.qty FROM orders o JOIN zones z ON z.id=o.zone_id WHERE z.name='Zona Hold'`;
for (const o of ord) {
  await sql`DELETE FROM tickets WHERE order_id=${o.id}`;
  await sql`DELETE FROM orders WHERE id=${o.id}`;
  await sql`UPDATE zones SET sold = GREATEST(0, sold - ${o.qty}) WHERE id=${o.zone_id}`;
}
await sql`DELETE FROM seat_holds WHERE zone_id=${zid}`;
await sql`DELETE FROM zones WHERE id=${zid}`;
console.log("E2E HOLDS OK");
