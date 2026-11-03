// Producto · Lab (#140): pruebas de producto con ficha, métricas automáticas desde Epos y calendario de lanzamientos.
// Las métricas las calcula la base de datos (lab_metricas); el semáforo orienta, no decide.
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, Panel, Pestanas, avisar, confirmar, hoyStr, masDias } from "../ui.jsx";
import { eur, num } from "../fmt.js";

const FASES = [["idea", "Idea"], ["evaluando", "Evaluando"], ["programado", "Programado"], ["en_prueba", "En prueba"], ["decision", "Decisión"], ["cerrada", "Cerrada"]];
const FASE_T = Object.fromEntries([...FASES, ["descartada", "Descartada"]]);
const SALIDAS = [["escalar", "Escalar"], ["mantener", "Mantener"], ["retirar", "Retirar"]];
const SALIDAS_T = [["repetir_ampliar", "Repetir y ampliar"], ["repetir_igual", "Repetir igual"], ["repetir_cambios", "Repetir con cambios"], ["no_repetir", "No repetir"]];
const FUENTES = [["redes", "Redes"], ["proveedor", "Proveedor"], ["tendencia", "Tendencia"], ["otro", "Otro"]];
const SEMAFORO = { escalar: ["Escalar", "#317039"], mantener: ["Mantener", "#C59A3D"], retirar: ["Retirar", "#B2412A"] };
const msg = (e) => { const t = String(e?.message || e || ""); const m = /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };
const numero = (v) => { if (v === "" || v == null) return null; const n = Number(String(v).replace(",", ".")); return isFinite(n) ? n : null; };
const fdia = (f) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "–");
const fcorta = (f) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "–");
const dif = (a, b) => Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);

// Avisos (sin bloquear): más de 2 pruebas en curso a la vez, o menos de 15 días entre dos lanzamientos.
export function avisosCalendario(pruebas) {
  const v = pruebas.filter((p) => p.f_lanzamiento && p.fase !== "descartada" && p.fase !== "idea");
  const out = [];
  for (const p of v) {
    const fin = p.f_fin || p.f_lanzamiento;
    const sol = v.filter((q) => q.f_lanzamiento <= fin && (q.f_fin || q.f_lanzamiento) >= p.f_lanzamiento);
    if (sol.length > 2) out.push(`Se solapan ${sol.length} pruebas en torno a «${p.nombre}»: ${sol.map((q) => q.nombre).join(", ")}.`);
  }
  const ord = [...v].sort((a, b) => a.f_lanzamiento.localeCompare(b.f_lanzamiento));
  for (let i = 1; i < ord.length; i++) {
    const d = dif(ord[i].f_lanzamiento, ord[i - 1].f_lanzamiento);
    if (d < 15 && ord[i].id !== ord[i - 1].id) out.push(`«${ord[i - 1].nombre}» y «${ord[i].nombre}» se lanzan con solo ${d} día${d === 1 ? "" : "s"} de diferencia.`);
  }
  return [...new Set(out)];
}

