import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { accessState, type AccessEvent } from "@/lib/access";
import ValidarClient from "@/components/validar-client";

export const dynamic = "force-dynamic";

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
  const open = events.filter((e) => accessState(e).open);
  const closed = events.filter((e) => !accessState(e).open);
  return (
    <>
      <p className="crumbs">Personal · {s.name} ({s.role})</p>
      <ValidarClient
        openEvents={open.map((e) => ({ id: e.id, title: e.title }))}
        closedEvents={closed.map((e) => ({ id: e.id, title: e.title, reason: accessState(e).reason }))}
        isOwner={s.role === "owner"}
      />
    </>
  );
}
