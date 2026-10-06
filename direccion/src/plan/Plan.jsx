// Plan: gestor de proyectos y tareas de dirección.
import { useMemo, useState } from "react";
import { Panel, Pestanas, Avatar, avisar, fechaCorta, Cargando, ir } from "../ui.jsx";
import {
  usePlan, AREAS_PLAN, AREA, SOCIOS, SOCIO, nombreSocio, ESTADOS_P, ESTADO_P, PRIORIDADES, hoyISO, atrasada, ordenTareas,
  crearProyecto, actualizarProyecto, borrarProyecto,
} from "./datos.js";
import {
  ChipArea, Responsables, FilaTarea, AltaRapida, ListaAgrupada, Tablero, TareaPanel, useFiltros, BarraFiltros, defaultsDeFiltros, resumenProyecto,
} from "./Tareas.jsx";

const masDiasISO = (f, n) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// ---------- 1. Resumen ----------
export function PlanResumen({ user }) {
  const { tareas, proyectos, nComentarios } = usePlan();
  const [quien, setQuien] = useState("");
  const [abierta, setAbierta] = useState(null);
  if (!tareas || !proyectos) return <Cargando />;
  const hoy = hoyISO(); const en7 = masDiasISO(hoy, 7); const hace7 = masDiasISO(hoy, -7);
  const mias = tareas.filter((t) => !quien || (t.propietarios || []).includes(quien));
  const abiertas = mias.filter((t) => t.estado !== "hecha");
  const atras = abiertas.filter((t) => atrasada(t, hoy));
  const semana = abiertas.filter((t) => t.fecha_fin && t.fecha_fin >= hoy && t.fecha_fin <= en7);
  const hechas7 = mias.filter((t) => t.estado === "hecha" && String(t.completada_en || "").slice(0, 10) >= hace7);
  const bloqueadas = abiertas.filter((t) => t.estado === "bloqueada");
  const activos = proyectos.filter((p) => p.estado === "activo" && (!quien || p.responsable === quien));
  const sinResp = tareas.filter((t) => t.estado !== "hecha" && !(t.propietarios || []).length);

  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={quien} onChange={setQuien} etiqueta="Ver como" opciones={[{ id: "", label: "Todos" }, ...SOCIOS.map((s) => ({ id: s.id, label: s.label }))]} />
        <div className="acciones"><button className="btn-l" onClick={() => ir("plan/tareas")}>Todas las tareas →</button></div>
      </div>
      <div className="grid sin-margen">
        <div className={`card c3 fkpi2 ${atras.length ? "mal" : ""}`}><h2>Atrasadas</h2><p className="num">{atras.length}</p><p className="sub">con la fecha límite pasada</p></div>
        <div className="card c3 fkpi2"><h2>Esta semana</h2><p className="num">{semana.length}</p><p className="sub">vencen en los próximos 7 días</p></div>
        <div className="card c3 fkpi2"><h2>Abiertas</h2><p className="num">{abiertas.length}</p><p className="sub">{bloqueadas.length ? `${bloqueadas.length} bloqueadas · ` : ""}{abiertas.filter((t) => t.estado === "en_curso").length} en curso</p></div>
        <div className="card c3 fkpi2 ok"><h2>Hechas en 7 días</h2><p className="num">{hechas7.length}</p><p className="sub">{hechas7.length ? "buen ritmo" : "ninguna todavía"}</p></div>
      </div>

      <div className="grid">
        <div className="card c7">
          <h2>Lo urgente</h2>
          <p className="sub">Atrasadas y lo que vence esta semana{quien ? ` · ${nombreSocio(quien)}` : ""}</p>
          {atras.length + semana.length === 0 ? <p className="empty">Nada urgente ✓</p> : (
            <ul className="lista-t">{[...atras, ...semana].sort(ordenTareas).map((t) => <FilaTarea key={t.id} t={t} proyectos={proyectos} onAbrir={setAbierta} nCom={nComentarios?.[t.id]} />)}</ul>
          )}
          <AltaRapida defaults={{ ...(quien ? { propietarios: [quien] } : {}), fecha_fin: hoy }} placeholder="Añadir tarea para hoy…" onCreada={(n) => setAbierta(n.id)} />
        </div>
        <div className="card c5">
          <div className="head"><div><h2>Proyectos en marcha</h2><p className="sub">Avance según tareas hechas</p></div><button className="enlace" onClick={() => ir("plan/proyectos")}>Ver todos →</button></div>
          {activos.length === 0 ? <p className="empty">No hay proyectos en marcha. <button className="btn-txt" onClick={() => ir("plan/proyectos")}>Crear uno</button></p> : (
            <ul className="proy-mini">
              {activos.map((p) => { const r = resumenProyecto(p, tareas); return (
                <li key={p.id}><button onClick={() => ir(`plan/proyectos/${p.id}`)}>
                  <span className="pm-cab"><b>{p.nombre}</b>{p.responsable && <Avatar nombre={nombreSocio(p.responsable)} size={20} />}</span>
                  <span className="barra-p"><i style={{ width: `${r.pct}%` }} /></span>
                  <span className="pm-pie">{r.hechas}/{r.total} tareas{r.atrasadas ? <em> · {r.atrasadas} atrasadas</em> : ""}{p.fecha_objetivo ? ` · objetivo ${fechaCorta(p.fecha_objetivo)}` : ""}</span>
                </button></li>
              ); })}
            </ul>
          )}
        </div>
      </div>

      {!quien && (
        <div className="grid">
          <div className="card c12">
            <h2>Carga por persona</h2>
            <p className="sub">Tareas abiertas de cada socio</p>
            <div className="carga">
              {SOCIOS.map((s) => {
                const ts = tareas.filter((t) => t.estado !== "hecha" && (t.propietarios || []).includes(s.id));
                const at = ts.filter((t) => atrasada(t, hoy)).length;
                return (
                  <button key={s.id} className="carga-p" onClick={() => setQuien(s.id)}>
                    <Avatar nombre={s.label} size={38} />
                    <span className="cp-n"><b>{s.label}</b><small>{s.lleva}</small></span>
                    <span className="cp-v"><b>{ts.length}</b><small>{at ? <em>{at} atrasadas</em> : "al día"}</small></span>
                  </button>
                );
              })}
              {sinResp.length > 0 && <button className="carga-p nadie" onClick={() => ir("plan/tareas")}><span className="avatar vacio">?</span><span className="cp-n"><b>Sin responsable</b><small>asígnalas</small></span><span className="cp-v"><b>{sinResp.length}</b></span></button>}
            </div>
          </div>
        </div>
      )}
      {abierta && <TareaPanel id={abierta} user={user} onClose={() => setAbierta(null)} />}
    </>
  );
}

