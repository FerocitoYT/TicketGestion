import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

// Apuntarse a la lista de espera de una zona (email + cantidad).
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!(await checkRateLimit(`wait:${ip}`, 10, 600))) {
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  }
  const ct = req.headers.get("content-type") || "";
  let zoneId = "", email = "", qty = 1;
  if (ct.includes("application/json")) {
    const b = z.object({ zoneId: z.string().uuid(), email: z.string().email().max(160), qty: z.number().int().min(1).max(50).optional() }).safeParse(await req.json());
    if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    zoneId = b.data.zoneId; email = b.data.email.toLowerCase(); qty = b.data.qty || 1;
  } else {
    const f = await req.formData();
    zoneId = String(f.get("zoneId") || "");
    email = String(f.get("email") || "").toLowerCase();
    qty = Math.min(50, Math.max(1, Number(f.get("qty") || 1)));
    if (!zoneId || !email.includes("@")) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }
  const sql = getDb();
  const zone = await sql`SELECT z.id FROM zones z JOIN events e ON e.id=z.event_id WHERE z.id=${zoneId} AND e.status='published' LIMIT 1`;
  if (!zone[0]) return NextResponse.json({ error: "Zona no disponible" }, { status: 404 });
  await sql`INSERT INTO waitlist (zone_id, email, qty) VALUES (${zoneId}, ${email}, ${qty})
    ON CONFLICT (zone_id, email) DO UPDATE SET qty=EXCLUDED.qty, notified_at=NULL`;
  if (ct.includes("application/json")) return NextResponse.json({ ok: true });
  const back = req.headers.get("referer") || "/eventos";
  return NextResponse.redirect(new URL(back + (back.includes("?") ? "&" : "?") + "lista=ok", req.url), 303);
}
