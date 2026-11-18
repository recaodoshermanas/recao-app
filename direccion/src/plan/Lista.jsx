// Plan → Lista (portada del Plan, estilo Asana/Monday): las tareas agrupadas por proyecto, y todo se edita en la fila:
// marcar hecha, responsables, fecha, prioridad y estado. El título abre el panel con notas, pasos y comentarios.
// Arriba, las dos métricas en una tira fina y la alta rápida (@persona !alta #proyecto).
import { useEffect, useRef, useState } from "react";
import { Cargando, ir, avisar } from "../ui.jsx";
import { eur, pct, num } from "../fmt.js";
import { usePlan, SOCIOS, nombreSocio, hoyISO, atrasada, ordenTareas, actualizarTarea, ESTADOS_T, PRIORIDADES, AREA } from "./datos.js";
import { AltaRapida, TareaPanel } from "./Tareas.jsx";
import { ProyectoPanel } from "./Ejecucion.jsx";
import { EditarProyecto } from "./Plan.jsx";
import { COLUMNAS, METRICA, useMetricas } from "./rumbo.js";
import "./lista.css";

const COLOR_SOCIO = { Adrian: "#1E272E", Pablo: "#7A5E9E", Javi: "#B5651D", Migue: "#317039" };
const ini = (id) => (nombreSocio(id) || "?")[0];
export function Bola({ id, size = 26, borde = "#fff" }) {
  return <span className="ls-bola" title={nombreSocio(id)} style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: COLOR_SOCIO[id] || "#6B7278", boxShadow: `0 0 0 2px ${borde}` }}>{ini(id)}</span>;
}
const fechaCelda = (f, hoy) => {
  if (!f) return "";
  if (f === hoy) return "Hoy";
  const d = new Date(`${f}T12:00:00`); const h = new Date(`${hoy}T12:00:00`);
  const dif = Math.round((d - h) / 86400000);
  if (dif === 1) return "Mañana";
  if (dif === -1) return "Ayer";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
};

// ---------- tira de métricas ----------
export function TiraMetricas() {
  const { m } = useMetricas();
  if (!m) return <div className="ls-tira"><span className="ls-pill vacia">Cargando métricas…</span></div>;
  const suelo = Number(m.config?.plan_margen_suelo) || 37;
  const mes = m.mes || {}, ant = m.anterior || {};
  const d = mes.por_dia && ant.por_dia ? ((mes.por_dia - ant.por_dia) / ant.por_dia) * 100 : null;
  const ok = mes.margen_pct != null ? mes.margen_pct >= suelo : null;
  const hz = m.config?.plan_horizonte;
  const quedan = hz ? Math.ceil((new Date(`${hz}T12:00:00`) - new Date()) / 86400000) : null;
  return (
    <div className="ls-tira">
      <span className="ls-pill"><span>Facturación</span><b>{mes.por_dia != null ? `${eur(mes.por_dia)}/día` : "–"}</b>{d != null && <em className={d >= 0 ? "up" : "down"}>{d >= 0 ? "▲" : "▼"} {num(Math.abs(d), 1)} %</em>}</span>
      <span className="ls-pill"><span>Margen</span><b>{mes.margen_pct != null ? pct(mes.margen_pct) : "–"}</b>{ok != null && <em className={ok ? "up" : "down"}>{ok ? "✓ sobre" : "✕ bajo"} el {pct(suelo, 0)}</em>}</span>
      {quedan != null && quedan >= 0 && <span className="ls-pill suave">Trimestre: quedan {quedan} días</span>}
    </div>
  );
}

