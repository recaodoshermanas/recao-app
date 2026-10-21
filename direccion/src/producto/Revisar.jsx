// Producto · Productos a revisar, por secciones (solicitud #16): Precio, Subidas de coste, IVA, Código de barras,
// Productos nuevos e Incidencias. Lo que se decide se guarda en Epos (epos-producto, queda en producto_cambios)
// y la decisión en su tabla (precio_avisos, coste_pendientes, iva_asignacion) con quién y cuándo.
import { useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Pestanas, Cargando, avisar, hace } from "../ui.jsx";
import { eur } from "../fmt.js";
import { guardarCambios } from "./datos.js";

const fn = (accion, datos = {}) => sb.fn("recepcion", { accion, ...datos });
const numero = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : null; };
// «RPC x: 400 {"message":"…"}» → «…»
const msg = (e) => { const t = String(e?.message || e || ""); const m = /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };
const ORIGEN = { auto: "Alta automática (factura)", pedido: "Añadido en un pedido", fuera_pedido: "Añadido fuera de pedido" };
const PVP_ORIGEN = { marcado: "marcado", parecidos: "igual que parecidos", regla: "regla de la tienda", trabajadora: "puesto en tienda" };
const SECCIONES = [
  { id: "precio", label: "Precio" }, { id: "coste", label: "Subidas de coste" }, { id: "iva", label: "IVA" },
  { id: "codigo", label: "Código de barras" }, { id: "nuevos", label: "Productos nuevos" }, { id: "incidencias", label: "Incidencias" },
  { id: "tienda", label: "Precios cambiados en tienda" }, // #35
];
const NOMBRE_SEC = Object.fromEntries(SECCIONES.map((s) => [s.id, s.label]));
const margen = (coste, pvp) => (pvp > 0 ? Math.round((1 - coste / pvp) * 1000) / 10 : null);
const pct = (x) => (x == null ? "—" : `${String(x).replace(".", ",")} %`);

function motivos(a) {
  const m = [];
  if (!a.revisado) m.push(["alta", "Alta reciente"]);
  if (a.estado_coste === "sin_verificar") m.push(["coste", a.coste_sin_iva == null && a.coste_introducido == null ? "Pendiente de coste" : "Coste sin verificar"]);
  if (!a.revisado && a.margen_bajo) m.push(["margen", "Margen bajo"]);
  if (!a.revisado && a.pvp_origen === "trabajadora") m.push(["precio", "Precio cambiado en tienda"]);
  if (!a.supplier_id) m.push(["prov", "Sin proveedor"]);
  return m;
}
const COLOR = { alta: ["#EAF0F8", "#2F5C8F"], coste: ["#FBF0DA", "#7A5410"], margen: ["#FBEAE7", "#A3362B"], precio: ["#FBEAE7", "#A3362B"], prov: ["#F0ECE2", "#5E5444"], otra: ["#EFE7F7", "#5A3A7A"] };
const chip = (k, t) => <span key={k + t} style={{ display: "inline-block", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: COLOR[k][0], color: COLOR[k][1], marginRight: 4, whiteSpace: "nowrap" }}>{t}</span>;
// Etiqueta «También en …» cuando el producto tiene otra tarea abierta en otra sección
const Otras = ({ lista }) => (lista?.length ? <span style={{ display: "block", marginTop: 3 }}>{lista.map((s) => chip("otra", `También en ${NOMBRE_SEC[s]}`))}</span> : null);

