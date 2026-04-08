import { useState } from "react";
import { F, SF, C } from "./lib/styles.js";
import { useRecaoData } from "./hooks/useRecaoData.js";
import { RoleSelectScreen, PasswordScreen, Header } from "./components/LoginScreens.jsx";
import { WorkerView } from "./views/WorkerView.jsx";
import { OwnerView } from "./views/owner/OwnerView.jsx";

export default function RecaoApp() {
  const [role, setRole] = useState(null);
  const [pendingOwner, setPendingOwner] = useState(false);
  const { facturas, monthlyData, proveedores, config, loading, error, reload } = useRecaoData();

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: SF, color: C.char, background: C.cream }}>
      <div style={{ fontSize: "32px", marginBottom: "8px" }}>Recao</div>
      <div style={{ fontFamily: F, fontSize: "12px", color: C.mut }}>Cargando datos...</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: F, color: C.red }}>
      Error de conexión: {error}
      <br /><button onClick={reload} style={{ marginTop: "16px", padding: "10px 20px", border: "none", borderRadius: "8px", background: C.char, color: C.gold, cursor: "pointer", fontFamily: F }}>Reintentar</button>
    </div>
  );

  if (pendingOwner) return <PasswordScreen onSuccess={() => { setRole("dueno"); setPendingOwner(false); }} onBack={() => setPendingOwner(false)} />;

  if (!role) return <RoleSelectScreen onSelectWorker={() => setRole("trabajadora")} onSelectOwner={() => setPendingOwner(true)} />;

  return (
    <div style={{ minHeight: "100vh", background: C.cream }}>
      <Header roleLabel={role === "trabajadora" ? "Trabajadora" : "Dirección"} onLogout={() => setRole(null)} />
      {role === "trabajadora" && <WorkerView facturas={facturas} proveedores={proveedores} onReload={reload} />}
      {role === "dueno" && <OwnerView facturas={facturas} monthlyData={monthlyData} proveedores={proveedores} config={config} onReload={reload} />}
    </div>
  );
}
