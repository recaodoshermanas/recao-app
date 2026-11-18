import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, SHADOW, avatar } from "../../lib/styles.js";
import { sb, supabase } from "../../lib/supabase.js";
import { EvaluacionSheet } from "./EvaluacionSheet.jsx";
import { RankingView } from "./RankingView.jsx";
import { resultadoGuardado } from "../../lib/evaluacionCandidatas.js";

const CRIT = [["c_experiencia", "Experiencia", "Exp."], ["c_cercania", "Cercanía", "Cerca"], ["c_turnos", "Turnos", "Turnos"], ["c_incorporacion", "Incorporación", "Ya"]];
const TABS = [["revisar", "Por revisar"], ["interesa", "Interesan"], ["entrevista", "Entrevista"], ["descartada", "Descartadas"]];
const FILTROS = [["cual", "Cualificadas"], ["c_experiencia", "Experiencia"], ["c_cercania", "Cerca"], ["c_incorporacion", "Disponible ya"], ["sincv", "Sin CV legible"]];
const ESTADO_L = { revisar: "Por revisar", interesa: "Interesan", entrevista: "Entrevista", descartada: "Descartada" };
const puntos = (c) => CRIT.reduce((n, [k]) => n + (c[k] === "Sí" ? 1 : 0), 0);
const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function fmtF(f) { if (!f) return ""; const d = new Date(f); return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
// #212: WhatsApp de primer contacto. Mismo criterio de móvil que la función whatsapp-candidatas
function telWa(v) {
  let d = String(v ?? "").trim().replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  const dig = d.replace(/\D/g, "");
  if (d.startsWith("+")) return dig.length >= 10 && dig.length <= 15 ? dig : null;
  if (dig.length === 9 && /^[67]/.test(dig)) return "34" + dig;
  if (dig.length === 11 && /^34[67]/.test(dig)) return dig;
  return null;
}
const PUESTO_L = { principal: "Principal", apoyo: "Apoyo" };
const nombrePila = (n) => { const p = String(n || "").trim().split(/\s+/)[0] || ""; return p ? p.charAt(0).toLocaleUpperCase("es") + p.slice(1).toLocaleLowerCase("es") : "hola"; };
function fmtDiaHora(f) { if (!f) return ""; return new Date(f).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
function fmtDia(f) { if (!f) return ""; return new Date(f).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }); }
// Resumen del WhatsApp de una candidata: último envío, respuesta (botón) posterior y mensajes recibidos
function resumenWa(msgs) {
  if (!msgs || !msgs.length) return null;
  const envios = msgs.filter((m) => m.sentido === "salida" && m.tipo === "plantilla");
  const ultEnvio = envios[envios.length - 1] || null;
  const ultError = [...msgs].reverse().find((m) => m.sentido === "salida") || null;
  const entradas = msgs.filter((m) => m.sentido === "entrada");
  const botones = entradas.filter((m) => m.tipo === "boton" && (!ultEnvio || m.creado_en >= ultEnvio.creado_en));
  const respuesta = botones[botones.length - 1] || null;
  const fallidoEnvio = ultEnvio && ultEnvio.estado === "fallido";
  const etiqueta = !ultEnvio ? null : respuesta ? respuesta.texto : fallidoEnvio ? null : "Esperando respuesta";
  return { ultEnvio, ultError: ultError && (ultError.tipo === "error" || ultError.estado === "fallido") ? ultError : null, entradas, respuesta, etiqueta };
}
function EtiquetaWa({ r }) {
  if (!r?.etiqueta) return null;
  const st = r.etiqueta === "Me interesa" ? { bg: "#E7F3EC", fg: "#1E7A46" } : r.etiqueta === "No me interesa" ? { bg: "#ECE8E1", fg: "#6B6358" } : { bg: "#FBF0DA", fg: "#8a6a1e" };
  return <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, color: st.fg, background: st.bg, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{r.etiqueta}</span>;
}

function gmailUrl(id) { return `https://mail.google.com/mail/u/5/#all/${id}`; }

