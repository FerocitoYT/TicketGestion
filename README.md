# TicketGestion

Plataforma de gestión de acceso a eventos (conciertos, deportes, teatro, festivales) estilo Ticketmaster.

## MVP

- **Público**: landing + catálogo, detalle de evento con zonas/precios, checkout con Stripe, ticket con QR, "Mis entradas" por email.
- **Organizador**: registro + organización, CRUD recintos/eventos/zonas, códigos promo, ventas, reembolsos.
- **Acceso**: validación de QR (`/validar`), anti-doble-uso transaccional, registro por puerta, historial de escaneos.

## Desarrollo

```bash
npm install
cp .env.example .env.local
npm run dev
```

Aplica `db/migrations/001_core.sql` en Neon.

## Pagos

- Checkout con Stripe Checkout Sessions. Webhook: `checkout.session.completed` + `charge.refunded`.
- Cada ticket tiene código `TG-XXXXXXXX` firmado HMAC (`lib/tickets.ts`).

## Emails

Resend para confirmación con QR. Sin API key hace mock en logs.
