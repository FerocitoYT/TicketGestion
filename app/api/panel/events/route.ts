import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "evento";
}

export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso: solo propietario o equipo" }, { status: 403 });
  const form = await req.formData();
  const title = String(form.get("title") || "").slice(0, 160);
  if (!title) return NextResponse.json({ error: "Título requerido" }, { status: 400 });
  const sql = getDb();
  const slug = slugify(title) + "-" + Math.random().toString(36).slice(2, 6);
  await sql`
    INSERT INTO events (org_id, venue_id, title, slug, description, category, starts_at)
    VALUES (${s.orgId}, ${String(form.get("venueId") || "") || null}, ${title}, ${slug},
      ${String(form.get("description") || "")}, ${String(form.get("category") || "concierto")},
      ${new Date(String(form.get("startsAt"))).toISOString()})`;
  return NextResponse.redirect(new URL("/panel", req.url), 303);
}
