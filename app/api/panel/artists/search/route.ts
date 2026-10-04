import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { searchArtistsSpain } from "@/lib/musicbrainz";

export async function GET(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q") || "";
  if (q.trim().length < 2) return NextResponse.json({ artists: [] });
  return NextResponse.json(await searchArtistsSpain(q.trim()));
}
