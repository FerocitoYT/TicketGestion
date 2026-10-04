import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Artistas({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  let artists: { name: string; slug: string; photo_url: string; genre: string; n: number }[] = [];
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT a.name, a.slug, a.photo_url, a.genre, COUNT(ea.event_id) AS n
      FROM artists a LEFT JOIN event_artists ea ON ea.artist_id=a.id
      LEFT JOIN events e ON e.id=ea.event_id AND e.status='published'
      GROUP BY a.id ORDER BY a.name ASC LIMIT 200`;
    artists = rows as unknown as typeof artists;
  } catch {
    return <p className="muted">Configura DATABASE_URL para ver artistas.</p>;
  }
  if (sp.q) {
    const q = sp.q.toLowerCase();
    artists = artists.filter((a) => a.name.toLowerCase().includes(q));
  }
  return (
    <>
      <p className="crumbs"><a href="/">Inicio</a> / Artistas</p>
      <h1>Artistas</h1>
      <form className="row" action="/artistas">
        <input name="q" placeholder="Busca artista…" defaultValue={sp.q || ""} style={{ maxWidth: 300 }} />
        <button className="btn btn-blue">Buscar</button>
      </form>
      <div className="grid">
        {artists.map((a) => (
          <a key={a.slug} className="card" href={`/artistas/${a.slug}`}>
            <div className="card-art art-concierto" style={a.photo_url ? { backgroundImage: `url(${a.photo_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
              {!a.photo_url && (a.genre || "Artista")}
            </div>
            <div className="card-body">
              <div>
                <h3>{a.name}</h3>
                <p>{a.genre}</p>
                <p className="price">{Number(a.n) === 1 ? "1 evento" : `${Number(a.n)} eventos`}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
      {artists.length === 0 && <p className="muted">Aún no hay artistas. Los organizadores los vinculan desde el panel.</p>}
    </>
  );
}