export function ProductosRevisar() {
  const [d, setD] = useState(null);
  const [s, setS] = useState(null);
  const [tab, setTab] = useState("precio");
  const [tienda, setTienda] = useState(null); // #35: cambios de precio hechos por las trabajadoras
  const cargar = useCallback(async () => {
    const [a, b, t] = await Promise.allSettled([fn("revisar_panel"), sb.rpc("revisar_secciones"), cargarTienda()]);
    setTienda(t.status === "fulfilled" ? t.value : { lista: [], nombres: new Map() });
    if (a.status === "fulfilled") setD(a.value); else { avisar(msg(a.reason), "mal"); setD((x) => x || { altas: [], incidencias: [], productos: [], usuarios: [], proveedores: [] }); }
    if (b.status === "fulfilled") setS(b.value); else { avisar(msg(b.reason), "mal"); setS((x) => x || { precio: [], coste: [], iva: [] }); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const P = useMemo(() => new Map((d?.productos || []).map((p) => [Number(p.id), p])), [d]);
  const U = useMemo(() => new Map((d?.usuarios || []).map((u) => [u.id, u.nombre])), [d]);
  if (!d || !s || !tienda) return <Cargando />;

  const altas = d.altas.filter((a) => motivos(a).length);
  const codigo = d.incidencias.filter((i) => i.tipo !== "no_es_este");
  const incid = d.incidencias.filter((i) => i.tipo === "no_es_este");
  // Qué productos tienen algo abierto en cada sección
  const ids = {
    precio: new Set(s.precio.map((x) => Number(x.product_id))), coste: new Set(s.coste.map((x) => Number(x.product_id))), iva: new Set(s.iva.map((x) => Number(x.product_id))),
    codigo: new Set(codigo.flatMap((i) => [Number(i.product_id_existente), Number(i.product_id_nuevo)]).filter(Boolean)),
    nuevos: new Set(altas.map((a) => Number(a.product_id)).filter(Boolean)), incidencias: new Set(incid.flatMap((i) => [Number(i.product_id_existente), Number(i.product_id_nuevo)]).filter(Boolean)),
    tienda: new Set(tienda.lista.map((x) => Number(x.product_id))),
  };
  const otras = (pid, actual) => SECCIONES.map((x) => x.id).filter((k) => k !== actual && ids[k].has(Number(pid)));
  const n = { precio: s.precio.length, coste: s.coste.length, iva: s.iva.length, codigo: codigo.length, nuevos: altas.length, incidencias: incid.length, tienda: tienda.lista.length };
  const conS = (r) => { setS(r); };

  return (
    <>
      <Pestanas valor={tab} onChange={setTab} etiqueta="Productos a revisar" opciones={SECCIONES.map((x) => ({ ...x, n: n[x.id] }))} />
      {tab === "precio" && <SecPrecio lista={s.precio} otras={otras} onListo={conS} />}
      {tab === "coste" && <SecCoste lista={s.coste} otras={otras} onListo={conS} />}
      {tab === "iva" && <SecIva lista={s.iva} otras={otras} onListo={conS} />}
      {tab === "codigo" && <Incidencias lista={codigo} P={P} U={U} onHecho={cargar} otras={otras} sec="codigo" vacio="No hay códigos repetidos. Aparecen cuando un producto nuevo o un código puesto en tienda ya lo tenía otro producto." titulo="Códigos de barras repetidos" />}
      {tab === "nuevos" && <Nuevos d={d} P={P} U={U} cargar={cargar} otras={otras} />}
      {tab === "tienda" && <SecTienda lista={tienda.lista} nombres={tienda.nombres} otras={otras} onHecho={cargar} />}
      {tab === "incidencias" && <Incidencias lista={incid} P={P} U={U} onHecho={cargar} otras={otras} sec="incidencias" vacio="No hay incidencias. Aparecen cuando una trabajadora dice que un código lleva al producto equivocado." titulo="«No es este producto»" />}
    </>
  );
}

// ---------- Precio: margen por debajo del 35 % con el coste de la última factura ----------
function SecPrecio({ lista, otras, onListo }) {
  const [otro, setOtro] = useState({});
  const [busy, setBusy] = useState(null);
  const decidir = async (a, decision) => {
    const pvp = decision === "aceptado" ? Number(a.pvp_regla) : decision === "otro" ? numero(otro[a.id]) : null;
    if (decision === "otro" && !(pvp > 0)) return;
    setBusy(a.id);
    try {
      if (pvp != null && Math.abs(pvp - Number(a.pvp_actual)) > 0.004) await guardarCambios([{ id: a.product_id, campos: { pvp } }], `Precio de «${a.nombre}» a ${eur(pvp, 2)}`);
      onListo(await sb.rpc("revisar_decidir", { p: { tipo: "precio", id: a.id, decision, pvp } }));
      avisar(decision === "mantenido" ? "Se mantiene el precio" : `Precio ${eur(pvp, 2)} guardado en Epos`);
    } catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };
  return (
    <div className="card mt">
      <div className="head"><div><h2>Precio</h2><p className="sub">Productos cuyo margen, con el coste de su última factura, queda por debajo del 35 %. «Aceptar» pone el precio de la regla (coste completo ÷ 0,65, redondeado arriba a 0,10 €). «Mantener» no cambia nada y no vuelve a avisar hasta que cambie el coste. Si hay subida de coste pendiente, resuélvela antes.</p></div></div>
      {!lista.length ? <p className="empty">Nada pendiente de precio.</p> : (
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Producto</th><th className="r">Coste completo</th><th className="r">Precio actual</th><th className="r">Regla</th><th>Qué hacer</th></tr></thead>
            <tbody>
              {lista.map((a) => {
                const x = numero(otro[a.id]);
                return (
                  <tr key={a.id}>
                    <td><span className="pn">{a.nombre}</span><span className="pf">{[a.categoria, a.proveedor, a.origen].filter(Boolean).join(" · ")} · {hace(a.creado_en)}</span>{a.marcado && chip("prov", "Precio marcado")}<Otras lista={otras(a.product_id, "precio")} /></td>
                    <td className="r">{eur(a.coste_completo, 3)}</td>
                    <td className="r">{eur(a.pvp_actual, 2)}<span className="pf" style={{ color: "#A3362B" }}>margen {pct(a.margen_actual)}</span></td>
                    <td className="r">{eur(a.pvp_regla, 2)}<span className="pf">margen {pct(margen(a.coste_completo, a.pvp_regla))}</span></td>
                    <td style={{ minWidth: 300 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {!a.marcado && <button className="btn-p" disabled={busy === a.id} onClick={() => decidir(a, "aceptado")}>Aceptar {eur(a.pvp_regla, 2)}</button>}
                        <button className="btn-l" disabled={busy === a.id} onClick={() => decidir(a, "mantenido")}>Mantener</button>
                        <input className="mini-input" inputMode="decimal" placeholder="Otro precio" aria-label={`Otro precio para ${a.nombre}`} value={otro[a.id] ?? ""} onChange={(e) => setOtro({ ...otro, [a.id]: e.target.value })} style={{ width: 90 }} />
                        <button className="btn-l" disabled={busy === a.id || !(x > 0)} onClick={() => decidir(a, "otro")}>Guardar</button>
                      </div>
                      {x > 0 && <span className="pf">Con {eur(x, 2)}: margen {pct(margen(a.coste_completo, x))}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Subidas de coste: la factura trae un coste más de un 20 % por encima del de Epos (no aplicado) ----------
function SecCoste({ lista, otras, onListo }) {
  const [busy, setBusy] = useState(null);
  const decidir = async (c, decision) => {
    setBusy(c.id);
    try {
      if (decision === "aplicado") await guardarCambios([{ id: c.product_id, campos: { coste: Number(c.coste_completo_nuevo), coste_imp_inc: true } }], `Coste de «${c.nombre}» actualizado`);
      const r = await sb.rpc("revisar_decidir", { p: { tipo: "coste", id: c.id, decision } });
      onListo(r);
      avisar(decision === "error" ? "Marcado como error: no se aplica" : r.nuevo_aviso_precio ? "Coste guardado en Epos. El margen baja del 35 %: tienes el precio en «Precio»" : "Coste guardado en Epos");
    } catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };
  return (
    <div className="card mt">
      <div className="head"><div><h2>Subidas de coste</h2><p className="sub">La factura trae un coste más de un 20 % por encima del de Epos y no se ha aplicado. «Es real» guarda en Epos el coste completo (con IVA y recargo, impuestos incluidos) y, si el margen baja del 35 %, crea el aviso en «Precio». Conviene resolver esto antes que el precio.</p></div></div>
      {!lista.length ? <p className="empty">No hay subidas de coste pendientes.</p> : (
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Producto</th><th className="r">Coste en Epos</th><th className="r">Coste factura</th><th className="r">Subida</th><th className="r">Precio</th><th>Qué hacer</th></tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td><span className="pn">{c.nombre}</span><span className="pf">{[c.categoria, c.proveedor, c.origen].filter(Boolean).join(" · ")} · {hace(c.creado_en)}</span><Otras lista={otras(c.product_id, "coste")} /></td>
                  <td className="r">{eur(c.coste_ex_actual, 3)}<span className="pf">sin IVA</span></td>
                  <td className="r">{eur(c.coste_ex_nuevo, 3)}<span className="pf">sin IVA · completo {eur(c.coste_completo_nuevo, 3)}</span></td>
                  <td className="r b" style={{ color: "#A3362B" }}>+{pct(c.subida_pct)}</td>
                  <td className="r">{eur(c.pvp, 2)}<span className="pf">margen nuevo {pct(margen(c.coste_completo_nuevo, c.pvp))}</span></td>
                  <td style={{ minWidth: 230 }}>
                    <button className="btn-p" disabled={busy === c.id} onClick={() => decidir(c, "aplicado")}>Es real, aplicar coste</button>{" "}
                    <button className="btn-l" disabled={busy === c.id} onClick={() => decidir(c, "error")}>Es un error</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- IVA: asignado por tipo de producto sin factura que lo confirme, o una factura trajo otro ----------
function SecIva({ lista, otras, onListo }) {
  const [grupos, setGrupos] = useState([]);
  const [elegido, setElegido] = useState({});
  const [cat, setCat] = useState(null); // { nombre, productos, pct }
  const [busy, setBusy] = useState(null);
  useEffect(() => { sb.rpc("iva_grupos").then(setGrupos).catch(() => setGrupos([])); }, []);
  const grupo = (p) => grupos.find((g) => Number(g.pct) === Number(p));
  const aplicar = async (productIds, p, clave, texto) => {
    const g = grupo(p); if (!g) { avisar("No encuentro ese IVA en Epos", "mal"); return false; }
    setBusy(clave);
    try {
      await guardarCambios(productIds.map((id) => ({ id, campos: { iva_id: Number(g.id) } })), texto);
      onListo(await sb.rpc("revisar_decidir", { p: { tipo: "iva", pct: Number(p), product_ids: productIds } }));
      avisar(`IVA ${p} % guardado en Epos (${productIds.length} producto${productIds.length === 1 ? "" : "s"})`);
      setBusy(null); return true;
    } catch (e) { avisar(msg(e), "mal"); setBusy(null); return false; }
  };
  const verCategoria = async (nombre, p) => {
    try { setCat({ nombre, pct: p, productos: await sb.rpc("revisar_iva_categoria", { p_categoria: nombre }) }); } catch (e) { avisar(msg(e), "mal"); }
  };
  const estado = (r) => (r.discrepancia_pct != null ? `Una factura trajo otro IVA (antes ${r.discrepancia_pct} %)` : r.estado === "segunda revisión" ? "Sin factura que lo confirme (2.ª revisión)" : "Sin factura que lo confirme");
  return (
    <div className="card mt">
      <div className="head"><div><h2>IVA</h2><p className="sub">Productos con el IVA asignado por tipo de producto que aún no ha confirmado ninguna factura (al mes y a los dos meses), o donde una factura trajo un IVA distinto. Elige 4, 10 o 21 % y guarda, para el producto o para toda su categoría (antes ves a qué productos afecta).</p></div></div>
      {cat && (
        <div style={{ background: "#F7F2E9", borderRadius: 12, padding: 14, margin: "4px 0 14px" }}>
          <div className="pn">Poner IVA {cat.pct} % a toda la categoría «{cat.nombre}»</div>
          <p className="pf">Se cambian en Epos estos {cat.productos.length} productos (los que ya tienen {cat.pct} % no cambian):</p>
          <div style={{ maxHeight: 220, overflow: "auto", margin: "6px 0 10px", fontSize: 13 }}>
            {cat.productos.map((x) => <div key={x.product_id}>{x.nombre} <span style={{ color: "var(--muted)" }}>· ahora {x.pct == null ? "sin IVA" : `${x.pct} %`}</span></div>)}
          </div>
          <button className="btn-p" disabled={busy === "cat" || !cat.productos.length} onClick={async () => { if (await aplicar(cat.productos.map((x) => Number(x.product_id)), cat.pct, "cat", `IVA ${cat.pct} % en «${cat.nombre}»`)) setCat(null); }}>Aplicar a los {cat.productos.length}</button>{" "}
          <button className="btn-txt" onClick={() => setCat(null)}>Cancelar</button>
        </div>
      )}
      {!lista.length ? <p className="empty">Nada pendiente de IVA.</p> : (
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Producto</th><th>Por qué</th><th className="r">IVA ahora</th><th>Qué hacer</th></tr></thead>
            <tbody>
              {lista.map((r) => {
                const e = elegido[r.product_id] ?? r.pct;
                return (
                  <tr key={r.product_id}>
                    <td><span className="pn">{r.nombre}</span><span className="pf">{[r.categoria, r.proveedor].filter(Boolean).join(" · ")}</span><Otras lista={otras(r.product_id, "iva")} /></td>
                    <td><span className="pf" style={{ color: "var(--text)" }}>{estado(r)}</span></td>
                    <td className="r b">{r.pct} %</td>
                    <td style={{ minWidth: 300 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <div className="seg" role="group" aria-label={`IVA de ${r.nombre}`}>{[4, 10, 21].map((p) => <button key={p} aria-pressed={Number(e) === p} onClick={() => setElegido({ ...elegido, [r.product_id]: p })}>{p} %</button>)}</div>
                        <button className="btn-p" disabled={busy === r.product_id} onClick={() => aplicar([Number(r.product_id)], e, r.product_id, `IVA ${e} % en «${r.nombre}»`)}>Guardar</button>
                        {r.categoria && <button className="btn-txt" onClick={() => verCategoria(r.categoria, e)}>A toda «{r.categoria}»</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Productos nuevos (altas desde la recepción), igual que antes ----------
function Nuevos({ d, P, U, cargar, otras }) {
  const [filtro, setFiltro] = useState("");
  const [sel, setSel] = useState([]);
  const [costes, setCostes] = useState({});
  const [provs, setProvs] = useState({});
  const [pvps, setPvps] = useState({});
  const [busy, setBusy] = useState(null);
  const filas = d.altas.map((a) => ({ ...a, _m: motivos(a) })).filter((a) => a._m.length && (!filtro || a._m.some(([k]) => k === filtro)));
  const cuenta = (k) => d.altas.filter((a) => motivos(a).some(([x]) => x === k)).length;
  // #32: cambiar el precio de venta desde aquí, igual que en el Catálogo (Epos al momento y queda en el historial)
  const guardarPvp = async (a, p) => {
    const nuevo = numero(pvps[a.id]); const antes = Number(p?.sale_price ?? a.pvp);
    if (!(nuevo > 0)) { avisar("El precio de venta no puede quedar vacío", "mal"); return; }
    if (Math.abs(nuevo - antes) < 0.005) { avisar("Es el mismo precio"); return; }
    if (!window.confirm(`Cambia el precio en caja de «${p?.name || a.nombre}» de ${eur(antes, 2)} a ${eur(nuevo, 2)}. ¿Seguimos?`)) return;
    setBusy(a.id);
    try { await guardarCambios([{ id: Number(a.product_id), campos: { pvp: nuevo } }], `Precio de «${p?.name || a.nombre}» a ${eur(nuevo, 2)}`); avisar(`Precio ${eur(nuevo, 2)} guardado en Epos`); setPvps((x) => ({ ...x, [a.id]: undefined })); await cargar(); }
    catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };
  const hacer = async (id, accion, datos, ok) => { setBusy(id); try { const r = await fn(accion, datos); avisar(typeof ok === "function" ? ok(r) : ok); setSel([]); await cargar(); } catch (e) { avisar(e.message || "No se ha podido", "mal"); } setBusy(null); };
  return (
    <div className="card mt">
      <div className="head">
        <div><h2>Productos dados de alta desde la recepción</h2><p className="sub">Ya están en Epos y se pueden vender. El precio de venta se cambia aquí mismo (se guarda en Epos al momento y queda en el historial); nombre, categoría e IVA, en el Catálogo. Luego márcalos como revisados. Los precios corregidos por coste aparecen en Recepción → Precios por aprobar.</p></div>
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
                      <Otras lista={a.product_id ? otras(a.product_id, "nuevos") : []} />
                    </td>
                    <td>{a._m.map(([k, t]) => chip(k, t))}{a.precio_marcado && chip("margen", `Precio marcado · ${eur(a.pvp, 2)}`)}{a.precio_marcado && !a.revisado && <span className="pf">Viene con el precio puesto: compruébalo y pulsa «Revisado».</span>}</td>
                    <td className="r">{a.coste_sin_iva != null ? eur(a.coste_sin_iva, 3) : "—"}{a.coste_introducido != null && a.coste_introducido !== a.coste_sin_iva && <span className="pf">puso {String(a.coste_introducido).replace(".", ",")}{a.interpretacion ? ` (${a.interpretacion})` : ""}</span>}
                      {a.estado_coste === "sin_verificar" && <span className="pf" style={{ textAlign: "left", maxWidth: 210, marginLeft: "auto" }}>{a.coste_sin_iva == null && a.coste_introducido == null ? `Se dio de alta sin coste: se cogerá de la factura${a.proveedor ? ` de ${a.proveedor}` : ""} cuando llegue, o ponlo aquí.` : `Es el coste que puso ${U.get(a.creado_por) || "la trabajadora"} al darlo de alta. Aún no lo ha confirmado ninguna factura${a.proveedor ? ` de ${a.proveedor}` : ""}; se confirma solo cuando llegue.`}</span>}</td>
                    <td className="r">{eur(p?.sale_price ?? a.pvp, 2)}{a.product_id && !p?.archivado && (
                        <span style={{ display: "flex", gap: 4, justifyContent: "flex-end", margin: "4px 0 2px" }}>
                          <label style={{ position: "absolute", left: -9999 }} htmlFor={`pv-${a.id}`}>Nuevo precio de venta de {a.nombre}</label>
                          <input id={`pv-${a.id}`} className="mini-input" inputMode="decimal" placeholder="Nuevo PVP" value={pvps[a.id] ?? ""} onChange={(e) => setPvps({ ...pvps, [a.id]: e.target.value })} style={{ width: 80 }} />
                          <button className="btn-l" disabled={busy === a.id || !(numero(pvps[a.id]) > 0)} onClick={() => guardarPvp(a, p)}>Guardar</button>
                        </span>
                      )}<span className="pf">{a.estado_coste === "sin_verificar" && a.coste_sin_iva == null && a.coste_introducido == null ? "precio momentáneo · " : ""}{PVP_ORIGEN[a.pvp_origen] || ""}{a.pvp_origen === "trabajadora" && a.pvp_calculado != null ? ` · el sistema daba ${eur(a.pvp_calculado, 2)}` : ""}</span></td>
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
  );
}

// ---------- Código de barras e Incidencias (incidencias de códigos, igual que antes, separadas por tipo) ----------
function Incidencias({ lista, P, U, onHecho, otras, sec, vacio, titulo }) {
  const [busy, setBusy] = useState(null);
  if (!lista.length) return <div className="card mt"><p className="empty">{vacio}</p></div>;
  const resolver = async (i, accion, txt) => {
    if (accion !== "descartar" && !window.confirm(txt)) return;
    setBusy(i.id);
    try { const r = await fn("incidencia_resolver", { id: i.id, accion_resolver: accion }); avisar(r.resolucion || "Resuelta"); onHecho(); }
    catch (e) { avisar(e.message || "No se ha podido", "mal"); }
    setBusy(null);
  };
  return (
    <div className="card mt">
      <div className="head"><div><h2>{titulo}</h2><p className="sub">Mientras no se resuelven, el producto nuevo no se da de alta (o se queda sin código).</p></div></div>
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
                  <td><span className="pn">{ex?.name || "—"}</span>{ex && <span className="pf">{eur(ex.sale_price, 2)} · {ex.supplier_name || "sin proveedor"}</span>}<Otras lista={i.product_id_existente ? otras(i.product_id_existente, sec) : []} /></td>
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

// ---------- #35 · Precios cambiados en tienda: ya están en Epos; dirección comprueba y marca «Revisado» o lo devuelve ----------
async function cargarTienda() {
  const [lista, us] = await Promise.all([
    sb.select("precio_cambios_tienda", "select=*&revisado=eq.false&order=creado_en.desc&limit=300"),
    sb.select("usuarios", "select=id,nombre"),
  ]);
  return { lista: lista || [], nombres: new Map((us || []).map((u) => [u.id, (u.nombre || "").split(" ")[0]])) };
}
function SecTienda({ lista, nombres, otras, onHecho }) {
  const [busy, setBusy] = useState(null);
  const revisado = async (c) => {
    setBusy(c.id);
    try { await sb.update("precio_cambios_tienda", `id=eq.${c.id}`, { revisado: true, revisado_por: (await sb.rpc("current_usuario_id").catch(() => null)) || null, revisado_en: new Date().toISOString() }); avisar("Marcado como revisado"); await onHecho(); }
    catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };
  const devolver = async (c) => {
    if (!window.confirm(`Vuelve a poner «${c.nombre}» a ${eur(c.pvp_antes, 2)} en la caja${c.precio_marcado != null ? " y deja de contar como precio marcado" : ""}. ¿Seguimos?`)) return;
    setBusy(c.id);
    try {
      await guardarCambios([{ id: Number(c.product_id), campos: { pvp: Number(c.pvp_antes) } }], `Precio de «${c.nombre}» devuelto a ${eur(c.pvp_antes, 2)}`);
      if (c.precio_marcado != null) await sb.update("producto_precio_marcado", `product_id=eq.${c.product_id}`, { activo: false });
      await sb.update("precio_cambios_tienda", `id=eq.${c.id}`, { revisado: true, revisado_por: (await sb.rpc("current_usuario_id").catch(() => null)) || null, revisado_en: new Date().toISOString() });
      avisar(`Precio ${eur(c.pvp_antes, 2)} guardado en Epos`); await onHecho();
    } catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };
  return (
    <div className="card mt">
      <div className="head"><div><h2>Precios cambiados en tienda</h2><p className="sub">Cambios que han hecho las trabajadoras desde «Escanear producto → Cambiar precio». Ya están en Epos. Compruébalos y pulsa «Revisado», o devuelve el precio anterior. Con «Precio marcado», el producto queda marcado y los avisos de precio no proponen subirlo.</p></div></div>
      {!lista.length ? <p className="empty">No hay cambios de precio por revisar.</p> : (
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Producto</th><th className="r">Antes</th><th className="r">Ahora</th><th>Motivo</th><th>Qué hacer</th></tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td><span className="pn">{c.nombre}</span><span className="pf">{[c.barcode, nombres.get(c.creado_por) || "—", hace(c.creado_en)].filter(Boolean).join(" · ")}</span><Otras lista={otras(c.product_id, "tienda")} /></td>
                  <td className="r">{eur(c.pvp_antes, 2)}</td>
                  <td className="r"><b>{eur(c.pvp_nuevo, 2)}</b></td>
                  <td>{c.motivo}{c.precio_marcado != null && <span style={{ display: "block", marginTop: 3 }}>{chip("prov", `Precio marcado · ${eur(c.precio_marcado, 2)}`)}</span>}</td>
                  <td style={{ minWidth: 220 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn-p" disabled={busy === c.id} onClick={() => revisado(c)}>Revisado</button>
                      {Math.abs(Number(c.pvp_antes) - Number(c.pvp_nuevo)) >= 0.005 && <button className="btn-l" disabled={busy === c.id} onClick={() => devolver(c)}>Volver a {eur(c.pvp_antes, 2)}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
