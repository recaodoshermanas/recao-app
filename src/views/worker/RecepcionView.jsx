import { useState, useEffect, useCallback, useRef } from "react";
import { F, SF, C, SHADOW, inp, btnDark, btnGhost, lbl } from "../../lib/styles.js";
import { IcoRight, IcoCheck } from "../../lib/icons.jsx";
import { sb } from "../../lib/supabase.js";

// Recepción de pedidos: la trabajadora confirma lo que ha llegado. El stock sube con lo que ella confirma.
const fn = (accion, datos = {}) => sb.fn("recepcion", { accion, ...datos });
const eur = (x) => (x == null || isNaN(x) ? "" : Number(x).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €");
const numero = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const dinero = (x) => (x == null || isNaN(x) ? "" : Number(x).toFixed(2).replace(".", ","));
const fmt = (x) => (x == null ? "" : Number.isInteger(Number(x)) ? String(Number(x)) : String(Math.round(Number(x) * 100) / 100).replace(".", ","));
const card = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 18, padding: 16, boxShadow: SHADOW.card, display: "flex", flexDirection: "column", gap: 10 };
const chip = (bg, fg) => ({ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: bg, color: fg });
const CHIPS = { email: ["#EAF0F8", "#2F5C8F", "EMAIL"], foto: ["#FBF0DA", "#7A5410", "FOTO"], manual: ["#F0ECE2", "#5E5444", "MANUAL"] };
const btnPeq = { ...btnGhost, padding: "0 14px", height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 };

// Foto → JPEG reducido en base64 (las fotos del móvil pesan mucho)
function prepararFoto(file) {
  return new Promise((ok, mal) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 2200; let { width: w, height: h } = img; const k = Math.min(1, max / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url); ok({ mime: "image/jpeg", base64: cv.toDataURL("image/jpeg", 0.82).split(",")[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("No puedo abrir esa foto")); };
    img.src = url;
  });
}

function Aviso({ msg, tipo = "mal" }) {
  if (!msg) return null;
  return <div role="alert" style={{ fontFamily: F, fontSize: 13, borderRadius: 12, padding: "10px 12px", background: tipo === "mal" ? "#FBEAE7" : "#EAF4EE", color: tipo === "mal" ? "#A3362B" : "#1E6B3C" }}>{msg}</div>;
}
function Cargando({ texto }) {
  return <div style={{ padding: "40px 10px", textAlign: "center", fontFamily: F, color: C.mut, fontSize: 14 }}>{texto || "Cargando…"}</div>;
}
function Cantidad({ valor, onCambio, etiqueta }) {
  const v = numero(valor);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <button type="button" aria-label={`Quitar uno de ${etiqueta}`} onClick={() => onCambio(Math.max(0, v - 1))} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.brd}`, background: C.cream, fontSize: 20, fontFamily: F, color: C.char, cursor: "pointer" }}>−</button>
      <input aria-label={`Unidades de ${etiqueta}`} inputMode="decimal" value={valor} onChange={(e) => onCambio(e.target.value)} onFocus={(e) => e.target.select()}
        style={{ width: 54, height: 44, boxSizing: "border-box", textAlign: "center", border: `1px solid ${C.brdL}`, borderRadius: 10, fontFamily: F, fontSize: 17, fontWeight: 700, color: C.char }} />
      <button type="button" aria-label={`Añadir uno de ${etiqueta}`} onClick={() => onCambio(v + 1)} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.brd}`, background: C.cream, fontSize: 20, fontFamily: F, color: C.char, cursor: "pointer" }}>+</button>
    </div>
  );
}

// ---------- buscador de productos (añadir, asociar, manual) ----------
function Buscador({ supplierId, titulo, onElegir, onCerrar, permitirNuevo, onNuevo }) {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState(null);
  const [todos, setTodos] = useState(false);
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => { fn("productos", { supplier_id: supplierId, q, todos }).then((r) => vivo && setLista(r.productos || [])).catch(() => vivo && setLista([])); }, q ? 250 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, supplierId, todos]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontFamily: SF, fontSize: 19, color: C.char }}>{titulo}</div>
        <button type="button" onClick={onCerrar} style={{ ...btnPeq, height: 38 }}>Cerrar</button>
      </div>
      <label style={{ position: "absolute", left: -9999 }} htmlFor="busca-prod">Buscar producto</label>
      <input id="busca-prod" autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar o escanear el código…" style={inp} />
      {supplierId && <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F, fontSize: 13, color: C.mut }}><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Buscar en todos los proveedores</label>}
      {lista === null ? <Cargando /> : lista.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>No encuentro nada con eso.</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lista.map((p) => (
            <button key={p.id} type="button" onClick={() => onElegir(p)} style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: "10px 12px", minHeight: 48, fontFamily: F, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.char }}>{p.nombre}</span><span style={{ display: "block", fontSize: 11.5, color: C.mut }}>PVP {eur(p.pvp)}{p.barcode ? ` · ${p.barcode}` : ""}</span></span>
              <IcoRight size={16} color={C.mut} />
            </button>
          ))}
        </div>
      )}
      {permitirNuevo && <button type="button" onClick={() => onNuevo(q)} style={{ background: "none", border: "none", fontFamily: F, fontSize: 13.5, fontWeight: 600, color: "#4A4236", textDecoration: "underline", padding: 10, cursor: "pointer" }}>No está: es un producto nuevo</button>}
    </div>
  );
}

