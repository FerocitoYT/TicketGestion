import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { authSecret } from "@/lib/secret";

// Código público del ticket: TG-XXXXXX + firma HMAC para validar sin DB spoofing.
export function newTicketCode(): string {
  return "TG-" + randomBytes(4).toString("hex").toUpperCase();
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
