import { useState, useEffect } from "react";
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { ymd } from "../../lib/turnos.js";
import { huecosCobertura } from "../../lib/cobertura.js";
import { IcoRight, IcoLeft, IcoBars, IcoUsers, IcoCheck } from "../../lib/icons.jsx";
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
import { CambiosAdminView } from "./CambiosAdminView.jsx";
import { HorasExtrasView } from "./HorasExtrasView.jsx";
import { CoberturaAdminView } from "./CoberturaAdminView.jsx";
import { IncidenciasAdminView } from "./IncidenciasAdminView.jsx";
import { TareasAdminView } from "./TareasAdminView.jsx";
import { WorkerView } from "../WorkerView.jsx";

const MUNDOS = {
  finanzas: { label: "Finanzas", sub: "Evolución · P&L · Tesorería · Datos mes · Facturas", Ico: IcoBars, iconBg: "#EAF0F8", iconFg: "#4A7AB5", tabs: [
    { id: "resumen", label: "Evolución" }, { id: "analitica", label: "Analítica" }, { id: "mes", label: "Datos mes" }, { id: "resultados", label: "P&L" }, { id: "tesoreria", label: "Tesorería" }, { id: "facturas", label: "Facturas" },
  ] },
  equipo: { label: "Equipo", sub: "Cierres · Incidencias · Horarios · Vacaciones · Cobertura · Cambios · Horas · Usuarios", Ico: IcoUsers, iconBg: "#F0ECF6", iconFg: "#8B6DAF", tabs: [
    { id: "cierres", label: "Cierres" }, { id: "incidencias", label: "Incidencias" }, { id: "horarios", label: "Horarios" }, { id: "vacaciones", label: "Vacaciones" }, { id: "cobertura", label: "Cobertura" }, { id: "cambios", label: "Cambios" }, { id: "horas", label: "Horas extras" }, { id: "usuarios", label: "Usuarios" },
  ] },
};

