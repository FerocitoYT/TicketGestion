const base = "http://127.0.0.1:3103";
for (let i = 0; i < 30; i++) {
  try { const r = await fetch(base + "/"); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
// 1. /validar sin sesión -> redirige a login
const anon = await fetch(base + "/validar", { redirect: "manual" });
console.log("VALIDAR sin login:", anon.status, anon.headers.get("location"));
// 2. API sin sesión -> 401
const api = await fetch(base + "/api/validar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: "XXXX.YYYY" }) });
console.log("API sin login:", api.status, JSON.stringify(await api.json()));
// 3. registro de propietario de prueba
const email = `portero-${Date.now()}@example.com`;
const reg = await fetch(base + "/api/auth/registro", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Jefe Puerta", email, password: "password123", orgName: "Puerta Test SA" }) });
console.log("REGISTRO:", reg.status);
const cookie = (reg.headers.get("set-cookie") || "").split(";")[0];
// 4. /validar con sesión -> 200 y muestra escáner
const page = await fetch(base + "/validar", { headers: { cookie } });
const html = await page.text();
console.log("VALIDAR con login:", page.status, html.includes("Escanear QR con cámara") || html.includes("no soporta escaneo") ? "ESCANER-OK" : "SIN-ESCANER");
// 5. API con sesión pero QR malo -> 400 (pasa auth, falla firma)
const bad = await fetch(base + "/api/validar", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ payload: "FALSO.FIRMA" }) });
console.log("API con login + QR falso:", bad.status, JSON.stringify(await bad.json()).slice(0, 80));
// 6. crear cuenta scanner desde panel
const st = await fetch(base + "/api/panel/members", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ name: "Portero 1", email: `scan-${Date.now()}@example.com`, password: "password123", role: "scanner" }) });
console.log("ALTA scanner:", st.status, JSON.stringify(await st.json()));
// limpieza
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
const txt = readFileSync(".env.local", "utf8");
let url = "";
for (const l of txt.split("\n")) { const m = l.match(/^DATABASE_URL=(.*)$/); if (m) url = m[1].trim(); }
const sql = neon(url);
await sql`DELETE FROM memberships WHERE org_id IN (SELECT id FROM orgs WHERE slug LIKE 'puerta-test%')`;
await sql`DELETE FROM users WHERE email=${email}`;
await sql`DELETE FROM users WHERE email LIKE 'scan-%@example.com'`;
await sql`DELETE FROM orgs WHERE slug LIKE 'puerta-test%'`;
console.log("LIMPIO OK");