export function Lab() {
  const [lista, setLista] = useState(null);
  const [vista, setVista] = useState("pruebas");
  const [fase, setFase] = useState("");
  const [sel, setSel] = useState(null); // prueba abierta (objeto) o "nueva"
  const cargar = useCallback(async () => {
    try { setLista(await sb.rpc("lab_lista")); } catch (e) { avisar(msg(e), "mal"); setLista((l) => l || []); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!lista) return <Cargando />;
  const visibles = lista.filter((p) => (fase ? p.fase === fase : p.fase !== "descartada"));
  const cuenta = (f) => lista.filter((p) => p.fase === f).length;
  return (
    <>
      <div className="card">
        <div className="head">
          <div><h2>Lab de producto</h2><p className="sub">Cada novedad se registra, se mide con las ventas de Epos y se decide con un criterio común. El semáforo orienta, no decide.</p></div>
          <button className="btn-p" onClick={() => setSel("nueva")}>Nueva prueba</button>
        </div>
        <Pestanas etiqueta="Vista" valor={vista} onChange={setVista} opciones={[{ id: "pruebas", label: "Pruebas" }, { id: "calendario", label: "Calendario" }, { id: "umbrales", label: "Umbrales del semáforo" }]} />
      </div>
      {vista === "pruebas" && (
        <div className="card mt">
          <Pestanas etiqueta="Fase" valor={fase} onChange={setFase} opciones={[{ id: "", label: "Todas" }, ...FASES.map(([id, label]) => ({ id, label, n: cuenta(id) })), { id: "descartada", label: "Descartadas", n: cuenta("descartada") }]} />
          {!visibles.length ? <p className="empty">No hay pruebas en esta fase.</p> : (
            <div className="tabla-scroll"><table className="ranking">
              <thead><tr><th>Prueba</th><th>Fase</th><th>Tipo</th><th>Lanzamiento</th><th>Decisión</th><th>Productos</th></tr></thead>
              <tbody>{visibles.map((p) => (
                <tr key={p.id} onClick={() => setSel(p)} style={{ cursor: "pointer" }}>
                  <td><b>{p.nombre}</b>{p.proveedor && <small className="pf">{p.proveedor}</small>}</td>
                  <td>{FASE_T[p.fase]}{p.salida && <small className="pf">{SALIDAS.find((s) => s[0] === p.salida)?.[1]}</small>}{p.salida_temporada && <small className="pf">{SALIDAS_T.find((s) => s[0] === p.salida_temporada)?.[1]}</small>}</td>
                  <td>{p.tipo === "temporada" ? "Temporada" : "Normal"}</td>
                  <td>{fdia(p.f_lanzamiento)}</td><td>{fdia(p.f_decision)}</td>
                  <td>{p.productos.length ? `${p.productos.length}` : <span className="pf">sin vincular</span>}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </div>
      )}
      {vista === "calendario" && <Calendario lista={lista} onAbrir={setSel} />}
      {vista === "umbrales" && <Umbrales />}
      {sel && <FichaPrueba p={sel === "nueva" ? null : sel} lista={lista} onClose={() => setSel(null)} onGuardado={() => { cargar(); }} />}
    </>
  );
}

function Calendario({ lista, onAbrir }) {
  const [mes, setMes] = useState(hoyStr().slice(0, 7));
  const [y, m] = mes.split("-").map(Number);
  const ini = `${mes}-01`, nd = new Date(y, m, 0).getDate(), fin = `${mes}-${String(nd).padStart(2, "0")}`;
  const mover = (k) => { const d = new Date(y, m - 1 + k, 1); setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const ps = lista.filter((p) => p.f_lanzamiento && p.fase !== "descartada" && p.f_lanzamiento <= fin && (p.f_fin || p.f_lanzamiento) >= ini);
  const decis = lista.filter((p) => p.f_decision && p.fase !== "descartada" && p.f_decision >= ini && p.f_decision <= fin);
  const av = avisosCalendario(lista);
  const pos = (f) => ((Math.min(Math.max(dif(f, ini), 0), nd - 1) + 0.5) / nd) * 100;
  return (
    <div className="card mt">
      <div className="head"><h2>{new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</h2>
        <div><button className="btn-l" aria-label="Mes anterior" onClick={() => mover(-1)}>←</button> <button className="btn-l" aria-label="Mes siguiente" onClick={() => mover(1)}>→</button></div></div>
      {av.map((t, i) => <div key={i} className="aviso"><b>!</b><span>{t}</span></div>)}
      {!ps.length && !decis.length ? <p className="empty">Nada programado este mes.</p> : (
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {ps.map((p) => {
            const a = p.f_lanzamiento, b = p.f_fin || p.f_lanzamiento;
            const l = Math.max(0, (dif(a, ini) / nd) * 100), r = Math.min(100, ((dif(b, ini) + 1) / nd) * 100);
            return (
              <div key={p.id}>
                <small className="pf">{p.nombre} · {fcorta(a)} → {fcorta(b)}{p.f_decision ? ` · decisión ${fcorta(p.f_decision)}` : ""}</small>
                <div onClick={() => onAbrir(p)} style={{ position: "relative", height: 24, background: "var(--line)", borderRadius: 6, cursor: "pointer" }}>
                  <div style={{ position: "absolute", left: `${l}%`, width: `${Math.max(2, r - l)}%`, top: 0, bottom: 0, background: p.tipo === "temporada" ? "#D9822B" : "#3D6E9E", borderRadius: 6 }} />
                  {p.f_decision && p.f_decision >= ini && p.f_decision <= fin && <div title={`Decisión ${fdia(p.f_decision)}`} style={{ position: "absolute", left: `${pos(p.f_decision)}%`, top: -3, bottom: -3, width: 3, background: "#1E272E" }} />}
                </div>
              </div>
            );
          })}
          <p className="sub">Azul: prueba normal · naranja: temporada · raya oscura: fecha de decisión. Los avisos orientan, no bloquean.</p>
        </div>
      )}
    </div>
  );
}

function Umbrales() {
  const [u, setU] = useState(null);
  useEffect(() => { sb.rpc("lab_umbrales").then(setU).catch((e) => avisar(msg(e), "mal")); }, []);
  if (!u) return <Cargando />;
  const set = (k) => (e) => setU({ ...u, [k]: e.target.value });
  const guardar = async () => {
    try {
      const r = await sb.rpc("lab_umbrales_guardar", { p_escalar_margen: numero(u.escalar_margen), p_escalar_sost: numero(u.escalar_sost), p_mantener_margen: numero(u.mantener_margen), p_retirar_merma: numero(u.retirar_merma) });
      setU(r); avisar("Umbrales guardados");
    } catch (e) { avisar(msg(e), "mal"); }
  };
  return (
    <div className="card mt">
      <h2>Umbrales del semáforo</h2>
      <p className="sub">Escalar: margen bruto semanal alto y venta sostenida. Mantener: margen intermedio. Retirar: margen bajo o demasiada merma.</p>
      <div className="fila-campos">
        <label className="campo">Escalar si el margen bruto es al menos (€/semana)<input inputMode="decimal" value={u.escalar_margen ?? ""} onChange={set("escalar_margen")} /></label>
        <label className="campo">…y el sostenimiento es al menos (%)<input inputMode="decimal" value={u.escalar_sost ?? ""} onChange={set("escalar_sost")} /></label>
        <label className="campo">Retirar si el margen es menor de (€/semana)<input inputMode="decimal" value={u.mantener_margen ?? ""} onChange={set("mantener_margen")} /></label>
        <label className="campo">…o si la merma supera (% de las unidades)<input inputMode="decimal" value={u.retirar_merma ?? ""} onChange={set("retirar_merma")} /></label>
      </div>
      <button className="btn-p" onClick={guardar}>Guardar umbrales</button>
    </div>
  );
}

const VACIA = { nombre: "", fase: "idea", tipo: "normal", proveedor: "", fuente: "", fuente_url: "", hipotesis: "", f_lanzamiento: "", duracion_dias: "", f_fin: "", f_decision: "", zona_codigo: "", subzona_id: "", pedido_inicial_uds: "", pedido_inicial_nota: "", coste_prueba: "", precio_mercado: "", precio_mercado_url: "", producto_parecido_id: null, pvp_elegido: "", notas: "", salida: "", salida_temporada: "", motivo_descarte: "" };
const CAMPOS_NUM = ["duracion_dias", "pedido_inicial_uds", "coste_prueba", "precio_mercado", "pvp_elegido"];

function FichaPrueba({ p, lista, onClose, onGuardado }) {
  const [f, setF] = useState(() => (p ? Object.fromEntries(Object.keys(VACIA).map((k) => [k, p[k] ?? (k === "producto_parecido_id" ? null : "")])) : { ...VACIA }));
  const [id, setId] = useState(p?.id || null);
  const [prods, setProds] = useState(p?.productos || []);
  const [zonas, setZonas] = useState({ z: [], s: [] });
  const [m, setM] = useState(null);
  const [busca, setBusca] = useState(""); const [res, setRes] = useState([]);
  const [buscaP, setBuscaP] = useState(""); const [resP, setResP] = useState([]);
  const [parecido, setParecido] = useState(null);
  const [sug, setSug] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => { Promise.all([sb.select("tienda_zonas", "select=codigo,nombre&order=orden"), sb.select("tienda_subzonas", "select=id,zona_codigo,nombre&activa=eq.true&order=orden")]).then(([z, s]) => setZonas({ z, s })).catch(() => {}); }, []);
  const cargarM = useCallback(() => { if (id) sb.rpc("lab_metricas", { p_id: id }).then(setM).catch((e) => setM({ error: msg(e) })); }, [id]);
  useEffect(() => { cargarM(); }, [cargarM, prods.length]);
  useEffect(() => {
    if (!prods.length) { setSug([]); return; }
    Promise.all(prods.map((x) => sb.rpc("lab_pvp_sugerido", { p_product: x.id }).then((r) => ({ ...x, ...r })).catch(() => ({ ...x, falta: "error" })))).then(setSug);
  }, [prods]);
  useEffect(() => { // PVP del producto parecido
    if (!f.producto_parecido_id) { setParecido(null); return; }
    sb.select("epos_products", `select=id,name,sale_price&id=eq.${f.producto_parecido_id}`).then((r) => setParecido(r[0] || null)).catch(() => {});
  }, [f.producto_parecido_id]);
  const buscar = (q, fijar) => { if (q.trim().length < 2) return fijar([]); sb.rpc("lab_producto_buscar", { p_q: q }).then(fijar).catch(() => fijar([])); };
  useEffect(() => { const t = setTimeout(() => buscar(busca, setRes), 250); return () => clearTimeout(t); }, [busca]);
  useEffect(() => { const t = setTimeout(() => buscar(buscaP, setResP), 250); return () => clearTimeout(t); }, [buscaP]);

  const cuerpo = () => {
    const o = {};
    for (const k of Object.keys(VACIA)) {
      const v = f[k];
      if (CAMPOS_NUM.includes(k)) o[k] = numero(v);
      else if (k === "subzona_id") o[k] = v ? Number(v) : null;
      else if (k === "producto_parecido_id") o[k] = v || null;
      else o[k] = v === "" ? null : v;
    }
    if (!o.f_decision && o.f_fin) o.f_decision = masDias(o.f_fin, 7);
    return o;
  };
  const guardar = async (extra = {}) => {
    if (!f.nombre.trim()) { avisar("Falta el nombre de la prueba", "mal"); return false; }
    setGuardando(true);
    try {
      const o = { ...cuerpo(), ...extra };
      if (id) { await sb.update("lab_pruebas", `id=eq.${id}`, o); }
      else { const r = await sb.insert("lab_pruebas", { ...o, creado_por: "Dirección" }); setId(r[0].id); }
      avisar("Guardado"); onGuardado(); return true;
    } catch (e) { avisar(msg(e), "mal"); return false; } finally { setGuardando(false); }
  };
  const cambiarFase = async (nueva) => {
    if (nueva === "cerrada" && !(f.salida || f.salida_temporada)) { avisar("Para cerrar elige antes la salida", "mal"); return; }
    if (await guardar({ fase: nueva })) setF((x) => ({ ...x, fase: nueva }));
  };
  const descartar = async () => {
    if (!f.motivo_descarte.trim()) { avisar("Escribe el motivo del descarte", "mal"); return; }
    if (await guardar({ fase: "descartada" })) { setF((x) => ({ ...x, fase: "descartada" })); }
  };
  const vincular = async (x) => {
    if (!id && !(await guardar())) return;
    try {
      const pid = id || (await sb.select("lab_pruebas", `select=id&nombre=eq.${encodeURIComponent(f.nombre)}&order=id.desc&limit=1`))[0].id;
      setId(pid);
      await sb.upsert("lab_prueba_productos", { prueba_id: pid, product_id: x.id }, "prueba_id,product_id");
      setProds((l) => (l.some((y) => y.id === x.id) ? l : [...l, { id: x.id, nombre: x.nombre }])); setBusca(""); setRes([]); onGuardado();
    } catch (e) { avisar(msg(e), "mal"); }
  };
  const quitar = async (x) => {
    try { await sb.delete("lab_prueba_productos", `prueba_id=eq.${id}&product_id=eq.${x.id}`); setProds((l) => l.filter((y) => y.id !== x.id)); onGuardado(); } catch (e) { avisar(msg(e), "mal"); }
  };
  const duplicar = async () => {
    if (!(await confirmar("Se crea una prueba nueva para el año siguiente, con los mismos datos y las fechas un año después. ¿Seguir?"))) return;
    const mas = (d) => { if (!d) return null; const x = new Date(`${d}T12:00:00`); x.setFullYear(x.getFullYear() + 1); return x.toISOString().slice(0, 10); };
    const o = cuerpo();
    try {
      const r = await sb.insert("lab_pruebas", { ...o, nombre: o.nombre.replace(/\b(20\d\d)\b/, (a) => String(Number(a) + 1)) === o.nombre ? `${o.nombre} (año siguiente)` : o.nombre.replace(/\b(20\d\d)\b/, (a) => String(Number(a) + 1)),
        fase: "programado", f_lanzamiento: mas(o.f_lanzamiento), f_fin: mas(o.f_fin), f_decision: mas(o.f_decision), salida: null, salida_temporada: null, motivo_descarte: null, anterior_id: id, creado_por: "Dirección" });
      avisar("Prueba duplicada para el año siguiente (productos sin vincular: se vinculan cuando se den de alta)"); onGuardado(); onClose();
      return r;
    } catch (e) { avisar(msg(e), "mal"); }
  };

  const temporada = f.tipo === "temporada";
  const subs = zonas.s.filter((s) => s.zona_codigo === f.zona_codigo);
  return (
    <Panel titulo={id ? f.nombre || "Prueba" : "Nueva prueba"} sub={FASE_T[f.fase]} onClose={onClose} ancho={720}
      pie={<><button className="btn-p" disabled={guardando} onClick={() => guardar()}>{guardando ? "Guardando…" : "Guardar"}</button></>}>
      <label className="campo">Nombre<input value={f.nombre} onChange={set("nombre")} /></label>
      <div className="fila-campos">
        <label className="campo">Tipo<select value={f.tipo} onChange={set("tipo")}><option value="normal">Normal</option><option value="temporada">Temporada</option></select></label>
        <label className="campo">Proveedor<input value={f.proveedor} onChange={set("proveedor")} /></label>
        <label className="campo">Fuente<select value={f.fuente} onChange={set("fuente")}><option value="">–</option>{FUENTES.map(([i, t]) => <option key={i} value={i}>{t}</option>)}</select></label>
        <label className="campo">Enlace de la fuente<input value={f.fuente_url} onChange={set("fuente_url")} placeholder="https://…" /></label>
      </div>
      <label className="campo">Hipótesis<textarea rows={2} value={f.hipotesis} onChange={set("hipotesis")} placeholder="Qué esperamos que pase" /></label>

      <h3>Fechas</h3>
      <div className="fila-campos">
        <label className="campo">{temporada ? "Inicio de campaña" : "Lanzamiento"}<input type="date" value={f.f_lanzamiento} onChange={set("f_lanzamiento")} /></label>
        {temporada
          ? <label className="campo">Fin de campaña<input type="date" value={f.f_fin} onChange={set("f_fin")} /></label>
          : <label className="campo">Duración (días, 28 por defecto)<input inputMode="numeric" value={f.duracion_dias} onChange={(e) => { const d = numero(e.target.value); setF((x) => ({ ...x, duracion_dias: e.target.value, f_fin: d && x.f_lanzamiento ? masDias(x.f_lanzamiento, d - 1) : x.f_fin })); }} placeholder="28" /></label>}
        <label className="campo">Fecha de decisión (fin + 7, editable)<input type="date" value={f.f_decision} onChange={set("f_decision")} /></label>
        {!temporada && <label className="campo">Fin<input type="date" value={f.f_fin} onChange={set("f_fin")} /></label>}
      </div>

      <h3>Productos de Epos</h3>
      <p className="sub">Cada producto de la prueba (p. ej. cada sabor) debe tener su propio producto en Epos. Los genéricos «Producto 1€» no se pueden vincular. En Idea/Evaluando puede no haber ninguno.</p>
      {prods.length > 0 && <ul className="movers">{prods.map((x) => <li key={x.id}><span className="mv-n"><b>{x.nombre}</b></span><button className="btn-txt" onClick={() => quitar(x)}>Quitar</button></li>)}</ul>}
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar producto de Epos para vincular…" aria-label="Buscar producto" style={{ width: "100%", marginBottom: 8 }} />
      {res.map((x) => <button key={x.id} type="button" className="btn-l" style={{ display: "block", textAlign: "left", marginBottom: 4 }} onClick={() => vincular(x)}>{x.nombre} · {eur(x.pvp, 2)}</button>)}

      <h3>Ubicación y pedido</h3>
      <div className="fila-campos">
        <label className="campo">Zona<select value={f.zona_codigo} onChange={(e) => setF({ ...f, zona_codigo: e.target.value, subzona_id: "" })}><option value="">–</option>{zonas.z.map((z) => <option key={z.codigo} value={z.codigo}>{z.nombre}</option>)}</select></label>
        <label className="campo">Subzona<select value={f.subzona_id} onChange={set("subzona_id")} disabled={!subs.length}><option value="">–</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
        <label className="campo">Pedido inicial (unidades)<input inputMode="decimal" value={f.pedido_inicial_uds} onChange={set("pedido_inicial_uds")} /></label>
        <label className="campo">Coste de la prueba (€)<input inputMode="decimal" value={f.coste_prueba} onChange={set("coste_prueba")} /></label>
      </div>
      <label className="campo">Pedido inicial · nota<input value={f.pedido_inicial_nota} onChange={set("pedido_inicial_nota")} placeholder="Tamaños, formatos…" /></label>

      <h3>Precio</h3>
      <div className="card" style={{ background: "var(--bg)", padding: 12 }}>
        <p className="sub" style={{ margin: 0 }}><b>(a) Coste con margen del 35 %</b> · coste con IVA (el «Imp. Inc.» de Epos) ÷ 0,65, redondeado hacia arriba a 0,10 €.</p>
        {!sug.length ? <p className="sub">Se calcula al vincular productos.</p> : sug.map((x) => (
          <p key={x.id} style={{ margin: "4px 0" }}>{x.nombre}: {x.pvp_sugerido != null ? <><b>{eur(x.pvp_sugerido, 2)}</b> <small className="pf">coste con IVA {eur(x.coste_imp_inc, 2)} · PVP actual {eur(x.pvp_actual, 2)}</small></> : <span className="pf">falta {x.falta === "iva" ? "el IVA" : x.falta === "coste" ? "coste" : "dato"} · PVP actual {eur(x.pvp_actual, 2)}</span>}
            {x.pvp_sugerido != null && <button className="btn-txt" onClick={() => setF((y) => ({ ...y, pvp_elegido: String(x.pvp_sugerido).replace(".", ",") }))}> usar</button>}</p>
        ))}
      </div>
      <div className="fila-campos" style={{ marginTop: 12 }}>
        <label className="campo">(b) Precio de mercado (€)<input inputMode="decimal" value={f.precio_mercado} onChange={set("precio_mercado")} /></label>
        <label className="campo">Enlace del precio de mercado<input value={f.precio_mercado_url} onChange={set("precio_mercado_url")} placeholder="https://…" /></label>
      </div>
      <div className="campo"><span>(c) Producto parecido de Recao{parecido ? `: ${parecido.name} · ${eur(parecido.sale_price, 2)}` : ""}</span>
        <input value={buscaP} onChange={(e) => setBuscaP(e.target.value)} placeholder="Buscar producto parecido…" aria-label="Producto parecido" />
        {resP.map((x) => <button key={x.id} type="button" className="btn-l" style={{ textAlign: "left" }} onClick={() => { setF((y) => ({ ...y, producto_parecido_id: x.id })); setBuscaP(""); setResP([]); }}>{x.nombre} · {eur(x.pvp, 2)}</button>)}
        {f.producto_parecido_id && <button type="button" className="btn-txt" onClick={() => setF((y) => ({ ...y, producto_parecido_id: null }))}>Quitar</button>}
      </div>
      <label className="campo">PVP elegido (€)<input inputMode="decimal" value={f.pvp_elegido} onChange={set("pvp_elegido")} /></label>
      <label className="campo">Notas<textarea rows={3} value={f.notas} onChange={set("notas")} /></label>

      {id && <Metricas m={m} temporada={temporada} />}

      <h3>Fase y decisión</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {FASES.map(([i, t]) => <button key={i} className={f.fase === i ? "btn-p" : "btn-l"} disabled={guardando} onClick={() => cambiarFase(i)}>{t}</button>)}
      </div>
      <div className="fila-campos">
        {temporada
          ? <label className="campo">Salida de la campaña<select value={f.salida_temporada} onChange={set("salida_temporada")}><option value="">–</option>{SALIDAS_T.map(([i, t]) => <option key={i} value={i}>{t}</option>)}</select></label>
          : <label className="campo">Salida<select value={f.salida} onChange={set("salida")}><option value="">–</option>{SALIDAS.map(([i, t]) => <option key={i} value={i}>{t}</option>)}</select></label>}
        <label className="campo">Motivo del descarte<input value={f.motivo_descarte} onChange={set("motivo_descarte")} placeholder="Solo si se descarta" /></label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn-l" onClick={descartar}>Descartar prueba</button>
        {id && temporada && <button className="btn-l" onClick={duplicar}>Duplicar para el año siguiente</button>}
      </div>
    </Panel>
  );
}

function Metricas({ m, temporada }) {
  if (!m) return <p className="sub">Calculando métricas…</p>;
  if (m.error) return <p className="mal">{m.error}</p>;
  if (m.sin_datos) return <><h3>Métricas</h3><p className="sub">{m.motivo}.</p></>;
  const t = m.totales, rep = m.repeticion || {}, c = m.canibalizacion, sf = SEMAFORO[m.semaforo];
  const maxDia = Math.max(1, ...(m.por_dia || []).map((d) => Number(d.venta)));
  const pico = (m.por_dia || []).reduce((a, d) => (!a || Number(d.venta) > Number(a.venta) ? d : a), null);
  return (
    <>
      <h3>Métricas · {fcorta(m.desde)} → {fcorta(m.hasta)}</h3>
      {!temporada && sf && <p><span className="chip-mal" style={{ background: sf[1] + "22", color: sf[1] }}>Semáforo sugerido: {sf[0]}</span> <small className="pf">margen medio {eur(m.margen_semana, 0)}/semana · orienta, no decide</small></p>}
      <div className="grid sin-margen">
        <div className="card c3"><h2>Venta sin IVA</h2><p className="num">{eur(t.venta, 0)}</p></div>
        <div className="card c3"><h2>Margen bruto</h2><p className="num">{eur(t.margen, 0)}</p><p className="sub">{t.margen_pct != null ? `${num(t.margen_pct, 1)} %` : "–"}</p></div>
        <div className="card c3"><h2>Unidades</h2><p className="num">{num(t.unidades)}</p><p className="sub">{num(t.ud_dia, 1)} al día</p></div>
        <div className="card c3"><h2>Merma</h2><p className="num">{num(m.merma?.unidades)}</p><p className="sub">{m.merma?.pct != null ? `${num(m.merma.pct, 1)} % de las unidades` : "–"}</p></div>
      </div>
      <div className="tabla-scroll"><table className="ranking"><thead><tr><th>Semana</th><th className="r">Venta</th><th className="r">Margen</th><th className="r">Margen %</th><th className="r">Uds/día</th></tr></thead>
        <tbody>{m.semanas.map((s) => <tr key={s.semana}><td>{s.semana} · {fcorta(s.desde)}</td><td className="r">{eur(s.venta, 0)}</td><td className="r">{eur(s.margen, 0)}</td><td className="r">{s.margen_pct != null ? `${num(s.margen_pct, 1)} %` : "–"}</td><td className="r">{num(s.ud_dia, 1)}</td></tr>)}
          <tr><td><b>Total</b></td><td className="r b">{eur(t.venta, 0)}</td><td className="r b">{eur(t.margen, 0)}</td><td className="r b">{t.margen_pct != null ? `${num(t.margen_pct, 1)} %` : "–"}</td><td className="r b">{num(t.ud_dia, 1)}</td></tr></tbody></table></div>
      <ul style={{ lineHeight: 1.6 }}>
        <li><b>Sostenimiento:</b> {m.sostenimiento_pct != null ? `${num(m.sostenimiento_pct, 0)} %` : "aún no se puede calcular (hace falta venta en la semana 1 y que haya empezado la semana 3)"} <small className="pf">media semanal de las semanas 3-4 ÷ venta de la semana 1</small></li>
        <li><b>Canibalización:</b> {c ? <>{c.grupo}: {eur(c.venta_dia_antes, 0)}/día antes (4 semanas) → {eur(c.venta_dia_durante, 0)}/día durante{c.variacion_pct != null ? ` (${c.variacion_pct > 0 ? "+" : ""}${num(c.variacion_pct, 0)} %)` : ""} <small className="pf">orientación: la estacionalidad mete ruido</small></> : "sin grupo de comparación"}</li>
        <li><b>Repetición:</b> {num(rep.repiten)} de {num(rep.clientes)} clientes con tarjeta lo compran 2 o más veces · {num(rep.nuevos)} clientes nuevos ({num(rep.nuevos_repiten)} repiten) <small className="pf">solo clientes con tarjeta</small></li>
        {m.sobrantes != null && <li><b>Sobrantes:</b> {num(m.sobrantes)} unidades (pedido inicial − vendidas − merma)</li>}
        {m.anterior && <li><b>Campaña anterior</b> ({m.anterior.nombre}): {eur(m.anterior.venta, 0)} de venta · {eur(m.anterior.margen, 0)} de margen · {num(m.anterior.unidades)} uds</li>}
      </ul>
      <h4>Por producto</h4>
      <div className="tabla-scroll"><table className="ranking"><thead><tr><th>Producto</th><th className="r">Venta</th><th className="r">Margen</th><th className="r">Uds</th></tr></thead>
        <tbody>{m.por_producto.map((x) => <tr key={x.product_id}><td>{x.nombre}</td><td className="r">{eur(x.venta, 0)}</td><td className="r">{eur(x.margen, 0)}</td><td className="r">{num(x.unidades)}</td></tr>)}</tbody></table></div>
      {temporada && m.por_dia?.length > 0 && (
        <>
          <h4>Venta por día{pico ? ` · pico el ${fdia(pico.fecha)} (${eur(pico.venta, 0)})` : ""}</h4>
          <svg viewBox={`0 0 ${Math.max(300, m.por_dia.length * 8)} 70`} className="chart" role="img" aria-label="Venta por día">
            {m.por_dia.map((d, i) => <rect key={d.fecha} x={i * 8} width={6} y={66 - (Number(d.venta) / maxDia) * 62} height={(Number(d.venta) / maxDia) * 62} fill="#D9822B"><title>{fdia(d.fecha)}: {eur(d.venta, 0)}</title></rect>)}
          </svg>
        </>
      )}
    </>
  );
}

// Aviso en Producto → Resumen cuando llega la fecha de decisión de una prueba
export function AvisosLab() {
  const [a, setA] = useState([]);
  useEffect(() => { sb.rpc("lab_avisos_decision").then((r) => setA(Array.isArray(r) ? r : [])).catch(() => {}); }, []);
  if (!a.length) return null;
  return (
    <section className="avisos favisos" aria-label="Pruebas del Lab para decidir">
      {a.map((x) => <a key={x.id} className="aviso" href="#/producto/lab"><b>Lab</b><span>Toca decidir sobre «{x.nombre}»{x.dias < 0 ? ` (la fecha de decisión pasó hace ${-x.dias} día${x.dias === -1 ? "" : "s"})` : ""}.</span><i aria-hidden="true">→</i></a>)}
    </section>
  );
}
