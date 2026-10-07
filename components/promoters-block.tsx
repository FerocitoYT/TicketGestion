import { getDb } from "@/lib/db";

export default async function PromotersBlock({ eventId, slug }: { eventId: string; slug: string }) {
  const sql = getDb();
  const rows = await sql`
    SELECT p.id, p.name, p.code, p.commission_pct, p.discount_pct, p.active,
      COUNT(o.id) FILTER (WHERE o.status='paid') AS sales,
      COALESCE(SUM(o.total_cents) FILTER (WHERE o.status='paid'),0) AS revenue,
      COALESCE(SUM(o.commission_cents) FILTER (WHERE o.status='paid'),0) AS commission
    FROM promoters p LEFT JOIN orders o ON o.promoter_id=p.id
    WHERE p.event_id=${eventId} GROUP BY p.id ORDER BY p.created_at ASC`;
  return (
    <>
      <table>
        <thead><tr><th>Promotor</th><th>Código</th><th>Comisión</th><th>Dto.</th><th>Ventas</th><th>Ingresos</th><th>A pagar</th><th>Enlace</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={String(p.id)}>
              <td>{String(p.name)}</td><td><strong>{String(p.code)}</strong></td>
              <td>{String(p.commission_pct)}%</td><td>{String(p.discount_pct)}%</td>
              <td>{String(p.sales)}</td>
              <td>{(Number(p.revenue) / 100).toFixed(2)} €</td>
              <td><strong>{(Number(p.commission) / 100).toFixed(2)} €</strong></td>
              <td><small className="muted">/eventos/{slug}?promo={String(p.code)}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted">Sin promotores.</p>}
      <form action="/api/panel/promoters" method="post" className="form" style={{ marginTop: 10 }}>
        <input type="hidden" name="eventId" value={eventId} />
        <div className="row">
          <input name="name" required placeholder="Nombre del promotor" />
          <input name="code" required placeholder="CÓDIGO" style={{ maxWidth: 160 }} />
          <input name="commission" type="number" min={0} max={100} defaultValue={10} placeholder="% comisión" style={{ maxWidth: 130 }} />
          <input name="discount" type="number" min={0} max={100} defaultValue={0} placeholder="% dto. comprador" style={{ maxWidth: 150 }} />
        </div>
        <button formAction="/api/panel/promoters">Crear promotor</button>
      </form>
    </>
  );
}
