import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import ComprarClient from "@/components/comprar-client";

export const dynamic = "force-dynamic";

export default async function ComprarPage({ searchParams }: { searchParams: Promise<{ zone?: string }> }) {
  const sp = await searchParams;
  if (!sp.zone) notFound();
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT z.id, z.name, z.price_cents, z.capacity, z.sold, z.seat_rows, z.seat_cols,
             z.session_id, e.id AS event_id, e.title AS event_title, e.slug AS eslug, e.status,
             e.max_per_order, s.starts_at AS ses_start,
             e.image_url AS poster
      FROM zones z JOIN events e ON e.id=z.event_id LEFT JOIN sessions s ON s.id=z.session_id
      WHERE z.id=${sp.zone} LIMIT 1`;
    if (!rows[0] || rows[0].status !== "published") notFound();
    const z = rows[0];
    const left = Number(z.capacity) - Number(z.sold);
    if (left <= 0) {
      return (<>
        <h1>{String(z.event_title)} — {String(z.name)}</h1>
        <p className="alert err">Zona agotada.</p>
        <h3>Avísame si se libera</h3>
        <form action="/api/lista-espera" method="post" className="form">
          <input type="hidden" name="zoneId" value={String(z.id)} />
          <label>Email<input name="email" type="email" required placeholder="tu@email.com" /></label>
          <label>Entradas<input name="qty" type="number" min={1} max={Number(z.max_per_order ?? 10)} defaultValue={1} /></label>
          <button>Avisarme</button>
        </form>
        <p><a href={`/eventos/${z.eslug}`}>← Volver al evento</a></p>
      </>);
    }
    const k = process.env.STRIPE_SECRET_KEY || "";
    const simulated = !(k.startsWith("sk_") && !k.includes("replace_me"));
    const sesLabel = z.ses_start
      ? new Date(String(z.ses_start)).toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
      : "";
    return (
      <>
        <p className="crumbs"><a href="/">Inicio</a> / {String(z.event_title)} / {String(z.name)}</p>
        <h1>{String(z.event_title)}</h1>
        <p><span className="badge">{String(z.name)} · {(Number(z.price_cents) / 100).toFixed(2)} €</span> {sesLabel && <span className="badge">{sesLabel}</span>} <span className="badge">{left} disponibles</span></p>
        <ComprarClient
          eventId={String(z.event_id)}
          eventTitle={String(z.event_title)}
          zone={{
            id: String(z.id), name: String(z.name), price_cents: Number(z.price_cents),
            capacity: Number(z.capacity), sold: Number(z.sold),
            seat_rows: Number(z.seat_rows), seat_cols: Number(z.seat_cols), session_label: sesLabel,
          }}
          maxOrder={Number(z.max_per_order ?? 10)}
          simulated={simulated}
        />
      </>
    );
  } catch {
    return <p className="muted">No se pudo cargar la compra.</p>;
  }
}
