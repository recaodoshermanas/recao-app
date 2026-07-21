import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, chipStyle, CHIP, avatar } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { resumenCalendario } from "../../lib/vacaciones.js";

const ANIO = 2026;
const secLbl = { fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutL, margin: "0 2px 12px" };
const btnSm = { padding: "8px 14px", borderRadius: 10, border: "none", fontFamily: F, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const sel = { padding: "7px 10px", borderRadius: 9, border: `1.5px solid ${C.brd}`, fontFamily: F, fontSize: 13, background: "#fff", color: C.char };
function diasEntre(a, b) { if (!a || !b) return 0; const d = (new Date(b) - new Date(a)) / 86400000 + 1; return d > 0 ? Math.round(d) : 0; }
function fmtF(s) { if (!s) return ""; const p = s.split("-"); return `${p[2]}/${p[1]}`; }
function ymd(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
function rangoFechas(ini, fin) { const out = []; const d = new Date(ini + "T00:00:00"); const end = new Date(fin + "T00:00:00"); while (d <= end) { out.push(ymd(d)); d.setDate(d.getDate() + 1); } return out; }

function Avatar({ name, size = 38 }) {
  const a = avatar(name);
  return <span style={{ width: size, height: size, borderRadius: "999px", background: a.bg, color: a.fg, fontFamily: SF, fontSize: Math.round(size * 0.42), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.inicial}</span>;
}

function CoberturaEditor({ sol, trabajadoras, onSave }) {
  const [tipo, setTipo] = useState(sol.cobertura_tipo || "");
  const [interna, setInterna] = useState(sol.cobertura_usuario_id || "");
  const [externa, setExterna] = useState(sol.cobertura_nombre || "");
  const compis = trabajadoras.filter(t => t.id !== sol.usuario_id);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid #F0EBE1" }}>
      <span style={{ fontFamily: F, fontSize: 11, color: C.mutL }}>Cobertura</span>
      <select value={tipo} onChange={e => setTipo(e.target.value)} style={sel}>
        <option value="">Sin asignar</option>
        <option value="interna">Compañera</option>
        <option value="externa">Externa</option>
      </select>
      {tipo === "interna" && <select value={interna} onChange={e => setInterna(e.target.value)} style={sel}><option value="">Elegir…</option>{compis.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>}
      {tipo === "externa" && <input value={externa} onChange={e => setExterna(e.target.value)} placeholder="Nombre" style={sel} />}
      <button onClick={() => onSave(tipo, tipo === "interna" ? interna : externa)} style={{ ...btnSm, background: C.char, color: C.gold, marginLeft: "auto" }}>Guardar</button>
    </div>
  );
}

export function VacacionesAdminView() {
  const [trab, setTrab] = useState([]);
  const nombreDe = useMemo(() => Object.fromEntries(trab.map(t => [t.id, t.nombre])), [trab]);
  const [sols, setSols] = useState([]);
  const [saldos, setSaldos] = useState({});
  const [vacDias, setVacDias] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [abrir, setAbrir] = useState(false);
  const [nUid, setNUid] = useState(""); const [nIni, setNIni] = useState(""); const [nFin, setNFin] = useState(""); const [nDias, setNDias] = useState(""); const [nEstado, setNEstado] = useState("aceptado");
  const [editUid, setEditUid] = useState(null); const [editVal, setEditVal] = useState("");

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await sb.fn("gestion-usuarios", { action: "listar" });
      const tr = (r.usuarios || []).filter(u => u.rol === "trabajadora");
      setTrab(tr);
      setNUid(prev => prev || (tr[0] ? tr[0].id : ""));
      setSols(await sb.select("vacaciones_solicitudes", "select=*&order=fecha_inicio.desc"));
      const sal = await sb.select("vacaciones_saldo", `select=usuario_id,dias_totales&anio=eq.${ANIO}`);
      const sm = {}; sal.forEach(x => { sm[x.usuario_id] = x.dias_totales; }); setSaldos(sm);
      const vac = await sb.select("horarios", `select=usuario_id,fecha&turno=eq.Vacaciones&fecha=gte.${ANIO}-01-01&fecha=lte.${ANIO}-12-31`);
      const vm = {}; vac.forEach(x => { (vm[x.usuario_id] = vm[x.usuario_id] || []).push(x.fecha); }); setVacDias(vm);
    } catch (e) { flash(e.message || "Error al cargar"); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const hoy = ymd(new Date());
  const escribirVac = async (uid, ini, fin) => { const dias = rangoFechas(ini, fin).map(f => ({ usuario_id: uid, fecha: f, turno: "Vacaciones" })); if (dias.length) await sb.upsert("horarios", dias, "usuario_id,fecha"); };
  const borrarVac = async (uid, ini, fin) => { await sb.delete("horarios", `usuario_id=eq.${uid}&fecha=gte.${ini}&fecha=lte.${fin}&turno=eq.Vacaciones`); };

  const cambiarEstado = async (s, estado) => {
    try {
      if (estado === "aceptado") await escribirVac(s.usuario_id, s.fecha_inicio, s.fecha_fin);
      else if (s.estado === "aceptado") await borrarVac(s.usuario_id, s.fecha_inicio, s.fecha_fin);
      await sb.update("vacaciones_solicitudes", `id=eq.${s.id}`, { estado, actualizado_en: new Date().toISOString() });
      await load();
    } catch (e) { flash(e.message); }
  };
  const crear = async () => {
    const dias = parseInt(nDias || diasEntre(nIni, nFin), 10);
    if (!nUid || !nIni || !nFin || !dias) { flash("Trabajadora, fechas y días"); return; }
    try {
      if (nEstado === "aceptado") await escribirVac(nUid, nIni, nFin);
      await sb.insert("vacaciones_solicitudes", { usuario_id: nUid, fecha_inicio: nIni, fecha_fin: nFin, dias, estado: nEstado });
      setNIni(""); setNFin(""); setNDias(""); setAbrir(false); flash("Periodo añadido"); await load();
    } catch (e) { flash(e.message); }
  };
  const guardarCobertura = async (s, tipo, valor) => {
    const patch = { cobertura_tipo: tipo || null, cobertura_usuario_id: tipo === "interna" ? (valor || null) : null, cobertura_nombre: tipo === "externa" ? (valor || null) : null, actualizado_en: new Date().toISOString() };
    try { await sb.update("vacaciones_solicitudes", `id=eq.${s.id}`, patch); flash("Cobertura guardada"); await load(); } catch (e) { flash(e.message); }
  };
  const abrirEdit = (t) => { setEditUid(t.id); setEditVal(String(saldos[t.id] ?? 22)); };
  const guardarTotal = async (uid) => {
    const v = parseInt(editVal, 10);
    if (!v || v < 0) { flash("Número no válido"); return; }
    try { await sb.update("vacaciones_saldo", `usuario_id=eq.${uid}&anio=eq.${ANIO}`, { dias_totales: v }); setEditUid(null); flash("Días actualizados"); await load(); } catch (e) { flash(e.message); }
  };
  const coberturaTxt = (s) => s.cobertura_tipo === "interna" ? ` · cubre ${nombreDe[s.cobertura_usuario_id] || "compañera"}` : s.cobertura_tipo === "externa" ? ` · cubre ${s.cobertura_nombre}` : "";

  const resumen = useMemo(() => { const o = {}; for (const t of trab) o[t.id] = resumenCalendario(saldos[t.id] ?? 22, vacDias[t.id] || [], sols.filter(s => s.usuario_id === t.id), hoy); return o; }, [trab, sols, saldos, vacDias, hoy]);

  return (
    <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      <div style={secLbl}>Saldos del equipo · {ANIO}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        {trab.map(t => { const r = resumen[t.id] || { total: 22, restantes: 22, cogidos: 0 }; const editing = editUid === t.id; return (
          <div key={t.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={t.nombre} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.char, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.nombre}</div>
              {editing ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <input type="number" value={editVal} onChange={e => setEditVal(e.target.value)} style={{ width: 54, padding: "4px 7px", borderRadius: 8, border: `1.5px solid ${C.brd}`, fontFamily: F, fontSize: 13, color: C.char }} />
                  <button onClick={() => guardarTotal(t.id)} style={{ ...btnSm, padding: "5px 10px", background: C.char, color: C.gold }}>OK</button>
                </div>
              ) : (
                <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 1 }}>
                  <b style={{ color: C.char, fontFamily: SF, fontSize: 15 }}>{r.restantes}</b> / {r.total} días
                  <span onClick={() => abrirEdit(t)} style={{ color: C.blu, cursor: "pointer", marginLeft: 6, fontSize: 11, fontWeight: 600 }}>editar</span>
                  <div style={{ fontSize: 11, color: C.mutL, marginTop: 1 }}>{r.cogidos} cogidos{r.pendientes ? ` · ${r.pendientes} por confirmar` : ""}</div>
                </div>
              )}
            </div>
          </div>
        ); })}
      </div>

      {!abrir ? <button onClick={() => setAbrir(true)} style={{ ...btnSm, background: "#fff", color: C.char, border: `1.5px solid ${C.brd}`, marginBottom: 18 }}>+ Añadir periodo</button>
        : (
          <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 14, marginBottom: 18 }}>
            <select value={nUid} onChange={e => setNUid(e.target.value)} style={{ ...sel, width: "100%", marginBottom: 8 }}>{trab.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input type="date" value={nIni} onChange={e => { setNIni(e.target.value); setNDias(String(diasEntre(e.target.value, nFin) || "")); }} style={{ ...sel, flex: 1 }} />
              <input type="date" value={nFin} onChange={e => { setNFin(e.target.value); setNDias(String(diasEntre(nIni, e.target.value) || "")); }} style={{ ...sel, flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" value={nDias} onChange={e => setNDias(e.target.value)} placeholder="Días" style={{ ...sel, width: 80 }} />
              <select value={nEstado} onChange={e => setNEstado(e.target.value)} style={sel}><option value="aceptado">Aceptado</option><option value="pendiente">Pendiente</option></select>
              <button onClick={crear} style={{ ...btnSm, background: C.char, color: C.gold, marginLeft: "auto" }}>Añadir</button>
            </div>
            <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, marginTop: 8 }}>Si es "Aceptado", esos días se marcan como Vacaciones en el calendario.</div>
          </div>
        )}

      <div style={secLbl}>Solicitudes ({sols.length})</div>
      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Cargando…</div>
        : sols.map(s => (
          <div key={s.id} style={{ background: "#fff", border: s.estado === "pendiente" ? `1.5px solid ${C.gold}` : `1px solid ${C.brdL}`, borderRadius: 16, padding: 15, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <Avatar name={nombreDe[s.usuario_id]} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char }}>{nombreDe[s.usuario_id] || "—"} · {fmtF(s.fecha_inicio)} – {fmtF(s.fecha_fin)}</div>
                  <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 1 }}>{s.dias} días{coberturaTxt(s)}</div>
                </div>
              </div>
              <span style={chipStyle(s.estado)}>{CHIP[s.estado].label}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {s.estado !== "aceptado" && <button onClick={() => cambiarEstado(s, "aceptado")} style={{ ...btnSm, background: C.grn, color: "#fff" }}>Aceptar</button>}
              {s.estado !== "rechazado" && <button onClick={() => cambiarEstado(s, "rechazado")} style={{ ...btnSm, background: "#fff", color: "#B23A2C", border: "1.5px solid #EDC9C3" }}>Rechazar</button>}
              {s.estado !== "pendiente" && <button onClick={() => cambiarEstado(s, "pendiente")} style={{ ...btnSm, background: "#fff", color: C.mut, border: `1.5px solid ${C.brd}` }}>Pendiente</button>}
            </div>
            {s.estado === "aceptado" && <CoberturaEditor sol={s} trabajadoras={trab} onSave={(tipo, valor) => guardarCobertura(s, tipo, valor)} />}
          </div>
        ))}
    </div>
  );
}
