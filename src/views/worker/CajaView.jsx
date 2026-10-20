import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { F, SF, C, SHADOW, inp, btnDark, btnGhost } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

// Caja de emergencia (caída de Epos, 20/10/2026).
// Escanea con la cámara (siempre abierta) o con la pistola, arma el ticket y cobra en efectivo o tarjeta.
// Cada venta se guarda en esta tablet al momento y se envía a la base de datos (caja_ventas) para subirla a Epos cuando vuelva.
// Si no hay conexión, se queda en cola y se reintenta sola.

const K_TICKET = "recao_caja_ticket";
const K_COLA = "recao_caja_cola";
const K_HIST = "recao_caja_hist";
const K_CAT = "recao_caja_catalogo";

const eur = (x) => (Number(x) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const fmtQ = (q) => (Number.isInteger(Number(q)) ? String(Number(q)) : String(Math.round(Number(q) * 1000) / 1000).replace(".", ","));
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const hoyStr = () => new Date().toLocaleDateString("sv-SE");
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
const leer = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (_) { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

// Variantes de un código (EAN-13 con 0 delante = UPC-A, etc.)
const variantes = (c) => { const s = String(c).replace(/\D/g, ""); const out = new Set([s, s.replace(/^0+/, "")]); if (s.length === 12) out.add("0" + s); return [...out].filter(Boolean); };

// Pitido corto al leer un código
let audioCtx = null;
function pitar(ok = true) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.frequency.value = ok ? 1500 : 320; o.type = "square"; g.gain.value = 0.06;
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + (ok ? 0.08 : 0.25));
  } catch (_) {}
  try { navigator.vibrate && navigator.vibrate(ok ? 40 : [80, 60, 80]); } catch (_) {}
}

// Lector: el del navegador (Android/Chrome) o, si no lo hay (iPhone/iPad), uno que se carga de internet
async function crearLector() {
  const formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];
  if ("BarcodeDetector" in window) {
    try { const sup = await window.BarcodeDetector.getSupportedFormats(); if (sup?.length) return new window.BarcodeDetector({ formats: formats.filter((f) => sup.includes(f)) }); } catch (_) {}
  }
  const urls = ["https://cdn.jsdelivr.net/npm/barcode-detector@2/dist/es/pure.min.js", "https://esm.sh/barcode-detector@2/pure", "https://cdn.jsdelivr.net/npm/barcode-detector@3/dist/es/ponyfill.min.js"];
  for (const u of urls) {
    try { const m = await import(/* @vite-ignore */ u); const BD = m.BarcodeDetector || m.default; if (BD) return new BD({ formats }); } catch (_) {}
  }
  return null;
}

// ---------- cámara siempre abierta ----------
function Escaner({ activo, onCodigo }) {
  const video = useRef(null);
  const [estado, setEstado] = useState("abriendo");
  const cb = useRef(onCodigo); cb.current = onCodigo;
  useEffect(() => {
    if (!activo) return;
    let stream, parar = false, ultimo = "", ultimoT = 0;
    (async () => {
      try {
        setEstado("abriendo");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (parar) return;
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
              // el mismo código seguido no cuenta dos veces si no se aparta antes (1,5 s)
              if (raw !== ultimo || t - ultimoT > 1500) cb.current(String(raw));
              ultimo = raw; ultimoT = t;
            }
          }
          await new Promise((s) => setTimeout(s, 120));
        }
      } catch (_) { if (!parar) setEstado("error"); }
    })();
    return () => { parar = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [activo]);
  if (!activo) return null;
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#111", height: 150 }}>
      <video ref={video} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", left: "8%", right: "8%", top: "50%", height: 2, background: "rgba(241,190,73,.9)", boxShadow: "0 0 8px rgba(241,190,73,.9)" }} />
      {estado !== "ok" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, textAlign: "center", fontFamily: F, fontSize: 13.5, color: "#fff", background: "rgba(0,0,0,.55)" }}>
          {estado === "abriendo" ? "Abriendo la cámara…" : estado === "sinlector" ? "Este dispositivo no lee códigos con la cámara: usa el buscador o la pistola." : "No puedo abrir la cámara. Revisa el permiso de cámara del navegador."}
        </div>
      )}
    </div>
  );
}

