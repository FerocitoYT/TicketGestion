import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const CATS: [string, string][] = [
  ["concierto", "Conciertos"],
  ["deporte", "Deportes"],
  ["teatro", "Teatro"],
  ["festival", "Festivales"],
  ["otros", "Más planes"],
];
const CAT_LABEL = Object.fromEntries(CATS);

type EventRow = {
  title: string; slug: string; description: string; category: string;
  starts_at: string; city: string; venue: string; min_price: number | null;
  artists: string;
  artist_slugs: string;
};
type PopularArtist = {
  name: string; slug: string; photo_url: string; genre: string; n: number;
};

async function loadEvents(): Promise<EventRow[]> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT e.title, e.slug, e.description, e.category, e.starts_at,
             COALESCE(v.city,'') AS city, COALESCE(v.name,'') AS venue,
             (SELECT MIN(price_cents) FROM zones z WHERE z.event_id = e.id) AS min_price,
             COALESCE((SELECT string_agg(a.name, '|') FROM event_artists ea JOIN artists a ON a.id=ea.artist_id WHERE ea.event_id=e.id), '') AS artists,
             COALESCE((SELECT string_agg(a.slug, '|') FROM event_artists ea JOIN artists a ON a.id=ea.artist_id WHERE ea.event_id=e.id), '') AS artist_slugs
      FROM events e LEFT JOIN venues v ON v.id = e.venue_id
      WHERE e.status='published' ORDER BY e.starts_at ASC LIMIT 60`;
    return rows as unknown as EventRow[];
  } catch {
    return [];
  }
}

async function loadPopular(): Promise<PopularArtist[]> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT a.name, a.slug, a.photo_url, a.genre, COUNT(e.id) AS n
      FROM artists a JOIN event_artists ea ON ea.artist_id=a.id
      JOIN events e ON e.id=ea.event_id AND e.status='published'
      GROUP BY a.id ORDER BY COUNT(e.id) DESC, a.name ASC LIMIT 8`;
    return rows as unknown as PopularArtist[];
  } catch {
    return [];
  }
}

async function stats(): Promise<{ events: number; artists: number }> {
  try {
    const sql = getDb();
    const e = await sql`SELECT COUNT(*) AS n FROM events WHERE status='published'`;
    const a = await sql`SELECT COUNT(*) AS n FROM artists`;
    return { events: Number(e[0]?.n || 0), artists: Number(a[0]?.n || 0) };
  } catch {
    return { events: 0, artists: 0 };
  }
}

function fmtDay(d: string) {
  const dt = new Date(d);
  return {
    day: dt.getDate().toString().padStart(2, "0"),
    mon: dt.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
    full: dt.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }),
  };
}

