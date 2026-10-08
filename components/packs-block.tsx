import { getDb } from "@/lib/db";

export default async function PacksBlock({ eventId }: { eventId: string }) {
  const sql = getDb();
  const zones = await sql`SELECT z.id, z.name FROM zones z JOIN sessions s ON s.id=z.session_id
    WHERE z.event_id=${eventId} AND s.status='scheduled' ORDER BY s.starts_at, z.price_cents LIMIT 100`;
  const packs = await sql`SELECT p.*, z.name AS zone FROM packs p JOIN zones z ON z.id=p.zone_id
    WHERE p.event_id=${eventId} ORDER BY p.created_at ASC`;
  return (
    <>
      <table>
        <thead><tr><th>Pack</th><th>Zona</th><th>Entradas</th><th>Precio</th><th>Usos</th><th></th></tr></thead>
        <tbody>
          {packs.map((p) => (
            <tr key={String(p.id)}>
              <td><strong>{String(p.name)}</strong></td><td>{String(p.zone)}</td>
              <td>{String(p.qty)}</td><td>{(Number(p.price_cents) / 100).toFixed(2)} €</td>
              <td>{String(p.used)}{Number(p.max_uses) > 0 ? `/${String(p.max_uses)}` : ""}</td>
              <td><form action="/api/panel/packs/delete" method="post" style={{ display: "inline" }}>
                <input type="hidden" name="id" value={String(p.id)} /><input type="hidden" name="eventId" value={eventId} />
                <button>Quitar</button>
              </form></td>
            </tr>
          ))}
        </tbody>
      </table>
      {packs.length === 0 && <p className="muted">Sin packs. Ej.: Familiar 2+2, Grupo 5.</p>}
      <form action="/api/panel/packs" method="post" className="form" style={{ marginTop: 10 }}>
        <input type="hidden" name="eventId" value={eventId} />
        <div className="row">
          <input name="name" required placeholder="Pack Familiar 2+2" />
          <select name="zoneId" required>
            <option value="">Zona…</option>
            {zones.map((z) => <option key={String(z.id)} value={String(z.id)}>{String(z.name)}</option>)}
          </select>
        </div>
        <div className="row">
          <input name="qty" type="number" min={2} max={50} defaultValue={4} placeholder="Nº entradas" />
          <input name="price" type="number" step="0.01" min={0} required placeholder="Precio total €" />
          <input name="maxUses" type="number" min={0} defaultValue={0} placeholder="Usos máx (0=∞)" />
        </div>
        <button formAction="/api/panel/packs">Crear pack</button>
      </form>
    </>
  );
}
