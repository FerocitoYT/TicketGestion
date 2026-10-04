"use client";
import { useState } from "react";
export default function Registro() {
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/auth/registro", { method: "POST", body: JSON.stringify(Object.fromEntries(fd)), headers: { "content-type": "application/json" } });
    const j = await r.json();
    setMsg(r.ok ? "Cuenta creada. Redirigiendo…" : (j.error || "Error"));
    if (r.ok) location.href = "/panel";
  }
  return (<><h1>Crear cuenta organizadora</h1>
    <form onSubmit={submit} className="form">
      <input name="name" required placeholder="Nombre" />
      <input name="email" required type="email" placeholder="Email" />
      <input name="password" required type="password" minLength={8} placeholder="Contraseña (8+)" />
      <input name="orgName" required placeholder="Nombre de tu promotora" />
      <button>Crear cuenta</button>
    </form>{msg && <p className="muted">{msg}</p>}
    <p className="muted">¿Ya tienes cuenta? <a href="/login">Entra</a></p></>);
}
