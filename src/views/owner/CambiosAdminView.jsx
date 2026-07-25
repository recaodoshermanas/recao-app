import { useState, useEffect, useCallback } from "react";
import { F, SF, C, chipStyle, CHIP } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { TURNOS } from "../../lib/turnos.js";

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fmtDia(f) { if (!f) return ""; const p = f.split("-"); const d = new Date(f + "T00:00:00"); return `${DOW[d.getDay()]} ${p[2]}/${p[1]}`; }
const secLbl = { fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutL, margin: "0 2px 12px" };
const btnSm = { padding: "8px 14px", borderRadius: 10, border: "none", fontFamily: F, fontSize: 13, fontWeight: 600, cursor: "pointer" };

function ShiftChip({ turno }) {
  const d = TURNOS[turno]; if (!d) return null;
  return <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: d.bg, color: d.fg }}>{turno}</span>;
}

export function CambiosAdminView() {
  const [cambios, setCambios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2800); };

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await sb.fn("cambios-turno", { action: "pendientes" }); setCambios(r.cambios || []); } catch (e) { flash(e.message || "Error"); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const resolver = async (c, estado) => {
    try { const r = await sb.fn("cambios-turno", { action: "resolver", id: c.id, estado }); if (r && r.ok === false) throw new Error(r.error); flash(estado === "aceptado" ? "Cambio aplicado al calendario" : "Cambio rechazado"); await load(); }
    catch (e) { flash(e.message); }
  };
  const eliminar = async (c) => { if (!window.confirm("¿Eliminar este cambio?")) return; try { await sb.fn("cambios-turno", { action: "eliminar", id: c.id }); await load(); } catch (e) { flash(e.message); } };

  const pend = cambios.filter(c => c.estado === "pendiente");
  const resto = cambios.filter(c => c.estado !== "pendiente");

  const card = (c) => (
    <div key={c.id} style={{ background: "#fff", border: c.estado === "pendiente" ? `1.5px solid ${C.gold}` : `1px solid ${C.brdL}`, borderRadius: 16, padding: 15, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.char }}>{c.solicitante || "—"}</span>
        <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut, textTransform: "capitalize" }}>{fmtDia(c.fecha_1)}</span>
        <ShiftChip turno={c.turno_1} />
      </div>
      <div style={{ fontFamily: F, fontSize: 15, color: C.mutL, margin: "6px 0 6px 2px" }}>⇅</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.char }}>{c.otra || "—"}</span>
        <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut, textTransform: "capitalize" }}>{fmtDia(c.fecha_2)}</span>
        <ShiftChip turno={c.turno_2} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13, flexWrap: "wrap" }}>
        <span style={chipStyle(c.estado)}>{CHIP[c.estado].label}</span>
        {c.estado === "pendiente" && <>
          <button onClick={() => resolver(c, "aceptado")} style={{ ...btnSm, background: C.grn, color: "#fff" }}>Aceptar</button>
          <button onClick={() => resolver(c, "rechazado")} style={{ ...btnSm, background: "#fff", color: "#B23A2C", border: "1.5px solid #EDC9C3" }}>Rechazar</button>
        </>}
        <button onClick={() => eliminar(c)} style={{ ...btnSm, background: "none", color: C.mutL, marginLeft: "auto", padding: "8px 4px" }}>Eliminar</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : cambios.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>No hay cambios de turno</div>
          : <>
            {pend.length > 0 && <div style={secLbl}>Pendientes ({pend.length})</div>}
            {pend.map(card)}
            {resto.length > 0 && <div style={{ ...secLbl, marginTop: pend.length > 0 ? 20 : 0 }}>Historial</div>}
            {resto.map(card)}
          </>}
    </div>
  );
}
