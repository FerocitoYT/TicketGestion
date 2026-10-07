import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import DirectoClient from "@/components/directo-client";

export const dynamic = "force-dynamic";

export default async function Directo({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) redirect("/login");
  const sp = await searchParams;
  const sql = getDb();
  const events = await sql`SELECT id, title FROM events WHERE org_id=${s.orgId} AND status='published' ORDER BY starts_at DESC LIMIT 50`;
  const current = events.find((e) => String(e.id) === sp.event) || events[0];
  return (
    <>
      <p className="crumbs"><a href="/panel">Panel</a> / Directo</p>
      <h1>Ocupación en directo</h1>
      <form className="row" action="/panel/directo">
        <select name="event" defaultValue={current ? String(current.id) : ""} style={{ maxWidth: 360 }}>
          {events.map((e) => <option key={String(e.id)} value={String(e.id)}>{String(e.title)}</option>)}
        </select>
        <button className="btn btn-blue">Ver</button>
      </form>
      {current
        ? <DirectoClient eventId={String(current.id)} eventTitle={String(current.title)} />
        : <p className="muted">Sin eventos publicados.</p>}
    </>
  );
}
