import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Login" }, { status: 401 });
  const form = await req.formData();
  const sql = getDb();
  await sql`INSERT INTO venues (org_id, name, city, capacity)
    VALUES (${s.orgId}, ${String(form.get("name") || "").slice(0, 160)}, ${String(form.get("city") || "").slice(0, 120)}, ${Number(form.get("capacity") || 0)})`;
  return NextResponse.redirect(new URL("/panel", req.url), 303);
}
