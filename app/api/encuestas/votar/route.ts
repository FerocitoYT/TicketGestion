import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

// Vota con el código de una entrada del evento (vale usada o válida: ya asistió o asistirá).
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!(await checkRateLimit(`vote:${ip}`, 20, 600))) {
    return NextResponse.json({ error: "Demasiados votos, espera unos minutos" }, { status: 429 });
  }
  const b = z.object({
    code: z.string().trim().min(4).max(32),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(500).optional().default(""),
  }).safeParse(await req.json());
  if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const sql = getDb();
  const rows = await sql`
    SELECT t.id AS ticket_id, t.status, e.id AS event_id, s.id AS survey_id, s.active, s.question
    FROM tickets t JOIN events e ON e.id=t.event_id LEFT JOIN surveys s ON s.event_id=e.id AND s.active=true
    WHERE t.code=${b.data.code.toUpperCase()} LIMIT 1`;
  const t = rows[0];
  if (!t) return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });
  if (!t.survey_id) return NextResponse.json({ error: "Este evento no tiene encuesta activa" }, { status: 400 });
  if (t.status !== "valid" && t.status !== "used") {
    return NextResponse.json({ error: "Entrada no válida para votar" }, { status: 409 });
  }
  try {
    await sql`INSERT INTO survey_votes (survey_id, ticket_id, rating, comment)
      VALUES (${t.survey_id}, ${t.ticket_id}, ${b.data.rating}, ${b.data.comment})`;
  } catch {
    return NextResponse.json({ error: "Esta entrada ya votó. Gracias." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
