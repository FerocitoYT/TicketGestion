import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getForecast } from "@/lib/meteo";

export const dynamic = "force-dynamic";

async function getEvent(slug: string) {
  const sql = getDb();
  const ev = await sql`
    SELECT e.*, COALESCE(v.name,'') AS venue, COALESCE(v.city,'') AS city, COALESCE(v.address,'') AS address
    FROM events e LEFT JOIN venues v ON v.id=e.venue_id WHERE e.slug=${slug} LIMIT 1`;
  if (!ev[0]) return null;
  const sessions = await sql`SELECT id, starts_at, ends_at FROM sessions WHERE event_id=${ev[0].id} AND status='scheduled' ORDER BY starts_at ASC`;
  const zones = await sql`SELECT id, name, price_cents, capacity, sold, session_id, seat_rows, seat_cols, accessible FROM zones WHERE event_id=${ev[0].id} ORDER BY price_cents ASC`;
  const artists = await sql`SELECT a.name, a.slug FROM event_artists ea JOIN artists a ON a.id=ea.artist_id WHERE ea.event_id=${ev[0].id} ORDER BY a.name`;
  const program = await sql`SELECT p.starts_at, p.title, p.description, a.name AS artist, a.slug AS aslug
    FROM program_slots p LEFT JOIN artists a ON a.id=p.artist_id WHERE p.event_id=${ev[0].id} ORDER BY p.starts_at ASC`;
  const gallery = await sql`SELECT image_url, caption FROM event_gallery WHERE event_id=${ev[0].id} ORDER BY created_at ASC`;
  const packs = await sql`SELECT p.id, p.name, p.qty, p.price_cents, z.name AS zone,
      (SELECT COUNT(*) FROM orders o WHERE o.pack_id=p.id AND o.status='paid') AS sold_packs
    FROM packs p JOIN zones z ON z.id=p.zone_id
    WHERE p.event_id=${ev[0].id} AND p.active=true
      AND (p.max_uses = 0 OR p.used < p.max_uses)
      AND (z.capacity - z.sold) >= p.qty
    ORDER BY p.price_cents ASC`;
  const venueMap = ev[0].venue_id
    ? String((await sql`SELECT map_url FROM venues WHERE id=${ev[0].venue_id} LIMIT 1`)[0]?.map_url || "")
    : "";
  return {
    event: ev[0] as Record<string, unknown>,
    sessions: sessions as unknown as { id: string; starts_at: string; ends_at: string | null }[],
    zones: zones as unknown as { id: string; name: string; price_cents: number; capacity: number; sold: number; session_id: string; seat_rows: number; seat_cols: number; accessible: boolean }[],
    artists: artists as unknown as { name: string; slug: string }[],
    program: program as unknown as { starts_at: string; title: string; description: string; artist: string | null; aslug: string | null }[],
    gallery: gallery as unknown as { image_url: string; caption: string }[],
    packs: packs as unknown as { id: string; name: string; qty: number; price_cents: number; zone: string }[],
    venueMap,
  };
}

