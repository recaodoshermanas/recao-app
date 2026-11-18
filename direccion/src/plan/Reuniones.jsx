// Plan → Reuniones: la reunión semanal de dirección, en tres pasos y sin preparación.
// 1 Métricas · 2 Estado por persona (lo enseña la pantalla con sus tareas; solo se comenta lo que está en rojo
// y lo que cada uno necesita de los demás) · 3 Acuerdos (al cerrar pasan a Tareas; los bloqueos sin resolver, a la siguiente).
// Se puede grabar y la app saca el acta sola.
import { useEffect, useRef, useState } from "react";
import { Panel, Avatar, avisar, fechaCorta, hace, Cargando, ir } from "../ui.jsx";
import { eur, pct } from "../fmt.js";
import { usePlan, cargarPlan, SOCIOS, nombreSocio, hoyISO, atrasada, ordenTareas } from "./datos.js";
import { TareaPanel } from "./Tareas.jsx";
import { BloqueMetricas } from "./Rumbo.jsx";
import { PASOS, TIPOS_PUNTO, reuniones as R, socioDe, useMetricas, fotoMetricas, subirAudio, urlAudio, acta as llamarActa, DIAS_GRIS, diasDesde } from "./rumbo.js";
import "./rumbo.css";

const TIPOS_R = { semanal: "Semanal", mensual: "Revisión mensual", trimestral: "Revisión trimestral" };
const masDias = (f, n) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---------- lista ----------
export function PlanReuniones({ user, extra }) {
  const [lista, setLista] = useState(null);
  const [creando, setCreando] = useState(false);
  const cargar = () => R.lista().then(setLista).catch(() => setLista([]));
  useEffect(() => { if (!extra) cargar(); }, [extra]);
  if (extra) return <Reunion id={Number(extra)} user={user} />;
  if (!lista) return <Cargando />;
  const abiertas = lista.filter((r) => r.estado !== "cerrada").sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cerradas = lista.filter((r) => r.estado === "cerrada");
  const preparar = async () => {
    setCreando(true);
    try { const n = await R.crear({ fecha: hoyISO(), tipo: "semanal" }); ir(`plan/reuniones/${n.id}`); } catch (e) { avisar("No se ha podido crear", "mal"); }
    setCreando(false);
  };
  return (
    <>
      <section className="rb-hero">
        <div>
          <p className="rb-eyebrow">Reunión de dirección · 45 minutos</p>
          <h1>Se viene a decidir, no a contar lo hecho.</h1>
          <p className="rb-regla">El estado de cada uno lo enseña la pantalla. En la reunión solo se habla de lo que está en rojo y de lo que alguien necesita de los demás.</p>
        </div>
      </section>
      <div className="grid">
        <div className="card c7">
          <h2>{abiertas.length ? "Próxima reunión" : "No hay ninguna reunión abierta"}</h2>
          {abiertas.length === 0 ? (
            <><p className="sub">Ábrela cuando os sentéis (o antes, si alguien quiere apuntar un bloqueo).</p><p><button className="btn-p" disabled={creando} onClick={preparar}>Abrir una reunión</button></p></>
          ) : (
            <ul className="rn-lista">{abiertas.map((r) => (
              <li key={r.id}><button onClick={() => ir(`plan/reuniones/${r.id}`)}>
                <b>{fechaCorta(r.fecha)}</b><span>{TIPOS_R[r.tipo]}</span><span className="est-p e-activo">Abierta</span><span className="rn-ir">Abrir →</span>
              </button></li>
            ))}</ul>
          )}
        </div>
        <div className="card c5">
          <h2>Orden del día</h2>
          <ol className="rn-orden">{PASOS.map((p) => <li key={p.id}><b>{p.label}</b> <span>{p.min} min</span><small>{p.ayuda}</small></li>)}</ol>
          <p className="sub">Una vez al mes, revisión: ¿las métricas van bien? Repriorizar en Rumbo. Cada trimestre: elegir las métricas del siguiente.</p>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Historial</h2>
        {cerradas.length === 0 ? <p className="empty">Todavía no se ha cerrado ninguna reunión.</p> : (
          <ul className="rn-lista">{cerradas.map((r) => (
            <li key={r.id}><button onClick={() => ir(`plan/reuniones/${r.id}`)}>
              <b>{fechaCorta(r.fecha)}</b><span>{TIPOS_R[r.tipo]}</span><span className="rn-acta">{r.acta_estado === "lista" ? "🎙 Acta" : r.audio_path ? "🎙 Audio" : ""}</span><span className="rn-ir">Ver →</span>
            </button></li>
          ))}</ul>
        )}
      </div>
    </>
  );
}

