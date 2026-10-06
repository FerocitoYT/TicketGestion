import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import Votar from "@/components/votar";

export const dynamic = "force-dynamic";

export default async function EncuestaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const sql = getDb();
    const rows = await sql`SELECT e.title, e.slug, s.question, s.active,
      (SELECT COUNT(*) FROM survey_votes v WHERE v.survey_id=s.id) AS votes,
      (SELECT COALESCE(AVG(rating),0) FROM survey_votes v WHERE v.survey_id=s.id) AS avg
      FROM events e LEFT JOIN surveys s ON s.event_id=e.id
      WHERE e.slug=${slug} AND e.status='published' LIMIT 1`;
    if (!rows[0]) notFound();
    const ev = rows[0];
    return (
      <>
        <p className="crumbs"><a href="/">Inicio</a> / Encuesta</p>
        <h1>{String(ev.title)}: tu opinión</h1>
        {ev.active ? (
          <>
            <p className="muted">{String(ev.question || "¿Cómo valorarías este evento?")}</p>
            {Number(ev.votes) > 0 && (
              <p><span className="badge">Media: {Number(ev.avg).toFixed(1)}/5 con {String(ev.votes)} votos</span></p>
            )}
            <Votar code0="" />
          </>
        ) : (
          <p className="muted">Este evento aún no tiene encuesta activa.</p>
        )}
      </>
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_NOT_FOUND")) throw e;
    return <p className="muted">No se pudo cargar la encuesta.</p>;
  }
}
