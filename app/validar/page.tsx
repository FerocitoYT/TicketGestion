import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { accessState, type AccessEvent } from "@/lib/access";
import ValidarClient from "@/components/validar-client";

export const dynamic = "force-dynamic";

// Un evento lista como operativo si su propio control abre o si alguna sesión sigue en ventana.
function effectiveReason(e: AccessEvent, sessions: { ends_at: string | null }[]): string {
  const own = accessState(e);
  if (own.open) return "";
  const grace = Number(e.access_grace_minutes || 0);
  for (const sess of sessions) {
    if (!sess.ends_at) return "";
    if (Date.now() <= new Date(sess.ends_at).getTime() + grace * 60000) return "";
  }
  return own.reason;
}

export default async function ValidarPage() {
  const s = await getSession();
  if (!s) redirect("/login?next=/validar");
  const sql = getDb();
  let events: AccessEvent[];
  if (s.role === "owner") {
    const rows = await sql`SELECT id, title, status, starts_at, ends_at, access_grace_minutes, access_closed
      FROM events WHERE org_id=${s.orgId} AND status='published' ORDER BY starts_at ASC`;
    events = rows as unknown as AccessEvent[];
  } else {
    const rows = await sql`SELECT e.id, e.title, e.status, e.starts_at, e.ends_at, e.access_grace_minutes, e.access_closed
      FROM event_staff es JOIN events e ON e.id=es.event_id
      WHERE es.user_id=${s.userId} AND e.org_id=${s.orgId} AND e.status='published' ORDER BY e.starts_at ASC`;
    events = rows as unknown as AccessEvent[];
  }
  const withSessions = await Promise.all(
    events.map(async (e) => {
      const ss = await sql`SELECT ends_at FROM sessions WHERE event_id=${e.id} AND status='scheduled'`;
      return { e, sessions: ss as unknown as { ends_at: string | null }[] };
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
