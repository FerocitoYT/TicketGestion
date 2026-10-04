"use client";
import { useState } from "react";

export default function LoginForm() {
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/auth/login", { method: "POST", body: JSON.stringify(Object.fromEntries(fd)), headers: { "content-type": "application/json" } });
    const j = await r.json();
    if (!r.ok) {
      setMsg(j.error || "Error");
      return;
    }
    setMsg("OK. Entrando…");
    const q = new URLSearchParams(window.location.search).get("next");
    // El personal de puerta va directo a validar; el propietario al panel.
    const dest = q && q.startsWith("/") ? q : j.role === "owner" ? "/panel" : "/validar";
    window.location.assign(dest);
  }
  return (<><h1>Entrar <span className="muted" style={{ fontSize: 16 }}>(personal y organizadores)</span></h1>
    <p className="muted">El control de acceso es solo para personal: entra con tu cuenta de equipo.</p>
    <form onSubmit={submit} className="form">
      <input name="email" required type="email" placeholder="Email" />
      <input name="password" required type="password" placeholder="Contraseña" />
      <button>Entrar</button>
    </form>{msg && <p className="muted">{msg}</p>}
    <p className="muted">¿Sin cuenta? <a href="/registro">Regístrate</a></p></>);
}
