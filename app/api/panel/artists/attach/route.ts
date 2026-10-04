import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { slugify, fetchWikiBio } from "@/lib/wiki";

const Attach = z.object({
  eventId: z.string().uuid(),
  mbid: z.string().min(1).max(64),
  name: z.string().min(1).max(160),
  genre: z.string().max(80).optional().default(""),
});

async function findEvent(sql: ReturnType<typeof getDb>, eventId: string, orgId: string) {
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${orgId} LIMIT 1`;
  return ev[0] ? true : false;
}

// Importa desde MusicBrainz (foto + bio de Wikipedia) y vincula al evento.
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const sql = getDb();
  const b = Attach.safeParse(await req.json());
  if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  if (!(await findEvent(sql, b.data.eventId, s.orgId))) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const wiki = await fetchWikiBio(b.data.name);
  const slug = slugify(b.data.name);
  const art = await sql`
    INSERT INTO artists (name, slug, photo_url, bio, genre, mbid)
    VALUES (${b.data.name}, ${slug}, ${wiki.photo}, ${wiki.bio}, ${b.data.genre}, ${b.data.mbid})
    ON CONFLICT (mbid) DO UPDATE SET photo_url = CASE WHEN artists.photo_url = '' THEN EXCLUDED.photo_url ELSE artists.photo_url END,
      bio = CASE WHEN artists.bio = '' THEN EXCLUDED.bio ELSE artists.bio END,
      genre = CASE WHEN artists.genre = '' THEN EXCLUDED.genre ELSE artists.genre END
    RETURNING id`;
  let artistId = art[0].id as string;
  try {
    await sql`INSERT INTO event_artists (event_id, artist_id) VALUES (${b.data.eventId}, ${artistId}) ON CONFLICT DO NOTHING`;
  } catch {
    const fixed = await sql`UPDATE artists SET slug=${slug + "-" + b.data.mbid.slice(0, 6)} WHERE id=${artistId} RETURNING id`;
    artistId = fixed[0].id as string;
    await sql`INSERT INTO event_artists (event_id, artist_id) VALUES (${b.data.eventId}, ${artistId}) ON CONFLICT DO NOTHING`;
  }
  return NextResponse.json({ ok: true });
}
