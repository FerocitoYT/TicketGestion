import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TicketGestion — Entradas para conciertos y deporte",
  description: "Compra entradas y gestiona el acceso a eventos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="topbar">
          <a className="brand" href="/">TicketGestion</a>
          <nav>
            <a href="/eventos">Eventos</a>
            <a href="/mis-entradas">Mis entradas</a>
            <a href="/panel">Organizadores</a>
            <a href="/validar" className="btn-small">Validar acceso</a>
          </nav>
        </header>
        <main className="wrap">{children}</main>
        <footer className="foot">TicketGestion · Conciertos · Deporte · Teatro · Festivales</footer>
      </body>
    </html>
  );
}
