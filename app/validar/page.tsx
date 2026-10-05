import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { accessState, type AccessEvent } from "@/lib/access";
import ValidarClient from "@/components/validar-client";

export const dynamic = "force-dynamic";

// Un evento lista como operativo si su propio control abre o si alguna sesión está en ventana
// (día de la sesión desde las 00:00 hasta 1 h después del inicio).
function effectiveReason(
  e: AccessEvent, sessions: { starts_at: string; ends_at: string | null }[]
): string {
  if (e.status !== "published") return accessState(e).reason;
  if (e.access_closed) return accessState(e).reason;
  const inWindow = (startIso: string): boolean => {
    const start = new Date(startIso).getTime();
    const day = new Date(start);
    day.setHours(0, 0, 0, 0);
    return Date.now() >= day.getTime() && Date.now() <= start + 3600e3;
  };
  if (sessions.length === 0) return accessState(e).reason;
  if (sessions.some((s) => inWindow(s.starts_at))) return "";
  const upcoming = sessions
    .map((s) => new Date(s.starts_at).getTime())
    .filter((t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return Date.now() < d.getTime(); })
    .sort((a, b) => a - b)[0];
  if (upcoming !== undefined) {
    return `El control abre el ${new Date(upcoming).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}`;
  }
  return "Control finalizado (1 h después del inicio)";
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
