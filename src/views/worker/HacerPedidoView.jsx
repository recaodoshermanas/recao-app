import { useState, useEffect, useCallback } from "react";
import { F, SF, C, SHADOW, btnDark, btnGhost, inp } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

// #143 Hacer pedido: pedidos a proveedores calculados con ventas y stock (solo Ana Mari y dirección).
// El pedido NO toca el stock: solo la recepción lo hace.
const card = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 14, boxShadow: SHADOW.card };
const wrap = { padding: "16px 16px 28px", maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 };
const FORMAS = { whatsapp: "WhatsApp", app: "App del proveedor", comercial: "Comercial" };
const num = (x) => (x == null ? "–" : Number(x).toLocaleString("es-ES", { maximumFractionDigits: 1 }));
const fechaCorta = (f) => (f ? new Date(f).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "nunca");

export function HacerPedidoView() {
  const [provs, setProvs] = useState(null);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState("");
  const cargar = useCallback(async () => { try { setProvs(await sb.rpc("pedido_proveedores")); } catch (e) { setErr(e.message || "No se han podido cargar los proveedores"); setProvs([]); } }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (sel) return <Proveedor p={sel} onVolver={() => { setSel(null); cargar(); }} />;
  if (!provs) return <div style={{ padding: 30, textAlign: "center", fontFamily: F, color: C.mut }}>Cargando…</div>;
  return (
    <div style={wrap}>
      <div style={{ fontFamily: F, fontSize: 13, color: C.mut, lineHeight: 1.45 }}>Elige el proveedor. Salen ordenados por lo que se ha vendido en los últimos 28 días.</div>
      {err && <div style={{ fontFamily: F, fontSize: 13, color: C.red }}>{err}</div>}
      {provs.map(p => (
        <button key={p.supplier_id} type="button" onClick={() => setSel(p)} style={{ ...card, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: C.char }}>{p.nombre}</span>
          <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>
            {p.forma ? `${FORMAS[p.forma]} · ${p.veces_semana} ${p.veces_semana === 1 ? "vez" : "veces"} por semana` : "Sin configurar"} · Último pedido: {fechaCorta(p.ultimo_pedido)}
          </span>
        </button>
      ))}
    </div>
  );
}

function Ajustes({ p, onGuardado }) {
  const [forma, setForma] = useState(p.forma || "whatsapp");
  const [tel, setTel] = useState(p.telefono || "");
  const [veces, setVeces] = useState(p.veces_semana || 1);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const guardar = async () => {
    setBusy(true); setMsg("");
    try { await sb.rpc("pedido_config_guardar", { p_supplier: p.supplier_id, p_forma: forma, p_telefono: tel, p_veces: Number(veces) }); onGuardado({ ...p, forma, telefono: tel, veces_semana: Number(veces) }); }
    catch (e) { setMsg(e.message || "No se ha podido guardar"); }
    setBusy(false);
  };
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontFamily: SF, fontSize: 18 }}>Cómo se pide a {p.nombre}</div>
      <label style={{ fontFamily: F, fontSize: 13 }}>Forma de pedido
        <select value={forma} onChange={e => setForma(e.target.value)} style={{ ...inp, marginTop: 4 }}>
          {Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {forma === "whatsapp" && <label style={{ fontFamily: F, fontSize: 13 }}>Teléfono de WhatsApp (con prefijo, por ejemplo 34600111222)
        <input value={tel} onChange={e => setTel(e.target.value)} inputMode="tel" style={{ ...inp, marginTop: 4 }} />
      </label>}
      <label style={{ fontFamily: F, fontSize: 13 }}>Veces por semana que se le pide
        <select value={veces} onChange={e => setVeces(e.target.value)} style={{ ...inp, marginTop: 4 }}>
          {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.red }}>{msg}</div>}
      <button type="button" disabled={busy} onClick={guardar} style={btnDark}>{busy ? "Guardando…" : "Guardar"}</button>
    </div>
  );
}

