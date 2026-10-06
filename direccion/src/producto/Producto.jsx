// Producto: el corazón de Recao. Todo sale de Epos (ventas línea a línea, catálogo y costes)
// y de las facturas de proveedores. Periodo de referencia: últimos 30 días completos frente a los 30 anteriores.
// Los datos de producto se pueden cambiar desde aquí: se escriben en Epos al momento (ver datos.js y Ficha.jsx).
import { useMemo, useState } from "react";
import { eur, eurK, pct, num, mesCorto, mesAnio } from "../fmt.js";
import { Cargando, ir, avisar, confirmar } from "../ui.jsx";
import { FAMILIAS, COLOR_FAM, ESTADOS, n0, r0, margenPct, varPct, senales, tiene, useDatos, guardarCambios } from "./datos.js";
import { FichaProducto, NuevoProducto, SelectCat, SelectProv, SelectIva, BarraDeshacer, Delta } from "./Ficha.jsx";
import { salud } from "./Salud.jsx";
export { Salud } from "./Salud.jsx";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const useResumen = () => useDatos("resumen");
const useCatalogo = () => useDatos("catalogo");
function Estado({ fallo }) { return <Cargando texto={fallo ? "No se han podido cargar los datos de Epos. Recarga en un momento." : "Cargando datos de Epos…"} />; }

