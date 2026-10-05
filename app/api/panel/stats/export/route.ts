import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Exporta ventas por evento en CSV.
export async function GET() {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const sql = getDb();
  const rows = await sql`
    SELECT e.title, e.slug, e.status, to_char(e.starts_at, 'YYYY-MM-DD HH24:MI') AS fecha,
      COALESCE(SUM(o.total_cents) FILTER (WHERE o.status='paid'),0) AS ingresos_cents,
      COUNT(o.id) FILTER (WHERE o.status='paid') AS pedidos,
      COALESCE((SELECT SUM(capacity) FROM zones z WHERE z.event_id=e.id),0) AS aforo,
      COALESCE((SELECT SUM(sold) FROM zones z WHERE z.event_id=e.id),0) AS vendidas,
      COALESCE((SELECT COUNT(*) FROM scans sc WHERE sc.event_id=e.id AND sc.result='ok'),0) AS accesos
    FROM events e LEFT JOIN orders o ON o.event_id=e.id
    WHERE e.org_id=${s.orgId} GROUP BY e.id ORDER BY e.starts_at DESC`;
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = ["evento,slug,estado,fecha,ingresos_eur,pedidos,aforo,vendidas,accesos"];
  for (const r of rows) {
    lines.push([
      esc(String(r.title)), esc(String(r.slug)), String(r.status), String(r.fecha),
      (Number(r.ingresos_cents) / 100).toFixed(2), String(r.pedidos),
      String(r.aforo), String(r.vendidas), String(r.accesos),
    ].join(","));
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=estadisticas.csv",
    },
  });
}
