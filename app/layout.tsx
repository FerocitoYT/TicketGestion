import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "TicketGestion — Entradas para conciertos, deporte y teatro",
  description: "Compra entradas oficiales para conciertos, deporte, teatro y festivales. QR nominativo y acceso sin colas.",
};

const CATS = [
  ["concierto", "Conciertos"],
  ["deporte", "Deportes"],
  ["teatro", "Teatro"],
  ["festival", "Festivales"],
  ["otros", "Más planes"],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <SiteHeader />
        <main className="wrap">{children}</main>
        <footer className="foot">
          <div>
            <strong>TicketGestion</strong>
            <a href="/eventos">Todos los eventos</a>
            <a href="/mis-entradas">Mis entradas</a>
            <a href="/validar">Control de acceso</a>
          </div>
          <div>
            <strong>Categorías</strong>
            {CATS.map(([v, l]) => (
              <a key={v} href={`/eventos?cat=${v}`}>{l}</a>
            ))}
          </div>
          <div>
            <strong>Organizadores</strong>
            <a href="/registro">Crea tu cuenta</a>
            <a href="/panel">Panel de ventas</a>
            <a href="/login">Entrar</a>
          </div>
          <div>
            <strong>Confianza</strong>
            <a href="/mis-entradas">Entradas nominativas</a>
            <a href="/validar">Anti-reventa en puerta</a>
            <a href="/eventos">Compra oficial</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
