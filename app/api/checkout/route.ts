import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { baseUrl } from "@/lib/site-url";
import { newTicketCode } from "@/lib/tickets";
import { parseHolders } from "@/lib/holders";
import { normalizeSeat, validSeat } from "@/lib/seats";
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
  let qty = Math.min(50, Math.max(1, Number(form.get("qty") || 1)));
  const promo = String(form.get("promo") || "").toUpperCase().trim();
  if (!eventId || !zoneId || !buyerName || !buyerEmail) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  const sql = getDb();
  // Pack de grupo: fija zona, cantidad y precio cerrado (no combina con promos).
  const packId = String(form.get("packId") || "");
  let pack: Record<string, unknown> | null = null;
  let packZoneId = zoneId;
  let packQty = 0;
  if (packId) {
    const pr = await sql`SELECT * FROM packs WHERE id=${packId} AND event_id=${eventId} AND active=true LIMIT 1`;
    if (!pr[0]) return NextResponse.json({ error: "Pack no disponible" }, { status: 400 });
    if (Number(pr[0].max_uses) > 0 && Number(pr[0].used) >= Number(pr[0].max_uses)) {
      return NextResponse.json({ error: "Pack agotado" }, { status: 400 });
    }
    pack = pr[0] as Record<string, unknown>;
    packZoneId = String(pack.zone_id);
    packQty = Number(pack.qty);
  }
  const zones = await sql`SELECT z.*, e.title, e.status, e.max_per_order, e.max_per_buyer FROM zones z JOIN events e ON e.id=z.event_id WHERE z.id=${packZoneId} AND z.event_id=${eventId} LIMIT 1`;
  if (!zones[0] || zones[0].status !== "published") return NextResponse.json({ error: "Zona no disponible" }, { status: 400 });
  const zoneIdEff = packZoneId;
  if (pack && qty !== packQty) return NextResponse.json({ error: `Este pack es de ${packQty} entradas` }, { status: 400 });
  // Acompañante en zona adaptada: una entrada extra a su nombre (gratis o a precio según evento).
  // Con mapa, su asiento ya va en la selección; sin mapa, se suma uno a la cantidad.
  const companion = String(form.get("companion") || "") === "1" && Boolean(zones[0].accessible);
  const mappedEarly = Number(zones[0].seat_rows) > 0 && Number(zones[0].seat_cols) > 0;
  if (companion && !mappedEarly) qty = Math.min(50, qty + 1);
  const maxOrder = Math.max(1, Number(zones[0].max_per_order ?? 10));
  if (qty > maxOrder) return NextResponse.json({ error: `Máximo ${maxOrder} entradas por compra en este evento` }, { status: 400 });
  if (Number(zones[0].sold) + qty > Number(zones[0].capacity)) return NextResponse.json({ error: "Sin stock suficiente" }, { status: 400 });
  // Tope por comprador y evento (0 = sin límite): frena acaparamiento y reventa.
  const maxBuyer = Number(zones[0].max_per_buyer ?? 0);
  if (maxBuyer > 0) {
    const prev = await sql`SELECT COALESCE(SUM(qty),0) AS n FROM orders WHERE event_id=${eventId} AND buyer_email=${buyerEmail} AND status IN ('pending','paid')`;
    if (Number(prev[0].n) + qty > maxBuyer) {
      return NextResponse.json({ error: `Este email ya tiene ${Number(prev[0].n)} entradas: máximo ${maxBuyer} por persona en este evento` }, { status: 400 });
    }
  }
  let unit = Number(zones[0].price_cents);
  let promoterId: string | null = null;
  let commission = 0;
  if (promo) {
    const p = await sql`SELECT * FROM promo_codes WHERE event_id=${eventId} AND code=${promo} AND active=true LIMIT 1`;
    if (p[0] && (Number(p[0].max_uses) === 0 || Number(p[0].used) < Number(p[0].max_uses))) {
      unit = Math.round(unit * (1 - Number(p[0].pct_off) / 100));
      await sql`UPDATE promo_codes SET used = used + 1 WHERE id=${p[0].id}`;
    } else {
      // Si no es cupón, puede ser código de promotor (descuento + comisión).
      const pr = await sql`SELECT * FROM promoters WHERE event_id=${eventId} AND code=${promo} AND active=true LIMIT 1`;
      if (pr[0]) {
        promoterId = pr[0].id as string;
        unit = Math.round(unit * (1 - Number(pr[0].discount_pct) / 100));
      }
    }
  }
  let total = unit * qty;
  if (companion && zones[0].companion_free) total = Math.max(0, total - unit);
  // Pack: precio cerrado, sin promos ni descuentos combinados.
  if (pack) total = Number(pack.price_cents);
  if (promoterId) {
    const pct = await sql`SELECT commission_pct FROM promoters WHERE id=${promoterId} LIMIT 1`;
    commission = Math.round(total * (Number(pct[0]?.commission_pct || 0) / 100));
  }
  const idem = randomBytes(16).toString("hex");
  const holders = parseHolders(String(form.get("holders") || ""), companion ? Math.max(1, qty - 1) : qty, buyerName);
  if (companion) {
    holders.push({ name: `Acompañante de ${holders[0]?.name || buyerName}`.slice(0, 120), doc: "", seat: "" });
  }
  // Asientos elegidos en el plano (solo zonas numeradas): sustituyen al asiento libre del titular.
  let picked: string[] = [];
  let holdIdUsed = "";
  try {
    const raw = JSON.parse(String(form.get("seats") || "[]"));
    if (Array.isArray(raw)) picked = raw.map((s) => normalizeSeat(String(s))).filter(Boolean);
  } catch { /* sin asientos */ }
  const mapped = Number(zones[0].seat_rows) > 0 && Number(zones[0].seat_cols) > 0;
  if (mapped) {
    // Flujo con reserva: los asientos llegan bloqueados 10 min con holdId.
    const holdId = String(form.get("holdId") || "");
    if (!holdId) return NextResponse.json({ error: "Reserva primero tus asientos en el plano" }, { status: 400 });
    const uniq = [...new Set(picked)].sort();
    if (uniq.length === 0 || uniq.length > maxOrder || qty !== uniq.length) {
      return NextResponse.json({ error: "Asientos inválidos para esta compra" }, { status: 400 });
    }
    if (!uniq.every((s) => validSeat(s, Number(zones[0].seat_rows), Number(zones[0].seat_cols)))) {
      return NextResponse.json({ error: "Asiento fuera del plano" }, { status: 400 });
    }
    await sql`DELETE FROM seat_holds WHERE expires_at < now()`;
    const mine = await sql`SELECT seat FROM seat_holds WHERE hold_id=${holdId} AND zone_id=${zoneIdEff} AND expires_at > now()`;
    const mineSet = mine.map((m) => String(m.seat)).sort();
    if (mineSet.length !== uniq.length || !uniq.every((s, i) => s === mineSet[i])) {
      return NextResponse.json({ error: "Tu reserva caducó o cambió. Elige de nuevo los asientos." }, { status: 410 });
    }
    const busy = await sql`SELECT seat FROM tickets WHERE zone_id=${zoneIdEff} AND seat = ANY(${uniq}) AND status IN ('valid','used')`;
    if (busy.length > 0) return NextResponse.json({ error: `Se vendió mientras reservabas: ${busy.map((b) => String(b.seat)).join(", ")}` }, { status: 409 });
    picked = uniq;
    for (let i = 0; i < qty; i++) holders[i].seat = picked[i];
    // holders viaja con el pedido (también para el webhook de Stripe); la reserva se consume al pagar.
    holdIdUsed = holdId;
  }
  const created = await sql`
    INSERT INTO orders (event_id, zone_id, buyer_name, buyer_email, qty, total_cents, idempotency_key, holders, hold_id, promoter_id, commission_cents, pack_id)
    VALUES (${eventId}, ${zoneIdEff}, ${buyerName}, ${buyerEmail}, ${qty}, ${total}, ${idem}, ${JSON.stringify(holders)}, ${holdIdUsed || null}, ${promoterId}, ${commission}, ${pack ? String(pack.id) : null}) RETURNING id`;
  const orderId = created[0].id as string;
  const appUrl = baseUrl(req);
  const releaseHold = async () => {
    if (holdIdUsed) await sql`DELETE FROM seat_holds WHERE hold_id=${holdIdUsed}`;
  };
  // MODO PRUEBAS: sin Stripe se simula el pago y se emiten los tickets directamente.
  if (!stripeConfigured()) {
    const upd = await sql`
      UPDATE zones SET sold = sold + ${qty}
      WHERE id=${zoneIdEff} AND sold + ${qty} <= capacity RETURNING id`;
    if (!upd[0]) {
      await sql`UPDATE orders SET status='cancelled' WHERE id=${orderId}`;
      await releaseHold();
      return NextResponse.json({ error: "Sin stock suficiente" }, { status: 400 });
    }
    await sql`UPDATE orders SET status='paid' WHERE id=${orderId}`;
    if (pack) await sql`UPDATE packs SET used = used + 1 WHERE id=${String(pack.id)}`;
    try {
      for (let i = 0; i < qty; i++) {
        const seat = mapped ? picked[i] : holders[i].seat;
        await sql`INSERT INTO tickets (order_id, event_id, zone_id, code, holder_name, holder_doc, seat)
          VALUES (${orderId}, ${eventId}, ${zoneIdEff}, ${newTicketCode()}, ${holders[i].name}, ${holders[i].doc}, ${seat})`;
      }
      await releaseHold();
    } catch {
      // Carrera por el mismo asiento (índice único): anula la compra simulada.
      await sql`DELETE FROM tickets WHERE order_id=${orderId}`;
      await sql`UPDATE orders SET status='cancelled' WHERE id=${orderId}`;
      await sql`UPDATE zones SET sold = GREATEST(0, sold - ${qty}) WHERE id=${zoneIdEff}`;
      return NextResponse.json({ error: "Un asiento se ocupó mientras comprabas. Elige otros." }, { status: 409 });
    }
    await sendEmail(
      buyerEmail,
      `Tus entradas (simulado): ${String(zones[0].title)}`,
      `<p>Pago <strong>simulado</strong>, no se ha cargado nada.</p><p>Recupera tus QR en ${appUrl}/mis-entradas con este email.</p>`
    );
    return NextResponse.redirect(`${appUrl}/compra-ok?order=${orderId}`, 303);
  }
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: buyerEmail,
    line_items: [{ price_data: { currency: "eur", product_data: { name: `${zones[0].title} — ${zones[0].name} x${qty}` }, unit_amount: total }, quantity: 1 }],
    success_url: `${appUrl}/compra-ok?order=${orderId}`,
    cancel_url: `${appUrl}/eventos/${encodeURIComponent(String((zones[0] as Record<string, unknown>).slug || ""))}`,
    metadata: { orderId },
  });
  await sql`UPDATE orders SET stripe_session_id=${session.id} WHERE id=${orderId}`;
  return NextResponse.redirect(session.url!, 303);
}
