import { useState } from "react";
import { F, C } from "../../lib/styles";
import { EvolucionView } from "./EvolucionView";
import { DatosMesView } from "./DatosMesView";
import { PLView } from "./PLView";
import { TesoreriaView } from "./TesoreriaView";

export function OwnerView({ facturas, monthlyData, proveedores, config, onReload }) {
  const [tab, setTab] = useState("resumen");
  const tabs = [
    { id: "resumen", label: "Evolución", icon: "◉" },
    { id: "mes", label: "Datos mes", icon: "✎" },
    { id: "resultados", label: "P&L", icon: "▤" },
    { id: "tesoreria", label: "Tesorería", icon: "◈" },
  ];
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
      {tab === "mes" && <DatosMesView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} />}
      {tab === "resultados" && <PLView facturas={facturas} monthlyData={monthlyData} />}
      {tab === "tesoreria" && <TesoreriaView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} />}
    </div>
  );
}
