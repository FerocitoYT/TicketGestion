import { getDb } from "@/lib/db";

export default async function SurveyBlock({ eventId }: { eventId: string }) {
  const sql = getDb();
  const ev = await sql`SELECT slug FROM events WHERE id=${eventId} LIMIT 1`;
  const slug = ev[0] ? String(ev[0].slug) : "";
  const s = await sql`SELECT * FROM surveys WHERE event_id=${eventId} LIMIT 1`;
  const survey = s[0];
  let avg = "0", total = "0", dist: { rating: number; n: string }[] = [], comments: { rating: number; comment: string; created_at: string }[] = [];
  if (survey) {
    const st = await sql`SELECT COALESCE(AVG(rating),0) AS avg, COUNT(*) AS n FROM survey_votes WHERE survey_id=${survey.id}`;
    avg = Number(st[0]?.avg || 0).toFixed(1);
    total = String(st[0]?.n || 0);
    const d = await sql`SELECT rating, COUNT(*) AS n FROM survey_votes WHERE survey_id=${survey.id} GROUP BY rating ORDER BY rating DESC`;
    dist = d as unknown as typeof dist;
    const c = await sql`SELECT rating, comment, created_at FROM survey_votes WHERE survey_id=${survey.id} AND comment <> '' ORDER BY created_at DESC LIMIT 50`;
    comments = c as unknown as typeof comments;
  }
  return (
    <>
      <form action="/api/panel/surveys" method="post" className="form">
        <input type="hidden" name="eventId" value={eventId} />
        <div className="row">
          <input name="question" defaultValue={survey ? String(survey.question) : "¿Cómo valorarías este evento?"} maxLength={200} style={{ flex: 2 }} />
          <select name="active" defaultValue={survey && !survey.active ? "0" : "1"} style={{ maxWidth: 160 }}>
            <option value="1">Activa</option>
            <option value="0">Pausada</option>
          </select>
        </div>
        <button formAction="/api/panel/surveys">Guardar encuesta</button>
      </form>
      {survey && (
        <>
          <p className="muted" style={{ marginTop: 10 }}>Media: <strong>{avg}/5</strong> con {total} votos · {slug && <a href={`/encuestas/${slug}`}>Ver página de voto</a>}</p>
          <div className="row">
            {dist.map((x) => (
              <span key={x.rating} className="badge">{"★".repeat(x.rating)}: {String(x.n)}</span>
            ))}
          </div>
          {comments.map((c, i) => (
            <p key={i} className="muted">{"★".repeat(c.rating)} — {c.comment} <small>({new Date(String(c.created_at)).toLocaleDateString("es-ES")})</small></p>
          ))}
        </>
      )}
    </>
  );
}
