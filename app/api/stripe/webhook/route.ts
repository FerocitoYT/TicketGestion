import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { baseUrl } from "@/lib/site-url";
import { newTicketCode } from "@/lib/tickets";
import { sendEmail } from "@/lib/email";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") || "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const raw = await req.text();
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = secret
      ? (getStripe().webhooks.constructEvent(raw, sig, secret) as unknown as typeof event)
      : (JSON.parse(raw) as typeof event);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  const sql = getDb();
  if (event.type === "checkout.session.completed") {
    const obj = event.data.object;
    const orderId = String((obj.metadata as Record<string, string> | undefined)?.orderId || "");
    if (!orderId) return NextResponse.json({ ok: true });
    // Reserva atómica de stock + emite tickets (idempotente por estado)
    const orders = await sql`SELECT * FROM orders WHERE id=${orderId} LIMIT 1`;
    const order = orders[0] as Record<string, unknown> | undefined;
    if (!order || order.status !== "pending") return NextResponse.json({ ok: true });
    const upd = await sql`
      UPDATE zones SET sold = sold + ${Number(order.qty)}
      WHERE id=${String(order.zone_id)} AND sold + ${Number(order.qty)} <= capacity RETURNING id`;
    if (!upd[0]) {
      await sql`UPDATE orders SET status='cancelled' WHERE id=${orderId}`;
      return NextResponse.json({ ok: true });
    }
    await sql`UPDATE orders SET status='paid' WHERE id=${orderId}`;
    const holders = (Array.isArray(order.holders) ? order.holders : []) as { name?: string; doc?: string; seat?: string }[];
    for (let i = 0; i < Number(order.qty); i++) {
      await sql`INSERT INTO tickets (order_id, event_id, zone_id, code, holder_name, holder_doc, seat)
        VALUES (${orderId}, ${String(order.event_id)}, ${String(order.zone_id)}, ${newTicketCode()}, ${String(holders[i]?.name || order.buyer_name)}, ${String(holders[i]?.doc || "")}, ${String(holders[i]?.seat || "")})`;
    }
    if (order.hold_id) await sql`DELETE FROM seat_holds WHERE hold_id=${String(order.hold_id)}`;
    if (order.pack_id) await sql`UPDATE packs SET used = used + 1 WHERE id=${String(order.pack_id)}`;
    const ev = await sql`SELECT title FROM events WHERE id=${String(order.event_id)} LIMIT 1`;
    const appUrl = baseUrl(req);
    await sendEmail(
      String(order.buyer_email),
      `Tus entradas: ${String(ev[0]?.title || "evento")}`,
      `<p>Hola ${String(order.buyer_name)},</p><p>Tu compra (${String(order.qty)} entradas) está confirmada.</p><p>Recupera tus QR en <a href="${appUrl}/mis-entradas">Mis entradas</a> con este email.</p>`
    );
  }
  if (event.type === "charge.refunded") {
    const obj = event.data.object as { payment_intent?: string };
    // Marca básica: se concilia por panel con Stripe dashboard en MVP
    console.log("charge.refunded", obj.payment_intent);
  }
  return NextResponse.json({ ok: true });
}
