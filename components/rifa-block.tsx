import { getDb } from "@/lib/db";

export default async function RifaBlock({ eventId }: { eventId: string }) {
  const sql = getDb();
  const rifas = await sql`SELECT * FROM raffles WHERE event_id=${eventId} ORDER BY created_at ASC`;
  const winners = rifas.length > 0
    ? await sql`SELECT w.raffle_id, t.code, t.holder_name FROM raffle_winners w JOIN tickets t ON t.id=w.ticket_id
        WHERE w.raffle_id = ANY(${rifas.map((r) => String(r.id))}) ORDER BY w.created_at ASC`
    : [];
  return (
    <>
      {rifas.map((r) => {
        const ws = winners.filter((w) => String(w.raffle_id) === String(r.id));
        return (
          <div key={String(r.id)} className="card" style={{ marginBottom: 8 }}>
            <strong>{String(r.title)}</strong> · {String(r.prize)} · {String(r.winners_count)} ganador(es) · {String(r.status)}
            {ws.length > 0 && (
              <p style={{ margin: "6px 0" }}>{ws.map((w) => <span key={String(w.code)} className="badge" style={{ marginRight: 6 }}>{String(w.holder_name)} ({String(w.code)})</span>)}</p>
            )}
            <div className="row">
              <form action="/api/panel/rifas/sortear" method="post" style={{ display: "inline" }}>
                <input type="hidden" name="id" value={String(r.id)} /><input type="hidden" name="eventId" value={eventId} />
                <button>{ws.length > 0 ? "Re-sortear" : "Sortear"}</button>
              </form>
              <form action="/api/panel/rifas/delete" method="post" style={{ display: "inline" }}>
                <input type="hidden" name="id" value={String(r.id)} /><input type="hidden" name="eventId" value={eventId} />
                <button className="btn-ghost">Borrar</button>
              </form>
            </div>
          </div>
        );
      })}
      {rifas.length === 0 && <p className="muted">Sin sorteos. Ej.: Meet&Greet, camiseta firmada.</p>}
      <form action="/api/panel/rifas" method="post" className="form" style={{ marginTop: 10 }}>
        <input type="hidden" name="eventId" value={eventId} />
        <div className="row">
          <input name="title" required placeholder="Sorteo…" />
          <input name="prize" placeholder="Premio…" />
          <input name="winners" type="number" min={1} max={100} defaultValue={1} style={{ maxWidth: 120 }} />
        </div>
        <button formAction="/api/panel/rifas">Crear sorteo</button>
      </form>
    </>
  );
}
