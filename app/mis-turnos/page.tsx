import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MisTurnos() {
  const s = await getSession();
  if (!s) redirect("/login?next=/mis-turnos");
  const sql = getDb();
  const rows = await sql`SELECT sh.post, sh.starts_at, sh.ends_at, sh.notes, e.title AS event
    FROM shifts sh JOIN events e ON e.id=sh.event_id
    WHERE sh.user_id=${s.userId} AND e.org_id=${s.orgId}
    ORDER BY sh.starts_at ASC LIMIT 100`;
  const upcoming = rows.filter((r) => !r.ends_at || new Date(String(r.ends_at)).getTime() > Date.now() - 864e5);
  return (
    <>
      <p className="crumbs">Personal · {s.name}</p>
      <h1>Mis turnos</h1>
      {upcoming.length === 0 && <p className="muted">Sin turnos asignados. Pide a tu responsable que te asigne en el panel del evento.</p>}
      {upcoming.map((t, i) => (
        <div key={i} className="card" style={{ marginBottom: 8 }}>
          <strong>{String(t.event)}</strong> · {String(t.post)}<br />
          <span className="muted">
            {new Date(String(t.starts_at)).toLocaleString("es-ES")}
            {t.ends_at ? ` → ${new Date(String(t.ends_at)).toLocaleString("es-ES")}` : ""}
            {t.notes ? ` · ${String(t.notes)}` : ""}
          </span>
        </div>
      ))}
    </>
  );
}
