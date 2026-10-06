// Ficha de producto (ventas, edición y su historial de cambios), alta de productos
// y los controles de edición que comparten catálogo y salud.
import { useEffect, useMemo, useState } from "react";
import { supabase, sb } from "../../../src/lib/supabase.js";
import { eur, pct, num, mesAnio } from "../fmt.js";
import { Panel, Pestanas, fechaCorta, hace, avisar, confirmar } from "../ui.jsx";
import { n0, r0, margenPct, varPct, margenUnit, senales, ESTADOS, guardarCambios, guardarFicha, crearProducto, crearCategoria, crearProveedor, deshacer, olvidarUltimo, useUltimo, useDatos, sugeridor } from "./datos.js";

const signo = (v, dec = 0) => (v == null ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${num(Math.abs(v), dec)} %`);
const tono = (v) => (v == null ? "" : v > 2 ? "up" : v < -2 ? "down" : "flat");
export function Delta({ v, dec = 0 }) { return <span className={`delta ${tono(v)}`}>{v == null ? "–" : `${v > 0 ? "↑" : v < 0 ? "↓" : "→"} ${signo(v, dec)}`}</span>; }
const dec = (s) => (s === "" || s == null ? null : Number(String(s).replace(",", ".")));

// ---------- selectores con "crear nuevo" ----------
export function SelectCat({ valor, onChange, categorias, vacio = "Sin categoría", sugerido }) {
  const [nueva, setNueva] = useState(null);
  const grupos = useMemo(() => {
    const g = new Map();
    for (const c of categorias || []) { const k = c.padre || c.n; if (!g.has(k)) g.set(k, []); g.get(k).push(c); }
    return [...g];
  }, [categorias]);
  if (nueva != null) return (
    <span className="crear-en-linea">
      <input autoFocus value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nombre de la categoría" aria-label="Nombre de la categoría nueva" />
      <button className="btn-p" disabled={!nueva.trim()} onClick={async () => { try { const r = await crearCategoria(nueva.trim()); onChange(r.id); setNueva(null); avisar(`Categoría «${r.nombre}» creada en Epos`); } catch (e) { avisar(e.message, "error"); } }}>Crear</button>
      <button className="btn-txt" onClick={() => setNueva(null)}>Cancelar</button>
    </span>
  );
  return (
    <select value={valor ?? ""} onChange={(e) => (e.target.value === "__nueva" ? setNueva("") : onChange(e.target.value ? Number(e.target.value) : null))} aria-label="Categoría">
      <option value="">{vacio}</option>
      {sugerido && <option value={sugerido.id}>★ {sugerido.n} (sugerida)</option>}
      {grupos.map(([g, cs]) => (cs.length === 1 && !cs[0].padre ? <option key={cs[0].id} value={cs[0].id}>{cs[0].n}</option> : (
        <optgroup key={g} label={g}>{cs.map((c) => <option key={c.id} value={c.id}>{c.padre ? c.n : `${c.n} (general)`}</option>)}</optgroup>
      )))}
      <option value="__nueva">+ Nueva categoría…</option>
    </select>
  );
}
export function SelectProv({ valor, onChange, proveedores, vacio = "Sin proveedor", sugerido }) {
  const [nuevo, setNuevo] = useState(null);
  if (nuevo != null) return (
    <span className="crear-en-linea">
      <input autoFocus value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nombre del proveedor" aria-label="Nombre del proveedor nuevo" />
      <button className="btn-p" disabled={!nuevo.trim()} onClick={async () => { try { const r = await crearProveedor(nuevo.trim()); onChange(r.id); setNuevo(null); avisar(`Proveedor «${r.nombre}» creado en Epos`); } catch (e) { avisar(e.message, "error"); } }}>Crear</button>
      <button className="btn-txt" onClick={() => setNuevo(null)}>Cancelar</button>
    </span>
  );
  return (
    <select value={valor ?? ""} onChange={(e) => (e.target.value === "__nuevo" ? setNuevo("") : onChange(e.target.value ? Number(e.target.value) : null))} aria-label="Proveedor">
      <option value="">{vacio}</option>
      {sugerido && <option value={sugerido.id}>★ {sugerido.n} (sugerido)</option>}
      {(proveedores || []).map((s) => <option key={s.id} value={s.id}>{s.n}</option>)}
      <option value="__nuevo">+ Nuevo proveedor…</option>
    </select>
  );
}
export function SelectIva({ valor, onChange, iva, vacio = "Sin IVA", sugerido }) {
  return (
    <select value={valor ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} aria-label="IVA">
      <option value="">{vacio}</option>
      {sugerido && <option value={sugerido.id}>★ {sugerido.n} (sugerido)</option>}
      {(iva || []).map((t) => <option key={t.id} value={t.id}>{t.n}</option>)}
    </select>
  );
}

// ---------- barra para deshacer el último cambio ----------
export function BarraDeshacer() {
  const u = useUltimo();
  const [haciendo, setHaciendo] = useState(false);
  useEffect(() => { if (!u) return; const t = setTimeout(olvidarUltimo, 20000); return () => clearTimeout(t); }, [u]);
  if (!u) return null;
  return (
    <div className="deshacer" role="status">
      <span>✓ {u.texto}</span>
      <button disabled={haciendo} onClick={async () => { setHaciendo(true); try { await deshacer(u.lote); avisar("Cambio deshecho en Epos"); } catch (e) { avisar(e.message, "error"); } setHaciendo(false); }}>{haciendo ? "Deshaciendo…" : "Deshacer"}</button>
      <button className="x" aria-label="Cerrar" onClick={olvidarUltimo}>×</button>
    </div>
  );
}

// ---------- ficha ----------
function Barras({ datos, etiqueta, valor, alto = 120, fmt = (v) => num(v), color = "var(--mark)", resaltar }) {
  const W = 520, H = alto, mb = 18, max = Math.max(...datos.map(valor), 1) * 1.1, gw = W / Math.max(1, datos.length), bw = Math.max(3, gw * 0.7);
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

export function FichaProducto({ p: p0, onClose, pestana = "ventas" }) {
  const C = useDatos("catalogo");
  const p = C.d?.productos.find((x) => x.id === p0.id) || p0; // siempre la versión más reciente
  const [tab, setTab] = useState(pestana);
  const s = senales(p);
  return (
    <Panel titulo={p.n} sub={`${p.fam}${p.cat ? ` · ${p.cat}` : ""}${p.prov ? ` · ${p.prov}` : ""}`} onClose={onClose} ancho="640px">
      <div className="ficha-tabs"><Pestanas valor={tab} onChange={setTab} etiqueta="Ficha" opciones={[{ id: "ventas", label: "Ventas" }, { id: "editar", label: "Editar" }, { id: "historial", label: "Historial" }]} /></div>
      {s.length > 0 && tab !== "historial" && <div className="senales">{s.map((x) => <span key={x.id} className={`senal ${x.tono}`}>{x.t}<small>{x.tip}</small></span>)}</div>}
      {tab === "ventas" && <Ventas p={p} />}
      {tab === "editar" && <Editar p={p} C={C.d} onClose={onClose} />}
      {tab === "historial" && <Historial p={p} />}
    </Panel>
  );
}

function Ventas({ p }) {
  const [f, setF] = useState(null);
  useEffect(() => { supabase.rpc("dash_producto_ficha", { p_id: p.id }).then(({ data }) => setF(data || {})); }, [p.id]);
  const m = margenPct(p.vs, p.c);
  const DOW = ["", "L", "M", "X", "J", "V", "S", "D"];
  return (
    <>
      <div className="ficha-kpis cuatro">
        <div><span>Venta 30 días</span><b>{eur(r0(p.v))}</b><small><Delta v={varPct(p.v, p.v0)} /></small></div>
        <div><span>Unidades</span><b>{num(p.u)}</b><small>{p.dv} de 30 días con venta</small></div>
        <div className={m != null && n0(p.c) > 0 && m < 15 ? "mal" : ""}><span>Margen</span><b>{n0(p.c) > 0 ? pct(m, 1) : "–"}</b><small>{n0(p.c) > 0 ? `${eur(r0(n0(p.vs) - n0(p.c)))} en 30 días` : "sin coste en Epos"}</small></div>
        <div><span>Precio y coste</span><b>{p.pvp != null ? eur(p.pvp, 2) : "–"}</b><small>coste {p.cost ? eur(p.cost, 2) : "–"} · IVA {p.iva != null ? `${num(p.iva)} %` : "sin asignar"} · clase {p.abc}</small></div>
      </div>
      {p.x && <div className="ficha-x">{p.x.es && <span className={`estado-p e-${p.x.es}`}>{ESTADOS.find((e) => e.id === p.x.es)?.t}</span>}{p.x.ub && <span>📍 {p.x.ub}</span>}{p.x.uc && <span>{p.x.uc} uds./caja{p.x.cc ? ` · ${eur(p.x.cc, 2)} la caja` : ""}</span>}{p.x.sm != null && <span>Stock mínimo {p.x.sm}</span>}{p.x.no && <span className="nota">{p.x.no}</span>}</div>}
      {!f ? <p className="empty">Cargando historial de ventas…</p> : (
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
          <p className="sub fuera">Última venta: {p.ult ? fechaCorta(p.ult) : "nunca"}{p.pri ? ` · vendiéndose desde ${mesAnio(p.pri).toLowerCase()}` : ""}.</p>
        </>
      )}
    </>
  );
}

// ---------- edición ----------
const inicial = (p) => ({ nombre: p.n, categoria_id: p.cat_id ?? null, proveedor_id: p.prov_id ?? null, coste: p.cost ? String(p.cost).replace(".", ",") : "", pvp: p.pvp != null ? String(p.pvp).replace(".", ",") : "", iva_id: p.iva_id ?? null, codigo: p.cod || "", uc: p.x?.uc ?? "", cc: p.x?.cc != null ? String(p.x.cc).replace(".", ",") : "", ub: p.x?.ub ?? "", sm: p.x?.sm ?? "", es: p.x?.es ?? "", no: p.x?.no ?? "" });

function Editar({ p, C, onClose }) {
  const [f, setF] = useState(() => inicial(p));
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setF(inicial(p)); }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const S = sugeridor(C);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v && v.target ? v.target.value : v }));
  const ivaPct = (C?.iva || []).find((t) => t.id === f.iva_id)?.pct;
  const m = margenUnit(dec(f.pvp), dec(f.coste), ivaPct ?? 0);
  const costeCaja = f.uc && f.cc ? dec(f.cc) / Number(f.uc) : null;
  const codRepetido = f.codigo && C?.productos.find((q) => q.id !== p.id && q.cod === f.codigo.trim());
  const sug = S && { prov: !f.proveedor_id && S.prov(p), cat: !f.categoria_id && S.cat(p), iva: !f.iva_id && S.iva(p), coste: !dec(f.coste) && S.coste({ ...p, iva: ivaPct ?? p.iva }) };

  const camposEpos = () => {
    const c = {};
    if (f.nombre.trim() !== p.n) c.nombre = f.nombre.trim();
    if ((f.categoria_id ?? null) !== (p.cat_id ?? null)) c.categoria_id = f.categoria_id;
    if ((f.proveedor_id ?? null) !== (p.prov_id ?? null)) c.proveedor_id = f.proveedor_id;
    if ((dec(f.coste) ?? 0) !== n0(p.cost)) c.coste = dec(f.coste) ?? 0;
    if (dec(f.pvp) != null && dec(f.pvp) !== n0(p.pvp)) c.pvp = dec(f.pvp);
    if ((f.iva_id ?? null) !== (p.iva_id ?? null)) c.iva_id = f.iva_id;
    if ((f.codigo.trim() || null) !== (p.cod || null)) c.codigo = f.codigo.trim() || null;
    return c;
  };
  const xCambia = () => ["uc", "cc", "ub", "sm", "es", "no"].some((k) => String(f[k] ?? "") !== String((inicial(p))[k] ?? ""));

  async function guardar() {
    const c = camposEpos();
    if (!f.nombre.trim()) return avisar("El nombre no puede quedar vacío", "error");
    if (codRepetido) return avisar(`Ese código ya lo tiene «${codRepetido.n}»`, "error");
    if (c.pvp != null && !(await confirmar(`Vas a cambiar el precio en caja de ${eur(p.pvp, 2)} a ${eur(c.pvp, 2)}. Se aplica en la tienda al momento. ¿Seguimos?`))) return;
    if (c.iva_id !== undefined && p.iva_id != null && !(await confirmar("Vas a cambiar el IVA de un producto que ya lo tenía. El precio en caja no cambia, pero sí el IVA que se declara. ¿Seguimos?"))) return;
    setGuardando(true);
    try {
      if (Object.keys(c).length) await guardarCambios([{ id: p.id, campos: c }], `«${f.nombre.trim()}» guardado en Epos`);
      if (xCambia()) await guardarFicha(p.id, f);
      if (!Object.keys(c).length && !xCambia()) avisar("No hay cambios que guardar");
      else if (!Object.keys(c).length) avisar("Ficha guardada");
    } catch (e) { avisar(e.message, "error"); }
    setGuardando(false);
  }
  async function archivar() {
    if (!(await confirmar(`¿Archivar «${p.n}» en Epos? Deja de salir en la caja. Se puede deshacer desde el historial.`))) return;
    try { await guardarCambios([{ id: p.id, campos: { archivado: true } }], `«${p.n}» archivado en Epos`); onClose(); } catch (e) { avisar(e.message, "error"); }
  }
  if (!C) return <p className="empty">Cargando…</p>;
  return (
    <div className="editar-p">
      <h3 className="bloque-t">En Epos <small>se guarda en la caja al momento</small></h3>
      <label className="campo">Nombre<input value={f.nombre} onChange={set("nombre")} /></label>
      <div className="fila-campos">
        <label className="campo">Categoría<SelectCat valor={f.categoria_id} onChange={set("categoria_id")} categorias={C.categorias} sugerido={sug?.cat} /></label>
        <label className="campo">Proveedor<SelectProv valor={f.proveedor_id} onChange={set("proveedor_id")} proveedores={C.proveedores} sugerido={sug?.prov} /></label>
      </div>
      <div className="fila-campos tres">
        <label className="campo">Coste sin IVA (€)<input inputMode="decimal" value={f.coste} onChange={set("coste")} placeholder={sug?.coste ? `≈ ${num(sug.coste.coste, 2)}` : "0,00"} /></label>
        <label className="campo">Precio de venta con IVA (€)<input inputMode="decimal" value={f.pvp} onChange={set("pvp")} /></label>
        <label className="campo">IVA<SelectIva valor={f.iva_id} onChange={set("iva_id")} iva={C.iva} sugerido={sug?.iva} /></label>
      </div>
      <div className="calc-margen">
        {m != null ? <>Margen por unidad: <b className={m < 15 ? "mal" : ""}>{num(m, 1)} %</b> · deja {eur(dec(f.pvp) / (1 + (ivaPct ?? 0) / 100) - dec(f.coste), 2)}</> : "Pon coste y precio para ver el margen."}
        {sug?.coste && <> · <button className="btn-txt" onClick={() => setF((x) => ({ ...x, coste: String(sug.coste.coste).replace(".", ",") }))}>usar coste estimado {num(sug.coste.coste, 2)} € (margen típico {num(sug.coste.margen, 0)} %)</button></>}
      </div>
      <label className="campo">Código de barras<input value={f.codigo} onChange={set("codigo")} inputMode="numeric" placeholder="Escanéalo o escríbelo" />{codRepetido && <small className="mal">Ya lo tiene «{codRepetido.n}»</small>}</label>

      <h3 className="bloque-t">Ficha Recao <small>datos que Epos no tiene</small></h3>
      <div className="fila-campos">
        <label className="campo">Estado<select value={f.es} onChange={set("es")}><option value="">—</option>{ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.t}</option>)}</select></label>
        <label className="campo">Dónde está en tienda<input value={f.ub} onChange={set("ub")} placeholder="p. ej. nevera 2, balda alta" /></label>
      </div>
      <div className="fila-campos tres">
        <label className="campo">Unidades por caja<input inputMode="numeric" value={f.uc} onChange={set("uc")} /></label>
        <label className="campo">Coste de la caja (€)<input inputMode="decimal" value={f.cc} onChange={set("cc")} /></label>
        <label className="campo">Stock mínimo<input inputMode="numeric" value={f.sm} onChange={set("sm")} /></label>
      </div>
      {costeCaja != null && isFinite(costeCaja) && Math.abs(costeCaja - (dec(f.coste) || 0)) > 0.005 && <p className="calc-margen">La caja sale a {eur(costeCaja, 3)} la unidad. <button className="btn-txt" onClick={() => setF((x) => ({ ...x, coste: String(Math.round(costeCaja * 100) / 100).replace(".", ",") }))}>Usar como coste</button></p>}
      <label className="campo">Notas<textarea rows={3} value={f.no} onChange={set("no")} /></label>
      <div className="acciones-ficha">
        <button className="btn-txt peligro" onClick={archivar}>Archivar en Epos</button>
        <button className="btn-p" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </div>
  );
}

const CAMPO_T = { nombre: "Nombre", categoria_id: "Categoría", proveedor_id: "Proveedor", coste: "Coste", pvp: "Precio", codigo: "Código", iva_id: "IVA", archivado: "Archivado", alta: "Alta" };
function Historial({ p }) {
  const C = useDatos("catalogo");
  const [h, setH] = useState(null);
  useEffect(() => { sb.select("producto_cambios", `select=*&product_id=eq.${p.id}&order=creado_en.desc&limit=60`).then(setH).catch(() => setH([])); }, [p.id]);
  const valor = (campo, v) => {
    if (v == null || v === "") return "—";
    if (campo === "categoria_id") return C.d?.categorias?.find((x) => String(x.id) === v)?.n || v;
    if (campo === "proveedor_id") return C.d?.proveedores?.find((x) => String(x.id) === v)?.n || v;
    if (campo === "iva_id") return C.d?.iva?.find((x) => String(x.id) === v)?.n || v;
    if (campo === "coste" || campo === "pvp") return eur(Number(v), 2);
    if (campo === "archivado") return v === "true" ? "sí" : "no";
    return v;
  };
  if (!h) return <p className="empty">Cargando…</p>;
  if (!h.length) return <p className="empty">Sin cambios hechos desde el panel. Los cambios que se hagan aquí quedan registrados con quién y cuándo.</p>;
  return (
    <ul className="historial-p">
      {h.map((x) => <li key={x.id} className={x.deshecho ? "deshecho" : ""}><span className="hc">{CAMPO_T[x.campo] || x.campo}</span><span>{valor(x.campo, x.antes)} → <b>{valor(x.campo, x.despues)}</b></span><small>{x.usuario_nombre || "—"} · {hace(x.creado_en)}{x.deshecho ? " · deshecho" : ""}</small></li>)}
    </ul>
  );
}

// ---------- alta de producto ----------
export function NuevoProducto({ onClose, onCreado }) {
  const C = useDatos("catalogo");
  const [f, setF] = useState({ nombre: "", categoria_id: null, proveedor_id: null, coste: "", pvp: "", iva_id: null, codigo: "" });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v && v.target ? v.target.value : v }));
  const D = C.d; const S = sugeridor(D);
  const falso = { n: f.nombre, cat_id: f.categoria_id, cat: D?.categorias?.find((c) => c.id === f.categoria_id)?.n, fam: D?.categorias?.find((c) => c.id === f.categoria_id)?.fam, pvp: dec(f.pvp) };
  const sug = S && f.nombre.trim().length > 2 ? { prov: !f.proveedor_id && S.prov(falso), cat: !f.categoria_id && S.cat(falso), iva: !f.iva_id && S.iva(falso) } : {};
  const ivaPct = (D?.iva || []).find((t) => t.id === f.iva_id)?.pct;
  const m = margenUnit(dec(f.pvp), dec(f.coste), ivaPct ?? 0);
  const parecidos = f.nombre.trim().length > 3 ? (D?.productos || []).filter((p) => p.n.toLowerCase().includes(f.nombre.trim().toLowerCase())).slice(0, 4) : [];
  const codRep = f.codigo.trim() && D?.productos.find((p) => p.cod === f.codigo.trim());
  const falta = [!f.nombre.trim() && "nombre", !f.categoria_id && "categoría", !f.proveedor_id && "proveedor", !(dec(f.coste) > 0) && "coste", !(dec(f.pvp) > 0) && "precio", !f.iva_id && "IVA"].filter(Boolean);
  async function crear() {
    setGuardando(true);
    try { const p = await crearProducto({ ...f, nombre: f.nombre.trim(), coste: dec(f.coste), pvp: dec(f.pvp), codigo: f.codigo.trim() || null }); avisar(`«${p.name}» dado de alta en Epos`); onCreado?.(p); onClose(); }
    catch (e) { avisar(e.message, "error"); }
    setGuardando(false);
  }
  return (
    <Panel titulo="Nuevo producto" sub="Se da de alta en Epos y ya se puede cobrar en caja" onClose={onClose} ancho="560px"
      pie={<><span className="pie-falta">{falta.length ? `Falta: ${falta.join(", ")}` : codRep ? `El código ya lo tiene «${codRep.n}»` : ""}</span><button className="btn-p" disabled={guardando || falta.length > 0 || !!codRep} onClick={crear}>{guardando ? "Dando de alta…" : "Dar de alta"}</button></>}>
      {!D ? <p className="empty">Cargando…</p> : (
        <div className="editar-p">
          <label className="campo">Nombre<input autoFocus value={f.nombre} onChange={set("nombre")} placeholder="Como saldrá en el ticket" /></label>
          {parecidos.length > 0 && <p className="calc-margen">¿Ya existe? {parecidos.map((p) => p.n).join(" · ")}</p>}
          <div className="fila-campos">
            <label className="campo">Categoría<SelectCat valor={f.categoria_id} onChange={set("categoria_id")} categorias={D.categorias} vacio="Elige categoría" sugerido={sug.cat} /></label>
            <label className="campo">Proveedor<SelectProv valor={f.proveedor_id} onChange={set("proveedor_id")} proveedores={D.proveedores} vacio="Elige proveedor" sugerido={sug.prov} /></label>
          </div>
          <div className="fila-campos tres">
            <label className="campo">Coste sin IVA (€)<input inputMode="decimal" value={f.coste} onChange={set("coste")} /></label>
            <label className="campo">Precio con IVA (€)<input inputMode="decimal" value={f.pvp} onChange={set("pvp")} /></label>
            <label className="campo">IVA<SelectIva valor={f.iva_id} onChange={set("iva_id")} iva={D.iva} vacio="Elige IVA" sugerido={sug.iva} /></label>
          </div>
          <p className="calc-margen">{m != null ? <>Margen por unidad: <b className={m < 15 ? "mal" : ""}>{num(m, 1)} %</b></> : "Con coste, precio e IVA verás el margen."}</p>
          <label className="campo">Código de barras<input value={f.codigo} onChange={set("codigo")} inputMode="numeric" placeholder="Escanéalo o escríbelo (muy recomendable)" /></label>
        </div>
      )}
    </Panel>
  );
}
