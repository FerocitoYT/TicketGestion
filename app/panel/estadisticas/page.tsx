import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Estadisticas() {
  const s = await requireRole(["owner", "staff"]);
  if (!s) redirect("/login");
  const sql = getDb();
  const totals = await sql`
    SELECT COALESCE(SUM(o.total_cents) FILTER (WHERE o.status='paid'),0) AS revenue,
           COUNT(o.id) FILTER (WHERE o.status='paid') AS orders,
           (SELECT COUNT(*) FROM tickets t JOIN events e ON e.id=t.event_id WHERE e.org_id=${s.orgId}) AS tickets,
           (SELECT COUNT(*) FROM scans sc JOIN events e ON e.id=sc.event_id WHERE e.org_id=${s.orgId} AND sc.result='ok') AS checked
    FROM orders o JOIN events e ON e.id=o.event_id WHERE e.org_id=${s.orgId}`;
  const perEvent = await sql`
    SELECT e.id, e.title, e.starts_at, e.status,
      COALESCE(SUM(o.total_cents) FILTER (WHERE o.status='paid'),0) AS revenue,
      COUNT(o.id) FILTER (WHERE o.status='paid') AS orders,
      COALESCE((SELECT SUM(capacity) FROM zones z WHERE z.event_id=e.id),0) AS capacity,
      COALESCE((SELECT SUM(sold) FROM zones z WHERE z.event_id=e.id),0) AS sold,
      COALESCE((SELECT COUNT(*) FROM scans sc WHERE sc.event_id=e.id AND sc.result='ok'),0) AS checked
    FROM events e LEFT JOIN orders o ON o.event_id=e.id
    WHERE e.org_id=${s.orgId} GROUP BY e.id ORDER BY e.starts_at DESC`;
  const byDay = await sql`
    SELECT to_char(o.created_at, 'YYYY-MM-DD') AS day, SUM(o.total_cents) AS revenue, COUNT(*) AS orders
    FROM orders o JOIN events e ON e.id=o.event_id
    WHERE e.org_id=${s.orgId} AND o.status='paid' AND o.created_at > now() - interval '30 days'
    GROUP BY 1 ORDER BY 1 DESC LIMIT 30`;
  const t = totals[0];
  const occ = (sold: number, cap: number) => (cap > 0 ? `${Math.round((sold / cap) * 100)}%` : "—");
  return (
    <>
      <p className="crumbs"><a href="/panel">Panel</a> / Estadísticas</p>
      <h1>Estadísticas</h1>
      <div className="trust" style={{ marginTop: 10 }}>
        <div><h4>{(Number(t.revenue) / 100).toFixed(2)} €</h4><p>Ingresos (pagado)</p></div>
        <div><h4>{String(t.orders)}</h4><p>Pedidos pagados</p></div>
        <div><h4>{String(t.tickets)}</h4><p>Entradas emitidas</p></div>
        <div><h4>{String(t.checked)}</h4><p>Accesos validados</p></div>
      </div>
      <div className="section-title"><h2>Por evento</h2><a className="btn btn-blue" href="/api/panel/stats/export">Exportar CSV</a></div>
      <table>
        <thead><tr><th>Evento</th><th>Ingresos</th><th>Pedidos</th><th>Ocupación</th><th>Accesos</th><th>Estado</th></tr></thead>
        <tbody>
          {perEvent.map((e) => (
            <tr key={e.id as string}>
              <td><a href={`/panel/${e.id}`}>{String(e.title)}</a></td>
              <td>{(Number(e.revenue) / 100).toFixed(2)} €</td>
              <td>{String(e.orders)}</td>
              <td>{String(e.sold)}/{String(e.capacity)} ({occ(Number(e.sold), Number(e.capacity))})</td>
              <td>{String(e.checked)}</td>
              <td>{String(e.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="section-title"><h2>Ventas por día (30 días)</h2></div>
      <table>
        <thead><tr><th>Día</th><th>Ingresos</th><th>Pedidos</th></tr></thead>
        <tbody>
          {byDay.map((d) => (
            <tr key={String(d.day)}><td>{String(d.day)}</td><td>{(Number(d.revenue) / 100).toFixed(2)} €</td><td>{String(d.orders)}</td></tr>
          ))}
        </tbody>
      </table>
      {byDay.length === 0 && <p className="muted">Sin ventas en los últimos 30 días.</p>}
    </>
  );
}