// ---------- 2. Proyectos ----------
export function Proyectos({ user, extra }) {
  const { tareas, proyectos } = usePlan();
  const [filtro, setFiltro] = useState("activo");
  const [area, setArea] = useState("");
  const [editar, setEditar] = useState(null); // {} nuevo o proyecto
  if (!tareas || !proyectos) return <Cargando />;
  if (extra) {
    const p = proyectos.find((x) => String(x.id) === String(extra));
    if (!p) return <div className="card"><p className="empty">Este proyecto no existe. <button className="btn-txt" onClick={() => ir("plan/proyectos")}>Volver</button></p></div>;
    return <ProyectoDetalle p={p} tareas={tareas} user={user} />;
  }
  const lista = proyectos.filter((p) => (filtro === "todos" || p.estado === filtro) && (!area || p.area === area));
  const cuenta = (e) => proyectos.filter((p) => p.estado === e).length;
  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={filtro} onChange={setFiltro} etiqueta="Estado" opciones={[...ESTADOS_P.map((e) => ({ id: e.id, label: e.label, n: cuenta(e.id) })), { id: "todos", label: "Todos" }]} />
        <div className="acciones">
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área"><option value="">Todas las áreas</option>{AREAS_PLAN.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
          <button className="btn-p" onClick={() => setEditar({})}>+ Proyecto</button>
        </div>
      </div>
      {lista.length === 0 ? (
        <div className="card vacio-proy">
          <h2>{proyectos.length ? "No hay proyectos con este filtro" : "Todavía no hay proyectos"}</h2>
          <p className="sub">Un proyecto agrupa tareas con un objetivo y una fecha: el inventario, la ampliación del almacén, la carta de bocatas…</p>
          <button className="btn-p" onClick={() => setEditar({})}>Crear el primero</button>
        </div>
      ) : (
        <div className="proy-grid">
          {lista.map((p) => { const r = resumenProyecto(p, tareas); return (
            <button key={p.id} className="card proy-card" onClick={() => ir(`plan/proyectos/${p.id}`)}>
              <span className="pc-cab"><ChipArea id={p.area} /><span className={`est-p e-${p.estado}`}>{ESTADO_P[p.estado]?.label}</span></span>
              <h3>{p.nombre}</h3>
              {p.objetivo && <p className="pc-obj">{p.objetivo}</p>}
              <span className="barra-p"><i style={{ width: `${r.pct}%` }} /></span>
              <span className="pc-pie">
                <span>{r.total ? `${r.pct} % · ${r.hechas}/${r.total} tareas` : "Sin tareas"}{r.atrasadas ? <em> · {r.atrasadas} atrasadas</em> : ""}</span>
                <span className="pc-der">{p.fecha_objetivo && <span className={`f-tarea ${p.fecha_objetivo < hoyISO() && p.estado !== "terminado" ? "mal" : ""}`}>{fechaCorta(p.fecha_objetivo)}</span>}{p.responsable && <Avatar nombre={nombreSocio(p.responsable)} size={22} />}</span>
              </span>
            </button>
          ); })}
        </div>
      )}
      {editar && <EditarProyecto p={editar} onClose={() => setEditar(null)} onGuardado={(n) => { setEditar(null); if (n && !editar.id) ir(`plan/proyectos/${n.id}`); }} />}
    </>
  );
}

