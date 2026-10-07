import { getDb } from "@/lib/db";

export default async function GalleryBlock({ eventId }: { eventId: string }) {
  const sql = getDb();
  const photos = await sql`SELECT * FROM event_gallery WHERE event_id=${eventId} ORDER BY created_at ASC`;
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))" }}>
        {photos.map((p) => (
          <div key={String(p.id)} className="card" style={{ padding: 6 }}>
            <img src={String(p.image_url)} alt={String(p.caption || "")} style={{ width: "100%", borderRadius: 8 }} />
            <form action="/api/panel/gallery/delete" method="post">
              <input type="hidden" name="id" value={String(p.id)} /><input type="hidden" name="eventId" value={eventId} />
              <button className="btn-ghost" style={{ marginTop: 4 }}>Quitar</button>
            </form>
          </div>
        ))}
      </div>
      {photos.length === 0 && <p className="muted">Sin fotos todavía.</p>}
      <form action="/api/panel/gallery" method="post" encType="multipart/form-data" className="form" style={{ marginTop: 10 }}>
        <input type="hidden" name="eventId" value={eventId} />
        <div className="row">
          <input name="file" type="file" accept="image/jpeg,image/png,image/webp" />
          <input name="caption" placeholder="Pie de foto / o URL…" />
        </div>
        <div className="row">
          <input name="imageUrl" placeholder="https://… (alternativa al archivo)" />
        </div>
        <button formAction="/api/panel/gallery">Añadir foto</button>
      </form>
    </>
  );
}
