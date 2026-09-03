import { useState, useEffect, useCallback } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

function ymd(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${dd}`; }
function fmtF(s) { if (!s) return ""; const p = s.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; }
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const NIVEL = { leve: { label: "Leve", bg: "#FBF0DA", fg: "#8a6a1e" }, grave: { label: "Grave", bg: "#FBEAE7", fg: "#B23A2C" }, muy_grave: { label: "Muy grave", bg: "#F3D9D4", fg: "#7a1f10" } };

const ESCALA_MES = [{ r: "0 fallos", p: "100 %", t: 0 }, { r: "1 fallo", p: "75 %", t: 1 }, { r: "2 fallos", p: "40 %", t: 2 }, { r: "3 o más", p: "0 %", t: 3 }];
const ESCALA_TRAY = [{ r: "0 o 1 fallo", p: "100 %", t: 0 }, { r: "2 fallos", p: "50 %", t: 2 }, { r: "3 o más", p: "0 %", t: 3 }];

export function MiSeguimientoView({ user }) {
  const [fallos, setFallos] = useState([]);
  const [faltas, setFaltas] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFallos(await sb.select("fallos", `select=fecha,es_falsedad&usuario_id=eq.${user.id}&estado=eq.confirmado`));
      setFaltas(await sb.select("faltas", `select=nivel,fecha,fecha_caducidad&usuario_id=eq.${user.id}&order=fecha.desc`));
    } catch (e) { /* noop */ }
    setLoading(false);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  const inMonth = (f) => { const d = new Date(f + "T00:00:00"); return d.getFullYear() === y && d.getMonth() === m; };
  const trayStart = ymd(new Date(y, m - 2, 1)); const trayEnd = ymd(new Date(y, m + 1, 0));
  const fallosMes = fallos.filter(f => inMonth(f.fecha)).length;
  const fallosTray = fallos.filter(f => f.fecha >= trayStart && f.fecha <= trayEnd).length;
  const hoy = ymd(now);
  const faltasVig = faltas.filter(f => !f.fecha_caducidad || f.fecha_caducidad >= hoy);

  const tierMes = fallosMes >= 3 ? 3 : fallosMes;
  const tierTray = fallosTray >= 3 ? 3 : (fallosTray >= 2 ? 2 : 0);

  const Contador = ({ titulo, sub, valor, afecta }) => (
    <div style={{ background: C.char, borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gold }}>{titulo}</div>
      <div style={{ fontFamily: F, fontSize: 11.5, color: "#C9C0B0", marginTop: 2 }}>{sub}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
        <span style={{ fontFamily: SF, fontSize: 40, color: "#fff", lineHeight: 1 }}>{valor}</span>
        <span style={{ fontFamily: F, fontSize: 13, color: "#C9C0B0" }}>{valor === 1 ? "fallo" : "fallos"}</span>
      </div>
      <div style={{ fontFamily: F, fontSize: 12, color: C.gold, marginTop: 8 }}>{afecta}</div>
    </div>
  );

  const Escala = ({ filas, tier }) => (
    <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, overflow: "hidden", marginBottom: 18 }}>
      {filas.map((f, i) => {
        const on = f.t === tier;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: on ? "#FBF4E6" : "#fff", borderTop: i ? `1px solid ${C.brdL}` : "none" }}>
            <span style={{ fontFamily: F, fontSize: 13, fontWeight: on ? 700 : 500, color: on ? C.goldDark : C.mut }}>{f.r}</span>
            <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: on ? C.goldDark : C.char }}>{f.p}{on ? "  ·  tú" : ""}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : <>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginBottom: 16, lineHeight: 1.45 }}>Tu rendimiento para el plus, con las escalas para que calcules tú misma lo que te corresponde. <b>Un fallo solo se cuenta cuando dirección lo confirma tras el procedimiento.</b></div>

          <Contador titulo={`Fallos de ${MESES[m]}`} sub="Mes en curso · se reinicia el día 1" valor={fallosMes} afecta="Determina el plus mensual" />
          <Escala filas={ESCALA_MES} tier={tierMes} />

          <Contador titulo="Fallos del trimestre" sub="Este mes y los 2 anteriores" valor={fallosTray} afecta="Determina el plus de trayectoria" />
          <Escala filas={ESCALA_TRAY} tier={tierTray} />

          <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.mutL, margin: "6px 2px 10px" }}>Faltas vigentes</div>
          {faltasVig.length === 0 ? (
            <div style={{ fontFamily: F, fontSize: 14, color: "#1E7A46", background: "#E7F3EC", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>No tienes ninguna falta vigente ✓</div>
          ) : faltasVig.map((f, i) => {
            const nv = NIVEL[f.nivel] || NIVEL.leve;
            return (
              <div key={i} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "3px 9px", borderRadius: 999, background: nv.bg, color: nv.fg }}>{nv.label}</span>
                  <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 6 }}>Del {fmtF(f.fecha)}</div>
                </div>
                {f.fecha_caducidad && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mutL, textAlign: "right" }}>Caduca el<br /><b style={{ color: C.char }}>{fmtF(f.fecha_caducidad)}</b></div>}
              </div>
            );
          })}
        </>}
    </div>
  );
}
