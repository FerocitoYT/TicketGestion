import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ArtistaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM artists WHERE slug=${slug} LIMIT 1`;
    if (!rows[0]) notFound();
    const a = rows[0];
    const evs = await sql`
      SELECT e.title, e.slug, e.starts_at, e.category, COALESCE(v.city,'') AS city,
        (SELECT MIN(price_cents) FROM zones z WHERE z.event_id=e.id) AS min_price
      FROM event_artists ea JOIN events e ON e.id=ea.event_id LEFT JOIN venues v ON v.id=e.venue_id
      WHERE ea.artist_id=${a.id} AND e.status='published' ORDER BY e.starts_at ASC`;
    return (
      <>
        <p className="crumbs"><a href="/">Inicio</a> / <a href="/artistas">Artistas</a> / {String(a.name)}</p>
        <section className="event-hero">
          <div className="banner art-concierto" style={a.photo_url ? { backgroundImage: `linear-gradient(rgba(4,20,50,.55),rgba(4,20,50,.55)),url(${String(a.photo_url)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
            <span className="badge" style={{ background: "rgba(255,255,255,.25)", color: "#fff" }}>{String(a.genre || "Artista")}</span>
            <h1 style={{ margin: "10px 0 6px", fontSize: 38 }}>{String(a.name)}</h1>
          </div>
          <div className="info" style={{ gridTemplateColumns: "1fr" }}>
            <div>
              {a.photo_url && <img src={String(a.photo_url)} alt={String(a.name)} width={220} style={{ borderRadius: 12, float: "right", margin: "0 0 12px 16px" }} />}
              <h2>Sobre el artista</h2>
              <p>{String(a.bio || "Próximamente más información.")}</p>
            </div>
          </div>
        </section>
        <div className="section-title"><h2>Sus eventos</h2></div>
        {evs.length === 0 && <p className="muted">Sin eventos publicados por ahora.</p>}
        <div className="grid">
          {evs.map((e) => (
            <a key={e.slug as string} className="card" href={`/eventos/${e.slug}`}>
              <div className={`card-art art-${e.category}`}>{String(e.category)} · {String(e.city || "Gira")}</div>
              <div className="card-body">
                <div>
                  <h3>{String(e.title)}</h3>
                  <p>{new Date(String(e.starts_at)).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</p>
                  <p className="price">{e.min_price != null ? `Desde ${(Number(e.min_price) / 100).toFixed(2)} €` : "Disponible"}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </>
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_NOT_FOUND")) throw e;
    return <p className="muted">No se pudo cargar el artista.</p>;
  }
}
