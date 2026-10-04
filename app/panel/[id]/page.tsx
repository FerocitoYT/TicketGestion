import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect, notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ManageEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s) redirect("/login");
  const sql = getDb();
  const ev = await sql`SELECT * FROM events WHERE id=${id} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) notFound();
  const zones = await sql`SELECT * FROM zones WHERE event_id=${id} ORDER BY price_cents ASC`;
  const orders = await sql`SELECT * FROM orders WHERE event_id=${id} ORDER BY created_at DESC LIMIT 100`;
  const scans = await sql`SELECT s.*, t.code FROM scans s JOIN tickets t ON t.id=s.ticket_id WHERE s.event_id=${id} ORDER BY s.created_at DESC LIMIT 100`;
  return (
    <>
      <a href="/panel">← Volver</a>
      <h1>{String(ev[0].title)}</h1>
      <p className="muted">slug: {String(ev[0].slug)} · estado: {String(ev[0].status)}</p>
      <div className="row">
        <form action="/api/panel/events/publish" method="post"><input type="hidden" name="id" value={id} /><button>Publicar</button></form>
        <form action="/api/panel/events/cancel" method="post"><input type="hidden" name="id" value={id} /><button className="btn-ghost">Cancelar evento</button></form>
      </div>
      <h2>Zonas y precios</h2>
      <form action="/api/panel/zones" method="post" className="form">
        <input type="hidden" name="eventId" value={id} />
        <div className="row">
          <input name="name" required placeholder="Pista / Grada…" />
          <input name="price" required type="number" step="0.01" placeholder="Precio €" />
          <input name="capacity" required type="number" placeholder="Cupo" />
        </div>
        <button formAction="/api/panel/zones">Añadir zona</button>
      </form>
      <table><thead><tr><th>Zona</th><th>Precio</th><th>Vendidas</th><th>Aforo</th></tr></thead>
        <tbody>{zones.map((z) => <tr key={z.id as string}><td>{String(z.name)}</td><td>{(Number(z.price_cents) / 100).toFixed(2)} €</td><td>{String(z.sold)}</td><td>{String(z.capacity)}</td></tr>)}</tbody>
      </table>
      <h2>Código promo</h2>
      <form action="/api/panel/promos" method="post" className="form">
        <input type="hidden" name="eventId" value={id} />
        <div className="row">
          <input name="code" required placeholder="EARLY10" />
          <input name="pct" type="number" min={1} max={100} required placeholder="% dto" />
          <input name="maxUses" type="number" placeholder="Usos máx (0=∞)" defaultValue={0} />
        </div>
        <button formAction="/api/panel/promos">Crear promo</button>
      </form>
      <h2>Últimos pedidos</h2>
      <table><thead><tr><th>Email</th><th>Cant</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>{orders.map((o) => <tr key={o.id as string}><td>{String(o.buyer_email)}</td><td>{String(o.qty)}</td><td>{(Number(o.total_cents) / 100).toFixed(2)} €</td><td>{String(o.status)}</td></tr>)}</tbody>
      </table>
      <h2>Accesos</h2>
      <table><thead><tr><th>Hora</th><th>Código</th><th>Resultado</th><th>Puerta</th></tr></thead>
        <tbody>{scans.map((x) => <tr key={x.id as string}><td>{new Date(String(x.created_at)).toLocaleString("es-ES")}</td><td>{String(x.code)}</td><td>{String(x.result)}</td><td>{String(x.gate)}</td></tr>)}</tbody>
      </table>
    </>
  );
}
