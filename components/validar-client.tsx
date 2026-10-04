"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

type Scan = { result: string; gate: string; created_at: string };
type Result = {
  ok?: boolean; error?: string; code?: string; event?: string; zone?: string;
  holder?: string; doc?: string; seat?: string; buyer?: string; email?: string; scans?: Scan[];
};
type Evt = { id: string; title: string };

// Pitido de confirmación (Web Audio, sin archivos): doble tono agudo = OK, grave = denegado.
function beep(ok: boolean) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const play = (freq: number, at: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = ok ? "sine" : "sawtooth";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + dur + 0.05);
    };
    if (ok) { play(880, 0, 0.15); play(1320, 0.16, 0.3); }
    else { play(220, 0, 0.45); }
    setTimeout(() => ctx.close(), 1200);
  } catch { /* sin audio, sigue */ }
}

export default function ValidarClient({ openEvents, closedEvents, isOwner }: {
  openEvents: Evt[]; closedEvents: { id: string; title: string; reason: string }[]; isOwner: boolean;
}) {
  // Un solo evento operativo -> puerta fija, sin elegir (ritmo máximo, cero errores).
  const [eventId, setEventId] = useState(openEvents[0]?.id || "");
  const [payload, setPayload] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState({ ok: 0, no: 0 });
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState("");
  const [devices, setDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [left, setLeft] = useState(0);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => () => { stopCam(); if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function validate(code: string, ev: string) {
    if (busyRef.current || !code.trim() || !ev) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/validar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: code.trim(), eventId: ev }),
      });
      const j = (await r.json()) as Result;
      setRes(j);
      setCount((c) => ({ ok: c.ok + (j.ok ? 1 : 0), no: c.no + (j.ok ? 0 : 1) }));
      beep(!!j.ok);
      if (j.ok) {
        setPayload("");
        // Con asiento numerado el verde aguanta 15 s para revisar; sin asiento, 2,6 s.
        const hold = j.seat ? 15000 : 2600;
        if (timerRef.current) clearInterval(timerRef.current);
        if (j.seat) {
          const end = Date.now() + hold;
          setLeft(Math.ceil(hold / 1000));
          timerRef.current = setInterval(() => {
            const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            setLeft(s);
            if (s <= 0 && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          }, 500);
        }
        setTimeout(() => {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setRes((cur) => (cur === j ? null : cur));
        }, hold);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function startCam() {
    setCamError("");
    stopCam();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("sin cámara");
      const devs = await BrowserQRCodeReader.listVideoInputDevices();
      setDevices(devs.map((d) => ({ deviceId: d.deviceId, label: d.label || "Cámara" })));
      // Trasera por defecto (móviles): última suele ser la trasera.
      const chosen = deviceId || devs[devs.length - 1]?.deviceId || devs[0]?.deviceId || undefined;
      if (chosen) setDeviceId(chosen);
      const reader = new BrowserQRCodeReader();
      const video = videoRef.current;
      if (!video) return;
      const controls = await reader.decodeFromVideoDevice(chosen, video, (result) => {
        if (!result) return;
        const value = result.getText();
        const now = Date.now();
        // La cámara sigue encendida para el siguiente: ignora el mismo QR 3s.
        if (value === lastRef.current.code && now - lastRef.current.at < 3000) return;
        lastRef.current = { code: value, at: now };
        setPayload(value);
        validate(value, eventId || openEvents[0]?.id || "");
      });
      controlsRef.current = controls;
      setCamOn(true);
    } catch {
      setCamError("No se pudo abrir la cámara. Permite el acceso en el navegador (HTTPS) o usa el código manual.");
    }
  }

  function stopCam() {
    try { controlsRef.current?.stop(); } catch { /* noop */ }
    controlsRef.current = null;
    setCamOn(false);
  }

  if (openEvents.length === 0) {
    return (
      <>
        <h1>Control de acceso</h1>
        <p className="alert err">
          {isOwner
            ? "No hay eventos con control operativo. Publica un evento y fija su hora de fin en el panel."
            : "No tienes ningún evento asignado con control operativo (o ya finalizaron). Pide a tu responsable que te asigne en el panel."}
        </p>
        {closedEvents.length > 0 && (
          <>
            <h3>Finalizados / no operativos</h3>
            <ul>{closedEvents.map((e) => <li key={e.id}>{e.title} — {e.reason}</li>)}</ul>
          </>
        )}
      </>
    );
  }

  const current = openEvents.find((e) => e.id === eventId) || openEvents[0];
  return (
    <>
      <h1>Control de acceso</h1>
      {openEvents.length === 1 ? (
        <p><span className="badge">Puerta: {current.title}</span></p>
      ) : (
        <label style={{ maxWidth: 480, display: "block" }}>Evento en puerta
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {openEvents.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </label>
      )}
      <p className="muted">Sesión: ✅ {count.ok} · ⛔ {count.no}</p>
      {!camOn && (
        <button className="btn btn-blue" onClick={startCam} style={{ fontSize: 18, padding: "16px 30px", width: "100%", maxWidth: 480 }}>
          Activar lector QR
        </button>
      )}
      {camError && <p className="alert err">{camError}</p>}
      {camOn && (
        <>
          <video ref={videoRef} style={{ width: "100%", maxWidth: 560, borderRadius: 12, background: "#000" }} playsInline muted />
          <div className="row" style={{ marginTop: 10, maxWidth: 560 }}>
            <button className="btn btn-blue" onClick={stopCam}>Detener lector</button>
            {devices.length > 1 && (
              <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} style={{ maxWidth: 220 }}>
                {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
              </select>
            )}
          </div>
        </>
      )}
      {!camOn && <video ref={videoRef} style={{ display: "none" }} playsInline muted />}
      <details style={{ marginTop: 18, maxWidth: 480 }}>
        <summary className="muted" style={{ cursor: "pointer", fontWeight: 700 }}>Solo si es necesario: introducir código manualmente</summary>
        <form onSubmit={(e) => { e.preventDefault(); validate(payload, eventId || openEvents[0].id); }} className="form" style={{ marginTop: 10 }}>
          <label>Código de la entrada<input value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="F8CL34RS.firma" /></label>
          <button disabled={busy}>{busy ? "Validando…" : "Validar código"}</button>
        </form>
      </details>
      {res && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center",
          background: res.ok ? "#0a7a3d" : "#b31217", color: "#fff", padding: 24, textAlign: "center",
        }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 64 }}>{res.ok ? "✓" : "✕"}</div>
            <h2 style={{ fontSize: 40, margin: "6px 0" }}>{res.ok ? "VALIDACIÓN CORRECTA" : "ACCESO DENEGADO"}</h2>
            {res.error && !res.ok && <p style={{ fontSize: 18 }}><strong>{res.error}</strong></p>}
            {res.code && (
              <div style={{ fontSize: 19, lineHeight: 1.7, marginTop: 8 }}>
                <div><strong>{res.holder}</strong>{res.doc ? ` · ${res.doc}` : ""}</div>
                <div>{res.event} · {res.zone}</div>
                {res.seat && <div>Asiento: <strong>{res.seat}</strong></div>}
                <div style={{ opacity: 0.85, fontSize: 15 }}>{res.code}</div>
              </div>
            )}
            {!res.ok && res.code && <p style={{ opacity: 0.9 }}>Posible reventa o QR copiado: retén la entrada y avisa al responsable.</p>}
            {res.ok && res.seat && <p style={{ fontSize: 17 }}>Se mantiene {left} s para revisar el asiento</p>}
            <button onClick={() => setRes(null)} style={{ marginTop: 16, background: "#fff", color: res.ok ? "#0a7a3d" : "#b31217", border: 0, borderRadius: 99, padding: "12px 34px", fontWeight: 800, fontSize: 16 }}>
              {res.ok ? "Siguiente" : "Cerrar"}
            </button>
          </div>
        </div>
      )}
      {res && !res.code && (
        <div className="alert err" style={{ marginTop: 14 }}>
          <p><strong>{res.error}</strong></p>
        </div>
      )}
    </>
  );
}