// ---------- una reunión ----------
function Reunion({ id, user }) {
  const [r, setR] = useState(null);
  const [puntos, setPuntos] = useState(null);
  const [anterior, setAnterior] = useState(undefined); // reunión cerrada justo antes (para «hecho desde la última»)
  const [paso, setPaso] = useState("metricas");
  const [cerrar, setCerrar] = useState(false);
  const [noExiste, setNoExiste] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const { proyectos, tareas } = usePlan();
  const yo = socioDe(user);
  const cargar = async () => {
    try {
      const [a, b] = await Promise.all([R.una(id), R.puntos(id)]);
      if (!a) { setNoExiste(true); return; }
      setR(a); setPuntos(b);
    } catch (e) { /* se reintenta en la siguiente vuelta */ }
  };
  useEffect(() => {
    cargar();
    R.lista().then((l) => setAnterior(l.filter((x) => x.estado === "cerrada" && x.id !== id).sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null)).catch(() => setAnterior(null));
    const t = setInterval(() => { if (!document.hidden) cargar(); }, 20000);
    return () => clearInterval(t);
  }, [id]);
  if (noExiste) return <div className="card"><p className="empty">Esta reunión no existe. <button className="btn-txt" onClick={() => ir("plan/reuniones")}>Volver</button></p></div>;
  if (!r || !puntos) return <Cargando />;
  const cerrada = r.estado === "cerrada";
  const guardar = async (patch) => { setR({ ...r, ...patch }); try { await R.guardar(id, patch); } catch (e) { avisar("No se ha podido guardar", "mal"); cargar(); } };
  const nBloq = puntos.filter((p) => p.tipo !== "acuerdo" && p.estado === "abierto").length;
  const nAcu = puntos.filter((p) => p.tipo === "acuerdo").length;

  return (
    <>
      <button className="volver" onClick={() => ir("plan/reuniones")}>← Reuniones</button>
      <section className="rn-cab">
        <div>
          <p className="rb-eyebrow">{TIPOS_R[r.tipo]} · {cerrada ? `cerrada ${hace(r.cerrada_en)}` : "abierta"}</p>
          <h1>Reunión del {fechaCorta(r.fecha)}</h1>
          {!cerrada && (
            <div className="rn-cab-campos">
              <label>Fecha <input type="date" value={r.fecha} onChange={(e) => e.target.value && guardar({ fecha: e.target.value })} /></label>
              <label>Tipo <select value={r.tipo} onChange={(e) => guardar({ tipo: e.target.value })}>{Object.entries(TIPOS_R).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </div>
          )}
        </div>
        <div className="rn-cab-acc">
          {!cerrada && <button className="btn-p" onClick={() => setCerrar(true)}>Cerrar la reunión</button>}
          {!cerrada && !puntos.length && <button className="btn-txt peligro" onClick={async () => { if (window.confirm("¿Borrar esta reunión?")) { await R.borrar(id); ir("plan/reuniones"); } }}>Borrar</button>}
        </div>
      </section>

      <nav className="rn-pasos" aria-label="Orden del día">
        {PASOS.map((p) => (
          <button key={p.id} aria-current={paso === p.id ? "step" : undefined} onClick={() => setPaso(p.id)}>
            <b>{p.n}</b>{p.label}<small>{p.min}′{p.id === "personas" && nBloq ? ` · ${nBloq} bloqueos` : ""}{p.id === "acuerdos" && nAcu ? ` · ${nAcu}` : ""}</small>
          </button>
        ))}
        <button aria-current={paso === "acta" ? "step" : undefined} onClick={() => setPaso("acta")}><b>🎙</b>Grabación y acta</button>
      </nav>
      {PASOS.find((p) => p.id === paso) && <p className="rn-ayuda">{PASOS.find((p) => p.id === paso).ayuda}</p>}

      {paso === "metricas" && (cerrada && r.metricas ? <FotoMetricas f={r.metricas} /> : <BloqueMetricas compacto />)}
      {paso === "personas" && (
        <EstadoPersonas r={r} tareas={tareas} proyectos={proyectos} puntos={puntos} setPuntos={setPuntos} yo={yo} cerrada={cerrada}
          desde={anterior === undefined ? null : (anterior?.cerrada_en || new Date(Date.now() - 7 * 86400000).toISOString())} desdeTexto={anterior ? `desde la reunión del ${fechaCorta(anterior.fecha)}` : "en los últimos 7 días"} onAbrir={setAbierta} />
      )}
      {paso === "acuerdos" && <Puntos r={r} puntos={puntos} setPuntos={setPuntos} yo={yo} tipos={["acuerdo"]} proyectos={proyectos} cerrada={cerrada} />}
      {paso === "acta" && <Grabacion r={r} setR={setR} recargar={cargar} puntos={puntos} setPuntos={setPuntos} yo={yo} proyectos={proyectos} />}

      {!cerrada && paso !== "acta" && (
        <div className="card rn-notas">
          <h2>Notas</h2>
          <textarea rows={3} defaultValue={r.notas || ""} placeholder="Lo que no encaja en otro sitio…" onBlur={(e) => e.target.value !== (r.notas || "") && guardar({ notas: e.target.value })} />
        </div>
      )}
      {cerrada && r.notas && <div className="card rn-notas"><h2>Notas</h2><p className="rn-texto">{r.notas}</p></div>}
      {abierta && <TareaPanel id={abierta} user={user} onClose={() => setAbierta(null)} />}
      {cerrar && <CerrarReunion r={r} puntos={puntos} onClose={() => setCerrar(false)} onCerrada={(res) => { setCerrar(false); cargarPlan(); avisar(`Reunión cerrada · ${res.tareas} tareas creadas${res.arrastrados ? ` · ${res.arrastrados} bloqueos pasan a la siguiente` : ""}`); cargar(); setPaso("acuerdos"); }} />}
    </>
  );
}

function FotoMetricas({ f }) {
  return (
    <div className="rb-metricas compacto">
      <section className="card rb-met"><div className="rb-met-cab"><h2>Facturación</h2><span className="rb-tag">al cerrar la reunión</span></div><p className="num">{f.por_dia != null ? eur(f.por_dia) : "–"}</p><p className="rb-pie">por día · mes anterior {f.por_dia_anterior != null ? eur(f.por_dia_anterior) : "–"}</p></section>
      <section className={`card rb-met ${f.margen_pct != null && f.margen_pct < f.suelo ? "mal" : ""}`}><div className="rb-met-cab"><h2>Margen bruto</h2><span className="rb-tag">suelo {pct(f.suelo, 0)}</span></div><p className="num">{f.margen_pct != null ? pct(f.margen_pct) : "–"}</p><p className="rb-pie">mes anterior {f.margen_pct_anterior != null ? pct(f.margen_pct_anterior) : "–"}</p></section>
    </div>
  );
}

// ---------- 2. estado por persona: lo enseña la pantalla, sale de sus tareas y proyectos ----------
function EstadoPersonas({ r, tareas, proyectos, puntos, setPuntos, yo, cerrada, desde, desdeTexto, onAbrir }) {
  if (!tareas || !proyectos) return <Cargando />;
  const hoy = hoyISO(); const en7 = masDias(hoy, 7);
  const sinDueno = tareas.filter((t) => t.estado !== "hecha" && !(t.propietarios || []).length);
  return (
    <>
      <div className="rn-personas">
        {SOCIOS.map((s) => <Persona key={s.id} s={s} r={r} hoy={hoy} en7={en7} desde={desde} desdeTexto={desdeTexto} tareas={tareas} proyectos={proyectos} puntos={puntos} setPuntos={setPuntos} yo={yo} cerrada={cerrada} onAbrir={onAbrir} />)}
      </div>
      {sinDueno.length > 0 && <p className="rn-ayuda">Hay {sinDueno.length} tareas abiertas sin responsable. <button className="btn-txt" onClick={() => ir("plan/proyectos")}>Asignarlas</button></p>}
    </>
  );
}

function Persona({ s, r, hoy, en7, desde, desdeTexto, tareas, proyectos, puntos, setPuntos, yo, cerrada, onAbrir }) {
  const [txt, setTxt] = useState("");
  const [verHechas, setVerHechas] = useState(false);
  const mias = tareas.filter((t) => (t.propietarios || []).includes(s.id));
  const abiertas = mias.filter((t) => t.estado !== "hecha");
  const atras = abiertas.filter((t) => atrasada(t, hoy)).sort(ordenTareas);
  const semana = abiertas.filter((t) => t.fecha_fin && t.fecha_fin >= hoy && t.fecha_fin <= en7).sort(ordenTareas);
  const hechas = desde ? mias.filter((t) => t.estado === "hecha" && String(t.completada_en || "") >= desde) : [];
  const ahora = proyectos.filter((p) => p.responsable === s.id && p.estado !== "terminado" && !p.permanente && p.columna === "ahora");
  const bloqueos = puntos.filter((p) => p.tipo !== "acuerdo" && p.autor === s.id);
  const rojo = atras.length > 0 || ahora.some((p) => diasDesde(p.actualizado_en) >= DIAS_GRIS) || ahora.length > 2 || bloqueos.some((b) => b.estado === "abierto");
  const anadir = async () => {
    if (!txt.trim()) return;
    try { const n = await R.nuevoPunto({ reunion_id: r.id, tipo: "bloqueo", texto: txt.trim(), autor: s.id, responsable: s.id }); setPuntos([...puntos, n]); setTxt(""); }
    catch (e) { avisar("No se ha podido apuntar", "mal"); }
  };
  const cambiar = async (p, patch) => { setPuntos(puntos.map((x) => (x.id === p.id ? { ...x, ...patch } : x))); try { await R.guardarPunto(p.id, patch); } catch (e) { avisar("No se ha podido guardar", "mal"); } };
  const aAcuerdo = async (p) => {
    try {
      const n = await R.nuevoPunto({ reunion_id: r.id, tipo: "acuerdo", texto: p.texto, autor: yo, responsable: null, proyecto_id: p.proyecto_id || null });
      setPuntos([...puntos.map((x) => (x.id === p.id ? { ...x, estado: "resuelto", resolucion: "Pasa a acuerdo" } : x)), n]);
      await R.guardarPunto(p.id, { estado: "resuelto", resolucion: "Pasa a acuerdo" });
      avisar("Añadido a acuerdos: ponle responsable y fecha");
    } catch (e) { avisar("No se ha podido", "mal"); }
  };
  const Lista = ({ ts, clase }) => <ul className={`rn-p-tareas ${clase || ""}`}>{ts.map((t) => <li key={t.id}><button onClick={() => onAbrir(t.id)}><span>{t.prioridad === "alta" && <i className="prio-alta">!</i>}{t.titulo}</span>{t.fecha_fin && <em>{fechaCorta(t.fecha_fin)}</em>}</button></li>)}</ul>;
  return (
    <section className={`card rn-persona ${rojo ? "rojo" : ""}`}>
      <header>
        <Avatar nombre={s.label} size={36} />
        <span><b>{s.label}</b><small>{s.lleva}</small></span>
        <span className={`rn-p-sem ${rojo ? "mal" : "ok"}`}>{rojo ? "A comentar" : "✓ Al día"}</span>
      </header>
      <dl className="rn-p-kpis">
        <div className={atras.length ? "mal" : ""}><dt>Atrasadas</dt><dd>{atras.length}</dd></div>
        <div><dt>Esta semana</dt><dd>{semana.length}</dd></div>
        <div className="ok"><dt>Hechas</dt><dd>{hechas.length}</dd></div>
        <div className={ahora.length > 2 ? "mal" : ""}><dt>En «Ahora»</dt><dd>{ahora.length}</dd></div>
      </dl>
      {atras.length > 0 && <><h4 className="mal">Atrasadas</h4><Lista ts={atras} clase="mal" /></>}
      {semana.length > 0 && <><h4>Vencen esta semana</h4><Lista ts={semana} /></>}
      {ahora.length > 0 && (
        <><h4>Proyectos en «Ahora»</h4>
          <ul className="rn-p-proys">{ahora.map((p) => { const gris = diasDesde(p.actualizado_en) >= DIAS_GRIS; return (
            <li key={p.id} className={gris ? "gris" : ""}><button onClick={() => ir(`plan/proyectos/${p.id}`)}><b>{p.nombre}</b><small>{gris ? `sin actualizar hace ${diasDesde(p.actualizado_en)} días` : p.siguiente_paso ? `→ ${p.siguiente_paso}` : "sin siguiente paso"}</small></button></li>
          ); })}</ul></>
      )}
      {hechas.length > 0 && <button className="btn-txt rn-p-hechas" onClick={() => setVerHechas(!verHechas)}>{verHechas ? "Ocultar" : "Ver"} {hechas.length} hechas {desdeTexto}</button>}
      {verHechas && <Lista ts={hechas} clase="hechas" />}
      {abiertas.length === 0 && ahora.length === 0 && <p className="empty">Sin tareas abiertas.</p>}
      <h4>Necesita de los demás</h4>
      {bloqueos.length === 0 && cerrada && <p className="empty">Nada.</p>}
      <ul className="rn-p-bloq">{bloqueos.map((b) => (
        <li key={b.id} className={b.estado === "resuelto" ? "resuelto" : ""}>
          <span>⛔ {b.texto}{b.origen === "arrastrado" && <em> · de la reunión anterior</em>}</span>
          {!cerrada && b.estado === "abierto" && <span className="rn-p-bloq-acc"><button className="btn-l" onClick={() => cambiar(b, { estado: "resuelto" })}>Resuelto</button><button className="btn-txt" onClick={() => aAcuerdo(b)}>→ Acuerdo</button></span>}
        </li>
      ))}</ul>
      {!cerrada && <div className="rn-p-alta"><input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && anadir()} placeholder={`¿${s.label} necesita algo de alguien?`} aria-label={`Bloqueo de ${s.label}`} /><button className="btn-l" disabled={!txt.trim()} onClick={anadir}>Apuntar</button></div>}
    </section>
  );
}

