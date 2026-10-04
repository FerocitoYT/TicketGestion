import { siteUrl } from "@/lib/stripe";

// URL pública real de la petición (Vercel, preview o local).
// Usa las cabeceras del proxy en vez de NEXT_PUBLIC_APP_URL para no redirigir a localhost en producción.
export function baseUrl(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.trim();
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${proto}://${host}`.replace(/\/+$/, "");
  }
  return siteUrl();
}
