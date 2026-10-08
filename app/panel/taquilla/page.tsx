import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import TaquillaClient from "@/components/taquilla-client";

export const dynamic = "force-dynamic";

export default async function Taquilla() {
  const s = await requireRole(["owner", "staff"]);
  if (!s) redirect("/login");
  const sql = getDb();
  const evs = await sql`SELECT id, title, max_per_order FROM events WHERE org_id=${s.orgId} AND status='published' ORDER BY starts_at ASC`;
  const zones = await sql`SELECT z.id, z.event_id, z.name, z.price_cents, z.capacity, z.sold, z.seat_rows, z.seat_cols, z.accessible
    FROM zones z JOIN events e ON e.id=z.event_id WHERE e.org_id=${s.orgId} AND e.status='published' ORDER BY z.price_cents`;
  const events = evs.map((e) => ({
    id: String(e.id), title: String(e.title), max: Number(e.max_per_order ?? 10),
    zones: zones.filter((z) => String(z.event_id) === String(e.id)).map((z) => ({
      id: String(z.id), event_id: String(z.event_id), name: String(z.name),
      price_cents: Number(z.price_cents), capacity: Number(z.capacity), sold: Number(z.sold),
      seat_rows: Number(z.seat_rows), seat_cols: Number(z.seat_cols), accessible: Boolean(z.accessible),
    })),
  }));
  const maxOrder = Math.max(1, ...events.map((e) => e.max), 10);
  return (
    <>
      <p className="crumbs"><a href="/panel">Panel</a> / Taquilla</p>
      <h1>Taquilla presencial</h1>
      <p className="muted">Vende en puerta física con el mismo stock y aforo. Efectivo, tarjeta o datáfono.</p>
      {events.length === 0
        ? <p className="muted">Sin eventos publicados.</p>
        : <TaquillaClient events={events} maxOrder={maxOrder} />}
    </>
  );
}
