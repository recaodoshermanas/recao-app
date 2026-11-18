// Plan → Proyectos y tareas: una sola sección con tres pestañas.
//  · Foco (por defecto): todas las tareas por cuándo vencen (vencidas, hoy, mañana, próximos días, más adelante, sin fecha,
//    hechas en 7 días), con contadores que filtran y alta rápida en cada grupo que ya pone la fecha.
//  · Proyectos: cada proyecto se despliega con sus tareas; se marcan, se añaden y se abren sin cambiar de pantalla.
//  · Todas las tareas: la lista y el tablero de siempre, con filtros.
import { useEffect, useRef, useState } from "react";
import { Panel, Pestanas, Avatar, fechaCorta, Cargando, ir, avisar } from "../ui.jsx";
import { usePlan, cargarPlan, SOCIOS, nombreSocio, hoyISO, atrasada, ordenTareas, crearProyecto, actualizarProyecto, borrarProyecto, crearTarea, AREAS_PLAN, PRIORIDADES } from "./datos.js";
import { ChipArea, FilaTarea, AltaRapida, TareaPanel, resumenProyecto, leerAltaRapida } from "./Tareas.jsx";
import { Fila, Bola } from "./Lista.jsx";
import { Proyectos, PlanTareas, EditarProyecto } from "./Plan.jsx";
import { COLUMNAS, METRICA, METRICAS, DIAS_GRIS, diasDesde, socioDe } from "./rumbo.js";

const PESTANAS = [{ id: "foco", label: "Foco" }, { id: "proyectos", label: "Proyectos" }, { id: "todas", label: "Tablero y lista" }];
const masDias = (f, n) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function PlanProyectos({ user, extra }) {
  const ruta = extra === "personas" ? "foco" : extra; // «Por persona» pasó a ser el filtro de persona del Foco
  const inicial = PESTANAS.some((p) => p.id === ruta) ? ruta : (() => { try { const g = localStorage.getItem("plan-pestana"); return PESTANAS.some((p) => p.id === g) ? g : "foco"; } catch (e) { return "foco"; } })();
  const [tab, setTab] = useState(inicial);
  useEffect(() => { if (PESTANAS.some((p) => p.id === ruta)) setTab(ruta); }, [ruta]);
  if (extra && /^\d+$/.test(String(extra))) return <Proyectos user={user} extra={extra} />; // ficha de un proyecto
  useEffect(() => {
    const k = (e) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(document.activeElement?.tagName || "") || document.body.classList.contains("con-panel")) return;
      const el = document.querySelector("[data-alta-rapida]"); if (el) { e.preventDefault(); el.focus(); }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);
  const cambiar = (t) => { setTab(t); try { localStorage.setItem("plan-pestana", t); } catch (e) { /* sin almacenamiento */ } };
  return (
    <>
      <div className="barra-sec"><Pestanas valor={tab} onChange={cambiar} etiqueta="Vista" opciones={PESTANAS} /></div>
      {tab === "proyectos" && <ListaProyectos user={user} />}
      {tab === "foco" && <VistaFoco user={user} />}
      {tab === "todas" && <PlanTareas user={user} />}
    </>
  );
}

