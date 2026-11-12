import { F, SF, C } from "./lib/styles.js";
import { useAuth } from "./hooks/useAuth.js";
import { useRecaoData } from "./hooks/useRecaoData.js";
import { LoginScreen, Header } from "./components/LoginScreens.jsx";
import { tokenRecuperar } from "./lib/recuperar.js";
import { WorkerApp } from "./views/worker/WorkerApp.jsx";
import { OwnerView } from "./views/owner/OwnerView.jsx";
import { EventualApp } from "./views/eventual/EventualApp.jsx"; // BOLSA
import { entraEnApp, entraEnPanel } from "./lib/accesos.js"; // ACCESOS

export default function RecaoApp() {
  const { user, checking, login, logout } = useAuth();
  // BOLSA: las eventuales no cargan facturas/datos del mes/config (no son para ellas)
  const sinApp = !!user && !entraEnApp(user); // ACCESOS: cuenta sin acceso a la app de tienda
  const { facturas, monthlyData, proveedores, config, loading, error, reload } = useRecaoData(user && !user.eventual && !sinApp ? user : null);

  if (checking) return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: SF, color: C.char, background: C.cream }}>
      <div style={{ fontSize: "32px", marginBottom: "8px" }}>Recao</div>
    </div>
  );

  // Enlace de "¿Has olvidado tu contraseña?": se muestra aunque haya otra sesión abierta en este móvil
  if (!user || tokenRecuperar()) return <LoginScreen onLogin={login} />;

  // ACCESOS: quien no tiene la app (p. ej. solo panel de dirección) no entra aquí
  if (sinApp) return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "24px", textAlign: "center", fontFamily: F, color: C.char, background: C.cream }}>
      <div style={{ fontFamily: SF, fontSize: "28px", marginBottom: "10px" }}>Recao</div>
      <div style={{ fontSize: "15px", maxWidth: "320px", lineHeight: 1.5 }}>Tu cuenta no tiene acceso a la app de la tienda.</div>
      {entraEnPanel(user) && <a href="https://direccion.elrecao.com" style={{ marginTop: "16px", padding: "12px 20px", borderRadius: "10px", background: C.char, color: C.gold, textDecoration: "none", fontWeight: 600 }}>Ir al panel de dirección</a>}
      <button onClick={logout} style={{ marginTop: "14px", padding: "10px 18px", border: `1.5px solid ${C.brd}`, borderRadius: "10px", background: "#fff", color: C.char, cursor: "pointer", fontFamily: F }}>Salir</button>
    </div>
  );

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
      {user.rol === "trabajadora" && user.eventual && <EventualApp user={user} />}
      {user.rol === "trabajadora" && !user.eventual && <WorkerApp user={user} facturas={facturas} proveedores={proveedores} onReload={reload} />}
      {user.rol === "admin" && <OwnerView facturas={facturas} monthlyData={monthlyData} proveedores={proveedores} config={config} onReload={reload} currentUser={user} />}
    </div>
  );
}
