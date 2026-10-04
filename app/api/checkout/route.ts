import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { getStripe, siteUrl } from "@/lib/stripe";
import { newTicketCode } from "@/lib/tickets";
import { sendEmail } from "@/lib/email";

function stripeConfigured() {
  const k = process.env.STRIPE_SECRET_KEY || "";
  return k.startsWith("sk_") && !k.includes("replace_me");
}

export async function POST(req: Request) {
  const form = await req.formData();
  const eventId = String(form.get("eventId") || "");
  const zoneId = String(form.get("zoneId") || "");
  const buyerName = String(form.get("buyerName") || "").slice(0, 120);
  const buyerEmail = String(form.get("buyerEmail") || "").toLowerCase().slice(0, 160);
  const qty = Math.min(10, Math.max(1, Number(form.get("qty") || 1)));
  const promo = String(form.get("promo") || "").toUpperCase().trim();
  if (!eventId || !zoneId || !buyerName || !buyerEmail) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  const sql = getDb();
  const zones = await sql`SELECT z.*, e.title, e.status FROM zones z JOIN events e ON e.id=z.event_id WHERE z.id=${zoneId} AND z.event_id=${eventId} LIMIT 1`;
  if (!zones[0] || zones[0].status !== "published") return NextResponse.json({ error: "Zona no disponible" }, { status: 400 });
  if (Number(zones[0].sold) + qty > Number(zones[0].capacity)) return NextResponse.json({ error: "Sin stock suficiente" }, { status: 400 });
  let unit = Number(zones[0].price_cents);
  if (promo) {
    const p = await sql`SELECT * FROM promo_codes WHERE event_id=${eventId} AND code=${promo} AND active=true LIMIT 1`;
    if (p[0] && (Number(p[0].max_uses) === 0 || Number(p[0].used) < Number(p[0].max_uses))) {
      unit = Math.round(unit * (1 - Number(p[0].pct_off) / 100));
      await sql`UPDATE promo_codes SET used = used + 1 WHERE id=${p[0].id}`;
    }
  }
  const total = unit * qty;
  const idem = randomBytes(16).toString("hex");
  const created = await sql`
    INSERT INTO orders (event_id, zone_id, buyer_name, buyer_email, qty, total_cents, idempotency_key)
    VALUES (${eventId}, ${zoneId}, ${buyerName}, ${buyerEmail}, ${qty}, ${total}, ${idem}) RETURNING id`;
  const orderId = created[0].id as string;
  // MODO PRUEBAS: sin Stripe se simula el pago y se emiten los tickets directamente.
  if (!stripeConfigured()) {
    const upd = await sql`
      UPDATE zones SET sold = sold + ${qty}
      WHERE id=${zoneId} AND sold + ${qty} <= capacity RETURNING id`;
    if (!upd[0]) {
      await sql`UPDATE orders SET status='cancelled' WHERE id=${orderId}`;
      return NextResponse.json({ error: "Sin stock suficiente" }, { status: 400 });
    }
    await sql`UPDATE orders SET status='paid' WHERE id=${orderId}`;
    for (let i = 0; i < qty; i++) {
      await sql`INSERT INTO tickets (order_id, event_id, zone_id, code, holder_name)
        VALUES (${orderId}, ${eventId}, ${zoneId}, ${newTicketCode()}, ${buyerName})`;
    }
    await sendEmail(
      buyerEmail,
      `Tus entradas (simulado): ${String(zones[0].title)}`,
      `<p>Pago <strong>simulado</strong>, no se ha cargado nada.</p><p>Recupera tus QR en ${siteUrl()}/mis-entradas con este email.</p>`
    );
    return NextResponse.redirect(`${siteUrl()}/compra-ok?order=${orderId}`, 303);
  }
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: buyerEmail,
    line_items: [{ price_data: { currency: "eur", product_data: { name: `${zones[0].title} — ${zones[0].name} x${qty}` }, unit_amount: total }, quantity: 1 }],
    success_url: `${siteUrl()}/compra-ok?order=${orderId}`,
    cancel_url: `${siteUrl()}/eventos/${encodeURIComponent(String((zones[0] as Record<string, unknown>).slug || ""))}`,
    metadata: { orderId },
  });
  await sql`UPDATE orders SET stripe_session_id=${session.id} WHERE id=${orderId}`;
  return NextResponse.redirect(session.url!, 303);
}
