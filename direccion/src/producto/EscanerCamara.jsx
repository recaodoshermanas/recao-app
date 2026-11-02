// Lector de códigos de barras con la cámara (#135). Usa el del navegador o, en iPhone/Safari, uno que se carga de internet.
import { useEffect, useRef, useState } from "react";

async function crearLector() {
  const formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];
  if ("BarcodeDetector" in window) {
    try { const sup = await window.BarcodeDetector.getSupportedFormats(); if (sup?.length) return new window.BarcodeDetector({ formats: formats.filter((f) => sup.includes(f)) }); } catch (_) {}
  }
  const urls = ["https://cdn.jsdelivr.net/npm/barcode-detector@2/dist/es/pure.min.js", "https://esm.sh/barcode-detector@2/pure", "https://cdn.jsdelivr.net/npm/barcode-detector@3/dist/es/ponyfill.min.js"];
  for (const u of urls) {
    try { const m = await import(/* @vite-ignore */ u); const BD = m.BarcodeDetector || m.default; if (BD) return new BD({ formats }); } catch (_) {}
  }
  return null;
}

export function EscanerCamara({ onCodigo, onCerrar }) {
  const video = useRef(null);
  const [estado, setEstado] = useState("abriendo");
  const cb = useRef(onCodigo); cb.current = onCodigo;
  useEffect(() => {
    let stream, parar = false, ultimo = "", ultimoT = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (parar) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current; v.srcObject = stream; await v.play();
        const det = await crearLector();
        if (!det) { setEstado("sinlector"); return; }
        setEstado("ok");
        while (!parar) {
          if (v.readyState >= 2) {
            const r = await det.detect(v).catch(() => []);
            const raw = r?.[0]?.rawValue;
            if (raw) {
              const t = Date.now();
              if (raw !== ultimo || t - ultimoT > 2000) cb.current(String(raw));
              ultimo = raw; ultimoT = t;
            }
          }
          await new Promise((s) => setTimeout(s, 150));
        }
      } catch (_) { if (!parar) setEstado("error"); }
    })();
    return () => { parar = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#111", height: 180, maxWidth: 480, marginTop: 8 }}>
      <video ref={video} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", left: "8%", right: "8%", top: "50%", height: 2, background: "rgba(241,190,73,.9)" }} />
      {estado !== "ok" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, textAlign: "center", fontSize: 13.5, color: "#fff", background: "rgba(0,0,0,.55)" }}>
          {estado === "abriendo" ? "Abriendo la cámara…" : estado === "sinlector" ? "Este dispositivo no lee códigos con la cámara: escribe el nombre o el código." : "No puedo abrir la cámara. Revisa el permiso de cámara del navegador; mientras, usa el buscador."}
        </div>
      )}
      <button type="button" className="btn-l" style={{ position: "absolute", top: 8, right: 8 }} onClick={onCerrar}>Cerrar cámara</button>
    </div>
  );
}
