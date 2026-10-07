import { getDb } from "@/lib/db";

export default async function ShiftsBlock({ eventId }: { eventId: string }) {
  const sql = getDb();
  const members = await sql`SELECT u.id, u.name FROM memberships m JOIN users u ON u.id=m.user_id
    WHERE m.org_id=(SELECT org_id FROM events WHERE id=${eventId}) ORDER BY u.name`;
  const shifts = await sql`SELECT sh.*, u.name AS who FROM shifts sh JOIN users u ON u.id=sh.user_id
    WHERE sh.event_id=${eventId} ORDER BY sh.starts_at ASC`;
  return (
    <>
      <table>
        <thead><tr><th>Personal</th><th>Puesto</th><th>Inicio</th><th>Fin</th><th></th></tr></thead>
        <tbody>
          {shifts.map((x) => (
            <tr key={String(x.id)}>
              <td>{String(x.who)}</td><td>{String(x.post)}</td>
              <td>{new Date(String(x.starts_at)).toLocaleString("es-ES")}</td>
              <td>{x.ends_at ? new Date(String(x.ends_at)).toLocaleString("es-ES") : "—"}</td>
              <td><form action="/api/panel/shifts/delete" method="post" style={{ display: "inline" }}>
                <input type="hidden" name="id" value={String(x.id)} /><input type="hidden" name="eventId" value={eventId} />
                <button>Quitar</button>
              </form></td>
            </tr>
          ))}
        </tbody>
      </table>
      {shifts.length === 0 && <p className="muted">Sin turnos. Asigna también en “Personal de puerta” quién valida.</p>}
      <form action="/api/panel/shifts" method="post" className="form" style={{ marginTop: 10 }}>
        <input type="hidden" name="eventId" value={eventId} />
        <div className="row">
          <select name="userId" required>
            <option value="">Persona…</option>
            {members.map((m) => <option key={String(m.id)} value={String(m.id)}>{String(m.name)}</option>)}
          </select>
          <input name="post" placeholder="Puesto (Puerta A, Taquilla…)" defaultValue="Puerta" />
        </div>
        <div className="row">
          <input name="startsAt" type="datetime-local" required />
          <input name="endsAt" type="datetime-local" />
        </div>
        <input name="notes" placeholder="Notas (opcional)" />
        <button formAction="/api/panel/shifts">Asignar turno</button>
      </form>
    </>
  );
}
