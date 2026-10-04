"use client";
import { useState } from "react";
export default function Login() {
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/auth/login", { method: "POST", body: JSON.stringify(Object.fromEntries(fd)), headers: { "content-type": "application/json" } });
    const j = await r.json();
    setMsg(r.ok ? "OK. Redirigiendo…" : (j.error || "Error"));
    if (r.ok) location.href = "/panel";
  }
  return (<><h1>Entrar</h1>
    <form onSubmit={submit} className="form">
      <input name="email" required type="email" placeholder="Email" />
      <input name="password" required type="password" placeholder="Contraseña" />
      <button>Entrar</button>
    </form>{msg && <p className="muted">{msg}</p>}
    <p className="muted">¿Sin cuenta? <a href="/registro">Regístrate</a></p></>);
}
