import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { alertToken } from "@/lib/alerts";
import { baseUrl } from "@/lib/site-url";

async function setStatus(req: Request, status: string) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso: solo propietario o equipo" }, { status: 403 });
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const sql = getDb();
  await sql`UPDATE events SET status=${status} WHERE id=${id} AND org_id=${s.orgId}`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, ${"event." + status}, ${JSON.stringify({ id })})`;
  // Al publicar: crea la encuesta por defecto y avisa a suscritos de sus artistas.
  if (status === "published") {
    await sql`INSERT INTO surveys (event_id) VALUES (${id}) ON CONFLICT (event_id) DO NOTHING`;
    try {
      const ev = await sql`SELECT title, slug FROM events WHERE id=${id} LIMIT 1`;
      const subs = await sql`
        SELECT al.email, a.id AS artist_id, a.name AS artist FROM artist_alerts al
        JOIN artists a ON a.id=al.artist_id
        JOIN event_artists ea ON ea.artist_id=a.id
        WHERE ea.event_id=${id}`;
      const byEmail = new Map<string, { artist: string; artist_id: string }[]>();
      for (const sub of subs) {
        const key = String(sub.email).toLowerCase();
        if (!byEmail.has(key)) byEmail.set(key, []);
        byEmail.get(key)!.push({ artist: String(sub.artist), artist_id: String(sub.artist_id) });
      }
      const app = baseUrl(req);
      for (const [email, list] of byEmail) {
        const names = [...new Set(list.map((l) => l.artist))].join(", ");
        const link = `${app}/api/alertas?token=${encodeURIComponent(alertToken(list[0].artist_id, email))}`;
        await sendEmail(
          email,
          `Nuevas fechas de ${names}: ${String(ev[0]?.title || "")}`,
          `<p>Hola,</p><p><strong>${names}</strong> tiene nuevo evento: <a href="${app}/eventos/${ev[0]?.slug}">${String(ev[0]?.title || "")}</a>.</p><p><a href="${link}">Darme de baja</a></p>`
        );
      }
    } catch (e) {
      console.error("alerts-notify", e);
    }
  }
  return NextResponse.redirect(new URL("/panel", req.url), 303);
}
export async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/publish")) return setStatus(req, "published");
  return setStatus(req, "cancelled");
}
