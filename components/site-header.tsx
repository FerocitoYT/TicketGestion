"use client";
import { useState } from "react";

const CATS: [string, string][] = [
  ["concierto", "Conciertos"],
  ["deporte", "Deportes"],
  ["teatro", "Teatro"],
  ["festival", "Festivales"],
  ["otros", "Más planes"],
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="topbar">
        <button className="burger" aria-label="Abrir menú" onClick={() => setOpen(true)}>☰</button>
        <a className="brand" href="/">Ticket<span>Gestion</span></a>
        <form className="searchbar" action="/eventos">
          <input name="q" placeholder="Busca artista, equipo o recinto…" />
          <button>Buscar</button>
        </form>
        <div className="spacer" />
        <nav className="desk">
          {CATS.slice(0, 3).map(([v, l]) => (
            <a key={v} href={`/eventos?cat=${v}`}>{l}</a>
          ))}
          <a href="/mis-entradas">Mis entradas</a>
          <a href="/panel">Vende con nosotros</a>
          <a href="/validar" className="btn-small">Acceso personal</a>
        </nav>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`drawer ${open ? "open" : ""}`}>
        <div className="drawer-head">
          <span className="brand" style={{ color: "var(--tm-blue)" }}>Ticket<span>Gestion</span></span>
          <button className="burger burger-dark" aria-label="Cerrar menú" onClick={() => setOpen(false)}>✕</button>
        </div>
        <p className="drawer-sec">Explorar</p>
        <a href="/eventos" onClick={() => setOpen(false)}>Toda la agenda</a>
        {CATS.map(([v, l]) => (
          <a key={v} href={`/eventos?cat=${v}`} onClick={() => setOpen(false)}>{l}</a>
        ))}
        <p className="drawer-sec">Mis entradas</p>
        <a href="/mis-entradas" onClick={() => setOpen(false)}>Recuperar mis QR</a>
        <p className="drawer-sec">Organizadores</p>
        <a href="/panel" onClick={() => setOpen(false)}>Panel de ventas</a>
        <a href="/registro" onClick={() => setOpen(false)}>Crear cuenta</a>
        <a href="/login" onClick={() => setOpen(false)}>Entrar</a>
        <p className="drawer-sec">Personal</p>
        <a href="/validar" onClick={() => setOpen(false)}>Control de acceso</a>
      </aside>
    </>
  );
}