// ---------- proyectos desplegables ----------
function ListaProyectos({ user }) {
  const { tareas, proyectos, nComentarios } = usePlan();
  const [quien, setQuien] = useState("");
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [abierta, setAbierta] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const [editar, setEditar] = useState(null);
  const [verTerminados, setVerTerminados] = useState(false);
  if (!tareas || !proyectos) return <Cargando />;
  const toggle = (k) => setAbiertos((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const mios = proyectos.filter((p) => !quien || p.responsable === quien || tareas.some((t) => t.proyecto_id === p.id && (t.propietarios || []).includes(quien) && t.estado !== "hecha"));
  const vivos = mios.filter((p) => p.estado !== "terminado");
  const grupos = [
    ...COLUMNAS.map((c) => ({ k: c.id, label: c.label, lista: vivos.filter((p) => !p.permanente && p.columna === c.id) })),
    { k: "sin", label: "Sin colocar en el roadmap", lista: vivos.filter((p) => !p.permanente && !p.columna) },
    { k: "perm", label: "Responsabilidades permanentes", lista: vivos.filter((p) => p.permanente) },
  ].filter((g) => g.lista.length);
  const terminados = mios.filter((p) => p.estado === "terminado");
  const sueltas = tareas.filter((t) => !t.proyecto_id && t.estado !== "hecha" && (!quien || (t.propietarios || []).includes(quien))).sort(ordenTareas);
  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={quien} onChange={setQuien} etiqueta="De" opciones={[{ id: "", label: "Todos" }, ...SOCIOS.map((s) => ({ id: s.id, label: s.label }))]} />
        <div className="acciones">
          <button className="btn-l" onClick={() => setAbiertos(abiertos.size ? new Set() : new Set(vivos.map((p) => p.id)))}>{abiertos.size ? "Plegar todo" : "Desplegar todo"}</button>
          <button className="btn-p" onClick={() => setNuevo(true)}>+ Proyecto</button>
        </div>
      </div>
      {grupos.map((g) => (
        <section key={g.k} className="ej-grupo">
          <h3>{g.label} <span className="rb-n">{g.lista.length}</span></h3>
          <ul className="ej-proys">{g.lista.map((p) => <FilaProyecto key={p.id} p={p} tareas={tareas} proyectos={proyectos} nComentarios={nComentarios} abierto={abiertos.has(p.id)} onToggle={() => toggle(p.id)} onAbrirTarea={setAbierta} onEditar={setEditar} />)}</ul>
        </section>
      ))}
      <section className="ej-grupo">
        <h3>Tareas sin proyecto <span className="rb-n">{sueltas.length}</span></h3>
        <div className="card ej-sueltas">
          {sueltas.length ? <ul className="lista-t">{sueltas.map((t) => <FilaTarea key={t.id} t={t} proyectos={proyectos} onAbrir={setAbierta} nCom={nComentarios?.[t.id]} />)}</ul> : <p className="empty">Ninguna.</p>}
          <AltaRapida defaults={quien ? { propietarios: [quien] } : {}} placeholder="Añadir una tarea suelta…" onCreada={(n) => setAbierta(n.id)} />
        </div>
      </section>
      {terminados.length > 0 && (
        <section className="ej-grupo">
          <button className="btn-txt" onClick={() => setVerTerminados(!verTerminados)}>{verTerminados ? "Ocultar" : "Ver"} {terminados.length} proyectos terminados</button>
          {verTerminados && <ul className="ej-proys">{terminados.map((p) => <FilaProyecto key={p.id} p={p} tareas={tareas} proyectos={proyectos} nComentarios={nComentarios} abierto={abiertos.has(p.id)} onToggle={() => toggle(p.id)} onAbrirTarea={setAbierta} onEditar={setEditar} />)}</ul>}
        </section>
      )}
      {abierta && <TareaPanel id={abierta} user={user} onClose={() => setAbierta(null)} />}
      {editar && <EditarProyecto p={editar} onClose={() => setEditar(null)} onGuardado={() => { setEditar(null); cargarPlan(); }} onBorrado={() => { setEditar(null); cargarPlan(); }} />}
      {nuevo && <EditarProyecto p={{ columna: "siguiente", responsable: quien || "" }} onClose={() => setNuevo(false)} onGuardado={() => { setNuevo(false); cargarPlan(); }} />}
    </>
  );
}

function FilaProyecto({ p, tareas, proyectos, nComentarios, abierto, onToggle, onAbrirTarea, onEditar }) {
  const [verHechas, setVerHechas] = useState(false);
  const r = resumenProyecto(p, tareas);
  const ts = tareas.filter((t) => t.proyecto_id === p.id).sort(ordenTareas);
  const abiertas = ts.filter((t) => t.estado !== "hecha");
  const hechas = ts.filter((t) => t.estado === "hecha");
  const personas = [...new Set(abiertas.flatMap((t) => t.propietarios || []))];
  const met = METRICA[p.metrica];
  const gris = !p.permanente && p.estado !== "terminado" && diasDesde(p.actualizado_en) >= DIAS_GRIS;
  const hoy = hoyISO();
  return (
    <li className={`card ej-proy ${abierto ? "abierto" : ""} ${gris ? "gris" : ""}`}>
      <button className="ej-proy-cab" onClick={onToggle} aria-expanded={abierto}>
        <span className="ej-caret" aria-hidden>{abierto ? "▾" : "▸"}</span>
        <span className="ej-proy-nom">
          <span className="ej-proy-chips"><ChipArea id={p.area} />{met && <span className={`rb-met-chip ${met.principal ? "principal" : ""}`}>↗ {met.corta}</span>}{gris && <span className="rb-gris">sin actualizar hace {diasDesde(p.actualizado_en)} días</span>}</span>
          <b>{p.nombre}</b>
          {p.siguiente_paso && <small className={p.siguiente_paso_fecha && p.siguiente_paso_fecha < hoy ? "mal" : ""}>→ {p.siguiente_paso}{p.siguiente_paso_fecha ? ` · ${fechaCorta(p.siguiente_paso_fecha)}` : ""}</small>}
        </span>
        <span className="ej-proy-avance">
          <span className="barra-p"><i style={{ width: `${r.pct}%` }} /></span>
          <small>{r.total ? `${r.hechas}/${r.total} tareas` : "sin tareas"}{r.atrasadas ? <em> · {r.atrasadas} atrasadas</em> : ""}</small>
        </span>
        <span className="ej-proy-gente">
          {p.responsable && <span title={`Responsable: ${nombreSocio(p.responsable)}`}><Avatar nombre={nombreSocio(p.responsable)} size={26} /></span>}
          {personas.filter((x) => x !== p.responsable).map((x) => <span key={x} className="ej-otro" title={nombreSocio(x)}><Avatar nombre={nombreSocio(x)} size={20} /></span>)}
        </span>
      </button>
      {abierto && (
        <div className="ej-proy-cuerpo">
          {p.objetivo && <p className="ej-obj"><b>Objetivo:</b> {p.objetivo}</p>}
          {abiertas.length ? <ul className="lista-t">{abiertas.map((t) => <FilaTarea key={t.id} t={t} proyectos={proyectos} onAbrir={onAbrirTarea} nCom={nComentarios?.[t.id]} mostrarProyecto={false} />)}</ul> : <p className="empty">No hay tareas abiertas.</p>}
          {verHechas && hechas.length > 0 && <ul className="lista-t">{hechas.map((t) => <FilaTarea key={t.id} t={t} proyectos={proyectos} onAbrir={onAbrirTarea} nCom={nComentarios?.[t.id]} mostrarProyecto={false} />)}</ul>}
          <AltaRapida defaults={{ proyecto_id: p.id, area: p.area || null, propietarios: p.responsable ? [p.responsable] : [] }} placeholder={`Añadir tarea a «${p.nombre}»…`} />
          <div className="ej-proy-pie">
            {hechas.length > 0 && <button className="btn-txt" onClick={() => setVerHechas(!verHechas)}>{verHechas ? "Ocultar" : "Ver"} {hechas.length} hechas</button>}
            <span />
            <span className="ej-acc"><button className="btn-l" onClick={() => onEditar(p)}>Editar</button><button className="btn-l" onClick={() => ir(`plan/proyectos/${p.id}`)}>Abrir la ficha →</button></span>
          </div>
        </div>
      )}
    </li>
  );
}

// ---------- Foco: todas las tareas por cuándo vencen ----------
const CONTADORES = [
  { k: "vencidas", label: "Vencidas", sub: "con la fecha pasada" },
  { k: "hoy", label: "Para hoy", sub: "" },
  { k: "semana", label: "Próximos 7 días", sub: "con fecha límite" },
  { k: "hechas", label: "Hechas esta semana", sub: "últimos 7 días" },
];
export function pedirFiltroFoco(k, persona = "") { // desde Rumbo: abre el Foco ya filtrado
  try { localStorage.setItem("plan-foco-pedido", JSON.stringify({ k, persona })); localStorage.setItem("plan-pestana", "foco"); } catch (e) { /* sin almacenamiento */ }
  ir("plan/proyectos/foco");
}

function VistaFoco({ user }) {
  const { tareas, proyectos, nComentarios } = usePlan();
  const pedido = (() => { try { const x = JSON.parse(localStorage.getItem("plan-foco-pedido") || "null"); localStorage.removeItem("plan-foco-pedido"); return x; } catch (e) { return null; } })();
  const [persona, setPersona] = useState(() => pedido?.persona ?? (() => { try { return localStorage.getItem("plan-foco-persona") || ""; } catch (e) { return ""; } })());
  const [proyecto, setProyecto] = useState("");
  const [foco, setFoco] = useState(pedido?.k || null);
  const [cerrados, setCerrados] = useState({ hechas: true });
  const [abierta, setAbierta] = useState(null);
  if (!tareas || !proyectos) return <Cargando />;
  const hoy = hoyISO(); const D = (n) => masDias(hoy, n);
  const cambiarPersona = (x) => { setPersona(x); try { localStorage.setItem("plan-foco-persona", x); } catch (e) { /* nada */ } };
  const visibles = tareas.filter((t) =>
    (!persona || (persona === "nadie" ? !(t.propietarios || []).length : (t.propietarios || []).includes(persona))) &&
    (!proyecto || (proyecto === "sin" ? !t.proyecto_id : String(t.proyecto_id) === proyecto)));
  const abiertas = visibles.filter((t) => t.estado !== "hecha");
  const hace7 = new Date(Date.now() - 6 * 86400000); hace7.setHours(0, 0, 0, 0);
  const en = {
    vencidas: (t) => t.estado !== "hecha" && t.fecha_fin && t.fecha_fin < hoy,
    hoy: (t) => t.estado !== "hecha" && t.fecha_fin === hoy,
    semana: (t) => t.estado !== "hecha" && t.fecha_fin && t.fecha_fin >= hoy && t.fecha_fin < D(7),
    hechas: (t) => t.estado === "hecha" && t.completada_en && new Date(t.completada_en) >= hace7,
  };
  const n = (k) => visibles.filter(en[k]).length;
  const enCurso = abiertas.filter((t) => t.estado === "en_curso").length;
  const base = foco ? visibles.filter(en[foco]) : visibles;
  const ab = base.filter((t) => t.estado !== "hecha");
  const GRUPOS = [
    { k: "vencidas", label: "Vencidas", f: (t) => t.fecha_fin && t.fecha_fin < hoy, mal: true },
    { k: "hoy", label: "Hoy", f: (t) => t.fecha_fin === hoy, fecha: hoy, siempre: true },
    { k: "manana", label: "Mañana", f: (t) => t.fecha_fin === D(1), fecha: D(1) },
    { k: "prox", label: "Próximos días", f: (t) => t.fecha_fin >= D(2) && t.fecha_fin < D(7) },
    { k: "luego", label: "Más adelante", f: (t) => t.fecha_fin >= D(7) },
    { k: "sinf", label: "Sin fecha", f: (t) => !t.fecha_fin, fecha: null, siempre: !foco },
  ];
  const hechas = (foco && foco !== "hechas" ? [] : base.filter(en.hechas)).sort((a, b) => String(b.completada_en).localeCompare(String(a.completada_en)));
  const defaults = (fecha) => ({ ...(fecha !== undefined ? { fecha_fin: fecha } : {}), ...(persona && persona !== "nadie" ? { propietarios: [persona] } : {}), ...(proyecto && proyecto !== "sin" ? { proyecto_id: Number(proyecto), area: proyectos.find((p) => String(p.id) === proyecto)?.area || null } : {}) });
  const vivos = proyectos.filter((p) => p.estado !== "terminado");
  const grupos = GRUPOS.map((g) => ({ ...g, lista: ab.filter(g.f).sort(ordenTareas) })).filter((g) => g.lista.length || (g.siempre && foco !== "hechas" && foco !== "vencidas"));
  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={persona} onChange={cambiarPersona} etiqueta="De" opciones={[{ id: "", label: "Todos" }, ...SOCIOS.map((s) => ({ id: s.id, label: s.label, n: tareas.filter((t) => t.estado !== "hecha" && (t.propietarios || []).includes(s.id) && t.fecha_fin && t.fecha_fin < hoy).length || undefined })), { id: "nadie", label: "Sin responsable" }]} />
        <div className="acciones">
          <select value={proyecto} onChange={(e) => setProyecto(e.target.value)} aria-label="Proyecto"><option value="">Todos los proyectos</option><option value="sin">Sin proyecto</option>{vivos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        </div>
      </div>
      <div className="fo-kpis">
        {CONTADORES.map((c) => {
          const v = n(c.k);
          return (
            <button key={c.k} className={`card fo-kpi k-${c.k} ${foco === c.k ? "on" : ""} ${!v ? "cero" : ""}`} onClick={() => setFoco(foco === c.k ? null : c.k)} aria-pressed={foco === c.k}>
              <small>{c.label}</small><strong>{v}</strong>
              <em>{foco === c.k ? "Filtrando · pulsa para quitar" : c.k === "hoy" ? `${enCurso} en curso ahora` : c.sub}</em>
            </button>
          );
        })}
      </div>
      <div className="card">
        <AltaRapida defaults={defaults(undefined)} onCreada={(x) => setAbierta(x.id)} />
        <p className="fo-ayuda">Atajos al escribir: <code>@javi</code> responsable · <code>!alta</code> prioridad · <code>#inventario</code> proyecto</p>
      </div>
      {grupos.length === 0 && hechas.length === 0 && <div className="card"><p className="empty">Todo al día ✓ No hay tareas con estos filtros.</p></div>}
      {grupos.map((g) => (
        <section key={g.k} className={`fo-grupo ${g.mal ? "mal" : ""} ${cerrados[g.k] ? "cerrado" : ""}`}>
          <button className="fo-cab" onClick={() => setCerrados({ ...cerrados, [g.k]: !cerrados[g.k] })} aria-expanded={!cerrados[g.k]}>
            <span className="ej-caret" aria-hidden>{cerrados[g.k] ? "▸" : "▾"}</span><i className={`fo-pto k-${g.k}`} /><b>{g.label}</b><span className="rb-n">{g.lista.length}</span>
          </button>
          {!cerrados[g.k] && (
            <div className="card fo-cuerpo">
              {g.lista.length > 0 && <ul className="lista-t">{g.lista.map((t) => <FilaTarea key={t.id} t={t} proyectos={proyectos} onAbrir={setAbierta} nCom={nComentarios?.[t.id]} />)}</ul>}
              {"fecha" in g && <AltaRapida defaults={defaults(g.fecha)} placeholder={g.k === "hoy" ? "Añadir tarea para hoy…" : g.k === "manana" ? "Añadir tarea para mañana…" : "Añadir tarea sin fecha…"} />}
            </div>
          )}
        </section>
      ))}
      {hechas.length > 0 && (
        <section className={`fo-grupo ok ${cerrados.hechas && foco !== "hechas" ? "cerrado" : ""}`}>
          <button className="fo-cab" onClick={() => setCerrados({ ...cerrados, hechas: !cerrados.hechas })}>
            <span className="ej-caret" aria-hidden>{cerrados.hechas && foco !== "hechas" ? "▸" : "▾"}</span><i className="fo-pto k-hechas" /><b>Hechas · últimos 7 días</b><span className="rb-n">{hechas.length}</span>
          </button>
          {(!cerrados.hechas || foco === "hechas") && <div className="card fo-cuerpo"><ul className="lista-t">{hechas.map((t) => <FilaTarea key={t.id} t={t} proyectos={proyectos} onAbrir={setAbierta} nCom={nComentarios?.[t.id]} />)}</ul></div>}
        </section>
      )}
      {abierta && <TareaPanel id={abierta} user={user} onClose={() => setAbierta(null)} />}
    </>
  );
}

// ---------- el proyecto en un panel: sus tareas, su equipo y editar ----------
// Un proyecto es la suma de sus tareas. Tiene un responsable (quien rinde cuentas) y un equipo, que sale solo
// de las personas que tienen tareas en él.
export function equipoProyecto(p, tareas) {
  const otros = [...new Set((tareas || []).filter((t) => t.proyecto_id === p.id && t.estado !== "hecha").flatMap((t) => t.propietarios || []))];
  return otros.filter((x) => x !== p.responsable);
}
export function proximaTarea(p, tareas) {
  return (tareas || []).filter((t) => t.proyecto_id === p.id && t.estado !== "hecha").sort(ordenTareas)[0] || null;
}

// Proyecto en un panel lateral, como en el Roadmap de Impulser: todo se edita en el sitio y se guarda solo
// (nombre, columna, responsable, área, métrica, fecha, prioridad, objetivo) y debajo sus tareas, editables en la fila,
// con una caja para añadir que ya pregunta quién, cuándo y prioridad.
export async function nuevoProyecto(user, extra = {}) {
  const yo = socioDe(user);
  return crearProyecto({ nombre: "Proyecto nuevo", estado: "idea", prioridad: "media", columna: "siguiente", responsable: yo, ...extra });
}

const Chips = ({ opciones, valor, onChange, etiqueta }) => (
  <div className="pp2-chips" role="group" aria-label={etiqueta}>
    {opciones.map((o) => <button key={o.id} className={valor === o.id ? "on" : ""} aria-pressed={valor === o.id} onClick={() => onChange(o.id)} style={o.color && valor === o.id ? { background: o.color, borderColor: o.color, color: "#fff" } : undefined}>{o.label}</button>)}
  </div>
);

export function ProyectoPanel({ p, user, onClose }) {
  const { tareas, proyectos } = usePlan();
  const vivo = (proyectos || []).find((x) => x.id === p.id) || p;
  const [nombre, setNombre] = useState(vivo.nombre || "");
  const [obj, setObj] = useState(vivo.objetivo || "");
  const [guardado, setGuardado] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [verHechas, setVerHechas] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [nt, setNt] = useState({ titulo: "", quien: vivo.responsable || socioDe(user) || "", fecha: "", prio: "media" });
  const nombreRef = useRef(null);
  useEffect(() => { setNombre(vivo.nombre || ""); setObj(vivo.objetivo || ""); }, [p.id]); // eslint-disable-line
  useEffect(() => { if (vivo.nombre === "Proyecto nuevo") setTimeout(() => { nombreRef.current?.focus(); nombreRef.current?.select(); }, 250); }, [p.id]); // eslint-disable-line
  const sv = async (patch) => {
    try { await actualizarProyecto(vivo.id, patch); setGuardado(true); setTimeout(() => setGuardado(false), 1500); }
    catch (e) { avisar("No se ha podido guardar", "mal"); }
  };
  const ts = (tareas || []).filter((t) => t.proyecto_id === vivo.id).sort(ordenTareas);
  const abiertas = ts.filter((t) => t.estado !== "hecha");
  const hechas = ts.filter((t) => t.estado === "hecha");
  const hoy = hoyISO();
  const anadir = async () => {
    const r = leerAltaRapida(nt.titulo, proyectos);
    if (!r.titulo) return;
    try {
      await crearTarea({ proyecto_id: vivo.id, area: vivo.area || null, propietarios: nt.quien ? [nt.quien] : [], fecha_fin: nt.fecha || null, prioridad: nt.prio, ...r });
      setNt({ ...nt, titulo: "" });
    } catch (e) { avisar("No se ha podido añadir", "mal"); }
  };
  const columna = vivo.permanente ? "permanente" : (vivo.columna || "");
  return (
    <>
      <Panel titulo={<textarea ref={nombreRef} className="pp2-nombre" rows={1} value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => nombre.trim() && nombre !== vivo.nombre && sv({ nombre: nombre.trim() })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} aria-label="Nombre del proyecto" />}
        sub={<span className="pp2-sub">Proyecto · {hechas.length}/{ts.length} tareas hechas{guardado && <b> · Guardado ✓</b>}</span>} onClose={onClose} ancho="600px"
        pie={<div className="pie-t">
          <button className={`btn-txt peligro ${borrar ? "armado" : ""}`} onClick={async () => { if (!borrar) { setBorrar(true); setTimeout(() => setBorrar(false), 3000); return; } try { await borrarProyecto(vivo.id); avisar("Proyecto borrado"); onClose(); } catch (e) { avisar("No se ha podido borrar", "mal"); } }}>{borrar ? "¿Seguro? Pulsa otra vez" : "Borrar proyecto"}</button>
          <button className="btn-p" onClick={onClose}>Listo</button>
        </div>}>
        <div className="pp2-campos">
          <span>Columna</span>
          <Chips etiqueta="Columna" valor={columna} onChange={(c) => sv(c === "permanente" ? { permanente: true, columna: null } : { permanente: false, columna: c, ...(c === "ahora" && vivo.estado !== "activo" ? { estado: "activo" } : {}) })}
            opciones={[...COLUMNAS.map((c) => ({ id: c.id, label: c.label })), { id: "permanente", label: "Permanente" }]} />
          <span>Responsable</span>
          <div className="pp2-chips" role="group" aria-label="Responsable">
            {SOCIOS.map((s) => <button key={s.id} className={vivo.responsable === s.id ? "on" : ""} aria-pressed={vivo.responsable === s.id} onClick={() => sv({ responsable: vivo.responsable === s.id ? null : s.id })}><Bola id={s.id} size={22} />{s.label}</button>)}
          </div>
          <span>Área</span>
          <Chips etiqueta="Área" valor={vivo.area || ""} onChange={(a) => sv({ area: vivo.area === a ? null : a })} opciones={AREAS_PLAN.map((a) => ({ id: a.id, label: a.label, color: a.color }))} />
          <span>Métrica</span>
          <Chips etiqueta="Métrica" valor={vivo.metrica || ""} onChange={(m) => sv({ metrica: vivo.metrica === m ? null : m })} opciones={METRICAS.map((m) => ({ id: m.id, label: m.corta }))} />
          <span>Prioridad</span>
          <Chips etiqueta="Prioridad" valor={vivo.prioridad || "media"} onChange={(x) => sv({ prioridad: x })} opciones={PRIORIDADES} />
          <span>Fecha objetivo</span>
          <input type="date" className="pp2-fecha" value={vivo.fecha_objetivo || ""} onChange={(e) => sv({ fecha_objetivo: e.target.value || null })} />
        </div>
        <textarea className="pp2-obj" rows={2} value={obj} onChange={(e) => setObj(e.target.value)} onBlur={() => obj !== (vivo.objetivo || "") && sv({ objetivo: obj.trim() || null })} placeholder="Objetivo: por qué importa y cómo sabremos que está hecho…" />

        <h3 className="pp2-h">Tareas <span>{abiertas.length} abiertas</span></h3>
        <div className="pp2-tareas">
          {abiertas.map((t) => <Fila key={t.id} t={t} hoy={hoy} onAbrir={setAbierta} compacta />)}
          {verHechas && hechas.map((t) => <Fila key={t.id} t={t} hoy={hoy} onAbrir={setAbierta} compacta />)}
        </div>
        {hechas.length > 0 && <button className="btn-txt pp2-hechas" onClick={() => setVerHechas(!verHechas)}>{verHechas ? "Ocultar" : "Ver"} {hechas.length} hechas</button>}
        <div className="pp2-nueva">
          <input value={nt.titulo} onChange={(e) => setNt({ ...nt, titulo: e.target.value })} onKeyDown={(e) => e.key === "Enter" && anadir()} placeholder="Nueva tarea en este proyecto…" aria-label="Nueva tarea" />
          <div className="pp2-nueva-fila">
            <select value={nt.quien} onChange={(e) => setNt({ ...nt, quien: e.target.value })} aria-label="Responsable"><option value="">Sin responsable</option>{SOCIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <input type="date" value={nt.fecha} onChange={(e) => setNt({ ...nt, fecha: e.target.value })} aria-label="Fecha límite" />
            <select value={nt.prio} onChange={(e) => setNt({ ...nt, prio: e.target.value })} aria-label="Prioridad">{PRIORIDADES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
            <button className="btn-p" disabled={!nt.titulo.trim()} onClick={anadir}>Añadir</button>
          </div>
        </div>
      </Panel>
      {abierta && <TareaPanel id={abierta} user={user} onClose={() => setAbierta(null)} />}
    </>
  );
}
