// Personas · Resumen (#167): franja de «lo urgente» + ventanas desplegables por área.
// No crea datos: junta lo que ya tienen las pestañas de Personas. Cada ventana carga por separado y puede fallar sin romper el resto.
import { useEffect, useMemo, useState } from "react";
import { sb } from "../../src/lib/supabase.js";
import { ymd, horasTurno } from "../../src/lib/turnos.js";
import { huecosCobertura, requeridosDe, TURNOS_REQUERIDOS } from "../../src/lib/cobertura.js";
import { BOLSA_ACTIVA, DIAS_URGENTE } from "../../src/lib/bolsa.js";
import { Cargando } from "./ui.jsx";
import "./personas/resumen.css";
import { useCobertura, NotaMes, PorCubrir, colorNota } from "./personas/CoberturaNota.jsx";

const masDias = (n, base) => { const d = base ? new Date(`${base}T12:00:00`) : new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const diaCorto = (f) => new Date(`${f.slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
const diaMini = (f) => new Date(`${f.slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
const dif = (f, hoy) => Math.round((new Date(`${f}T12:00:00`) - new Date(`${hoy}T12:00:00`)) / 86400000);
const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
const horaDe = (t) => String(t).slice(11, 16);
const h1 = (n) => `${(Math.round(Number(n || 0) * 10) / 10).toLocaleString("es-ES")} h`;
const nomMes = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { month: "long" });
const NO_TRABAJO = new Set(["Descanso", "Vacaciones", "Baja", "Permiso", "Formación"]);
const inicioTurno = (turno, fecha) => { const m = /(\d{1,2}):(\d{2})/.exec(horasTurno(turno, fecha) || ""); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null; };
const ahoraHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

function tramos(filas) {
  const por = {};
  filas.forEach((h) => { (por[h.usuario_id] ||= []).push(h.fecha); });
  const out = [];
  Object.entries(por).forEach(([uid, fechas]) => {
    fechas.sort();
    let ini = fechas[0], fin = fechas[0];
    for (let i = 1; i <= fechas.length; i++) {
      const f = fechas[i];
      if (f && f === masDias(1, fin)) { fin = f; continue; }
      out.push({ uid, ini, fin });
      ini = fin = f;
    }
  });
  return out.sort((a, b) => a.ini.localeCompare(b.ini));
}

function Anillo({ valor, texto, sub }) {
  const v = valor == null ? 0 : Math.max(0, Math.min(100, valor)); const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="rs-anillo" role="img" aria-label={`${valor ?? "sin dato"} % ${texto}`}>
      <svg viewBox="0 0 80 80" width="84" height="84"><circle cx="40" cy="40" r={r} className="pista" /><circle cx="40" cy="40" r={r} className="valor" strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 40 40)" /></svg>
      <div><b>{valor == null ? "—" : `${valor} %`}</b><span>{texto}</span>{sub && <small>{sub}</small>}</div>
    </div>
  );
}
function Barra({ etiqueta, valor, texto }) {
  return <div className="rs-barra"><span>{etiqueta}</span><div className="pista"><i style={{ width: `${Math.max(0, Math.min(100, valor || 0))}%` }} /></div><em>{texto}</em></div>;
}
function Cifras({ items }) {
  return <div className="rs-cifras">{items.map((x, i) => (x.ruta
    ? <a key={i} className={`rs-cifra ${x.n > 0 ? x.c || "ama" : "ok"}`} href={`#/${x.ruta}`}><b>{x.n}</b><span>{x.t}</span></a>
    : <div key={i} className="rs-cifra"><b>{x.n}</b><span>{x.t}</span></div>))}</div>;
}
function Etiqueta({ c = "gris", children }) { return <span className={`rs-et ${c}`}>{children}</span>; }

function Ventana({ icono, nombre, clave, etiquetas = [], abierta, onToggle, cargando, error, ruta, rutaTxt, children }) {
  return (
    <section className={`rs-ven ${abierta ? "abierta" : ""}`}>
      <button className="rs-cab" onClick={onToggle} aria-expanded={abierta}>
        <span className="ic" aria-hidden="true">{icono}</span>
        <span className="tx"><b>{nombre}</b><small>{cargando ? "Cargando…" : error ? "Sin datos por ahora" : clave}</small></span>
        <span className="et">{!cargando && !error && etiquetas.filter(Boolean).slice(0, 2)}</span>
        <i className="fl" aria-hidden="true">{abierta ? "▾" : "▸"}</i>
      </button>
      {abierta && (
        <div className="rs-cuerpo">
          {cargando ? <Cargando /> : error ? <p className="empty">No se han podido cargar estos datos. El resto del Resumen sigue funcionando.</p> : children}
          <a className="rs-ir" href={`#/${ruta}`}>Ir a {rutaTxt} →</a>
        </div>
      )}
    </section>
  );
}

