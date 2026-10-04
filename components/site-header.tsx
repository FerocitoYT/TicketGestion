"use client";
import { useEffect, useState } from "react";

const CATS: [string, string][] = [
  ["concierto", "Conciertos"],
  ["deporte", "Deportes"],
  ["teatro", "Teatro"],
  ["festival", "Festivales"],
  ["otros", "Más planes"],
];

type Me = { name: string; email: string; role: string } | null;

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((j) => setMe(j.user)).catch(() => {});
  }, []);
  const role = me?.role;
  const isStaff = role === "owner" || role === "staff";
  const isScanner = role === "scanner" || isStaff;
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
          {!isScanner && <a href="/mis-entradas">Mis entradas</a>}
          {isScanner && <a href="/validar">Validar</a>}
          {isScanner && <a href="/mis-registros">Mis registros</a>}
          {isStaff && <a href="/panel">Panel</a>}
          {!me && <a href="/panel">Vende con nosotros</a>}
          {!me && <a href="/validar" className="btn-small">Acceso personal</a>}
          {me && <span style={{ color: "#fff", fontSize: 14, opacity: 0.9 }}>{me.name}</span>}
        </nav>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`drawer ${open ? "open" : ""}`}>
        <div className="drawer-head">
          <span className="brand" style={{ color: "var(--tm-blue)" }}>Ticket<span>Gestion</span></span>
          <button className="burger burger-dark" aria-label="Cerrar menú" onClick={() => setOpen(false)}>✕</button>
        </div>
        {me && <p className="drawer-sec">{me.name} · {role === "owner" ? "Propietario" : role === "staff" ? "Equipo" : "Puerta"}</p>}
        <p className="drawer-sec">Explorar</p>
        <a href="/eventos" onClick={() => setOpen(false)}>Toda la agenda</a>
        {CATS.map(([v, l]) => (
          <a key={v} href={`/eventos?cat=${v}`} onClick={() => setOpen(false)}>{l}</a>
        ))}
        {isScanner && (
          <>
            <p className="drawer-sec">Puerta</p>
            <a href="/validar" onClick={() => setOpen(false)}>Control de acceso</a>
            <a href="/mis-registros" onClick={() => setOpen(false)}>Mis registros</a>
          </>
        )}
        {!isScanner && (
          <>
            <p className="drawer-sec">Mis entradas</p>
            <a href="/mis-entradas" onClick={() => setOpen(false)}>Recuperar mis QR</a>
          </>
        )}
        {(isStaff || !me) && (
          <>
            <p className="drawer-sec">Organizadores</p>
            {isStaff && <a href="/panel" onClick={() => setOpen(false)}>Panel de ventas</a>}
            {!me && <a href="/registro" onClick={() => setOpen(false)}>Vende con nosotros</a>}
            {!me && <a href="/login" onClick={() => setOpen(false)}>Entrar</a>}
          </>
        )}
        {!me && (
          <>
            <p className="drawer-sec">Personal</p>
            <a href="/validar" onClick={() => setOpen(false)}>Control de acceso</a>
          </>
        )}
      </aside>
    </>
  );
}