function ProyectoDetalle({ p, tareas, user }) {
  const { nComentarios } = usePlan();
  const [vista, setVista] = useState("lista");
  const [abierta, setAbierta] = useState(null);
  const [editar, setEditar] = useState(false);
  const [verHechas, setVerHechas] = useState(false);
  const r = resumenProyecto(p, tareas);
  const ts = tareas.filter((t) => t.proyecto_id === p.id);
  const visibles = verHechas ? ts : ts.filter((t) => t.estado !== "hecha");
  const personas = [...new Set(ts.flatMap((t) => t.propietarios || []))];
  return (
    <>
      <button className="volver" onClick={() => ir("plan/proyectos")}>← Proyectos</button>
      <section className="proy-hero">
        <div className="ph-t">
          <span className="pc-cab"><ChipArea id={p.area} /><span className={`est-p e-${p.estado}`}>{ESTADO_P[p.estado]?.label}</span>{p.prioridad === "alta" && <span className="est-p e-alta">Prioridad alta</span>}</span>
          <h1>{p.nombre}</h1>
          {p.objetivo && <p className="ph-obj"><b>Objetivo:</b> {p.objetivo}</p>}
          {p.descripcion && <p className="ph-desc">{p.descripcion}</p>}
        </div>
        <dl className="ph-dl">
          <div><dt>Avance</dt><dd>{r.pct} %</dd><span className="barra-p"><i style={{ width: `${r.pct}%` }} /></span></div>
          <div><dt>Tareas</dt><dd>{r.hechas}/{r.total}</dd><span>{r.atrasadas ? <em>{r.atrasadas} atrasadas</em> : "ninguna atrasada"}</span></div>
          <div><dt>Fecha objetivo</dt><dd>{p.fecha_objetivo ? fechaCorta(p.fecha_objetivo) : "—"}</dd><span>{p.fecha_inicio ? `desde ${fechaCorta(p.fecha_inicio)}` : ""}</span></div>
          <div><dt>Responsable</dt><dd className="ph-resp">{p.responsable ? <><Avatar nombre={nombreSocio(p.responsable)} size={26} />{nombreSocio(p.responsable)}</> : "—"}</dd><span>{personas.length ? `con ${personas.map(nombreSocio).join(", ")}` : ""}</span></div>
        </dl>
        <div className="ph-acc">
          <button className="btn-l" onClick={() => setEditar(true)}>Editar proyecto</button>
          {p.estado !== "terminado" && r.total > 0 && r.abiertas === 0 && <button className="btn-p" onClick={() => actualizarProyecto(p.id, { estado: "terminado" }).then(() => avisar("Proyecto terminado 🎉"))}>Marcar como terminado</button>}
        </div>
      </section>

      <div className="card">
        <div className="head">
          <div><h2>Tareas del proyecto</h2></div>
          <div className="acciones">
            <label className="chk"><input type="checkbox" checked={verHechas} onChange={(e) => setVerHechas(e.target.checked)} /> Ver hechas</label>
            <Pestanas valor={vista} onChange={setVista} etiqueta="Vista" opciones={[{ id: "lista", label: "Lista" }, { id: "tablero", label: "Tablero" }]} />
          </div>
        </div>
        <AltaRapida defaults={{ proyecto_id: p.id, area: p.area || null, propietarios: p.responsable ? [p.responsable] : [] }} onCreada={(n) => setAbierta(n.id)} />
        {vista === "lista"
          ? <ListaAgrupada tareas={visibles} por="fecha" proyectos={[p]} onAbrir={setAbierta} nComentarios={nComentarios} mostrarProyecto={false} />
          : <Tablero tareas={ts} proyectos={[]} onAbrir={setAbierta} nComentarios={nComentarios} />}
      </div>
      {abierta && <TareaPanel id={abierta} user={user} onClose={() => setAbierta(null)} />}
      {editar && <EditarProyecto p={p} onClose={() => setEditar(false)} onGuardado={() => setEditar(false)} onBorrado={() => ir("plan/proyectos")} />}
    </>
  );
}