const seguro = (p) => Promise.resolve(p).then((v) => ({ v })).catch(() => ({ error: true }));

function useDatos() {
  const [s, setS] = useState({});
  useEffect(() => {
    let vivo = true;
    const poner = (k, p) => seguro(p).then((r) => { if (vivo) setS((x) => ({ ...x, [k]: r })); });
    const hoy = ymd(new Date()), manana = masDias(1), mes0 = `${hoy.slice(0, 7)}-01`;
    const mesAnt0 = (() => { const d = new Date(`${mes0}T12:00:00`); d.setMonth(d.getMonth() - 1); return ymd(d); })();
    const mesFin = (() => { const d = new Date(`${mes0}T12:00:00`); d.setMonth(d.getMonth() + 1); d.setDate(0); return ymd(d); })();
    poner("usuarios", sb.select("usuarios", "select=id,nombre,rol,activo,eventual,tipo_turno,auth_id,documentos_electronicos_en"));
    poner("horarios", sb.select("horarios", `select=usuario_id,fecha,turno&fecha=gte.${hoy}&fecha=lte.${masDias(60)}&limit=3000`));
    poner("fichHoy", sb.select("fichajes", `select=usuario_id,entrada,salida&anulado=eq.false&entrada=gte.${hoy}T00:00:00&entrada=lt.${manana}T00:00:00`));
    poner("fichPanel", sb.fn("fichajes", { accion: "panel" }));
    poner("fichMes", sb.fn("fichajes", { accion: "panel", desde: mes0, hasta: mesFin }));
    poner("bolsa", sb.select("bolsa_turnos", `select=id,fecha,turno,estado,destino,publicado_en,cogido_en&fecha=gte.${mesAnt0}&fecha=lte.${masDias(60)}&estado=in.(abierto,cubierto)`));
    poner("sinCerrar", sb.rpc("sin_cerrar_bandeja", {}));
    poner("cierres", sb.select("cierres_turno", `select=fecha,turno,items:cierre_items(hecha)&fecha=gte.${mesAnt0}&fecha=lte.${hoy}&limit=1000`));
    poner("semanas", sb.select("cierres_turno", `select=fecha,items:cierre_items(hecha)&fecha=gte.${masDias(-41)}&fecha=lte.${hoy}&limit=1000`));
    poner("avisos", sb.select("avisos", "select=id&estado=eq.emitido"));
    poner("incid", sb.select("incidencias_turno", `select=id,cierre_item_id&descartada=eq.false&fecha=gte.${masDias(-30)}`));
    poner("causas", sb.select("causas_revision", `select=cierre_item_id&revisado_en=gte.${masDias(-31)}T00:00:00`));
    poner("extras", sb.rpc("tareas_extra_resumen", { p_dias: 30 }));
    poner("vacSol", sb.select("vacaciones_solicitudes", "select=id&estado=eq.pendiente"));
    poner("cambios", sb.select("cambios_turno", "select=id&estado=eq.pendiente"));
    poner("hextra", sb.select("horas_extra_peticiones", "select=id&estado=eq.pendiente"));
    poner("hextraMes", sb.select("horas_extras", `select=horas&fecha=gte.${mes0}&fecha=lte.${mesFin}`));
    poner("form", sb.rpc("formacion_admin_resumen", {}));
    poner("novedades", sb.select("novedades", "select=id&activa=eq.true"));
    poner("docs", sb.select("documentos_personal", "select=usuario_id,tipo,periodo,visto_en,recibido_en,requiere&anulado_en=is.null&limit=2000"));
    poner("nomPartes", sb.select("nominas_partes", `select=usuario_id,mes,estado,publicada_en&mes=eq.${mesAnt0}`));
    poner("candidatos", sb.select("candidatos", "select=id,nombre,estado,creado_en&order=creado_en.desc&limit=300"));
    return () => { vivo = false; };
  }, []);
  return s;
}

