import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { validateScan } from "@/lib/door";

// Sincroniza la cola offline: revalida cada escaneo en servidor (manda asignación,
// ventana y anti-doble-uso reales; el offline era provisional).
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Login requerido" }, { status: 401 });
  const b = z.object({
    items: z.array(z.object({ payload: z.string().min(3), at: z.string().max(40).optional() })).max(2000),
  }).safeParse(await req.json());
  if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const user = { userId: s.userId, orgId: s.orgId, role: s.role };
  const results = [];
  for (const it of b.data.items) {
    try {
      const r = await validateScan(user, it.payload, "offline-sync");
      results.push({ payload: it.payload, status: r.status, ok: r.status === 200, detail: (r.body.error as string) || "ok" });
    } catch {
      results.push({ payload: it.payload, status: 500, ok: false, detail: "error" });
    }
  }
  const ok = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, synced: results.length, confirmed: ok, results });
}