// ---------- 3. acuerdos ----------
function Puntos({ r, puntos, setPuntos, yo, tipos, proyectos, cerrada }) {
  const esAcuerdos = tipos[0] === "acuerdo";
  const [f, setF] = useState({ tipo: tipos[0], texto: "", responsable: "", fecha: "", proyecto_id: "" });
  const [busy, setBusy] = useState(false);
  const lista = puntos.filter((p) => tipos.includes(p.tipo));
  const abiertos = lista.filter((p) => p.estado === "abierto" || esAcuerdos);
  const resueltos = esAcuerdos ? [] : lista.filter((p) => p.estado === "resuelto");
  const anadir = async () => {
    if (!f.texto.trim()) return;
    setBusy(true);
    try {
      const n = await R.nuevoPunto({ reunion_id: r.id, tipo: f.tipo, texto: f.texto.trim(), autor: yo, responsable: f.responsable || (esAcuerdos ? null : yo), fecha: f.fecha || null, proyecto_id: f.proyecto_id ? Number(f.proyecto_id) : null });
      setPuntos([...puntos, n]); setF({ ...f, texto: "", fecha: "", proyecto_id: "", responsable: "" });
    } catch (e) { avisar("No se ha podido apuntar", "mal"); }
    setBusy(false);
  };
  const cambiar = async (p, patch) => { setPuntos(puntos.map((x) => (x.id === p.id ? { ...x, ...patch } : x))); try { await R.guardarPunto(p.id, patch); } catch (e) { avisar("No se ha podido guardar", "mal"); } };
  const quitar = async (p) => { setPuntos(puntos.filter((x) => x.id !== p.id)); try { await R.borrarPunto(p.id); } catch (e) { avisar("No se ha podido borrar", "mal"); } };
  const aAcuerdo = async (p) => {
    try {
      const n = await R.nuevoPunto({ reunion_id: r.id, tipo: "acuerdo", texto: p.resolucion || p.texto, autor: yo, responsable: p.responsable || null, proyecto_id: p.proyecto_id || null });
      const patch = { estado: "resuelto", resolucion: p.resolucion || "Pasa a acuerdo" };
      setPuntos([...puntos.map((x) => (x.id === p.id ? { ...x, ...patch } : x)), n]);
      await R.guardarPunto(p.id, patch);
      avisar("Añadido a acuerdos: ponle responsable y fecha");
    } catch (e) { avisar("No se ha podido", "mal"); }
  };
  const vivos = (proyectos || []).filter((p) => p.estado !== "terminado");
  return (
    <div className="card">
      <div className="head"><div><h2>{esAcuerdos ? "Acuerdos" : "Decisiones y bloqueos"}</h2><p className="sub">{esAcuerdos ? "Cada acuerdo con responsable y fecha. Al cerrar la reunión se convierten en tareas del Plan." : "Lo que cada uno necesita de los demás. Se resuelve aquí o pasa a la siguiente reunión."}</p></div></div>
      {!cerrada && (
        <div className="rn-alta">
          {!esAcuerdos && <div className="seg" role="group" aria-label="Tipo">{tipos.map((t) => <button key={t} aria-pressed={f.tipo === t} onClick={() => setF({ ...f, tipo: t })}>{TIPOS_PUNTO[t].icono} {TIPOS_PUNTO[t].label}</button>)}</div>}
          <input value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} onKeyDown={(e) => e.key === "Enter" && anadir()} placeholder={TIPOS_PUNTO[f.tipo].pide} aria-label="Texto" />
          <div className="rn-alta-fila">
            {esAcuerdos && <select value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })} aria-label="Responsable"><option value="">Responsable…</option>{SOCIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>}
            {esAcuerdos && <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} aria-label="Fecha" />}
            <select value={f.proyecto_id} onChange={(e) => setF({ ...f, proyecto_id: e.target.value })} aria-label="Proyecto"><option value="">Sin proyecto</option>{vivos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
            <button className="btn-p" disabled={busy || !f.texto.trim()} onClick={anadir}>Apuntar</button>
          </div>
        </div>
      )}
      {abiertos.length === 0 ? <p className="empty">{esAcuerdos ? "Ningún acuerdo todavía." : "Nada apuntado. Si nadie necesita nada de nadie, mejor: reunión corta."}</p> : (
        <ul className="rn-puntos">{abiertos.map((p) => <Punto key={p.id} p={p} esAcuerdos={esAcuerdos} cerrada={cerrada} proyectos={vivos} onCambiar={cambiar} onQuitar={quitar} onAcuerdo={aAcuerdo} />)}</ul>
      )}
      {resueltos.length > 0 && (
        <details className="rn-resueltos"><summary>Resueltos ({resueltos.length})</summary>
          <ul className="rn-puntos">{resueltos.map((p) => <Punto key={p.id} p={p} cerrada={cerrada} proyectos={vivos} onCambiar={cambiar} onQuitar={quitar} />)}</ul>
        </details>
      )}
    </div>
  );
}

