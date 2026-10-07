import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

const MAX_BYTES = 1_000_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

// Añade foto a la galería (form) o borra una (?delete con id).
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const sql = getDb();
  const form = await req.formData();
  const eventId = String(form.get("eventId") || "");
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const caption = String(form.get("caption") || "").slice(0, 160);
  let imageUrl = String(form.get("imageUrl") || "").trim().slice(0, 500);
  if (!imageUrl) {
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "Sube un archivo o pega una URL" }, { status: 400 });
    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Solo JPG, PNG o WebP" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Máximo 1 MB" }, { status: 400 });
    imageUrl = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  } else if (!/^https?:\/\//.test(imageUrl)) {
    return NextResponse.json({ error: "URL no válida" }, { status: 400 });
  }
  await sql`INSERT INTO event_gallery (event_id, image_url, caption) VALUES (${eventId}, ${imageUrl}, ${caption})`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
