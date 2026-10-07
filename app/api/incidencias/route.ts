import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Parte de incidencia: lo reporta cualquier personal con sesión (puerta incluida).
// Resolver: POST /api/incidencias/resolve (propietario o equipo).
export async function POST(req: Request) {
  const sql = getDb();
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Login requerido" }, { status: 401 });
  const ct = req.headers.get("content-type") || "";
  let eventId = "", severity = "aviso", text = "";
  if (ct.includes("application/json")) {
    const b = z.object({ eventId: z.string().uuid(), severity: z.enum(["info", "aviso", "grave"]).optional(), text: z.string().min(3).max(1000) }).safeParse(await req.json());
    if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    eventId = b.data.eventId; severity = b.data.severity || "aviso"; text = b.data.text;
  } else {
    const f = await req.formData();
    eventId = String(f.get("eventId") || "");
    severity = String(f.get("severity") || "aviso");
    text = String(f.get("text") || "").slice(0, 1000);
    if (!eventId || text.trim().length < 3 || !["info", "aviso", "grave"].includes(severity)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
  }
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  if (s.role !== "owner") {
    const asg = await sql`SELECT 1 FROM event_staff WHERE event_id=${eventId} AND user_id=${s.userId} LIMIT 1`;
    if (!asg[0]) return NextResponse.json({ error: "No estás asignado a este evento" }, { status: 403 });
  }
  await sql`INSERT INTO incidents (event_id, user_id, severity, text) VALUES (${eventId}, ${s.userId}, ${severity}, ${text.trim()})`;
  if (ct.includes("application/json")) return NextResponse.json({ ok: true });
  const back = req.headers.get("referer") || "/incidencias";
  return NextResponse.redirect(new URL(back.split("?")[0] + "?ok=1", req.url), 303);
}
