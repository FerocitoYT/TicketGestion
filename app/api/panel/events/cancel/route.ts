import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso: solo propietario o equipo" }, { status: 403 });
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const sql = getDb();
  await sql`UPDATE events SET status='cancelled' WHERE id=${id} AND org_id=${s.orgId}`;
  await sql`UPDATE tickets SET status='cancelled' WHERE event_id=${id} AND status='valid'`;
  return NextResponse.redirect(new URL("/panel", req.url), 303);
}
