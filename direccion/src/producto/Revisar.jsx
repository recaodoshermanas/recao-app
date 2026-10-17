// Producto · Productos a revisar: altas que hacen las trabajadoras o el sistema desde la recepción,
// costes sin verificar, precios cambiados en tienda, productos sin proveedor e incidencias de códigos.
import { useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Pestanas, Cargando, avisar, hace } from "../ui.jsx";
import { eur } from "../fmt.js";

const fn = (accion, datos = {}) => sb.fn("recepcion", { accion, ...datos });
const numero = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : null; };
const ORIGEN = { auto: "Alta automática (factura)", pedido: "Añadido en un pedido", fuera_pedido: "Añadido fuera de pedido" };
const PVP_ORIGEN = { marcado: "marcado", parecidos: "igual que parecidos", regla: "regla de la tienda", trabajadora: "puesto en tienda" };

function motivos(a) {
  const m = [];
  if (!a.revisado) m.push(["alta", "Alta reciente"]);
  if (a.estado_coste === "sin_verificar") m.push(["coste", "Coste sin verificar"]);
  if (!a.revisado && a.margen_bajo) m.push(["margen", "Margen bajo"]);
  if (!a.revisado && a.pvp_origen === "trabajadora") m.push(["precio", "Precio cambiado en tienda"]);
  if (!a.supplier_id) m.push(["prov", "Sin proveedor"]);
  return m;
}
const COLOR = { alta: ["#EAF0F8", "#2F5C8F"], coste: ["#FBF0DA", "#7A5410"], margen: ["#FBEAE7", "#A3362B"], precio: ["#FBEAE7", "#A3362B"], prov: ["#F0ECE2", "#5E5444"] };
const chip = (k, t) => <span key={k} style={{ display: "inline-block", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: COLOR[k][0], color: COLOR[k][1], marginRight: 4, whiteSpace: "nowrap" }}>{t}</span>;

