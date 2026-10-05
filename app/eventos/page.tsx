import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const CATS: [string, string][] = [
  ["concierto", "Conciertos"],
  ["deporte", "Deportes"],
  ["teatro", "Teatro"],
  ["festival", "Festivales"],
  ["otros", "Más planes"],
];

export default async function Eventos({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const sp = await searchParams;
  let events: { title: string; slug: string; description: string; category: string; starts_at: string; city: string; venue: string; min_price: number | null; poster: string }[] = [];
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT e.title, e.slug, e.description, e.category, e.starts_at, e.image_url AS poster,
             COALESCE(v.city,'') AS city, COALESCE(v.name,'') AS venue,
             (SELECT MIN(price_cents) FROM zones z WHERE z.event_id = e.id) AS min_price
      FROM events e LEFT JOIN venues v ON v.id = e.venue_id
      WHERE e.status='published' ORDER BY e.starts_at ASC LIMIT 120`;
    events = rows as unknown as typeof events;
  } catch {
    return <p className="muted">Configura DATABASE_URL para ver la agenda.</p>;
  }
  if (sp.q) {
    const q = sp.q.toLowerCase();
    events = events.filter((e) => (e.title + e.description + e.city + e.venue).toLowerCase().includes(q));
  }
  if (sp.cat) events = events.filter((e) => e.category === sp.cat);
  return (
    <>
      <p className="crumbs"><a href="/">Inicio</a> / Agenda</p>
      <h1>Agenda de eventos</h1>
      <form className="row" action="/eventos">
        <input name="q" placeholder="Busca…" defaultValue={sp.q || ""} style={{ maxWidth: 300 }} />
        <select name="cat" defaultValue={sp.cat || ""} style={{ maxWidth: 220 }}>
          <option value="">Todas las categorías</option>
          {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn btn-blue">Filtrar</button>
      </form>
      <p className="muted">{events.length} eventos encontrados</p>
      <div className="grid">
        {events.map((e) => {
          const dt = new Date(e.starts_at);
          return (
            <a key={e.slug} className="card" href={`/eventos/${e.slug}`}>
              <div className={`card-art art-${e.category}`} style={e.poster ? { backgroundImage: `url(${e.poster})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                {!e.poster && <>{e.category} · {e.city || "Gira"}</>}
              </div>
              <div className="card-body">
                <div className="datebox">
                  <b>{dt.getDate().toString().padStart(2, "0")}</b>
                  <span>{dt.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")}</span>
                </div>
                <div>
                  <h3>{e.title}</h3>
                  <p>{e.venue}{e.city ? ` · ${e.city}` : ""}</p>
                  <p className="price">{e.min_price != null ? `Desde ${(e.min_price / 100).toFixed(2)} €` : "Disponible"}</p>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}
