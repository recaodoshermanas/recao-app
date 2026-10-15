import { useState, useEffect, useCallback, useRef } from "react";
import { F, SF, C, SHADOW, inp, btnDark, btnGhost, lbl } from "../../lib/styles.js";
import { IcoRight, IcoCheck } from "../../lib/icons.jsx";
import { sb } from "../../lib/supabase.js";

// Recepción de pedidos: la trabajadora confirma lo que ha llegado. El stock sube con lo que ella confirma.
const fn = (accion, datos = {}) => sb.fn("recepcion", { accion, ...datos });
const eur = (x) => (x == null || isNaN(x) ? "" : Number(x).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €");
const numero = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
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

// ---------- producto nuevo ----------
function FormNuevo({ inicial, proveedor, coste, precioMarcado, onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState(inicial?.nombre || "");
  const [codigo, setCodigo] = useState(inicial?.codigo || "");
  const [sinCodigo, setSinCodigo] = useState(!!inicial?.sin_codigo);
  const [pvp, setPvp] = useState(inicial?.pvp != null ? fmt(inicial.pvp) : "");
  const [sug, setSug] = useState(null);
  const [msg, setMsg] = useState("");
  const [camara, setCamara] = useState(false);
  const video = useRef(null);
  useEffect(() => {
    if (!nombre.trim()) return;
    const t = setTimeout(() => fn("precio_sugerido", { nombre, proveedor: proveedor?.nombre, supplier_id: proveedor?.supplier_id, coste_con_iva: coste, precio_marcado: precioMarcado })
      .then((r) => { setSug(r); if (r.pvp != null && (pvp === "" || inicial?.pvp == null)) setPvp(fmt(r.pvp)); }).catch(() => {}), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre]);
  // Escanear con la cámara si el móvil lo permite (la pistola escribe directamente en el campo)
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
          if (r?.[0]?.rawValue) { setCodigo(r[0].rawValue); setSinCodigo(false); setCamara(false); break; }
          await new Promise((s) => setTimeout(s, 250));
        }
      } catch (_) { setMsg("No he podido abrir la cámara."); setCamara(false); }
    })();
    return () => { parar = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [camara]);
  const guardar = () => {
    if (!nombre.trim()) { setMsg("Escribe el nombre del producto"); return; }
    if (!sinCodigo && !/^\d{6,14}$/.test(codigo.trim())) { setMsg("Escanea el código de barras o marca «No tiene código»"); return; }
    if (!(numero(pvp) > 0)) { setMsg("Pon el precio de venta"); return; }
    onGuardar({ nombre: nombre.trim(), codigo: sinCodigo ? null : codigo.trim(), sin_codigo: sinCodigo, pvp: numero(pvp), pvp_sugerido: sug?.pvp ?? null });
  };
  return (
    <div style={{ ...card, border: `1.5px solid ${C.gold}` }}>
      <div style={{ fontFamily: SF, fontSize: 19 }}>Producto nuevo</div>
      <label style={lbl} htmlFor="nv-nombre">Nombre como sale en la caja</label>
      <input id="nv-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ ...inp, marginTop: -6 }} />
      <label style={lbl} htmlFor="nv-cod">Código de barras</label>
      <div style={{ display: "flex", gap: 8, marginTop: -6 }}>
        <input id="nv-cod" inputMode="numeric" value={codigo} disabled={sinCodigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="Pásale la pistola…" style={{ ...inp, flex: 1, minWidth: 0, letterSpacing: "0.04em" }} />
        <button type="button" aria-label="Escanear con la cámara" disabled={sinCodigo} onClick={() => setCamara(true)} style={{ ...btnPeq, width: 52, padding: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.char} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
        </button>
      </div>
      {camara && <video ref={video} muted playsInline style={{ width: "100%", borderRadius: 12, background: "#000" }} />}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F, fontSize: 13.5, color: C.char }}><input type="checkbox" checked={sinCodigo} onChange={(e) => setSinCodigo(e.target.checked)} /> No tiene código (sale en la caja por su nombre)</label>
      <label style={lbl} htmlFor="nv-pvp">Precio de venta</label>
      <input id="nv-pvp" inputMode="decimal" value={pvp} onChange={(e) => setPvp(e.target.value)} placeholder="0,00" style={{ ...inp, marginTop: -6, fontWeight: 600 }} />
      {sug?.motivo && <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: -4 }}>Propuesto: {sug.pvp != null ? eur(sug.pvp) : "—"} · {sug.motivo}. ¿Viene marcado en el envase? Cámbialo aquí; dirección lo revisa.</div>}
      <Aviso msg={msg} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button type="button" onClick={onCerrar} style={btnPeq}>Cancelar</button>
        <button type="button" onClick={guardar} style={{ ...btnPeq, background: C.char, color: C.gold, border: "none", fontFamily: SF, fontSize: 15 }}>Guardar</button>
      </div>
    </div>
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
      {manual && l.tipo === "venta" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F, fontSize: 12.5, color: C.mut }}>
          Coste por unidad con IVA
          <input inputMode="decimal" value={l.coste_txt ?? ""} onChange={(e) => onCambio({ coste_txt: e.target.value })} placeholder={l.coste_ref != null ? fmt(l.coste_ref) : "0,00"} style={{ width: 80, height: 36, textAlign: "center", border: `1px solid ${C.brd}`, borderRadius: 10, fontFamily: F, fontSize: 15 }} aria-label="Coste con IVA" />
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
    setLineas((ls) => [...ls, { id: null, via: rec.via, descripcion: p.nombre, producto: p, product_id: p.id, tipo: "venta", emparejado: "ok", anadida: true, q: "1", coste_ref: p.coste != null && p.iva != null ? Math.round(p.coste * (1 + p.iva / 100) * 100) / 100 : null }]);
    setPanel(null);
  };
  const confirmar = async () => {
    if (pendientes) { setMsg(`Falta decir qué producto es en ${pendientes} línea${pendientes > 1 ? "s" : ""}`); setDetalleAbierto(true); return; }
    if (!lineas.some((l) => numero(l.q) > 0)) { setMsg("No hay nada que recepcionar"); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fn("confirmar", {
        id: rec.id,
        lineas: lineas.map((l) => ({ id: l.id || undefined, product_id: l.product_id ?? l.producto?.id ?? null, uds_confirmadas: numero(l.q), tipo: l.tipo, unidades_por: l.unidades_por, descripcion: l.descripcion, nuevo: l.emparejado === "nuevo" ? l.nuevo : undefined, coste_con_iva: l.coste_txt ? numero(l.coste_txt) : manual && l.coste_ref != null ? l.coste_ref : undefined })),
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
  if (panel?.modo === "nuevo") {
    const l = panel.idx != null ? lineas[panel.idx] : null;
    return (
      <div style={{ padding: "18px 16px" }}>
        <FormNuevo inicial={l?.nuevo?.nombre ? l.nuevo : { nombre: panel.nombre || (l ? l.descripcion : "") }} proveedor={prov} coste={l?.coste_unit ?? null} precioMarcado={l?.precio_marcado ?? null}
          onCerrar={() => setPanel(null)}
          onGuardar={(n) => {
            if (l) cambiar(panel.idx, { emparejado: "nuevo", nuevo: { ...(l.nuevo || {}), ...n }, producto: null, product_id: null, tipo: "venta" });
            else setLineas((ls) => [...ls, { id: null, via: rec.via, descripcion: n.nombre, emparejado: "nuevo", nuevo: n, tipo: "venta", anadida: true, q: "1" }]);
            setPanel(null);
          }} />
      </div>
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
      {rec.prueba && <div style={{ fontFamily: F, fontSize: 12.5, background: "#EAF0F8", color: "#2F5C8F", borderRadius: 12, padding: "8px 12px" }}>Modo prueba hasta el inventario: se guarda todo, pero el stock de la caja aún no cambia.</div>}
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
          {manual && <p style={{ margin: 0, fontFamily: F, fontSize: 13, color: C.mut }}>Añade lo que ha llegado. El coste sale de la última compra: cámbialo si es otro.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lineas.map((l, i) => <Linea key={l.id ?? `n${i}`} l={l} manual={manual} onCambio={(c) => cambiar(i, c)} onAsociar={(modo) => setPanel({ modo, idx: i })} />)}
          </div>
          <button type="button" onClick={() => setPanel({ modo: "anadir" })} style={{ height: 46, borderRadius: 12, border: "1.5px dashed #C9C0B0", background: "transparent", fontFamily: F, fontSize: 13.5, fontWeight: 600, color: "#4A4236", cursor: "pointer" }}>{manual ? "+ Añadir producto" : "+ Ha llegado algo que no está en la lista"}</button>
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
        {r.precios_por_aprobar ? fila(true, `${r.precios_por_aprobar} precio${r.precios_por_aprobar > 1 ? "s" : ""} para que dirección los revise${r.nuevos ? " (incluye los productos nuevos)" : ""}`) : fila(true, "Ningún precio de venta cambia")}
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
  const [resultado, setResultado] = useState(null);
  const fotoInput = useRef(null);
  const destinoFoto = useRef(null); // {proveedor, recepcion_id}

  const cargar = useCallback(async () => {
    try { const r = await fn("inicio"); setLista(r.pendientes || []); setProvs(r.proveedores || []); setPrueba(!!r.prueba); onContar && onContar((r.pendientes || []).length); }
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
  if (vista === "revisar" && datos) return <div>{input}<Revisar datos={datos} onVolver={(recargar) => { setDatos(null); setVista("lista"); if (recargar) cargar(); }} onHecho={(r) => { setResultado(r); setDatos(null); setVista("hecho"); }} /></div>;
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
      {prueba && <div style={{ fontFamily: F, fontSize: 12.5, background: "#EAF0F8", color: "#2F5C8F", borderRadius: 12, padding: "8px 12px" }}>Modo prueba hasta el inventario: practica sin miedo, el stock de la caja aún no cambia.</div>}
      <Aviso msg={msg} />
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
                <button type="button" onClick={() => pedirFoto({ nombre: r.proveedor, supplier_id: r.supplier_id }, r.id)} style={btnPeq}>Hacer foto</button>
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
