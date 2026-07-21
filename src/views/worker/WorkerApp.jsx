import { useState } from "react";
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { IcoCheck, IcoRight, IcoLeft, IcoCalendar, IcoSun, IcoReceipt, IcoUser } from "../../lib/icons.jsx";
import { CerrarTurnoView } from "./CerrarTurnoView.jsx";
import { MiHorarioView } from "./MiHorarioView.jsx";
import { MisVacacionesView } from "./MisVacacionesView.jsx";
import { MiCuentaView } from "./MiCuentaView.jsx";
import { WorkerView } from "../WorkerView.jsx";

const TILES = [
  { id: "horario", label: "Mis horarios", sub: "Tu calendario", Ico: IcoCalendar, iconBg: "#EAF4EE", iconFg: "#2D8B4E" },
  { id: "vacaciones", label: "Mis vacaciones", sub: "Días y solicitudes", Ico: IcoSun, iconBg: "#E4F5F5", iconFg: "#189595" },
  { id: "facturas", label: "Facturas", sub: "Registrar", Ico: IcoReceipt, iconBg: "#F0EEF6", iconFg: "#8B6DAF" },
  { id: "cuenta", label: "Mi cuenta", sub: "Contraseña", Ico: IcoUser, iconBg: "#F0ECE2", iconFg: "#8A7A54" },
];
const TITULOS = { cerrar: "Cerrar turno", horario: "Mis horarios", vacaciones: "Mis vacaciones", facturas: "Facturas", cuenta: "Mi cuenta" };

export function WorkerApp({ user, facturas, proveedores, onReload }) {
  const [screen, setScreen] = useState("home");

  if (screen === "home") {
    const hoy = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    return (
      <div style={{ padding: "18px 16px", maxWidth: 540, margin: "0 auto" }}>
        <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 14 }}>{hoy}</div>

        <button onClick={() => setScreen("cerrar")} style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", background: C.gold, border: "none", borderRadius: 20, padding: 20, display: "flex", alignItems: "center", gap: 15, boxShadow: SHADOW.hero, textAlign: "left" }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, background: C.goldDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IcoCheck size={24} color={C.gold} sw={2.2} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: SF, fontSize: 21, color: C.goldDark }}>Cerrar turno</span>
            <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.goldSub, marginTop: 2 }}>Marca tus tareas del turno</span>
          </span>
          <IcoRight size={20} color={C.goldSub} sw={2.4} />
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          {TILES.map(t => { const Ico = t.Ico; return (
            <button key={t.id} onClick={() => setScreen(t.id)} style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 18, padding: 16, cursor: "pointer", boxShadow: SHADOW.card }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: t.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico size={20} color={t.iconFg} /></span>
              <div style={{ fontFamily: SF, fontSize: 16, color: C.char, marginTop: 12 }}>{t.label}</div>
              <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 2 }}>{t.sub}</div>
            </button>
          ); })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: `1px solid ${C.brdL}`, position: "sticky", top: 52, background: C.cream, zIndex: 8 }}>
        <button onClick={() => setScreen("home")} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IcoLeft size={18} color={C.char} sw={2.4} /></button>
        <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>{TITULOS[screen]}</div>
      </div>
      {screen === "cerrar" && <CerrarTurnoView user={user} />}
      {screen === "horario" && <MiHorarioView user={user} />}
      {screen === "vacaciones" && <MisVacacionesView user={user} />}
      {screen === "facturas" && <WorkerView facturas={facturas} proveedores={proveedores} onReload={onReload} />}
      {screen === "cuenta" && <MiCuentaView />}
    </div>
  );
}
