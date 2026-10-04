import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { searchAttractions } from "@/lib/tm";

export async function GET(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q") || "";
  if (q.trim().length < 2) return NextResponse.json({ attractions: [] });
  return NextResponse.json(await searchAttractions(q.trim()));
}
