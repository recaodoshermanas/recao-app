// Plan: piezas de tareas (fila, lista agrupada, tablero, alta rápida y panel de detalle).
import { useEffect, useRef, useState } from "react";
import { Panel, Avatar, avisar, fechaCorta, hace } from "../ui.jsx";
import {
  AREAS_PLAN, AREA, SOCIOS, nombreSocio, ESTADOS_T, ESTADO_T, PRIORIDADES, hoyISO, atrasada, ordenTareas,
  crearTarea, actualizarTarea, borrarTarea, comentariosDe, comentar, borrarComentario, usePlan,
} from "./datos.js";

export function ChipArea({ id }) {
  const a = AREA[id];
  if (!a) return null;
  return <span className="chip-area" style={{ "--c": a.color }}>{a.label}</span>;
}
export function Responsables({ ids, size = 22 }) {
  if (!ids || !ids.length) return <span className="sin-resp" title="Sin responsable">—</span>;
  return <span className="resp">{ids.map((id) => <span key={id} title={nombreSocio(id)}><Avatar nombre={nombreSocio(id)} size={size} /></span>)}</span>;
}
export function Fecha({ t }) {
  if (!t.fecha_fin) return <span className="f-tarea vacia">Sin fecha</span>;
  const hoy = hoyISO();
  const cls = atrasada(t, hoy) ? "mal" : t.fecha_fin === hoy && t.estado !== "hecha" ? "hoy" : "";
  return <span className={`f-tarea ${cls}`}>{t.fecha_fin === hoy ? "Hoy" : fechaCorta(t.fecha_fin)}</span>;
}

export function FilaTarea({ t, proyectos, onAbrir, nCom, mostrarProyecto = true }) {
  const proy = proyectos?.find((p) => p.id === t.proyecto_id);
  const ck = Array.isArray(t.checklist) ? t.checklist : [];
  const hechos = ck.filter((c) => c.hecha).length;
  const toggle = async (e) => {
    e.stopPropagation();
    try { await actualizarTarea(t.id, { estado: t.estado === "hecha" ? "pendiente" : "hecha" }); } catch (err) { avisar("No se ha podido guardar", "mal"); }
  };
  return (
    <li className={`fila-t e-${t.estado} p-${t.prioridad}`}>
      <button className={`check ${t.estado === "hecha" ? "on" : ""}`} onClick={toggle} aria-label={t.estado === "hecha" ? "Marcar como pendiente" : "Marcar como hecha"}>{t.estado === "hecha" ? "✓" : ""}</button>
      <button className="fila-t-cuerpo" onClick={() => onAbrir(t.id)}>
        <span className="t-tit">{t.prioridad === "alta" && t.estado !== "hecha" && <i className="prio-alta" title="Prioridad alta">!</i>}{t.titulo}</span>
        <span className="t-meta">
          {t.estado === "en_curso" && <span className="est en_curso">En curso</span>}
          {t.estado === "bloqueada" && <span className="est bloqueada">Bloqueada</span>}
          {mostrarProyecto && proy && <span className="t-proy">◆ {proy.nombre}</span>}
          <ChipArea id={t.area} />
          {ck.length > 0 && <span className="t-ck">☑ {hechos}/{ck.length}</span>}
          {nCom > 0 && <span className="t-com">💬 {nCom}</span>}
        </span>
      </button>
      <Responsables ids={t.propietarios} />
      <Fecha t={t} />
    </li>
  );
}

export function AltaRapida({ defaults, placeholder = "Añadir tarea… (escribe y pulsa Enter)", onCreada }) {
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const crear = async () => {
    const titulo = txt.trim(); if (!titulo) return;
    setBusy(true);
    try { const n = await crearTarea({ titulo, ...defaults }); setTxt(""); onCreada && onCreada(n); }
    catch (e) { avisar("No se ha podido crear la tarea", "mal"); }
    setBusy(false);
  };
  return (
    <div className="alta-rapida">
      <span aria-hidden="true">+</span>
      <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") crear(); }} placeholder={placeholder} disabled={busy} aria-label="Nueva tarea" />
      {txt.trim() && <button className="btn-p" onClick={crear} disabled={busy}>Añadir</button>}
    </div>
  );
}

