import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { encodeSigned, decodeSigned } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// Alta: formulario (redirige a la ficha). Baja: enlace con token ?token=.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!(await checkRateLimit(`alert:${ip}`, 10, 600))) return NextResponse.json({ error: "Demasiadas altas" }, { status: 429 });
  const ct = req.headers.get("content-type") || "";
  let artistId = "", email = "";
  if (ct.includes("application/json")) {
    const b = z.object({ artistId: z.string().uuid(), email: z.string().email() }).safeParse(await req.json());
    if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    artistId = b.data.artistId; email = b.data.email.toLowerCase();
  } else {
    const f = await req.formData();
    artistId = String(f.get("artistId") || "");
    email = String(f.get("email") || "").toLowerCase();
    if (!artistId || !email.includes("@")) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }
  const sql = getDb();
  const a = await sql`SELECT slug FROM artists WHERE id=${artistId} LIMIT 1`;
  if (!a[0]) return NextResponse.json({ error: "Artista no encontrado" }, { status: 404 });
  await sql`INSERT INTO artist_alerts (artist_id, email) VALUES (${artistId}, ${email}) ON CONFLICT DO NOTHING`;
  if (ct.includes("application/json")) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL(`/artistas/${a[0].slug}?alerta=ok`, req.url), 303);
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const data = decodeSigned<{ artistId: string; email: string }>(token);
  if (!data?.artistId || !data?.email) return NextResponse.json({ error: "Enlace inválido" }, { status: 400 });
  const sql = getDb();
  await sql`DELETE FROM artist_alerts WHERE artist_id=${data.artistId} AND email=${data.email}`;
  const a = await sql`SELECT slug FROM artists WHERE id=${data.artistId} LIMIT 1`;
  return NextResponse.redirect(new URL(a[0] ? `/artistas/${a[0].slug}?alerta=off` : "/artistas", req.url), 303);
}