// ---------- celdas editables ----------
function CeldaPersonas({ t }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => { if (!ref.current?.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);
  const ps = t.propietarios || [];
  const toggle = async (id) => {
    const s = new Set(ps); s.has(id) ? s.delete(id) : s.add(id);
    try { await actualizarTarea(t.id, { propietarios: SOCIOS.map((x) => x.id).filter((x) => s.has(x)) }); } catch (e) { avisar("No se ha podido guardar", "mal"); }
  };
  return (
    <div className="ls-celda-p" ref={ref}>
      <button className="ls-personas" onClick={() => setAbierto(!abierto)} aria-label={`Responsables: ${ps.map(nombreSocio).join(", ") || "nadie"}`} aria-expanded={abierto}>
        {ps.length ? ps.map((p) => <Bola key={p} id={p} />) : <span className="ls-nadie">+</span>}
      </button>
      {abierto && (
        <div className="ls-pop" role="menu">
          {SOCIOS.map((s) => (
            <button key={s.id} role="menuitemcheckbox" aria-checked={ps.includes(s.id)} className={ps.includes(s.id) ? "on" : ""} onClick={() => toggle(s.id)}>
              <Bola id={s.id} size={24} /><span>{s.label}</span><i>{ps.includes(s.id) ? "✓" : ""}</i>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Fila({ t, hoy, onAbrir }) {
  const g = (patch) => actualizarTarea(t.id, patch).catch(() => avisar("No se ha podido guardar", "mal"));
  const hecha = t.estado === "hecha";
  const tarde = atrasada(t, hoy);
  const ck = Array.isArray(t.checklist) ? t.checklist : [];
  return (
    <div className={`ls-fila ${hecha ? "hecha" : ""}`}>
      <button className={`ls-check ${hecha ? "on" : ""}`} onClick={() => g({ estado: hecha ? "pendiente" : "hecha" })} aria-label={hecha ? "Reabrir" : "Marcar como hecha"}>{hecha ? "✓" : ""}</button>
      <button className="ls-tit" onClick={() => onAbrir(t.id)} title="Abrir: notas, pasos y comentarios">
        <span>{t.titulo || "Sin título"}</span>
        {ck.length > 0 && <small>pasos {ck.filter((c) => c.hecha).length}/{ck.length}</small>}
      </button>
      <CeldaPersonas t={t} />
      <label className={`ls-fecha ${tarde ? "tarde" : ""} ${t.fecha_fin ? "" : "vacia"}`}>
        <span>{t.fecha_fin ? fechaCelda(t.fecha_fin, hoy) : "Fecha"}</span>
        <input type="date" value={t.fecha_fin || ""} onChange={(e) => g({ fecha_fin: e.target.value || null })} aria-label="Fecha límite" />
      </label>
      <select className={`ls-prio p-${t.prioridad}`} value={t.prioridad} onChange={(e) => g({ prioridad: e.target.value })} aria-label="Prioridad">
        {PRIORIDADES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <select className={`ls-est e-${t.estado}`} value={t.estado} onChange={(e) => g({ estado: e.target.value })} aria-label="Estado">
        {ESTADOS_T.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
      </select>
    </div>
  );
}

function Grupo({ titulo, color, p, tareas, hoy, ocultarHechas, onAbrir, onAbrirProyecto, defaults }) {
  const [plegado, setPlegado] = useState(false);
  const ts = tareas.slice().sort(ordenTareas);
  const vis = ocultarHechas ? ts.filter((t) => t.estado !== "hecha") : ts;
  const hechas = ts.filter((t) => t.estado === "hecha").length;
  const col = p && COLUMNAS.find((c) => c.id === p.columna);
  const met = p && METRICA[p.metrica];
  return (
    <section className="ls-grupo" style={{ "--g": color }}>
      <header className="ls-gcab">
        <button className="ls-pleg" onClick={() => setPlegado(!plegado)} aria-expanded={!plegado} aria-label={plegado ? "Desplegar" : "Plegar"}>{plegado ? "▸" : "▾"}</button>
        {p ? <button className="ls-gnom" onClick={() => onAbrirProyecto(p)}>{titulo}</button> : <b className="ls-gnom">{titulo}</b>}
        {col && <span className={`ls-col ${col.id === "ahora" ? "ahora" : ""}`}>{col.label}</span>}
        {p?.area && <span className="ls-area">{AREA[p.area]?.label}</span>}
        {met && <span className="ls-met">↗ {met.corta}</span>}
        <span className="ls-esp" />
        {ts.length > 0 && <span className="ls-prog"><i><b style={{ width: `${Math.round((100 * hechas) / ts.length)}%` }} /></i>{hechas}/{ts.length}</span>}
        {p?.responsable && <Bola id={p.responsable} size={28} />}
      </header>
      {!plegado && (
        <>
          {vis.map((t) => <Fila key={t.id} t={t} hoy={hoy} onAbrir={onAbrir} />)}
          <div className="ls-alta"><AltaRapida defaults={defaults} placeholder={`Añadir tarea${p ? ` a «${titulo}»` : ""}…`} /></div>
        </>
      )}
    </section>
  );
}

export function PlanLista({ user }) {
  const { tareas, proyectos } = usePlan();
  const [persona, setPersona] = useState(() => { try { return localStorage.getItem("plan-lista-persona") || ""; } catch (e) { return ""; } });
  const [ocultar, setOcultar] = useState(true);
  const [pronto, setPronto] = useState(false);
  const [q, setQ] = useState("");
  const [abierta, setAbierta] = useState(null);
  const [proy, setProy] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  if (!tareas || !proyectos) return <Cargando />;
  const hoy = hoyISO();
  const en7 = (() => { const d = new Date(`${hoy}T12:00:00`); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();
  const elegir = (id) => { const v = persona === id ? "" : id; setPersona(v); try { localStorage.setItem("plan-lista-persona", v); } catch (e) { /* nada */ } };
  const pasa = (t) =>
    (!persona || (t.propietarios || []).includes(persona)) &&
    (!q || `${t.titulo} ${t.descripcion || ""}`.toLowerCase().includes(q.toLowerCase())) &&
    (!pronto || (t.estado !== "hecha" && t.fecha_fin && t.fecha_fin <= en7));
  const visibles = tareas.filter(pasa);
  const orden = { ahora: 0, siguiente: 1, mas_adelante: 2 };
  const vivos = proyectos.filter((p) => p.estado !== "terminado")
    .sort((a, b) => (a.permanente - b.permanente) || ((orden[a.columna] ?? 3) - (orden[b.columna] ?? 3)) || a.id - b.id)
    .filter((p) => !persona || p.responsable === persona || visibles.some((t) => t.proyecto_id === p.id));
  const sueltas = visibles.filter((t) => !t.proyecto_id || !proyectos.some((p) => p.id === t.proyecto_id && p.estado !== "terminado"));
  const defBase = persona ? { propietarios: [persona] } : {};
  const nVencidas = tareas.filter((t) => atrasada(t, hoy) && (!persona || (t.propietarios || []).includes(persona))).length;

  return (
    <div className="ls">
      <div className="ls-cab">
        <TiraMetricas />
        <span className="ls-esp" />
        <button className="ls-btn" onClick={() => ir("plan/reuniones")}>Reunión</button>
        <button className="ls-btn" onClick={() => setNuevo(true)}>+ Proyecto</button>
      </div>

      <div className="ls-filtros">
        <div className="ls-quien" role="group" aria-label="Ver tareas de">
          <span>Ver de</span>
          {SOCIOS.map((s) => <button key={s.id} className={persona === s.id ? "on" : ""} onClick={() => elegir(s.id)} aria-pressed={persona === s.id} title={s.label}><Bola id={s.id} size={30} borde={persona === s.id ? "#F1BE49" : "#fff"} /></button>)}
          {persona && <button className="ls-chip" onClick={() => elegir("")}>Todos ✕</button>}
        </div>
        <button className={`ls-chip ${pronto ? "on" : ""}`} onClick={() => setPronto(!pronto)} aria-pressed={pronto}>◷ Vencen en 7 días</button>
        <button className={`ls-chip ${ocultar ? "on" : ""}`} onClick={() => setOcultar(!ocultar)} aria-pressed={ocultar}>Ocultar hechas</button>
        {nVencidas > 0 && <span className="ls-aviso">{nVencidas} vencida{nVencidas > 1 ? "s" : ""}</span>}
        <span className="ls-esp" />
        <input className="ls-buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar tareas" />
      </div>

      <div className="ls-alta-top"><AltaRapida defaults={defBase} placeholder="Escribe una tarea y pulsa Enter…   @javi  !alta  #proyecto" onCreada={(n) => setAbierta(n.id)} /></div>

      <div className="ls-colcab" aria-hidden="true"><span /><span>Tarea</span><span>Responsables</span><span>Fecha</span><span>Prioridad</span><span>Estado</span></div>
      {vivos.length === 0 && sueltas.length === 0 && (
        <div className="ls-vacio"><b>Empezad por los proyectos</b><p>Cread cada uno los vuestros con «+ Proyecto» y añadid sus tareas aquí mismo.</p><button className="ls-btn osc" onClick={() => setNuevo(true)}>+ Proyecto</button></div>
      )}
      <div className="ls-grupos">
        {vivos.map((p) => (
          <Grupo key={p.id} titulo={p.nombre} color={AREA[p.area]?.color || "#8A9095"} p={p} tareas={visibles.filter((t) => t.proyecto_id === p.id)} hoy={hoy} ocultarHechas={ocultar}
            onAbrir={setAbierta} onAbrirProyecto={setProy} defaults={{ ...defBase, proyecto_id: p.id, area: p.area || null, ...(persona ? {} : { propietarios: p.responsable ? [p.responsable] : [] }) }} />
        ))}
        {(sueltas.length > 0 || vivos.length > 0) && <Grupo titulo="Tareas sin proyecto" color="#C9C5BA" tareas={sueltas} hoy={hoy} ocultarHechas={ocultar} onAbrir={setAbierta} onAbrirProyecto={() => {}} defaults={defBase} />}
      </div>
      <p className="ls-pie">Pulsa una celda para cambiarla. El título abre la tarea; el nombre del proyecto, el proyecto. Tecla N: nueva tarea.</p>

      {abierta && <TareaPanel id={abierta} user={user} onClose={() => setAbierta(null)} />}
      {proy && <ProyectoPanel p={proy} user={user} onClose={() => setProy(null)} />}
      {nuevo && <EditarProyecto p={{ columna: "siguiente", responsable: persona || "" }} onClose={() => setNuevo(false)} onGuardado={(n) => { setNuevo(false); if (n?.id) setProy(n); }} />}
    </div>
  );
}
