// Roadmap común: una sola línea de tiempo con todo lo que está en marcha en Recao.
// Se agrupa por área o por persona y se despliega en tres niveles: grupo → proyecto → tareas.
import { useEffect, useMemo, useState } from "react";
import { Pestanas, fechaCorta, ir } from "../ui.jsx";
import { initTips } from "../charts.js";
import { AREAS_PLAN, AREA, SOCIOS, SOCIO, nombreSocio, ESTADO_P, ESTADO_T, hoyISO, atrasada } from "./datos.js";
import "./roadmap.css";

const MS = 86400000;
const aFecha = (f) => new Date(`${f}T12:00:00`);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const masDias = (f, n) => { const d = aFecha(f); d.setDate(d.getDate() + n); return iso(d); };
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / MS);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ESCALAS = [
  { id: "mes", label: "6 semanas", dias: 42, antes: 10 },
  { id: "trimestre", label: "Trimestre", dias: 91, antes: 21 },
  { id: "semestre", label: "Semestre", dias: 182, antes: 35 },
  { id: "anio", label: "Año", dias: 365, antes: 60 },
];
const SIN = "_sin";

// fechas que ocupa cada cosa en la línea de tiempo
function rangoProyecto(p, ts) {
  const fs = [p.fecha_inicio, p.fecha_objetivo, ...ts.flatMap((t) => [t.fecha_inicio, t.fecha_fin])].filter(Boolean).sort();
  if (!fs.length) return null;
  return { ini: p.fecha_inicio || fs[0], fin: p.fecha_objetivo || fs[fs.length - 1] };
}
const rangoTarea = (t) => (t.fecha_fin || t.fecha_inicio ? { ini: t.fecha_inicio || t.fecha_fin, fin: t.fecha_fin || t.fecha_inicio } : null);

