import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type EventRow = {
  title: string; slug: string; description: string; category: string;
  starts_at: string; city: string; venue: string; min_price: number | null;
};

async function load(): Promise<EventRow[]> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT e.title, e.slug, e.description, e.category, e.starts_at,
             COALESCE(v.city,'') AS city, COALESCE(v.name,'') AS venue,
             (SELECT MIN(price_cents) FROM zones z WHERE z.event_id = e.id) AS min_price
      FROM events e LEFT JOIN venues v ON v.id = e.venue_id
      WHERE e.status='published' ORDER BY e.starts_at ASC LIMIT 60`;
    return rows as unknown as EventRow[];
  } catch {
    return [];
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const sp = await searchParams;
  let events = await load();
  if (sp.q) {
    const q = sp.q.toLowerCase();
    events = events.filter((e) => (e.title + e.description + e.city + e.venue).toLowerCase().includes(q));
  }
  if (sp.cat) events = events.filter((e) => e.category === sp.cat);
  return (
    <>
      <section className="hero">
        <h1>Entradas para conciertos, deporte y más</h1>
        <p>Compra en segundos, recibe tu QR y accede sin colas. Organizadores: crea eventos, vende por zonas y valida en puerta.</p>
        <form className="row" action="/">
          <input name="q" placeholder="Busca artista, equipo, recinto…" defaultValue={sp.q || ""} style={{ maxWidth: 320 }} />
          <select name="cat" defaultValue={sp.cat || ""} style={{ maxWidth: 200 }}>
            <option value="">Todas las categorías</option>
            <option value="concierto">Conciertos</option>
            <option value="deporte">Deporte</option>
            <option value="teatro">Teatro</option>
            <option value="festival">Festivales</option>
            <option value="otros">Otros</option>
          </select>
          <button>Buscar</button>
          <a className="btn btn-ghost" href="/panel">Crear evento</a>
        </form>
      </section>
      {events.length === 0 ? (
        <p className="muted">Aún no hay eventos publicados. Configura DATABASE_URL y publica el primero desde /panel.</p>
      ) : (
        <div className="grid">
          {events.map((e) => (
            <a key={e.slug} className="card" href={`/eventos/${e.slug}`}>
              <span className="badge">{e.category} · {new Date(e.starts_at).toLocaleDateString("es-ES")}</span>
              <h3>{e.title}</h3>
              <p className="muted">{e.venue}{e.city ? ` · ${e.city}` : ""}</p>
              <p>{e.min_price != null ? `Desde ${(e.min_price / 100).toFixed(2)} €` : "Precio por definir"}</p>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
