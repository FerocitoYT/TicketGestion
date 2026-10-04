"use client";
import { useEffect, useRef, useState } from "react";

type Scan = { result: string; gate: string; created_at: string };
type Result = {
  ok?: boolean; error?: string; code?: string; event?: string; zone?: string;
  holder?: string; doc?: string; buyer?: string; email?: string; scans?: Scan[];
};

export default function ValidarClient({ gate0 }: { gate0: string }) {
  const [payload, setPayload] = useState("");
  const [gate, setGate] = useState(gate0);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState({ ok: 0, no: 0 });
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState("");
  const [camSupported, setCamSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    setCamSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
    return () => stopCam();
  }, []);

  async function validate(code: string) {
    if (busyRef.current || !code.trim()) return;
    busyRef.current = true;
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch("/api/validar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: code.trim(), gate }),
      });
      const j = (await r.json()) as Result;
      setRes(j);
      setCount((c) => ({ ok: c.ok + (j.ok ? 1 : 0), no: c.no + (j.ok ? 0 : 1) }));
      if (j.ok) setPayload("");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function startCam() {
    setCamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCamOn(true);
      const Detector = (window as unknown as { BarcodeDetector: new (o: object) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      const detector = new Detector({ formats: ["qr_code"] });
      const loop = async () => {
        if (!streamRef.current) return;
        try {
          const found = await detector.detect(video);
          if (found[0]?.rawValue) {
            const value = found[0].rawValue;
            stopCam();
            setPayload(value);
            await validate(value);
            return;
          }
        } catch { /* frame sin QR, sigue */ }
        if (streamRef.current) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch {
      setCamError("No se pudo abrir la cámara. Revisa los permisos del navegador o usa el código manual.");
    }
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }

  return (
    <>
      <h1>Control de acceso</h1>
      <p className="muted">Escanea el QR con la cámara o introduce el código. Comprueba que el titular coincide con el DNI. Sesión: ✅ {count.ok} · ⛔ {count.no}</p>
      <div className="row" style={{ marginBottom: 12 }}>
        {camSupported ? (
          camOn
            ? <button className="btn btn-blue" onClick={stopCam}>Detener cámara</button>
            : <button className="btn btn-blue" onClick={startCam}>Escanear QR con cámara</button>
        ) : (
          <span className="badge">Este navegador no soporta escaneo por cámara: usa el código manual</span>
        )}
      </div>
      {camError && <p className="alert err">{camError}</p>}
      {camOn && <video ref={videoRef} style={{ width: "100%", maxWidth: 480, borderRadius: 12, background: "#000" }} playsInline muted />}
      {!camOn && <video ref={videoRef} style={{ display: "none" }} playsInline muted />}
      <form onSubmit={(e) => { e.preventDefault(); validate(payload); }} className="form" style={{ marginTop: 12 }}>
        <label>Código del QR<input value={payload} onChange={(e) => setPayload(e.target.value)} required placeholder="F8CL34RS.firma" autoFocus={!camOn} /></label>
        <label>Puerta<input value={gate} onChange={(e) => setGate(e.target.value)} /></label>
        <button disabled={busy}>{busy ? "Validando…" : "Validar código"}</button>
      </form>
      {res && (
        <div className="alert" style={{ background: res.ok ? "#e3f6ec" : "#fde7ec", border: `1px solid ${res.ok ? "#b6e3c9" : "#f3b7c3" }`, marginTop: 14 }}>
          <h2 style={{ margin: "0 0 8px" }}>{res.ok ? "✅ ACCESO PERMITIDO" : "⛔ ACCESO DENEGADO"}</h2>
          {res.error && <p><strong>{res.error}</strong></p>}
          {res.code && (
            <table>
              <tbody>
                <tr><th>Código</th><td><strong>{res.code}</strong></td></tr>
                <tr><th>Titular</th><td><strong>{res.holder}</strong>{res.doc ? ` · ${res.doc}` : ""}</td></tr>
                <tr><th>Evento</th><td>{res.event}</td></tr>
                <tr><th>Zona</th><td>{res.zone}</td></tr>
                <tr><th>Comprador</th><td>{res.buyer} · {res.email}</td></tr>
              </tbody>
            </table>
          )}
          {!res.ok && res.code && <p className="muted">Posible reventa o QR copiado: retén la entrada y avisa al responsable.</p>}
          {res.scans && res.scans.length > 0 && (
            <p className="muted">Intentos previos: {res.scans.map((s) => `${s.result}@${s.gate}`).join(", ")}</p>
          )}
        </div>
      )}
    </>
  );
}