export function Roadmap({ tareas, proyectos, onAbrirTarea, quien = "" }) {
  const hoy = hoyISO();
  const [escala, setEscala] = useState("trimestre");
  const [desde, setDesde] = useState(null); // inicio de la ventana; null = centrada en hoy
  const [por, setPor] = useState("area");
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [verHechas, setVerHechas] = useState(false);
  useEffect(() => { initTips(document.body); }, []);

  const E = ESCALAS.find((e) => e.id === escala);
  const ini = desde || masDias(hoy, -E.antes);
  const fin = masDias(ini, E.dias);
  const pos = (f) => (diasEntre(ini, f) / E.dias) * 100;
  const dentro = (r) => r && r.fin >= ini && r.ini <= fin;
  const mover = (k) => setDesde(masDias(ini, Math.round(E.dias * 0.5) * k));
  const toggle = (k) => setAbiertos((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set([...s, k])));

  // datos agrupados
  const grupos = useMemo(() => {
    const ts = tareas.filter((t) => (verHechas || t.estado !== "hecha" || (t.completada_en || t.fecha_fin || "") >= masDias(hoy, -30)) && (!quien || (t.propietarios || []).includes(quien)));
    const ps = proyectos.filter((p) => (verHechas || p.estado !== "terminado") && (!quien || p.responsable === quien || ts.some((t) => t.proyecto_id === p.id)));
    const claves = por === "area" ? [...AREAS_PLAN.map((a) => a.id), SIN] : [...SOCIOS.map((s) => s.id), SIN];
    const deTarea = (t) => (por === "area" ? [t.area || ps.find((p) => p.id === t.proyecto_id)?.area || SIN] : (t.propietarios || []).length ? t.propietarios : [SIN]);
    const deProy = (p) => (por === "area" ? [p.area || SIN] : [p.responsable || SIN]);
    return claves.map((k) => {
      const proys = ps.filter((p) => deProy(p).includes(k)).map((p) => {
        const tsP = ts.filter((t) => t.proyecto_id === p.id);
        const hechas = tareas.filter((t) => t.proyecto_id === p.id && t.estado === "hecha").length, total = tareas.filter((t) => t.proyecto_id === p.id).length;
        return { p, ts: tsP, r: rangoProyecto(p, tsP), pct: total ? Math.round((hechas / total) * 100) : 0, total, hechas, tarde: p.estado !== "terminado" && p.fecha_objetivo && p.fecha_objetivo < hoy };
      });
      const sueltas = ts.filter((t) => !t.proyecto_id && deTarea(t).includes(k));
      const meta = por === "area" ? (AREA[k] ? { label: AREA[k].label, color: AREA[k].color } : { label: "Sin área", color: "#A9AFB4" }) : (SOCIO[k] ? { label: SOCIO[k].label, color: "#1E272E", sub: SOCIO[k].lleva } : { label: "Sin responsable", color: "#A9AFB4" });
      return { k, ...meta, proys, sueltas };
    }).filter((g) => g.proys.length || g.sueltas.length);
  }, [tareas, proyectos, por, verHechas, quien, hoy]);

  // la foto: qué pasa dentro de la ventana
  const enVentana = grupos.flatMap((g) => g.proys).filter((x, i, a) => a.findIndex((y) => y.p.id === x.p.id) === i && dentro(x.r));
  const tareasVentana = [...new Set(grupos.flatMap((g) => [...g.sueltas, ...g.proys.flatMap((x) => x.ts)]))].filter((t) => dentro(rangoTarea(t)));
  const hitos = enVentana.filter((x) => x.p.fecha_objetivo && x.p.fecha_objetivo >= ini && x.p.fecha_objetivo <= fin);
  const atras = tareasVentana.filter((t) => atrasada(t, hoy)).length + enVentana.filter((x) => x.tarde).length;
  const sinFecha = tareas.filter((t) => t.estado !== "hecha" && !t.fecha_fin && !t.fecha_inicio).length + proyectos.filter((p) => p.estado !== "terminado" && !rangoProyecto(p, tareas.filter((t) => t.proyecto_id === p.id))).length;
  const todoAbierto = grupos.length > 0 && grupos.every((g) => abiertos.has(g.k));

  // cabecera: meses (y semanas en escalas cortas)
  const marcas = [];
  for (let d = aFecha(ini), i = 0; i <= E.dias; i++, d.setDate(d.getDate() + 1)) {
    const f = iso(d);
    if (d.getDate() === 1) marcas.push({ f, tipo: "mes", t: `${MESES[d.getMonth()]}${d.getMonth() === 0 ? ` ${d.getFullYear()}` : ""}` });
    else if (E.dias <= 91 && d.getDay() === 1) marcas.push({ f, tipo: "sem", t: String(d.getDate()) });
  }
  // los números de semana pegados a un cambio de mes se quitan para que no se pisen
  const meses = marcas.filter((m) => m.tipo === "mes").map((m) => m.f);
  for (let i = marcas.length - 1; i >= 0; i--) if (marcas[i].tipo === "sem" && meses.some((f) => Math.abs(diasEntre(f, marcas[i].f)) < Math.max(3, E.dias / 22))) marcas.splice(i, 1);

  // piezas: el color siempre es el del área (así se lee igual agrupando por persona)
  const areaDeProy = Object.fromEntries(proyectos.map((p) => [p.id, p.area]));
  const colorDe = (area) => AREA[area]?.color || "#A9AFB4";
  // piezas
  const tipTarea = (t) => `<b>${esc(t.titulo)}</b><br>${esc(ESTADO_T[t.estado]?.label || t.estado)}${t.fecha_fin ? ` · ${esc(fechaCorta(t.fecha_fin))}` : ""}${(t.propietarios || []).length ? `<br>${esc(t.propietarios.map(nombreSocio).join(", "))}` : ""}`;
  const Punto = ({ t }) => {
    const r = rangoTarea(t); if (!dentro(r)) return null;
    const barra = r.ini !== r.fin;
    const cls = `rm-t e-${t.estado} ${atrasada(t, hoy) ? "tarde" : ""} ${t.prioridad === "alta" ? "alta" : ""}`;
    const l = Math.max(0, pos(r.ini)), w = Math.min(100, pos(r.fin) + 100 / E.dias) - l;
    return barra
      ? <button className={`${cls} barra`} style={{ left: `${l}%`, width: `${Math.max(w, 0.6)}%`, "--c": colorDe(t.area || areaDeProy[t.proyecto_id]) }} data-tip={tipTarea(t)} onClick={() => onAbrirTarea(t.id)} aria-label={t.titulo} />
      : <button className={cls} style={{ left: `calc(${pos(r.fin) + 50 / E.dias}% - 6px)`, "--c": colorDe(t.area || areaDeProy[t.proyecto_id]) }} data-tip={tipTarea(t)} onClick={() => onAbrirTarea(t.id)} aria-label={t.titulo} />;
  };
  const BarraProy = ({ x, color, fina }) => {
    if (!dentro(x.r)) return null;
    const l = Math.max(0, pos(x.r.ini)), rr = Math.min(100, pos(x.r.fin) + 100 / E.dias), w = rr - l;
    const p = x.p;
    const tip = `<b>${esc(p.nombre)}</b><br>${esc(ESTADO_P[p.estado]?.label || p.estado)} · ${x.hechas}/${x.total} tareas${p.responsable ? ` · ${esc(nombreSocio(p.responsable))}` : ""}<br>${esc(fechaCorta(x.r.ini))} → ${esc(fechaCorta(x.r.fin))}${x.tarde ? "<br><b>Pasada la fecha objetivo</b>" : ""}`;
    return (
      <>
        <button className={`rm-p e-${p.estado} ${x.tarde ? "tarde" : ""} ${fina ? "fina" : ""}`} style={{ left: `${l}%`, width: `${Math.max(w, 1)}%`, "--c": p.area ? colorDe(p.area) : color }} data-tip={tip} onClick={() => ir(`plan/proyectos/${p.id}`)}>
          <i className="rm-pct" style={{ width: `${x.pct}%` }} />
          {!fina && <span>{p.nombre}</span>}
        </button>
        {p.fecha_objetivo && p.fecha_objetivo >= ini && p.fecha_objetivo <= fin && <i className={`rm-hito ${x.tarde ? "tarde" : ""}`} style={{ left: `calc(${pos(p.fecha_objetivo) + 50 / E.dias}% - 6px)` }} data-tip={`<b>Objetivo: ${esc(p.nombre)}</b><br>${esc(fechaCorta(p.fecha_objetivo))}`} />}
      </>
    );
  };
  // en la vista plegada, los proyectos se apilan en carriles para no pisarse
  const carriles = (proys) => {
    const lanes = [];
    proys.filter((x) => dentro(x.r)).sort((a, b) => a.r.ini.localeCompare(b.r.ini)).forEach((x) => {
      const i = lanes.findIndex((l) => l[l.length - 1].r.fin < x.r.ini);
      if (i >= 0) lanes[i].push(x); else lanes.push([x]);
    });
    return lanes;
  };
  const Fondo = () => (
    <>
      {marcas.map((m) => <i key={m.f} className={`rm-grid ${m.tipo}`} style={{ left: `${pos(m.f)}%` }} />)}
      {hoy >= ini && hoy <= fin && <i className="rm-hoy" style={{ left: `${pos(hoy) + 50 / E.dias}%` }} />}
    </>
  );

  return (
    <div className="card roadmap">
      <div className="rm-top">
        <div>
          <h2>Roadmap</h2>
          <p className="sub">Todo lo que está en marcha en Recao, en una sola línea de tiempo. Despliega cada {por === "area" ? "área" : "persona"} para ver sus proyectos y cada proyecto para ver sus tareas.</p>
        </div>
        <div className="rm-ctrl">
          <Pestanas valor={por} onChange={(v) => { setPor(v); setAbiertos(new Set()); }} etiqueta="Agrupar por" opciones={[{ id: "area", label: "Por área" }, { id: "persona", label: "Por persona" }]} />
          <Pestanas valor={escala} onChange={(v) => { setEscala(v); setDesde(null); }} etiqueta="Escala" opciones={ESCALAS.map((e) => ({ id: e.id, label: e.label }))} />
        </div>
      </div>

      <div className="rm-foto">
        <span><b>{enVentana.length}</b> proyecto{enVentana.length === 1 ? "" : "s"}</span>
        <span><b>{hitos.length}</b> objetivo{hitos.length === 1 ? "" : "s"} con fecha</span>
        <span><b>{tareasVentana.filter((t) => t.estado !== "hecha").length}</b> tareas abiertas</span>
        <span><b>{tareasVentana.filter((t) => t.estado === "hecha").length}</b> hechas</span>
        {atras > 0 && <span className="mal"><b>{atras}</b> fuera de plazo</span>}
        <span className="rm-areas">{grupos.filter((g) => g.k !== SIN).map((g) => <i key={g.k} style={{ background: g.color }} data-tip={`${esc(g.label)}: ${g.proys.filter((x) => dentro(x.r)).length} proyectos · ${g.sueltas.filter((t) => dentro(rangoTarea(t)) && t.estado !== "hecha").length} tareas sueltas`} />)}</span>
      </div>

      <div className="rm-nav">
        <button className="btn-l" onClick={() => mover(-1)} aria-label="Antes">‹</button>
        <button className="btn-l" onClick={() => setDesde(null)} disabled={!desde}>Hoy</button>
        <button className="btn-l" onClick={() => mover(1)} aria-label="Después">›</button>
        <span className="rm-rango">{fechaCorta(ini)} → {fechaCorta(fin)}</span>
        <label className="chk rm-chk"><input type="checkbox" checked={verHechas} onChange={(e) => setVerHechas(e.target.checked)} /> Ver también lo terminado</label>
        <button className="btn-txt" onClick={() => setAbiertos(todoAbierto ? new Set() : new Set([...grupos.map((g) => g.k), ...grupos.flatMap((g) => g.proys.map((x) => `p${x.p.id}`))]))}>{todoAbierto ? "Plegar todo" : "Desplegar todo"}</button>
      </div>

      {grupos.length === 0 ? <p className="empty">No hay nada con fecha todavía. Crea proyectos con fecha de inicio y objetivo para verlos aquí.</p> : (
        <div className="rm">
          <div className="rm-fila rm-cab">
            <div className="rm-et" />
            <div className="rm-lienzo">{marcas.map((m) => <span key={m.f} className={m.tipo} style={{ left: `${pos(m.f)}%` }}>{m.t}</span>)}{hoy >= ini && hoy <= fin && <span className="hoy" style={{ left: `${pos(hoy) + 50 / E.dias}%` }}>hoy</span>}</div>
          </div>
          {grupos.map((g) => {
            const abierto = abiertos.has(g.k);
            const lanes = carriles(g.proys);
            const puntos = [...g.sueltas, ...g.proys.flatMap((x) => x.ts)].filter((t) => dentro(rangoTarea(t)));
            const nAbiertas = g.sueltas.filter((t) => t.estado !== "hecha").length + g.proys.reduce((s, x) => s + x.ts.filter((t) => t.estado !== "hecha").length, 0);
            return (
              <div key={g.k} className={`rm-grupo ${abierto ? "abierto" : ""}`} style={{ "--c": g.color }}>
                <div className="rm-fila rm-g">
                  <button className="rm-et" onClick={() => toggle(g.k)} aria-expanded={abierto}>
                    <span className="rm-caret">{abierto ? "▾" : "▸"}</span>
                    <span className="rm-pto" />
                    <span className="rm-nom"><b>{g.label}</b><small>{g.proys.length ? `${g.proys.length} proy. · ` : ""}{nAbiertas} tareas</small></span>
                  </button>
                  <div className="rm-lienzo" style={{ height: abierto ? 34 : Math.max(34, (lanes.length + (puntos.length ? 1 : 0)) * 22 + 12) }}>
                    <Fondo />
                    {!abierto && lanes.map((l, i) => <div key={i} className="rm-carril" style={{ top: 6 + i * 22 }}>{l.map((x) => <BarraProy key={x.p.id} x={x} color={g.color} />)}</div>)}
                    {!abierto && puntos.length > 0 && <div className="rm-carril puntos" style={{ top: 6 + lanes.length * 22 }}>{puntos.map((t) => <Punto key={t.id} t={t} />)}</div>}
                    {abierto && <div className="rm-resumen">{g.proys.length} proyecto{g.proys.length === 1 ? "" : "s"} · {g.sueltas.length} tarea{g.sueltas.length === 1 ? "" : "s"} sin proyecto</div>}
                  </div>
                </div>
                {abierto && (
                  <>
                    {g.proys.map((x) => {
                      const k = `p${x.p.id}`; const ab = abiertos.has(k);
                      return (
                        <div key={k}>
                          <div className="rm-fila rm-pr">
                            <button className="rm-et" onClick={() => toggle(k)} aria-expanded={ab} disabled={!x.ts.length}>
                              <span className="rm-caret">{x.ts.length ? (ab ? "▾" : "▸") : ""}</span>
                              <span className="rm-nom"><b>{x.p.nombre}</b><small>{ESTADO_P[x.p.estado]?.label}{x.total ? ` · ${x.hechas}/${x.total}` : ""}{por === "area" && x.p.responsable ? ` · ${nombreSocio(x.p.responsable)}` : ""}{por === "persona" && x.p.area ? ` · ${AREA[x.p.area]?.label || ""}` : ""}</small></span>
                            </button>
                            <div className="rm-lienzo"><Fondo />{x.r ? (dentro(x.r) ? <BarraProy x={x} color={g.color} /> : <span className="rm-fuera">{x.r.fin < ini ? `← terminó ${fechaCorta(x.r.fin)}` : `empieza ${fechaCorta(x.r.ini)} →`}</span>) : <span className="rm-fuera">sin fechas</span>}{!ab && x.ts.map((t) => <Punto key={t.id} t={t} />)}</div>
                          </div>
                          {ab && x.ts.map((t) => (
                            <div key={t.id} className="rm-fila rm-ta">
                              <button className="rm-et" onClick={() => onAbrirTarea(t.id)}><span className={`rm-est e-${t.estado}`} /><span className="rm-nom"><span className={t.estado === "hecha" ? "hecha" : ""}>{t.titulo}</span></span></button>
                              <div className="rm-lienzo"><Fondo /><Punto t={t} /></div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {g.sueltas.length > 0 && (() => {
                      const k = `s${g.k}`; const ab = abiertos.has(k);
                      return (
                        <div>
                          <div className="rm-fila rm-pr suelta">
                            <button className="rm-et" onClick={() => toggle(k)} aria-expanded={ab}><span className="rm-caret">{ab ? "▾" : "▸"}</span><span className="rm-nom"><b>Tareas sin proyecto</b><small>{g.sueltas.length}</small></span></button>
                            <div className="rm-lienzo"><Fondo />{!ab && g.sueltas.map((t) => <Punto key={t.id} t={t} />)}</div>
                          </div>
                          {ab && [...g.sueltas].sort((a, b) => String(rangoTarea(a)?.ini || "9").localeCompare(String(rangoTarea(b)?.ini || "9"))).map((t) => (
                            <div key={t.id} className="rm-fila rm-ta">
                              <button className="rm-et" onClick={() => onAbrirTarea(t.id)}><span className={`rm-est e-${t.estado}`} /><span className="rm-nom"><span className={t.estado === "hecha" ? "hecha" : ""}>{t.titulo}</span></span></button>
                              <div className="rm-lienzo"><Fondo />{rangoTarea(t) ? <Punto t={t} /> : <span className="rm-fuera">sin fecha</span>}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="rm-ley">
        <span><i className="l-p" /> proyecto (relleno = avance)</span>
        <span><i className="l-h" /> fecha objetivo</span>
        <span><i className="l-t" /> tarea</span>
        <span><i className="l-t hecha" /> hecha</span>
        <span><i className="l-t tarde" /> fuera de plazo</span>
        {sinFecha > 0 && <span className="rm-sinf">{sinFecha} sin fecha no aparecen <button className="btn-txt" onClick={() => ir("plan/tareas")}>ponles fecha</button></span>}
      </div>
    </div>
  );
}