// ---------- código de barras: pistola, cámara o «No tiene código» ----------
function eanOk(c) {
  if (!/^\d{6,14}$/.test(c)) return false;
  if (c.length !== 8 && c.length !== 13) return true;
  const d = c.split("").map(Number); const chk = d.pop();
  let s = 0; d.reverse().forEach((x, i) => { s += x * (i % 2 === 0 ? 3 : 1); });
  return (10 - (s % 10)) % 10 === chk;
}
function CampoCodigo({ id, codigo, setCodigo, sinCodigo, setSinCodigo, estado }) {
  const [camara, setCamara] = useState(false);
  const [msg, setMsg] = useState("");
  const video = useRef(null);
  useEffect(() => {
    if (!camara) return;
    let stream, parar = false;
    (async () => {
      try {
        if (!("BarcodeDetector" in window)) { setMsg("Este móvil no lee códigos con la cámara: usa la pistola o escríbelo."); setCamara(false); return; }
        const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        while (!parar) {
          const r = await det.detect(video.current).catch(() => []);
          if (r?.[0]?.rawValue) { setCodigo(String(r[0].rawValue).replace(/\D/g, "")); setSinCodigo(false); setCamara(false); break; }
          await new Promise((s) => setTimeout(s, 250));
        }
      } catch (_) { setMsg("No he podido abrir la cámara."); setCamara(false); }
    })();
    return () => { parar = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [camara, setCodigo, setSinCodigo]);
  const ok = estado === "nuevo";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input id={id} inputMode="numeric" value={sinCodigo ? "" : codigo} disabled={sinCodigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder={sinCodigo ? "Sin código: sale en la caja por su nombre" : "Pásale la pistola…"}
          style={{ ...inp, flex: 1, minWidth: 0, letterSpacing: "0.04em", borderColor: ok ? C.grn : estado === "malo" ? C.red : C.brd, background: ok ? "#EAF4EE" : "#fff" }} />
        <button type="button" aria-label="Escanear con la cámara" disabled={sinCodigo} onClick={() => setCamara(true)} style={{ ...btnPeq, width: 52, padding: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.char} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
        </button>
      </div>
      {camara && <video ref={video} muted playsInline style={{ width: "100%", borderRadius: 12, background: "#000" }} />}
      {!sinCodigo && estado === "nuevo" && <div style={{ fontFamily: F, fontSize: 12.5, color: "#1E6B3C", fontWeight: 600 }}>Código nuevo: no está en la tienda</div>}
      {!sinCodigo && estado === "malo" && <div style={{ fontFamily: F, fontSize: 12.5, color: "#A3362B", fontWeight: 600 }}>Ese código no es válido: escanéalo otra vez</div>}
      {!sinCodigo && estado === "mirando" && <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>Comprobando…</div>}
      <Aviso msg={msg} />
      <button type="button" onClick={() => { setSinCodigo(!sinCodigo); if (!sinCodigo) setCodigo(""); }} aria-pressed={sinCodigo}
        style={{ ...btnPeq, height: 40, alignSelf: "flex-start", background: sinCodigo ? C.char : "#fff", color: sinCodigo ? C.gold : C.char, border: sinCodigo ? "none" : btnPeq.border }}>
        {sinCodigo ? "No tiene código ✓" : "No tiene código"}
      </button>
    </div>
  );
}

function SiNo({ valor, onCambio, etiqueta }) {
  const b = (v, t) => (
    <button type="button" aria-pressed={valor === v} onClick={() => onCambio(v)}
      style={{ flex: 1, height: 46, borderRadius: 12, cursor: "pointer", fontFamily: F, fontSize: 15, fontWeight: 600, border: valor === v ? "none" : `1.5px solid ${C.brd}`, background: valor === v ? C.char : "#fff", color: valor === v ? C.gold : C.char }}>{t}</button>
  );
  return <div role="group" aria-label={etiqueta} style={{ display: "flex", gap: 8 }}>{b(true, "Sí")}{b(false, "No")}</div>;
}

// ---------- 8 · Producto nuevo (dentro de un pedido) y 9 · Añadir producto (fuera de pedido) ----------
// modo: "pedido" (se añade a la lista y se da de alta al confirmar), "espera" (pedido que espera su factura: alta inmediata), "fuera" (alta inmediata)
function FichaProducto({ modo, recepcion, proveedor, proveedores, inicial, onListo, onCerrar }) {
  const dentro = modo !== "fuera";
  const [codigo, setCodigo] = useState(inicial?.codigo || "");
  const [sinCodigo, setSinCodigo] = useState(!!inicial?.sin_codigo);
  const [estadoCod, setEstadoCod] = useState("");
  const [existe, setExiste] = useState(null);
  const [nombre, setNombre] = useState(inicial?.nombre || "");
  const [uds, setUds] = useState(inicial?.unidades != null ? fmt(inicial.unidades) : "1");
  const [marcado, setMarcado] = useState(inicial?.marcado ?? (inicial?.precio_marcado != null ? true : null));
  const [pMarcado, setPMarcado] = useState(inicial?.precio_marcado != null ? dinero(inicial.precio_marcado) : "");
  const [coste, setCoste] = useState(inicial?.coste != null ? String(Math.round(Number(inicial.coste) * 10000) / 10000).replace(".", ",") : "");
  const [provSel, setProvSel] = useState(inicial?.proveedor || "");
  const [pvp, setPvp] = useState(inicial?.pvp != null ? dinero(inicial.pvp) : "");
  const [tocado, setTocado] = useState(inicial?.pvp != null);
  const [sug, setSug] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const provElegido = !dentro ? (proveedores || []).find((p) => p.nombre === provSel) : null;

  // ¿existe el código?
  useEffect(() => {
    setExiste(null);
    if (sinCodigo || !codigo) { setEstadoCod(""); return; }
    if (codigo.length < 8) { setEstadoCod(""); return; }
    if (!eanOk(codigo)) { setEstadoCod(codigo.length >= 13 || codigo.length === 8 ? "malo" : ""); return; }
    let vivo = true; setEstadoCod("mirando");
    const t = setTimeout(() => fn("comprobar_codigo", { codigo }).then((r) => {
      if (!vivo) return;
      if (!r.valido) setEstadoCod("malo"); else if (r.producto) { setEstadoCod("existe"); setExiste(r.producto); } else setEstadoCod("nuevo");
    }).catch(() => vivo && setEstadoCod("")), 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [codigo, sinCodigo]);

  // precio de venta propuesto
  useEffect(() => {
    const t = setTimeout(() => {
      fn("precio_sugerido", { nombre, recepcion_id: recepcion?.id, supplier_id: dentro ? proveedor?.supplier_id : provElegido?.supplier_id, proveedor: dentro ? proveedor?.nombre : provElegido?.nombre, coste_sin_iva: coste ? numero(coste) : null, marcado: marcado === true, precio_marcado: marcado ? numero(pMarcado) || null : null })
        .then((r) => { setSug(r); if (!tocado && r.pvp != null) setPvp(dinero(r.pvp)); }).catch(() => {});
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre, coste, marcado, pMarcado, provSel]);

  if (existe) return <CodigoExiste producto={existe} modo={modo} recepcion={recepcion} datos={{ nombre, coste: coste ? numero(coste) : null, marcado: marcado === true, precio_marcado: marcado ? numero(pMarcado) : null, pvp: numero(pvp) || null, unidades: dentro ? numero(uds) : null, supplier_id: dentro ? proveedor?.supplier_id : provElegido?.supplier_id, proveedor: dentro ? proveedor?.nombre : provElegido?.nombre, recepcion_id: recepcion?.id }}
    onEsEste={() => onListo({ existente: existe, unidades: numero(uds) })} onVolver={() => { setExiste(null); setCodigo(""); setEstadoCod(""); }} onIncidencia={() => onListo({ incidencia: true })} />;

  const guardar = async () => {
    setMsg("");
    if (!sinCodigo && !codigo) { setMsg("Escanea el código de barras o marca «No tiene código»"); return; }
    if (!sinCodigo && estadoCod !== "nuevo") { setMsg(estadoCod === "malo" ? "Ese código no es válido: escanéalo otra vez" : "Espera a que compruebe el código"); return; }
    if (!nombre.trim()) { setMsg("Escribe el nombre del producto"); return; }
    if (dentro && !(numero(uds) > 0)) { setMsg("Pon las unidades recibidas"); return; }
    if (marcado === null) { setMsg("Dime si viene con el precio marcado"); return; }
    if (marcado && !(numero(pMarcado) > 0)) { setMsg("Pon el precio marcado"); return; }
    if (!(numero(coste) > 0)) { setMsg("Pon el precio de coste"); return; }
    if (!(numero(pvp) > 0)) { setMsg("Falta el precio de venta"); return; }
    const datos = { nombre: nombre.trim(), codigo: sinCodigo ? null : codigo, sin_codigo: sinCodigo, marcado, precio_marcado: marcado ? numero(pMarcado) : null, coste: numero(coste), pvp: numero(pvp), pvp_sugerido: sug?.pvp ?? null, unidades: dentro ? numero(uds) : null };
    if (modo === "pedido") { onListo({ nuevo: datos }); return; }
    setBusy(true);
    try {
      const r = await fn("alta_producto", { ...datos, recepcion_id: recepcion?.id, supplier_id: provElegido?.supplier_id, proveedor: provElegido?.nombre });
      onListo({ alta: r });
    } catch (e) { setMsg(e.message || "No se ha podido dar de alta"); }
    setBusy(false);
  };
  const L = (n, t) => <label style={lbl} htmlFor={`fp-${n}`}>{dentro ? `${n} · ` : ""}{t}</label>;
  const ayuda = (t) => <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: -2 }}>{t}</div>;
  return (
    <div style={{ padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: SF, fontSize: 22, color: C.char }}>{dentro ? "Producto nuevo" : "Añadir producto"}</div>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>{dentro ? `Pedido de ${proveedor?.nombre || recepcion?.proveedor} · se añade a este pedido` : "Algo de la tienda que no pasa por caja"}</div>
        </div>
        <button type="button" onClick={onCerrar} style={{ ...btnPeq, height: 38 }}>{dentro ? "Volver" : "Cerrar"}</button>
      </div>
      {dentro && <div style={{ fontFamily: F, fontSize: 13, color: C.mut, background: "#F4EFE6", borderRadius: 12, padding: "10px 12px" }}>Para lo que ha llegado y no tenemos dado de alta.{recepcion?.via !== "manual" ? " Cuando llegue la factura, compruebo el coste." : ""}</div>}
      <div>{L(1, "Código de barras")}<CampoCodigo id="fp-1" codigo={codigo} setCodigo={setCodigo} sinCodigo={sinCodigo} setSinCodigo={setSinCodigo} estado={estadoCod} /></div>
      <div>{L(2, "Nombre")}<input id="fp-2" value={nombre} onChange={(e) => setNombre(e.target.value)} style={inp} />{ayuda("Como lo leerías en la caja")}</div>
      {dentro && <div>{L(3, "Unidades recibidas")}<input id="fp-3" inputMode="decimal" value={uds} onChange={(e) => setUds(e.target.value)} onFocus={(e) => e.target.select()} style={{ ...inp, maxWidth: 140, fontWeight: 700 }} /></div>}
      {!dentro && (
        <div>
          <label style={lbl} htmlFor="fp-prov">Proveedor</label>
          <select id="fp-prov" value={provSel} onChange={(e) => setProvSel(e.target.value)} style={inp}>
            <option value="">No lo sé (lo revisa dirección)</option>
            {(proveedores || []).map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
          </select>
          {ayuda("Si no lo sabes, déjalo en «No lo sé».")}
        </div>
      )}
      <div>
        <div style={lbl}>{dentro ? "4 · " : ""}¿Viene con el precio marcado?</div>
        <SiNo valor={marcado} onCambio={setMarcado} etiqueta="¿Viene con el precio marcado?" />
      </div>
      {marcado && <div><label style={lbl} htmlFor="fp-pm">Precio marcado</label><input id="fp-pm" inputMode="decimal" value={pMarcado} onChange={(e) => setPMarcado(e.target.value)} placeholder="0,00" style={{ ...inp, maxWidth: 160, fontWeight: 700 }} /></div>}
      <div>
        {L(5, "Precio de coste")}
        <input id="fp-5" inputMode="decimal" value={coste} onChange={(e) => setCoste(e.target.value)} placeholder="0,00" style={{ ...inp, maxWidth: 160, fontWeight: 700 }} />
        <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 6 }}>El precio de la línea tal como sale en la factura. Si trae dos precios, pon el que <b>no lleva IVA</b>.{!dentro ? " Si no tienes factura, pon el que sepas: dirección lo revisa." : ""}</div>
      </div>
      <div style={{ border: `1.5px solid ${C.grn}`, borderRadius: 14, padding: 14, background: "#fff", display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ ...lbl, marginBottom: 0 }} htmlFor="fp-pvp">Precio de venta</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input id="fp-pvp" inputMode="decimal" value={pvp} onChange={(e) => { setPvp(e.target.value); setTocado(true); }} placeholder="—" style={{ ...inp, maxWidth: 140, fontWeight: 700, fontSize: 18 }} />
          <span style={{ fontFamily: F, fontSize: 15, color: C.char }}>€</span>
          {tocado && sug?.pvp != null && Math.abs(numero(pvp) - sug.pvp) > 0.001 && <button type="button" onClick={() => { setPvp(dinero(sug.pvp)); setTocado(false); }} style={{ background: "none", border: "none", fontFamily: F, fontSize: 12.5, color: C.mut, textDecoration: "underline", cursor: "pointer" }}>Volver a {eur(sug.pvp)}</button>}
        </div>
        {sug?.nota && <div style={{ fontFamily: F, fontSize: 12.5, color: C.char }}>{sug.nota}</div>}
        <div style={{ fontFamily: F, fontSize: 12, color: C.mut }}>Sale solo. Si lo cambias, dirección lo revisa.</div>
      </div>
      <Aviso msg={msg} />
      <button type="button" disabled={busy} onClick={guardar} style={{ ...btnDark, background: C.grn, color: "#fff", fontSize: 17, padding: 16, opacity: busy ? 0.6 : 1 }}>{busy ? "Dando de alta…" : modo === "pedido" ? "Añadir al pedido" : modo === "espera" ? "Añadir al pedido y dar de alta" : "Dar de alta"}</button>
    </div>
  );
}

// ---------- 10 · Este código ya existe ----------
function CodigoExiste({ producto: p, modo, recepcion, datos, onEsEste, onVolver, onIncidencia }) {
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const input = useRef(null);
  const mandar = async () => {
    setBusy(true); setMsg("");
    try { await fn("incidencia_codigo", { codigo: p.barcode, texto, foto, recepcion_id: recepcion?.id, datos }); onIncidencia(); }
    catch (e) { setMsg(e.message || "No se ha podido mandar"); }
    setBusy(false);
  };
  return (
    <div style={{ padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: SF, fontSize: 22 }}>Este código ya existe</div>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>Código {p.barcode}</div>
        </div>
        <button type="button" onClick={onVolver} style={{ ...btnPeq, height: 38 }}>Volver</button>
      </div>
      <div style={{ fontFamily: F, fontSize: 14 }}>Este código ya lo tiene un producto de la tienda:</div>
      <div style={card}>
        <div style={{ fontFamily: F, fontSize: 16, fontWeight: 700 }}>{p.nombre}</div>
        <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>{[p.proveedor, p.categoria, eur(p.pvp)].filter(Boolean).join(" · ")}</div>
      </div>
      {modo === "pedido" && <button type="button" onClick={onEsEste} style={{ ...btnDark, background: C.grn, color: "#fff" }}>Sí, es este: añadirlo al pedido</button>}
      {modo !== "pedido" && <button type="button" onClick={onEsEste} style={{ ...btnDark, background: C.grn, color: "#fff" }}>Sí, es este</button>}
      {modo === "espera" && <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: -6 }}>No hace falta darlo de alta: se cuenta cuando recepciones el pedido con su factura.</div>}
      <div style={{ background: "#FBEDE9", border: `1.5px solid ${C.red}`, borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#A3362B" }}>No es este producto</div>
        <div style={{ fontFamily: F, fontSize: 13, color: C.char }}>Se lo mando a dirección para que lo corrija. Mientras, no se da de alta.</div>
        <label style={lbl} htmlFor="ce-txt">¿Qué producto es? (opcional)</label>
        <input id="ce-txt" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={datos?.nombre || ""} style={{ ...inp, marginTop: -6 }} />
        <input ref={input} type="file" accept="image/*" capture="environment" style={{ display: "none" }} aria-hidden="true" tabIndex={-1}
          onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setFoto(await prepararFoto(f)); } catch (er) { setMsg(er.message); } }} />
        <button type="button" onClick={() => input.current?.click()} style={{ height: 46, borderRadius: 12, border: "1.5px dashed #C9C0B0", background: "transparent", fontFamily: F, fontSize: 13.5, fontWeight: 600, color: "#4A4236", cursor: "pointer" }}>{foto ? "Foto añadida ✓ (cambiar)" : "Añadir foto (opcional)"}</button>
        <Aviso msg={msg} />
        <button type="button" disabled={busy} onClick={mandar} style={{ ...btnDark, background: C.red, color: "#fff", opacity: busy ? 0.6 : 1 }}>{busy ? "Mandando…" : "Mandar incidencia"}</button>
      </div>
    </div>
  );
}

// ---------- 6 · Productos nuevos: solo falta el código ----------
function FilaSinCodigo({ p, onHecho }) {
  const [codigo, setCodigo] = useState("");
  const [sinCodigo, setSinCodigo] = useState(false);
  const [estado, setEstado] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [hecho, setHecho] = useState(false);
  useEffect(() => { if (!codigo || codigo.length < 8) { setEstado(""); return; } setEstado(eanOk(codigo) ? "nuevo" : (codigo.length >= 13 || codigo.length === 8 ? "malo" : "")); }, [codigo]);
  const guardar = async (sin) => {
    setBusy(true); setMsg("");
    try {
      const r = await fn("guardar_codigo", sin ? { alta_id: p.id, sin_codigo: true } : { alta_id: p.id, codigo });
      if (r.duplicado) setMsg(`Ese código ya lo tiene «${r.duplicado.nombre}». No lo he guardado: se lo he mandado a dirección.`);
      setHecho(true); onHecho();
    } catch (e) { setMsg(e.message || "No se ha podido guardar"); }
    setBusy(false);
  };
  return (
    <div style={{ ...card, border: `1.5px solid ${hecho ? C.grn : "#E0B94A"}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700 }}>{p.nombre}</div>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>{[p.proveedor, p.unidades ? `${fmt(p.unidades)} unidades` : null, p.pvp != null ? `PVP ${eur(p.pvp)}` : null].filter(Boolean).join(" · ")}</div>
        </div>
        {hecho && <IcoCheck size={22} color={C.grn} sw={2.4} />}
      </div>
      {!hecho && (
        <>
          <CampoCodigo id={`sc-${p.id}`} codigo={codigo} setCodigo={setCodigo} sinCodigo={sinCodigo} setSinCodigo={(v) => { setSinCodigo(v); }} estado={estado} />
          <button type="button" disabled={busy || (!sinCodigo && estado !== "nuevo")} onClick={() => guardar(sinCodigo)} style={{ ...btnPeq, background: C.char, color: C.gold, border: "none", opacity: busy || (!sinCodigo && estado !== "nuevo") ? 0.5 : 1 }}>{busy ? "Guardando…" : "Guardar"}</button>
        </>
      )}
      <Aviso msg={msg} tipo={/mandado/.test(msg) ? "bien" : "mal"} />
    </div>
  );
}
function SinCodigo({ productos: iniciales, onTerminar }) {
  const [lista, setLista] = useState(iniciales || null);
  const [hechos, setHechos] = useState(0);
  useEffect(() => { if (!iniciales) fn("sin_codigo").then((r) => setLista(r.productos || [])).catch(() => setLista([])); }, [iniciales]);
  if (!lista) return <Cargando />;
  return (
    <div style={{ padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 540, margin: "0 auto" }}>
      <div style={{ background: C.char, borderRadius: 16, padding: "16px 18px" }}>
        <div style={{ fontFamily: SF, fontSize: 21, color: C.gold }}>{lista.length} producto{lista.length === 1 ? "" : "s"} nuevo{lista.length === 1 ? "" : "s"}</div>
        <div style={{ fontFamily: F, fontSize: 13, color: "#E9DFC6" }}>Solo falta su código de barras: pásales la pistola</div>
      </div>
      {lista.length === 0 ? <div style={{ fontFamily: F, fontSize: 14, color: C.mut }}>No hay productos sin código.</div> : lista.map((p) => <FilaSinCodigo key={p.id ?? p.alta_id} p={{ ...p, id: p.id ?? p.alta_id }} onHecho={() => setHechos((n) => n + 1)} />)}
      <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>Ya están dados de alta en la caja con su precio. Si un producto no tiene código, márcalo y sale en la caja por su nombre.</div>
      <button type="button" onClick={onTerminar} style={btnDark}>{hechos >= lista.length ? "Terminar" : "Terminar (lo que falte, luego)"}</button>
    </div>
  );
}

// ---------- 11 · Poner código a productos que ya existen y no lo tienen (solicitud #12) ----------
const fnCod = (accion, datos = {}) => sb.fn("codigos", { accion, ...datos });
const sinAcentos = (t) => String(t ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
function FilaPonerCodigo({ p, abierto, onAbrir, onHecho }) {
  const [codigo, setCodigo] = useState("");
  const [noLleva, setNoLleva] = useState(false);
  const [estado, setEstado] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!codigo || codigo.length < 8) { setEstado(""); return; } if (!eanOk(codigo)) { setEstado(codigo.length >= 13 || codigo.length === 8 ? "malo" : ""); return; } setEstado("mirando"); const t = setTimeout(() => fn("comprobar_codigo", { codigo }).then((r) => setEstado(r.producto ? "existe" : "nuevo")).catch(() => setEstado("nuevo")), 300); return () => clearTimeout(t); }, [codigo]);
  const guardar = async () => {
    setBusy(true); setMsg("");
    try {
      if (noLleva) { await fnCod("no_lleva", { product_id: p.id }); onHecho(p.id, "sin"); }
      else {
        const r = await fnCod("poner", { product_id: p.id, codigo });
        if (r.duplicado) { setMsg(`Ese código ya lo tiene «${r.duplicado.nombre}». No lo he guardado: se lo he mandado a dirección.`); setBusy(false); return; }
        onHecho(p.id, "ok");
      }
    } catch (e) { setMsg(e.message || "No se ha podido guardar"); }
    setBusy(false);
  };
  const listo = noLleva || estado === "nuevo";
  return (
    <div style={{ ...card, padding: abierto ? 16 : "12px 16px", gap: abierto ? 10 : 0, border: `1px solid ${abierto ? "#E0B94A" : C.brdL}` }}>
      <button type="button" onClick={onAbrir} aria-expanded={abierto} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: F, fontSize: 14.5, fontWeight: 700, color: C.char }}>{p.nombre}</span>
          <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.mut }}>{[p.proveedor, p.categoria, p.pvp ? eur(p.pvp) : null].filter(Boolean).join(" · ")}</span>
        </span>
        <IcoRight size={16} color={C.mutL} sw={2.4} />
      </button>
      {abierto && (
        <>
          <CampoCodigo id={`pc-${p.id}`} codigo={codigo} setCodigo={setCodigo} sinCodigo={noLleva} setSinCodigo={setNoLleva} estado={estado === "existe" ? "malo" : estado} />
          {!noLleva && estado === "existe" && <div style={{ fontFamily: F, fontSize: 12.5, color: "#A3362B", fontWeight: 600 }}>Ese código ya lo tiene otro producto. Si lo guardas, se lo mando a dirección para que lo revise.</div>}
          <Aviso msg={msg} tipo={/mandado/.test(msg) ? "bien" : "mal"} />
          <button type="button" disabled={busy || !(listo || estado === "existe")} onClick={guardar} style={{ ...btnDark, minHeight: 46, opacity: busy || !(listo || estado === "existe") ? 0.5 : 1 }}>{busy ? "Guardando…" : noLleva ? "Guardar: no lleva código" : "Guardar código"}</button>
        </>
      )}
    </div>
  );
}
function PonerCodigos({ onVolver }) {
  const [lista, setLista] = useState(null);
  const [buscar, setBuscar] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [hechos, setHechos] = useState({ ok: 0, sin: 0 });
  useEffect(() => { fnCod("lista").then((r) => setLista(r.productos || [])).catch(() => setLista([])); }, []);
  if (!lista) return <Cargando />;
  const q = sinAcentos(buscar).trim();
  const filtrada = q ? lista.filter((p) => sinAcentos(`${p.nombre} ${p.proveedor || ""} ${p.categoria || ""}`).includes(q)) : lista;
  const MAX = 60;
  return (
    <div style={{ padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: SF, fontSize: 22, color: C.char }}>Poner código</div>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>{lista.length} producto{lista.length === 1 ? "" : "s"} de la tienda sin código de barras</div>
        </div>
        <button type="button" onClick={onVolver} style={{ ...btnPeq, height: 38 }}>Volver</button>
      </div>
      {(hechos.ok > 0 || hechos.sin > 0) && <Aviso tipo="bien" msg={[hechos.ok ? `${hechos.ok} con código nuevo` : null, hechos.sin ? `${hechos.sin} marcado${hechos.sin === 1 ? "" : "s"} sin código` : null].filter(Boolean).join(" · ") + " ✓"} />}
      <input type="search" value={buscar} onChange={(e) => { setBuscar(e.target.value); setAbierto(null); }} placeholder="Busca por nombre, proveedor o categoría" aria-label="Buscar producto" style={inp} />
      <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, lineHeight: 1.45 }}>Coge el producto de la estantería, búscalo aquí y pásale la pistola. Si de verdad no lleva código (pan del día, fruta, obrador…), márcalo y sale de la lista.</div>
      {filtrada.length === 0 && <div style={{ fontFamily: F, fontSize: 14, color: C.mut }}>{lista.length ? "No hay ninguno con ese nombre." : "Todos los productos tienen ya su código ✓"}</div>}
      {filtrada.slice(0, MAX).map((p) => (
        <FilaPonerCodigo key={p.id} p={p} abierto={abierto === p.id} onAbrir={() => setAbierto(abierto === p.id ? null : p.id)}
          onHecho={(id, tipo) => { setLista((l) => l.filter((x) => x.id !== id)); setHechos((h) => ({ ...h, [tipo]: h[tipo] + 1 })); setAbierto(null); }} />
      ))}
      {filtrada.length > MAX && <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, textAlign: "center" }}>Y {filtrada.length - MAX} más: escribe para buscar.</div>}
    </div>
  );
}

// ---------- 9 · Añadir producto desde el inicio ----------
export function AnadirProductoView({ onFin }) {
  const [provs, setProvs] = useState(null);
  const [hecho, setHecho] = useState(null);
  const [clave, setClave] = useState(0);
  const [poner, setPoner] = useState(false); // #12: poner código a productos que ya existen
  const [sinCod, setSinCod] = useState(null);
  useEffect(() => { fn("inicio").then((r) => setProvs(r.proveedores || [])).catch(() => setProvs([])); }, []);
  useEffect(() => { if (!poner) fnCod("lista").then((r) => setSinCod((r.productos || []).length)).catch(() => {}); }, [poner]);
  if (poner) return <PonerCodigos onVolver={() => setPoner(false)} />;
  if (!provs) return <Cargando />;
  if (hecho) return (
    <div style={{ padding: "36px 16px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
        <span style={{ width: 72, height: 72, borderRadius: 999, background: "#EAF4EE", display: "flex", alignItems: "center", justifyContent: "center" }}><IcoCheck size={36} color={C.grn} sw={2.4} /></span>
        <div style={{ fontFamily: SF, fontSize: 24 }}>{hecho.incidencia ? "Incidencia mandada" : "Producto dado de alta"}</div>
        <div style={{ fontFamily: F, fontSize: 14, color: C.mut }}>{hecho.incidencia ? "Dirección lo revisa y lo corrige." : `${hecho.alta.nombre} · ${eur(hecho.alta.pvp)} · ya se puede vender en la caja`}</div>
      </div>
      <button type="button" onClick={() => { setHecho(null); setClave((k) => k + 1); }} style={{ ...btnGhost, minHeight: 48 }}>Añadir otro</button>
      <button type="button" onClick={onFin} style={btnDark}>Volver al inicio</button>
    </div>
  );
  return (
    <>
      {sinCod > 0 && (
        <div style={{ padding: "16px 16px 0", maxWidth: 540, margin: "0 auto" }}>
          <button type="button" onClick={() => setPoner(true)} style={{ width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "#fff", border: "1.5px solid #E0B94A", borderRadius: 16, cursor: "pointer", textAlign: "left" }}>
            <span style={{ minWidth: 34, height: 26, padding: "0 8px", boxSizing: "border-box", borderRadius: 999, background: "#FBF0DA", color: "#7A5410", fontFamily: F, fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{sinCod}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontFamily: F, fontSize: 14.5, fontWeight: 700, color: C.char }}>¿Ya existe pero no tiene código?</span>
              <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.mut }}>Ponle el código a los productos de la tienda que no lo tienen</span>
            </span>
            <IcoRight size={18} color={C.mutL} sw={2.4} />
          </button>
        </div>
      )}
      <FichaProducto key={clave} modo="fuera" proveedores={provs} onCerrar={onFin} onListo={(r) => { if (r.existente) onFin(); else setHecho(r); }} />
    </>
  );
}

// ---------- una línea del pedido ----------
function Linea({ l, manual, onCambio, onAsociar }) {
  const dif = l.uds_doc != null && Math.abs(numero(l.q) - Number(l.uds_doc)) > 1e-6;
  const titulo = l.nuevo?.nombre || l.producto?.nombre || l.descripcion;
  const sinProducto = l.tipo === "venta" && !l.producto && l.emparejado !== "nuevo";
  const borde = dif ? `1.5px solid ${C.red}` : sinProducto ? "1.5px solid #E0B94A" : `1px solid ${C.brdL}`;
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "10px 12px", border: borde, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char }}>{titulo}{l.emparejado === "nuevo" && <span style={{ ...chip("#FBF0DA", "#7A5410"), marginLeft: 6 }}>NUEVO</span>}</div>
          {l.emparejado === "nuevo" && !l.product_id && l.nuevo?.auto && <div style={{ fontFamily: F, fontSize: 12, color: "#6B4A0C" }}>No lo tenemos: se da de alta solo al confirmar{l.precio_marcado != null ? ` (precio marcado ${eur(l.precio_marcado)})` : ""}. <button type="button" onClick={() => onAsociar("buscar")} style={{ background: "none", border: "none", padding: 0, fontFamily: F, fontSize: 12, color: "#6B4A0C", textDecoration: "underline", cursor: "pointer" }}>No, es otro producto</button></div>}
          {l.emparejado === "nuevo" && !l.product_id && !l.nuevo?.auto && l.nuevo && <div style={{ fontFamily: F, fontSize: 12, color: "#6B4A0C" }}>PVP {eur(l.nuevo.pvp)}{l.nuevo.sin_codigo ? " · sin código" : l.nuevo.codigo ? ` · ${l.nuevo.codigo}` : ""} · se da de alta al confirmar. <button type="button" onClick={() => onAsociar("editar")} style={{ background: "none", border: "none", padding: 0, fontFamily: F, fontSize: 12, color: "#6B4A0C", textDecoration: "underline", cursor: "pointer" }}>Cambiar</button></div>}
          {l.descripcion && l.descripcion !== titulo && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut }}>{l.via === "foto" ? "Leído: «" + l.descripcion + "»" : l.descripcion}</div>}
          {l.cant_doc != null && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut }}>Factura: {fmt(l.cant_doc)}{Number(l.unidades_por) > 1 ? ` × ${fmt(l.unidades_por)} uds` : ""}{l.base_unit != null ? ` · ${eur(l.base_unit)}/ud sin IVA` : ""}</div>}
          {l.tipo !== "venta" && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut }}>No es de venta: no suma stock</div>}
          {dif && <div style={{ fontFamily: F, fontSize: 11.5, color: "#A3362B", fontWeight: 600 }}>El documento dice {fmt(l.uds_doc)}</div>}
        </div>
        {l.tipo === "venta" && <Cantidad valor={l.q} etiqueta={titulo} onCambio={(v) => onCambio({ q: v })} />}
      </div>
      {l.tipo === "venta" && l.cant_doc != null && !l.unidades_conocidas && l.emparejado !== "nuevo" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F, fontSize: 12.5, color: "#6B4A0C" }}>
          ¿Cuántas unidades trae cada una de la factura?
          <input inputMode="numeric" value={l.unidades_por_txt ?? fmt(l.unidades_por)} onChange={(e) => { const u = numero(e.target.value) || 1; onCambio({ unidades_por_txt: e.target.value, unidades_por: u, q: fmt(Number(l.cant_doc) * u), uds_doc: Number(l.cant_doc) * u }); }}
            style={{ width: 56, height: 36, textAlign: "center", border: `1px solid ${C.brd}`, borderRadius: 10, fontFamily: F, fontSize: 15 }} aria-label="Unidades por bulto" />
        </label>
      )}
      {manual && l.tipo === "venta" && l.emparejado !== "nuevo" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F, fontSize: 12.5, color: C.mut }}>
          Coste (sin IVA)
          <input inputMode="decimal" value={l.coste_txt ?? ""} onChange={(e) => onCambio({ coste_txt: e.target.value })} placeholder={l.coste_ref != null ? fmt(l.coste_ref) : "0,00"} style={{ width: 80, height: 36, textAlign: "center", border: `1px solid ${C.brd}`, borderRadius: 10, fontFamily: F, fontSize: 15 }} aria-label="Coste sin IVA" />
        </label>
      )}
      {sinProducto && (
        <div style={{ background: "#FBF0DA", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: "#6B4A0C" }}>¿Qué producto es?</div>
          {(l.nuevo?.candidatos || []).slice(0, 3).map((c) => (
            <button key={c.id} type="button" onClick={() => onCambio({ producto: { id: c.id, nombre: c.nombre, pvp: c.pvp }, product_id: c.id, emparejado: "ok" })} style={{ ...btnPeq, justifyContent: "flex-start", borderColor: C.grn, color: "#1E6B3C", textAlign: "left" }}>{c.nombre}</button>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button type="button" onClick={() => onAsociar("buscar")} style={btnPeq}>Buscar otro</button>
            <button type="button" onClick={() => onAsociar("nuevo")} style={btnPeq}>Es nuevo</button>
          </div>
          <button type="button" onClick={() => onCambio({ tipo: "uso_interno" })} style={{ background: "none", border: "none", fontFamily: F, fontSize: 12.5, color: C.mut, textDecoration: "underline", cursor: "pointer" }}>No es para vender (limpieza, bolsas…)</button>
        </div>
      )}
      {l.emparejado === "propuesta" && l.producto && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F, fontSize: 12, color: "#6B4A0C" }}>
          <span style={{ flex: 1 }}>Lo he asociado por el nombre. ¿Es este producto?</span>
          <button type="button" onClick={() => onCambio({ emparejado: "ok" })} style={{ ...btnPeq, height: 36, padding: "0 10px" }}>Sí</button>
          <button type="button" onClick={() => onAsociar("buscar")} style={{ ...btnPeq, height: 36, padding: "0 10px" }}>Cambiar</button>
        </div>
      )}
    </div>
  );
}

// ---------- revisar y confirmar ----------
function Revisar({ datos, onHecho, onVolver }) {
  const { recepcion: rec, proveedor: prov } = datos;
  const manual = rec.via === "manual";
  const [lineas, setLineas] = useState(() => (datos.lineas || []).map((l) => ({ ...l, via: rec.via, q: fmt(l.uds_confirmadas ?? l.uds_doc ?? 0) })));
  const [panel, setPanel] = useState(null); // {modo:'buscar'|'nuevo'|'anadir', idx}
  const [detalleAbierto, setDetalleAbierto] = useState(!(prov && prov.revision === false) || manual);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(datos.aviso || "");
  const cambiar = (i, cambio) => setLineas((ls) => ls.map((l, k) => (k === i ? { ...l, ...cambio } : l)));
  const pendientes = lineas.filter((l) => l.tipo === "venta" && !l.producto && l.emparejado !== "nuevo" && numero(l.q) > 0).length;
  const difs = lineas.filter((l) => l.uds_doc != null && Math.abs(numero(l.q) - Number(l.uds_doc)) > 1e-6).length;
  const total = lineas.filter((l) => l.tipo === "venta").reduce((s, l) => s + numero(l.q), 0);

  const anadir = (p) => {
    setLineas((ls) => [...ls, { id: null, via: rec.via, descripcion: p.nombre, producto: p, product_id: p.id, tipo: "venta", emparejado: "ok", anadida: true, q: "1", coste_ref: p.coste != null ? Math.round(p.coste * 100) / 100 : null }]);
    setPanel(null);
  };
  const confirmar = async () => {
    if (pendientes) { setMsg(`Falta decir qué producto es en ${pendientes} línea${pendientes > 1 ? "s" : ""}`); setDetalleAbierto(true); return; }
    if (!lineas.some((l) => numero(l.q) > 0)) { setMsg("No hay nada que recepcionar"); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fn("confirmar", {
        id: rec.id,
        lineas: lineas.map((l) => ({ id: l.id || undefined, product_id: l.product_id ?? l.producto?.id ?? null, uds_confirmadas: numero(l.q), tipo: l.tipo, unidades_por: l.unidades_por, descripcion: l.descripcion, nuevo: l.emparejado === "nuevo" && !l.product_id ? l.nuevo : undefined, coste_sin_iva: l.emparejado === "nuevo" ? undefined : l.coste_txt ? numero(l.coste_txt) : manual && l.coste_ref != null ? l.coste_ref : undefined })),
      });
      onHecho(r);
    } catch (e) { setMsg(e.message || "No se ha podido confirmar"); }
    setBusy(false);
  };
  const descartar = async () => {
    if (!window.confirm("¿Descartar este pedido? No se suma nada.")) return;
    try { await fn("descartar", { id: rec.id }); onVolver(true); } catch (e) { setMsg(e.message); }
  };

  if (panel?.modo === "buscar" || panel?.modo === "anadir") return (
    <div style={{ padding: "18px 16px" }}>
      <Buscador supplierId={prov?.supplier_id} titulo={panel.modo === "anadir" ? `Añadir de ${rec.proveedor}` : "¿Qué producto es?"} permitirNuevo
        onCerrar={() => setPanel(null)}
        onNuevo={(q) => setPanel({ modo: "nuevo", idx: panel.modo === "anadir" ? null : panel.idx, nombre: q })}
        onElegir={(p) => { if (panel.modo === "anadir") anadir(p); else { cambiar(panel.idx, { producto: p, product_id: p.id, emparejado: "ok", tipo: "venta" }); setPanel(null); } }} />
    </div>
  );
  if (panel?.modo === "nuevo" || panel?.modo === "editar") {
    const l = panel.idx != null ? lineas[panel.idx] : null;
    const inicial = l?.nuevo && !l.nuevo.auto && l.nuevo.pvp != null
      ? { ...l.nuevo, unidades: numero(l.q) }
      : { nombre: panel.nombre || (l ? (l.nuevo?.nombre || l.descripcion) : ""), unidades: l ? numero(l.q) || null : null, coste: l?.base_unit ?? null, marcado: l?.precio_marcado != null ? true : null, precio_marcado: l?.precio_marcado ?? null };
    return (
      <FichaProducto modo="pedido" recepcion={rec} proveedor={prov || { nombre: rec.proveedor, supplier_id: rec.supplier_id }} inicial={inicial}
        onCerrar={() => setPanel(null)}
        onListo={(r) => {
          if (r.nuevo) {
            const n = r.nuevo; const cambio = { emparejado: "nuevo", nuevo: { ...n }, producto: null, product_id: null, tipo: "venta", q: fmt(n.unidades) };
            if (l) cambiar(panel.idx, cambio); else setLineas((ls) => [...ls, { id: null, via: rec.via, descripcion: n.nombre, anadida: true, ...cambio }]);
          } else if (r.existente) {
            const p = r.existente; const cambio = { producto: { id: p.id, nombre: p.nombre, pvp: p.pvp }, product_id: p.id, emparejado: "ok", nuevo: null, tipo: "venta", q: fmt(r.unidades || 1) };
            if (l) cambiar(panel.idx, cambio); else setLineas((ls) => [...ls, { id: null, via: rec.via, descripcion: p.nombre, anadida: true, ...cambio }]);
          } else if (r.incidencia) setMsg("Incidencia mandada a dirección. Ese producto no se ha añadido al pedido.");
          setPanel(null);
        }} />
    );
  }

  return (
    <div style={{ padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 540, margin: "0 auto" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: SF, fontSize: 22, color: C.char, flex: 1 }}>{rec.proveedor}</span>
          {CHIPS[rec.via] && <span style={chip(CHIPS[rec.via][0], CHIPS[rec.via][1])}>{CHIPS[rec.via][2]}</span>}
        </div>
        <div style={{ fontFamily: F, fontSize: 12, color: C.mut }}>{[rec.doc_tipo === "albaran" ? "Albarán" : rec.doc_tipo === "factura" ? "Factura" : null, rec.doc_numero, rec.total != null ? eur(rec.total) : null].filter(Boolean).join(" · ") || (manual ? "Sin factura: apunta lo que ha llegado" : "")}</div>
      </div>
      {rec.prueba && <div style={{ fontFamily: F, fontSize: 12.5, background: "#EAF0F8", color: "#2F5C8F", borderRadius: 12, padding: "8px 12px" }}>Modo prueba hasta el inventario: se guarda todo, pero el stock de la caja aún no cambia. Los productos nuevos sí se dan de alta en la caja.</div>}
      <Aviso msg={msg} tipo={msg && /ya estaba/.test(msg) ? "bien" : "mal"} />

      {!detalleAbierto ? (
        <div style={card}>
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 600 }}>{lineas.length} productos · {fmt(total)} unidades</div>
          <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Este proveedor no hace falta contarlo línea a línea. Si algo no cuadra, abre el detalle.</div>
          <button type="button" onClick={() => setDetalleAbierto(true)} style={btnPeq}>Ver el detalle</button>
        </div>
      ) : (
        <>
          {!manual && <p style={{ margin: 0, fontFamily: F, fontSize: 13, color: C.mut }}>Salen las unidades del documento. Cuenta lo que ha llegado y cambia lo que no coincida.</p>}
          {manual && <p style={{ margin: 0, fontFamily: F, fontSize: 13, color: C.mut }}>Pon solo lo que ha llegado. El coste sale de la última compra (sin IVA): cámbialo si es otro.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lineas.map((l, i) => <Linea key={l.id ?? `n${i}`} l={l} manual={manual} onCambio={(c) => cambiar(i, c)} onAsociar={(modo) => setPanel({ modo, idx: i })} />)}
          </div>
          <button type="button" onClick={() => setPanel({ modo: "anadir" })} style={{ height: 46, borderRadius: 12, border: "1.5px dashed #C9C0B0", background: "transparent", fontFamily: F, fontSize: 13.5, fontWeight: 600, color: "#4A4236", cursor: "pointer" }}>{manual ? "+ Añadir producto" : "+ Ha llegado algo que no está en la lista"}</button>
          <button type="button" onClick={() => setPanel({ modo: "nuevo" })} style={{ height: 46, borderRadius: 12, border: `1.5px solid ${C.char}`, background: "#fff", fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.char, cursor: "pointer" }}>+ Producto nuevo (no lo tenemos dado de alta)</button>
        </>
      )}

      {difs > 0 && <div style={{ fontFamily: F, fontSize: 12.5, color: "#A3362B" }}>{difs} línea{difs > 1 ? "s" : ""} no coincide{difs > 1 ? "n" : ""} con el documento: queda apuntado para reclamar.</div>}
      <button type="button" disabled={busy} onClick={confirmar} style={{ ...btnDark, background: C.grn, color: "#fff", fontSize: 18, padding: 16, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Confirmar recepción"}</button>
      <button type="button" onClick={descartar} style={{ background: "none", border: "none", fontFamily: F, fontSize: 13, color: C.mut, textDecoration: "underline", cursor: "pointer" }}>Descartar este pedido</button>
    </div>
  );
}

// ---------- hecho ----------
function Hecho({ r, onFin }) {
  const fila = (ok, texto) => (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontFamily: F, fontSize: 13.5 }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{ok ? <IcoCheck size={18} color={C.grn} sw={2.4} /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A3362B" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>}</span>
      <span>{texto}</span>
    </div>
  );
  return (
    <div style={{ padding: "36px 16px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
        <span style={{ width: 72, height: 72, borderRadius: 999, background: "#EAF4EE", display: "flex", alignItems: "center", justifyContent: "center" }}><IcoCheck size={36} color={C.grn} sw={2.4} /></span>
        <div style={{ fontFamily: SF, fontSize: 26 }}>Pedido recepcionado</div>
        <div style={{ fontFamily: F, fontSize: 14, color: C.mut }}>{r.proveedor} · {r.productos} productos · {fmt(r.unidades)} unidades</div>
      </div>
      <div style={card}>
        {r.prueba ? fila(true, "Guardado. Modo prueba: el stock de la caja empieza a sumar tras el inventario.") : r.stock?.aplicado ? fila(true, "Stock sumado en la caja") : fila(false, r.stock?.errores?.length ? "No se ha podido sumar todo el stock: dirección ya está avisada" : "Guardado. El stock de la caja aún no se suma automáticamente.")}
        {r.diferencias?.length ? fila(false, `${r.diferencias.length} diferencia${r.diferencias.length > 1 ? "s" : ""} apuntada${r.diferencias.length > 1 ? "s" : ""} para reclamar: ${r.diferencias.map((d) => `${d.descripcion} (${fmt(d.recibido - d.doc)})`).join(", ")}`) : fila(true, "Todo coincide con el documento")}
        {r.altas?.length ? fila(true, `${r.altas.length} producto${r.altas.length > 1 ? "s" : ""} nuevo${r.altas.length > 1 ? "s" : ""} dado${r.altas.length > 1 ? "s" : ""} de alta en la caja: ${r.altas.map((a) => `${a.nombre} (${eur(a.pvp)})`).join(", ")}`) : null}
        {r.fallos_alta?.length ? fila(false, `No se ha podido dar de alta: ${r.fallos_alta.join("; ")}. Dirección ya está avisada.`) : null}
        {r.precios_por_aprobar ? fila(true, `${r.precios_por_aprobar} precio${r.precios_por_aprobar > 1 ? "s" : ""} para que dirección los revise`) : fila(true, "Ningún precio de venta cambia")}
      </div>
      <div style={{ ...card, background: "#FBF0DA", border: "1px solid #E0B94A" }}>
        <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#6B4A0C" }}>Antes de colocar</div>
        <div style={{ fontFamily: F, fontSize: 13.5 }}>Saca a la tienda primero lo que ya había (lo más antiguo delante).</div>
      </div>
      <button type="button" onClick={onFin} style={btnDark}>Volver a los pedidos</button>
    </div>
  );
}

// ---------- vista principal ----------
export function RecepcionView({ onContar }) {
  const [vista, setVista] = useState("lista"); // lista | proveedor | leyendo | revisar | hecho
  const [datos, setDatos] = useState(null);
  const [lista, setLista] = useState(null);
  const [provs, setProvs] = useState([]);
  const [prueba, setPrueba] = useState(false);
  const [elegido, setElegido] = useState(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [avisoBien, setAvisoBien] = useState("");
  const [resultado, setResultado] = useState(null);
  const [sinCodigo, setSinCodigo] = useState(0);
  const [espera, setEspera] = useState(null); // pedido que espera su factura y al que se añade un producto nuevo
  const fotoInput = useRef(null);
  const destinoFoto = useRef(null); // {proveedor, recepcion_id}

  const cargar = useCallback(async () => {
    try { const r = await fn("inicio"); setLista(r.pendientes || []); setProvs(r.proveedores || []); setPrueba(!!r.prueba); setSinCodigo(r.sin_codigo || 0); onContar && onContar((r.pendientes || []).length); }
    catch (e) { setMsg(e.message || "No se han podido cargar los pedidos"); setLista([]); }
  }, [onContar]);
  useEffect(() => { cargar(); }, [cargar]);

  const abrir = async (id) => { setMsg(""); setVista("leyendo"); try { setDatos(await fn("abrir", { id })); setVista("revisar"); } catch (e) { setMsg(e.message); setVista("lista"); } };
  const pedirFoto = (proveedor, recepcion_id) => { destinoFoto.current = { proveedor, recepcion_id }; setMsg(""); fotoInput.current?.click(); };
  const fotoElegida = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 4); e.target.value = "";
    if (!files.length) return;
    setVista("leyendo"); setMsg("");
    try {
      const fotos = await Promise.all(files.map(prepararFoto));
      const d = destinoFoto.current || {};
      const r = await fn("leer_foto", { supplier_id: d.proveedor?.supplier_id, proveedor: d.proveedor?.nombre, recepcion_id: d.recepcion_id, fotos });
      setDatos(r); setVista("revisar");
    } catch (er) { setMsg(er.message || "No he podido leer la foto"); setVista(elegido ? "proveedor" : "lista"); }
  };
  const manual = async (p) => { setVista("leyendo"); try { setDatos(await fn("crear_manual", { supplier_id: p.supplier_id, proveedor: p.nombre })); setVista("revisar"); } catch (e) { setMsg(e.message); setVista("proveedor"); } };
  const haLlegado = async (p) => { try { await fn("ha_llegado", { supplier_id: p.supplier_id, proveedor: p.nombre }); setElegido(null); setVista("lista"); setMsg(""); cargar(); } catch (e) { setMsg(e.message); } };

  const input = <input ref={fotoInput} type="file" accept="image/*" capture="environment" multiple onChange={fotoElegida} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />;

  if (vista === "leyendo") return <div>{input}<Cargando texto={destinoFoto.current && !datos ? "Leyendo el documento… tarda unos 20 segundos" : "Un momento…"} /></div>;
  if (vista === "revisar" && datos) return <div>{input}<Revisar datos={datos} onVolver={(recargar) => { setDatos(null); setVista("lista"); if (recargar) cargar(); }} onHecho={(r) => { setResultado(r); setDatos(null); setVista(r.sin_codigo?.length ? "sincodigo" : "hecho"); }} /></div>;
  if (vista === "sincodigo") return <SinCodigo productos={resultado?.sin_codigo?.length ? resultado.sin_codigo.map((a) => ({ ...a, id: a.alta_id })) : null} onTerminar={() => { if (resultado) setVista("hecho"); else { setVista("lista"); cargar(); } }} />;
  if (vista === "espera" && espera) return <FichaProducto modo="espera" recepcion={espera} proveedor={{ nombre: espera.proveedor, supplier_id: espera.supplier_id }} onCerrar={() => { setEspera(null); setVista("lista"); }}
    onListo={(r) => { setEspera(null); setVista("lista"); setMsg(""); if (r.alta) { setAvisoBien(`${r.alta.nombre} dado de alta a ${eur(r.alta.pvp)} y añadido al pedido de ${espera.proveedor}.`); cargar(); } else if (r.incidencia) setAvisoBien("Incidencia mandada a dirección."); }} />;
  if (vista === "hecho" && resultado) return <Hecho r={resultado} onFin={() => { setResultado(null); setElegido(null); destinoFoto.current = null; setVista("lista"); cargar(); }} />;

  if (vista === "proveedor") {
    if (elegido) {
      const p = elegido;
      return (
        <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 540, margin: "0 auto" }}>
          {input}
          <div style={{ fontFamily: SF, fontSize: 22 }}>{p.nombre}</div>
          <Aviso msg={msg} />
          <button type="button" onClick={() => pedirFoto(p, null)} style={{ ...btnDark, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>Hacer foto de la factura o albarán</button>
          {p.canal === "email" && <button type="button" onClick={() => haLlegado(p)} style={{ ...btnGhost, minHeight: 48 }}>Ha llegado, la factura viene por correo</button>}
          <button type="button" onClick={() => manual(p)} style={{ ...btnGhost, minHeight: 48 }}>No hay papel: apuntar a mano</button>
          {p.canal === "email" && <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>Si esperas al correo, el pedido queda pendiente y te aviso cuando llegue la factura.</div>}
          <button type="button" onClick={() => { setElegido(null); setMsg(""); }} style={{ background: "none", border: "none", fontFamily: F, fontSize: 13, color: C.mut, textDecoration: "underline", cursor: "pointer" }}>Elegir otro proveedor</button>
        </div>
      );
    }
    const filtrados = provs.filter((p) => !q || p.nombre.toLowerCase().includes(q.toLowerCase()));
    return (
      <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 10, maxWidth: 540, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: SF, fontSize: 20 }}>¿De qué proveedor?</div>
          <button type="button" onClick={() => setVista("lista")} style={{ ...btnPeq, height: 38 }}>Volver</button>
        </div>
        <label htmlFor="busca-prov" style={{ position: "absolute", left: -9999 }}>Buscar proveedor</label>
        <input id="busca-prov" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar proveedor…" style={inp} />
        {filtrados.map((p) => (
          <button key={p.nombre} type="button" onClick={() => setElegido(p)} style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: "12px 14px", minHeight: 48, fontFamily: F, fontSize: 15, fontWeight: 600, color: C.char, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1 }}>{p.nombre}</span>
            {p.canal && CHIPS[p.canal] && <span style={chip(CHIPS[p.canal][0], CHIPS[p.canal][1])}>{CHIPS[p.canal][2]}</span>}
          </button>
        ))}
      </div>
    );
  }

  // lista de pedidos por recepcionar
  return (
    <div style={{ padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 540, margin: "0 auto" }}>
      {input}
      <p style={{ margin: 0, fontFamily: F, fontSize: 13, color: C.mut }}>Elige el pedido que acaba de llegar. El stock sube cuando confirmas.</p>
      {prueba && <div style={{ fontFamily: F, fontSize: 12.5, background: "#EAF0F8", color: "#2F5C8F", borderRadius: 12, padding: "8px 12px" }}>Modo prueba hasta el inventario: el stock de la caja aún no cambia. Ojo: los productos nuevos que des de alta sí entran en la caja.</div>}
      <Aviso msg={msg} />
      <Aviso msg={avisoBien} tipo="bien" />
      {sinCodigo > 0 && (
        <button type="button" onClick={() => { setResultado(null); setVista("sincodigo"); }} style={{ ...card, flexDirection: "row", alignItems: "center", cursor: "pointer", border: "1.5px solid #E0B94A", background: "#FBF0DA", textAlign: "left" }}>
          <span style={{ flex: 1, fontFamily: F, fontSize: 14, fontWeight: 600, color: "#6B4A0C" }}>Hay {sinCodigo} producto{sinCodigo > 1 ? "s" : ""} nuevo{sinCodigo > 1 ? "s" : ""} sin código de barras: pásale{sinCodigo > 1 ? "s" : ""} la pistola</span>
          <IcoRight size={18} color="#6B4A0C" />
        </button>
      )}
      {lista === null ? <Cargando /> : lista.length === 0 ? (
        <div style={{ ...card, alignItems: "center", textAlign: "center" }}><div style={{ fontFamily: F, fontSize: 14, color: C.mut }}>No hay pedidos pendientes.</div></div>
      ) : lista.map((r) => {
        const esp = r.estado === "esperando_documento";
        const ch = CHIPS[r.via];
        return (
          <div key={r.id} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: SF, fontSize: 19, flex: 1 }}>{r.proveedor}</span>
              {ch && <span style={chip(ch[0], ch[1])}>{ch[2]}</span>}
            </div>
            {esp ? (
              <>
                <div style={{ fontFamily: F, fontSize: 13, color: "#8A5A0B", fontWeight: 600 }}>Esperando la factura por correo</div>
                <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Llegó el {new Date(r.llegada_en || r.creado_en).toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}. Puedes esperar o adelantarte con una foto.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button type="button" onClick={() => pedirFoto({ nombre: r.proveedor, supplier_id: r.supplier_id }, r.id)} style={btnPeq}>Hacer foto</button>
                  <button type="button" onClick={() => { setAvisoBien(""); setEspera(r); setVista("espera"); }} style={{ ...btnPeq, borderColor: C.char }}>+ Producto nuevo</button>
                </div>
                {r.lineas > 0 && <div style={{ fontFamily: F, fontSize: 12, color: C.mut }}>{r.lineas} producto{r.lineas > 1 ? "s" : ""} nuevo{r.lineas > 1 ? "s" : ""} ya añadido{r.lineas > 1 ? "s" : ""}: se cuentan cuando llegue la factura</div>}
              </>
            ) : (
              <>
                {r.via === "email" && <div style={{ fontFamily: F, fontSize: 13, color: "#1E6B3C", fontWeight: 600 }}>Factura recibida{r.doc_numero ? ` · ${r.doc_numero}` : ""}</div>}
                <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>{r.lineas} producto{r.lineas === 1 ? "" : "s"}{r.total != null ? ` · ${eur(r.total)}` : ""}{r.via !== "email" ? " · sin terminar" : ""}</div>
                <button type="button" onClick={() => abrir(r.id)} style={{ ...btnDark, padding: 13 }}>{r.via === "email" ? "Revisar y recepcionar" : "Seguir"}</button>
              </>
            )}
          </div>
        );
      })}
      <button type="button" onClick={() => { setElegido(null); setQ(""); setMsg(""); setVista("proveedor"); }} style={{ height: 52, borderRadius: 14, border: "1.5px dashed #C9C0B0", background: "transparent", fontFamily: F, fontSize: 15, fontWeight: 600, color: "#4A4236", cursor: "pointer" }}>+ Ha llegado un pedido</button>
    </div>
  );
}