// ---------- buscador por nombre ----------
function Buscador({ catalogo, onElegir, onCerrar }) {
  const [q, setQ] = useState("");
  const [remoto, setRemoto] = useState(null);
  const local = useMemo(() => {
    if (!catalogo || q.trim().length < 2) return [];
    const partes = norm(q).split(/\s+/).filter(Boolean);
    return catalogo.filter((p) => { const n = norm(p.nombre); return partes.every((x) => n.includes(x)) || (p.barcode && p.barcode.includes(q.trim())); }).slice(0, 40);
  }, [q, catalogo]);
  // sin catálogo en la tablet: busca en el servidor
  useEffect(() => {
    if (catalogo || q.trim().length < 2) { setRemoto(null); return; }
    let vivo = true;
    const t = setTimeout(() => {
      sb.fn("recepcion", { accion: "productos", q: q.trim(), todos: true })
        .then((r) => vivo && setRemoto((r.productos || []).map((p) => ({ id: p.id, nombre: p.nombre, barcode: p.barcode, precio: Number(p.pvp) }))))
        .catch(() => vivo && setRemoto([]));
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, catalogo]);
  const lista = catalogo ? local : remoto || [];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 12px" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.cream, borderRadius: 20, padding: 16, width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: SF, fontSize: 20, color: C.char }}>Buscar producto</div>
          <button type="button" onClick={onCerrar} style={{ ...btnGhost, padding: "8px 14px" }}>Cerrar</button>
        </div>
        <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej.: pan, coca cola, agua…" style={inp} aria-label="Buscar producto por nombre" />
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {q.trim().length < 2 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, padding: 6 }}>Escribe al menos 2 letras.</div>
            : !catalogo && remoto === null ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, padding: 6 }}>Buscando…</div>
            : lista.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, padding: 6 }}>No encuentro nada con eso.</div>
            : lista.map((p) => (
              <button key={p.id} type="button" onClick={() => onElegir(p)} style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: "12px 14px", minHeight: 52, fontFamily: F, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: C.char }}>{p.nombre}{p.al_peso && <span style={{ fontSize: 11.5, color: C.mut, fontWeight: 500 }}> · al peso (€/kg)</span>}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.char }}>{eur(p.precio)}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

