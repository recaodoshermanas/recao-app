import { useState, useEffect, useCallback } from "react";
import { F, SF, C, btnDark, chipStyle, CHIP } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { resumenCalendario, rangoFechas, diasQueGastan, agruparRangos } from "../../lib/vacaciones.js";

const ANIO = 2026;
function fmtF(s) { if (!s) return ""; const p = s.split("-"); return `${p[2]}/${p[1]}`; }
function ymd(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
const inpMini = { flex: 1, padding: "11px 12px", border: `1.5px solid ${C.brd}`, borderRadius: 12, fontFamily: F, fontSize: 14, color: C.char, background: "#fff", boxSizing: "border-box", outline: "none" };
const pill = { background: "rgba(255,255,255,.55)", borderRadius: "999px", padding: "4px 10px", fontFamily: F, fontSize: 11, fontWeight: 600, color: "#073B3B" };
const secLbl = { fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutL, margin: "20px 2px 10px" };

export function MisVacacionesView({ user }) {
  const [sols, setSols] = useState([]);
  const [total, setTotal] = useState(22);
  const [vacDias, setVacDias] = useState([]);
  const [descansos, setDescansos] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [ini, setIni] = useState(""); const [fin, setFin] = useState(""); const [dias, setDias] = useState("");
  const [calc, setCalc] = useState(false);
  const [msg, setMsg] = useState("");

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };
  const load = useCallback(async () => {
    try {
      setSols(await sb.select("vacaciones_solicitudes", `select=*&usuario_id=eq.${user.id}&order=fecha_inicio.desc`));
      const sal = await sb.select("vacaciones_saldo", `select=dias_totales&usuario_id=eq.${user.id}&anio=eq.${ANIO}`);
      setTotal(sal[0] ? sal[0].dias_totales : 22);
      const h = await sb.select("horarios", `select=fecha,turno&usuario_id=eq.${user.id}&turno=in.(Vacaciones,Descanso)&fecha=gte.${ANIO}-01-01&fecha=lte.${ANIO}-12-31`);
      setVacDias(h.filter(x => x.turno === "Vacaciones").map(x => x.fecha));
      setDescansos(h.filter(x => x.turno === "Descanso").map(x => x.fecha));
    } catch (e) { /* noop */ }
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!ini || !fin || fin < ini) { setDias(""); return; }
    let cancel = false; setCalc(true);
    (async () => {
      try {
        const rows = await sb.select("horarios", `select=fecha,turno&usuario_id=eq.${user.id}&fecha=gte.${ini}&fecha=lte.${fin}`);
        const m = {}; rows.forEach(r => { m[r.fecha] = r.turno; });
        const n = diasQueGastan(rangoFechas(ini, fin), m).length;
        if (!cancel) setDias(String(n));
      } catch (e) { if (!cancel) setDias(""); }
      if (!cancel) setCalc(false);
    })();
    return () => { cancel = true; };
  }, [ini, fin, user.id]);

  const hoy = ymd(new Date());
  const r = resumenCalendario(total, vacDias, sols, hoy);
  const bloques = agruparRangos(vacDias, descansos);

  const solicitar = async () => {
    const d = parseInt(dias, 10);
    if (!ini || !fin || !d) { flash("Pon las fechas"); return; }
    try { await sb.insert("vacaciones_solicitudes", { usuario_id: user.id, fecha_inicio: ini, fecha_fin: fin, dias: d, estado: "pendiente" }); setIni(""); setFin(""); setDias(""); setAbierto(false); flash("Solicitud enviada"); await load(); }
    catch (e) { flash(e.message); }
  };
  const cancelar = async (s) => { try { await sb.delete("vacaciones_solicitudes", `id=eq.${s.id}`); await load(); } catch (e) { flash(e.message); } };

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      <div style={{ background: "linear-gradient(135deg, #6ddadb, #48c7c9)", borderRadius: 20, padding: 22, textAlign: "center", boxShadow: "0 12px 28px -14px rgba(30,160,160,.7)" }}>
        <div style={{ fontFamily: SF, fontSize: 60, color: "#073B3B", lineHeight: 0.9 }}>{r.restantes}</div>
        <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: "#0A3B3B", marginTop: 6 }}>días disponibles de {r.total}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
          <span style={pill}>{r.disfrutados} disfrutados</span>
          <span style={pill}>{r.planificados} planificados</span>
          <span style={pill}>{r.pendientes} por confirmar</span>
        </div>
      </div>

      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginTop: 12, textAlign: "center" }}>{msg}</div>}

      {!abierto ? (
        <button onClick={() => setAbierto(true)} style={{ ...btnDark, fontSize: 15, padding: 14, marginTop: 14 }}>+ Solicitar vacaciones</button>
      ) : (
        <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 14, marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input type="date" value={ini} onChange={e => setIni(e.target.value)} style={inpMini} />
            <input type="date" value={fin} onChange={e => setFin(e.target.value)} style={inpMini} />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>
              {calc ? "Calculando…" : dias ? <span><b style={{ fontFamily: SF, fontSize: 17, color: C.char }}>{dias}</b> días de vacaciones</span> : "Elige las fechas"}
            </div>
            <button onClick={solicitar} disabled={!dias} style={{ ...btnDark, flex: 1, fontSize: 14, padding: 12, opacity: dias ? 1 : 0.5 }}>Enviar</button>
          </div>
          <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, marginTop: 8 }}>Solo cuentan los días que te tocaba trabajar; tus descansos no gastan vacaciones.</div>
        </div>
      )}

      <div style={secLbl}>Mis solicitudes</div>
      {sols.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 16 }}>Aún no has solicitado vacaciones</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {sols.map(s => (
            <div key={s.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 13, padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char }}>{fmtF(s.fecha_inicio)} – {fmtF(s.fecha_fin)}</div>
                <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 2 }}>{s.dias} días</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={chipStyle(s.estado)}>{CHIP[s.estado].label}</span>
                {s.estado === "pendiente" && <button onClick={() => cancelar(s)} style={{ border: "none", background: "none", color: "#ccc", fontSize: 18, cursor: "pointer" }}>×</button>}
              </div>
            </div>
          ))}
        </div>}

      <div style={secLbl}>Histórico {ANIO}</div>
      {bloques.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 16 }}>Todavía no has disfrutado vacaciones este año</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bloques.slice().reverse().map((b, i) => {
            const pasado = b.fin <= hoy;
            return (
              <div key={i} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 13, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char }}>{fmtF(b.ini)}{b.ini !== b.fin ? ` – ${fmtF(b.fin)}` : ""}</div>
                  <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 2 }}>{b.dias} {b.dias === 1 ? "día" : "días"}</div>
                </div>
                <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "5px 11px", borderRadius: 999, background: pasado ? "#E7F3EC" : "#E4F5F5", color: pasado ? "#1E7A46" : "#0d6d6d" }}>{pasado ? "Disfrutado" : "Planificado"}</span>
              </div>
            );
          })}
        </div>}
    </div>
  );
}
