import { getDb } from "@/lib/db";

export default async function ProgramBlock({ eventId }: { eventId: string }) {
  const sql = getDb();
  const sessions = await sql`SELECT id, starts_at FROM sessions WHERE event_id=${eventId} ORDER BY starts_at ASC`;
  const artists = await sql`SELECT a.id, a.name FROM event_artists ea JOIN artists a ON a.id=ea.artist_id WHERE ea.event_id=${eventId} ORDER BY a.name`;
  const slots = await sql`SELECT p.*, a.name AS artist FROM program_slots p LEFT JOIN artists a ON a.id=p.artist_id WHERE p.event_id=${eventId} ORDER BY p.starts_at ASC`;
  return (
    <>
      <table>
        <thead><tr><th>Hora</th><th>Actuación</th><th>Artista</th><th></th></tr></thead>
        <tbody>
          {slots.map((p) => (
            <tr key={String(p.id)}>
              <td>{new Date(String(p.starts_at)).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
              <td><strong>{String(p.title)}</strong><br /><span className="muted">{String(p.description || "")}</span></td>
              <td>{String(p.artist || "—")}</td>
              <td><form action="/api/panel/program/delete" method="post" style={{ display: "inline" }}>
                <input type="hidden" name="id" value={String(p.id)} /><input type="hidden" name="eventId" value={eventId} />
                <button>Quitar</button>
              </form></td>
            </tr>
          ))}
        </tbody>
      </table>
      {slots.length === 0 && <p className="muted">Sin programa todavía.</p>}
      <form action="/api/panel/program" method="post" className="form" style={{ marginTop: 10 }}>
        <input type="hidden" name="eventId" value={eventId} />
        <div className="row">
          <input name="startsAt" type="datetime-local" required />
          <input name="title" required placeholder="Puertas / Artista / Descanso…" />
        </div>
        <div className="row">
          <select name="sessionId">
            <option value="">Todas las fechas</option>
            {sessions.map((s) => <option key={String(s.id)} value={String(s.id)}>{new Date(String(s.starts_at)).toLocaleDateString("es-ES")}</option>)}
          </select>
          <select name="artistId">
            <option value="">Sin artista vinculado</option>
            {artists.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.name)}</option>)}
          </select>
        </div>
        <input name="description" placeholder="Detalle opcional" />
        <button formAction="/api/panel/program">Añadir al programa</button>
      </form>
    </>
  );
}