function Foto({ c, size }) {
  if (c.foto) return <img src={c.foto} alt="" style={{ width: size, height: size, objectFit: "cover", borderRadius: size > 60 ? 12 : "999px", display: "block", flexShrink: 0 }} />;
  const a = avatar(c.nombre);
  return <span style={{ width: size, height: size, borderRadius: size > 60 ? 12 : "999px", background: a.bg, color: a.fg, fontFamily: SF, fontSize: Math.round(size * 0.38), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.inicial}</span>;
}

function Crit({ c }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
      {CRIT.map(([k, , sh]) => {
        const v = c[k];
        const bg = v === "Sí" ? "#E7F3EC" : v === "No" ? "#FBEAE7" : "#F0EADF";
        const fg = v === "Sí" ? "#1E7A46" : v === "No" ? "#B23A2C" : C.mut;
        return <span key={k} style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: bg, color: fg }}>{sh}{v === "Sí" ? " ✓" : v === "No" ? " ✕" : " ?"}</span>;
      })}
    </div>
  );
}

function CvArchivo({ c }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setUrl(null); setErr(false);
    if (!c.cv_ruta) return;
    let vivo = true;
    supabase.storage.from("curriculums").createSignedUrl(c.cv_ruta, 600).then(({ data, error }) => { if (!vivo) return; if (error || !data?.signedUrl) setErr(true); else setUrl(data.signedUrl); });
    return () => { vivo = false; };
  }, [c.id, c.cv_ruta]);
  if (!c.cv_ruta) return null;
  if (err) return <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 8 }}>No se ha podido abrir el archivo del currículum.</div>;
  if (!url) return <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 8 }}>Cargando currículum…</div>;
  const esImg = (c.cv_mime || "").startsWith("image/");
  return (
    <div style={{ marginTop: 10 }}>
      {esImg ? <img src={url} alt="Currículum" style={{ width: "100%", borderRadius: 12, border: `1px solid ${C.brdL}` }} />
        : <iframe src={url} title="Currículum" style={{ width: "100%", height: "60vh", border: `1px solid ${C.brdL}`, borderRadius: 12, background: "#fff" }} />}
      <a href={url} target="_blank" rel="noopener" style={{ display: "inline-block", marginTop: 6, color: C.blu, fontFamily: F, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Abrir a pantalla completa / descargar ↗</a>
    </div>
  );
}

export function CVCandidatosView({ currentUser, abrirId }) {
  const [rows, setRows] = useState([]);
  const [evals, setEvals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pantalla, setPantalla] = useState("candidatas"); // candidatas | ranking
  const [tab, setTab] = useState("revisar");
  const [vista, setVista] = useState("lista");
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState({});
  const [abierto, setAbierto] = useState(null);
  const [evaluando, setEvaluando] = useState(null);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };
  // #212: WhatsApp de primer contacto
  const [wa, setWa] = useState([]);
  const [waInfo, setWaInfo] = useState(null);
  const [waElegir, setWaElegir] = useState(null); // { c, puesto }
  const [waErr, setWaErr] = useState("");
  const loadWa = useCallback(async () => {
    try { setWa(await sb.select("candidatos_whatsapp", "select=*&order=creado_en.asc")); } catch (e) { /* tabla sin acceso: no se muestra */ }
  }, []);
  useEffect(() => { loadWa(); sb.fn("whatsapp-candidatas", { action: "estado" }).then(setWaInfo).catch(() => setWaInfo({ recepcion_activa: false })); }, [loadWa]);
  const waPor = useMemo(() => { const m = {}; wa.forEach((x) => { (m[x.candidato_id] = m[x.candidato_id] || []).push(x); }); return m; }, [wa]);
  const waRes = (c) => resumenWa(waPor[c.id]);
  const abrirWa = (c) => {
    setWaErr("");
    const r = waRes(c);
    if (r?.ultEnvio && !window.confirm(`Ya se le envió el ${fmtDia(r.ultEnvio.creado_en)}. ¿Enviar otra vez?`)) return;
    setWaElegir({ c, puesto: null });
  };
  const enviarWa = async () => {
    const { c, puesto } = waElegir || {};
    if (!c || !puesto) return;
    setBusy(true); setWaErr("");
    try { await sb.fn("whatsapp-candidatas", { action: "enviar", candidato_id: c.id, puesto }); setWaElegir(null); flash("WhatsApp enviado"); }
    catch (e) { setWaErr(e.message || "No se ha podido enviar"); }
    await loadWa();
    setBusy(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await sb.select("candidatos", "select=*&order=fecha_correo.desc")); } catch (e) { flash(e.message || "Error"); }
    setLoading(false);
  }, []);
  const loadEvals = useCallback(async () => {
    try { setEvals(await sb.select("evaluaciones_candidato", "select=*")); } catch (e) { /* noop */ }
  }, []);
  useEffect(() => { load(); loadEvals(); }, [load, loadEvals]);
  // #212: el aviso de la campana abre la ficha de la candidata (personas/seleccion/<id>)
  useEffect(() => {
    if (!abrirId || !rows.length) return;
    const c = rows.find((x) => String(x.id) === String(abrirId));
    if (c) { setPantalla("candidatas"); setTab(c.estado); abrir(c); loadWa(); }
  }, [abrirId, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const evalsById = useMemo(() => { const m = {}; evals.forEach(e => { m[e.candidato_id] = e; }); return m; }, [evals]);

  const toggleF = (k) => setFiltros(p => { const n = { ...p }; if (n[k]) delete n[k]; else n[k] = true; return n; });

  const mover = async (c, estado) => {
    setBusy(true);
    setRows(prev => prev.map(x => x.id === c.id ? { ...x, estado } : x));
    setAbierto(a => a && a.id === c.id ? { ...a, estado } : a);
    try { await sb.update("candidatos", `id=eq.${c.id}`, { estado, actualizado_en: new Date().toISOString() }); flash(ESTADO_L[estado]); } catch (e) { flash(e.message || "Error"); load(); }
    setBusy(false);
  };
  const guardarNota = async (c) => {
    setBusy(true);
    setRows(prev => prev.map(x => x.id === c.id ? { ...x, nota } : x));
    try { await sb.update("candidatos", `id=eq.${c.id}`, { nota, actualizado_en: new Date().toISOString() }); flash("Nota guardada"); } catch (e) { flash(e.message || "Error"); }
    setBusy(false);
  };
  const abrir = (c) => { setAbierto(c); setNota(c.nota || ""); };

  const conteo = useMemo(() => { const m = {}; TABS.forEach(([k]) => m[k] = rows.filter(r => r.estado === k).length); return m; }, [rows]);
  const cualificadas = useMemo(() => rows.filter(r => r.estado !== "descartada" && puntos(r) >= 2).length, [rows]);

  const lista = useMemo(() => {
    const nq = norm(q);
    return rows.filter(c => {
      if (c.estado !== tab) return false;
      if (filtros.cual && puntos(c) < 2) return false;
      if (filtros.c_experiencia && c.c_experiencia !== "Sí") return false;
      if (filtros.c_cercania && c.c_cercania !== "Sí") return false;
      if (filtros.c_incorporacion && c.c_incorporacion !== "Sí") return false;
      if (filtros.sincv && c.cv_texto) return false;
      if (nq && !(norm(c.nombre).includes(nq) || norm(c.poblacion).includes(nq) || norm(c.resumen).includes(nq))) return false;
      return true;
    });
  }, [rows, tab, filtros, q]);

  const acciones = (c, full) => {
    const b = (bg, fg, est, txt) => <button key={est} onClick={() => mover(c, est)} disabled={busy} style={{ flex: full ? 1 : "none", background: bg, color: fg, border: "none", borderRadius: 10, padding: full ? "11px 10px" : "8px 12px", fontFamily: F, fontSize: full ? 13.5 : 12.5, fontWeight: 700, cursor: "pointer" }}>{txt}</button>;
    if (c.estado === "descartada") return <div style={{ display: "flex", gap: 8 }}>{b("#fff", C.mut, "revisar", "Devolver a revisar")}</div>;
    return <div style={{ display: "flex", gap: 8 }}>
      {c.estado !== "interesa" && b("#E7F3EC", "#1E7A46", "interesa", "Interesa")}
      {c.estado !== "entrevista" && b("#FBF0DA", "#8a6a1e", "entrevista", "Entrevista")}
      {b("#FBEAE7", "#B23A2C", "descartada", "Descartar")}
    </div>;
  };

  // Resumen de la evaluación para la ficha
  const evalResumen = (c) => {
    const ev = evalsById[c.id];
    if (!ev) return null;
    const calc = resultadoGuardado(ev);
    return { ev, calc };
  };

  const abrirEval = (c) => { setEvaluando(c); };

  return (
    <div style={{ padding: "14px 14px 24px", maxWidth: 680, margin: "0 auto" }}>
      {msg && <div style={{ position: "sticky", top: 96, zIndex: 12, fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      {/* Toggle Candidatas / Ranking */}
      <div style={{ display: "flex", gap: 3, background: "#EFE9DD", borderRadius: 11, padding: 3, marginBottom: 12 }}>
        {[["candidatas", "Candidatas"], ["ranking", "Ranking"]].map(([k, l]) => (
          <button key={k} onClick={() => setPantalla(k)} style={{ flex: 1, padding: "9px 8px", borderRadius: 8, border: "none", background: pantalla === k ? "#fff" : "transparent", color: pantalla === k ? C.char : C.mut, fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: pantalla === k ? SHADOW.card : "none" }}>{l}</button>
        ))}
      </div>

      {pantalla === "ranking" ? (
        <RankingView candidatos={rows} evaluaciones={evals} onOpen={abrirEval} />
      ) : (
      <>
      <div style={{ display: "flex", gap: 3, background: "#EFE9DD", borderRadius: 11, padding: 3, marginBottom: 12, overflowX: "auto" }}>
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, whiteSpace: "nowrap", padding: "8px 8px", borderRadius: 8, border: "none", background: tab === k ? "#fff" : "transparent", color: tab === k ? C.char : C.mut, fontFamily: F, fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: tab === k ? SHADOW.card : "none" }}>{l} <span style={{ color: tab === k ? C.goldDark : C.mutL }}>{conteo[k] || 0}</span></button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, población, experiencia…" style={{ flex: 1, boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "9px 12px", fontFamily: F, fontSize: 13.5, color: C.char, outline: "none" }} />
        <div style={{ display: "flex", background: "#EFE9DD", borderRadius: 10, padding: 3 }}>
          {[["lista", "Lista"], ["fotos", "Fotos"]].map(([v, l]) => <button key={v} onClick={() => setVista(v)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: vista === v ? "#fff" : "transparent", color: vista === v ? C.char : C.mut, fontFamily: F, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {FILTROS.map(([k, l]) => { const on = !!filtros[k]; return <button key={k} onClick={() => toggleF(k)} style={{ fontFamily: F, fontSize: 12, fontWeight: 600, padding: "6px 11px", borderRadius: 999, cursor: "pointer", border: `1.5px solid ${on ? C.char : C.brd}`, background: on ? C.char : "#fff", color: on ? C.gold : C.mut }}>{l}{k === "cual" ? ` (${cualificadas})` : ""}</button>; })}
      </div>

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 30 }}>Cargando…</div>
        : lista.length === 0 ? <div style={{ fontFamily: SF, fontSize: 15, color: C.mut, textAlign: "center", padding: 34 }}>{tab === "revisar" ? "No hay candidatas con estos filtros." : "Aún no hay nadie aquí. Muévelas desde «Por revisar»."}</div>
          : vista === "fotos" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
              {lista.map(c => (
                <button key={c.id} onClick={() => abrir(c)} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: 8, cursor: "pointer", textAlign: "center", boxShadow: SHADOW.card }}>
                  <div style={{ display: "flex", justifyContent: "center" }}><Foto c={c} size={78} /></div>
                  <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: C.char, marginTop: 6, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nombre}</div>
                  <div style={{ fontFamily: F, fontSize: 10, color: puntos(c) >= 2 ? "#1E7A46" : C.mutL, marginTop: 2 }}>{puntos(c)}/4 criterios</div>
                </button>
              ))}
            </div>
          ) : (
            lista.map(c => {
              const er = tab === "entrevista" ? evalResumen(c) : null;
              return (
              <div key={c.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: SHADOW.card }}>
                <div onClick={() => abrir(c)} style={{ display: "flex", gap: 12, cursor: "pointer" }}>
                  <Foto c={c} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{c.nombre}</span>
                      <span style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {tab === "interesa" && <EtiquetaWa r={waRes(c)} />}
                        {puntos(c) >= 2 && <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, color: "#1E7A46", background: "#E7F3EC", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>Cualificada</span>}
                      </span>
                    </div>
                    <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 1 }}>{c.poblacion || "Población no indicada"}{c.fecha_correo ? ` · ${fmtF(c.fecha_correo)}` : ""}</div>
                    <Crit c={c} />
                  </div>
                </div>
                <div style={{ fontFamily: F, fontSize: 13, color: C.char, lineHeight: 1.45, marginTop: 10 }}>{c.resumen}</div>
                {tab === "entrevista" && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={() => abrirEval(c)} style={{ background: C.char, color: C.gold, border: "none", borderRadius: 10, padding: "9px 16px", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{er ? "Ver evaluación" : "Evaluar"}</button>
                    {er && (er.calc.descartada
                      ? <span style={{ fontFamily: F, fontSize: 11.5, color: "#B23A2C" }}>Descartada · {er.calc.motivoDescarte}</span>
                      : er.calc.completa
                        ? <span style={{ fontFamily: F, fontSize: 12.5, color: C.char }}>Nota <b>{er.calc.notaFinal}</b>{er.calc.etiqueta ? ` · ${er.calc.etiqueta.label}` : ""}{er.calc.plantillaAnterior ? " · plantilla anterior" : ""}</span>
                        : <span style={{ fontFamily: F, fontSize: 11.5, color: C.mut }}>Evaluación incompleta</span>)}
                  </div>
                )}
                <div style={{ marginTop: 12 }}>{acciones(c, false)}</div>
              </div>
            ); })
          )}
      </>
      )}

      {abierto && (
        <div onClick={() => setAbierto(null)} style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.cream, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "18px 18px 26px" }}>
            <div style={{ width: 40, height: 4, background: C.brd, borderRadius: 999, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Foto c={abierto} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 20, color: C.char }}>{abierto.nombre}</div>
                <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2 }}>{abierto.poblacion || "Población no indicada"}</div>
                <div style={{ fontFamily: F, fontSize: 11.5, color: C.mutL, marginTop: 1 }}>Estado: {ESTADO_L[abierto.estado] || abierto.estado}</div>
              </div>
            </div>

            {abierto.estado === "entrevista" && (() => {
              const er = evalResumen(abierto);
              return (
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => abrirEval(abierto)} style={{ background: C.char, color: C.gold, border: "none", borderRadius: 11, padding: "11px 18px", fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{er ? "Ver / editar evaluación" : "Evaluar candidata"}</button>
                  {er && (er.calc.descartada
                    ? <span style={{ fontFamily: F, fontSize: 12, color: "#B23A2C" }}>Descartada · {er.calc.motivoDescarte}</span>
                    : er.calc.completa
                      ? <span style={{ fontFamily: F, fontSize: 13, color: C.char }}>Nota <b>{er.calc.notaFinal}</b>{er.calc.etiqueta ? ` · ${er.calc.etiqueta.label}` : ""}{er.calc.plantillaAnterior ? " · plantilla anterior" : ""}</span>
                      : <span style={{ fontFamily: F, fontSize: 12, color: C.mut }}>Incompleta · falta {er.calc.falta.join(", ")}{er.calc.plantillaAnterior ? " · plantilla anterior" : ""}</span>)}
                </div>
              );
            })()}

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "11px 13px" }}>
              {abierto.telefono && <a href={`tel:${abierto.telefono.replace(/\s/g, "")}`} style={{ fontFamily: F, fontSize: 13.5, color: C.blu, textDecoration: "none" }}>📞 {abierto.telefono}</a>}
              {abierto.email && <a href={`mailto:${abierto.email}`} style={{ fontFamily: F, fontSize: 13.5, color: C.blu, textDecoration: "none", wordBreak: "break-all" }}>✉️ {abierto.email}</a>}
            </div>

            {(() => {
              const r = waRes(abierto);
              const tel = telWa(abierto.telefono);
              const puedeEnviar = abierto.estado === "interesa";
              if (!puedeEnviar && !r) return null;
              const lista = r ? r.entradas : [];
              return (
                <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "11px 13px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: F, fontSize: 13, color: C.char, lineHeight: 1.45 }}>
                      {r?.ultEnvio ? <>WhatsApp enviado · {PUESTO_L[r.ultEnvio.puesto] || ""} · {fmtDiaHora(r.ultEnvio.creado_en)}</> : <span style={{ color: C.mut }}>Sin WhatsApp enviado</span>}
                      {r?.ultEnvio && <div style={{ marginTop: 4 }}><EtiquetaWa r={r} />{r.respuesta && <span style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginLeft: 6 }}>{fmtDiaHora(r.respuesta.creado_en)}</span>}</div>}
                    </div>
                    {puedeEnviar && (
                      <button onClick={() => abrirWa(abierto)} disabled={busy || !tel || !waInfo?.recepcion_activa}
                        title={!tel ? "Sin teléfono válido" : !waInfo?.recepcion_activa ? "Falta activar la recepción de respuestas" : ""}
                        style={{ background: tel && waInfo?.recepcion_activa ? "#1E7A46" : "#E5DFD3", color: tel && waInfo?.recepcion_activa ? "#fff" : C.mut, border: "none", borderRadius: 10, padding: "9px 14px", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: tel && waInfo?.recepcion_activa ? "pointer" : "default" }}>
                        {!tel ? "Sin teléfono válido" : "WhatsApp"}
                      </button>
                    )}
                  </div>
                  {puedeEnviar && tel && waInfo && !waInfo.recepcion_activa && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 6 }}>Aún no se puede enviar: falta activar la recepción de respuestas.</div>}
                  {r?.ultError && (!r.ultEnvio || r.ultError.creado_en >= r.ultEnvio.creado_en) && <div style={{ fontFamily: F, fontSize: 12.5, color: "#B23A2C", marginTop: 6 }}>No se ha podido enviar · {r.ultError.error || "Meta no lo ha entregado."}</div>}
                  {lista.length > 0 && (
                    <>
                      <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, margin: "12px 0 6px" }}>Mensajes de WhatsApp</div>
                      {lista.map((m) => (
                        <div key={m.id} style={{ background: "#F5F0E6", borderRadius: 10, padding: "8px 11px", marginBottom: 6 }}>
                          <div style={{ fontFamily: F, fontSize: 11, color: C.mutL }}>{fmtDiaHora(m.creado_en)}</div>
                          <div style={{ fontFamily: F, fontSize: 13.5, color: C.char, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {m.tipo === "archivo" ? <i>Ha enviado un archivo</i> : m.tipo === "boton" ? <>Ha pulsado «{m.texto}»</> : m.texto}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })()}

            <Crit c={abierto} />

            {abierto.resumen && <div style={{ fontFamily: F, fontSize: 13.5, color: C.char, lineHeight: 1.5, marginTop: 12, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "12px 14px" }}>{abierto.resumen}</div>}

            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, margin: "16px 0 7px" }}>Currículum</div>
            {abierto.cv_texto ? (
              <div style={{ fontFamily: F, fontSize: 13.5, color: C.char, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "13px 15px", maxHeight: "42vh", overflowY: "auto" }}>{abierto.cv_texto}</div>
            ) : (
              <div style={{ fontFamily: F, fontSize: 13, color: C.mut, lineHeight: 1.5, background: "#F5F0E6", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "12px 14px" }}>No hay texto del CV guardado para esta candidata. Puedes ver el original en el correo.</div>
            )}
            <CvArchivo c={abierto} />
            {abierto.cv_archivo && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mutL, marginTop: 6 }}>📎 {abierto.cv_archivo}</div>}
            <a href={gmailUrl(abierto.gmail_id)} target="_blank" rel="noopener" style={{ display: "inline-block", marginTop: 10, color: C.blu, fontFamily: F, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Ver original en Gmail ↗</a>

            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, margin: "16px 0 7px" }}>Notas de dirección</div>
            <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Anota lo que quieras sobre esta candidata…" rows={2} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: "10px 12px", fontFamily: F, fontSize: 14, color: C.char, outline: "none", resize: "vertical" }} />
            {nota !== (abierto.nota || "") && <button onClick={() => guardarNota(abierto)} disabled={busy} style={{ marginTop: 8, background: "#fff", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "8px 14px", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, cursor: "pointer" }}>Guardar nota</button>}

            <div style={{ marginTop: 18 }}>{acciones(abierto, true)}</div>
            <button onClick={() => setAbierto(null)} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: C.mut, fontFamily: F, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
          </div>
        </div>
      )}

      {waElegir && (
        <div onClick={() => !busy && setWaElegir(null)} style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", zIndex: 90, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.cream, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "18px 18px 24px" }}>
            <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>WhatsApp a {waElegir.c.nombre}</div>
            <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2 }}>Elige qué mensaje enviar</div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {[["principal", "Puesto principal (40 h)"], ["apoyo", "Puesto de apoyo (28 h)"]].map(([k, l]) => (
                <button key={k} onClick={() => setWaElegir((w) => ({ ...w, puesto: k }))} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `1.5px solid ${waElegir.puesto === k ? C.char : C.brd}`, background: waElegir.puesto === k ? C.char : "#fff", color: waElegir.puesto === k ? C.gold : C.char, fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{l}</button>
              ))}
            </div>
            {waElegir.puesto && waInfo?.textos && (
              <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700, color: C.char }}>Tu candidatura en Recao</div>
                <div style={{ fontFamily: F, fontSize: 13, color: C.char, lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 6 }}>{String(waInfo.textos[waElegir.puesto] || "").replace("{{1}}", nombrePila(waElegir.c.nombre))}</div>
                <div style={{ fontFamily: F, fontSize: 11.5, color: C.mutL, marginTop: 8 }}>{waInfo.textos.pie}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  {["Me interesa", "No me interesa"].map((b) => <span key={b} style={{ flex: 1, textAlign: "center", fontFamily: F, fontSize: 12.5, fontWeight: 600, color: C.blu, border: `1px solid ${C.brdL}`, borderRadius: 8, padding: "6px 4px" }}>{b}</span>)}
                </div>
              </div>
            )}
            {waErr && <div style={{ fontFamily: F, fontSize: 13, color: "#B23A2C", marginTop: 10 }}>{waErr}</div>}
            <button onClick={enviarWa} disabled={busy || !waElegir.puesto} style={{ width: "100%", marginTop: 14, background: waElegir.puesto ? "#1E7A46" : "#E5DFD3", color: waElegir.puesto ? "#fff" : C.mut, border: "none", borderRadius: 11, padding: "12px", fontFamily: F, fontSize: 14.5, fontWeight: 700, cursor: waElegir.puesto ? "pointer" : "default" }}>{busy ? "Enviando…" : "Enviar"}</button>
            <button onClick={() => setWaElegir(null)} disabled={busy} style={{ width: "100%", marginTop: 8, background: "none", border: "none", color: C.mut, fontFamily: F, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {evaluando && (
        <EvaluacionSheet
          candidato={evaluando}
          evaluacion={evalsById[evaluando.id] || null}
          currentUser={currentUser}
          onClose={() => setEvaluando(null)}
          onSaved={loadEvals}
        />
      )}
    </div>
  );
}
