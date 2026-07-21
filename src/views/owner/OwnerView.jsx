import { useState } from "react";
import { F, C } from "../../lib/styles.js";
import { EvolucionView } from "./EvolucionView.jsx";
import { DatosMesView } from "./DatosMesView.jsx";
import { PLView } from "./PLView.jsx";
import { TesoreriaView } from "./TesoreriaView.jsx";
import { AjustesView } from "./AjustesView.jsx";
import { AnalyticaView } from "./AnalyticaView.jsx";
import { UsuariosView } from "./UsuariosView.jsx";

export function OwnerView({ facturas, monthlyData, proveedores, config, onReload, currentUser }) {
  const [tab, setTab] = useState("resumen");
  const [focusMonth, setFocusMonth] = useState(null);

  const tabs = [
    { id: "resumen", label: "Evolucion", icon: "\u25C9" },
    { id: "analitica", label: "Analitica", icon: "\u25CE" },
    { id: "mes", label: "Datos mes", icon: "\u270E" },
    { id: "resultados", label: "P&L", icon: "\u25A4" },
    { id: "tesoreria", label: "Tesoreria", icon: "\u25C8" },
    { id: "usuarios", label: "Usuarios", icon: "\u25C9" },
    { id: "ajustes", label: "Ajustes", icon: "\u2699" },
  ];

  const goEditMonth = (mk) => { setFocusMonth(mk); setTab("mes"); };

  return (
    <div>
      <div style={{ display: "flex", borderBottom: `2px solid ${C.brd}`, background: C.cream, position: "sticky", top: 52, zIndex: 9, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "11px 4px 9px", border: "none", background: tab === t.id ? C.char : "transparent", color: tab === t.id ? C.gold : C.mut, fontFamily: F, fontSize: "11px", fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", borderBottom: tab === t.id ? `3px solid ${C.gold}` : "3px solid transparent", whiteSpace: "nowrap", minWidth: "60px" }}>
            <span style={{ fontSize: "14px", display: "block", marginBottom: "1px" }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      {tab === "resumen" && <EvolucionView facturas={facturas} monthlyData={monthlyData} />}
      {tab === "analitica" && <AnalyticaView />}
      {tab === "mes" && <DatosMesView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} initialMonth={focusMonth} />}
      {tab === "resultados" && <PLView facturas={facturas} monthlyData={monthlyData} onEditMonth={goEditMonth} />}
      {tab === "tesoreria" && <TesoreriaView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} />}
      {tab === "usuarios" && <UsuariosView currentUser={currentUser} />}
      {tab === "ajustes" && <AjustesView currentUser={currentUser} />}
    </div>
  );
}
