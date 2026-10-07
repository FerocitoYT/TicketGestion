import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Incidencias({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login?next=/incidencias");
  const sp = await searchParams;
  const sql = getDb();
  const evs = s.role === "owner"
    ? await sql`SELECT id, title FROM events WHERE org_id=${s.orgId} AND status='published' ORDER BY starts_at DESC LIMIT 50`
    : await sql`SELECT e.id, e.title FROM event_staff es JOIN events e ON e.id=es.event_id
        WHERE es.user_id=${s.userId} AND e.org_id=${s.orgId} AND e.status='published' ORDER BY e.starts_at DESC LIMIT 50`;
  const ids = evs.map((e) => String(e.id));
  const list = ids.length > 0
    ? await sql`SELECT i.*, e.title AS event, u.name AS reporter FROM incidents i
        JOIN events e ON e.id=i.event_id LEFT JOIN users u ON u.id=i.user_id
        WHERE i.event_id = ANY(${ids}) AND i.status='abierta' ORDER BY i.created_at DESC LIMIT 100`
    : [];
  return (
    <>
      <p className="crumbs">Personal · {s.name}</p>
      <h1>Partes de incidencia</h1>
      {sp.ok && <p className="alert ok">Parte registrado. Gracias.</p>}
      <form action="/api/incidencias" method="post" className="form">
        <div className="row">
          <select name="eventId" required style={{ flex: 2 }}>
            <option value="">Evento…</option>
            {evs.map((e) => <option key={String(e.id)} value={String(e.id)}>{String(e.title)}</option>)}
          </select>
          <select name="severity" defaultValue="aviso" style={{ maxWidth: 160 }}>
            <option value="info">Info</option>
            <option value="aviso">Aviso</option>
            <option value="grave">Grave</option>
          </select>
        </div>
        <textarea name="text" required minLength={3} maxLength={1000} rows={3} placeholder="Describe lo ocurrido…" />
        <button>Enviar parte</button>
      </form>
      <div className="section-title"><h2>Abiertas ({list.length})</h2></div>
      {list.map((i) => (
        <div key={String(i.id)} className="card" style={{ marginBottom: 8, borderLeft: `5px solid ${String(i.severity) === "grave" ? "#b31217" : String(i.severity) === "aviso" ? "#e69500" : "#026cdf"}` }}>
          <strong>{String(i.event)}</strong> · {String(i.severity).toUpperCase()} · {String(i.reporter || "—")} · {new Date(String(i.created_at)).toLocaleString("es-ES")}
          <p>{String(i.text)}</p>
        </div>
      ))}
      {list.length === 0 && <p className="muted">Sin incidencias abiertas.</p>}
    </>
  );
}
