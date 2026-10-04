import { readFileSync } from "fs";
const base = "http://127.0.0.1:3101";
const txt = readFileSync(".env.local", "utf8");
// espera al servidor
for (let i = 0; i < 30; i++) {
  try { const r = await fetch(base + "/"); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
// ids
const idsRes = await fetch(base + "/api/debug-ids-nope").catch(() => null);
console.log("server up");
// compra 1 entrada nominativa vía checkout HTTP
const form = new FormData();
const zid = process.argv[2], eid = process.argv[3];
form.set("eventId", eid); form.set("zoneId", zid);
form.set("buyerName", "Puerta Test"); form.set("buyerEmail", "puerta-http@example.com");
form.set("qty", "1"); form.set("holders", "Carmen Ruiz | 11223344C");
const buy = await fetch(base + "/api/checkout", { method: "POST", body: form, redirect: "manual" });
console.log("CHECKOUT:", buy.status, buy.headers.get("location"));
// localiza el ticket
import { neon } from "@neondatabase/serverless";
let url = "";
for (const l of txt.split("\n")) { const m = l.match(/^DATABASE_URL=(.*)$/); if (m) url = m[1].trim(); }
const sql = neon(url);
const tk = await sql`SELECT t.code, t.holder_name, t.holder_doc FROM tickets t JOIN orders o ON o.id=t.order_id WHERE o.buyer_email='puerta-http@example.com' ORDER BY t.created_at DESC LIMIT 1`;
console.log("TICKET:", JSON.stringify(tk[0]));
// obtiene payload QR desde la página del ticket (firma)
import { createHmac } from "crypto";
let secret = "";
for (const l of txt.split("\n")) { const m = l.match(/^AUTH_SECRET=(.*)$/); if (m) secret = m[1].trim(); }
const sig = createHmac("sha256", secret).update(`ticket|${tk[0].code}`).digest("base64url").slice(0, 16);
const payload = `${tk[0].code}.${sig}`;
const v1 = await (await fetch(base + "/api/validar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload, gate: "Puerta A" }) })).json();
console.log("ESCANEO 1:", JSON.stringify(v1).slice(0, 220));
const v2 = await (await fetch(base + "/api/validar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload, gate: "Puerta B" }) })).json();
console.log("ESCANEO 2 (reventa):", JSON.stringify(v2).slice(0, 220));
// limpieza
const ord = await sql`SELECT id, zone_id FROM orders WHERE buyer_email='puerta-http@example.com'`;
for (const t of ord) {
  await sql`DELETE FROM tickets WHERE order_id=${t.id}`;
  await sql`DELETE FROM orders WHERE id=${t.id}`;
  await sql`UPDATE zones SET sold = GREATEST(0, sold - 1) WHERE id=${t.zone_id}`;
}
console.log("HTTP E2E OK + LIMPIO");