function Punto({ p, esAcuerdos, cerrada, proyectos, onCambiar, onQuitar, onAcuerdo }) {
  const [res, setRes] = useState(p.resolucion || "");
  const proy = proyectos.find((x) => x.id === p.proyecto_id);
  const t = TIPOS_PUNTO[p.tipo];
  const sinResp = esAcuerdos && !p.responsable;
  return (
    <li className={`rn-punto t-${p.tipo} ${p.estado === "resuelto" && !esAcuerdos ? "resuelto" : ""} ${sinResp ? "falta" : ""}`}>
      <span className="rn-punto-ico" aria-hidden>{t.icono}</span>
      <div className="rn-punto-cuerpo">
        <p><b>{p.texto}</b></p>
        <span className="rn-punto-meta">
          {p.autor && <>{nombreSocio(p.autor)}</>}{p.origen === "arrastrado" && <em> · viene de la reunión anterior</em>}{p.origen === "acta" && <em> · sacado del acta</em>}
          {proy && <> · ◆ {proy.nombre}</>}
          {p.tarea_id && <> · <button className="btn-txt" onClick={() => ir("plan/tareas")}>ya es tarea →</button></>}
        </span>
        {esAcuerdos && !cerrada && (
          <span className="rn-punto-campos">
            <select value={p.responsable || ""} onChange={(e) => onCambiar(p, { responsable: e.target.value || null })} aria-label="Responsable"><option value="">Sin responsable</option>{SOCIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <input type="date" value={p.fecha || ""} onChange={(e) => onCambiar(p, { fecha: e.target.value || null })} aria-label="Fecha" />
          </span>
        )}
        {esAcuerdos && cerrada && <span className="rn-punto-meta">{p.responsable ? <><Avatar nombre={nombreSocio(p.responsable)} size={18} /> {nombreSocio(p.responsable)}</> : "Sin responsable"}{p.fecha ? ` · ${fechaCorta(p.fecha)}` : ""}</span>}
        {!esAcuerdos && p.estado === "abierto" && !cerrada && (
          <span className="rn-punto-resolver">
            <input value={res} onChange={(e) => setRes(e.target.value)} placeholder="Qué se decide / cómo se desbloquea" aria-label="Resolución" />
            <button className="btn-l" onClick={() => onCambiar(p, { estado: "resuelto", resolucion: res.trim() || null })}>Resuelto</button>
            <button className="btn-txt" onClick={() => onAcuerdo({ ...p, resolucion: res.trim() })}>→ Acuerdo</button>
          </span>
        )}
        {!esAcuerdos && p.estado === "resuelto" && p.resolucion && <span className="rn-punto-meta">→ {p.resolucion}</span>}
      </div>
      {!cerrada && !p.tarea_id && <button className="x" onClick={() => onQuitar(p)} aria-label="Quitar">×</button>}
    </li>
  );
}

// ---------- cerrar ----------
function CerrarReunion({ r, puntos, onClose, onCerrada }) {
  const { m } = useMetricas();
  const [sig, setSig] = useState(masDias(r.fecha, 7));
  const [busy, setBusy] = useState(false);
  const acuerdos = puntos.filter((p) => p.tipo === "acuerdo");
  const sinResp = acuerdos.filter((p) => !p.responsable);
  const sinFecha = acuerdos.filter((p) => p.responsable && !p.fecha);
  const abiertos = puntos.filter((p) => p.tipo !== "acuerdo" && p.estado === "abierto");
  return (
    <Panel titulo="Cerrar la reunión" onClose={onClose} ancho="520px"
      pie={<div className="pie-t"><span /><button className="btn-p" disabled={busy} onClick={async () => { setBusy(true); try { onCerrada(await R.cerrar(r.id, fotoMetricas(m), sig)); } catch (e) { avisar(String(e.message || "No se ha podido cerrar").replace(/^RPC[^:]*:\s*\d+\s*/, ""), "mal"); setBusy(false); } }}>Cerrar la reunión</button></div>}>
      <ul className="rn-cierre">
        <li><b>{acuerdos.length - sinResp.length}</b> acuerdos pasan a Tareas del Plan, cada uno a su responsable.</li>
        {sinResp.length > 0 && <li className="mal"><b>{sinResp.length}</b> acuerdos sin responsable: no se convierten en tarea. Vuelve y asígnalos.</li>}
        {sinFecha.length > 0 && <li className="mal"><b>{sinFecha.length}</b> acuerdos sin fecha.</li>}
        <li><b>{abiertos.length}</b> bloqueos o decisiones sin resolver pasan a la siguiente reunión.</li>
        <li>Se guarda la foto de las métricas de hoy.</li>
      </ul>
      <label className="campo">Siguiente reunión<input type="date" value={sig} onChange={(e) => setSig(e.target.value)} /></label>
    </Panel>
  );
}

// ---------- grabación y acta ----------
function elegirFormato() {
  const opciones = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
  return typeof MediaRecorder !== "undefined" ? opciones.find((t) => MediaRecorder.isTypeSupported?.(t)) || "" : null;
}

function Grabacion({ r, setR, recargar, puntos, setPuntos, yo, proyectos }) {
  const [grabando, setGrabando] = useState(false);
  const [seg, setSeg] = useState(0);
  const [subiendo, setSubiendo] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [lanzando, setLanzando] = useState(false);
  const rec = useRef(null); const trozos = useRef([]); const flujo = useRef(null); const t0 = useRef(0); const wake = useRef(null);
  const formato = elegirFormato();

  useEffect(() => { if (r.audio_path) urlAudio(r.audio_path).then(setAudioUrl); else setAudioUrl(null); }, [r.audio_path]);
  // mientras Google transcribe o Claude redacta, se pregunta cada 10 s
  useEffect(() => {
    if (!["transcribiendo", "redactando"].includes(r.acta_estado)) return;
    let vivo = true;
    const t = setInterval(async () => { try { const x = await llamarActa("comprobar", r.id); if (vivo && x?.estado !== r.acta_estado) recargar(); } catch (e) { /* siguiente vuelta */ } }, 10000);
    return () => { vivo = false; clearInterval(t); };
  }, [r.acta_estado, r.id]);
  useEffect(() => () => { flujo.current?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => {
    if (!grabando) return;
    const aviso = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", aviso);
    const t = setInterval(() => setSeg((Date.now() - t0.current) / 1000), 1000);
    return () => { window.removeEventListener("beforeunload", aviso); clearInterval(t); };
  }, [grabando]);

  const subir = async (blob, nombre) => {
    setSubiendo(true);
    try {
      await subirAudio(r.id, blob, nombre); avisar("Audio guardado: sacando el acta…");
      try { await llamarActa("empezar", r.id); } catch (e) { avisar(e.message || "No se ha podido empezar el acta", "mal"); }
      await recargar();
    } catch (e) { avisar(`No se ha podido subir el audio: ${e.message}`, "mal"); }
    setSubiendo(false);
  };
  const empezar = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      flujo.current = s; trozos.current = [];
      const mr = new MediaRecorder(s, { ...(formato ? { mimeType: formato } : {}), audioBitsPerSecond: 48000 });
      mr.ondataavailable = (e) => { if (e.data?.size) trozos.current.push(e.data); };
      mr.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        try { wake.current?.release?.(); } catch (_) { /* nada */ }
        const tipo = mr.mimeType || formato || "audio/webm";
        const blob = new Blob(trozos.current, { type: tipo });
        const ext = tipo.includes("mp4") ? "m4a" : tipo.includes("ogg") ? "ogg" : "webm";
        subir(blob, `reunion-${r.fecha}.${ext}`);
      };
      mr.start(10000); rec.current = mr; t0.current = Date.now(); setSeg(0); setGrabando(true);
      try { wake.current = await navigator.wakeLock?.request("screen"); } catch (_) { /* sin bloqueo de pantalla */ }
    } catch (e) { avisar("No se puede usar el micrófono: dale permiso al navegador", "mal"); }
  };
  const parar = () => { rec.current?.stop(); setGrabando(false); };

  const lanzar = async (accion = "empezar") => {
    setLanzando(true);
    try { await llamarActa(accion, r.id); await recargar(); } catch (e) { avisar(e.message || "No se ha podido", "mal"); await recargar(); }
    setLanzando(false);
  };
  const a = r.acta;
  const yaAcuerdo = (t) => puntos.some((p) => p.tipo === "acuerdo" && p.texto.trim().toLowerCase() === String(t).trim().toLowerCase());
  const pasarAcuerdo = async (x) => {
    try {
      const n = await R.nuevoPunto({ reunion_id: r.id, tipo: "acuerdo", texto: x.texto, autor: yo, responsable: x.responsable || null, fecha: x.fecha || null, proyecto_id: (proyectos || []).some((p) => p.id === x.proyecto_id) ? x.proyecto_id : null, origen: "acta" });
      setPuntos([...puntos, n]); avisar("Añadido a acuerdos");
    } catch (e) { avisar("No se ha podido", "mal"); }
  };

  return (
    <div className="grid sin-margen">
      <div className="card c5">
        <h2>Grabación</h2>
        <p className="sub">Decid en voz alta que se graba antes de empezar. El audio solo lo ve dirección.</p>
        {grabando ? (
          <div className="rn-grabando"><span className="rn-rec" aria-hidden />Grabando · {mmss(seg)}<button className="btn-p" onClick={parar}>Parar y guardar</button></div>
        ) : subiendo ? <p className="rn-ayuda">Subiendo el audio…</p> : (
          <div className="rn-grabar">
            {formato !== null && <button className="btn-p" onClick={empezar}>{r.audio_path ? "Grabar de nuevo" : "● Grabar la reunión"}</button>}
            <label className="btn-l rn-subir">Subir un audio<input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg" onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f, f.name); e.target.value = ""; }} /></label>
          </div>
        )}
        {grabando && <p className="rn-ayuda">Deja esta pantalla abierta (y el móvil enchufado) hasta parar: si se cierra, se pierde la grabación.</p>}
        {audioUrl && !grabando && <audio className="rn-audio" controls preload="none" src={audioUrl} />}
        {r.audio_nombre && <p className="rn-ayuda">{r.audio_nombre}</p>}
      </div>
      <div className="card c7">
        <div className="head"><div><h2>Acta</h2><p className="sub">Google transcribe el audio y Claude saca el resumen, las decisiones y los acuerdos.</p></div></div>
        {!r.audio_path && <p className="empty">Cuando haya audio, aquí sale el acta.</p>}
        {r.audio_path && r.acta_estado === "subido" && <p><button className="btn-p" disabled={lanzando} onClick={() => lanzar("empezar")}>{lanzando ? "Enviando…" : "Sacar el acta"}</button></p>}
        {r.acta_estado === "transcribiendo" && <p className="rn-proceso">Transcribiendo el audio… Una reunión de 45 minutos tarda unos minutos. Puedes seguir con otra cosa.</p>}
        {r.acta_estado === "redactando" && <p className="rn-proceso">Redactando el acta…{" "}<button className="btn-txt" disabled={lanzando} onClick={() => lanzar("redactar_otra_vez")}>¿Se ha atascado? Reintentar</button></p>}
        {r.acta_estado === "error" && <div className="rn-error"><p>No ha salido: {r.acta_error}</p><button className="btn-l" disabled={lanzando} onClick={() => lanzar(r.transcripcion ? "redactar_otra_vez" : "empezar")}>Reintentar</button></div>}
        {r.acta_estado === "lista" && a && (
          <div className="rn-acta-c">
            {a.resumen && <p className="rn-resumen">{a.resumen}</p>}
            {a.decisiones?.length > 0 && <><h3>Decisiones</h3><ul>{a.decisiones.map((d, i) => <li key={i}>{d.texto}</li>)}</ul></>}
            {a.acuerdos?.length > 0 && <><h3>Acuerdos propuestos</h3><ul className="rn-propuestos">{a.acuerdos.map((x, i) => (
              <li key={i}><span>{x.texto}<small>{x.responsable ? nombreSocio(x.responsable) : "sin responsable"}{x.fecha ? ` · ${fechaCorta(x.fecha)}` : ""}</small></span>
                {r.estado !== "cerrada" && (yaAcuerdo(x.texto) ? <em>✓ en acuerdos</em> : <button className="btn-l" onClick={() => pasarAcuerdo(x)}>Añadir</button>)}</li>
            ))}</ul></>}
            {a.bloqueos?.length > 0 && <><h3>Bloqueos</h3><ul>{a.bloqueos.map((b, i) => <li key={i}>{b.texto}{b.quien ? ` (${b.quien})` : ""}</li>)}</ul></>}
            {a.temas?.length > 0 && <><h3>Temas</h3><ul>{a.temas.map((t, i) => <li key={i}><b>{t.titulo}:</b> {t.resumen}</li>)}</ul></>}
            {r.transcripcion && <details className="rn-trans"><summary>Transcripción completa</summary><p className="rn-texto">{r.transcripcion}</p></details>}
          </div>
        )}
      </div>
    </div>
  );
}
