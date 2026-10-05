import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Panel() {
  const s = await getSession();
  if (!s) redirect("/login");
  // Puerta (scanner) no entra al panel: solo propietario y equipo.
  if (s.role !== "owner" && s.role !== "staff") {
    return (
      <>
        <h1>Sin acceso</h1>
        <p className="muted">Tu cuenta de puerta no tiene acceso al panel.</p>
        <p><a className="btn btn-blue" href="/validar">Ir al control de acceso</a> <a className="btn" href="/mis-registros">Mis registros</a></p>
      </>
    );
  }
  try {
    const sql = getDb();
    const events = await sql`
      SELECT e.id, e.title, e.slug, e.status, e.starts_at,
        COALESCE((SELECT SUM(total_cents) FROM orders o WHERE o.event_id=e.id AND o.status='paid'),0) AS revenue,
        COALESCE((SELECT COUNT(*) FROM tickets t WHERE t.event_id=e.id),0) AS tickets,
        COALESCE((SELECT COUNT(*) FROM scans sc WHERE sc.event_id=e.id AND sc.result='ok'),0) AS checked
      FROM events e WHERE e.org_id=${s.orgId} ORDER BY e.starts_at DESC`;
    const venues = await sql`SELECT * FROM venues WHERE org_id=${s.orgId} ORDER BY name ASC`;
    const members = await sql`SELECT u.name, u.email, m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=${s.orgId} ORDER BY m.role, u.name`;
    return (
      <>
        <h1>Panel organizador</h1>
        <p className="muted">{s.name} · {s.role} · <a href="/panel/estadisticas">Estadísticas</a></p>
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
        <h2>Personal de acceso</h2>
        <p className="muted">Solo el personal puede abrir <a href="/validar">/validar</a>: escanea QR con cámara o código, y el sistema muestra el titular para comprobar el DNI.</p>
        <table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={String(m.email)}><td>{String(m.name)}</td><td>{String(m.email)}</td><td>{String(m.role)}</td></tr>
            ))}
          </tbody>
        </table>
        {s.role === "owner" && (
          <form id="staff-form" className="form" style={{ marginTop: 12 }}>
            <div className="row">
              <input name="name" required placeholder="Nombre del empleado" />
              <input name="email" required type="email" placeholder="Email" />
            </div>
            <div className="row">
              <input name="password" required type="password" minLength={8} placeholder="Contraseña (8+)" />
              <select name="role" defaultValue="scanner">
                <option value="scanner">Puerta (escáner)</option>
                <option value="staff">Equipo general</option>
              </select>
            </div>
            <button type="submit">Crear cuenta de personal</button>
          </form>
        )}
        <script dangerouslySetInnerHTML={{ __html: `document.getElementById('staff-form')?.addEventListener('submit',async(e)=>{e.preventDefault();const f=e.target;const d=Object.fromEntries(new FormData(f));const r=await fetch('/api/panel/members',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)});const j=await r.json();alert(r.ok?'Personal creado. Ya puede entrar en /login y abrir /validar.':(j.error||'Error'));if(r.ok)location.reload();});` }} />
      </>
    );
  } catch {
    return <p className="muted">Configura DATABASE_URL y migraciones.</p>;
  }
}