export function ProductosRevisar() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("altas");
  const [filtro, setFiltro] = useState("");
  const [sel, setSel] = useState([]);
  const [costes, setCostes] = useState({});
  const [provs, setProvs] = useState({});
  const [busy, setBusy] = useState(null);
  const cargar = useCallback(async () => { try { setD(await fn("revisar_panel")); } catch (e) { avisar(e.message || "No se ha podido cargar", "mal"); setD((x) => x || { altas: [], incidencias: [], productos: [], usuarios: [], proveedores: [] }); } }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const P = useMemo(() => new Map((d?.productos || []).map((p) => [Number(p.id), p])), [d]);
  const U = useMemo(() => new Map((d?.usuarios || []).map((u) => [u.id, u.nombre])), [d]);
  if (!d) return <Cargando />;

  const filas = d.altas.map((a) => ({ ...a, _m: motivos(a) })).filter((a) => a._m.length && (!filtro || a._m.some(([k]) => k === filtro)));
  const cuenta = (k) => d.altas.filter((a) => motivos(a).some(([x]) => x === k)).length;
  const hacer = async (id, accion, datos, ok) => { setBusy(id); try { const r = await fn(accion, datos); avisar(typeof ok === "function" ? ok(r) : ok); setSel([]); await cargar(); } catch (e) { avisar(e.message || "No se ha podido", "mal"); } setBusy(null); };

  return (
    <>
      <Pestanas valor={tab} onChange={setTab} etiqueta="Productos a revisar" opciones={[{ id: "altas", label: "Altas y avisos", n: filas.length && !filtro ? filas.length : d.altas.length }, { id: "incidencias", label: "Incidencias de código", n: d.incidencias.length }]} />
      {tab === "altas" ? (
        <div className="card mt">
          <div className="head">
            <div><h2>Productos dados de alta desde la recepción</h2><p className="sub">Ya están en Epos y se pueden vender. Revisa nombre, categoría, IVA y precio en el Catálogo y márcalos como revisados. Los precios corregidos por coste aparecen en Recepción → Precios por aprobar.</p></div>
            {sel.length > 0 && <button className="btn-p" onClick={() => hacer("lote", "alta_revisada", { ids: sel }, `${sel.length} marcados como revisados`)}>Marcar {sel.length} como revisados</button>}
          </div>
          <div className="filtros-t">
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Motivo">
              <option value="">Todos los motivos</option>
              <option value="alta">Alta reciente ({cuenta("alta")})</option>
              <option value="coste">Coste sin verificar ({cuenta("coste")})</option>
              <option value="margen">Margen bajo ({cuenta("margen")})</option>
              <option value="precio">Precio cambiado en tienda ({cuenta("precio")})</option>
              <option value="prov">Sin proveedor ({cuenta("prov")})</option>
            </select>
            {filas.some((a) => !a.revisado) && <button className="btn-txt" onClick={() => setSel(filas.filter((a) => !a.revisado).map((a) => a.id))}>Seleccionar las altas</button>}
          </div>
          {!filas.length ? <p className="empty">Nada por revisar. Aquí aparece cada producto que se da de alta desde la recepción (automático o a mano) y lo que haya que comprobar de él.</p> : (
            <div className="tabla-scroll">
              <table className="ranking">
                <thead><tr><th></th><th>Producto</th><th>Motivo</th><th className="r">Coste sin IVA</th><th className="r">PVP</th><th>Qué hacer</th></tr></thead>
                <tbody>
                  {filas.map((a) => {
                    const p = P.get(Number(a.product_id));
                    const tieneCoste = a._m.some(([k]) => k === "coste");
                    const sinProv = !a.supplier_id;
                    return (
                      <tr key={a.id}>
                        <td>{!a.revisado && <input type="checkbox" aria-label={`Seleccionar ${a.nombre}`} checked={sel.includes(a.id)} onChange={(e) => setSel(e.target.checked ? [...sel, a.id] : sel.filter((x) => x !== a.id))} />}</td>
                        <td>
                          <span className="pn">{p?.name || a.nombre}{p?.archivado ? " (archivado)" : ""}</span>
                          <span className="pf">{ORIGEN[a.origen]}{a.proveedor ? ` · ${a.proveedor}` : ""}{p?.category_name ? ` · ${p.category_name}` : ""} · {a.barcode || (a.sin_codigo ? "sin código" : "falta el código")} · {U.get(a.creado_por) || "sistema"} · {hace(a.creado_en)}</span>
                          {a.nombre_documento && a.nombre_documento !== a.nombre && <span className="pf">En factura: «{a.nombre_documento}»</span>}
                        </td>
                        <td>{a._m.map(([k, t]) => chip(k, t))}</td>
                        <td className="r">{a.coste_sin_iva != null ? eur(a.coste_sin_iva, 3) : "—"}{a.coste_introducido != null && a.coste_introducido !== a.coste_sin_iva && <span className="pf">puso {String(a.coste_introducido).replace(".", ",")}{a.interpretacion ? ` (${a.interpretacion})` : ""}</span>}</td>
                        <td className="r">{eur(p?.sale_price ?? a.pvp, 2)}<span className="pf">{PVP_ORIGEN[a.pvp_origen] || ""}{a.pvp_origen === "trabajadora" && a.pvp_calculado != null ? ` · el sistema daba ${eur(a.pvp_calculado, 2)}` : ""}</span></td>
                        <td style={{ minWidth: 220 }}>
                          {tieneCoste && (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                              <label style={{ position: "absolute", left: -9999 }} htmlFor={`co-${a.id}`}>Coste correcto sin IVA de {a.nombre}</label>
                              <input id={`co-${a.id}`} className="mini-input" inputMode="decimal" placeholder="Coste sin IVA" value={costes[a.id] ?? ""} onChange={(e) => setCostes({ ...costes, [a.id]: e.target.value })} style={{ width: 110 }} />
                              <button className="btn-l" disabled={busy === a.id || !(numero(costes[a.id]) >= 0) || costes[a.id] == null || costes[a.id] === ""} onClick={() => hacer(a.id, "alta_coste", { id: a.id, coste: numero(costes[a.id]) }, (r) => (r.propuesta ? `Coste guardado. Precio propuesto ${eur(r.propuesta, 2)} en Precios por aprobar` : "Coste guardado en Epos"))}>Guardar</button>
                            </div>
                          )}
                          {sinProv && (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                              <label style={{ position: "absolute", left: -9999 }} htmlFor={`pr-${a.id}`}>Proveedor de {a.nombre}</label>
                              <select id={`pr-${a.id}`} value={provs[a.id] ?? ""} onChange={(e) => setProvs({ ...provs, [a.id]: e.target.value })} style={{ maxWidth: 160 }}>
                                <option value="">Proveedor…</option>
                                {(d.proveedores || []).filter((x) => x.supplier_id).map((x) => <option key={x.nombre} value={x.nombre}>{x.nombre}</option>)}
                              </select>
                              <button className="btn-l" disabled={busy === a.id || !provs[a.id]} onClick={() => { const x = d.proveedores.find((y) => y.nombre === provs[a.id]); hacer(a.id, "alta_proveedor", { id: a.id, supplier_id: x?.supplier_id, proveedor: x?.nombre }, "Proveedor puesto en Epos"); }}>Poner</button>
                            </div>
                          )}
                          {!a.revisado && <button className="btn-l" disabled={busy === a.id} onClick={() => hacer(a.id, "alta_revisada", { ids: [a.id] }, "Marcado como revisado")}>Revisado</button>}{" "}
                          <a className="btn-txt" href="#/producto/catalogo" title="Búscalo por su nombre en el catálogo para cambiar nombre, categoría o IVA">Catálogo</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <Incidencias lista={d.incidencias} P={P} U={U} onHecho={cargar} />
      )}
    </>
  );
}

function Incidencias({ lista, P, U, onHecho }) {
  const [busy, setBusy] = useState(null);
  if (!lista.length) return <div className="card mt"><p className="empty">No hay incidencias de códigos. Aparecen cuando una trabajadora dice que un código lleva al producto equivocado, o cuando un producto nuevo trae el código de otro.</p></div>;
  const resolver = async (i, accion, txt) => {
    if (accion !== "descartar" && !window.confirm(txt)) return;
    setBusy(i.id);
    try { const r = await fn("incidencia_resolver", { id: i.id, accion_resolver: accion }); avisar(r.resolucion || "Resuelta"); onHecho(); }
    catch (e) { avisar(e.message || "No se ha podido", "mal"); }
    setBusy(null);
  };
  return (
    <div className="card mt">
      <div className="head"><div><h2>Incidencias de códigos de barras</h2><p className="sub">Mientras no se resuelven, el producto nuevo no se da de alta (o se queda sin código).</p></div></div>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>Código</th><th>Qué pasa</th><th>Producto que lo tiene</th><th>Qué hacer</th></tr></thead>
          <tbody>
            {lista.map((i) => {
              const ex = P.get(Number(i.product_id_existente));
              const nu = P.get(Number(i.product_id_nuevo));
              const nombreNuevo = nu?.name || i.datos?.nombre || i.texto;
              return (
                <tr key={i.id}>
                  <td><span className="pn">{i.barcode}</span><span className="pf">{U.get(i.creado_por) || "sistema"} · {hace(i.creado_en)}</span></td>
                  <td>
                    <span className="pn">{i.tipo === "no_es_este" ? "«No es este producto»" : "Posible duplicado"}</span>
                    {i.texto && <span className="pf">{i.texto}</span>}
                    {i.datos?.nombre && <span className="pf">Quería dar de alta: {i.datos.nombre}{i.datos.pvp ? ` a ${eur(i.datos.pvp, 2)}` : ""}{i.datos.proveedor ? ` (${i.datos.proveedor})` : ""}</span>}
                    {i.foto_url && <a className="btn-txt" href={i.foto_url} target="_blank" rel="noopener noreferrer">Ver foto</a>}
                  </td>
                  <td><span className="pn">{ex?.name || "—"}</span>{ex && <span className="pf">{eur(ex.sale_price, 2)} · {ex.supplier_name || "sin proveedor"}</span>}</td>
                  <td style={{ minWidth: 230 }}>
                    {(i.tipo === "posible_duplicado" || i.datos?.nombre) && <button className="btn-p" disabled={busy === i.id} onClick={() => resolver(i, "reasignar", `Se le quita el código ${i.barcode} a «${ex?.name || "?"}» y se le pone a «${nombreNuevo || "el producto nuevo"}»${i.tipo === "no_es_este" ? ", que se da de alta ahora" : ""}. ¿Seguimos?`)}>El código es del nuevo</button>}{" "}
                    {i.tipo === "no_es_este" && i.datos?.nombre && <button className="btn-l" disabled={busy === i.id} onClick={() => resolver(i, "crear_sin_codigo", `Se da de alta «${i.datos.nombre}» sin código y «${ex?.name || "?"}» se queda con el código. ¿Seguimos?`)}>Crear el nuevo sin código</button>}{" "}
                    <button className="btn-txt" disabled={busy === i.id} onClick={() => resolver(i, "descartar")}>Descartar: está bien</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
