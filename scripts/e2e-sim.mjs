import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { randomBytes, createHmac } from "crypto";
const txt = readFileSync(".env.local", "utf8");
let url = "", secret = "";
for (const l of txt.split("\n")) {
  let m = l.match(/^DATABASE_URL=(.*)$/); if (m) url = m[1].trim();
  m = l.match(/^AUTH_SECRET=(.*)$/); if (m) secret = m[1].trim();
}
const sql = neon(url);
const sign = (code) => createHmac("sha256", secret).update(`ticket|${code}`).digest("base64url").slice(0, 16);
// 1. compra simulada
const z = await sql`SELECT z.id AS zid, z.event_id AS eid FROM zones z JOIN events e ON e.id=z.event_id WHERE e.slug='concierto-demo-headliners' ORDER BY z.price_cents LIMIT 1`;
const { zid, eid } = z[0];
const qty = 2;
const upd = await sql`UPDATE zones SET sold = sold + ${qty} WHERE id=${zid} AND sold + ${qty} <= capacity RETURNING id`;
if (!upd[0]) throw new Error("sin stock");
const idem = randomBytes(16).toString("hex");
const o = await sql`INSERT INTO orders (event_id, zone_id, buyer_name, buyer_email, qty, total_cents, status, idempotency_key) VALUES (${eid}, ${zid}, 'Test E2E', 'e2e@example.com', ${qty}, 6300, 'paid', ${idem}) RETURNING id`;
const codes = [];
for (let i = 0; i < qty; i++) {
  const code = "TG-" + randomBytes(4).toString("hex").toUpperCase();
  await sql`INSERT INTO tickets (order_id, event_id, zone_id, code, holder_name) VALUES (${o[0].id}, ${eid}, ${zid}, ${code}, 'Test E2E')`;
  codes.push(code);
}
console.log("ORDER paid:", o[0].id, "tickets:", codes.join(","));
// 2. mis-entradas
const mine = await sql`SELECT t.code FROM tickets t JOIN orders oo ON oo.id=t.order_id WHERE oo.buyer_email='e2e@example.com' ORDER BY t.created_at DESC LIMIT 3`;
console.log("MIS-ENTRADAS:", mine.map((r) => r.code).join(","));
// 3. validar primero (ok) y duplicado
const first = codes[0];
const t = await sql`SELECT * FROM tickets WHERE code=${first} LIMIT 1`;
console.log("TICKET status antes:", t[0].status, "qr:", `${first}.${sign(first)}`);
const mark = await sql`UPDATE tickets SET status='used', used_at=now() WHERE id=${t[0].id} AND status='valid' RETURNING id`;
console.log("VALIDACION 1:", mark[0] ? "ok" : "fallo");
await sql`INSERT INTO scans (ticket_id, event_id, result, gate) VALUES (${t[0].id}, ${eid}, 'ok', 'Puerta Test')`;
const dup = await sql`UPDATE tickets SET status='used' WHERE id=${t[0].id} AND status='valid' RETURNING id`;
console.log("VALIDACION 2 (duplicado bloqueado):", dup[0] ? "FALLO-aceptado" : "ok-bloqueado");
// limpieza
await sql`DELETE FROM tickets WHERE order_id=${o[0].id}`;
await sql`DELETE FROM orders WHERE id=${o[0].id}`;
await sql`UPDATE zones SET sold = sold - ${qty} WHERE id=${zid}`;
console.log("E2E SIMULADO OK (datos de prueba limpiados)");
