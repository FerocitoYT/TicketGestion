import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function CompraOk({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  if (!order) return <p>Falta el pedido.</p>;
  try {
    const sql = getDb();
    const rows = await sql`SELECT o.*, e.title FROM orders o JOIN events e ON e.id=o.event_id WHERE o.id=${order} LIMIT 1`;
    if (!rows[0]) return <p>Pedido no encontrado.</p>;
    const o = rows[0];
    return (
      <>
        <h1>{o.status === "paid" ? "¡Pago confirmado!" : "Procesando pago…"}</h1>
        <p className="muted">{String(o.title)} · {String(o.qty)} entradas · {(Number(o.total_cents) / 100).toFixed(2)} €</p>
        {o.status === "paid"
          ? <><p>Te enviamos un email con el acceso a tus QR.</p><a className="btn" href="/mis-entradas">Ver mis entradas</a></>
          : <p className="muted">Stripe está confirmando el pago vía webhook. Recarga en unos segundos.</p>}
      </>
    );
  } catch {
    return <p className="muted">No se pudo cargar el pedido.</p>;
  }
}
