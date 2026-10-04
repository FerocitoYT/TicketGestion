import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Login" }, { status: 401 });
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const sql = getDb();
  await sql`UPDATE events SET status='cancelled' WHERE id=${id} AND org_id=${s.orgId}`;
  await sql`UPDATE tickets SET status='cancelled' WHERE event_id=${id} AND status='valid'`;
  return NextResponse.redirect(new URL("/panel", req.url), 303);
}