function Proveedor({ p: p0, onVolver }) {
  const [p, setP] = useState(p0);
  const [ajustes, setAjustes] = useState(!p0.forma);
  const [d, setD] = useState(null);
  const [cant, setCant] = useState({});
  const [err, setErr] = useState("");
  const [hecho, setHecho] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [edit, setEdit] = useState({});
  const [cajaBusy, setCajaBusy] = useState(null);
  const [quitados, setQuitados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [aviso, setAviso] = useState("");

  const calcular = useCallback(async () => {
    setD(null); setErr("");
    try {
      const r = await sb.rpc("pedido_calcular", { p_supplier: p.supplier_id });
      setD(r); setCant(Object.fromEntries((r.lineas || []).map(l => [l.product_id, Number(l.cantidad)])));
    } catch (e) { setErr(e.message || "No se ha podido calcular el pedido"); setD({ lineas: [] }); }
  }, [p.supplier_id]);
  useEffect(() => { if (p.forma) calcular(); }, [p.forma, p.veces_semana, calcular]);

  const paso = (l) => l.unidades_caja || 1;
  const cambiar = (l, dir) => setCant(c => ({ ...c, [l.product_id]: Math.max(0, (c[l.product_id] || 0) + dir * paso(l)) }));
  // #175 «Viene por cajas»: se guarda en la ficha del producto y vale para los siguientes pedidos.
  const guardarCaja = async (l, porCajas, txt) => {
    const n = parseInt(txt, 10);
    if (porCajas && !(Number.isInteger(n) && n >= 2 && n <= 999)) { setErr("Pon las unidades por caja: un número entero entre 2 y 999."); return; }
    setCajaBusy(l.product_id); setErr("");
    try {
      await sb.rpc("pedido_caja_guardar", { p_product: l.product_id, p_por_cajas: porCajas, p_unidades: porCajas ? n : null });
      let nl = null;
      try { const r = await sb.rpc("pedido_calcular", { p_supplier: p.supplier_id }); nl = (r.lineas || []).find(x => x.product_id === l.product_id) || null; } catch { /* se ajusta en local */ }
      const viejo = cant[l.product_id] || 0;
      const uc = porCajas ? n : null;
      const nuevaCant = nl ? Number(nl.cantidad) : porCajas ? Math.ceil(viejo / n) * n : (viejo > 0 ? Math.max(viejo, 3) : 0);
      setD(prev => ({ ...prev, lineas: prev.lineas.map(x => x.product_id !== l.product_id ? x : { ...x, unidades_caja: uc, ...(nl ? { motivo: nl.motivo } : {}) }) }));
      setCant(c => ({ ...c, [l.product_id]: nuevaCant }));
      setEdit(e => { const { [l.product_id]: _, ...resto } = e; return resto; });
    } catch (e) { setErr(e.message || "No se ha podido guardar"); }
    setCajaBusy(null);
  };
  // #176 Escribir la cantidad con el teclado (en cajas si el producto va por cajas).
  const escribir = (l, txt) => { const v = parseInt(String(txt).replace(/\D/g, ""), 10) || 0; setCant(c => ({ ...c, [l.product_id]: Math.min(v, 9999) * paso(l) })); };
  // #176 «No se pide aquí»: quita la línea solo de este pedido (se puede deshacer hasta enviarlo).
  const quitar = (l) => setQuitados(x => [...x, l.product_id]);
  const deshacerQuitar = (id) => setQuitados(x => x.filter(i => i !== id));
  // #176 Añadir un producto de otro proveedor: se recuerda para los siguientes pedidos de este proveedor.
  useEffect(() => {
    if (!buscando || q.trim().length < 2) { setRes([]); return undefined; }
    let vivo = true;
    const t = setTimeout(async () => { try { const r = await sb.rpc("pedido_buscar_producto", { p_q: q.trim(), p_supplier: p.supplier_id }); if (vivo) setRes(r || []); } catch (e) { if (vivo) setErr(e.message || "No se ha podido buscar"); } }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, buscando, p.supplier_id]);
  const anadir = async (x) => {
    setErr(""); setAviso("");
    if (quitados.includes(x.product_id)) { deshacerQuitar(x.product_id); setBuscando(false); setQ(""); return; }
    if ((d.lineas || []).some(l => l.product_id === x.product_id)) { setAviso(`«${x.nombre}» ya está en este pedido.`); return; }
    if (x.pendiente && !window.confirm(`Ojo: ${x.nombre} está ${x.pendiente}. ¿Lo añades igualmente?`)) return;
    try {
      if (!x.ya_en_este) await sb.rpc("pedido_extra_anadir", { p_supplier: p.supplier_id, p_product: x.product_id });
      const r = await sb.rpc("pedido_calcular", { p_supplier: p.supplier_id });
      const nl = (r.lineas || []).find(l => l.product_id === x.product_id);
      const linea = nl || { product_id: x.product_id, nombre: x.nombre, clase: "–", unidades_caja: x.unidades_caja, coste: x.coste, cantidad: 0, motivo: "Añadido a mano: escribe la cantidad que quieres pedir." };
      setD(prev => ({ ...prev, lineas: [...(prev.lineas || []), linea] }));
      setCant(c => ({ ...c, [x.product_id]: Number(linea.cantidad) || 0 }));
      setAviso(nl ? `«${x.nombre}» añadido con la cantidad sugerida.` : `«${x.nombre}» añadido: escribe la cantidad.`);
      setBuscando(false); setQ("");
    } catch (e) { setErr(e.message || "No se ha podido añadir el producto"); }
  };
  const visibles = d ? (d.lineas || []).filter(l => !quitados.includes(l.product_id)) : [];
  const lineas = visibles.filter(l => (cant[l.product_id] || 0) > 0);
  const textoLinea = (l) => {
    const q = cant[l.product_id]; const nom = l.nombre_proveedor || l.nombre;
    const ref = l.ref ? ` (ref ${l.ref})` : "";
    if (l.unidades_caja) return `${q / l.unidades_caja} ${q / l.unidades_caja === 1 ? "caja" : "cajas"} de ${nom} (${q} ud)${ref}`;
    return `${q} ud de ${nom}${ref}`;
  };
  const mensaje = `Hola, os paso el pedido:\n${lineas.map(textoLinea).join("\n")}\nGracias`;
  const tel = (p.telefono || "").replace(/\D/g, "");

  const copiar = async () => { try { await navigator.clipboard.writeText(mensaje); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { setErr("No se ha podido copiar"); } };
  const whatsapp = () => window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`, "_blank");
  const hecho_ = async () => {
    setBusy(true); setErr("");
    try {
      await sb.rpc("pedido_guardar", { p_supplier: p.supplier_id, p_forma: p.forma, p_lineas: lineas.map(l => ({ product_id: l.product_id, cantidad: cant[l.product_id], unidades_caja: l.unidades_caja, coste: l.coste, motivo: l.motivo })) });
      setHecho(true);
    } catch (e) { setErr(e.message || "No se ha podido guardar el pedido"); }
    setBusy(false);
  };

  const cab = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={onVolver} style={{ ...btnGhost, padding: "6px 12px" }}>← Proveedores</button>
      <div style={{ flex: 1, fontFamily: SF, fontSize: 18 }}>{p.nombre}</div>
      {p.forma && <button type="button" onClick={() => setAjustes(a => !a)} style={{ ...btnGhost, padding: "6px 12px" }}>Ajustes</button>}
    </div>
  );

  if (hecho) return (
    <div style={wrap}>
      {cab}
      <div style={{ ...card, fontFamily: F, fontSize: 14, lineHeight: 1.5 }}>Pedido guardado ✓ Recuerda que el pedido no cambia el stock: eso ocurre cuando se recepciona.</div>
      <button type="button" onClick={onVolver} style={btnDark}>Volver a proveedores</button>
    </div>
  );

  const bloque = (titulo, items) => items && items.length > 0 && (
    <details style={card}>
      <summary style={{ fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{titulo} ({items.length})</summary>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map(x => <div key={x.product_id} style={{ fontFamily: F, fontSize: 12.5, color: C.mut, lineHeight: 1.4 }}><b style={{ color: C.char }}>{x.nombre}</b> · {x.motivo}</div>)}
      </div>
    </details>
  );

  return (
    <div style={wrap}>
      {cab}
      {(ajustes || !p.forma) && <Ajustes p={p} onGuardado={(np) => { setP(np); setAjustes(false); }} />}
      {err && <div style={{ fontFamily: F, fontSize: 13, color: C.red }}>{err}</div>}
      {p.forma && !d && <div style={{ padding: 20, textAlign: "center", fontFamily: F, color: C.mut }}>Calculando el pedido…</div>}
      {p.forma && d && (
        <>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, lineHeight: 1.45 }}>
            Se pide {p.veces_semana === 1 ? "una vez" : `${p.veces_semana} veces`} por semana. Stock según la foto de la noche del {d.foto_stock ? fechaCorta(d.foto_stock) : "–"} menos lo vendido después. Las cantidades se pueden cambiar con + y −.
          </div>
          {lineas.length === 0 && <div style={{ ...card, fontFamily: F, fontSize: 14 }}>Hoy no hace falta pedir nada a este proveedor.</div>}
          {aviso && <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>{aviso}</div>}
          <button type="button" onClick={() => { setBuscando(b => !b); setQ(""); setRes([]); setAviso(""); }} style={btnGhost}>{buscando ? "Cerrar búsqueda" : "+ Añadir producto"}</button>
          {buscando && (
            <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={q} autoFocus placeholder="Nombre o código de barras" onChange={e => setQ(e.target.value)} style={inp} />
              {q.trim().length >= 2 && res.length === 0 && <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>Sin resultados.</div>}
              {res.map(x => (
                <button key={x.product_id} type="button" onClick={() => anadir(x)} style={{ ...btnGhost, textAlign: "left", display: "flex", flexDirection: "column", gap: 2, padding: "8px 12px" }}>
                  <span style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700 }}>{x.nombre}</span>
                  <span style={{ fontFamily: F, fontSize: 12, color: C.mut }}>{x.proveedor || "Sin proveedor"}{x.ya_en_este ? " · ya es de este proveedor" : ""}</span>
                  {x.pendiente && <span style={{ fontFamily: F, fontSize: 12, color: C.red }}>⚠ {x.pendiente}</span>}
                </button>
              ))}
            </div>
          )}
          {visibles.map(l => (
            <div key={l.product_id} style={{ ...card, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontFamily: F, fontSize: 14.5, fontWeight: 700, color: C.char }}>{l.nombre} <span style={{ fontWeight: 600, fontSize: 11.5, color: C.mut }}>· clase {l.clase}</span></div>
              {(l.nombre_proveedor || l.ref) && <div style={{ fontFamily: F, fontSize: 12, color: C.mut }}>{l.nombre_proveedor}{l.ref ? ` · ref ${l.ref}` : ""}</div>}
              <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, lineHeight: 1.4 }}>Venta semanal {num(l.venta_semana)} · Stock {l.stock == null ? "sin registro" : num(l.stock)}{l.dudoso ? " ⚠ stock dudoso" : ""}<br />{l.motivo}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" aria-label="Menos" onClick={() => cambiar(l, -1)} style={{ ...btnGhost, width: 40, height: 40, padding: 0 }}>−</button>
                <div style={{ minWidth: 90, textAlign: "center", fontFamily: F, fontSize: 15, fontWeight: 700 }}>
                  <input value={String(l.unidades_caja ? Math.round((cant[l.product_id] || 0) / l.unidades_caja) : (cant[l.product_id] || 0))} inputMode="numeric" aria-label="Cantidad" onFocus={e => e.target.select()} onChange={e => escribir(l, e.target.value)} style={{ ...inp, width: 64, textAlign: "center", padding: "6px 4px", fontWeight: 700 }} />
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: C.mut }}>{l.unidades_caja ? `${(cant[l.product_id] || 0) / l.unidades_caja === 1 ? "caja" : "cajas"} · ${cant[l.product_id] || 0} ud` : "ud"}</div>
                </div>
                <button type="button" aria-label="Más" onClick={() => cambiar(l, 1)} style={{ ...btnGhost, width: 40, height: 40, padding: 0 }}>+</button>
                <button type="button" onClick={() => quitar(l)} style={{ ...btnGhost, marginLeft: "auto", padding: "6px 10px", fontSize: 12.5 }}>No se pide aquí</button>
              </div>
              {(() => {
                const ed = edit[l.product_id]; const on = ed ? ed.on : !!l.unidades_caja;
                const txt = ed && ed.txt != null ? ed.txt : (l.unidades_caja ? String(l.unidades_caja) : "");
                const ocupado = cajaBusy === l.product_id;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: `1px solid ${C.brdL}`, paddingTop: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 13, fontWeight: 600 }}>
                      <input type="checkbox" checked={on} disabled={ocupado} onChange={e => { if (e.target.checked) setEdit(x => ({ ...x, [l.product_id]: { on: true, txt } })); else if (l.unidades_caja) guardarCaja(l, false); else setEdit(x => ({ ...x, [l.product_id]: { on: false, txt } })); }} />
                      Viene por cajas
                    </label>
                    {on && <>
                      <input value={txt} inputMode="numeric" placeholder="Unidades por caja" aria-label="Unidades por caja" onChange={e => setEdit(x => ({ ...x, [l.product_id]: { on: true, txt: e.target.value.replace(/\D/g, "") } }))} style={{ ...inp, width: 130, padding: "6px 10px" }} />
                      {String(l.unidades_caja || "") !== txt && <button type="button" disabled={ocupado} onClick={() => guardarCaja(l, true, txt)} style={{ ...btnDark, padding: "6px 12px" }}>{ocupado ? "Guardando…" : "Guardar"}</button>}
                    </>}
                  </div>
                );
              })()}
            </div>
          ))}
          {quitados.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700 }}>Quitados de este pedido ({quitados.length})</div>
              {quitados.map(id => { const l = (d.lineas || []).find(x => x.product_id === id); return l && (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontFamily: F, fontSize: 12.5 }}>
                  <span style={{ flex: 1 }}>{l.nombre}</span>
                  <button type="button" onClick={() => deshacerQuitar(id)} style={{ ...btnGhost, padding: "4px 10px", fontSize: 12.5 }}>Deshacer</button>
                </div>); })}
            </div>
          )}
          {bloque("Esperando a dirección", d.esperando_direccion)}
          {bloque("En observación", d.en_observacion)}
          {bloque("No hace falta todavía", d.no_hace_falta)}
          {bloque("No se piden", d.no_se_piden)}
          {lineas.length > 0 && (
            <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
              {p.forma === "whatsapp" && <>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: F, fontSize: 13, background: C.cream, borderRadius: 10, padding: 10 }}>{mensaje}</pre>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={copiar} style={{ ...btnGhost, flex: 1 }}>{copiado ? "Copiado ✓" : "Copiar"}</button>
                  <button type="button" onClick={whatsapp} disabled={!tel} style={{ ...btnDark, flex: 1 }}>Abrir WhatsApp</button>
                </div>
                {!tel && <div style={{ fontFamily: F, fontSize: 12, color: C.red }}>Falta el teléfono: ponlo en Ajustes.</div>}
              </>}
              {p.forma !== "whatsapp" && <div style={{ fontFamily: F, fontSize: 13, lineHeight: 1.5 }}>
                {lineas.map(l => <div key={l.product_id}>{textoLinea(l)} <span style={{ color: C.mut }}>· {l.nombre}</span></div>)}
              </div>}
              <button type="button" disabled={busy} onClick={hecho_} style={btnDark}>{busy ? "Guardando…" : "Pedido hecho"}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