function Card({ e }: { e: EventRow }) {
  const f = fmtDay(e.starts_at);
  const artists = e.artists ? e.artists.split("|") : [];
  return (
    <a className="card" href={`/eventos/${e.slug}`}>
      <div className={`card-art art-${e.category}`}>
        {CAT_LABEL[e.category] || e.category} · {e.city || "Gira nacional"}
      </div>
      <div className="card-body">
        <div className="datebox"><b>{f.day}</b><span>{f.mon}</span></div>
        <div>
          <h3>{e.title}</h3>
          {artists.length > 0 && <p><strong>{artists.slice(0, 2).join(" · ")}</strong></p>}
          <p>{e.venue}{e.city ? ` · ${e.city}` : ""}</p>
          <p>{f.full}</p>
          <p className="price">{e.min_price != null ? `Desde ${(e.min_price / 100).toFixed(2)} €` : "Entradas disponibles"}</p>
        </div>
      </div>
    </a>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; artista?: string }> }) {
  const sp = await searchParams;
  let events = await loadEvents();
  const [popular, st] = await Promise.all([loadPopular(), stats()]);
  if (sp.artista) {
    const q = sp.artista.toLowerCase();
    events = events.filter((e) => e.artists.toLowerCase().includes(q) || e.artist_slugs.toLowerCase().includes(q.replace(/\s+/g, "-")));
  } else {
    if (sp.q) {
      const q = sp.q.toLowerCase();
      events = events.filter((e) => (e.title + e.description + e.city + e.venue).toLowerCase().includes(q));
    }
    if (sp.cat) events = events.filter((e) => e.category === sp.cat);
  }
  const filtering = Boolean(sp.artista || sp.q || sp.cat);
  const featured = events[0];
  return (
    <>
      <section className="hero hero-premium">
        <span className="badge" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>Venta oficial · QR nominativo · Anti-reventa</span>
        <h1>La mejor noche empieza aquí</h1>
        <p>Conciertos, deporte y teatro con entradas oficiales a tu nombre, QR único anti-reventa y acceso sin colas.</p>
        <form action="/">
          <input type="text" name="artista" placeholder="¿A quién quieres ver? Ej. Rosalía…" defaultValue={sp.artista || ""} />
          <input type="text" name="q" placeholder="Evento, recinto o ciudad…" defaultValue={sp.q || ""} />
          <button className="btn" formAction="/">Buscar</button>
        </form>
        <div className="hero-stats">
          <span><strong>{st.events}</strong> eventos</span>
          <span><strong>{st.artists}</strong> artistas</span>
          <span><strong>100%</strong> oficial</span>
        </div>
      </section>

      {sp.artista && (
        <p style={{ marginTop: 18 }}>
          <span className="badge">Artista: {sp.artista}</span> {events.length} eventos · <a href="/">Limpiar</a>
        </p>
      )}

      {!filtering && popular.length > 0 && (
        <>
          <div className="section-title"><h2>Artistas más populares</h2><a href="/artistas">Ver todos</a></div>
          <div className="artist-row">
            {popular.map((a) => (
              <a key={a.slug} className="artist-card" href={`/artistas/${a.slug}`}>
                {a.photo_url
                  ? <img src={a.photo_url} alt={a.name} loading="lazy" />
                  : <div className="artist-fallback">{a.name.slice(0, 1)}</div>}
                <strong>{a.name}</strong>
                <span>{Number(a.n) === 1 ? "1 evento" : `${Number(a.n)} eventos`}</span>
              </a>
            ))}
          </div>
        </>
      )}

      <nav className="catnav">
        <a href="/" className={!sp.cat && !sp.artista ? "active" : ""}>Destacados</a>
        {CATS.map(([v, l]) => <a key={v} href={`/?cat=${v}`} className={sp.cat === v ? "active" : ""}>{l}</a>)}
      </nav>

      {events.length === 0 ? (
        <p className="muted" style={{ marginTop: 20 }}>
          {sp.artista
            ? <>Sin eventos con ese artista por ahora. <a href="/">Ver agenda completa</a>.</>
            : <>Aún no hay eventos publicados. Entra en <a href="/panel">Organizadores</a> y publica el primero.</>}
        </p>
      ) : (
        <>
          {!filtering && (
            <div className="section-title"><h2>Lo más vendido</h2><a href="/eventos">Ver todo</a></div>
          )}
          {filtering && (
            <div className="section-title"><h2>{events.length} resultados</h2><a href="/">Limpiar filtros</a></div>
          )}
          <div className="grid">
            {events.slice(0, 6).map((e) => <Card key={e.slug} e={e} />)}
          </div>
          {events.length > 6 && (
            <>
              <div className="section-title"><h2>Próximamente</h2><a href="/eventos">Agenda completa</a></div>
              <div className="grid">{events.slice(6, 12).map((e) => <Card key={e.slug} e={e} />)}</div>
            </>
          )}
        </>
      )}

      <section className="trust">
        <div><h4>QR nominativo</h4><p>Cada entrada lleva tu nombre y un código único. En puerta se comprueba tu DNI.</p></div>
        <div><h4>Cero reventa</h4><p>El primer escaneo quema la entrada: las copias dejan de funcionar al instante.</p></div>
        <div><h4>Sin colas</h4><p>Validación en segundos por puerta, con registro de cada acceso.</p></div>
        <div><h4>Para organizadores</h4><p>Zonas, precios, promos y panel de ventas en tiempo real. <a href="/registro">Empieza gratis</a>.</p></div>
      </section>
    </>
  );
}
