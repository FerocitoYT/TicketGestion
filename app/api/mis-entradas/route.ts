import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase() || "";
  if (!email.includes("@")) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  const sql = getDb();
  const rows = await sql`
    SELECT t.code, t.status, e.title AS event, z.name AS zone
    FROM tickets t JOIN orders o ON o.id=t.order_id JOIN events e ON e.id=t.event_id JOIN zones z ON z.id=t.zone_id
    WHERE o.buyer_email=${email} AND o.status='paid' ORDER BY t.created_at DESC LIMIT 50`;
  return NextResponse.json({
    tickets: rows.map((r) => ({ code: String(r.code), event: String(r.event), zone: String(r.zone), status: String(r.status) })),
  });
}