export function OwnerView({ facturas, monthlyData, proveedores, config, onReload, currentUser }) {
  const [mundo, setMundo] = useState(null);
  const [tab, setTab] = useState(null);
  const [focusMonth, setFocusMonth] = useState(null);
  const [avisosVac, setAvisosVac] = useState(0);
  const [avisosCambios, setAvisosCambios] = useState(0);
  const [avisosCobertura, setAvisosCobertura] = useState(0);

  useEffect(() => {
    (async () => {
      try { const v = await sb.select("vacaciones_solicitudes", "select=id&estado=eq.pendiente"); setAvisosVac(v.length); } catch (e) { /* noop */ }
      try { const c = await sb.select("cambios_turno", "select=id&estado=eq.pendiente"); setAvisosCambios(c.length); } catch (e) { /* noop */ }
      try {
        const hoy = ymd(new Date()); const d = new Date(); d.setDate(d.getDate() + 60); const hasta = ymd(d);
        const hor = await sb.select("horarios", `select=usuario_id,fecha,turno&fecha=gte.${hoy}&fecha=lte.${hasta}`);
        setAvisosCobertura(new Set(huecosCobertura(hor).map(h => h.fecha)).size);
      } catch (e) { /* noop */ }
    })();
  }, []);

  const entrar = (m) => { setMundo(m); setTab(MUNDOS[m].tabs[0].id); };
  const goEditMonth = (mk) => { setFocusMonth(mk); setMundo("finanzas"); setTab("mes"); };
  const especial = tab === "ajustes" || tab === "tareas";

  const avisoBtn = { width: "100%", boxSizing: "border-box", cursor: "pointer", background: C.char, border: "none", borderRadius: 15, padding: "15px 18px", display: "flex", alignItems: "center", gap: 13, textAlign: "left" };
  const avisoNum = { width: 34, height: 34, borderRadius: "999px", background: C.gold, color: C.goldDark, fontFamily: SF, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  const avisoTxt = { flex: 1, fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.gold };

  if (!mundo && !especial) {
    const hoy = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    const hayAvisos = avisosVac > 0 || avisosCambios > 0 || avisosCobertura > 0;
    return (
      <div style={{ padding: "20px 16px", maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontFamily: F, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.mutL }}>{hoy}</div>
          <button onClick={() => setTab("ajustes")} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, padding: "7px 14px", fontFamily: F, fontSize: 12, fontWeight: 500, color: C.mut, cursor: "pointer" }}>Ajustes</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {["finanzas", "equipo"].map(m => { const M = MUNDOS[m]; const Ico = M.Ico; return (
            <button key={m} onClick={() => entrar(m)} style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 20, padding: 20, cursor: "pointer", boxShadow: SHADOW.card }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ width: 44, height: 44, borderRadius: 13, background: M.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico size={24} color={M.iconFg} /></span>
                <IcoRight size={18} color="#C9C0B0" sw={2.4} />
              </div>
              <div style={{ fontFamily: SF, fontSize: 24, color: C.char, marginTop: 16 }}>{M.label}</div>
              <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 4, lineHeight: 1.4 }}>{M.sub}</div>
            </button>
          ); })}
        </div>

        <button onClick={() => setTab("tareas")} style={{ width: "100%", boxSizing: "border-box", textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 20, padding: 20, cursor: "pointer", boxShadow: SHADOW.card, marginTop: 14, display: "flex", alignItems: "center", gap: 15 }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: "#FBEEDC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IcoCheck size={24} color="#C08A2E" sw={2.2} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: SF, fontSize: 22, color: C.char }}>Tareas</span>
            <span style={{ display: "block", fontFamily: F, fontSize: 12, color: C.mut, marginTop: 3, lineHeight: 1.4 }}>Gestión de tareas de dirección · lista, tablero, calendario y timeline</span>
          </span>
          <IcoRight size={18} color="#C9C0B0" sw={2.4} />
        </button>

        {hayAvisos && (
          <div>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutL, margin: "22px 2px 10px" }}>Necesita tu atención</div>
            {avisosVac > 0 && (
              <button onClick={() => { setMundo("equipo"); setTab("vacaciones"); }} style={avisoBtn}>
                <span style={avisoNum}>{avisosVac}</span>
                <span style={avisoTxt}>solicitud{avisosVac > 1 ? "es" : ""} de vacaciones por revisar</span>
                <IcoRight size={18} color={C.gold} sw={2.4} />
              </button>
            )}
            {avisosCobertura > 0 && (
              <button onClick={() => { setMundo("equipo"); setTab("cobertura"); }} style={{ ...avisoBtn, marginTop: avisosVac > 0 ? 10 : 0 }}>
                <span style={avisoNum}>{avisosCobertura}</span>
                <span style={avisoTxt}>día{avisosCobertura > 1 ? "s" : ""} con turnos sin cubrir</span>
                <IcoRight size={18} color={C.gold} sw={2.4} />
              </button>
            )}
            {avisosCambios > 0 && (
              <button onClick={() => { setMundo("equipo"); setTab("cambios"); }} style={{ ...avisoBtn, marginTop: (avisosVac > 0 || avisosCobertura > 0) ? 10 : 0 }}>
                <span style={avisoNum}>{avisosCambios}</span>
                <span style={avisoTxt}>cambio{avisosCambios > 1 ? "s" : ""} de turno por revisar</span>
                <IcoRight size={18} color={C.gold} sw={2.4} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const M = mundo ? MUNDOS[mundo] : null;

  return (
    <div>
      {!especial && M && (
        <div style={{ display: "flex", alignItems: "center", background: C.char, position: "sticky", top: 52, zIndex: 9, padding: "0 6px", overflowX: "auto" }}>
          <button onClick={() => { setMundo(null); setTab(null); }} style={{ background: "transparent", border: "none", padding: "14px 10px", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}><IcoLeft size={18} color="#C9C0B0" sw={2.4} /></button>
          {M.tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "15px 13px", border: "none", background: "transparent", color: tab === t.id ? C.gold : "#8A8070", fontFamily: F, fontSize: 13, fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", borderBottom: tab === t.id ? `3px solid ${C.gold}` : "3px solid transparent", whiteSpace: "nowrap" }}>{t.label}</button>
          ))}
        </div>
      )}
      {especial && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: `1px solid ${C.brdL}`, position: "sticky", top: 52, background: C.cream, zIndex: 9 }}>
          <button onClick={() => setTab(null)} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IcoLeft size={18} color={C.char} sw={2.4} /></button>
          <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>{tab === "tareas" ? "Tareas" : "Ajustes"}</div>
        </div>
      )}

      {tab === "resumen" && <EvolucionView facturas={facturas} monthlyData={monthlyData} />}
      {tab === "analitica" && <AnalyticaView />}
      {tab === "mes" && <DatosMesView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} initialMonth={focusMonth} />}
      {tab === "resultados" && <PLView facturas={facturas} monthlyData={monthlyData} onEditMonth={goEditMonth} />}
      {tab === "tesoreria" && <TesoreriaView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} />}
      {tab === "facturas" && <WorkerView facturas={facturas} proveedores={proveedores} onReload={onReload} user={currentUser} />}
      {tab === "cierres" && <CierresAdminView />}
      {tab === "incidencias" && <IncidenciasAdminView />}
      {tab === "horarios" && <HorariosAdminView />}
      {tab === "vacaciones" && <VacacionesAdminView />}
      {tab === "cobertura" && <CoberturaAdminView />}
      {tab === "cambios" && <CambiosAdminView />}
      {tab === "horas" && <HorasExtrasView />}
      {tab === "usuarios" && <UsuariosView currentUser={currentUser} />}
      {tab === "tareas" && <TareasAdminView />}
      {tab === "ajustes" && <AjustesView currentUser={currentUser} />}
    </div>
  );
}
