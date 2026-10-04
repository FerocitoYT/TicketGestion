import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Panel() {
  const s = await getSession();
  if (!s) redirect("/login");
  try {
    const sql = getDb();
    const events = await sql`
      SELECT e.id, e.title, e.slug, e.status, e.starts_at,
        COALESCE((SELECT SUM(total_cents) FROM orders o WHERE o.event_id=e.id AND o.status='paid'),0) AS revenue,
        COALESCE((SELECT COUNT(*) FROM tickets t WHERE t.event_id=e.id),0) AS tickets,
        COALESCE((SELECT COUNT(*) FROM scans sc WHERE sc.event_id=e.id AND sc.result='ok'),0) AS checked
      FROM events e WHERE e.org_id=${s.orgId} ORDER BY e.starts_at DESC`;
    const venues = await sql`SELECT * FROM venues WHERE org_id=${s.orgId} ORDER BY name ASC`;
    return (
      <>
        <h1>Panel organizador</h1>
        <p className="muted">{s.name} · {s.role}</p>
        <h2>Crear recinto</h2>
        <form action="/api/panel/venues" method="post" className="form">
          <div className="row">
            <input name="name" required placeholder="Recinto (ej. WiZink Center)" />
            <input name="city" placeholder="Ciudad" />
            <input name="capacity" type="number" placeholder="Aforo" />
          </div>
          <button formAction="/api/panel/venues">Guardar recinto</button>
        </form>
        <h2>Crear evento</h2>
        <form action="/api/panel/events" method="post" className="form">
          <input name="title" required placeholder="Título (ej. Concierto …)" />
          <div className="row">
            <select name="category">
              <option value="concierto">Concierto</option>
              <option value="deporte">Deporte</option>
              <option value="teatro">Teatro</option>
              <option value="festival">Festival</option>
              <option value="otros">Otros</option>
            </select>
            <select name="venueId">
              <option value="">Sin recinto</option>
              {venues.map((v) => <option key={v.id as string} value={v.id as string}>{String(v.name)}</option>)}
            </select>
          </div>
          <input name="startsAt" type="datetime-local" required />
          <textarea name="description" placeholder="Descripción" />
          <button formAction="/api/panel/events">Crear borrador</button>
        </form>
        <h2>Mis eventos</h2>
        <table>
          <thead><tr><th>Evento</th><th>Estado</th><th>Ingresos</th><th>Tickets</th><th>Accesos</th><th></th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id as string}>
                <td>{String(e.title)}<br /><span className="muted">{new Date(String(e.starts_at)).toLocaleString("es-ES")}</span></td>
                <td>{String(e.status)}</td>
                <td>{(Number(e.revenue) / 100).toFixed(2)} €</td>
                <td>{String(e.tickets)}</td>
                <td>{String(e.checked)}</td>
                <td><a href={`/panel/${e.id}`}>Gestionar</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  } catch {
    return <p className="muted">Configura DATABASE_URL y migraciones.</p>;
  }
}
