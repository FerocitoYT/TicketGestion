import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

async function setStatus(req: Request, status: string) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso: solo propietario o equipo" }, { status: 403 });
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const sql = getDb();
  await sql`UPDATE events SET status=${status} WHERE id=${id} AND org_id=${s.orgId}`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, ${"event." + status}, ${JSON.stringify({ id })})`;
  return NextResponse.redirect(new URL("/panel", req.url), 303);
}
export async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/publish")) return setStatus(req, "published");
  return setStatus(req, "cancelled");
}
