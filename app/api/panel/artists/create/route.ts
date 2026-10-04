import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { slugify } from "@/lib/wiki";

const Schema = z.object({
  eventId: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  photo: z.string().max(500).optional().default(""),
  bio: z.string().max(5000).optional().default(""),
  genre: z.string().max(80).optional().default(""),
});

// Alta manual de artista (funciona sin TM_API_KEY) y vínculo opcional al evento.
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const b = Schema.safeParse(await req.json());
  if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const sql = getDb();
  if (b.data.eventId) {
    const ev = await sql`SELECT id FROM events WHERE id=${b.data.eventId} AND org_id=${s.orgId} LIMIT 1`;
    if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  let slug = slugify(b.data.name);
  const dupe = await sql`SELECT id FROM artists WHERE slug=${slug} LIMIT 1`;
  if (dupe[0]) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const art = await sql`INSERT INTO artists (name, slug, photo_url, bio, genre) VALUES (${b.data.name}, ${slug}, ${b.data.photo}, ${b.data.bio}, ${b.data.genre}) RETURNING id`;
  if (b.data.eventId) await sql`INSERT INTO event_artists (event_id, artist_id) VALUES (${b.data.eventId}, ${art[0].id}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ ok: true });
}
