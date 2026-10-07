import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import ArtistSearch from "@/components/artist-search";
import SurveyBlock from "@/components/survey-block";
import AccredBlock from "@/components/accred-block";
import WaitlistBlock from "@/components/waitlist-block";
import PromotersBlock from "@/components/promoters-block";
import ProgramBlock from "@/components/program-block";
import GalleryBlock from "@/components/gallery-block";
import ShiftsBlock from "@/components/shifts-block";
import EventIncidentsBlock from "@/components/event-incidents-block";

export const dynamic = "force-dynamic";

export default async function ManageEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "owner" && s.role !== "staff") redirect("/validar");
  const sql = getDb();
  const ev = await sql`SELECT * FROM events WHERE id=${id} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) notFound();
  const zones = await sql`SELECT * FROM zones WHERE event_id=${id} ORDER BY price_cents ASC`;
  const orders = await sql`SELECT * FROM orders WHERE event_id=${id} ORDER BY created_at DESC LIMIT 100`;
  const scans = await sql`SELECT s.*, t.code FROM scans s JOIN tickets t ON t.id=s.ticket_id WHERE s.event_id=${id} ORDER BY s.created_at DESC LIMIT 100`;
  const sessions = await sql`SELECT s.*, (SELECT COUNT(*) FROM zones z WHERE z.session_id=s.id) AS zones_n,
    (SELECT COALESCE(SUM(sold),0) FROM zones z WHERE z.session_id=s.id) AS sold
    FROM sessions s WHERE s.event_id=${id} ORDER BY s.starts_at ASC`;
  const attached = await sql`SELECT a.id, a.name, a.photo_url AS photo FROM event_artists ea JOIN artists a ON a.id=ea.artist_id WHERE ea.event_id=${id} ORDER BY a.name`;
  const zonesList = await sql`SELECT z.id, z.name FROM zones z JOIN sessions s ON s.id=z.session_id WHERE z.event_id=${id} AND s.status='scheduled' ORDER BY s.starts_at, z.price_cents`;
  const accreds = await sql`SELECT t.code, t.kind, t.holder_name AS holder, t.status, z.name AS zone
    FROM tickets t JOIN zones z ON z.id=t.zone_id WHERE t.event_id=${id} AND t.kind <> 'general' ORDER BY t.created_at DESC LIMIT 200`;
  const staff = await sql`SELECT u.id, u.name, u.email, m.role, (es.user_id IS NOT NULL) AS assigned
    FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN event_staff es ON es.user_id=u.id AND es.event_id=${id}
    WHERE m.org_id=${s.orgId} ORDER BY u.name`;
  const toLocal = (v: unknown) => {
    if (!v) return "";
    const d = new Date(String(v));
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  return (
    <>
      <a href="/panel">← Volver</a>
      <h1>{String(ev[0].title)}</h1>
      <p className="muted">slug: {String(ev[0].slug)} · estado: {String(ev[0].status)}</p>
      <h2>Cartel del concierto</h2>
      {ev[0].image_url ? (
        <img src={String(ev[0].image_url)} alt="Cartel" style={{ maxWidth: 320, borderRadius: 12 }} />
      ) : (
        <p className="muted">Sin cartel: se muestra un fondo por categoría.</p>
      )}
      <form action="/api/panel/events/poster" method="post" encType="multipart/form-data" className="form" style={{ marginTop: 10 }}>
        <input type="hidden" name="id" value={id} />
        <label>Archivo (JPG/PNG/WebP, máx 1,5 MB)<input name="file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <label>O URL de imagen<input name="imageUrl" placeholder="https://…" /></label>
        <button formAction="/api/panel/events/poster">Guardar cartel</button>
      </form>
      <div className="row">
        <form action="/api/panel/events/publish" method="post"><input type="hidden" name="id" value={id} /><button>Publicar</button></form>
        <form action="/api/panel/events/cancel" method="post"><input type="hidden" name="id" value={id} /><button className="btn-ghost">Cancelar evento</button></form>
      </div>
      <h2>Sesiones (fechas)</h2>
      <table><thead><tr><th>Fecha</th><th>Zonas</th><th>Vendidas</th><th></th></tr></thead>
        <tbody>{sessions.map((x) => (
          <tr key={String(x.id)}>
            <td>{new Date(String(x.starts_at)).toLocaleString("es-ES")}{x.ends_at ? ` → ${new Date(String(x.ends_at)).toLocaleString("es-ES")}` : ""}</td>
            <td>{String(x.zones_n)}</td><td>{String(x.sold)}</td>
            <td><form action="/api/panel/sessions/delete" method="post" style={{ display: "inline" }}>
              <input type="hidden" name="id" value={String(x.id)} /><input type="hidden" name="eventId" value={id} />
              <button>Borrar</button>
            </form></td>
          </tr>
        ))}</tbody>
      </table>
      <form action="/api/panel/sessions" method="post" className="form" style={{ marginTop: 10 }}>
        <input type="hidden" name="eventId" value={id} />
        <div className="row">
          <label>Inicio<input name="startsAt" type="datetime-local" required /></label>
          <label>Fin (opcional)<input name="endsAt" type="datetime-local" /></label>
        </div>
        <button formAction="/api/panel/sessions">Añadir fecha (hereda zonas)</button>
      </form>
      <h2>Zonas y precios</h2>
      {sessions.length === 0 && (
        <p className="alert err">Este evento aún no tiene fechas: crea primero una en “Sesiones” para poder añadir zonas.</p>
      )}
      <form action="/api/panel/zones" method="post" className="form">
        <input type="hidden" name="eventId" value={id} />
        <div className="row">
          <input name="name" required placeholder="Pista / Grada…" />
          <input name="price" required type="number" step="0.01" placeholder="Precio €" />
          <input name="capacity" required type="number" placeholder="Cupo" />
        </div>
        <div className="row">
          <select name="sessionId" required>
            {sessions.map((x) => <option key={String(x.id)} value={String(x.id)}>{new Date(String(x.starts_at)).toLocaleString("es-ES")}</option>)}
          </select>
          <input name="seatRows" type="number" min={0} max={40} placeholder="Filas (0 = sin numerar)" />
          <input name="seatCols" type="number" min={0} max={60} placeholder="Asientos por fila" />
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
      <h2>Control de acceso del evento</h2>
      <p className="muted">
        Control operativo: {String(ev[0].status) === "published" && !ev[0].access_closed ? "SÍ" : "NO"}
        {ev[0].access_closed ? " (cerrado a mano)" : ""}
      </p>
      <p className="muted">La puerta abre a las 00:00 del día del evento y cierra 1 h después del inicio.</p>
      <form action="/api/panel/events/schedule" method="post" className="form">
        <input type="hidden" name="id" value={id} />
        <div className="row">
          <label>Hora de fin (informativa)<input name="endsAt" type="datetime-local" defaultValue={toLocal(ev[0].ends_at)} /></label>
        </div>
        <button formAction="/api/panel/events/schedule">Guardar hora de fin</button>
      </form>
      <div className="row" style={{ marginTop: 10 }}>
        {!ev[0].access_closed
          ? <form action="/api/panel/events/finish" method="post"><input type="hidden" name="id" value={id} /><button>Finalizar control ahora</button></form>
          : <form action="/api/panel/events/reopen" method="post"><input type="hidden" name="id" value={id} /><button>Reabrir control</button></form>}
      </div>
      <h2>Límites y aforo</h2>
      <p className="muted">Por compra: {String(ev[0].max_per_order ?? 10)} · Por persona: {Number(ev[0].max_per_buyer ?? 0) > 0 ? String(ev[0].max_per_buyer) : "sin límite"} · Aforo zonas: {zones.reduce((a, z) => a + Number(z.capacity), 0)} ({zones.reduce((a, z) => a + Number(z.sold), 0)} vendidas)</p>
      <form action="/api/panel/events/limits" method="post" className="form">
        <input type="hidden" name="id" value={id} />
        <div className="row">
          <label>Máx por compra<input name="maxPerOrder" type="number" min={1} max={50} defaultValue={String(ev[0].max_per_order ?? 10)} /></label>
          <label>Máx por persona (0 = sin límite)<input name="maxPerBuyer" type="number" min={0} max={100} defaultValue={String(ev[0].max_per_buyer ?? 0)} /></label>
        </div>
        <button formAction="/api/panel/events/limits">Guardar límites</button>
      </form>
      <h2>Personal de puerta asignado</h2>      <p className="muted">Solo este personal puede validar entradas de este evento. El propietario siempre puede.</p>
      <form action="/api/panel/event-staff" method="post" className="form">
        <input type="hidden" name="eventId" value={id} />
        {staff.map((m) => (
          <label key={String(m.id)} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="userIds" value={String(m.id)} defaultChecked={Boolean(m.assigned)} style={{ width: "auto" }} />
            {String(m.name)} · {String(m.email)} · {String(m.role)}
          </label>
        ))}
        <button formAction="/api/panel/event-staff">Guardar asignación</button>
      </form>
      <h2>Turnos</h2>
      <ShiftsBlock eventId={id} />
      <h2>Incidencias</h2>
      <EventIncidentsBlock eventId={id} canResolve={true} />
      <h2>Artistas del evento</h2>
      <ArtistSearch eventId={id} attached={attached as unknown as { id: string; name: string; photo: string }[]} />
      <h2>Encuesta de satisfacción</h2>
      <SurveyBlock eventId={id} />
      <h2>Acreditaciones (VIP / prensa / invitados)</h2>
      <p className="muted">Entradas gratuitas con cupo de zona. Se nominan en puerta con DNI.</p>
      <AccredBlock
        eventId={id}
        zones={zonesList as unknown as { id: string; name: string }[]}
        existing={accreds as unknown as { code: string; kind: string; holder: string; status: string; zone: string }[]}
      />
      <h2>Lista de espera</h2>
      <WaitlistBlock eventId={id} />
      <h2>Promotores y afiliados</h2>
      <PromotersBlock eventId={id} slug={String(ev[0].slug)} />
      <h2>Programa (horarios)</h2>
      <ProgramBlock eventId={id} />
      <h2>Galería</h2>
      <GalleryBlock eventId={id} />
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
