import { getDb } from "@/lib/db";

export default async function WaitlistBlock({ eventId }: { eventId: string }) {
  const sql = getDb();
  const rows = await sql`SELECT w.id, w.email, w.qty, w.notified_at, w.created_at, z.name AS zone,
      (z.capacity - z.sold) AS free
    FROM waitlist w JOIN zones z ON z.id=w.zone_id
    WHERE z.event_id=${eventId} ORDER BY w.created_at ASC LIMIT 200`;
  return (
    <>
      <table>
        <thead><tr><th>Email</th><th>Cant</th><th>Zona</th><th>Libres</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {rows.map((w) => (
            <tr key={String(w.id)}>
              <td>{String(w.email)}</td><td>{String(w.qty)}</td><td>{String(w.zone)}</td>
              <td>{String(w.free)}</td>
              <td>{w.notified_at ? "Avisado" : "En espera"}</td>
              <td>{!w.notified_at && Number(w.free) >= Number(w.qty) && (
                <form action="/api/panel/waitlist/notify" method="post" style={{ display: "inline" }}>
                  <input type="hidden" name="id" value={String(w.id)} />
                  <button>Avisar</button>
                </form>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted">Nadie en espera.</p>}
      <form action="/api/panel/waitlist/notify" method="post" className="form" style={{ marginTop: 10 }}>
        <p className="muted">El cron avisa solo cuando se libera sitio. También puedes forzar la comprobación:</p>
        <button formAction="/api/panel/waitlist/notify">Comprobar y avisar ahora</button>
      </form>
    </>
  );
}
