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
  return (
    <a className="card" href={`/eventos/${e.slug}`}>
      <div className={`card-art art-${e.category}`}>
        {CAT_LABEL[e.category] || e.category} · {e.city || "Gira nacional"}
      </div>
      <div className="card-body">
        <div className="datebox"><b>{f.day}</b><span>{f.mon}</span></div>
        <div>
          <h3>{e.title}</h3>
          <p>{e.venue}{e.city ? ` · ${e.city}` : ""}</p>
          <p>{f.full}</p>
          <p className="price">{e.min_price != null ? `Desde ${(e.min_price / 100).toFixed(2)} €` : "Entradas disponibles"}</p>
        </div>
      </div>
    </a>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const sp = await searchParams;
  let events = await load();
  if (sp.q) {
    const q = sp.q.toLowerCase();
    events = events.filter((e) => (e.title + e.description + e.city + e.venue).toLowerCase().includes(q));
  }
  if (sp.cat) events = events.filter((e) => e.category === sp.cat);
  const featured = events[0];
  const rest = events.slice(1);
  return (
    <>
      <section className="hero">
        <span className="badge" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>Venta oficial · QR nominativo · Anti-reventa</span>
        <h1>No te pierdas nada: conciertos, deporte y teatro</h1>
        <p>Entradas oficiales con tu nombre, QR único anti-reventa y acceso sin colas. Organizadores: publica tu evento hoy.</p>
        <form action="/eventos">
          <input type="text" name="q" placeholder="Artista, equipo, festival, recinto…" defaultValue={sp.q || ""} />
          <select name="cat" defaultValue={sp.cat || ""}>
            <option value="">Toda España</option>
            {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn" formAction="/eventos">Buscar entradas</button>
        </form>
        <div className="row" style={{ marginTop: 14 }}>
          <a className="btn btn-light" href="/eventos">Ver agenda</a>
          <a className="btn btn-ghost" href="/panel">Organiza tu evento</a>
        </div>
      </section>

      <nav className="catnav">
        <a href="/" className={!sp.cat ? "active" : ""}>Destacados</a>
        {CATS.map(([v, l]) => <a key={v} href={`/?cat=${v}`} className={sp.cat === v ? "active" : ""}>{l}</a>)}
      </nav>

      {events.length === 0 ? (
        <p className="muted" style={{ marginTop: 20 }}>Aún no hay eventos publicados. Entra en <a href="/panel">Organizadores</a> y publica el primero.</p>
      ) : (
        <>
          {featured && !sp.q && !sp.cat && (
            <div className="section-title"><h2>Lo más vendido</h2><a href="/eventos">Ver todo</a></div>
          )}
          <div className="grid">
            {(sp.q || sp.cat ? events : rest.length ? [featured, ...rest.slice(0, 5)] : [featured]).map((e) => <Card key={e.slug} e={e} />)}
          </div>
          {!sp.q && !sp.cat && rest.length > 5 && (
            <>
              <div className="section-title"><h2>Próximamente</h2><a href="/eventos">Agenda completa</a></div>
              <div className="grid">{rest.slice(5, 11).map((e) => <Card key={e.slug} e={e} />)}</div>
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
