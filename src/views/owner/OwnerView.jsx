import { useState, useEffect } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { EvolucionView } from "./EvolucionView.jsx";
import { DatosMesView } from "./DatosMesView.jsx";
import { PLView } from "./PLView.jsx";
import { TesoreriaView } from "./TesoreriaView.jsx";
import { AjustesView } from "./AjustesView.jsx";
import { AnalyticaView } from "./AnalyticaView.jsx";
import { UsuariosView } from "./UsuariosView.jsx";
import { HorariosAdminView } from "./HorariosAdminView.jsx";
import { VacacionesAdminView } from "./VacacionesAdminView.jsx";
import { CierresAdminView } from "./CierresAdminView.jsx";

const MUNDOS = {
  finanzas: { label: "Finanzas", sub: "Evolución · P&L · Tesorería · Datos mes", tabs: [
    { id: "resumen", label: "Evolución" }, { id: "analitica", label: "Analítica" }, { id: "mes", label: "Datos mes" }, { id: "resultados", label: "P&L" }, { id: "tesoreria", label: "Tesorería" },
  ] },
  equipo: { label: "Equipo", sub: "Cierres · Horarios · Vacaciones · Usuarios", tabs: [
    { id: "cierres", label: "Cierres" }, { id: "horarios", label: "Horarios" }, { id: "vacaciones", label: "Vacaciones" }, { id: "usuarios", label: "Usuarios" },
  ] },
};

export function OwnerView({ facturas, monthlyData, proveedores, config, onReload, currentUser }) {
  const [mundo, setMundo] = useState(null);
  const [tab, setTab] = useState(null);
  const [focusMonth, setFocusMonth] = useState(null);
  const [avisosVac, setAvisosVac] = useState(0);

  useEffect(() => {
    (async () => { try { const v = await sb.select("vacaciones_solicitudes", "select=id&estado=eq.pendiente"); setAvisosVac(v.length); } catch (e) { /* noop */ } })();
  }, []);

  const entrar = (m) => { setMundo(m); setTab(MUNDOS[m].tabs[0].id); };
  const goEditMonth = (mk) => { setFocusMonth(mk); setMundo("finanzas"); setTab("mes"); };

  if (!mundo && tab !== "ajustes") {
    const hoy = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    return (
      <div style={{ padding: "18px 16px", maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: F, fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 600 }}>{hoy}</div>
          <button onClick={() => setTab("ajustes")} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 8, padding: "6px 12px", fontFamily: F, fontSize: 12, color: C.mut, cursor: "pointer" }}>Ajustes</button>
        </div>
        {["finanzas", "equipo"].map(m => { const M = MUNDOS[m]; return (
          <button key={m} onClick={() => entrar(m)} style={{ width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${C.brd}`, borderRadius: 14, padding: 18, marginBottom: 12, cursor: "pointer" }}>
            <div style={{ fontFamily: SF, fontSize: 20, color: C.char }}>{M.label}</div>
            <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 4 }}>{M.sub}</div>
          </button>
        ); })}
        {avisosVac > 0 && (
          <button onClick={() => { setMundo("equipo"); setTab("vacaciones"); }} style={{ width: "100%", textAlign: "left", background: C.char, border: "none", borderRadius: 14, padding: "13px 16px", cursor: "pointer", marginTop: 4 }}>
            <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.gold }}>{avisosVac} solicitud{avisosVac > 1 ? "es" : ""} de vacaciones por revisar</div>
          </button>
        )}
      </div>
    );
  }

  const M = mundo ? MUNDOS[mundo] : null;

  return (
    <div>
      {tab !== "ajustes" && M && (
        <div style={{ display: "flex", alignItems: "center", background: C.cream, borderBottom: `2px solid ${C.brd}`, position: "sticky", top: 52, zIndex: 9 }}>
          <button onClick={() => { setMundo(null); setTab(null); }} style={{ border: "none", background: "transparent", padding: "11px 12px", fontSize: 18, color: C.char, cursor: "pointer" }}>‹</button>
          <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
            {M.tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "11px 6px", border: "none", background: tab === t.id ? C.char : "transparent", color: tab === t.id ? C.gold : C.mut, fontFamily: F, fontSize: 12, fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", borderBottom: tab === t.id ? `3px solid ${C.gold}` : "3px solid transparent", whiteSpace: "nowrap", minWidth: 64 }}>{t.label}</button>
            ))}
          </div>
        </div>
      )}
      {tab === "ajustes" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.brd}`, position: "sticky", top: 52, background: C.cream, zIndex: 9 }}>
          <button onClick={() => setTab(null)} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 8, width: 34, height: 34, cursor: "pointer", color: C.char, fontSize: 16 }}>‹</button>
          <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>Ajustes</div>
        </div>
      )}

      {tab === "resumen" && <EvolucionView facturas={facturas} monthlyData={monthlyData} />}
      {tab === "analitica" && <AnalyticaView />}
      {tab === "mes" && <DatosMesView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} initialMonth={focusMonth} />}
      {tab === "resultados" && <PLView facturas={facturas} monthlyData={monthlyData} onEditMonth={goEditMonth} />}
      {tab === "tesoreria" && <TesoreriaView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} />}
      {tab === "cierres" && <CierresAdminView />}
      {tab === "horarios" && <HorariosAdminView />}
      {tab === "vacaciones" && <VacacionesAdminView />}
      {tab === "usuarios" && <UsuariosView currentUser={currentUser} />}
      {tab === "ajustes" && <AjustesView currentUser={currentUser} />}
    </div>
  );
}
