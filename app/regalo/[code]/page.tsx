import { getDb } from "@/lib/db";
import ActivarRegalo from "@/components/activar-regalo";

export const dynamic = "force-dynamic";

// Página pública (sin login): quien recibe el regalo la activa con sus datos.
export default async function RegaloPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let info: { event: string; status: string } | null = null;
  try {
    const sql = getDb();
    const rows = await sql`SELECT e.title AS event, t.status FROM tickets t JOIN events e ON e.id=t.event_id
      WHERE t.code=${code.toUpperCase()} AND t.is_gift=true LIMIT 1`;
    if (rows[0]) info = { event: String(rows[0].event), status: String(rows[0].status) };
  } catch { /* noop */ }
  return (
    <>
      <p className="crumbs"><a href="/">Inicio</a> / Regalo</p>
      <h1>Te han regalado una entrada</h1>
      {info ? (
        <p>Para <strong>{info.event}</strong>. Actívala con tu nombre y DNI: en puerta lo comprobarán.</p>
      ) : (
        <p className="muted">Escribe el código de tu regalo para activarlo a tu nombre.</p>
      )}
      <ActivarRegalo code0={code.toUpperCase()} />
    </>
  );
}
