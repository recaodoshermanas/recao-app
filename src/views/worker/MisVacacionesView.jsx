import { useState, useEffect, useCallback } from "react";
import { F, SF, C, inp } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { resumenVacaciones } from "../../lib/vacaciones.js";

const ANIO = 2026;
const EST = {
  pendiente: { label: "Pendiente", bg: "#FAEEDA", fg: "#7a5a12" },
  aceptado:  { label: "Aceptado",  bg: "#E1F5EE", fg: "#0F6E56" },
  rechazado: { label: "Rechazado", bg: "#FCEBEB", fg: "#A32D2D" },
};
function diasEntre(a, b) { if (!a || !b) return 0; const d = (new Date(b) - new Date(a)) / 86400000 + 1; return d > 0 ? Math.round(d) : 0; }
function fmtF(s) { if (!s) return ""; const p = s.split("-"); return `${p[2]}/${p[1]}`; }
function ymd(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }

export function MisVacacionesView({ user }) {
  const [sols, setSols] = useState([]);
  const [total, setTotal] = useState(22);
  const [ini, setIni] = useState(""); const [fin, setFin] = useState(""); const [dias, setDias] = useState("");
  const [msg, setMsg] = useState("");

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };
  const load = useCallback(async () => {
    try {
      setSols(await sb.select("vacaciones_solicitudes", `select=*&usuario_id=eq.${user.id}&order=fecha_inicio.desc`));
      const sal = await sb.select("vacaciones_saldo", `select=dias_totales&usuario_id=eq.${user.id}&anio=eq.${ANIO}`);
      setTotal(sal[0] ? sal[0].dias_totales : 22);
    } catch (e) { /* noop */ }
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const r = resumenVacaciones(total, sols, ymd(new Date()));

  const solicitar = async () => {
    const d = parseInt(dias || diasEntre(ini, fin), 10);
    if (!ini || !fin || !d) { flash("Pon fechas"); return; }
    try { await sb.insert("vacaciones_solicitudes", { usuario_id: user.id, fecha_inicio: ini, fecha_fin: fin, dias: d, estado: "pendiente" }); setIni(""); setFin(""); setDias(""); flash("Solicitud enviada"); await load(); }
    catch (e) { flash(e.message); }
  };
  const cancelar = async (s) => { try { await sb.delete("vacaciones_solicitudes", `id=eq.${s.id}`); await load(); } catch (e) { flash(e.message); } };

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      <div style={{ background: "#60d4d6", borderRadius: 14, padding: 18, marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontFamily: SF, fontSize: 40, color: "#0a3b3b", lineHeight: 1 }}>{r.restantes}</div>
        <div style={{ fontFamily: F, fontSize: 13, color: "#0a3b3b", marginTop: 4 }}>días disponibles de {r.total}</div>
        <div style={{ fontFamily: F, fontSize: 11.5, color: "#0a3b3b", marginTop: 6, opacity: 0.8 }}>{r.disfrutados} disfrutados · {r.futuros} aprobados a futuro · {r.solicitados} por confirmar</div>
      </div>

      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 8, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      <div style={{ background: "#fff", border: `1px solid ${C.brd}`, borderRadius: 12, padding: 14, marginBottom: 18 }}>
        <div style={{ fontFamily: SF, fontSize: 16, color: C.char, marginBottom: 10 }}>Solicitar vacaciones</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input type="date" value={ini} onChange={e => { setIni(e.target.value); setDias(String(diasEntre(e.target.value, fin) || "")); }} style={{ ...inp, marginBottom: 0 }} />
          <input type="date" value={fin} onChange={e => { setFin(e.target.value); setDias(String(diasEntre(ini, e.target.value) || "")); }} style={{ ...inp, marginBottom: 0 }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="number" value={dias} onChange={e => setDias(e.target.value)} placeholder="Días" style={{ ...inp, marginBottom: 0, width: 90 }} />
          <button onClick={solicitar} style={{ flex: 1, padding: 12, border: "none", borderRadius: 10, background: C.char, color: C.gold, fontFamily: SF, fontSize: 15, cursor: "pointer" }}>Enviar solicitud</button>
        </div>
      </div>

      <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 2px 8px" }}>Mis solicitudes</div>
      {sols.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Aún no has solicitado vacaciones</div>
        : sols.map(s => (
          <div key={s.id} style={{ background: "#fff", border: `1px solid ${C.brd}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char }}>{fmtF(s.fecha_inicio)} – {fmtF(s.fecha_fin)}</div>
              <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 2 }}>{s.dias} días</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, background: EST[s.estado].bg, color: EST[s.estado].fg }}>{EST[s.estado].label}</span>
              {s.estado === "pendiente" && <button onClick={() => cancelar(s)} style={{ border: "none", background: "none", color: "#ccc", fontSize: 18, cursor: "pointer" }}>×</button>}
            </div>
          </div>
        ))}
    </div>
  );
}