// ---------- cobro ----------
function Cobro({ total, onCobrar, onCerrar }) {
  const [forma, setForma] = useState(null);
  const [entregado, setEntregado] = useState("");
  const ent = num(entregado);
  const cambio = r2(ent - total);
  const billetes = [5, 10, 20, 50].filter((b) => b >= total).slice(0, 3);
  const listo = forma === "tarjeta" || (forma === "efectivo" && (entregado === "" || ent >= total));
  const btnForma = (id, txt) => (
    <button type="button" aria-pressed={forma === id} onClick={() => setForma(id)} style={{ flex: 1, height: 64, borderRadius: 14, cursor: "pointer", fontFamily: F, fontSize: 18, fontWeight: 700, border: forma === id ? "none" : `1.5px solid ${C.brd}`, background: forma === id ? C.char : "#fff", color: forma === id ? C.gold : C.char }}>{txt}</button>
  );
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.cream, borderRadius: 20, padding: 18, width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: F, fontSize: 12, color: C.mut, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Total a cobrar</div>
          <div style={{ fontFamily: SF, fontSize: 44, color: C.char }}>{eur(total)}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>{btnForma("efectivo", "Efectivo")}{btnForma("tarjeta", "Tarjeta")}</div>
        {forma === "efectivo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Entrega el cliente (opcional, para calcular el cambio)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setEntregado(String(total).replace(".", ","))} style={{ ...btnGhost, flex: 1 }}>Justo</button>
              {billetes.map((b) => <button key={b} type="button" onClick={() => setEntregado(String(b))} style={{ ...btnGhost, flex: 1 }}>{b} €</button>)}
            </div>
            <input inputMode="decimal" value={entregado} onChange={(e) => setEntregado(e.target.value)} placeholder="Otro importe" style={{ ...inp, fontSize: 20, textAlign: "center" }} aria-label="Importe entregado" />
            {entregado !== "" && (ent >= total
              ? <div style={{ textAlign: "center", fontFamily: F, fontSize: 15, color: "#1E6B3C", fontWeight: 700, background: "#EAF4EE", borderRadius: 12, padding: 10 }}>Cambio: <span style={{ fontSize: 26 }}>{eur(cambio)}</span></div>
              : <div style={{ textAlign: "center", fontFamily: F, fontSize: 14, color: "#A3362B", fontWeight: 700 }}>Faltan {eur(total - ent)}</div>)}
          </div>
        )}
        {forma === "tarjeta" && <div style={{ textAlign: "center", fontFamily: F, fontSize: 15, color: C.char, background: "#FBF0DA", borderRadius: 12, padding: 12 }}>Marca <b>{eur(total)}</b> en el datáfono y confirma cuando salga aprobado.</div>}
        <button type="button" disabled={!listo} onClick={() => onCobrar({ forma_pago: forma, entregado: forma === "efectivo" && entregado !== "" ? r2(ent) : null, cambio: forma === "efectivo" && entregado !== "" ? cambio : null })}
          style={{ ...btnDark, fontSize: 19, padding: 18, opacity: listo ? 1 : 0.4 }}>{forma === "tarjeta" ? "Pagado con tarjeta ✓" : "Cobrado ✓"}</button>
        <button type="button" onClick={onCerrar} style={{ ...btnGhost }}>Volver al ticket</button>
      </div>
    </div>
  );
}

