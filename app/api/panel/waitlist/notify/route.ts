import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { baseUrl } from "@/lib/site-url";

// Aviso manual a un apuntado (o comprobación general si no se indica id).
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const sql = getDb();
  const ct = req.headers.get("content-type") || "";
  let id = "";
  if (ct.includes("application/json")) {
    id = String((await req.json()).id || "");
  } else {
    const f = await req.formData();
    id = String(f.get("id") || "");
  }
  const rows = id
    ? await sql`SELECT w.id, w.email, w.qty, z.id AS zid, z.name, z.capacity, z.sold, e.title AS event, e.org_id
        FROM waitlist w JOIN zones z ON z.id=w.zone_id JOIN events e ON e.id=z.event_id WHERE w.id=${id} LIMIT 1`
    : await sql`SELECT w.id, w.email, w.qty, z.id AS zid, z.name, z.capacity, z.sold, e.title AS event, e.org_id
        FROM waitlist w JOIN zones z ON z.id=w.zone_id JOIN events e ON e.id=z.event_id
        WHERE e.org_id=${s.orgId} AND w.notified_at IS NULL AND z.capacity > z.sold
        ORDER BY w.created_at ASC LIMIT 50`;
  let n = 0;
  for (const w of rows) {
    if (String(w.org_id) !== s.orgId) continue;
    if (Number(w.capacity) - Number(w.sold) < Number(w.qty)) continue;
    const app = baseUrl(req);
    await sendEmail(
      String(w.email),
      `¡Sitio libre en ${String(w.name)}: ${String(w.event)}!`,
      `<p>Hola,</p><p>Hay sitio para <strong>${w.qty} entrada(s)</strong> en <strong>${String(w.name)}</strong> (${String(w.event)}): <a href="${app}/comprar?zone=${w.zid}">Comprar ahora</a>.</p>`
    );
    await sql`UPDATE waitlist SET notified_at=now() WHERE id=${w.id}`;
    n++;
  }
  if (ct.includes("application/json")) return NextResponse.json({ ok: true, notified: n });
  const back = req.headers.get("referer") || "/panel";
  return NextResponse.redirect(new URL(back.split("?")[0], req.url), 303);
}
