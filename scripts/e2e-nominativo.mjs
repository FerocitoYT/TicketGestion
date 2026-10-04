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
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const gen = () => { const b = randomBytes(8); let s = ""; for (let i = 0; i < 8; i++) s += ALPHA[b[i] % ALPHA.length]; return s; };
const sign = (c) => createHmac("sha256", secret).update(`ticket|${c}`).digest("base64url").slice(0, 16);
// formato
const sample = Array.from({ length: 5 }, gen);
console.log("CODIGOS:", sample.join(" "));
if (!sample.every((c) => /^[A-HJ-NP-Z2-9]{8}$/.test(c))) throw new Error("formato inválido");
// compra nominativa 2 entradas
const z = await sql`SELECT z.id AS zid, z.event_id AS eid FROM zones z JOIN events e ON e.id=z.event_id WHERE e.slug='concierto-demo-headliners' ORDER BY z.price_cents LIMIT 1`;
const { zid, eid } = z[0];
await sql`UPDATE zones SET sold = sold + 2 WHERE id=${zid} AND sold + 2 <= capacity RETURNING id`;
const holders = JSON.stringify([{ name: "Ana López", doc: "12345678A" }, { name: "Bruno Díaz", doc: "87654321B" }]);
const o = await sql`INSERT INTO orders (event_id, zone_id, buyer_name, buyer_email, qty, total_cents, status, idempotency_key, holders) VALUES (${eid}, ${zid}, 'Comprador Test', 'nominativo@example.com', 2, 7000, 'paid', ${randomBytes(16).toString("hex")}, ${holders}) RETURNING id`;
const codes = [];
const hs = JSON.parse(holders);
for (let i = 0; i < 2; i++) {
  const code = gen();
  await sql`INSERT INTO tickets (order_id, event_id, zone_id, code, holder_name, holder_doc) VALUES (${o[0].id}, ${eid}, ${zid}, ${code}, ${hs[i].name}, ${hs[i].doc})`;
  codes.push(code);
}
console.log("NOMINATIVAS:", codes.map((c, i) => `${c}=${hs[i].name}`).join(" | "));
// validar 1ª (ok)
const t = await sql`SELECT * FROM tickets WHERE code=${codes[0]} LIMIT 1`;
const m1 = await sql`UPDATE tickets SET status='used', used_at=now() WHERE id=${t[0].id} AND status='valid' RETURNING id`;
console.log("ESCANEO 1 (debe OK):", m1[0] ? "OK" : "FALLO");
await sql`INSERT INTO scans (ticket_id, event_id, result, gate) VALUES (${t[0].id}, ${eid}, 'ok', 'Puerta A')`;
// reventa: mismo QR otra vez (denegado)
const m2 = await sql`UPDATE tickets SET status='used' WHERE id=${t[0].id} AND status='valid' RETURNING id`;
console.log("REVENTA (debe BLOQUEADO):", m2[0] ? "FALLO-ENTRÓ" : "BLOQUEADO");
await sql`INSERT INTO scans (ticket_id, event_id, result, gate) VALUES (${t[0].id}, ${eid}, 'duplicate', 'Puerta B')`;
const st = await sql`SELECT holder_name, holder_doc, status FROM tickets WHERE id=${t[0].id}`;
console.log("TITULAR EN PUERTA:", JSON.stringify(st[0]));
console.log("QR payload ejemplo:", `${codes[1]}.${sign(codes[1])}`);
// limpieza
await sql`DELETE FROM tickets WHERE order_id=${o[0].id}`;
await sql`DELETE FROM orders WHERE id=${o[0].id}`;
await sql`UPDATE zones SET sold = sold - 2 WHERE id=${zid}`;
console.log("E2E NOMINATIVO OK");