function EditarProyecto({ p, onClose, onGuardado, onBorrado }) {
  const nuevo = !p.id;
  const [f, setF] = useState({ nombre: p.nombre || "", objetivo: p.objetivo || "", descripcion: p.descripcion || "", area: p.area || "", responsable: p.responsable || "", estado: p.estado || "activo", prioridad: p.prioridad || "media", fecha_inicio: p.fecha_inicio || "", fecha_objetivo: p.fecha_objetivo || "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = async () => {
    setBusy(true);
    const datos = { ...f, nombre: f.nombre.trim(), objetivo: f.objetivo.trim() || null, descripcion: f.descripcion.trim() || null, area: f.area || null, responsable: f.responsable || null, fecha_inicio: f.fecha_inicio || null, fecha_objetivo: f.fecha_objetivo || null };
    try {
      let n = null;
      if (nuevo) n = await crearProyecto(datos); else await actualizarProyecto(p.id, datos);
      avisar(nuevo ? "Proyecto creado" : "Proyecto guardado"); onGuardado(n);
    } catch (e) { avisar("No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo={nuevo ? "Nuevo proyecto" : "Editar proyecto"} onClose={onClose} ancho="560px"
      pie={<div className="pie-t">{!nuevo ? <button className="btn-txt peligro" onClick={async () => { if (window.confirm("¿Eliminar el proyecto? Sus tareas se quedan, sin proyecto.")) { await borrarProyecto(p.id); avisar("Proyecto eliminado"); onClose(); onBorrado && onBorrado(); } }}>Eliminar</button> : <span />}<button className="btn-p" disabled={!f.nombre.trim() || busy} onClick={guardar}>{nuevo ? "Crear proyecto" : "Guardar"}</button></div>}>
      <label className="campo">Nombre<input autoFocus value={f.nombre} onChange={set("nombre")} placeholder="Ej: Inventario completo en Epos" /></label>
      <label className="campo">Objetivo<input value={f.objetivo} onChange={set("objetivo")} placeholder="Qué tiene que estar conseguido al terminar" /></label>
      <div className="fila-campos">
        <label className="campo">Área<select value={f.area} onChange={set("area")}><option value="">Sin área</option>{AREAS_PLAN.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
        <label className="campo">Responsable<select value={f.responsable} onChange={set("responsable")}><option value="">Sin asignar</option>{SOCIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      </div>
      <div className="fila-campos">
        <label className="campo">Estado<select value={f.estado} onChange={set("estado")}>{ESTADOS_P.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
        <label className="campo">Prioridad<select value={f.prioridad} onChange={set("prioridad")}>{PRIORIDADES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
      </div>
      <div className="fila-campos">
        <label className="campo">Empieza<input type="date" value={f.fecha_inicio} onChange={set("fecha_inicio")} /></label>
        <label className="campo">Fecha objetivo<input type="date" value={f.fecha_objetivo} onChange={set("fecha_objetivo")} /></label>
      </div>
      <label className="campo">Descripción<textarea rows={4} value={f.descripcion} onChange={set("descripcion")} placeholder="Contexto, decisiones, enlaces…" /></label>
    </Panel>
  );
}

// ---------- 3. Tareas ----------
export function PlanTareas({ user }) {
  const { tareas, proyectos, nComentarios } = usePlan();
  const { f, setF, aplicar } = useFiltros();
  const [vista, setVista] = useState(() => { try { return localStorage.getItem("plan-vista") || "lista"; } catch (e) { return "lista"; } });
  const [por, setPor] = useState("fecha");
  const [abierta, setAbierta] = useState(null);
  const cambiarVista = (v) => { setVista(v); try { localStorage.setItem("plan-vista", v); } catch (e) { /* sin almacenamiento */ } };
  if (!tareas || !proyectos) return <Cargando />;
  const filtradas = aplicar(tareas);
  // en el tablero se ven todas las columnas; de las hechas, solo las de las dos últimas semanas
  const hace14 = masDiasISO(hoyISO(), -14);
  const paraTablero = aplicar(tareas, true).filter((t) => t.estado !== "hecha" || String(t.completada_en || t.actualizado_en || "").slice(0, 10) >= hace14);
  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={vista} onChange={cambiarVista} etiqueta="Vista" opciones={[{ id: "lista", label: "Lista" }, { id: "tablero", label: "Tablero" }]} />
        {vista === "lista" && <label className="agrupar">Agrupar por<select value={por} onChange={(e) => setPor(e.target.value)}><option value="fecha">Fecha</option><option value="proyecto">Proyecto</option><option value="area">Área</option><option value="persona">Persona</option></select></label>}
      </div>
      <BarraFiltros f={f} setF={setF} proyectos={proyectos} />
      <div className="card">
        <AltaRapida defaults={defaultsDeFiltros(f)} onCreada={(n) => setAbierta(n.id)} />
        {vista === "lista"
          ? <ListaAgrupada tareas={filtradas} por={por} proyectos={proyectos} onAbrir={setAbierta} nComentarios={nComentarios} />
          : <Tablero tareas={paraTablero} proyectos={proyectos} onAbrir={setAbierta} nComentarios={nComentarios} />}
      </div>
      {abierta && <TareaPanel id={abierta} user={user} onClose={() => setAbierta(null)} />}
    </>
  );
}

// ---------- 4. Calendario ----------
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function PlanCalendario({ user }) {
  const { tareas, proyectos } = usePlan();
  const hoy = hoyISO();
  const [vista, setVista] = useState("mes");
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [abierta, setAbierta] = useState(null);
  const [persona, setPersona] = useState("");
  const celdas = useMemo(() => {
    const [a, m] = mes.split("-").map(Number);
    const primero = new Date(a, m - 1, 1); const off = (primero.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(a, m - 1, 1 - off + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  }, [mes]);
  if (!tareas || !proyectos) return <Cargando />;
  const ts = tareas.filter((t) => !persona || (t.propietarios || []).includes(persona));
  const porDia = {}; ts.forEach((t) => { if (t.fecha_fin) (porDia[t.fecha_fin] ||= []).push(t); });
  const hitos = {}; proyectos.forEach((p) => { if (p.fecha_objetivo && p.estado !== "terminado") (hitos[p.fecha_objetivo] ||= []).push(p); });
  const mover = (k) => { const [a, m] = mes.split("-").map(Number); const d = new Date(a, m - 1 + k, 1); setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const [a, m] = mes.split("-").map(Number);
  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={vista} onChange={setVista} etiqueta="Vista" opciones={[{ id: "mes", label: "Mes" }, { id: "cronograma", label: "Cronograma" }]} />
        <div className="acciones"><select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Persona"><option value="">Todos</option>{SOCIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
      </div>
      {vista === "mes" ? (
        <div className="card">
          <div className="head"><h2>{MESES[m - 1]} {a}</h2><div className="nav-sem"><button className="btn-l" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>{mes !== hoy.slice(0, 7) && <button className="btn-l" onClick={() => setMes(hoy.slice(0, 7))}>Hoy</button>}<button className="btn-l" onClick={() => mover(1)} aria-label="Mes siguiente">›</button></div></div>
          <div className="cal">
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {celdas.map((f) => (
              <div key={f} className={`cal-dia ${f.slice(0, 7) !== mes ? "fuera" : ""} ${f === hoy ? "hoy" : ""}`}>
                <span className="cal-n">{Number(f.slice(8))}</span>
                {(hitos[f] || []).map((p) => <button key={`p${p.id}`} className="cal-hito" onClick={() => ir(`plan/proyectos/${p.id}`)}>◆ {p.nombre}</button>)}
                {(porDia[f] || []).sort(ordenTareas).slice(0, 4).map((t) => (
                  <button key={t.id} className={`cal-t e-${t.estado} ${atrasada(t, hoy) ? "mal" : ""}`} onClick={() => setAbierta(t.id)} title={t.titulo}>{t.titulo}</button>
                ))}
                {(porDia[f] || []).length > 4 && <span className="cal-mas">+{porDia[f].length - 4}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : <Cronograma proyectos={proyectos} tareas={ts} onAbrir={setAbierta} />}
      {abierta && <TareaPanel id={abierta} user={user} onClose={() => setAbierta(null)} />}
    </>
  );
}

function Cronograma({ proyectos, tareas, onAbrir }) {
  const hoy = hoyISO();
  const conFecha = tareas.filter((t) => t.fecha_fin || t.fecha_inicio);
  const filasP = proyectos.filter((p) => p.estado !== "terminado").map((p) => {
    const ts = conFecha.filter((t) => t.proyecto_id === p.id);
    const fechas = [p.fecha_inicio, p.fecha_objetivo, ...ts.flatMap((t) => [t.fecha_inicio, t.fecha_fin])].filter(Boolean).sort();
    return { p, ts, ini: fechas[0], fin: fechas[fechas.length - 1] };
  }).filter((x) => x.ini);
  const sueltas = conFecha.filter((t) => !t.proyecto_id && t.estado !== "hecha");
  const todas = [...filasP.flatMap((x) => [x.ini, x.fin]), ...sueltas.flatMap((t) => [t.fecha_inicio, t.fecha_fin]), hoy].filter(Boolean).sort();
  if (!todas.length) return <div className="card"><p className="empty">Ponle fechas a proyectos o tareas para verlos en el cronograma.</p></div>;
  const ini = masDiasISO(todas[0], -3); const fin = masDiasISO(todas[todas.length - 1], 5);
  const dias = Math.round((new Date(`${fin}T12:00:00`) - new Date(`${ini}T12:00:00`)) / 86400000) + 1;
  const PX = 22;
  const x = (f) => Math.round((new Date(`${f}T12:00:00`) - new Date(`${ini}T12:00:00`)) / 86400000) * PX;
  const semanas = []; for (let i = 0; i < dias; i++) { const f = masDiasISO(ini, i); if (new Date(`${f}T12:00:00`).getDay() === 1) semanas.push(f); }
  const Barra = ({ a, b, clase, texto, onClick, titulo }) => {
    const s = a || b, e = b || a; const l = x(s < e ? s : e), w = Math.max(PX, x(s < e ? e : s) - l + PX);
    return <button className={`gantt-barra ${clase}`} style={{ left: l, width: w }} onClick={onClick} title={titulo}>{texto}</button>;
  };
  return (
    <div className="card">
      <h2>Cronograma</h2>
      <p className="sub">Proyectos (barra oscura) y sus tareas con fecha. La línea amarilla es hoy.</p>
      <div className="gantt">
        <div className="gantt-izq">
          <div className="gantt-cab" />
          {filasP.map(({ p, ts }) => [<div key={`p${p.id}`} className="gantt-et proy"><button onClick={() => ir(`plan/proyectos/${p.id}`)}>◆ {p.nombre}</button></div>, ...ts.map((t) => <div key={t.id} className="gantt-et"><button onClick={() => onAbrir(t.id)}>{t.titulo}</button></div>)])}
          {sueltas.length > 0 && <div className="gantt-et proy"><span>Sin proyecto</span></div>}
          {sueltas.map((t) => <div key={t.id} className="gantt-et"><button onClick={() => onAbrir(t.id)}>{t.titulo}</button></div>)}
        </div>
        <div className="gantt-der">
          <div className="gantt-lienzo" style={{ width: dias * PX }}>
            <div className="gantt-cab">{semanas.map((f) => <span key={f} style={{ left: x(f) }}>{fechaCorta(f).split(" ").slice(1).join(" ")}</span>)}</div>
            <i className="gantt-hoy" style={{ left: x(hoy) + PX / 2 }} />
            {filasP.map(({ p, ts, ini: a, fin: b }) => [
              <div key={`p${p.id}`} className="gantt-fila"><Barra a={a} b={p.fecha_objetivo || b} clase="proy" texto={p.nombre} onClick={() => ir(`plan/proyectos/${p.id}`)} titulo={p.nombre} /></div>,
              ...ts.map((t) => <div key={t.id} className="gantt-fila"><Barra a={t.fecha_inicio} b={t.fecha_fin} clase={`e-${t.estado} ${atrasada(t, hoy) ? "mal" : ""}`} texto={(t.propietarios || []).map((s) => SOCIO[s]?.label?.[0] || s[0]).join(" ")} onClick={() => onAbrir(t.id)} titulo={t.titulo} /></div>),
            ])}
            {sueltas.length > 0 && <div className="gantt-fila" />}
            {sueltas.map((t) => <div key={t.id} className="gantt-fila"><Barra a={t.fecha_inicio} b={t.fecha_fin} clase={`e-${t.estado} ${atrasada(t, hoy) ? "mal" : ""}`} texto={(t.propietarios || []).map((s) => SOCIO[s]?.label?.[0] || s[0]).join(" ")} onClick={() => onAbrir(t.id)} titulo={t.titulo} /></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export { Responsables, AREA };
