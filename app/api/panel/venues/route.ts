import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso: solo propietario o equipo" }, { status: 403 });
  const form = await req.formData();
  const sql = getDb();
  await sql`INSERT INTO venues (org_id, name, city, capacity)
    VALUES (${s.orgId}, ${String(form.get("name") || "").slice(0, 160)}, ${String(form.get("city") || "").slice(0, 120)}, ${Number(form.get("capacity") || 0)})`;
  return NextResponse.redirect(new URL("/panel", req.url), 303);
}
