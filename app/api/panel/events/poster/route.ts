import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

const MAX_BYTES = 1_500_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

// Cartel del evento: subida de archivo (se guarda como data URL, sin servicios externos)
// o URL directa. Solo propietario/equipo.
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const sql = getDb();
  const ev = await sql`SELECT id FROM events WHERE id=${id} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  let imageUrl = "";
  const url = String(form.get("imageUrl") || "").trim().slice(0, 500);
  if (url) {
    if (!/^https?:\/\//.test(url)) return NextResponse.json({ error: "URL no válida" }, { status: 400 });
    imageUrl = url;
  } else {
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "Sube un archivo o pega una URL" }, { status: 400 });
    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Solo JPG, PNG o WebP" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Máximo 1,5 MB" }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    imageUrl = `data:${file.type};base64,${buf.toString("base64")}`;
  }
  await sql`UPDATE events SET image_url=${imageUrl} WHERE id=${id}`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.poster', ${JSON.stringify({ id })})`;
  return NextResponse.redirect(new URL(`/panel/${id}`, req.url), 303);
}
