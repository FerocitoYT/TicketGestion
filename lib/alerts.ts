import { encodeSigned } from "@/lib/auth";

// Token de baja de alertas (enlace por email).
export function alertToken(artistId: string, email: string): string {
  return encodeSigned({ artistId, email });
}