// ---------- ventas de hoy (de esta tablet) ----------
function VentasHoy({ hist, cola, onAnular, onCerrar }) {
  const hoy = hist.filter((v) => v.dia === hoyStr());
  const vivas = hoy.filter((v) => !v.anulada);
  const suma = (f) => r2(vivas.filter((v) => !f || v.forma_pago === f).reduce((s, v) => s + v.total, 0));
  const [abierta, setAbierta] = useState(null);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 12px" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.cream, borderRadius: 20, padding: 16, width: "100%", maxWidth: 560, maxHeight: "88vh", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: SF, fontSize: 20, color: C.char }}>Ventas de hoy</div>
          <button type="button" onClick={onCerrar} style={{ ...btnGhost, padding: "8px 14px" }}>Cerrar</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, fontFamily: F, textAlign: "center" }}>
          {[["Tickets", vivas.length], ["Efectivo", eur(suma("efectivo"))], ["Tarjeta", eur(suma("tarjeta"))], ["Total", eur(suma())]].map(([t, v]) => (
            <div key={t} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "8px 4px" }}><div style={{ fontSize: 10.5, color: C.mut, textTransform: "uppercase", fontWeight: 700 }}>{t}</div><div style={{ fontSize: 14.5, fontWeight: 700, color: C.char }}>{v}</div></div>
          ))}
        </div>
        {cola.length > 0 && <div style={{ fontFamily: F, fontSize: 13, background: "#FBF0DA", color: "#7A5410", borderRadius: 12, padding: "8px 12px" }}>{cola.length} {cola.length > 1 ? "ventas guardadas" : "venta guardada"} solo en esta tablet, pendiente{cola.length > 1 ? "s" : ""} de enviar. Se envían solas al haber conexión: no borres los datos del navegador.</div>}
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {hoy.length === 0 && <div style={{ fontFamily: F, fontSize: 13, color: C.mut, padding: 6 }}>Aún no hay ventas hoy en esta tablet.</div>}
          {hoy.map((v) => (
            <div key={v.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: "10px 12px", fontFamily: F, opacity: v.anulada ? 0.5 : 1 }}>
              <button type="button" onClick={() => setAbierta(abierta === v.id ? null : v.id)} style={{ all: "unset", cursor: "pointer", display: "flex", width: "100%", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: C.mut, width: 44 }}>{new Date(v.creada_en).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
                <span style={{ flex: 1, fontSize: 13.5, color: C.char }}>{v.forma_pago === "efectivo" ? "Efectivo" : "Tarjeta"} · {v.lineas.length} {v.lineas.length > 1 ? "líneas" : "línea"}{v.anulada ? " · ANULADA" : ""}{cola.some((c) => c.id === v.id) ? " · sin enviar" : ""}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.char, textDecoration: v.anulada ? "line-through" : "none" }}>{eur(v.total)}</span>
              </button>
              {abierta === v.id && (
                <div style={{ marginTop: 8, borderTop: `1px solid ${C.brdL}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {v.lineas.map((l, i) => <div key={i} style={{ display: "flex", fontSize: 13, color: C.char }}><span style={{ flex: 1 }}>{fmtQ(l.cantidad)} × {l.nombre}</span><span>{eur(l.cantidad * l.precio_unit)}</span></div>)}
                  {v.cambio != null && <div style={{ fontSize: 12.5, color: C.mut }}>Entregó {eur(v.entregado)} · cambio {eur(v.cambio)}</div>}
                  {!v.anulada && <button type="button" onClick={() => { if (window.confirm(`¿Anular esta venta de ${eur(v.total)}? Solo si se cobró por error.`)) onAnular(v); }} style={{ ...btnGhost, alignSelf: "flex-start", marginTop: 4, color: "#A3362B", borderColor: "#E8C4BE" }}>Anular venta</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- pantalla principal ----------
export function CajaView() {
  const [catalogo, setCatalogo] = useState(() => leer(K_CAT, null)?.items || null);
  const [lineas, setLineas] = useState(() => leer(K_TICKET, []));
  const [cola, setCola] = useState(() => leer(K_COLA, []));
  const [hist, setHist] = useState(() => leer(K_HIST, []).filter((v) => v.dia >= new Date(Date.now() - 3 * 864e5).toLocaleDateString("sv-SE")));
  const [aviso, setAviso] = useState(null);
  const [modal, setModal] = useState(null); // buscar | cobrar | hoy
  const [hecho, setHecho] = useState(null);
  const [camara, setCamara] = useState(true);
  const avisoT = useRef(null);

  useEffect(() => guardar(K_TICKET, lineas), [lineas]);
  useEffect(() => guardar(K_COLA, cola), [cola]);
  useEffect(() => guardar(K_HIST, hist), [hist]);

  const mostrar = useCallback((texto, tipo = "ok") => { setAviso({ texto, tipo }); clearTimeout(avisoT.current); avisoT.current = setTimeout(() => setAviso(null), tipo === "mal" ? 4000 : 1800); }, []);

  // Catálogo completo en la tablet (para escanear al instante)
  useEffect(() => {
    sb.rpc("caja_catalogo").then((r) => {
      const items = (Array.isArray(r) ? r : []).map(([id, nombre, barcode, precio, al_peso, cat]) => ({ id, nombre, barcode, precio: Number(precio), al_peso, cat }));
      if (items.length) { setCatalogo(items); guardar(K_CAT, { en: Date.now(), items }); }
    }).catch(() => {});
  }, []);
  const porCodigo = useMemo(() => {
    const m = new Map();
    (catalogo || []).forEach((p) => { if (p.barcode) variantes(p.barcode).forEach((v) => { if (!m.has(v)) m.set(v, p); }); });
    return m;
  }, [catalogo]);

  // Cola: envía lo pendiente cada 20 s
  const enviando = useRef(false);
  const enviarCola = useCallback(async () => {
    if (enviando.current) return; enviando.current = true;
    try {
      let pend = leer(K_COLA, []);
      for (const v of pend) {
        try {
          if (v.accion === "anular") await sb.rpc("caja_anular", { p_id: v.id });
          else await sb.rpc("caja_registrar", { p: { id: v.id, creada_en: v.creada_en, forma_pago: v.forma_pago, entregado: v.entregado, cambio: v.cambio, lineas: v.lineas } });
          pend = pend.filter((x) => !(x.id === v.id && x.accion === v.accion)); guardar(K_COLA, pend); setCola(pend);
        } catch (_) { break; }
      }
    } finally { enviando.current = false; }
  }, []);
  useEffect(() => { enviarCola(); const t = setInterval(enviarCola, 20000); window.addEventListener("online", enviarCola); return () => { clearInterval(t); window.removeEventListener("online", enviarCola); }; }, [enviarCola]);

  const anadir = useCallback((p, cant = 1) => {
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.product_id === p.id);
      if (i >= 0 && !p.al_peso) { const n = [...ls]; const [l] = n.splice(i, 1); return [{ ...l, cantidad: r2(l.cantidad + cant) }, ...n]; }
      return [{ key: uuid(), product_id: p.id, nombre: p.nombre, barcode: p.barcode || null, precio_unit: Number(p.precio) || 0, cantidad: cant, al_peso: !!p.al_peso }, ...ls];
    });
  }, []);

  const buscando = useRef(new Set());
  const codigoLeido = useCallback(async (raw) => {
    const cod = String(raw).replace(/\s/g, "");
    let p = null;
    for (const v of variantes(cod)) { p = porCodigo.get(v); if (p) break; }
    if (!p && /^\d{6,14}$/.test(cod) && !buscando.current.has(cod)) {
      buscando.current.add(cod);
      try { const r = await sb.fn("recepcion", { accion: "productos", q: cod, todos: true }); const x = (r.productos || [])[0]; if (x) p = { id: x.id, nombre: x.nombre, barcode: x.barcode, precio: Number(x.pvp) }; } catch (_) {}
      buscando.current.delete(cod);
    }
    if (!p) { pitar(false); mostrar(`Código ${cod} no encontrado: búscalo por nombre`, "mal"); return; }
    pitar(true); anadir(p); mostrar(`${p.nombre} · ${eur(p.precio)}`);
  }, [porCodigo, anadir, mostrar]);

  // Pistola lectora (teclado): números rápidos + Enter
  useEffect(() => {
    let buf = "", t0 = 0;
    const h = (e) => {
      if (modal) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const now = Date.now();
      if (e.key === "Enter") { if (buf.length >= 6) { codigoLeido(buf); e.preventDefault(); } buf = ""; return; }
      if (/^[0-9A-Za-z]$/.test(e.key)) { if (now - t0 > 80) buf = ""; buf += e.key; t0 = now; }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [codigoLeido, modal]);

  const total = r2(lineas.reduce((s, l) => s + r2(num(l.cantidad) * l.precio_unit), 0));
  const unidades = lineas.reduce((s, l) => s + (l.al_peso ? 1 : num(l.cantidad)), 0);
  const cambiarCant = (key, v) => setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, cantidad: v } : l)));
  const quitar = (key) => setLineas((ls) => ls.filter((l) => l.key !== key));

  const cobrar = ({ forma_pago, entregado, cambio }) => {
    const ls = lineas.map((l) => ({ ...l, cantidad: num(l.cantidad) })).filter((l) => l.cantidad > 0);
    if (!ls.length) return;
    const venta = {
      id: uuid(), creada_en: new Date().toISOString(), dia: hoyStr(), forma_pago, entregado, cambio, total: r2(ls.reduce((s, l) => s + r2(l.cantidad * l.precio_unit), 0)),
      lineas: ls.map((l) => ({ product_id: l.product_id, nombre: l.nombre, barcode: l.barcode, cantidad: l.cantidad, precio_unit: l.precio_unit })),
    };
    setHist((h) => [venta, ...h]);
    const nc = [...leer(K_COLA, []), { ...venta, accion: "venta" }]; guardar(K_COLA, nc); setCola(nc);
    setLineas([]); setModal(null); setHecho(venta);
    enviarCola();
  };
  const anular = (v) => {
    setHist((h) => h.map((x) => (x.id === v.id ? { ...x, anulada: true } : x)));
    let nc = leer(K_COLA, []);
    if (nc.some((x) => x.id === v.id && x.accion === "venta")) nc = nc.filter((x) => x.id !== v.id); // aún no enviada: se descarta
    else nc = [...nc, { id: v.id, accion: "anular" }];
    guardar(K_COLA, nc); setCola(nc); enviarCola();
  };

  const pendientesEnvio = cola.filter((c) => c.accion === "venta").length;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 12px 150px", display: "flex", flexDirection: "column", gap: 10 }}>
      <Escaner activo={camara && !modal && !hecho} onCodigo={codigoLeido} />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setModal("buscar")} style={{ ...btnGhost, flex: 2, height: 50, fontSize: 15 }}>🔎 Buscar por nombre</button>
        <button type="button" onClick={() => setModal("hoy")} style={{ ...btnGhost, flex: 1, height: 50 }}>Ventas de hoy</button>
        <button type="button" onClick={() => setCamara(!camara)} aria-pressed={camara} style={{ ...btnGhost, height: 50, padding: "0 12px" }}>{camara ? "Cámara: sí" : "Cámara: no"}</button>
      </div>
      {aviso && <div role="status" style={{ fontFamily: F, fontSize: 14, fontWeight: 600, borderRadius: 12, padding: "10px 12px", background: aviso.tipo === "mal" ? "#FBEAE7" : "#EAF4EE", color: aviso.tipo === "mal" ? "#A3362B" : "#1E6B3C" }}>{aviso.texto}</div>}
      {!catalogo && <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>Cargando catálogo… (mientras tanto los códigos se consultan uno a uno)</div>}
      {pendientesEnvio > 0 && <div style={{ fontFamily: F, fontSize: 12.5, color: "#7A5410", background: "#FBF0DA", borderRadius: 10, padding: "6px 10px" }}>{pendientesEnvio} {pendientesEnvio > 1 ? "ventas" : "venta"} sin enviar todavía (se reintenta sola)</div>}

      <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, boxShadow: SHADOW.card, overflow: "hidden" }}>
        {lineas.length === 0 ? (
          <div style={{ padding: "34px 16px", textAlign: "center", fontFamily: F, fontSize: 14.5, color: C.mut }}>Escanea un producto o búscalo por nombre</div>
        ) : lineas.map((l, i) => {
          const imp = r2(num(l.cantidad) * l.precio_unit);
          return (
            <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderTop: i ? `1px solid ${C.brdL}` : "none", fontFamily: F }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.char, lineHeight: 1.25 }}>{l.nombre}</div>
                <div style={{ fontSize: 12.5, color: C.mut }}>{eur(l.precio_unit)}{l.al_peso ? " /kg" : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button type="button" aria-label={`Quitar uno de ${l.nombre}`} onClick={() => cambiarCant(l.key, Math.max(l.al_peso ? 0 : 1, r2(num(l.cantidad) - (l.al_peso ? 0.1 : 1))))} style={qBtn}>−</button>
                <input aria-label={`Cantidad de ${l.nombre}`} inputMode="decimal" value={typeof l.cantidad === "number" ? fmtQ(l.cantidad) : l.cantidad} onFocus={(e) => e.target.select()} onChange={(e) => cambiarCant(l.key, e.target.value)}
                  style={{ width: 52, height: 42, boxSizing: "border-box", textAlign: "center", border: `1px solid ${C.brdL}`, borderRadius: 10, fontFamily: F, fontSize: 16, fontWeight: 700, color: C.char }} />
                <button type="button" aria-label={`Añadir uno de ${l.nombre}`} onClick={() => cambiarCant(l.key, r2(num(l.cantidad) + (l.al_peso ? 0.1 : 1)))} style={qBtn}>+</button>
              </div>
              <div style={{ width: 74, textAlign: "right", fontSize: 15, fontWeight: 700, color: C.char }}>{eur(imp)}</div>
              <button type="button" aria-label={`Eliminar ${l.nombre}`} onClick={() => quitar(l.key)} style={{ ...qBtn, width: 38, color: "#A3362B", borderColor: "#E8C4BE", background: "#fff" }}>✕</button>
            </div>
          );
        })}
      </div>
      {lineas.length > 0 && <button type="button" onClick={() => { if (window.confirm("¿Vaciar el ticket entero?")) setLineas([]); }} style={{ background: "none", border: "none", fontFamily: F, fontSize: 13, color: "#A3362B", textDecoration: "underline", alignSelf: "flex-start", cursor: "pointer", padding: 4 }}>Vaciar ticket</button>}

      {/* total fijo abajo */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, background: C.char, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", boxShadow: "0 -8px 24px rgba(0,0,0,.18)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F, fontSize: 12, color: "#C9BFA8" }}>{lineas.length ? `${fmtQ(unidades)} ${unidades === 1 ? "artículo" : "artículos"}` : "Ticket vacío"}</div>
            <div style={{ fontFamily: SF, fontSize: 34, color: C.gold, lineHeight: 1.1 }}>{eur(total)}</div>
          </div>
          <button type="button" disabled={!lineas.length || total <= 0} onClick={() => setModal("cobrar")} style={{ height: 60, padding: "0 30px", borderRadius: 16, border: "none", background: C.gold, color: C.goldDark, fontFamily: SF, fontSize: 22, cursor: "pointer", opacity: lineas.length && total > 0 ? 1 : 0.4 }}>Cobrar</button>
        </div>
      </div>

      {modal === "buscar" && <Buscador catalogo={catalogo} onCerrar={() => setModal(null)} onElegir={(p) => { anadir(p, p.al_peso ? 1 : 1); setModal(null); mostrar(`${p.nombre} · ${eur(p.precio)}${p.al_peso ? " /kg: ajusta los kilos" : ""}`); }} />}
      {modal === "cobrar" && <Cobro total={total} onCerrar={() => setModal(null)} onCobrar={cobrar} />}
      {modal === "hoy" && <VentasHoy hist={hist} cola={cola} onAnular={anular} onCerrar={() => setModal(null)} />}
      {hecho && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <div style={{ background: C.cream, borderRadius: 20, padding: 22, width: "100%", maxWidth: 420, textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 40 }}>✓</div>
            <div style={{ fontFamily: SF, fontSize: 24, color: C.char }}>Venta guardada · {eur(hecho.total)}</div>
            <div style={{ fontFamily: F, fontSize: 15, color: C.mut }}>{hecho.forma_pago === "efectivo" ? "Efectivo" : "Tarjeta"}</div>
            {hecho.cambio != null && <div style={{ fontFamily: F, fontSize: 16, color: "#1E6B3C", fontWeight: 700, background: "#EAF4EE", borderRadius: 12, padding: 12 }}>Cambio: <span style={{ fontSize: 30 }}>{eur(hecho.cambio)}</span></div>}
            <button type="button" autoFocus onClick={() => setHecho(null)} style={{ ...btnDark, fontSize: 18 }}>Nueva venta</button>
          </div>
        </div>
      )}
    </div>
  );
}
const qBtn = { width: 42, height: 42, borderRadius: 11, border: `1px solid ${C.brd}`, background: C.cream, fontSize: 19, fontFamily: F, color: C.char, cursor: "pointer", flexShrink: 0 };
