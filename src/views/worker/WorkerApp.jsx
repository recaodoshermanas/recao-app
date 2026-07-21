import { useState } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { CerrarTurnoView } from "./CerrarTurnoView.jsx";
import { MiHorarioView } from "./MiHorarioView.jsx";
import { MisVacacionesView } from "./MisVacacionesView.jsx";
import { MiCuentaView } from "./MiCuentaView.jsx";
import { WorkerView } from "../WorkerView.jsx";

const TILES = [
  { id: "cerrar", label: "Cerrar turno", sub: "Marca tus tareas del turno", hero: true },
  { id: "horario", label: "Mis horarios", sub: "Tu calendario" },
  { id: "vacaciones", label: "Mis vacaciones", sub: "Días y solicitudes" },
  { id: "facturas", label: "Facturas", sub: "Registrar" },
  { id: "cuenta", label: "Mi cuenta", sub: "Contraseña" },
];

export function WorkerApp({ user, facturas, proveedores, onReload }) {
  const [screen, setScreen] = useState("home");
  const title = (TILES.find(t => t.id === screen) || {}).label;

  if (screen === "home") {
    const hoy = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    return (
      <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
        <div style={{ fontFamily: F, fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 600, marginBottom: 14 }}>{hoy}</div>
        {TILES.filter(t => t.hero).map(t => (
          <button key={t.id} onClick={() => setScreen(t.id)} style={{ width: "100%", textAlign: "left", background: C.gold, border: "none", borderRadius: 14, padding: 18, marginBottom: 12, cursor: "pointer" }}>
            <div style={{ fontFamily: SF, fontSize: 20, color: "#412402" }}>{t.label}</div>
            <div style={{ fontFamily: F, fontSize: 13, color: "#633806", marginTop: 3 }}>{t.sub}</div>
          </button>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
          {TILES.filter(t => !t.hero).map(t => (
            <button key={t.id} onClick={() => setScreen(t.id)} style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.brd}`, borderRadius: 12, padding: 14, cursor: "pointer" }}>
              <div style={{ fontFamily: SF, fontSize: 15, color: C.char }}>{t.label}</div>
              <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 3 }}>{t.sub}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.brd}`, position: "sticky", top: 52, background: C.cream, zIndex: 8 }}>
        <button onClick={() => setScreen("home")} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 8, width: 34, height: 34, cursor: "pointer", color: C.char, fontSize: 16 }}>‹</button>
        <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>{title}</div>
      </div>
      {screen === "cerrar" && <CerrarTurnoView user={user} />}
      {screen === "horario" && <MiHorarioView user={user} />}
      {screen === "vacaciones" && <MisVacacionesView user={user} />}
      {screen === "facturas" && <WorkerView facturas={facturas} proveedores={proveedores} onReload={onReload} />}
      {screen === "cuenta" && <MiCuentaView />}
    </div>
  );
}
