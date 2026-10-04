import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const RESULT_LABEL: Record<string, string> = {
  ok: "Permitido",
  duplicate: "Duplicado",
  invalid: "Otro evento",
  cancelled: "Cancelada",
};

export default async function MisRegistros({ searchParams }: { searchParams: Promise<{ ev?: string; res?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login?next=/mis-registros");
  const sp = await searchParams;
  const sql = getDb();
  const events = await sql`SELECT DISTINCT e.id, e.title FROM scans sc JOIN events e ON e.id=sc.event_id WHERE sc.scanned_by=${s.userId} ORDER BY e.title`;
  let rows;
  if (sp.ev && sp.res) {
    rows = await sql`SELECT sc.result, sc.gate, sc.created_at, t.code, t.holder_name, e.title AS event
      FROM scans sc JOIN tickets t ON t.id=sc.ticket_id JOIN events e ON e.id=sc.event_id
      WHERE sc.scanned_by=${s.userId} AND sc.event_id=${sp.ev} AND sc.result=${sp.res}
      ORDER BY sc.created_at DESC LIMIT 200`;
  } else if (sp.ev) {
    rows = await sql`SELECT sc.result, sc.gate, sc.created_at, t.code, t.holder_name, e.title AS event
      FROM scans sc JOIN tickets t ON t.id=sc.ticket_id JOIN events e ON e.id=sc.event_id
      WHERE sc.scanned_by=${s.userId} AND sc.event_id=${sp.ev}
      ORDER BY sc.created_at DESC LIMIT 200`;
  } else if (sp.res) {
    rows = await sql`SELECT sc.result, sc.gate, sc.created_at, t.code, t.holder_name, e.title AS event
      FROM scans sc JOIN tickets t ON t.id=sc.ticket_id JOIN events e ON e.id=sc.event_id
      WHERE sc.scanned_by=${s.userId} AND sc.result=${sp.res}
      ORDER BY sc.created_at DESC LIMIT 200`;
  } else {
    rows = await sql`SELECT sc.result, sc.gate, sc.created_at, t.code, t.holder_name, e.title AS event
      FROM scans sc JOIN tickets t ON t.id=sc.ticket_id JOIN events e ON e.id=sc.event_id
      WHERE sc.scanned_by=${s.userId}
      ORDER BY sc.created_at DESC LIMIT 200`;
  }
  const okCount = await sql`SELECT COUNT(*) AS n FROM scans WHERE scanned_by=${s.userId} AND result='ok'`;
  const noCount = await sql`SELECT COUNT(*) AS n FROM scans WHERE scanned_by=${s.userId} AND result != 'ok'`;
  return (
    <>
      <p className="crumbs">Personal · {s.name}</p>
      <h1>Mis registros</h1>
      <p className="muted">
        Tus validaciones: ✅ {String(okCount[0]?.n || 0)} · ⛔ {String(noCount[0]?.n || 0)}.
        Si una entrada falla, anota código y hora y consúltalo con tu superior.
      </p>
      <form className="row" action="/mis-registros">
        <select name="ev" defaultValue={sp.ev || ""} style={{ maxWidth: 260 }}>
          <option value="">Todos los eventos</option>
          {events.map((e) => <option key={e.id as string} value={e.id as string}>{String(e.title)}</option>)}
        </select>
        <select name="res" defaultValue={sp.res || ""} style={{ maxWidth: 200 }}>
          <option value="">Todos los resultados</option>
          {Object.entries(RESULT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn btn-blue">Filtrar</button>
      </form>
      <table>
        <thead><tr><th>Hora</th><th>Código</th><th>Titular</th><th>Evento</th><th>Resultado</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{new Date(String(r.created_at)).toLocaleString("es-ES")}</td>
              <td><strong>{String(r.code)}</strong></td>
              <td>{String(r.holder_name || "")}</td>
              <td>{String(r.event)}</td>
              <td>{RESULT_LABEL[String(r.result)] || String(r.result)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted">Sin registros todavía.</p>}
    </>
  );
}
