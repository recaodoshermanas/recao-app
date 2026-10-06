// Salud del catálogo: cada aviso es una lista de trabajo que se arregla aquí mismo
// (se escribe en Epos al momento) con sugerencias y cambios en lote.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../src/lib/supabase.js";
import { eur, pct, num } from "../fmt.js";
import { Pestanas, Cargando, fechaCorta, hace, avisar, confirmar } from "../ui.jsx";
import { n0, r0, margenPct, margenUnit, tiene, useDatos, cargar, guardarCambios, deshacer, sugeridor } from "./datos.js";
import { FichaProducto, SelectCat, SelectProv, SelectIva, BarraDeshacer } from "./Ficha.jsx";

const dec = (s) => (s === "" || s == null ? null : Number(String(s).replace(",", ".")));
export const SECCIONES = [
  { id: "rotura", t: "Posibles roturas", d: "Se venden casi a diario (al menos 20 de los últimos 28 días) y no se han vendido ni ayer, ni anteayer, ni hoy. Lo más probable es que falten en la tienda." },
  { id: "siniva", t: "Sin IVA", d: "No tienen grupo de IVA en Epos, así que la caja los cobra sin separar IVA: el IVA que sale de Epos es menor del real y el margen aparece inflado. El precio en caja no cambia al asignarlo. Ojo: el tipo correcto (4, 10 o 21 %) lo marca la ley para cada producto; ante la duda, confírmalo con la gestoría.", lote: "iva_id" },
  { id: "sincoste", t: "Sin coste", d: "No tienen precio de coste en Epos, así que no sabemos cuánto dejan. El coste estimado sale del margen típico de su categoría: úsalo solo si no tienes la factura a mano." },
  { id: "negativo", t: "Pierden dinero", d: "Se venden por debajo de lo que cuestan. Revisa el coste (puede estar mal puesto) o el precio." },
  { id: "margen", t: "Margen bajo", d: "Margen por debajo del 15 %. Revisa precio de venta o de compra." },
  { id: "sinprov", t: "Sin proveedor", d: "Sin proveedor no se pueden preparar pedidos ni cuadrar compras con ventas.", lote: "proveedor_id" },
  { id: "sincat", t: "Sin categoría", d: "Sin categoría no cuentan en su familia y la caja es más difícil de usar.", lote: "categoria_id" },
  { id: "sinbc", t: "Sin código", d: "Productos importantes (clase A o B) sin código de barras: se cobran a mano y es fácil equivocarse. Escanea el código en el campo y pulsa Intro." },
  { id: "dormidos", t: "Dormidos", d: "Sin ventas en 90 días: candidatos a archivar en Epos para limpiar la caja y el catálogo antes del inventario. Archivar se puede deshacer.", lote: "archivado" },
  { id: "historial", t: "Historial" },
];

// % de la venta de 30 días que está en productos con los datos básicos completos
export function salud(ps) {
  const v = ps.reduce((s, p) => s + n0(p.v), 0);
  const ok = ps.filter((p) => n0(p.v) > 0 && !["siniva", "sincoste", "sinprov", "sincat"].some((id) => tiene(p, id))).reduce((s, p) => s + n0(p.v), 0);
  return v > 0 ? (ok / v) * 100 : null;
}

export function Salud({ extra }) {
  const C = useDatos("catalogo");
  const [sec, setSec] = useState(SECCIONES.some((s) => s.id === extra) ? extra : "siniva");
  const [ficha, setFicha] = useState(null);
  if (!C.d) return <Cargando texto={C.fallo ? "No se han podido cargar los datos de Epos. Recarga en un momento." : "Cargando datos de Epos…"} />;
  const cat = C.d.productos;
  const de = (id) => cat.filter((p) => tiene(p, id));
  const S = SECCIONES.find((s) => s.id === sec);
  const sana = salud(cat);
  return (
    <>
      <div className="salud-cab card">
        <div>
          <h2>Catálogo sano</h2>
          <p className="sub">De la venta de los últimos 30 días, la parte que está en productos con IVA, coste, proveedor y categoría bien puestos en Epos.</p>
        </div>
        <div className="salud-num"><b>{sana == null ? "–" : `${num(sana, 0)} %`}</b><span className="barra-h"><i style={{ width: `${sana || 0}%`, background: sana > 90 ? "var(--up)" : "var(--amarillo-hondo)" }} /></span></div>
      </div>
      <div className="barra-sec salud-sec"><Pestanas valor={sec} onChange={setSec} etiqueta="Revisión" opciones={SECCIONES.map((s) => ({ id: s.id, label: s.t, n: s.id === "historial" ? null : de(s.id).length }))} /></div>
      {sec === "historial" ? <HistorialGeneral /> : <Lista key={sec} S={S} lista={de(sec)} C={C.d} onFicha={setFicha} />}
      <BarraDeshacer />
      {ficha && <FichaProducto p={ficha} onClose={() => setFicha(null)} pestana={sec === "rotura" ? "ventas" : "editar"} />}
    </>
  );
}

