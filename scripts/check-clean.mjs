import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
const txt = readFileSync(".env.local", "utf8");
let url = "";
for (const l of txt.split("\n")) {
  const m = l.match(/^DATABASE_URL=(.*)$/);
  if (m) url = m[1].trim();
}
const sql = neon(url);
const orders = await sql`SELECT id, buyer_email, qty, total_cents, status FROM orders ORDER BY created_at DESC LIMIT 5`;
console.log("ULTIMOS PEDIDOS:", JSON.stringify(orders));
// Limpia pedidos de prueba web (conserva seed: zonas/evento)
const tests = await sql`SELECT id, zone_id FROM orders WHERE buyer_email IN ('test-web@example.com','test-pruebas@example.com')`;
for (const t of tests) {
  await sql`DELETE FROM tickets WHERE order_id=${t.id}`;
  await sql`DELETE FROM orders WHERE id=${t.id}`;
  await sql`UPDATE zones SET sold = GREATEST(0, sold - 1) WHERE id=${t.zone_id}`;
}
console.log("LIMPIEZA TESTS OK:", tests.length);
