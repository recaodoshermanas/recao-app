// Producto: el corazón de Recao. Todo sale de Epos (ventas línea a línea, catálogo y costes)
// y de las facturas de proveedores. Periodo de referencia: últimos 30 días completos frente a los 30 anteriores.
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../../../src/lib/supabase.js";
import { initTips } from "../charts.js";
import { eur, eurK, pct, num, mesCorto, mesAnio } from "../fmt.js";
import { Panel, Pestanas, Cargando, fechaCorta, ir } from "../ui.jsx";

const FAMILIAS = ["Bollería", "Bebidas", "Snacks y chuches", "Tabaco y vapers", "Bocatas y frío", "Pan", "Alimentación y hogar", "Helados", "Cromos y papelería", "Sin clasificar"];
const COLOR_FAM = { "Bollería": "#D9822B", "Bebidas": "#3D6E9E", "Snacks y chuches": "#B2412A", "Tabaco y vapers": "#5C6670", "Bocatas y frío": "#317039", "Pan": "#C59A3D", "Alimentación y hogar": "#7A5E9E", "Helados": "#2E8C8C", "Cromos y papelería": "#9E5E7A", "Sin clasificar": "#A9AFB4" };
const n0 = (v) => Number(v) || 0;
const r0 = (v) => Math.round(n0(v));
const margenPct = (vs, c) => (n0(vs) > 0 ? ((n0(vs) - n0(c)) / n0(vs)) * 100 : null);
const varPct = (a, b) => (n0(b) > 0 ? ((n0(a) - n0(b)) / n0(b)) * 100 : null);
const signo = (v, dec = 0) => (v == null ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${num(Math.abs(v), dec)} %`);
const tono = (v) => (v == null ? "" : v > 2 ? "up" : v < -2 ? "down" : "flat");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- datos (compartidos entre subpáginas) ----------
const cache = { resumen: null, catalogo: null };
function useRpc(clave, fn, cadaMs = 10 * 60 * 1000) {
  const [d, setD] = useState(cache[clave]);
  const [fallo, setFallo] = useState(false);
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc(fn);
    if (error) { if (!cache[clave]) setFallo(true); return; }
    cache[clave] = data; setD(data);
  }, [clave, fn]);
  useEffect(() => { initTips(document.body); cargar(); const t = setInterval(() => { if (!document.hidden) cargar(); }, cadaMs); return () => clearInterval(t); }, [cargar, cadaMs]);
  return { d, fallo };
}
const useResumen = () => useRpc("resumen", "dash_producto");
const useCatalogo = () => useRpc("catalogo", "dash_catalogo");

// Señales de cada producto (las mismas en resumen, catálogo y salud)
function senales(p) {
  const s = [];
  if (p.d28 >= 20 && n0(p.u2) === 0 && n0(p.uh) === 0) s.push({ id: "rotura", t: "Posible rotura", tono: "mal", tip: `Se vendía casi a diario (${p.d28} de 28 días) y no se ha vendido ni ayer, ni anteayer, ni hoy` });
  if (n0(p.v) > 0 && n0(p.cost) === 0) s.push({ id: "sincoste", t: "Sin coste", tono: "mal", tip: "Sin precio de coste en Epos: su margen no se puede calcular" });
  const m = margenPct(p.vs, p.c);
  if (m != null && n0(p.c) > 0 && m < 0) s.push({ id: "negativo", t: "Pierde dinero", tono: "mal", tip: `Margen ${num(m, 1)} %` });
  else if (m != null && n0(p.c) > 0 && m < 15) s.push({ id: "margen", t: "Margen bajo", tono: "aviso", tip: `Margen ${num(m, 1)} %` });
  if (n0(p.v) > 0 && !p.prov) s.push({ id: "sinprov", t: "Sin proveedor", tono: "aviso", tip: "Sin proveedor asignado en Epos" });
  if ((p.abc === "A" || p.abc === "B") && !p.bc) s.push({ id: "sinbc", t: "Sin código", tono: "aviso", tip: "Sin código de barras: se cobra a mano y es más fácil equivocarse" });
  return s;
}

function Estado({ fallo }) { return <Cargando texto={fallo ? "No se han podido cargar los datos de Epos. Recarga en un momento." : "Cargando datos de Epos…"} />; }
function Delta({ v, dec = 0 }) { return <span className={`delta ${tono(v)}`}>{v == null ? "–" : `${v > 0 ? "↑" : v < 0 ? "↓" : "→"} ${signo(v, dec)}`}</span>; }

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
  const conteo = (id) => cat.filter((p) => senales(p).some((s) => s.id === id)).length;
  const alertas = [
    { id: "rotura", n: conteo("rotura"), t: "posibles roturas: productos que se venden casi a diario y llevan desde anteayer sin venderse" },
    { id: "sincoste", n: conteo("sincoste"), t: `productos vendidos sin precio de coste en Epos (${eur(r0(cat.filter((p) => n0(p.v) > 0 && n0(p.cost) === 0).reduce((s, p) => s + n0(p.v), 0)))} de venta sin margen conocido)` },
    { id: "margen", n: conteo("margen") + conteo("negativo"), t: "productos con margen por debajo del 15 %" },
    { id: "sinprov", n: conteo("sinprov"), t: "productos vendidos sin proveedor en Epos" },
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
export function Catalogo({ extra }) {
  const C = useCatalogo();
  const [q, setQ] = useState("");
  const [fam, setFam] = useState("");
  const [prov, setProv] = useState("");
  const [abc, setAbc] = useState(["A", "B", "C", "D"].includes(extra) ? extra : "");
  const [orden, setOrden] = useState("v");
  const [asc, setAsc] = useState(false);
  const [limite, setLimite] = useState(80);
  const [ficha, setFicha] = useState(null);
  const lista = useMemo(() => {
    const ps = C.d?.productos || [];
    const qq = q.trim().toLowerCase();
    const o = ORDENES.find((x) => x.id === orden);
    return ps.filter((p) => (!qq || `${p.n} ${p.cat || ""} ${p.prov || ""}`.toLowerCase().includes(qq)) && (!fam || p.fam === fam) && (!prov || (prov === "-" ? !p.prov : p.prov === prov)) && (!abc || p.abc === abc))
      .sort((x, y) => { const a = o.f(x), b = o.f(y); const r = typeof a === "string" ? a.localeCompare(b) : a - b; return asc ? r : -r; });
  }, [C.d, q, fam, prov, abc, orden, asc]);
  if (!C.d) return <Estado fallo={C.fallo} />;
  const provs = [...new Set(C.d.productos.map((p) => p.prov).filter(Boolean))].sort();
  const tot = lista.reduce((s, p) => s + n0(p.v), 0);
  const ordenar = (id) => { if (orden === id) setAsc(!asc); else { setOrden(id); setAsc(id === "n"); } };
  const Th = ({ id, children, r = true }) => <th className={`${r ? "r" : ""} ordenable ${orden === id ? "on" : ""}`}><button onClick={() => ordenar(id)}>{children}{orden === id ? (asc ? " ↑" : " ↓") : ""}</button></th>;
  return (
    <>
      <div className="filtros-t">
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setLimite(80); }} placeholder="Buscar producto, categoría o proveedor…" aria-label="Buscar productos" />
        <select value={fam} onChange={(e) => setFam(e.target.value)} aria-label="Familia"><option value="">Todas las familias</option>{FAMILIAS.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        <select value={prov} onChange={(e) => setProv(e.target.value)} aria-label="Proveedor"><option value="">Todos los proveedores</option>{provs.map((p) => <option key={p} value={p}>{p}</option>)}<option value="-">Sin proveedor</option></select>
        <select value={abc} onChange={(e) => setAbc(e.target.value)} aria-label="Clase"><option value="">Todas las clases</option><option value="A">A · el 80 % de la venta</option><option value="B">B · el siguiente 15 %</option><option value="C">C · el último 5 %</option><option value="D">D · sin ventas en 90 días</option></select>
      </div>
      <div className="card">
        <div className="head"><div><h2>{num(lista.length)} productos</h2><p className="sub">{eur(r0(tot))} de venta en los últimos 30 días · pulsa un producto para ver su ficha</p></div></div>
        <div className="tabla-scroll">
          <table className="ranking catalogo">
            <thead><tr><Th id="n" r={false}>Producto</Th><th className="r">PVP</th><Th id="u">Uds.</Th><Th id="v">Venta 30 d</Th><Th id="var">vs ant.</Th><Th id="mpct">Margen</Th><Th id="margen">Deja</Th><th>Avisos</th></tr></thead>
            <tbody>
              {lista.slice(0, limite).map((p) => {
                const m = margenPct(p.vs, p.c); const s = senales(p);
                return (
                  <tr key={p.id} onClick={() => setFicha(p)} className="clic">
                    <td><span className={`abc-mini c-${p.abc}`}>{p.abc}</span><span className="pn">{p.n}</span><span className="pf">{p.fam}{p.prov ? ` · ${p.prov}` : ""}</span></td>
                    <td className="r">{p.pvp != null ? eur(p.pvp, 2) : "–"}</td>
                    <td className="r">{num(p.u)}</td>
                    <td className="r b">{eur(r0(p.v))}</td>
                    <td className="r"><Delta v={varPct(p.v, p.v0)} /></td>
                    <td className={`r ${m != null && n0(p.c) > 0 && m < 15 ? "down" : ""}`}>{n0(p.c) > 0 ? pct(m, 1) : "–"}</td>
                    <td className="r">{n0(p.c) > 0 ? eur(r0(n0(p.vs) - n0(p.c))) : "–"}</td>
                    <td>{s.filter((x) => x.id !== "sinbc").map((x) => <span key={x.id} className={`senal ${x.tono}`} title={x.tip}>{x.t}</span>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {lista.length > limite && <button className="btn-l mas" onClick={() => setLimite(limite + 120)}>Ver más ({num(lista.length - limite)} restantes)</button>}
      </div>
      {ficha && <FichaProducto p={ficha} onClose={() => setFicha(null)} />}
    </>
  );
}

// ---------- ficha de producto ----------
function Barras({ datos, etiqueta, valor, alto = 120, fmt = (v) => num(v), color = "var(--mark)", resaltar }) {
  const W = 520, H = alto, mb = 18, max = Math.max(...datos.map(valor), 1) * 1.1, gw = W / datos.length, bw = Math.max(3, gw * 0.7);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <line x1="0" x2={W} y1={H - mb} y2={H - mb} stroke="var(--line)" />
      {datos.map((d, i) => {
        const v = valor(d), h = (v / max) * (H - mb - 6);
        return (
          <g key={i}>
            <rect x={gw * i + (gw - bw) / 2} y={H - mb - h} width={bw} height={h} rx="2" fill={resaltar && resaltar(d) ? "var(--amarillo-hondo)" : color} />
            {etiqueta(d, i) && <text x={gw * i + gw / 2} y={H - 4} textAnchor="middle" className="axis" style={{ fontSize: 10 }}>{etiqueta(d, i)}</text>}
            <rect x={gw * i} y="0" width={gw} height={H - mb} fill="transparent" data-tip={`${etiqueta(d, i, true) || ""}: <b>${fmt(v)}</b>`} />
          </g>
        );
      })}
    </svg>
  );
}

export function FichaProducto({ p, onClose }) {
  const [f, setF] = useState(null);
  useEffect(() => { supabase.rpc("dash_producto_ficha", { p_id: p.id }).then(({ data }) => setF(data || {})); }, [p.id]);
  const m = margenPct(p.vs, p.c);
  const s = senales(p);
  const DOW = ["", "L", "M", "X", "J", "V", "S", "D"];
  return (
    <Panel titulo={p.n} sub={`${p.fam}${p.cat ? ` · ${p.cat}` : ""}${p.prov ? ` · ${p.prov}` : ""}`} onClose={onClose} ancho="620px">
      {s.length > 0 && <div className="senales">{s.map((x) => <span key={x.id} className={`senal ${x.tono}`}>{x.t}<small>{x.tip}</small></span>)}</div>}
      <div className="ficha-kpis cuatro">
        <div><span>Venta 30 días</span><b>{eur(r0(p.v))}</b><small><Delta v={varPct(p.v, p.v0)} /></small></div>
        <div><span>Unidades</span><b>{num(p.u)}</b><small>{p.dv} de 30 días con venta</small></div>
        <div className={m != null && n0(p.c) > 0 && m < 15 ? "mal" : ""}><span>Margen</span><b>{n0(p.c) > 0 ? pct(m, 1) : "–"}</b><small>{n0(p.c) > 0 ? `${eur(r0(n0(p.vs) - n0(p.c)))} en 30 días` : "sin coste en Epos"}</small></div>
        <div><span>Precio y coste</span><b>{p.pvp != null ? eur(p.pvp, 2) : "–"}</b><small>coste {p.cost ? eur(p.cost, 2) : "–"} · clase {p.abc}</small></div>
      </div>
      {!f ? <p className="empty">Cargando historial…</p> : (
        <>
          <section className="ficha-sec">
            <h3>Unidades por semana <small>últimas 26</small></h3>
            <Barras datos={f.semanas || []} valor={(d) => n0(d.u)} etiqueta={(d, i, largo) => (largo ? `Semana del ${fechaCorta(d.semana)}` : i % 4 === 0 ? fechaCorta(d.semana).split(" ").slice(1).join(" ") : "")} />
          </section>
          <section className="ficha-sec">
            <h3>Últimos 21 días <small>los días a cero en amarillo: ¿rotura?</small></h3>
            <Barras alto={90} datos={f.dias || []} valor={(d) => n0(d.u)} resaltar={(d) => n0(d.u) === 0} color="var(--up)" etiqueta={(d, i, largo) => (largo ? fechaCorta(d.fecha) : i % 3 === 0 ? String(Number(d.fecha.slice(8))) : "")} />
          </section>
          <div className="fila-graf">
            <section className="ficha-sec">
              <h3>Por día de la semana <small>media de unidades</small></h3>
              <Barras alto={90} datos={f.dow || []} valor={(d) => n0(d.u)} fmt={(v) => num(v, 1)} etiqueta={(d, i, largo) => (largo ? ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][d.dow] : DOW[d.dow])} />
            </section>
            <section className="ficha-sec">
              <h3>Por hora <small>12 semanas</small></h3>
              <Barras alto={90} datos={f.horas || []} valor={(d) => n0(d.u)} etiqueta={(d, i, largo) => (largo ? `${d.h}:00` : d.h % 3 === 0 ? String(d.h) : "")} />
            </section>
          </div>
          <section className="ficha-sec">
            <h3>Precio, coste y margen por mes</h3>
            <div className="tabla-scroll">
              <table className="ranking">
                <thead><tr><th>Mes</th><th className="r">Uds.</th><th className="r">Venta</th><th className="r">Precio medio</th><th className="r">Coste medio</th><th className="r">Margen</th></tr></thead>
                <tbody>{[...(f.meses || [])].reverse().slice(0, 8).map((x) => <tr key={x.mes}><td>{mesAnio(x.mes)}</td><td className="r">{num(x.u)}</td><td className="r">{eur(r0(x.v))}</td><td className="r">{x.pm != null ? eur(x.pm, 2) : "–"}</td><td className="r">{x.cm ? eur(x.cm, 2) : "–"}</td><td className="r">{x.margen != null && x.cm ? pct(x.margen, 1) : "–"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
          {(f.precios || []).length > 1 && (
            <section className="ficha-sec">
              <h3>Cambios de precio <small>últimos 6 meses</small></h3>
              <ul className="pq-l">{f.precios.map((x) => <li key={`${x.precio}-${x.desde}`}><span>{eur(x.precio, 2)}<span className="pf">{fechaCorta(x.desde)} → {fechaCorta(x.hasta)}</span></span><b>{num(x.u)} uds.</b></li>)}</ul>
            </section>
          )}
          <p className="sub fuera">Última venta: {p.ult ? fechaCorta(p.ult) : "nunca"}{p.bc ? "" : " · sin código de barras"}. Para cambiar precio, coste, categoría o proveedor, dímelo y lo cambio en Epos.</p>
        </>
      )}
    </Panel>
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

// ---------- 5. Salud del catálogo ----------
const SECCIONES = [
  { id: "rotura", t: "Posibles roturas", d: "Se venden casi a diario (al menos 20 de los últimos 28 días) y no se han vendido ni ayer, ni anteayer, ni hoy. Lo más probable es que falten en la tienda." },
  { id: "sincoste", t: "Vendidos sin coste", d: "No tienen precio de coste en Epos, así que no sabemos cuánto dejan. Hay que darlo de alta." },
  { id: "negativo", t: "Pierden dinero", d: "Se venden por debajo de lo que cuestan." },
  { id: "margen", t: "Margen bajo (<15 %)", d: "Revisar precio de venta o de compra." },
  { id: "sinprov", t: "Sin proveedor", d: "Productos vendidos que no tienen proveedor en Epos: sin él no se pueden preparar pedidos ni cuadrar compras." },
  { id: "sinbc", t: "Sin código de barras", d: "Clase A o B sin código: se cobran a mano y es fácil equivocarse." },
  { id: "dormidos", t: "Sin ventas en 90 días", d: "Dados de alta pero sin vender: candidatos a archivar en Epos para limpiar el catálogo antes del inventario." },
];
export function Salud({ extra }) {
  const C = useCatalogo();
  const [sec, setSec] = useState(SECCIONES.some((s) => s.id === extra) ? extra : "rotura");
  const [ficha, setFicha] = useState(null);
  if (!C.d) return <Estado fallo={C.fallo} />;
  const cat = C.d.productos;
  const de = (id) => (id === "dormidos" ? cat.filter((p) => p.abc === "D") : cat.filter((p) => senales(p).some((s) => s.id === id)));
  const S = SECCIONES.find((s) => s.id === sec);
  const lista = de(sec).sort((a, b) => (sec === "dormidos" ? String(b.ult || "").localeCompare(String(a.ult || "")) : n0(b.v) - n0(a.v)));
  return (
    <>
      <div className="barra-sec salud-sec"><Pestanas valor={sec} onChange={setSec} etiqueta="Revisión" opciones={SECCIONES.map((s) => ({ id: s.id, label: s.t, n: de(s.id).length }))} /></div>
      <div className="card">
        <h2>{S.t} · {num(lista.length)}</h2>
        <p className="sub">{S.d}</p>
        {lista.length === 0 ? <p className="empty">Nada por aquí ✓</p> : (
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>Producto</th><th className="r">Clase</th><th className="r">Venta 30 d</th><th className="r">{sec === "rotura" ? "Días con venta (28)" : "Margen"}</th><th className="r">{sec === "rotura" ? "Hoy" : "Coste / PVP"}</th><th className="r">Última venta</th></tr></thead>
              <tbody>
                {lista.slice(0, 200).map((p) => (
                  <tr key={p.id} className="clic" onClick={() => setFicha(p)}>
                    <td><span className="pn">{p.n}</span><span className="pf">{p.fam}{p.prov ? ` · ${p.prov}` : ""}</span></td>
                    <td className="r">{p.abc}</td>
                    <td className="r b">{eur(r0(p.v))}</td>
                    <td className="r">{sec === "rotura" ? p.d28 : n0(p.c) > 0 ? pct(margenPct(p.vs, p.c), 1) : "–"}</td>
                    <td className="r">{sec === "rotura" ? `${num(p.uh)} uds.` : `${p.cost ? eur(p.cost, 2) : "–"} / ${p.pvp != null ? eur(p.pvp, 2) : "–"}`}</td>
                    <td className="r">{p.ult ? fechaCorta(p.ult) : "nunca"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length > 200 && <p className="sub fuera">Se muestran los 200 primeros de {num(lista.length)}.</p>}
          </div>
        )}
        <p className="sub fuera">Los cambios en Epos (costes, proveedores, códigos, archivar) puedo hacerlos yo: dime cuáles y los aplico.</p>
      </div>
      {ficha && <FichaProducto p={ficha} onClose={() => setFicha(null)} />}
    </>
  );
}