function Lista({ S, lista: lista0, C, onFicha }) {
  const sec = S.id;
  const sug = sugeridor(C);
  const lista = useMemo(() => [...lista0].sort((a, b) => (sec === "dormidos" ? String(b.ult || "").localeCompare(String(a.ult || "")) : n0(b.v90) - n0(a.v90))), [lista0, sec]);
  const [ed, setEd] = useState({}); // ediciones por fila
  const [sel, setSel] = useState(() => new Set());
  const [guardando, setGuardando] = useState(null);
  const [loteValor, setLoteValor] = useState(null);
  const [limite, setLimite] = useState(150);
  useEffect(() => { setSel(new Set()); }, [sec]);
  // la sugerencia de cada fila, para precargarla y para "aceptar sugerencias"
  const sugerencia = (p) => (sec === "sinprov" ? sug.prov(p) : sec === "sincat" ? sug.cat(p) : sec === "siniva" ? sug.iva(p) : sec === "sincoste" ? sug.coste(p) : null);
  // el IVA es fiscal: se sugiere fila a fila pero no se acepta en bloque sin mirarlo
  const conSug = sec === "sinprov" || sec === "sincat" ? lista.filter((p) => sugerencia(p)) : [];
  const campoLote = S.lote;
  const visibles = lista.slice(0, limite);
  const todos = visibles.length > 0 && visibles.every((p) => sel.has(p.id));
  const marcar = (id) => setSel((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  async function guardarFila(p, campos, texto) {
    setGuardando(p.id);
    try { await guardarCambios([{ id: p.id, campos }], texto || `«${p.n}» guardado en Epos`); setEd((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== String(p.id)))); }
    catch (e) { avisar(e.message, "error"); }
    setGuardando(null);
  }
  async function aplicarLote(cambios, texto) {
    if (!cambios.length) return;
    const aviso = S.id === "siniva" ? `Se va a asignar IVA a ${cambios.length} productos en Epos. El precio en caja no cambia, pero desde ahora la caja separará el IVA en esos productos (y el IVA que sale de Epos subirá). ¿Seguimos?` : `Se van a cambiar ${cambios.length} productos en Epos. ¿Seguimos?`;
    if ((cambios.length > 20 || S.id === "siniva") && !(await confirmar(aviso))) return;
    setGuardando("lote");
    try { await guardarCambios(cambios, texto); setSel(new Set()); setLoteValor(null); }
    catch (e) { avisar(e.message, "error"); }
    setGuardando(null);
  }
  const valorFila = (p, k, def) => (ed[p.id]?.[k] !== undefined ? ed[p.id][k] : def);
  const editar = (p, k, v) => setEd((e) => ({ ...e, [p.id]: { ...e[p.id], [k]: v } }));

  if (!lista.length) return <div className="card"><h2>{S.t}</h2><p className="sub">{S.d}</p><p className="vacio-ok"><b>✓</b>Nada por aquí. Todo en orden.</p></div>;

  return (
    <div className="card">
      <div className="head">
        <div><h2>{S.t} · {num(lista.length)}</h2><p className="sub">{S.d}</p></div>
        {conSug.length > 0 && <button className="btn-l" disabled={guardando === "lote"} onClick={() => aplicarLote(conSug.map((p) => ({ id: p.id, campos: { [campoLote]: sugerencia(p).id } })), `Sugerencias aplicadas a ${conSug.length} productos`)}>★ Aceptar las {num(conSug.length)} sugerencias</button>}
      </div>

      {campoLote && sel.size > 0 && (
        <div className="lote-barra">
          <b>{sel.size} seleccionado{sel.size > 1 ? "s" : ""}</b>
          {campoLote === "archivado" ? (
            <button className="btn-p" disabled={guardando === "lote"} onClick={async () => { if (await confirmar(`¿Archivar ${sel.size} productos en Epos? Dejan de salir en la caja. Se puede deshacer.`)) aplicarLote([...sel].map((id) => ({ id, campos: { archivado: true } })), `${sel.size} productos archivados en Epos`); }}>{guardando === "lote" ? "Archivando…" : "Archivar en Epos"}</button>
          ) : (
            <>
              {campoLote === "proveedor_id" && <SelectProv valor={loteValor} onChange={setLoteValor} proveedores={C.proveedores} vacio="Elige proveedor…" />}
              {campoLote === "categoria_id" && <SelectCat valor={loteValor} onChange={setLoteValor} categorias={C.categorias} vacio="Elige categoría…" />}
              {campoLote === "iva_id" && <SelectIva valor={loteValor} onChange={setLoteValor} iva={C.iva} vacio="Elige IVA…" />}
              <button className="btn-p" disabled={!loteValor || guardando === "lote"} onClick={() => aplicarLote([...sel].map((id) => ({ id, campos: { [campoLote]: loteValor } })), `${sel.size} productos actualizados en Epos`)}>{guardando === "lote" ? "Guardando…" : "Aplicar"}</button>
            </>
          )}
          <button className="btn-txt" onClick={() => setSel(new Set())}>Quitar selección</button>
        </div>
      )}

      <div className="tabla-scroll">
        <table className="ranking salud-t">
          <thead><tr>
            {campoLote && <th className="chk-c"><input type="checkbox" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(visibles.map((p) => p.id)))} aria-label="Seleccionar todos" /></th>}
            <th>Producto</th><th className="r">Venta 30 d</th>
            {sec === "rotura" && <><th className="r">Días con venta (28)</th><th className="r">Hoy</th><th className="r">Última venta</th></>}
            {sec === "dormidos" && <><th className="r">PVP</th><th className="r">Última venta</th><th></th></>}
            {!["rotura", "dormidos"].includes(sec) && <th className="arreglo">Arreglar</th>}
          </tr></thead>
          <tbody>
            {visibles.map((p) => {
              const sg = sugerencia(p);
              return (
                <tr key={p.id} className={sel.has(p.id) ? "sel" : ""}>
                  {campoLote && <td className="chk-c"><input type="checkbox" checked={sel.has(p.id)} onChange={() => marcar(p.id)} aria-label={`Seleccionar ${p.n}`} /></td>}
                  <td><button className="enlace-p" onClick={() => onFicha(p)}><span className="pn">{p.n}</span></button><span className="pf">{p.abc} · {p.fam}{p.cat ? ` · ${p.cat}` : ""}{p.prov ? ` · ${p.prov}` : ""}</span></td>
                  <td className="r b">{eur(r0(p.v))}{sec === "siniva" || sec === "sincat" ? <small>{eur(r0(p.v90))} en 90 d</small> : null}</td>
                  {sec === "rotura" && <><td className="r">{p.d28}</td><td className="r">{num(p.uh)} uds.</td><td className="r">{p.ult ? fechaCorta(p.ult) : "–"}</td></>}
                  {sec === "dormidos" && <><td className="r">{p.pvp != null ? eur(p.pvp, 2) : "–"}</td><td className="r">{p.ult ? fechaCorta(p.ult) : "nunca"}</td><td className="r"><button className="btn-l" disabled={guardando === p.id} onClick={() => guardarFila(p, { archivado: true }, `«${p.n}» archivado en Epos`)}>Archivar</button></td></>}
                  {sec === "siniva" && <td className="arreglo"><div className="arr">
                    <SelectIva valor={valorFila(p, "iva_id", sg?.id ?? null)} onChange={(v) => editar(p, "iva_id", v)} iva={C.iva} vacio="Elige IVA" />
                    {sg && valorFila(p, "iva_id", sg.id) === sg.id && <small className="por">★ como el resto de «{sg.por}»</small>}
                    <button className="btn-p" disabled={!valorFila(p, "iva_id", sg?.id) || guardando === p.id} onClick={() => guardarFila(p, { iva_id: valorFila(p, "iva_id", sg?.id) })}>Guardar</button>
                  </div></td>}
                  {sec === "sincoste" && <td className="arreglo"><div className="arr">
                    <input className="mini-in" inputMode="decimal" value={valorFila(p, "coste", "")} onChange={(e) => editar(p, "coste", e.target.value)} placeholder={sg ? `≈ ${num(sg.coste, 2)}` : "Coste €"} aria-label={`Coste de ${p.n}`} onKeyDown={(e) => { if (e.key === "Enter" && dec(valorFila(p, "coste", "")) > 0) guardarFila(p, { coste: dec(valorFila(p, "coste", "")) }); }} />
                    <small className="por">PVP {eur(p.pvp, 2)}{p.iva == null ? " · sin IVA" : ""}{dec(valorFila(p, "coste", "")) > 0 ? ` → margen ${num(margenUnit(p.pvp, dec(valorFila(p, "coste", "")), p.iva ?? 0), 0)} %` : sg ? ` · estimado con margen ${num(sg.margen, 0)} %` : ""}</small>
                    {sg && !valorFila(p, "coste", "") && <button className="btn-txt" onClick={() => editar(p, "coste", String(sg.coste).replace(".", ","))}>Usar estimado</button>}
                    <button className="btn-p" disabled={!(dec(valorFila(p, "coste", "")) > 0) || guardando === p.id} onClick={() => guardarFila(p, { coste: dec(valorFila(p, "coste", "")) })}>Guardar</button>
                  </div></td>}
                  {(sec === "negativo" || sec === "margen") && (() => {
                    const co = valorFila(p, "coste", String(p.cost ?? "").replace(".", ",")), pv = valorFila(p, "pvp", String(p.pvp ?? "").replace(".", ","));
                    const m = margenUnit(dec(pv), dec(co), p.iva ?? 0), m30 = margenPct(p.vs, p.c);
                    const campos = {}; if (dec(co) !== n0(p.cost)) campos.coste = dec(co); if (dec(pv) !== n0(p.pvp)) campos.pvp = dec(pv);
                    return <td className="arreglo"><div className="arr">
                      <label className="mini-l">Coste<input className="mini-in" inputMode="decimal" value={co} onChange={(e) => editar(p, "coste", e.target.value)} /></label>
                      <label className="mini-l">PVP<input className="mini-in" inputMode="decimal" value={pv} onChange={(e) => editar(p, "pvp", e.target.value)} /></label>
                      <small className={`por ${m != null && m < 15 ? "mal" : ""}`}>{m != null ? `margen ${num(m, 1)} %` : "–"}{m30 != null ? ` (vendido: ${num(m30, 1)} %)` : ""}</small>
                      <button className="btn-p" disabled={!Object.keys(campos).length || guardando === p.id} onClick={async () => { if (campos.pvp != null && !(await confirmar(`Cambia el precio en caja de «${p.n}» de ${eur(p.pvp, 2)} a ${eur(campos.pvp, 2)}. ¿Seguimos?`))) return; guardarFila(p, campos); }}>Guardar</button>
                    </div></td>;
                  })()}
                  {sec === "sinprov" && <td className="arreglo"><div className="arr">
                    <SelectProv valor={valorFila(p, "proveedor_id", sg?.id ?? null)} onChange={(v) => editar(p, "proveedor_id", v)} proveedores={C.proveedores} vacio="Elige proveedor" />
                    {sg && valorFila(p, "proveedor_id", sg.id) === sg.id && <small className="por">★ como {sg.cuantos} productos «{sg.por.toLowerCase()}»</small>}
                    <button className="btn-p" disabled={!valorFila(p, "proveedor_id", sg?.id) || guardando === p.id} onClick={() => guardarFila(p, { proveedor_id: valorFila(p, "proveedor_id", sg?.id) })}>Guardar</button>
                  </div></td>}
                  {sec === "sincat" && <td className="arreglo"><div className="arr">
                    <SelectCat valor={valorFila(p, "categoria_id", sg?.id ?? null)} onChange={(v) => editar(p, "categoria_id", v)} categorias={C.categorias} vacio="Elige categoría" />
                    {sg && valorFila(p, "categoria_id", sg.id) === sg.id && <small className="por">★ como {sg.cuantos} productos «{sg.por.toLowerCase()}»</small>}
                    <button className="btn-p" disabled={!valorFila(p, "categoria_id", sg?.id) || guardando === p.id} onClick={() => guardarFila(p, { categoria_id: valorFila(p, "categoria_id", sg?.id) })}>Guardar</button>
                  </div></td>}
                  {sec === "sinbc" && <td className="arreglo"><div className="arr">
                    <input className="mini-in largo" inputMode="numeric" value={valorFila(p, "codigo", "")} onChange={(e) => editar(p, "codigo", e.target.value)} placeholder="Escanea el código" aria-label={`Código de ${p.n}`} onKeyDown={(e) => { if (e.key === "Enter" && valorFila(p, "codigo", "").trim()) guardarFila(p, { codigo: valorFila(p, "codigo", "").trim() }); }} />
                    {(() => { const c = valorFila(p, "codigo", "").trim(); const rep = c && C.productos.find((q) => q.cod === c && q.id !== p.id); return rep ? <small className="por mal">Ya lo tiene «{rep.n}»</small> : null; })()}
                    <button className="btn-p" disabled={!valorFila(p, "codigo", "").trim() || guardando === p.id} onClick={() => guardarFila(p, { codigo: valorFila(p, "codigo", "").trim() })}>Guardar</button>
                  </div></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lista.length > limite && <button className="btn-l mas" onClick={() => setLimite(limite + 300)}>Ver más ({num(lista.length - limite)} restantes)</button>}
    </div>
  );
}

const CAMPO_T = { nombre: "nombre", categoria_id: "categoría", proveedor_id: "proveedor", coste: "coste", pvp: "precio", codigo: "código", iva_id: "IVA", archivado: "archivado", alta: "alta" };
function HistorialGeneral() {
  const C = useDatos("catalogo");
  const [h, setH] = useState(null);
  const valor = (campo, v) => {
    if (v == null || v === "") return "—";
    if (campo === "categoria_id") return C.d?.categorias?.find((x) => String(x.id) === v)?.n || v;
    if (campo === "proveedor_id") return C.d?.proveedores?.find((x) => String(x.id) === v)?.n || v;
    if (campo === "iva_id") return C.d?.iva?.find((x) => String(x.id) === v)?.n || v;
    if (campo === "coste" || campo === "pvp") return eur(Number(v), 2);
    if (campo === "archivado") return v === "true" ? "sí" : "no";
    return v;
  };
  const [abierto, setAbierto] = useState(null);
  const [haciendo, setHaciendo] = useState(null);
  const recargar = () => supabase.rpc("dash_producto_cambios", { p_limite: 150 }).then(({ data }) => setH(data || []));
  useEffect(() => { recargar(); }, []);
  if (!h) return <Cargando />;
  if (!h.length) return <div className="card"><h2>Historial</h2><p className="empty">Todavía no se ha cambiado nada desde el panel. Cada cambio que se haga quedará aquí, con quién y cuándo, y se podrá deshacer.</p></div>;
  return (
    <div className="card">
      <h2>Historial de cambios en Epos</h2>
      <p className="sub">Todo lo que se cambia desde el panel. Deshacer devuelve los productos a como estaban.</p>
      <ul className="historial-g">
        {h.map((l) => (
          <li key={l.lote} className={l.deshecho ? "deshecho" : ""}>
            <div className="hg-cab">
              <button className="enlace-p" onClick={() => setAbierto(abierto === l.lote ? null : l.lote)}>
                <b>{l.productos === 1 ? l.detalle[0].n : `${num(l.productos)} productos`}</b>
                <span className="pf">{l.campos.map((c) => CAMPO_T[c] || c).join(", ")} · {l.quien || "—"} · {hace(l.cuando)}{l.deshecho ? " · deshecho" : ""}</span>
              </button>
              {!l.deshecho && !l.campos.includes("alta") && <button className="btn-l" disabled={haciendo === l.lote} onClick={async () => { if (!(await confirmar("¿Deshacer este cambio en Epos?"))) return; setHaciendo(l.lote); try { await deshacer(l.lote); avisar("Cambio deshecho en Epos"); await recargar(); } catch (e) { avisar(e.message, "error"); } setHaciendo(null); }}>{haciendo === l.lote ? "Deshaciendo…" : "Deshacer"}</button>}
            </div>
            {abierto === l.lote && <ul className="hg-det">{l.detalle.slice(0, 80).map((d, i) => <li key={i}><span>{d.n}</span><small>{CAMPO_T[d.campo] || d.campo}: {valor(d.campo, d.antes)} → {valor(d.campo, d.despues)}</small></li>)}{l.detalle.length > 80 && <li><small>y {l.detalle.length - 80} más</small></li>}</ul>}
          </li>
        ))}
      </ul>
      <button className="btn-txt" onClick={() => cargar("catalogo")}>Recargar catálogo</button>
    </div>
  );
}
