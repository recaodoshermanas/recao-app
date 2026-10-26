// Producto · Recepción de pedidos (dirección)
// Lo que dejan las recepciones de las trabajadoras: precios por aprobar, etiquetas por cambiar,
// diferencias para reclamar, avisos, y la ficha de cada proveedor. Nada cambia en Epos sin aprobación.
import { useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Panel, Pestanas, Cargando, avisar, fechaCorta, hace } from "../ui.jsx";
import { eur, pct } from "../fmt.js";

const fn = (accion, datos = {}) => sb.fn("recepcion", { accion, ...datos });
const numero = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : null; };
const MOTIVO = { subida_coste: "Ha subido el coste", producto_nuevo: "Producto nuevo", cambiado_trabajadora: "Nuevo · precio cambiado en tienda", coste_corregido: "Coste corregido con la factura" };
const ESTADO = { esperando_documento: "Esperando factura", por_revisar: "Por recepcionar", confirmada: "Confirmada", con_diferencias: "Con diferencias", descartada: "Descartada" };
const VIA = { email: "Correo", foto: "Foto", manual: "Manual" };
const AVISO = { sin_documento: "Sin factura", diferencia: "Diferencia", sin_codigo: "Sin código", sin_asociar: "Sin asociar", stock_error: "Stock", precio: "Precio", coste_sin_verificar: "Coste sin verificar", alta_error: "Alta fallida", expositor_sin_desglosar: "Expositor sin desglosar", alta_por_error: "Alta por error" };
const margen = (pvp, coste) => (pvp > 0 && coste != null ? (1 - coste / pvp) * 100 : null);

// #66: ids de recepciones cuyo número es el código automático (el servidor no lo manda en sus listas)
function useGenerados(clave) {
  const [ids, setIds] = useState(() => new Set());
  useEffect(() => { sb.select("recepciones", "select=id&doc_numero_generado=is.true").then((r) => setIds(new Set((r || []).map((x) => x.id)))).catch(() => {}); }, [clave]);
  return ids;
}
export function Recepcion() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("precios");
  const [fallo, setFallo] = useState(false);
  const cargar = useCallback(async () => { try { setD(await fn("panel")); setFallo(false); } catch (e) { setFallo(true); avisar(e.message || "No se ha podido cargar", "mal"); } }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!d) return <Cargando texto={fallo ? "No se ha podido cargar la recepción. Recarga en un momento." : "Cargando…"} />;

  const opciones = [
    { id: "precios", label: "Precios por aprobar", n: d.precios.length },
    { id: "etiquetas", label: "Etiquetas por cambiar", n: d.etiquetas.length },
    { id: "diferencias", label: "Diferencias", n: d.diferencias.length },
    { id: "avisos", label: "Avisos", n: d.avisos.length },
    { id: "pedidos", label: "Pedidos" },
    { id: "proveedores", label: "Proveedores" },
    { id: "ajustes", label: "Ajustes" },
  ];
  return (
    <>
      {d.config.prueba && <p className="b-nota" style={{ marginTop: 0 }}>Modo prueba hasta el {fechaCorta(d.config.real_desde)}: las trabajadoras ya pueden recepcionar, pero el stock de Epos no cambia hasta el inventario.</p>}
      <Pestanas valor={tab} opciones={opciones} onChange={setTab} etiqueta="Secciones de recepción" />
      <div className="card mt">
        {tab === "precios" && <Precios lista={d.precios} onCambio={cargar} />}
        {tab === "etiquetas" && <Etiquetas lista={d.etiquetas} onCambio={cargar} />}
        {tab === "diferencias" && <Diferencias lista={d.diferencias} onCambio={cargar} />}
        {tab === "avisos" && <ListaAvisos lista={d.avisos} onCambio={cargar} />}
        {tab === "pedidos" && <Pedidos proveedores={d.proveedores} onCambio={cargar} />}
        {tab === "proveedores" && <Fichas fichas={d.fichas} proveedores={d.proveedores} onCambio={cargar} />}
        {tab === "ajustes" && <Ajustes config={d.config} onCambio={cargar} />}
      </div>
    </>
  );
}

