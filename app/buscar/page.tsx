import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  if (!q) {
    return (<><h1>Buscar</h1><p className="muted">Escribe un artista, evento o recinto en el buscador superior.</p></>);
  }
  const like = `%${q.toLowerCase()}%`;
  let artists: { name: string; slug: string; photo_url: string; genre: string }[] = [];
  let events: { title: string; slug: string; category: string; starts_at: string; city: string; venue: string }[] = [];
  try {
    const sql = getDb();
    const a = await sql`SELECT name, slug, photo_url, genre FROM artists WHERE LOWER(name) LIKE ${like} ORDER BY name ASC LIMIT 8`;
    artists = a as unknown as typeof artists;
    const e = await sql`
      SELECT e.title, e.slug, e.category, e.starts_at, COALESCE(v.city,'') AS city, COALESCE(v.name,'') AS venue
      FROM events e LEFT JOIN venues v ON v.id=e.venue_id
      WHERE e.status='published' AND (LOWER(e.title) LIKE ${like} OR LOWER(COALESCE(v.name,'')) LIKE ${like} OR LOWER(COALESCE(v.city,'')) LIKE ${like} OR LOWER(e.description) LIKE ${like})
      ORDER BY e.starts_at ASC LIMIT 12`;
    events = e as unknown as typeof events;
  } catch {
    return <p className="muted">Configura DATABASE_URL para buscar.</p>;
  }
  return (
    <>
      <p className="crumbs"><a href="/">Inicio</a> / Buscar: {q}</p>
      <h1>Resultados para “{q}”</h1>
      {artists.length === 0 && events.length === 0 && (
        <p className="muted">Sin resultados. Prueba con otro nombre. <a href="/eventos">Ver agenda completa</a>.</p>
      )}
      {artists.length > 0 && (
        <>
          <div className="section-title"><h2>Artistas</h2><a href="/artistas">Ver todos</a></div>
          <div className="artist-row">
            {artists.map((a) => (
              <a key={a.slug} className="artist-card" href={`/artistas/${a.slug}`}>
                {a.photo_url
                  ? <img src={a.photo_url} alt={a.name} loading="lazy" />
                  : <div className="artist-fallback">{a.name.slice(0, 1)}</div>}
                <strong>{a.name}</strong>
                <span>{a.genre}</span>
              </a>
            ))}
          </div>
        </>
      )}
      {events.length > 0 && (
        <>
          <div className="section-title"><h2>Eventos</h2><a href="/eventos">Ver agenda</a></div>
          <div className="grid">
            {events.map((e) => {
              const dt = new Date(e.starts_at);
              return (
                <a key={e.slug} className="card" href={`/eventos/${e.slug}`}>
                  <div className={`card-art art-${e.category}`}>{e.category} · {e.city || "Gira"}</div>
                  <div className="card-body">
                    <div className="datebox">
                      <b>{dt.getDate().toString().padStart(2, "0")}</b>
                      <span>{dt.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")}</span>
                    </div>
                    <div>
                      <h3>{e.title}</h3>
                      <p>{e.venue}{e.city ? ` · ${e.city}` : ""}</p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