export function agrupar(tareas, por, proyectos) {
  const hoy = hoyISO();
  const finSemana = (() => { const d = new Date(`${hoy}T12:00:00`); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();
  if (por === "fecha") {
    const g = { atrasadas: [], hoy: [], semana: [], despues: [], sin: [], hechas: [] };
    tareas.forEach((t) => {
      if (t.estado === "hecha") g.hechas.push(t);
      else if (!t.fecha_fin) g.sin.push(t);
      else if (t.fecha_fin < hoy) g.atrasadas.push(t);
      else if (t.fecha_fin === hoy) g.hoy.push(t);
      else if (t.fecha_fin <= finSemana) g.semana.push(t);
      else g.despues.push(t);
    });
    return [
      { id: "atrasadas", label: "Atrasadas", tareas: g.atrasadas, tono: "mal" }, { id: "hoy", label: "Hoy", tareas: g.hoy },
      { id: "semana", label: "Próximos 7 días", tareas: g.semana }, { id: "despues", label: "Más adelante", tareas: g.despues },
      { id: "sin", label: "Sin fecha", tareas: g.sin }, { id: "hechas", label: "Hechas", tareas: g.hechas.sort((a, b) => String(b.completada_en || b.actualizado_en).localeCompare(String(a.completada_en || a.actualizado_en))), plegado: true },
    ].filter((x) => x.tareas.length);
  }
  if (por === "proyecto") {
    const grupos = (proyectos || []).map((p) => ({ id: `p${p.id}`, label: p.nombre, tareas: tareas.filter((t) => t.proyecto_id === p.id) }));
    grupos.push({ id: "sinp", label: "Sin proyecto", tareas: tareas.filter((t) => !t.proyecto_id || !(proyectos || []).some((p) => p.id === t.proyecto_id)) });
    return grupos.filter((x) => x.tareas.length);
  }
  if (por === "area") {
    const g = AREAS_PLAN.map((a) => ({ id: a.id, label: a.label, tareas: tareas.filter((t) => t.area === a.id) }));
    g.push({ id: "sina", label: "Sin área", tareas: tareas.filter((t) => !AREA[t.area]) });
    return g.filter((x) => x.tareas.length);
  }
  if (por === "persona") {
    const g = SOCIOS.map((s) => ({ id: s.id, label: s.label, tareas: tareas.filter((t) => (t.propietarios || []).includes(s.id)) }));
    g.push({ id: "nadie", label: "Sin responsable", tareas: tareas.filter((t) => !(t.propietarios || []).length) });
    return g.filter((x) => x.tareas.length);
  }
  return [{ id: "todas", label: "Tareas", tareas }];
}

export function ListaAgrupada({ tareas, por, proyectos, onAbrir, nComentarios, mostrarProyecto }) {
  const [abiertos, setAbiertos] = useState({});
  const grupos = agrupar(tareas, por, proyectos);
  if (!grupos.length) return <p className="empty">No hay tareas.</p>;
  return (
    <div className="grupos-t">
      {grupos.map((g) => {
        const plegado = g.plegado ? !abiertos[g.id] : !!abiertos[g.id];
        return (
          <section key={g.id} className={`grupo-t ${g.tono || ""}`}>
            <button className="grupo-t-cab" onClick={() => setAbiertos({ ...abiertos, [g.id]: !abiertos[g.id] })} aria-expanded={!plegado}>
              <span className="flecha">{plegado ? "▸" : "▾"}</span>{g.label}<small>{g.tareas.length}</small>
            </button>
            {!plegado && <ul className="lista-t">{[...g.tareas].sort(ordenTareas).map((t) => <FilaTarea key={t.id} t={t} proyectos={proyectos} onAbrir={onAbrir} nCom={nComentarios?.[t.id]} mostrarProyecto={mostrarProyecto} />)}</ul>}
          </section>
        );
      })}
    </div>
  );
}

export function Tablero({ tareas, proyectos, onAbrir, nComentarios }) {
  const [sobre, setSobre] = useState(null);
  const soltar = async (estadoId, e) => {
    e.preventDefault(); setSobre(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    const t = tareas.find((x) => x.id === id);
    if (!t || t.estado === estadoId) return;
    try { await actualizarTarea(id, { estado: estadoId }); } catch (err) { avisar("No se ha podido mover", "mal"); }
  };
  return (
    <div className="tablero">
      {ESTADOS_T.map((col) => {
        const ts = tareas.filter((t) => (t.estado || "pendiente") === col.id).sort(ordenTareas);
        return (
          <section key={col.id} className={`col-t c-${col.id} ${sobre === col.id ? "sobre" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setSobre(col.id); }} onDragLeave={() => setSobre(null)} onDrop={(e) => soltar(col.id, e)}>
            <h3>{col.label}<small>{ts.length}</small></h3>
            <ul>
              {ts.map((t) => {
                const proy = proyectos?.find((p) => p.id === t.proyecto_id);
                const ck = Array.isArray(t.checklist) ? t.checklist : [];
                return (
                  <li key={t.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(t.id)); e.dataTransfer.effectAllowed = "move"; }}>
                    <button className={`tarjeta-t p-${t.prioridad}`} onClick={() => onAbrir(t.id)}>
                      <span className="t-tit">{t.titulo}</span>
                      {proy && <span className="t-proy">◆ {proy.nombre}</span>}
                      <span className="t-pie"><ChipArea id={t.area} />{ck.length > 0 && <span className="t-ck">☑ {ck.filter((c) => c.hecha).length}/{ck.length}</span>}{nComentarios?.[t.id] > 0 && <span className="t-com">💬 {nComentarios[t.id]}</span>}<span className="sep" /><Responsables ids={t.propietarios} size={20} /><Fecha t={t} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ---------- panel de detalle ----------
export function TareaPanel({ id, user, onClose }) {
  const { tareas, proyectos } = usePlan();
  const t = (tareas || []).find((x) => x.id === id);
  const [titulo, setTitulo] = useState(t?.titulo || "");
  const [desc, setDesc] = useState(t?.descripcion || "");
  const [coms, setComs] = useState(null);
  const [nuevoCk, setNuevoCk] = useState("");
  const [com, setCom] = useState("");
  const tituloRef = useRef(null);
  useEffect(() => { setTitulo(t?.titulo || ""); setDesc(t?.descripcion || ""); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { comentariosDe(id).then(setComs).catch(() => setComs([])); }, [id]);
  useEffect(() => { if (t && !t.titulo) tituloRef.current?.focus(); }, [t]);
  if (!t) return null;
  const guardar = async (patch, ok) => { try { await actualizarTarea(t.id, patch); if (ok) avisar(ok); } catch (e) { avisar("No se ha podido guardar", "mal"); } };
  const ck = Array.isArray(t.checklist) ? t.checklist : [];
  const setCk = (n) => guardar({ checklist: n });
  const toggleSocio = (sid) => { const s = new Set(t.propietarios || []); s.has(sid) ? s.delete(sid) : s.add(sid); guardar({ propietarios: SOCIOS.map((x) => x.id).filter((x) => s.has(x)) }); };
  const autor = user?.nombre || "Dirección";
  return (
    <Panel titulo={<input ref={tituloRef} className="titulo-ed" value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={() => titulo.trim() && titulo !== t.titulo && guardar({ titulo: titulo.trim() })} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} placeholder="Título de la tarea" aria-label="Título" />}
      sub={`Creada ${hace(t.creado_en)}${t.completada_en ? ` · hecha ${hace(t.completada_en)}` : ""}`} onClose={onClose} ancho="600px"
      pie={<div className="pie-t"><button className="btn-txt peligro" onClick={async () => { if (window.confirm("¿Eliminar esta tarea?")) { try { await borrarTarea(t.id); avisar("Tarea eliminada"); onClose(); } catch (e) { avisar("No se ha podido eliminar", "mal"); } } }}>Eliminar</button><button className="btn-p" onClick={onClose}>Listo</button></div>}>
      <div className="campos-t">
        <div className="campo-t"><span>Estado</span>
          <div className="seg seg-wrap">{ESTADOS_T.map((e) => <button key={e.id} aria-pressed={t.estado === e.id} onClick={() => guardar({ estado: e.id })}>{e.label}</button>)}</div>
        </div>
        <div className="campo-t"><span>Responsables</span>
          <div className="socios">{SOCIOS.map((s) => <button key={s.id} className={(t.propietarios || []).includes(s.id) ? "on" : ""} onClick={() => toggleSocio(s.id)} aria-pressed={(t.propietarios || []).includes(s.id)}><Avatar nombre={s.label} size={22} />{s.label}</button>)}</div>
        </div>
        <div className="campo-t"><span>Prioridad</span>
          <div className="seg">{PRIORIDADES.map((p) => <button key={p.id} aria-pressed={t.prioridad === p.id} onClick={() => guardar({ prioridad: p.id })}>{p.label}</button>)}</div>
        </div>
        <div className="fila-campos">
          <label className="campo">Área<select value={t.area || ""} onChange={(e) => guardar({ area: e.target.value || null })}><option value="">Sin área</option>{AREAS_PLAN.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
          <label className="campo">Proyecto<select value={t.proyecto_id || ""} onChange={(e) => guardar({ proyecto_id: e.target.value ? Number(e.target.value) : null })}><option value="">Sin proyecto</option>{(proyectos || []).filter((p) => p.estado !== "terminado" || p.id === t.proyecto_id).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        </div>
        <div className="fila-campos">
          <label className="campo">Empieza<input type="date" value={t.fecha_inicio || ""} onChange={(e) => guardar({ fecha_inicio: e.target.value || null })} /></label>
          <label className="campo">Fecha límite<input type="date" value={t.fecha_fin || ""} onChange={(e) => guardar({ fecha_fin: e.target.value || null })} /></label>
        </div>
        <label className="campo">Descripción<textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== (t.descripcion || "") && guardar({ descripcion: desc.trim() || null })} placeholder="Contexto, enlaces, qué significa terminarla…" /></label>

        <div className="campo-t bloque"><span>Pasos {ck.length > 0 && <small>{ck.filter((c) => c.hecha).length}/{ck.length}</small>}</span>
          <ul className="checklist">
            {ck.map((c) => (
              <li key={c.id} className={c.hecha ? "hecha" : ""}>
                <button className={`check peq ${c.hecha ? "on" : ""}`} onClick={() => setCk(ck.map((x) => (x.id === c.id ? { ...x, hecha: !x.hecha } : x)))} aria-label={c.hecha ? "Desmarcar" : "Marcar"}>{c.hecha ? "✓" : ""}</button>
                <span>{c.texto}</span>
                <button className="x" onClick={() => setCk(ck.filter((x) => x.id !== c.id))} aria-label="Quitar paso">×</button>
              </li>
            ))}
          </ul>
          <input className="mini-input" value={nuevoCk} onChange={(e) => setNuevoCk(e.target.value)} placeholder="Añadir paso y pulsar Enter"
            onKeyDown={(e) => { if (e.key === "Enter" && nuevoCk.trim()) { setCk([...ck, { id: Date.now().toString(36), texto: nuevoCk.trim(), hecha: false }]); setNuevoCk(""); } }} />
        </div>

        <div className="campo-t bloque"><span>Comentarios</span>
          {coms === null ? <p className="empty">Cargando…</p> : (
            <ul className="comentarios">
              {coms.map((c) => (
                <li key={c.id}><Avatar nombre={c.autor} size={26} /><div><b>{c.autor || "—"}</b><small>{hace(c.creado_en)}</small><p>{c.texto}</p></div>
                  {c.autor === autor && <button className="x" onClick={async () => { await borrarComentario(c); setComs(coms.filter((x) => x.id !== c.id)); }} aria-label="Borrar comentario">×</button>}</li>
              ))}
            </ul>
          )}
          <div className="nuevo-com">
            <textarea rows={2} value={com} onChange={(e) => setCom(e.target.value)} placeholder="Escribe una actualización o una duda…" />
            <button className="btn-l" disabled={!com.trim()} onClick={async () => { try { const n = await comentar(t.id, autor, com.trim()); setComs([...(coms || []), n]); setCom(""); } catch (e) { avisar("No se ha podido comentar", "mal"); } }}>Comentar</button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// Filtros comunes de tareas
export function useFiltros(inicial = {}) {
  const [f, setF] = useState({ q: "", persona: "", area: "", proyecto: "", estado: "abiertas", ...inicial });
  const aplicar = (tareas, sinEstado = false) => (tareas || []).filter((t) =>
    (!f.q || `${t.titulo} ${t.descripcion || ""}`.toLowerCase().includes(f.q.toLowerCase())) &&
    (!f.persona || (f.persona === "nadie" ? !(t.propietarios || []).length : (t.propietarios || []).includes(f.persona))) &&
    (!f.area || (f.area === "sin" ? !AREA[t.area] : t.area === f.area)) &&
    (!f.proyecto || (f.proyecto === "sin" ? !t.proyecto_id : String(t.proyecto_id) === f.proyecto)) &&
    (sinEstado || f.estado === "todas" || (f.estado === "abiertas" ? t.estado !== "hecha" : t.estado === f.estado)));
  return { f, setF, aplicar };
}

export function BarraFiltros({ f, setF, proyectos, ocultar = [] }) {
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const activos = ["persona", "area", "proyecto"].filter((k) => f[k]).length + (f.estado !== "abiertas" ? 1 : 0) + (f.q ? 1 : 0);
  return (
    <div className="filtros-t">
      <input type="search" value={f.q} onChange={set("q")} placeholder="Buscar…" aria-label="Buscar tareas" />
      {!ocultar.includes("persona") && <select value={f.persona} onChange={set("persona")} aria-label="Responsable"><option value="">Todos</option>{SOCIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}<option value="nadie">Sin responsable</option></select>}
      {!ocultar.includes("area") && <select value={f.area} onChange={set("area")} aria-label="Área"><option value="">Todas las áreas</option>{AREAS_PLAN.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}<option value="sin">Sin área</option></select>}
      {!ocultar.includes("proyecto") && <select value={f.proyecto} onChange={set("proyecto")} aria-label="Proyecto"><option value="">Todos los proyectos</option>{(proyectos || []).map((p) => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}<option value="sin">Sin proyecto</option></select>}
      <select value={f.estado} onChange={set("estado")} aria-label="Estado"><option value="abiertas">Abiertas</option>{ESTADOS_T.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}<option value="todas">Todas</option></select>
      {activos > 0 && <button className="btn-txt" onClick={() => setF({ q: "", persona: "", area: "", proyecto: "", estado: "abiertas", ...Object.fromEntries(ocultar.map((k) => [k, f[k]])) })}>Limpiar</button>}
    </div>
  );
}

export function defaultsDeFiltros(f) {
  const d = {};
  if (f.persona && f.persona !== "nadie") d.propietarios = [f.persona];
  if (f.area && f.area !== "sin") d.area = f.area;
  if (f.proyecto && f.proyecto !== "sin") d.proyecto_id = Number(f.proyecto);
  return d;
}

export const resumenProyecto = (p, tareas) => {
  const ts = (tareas || []).filter((t) => t.proyecto_id === p.id);
  const hechas = ts.filter((t) => t.estado === "hecha").length;
  const hoy = hoyISO();
  return { total: ts.length, hechas, abiertas: ts.length - hechas, atrasadas: ts.filter((t) => atrasada(t, hoy)).length, pct: ts.length ? Math.round((hechas / ts.length) * 100) : 0, proxima: ts.filter((t) => t.estado !== "hecha" && t.fecha_fin).sort((a, b) => a.fecha_fin.localeCompare(b.fecha_fin))[0] };
};

export function useTareaAbierta() {
  const [abierta, setAbierta] = useState(null);
  return [abierta, setAbierta];
}

export { ESTADO_T };