function Precios({ lista, onCambio }) {
  const [valores, setValores] = useState({});
  const [busy, setBusy] = useState(null);
  if (!lista.length) return <p className="empty">No hay precios por aprobar. Aparecen aquí cuando sube el coste de un producto y ya no deja el margen objetivo de su proveedor (35 % por defecto), o cuando llega un producto nuevo.</p>;
  const aprobar = async (c) => {
    const pvp = numero(valores[c.id] ?? c.pvp_propuesto);
    if (!(pvp > 0)) { avisar("Precio no válido", "mal"); return; }
    setBusy(c.id);
    try { await fn("aprobar_precio", { id: c.id, pvp }); avisar(c.product_id ? "Precio cambiado en Epos" : "Producto dado de alta en Epos"); onCambio(); }
    catch (e) { avisar(e.message || "No se ha podido aprobar", "mal"); }
    setBusy(null);
  };
  const rechazar = async (c) => { setBusy(c.id); try { await fn("rechazar_precio", { id: c.id }); avisar("Descartado: el precio no cambia"); onCambio(); } catch (e) { avisar(e.message, "mal"); } setBusy(null); };
  return (
    <>
      <div className="head"><div><h2>Precios por aprobar</h2><p className="sub">Nada cambia en Epos hasta que lo apruebas. Al aprobar, entra en «Etiquetas por cambiar».</p></div></div>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>Producto</th><th className="r">Coste real</th><th className="r">PVP actual</th><th className="r">Propuesto</th><th className="r">Margen</th><th></th></tr></thead>
          <tbody>
            {lista.map((c) => {
              const v = valores[c.id] ?? String(c.pvp_propuesto).replace(".", ",");
              const m = margen(numero(v), c.coste_real != null ? Number(c.coste_real) : null);
              return (
                <tr key={c.id}>
                  <td><span className="pn">{c.nombre}</span><span className="pf">{MOTIVO[c.motivo] || c.motivo} · {hace(c.creado_en)}</span></td>
                  <td className="r">{c.coste_real != null ? eur(c.coste_real, 2) : "—"}</td>
                  <td className="r">{c.pvp_actual != null ? eur(c.pvp_actual, 2) : "—"}</td>
                  <td className="r"><label style={{ position: "absolute", left: -9999 }} htmlFor={`pvp-${c.id}`}>PVP para {c.nombre}</label><input id={`pvp-${c.id}`} className="mini-input" inputMode="decimal" value={v} onChange={(e) => setValores({ ...valores, [c.id]: e.target.value })} style={{ width: 78, textAlign: "right" }} /></td>
                  <td className="r">{m != null ? pct(m, 0) : "—"}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn-p" disabled={busy === c.id} onClick={() => aprobar(c)}>{c.product_id ? "Aprobar" : "Dar de alta"}</button>{" "}
                    <button className="btn-txt" disabled={busy === c.id} onClick={() => rechazar(c)}>No</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Etiquetas({ lista, onCambio }) {
  const [sel, setSel] = useState([]);
  if (!lista.length) return <p className="empty">No hay etiquetas por cambiar.</p>;
  const hecho = async (ids) => { try { await fn("etiqueta_hecha", { ids }); avisar(ids.length > 1 ? "Etiquetas marcadas como cambiadas" : "Etiqueta cambiada"); setSel([]); onCambio(); } catch (e) { avisar(e.message, "mal"); } };
  return (
    <>
      <div className="head">
        <div><h2>Etiquetas por cambiar</h2><p className="sub">Precios ya aprobados en Epos. Cambia la etiqueta en la tienda y márcala.</p></div>
        {sel.length > 0 && <button className="btn-p" onClick={() => hecho(sel)}>Marcar {sel.length} como cambiadas</button>}
      </div>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th></th><th>Producto</th><th className="r">Antes</th><th className="r">Ahora</th><th className="r">Aprobado</th><th></th></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td><input type="checkbox" aria-label={`Seleccionar ${c.nombre}`} checked={sel.includes(c.id)} onChange={(e) => setSel(e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id))} /></td>
                <td><span className="pn">{c.nombre}</span></td>
                <td className="r">{c.pvp_actual != null ? eur(c.pvp_actual, 2) : "nuevo"}</td>
                <td className="r b">{eur(c.pvp_final, 2)}</td>
                <td className="r">{hace(c.decidido_en)}</td>
                <td className="r"><button className="btn-l" onClick={() => hecho([c.id])}>Hecha</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Diferencias({ lista, onCambio }) {
  const gen = useGenerados(lista.length);
  const grupos = useMemo(() => {
    const g = new Map();
    for (const l of lista) { const k = l.recepciones?.proveedor || "—"; if (!g.has(k)) g.set(k, []); g.get(k).push(l); }
    return [...g];
  }, [lista]);
  if (!lista.length) return <p className="empty">No hay diferencias pendientes de reclamar.</p>;
  const reclamado = async (ids) => { try { await fn("reclamado", { ids }); avisar("Marcado como reclamado"); onCambio(); } catch (e) { avisar(e.message, "mal"); } };
  return (
    <>
      <div className="head"><div><h2>Diferencias para reclamar</h2><p className="sub">Lo que no cuadra entre el documento del proveedor y lo que ha llegado.</p></div></div>
      {grupos.map(([prov, ls]) => (
        <div key={prov} style={{ marginTop: 18 }}>
          <div className="head"><h2 style={{ fontSize: 15 }}>{prov}</h2><button className="btn-l" onClick={() => reclamado(ls.map((l) => l.id))}>Reclamado todo</button></div>
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>Producto</th><th>Documento</th><th className="r">Factura</th><th className="r">Llegó</th><th className="r">Diferencia</th><th className="r">Importe</th></tr></thead>
              <tbody>
                {ls.map((l) => { const dif = Number(l.uds_confirmadas || 0) - Number(l.uds_doc || 0); return (
                  <tr key={l.id}>
                    <td><span className="pn">{l.descripcion}</span></td>
                    <td><span className="pf">{l.recepciones?.doc_numero || "sin número"}{gen.has(l.recepcion_id) ? " (código interno)" : ""} · {fechaCorta(l.recepciones?.confirmado_en)}</span></td>
                    <td className="r">{Number(l.uds_doc)}</td>
                    <td className="r">{Number(l.uds_confirmadas || 0)}</td>
                    <td className="r b" style={{ color: dif < 0 ? "var(--down)" : undefined }}>{dif > 0 ? "+" : ""}{Math.round(dif * 100) / 100}</td>
                    <td className="r">{l.coste_unit != null ? eur(Math.abs(dif) * Number(l.coste_unit), 2) : "—"}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

function ListaAvisos({ lista, onCambio }) {
  if (!lista.length) return <p className="empty">No hay avisos abiertos.</p>;
  const resolver = async (ids) => { try { await fn("resolver_aviso", { ids }); onCambio(); } catch (e) { avisar(e.message, "mal"); } };
  return (
    <>
      <div className="head"><div><h2>Avisos</h2><p className="sub">Facturas que no llegan, productos sin código o sin asociar y errores de stock.</p></div><button className="btn-l" onClick={() => resolver(lista.map((a) => a.id))}>Marcar todos como vistos</button></div>
      <div className="tabla-scroll">
        <table className="ranking">
          <tbody>
            {lista.map((a) => (
              <tr key={a.id}>
                <td style={{ width: 110 }}><span className="pf">{AVISO[a.tipo] || a.tipo}</span></td>
                <td><span className="pn" style={{ fontWeight: 500 }}>{a.texto}</span><span className="pf">{hace(a.creado_en)}</span></td>
                <td className="r"><button className="btn-txt" onClick={() => resolver([a.id])}>Resuelto</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const MOTIVOS_NP = { expositor: "Expositor o surtido sin desglosar", portes: "Portes / transporte", envases: "Envases / fianzas", material: "Material para la tienda", otro: "Otro" };
const fechaHora = (t) => (t ? new Date(t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

function Pedidos({ proveedores, onCambio }) {
  const gen = useGenerados(0);
  const [f, setF] = useState({ q: "", proveedor: "", estado: "", desde: "", hasta: "" });
  const [filas, setFilas] = useState(null);
  const [total, setTotal] = useState(0);
  const [mas, setMas] = useState(false);
  const [abierto, setAbierto] = useState(null);
  const cargar = useCallback(async (off = 0) => {
    try {
      const r = await fn("pedidos_lista", { ...f, offset: off, limit: 50 });
      setFilas((x) => (off ? [...(x || []), ...r.filas] : r.filas)); setTotal(r.total);
    } catch (e) { avisar(e.message || "No se han podido cargar los pedidos", "mal"); setFilas((x) => x || []); }
    setMas(false);
  }, [f]);
  useEffect(() => { const t = setTimeout(() => cargar(0), 250); return () => clearTimeout(t); }, [cargar]);
  const reintentar = async (r) => { try { const x = await fn("aplicar_stock", { id: r.id }); avisar(x.ok ? `Stock sumado (${x.productos} productos)` : `Faltan ${x.errores.length} productos`, x.ok ? "ok" : "mal"); cargar(0); onCambio(); } catch (e) { avisar(e.message, "mal"); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <div className="head"><div><h2>Pedidos</h2><p className="sub">Todas las recepciones, de la más reciente a la más antigua. Pulsa un pedido para verlo completo{total ? ` · ${total} en total` : ""}.</p></div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input className="mini-input" aria-label="Nº de documento" placeholder="Nº de documento" value={f.q} onChange={set("q")} style={{ minWidth: 150 }} />
        <select className="mini-input" aria-label="Proveedor" value={f.proveedor} onChange={set("proveedor")}><option value="">Todos los proveedores</option>{(proveedores || []).map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}</select>
        <select className="mini-input" aria-label="Estado" value={f.estado} onChange={set("estado")}><option value="">Todos los estados</option>{Object.entries(ESTADO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        <label className="sub" style={{ display: "flex", alignItems: "center", gap: 4 }}>Desde<input className="mini-input" type="date" value={f.desde} onChange={set("desde")} /></label>
        <label className="sub" style={{ display: "flex", alignItems: "center", gap: 4 }}>Hasta<input className="mini-input" type="date" value={f.hasta} onChange={set("hasta")} /></label>
      </div>
      {!filas ? <Cargando /> : !filas.length ? <p className="empty">No hay pedidos con esos filtros.</p> : (
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Proveedor</th><th>Vía</th><th>Estado</th><th>Recepcionó</th><th className="r">Total</th><th className="r">Fecha doc.</th><th className="r">Recepción</th><th className="r">Stock</th></tr></thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.id} onClick={() => setAbierto(r.id)} style={{ cursor: "pointer" }}>
                  <td><button className="btn-txt" style={{ textAlign: "left" }} onClick={(e) => { e.stopPropagation(); setAbierto(r.id); }}><span className="pn">{r.proveedor}</span></button><span className="pf">{[r.doc_tipo === "albaran" ? "Albarán" : r.doc_tipo === "factura" ? "Factura" : null, r.doc_numero].filter(Boolean).join(" ")}{gen.has(r.id) ? " · código interno" : ""}{r.prueba ? " · prueba" : ""}</span></td>
                  <td>{VIA[r.via] || r.via}</td>
                  <td>{ESTADO[r.estado] || r.estado}</td>
                  <td>{r.recepcionado_por || "—"}</td>
                  <td className="r">{r.total != null ? eur(r.total, 2) : "—"}</td>
                  <td className="r">{r.doc_fecha ? fechaCorta(r.doc_fecha) : "sin fecha"}</td>
                  <td className="r">{fechaCorta(r.confirmado_en || r.llegada_en || r.creado_en)}</td>
                  <td className="r" onClick={(e) => e.stopPropagation()}>{r.stock_aplicado ? "Sumado" : r.prueba || !["confirmada", "con_diferencias"].includes(r.estado) ? "—" : <button className="btn-txt" title={r.stock_error || ""} onClick={() => reintentar(r)}>Sumar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filas && filas.length < total && <p style={{ textAlign: "center" }}><button className="btn-l" disabled={mas} onClick={() => { setMas(true); cargar(filas.length); }}>{mas ? "Cargando…" : `Ver más (${total - filas.length} restantes)`}</button></p>}
      {abierto && <PedidoDetalle id={abierto} onClose={() => setAbierto(null)} onCambio={() => { cargar(0); onCambio(); }} />}
    </>
  );
}

function BuscaProducto({ onElegir, onCerrar }) {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setLista([]); return; }
    let vivo = true;
    const t = setTimeout(() => { fn("productos", { q, todos: true }).then((r) => vivo && setLista(r.productos || [])).catch(() => vivo && setLista([])); }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [q]);
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 10, margin: "6px 0 10px", background: "var(--bg, #fff)" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input className="mini-input" autoFocus aria-label="Buscar producto" placeholder="Nombre o código de barras" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <button className="btn-l" onClick={onCerrar}>Cancelar</button>
      </div>
      {lista.map((p) => <div key={p.id}><button className="btn-txt" style={{ textAlign: "left", padding: "6px 2px" }} onClick={() => onElegir(p)}>{p.nombre} <span className="pf">{eur(p.pvp, 2)}</span></button></div>)}
      {q.trim().length >= 2 && !lista.length && <p className="sub">Nada con ese nombre.</p>}
    </div>
  );
}

function PedidoDetalle({ id, onClose, onCambio }) {
  const gen = useGenerados(id);
  const [d, setD] = useState(null);
  const [ed, setEd] = useState({});
  const [busca, setBusca] = useState(null); // id de línea
  const [busy, setBusy] = useState(false);
  useEffect(() => { fn("pedido_abrir", { id }).then(setD).catch((e) => { avisar(e.message || "No se ha podido abrir", "mal"); onClose(); }); }, [id, onClose]);
  if (!d) return <Panel titulo="Pedido" onClose={onClose} ancho={920}><Cargando /></Panel>;
  const rec = d.recepcion;
  const doc = d.fotos.length ? d.fotos : [rec.foto_url].filter(Boolean);
  const esPdf = !!rec.doc_url;
  const cambiar = (lid, c) => setEd((x) => ({ ...x, [lid]: { ...(x[lid] || {}), ...c } }));
  const val = (l, k, def) => (ed[l.id]?.[k] !== undefined ? ed[l.id][k] : def);
  const cambios = d.lineas.map((l) => {
    const e = ed[l.id]; if (!e) return null;
    const c = { linea_id: l.id };
    if (e.q !== undefined && numero(e.q) != null && numero(e.q) !== Number(l.uds_confirmadas)) c.uds_confirmadas = numero(e.q);
    if (e.base !== undefined && numero(e.base) != null && Math.abs(numero(e.base) - Number(l.base_unit ?? -1)) > 1e-9) c.coste_sin_iva = numero(e.base);
    if (e.iva !== undefined && numero(e.iva) != null && numero(e.iva) !== Number(l.iva_pct)) c.iva_pct = numero(e.iva);
    if (e.producto && e.producto.id !== l.product_id) c.product_id = e.producto.id;
    if (e.es_producto !== undefined) { c.es_producto = e.es_producto; if (e.motivo) c.motivo = e.motivo; if (e.motivo_texto) c.motivo_texto = e.motivo_texto; }
    return Object.keys(c).length > 1 ? c : null;
  }).filter(Boolean);
  const guardar = async () => {
    if (!cambios.length) return;
    const aviso = rec.prueba ? "Es un pedido de prueba: se corrige sin tocar el stock." : "Se ajustará el stock solo por la diferencia y quedará anotado quién y cuándo.";
    if (!window.confirm(`¿Guardar ${cambios.length} corrección${cambios.length > 1 ? "es" : ""}? ${aviso}`)) return;
    setBusy(true);
    try {
      const r = await fn("pedido_corregir", { id, cambios });
      setD(r.pedido); setEd({});
      if (r.errores?.length) avisar(`No se ha podido: ${r.errores.join("; ")}`, "mal");
      else avisar(`Corregido${r.notas?.length ? ` · ${r.notas.join(" · ")}` : ""}`);
      onCambio();
    } catch (e) { avisar(e.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  const marcar = (l, motivo) => {
    if (!motivo) return;
    let texto = null;
    if (motivo === "otro") { texto = window.prompt("¿Qué es?"); if (!texto) return; }
    if (!window.confirm(`«${l.descripcion}» pasa a «No es un producto» (${MOTIVOS_NP[motivo]}). ${rec.prueba ? "" : "Se quita su stock. "}Se guarda al pulsar «Guardar correcciones».`)) return;
    cambiar(l.id, { es_producto: false, motivo, motivo_texto: texto });
  };
  return (
    <Panel titulo={`${rec.proveedor}${rec.doc_numero ? ` · ${rec.doc_numero}${gen.has(rec.id) ? " (código interno)" : ""}` : ""}`} sub={`${ESTADO[rec.estado] || rec.estado}${rec.prueba ? " · de prueba" : ""} · recepcionó ${d.recepcionado_por || "—"} · ${fechaHora(rec.confirmado_en || rec.creado_en)}`} onClose={onClose} ancho={920}
      pie={d.corregible ? <button className="btn-p" disabled={busy || !cambios.length} onClick={guardar}>{busy ? "Guardando…" : `Guardar correcciones${cambios.length ? ` (${cambios.length})` : ""}`}</button> : <span className="sub">Solo se corrigen pedidos ya confirmados.</span>}>
      <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
        {rec.doc_url && <a className="btn-l" href={rec.doc_url} target="_blank" rel="noreferrer" style={{ justifySelf: "start" }}>Abrir el documento (PDF)</a>}
        {!esPdf && doc.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Documento, foto ${i + 1}`} style={{ maxWidth: "100%", maxHeight: 420, borderRadius: 10, border: "1px solid var(--line)" }} /></a>)}
        {!doc.length && !rec.doc_url && <p className="sub">Este pedido no tiene foto ni PDF.</p>}
      </div>
      {busca != null && <BuscaProducto onCerrar={() => setBusca(null)} onElegir={(p) => { cambiar(busca, { producto: p }); setBusca(null); }} />}
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>Línea del documento</th><th>Producto asociado</th><th className="r">Doc.</th><th className="r">Recibida</th><th className="r">Coste s/IVA</th><th className="r">IVA %</th><th className="r">Coste completo</th><th></th></tr></thead>
          <tbody>
            {d.lineas.map((l) => {
              const e = ed[l.id] || {};
              const noProd = e.es_producto === false || (l.tipo !== "venta" && e.es_producto !== true);
              const prod = e.producto || l.producto;
              const editable = d.corregible && l.tipo === "venta" && e.es_producto !== false;
              const base = val(l, "base", l.base_unit != null ? String(l.base_unit) : ""), iva = val(l, "iva", l.iva_pct != null ? String(l.iva_pct) : "");
              return (
                <tr key={l.id} style={e && Object.keys(e).length ? { background: "rgba(232,145,58,.10)" } : undefined}>
                  <td><span className="pn">{l.descripcion}</span><span className="pf">{[l.ref, l.anadida ? "añadida a mano" : null, l.emparejado === "nuevo" ? "alta en este pedido" : null].filter(Boolean).join(" · ")}</span></td>
                  <td>
                    {noProd ? <span className="pf">No es un producto: {MOTIVOS_NP[e.motivo || l.no_producto_motivo] || "otro"}{(e.motivo_texto || l.no_producto_texto) ? ` (${e.motivo_texto || l.no_producto_texto})` : ""}</span> : (
                      <>{prod ? prod.nombre : <span className="pf">Sin producto</span>}{editable && <> <button className="btn-txt" onClick={() => setBusca(l.id)}>Cambiar</button></>}</>
                    )}
                  </td>
                  <td className="r">{l.cant_doc != null ? l.uds_doc ?? l.cant_doc : "—"}</td>
                  <td className="r">{editable ? <input className="mini-input" inputMode="decimal" aria-label={`Cantidad recibida de ${l.descripcion}`} style={{ width: 70, textAlign: "right" }} value={val(l, "q", String(l.uds_confirmadas ?? 0))} onChange={(x) => cambiar(l.id, { q: x.target.value })} /> : l.tipo === "venta" ? l.uds_confirmadas : "—"}</td>
                  <td className="r">{editable ? <input className="mini-input" inputMode="decimal" aria-label={`Coste sin IVA de ${l.descripcion}`} style={{ width: 80, textAlign: "right" }} value={base} onChange={(x) => cambiar(l.id, { base: x.target.value })} /> : l.base_unit != null && l.tipo === "venta" ? eur(l.base_unit, 4) : "—"}</td>
                  <td className="r">{editable ? <input className="mini-input" inputMode="decimal" aria-label={`IVA de ${l.descripcion}`} style={{ width: 56, textAlign: "right" }} value={iva} onChange={(x) => cambiar(l.id, { iva: x.target.value })} /> : l.iva_pct ?? "—"}</td>
                  <td className="r">{l.coste_unit != null && l.tipo === "venta" ? eur(l.coste_unit, 4) : "—"}</td>
                  <td className="r">
                    {d.corregible && (l.tipo === "venta" && e.es_producto !== false ? (
                      <select className="mini-input" aria-label={`Marcar ${l.descripcion} como no producto`} value="" onChange={(x) => marcar(l, x.target.value)}><option value="">No es un producto…</option>{Object.entries(MOTIVOS_NP).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                    ) : noProd && e.es_producto !== true ? <button className="btn-l" onClick={() => (prod ? cambiar(l.id, { es_producto: true, motivo: null }) : setBusca(l.id) || cambiar(l.id, { es_producto: true }))}>Sí es un producto</button> : null)}
                    {Object.keys(e).length > 0 && <button className="btn-txt" onClick={() => setEd((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== String(l.id))))}>Deshacer</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3 style={{ marginTop: 18 }}>Factura</h3>
      {d.facturas.length ? d.facturas.map((x) => <p key={x.id} className="sub">Factura en «Facturas»: {eur(x.importe, 2)}{x.tipo_pago ? ` · ${x.tipo_pago}` : ""}. Para cambiar el importe o la forma de pago, por ahora, hazlo en «Facturas».</p>) : <p className="sub">{rec.total != null ? `Total leído del documento: ${eur(rec.total, 2)}. ` : ""}Todavía no hay factura enlazada a este pedido.</p>}
      {d.altas.length > 0 && <><h3 style={{ marginTop: 18 }}>Productos dados de alta en este pedido</h3><ul className="sub">{d.altas.map((a) => <li key={a.id}>{a.nombre} · {eur(a.pvp, 2)}{a.revisado ? "" : " · pendiente de revisar"}</li>)}</ul></>}
      {d.avisos.length > 0 && <><h3 style={{ marginTop: 18 }}>Diferencias y avisos</h3><ul className="sub">{d.avisos.map((a) => <li key={a.id}>{AVISO[a.tipo] || a.tipo}: {a.texto}{a.estado !== "abierto" ? " (resuelto)" : ""}</li>)}</ul></>}
      {d.correcciones.length > 0 && <><h3 style={{ marginTop: 18 }}>Correcciones hechas</h3><ul className="sub">{d.correcciones.map((c) => { const l = d.lineas.find((x) => x.id === c.linea_id); return <li key={c.id}>{fechaHora(c.creado_en)} · {c.usuario_nombre || "—"} · {l?.descripcion || "línea"}: {c.campo}, de {String(c.antes ?? "—")} a {String(c.despues ?? "—")}</li>; })}</ul></>}
    </Panel>
  );
}

function Fichas({ fichas, proveedores, onCambio }) {
  const [editando, setEditando] = useState(null);
  const [marcado, setMarcado] = useState({}); // #72: precio marcado por proveedor
  const cargarMarcado = () => sb.rpc("proveedor_marcado_lista").then((r) => setMarcado(Object.fromEntries((r || []).map((x) => [x.proveedor, x])))).catch(() => {});
  useEffect(() => { cargarMarcado(); }, [fichas]);
  const filas = useMemo(() => {
    const porNombre = new Map(fichas.map((f) => [f.proveedor, f]));
    return proveedores.map((p) => ({ ...p, ficha: porNombre.get(p.nombre) || null, marcado: marcado[p.nombre] || null }));
  }, [fichas, proveedores, marcado]);
  return (
    <>
      <div className="head"><div><h2>Ficha de proveedores</h2><p className="sub">Por dónde llega su factura, si hay que contarla línea a línea y si cobra recargo de equivalencia. Sin ficha: la trabajadora elige y se revisa todo.</p></div></div>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>Proveedor</th><th>Canal</th><th>Revisión</th><th>Recargo</th><th>Precio marcado</th><th>Remitentes</th><th></th></tr></thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.nombre}>
                <td><span className="pn">{p.nombre}</span>{p.ficha?.nota && <span className="pf">{p.ficha.nota}</span>}</td>
                <td>{p.ficha?.canal ? VIA[p.ficha.canal] || p.ficha.canal : "—"}</td>
                <td>{p.ficha ? (p.ficha.revision === false ? "No" : "Sí") : "Sí"}</td>
                <td>{p.ficha ? (p.ficha.recargo === false ? "No" : "Sí") : "Sí"}</td>
                <td>{p.marcado?.posible ? (p.marcado.filtro ? `Sí, si contiene «${p.marcado.filtro}»` : "Sí") : "No"}</td>
                <td><span className="pf">{(p.ficha?.remitentes || []).join(", ")}</span></td>
                <td className="r"><button className="btn-l" onClick={() => setEditando(p)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && <EditarFicha p={editando} onClose={() => setEditando(null)} onGuardado={() => { setEditando(null); onCambio(); cargarMarcado(); }} />}
    </>
  );
}

function EditarFicha({ p, onClose, onGuardado }) {
  const f0 = p.ficha || {};
  const [f, setF] = useState({ proveedor: p.nombre, canal: f0.canal || "", revision: f0.revision !== false, recargo: f0.recargo !== false, remitentes: (f0.remitentes || []).join(", "), formato: f0.formato || "", nota: f0.nota || "" });
  const [m, setM] = useState({ posible: !!p.marcado?.posible, filtro: p.marcado?.filtro || "" }); // #72
  const [busy, setBusy] = useState(false);
  const guardar = async () => {
    setBusy(true);
    try {
      await fn("guardar_ficha", { ficha: f });
      await sb.rpc("proveedor_marcado_guardar", { p_proveedor: p.nombre, p_posible: m.posible, p_filtro: m.posible ? m.filtro : "" });
      avisar("Ficha guardada"); onGuardado();
    } catch (e) { avisar(e.message, "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo={p.nombre} sub="Ficha del proveedor" onClose={onClose} pie={<button className="btn-p" disabled={busy} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button>}>
      <label className="campo">Cómo llega su factura<select value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}><option value="">Sin definir (lo elige la trabajadora)</option><option value="email">Por correo</option><option value="foto">En papel (foto)</option><option value="manual">Sin papel (a mano)</option></select></label>
      <label className="campo">Direcciones de correo desde las que manda la factura<input value={f.remitentes} onChange={(e) => setF({ ...f, remitentes: e.target.value })} placeholder="facturas@proveedor.com, otra@proveedor.com" /></label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}><input type="checkbox" checked={f.revision} onChange={(e) => setF({ ...f, revision: e.target.checked })} /> Hay que contar el pedido línea a línea</label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}><input type="checkbox" checked={f.recargo} onChange={(e) => setF({ ...f, recargo: e.target.checked })} /> Cobra recargo de equivalencia</label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: m.posible ? 8 : 14 }}><input type="checkbox" checked={m.posible} onChange={(e) => setM({ ...m, posible: e.target.checked })} /> Puede traer precio marcado</label>
      {m.posible && <label className="campo">Solo productos que contengan… (vacío = todos los de este proveedor)<input value={m.filtro} onChange={(e) => setM({ ...m, filtro: e.target.value })} placeholder="Por ejemplo: BANG" /></label>}
      <label className="campo">Formato del documento<input value={f.formato} onChange={(e) => setF({ ...f, formato: e.target.value })} placeholder="PDF, .txt…" /></label>
      <label className="campo">Nota<textarea rows={3} value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} /></label>
      <p className="sub">Recuerda añadir también el remitente al filtro «Facturas» de Gmail para que su correo entre solo.</p>
    </Panel>
  );
}

function Ajustes({ config, onCambio }) {
  const [clave, setClave] = useState("");
  const [busy, setBusy] = useState(false);
  const [script, setScript] = useState(null);
  const poner = async (valores, txt) => { try { await fn("config", { valores }); avisar(txt); onCambio(); } catch (e) { avisar(e.message, "mal"); } };
  const guardarClave = async () => { setBusy(true); try { await fn("guardar_clave_claude", { clave }); setClave(""); avisar("Clave guardada y comprobada"); onCambio(); } catch (e) { avisar(e.message, "mal"); } setBusy(false); };
  const verScript = async () => { try { const r = await fn("clave_ingesta"); setScript(codigoScript(r.url, r.clave)); } catch (e) { avisar(e.message, "mal"); } };
  const fila = (titulo, sub, on, onChange) => (
    <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--grid)" }}>
      <div><div style={{ fontWeight: 700 }}>{titulo}</div><div className="sub">{sub}</div></div>
      <button className={on ? "btn-p" : "btn-l"} onClick={() => onChange(!on)} aria-pressed={on}>{on ? "Activado" : "Desactivado"}</button>
    </div>
  );
  return (
    <>
      <div className="head"><div><h2>Ajustes de recepción</h2><p className="sub">Hasta el {fechaCorta(config.real_desde)} todo funciona en modo prueba, haya lo que haya activado aquí.</p></div></div>
      {fila("Sumar stock en Epos al confirmar", "Lee el stock de cada producto y le suma lo recibido. Se prueba en el simulacro del 21 de octubre.", config.stock_activo, (v) => poner({ recepcion_stock_activo: v }, v ? "Stock activado" : "Stock desactivado"))}
      {fila("Actualizar el coste en Epos", "Guarda en Epos la base imponible por unidad de la última factura. Mejor tras la revisión del IVA del catálogo.", config.coste_activo, (v) => poner({ recepcion_coste_activo: v }, v ? "Coste activado" : "Coste desactivado"))}
      {fila("Recargo de equivalencia", "Suma el recargo al coste real para calcular márgenes. Se quita al pasar al régimen general.", config.recargo_activo, (v) => poner({ recargo_activo: v }, "Guardado"))}
      <div style={{ padding: "16px 0", borderBottom: "1px solid var(--grid)" }}>
        <div style={{ fontWeight: 700 }}>Lectura de facturas con Claude</div>
        <div className="sub">{config.clave_claude ? "Hay una clave guardada y funcionando." : "Falta la clave: sin ella no se pueden leer fotos ni PDF."} Para cambiarla, pega aquí la nueva (no se muestra nunca).</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <label style={{ position: "absolute", left: -9999 }} htmlFor="clave-claude">Clave de Anthropic</label>
          <input id="clave-claude" className="mini-input" type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="sk-ant-…" style={{ flex: 1, minWidth: 220 }} />
          <button className="btn-p" disabled={busy || clave.length < 40} onClick={guardarClave}>{busy ? "Comprobando…" : "Guardar clave"}</button>
        </div>
      </div>
      <div style={{ padding: "16px 0" }}>
        <div style={{ fontWeight: 700 }}>Facturas por correo (Gmail)</div>
        <div className="sub">Un pequeño programa en la cuenta de Gmail de la tienda manda cada 15 minutos los adjuntos con la etiqueta «Facturas». Se instala una vez.</div>
        {!script ? <button className="btn-l" style={{ marginTop: 10 }} onClick={verScript}>Ver cómo instalarlo</button> : (
          <div style={{ marginTop: 10 }}>
            <ol style={{ margin: "0 0 10px", paddingLeft: 20, lineHeight: 1.6, fontSize: 14 }}>
              <li>Con la cuenta de la tienda, abre <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer">script.google.com → Nuevo proyecto</a>.</li>
              <li>Borra lo que hay, pega este código y guarda (icono del disquete).</li>
              <li>Elige la función <b>instalar</b> arriba y pulsa <b>Ejecutar</b>. Acepta los permisos de Gmail.</li>
            </ol>
            <textarea readOnly rows={12} value={script} onFocus={(e) => e.target.select()} style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12, border: "1px solid var(--line)", borderRadius: 12, padding: 10, boxSizing: "border-box" }} aria-label="Código del programa de Gmail" />
            <p className="sub">El código lleva una clave propia de la tienda: no lo compartas fuera de dirección.</p>
          </div>
        )}
      </div>
    </>
  );
}

function codigoScript(url, clave) {
  return `// Recao · facturas del correo → Recepción de pedidos
var URL_RECAO = "${url}";
var CLAVE = "${clave}";

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("revisarFacturas").timeBased().everyMinutes(15).create();
  revisarFacturas();
}

function revisarFacturas() {
  var leidas = GmailApp.getUserLabelByName("Facturas/Leídas") || GmailApp.createLabel("Facturas/Leídas");
  var hilos = GmailApp.search('label:Facturas -label:"Facturas/Leídas" newer_than:7d has:attachment', 0, 20);
  hilos.forEach(function (hilo) {
    var todoBien = true;
    hilo.getMessages().forEach(function (m) {
      var adjuntos = m.getAttachments().filter(function (a) {
        var n = a.getName().toLowerCase();
        return /\\.(pdf|txt)$/.test(n) || /pdf|text/.test(a.getContentType());
      }).map(function (a) {
        return { nombre: a.getName(), mime: a.getContentType(), base64: Utilities.base64Encode(a.getBytes()) };
      });
      if (!adjuntos.length) return;
      var r = UrlFetchApp.fetch(URL_RECAO, {
        method: "post", contentType: "application/json", muteHttpExceptions: true,
        headers: { "x-ingesta-key": CLAVE },
        payload: JSON.stringify({ accion: "ingesta_correo", from: m.getFrom(), subject: m.getSubject(), message_id: m.getId(), adjuntos: adjuntos })
      });
      if (r.getResponseCode() !== 200) { todoBien = false; console.log(m.getSubject() + ": " + r.getContentText()); }
    });
    if (todoBien) hilo.addLabel(leidas);
  });
}
`;
}
