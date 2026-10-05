import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { baseUrl } from "@/lib/site-url";
import { runReminders } from "@/lib/reminders";

// Vercel Cron (Authorization: Bearer CRON_SECRET) o propietario/equipo.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const cronOk = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const s = await requireRole(["owner", "staff"]);
    if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  const res = await runReminders(baseUrl(req));
  return NextResponse.json({ ok: true, ...res });
}

export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const res = await runReminders(baseUrl(req));
  return NextResponse.json({ ok: true, ...res });
}
