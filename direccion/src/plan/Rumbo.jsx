// Plan → Rumbo: las dos métricas del trimestre arriba y, debajo, el roadmap en tres columnas
// (Ahora / Siguiente / Más adelante). Cada tarjeta dice qué métrica mueve, quién la lleva y su siguiente paso.
import { useState } from "react";
import { Panel, Pestanas, Avatar, avisar, fechaCorta, Cargando, ir } from "../ui.jsx";
import { eur, pct, num, nombreMes } from "../fmt.js";
import { usePlan, cargarPlan, SOCIOS, nombreSocio, hoyISO, atrasada, actualizarProyecto, AREA } from "./datos.js";
import { ChipArea, resumenProyecto } from "./Tareas.jsx";
import { EditarProyecto } from "./Plan.jsx";
import { ProyectoPanel, equipoProyecto, proximaTarea, pedirFiltroFoco } from "./Ejecucion.jsx";
import { COLUMNAS, MAX_AHORA, DIAS_GRIS, METRICA, useMetricas, guardarConfig, diasDesde } from "./rumbo.js";
import "./rumbo.css";
import { TiraMetricas, Bola } from "./Lista.jsx";

// ---------- gráfico mínimo de evolución semanal ----------
function Linea({ valores, suelo, etiqueta, fmt }) {
  const vs = valores.filter((v) => v != null);
  if (vs.length < 2) return null;
  const W = 280, H = 60, P = 4;
  const min = Math.min(...vs, suelo ?? Infinity), max = Math.max(...vs, suelo ?? -Infinity);
  const y = (v) => H - P - ((v - min) / ((max - min) || 1)) * (H - P * 2);
  const x = (i) => P + (i / (valores.length - 1)) * (W - P * 2);
  const pts = valores.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");
  const ult = valores.length - 1;
  return (
    <svg className="rb-linea" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${etiqueta}: de ${fmt(vs[0])} a ${fmt(vs[vs.length - 1])} en ${valores.length} semanas`}>
      {suelo != null && <line x1={P} x2={W - P} y1={y(suelo)} y2={y(suelo)} className="rb-suelo" />}
      <polyline points={pts} fill="none" />
      {valores[ult] != null && <circle cx={x(ult)} cy={y(valores[ult])} r="3.5" />}
    </svg>
  );
}

// ---------- las dos métricas ----------
export function BloqueMetricas({ compacto = false, onAjustar }) {
  const { m, error } = useMetricas();
  if (error) return <div className="card"><p className="empty">No se han podido cargar las métricas.</p></div>;
  if (!m) return <div className="rb-metricas"><div className="card rb-met cargando" /><div className="card rb-met cargando" /></div>;
  const suelo = Number(m.config?.plan_margen_suelo) || 37;
  const objetivo = Number(m.config?.plan_objetivo_dia) || null;
  const mes = m.mes || {}, ant = m.anterior || {};
  const mesN = nombreMes(m.hoy), antN = ant.dias ? nombreMes(new Date(new Date(`${m.hoy}T12:00:00`).setDate(0)).toISOString()) : "";
  const dFact = mes.por_dia && ant.por_dia ? ((mes.por_dia - ant.por_dia) / ant.por_dia) * 100 : null;
  const dMarg = mes.margen_pct != null && ant.margen_pct != null ? mes.margen_pct - ant.margen_pct : null;
  const sobreSuelo = mes.margen_pct != null ? mes.margen_pct >= suelo : null;
  const semanas = (m.semanas || []).filter((s) => s.dias >= 5); // la semana en curso, a medias, no cuenta
  const clase = (d) => (d == null ? "flat" : d > 0.05 ? "up" : d < -0.05 ? "down" : "flat");
  return (
    <div className={`rb-metricas ${compacto ? "compacto" : ""}`}>
      <section className="card rb-met">
        <div className="rb-met-cab"><h2>Facturación</h2><span className="rb-tag">€ por día · {mesN}</span></div>
        <p className="num">{mes.por_dia != null ? eur(mes.por_dia) : "–"}</p>
        <p className={`delta ${clase(dFact)}`}>{dFact == null ? "—" : `${dFact > 0 ? "+" : ""}${num(dFact, 1)} %`}<span> frente a {antN || "el mes anterior"} ({ant.por_dia != null ? eur(ant.por_dia) : "–"}/día)</span></p>
        {!compacto && <Linea valores={semanas.map((s) => s.por_dia)} etiqueta="Facturación por día, por semanas" fmt={(v) => eur(v)} />}
        <p className="rb-pie">{mes.dias || 0} días cerrados · hoy llevamos {eur(m.hoy_venta || 0)}{objetivo ? <> · objetivo {eur(objetivo)}/día ({num((100 * (mes.por_dia || 0)) / objetivo, 0)} %)</> : null}</p>
      </section>
      <section className={`card rb-met ${sobreSuelo === false ? "mal" : ""}`}>
        <div className="rb-met-cab"><h2>Margen bruto</h2><span className={`rb-tag ${sobreSuelo === false ? "mal" : sobreSuelo ? "ok" : ""}`}>{sobreSuelo == null ? `Suelo ${pct(suelo, 0)}` : sobreSuelo ? `Por encima del suelo (${pct(suelo, 0)})` : `Por debajo del suelo (${pct(suelo, 0)})`}</span></div>
        <p className="num">{mes.margen_pct != null ? pct(mes.margen_pct) : "–"}</p>
        <p className={`delta ${clase(dMarg)}`}>{dMarg == null ? "—" : `${dMarg > 0 ? "+" : ""}${num(dMarg, 1)} puntos`}<span> frente a {antN || "el mes anterior"} ({ant.margen_pct != null ? pct(ant.margen_pct) : "–"})</span></p>
        {!compacto && <Linea valores={semanas.map((s) => s.margen_pct)} suelo={suelo} etiqueta="Margen bruto por semanas" fmt={(v) => pct(v)} />}
        <p className="rb-pie">{mes.margen != null ? `${eur(mes.margen)} de margen en ${mesN}` : ""}{onAjustar && <> · <button className="btn-txt" onClick={onAjustar}>Ajustar suelo y horizonte</button></>}</p>
      </section>
    </div>
  );
}

function AjustesRumbo({ onClose }) {
  const { m } = useMetricas();
  const c = m?.config || {};
  const [f, setF] = useState({ suelo: c.plan_margen_suelo ?? "37", horizonte: c.plan_horizonte ?? "", objetivo: c.plan_objetivo_dia ?? "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Panel titulo="Métricas del trimestre" sub="Facturación y margen: si chocan, manda la facturación mientras el margen no baje del suelo." onClose={onClose} ancho="480px"
      pie={<div className="pie-t"><span /><button className="btn-p" disabled={busy} onClick={async () => { setBusy(true); try { await guardarConfig(f); avisar("Guardado"); onClose(); } catch (e) { avisar("No se ha podido guardar", "mal"); } setBusy(false); }}>Guardar</button></div>}>
      <label className="campo">Suelo de margen (%)<input type="number" step="0.5" min="0" max="100" value={f.suelo} onChange={set("suelo")} /></label>
      <label className="campo">Horizonte (fin del trimestre)<input type="date" value={f.horizonte} onChange={set("horizonte")} /></label>
      <label className="campo">Objetivo de facturación (€/día, opcional)<input type="number" step="50" min="0" value={f.objetivo} onChange={set("objetivo")} placeholder="Sin objetivo" /></label>
    </Panel>
  );
}

// ---------- tarjeta del roadmap ----------
function Tarjeta({ p, tareas, onEditar, onMover, arrastrando, setArrastrando, hoy }) {
  const r = resumenProyecto(p, tareas);
  const dias = diasDesde(p.actualizado_en);
  const gris = dias >= DIAS_GRIS;
  const pasoTarde = p.siguiente_paso_fecha && p.siguiente_paso_fecha < hoy;
  const objTarde = p.fecha_objetivo && p.fecha_objetivo < hoy;
  const met = METRICA[p.metrica];
  const prox = proximaTarea(p, tareas);
  const enCurso = tareas.filter((t) => t.proyecto_id === p.id && t.estado === "en_curso").length;
  const bloq = tareas.filter((t) => t.proyecto_id === p.id && t.estado === "bloqueada").length;
  const equipo = equipoProyecto(p, tareas);
  const i = COLUMNAS.findIndex((c) => c.id === p.columna);
  const color = AREA[p.area]?.color || "#8A9095";
  return (
    <li className={`rb-card v2 ${gris ? "gris" : ""} ${arrastrando === p.id ? "arrastrando" : ""}`} style={{ "--a": color }} draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(p.id)); e.dataTransfer.effectAllowed = "move"; setArrastrando(p.id); }}
      onDragEnd={() => setArrastrando(null)}>
      <button className="rb-card-cuerpo" onClick={() => onEditar(p)}>
        <span className="rb-card-cab">
          {p.area && <span className="rb-area">{AREA[p.area]?.label}</span>}
          {met ? <span className="rb-metv2">↗ {met.corta}</span> : <span className="rb-metv2 falta">sin métrica</span>}
          <span className="ls-esp" />
          {gris && <span className="rb-gris">{dias} días sin tocar</span>}
        </span>
        <b className="rb-card-tit">{p.nombre}</b>
        <span className="rb-barra"><i><b style={{ width: `${r.pct}%` }} /></i><small>{r.hechas}/{r.total}</small></span>
        {(enCurso || bloq || r.atrasadas || objTarde) ? (
          <span className="rb-cuentas">
            {enCurso > 0 && <span className="c-curso">{enCurso} en curso</span>}
            {bloq > 0 && <span className="c-bloq">{bloq} bloqueada{bloq > 1 ? "s" : ""}</span>}
            {r.atrasadas > 0 && <span className="c-venc">{r.atrasadas} vencida{r.atrasadas > 1 ? "s" : ""}</span>}
            {objTarde && <span className="c-venc">objetivo vencido</span>}
          </span>
        ) : null}
        <span className="rb-prox">
          <i>{prox ? "Próxima tarea" : p.siguiente_paso ? "Siguiente paso" : "Próxima tarea"}</i>
          {prox ? <><b>{prox.titulo}</b>{prox.fecha_fin && <em className={prox.fecha_fin < hoy ? "mal" : ""}> {fechaCorta(prox.fecha_fin)}</em>}</>
            : p.siguiente_paso ? <><b>{p.siguiente_paso}</b>{p.siguiente_paso_fecha && <em className={pasoTarde ? "mal" : ""}> {fechaCorta(p.siguiente_paso_fecha)}</em>}</>
            : <span className="falta">Sin tareas todavía</span>}
        </span>
        <span className="rb-card-pie">
          {p.responsable ? <span className="rb-resp" title="Responsable"><Bola id={p.responsable} size={28} />{nombreSocio(p.responsable)}</span> : <span className="rb-resp falta">Sin responsable</span>}
          {equipo.length > 0 && <span className="rb-equipo" title={`Equipo: ${equipo.map(nombreSocio).join(", ")}`}>{equipo.map((x) => <Bola key={x} id={x} size={24} />)}</span>}
        </span>
      </button>
      <span className="rb-mover">
        <button disabled={i <= 0} onClick={() => onMover(p, COLUMNAS[i - 1]?.id)} aria-label={`Mover «${p.nombre}» a ${COLUMNAS[i - 1]?.label || ""}`}>←</button>
        {gris && <button className="rb-sigue" onClick={() => onMover(p, p.columna, true)} title="Marcarla como revisada sin cambiar nada">Sigue igual</button>}
        <button disabled={i >= COLUMNAS.length - 1} onClick={() => onMover(p, COLUMNAS[i + 1]?.id)} aria-label={`Mover «${p.nombre}» a ${COLUMNAS[i + 1]?.label || ""}`}>→</button>
      </span>
    </li>
  );
}

// ---------- el tablero en tres columnas ----------
export function TableroRumbo({ quien = "", soloAhora = false, compacto = false, user }) {
  const { tareas, proyectos } = usePlan();
  const [editar, setEditar] = useState(null);
  const [arrastrando, setArrastrando] = useState(null);
  const [encima, setEncima] = useState(null);
  const hoy = hoyISO();
  if (!tareas || !proyectos) return <Cargando />;
  const vivos = proyectos.filter((p) => p.estado !== "terminado");
  const mios = vivos.filter((p) => !quien || p.responsable === quien);
  const enCol = (c) => mios.filter((p) => !p.permanente && p.columna === c).sort((a, b) => (a.orden_col ?? 0) - (b.orden_col ?? 0) || a.id - b.id);
  const sinColocar = mios.filter((p) => !p.permanente && !p.columna);
  const permanentes = mios.filter((p) => p.permanente);

  const mover = async (p, col, soloRevisar = false) => {
    if (!col) return;
    const patch = soloRevisar ? { columna: p.columna } : { columna: col };
    if (!soloRevisar && col === "ahora" && p.estado !== "activo") patch.estado = "activo";
    if (!soloRevisar && p.columna === "ahora" && col !== "ahora" && p.estado === "activo") patch.estado = "idea";
    try {
      await actualizarProyecto(p.id, patch);
      await cargarPlan(); // trae la fecha de actualización nueva
      if (soloRevisar) avisar("Revisada"); else {
        const enAhora = vivos.filter((x) => x.responsable && x.responsable === p.responsable && !x.permanente && (x.id === p.id ? col : x.columna) === "ahora").length;
        avisar(col === "ahora" && p.responsable && enAhora > MAX_AHORA ? `${nombreSocio(p.responsable)} tiene ${enAhora} en «Ahora» (máximo ${MAX_AHORA})` : `Movida a «${COLUMNAS.find((c) => c.id === col).label}»`, col === "ahora" && enAhora > MAX_AHORA ? "mal" : "ok");
      }
    } catch (e) { avisar("No se ha podido mover", "mal"); }
  };
  const soltar = (col) => (e) => {
    e.preventDefault(); setEncima(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    const p = proyectos.find((x) => x.id === id);
    if (p && p.columna !== col) mover(p, col);
  };
  const cols = soloAhora ? COLUMNAS.slice(0, 1) : COLUMNAS;

  return (
    <>
      <div className={`rb-tablero ${soloAhora ? "uno" : ""} ${compacto ? "compacto" : ""}`}>
        {cols.map((c) => {
          const lista = enCol(c.id);
          return (
            <section key={c.id} className={`rb-col c-${c.id} ${encima === c.id ? "encima" : ""}`}
              onDragOver={(e) => { e.preventDefault(); if (encima !== c.id) setEncima(c.id); }} onDragLeave={() => setEncima(null)} onDrop={soltar(c.id)}>
              <header><h3>{c.label} <span className="rb-n">{lista.length}</span></h3><p>{c.sub}</p></header>
              {lista.length === 0 ? <p className="rb-vacia">{c.id === "ahora" ? "Nada en marcha. Trae algo de «Siguiente»." : "Vacía"}</p> : (
                <ul>{lista.map((p) => <Tarjeta key={p.id} p={p} tareas={tareas} hoy={hoy} onEditar={setEditar} onMover={mover} arrastrando={arrastrando} setArrastrando={setArrastrando} />)}</ul>
              )}
            </section>
          );
        })}
      </div>
      {!soloAhora && (sinColocar.length > 0 || permanentes.length > 0) && (
        <div className="rb-tiras">
          {sinColocar.length > 0 && (
            <div className="card rb-tira">
              <h3>Sin colocar <span className="rb-n">{sinColocar.length}</span></h3>
              <p className="sub">Proyectos que todavía no están en ninguna columna. Arrástralos o ábrelos para colocarlos.</p>
              <ul>{sinColocar.map((p) => <li key={p.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(p.id)); setArrastrando(p.id); }} onDragEnd={() => setArrastrando(null)}><button onClick={() => setEditar(p)}><ChipArea id={p.area} />{p.nombre}{p.responsable && <Avatar nombre={nombreSocio(p.responsable)} size={20} />}</button></li>)}</ul>
            </div>
          )}
          {permanentes.length > 0 && (
            <div className="card rb-tira">
              <h3>Responsabilidades permanentes <span className="rb-n">{permanentes.length}</span></h3>
              <p className="sub">No son proyectos: no acaban. Van aparte para que no ocupen «Ahora».</p>
              <ul>{permanentes.map((p) => <li key={p.id}><button onClick={() => setEditar(p)}><ChipArea id={p.area} />{p.nombre}{p.responsable && <Avatar nombre={nombreSocio(p.responsable)} size={20} />}</button></li>)}</ul>
            </div>
          )}
        </div>
      )}
      {editar && <ProyectoPanel p={editar} user={user} onClose={() => setEditar(null)} />}
    </>
  );
}

// Avisos de las reglas: más de 2 en «Ahora», tarjetas en gris, siguientes pasos vencidos, sin métrica
export function avisosRumbo(proyectos, hoy = hoyISO()) {
  const vivos = (proyectos || []).filter((p) => p.estado !== "terminado" && !p.permanente && p.columna);
  const ahora = vivos.filter((p) => p.columna === "ahora");
  const pasados = SOCIOS.map((s) => ({ s, n: ahora.filter((p) => p.responsable === s.id).length })).filter((x) => x.n > MAX_AHORA);
  return {
    pasados,
    grises: vivos.filter((p) => p.columna !== "mas_adelante" && diasDesde(p.actualizado_en) >= DIAS_GRIS),
    pasosTarde: vivos.filter((p) => p.siguiente_paso_fecha && p.siguiente_paso_fecha < hoy),
    sinMetrica: ahora.filter((p) => !p.metrica),
    sinPaso: ahora.filter((p) => !p.siguiente_paso),
  };
}

export function AvisosReglas({ proyectos }) {
  const a = avisosRumbo(proyectos);
  const items = [
    ...a.pasados.map(({ s, n }) => ({ k: `p${s.id}`, mal: true, t: <><b>{s.label}</b> tiene {n} proyectos en «Ahora» (máximo {MAX_AHORA}). Toca elegir.</> })),
    a.grises.length && { k: "g", t: <><b>{a.grises.length}</b> {a.grises.length === 1 ? "tarjeta lleva" : "tarjetas llevan"} más de {DIAS_GRIS} días sin actualizar.</> },
    a.pasosTarde.length && { k: "t", t: <><b>{a.pasosTarde.length}</b> con el siguiente paso vencido.</> },
    a.sinMetrica.length && { k: "m", t: <><b>{a.sinMetrica.length}</b> en «Ahora» sin decir qué métrica mueve{a.sinMetrica.length === 1 ? "" : "n"}.</> },
    a.sinPaso.length && { k: "s", t: <><b>{a.sinPaso.length}</b> en «Ahora» sin siguiente paso.</> },
  ].filter(Boolean);
  if (!items.length) return <p className="rb-ok">✓ El roadmap cumple las reglas: nadie pasa de {MAX_AHORA} en «Ahora» y todo está al día.</p>;
  return <ul className="rb-avisos">{items.map((x) => <li key={x.k} className={x.mal ? "mal" : ""}>{x.t}</li>)}</ul>;
}

// ---------- la foto de la ejecución: cómo van proyectos y tareas ----------
function FotoPlan({ quien }) {
  const { tareas, proyectos } = usePlan();
  if (!tareas || !proyectos) return null;
  const hoy = hoyISO();
  const en7 = (() => { const d = new Date(`${hoy}T12:00:00`); d.setDate(d.getDate() + 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const hace7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const ts = tareas.filter((t) => !quien || (t.propietarios || []).includes(quien));
  const abiertas = ts.filter((t) => t.estado !== "hecha");
  const atras = abiertas.filter((t) => atrasada(t, hoy)).length;
  const semana = abiertas.filter((t) => t.fecha_fin && t.fecha_fin >= hoy && t.fecha_fin <= en7).length;
  const hechas = ts.filter((t) => t.estado === "hecha" && String(t.completada_en || "") >= hace7).length;
  const ahora = proyectos.filter((p) => p.estado !== "terminado" && !p.permanente && p.columna === "ahora" && (!quien || p.responsable === quien)).length;
  const K = ({ t, v, sub, cls, ir: a }) => <button className={`card rb-kpi ${cls || ""}`} onClick={a}><h2>{t}</h2><p className="num">{v}</p><p className="sub">{sub}</p></button>;
  return (
    <div className="rb-foto">
      <K t="Proyectos en «Ahora»" v={ahora} sub={quien ? `de ${nombreSocio(quien)}` : "de los cuatro socios"} ir={() => ir("plan/proyectos/proyectos")} />
      <K t="Tareas vencidas" v={atras} sub="con la fecha pasada" cls={atras ? "mal" : ""} ir={() => pedirFiltroFoco("vencidas", quien)} />
      <K t="Vencen esta semana" v={semana} sub="en los próximos 7 días" ir={() => pedirFiltroFoco("semana", quien)} />
      <K t="Hechas en 7 días" v={hechas} sub={hechas ? "buen ritmo" : "ninguna todavía"} cls="ok" ir={() => pedirFiltroFoco("hechas", quien)} />
    </div>
  );
}

// ---------- la página ----------
export function PlanRumbo({ user }) {
  const { proyectos } = usePlan();
  const { m } = useMetricas();
  const [quien, setQuien] = useState("");
  const [ajustes, setAjustes] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const horizonte = m?.config?.plan_horizonte;
  const quedan = horizonte ? Math.ceil((new Date(`${horizonte}T12:00:00`) - new Date()) / 86400000) : null;
  return (
    <>
      <section className="rb-hero">
        <div>
          <p className="rb-eyebrow">Rumbo del trimestre{horizonte ? ` · hasta el ${fechaCorta(horizonte)}` : ""}{quedan != null && quedan >= 0 ? ` · quedan ${quedan} días` : ""}</p>
          <h1>Dos métricas mandan; el roadmap y las reuniones trabajan para ellas.</h1>
          <p className="rb-regla">Si chocan, manda la facturación mientras el margen no baje del suelo.</p>
        </div>
        <div className="rb-hero-acc">
          <button className="btn-p" onClick={() => ir("plan/reuniones")}>Reunión de dirección →</button>
        </div>
      </section>
      <BloqueMetricas onAjustar={() => setAjustes(true)} />
      <FotoPlan quien={quien} />
      <div className="barra-sec rb-barra">
        <Pestanas valor={quien} onChange={setQuien} etiqueta="Ver de" opciones={[{ id: "", label: "Todos" }, ...SOCIOS.map((s) => ({ id: s.id, label: s.label, n: (proyectos || []).filter((p) => p.estado !== "terminado" && !p.permanente && p.columna === "ahora" && p.responsable === s.id).length }))]} />
        <div className="acciones">
          <button className="btn-l" onClick={() => ir("plan/proyectos")}>Proyectos y tareas</button>
          <button className="btn-p" onClick={() => setNuevo(true)}>+ Proyecto</button>
        </div>
      </div>
      {proyectos && <AvisosReglas proyectos={proyectos} />}
      <TableroRumbo quien={quien} user={user} />
      <p className="rb-leyenda">Arrastra las tarjetas entre columnas (o usa las flechas). Una tarjeta sin tocar en {DIAS_GRIS} días se pone gris: actualízala o pulsa «Sigue igual».</p>
      {ajustes && <AjustesRumbo onClose={() => setAjustes(false)} />}
      {nuevo && <EditarProyecto p={{ columna: "siguiente", responsable: quien || "" }} onClose={() => setNuevo(false)} onGuardado={() => { setNuevo(false); cargarPlan(); }} />}
    </>
  );
}

// ---------- Plan → Proyectos: el tablero Ahora / Siguiente / Más adelante, con la tira de métricas ----------
export function PlanTableroProyectos({ user }) {
  const { proyectos } = usePlan();
  const [quien, setQuien] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  return (
    <>
      <div className="ls-cab">
        <TiraMetricas />
        <span className="ls-esp" />
        <button className="ls-btn" onClick={() => ir("plan/reuniones")}>Reunión</button>
        <button className="ls-btn osc" onClick={() => setNuevo(true)}>+ Proyecto</button>
      </div>
      <div className="ls-filtros">
        <div className="ls-quien" role="group" aria-label="Ver proyectos de">
          <span>Ver de</span>
          {SOCIOS.map((s) => <button key={s.id} className={quien === s.id ? "on" : ""} onClick={() => setQuien(quien === s.id ? "" : s.id)} aria-pressed={quien === s.id} title={s.label}><Bola id={s.id} size={30} borde={quien === s.id ? "#F1BE49" : "#fff"} /></button>)}
          {quien && <button className="ls-chip" onClick={() => setQuien("")}>Todos ✕</button>}
        </div>
      </div>
      {proyectos && <AvisosReglas proyectos={proyectos} />}
      <TableroRumbo quien={quien} user={user} />
      <p className="rb-leyenda">Arrastra las tarjetas entre columnas (o usa las flechas). Al pulsar un proyecto se abre con sus tareas. <button className="btn-txt" onClick={() => setAjustes(true)}>Ajustar suelo de margen y horizonte</button></p>
      {ajustes && <AjustesRumbo onClose={() => setAjustes(false)} />}
      {nuevo && <EditarProyecto p={{ columna: "siguiente", responsable: quien || "" }} onClose={() => setNuevo(false)} onGuardado={() => { setNuevo(false); cargarPlan(); }} />}
    </>
  );
}
