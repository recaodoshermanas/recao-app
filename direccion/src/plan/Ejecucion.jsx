// Plan → Proyectos y tareas: una sola sección con tres pestañas.
//  · Proyectos: cada proyecto se despliega con sus tareas; se marcan, se añaden y se abren sin cambiar de pantalla.
//  · Por persona: lo de cada socio por urgencia (atrasadas, esta semana, más adelante, sin fecha).
//  · Todas las tareas: la lista y el tablero de siempre, con filtros.
import { useEffect, useState } from "react";
import { Panel, Pestanas, Avatar, fechaCorta, Cargando, ir } from "../ui.jsx";
import { usePlan, cargarPlan, SOCIOS, nombreSocio, hoyISO, atrasada, ordenTareas } from "./datos.js";
import { ChipArea, FilaTarea, AltaRapida, TareaPanel, resumenProyecto } from "./Tareas.jsx";
import { Proyectos, PlanTareas, EditarProyecto } from "./Plan.jsx";
import { COLUMNAS, METRICA, DIAS_GRIS, diasDesde } from "./rumbo.js";

const PESTANAS = [{ id: "proyectos", label: "Proyectos" }, { id: "personas", label: "Por persona" }, { id: "todas", label: "Todas las tareas" }];
const masDias = (f, n) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function PlanProyectos({ user, extra }) {
  const inicial = PESTANAS.some((p) => p.id === extra) ? extra : (() => { try { return localStorage.getItem("plan-pestana") || "proyectos"; } catch (e) { return "proyectos"; } })();
  const [tab, setTab] = useState(inicial);
  useEffect(() => { if (PESTANAS.some((p) => p.id === extra)) setTab(extra); }, [extra]);
  if (extra && /^\d+$/.test(String(extra))) return <Proyectos user={user} extra={extra} />; // ficha de un proyecto
  const cambiar = (t) => { setTab(t); try { localStorage.setItem("plan-pestana", t); } catch (e) { /* sin almacenamiento */ } };
  return (
    <>
      <div className="barra-sec"><Pestanas valor={tab} onChange={cambiar} etiqueta="Vista" opciones={PESTANAS} /></div>
      {tab === "proyectos" && <ListaProyectos user={user} />}
      {tab === "personas" && <PorPersona user={user} />}
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

// ---------- por persona ----------
function PorPersona({ user }) {
  const { tareas, proyectos, nComentarios } = usePlan();
  const [abierta, setAbierta] = useState(null);
  if (!tareas || !proyectos) return <Cargando />;
  const hoy = hoyISO(); const en7 = masDias(hoy, 7);
  const cols = [...SOCIOS.map((s) => ({ id: s.id, label: s.label, sub: s.lleva })), { id: "", label: "Sin responsable", sub: "asígnalas" }];
  return (
    <>
      <div className="ej-personas">
        {cols.map((c) => {
          const ts = tareas.filter((t) => t.estado !== "hecha" && (c.id ? (t.propietarios || []).includes(c.id) : !(t.propietarios || []).length)).sort(ordenTareas);
          if (!c.id && !ts.length) return null;
          const tramos = [
            { k: "atras", label: "Atrasadas", ts: ts.filter((t) => atrasada(t, hoy)), mal: true },
            { k: "semana", label: "Esta semana", ts: ts.filter((t) => t.fecha_fin && t.fecha_fin >= hoy && t.fecha_fin <= en7) },
            { k: "luego", label: "Más adelante", ts: ts.filter((t) => t.fecha_fin && t.fecha_fin > en7) },
            { k: "sin", label: "Sin fecha", ts: ts.filter((t) => !t.fecha_fin) },
          ];
          return (
            <section key={c.id || "nadie"} className="card ej-persona">
              <header>{c.id ? <Avatar nombre={c.label} size={34} /> : <span className="avatar vacio">?</span>}<span><b>{c.label}</b><small>{c.sub}</small></span><span className="rb-n">{ts.length}</span></header>
              {tramos.filter((x) => x.ts.length).map((x) => (
                <div key={x.k} className={`ej-tramo ${x.mal ? "mal" : ""}`}>
                  <h4>{x.label} <span>{x.ts.length}</span></h4>
                  <ul className="lista-t">{x.ts.map((t) => <FilaTarea key={t.id} t={t} proyectos={proyectos} onAbrir={setAbierta} nCom={nComentarios?.[t.id]} />)}</ul>
                </div>
              ))}
              {!ts.length && <p className="empty">Nada pendiente ✓</p>}
              {c.id && <AltaRapida defaults={{ propietarios: [c.id] }} placeholder={`Tarea para ${c.label}…`} onCreada={(n) => setAbierta(n.id)} />}
            </section>
          );
        })}
      </div>
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

export function ProyectoPanel({ p, user, onClose }) {
  const { tareas, proyectos, nComentarios } = usePlan();
  const [abierta, setAbierta] = useState(null);
  const [editar, setEditar] = useState(false);
  const [verHechas, setVerHechas] = useState(false);
  const vivo = (proyectos || []).find((x) => x.id === p.id) || p; // refresca al guardar
  const ts = (tareas || []).filter((t) => t.proyecto_id === vivo.id).sort(ordenTareas);
  const abiertas = ts.filter((t) => t.estado !== "hecha");
  const hechas = ts.filter((t) => t.estado === "hecha");
  const r = resumenProyecto(vivo, tareas || []);
  const equipo = equipoProyecto(vivo, tareas);
  const met = METRICA[vivo.metrica];
  const col = COLUMNAS.find((c) => c.id === vivo.columna);
  return (
    <>
      <Panel titulo={vivo.nombre} sub={[col ? `Roadmap: ${col.label}` : vivo.permanente ? "Responsabilidad permanente" : "Sin colocar en el roadmap", vivo.fecha_objetivo ? `objetivo ${fechaCorta(vivo.fecha_objetivo)}` : ""].filter(Boolean).join(" · ")} onClose={onClose} ancho="560px"
        pie={<div className="pie-t"><button className="btn-txt" onClick={() => { onClose(); ir(`plan/proyectos/${vivo.id}`); }}>Abrir la ficha completa →</button><button className="btn-p" onClick={() => setEditar(true)}>Editar proyecto</button></div>}>
        <div className="pp-cab">
          <span className="ej-proy-chips"><ChipArea id={vivo.area} />{met ? <span className={`rb-met-chip ${met.principal ? "principal" : ""}`}>↗ {met.label}</span> : <span className="rb-met-chip falta">Sin métrica</span>}</span>
          {vivo.objetivo && <p className="ej-obj"><b>Objetivo:</b> {vivo.objetivo}</p>}
          <div className="pp-gente">
            <div><small>Responsable</small>{vivo.responsable ? <span className="rb-resp"><Avatar nombre={nombreSocio(vivo.responsable)} size={26} />{nombreSocio(vivo.responsable)}</span> : <span className="rb-resp falta">Sin responsable</span>}</div>
            <div><small>Equipo</small>{equipo.length ? <span className="pp-equipo">{equipo.map((x) => <span key={x} className="rb-resp"><Avatar nombre={nombreSocio(x)} size={22} />{nombreSocio(x)}</span>)}</span> : <span className="rb-resp falta">solo el responsable</span>}</div>
          </div>
          <div className="pp-avance"><span className="barra-p"><i style={{ width: `${r.pct}%` }} /></span><small>{r.total ? `${r.hechas} de ${r.total} tareas hechas` : "Todavía sin tareas"}{r.atrasadas ? <em> · {r.atrasadas} atrasadas</em> : ""}</small></div>
        </div>
        <h3 className="pp-h">Tareas</h3>
        {abiertas.length ? <ul className="lista-t">{abiertas.map((t) => <FilaTarea key={t.id} t={t} proyectos={proyectos} onAbrir={setAbierta} nCom={nComentarios?.[t.id]} mostrarProyecto={false} />)}</ul> : <p className="empty">No hay tareas abiertas. Añade la primera: un proyecto avanza a base de tareas.</p>}
        <AltaRapida defaults={{ proyecto_id: vivo.id, area: vivo.area || null, propietarios: vivo.responsable ? [vivo.responsable] : [] }} placeholder="Añadir tarea… (luego le cambias quién la lleva)" onCreada={(n) => setAbierta(n.id)} />
        {hechas.length > 0 && <button className="btn-txt" onClick={() => setVerHechas(!verHechas)}>{verHechas ? "Ocultar" : "Ver"} {hechas.length} hechas</button>}
        {verHechas && <ul className="lista-t">{hechas.map((t) => <FilaTarea key={t.id} t={t} proyectos={proyectos} onAbrir={setAbierta} nCom={nComentarios?.[t.id]} mostrarProyecto={false} />)}</ul>}
      </Panel>
      {abierta && <TareaPanel id={abierta} user={user} onClose={() => setAbierta(null)} />}
      {editar && <EditarProyecto p={vivo} onClose={() => setEditar(false)} onGuardado={() => { setEditar(false); cargarPlan(); }} onBorrado={() => { setEditar(false); onClose(); cargarPlan(); }} />}
    </>
  );
}
