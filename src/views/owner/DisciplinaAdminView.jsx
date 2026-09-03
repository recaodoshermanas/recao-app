import { useState, useEffect, useCallback } from "react";
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fmtDia(f) { if (!f) return ""; const p = f.split("-"); const d = new Date(f + "T00:00:00"); return `${DOW[d.getDay()]} ${p[2]}/${p[1]}`; }
function fmtF(s) { if (!s) return ""; const p = s.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; }
const RES = { descartado: { label: "Descartado", bg: "#E7F3EC", fg: "#1E7A46" }, sin_fallo: { label: "Sin fallo", bg: "#EAF0F8", fg: "#3D6AA5" }, confirmado: { label: "Confirmado", bg: "#FBEAE7", fg: "#B23A2C" } };
const NIVELES = [["", "Sin falta"], ["leve", "Leve"], ["grave", "Grave"], ["muy_grave", "Muy grave"]];
const NIVEL_L = { leve: "Leve", grave: "Grave", muy_grave: "Muy grave" };
const SUPTXT = { 1: "Falsedad · tarea marcada hecha, desmentida", 2: "Falsedad · validó como conforme algo no hecho", 3: "Causa rechazada", 4: "No cerró el turno", 5: "No verificó el turno anterior" };

export function DisciplinaAdminView() {
  const [tab, setTab] = useState("verif");
  const [verif, setVerif] = useState([]);
  const [causas, setCausas] = useState([]);
  const [nocierre, setNocierre] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [fEstado, setFEstado] = useState("emitido");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [fotos, setFotos] = useState({});
  const [causaNota, setCausaNota] = useState({});
  const [resolviendo, setResolviendo] = useState(null);
  const [rRes, setRRes] = useState("confirmado");
  const [rNivel, setRNivel] = useState("");
  const [rArt, setRArt] = useState("");
  const [rNota, setRNota] = useState("");
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [expUid, setExpUid] = useState("");
  const [expData, setExpData] = useState(null);
  const [expLoading, setExpLoading] = useState(false);
  const [naOpen, setNaOpen] = useState(false);
  const [naUid, setNaUid] = useState("");
  const [naFecha, setNaFecha] = useState("");
  const [naTurno, setNaTurno] = useState("mañana");
  const [naDesc, setNaDesc] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3800); };
  const call = (action, extra) => sb.fn("disciplina", { action, ...(extra || {}) });

  useEffect(() => { (async () => { try { const r = await sb.fn("gestion-usuarios", { action: "listar" }); setTrabajadoras((r.usuarios || []).filter(u => u.rol === "trabajadora" && u.activo && !u.eventual)); } catch (e) { /* noop */ } })(); }, []);

  const load = useCallback(async () => {
    if (tab === "exp") { setLoading(false); return; }
    setLoading(true);
    try {
      if (tab === "verif") setVerif((await call("bandeja_verificaciones")).items || []);
      else if (tab === "causas") setCausas((await call("bandeja_causas")).items || []);
      else if (tab === "nocierre") setNocierre((await call("bandeja_no_cierre")).items || []);
      else if (tab === "avisos") setAvisos((await call("listar_avisos", fEstado ? { estado: fEstado } : {})).avisos || []);
    } catch (e) { flash(e.message || "Error"); }
    setLoading(false);
  }, [tab, fEstado]);
  useEffect(() => { load(); }, [load]);

  const loadExp = useCallback(async (uid) => {
    if (!uid) { setExpData(null); return; }
    setExpLoading(true);
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const faltas = await sb.select("faltas", `select=*&usuario_id=eq.${uid}&or=(fecha_caducidad.is.null,fecha_caducidad.gte.${hoy})&order=fecha.desc`);
      const fallos = await sb.select("fallos", `select=*&usuario_id=eq.${uid}&estado=eq.confirmado&order=fecha.desc&limit=100`);
      const f30 = await sb.rpc("disc_fallos_30", { p_uid: uid });
      const s90 = await sb.rpc("disc_falsedades_90", { p_uid: uid });
      setExpData({ faltas: faltas || [], fallos: fallos || [], f30: Number(f30) || 0, s90: Number(s90) || 0 });
    } catch (e) { flash(e.message || "Error"); }
    setExpLoading(false);
  }, []);
  useEffect(() => { loadExp(expUid); }, [expUid, loadExp]);

  const verFoto = async (id) => { setFotos(p => ({ ...p, [id]: "loading" })); try { const r = await sb.fn("incidencias", { action: "detalle", id }); setFotos(p => ({ ...p, [id]: r.foto || null })); } catch (e) { setFotos(p => ({ ...p, [id]: null })); } };
  const emitir = async (id) => { setBusy(true); try { await call("emitir_verificacion", { incidencia_id: id }); flash("Aviso emitido a la responsable"); await load(); } catch (e) { flash(e.message || "Error"); } setBusy(false); };
  const descartar = async (id) => { if (!window.confirm("¿Descartar esta verificación? No generará aviso.")) return; setBusy(true); try { await call("descartar_verificacion", { incidencia_id: id }); await load(); } catch (e) { flash(e.message || "Error"); } setBusy(false); };
  const revisarCausa = async (id, decision) => { if (decision === "rechazada" && !window.confirm("Rechazar la causa generará un aviso a las dos personas del turno. ¿Seguir?")) return; setBusy(true); try { await call("revisar_causa", { cierre_item_id: id, decision, justificacion: causaNota[id] || null }); flash(decision === "rechazada" ? "Causa rechazada · aviso emitido" : "Causa validada"); await load(); } catch (e) { flash(e.message || "Error"); } setBusy(false); };
  const emitirNoCierre = async (fecha, turno) => { if (!window.confirm("Se emitirá un aviso a las dos personas de ese turno por no registrar el cierre. ¿Seguir?")) return; setBusy(true); try { await call("emitir_no_cierre", { fecha, turno }); flash("Aviso de no-cierre emitido"); await load(); } catch (e) { flash(e.message || "Error"); } setBusy(false); };
  const abrirResolver = (a) => { setResolviendo(a); setRRes("confirmado"); setRNivel(""); setRArt(""); setRNota(""); };
  const resolver = async () => { setBusy(true); try { await call("resolver", { aviso_id: resolviendo.id, resultado: rRes, nivel: rRes === "confirmado" && rNivel ? rNivel : undefined, articulo: rArt || undefined, nota: rNota || undefined }); setResolviendo(null); flash("Aviso resuelto"); await load(); } catch (e) { flash(e.message || "Error"); } setBusy(false); };
  const abrirManual = () => { setNaUid(trabajadoras[0]?.id || ""); setNaFecha(new Date().toISOString().slice(0, 10)); setNaTurno("mañana"); setNaDesc(""); setNaOpen(true); };
  const crearManual = async () => { if (!naUid || !naFecha || !naDesc.trim()) { flash("Rellena persona, fecha y descripción"); return; } setBusy(true); try { await call("crear_aviso_manual", { usuario_id: naUid, fecha: naFecha, turno: naTurno, descripcion: naDesc.trim() }); setNaOpen(false); flash("Aviso emitido"); await load(); } catch (e) { flash(e.message || "Error"); } setBusy(false); };

  const card = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 15, marginBottom: 11, boxShadow: SHADOW.card };
  const btn = (bg, fg) => ({ flex: 1, background: bg, color: fg, border: "none", borderRadius: 10, padding: 11, fontFamily: F, fontSize: 13.5, fontWeight: 700, cursor: "pointer" });
  const vacio = (t) => <div style={{ fontFamily: SF, fontSize: 16, color: "#1E7A46", textAlign: "center", padding: 30 }}>{t}</div>;

  const Verif = () => verif.length === 0 ? vacio("Nada pendiente ✓")
    : verif.map(it => {
      const f = fotos[it.id]; const urge = it.dias_prescripcion <= 3;
      return (
        <div key={it.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char }}>{it.tarea_texto}</div>
            <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 999, background: urge ? "#FBEAE7" : "#F0EADF", color: urge ? "#B23A2C" : C.mut, whiteSpace: "nowrap", height: "fit-content" }}>{it.dias_prescripcion}d prescr.</span>
          </div>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 7, lineHeight: 1.5 }}>Turno <b style={{ textTransform: "capitalize" }}>{it.turno}</b> · {fmtDia(it.fecha)}<br />Sin hacer: <b style={{ color: C.red }}>{it.cerrado_por_nombre}</b> · reportó <b>{it.reportado_por_nombre}</b></div>
          {it.comentario && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: "#FAF7F2", borderRadius: 10, padding: "9px 12px", marginTop: 9, fontStyle: "italic" }}>“{it.comentario}”</div>}
          {f === undefined ? <button onClick={() => verFoto(it.id)} style={{ marginTop: 10, background: "none", border: "none", color: C.blu, fontFamily: F, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>Ver prueba</button>
            : f === "loading" ? <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 10 }}>Cargando…</div>
              : f === null ? <div style={{ fontFamily: F, fontSize: 12, color: C.mutL, marginTop: 10 }}>Sin foto</div>
                : <img src={f} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 10, display: "block" }} />}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => emitir(it.id)} disabled={busy} style={btn(C.char, C.gold)}>Aceptar (emitir aviso)</button>
            <button onClick={() => descartar(it.id)} disabled={busy} style={btn("#fff", C.mut)}>Descartar</button>
          </div>
        </div>
      );
    });

  const Causas = () => causas.length === 0 ? vacio("Nada pendiente ✓")
    : causas.map(it => (
      <div key={it.id} style={card}>
        <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char }}>{it.tarea_texto}</div>
        <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 6 }}>Turno <b style={{ textTransform: "capitalize" }}>{it.turno}</b> · {fmtDia(it.fecha)} · <b>{it.cerrado_por_nombre}</b></div>
        <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: "#FAF7F2", borderRadius: 10, padding: "9px 12px", marginTop: 9, fontStyle: "italic" }}>“{it.justificacion || "(sin motivo)"}”</div>
        <input value={causaNota[it.id] || ""} onChange={e => setCausaNota(p => ({ ...p, [it.id]: e.target.value }))} placeholder="Justificación de tu decisión (opcional)" style={{ width: "100%", boxSizing: "border-box", marginTop: 10, border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "9px 11px", fontFamily: F, fontSize: 13, color: C.char, outline: "none" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={() => revisarCausa(it.id, "validada")} disabled={busy} style={btn("#E7F3EC", "#1E7A46")}>Validar</button>
          <button onClick={() => revisarCausa(it.id, "rechazada")} disabled={busy} style={btn("#FBEAE7", "#B23A2C")}>Rechazar</button>
        </div>
      </div>
    ));

  const NoCierre = () => nocierre.length === 0 ? vacio("Todos los turnos cerrados ✓")
    : nocierre.map((it, i) => (
      <div key={i} style={card}>
        <div style={{ fontFamily: SF, fontSize: 16, color: C.char, textTransform: "capitalize" }}>Turno {it.turno} · {fmtDia(it.fecha)}</div>
        <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 5 }}>No se registró el cierre. Responsables: <b>{it.principal_nombre}</b>{it.apoyo_nombre ? <> y <b>{it.apoyo_nombre}</b></> : " (solo principal)"}</div>
        <button onClick={() => emitirNoCierre(it.fecha, it.turno)} disabled={busy} style={{ width: "100%", marginTop: 12, background: C.char, color: C.gold, border: "none", borderRadius: 10, padding: 12, fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Emitir aviso</button>
      </div>
    ));

  const Avisos = () => (
    <div>
      <button onClick={abrirManual} style={{ width: "100%", boxSizing: "border-box", marginBottom: 12, background: "#fff", border: `1.5px dashed ${C.brd}`, borderRadius: 12, padding: "10px", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, cursor: "pointer" }}>+ Aviso manual (validación indebida · sup. 2)</button>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["emitido", "Pendientes"], ["resuelto", "Resueltos"], ["", "Todos"]].map(([v, l]) => (
          <button key={l} onClick={() => setFEstado(v)} style={{ flex: 1, padding: "8px 6px", borderRadius: 10, border: `1.5px solid ${fEstado === v ? C.char : C.brd}`, background: fEstado === v ? C.char : "#fff", color: fEstado === v ? C.gold : C.mut, fontFamily: F, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {avisos.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>No hay avisos.</div>
        : avisos.map(a => {
          const res = RES[a.resultado];
          return (
            <div key={a.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{a.usuario_nombre}</div>
                {a.estado === "resuelto"
                  ? <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: res ? res.bg : "#eee", color: res ? res.fg : C.mut }}>{res ? res.label : "Resuelto"}</span>
                  : <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: a.plazo_vencido ? "#E7F3EC" : "#FBF0DA", color: a.plazo_vencido ? "#1E7A46" : "#8a6a1e" }}>{a.plazo_vencido ? "Plazo cumplido" : "En plazo 48h"}</span>}
              </div>
              <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 4 }}>Turno <b style={{ textTransform: "capitalize" }}>{a.turno}</b> · {fmtDia(a.fecha)}{a.es_falsedad ? " · falsedad" : ""}</div>
              <div style={{ fontFamily: F, fontSize: 12, color: C.mutL, marginTop: 4 }}>{SUPTXT[a.supuesto] || a.descripcion}</div>
              {a.alegacion_en && <div style={{ background: "#EAF0F8", borderRadius: 10, padding: "9px 12px", marginTop: 9 }}><div style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "#3D6AA5", marginBottom: 4 }}>Alegación de la trabajadora</div><div style={{ fontFamily: F, fontSize: 13, color: C.char, lineHeight: 1.4 }}>{a.alegacion || "(sin texto)"}</div></div>}
              {a.estado === "resuelto" && (a.nivel || a.resolucion_nota) && <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 8 }}>{a.nivel ? <b style={{ color: C.red }}>Falta {NIVEL_L[a.nivel]} (art. {a.articulo})</b> : null}{a.resolucion_nota ? <div style={{ marginTop: 3 }}>{a.resolucion_nota}</div> : null}</div>}
              {a.estado === "emitido" && <button onClick={() => abrirResolver(a)} style={{ width: "100%", marginTop: 12, background: C.char, color: C.gold, border: "none", borderRadius: 10, padding: 12, fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Resolver</button>}
            </div>
          );
        })}
    </div>
  );

  const Expedientes = () => (
    <div>
      <select value={expUid} onChange={e => setExpUid(e.target.value)} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: "11px 12px", fontFamily: F, fontSize: 14, color: C.char, background: "#fff", outline: "none", marginBottom: 14 }}>
        <option value="">Elige una trabajadora…</option>
        {trabajadoras.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
      </select>
      {!expUid ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Selecciona a quién ver.</div>
        : expLoading || !expData ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Cargando…</div>
          : (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, background: expData.f30 >= 3 ? "#FBEAE7" : "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "11px 13px", textAlign: "center" }}>
                  <div style={{ fontFamily: SF, fontSize: 22, color: expData.f30 >= 3 ? "#B23A2C" : C.char }}>{expData.f30}<span style={{ fontSize: 13, color: C.mutL }}>/4</span></div>
                  <div style={{ fontFamily: F, fontSize: 11, color: C.mut }}>fallos · 30 días</div>
                </div>
                <div style={{ flex: 1, background: expData.s90 >= 2 ? "#FBEAE7" : "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "11px 13px", textAlign: "center" }}>
                  <div style={{ fontFamily: SF, fontSize: 22, color: expData.s90 >= 2 ? "#B23A2C" : C.char }}>{expData.s90}<span style={{ fontSize: 13, color: C.mutL }}>/3</span></div>
                  <div style={{ fontFamily: F, fontSize: 11, color: C.mut }}>falsedades · 90 días</div>
                </div>
              </div>
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 9 }}>Faltas vigentes</div>
              {expData.faltas.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: "#1E7A46", background: "#E7F3EC", borderRadius: 10, padding: "10px 12px", textAlign: "center", marginBottom: 18 }}>Sin faltas vigentes ✓</div>
                : <div style={{ marginBottom: 18 }}>{expData.faltas.map(f => (
                  <div key={f.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "11px 13px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, background: "#FBEAE7", color: "#B23A2C" }}>{NIVEL_L[f.nivel] || f.nivel}</span>
                      <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 6 }}>Del {fmtF(f.fecha)}{f.articulo ? ` · art. ${f.articulo}` : ""}{f.acuse_en ? ` · recibí: ${f.acuse_tipo === "no_conforme" ? "no conforme" : "recibido"}` : " · sin acuse"}</div>
                    </div>
                    {f.fecha_caducidad && <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, textAlign: "right" }}>Caduca<br /><b style={{ color: C.char }}>{fmtF(f.fecha_caducidad)}</b></div>}
                  </div>
                ))}</div>}
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 9 }}>Fallos ({expData.fallos.length})</div>
              {expData.fallos.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 8 }}>Sin fallos.</div>
                : expData.fallos.map(f => (
                  <div key={f.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 10, padding: "9px 12px", marginBottom: 7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontFamily: F, fontSize: 12.5, color: C.char }}>Turno <b style={{ textTransform: "capitalize" }}>{f.turno}</b> · {fmtF(f.fecha)}<div style={{ fontSize: 11, color: C.mutL, marginTop: 2 }}>{SUPTXT[f.supuesto] || `Supuesto ${f.supuesto}`}</div></div>
                    {f.es_falsedad && <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, color: "#B23A2C", background: "#FBEAE7", borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap" }}>falsedad</span>}
                  </div>
                ))}
            </div>
          )}
    </div>
  );

  const seg = (on) => ({ flex: 1, padding: "9px", borderRadius: 10, border: `1.5px solid ${on ? C.char : C.brd}`, background: on ? C.char : "#fff", color: on ? C.gold : C.mut, fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" });
  const inpStyle = { width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "10px 12px", fontFamily: F, fontSize: 14, color: C.char, background: "#fff", outline: "none" };

  return (
    <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 3, background: "#EFE9DD", borderRadius: 11, padding: 3, marginBottom: 14 }}>
        {[["verif", "Verif."], ["causas", "Causas"], ["nocierre", "Sin cerrar"], ["avisos", "Avisos"], ["exp", "Exped."]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{ flex: 1, padding: "7px 2px", borderRadius: 8, border: "none", background: tab === v ? "#fff" : "transparent", color: tab === v ? C.char : C.mut, fontFamily: F, fontSize: 11, fontWeight: 700, cursor: "pointer", boxShadow: tab === v ? SHADOW.card : "none" }}>{l}</button>
        ))}
      </div>

      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      {tab === "exp" ? <Expedientes />
        : loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 26 }}>Cargando…</div>
          : tab === "verif" ? <Verif /> : tab === "causas" ? <Causas /> : tab === "nocierre" ? <NoCierre /> : <Avisos />}

      {naOpen && (
        <div onClick={() => setNaOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.cream, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "18px 18px 26px" }}>
            <div style={{ width: 40, height: 4, background: C.brd, borderRadius: 999, margin: "0 auto 16px" }} />
            <div style={{ fontFamily: SF, fontSize: 20, color: C.char }}>Aviso manual</div>
            <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginBottom: 16 }}>Supuesto 2 · validó como conforme una tarea que no lo estaba (falsedad, solo a quien verificó).</div>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 7 }}>Persona (quien verificó)</div>
            <select value={naUid} onChange={e => setNaUid(e.target.value)} style={{ ...inpStyle, marginBottom: 12 }}>{trabajadoras.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 7 }}>Fecha del hecho</div>
                <input type="date" value={naFecha} onChange={e => setNaFecha(e.target.value)} style={inpStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 7 }}>Turno</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setNaTurno("mañana")} style={seg(naTurno === "mañana")}>mañana</button>
                  <button onClick={() => setNaTurno("tarde")} style={seg(naTurno === "tarde")}>tarde</button>
                </div>
              </div>
            </div>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 7 }}>Descripción de los hechos</div>
            <textarea value={naDesc} onChange={e => setNaDesc(e.target.value)} placeholder="Qué validó como conforme y por qué no lo estaba…" rows={3} style={{ ...inpStyle, resize: "vertical", marginBottom: 16 }} />
            <button onClick={crearManual} disabled={busy} style={{ width: "100%", boxSizing: "border-box", background: C.char, color: C.gold, border: "none", borderRadius: 13, padding: 15, fontFamily: SF, fontSize: 16, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>{busy ? "Emitiendo…" : "Emitir aviso"}</button>
            <button onClick={() => setNaOpen(false)} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: C.mut, fontFamily: F, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {resolviendo && (
        <div onClick={() => setResolviendo(null)} style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.cream, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "18px 18px 26px" }}>
            <div style={{ width: 40, height: 4, background: C.brd, borderRadius: 999, margin: "0 auto 16px" }} />
            <div style={{ fontFamily: SF, fontSize: 20, color: C.char }}>Resolver aviso</div>
            <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginBottom: 16 }}>{resolviendo.usuario_nombre} · turno {resolviendo.turno} · {fmtDia(resolviendo.fecha)}</div>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 8 }}>Resultado</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
              {[["descartado", "Descartar el hecho", "No pasó / no procede"], ["sin_fallo", "Incidencia sin fallo", "Queda constancia, no cuenta"], ["confirmado", "Confirmar el fallo", "Se anota en los contadores"]].map(([v, t, s]) => {
                const on = rRes === v;
                return (
                  <button key={v} onClick={() => setRRes(v)} style={{ textAlign: "left", border: `1.5px solid ${on ? C.char : C.brd}`, background: on ? "#fff" : "transparent", borderRadius: 12, padding: "11px 13px", cursor: "pointer" }}>
                    <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: on ? C.char : C.mut }}>{t}</div>
                    <div style={{ fontFamily: F, fontSize: 11.5, color: C.mutL, marginTop: 1 }}>{s}</div>
                  </button>
                );
              })}
            </div>
            {rRes === "confirmado" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 8 }}>¿Calificar como falta? (opcional)</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  {NIVELES.map(([v, l]) => { const on = rNivel === v; return <button key={l} onClick={() => setRNivel(v)} style={{ padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${on ? C.char : C.brd}`, background: on ? C.char : "#fff", color: on ? C.gold : C.mut, fontFamily: F, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>; })}
                </div>
                {rNivel && <input value={rArt} onChange={e => setRArt(e.target.value)} placeholder="Artículo del convenio (obligatorio)" style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${rArt ? C.brd : "#EDC9C3"}`, borderRadius: 10, padding: "9px 11px", fontFamily: F, fontSize: 14, color: C.char, outline: "none", marginBottom: 10 }} />}
              </div>
            )}
            <textarea value={rNota} onChange={e => setRNota(e.target.value)} placeholder="Motivo / nota de la resolución" rows={2} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: "10px 12px", fontFamily: F, fontSize: 14, color: C.char, outline: "none", resize: "vertical", marginBottom: 16 }} />
            <button onClick={resolver} disabled={busy || (rRes === "confirmado" && rNivel && !rArt.trim())} style={{ width: "100%", boxSizing: "border-box", background: C.char, color: C.gold, border: "none", borderRadius: 13, padding: 15, fontFamily: SF, fontSize: 16, cursor: "pointer", opacity: (busy || (rRes === "confirmado" && rNivel && !rArt.trim())) ? 0.5 : 1 }}>{busy ? "Guardando…" : "Confirmar resolución"}</button>
            <button onClick={() => setResolviendo(null)} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: C.mut, fontFamily: F, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
