export function authSecret(): string {
  const s = process.env.AUTH_SECRET || "";
  if (s.length < 32) throw new Error("AUTH_SECRET must be at least 32 chars");
  return s;
}
