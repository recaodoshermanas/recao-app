import { F, SF, C } from "./lib/styles.js";
import { useAuth } from "./hooks/useAuth.js";
import { useRecaoData } from "./hooks/useRecaoData.js";
import { LoginScreen, Header } from "./components/LoginScreens.jsx";
import { WorkerApp } from "./views/worker/WorkerApp.jsx";
import { OwnerView } from "./views/owner/OwnerView.jsx";

export default function RecaoApp() {
  const { user, checking, login, logout } = useAuth();
  const { facturas, monthlyData, proveedores, config, loading, error, reload } = useRecaoData();

  if (checking) return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: SF, color: C.char, background: C.cream }}>
      <div style={{ fontSize: "32px", marginBottom: "8px" }}>Recao</div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={login} />;

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

  return (
    <div style={{ minHeight: "100vh", background: C.cream }}>
      <Header user={user} onLogout={logout} />
      {user.rol === "trabajadora" && <WorkerApp user={user} facturas={facturas} proveedores={proveedores} onReload={reload} />}
      {user.rol === "admin" && <OwnerView facturas={facturas} monthlyData={monthlyData} proveedores={proveedores} config={config} onReload={reload} currentUser={user} />}
    </div>
  );
}
