import { getDb } from "@/lib/db";

export default async function EventIncidentsBlock({ eventId, canResolve }: { eventId: string; canResolve: boolean }) {
  const sql = getDb();
  const rows = await sql`SELECT i.*, u.name AS reporter FROM incidents i LEFT JOIN users u ON u.id=i.user_id
    WHERE i.event_id=${eventId} ORDER BY i.status ASC, i.created_at DESC LIMIT 100`;
  const open = rows.filter((r) => r.status === "abierta");
  return (
    <>
      <p className="muted">{open.length} abiertas de {rows.length} totales.</p>
      {rows.map((i) => (
        <div key={String(i.id)} className="card" style={{ marginBottom: 8, borderLeft: `5px solid ${String(i.severity) === "grave" ? "#b31217" : String(i.severity) === "aviso" ? "#e69500" : "#026cdf"}` }}>
          <strong>{String(i.severity).toUpperCase()}</strong> · {String(i.reporter || "—")} · {new Date(String(i.created_at)).toLocaleString("es-ES")} · {String(i.status)}
          <p>{String(i.text)}</p>
          {canResolve && String(i.status) === "abierta" && (
            <form action="/api/incidencias/resolve" method="post">
              <input type="hidden" name="id" value={String(i.id)} /><input type="hidden" name="eventId" value={eventId} />
              <button>Marcar resuelta</button>
            </form>
          )}
        </div>
      ))}
      {rows.length === 0 && <p className="muted">Sin incidencias.</p>}
    </>
  );
}
