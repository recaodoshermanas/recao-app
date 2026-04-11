import { useState } from "react";
import { F, C } from "../../lib/styles.js";
import { EvolucionView } from "./EvolucionView.jsx";
import { DatosMesView } from "./DatosMesView.jsx";
import { PLView } from "./PLView.jsx";
import { TesoreriaView } from "./TesoreriaView.jsx";
import { AjustesView } from "./AjustesView.jsx";

export function OwnerView({ facturas, monthlyData, proveedores, config, onReload, currentUser }) {
  const [tab, setTab] = useState("resumen");
  const [focusMonth, setFocusMonth] = useState(null);

  const tabs = [
    { id: "resumen", label: "Evolución", icon: "◉" },
    { id: "mes", label: "Datos mes", icon: "✎" },
    { id: "resultados", label: "P&L", icon: "▤" },
    { id: "tesoreria", label: "Tesorería", icon: "◈" },
    { id: "ajustes", label: "Ajustes", icon: "⚙" },
  ];

  const goEditMonth = (mk) => { setFocusMonth(mk); setTab("mes"); };

  return (
    <div>
      <div style={{ display: "flex", borderBottom: `2px solid ${C.brd}`, background: C.cream, position: "sticky", top: 52, zIndex: 9 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "11px 4px 9px", border: "none", background: tab === t.id ? C.char : "transparent", color: tab === t.id ? C.gold : C.mut, fontFamily: F, fontSize: "11px", fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", borderBottom: tab === t.id ? `3px solid ${C.gold}` : "3px solid transparent" }}>
            <span style={{ fontSize: "14px", display: "block", marginBottom: "1px" }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      {tab === "resumen" && <EvolucionView facturas={facturas} monthlyData={monthlyData} />}
      {tab === "mes" && <DatosMesView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} initialMonth={focusMonth} />}
      {tab === "resultados" && <PLView facturas={facturas} monthlyData={monthlyData} onEditMonth={goEditMonth} />}
      {tab === "tesoreria" && <TesoreriaView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} />}
      {tab === "ajustes" && <AjustesView currentUser={currentUser} />}
    </div>
  );
}
