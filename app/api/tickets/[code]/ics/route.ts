import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// Descarga .ics para añadir la entrada al calendario (vale para Google/Apple Calendar).
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Login requerido" }, { status: 401 });
  const { code } = await params;
  const sql = getDb();
  const rows = await sql`
    SELECT t.code, t.holder_name, t.seat, e.title, e.starts_at, e.ends_at, COALESCE(v.name,'') AS venue, COALESCE(v.address,'') AS address
    FROM tickets t JOIN events e ON e.id=t.event_id LEFT JOIN venues v ON v.id=e.venue_id
    WHERE t.code=${code} AND t.status='valid' LIMIT 1`;
  if (!rows[0]) return NextResponse.json({ error: "Entrada no válida" }, { status: 404 });
  const t = rows[0];
  const start = new Date(String(t.starts_at));
  const end = t.ends_at ? new Date(String(t.ends_at)) : new Date(start.getTime() + 3 * 3600e3);
  const summary = `${t.title} — Entrada ${t.code}`;
  const desc = `Titular: ${t.holder_name || ""}${t.seat ? ` · Asiento ${t.seat}` : ""}. Lleva tu QR y DNI.`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TicketGestion//Entradas//ES", "BEGIN:VEVENT",
    `UID:${t.code}@ticketgestion`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(String(summary))}`, `DESCRIPTION:${icsEscape(String(desc))}`,
    `LOCATION:${icsEscape(String(t.venue || "") + (t.address ? `, ${t.address}` : ""))}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename=entrada-${t.code}.ics`,
    },
  });
}
