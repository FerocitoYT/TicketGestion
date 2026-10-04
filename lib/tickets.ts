import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { authSecret } from "@/lib/secret";

// Código público del ticket: 8 caracteres estilo F8CL34RS (sin 0/O/1/I para evitar confusión en puerta)
// + firma HMAC en el QR para detectar falsificaciones sin depender solo de la DB.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newTicketCode(): string {
  const b = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[b[i] % ALPHABET.length];
  return code;
}
export function signTicket(code: string): string {
  return createHmac("sha256", authSecret()).update(`ticket|${code}`).digest("base64url").slice(0, 16);
}
export function ticketQrPayload(code: string): string {
  return `${code}.${signTicket(code)}`;
}
export function verifyTicketPayload(payload: string): string | null {
  const [code, sig] = payload.trim().split(".");
  if (!code || !sig) return null;
  const exp = signTicket(code);
  const a = Buffer.from(sig);
  const b = Buffer.from(exp);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return code;
}
