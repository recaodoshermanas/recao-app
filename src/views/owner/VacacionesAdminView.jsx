import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, inp } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { resumenVacaciones } from "../../lib/vacaciones.js";

const ANIO = 2026;
const EST = {
  pendiente: { label: "Pendiente", bg: "#FAEEDA", fg: "#7a5a12" },
  aceptado:  { label: "Aceptado",  bg: "#E1F5EE", fg: "#0F6E56" },
  rechazado: { label: "Rechazado", bg: "#FCEBEB", fg: "#A32D2D" },
};
const chip = (est) => ({ fontFamily: F, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "3px 9px", borderRadius: 20, background: EST[est].bg, color: EST[est].fg });
const btnSm = { padding: "6px 10px", borderRadius: 7, border: `1.5px solid ${C.brd}`, background: "#fff", color: C.char, fontFamily: F, fontSize: 12, cursor: "pointer" };

function ymd(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
function diasEntre(a, b) { if (!a || !b) return 0; const d = (new Date(b) - new Date(a)) / 86400000 + 1; return d > 0 ? Math.round(d) : 0; }
function fmtF(s) { if (!s) return ""; const p = s.split("-"); return `${p[2]}/${p[1]}`; }

function CoberturaEditor({ sol, trabajadoras, onSave }) {
  const [tipo, setTipo] = useState(sol.cobertura_tipo || "");
  const [interna, setInterna] = useState(sol.cobertura_usuario_id || "");
  const [externa, setExterna] = useState(sol.cobertura_nombre || "");
  const compis = trabajadoras.filter(t => t.id !== sol.usuario_id);
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.brd}` }}>
      <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Cobertura</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...inp, width: "auto", padding: "8px 10px", marginBottom: 0, fontSize: 13 }}>
          <option value="">Sin asignar</option>
          <option value="interna">Compañera</option>
          <option value="externa">Externa</option>
        </select>
        {tipo === "interna" && (
          <select value={interna} onChange={e => setInterna(e.target.value)} style={{ ...inp, width: "auto", padding: "8px 10px", marginBottom: 0, fontSize: 13 }}>
            <option value="">Elegir…</option>
            {compis.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
        {tipo === "externa" && (
          <input value={externa} onChange={e => setExterna(e.target.value)} placeholder="Nombre externo" style={{ ...inp, width: "auto", padding: "8px 10px", marginBottom: 0, fontSize: 13 }} />
        )}
        <button onClick={() => onSave(tipo, tipo === "interna" ? interna : externa)} style={{ ...btnSm, background: C.char, color: C.gold, border: "none" }}>Guardar</button>
      </div>
    </div>
  );
}

export function VacacionesAdminView() {
  const [trab, setTrab] = useState([]);
  const nombreDe = useMemo(() => Object.fromEntries(trab.map(t => [t.id, t.nombre])), [trab]);
  const [sols, setSols] = useState([]);
  const [saldos, setSaldos] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [nUid, setNUid] = useState(""); const [nIni, setNIni] = useState(""); const [nFin, setNFin] = useState(""); const [nDias, setNDias] = useState(""); const [nEstado, setNEstado] = useState("aceptado");

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
    } catch (e) { flash(e.message || "Error al cargar"); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const hoy = ymd(new Date());
  const cambiarEstado = async (s, estado) => { try { await sb.update("vacaciones_solicitudes", `id=eq.${s.id}`, { estado, actualizado_en: new Date().toISOString() }); await load(); } catch (e) { flash(e.message); } };
  const crear = async () => {
    const dias = parseInt(nDias || diasEntre(nIni, nFin), 10);
    if (!nUid || !nIni || !nFin || !dias) { flash("Trabajadora, fechas y días"); return; }
    try { await sb.insert("vacaciones_solicitudes", { usuario_id: nUid, fecha_inicio: nIni, fecha_fin: nFin, dias, estado: nEstado }); setNIni(""); setNFin(""); setNDias(""); flash("Periodo añadido"); await load(); } catch (e) { flash(e.message); }
  };
  const guardarCobertura = async (s, tipo, valor) => {
    const patch = { cobertura_tipo: tipo || null, cobertura_usuario_id: tipo === "interna" ? (valor || null) : null, cobertura_nombre: tipo === "externa" ? (valor || null) : null, actualizado_en: new Date().toISOString() };
    try { await sb.update("vacaciones_solicitudes", `id=eq.${s.id}`, patch); flash("Cobertura guardada"); await load(); } catch (e) { flash(e.message); }
  };

  const resumen = useMemo(() => { const o = {}; for (const t of trab) o[t.id] = resumenVacaciones(saldos[t.id] ?? 22, sols.filter(s => s.usuario_id === t.id), hoy); return o; }, [trab, sols, saldos, hoy]);

  return (
    <div style={{ padding: "14px", maxWidth: 660, margin: "0 auto" }}>
      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 8, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 2px 8px" }}>Saldos {ANIO}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 18 }}>
        {trab.map(t => { const r = resumen[t.id] || { total: 22, restantes: 22 }; return (
          <div key={t.id} style={{ background: "#fff", border: `1px solid ${C.brd}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.nombre}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
              <span style={{ fontFamily: SF, fontSize: 22, color: C.char }}>{r.restantes}</span>
              <span style={{ fontFamily: F, fontSize: 11, color: C.mut }}>/ {r.total} restantes</span>
            </div>
          </div>
        ); })}
      </div>

      <details style={{ marginBottom: 18, border: `1px solid ${C.brd}`, borderRadius: 10, background: "#fff", padding: "10px 12px" }}>
        <summary style={{ fontFamily: SF, fontSize: 15, color: C.char, cursor: "pointer" }}>Añadir periodo</summary>
        <div style={{ marginTop: 10 }}>
          <select value={nUid} onChange={e => setNUid(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
            {trab.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input type="date" value={nIni} onChange={e => { setNIni(e.target.value); setNDias(String(diasEntre(e.target.value, nFin) || "")); }} style={{ ...inp, marginBottom: 0 }} />
            <input type="date" value={nFin} onChange={e => { setNFin(e.target.value); setNDias(String(diasEntre(nIni, e.target.value) || "")); }} style={{ ...inp, marginBottom: 0 }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
            <input type="number" value={nDias} onChange={e => setNDias(e.target.value)} placeholder="Días" style={{ ...inp, marginBottom: 0, width: 90 }} />
            <select value={nEstado} onChange={e => setNEstado(e.target.value)} style={{ ...inp, marginBottom: 0, width: "auto" }}>
              <option value="aceptado">Aceptado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
          <button onClick={crear} style={{ width: "100%", padding: 12, border: "none", borderRadius: 10, background: C.char, color: C.gold, fontFamily: SF, fontSize: 15, cursor: "pointer" }}>Añadir</button>
        </div>
      </details>

      <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 2px 8px" }}>Solicitudes ({sols.length})</div>
      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Cargando…</div>
        : sols.map(s => (
          <div key={s.id} style={{ background: "#fff", border: `1px solid ${C.brd}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{nombreDe[s.usuario_id] || "—"}</div>
                <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginTop: 2 }}>{fmtF(s.fecha_inicio)} – {fmtF(s.fecha_fin)} · {s.dias} días</div>
              </div>
              <span style={chip(s.estado)}>{EST[s.estado].label}</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {s.estado !== "aceptado" && <button onClick={() => cambiarEstado(s, "aceptado")} style={{ ...btnSm, background: EST.aceptado.bg, color: EST.aceptado.fg, border: "none" }}>Aceptar</button>}
              {s.estado !== "rechazado" && <button onClick={() => cambiarEstado(s, "rechazado")} style={{ ...btnSm, background: EST.rechazado.bg, color: EST.rechazado.fg, border: "none" }}>Rechazar</button>}
              {s.estado !== "pendiente" && <button onClick={() => cambiarEstado(s, "pendiente")} style={btnSm}>Pendiente</button>}
            </div>
            {s.estado === "aceptado" && <CoberturaEditor sol={s} trabajadoras={trab} onSave={(tipo, valor) => guardarCobertura(s, tipo, valor)} />}
          </div>
        ))}
    </div>
  );
}
