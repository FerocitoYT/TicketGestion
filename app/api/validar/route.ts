import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { validateScan } from "@/lib/door";

const Schema = z.object({
  payload: z.string().min(3),
  gate: z.string().max(60).optional(),
  eventId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Solo personal: inicia sesión para validar accesos" }, { status: 401 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida (falta evento o QR)" }, { status: 400 });
  const r = await validateScan(
    { userId: s.userId, orgId: s.orgId, role: s.role },
    parsed.data.payload, parsed.data.gate || "", parsed.data.eventId
  );
  return NextResponse.json(r.body, { status: r.status });
}
