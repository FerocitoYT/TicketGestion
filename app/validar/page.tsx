import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { accessState, type AccessEvent } from "@/lib/access";
import ValidarClient from "@/components/validar-client";

export const dynamic = "force-dynamic";

// Un evento lista como operativo si su propio control abre o si alguna sesión está en ventana.
// Si todo es futuro, indica cuándo abre; si todo pasó, el motivo de cierre.
function effectiveReason(
  e: AccessEvent, sessions: { starts_at: string; ends_at: string | null }[]
): string {
  if (e.status !== "published") return accessState(e).reason;
  if (e.access_closed) return accessState(e).reason;
  const grace = Number(e.access_grace_minutes || 0);
  const opens = Number(e.access_opens_minutes ?? 120);
  if (sessions.length === 0) return accessState(e).reason;
  let earliestUpcoming: number | null = null;
  for (const sess of sessions) {
    const start = new Date(sess.starts_at).getTime();
    const limit = sess.ends_at ? new Date(sess.ends_at).getTime() + grace * 60000 : Infinity;
    if (Date.now() >= start - opens * 60000 && Date.now() <= limit) return "";
    if (Date.now() < start - opens * 60000 && (earliestUpcoming === null || start - opens * 60000 < earliestUpcoming)) {
      earliestUpcoming = start - opens * 60000;
    }
  }
  if (earliestUpcoming !== null) {
    return `El control abre el ${new Date(earliestUpcoming).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  }
  return "Control finalizado (hora de fin superada)";
}

export default async function ValidarPage() {
  const s = await getSession();
  if (!s) redirect("/login?next=/validar");
  const sql = getDb();
  let events: AccessEvent[];
  if (s.role === "owner") {
    const rows = await sql`SELECT id, title, status, starts_at, ends_at, access_grace_minutes, access_closed, access_opens_minutes
      FROM events WHERE org_id=${s.orgId} AND status='published' ORDER BY starts_at ASC`;
    events = rows as unknown as AccessEvent[];
  } else {
    const rows = await sql`SELECT e.id, e.title, e.status, e.starts_at, e.ends_at, e.access_grace_minutes, e.access_closed, e.access_opens_minutes
      FROM event_staff es JOIN events e ON e.id=es.event_id
      WHERE es.user_id=${s.userId} AND e.org_id=${s.orgId} AND e.status='published' ORDER BY e.starts_at ASC`;
    events = rows as unknown as AccessEvent[];
  }
  const withSessions = await Promise.all(
    events.map(async (e) => {
      const ss = await sql`SELECT starts_at, ends_at FROM sessions WHERE event_id=${e.id} AND status='scheduled'`;
      return { e, sessions: ss as unknown as { starts_at: string; ends_at: string | null }[] };
    })
  );
  const open = withSessions.filter((x) => effectiveReason(x.e, x.sessions) === "");
  const closed = withSessions.filter((x) => effectiveReason(x.e, x.sessions) !== "");
  return (
    <>
      <p className="crumbs">Personal · {s.name} ({s.role})</p>
      <ValidarClient
        openEvents={open.map((x) => ({ id: x.e.id, title: x.e.title }))}
        closedEvents={closed.map((x) => ({ id: x.e.id, title: x.e.title, reason: effectiveReason(x.e, x.sessions) }))}
        isOwner={s.role === "owner"}
      />
    </>
  );
}
