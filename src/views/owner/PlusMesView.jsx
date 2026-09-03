import { useState, useEffect, useCallback } from "react";
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { IcoLeft, IcoRight } from "../../lib/icons.jsx";
import { sb } from "../../lib/supabase.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const eur = (v) => Number(v || 0).toFixed(2).replace(".", ",") + " €";
const pct = (v) => Math.round(Number(v || 0) * 100) + "%";

export function PlusMesView() {
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await sb.fn("gestion-usuarios", { action: "listar" });
      const trab = (r.usuarios || []).filter(u => u.rol === "trabajadora" && u.activo && !u.eventual).sort((a, b) => a.nombre.localeCompare(b.nombre));
      const res = [];
      for (const t of trab) {
        try {
          const c = await sb.rpc("plus_calculo", { p_uid: t.id, p_anio: anio, p_mes: mes });
          res.push({ t, c: Array.isArray(c) ? c[0] : c });
        } catch (e) { res.push({ t, c: null }); }
      }
      setFilas(res);
    } catch (e) { setMsg(e.message || "Error"); }
    setLoading(false);
  }, [anio, mes]);
  useEffect(() => { load(); }, [load]);

  const mover = (n) => { let m = mes + n, a = anio; if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; } setMes(m); setAnio(a); };
  const totalMes = filas.reduce((s, f) => s + Number(f.c?.total || 0), 0);

  const exportar = () => {
    const cab = ["Trabajadora", "Turnos programados", "Turnos computables", "Fallos mes", "Fallos trayectoria", "% mensual", "Importe mensual", "% trayectoria", "Importe trayectoria", "Total"];
    const rows = filas.map(f => {
      const c = f.c || {};
      return [f.t.nombre, c.turnos_prog ?? "", c.turnos_comp ?? "", c.fallos_mes ?? "", c.fallos_tray ?? "", pct(c.pct_mensual), String(c.importe_mensual ?? "").replace(".", ","), pct(c.pct_tray), String(c.importe_tray ?? "").replace(".", ","), String(c.total ?? "").replace(".", ",")];
    });
    const csv = [cab, ...rows].map(r => r.map(x => `"${String(x)}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `plus_${anio}_${String(mes).padStart(2, "0")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={() => mover(-1)} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IcoLeft size={18} color={C.char} sw={2.2} /></button>
        <div style={{ fontFamily: SF, fontSize: 19, color: C.char, textTransform: "capitalize" }}>{MESES[mes - 1]} {anio}</div>
        <button onClick={() => mover(1)} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IcoRight size={18} color={C.char} sw={2.2} /></button>
      </div>

      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.red, textAlign: "center", marginBottom: 12 }}>{msg}</div>}

      <div style={{ background: C.char, borderRadius: 16, padding: "15px 18px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: F, fontSize: 11.5, color: "#C9C0B0" }}>Total plus del mes</div>
          <div style={{ fontFamily: SF, fontSize: 26, color: C.gold, marginTop: 2 }}>{eur(totalMes)}</div>
        </div>
        <button onClick={exportar} style={{ background: C.gold, color: C.goldDark, border: "none", borderRadius: 11, padding: "10px 16px", fontFamily: F, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Descargar CSV</button>
      </div>

      <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginBottom: 14, lineHeight: 1.4 }}>Prorrateo al 100% (mes completo). Falta afinar el prorrateo de meses parciales y la media en vacaciones.</div>

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Calculando…</div>
        : filas.map(({ t, c }) => (
          <div key={t.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 15, marginBottom: 10, boxShadow: SHADOW.card }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontFamily: SF, fontSize: 17, color: C.char }}>{t.nombre}</div>
              <div style={{ fontFamily: SF, fontSize: 19, color: C.goldDark }}>{c ? eur(c.total) : "—"}</div>
            </div>
            {c && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, background: "#FAF7F2", borderRadius: 10, padding: "9px 11px", textAlign: "center" }}>
                    <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>{c.fallos_mes}</div>
                    <div style={{ fontFamily: F, fontSize: 10.5, color: C.mut }}>fallos mes</div>
                  </div>
                  <div style={{ flex: 1, background: "#FAF7F2", borderRadius: 10, padding: "9px 11px", textAlign: "center" }}>
                    <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>{c.fallos_tray}</div>
                    <div style={{ fontFamily: F, fontSize: 10.5, color: C.mut }}>fallos trayectoria</div>
                  </div>
                  <div style={{ flex: 1, background: "#FAF7F2", borderRadius: 10, padding: "9px 11px", textAlign: "center" }}>
                    <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>{c.turnos_prog}</div>
                    <div style={{ fontFamily: F, fontSize: 10.5, color: C.mut }}>turnos</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontSize: 13, color: C.mut, padding: "3px 0" }}><span>Mensual · {eur(c.base_mensual)} × {pct(c.pct_mensual)}</span><span style={{ color: C.char, fontWeight: 700 }}>{eur(c.importe_mensual)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontSize: 13, color: C.mut, padding: "3px 0" }}><span>Trayectoria · {eur(c.base_tray)} × {pct(c.pct_tray)}</span><span style={{ color: C.char, fontWeight: 700 }}>{eur(c.importe_tray)}</span></div>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