export default async function EventPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ promo?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const promo = (sp.promo || "").toUpperCase().trim().slice(0, 32);
  let data: Awaited<ReturnType<typeof getEvent>>;
  try {
    data = await getEvent(slug);
  } catch {
    return <p className="muted">Configura DATABASE_URL para ver eventos.</p>;
  }
  if (!data) notFound();
  const { event, sessions, zones, artists, program, gallery, venueMap, packs } = data;
  const forecast = String(event.city || "")
    ? await getForecast(String(event.city), String(event.starts_at)).catch(() => null)
    : null;
  const totalLeft = zones.reduce((a, z) => a + Math.max(0, Number(z.capacity) - Number(z.sold)), 0);
  const dt = new Date(String(event.starts_at));
  return (
    <>
      <p className="crumbs"><a href="/">Inicio</a> / <a href="/eventos">Agenda</a> / {String(event.title)}</p>
      <section className="event-hero">
        <div className={`banner art-${String(event.category)}`} style={event.image_url ? { backgroundImage: `linear-gradient(rgba(4,20,50,.45),rgba(4,20,50,.45)),url(${String(event.image_url)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          <span className="badge" style={{ background: "rgba(255,255,255,.25)", color: "#fff" }}>
            {String(event.category)} · {sessions.length > 1 ? `${sessions.length} fechas` : dt.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <h1 className="event-title" style={{ margin: "10px 0 6px", fontSize: 38 }}>{String(event.title)}</h1>
          <p style={{ margin: 0, opacity: 0.93 }}>
            {String(event.venue)}{String(event.city) ? ` · ${event.city}` : ""}{String(event.address) ? ` · ${event.address}` : ""}
          </p>
        </div>
        <div className="info">
          <div>
            <h2>Sobre el evento</h2>
            <p>{String(event.description || "Toda la información del evento, accesos y horarios.")}</p>
            {artists.length > 0 && (
              <div className="row" style={{ margin: "10px 0" }}>
                {artists.map((a) => <a key={a.slug} className="badge" href={`/artistas/${a.slug}`}>{a.name}</a>)}
              </div>
            )}
            <div className="row" style={{ margin: "14px 0" }}>
              <span className="badge">{totalLeft} entradas disponibles</span>
              <span className="badge">QR nominativo</span>
              <span className="badge">Anti-reventa en puerta</span>
            </div>
            <h3>Zonas y precios</h3>
            {sessions.map((ses) => {
              const sz = zones.filter((z) => String(z.session_id) === String(ses.id));
              if (sz.length === 0) return null;
              return (
                <div key={String(ses.id)}>
                  <p><span className="badge">{new Date(String(ses.starts_at)).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span></p>
                  <div className="zones">
                    {sz.map((z) => (
                      <div key={String(z.id)} className="zone">
                        <div><strong>{String(z.name)}</strong><br /><span className="muted">{Number(z.capacity) - Number(z.sold)} disponibles{Number(z.seat_rows) > 0 ? " · asientos numerados" : ""}{z.accessible ? " · acceso adaptado" : ""}</span></div>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>{(Number(z.price_cents) / 100).toFixed(2)} €</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <h3>Programa</h3>
            {program.length === 0 && <p className="muted">Horarios por confirmar.</p>}
            {program.map((p, i) => (
              <div key={i} className="zone" style={{ marginBottom: 8 }}>
                <div><strong>{new Date(String(p.starts_at)).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</strong></div>
                <div>
                  <strong>{p.aslug ? <a href={`/artistas/${p.aslug}`}>{String(p.title)}</a> : String(p.title)}</strong>
                  <br /><span className="muted">{String(p.description || "")}</span>
                </div>
              </div>
            ))}
            {venueMap && (
              <>
                <h3>Cómo llegar</h3>
                <img src={venueMap} alt="Plano del recinto" style={{ width: "100%", borderRadius: 12 }} />
              </>
            )}
            {(event.transport || event.parking || forecast) && (
              <>
                <h3>El día D</h3>
                {forecast && (
                  <p><span className="badge">Meteo: {forecast.label} · {forecast.tmax}°C · lluvia {forecast.precip}%</span></p>
                )}
                {event.transport ? <p><strong>Transporte:</strong> {String(event.transport)}</p> : null}
                {event.parking ? <p><strong>Parking:</strong> {String(event.parking)}</p> : null}
              </>
            )}
            {gallery.length > 0 && (
              <>
                <h3>Galería</h3>
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))" }}>
                  {gallery.map((g, i) => (
                    <img key={i} src={g.image_url} alt={g.caption} title={g.caption} style={{ width: "100%", borderRadius: 10 }} />
                  ))}
                </div>
              </>
            )}
            <h3>Preguntas frecuentes</h3>
            <p className="muted"><strong>¿La entrada lleva mi nombre?</strong> Sí: cada QR es nominativo y en puerta se comprueba el DNI.</p>
            <p className="muted"><strong>¿Puedo revenderla?</strong> No: el primer escaneo quema la entrada y las copias dejan de funcionar.</p>
            <p className="muted"><strong>¿Cómo recibo mis entradas?</strong> Al instante, con QR único por persona, recuperables en Mis entradas.</p>
          </div>
          <aside className="buybox">
            <h3 style={{ marginTop: 0 }}>Comprar entradas</h3>
            {promo && <p><span className="badge">Código {promo} aplicado: se usará al pagar</span></p>}
            {packs.length > 0 && (
              <>
                <p className="muted" style={{ margin: "8px 0" }}><strong>Packs de grupo</strong></p>
                {packs.map((p) => (
                  <div key={String(p.id)} className="zone" style={{ marginBottom: 10 }}>
                    <div>
                      <strong>{String(p.name)}</strong><br />
                      <span className="muted">{String(p.qty)} entradas · {String(p.zone)}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{(Number(p.price_cents) / 100).toFixed(2)} €</div>
                      <a className="btn btn-blue" style={{ marginTop: 6 }} href={`/comprar?pack=${String(p.id)}${promo ? `&promo=${encodeURIComponent(promo)}` : ""}`}>Elegir pack</a>
                    </div>
                  </div>
                ))}
              </>
            )}
            {zones.length === 0 || sessions.length === 0 ? (
              <p className="muted">Entradas a la venta próximamente.</p>
            ) : (
              sessions.map((ses) => {
                const sz = zones.filter((z) => String(z.session_id) === String(ses.id));
                const avail = sz.filter((z) => Number(z.capacity) - Number(z.sold) > 0);
                const soldout = sz.filter((z) => Number(z.capacity) - Number(z.sold) <= 0);
                if (sz.length === 0) return null;
                return (
                  <div key={String(ses.id)} style={{ marginBottom: 12 }}>
                    <p className="muted" style={{ margin: "8px 0" }}><strong>{new Date(String(ses.starts_at)).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</strong></p>
                    {avail.map((z) => (
                      <div key={String(z.id)} className="zone" style={{ marginBottom: 10 }}>
                        <div>
                          <strong>{String(z.name)}</strong><br />
                          <span className="muted">{Number(z.capacity) - Number(z.sold)} disponibles{Number(z.seat_rows) > 0 ? " · elige asiento" : ""}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 20, fontWeight: 800 }}>{(Number(z.price_cents) / 100).toFixed(2)} €</div>
                          <a className="btn btn-blue" style={{ marginTop: 6 }} href={`/comprar?zone=${String(z.id)}${promo ? `&promo=${encodeURIComponent(promo)}` : ""}`}>Elegir</a>
                        </div>
                      </div>
                    ))}
                    {soldout.map((z) => (
                      <div key={String(z.id)} className="zone" style={{ marginBottom: 10, opacity: 0.75 }}>
                        <div>
                          <strong>{String(z.name)}</strong><br />
                          <span className="muted">Agotada</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 20, fontWeight: 800 }}>{(Number(z.price_cents) / 100).toFixed(2)} €</div>
                          <a className="btn btn-ghost" style={{ marginTop: 6 }} href={`/comprar?zone=${String(z.id)}`}>Avísame</a>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
            {zones.length > 0 && zones.every((z) => Number(z.capacity) - Number(z.sold) <= 0) && (
              <p className="alert err">Entradas agotadas.</p>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