// ---------- 1. Resumen ----------
export function ProductoResumen() {
  const R = useResumen();
  const C = useCatalogo();
  const [ficha, setFicha] = useState(null);
  if (!R.d) return <Estado fallo={R.fallo} />;
  const d = R.d; const k = d.kpi || {}; const a = k.act || {}; const b = k.ant || {};
  const mA = margenPct(a.vs, a.c), mB = margenPct(b.vs, b.c);
  const cat = C.d?.productos || [];
  // familias en el periodo (desde el catálogo)
  const fam = FAMILIAS.map((f) => {
    const ps = cat.filter((p) => p.fam === f);
    const v = ps.reduce((s, p) => s + n0(p.v), 0), v0 = ps.reduce((s, p) => s + n0(p.v0), 0);
    const vs = ps.reduce((s, p) => s + n0(p.vs), 0), c = ps.reduce((s, p) => s + n0(p.c), 0);
    return { f, v, v0, vs, c, m: margenPct(vs, c), mEur: vs - c, refs: ps.filter((p) => n0(p.v) > 0).length };
  }).filter((x) => x.v > 0).sort((x, y) => y.v - x.v);
  const totV = fam.reduce((s, x) => s + x.v, 0), totMargen = fam.reduce((s, x) => s + x.mEur, 0);
  const movers = cat.filter((p) => n0(p.v) + n0(p.v0) > 40).map((p) => ({ ...p, dif: n0(p.v) - n0(p.v0) }));
  const suben = [...movers].sort((x, y) => y.dif - x.dif).slice(0, 7);
  const bajan = [...movers].sort((x, y) => x.dif - y.dif).slice(0, 7);
  const claseA = cat.filter((p) => p.abc === "A");
  const conteo = (id) => cat.filter((p) => tiene(p, id)).length;
  const ventaDe = (id) => r0(cat.filter((p) => tiene(p, id)).reduce((s, p) => s + n0(p.v), 0));
  const sana = cat.length ? salud(cat) : null;
  const alertas = [
    { id: "rotura", n: conteo("rotura"), t: "posibles roturas: productos que se venden casi a diario y llevan desde anteayer sin venderse" },
    { id: "siniva", n: conteo("siniva"), t: `productos sin IVA en Epos: ${eur(ventaDe("siniva"))} vendidos en 30 días sin repercutir IVA` },
    { id: "sincoste", n: conteo("sincoste"), t: `productos vendidos sin precio de coste en Epos (${eur(ventaDe("sincoste"))} de venta sin margen conocido)` },
    { id: "margen", n: conteo("margen") + conteo("negativo"), t: "productos con margen por debajo del 15 %" },
    { id: "sinprov", n: conteo("sinprov"), t: "productos vendidos sin proveedor en Epos" },
    { id: "sincat", n: conteo("sincat"), t: "productos vendidos sin categoría en Epos" },
  ].filter((x) => x.n > 0);

  return (
    <>
      <div className="grid sin-margen">
        <div className="card c3 fkpi2"><h2>Venta · 30 días</h2><p className="num">{eurK(a.v)}</p><p className="sub"><Delta v={varPct(a.v, b.v)} /> frente a los 30 anteriores</p></div>
        <div className="card c3 fkpi2"><h2>Margen real</h2><p className="num">{pct(mA, 1)}</p><p className="sub">{mA != null && mB != null ? `${mA >= mB ? "+" : "−"}${num(Math.abs(mA - mB), 1)} puntos · ` : ""}{eurK(n0(a.vs) - n0(a.c))} de margen bruto</p></div>
        <div className="card c3 fkpi2"><h2>Unidades vendidas</h2><p className="num">{num(d.unidades?.act)}</p><p className="sub"><Delta v={varPct(d.unidades?.act, d.unidades?.ant)} /> · {num(d.unidades?.refs_act)} referencias distintas</p></div>
        <div className="card c3 fkpi2"><h2>Ticket medio</h2><p className="num">{eur(n0(a.v) / Math.max(1, n0(a.t)), 2)}</p><p className="sub">{num(a.t)} tickets · <Delta v={varPct(n0(a.v) / Math.max(1, n0(a.t)), n0(b.v) / Math.max(1, n0(b.t)))} /></p></div>
      </div>

      {alertas.length > 0 && (
        <section className="avisos favisos" aria-label="Avisos de catálogo">
          {sana != null && <a className="aviso salud-aviso" href="#/producto/salud"><b>{num(sana, 0)} %</b><span>catálogo sano: parte de la venta en productos con IVA, coste, proveedor y categoría bien puestos. Se arregla desde Salud del catálogo.</span><i aria-hidden="true">→</i></a>}
          {alertas.map((x) => <a key={x.id} className="aviso" href={`#/producto/salud/${x.id}`}><b>{x.n}</b><span>{x.t}</span><i aria-hidden="true">→</i></a>)}
        </section>
      )}

      <div className="grid">
        <div className="card c7">
          <div className="head"><div><h2>Dónde está el dinero</h2><p className="sub">Familias en los últimos 30 días: lo que venden y lo que dejan</p></div><button className="enlace" onClick={() => ir("producto/familias")}>Familias →</button></div>
          {!C.d ? <p className="empty">Cargando catálogo…</p> : (
            <div className="tabla-scroll"><table className="ranking fam-t">
              <thead><tr><th>Familia</th><th className="r">Venta</th><th className="bar-th">Peso</th><th className="r">Margen</th><th className="r">Deja</th><th className="r">vs 30 d</th></tr></thead>
              <tbody>
                {fam.map((x) => (
                  <tr key={x.f}>
                    <td><span className="pto" style={{ background: COLOR_FAM[x.f] }} />{x.f}</td>
                    <td className="r b">{eur(r0(x.v))}</td>
                    <td className="bar-td"><span className="barra-h"><i style={{ width: `${(x.v / totV) * 100}%`, background: COLOR_FAM[x.f] }} /></span><small>{num((x.v / totV) * 100, 0)} %</small></td>
                    <td className={`r ${x.m != null && x.m < 30 ? "down" : ""}`}>{pct(x.m, 1)}</td>
                    <td className="r">{eur(r0(x.mEur))}<small className="pf">{num((x.mEur / totMargen) * 100, 0)} % del margen</small></td>
                    <td className="r"><Delta v={varPct(x.v, x.v0)} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
        <div className="card c5">
          <h2>La regla del 80/20</h2>
          <p className="sub">Últimos 90 días</p>
          {!C.d ? <p className="empty">Cargando…</p> : (
            <div className="abc">
              {[["A", "Hacen el 80 % de la venta", "#1E272E"], ["B", "El siguiente 15 %", "#7C868D"], ["C", "El último 5 %", "#CFCCC3"], ["D", "Sin ventas en 90 días", "#EEECE6"]].map(([cl, t, col]) => {
                const n = cat.filter((p) => p.abc === cl).length;
                return (
                  <button key={cl} className="abc-f" onClick={() => ir(`producto/catalogo/${cl}`)}>
                    <span className="abc-l" style={{ background: col, color: cl === "A" || cl === "B" ? "#fff" : "#1E272E" }}>{cl}</span>
                    <span className="abc-t"><b>{num(n)} productos</b><small>{t}</small></span>
                    <span className="abc-b"><i style={{ width: `${(n / cat.length) * 100}%`, background: col }} /></span>
                  </button>
                );
              })}
              <p className="sub fuera">De {num(cat.length)} productos dados de alta, {num(claseA.length)} hacen el 80 % de la venta: son los que hay que tener siempre y contar primero en el inventario.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="card c12">
          <h2>Evolución por familia</h2>
          <p className="sub">Venta mensual de los últimos 13 meses (el último, en curso)</p>
          <EvolucionFamilias filas={d.familias_mes} />
        </div>
      </div>

      {C.d && (
        <div className="grid">
          <ListaMovers titulo="Lo que más sube" sub="Diferencia de venta frente a los 30 días anteriores" lista={suben} onFicha={setFicha} />
          <ListaMovers titulo="Lo que más cae" sub="Ojo con las roturas: muchas caídas son falta de producto" lista={bajan} onFicha={setFicha} />
        </div>
      )}
      {ficha && <FichaProducto p={ficha} onClose={() => setFicha(null)} />}
      <BarraDeshacer />
    </>
  );
}

function ListaMovers({ titulo, sub, lista, onFicha }) {
  return (
    <div className="card c6">
      <h2>{titulo}</h2><p className="sub">{sub}</p>
      <ul className="movers">
        {lista.map((p) => (
          <li key={p.id}><button onClick={() => onFicha(p)}>
            <span className="mv-n"><b>{p.n}</b><small>{p.fam} · {eur(r0(p.v0))} → {eur(r0(p.v))}</small></span>
            <span className={`mv-d ${p.dif >= 0 ? "up" : "down"}`}>{p.dif >= 0 ? "+" : "−"}{eur(Math.abs(r0(p.dif)))}</span>
          </button></li>
        ))}
      </ul>
    </div>
  );
}

function EvolucionFamilias({ filas }) {
  const [sel, setSel] = useState(null);
  const meses = [...new Set((filas || []).map((x) => x.mes))].sort();
  if (!meses.length) return <p className="empty">Sin datos.</p>;
  const porMes = meses.map((m) => ({ mes: m, fams: Object.fromEntries((filas || []).filter((x) => x.mes === m).map((x) => [x.fam, n0(x.v)])) }));
  const orden = FAMILIAS.filter((f) => (filas || []).some((x) => x.fam === f));
  const max = Math.max(...porMes.map((m) => (sel ? n0(m.fams[sel]) : Object.values(m.fams).reduce((s, v) => s + v, 0)))) * 1.08 || 1;
  const W = 900, H = 260, ml = 44, mb = 24, mt = 10, iw = W - ml - 6, ih = H - mt - mb, gw = iw / meses.length, bw = Math.min(44, gw * 0.62);
  const y = (v) => mt + ih - (v / max) * ih;
  return (
    <>
      <div className="leyenda-fam">
        <button className={!sel ? "on" : ""} onClick={() => setSel(null)}>Todas</button>
        {orden.map((f) => <button key={f} className={sel === f ? "on" : ""} onClick={() => setSel(sel === f ? null : f)}><i style={{ background: COLOR_FAM[f] }} />{f}</button>)}
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Venta mensual por familia">
        {[0, 0.5, 1].map((t) => <g key={t}><line x1={ml} x2={W} y1={y(max * t / 1.08)} y2={y(max * t / 1.08)} stroke="var(--grid)" /><text x={ml - 6} y={y(max * t / 1.08) + 4} textAnchor="end" className="axis">{eurK((max * t) / 1.08)}</text></g>)}
        {porMes.map((m, i) => {
          let acc = 0; const x = ml + gw * i + (gw - bw) / 2;
          const capas = (sel ? [sel] : orden).map((f) => { const v = n0(m.fams[f]); const r = { f, v, y0: acc }; acc += v; return r; });
          const tip = `<b>${esc(mesAnio(m.mes))}</b><br>` + (sel ? `${esc(sel)}: <b>${eur(r0(m.fams[sel]))}</b>` : orden.filter((f) => m.fams[f]).map((f) => `${esc(f)}: ${eur(r0(m.fams[f]))}`).join("<br>"));
          return (
            <g key={m.mes}>
              {capas.map((c) => c.v > 0 && <rect key={c.f} x={x} y={y(c.y0 + c.v)} width={bw} height={Math.max(0, y(c.y0) - y(c.y0 + c.v))} fill={COLOR_FAM[c.f]} />)}
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="axis">{mesCorto(m.mes)}</text>
              <rect x={ml + gw * i} y={mt} width={gw} height={ih} fill="transparent" data-tip={tip} />
            </g>
          );
        })}
      </svg>
    </>
  );
}

// ---------- 2. Catálogo ----------
const ORDENES = [
  { id: "v", label: "Venta", f: (p) => n0(p.v) }, { id: "margen", label: "Margen €", f: (p) => n0(p.vs) - n0(p.c) },
  { id: "mpct", label: "Margen %", f: (p) => margenPct(p.vs, p.c) ?? -999 }, { id: "u", label: "Unidades", f: (p) => n0(p.u) },
  { id: "var", label: "Variación", f: (p) => n0(p.v) - n0(p.v0) }, { id: "n", label: "Nombre", f: (p) => p.n },
];
const ACCIONES_LOTE = [{ id: "categoria_id", t: "Mover a categoría" }, { id: "proveedor_id", t: "Asignar proveedor" }, { id: "iva_id", t: "Cambiar IVA" }, { id: "archivado", t: "Archivar" }];
export function Catalogo({ extra }) {
  const C = useCatalogo();
  const [q, setQ] = useState("");
  const [fam, setFam] = useState("");
  const [prov, setProv] = useState("");
  const [abc, setAbc] = useState(["A", "B", "C", "D"].includes(extra) ? extra : "");
  const [estado, setEstado] = useState("");
  const [orden, setOrden] = useState("v");
  const [asc, setAsc] = useState(false);
  const [limite, setLimite] = useState(80);
  const [ficha, setFicha] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [accion, setAccion] = useState("categoria_id");
  const [valor, setValor] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const lista = useMemo(() => {
    const ps = C.d?.productos || [];
    const qq = q.trim().toLowerCase();
    const o = ORDENES.find((x) => x.id === orden);
    return ps.filter((p) => (!qq || `${p.n} ${p.cat || ""} ${p.prov || ""} ${p.cod || ""}`.toLowerCase().includes(qq)) && (!fam || p.fam === fam) && (!prov || (prov === "-" ? !p.prov_id : String(p.prov_id) === prov)) && (!abc || p.abc === abc) && (!estado || (estado === "-" ? !p.x?.es : p.x?.es === estado)))
      .sort((x, y) => { const a = o.f(x), b = o.f(y); const r = typeof a === "string" ? a.localeCompare(b) : a - b; return asc ? r : -r; });
  }, [C.d, q, fam, prov, abc, estado, orden, asc]);
  if (!C.d) return <Estado fallo={C.fallo} />;
  const tot = lista.reduce((s, p) => s + n0(p.v), 0);
  const ordenar = (id) => { if (orden === id) setAsc(!asc); else { setOrden(id); setAsc(id === "n"); } };
  const Th = ({ id, children, r = true }) => <th className={`${r ? "r" : ""} ordenable ${orden === id ? "on" : ""}`}><button onClick={() => ordenar(id)}>{children}{orden === id ? (asc ? " ↑" : " ↓") : ""}</button></th>;
  const visibles = lista.slice(0, limite);
  const todos = visibles.length > 0 && visibles.every((p) => sel.has(p.id));
  const marcar = (id) => setSel((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  async function aplicar() {
    const ids = [...sel];
    const txt = accion === "archivado" ? `¿Archivar ${ids.length} productos en Epos? Dejan de salir en la caja. Se puede deshacer.` : `Se van a cambiar ${ids.length} productos en Epos. ¿Seguimos?`;
    if ((accion === "archivado" || ids.length > 10) && !(await confirmar(txt))) return;
    setGuardando(true);
    try { await guardarCambios(ids.map((id) => ({ id, campos: { [accion]: accion === "archivado" ? true : valor } })), `${ids.length} producto${ids.length > 1 ? "s" : ""} ${accion === "archivado" ? "archivados" : "actualizados"} en Epos`); setSel(new Set()); setValor(null); }
    catch (e) { avisar(e.message, "error"); }
    setGuardando(false);
  }
  return (
    <>
      <div className="filtros-t">
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setLimite(80); }} placeholder="Buscar producto, categoría, proveedor o código…" aria-label="Buscar productos" />
        <select value={fam} onChange={(e) => setFam(e.target.value)} aria-label="Familia"><option value="">Todas las familias</option>{FAMILIAS.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        <select value={prov} onChange={(e) => setProv(e.target.value)} aria-label="Proveedor"><option value="">Todos los proveedores</option>{(C.d.proveedores || []).map((p) => <option key={p.id} value={p.id}>{p.n}</option>)}<option value="-">Sin proveedor</option></select>
        <select value={abc} onChange={(e) => setAbc(e.target.value)} aria-label="Clase"><option value="">Todas las clases</option><option value="A">A · el 80 % de la venta</option><option value="B">B · el siguiente 15 %</option><option value="C">C · el último 5 %</option><option value="D">D · sin ventas en 90 días</option></select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado"><option value="">Cualquier estado</option>{ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.t}</option>)}<option value="-">Sin estado</option></select>
        <button className="btn-p nuevo-p" onClick={() => setNuevo(true)}>+ Nuevo producto</button>
      </div>
      {sel.size > 0 && (
        <div className="lote-barra fija">
          <b>{sel.size} seleccionado{sel.size > 1 ? "s" : ""}</b>
          <select value={accion} onChange={(e) => { setAccion(e.target.value); setValor(null); }} aria-label="Qué hacer">{ACCIONES_LOTE.map((a) => <option key={a.id} value={a.id}>{a.t}</option>)}</select>
          {accion === "categoria_id" && <SelectCat valor={valor} onChange={setValor} categorias={C.d.categorias} vacio="Elige categoría…" />}
          {accion === "proveedor_id" && <SelectProv valor={valor} onChange={setValor} proveedores={C.d.proveedores} vacio="Elige proveedor…" />}
          {accion === "iva_id" && <SelectIva valor={valor} onChange={setValor} iva={C.d.iva} vacio="Elige IVA…" />}
          <button className="btn-p" disabled={guardando || (accion !== "archivado" && !valor)} onClick={aplicar}>{guardando ? "Guardando…" : accion === "archivado" ? "Archivar en Epos" : "Aplicar en Epos"}</button>
          <button className="btn-txt" onClick={() => setSel(new Set())}>Quitar selección</button>
        </div>
      )}
      <div className="card">
        <div className="head"><div><h2>{num(lista.length)} productos</h2><p className="sub">{eur(r0(tot))} de venta en los últimos 30 días · pulsa un producto para ver su ficha y editarlo · marca varios para cambiarlos a la vez</p></div></div>
        <div className="tabla-scroll">
          <table className="ranking catalogo">
            <thead><tr><th className="chk-c"><input type="checkbox" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(visibles.map((p) => p.id)))} aria-label="Seleccionar todos los visibles" /></th><Th id="n" r={false}>Producto</Th><th className="r">PVP</th><Th id="u">Uds.</Th><Th id="v">Venta 30 d</Th><Th id="var">vs ant.</Th><Th id="mpct">Margen</Th><Th id="margen">Deja</Th><th>Avisos</th></tr></thead>
            <tbody>
              {visibles.map((p) => {
                const m = margenPct(p.vs, p.c); const s = senales(p).filter((x) => x.id !== "sinbc");
                return (
                  <tr key={p.id} onClick={() => setFicha(p)} className={`clic ${sel.has(p.id) ? "sel" : ""}`}>
                    <td className="chk-c" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(p.id)} onChange={() => marcar(p.id)} aria-label={`Seleccionar ${p.n}`} /></td>
                    <td><span className={`abc-mini c-${p.abc}`}>{p.abc}</span><span className="pn">{p.n}{p.x?.es && <span className={`estado-p e-${p.x.es}`}>{ESTADOS.find((e) => e.id === p.x.es)?.t}</span>}</span><span className="pf">{p.fam}{p.prov ? ` · ${p.prov}` : ""}</span></td>
                    <td className="r">{p.pvp != null ? eur(p.pvp, 2) : "–"}</td>
                    <td className="r">{num(p.u)}</td>
                    <td className="r b">{eur(r0(p.v))}</td>
                    <td className="r"><Delta v={varPct(p.v, p.v0)} /></td>
                    <td className={`r ${m != null && n0(p.c) > 0 && m < 15 ? "down" : ""}`}>{n0(p.c) > 0 ? pct(m, 1) : "–"}</td>
                    <td className="r">{n0(p.c) > 0 ? eur(r0(n0(p.vs) - n0(p.c))) : "–"}</td>
                    <td>{s.map((x) => <span key={x.id} className={`senal ${x.tono}`} title={x.tip}>{x.t}</span>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {lista.length > limite && <button className="btn-l mas" onClick={() => setLimite(limite + 120)}>Ver más ({num(lista.length - limite)} restantes)</button>}
      </div>
      {ficha && <FichaProducto p={ficha} onClose={() => setFicha(null)} />}
      {nuevo && <NuevoProducto onClose={() => setNuevo(false)} />}
      <BarraDeshacer />
    </>
  );
}

// ---------- 3. Familias ----------
export function Familias() {
  const R = useResumen();
  const C = useCatalogo();
  const [ficha, setFicha] = useState(null);
  if (!C.d || !R.d) return <Estado fallo={C.fallo || R.fallo} />;
  const cat = C.d.productos;
  const tot = cat.reduce((s, p) => s + n0(p.v), 0);
  const fams = FAMILIAS.map((f) => {
    const ps = cat.filter((p) => p.fam === f);
    const v = ps.reduce((s, p) => s + n0(p.v), 0), v0 = ps.reduce((s, p) => s + n0(p.v0), 0);
    const vs = ps.reduce((s, p) => s + n0(p.vs), 0), c = ps.reduce((s, p) => s + n0(p.c), 0);
    const cats = Object.entries(ps.reduce((a, p) => { const k = p.cat || "Sin categoría"; a[k] = (a[k] || 0) + n0(p.v); return a; }, {})).sort((a, b) => b[1] - a[1]);
    const serie = (R.d.familias_mes || []).filter((x) => x.fam === f).sort((a, b) => a.mes.localeCompare(b.mes));
    return { f, v, v0, vs, c, m: margenPct(vs, c), top: [...ps].sort((a, b) => n0(b.v) - n0(a.v)).slice(0, 6), refs: ps.filter((p) => n0(p.v) > 0).length, total: ps.length, cats, serie };
  }).filter((x) => x.v > 0 || x.total > 0).sort((a, b) => b.v - a.v);
  return (
    <>
      <div className="fam-grid">
        {fams.map((x) => {
          const maxS = Math.max(...x.serie.map((s) => n0(s.v)), 1);
          return (
            <article key={x.f} className="card fam-card" style={{ "--c": COLOR_FAM[x.f] }}>
              <div className="fam-cab">
                <h2><span className="pto" style={{ background: COLOR_FAM[x.f] }} />{x.f}</h2>
                <Delta v={varPct(x.v, x.v0)} />
              </div>
              <div className="fam-nums">
                <div><b>{eur(r0(x.v))}</b><small>{num((x.v / tot) * 100, 1)} % de la venta</small></div>
                <div><b className={x.m != null && x.m < 30 ? "mal" : ""}>{pct(x.m, 1)}</b><small>margen · deja {eur(r0(x.vs - x.c))}</small></div>
                <div><b>{x.refs}</b><small>de {x.total} referencias vendidas</small></div>
              </div>
              <div className="mini-serie" aria-label="Venta de los últimos 13 meses">
                {x.serie.map((s) => <i key={s.mes} style={{ height: `${(n0(s.v) / maxS) * 100}%` }} data-tip={`${esc(mesAnio(s.mes))}: <b>${eur(r0(s.v))}</b>`} />)}
              </div>
              <h3 className="fh3">Lo que más vende</h3>
              <ul className="top-fam">{x.top.map((p) => <li key={p.id}><button onClick={() => setFicha(p)}><span>{p.n}</span><b>{eur(r0(p.v))}</b></button></li>)}</ul>
              {x.cats.length > 1 && <p className="sub fuera">Categorías de Epos: {x.cats.map(([c, v]) => `${c} (${eurK(v)})`).join(" · ")}</p>}
            </article>
          );
        })}
      </div>
      {ficha && <FichaProducto p={ficha} onClose={() => setFicha(null)} />}
    </>
  );
}

// ---------- 4. Proveedores ----------
export function Proveedores() {
  const R = useResumen();
  const C = useCatalogo();
  const [abierto, setAbierto] = useState(null);
  const [ficha, setFicha] = useState(null);
  if (!R.d || !C.d) return <Estado fallo={R.fallo || C.fallo} />;
  const provs = R.d.proveedores || [];
  const tot = provs.reduce((s, p) => s + n0(p.v), 0);
  return (
    <>
      <div className="card">
        <h2>Proveedores</h2>
        <p className="sub">Lo que se vende de cada proveedor (según Epos) y lo que se le compra (facturas de la app). Pulsa uno para ver sus productos.</p>
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Proveedor</th><th className="r">Productos vendidos</th><th className="r">Venta 30 d</th><th className="r">Peso</th><th className="r">vs ant.</th><th className="r">Margen</th><th className="r">Compras 30 d</th><th className="r">Compras 90 d</th></tr></thead>
            <tbody>
              {provs.map((p) => (
                <tr key={p.prov} className={`clic ${abierto === p.prov ? "sel" : ""}`} onClick={() => setAbierto(abierto === p.prov ? null : p.prov)}>
                  <td><span className="pn">{p.prov}</span>{p.nombre_fac && p.nombre_fac !== p.prov && <span className="pf">En facturas: {p.nombre_fac}</span>}</td>
                  <td className="r">{num(p.productos)}</td>
                  <td className="r b">{eur(p.v)}</td>
                  <td className="r">{num((n0(p.v) / tot) * 100, 1)} %</td>
                  <td className="r"><Delta v={varPct(p.v, p.v0)} /></td>
                  <td className={`r ${p.margen != null && p.margen < 25 ? "down" : ""}`}>{pct(p.margen, 1)}</td>
                  <td className="r">{p.f30 != null ? eur(p.f30) : "–"}</td>
                  <td className="r">{p.f90 != null ? eur(p.f90) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {abierto && (
        <div className="card mt">
          <div className="head"><h2>{abierto}: productos</h2><button className="btn-l" onClick={() => setAbierto(null)}>Cerrar</button></div>
          <ul className="movers">
            {C.d.productos.filter((p) => (abierto === "Sin proveedor" ? !p.prov : p.prov === abierto) && n0(p.v90) > 0).sort((a, b) => n0(b.v) - n0(a.v)).slice(0, 40).map((p) => (
              <li key={p.id}><button onClick={() => setFicha(p)}><span className="mv-n"><b>{p.n}</b><small>{p.fam} · margen {n0(p.c) > 0 ? pct(margenPct(p.vs, p.c), 1) : "–"}</small></span><span className="mv-d">{eur(r0(p.v))}</span></button></li>
            ))}
          </ul>
        </div>
      )}
      {(R.d.facturas_sin_epos || []).length > 0 && (
        <div className="card mt">
          <h2>Facturas de proveedores que no están en Epos</h2>
          <p className="sub">Se les compra (según las facturas de la app) pero ningún producto de Epos los tiene como proveedor. O falta asignarlo en Epos o el nombre no coincide.</p>
          <ul className="pq-l">{R.d.facturas_sin_epos.map((f) => <li key={f.nombre}><span>{f.nombre}<span className="pf">{f.n} facturas en 90 días</span></span><b>{eur(f.f90)}</b></li>)}</ul>
        </div>
      )}
      {ficha && <FichaProducto p={ficha} onClose={() => setFicha(null)} />}
    </>
  );
}