const ABRE0 = { horarios: true, cubrir: true };
const CLAVE_LS = "recao_resumen_personas_abiertas";
function useAbiertas() {
  const [ab, setAb] = useState(() => { try { const g = localStorage.getItem(CLAVE_LS); if (g) return JSON.parse(g); } catch (e) { /* sin almacenamiento */ } return ABRE0; });
  const guardar = (n) => { setAb(n); try { localStorage.setItem(CLAVE_LS, JSON.stringify(n)); } catch (e) { /* ignorar */ } };
  return [ab, guardar];
}
function useMovil() {
  const q = "(max-width: 760px)";
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  return m;
}

const INC_OK = new Set(["sin_fichaje", "sin_salida", "cero", "larga", "tarde", "exceso", "sin_turno"]);
const TIPO_TXT = { sin_fichaje: "No fichó", sin_salida: "Falta la salida", cero: "Fichaje de 0 min", larga: "Más de 13 h", tarde: "Entrada después de la hora", exceso: "Salida tarde (¿extra?)", sin_turno: "Fichó sin turno" };

export function PersonasResumen() {
  const s = useDatos();
  const cob = useCobertura(1); const cobMes = (cob.meses || [])[0];
  const [ab, setAb] = useAbiertas();
  const movil = useMovil();
  const hoy = ymd(new Date()), manana = masDias(1);
  const L = (k) => !s[k]; const E = (k) => !!(s[k] && s[k].error); const V = (k) => (s[k] && s[k].v) || null;

  const us = V("usuarios") || [];
  const nombres = useMemo(() => Object.fromEntries(us.map((u) => [u.id, u.nombre])), [s.usuarios]);
  const hor = V("horarios") || [];
  const huecos15 = useMemo(() => huecosCobertura(hor.filter((h) => h.fecha <= masDias(14))).filter((x) => x.fecha >= hoy), [s.horarios]);
  const bolsa = V("bolsa") || [];
  const bolsaAbierta = bolsa.filter((b) => b.estado === "abierto" && b.fecha >= hoy);
  const enBolsa = new Set(bolsaAbierta.map((b) => `${b.fecha}|${b.turno}`));
  const urg = bolsaAbierta.filter((b) => b.fecha <= masDias(DIAS_URGENTE));

  const hoyTurnos = hor.filter((h) => h.fecha === hoy && !NO_TRABAJO.has(h.turno));
  const fichHoy = V("fichHoy") || [];
  const estadoFich = (h) => {
    const f = fichHoy.filter((x) => x.usuario_id === h.usuario_id).sort((a, b) => String(a.entrada).localeCompare(String(b.entrada)))[0];
    if (f) return { t: `✓ fichó ${horaDe(f.entrada)}`, c: "ok" };
    const ini = inicioTurno(h.turno, hoy);
    if (ini && ahoraHM() >= ini) return { t: "Sin fichar", c: "rojo" };
    return { t: ini ? `entra a las ${ini}` : "—", c: "gris" };
  };
  const sinFichar = E("fichHoy") ? 0 : hoyTurnos.filter((h) => estadoFich(h).c === "rojo").length;

  const panel = V("fichPanel") || {};
  const incs = (panel.dias || []).filter((x) => (x.incidencias || []).some((i) => INC_OK.has(i)) && !x.revisado);
  const solFich = (panel.solicitudes || []).filter((x) => x.estado === "pendiente");
  const porTipo = {}; incs.forEach((x) => (x.incidencias || []).forEach((i) => { if (INC_OK.has(i)) porTipo[i] = (porTipo[i] || 0) + 1; }));
  const porPers = useMemo(() => {
    const m = new Map();
    for (const x of (V("fichMes") || {}).dias || []) { const p = m.get(x.usuario_id) || { n: x.nombre, t: 0, f: 0 }; p.t += Number(x.horas_turno || 0); p.f += Number(x.horas_fichadas || 0); m.set(x.usuario_id, p); }
    return [...m.values()].sort((a, b) => a.n.localeCompare(b.n, "es"));
  }, [s.fichMes]);
  const totT = porPers.reduce((a, p) => a + p.t, 0), totF = porPers.reduce((a, p) => a + p.f, 0);

  const mesAct = hoy.slice(0, 7);
  const mesPrev = (() => { const d = new Date(`${mesAct}-01T12:00:00`); d.setMonth(d.getMonth() - 1); return ymd(d).slice(0, 7); })();
  const cierres = V("cierres") || [];
  const calc = (filtro) => { let h = 0, t = 0; cierres.filter(filtro).forEach((c) => (c.items || []).forEach((i) => { t++; if (i.hecha) h++; })); return { h, t, p: pct(h, t) }; };
  const cAct = calc((c) => c.fecha.startsWith(mesAct)); const cPrev = calc((c) => c.fecha.startsWith(mesPrev));
  const cMan = calc((c) => c.fecha.startsWith(mesAct) && c.turno === "mañana"); const cTar = calc((c) => c.fecha.startsWith(mesAct) && c.turno === "tarde");
  const sem6 = useMemo(() => { let h = 0, t = 0; (V("semanas") || []).forEach((c) => (c.items || []).forEach((i) => { t++; if (i.hecha) h++; })); return pct(h, t); }, [s.semanas]);
  const sinCerrar = (V("sinCerrar") || {}).items || [];
  const revisadas = new Set((V("causas") || []).map((c) => c.cierre_item_id));
  const porRevisar = (V("incid") || []).filter((i) => !i.cierre_item_id || !revisadas.has(i.cierre_item_id)).length;
  const avisosAb = (V("avisos") || []).length;
  const repiten = (V("extras") || {}).repiten || 0;

  const vacSol = (V("vacSol") || []).length, camb = (V("cambios") || []).length;
  const vacs = useMemo(() => tramos(hor.filter((h) => h.turno === "Vacaciones" && h.fecha <= masDias(45))), [s.horarios]);
  const vacPers = new Set(vacs.map((v) => v.uid)).size;

  const bMes = bolsa.filter((b) => b.fecha.startsWith(mesAct)); const bPrev = bolsa.filter((b) => b.fecha.startsWith(mesPrev));
  const cub = (arr) => arr.filter((b) => b.estado === "cubierto").length;
  const tiempoMedio = (arr) => { const t = arr.filter((b) => b.estado === "cubierto" && b.cogido_en && b.publicado_en).map((b) => (new Date(b.cogido_en) - new Date(b.publicado_en)) / 3600000); return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null; };
  const fmtTiempo = (h) => (h == null ? "—" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} días`);
  const apoyos = bMes.filter((b) => b.destino === "eventuales"), plant = bMes.filter((b) => b.destino === "plantilla");
  const cubSem = bolsa.filter((b) => b.estado === "cubierto" && b.cogido_en && b.cogido_en.slice(0, 10) >= masDias(-6)).length;

  const trab = us.filter((u) => u.activo && u.rol === "trabajadora");
  const nPrinc = trab.filter((u) => !u.eventual && u.tipo_turno === "principal").length;
  const nApoyo = trab.filter((u) => !u.eventual && u.tipo_turno !== "principal").length;
  const nEvent = trab.filter((u) => u.eventual).length;
  const fp = (V("form") || {}).personas || [];
  const alDia = fp.filter((p) => p.total > 0 && p.completos === p.total).length;
  const rojosForm = fp.filter((p) => p.rojo).length;
  const hextraMes = (V("hextraMes") || []).reduce((a, x) => a + Number(x.horas || 0), 0);
  const nHextra = (V("hextra") || []).length;

  const docs = V("docs") || [];
  const mesNomina = `${mesPrev}-01`;
  const nomDocs = docs.filter((d) => d.tipo === "nomina" && d.periodo && d.periodo.startsWith(mesPrev));
  const nomPub = new Set([...nomDocs.map((d) => d.usuario_id), ...(V("nomPartes") || []).filter((p) => p.publicada_en).map((p) => p.usuario_id)]);
  const esperadas = us.filter((u) => u.activo && u.rol === "trabajadora" && u.documentos_electronicos_en).length;
  const nomVistas = nomDocs.filter((d) => d.visto_en).length;
  const sinAcuse = docs.filter((d) => d.requiere && d.requiere !== "ninguno" && !d.recibido_en && !d.visto_en).length;
  const nomFalta = esperadas > 0 ? Math.max(0, esperadas - nomPub.size) : 0;

  const cands = V("candidatos") || [];
  const nuevas = cands.filter((c) => !["descartada", "interesa", "entrevista"].includes(c.estado));
  const nuevasSem = nuevas.filter((c) => c.creado_en && c.creado_en.slice(0, 10) >= masDias(-6)).length;
  const entrev = cands.filter((c) => c.estado === "entrevista");

  const franja = [];
  const sc0 = sinCerrar[0];
  if (!E("sinCerrar")) franja.push({ k: "cerrar", c: sinCerrar.length ? "rojo" : "ok", n: sinCerrar.length, t: "Turnos sin cerrar", d: sc0 ? `${sc0.turno} del ${diaCorto(sc0.fecha)}${sc0.principal_nombre ? ` · ${sc0.principal_nombre}` : ""}` : "Al día", ruta: "personas/seguimiento/disciplina" });
  if (!E("horarios")) franja.push({ k: "hueco", c: huecos15.length ? "rojo" : "ok", n: huecos15.length, t: "Turnos sin cubrir (15 días)", d: huecos15[0] ? `${huecos15[0].turno}, ${diaCorto(huecos15[0].fecha)}` : "Al día", ruta: "personas/horarios" });
  if (!E("bolsa")) franja.push({ k: "bolsa", c: urg.length ? "rojo" : "ok", n: urg.length, t: "Bolsa urgente", d: urg[0] ? `${urg[0].turno}, ${diaCorto(urg[0].fecha)}` : `a ${DIAS_URGENTE} días o menos`, ruta: "personas/bolsa" });
  if (!E("vacSol") && !E("cambios")) franja.push({ k: "rev", c: vacSol + camb ? "ama" : "ok", n: vacSol + camb, t: "Vacaciones y cambios por revisar", d: vacSol + camb ? `${pl(vacSol, "vacación", "vacaciones")} · ${pl(camb, "cambio", "cambios")}` : "Al día", ruta: "personas/solicitudes" });
  if (!E("fichPanel")) franja.push({ k: "fich", c: incs.length ? "ama" : "ok", n: incs.length, t: "Fichajes con incidencia", d: incs.length ? pl(solFich.length, "corrección pendiente", "correcciones pendientes") : "Al día", ruta: "personas/fichajes" });
  if (!E("docs") && !E("nomPartes") && !E("usuarios")) franja.push({ k: "nom", c: nomFalta ? "ama" : "ok", n: nomFalta, t: `Nóminas de ${nomMes(mesNomina)} sin publicar`, d: nomFalta ? `${nomPub.size} de ${esperadas} publicadas` : "Todas publicadas", ruta: "personas/documentos" });
  const hayUrgente = franja.some((f) => f.c !== "ok");
  const cargandoFranja = ["sinCerrar", "horarios", "bolsa", "vacSol", "fichPanel", "docs"].some(L);

  const est = (id) => (id in ab ? ab[id] : false);
  const ids = ["horarios", "cubrir", "fichajes", "vacaciones", "bolsa", "equipo", "seguimiento", "documentos", "seleccion"];
  const todasAbiertas = ids.every(est);
  const abrirTodas = () => setAb(Object.fromEntries(ids.map((i) => [i, !todasAbiertas])));
  const P = (id) => ({ abierta: est(id), onToggle: () => setAb({ ...ab, [id]: !est(id) }) });

  const dias7 = Array.from({ length: 7 }, (_, i) => masDias(i));
  const quien = (f, t) => hor.filter((h) => h.fecha === f && h.turno === t).map((h) => (nombres[h.usuario_id] || "—").split(" ")[0]);
  const sinCubrir7 = new Set(huecos15.filter((h) => h.fecha <= masDias(6)).map((h) => h.fecha)).size;
  const horariosHoy = [...hoyTurnos].sort((a, b) => (inicioTurno(a.turno, hoy) || "").localeCompare(inicioTurno(b.turno, hoy) || ""));
  const mananaN = hor.filter((h) => h.fecha === manana && !NO_TRABAJO.has(h.turno)).length;

  const W = {
    horarios: (
      <Ventana {...P("horarios")} icono="🗓" nombre="Horarios" cargando={L("horarios")} error={E("horarios")} ruta="personas/horarios" rutaTxt="Horarios"
        clave={`Hoy ${pl(hoyTurnos.length, "persona", "personas")} · mañana ${mananaN}`}
        etiquetas={[sinFichar > 0 && <Etiqueta key="a" c="rojo">{sinFichar} sin fichar</Etiqueta>, sinCubrir7 > 0 && <Etiqueta key="b" c="rojo">{pl(sinCubrir7, "día sin cubrir", "días sin cubrir")}</Etiqueta>]}>
        <h3>Hoy en tienda</h3>
        {horariosHoy.length === 0 ? <p className="empty">Sin turnos puestos hoy.</p> : (
          <ul className="rs-lista">{horariosHoy.map((h) => { const e = E("fichHoy") ? { t: "—", c: "gris" } : estadoFich(h); return (
            <li key={h.usuario_id + h.turno}><b>{nombres[h.usuario_id] || "—"}</b><span>{h.turno} · {horasTurno(h.turno, hoy)}</span><Etiqueta c={e.c}>{e.t}</Etiqueta></li>); })}</ul>)}
        <h3>Cobertura de los próximos 7 días</h3>
        <div className="tabla-scroll"><table className="rs-rejilla"><thead><tr><th></th>{dias7.map((f) => <th key={f}>{diaMini(f)}</th>)}</tr></thead>
          <tbody>{[...TURNOS_REQUERIDOS, ...(dias7.some((f) => requeridosDe(f).includes("Apoyo 3")) ? ["Apoyo 3"] : [])].map((t) => (<tr key={t}><th>{t}</th>{dias7.map((f) => { const q = requeridosDe(f).includes(t) ? quien(f, t) : null; return <td key={f} className={q && !q.length ? "hueco" : ""}>{q == null ? "" : q.length ? q.join(", ") : "Sin cubrir"}</td>; })}</tr>))}</tbody></table></div>
      </Ventana>),
    cubrir: (
      <Ventana {...P("cubrir")} icono="⚠️" nombre="Turnos sin cubrir" cargando={L("horarios")} error={E("horarios")} ruta="personas/horarios" rutaTxt="Horarios"
        clave={huecos15.length ? `${pl(huecos15.length, "turno sin cubrir", "turnos sin cubrir")} en 15 días` : "Todo cubierto en 15 días"}
        etiquetas={[huecos15.length ? <Etiqueta key="a" c="rojo">{huecos15.length}</Etiqueta> : <Etiqueta key="a" c="ok">Al día</Etiqueta>]}>
        {huecos15.length === 0 ? <p className="empty">✓ Todos los turnos obligatorios están cubiertos.</p> : (
          <ul className="rs-lista">{huecos15.map((h) => { const n = dif(h.fecha, hoy); return (
            <li key={h.fecha + h.turno}><b>{diaCorto(h.fecha)}</b><span>{h.turno} · {horasTurno(h.turno, h.fecha)} · {enBolsa.has(`${h.fecha}|${h.turno}`) ? "en la bolsa" : "no está en la bolsa"}</span>
              <Etiqueta c={n <= 7 ? "rojo" : "ama"}>{n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`}</Etiqueta>
              <a className="rs-btn" href="#/personas/horarios">Asignar</a></li>); })}</ul>)}
      </Ventana>),
    fichajes: (
      <Ventana {...P("fichajes")} icono="⏱" nombre="Fichajes" cargando={L("fichMes") || L("fichPanel")} error={E("fichMes") && E("fichPanel")} ruta="personas/fichajes" rutaTxt="Fichajes"
        clave={E("fichMes") ? "Sin horas del mes" : `${h1(totF)} fichadas de ${h1(totT)} de turno`}
        etiquetas={[incs.length > 0 && <Etiqueta key="a" c="ama">{pl(incs.length, "incidencia", "incidencias")}</Etiqueta>, solFich.length > 0 && <Etiqueta key="b" c="ama">{pl(solFich.length, "corrección", "correcciones")}</Etiqueta>]}>
        <h3>Horas del mes: fichadas / de turno</h3>
        {porPers.length === 0 ? <p className="empty">Todavía no hay horas este mes.</p> : porPers.map((p) => <Barra key={p.n} etiqueta={p.n} valor={pct(p.f, p.t) ?? (p.f > 0 ? 100 : 0)} texto={`${h1(p.f)} / ${h1(p.t)}`} />)}
        <h3>Incidencias por revisar</h3>
        {Object.keys(porTipo).length === 0 ? <p className="empty">✓ Sin incidencias.</p> : <ul className="rs-lista">{Object.entries(porTipo).map(([k, n]) => <li key={k}><b>{TIPO_TXT[k]}</b><span></span><Etiqueta c="ama">{n}</Etiqueta></li>)}</ul>}
      </Ventana>),
    vacaciones: (
      <Ventana {...P("vacaciones")} icono="🏖" nombre="Vacaciones y cambios" cargando={L("horarios")} error={E("horarios")} ruta="personas/solicitudes" rutaTxt="Solicitudes"
        clave={vacPers ? `${pl(vacPers, "persona", "personas")} de vacaciones en 45 días` : "Nadie de vacaciones en 45 días"}
        etiquetas={[vacSol > 0 && <Etiqueta key="a" c="ama">{pl(vacSol, "vacación", "vacaciones")}</Etiqueta>, camb > 0 && <Etiqueta key="b" c="ama">{pl(camb, "cambio", "cambios")}</Etiqueta>]}>
        <h3>De vacaciones</h3>
        {vacs.length === 0 ? <p className="empty">Nadie de vacaciones.</p> : <ul className="rs-lista">{vacs.slice(0, 10).map((v) => <li key={v.uid + v.ini}><b>{nombres[v.uid] || "—"}</b><span>{v.ini === v.fin ? diaCorto(v.ini) : `${diaCorto(v.ini)} → ${diaCorto(v.fin)}`}</span></li>)}</ul>}
        <h3>Por revisar</h3>
        <p>{pl(vacSol, "solicitud de vacaciones", "solicitudes de vacaciones")} · {pl(camb, "cambio de turno", "cambios de turno")}</p>
      </Ventana>),
    bolsa: (
      <Ventana {...P("bolsa")} icono="🔄" nombre="Cobertura de turnos" cargando={cob.cargando} error={!!cob.error || !BOLSA_ACTIVA} ruta="personas/bolsa" rutaTxt="Bolsa"
        clave={cobMes ? `${cobMes.pct == null ? "—" : cobMes.pct + " %"} este mes · meta ${cob.cfg.meta} %` : "sin datos"}
        etiquetas={[cobMes && <Etiqueta key="a" c={{ verde: "ok", ambar: "ama", rojo: "rojo", gris: "gris" }[colorNota(cobMes.pct, cob.cfg)]}>{cobMes.pct ?? "—"} %</Etiqueta>, urg.length > 0 && <Etiqueta key="b" c="rojo">{urg.length} urgente{urg.length > 1 ? "s" : ""}</Etiqueta>]}>
        {cobMes && <NotaMes m={cobMes} cfg={cob.cfg} titulo={nomMes(cobMes.mes)} />}
        <PorCubrir turnos={cob.turnos} />
        <Cifras items={[{ n: bolsaAbierta.length, t: "abiertos" }, { n: urg.length, t: `a ${DIAS_URGENTE} días o menos` }, { n: cubSem, t: "cubiertos esta semana" }]} />
      </Ventana>),
    equipo: (
      <Ventana {...P("equipo")} icono="👥" nombre="Equipo" cargando={L("usuarios")} error={E("usuarios")} ruta="personas/equipo" rutaTxt="Equipo"
        clave={`${nPrinc} principales · ${nApoyo} apoyos · ${nEvent} eventuales`}
        etiquetas={[nHextra > 0 && <Etiqueta key="a" c="ama">{nHextra} extra por confirmar</Etiqueta>, rojosForm > 0 && <Etiqueta key="b" c="rojo">{rojosForm} con formación atrasada</Etiqueta>]}>
        {E("form") ? <p className="empty">Formación sin datos por ahora.</p> : <Anillo valor={pct(alDia, fp.length)} texto="al día en formación" sub={rojosForm ? `${pl(rojosForm, "persona lleva", "personas llevan")} más de 21 días sin ver un vídeo` : "Nadie lleva más de 21 días sin ver un vídeo"} />}
        <Cifras items={[{ n: h1(hextraMes), t: "horas extra del mes" }, { n: nHextra, t: "extra por confirmar", c: "ama", ruta: "personas/equipo" }, { n: (V("novedades") || []).length, t: "novedades activas" }]} />
        <p className="sub">El plus del mes por persona se ve en Equipo.</p>
      </Ventana>),
    seguimiento: (
      <Ventana {...P("seguimiento")} icono="✅" nombre="Seguimiento" cargando={L("cierres")} error={E("cierres")} ruta="personas/seguimiento" rutaTxt="Seguimiento"
        clave={`Tareas hechas por el equipo en ${nomMes(`${mesAct}-01`)}: ${cAct.p ?? "—"} %`}
        etiquetas={[avisosAb > 0 && <Etiqueta key="a" c="ama">{pl(avisosAb, "aviso abierto", "avisos abiertos")}</Etiqueta>]}>
        <Anillo valor={cAct.p} texto="de las tareas hechas" sub={`${cAct.h} de ${cAct.t}${cPrev.p != null ? ` · mes anterior ${cPrev.p} %` : ""}`} />
        <Barra etiqueta="Turno de mañana" valor={cMan.p || 0} texto={cMan.p == null ? "—" : `${cMan.p} %`} />
        <Barra etiqueta="Turno de tarde" valor={cTar.p || 0} texto={cTar.p == null ? "—" : `${cTar.p} %`} />
        <p className="sub">Últimas 6 semanas: {sem6 == null ? "—" : `${sem6} %`}</p>
        <Cifras items={[
          { n: avisosAb, t: "avisos con plazo abierto", ruta: "personas/seguimiento/disciplina" },
          { n: porRevisar, t: "verificaciones por revisar", ruta: "personas/seguimiento/incidencias" },
          { n: sinCerrar.length, t: "turnos sin cerrar", c: "rojo", ruta: "personas/seguimiento/disciplina" },
          { n: repiten, t: "tareas extra que se repiten", ruta: "personas/seguimiento/tareas-extra" },
        ]} />
        <p className="sub">Los expedientes abiertos están en Disciplina.</p>
      </Ventana>),
    documentos: (
      <Ventana {...P("documentos")} icono="📄" nombre="Documentos" cargando={L("docs")} error={E("docs")} ruta="personas/documentos" rutaTxt="Documentos"
        clave={`Nóminas de ${nomMes(mesNomina)}: ${nomPub.size} publicadas`}
        etiquetas={[sinAcuse > 0 && <Etiqueta key="a" c="ama">{sinAcuse} sin acuse</Etiqueta>]}>
        <Cifras items={[{ n: nomPub.size, t: "nóminas publicadas" }, { n: nomVistas, t: "vistas por la trabajadora" }, { n: sinAcuse, t: "documentos sin acuse", c: "ama", ruta: "personas/documentos" }]} />
        <h3>Contratos y prórrogas · próximos 60 días</h3>
        <p className="empty">Todavía no hay fechas de contrato, prórroga o periodo de prueba guardadas; cuando se guarden, saldrán aquí.</p>
      </Ventana>),
    seleccion: (
      <Ventana {...P("seleccion")} icono="🧑‍💼" nombre="Selección" cargando={L("candidatos")} error={E("candidatos")} ruta="personas/seleccion" rutaTxt="Selección"
        clave={`${pl(nuevasSem, "candidatura nueva", "candidaturas nuevas")} esta semana`}
        etiquetas={[entrev.length > 0 && <Etiqueta key="a" c="ama">{pl(entrev.length, "entrevista", "entrevistas")}</Etiqueta>]}>
        <Cifras items={[{ n: nuevasSem, t: "nuevas esta semana" }, { n: nuevas.length, t: "por revisar", c: "ama", ruta: "personas/seleccion" }, { n: entrev.length, t: "en entrevista" }]} />
        {entrev.length > 0 && <ul className="rs-lista">{entrev.map((c) => <li key={c.id}><b>{c.nombre}</b><span>entrevista</span></li>)}</ul>}
      </Ventana>),
  };
  const izq = ["horarios", "fichajes", "bolsa", "seguimiento"];
  const der = ["cubrir", "vacaciones", "equipo", "documentos", "seleccion"];
  const ordenMovil = ["horarios", "cubrir", "fichajes", "vacaciones", "bolsa", "equipo", "seguimiento", "documentos", "seleccion"];
  const col = (l) => <div className="rs-col">{l.map((i) => <div key={i}>{W[i]}</div>)}</div>;

  return (
    <div className="rs">
      <section className="rs-franja" aria-label="Lo urgente">
        {cargandoFranja && franja.length === 0 ? <Cargando /> : !hayUrgente ? (
          <div className="rs-todo-ok"><b>✓</b><span>Todo al día</span></div>
        ) : (
          <div className="rs-recuadros">{franja.map((f) => (
            <a key={f.k} className={`rs-rec ${f.c}`} href={`#/${f.ruta}`}><b>{f.n}</b><span>{f.t}</span><small>{f.d}</small></a>))}</div>
        )}
      </section>
      <div className="rs-barra-top"><button className="btn-l" onClick={abrirTodas}>{todasAbiertas ? "Cerrar todas" : "Abrir todas"}</button></div>
      {movil ? col(ordenMovil) : <div className="rs-cols">{col(izq)}{col(der)}</div>}
    </div>
  );
}
