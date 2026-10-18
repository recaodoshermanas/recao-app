import { useState, useEffect } from "react";
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { IcoCheck, IcoRight, IcoLeft, IcoCalendar, IcoSun, IcoReceipt, IcoUser, IcoSwap, IcoBars, IcoUsers } from "../../lib/icons.jsx";
import { sb } from "../../lib/supabase.js"; // BOLSA
import { BOLSA_ACTIVA } from "../../lib/bolsa.js"; // BOLSA
import { CerrarTurnoView } from "./CerrarTurnoView.jsx";
import { MiHorarioView } from "./MiHorarioView.jsx";
import { MisVacacionesView } from "./MisVacacionesView.jsx";
import { MiCuentaView } from "./MiCuentaView.jsx";
import { CambioTurnoView } from "./CambioTurnoView.jsx";
import { RevisarTurnoView } from "./RevisarTurnoView.jsx";
import { MiSeguimientoView } from "./MiSeguimientoView.jsx";
import { MisAvisosView } from "./MisAvisosView.jsx";
import { CubrirTurnosView } from "./CubrirTurnosView.jsx"; // BOLSA
import { RecepcionView, AnadirProductoView } from "./RecepcionView.jsx"; // RECEPCION
import { MisFichajesView } from "./MisFichajesView.jsx"; // FICHAJES
import { MisDocumentosView } from "./MisDocumentosView.jsx"; // DOCUMENTOS
import { WorkerView } from "../WorkerView.jsx";
import { NovedadesEquipo } from "../../components/Novedades.jsx"; // NOVEDADES

const IcoCaja = ({ size = 20, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></svg>; // RECEPCION
const TILES = [
  { id: "recepcion", label: "Recepcionar pedido", sub: "Mercancía que llega", Ico: IcoCaja, iconBg: "#FBF0DA", iconFg: "#B08421" }, // RECEPCION
  ...(BOLSA_ACTIVA ? [{ id: "cubrir", label: "Turnos para cubrir", sub: "Mañana y Tarde", Ico: IcoUsers, iconBg: "#FBF0DA", iconFg: "#B08421" }] : []), // BOLSA
  { id: "horario", label: "Mis horarios", sub: "Tu calendario", Ico: IcoCalendar, iconBg: "#EAF4EE", iconFg: "#2D8B4E" },
  { id: "fichajes", label: "Mis fichajes", sub: "Horas de la caja", Ico: IcoCalendar, iconBg: "#EAF0F8", iconFg: "#4A7AB5" }, // FICHAJES
  { id: "revisar", label: "Turno anterior", sub: "Revisar y reportar", Ico: IcoCheck, iconBg: "#FBEDE9", iconFg: "#C44D3F" },
  { id: "documentos", label: "Mis documentos", sub: "Nóminas y contrato", Ico: IcoReceipt, iconBg: "#F0ECE2", iconFg: "#8A7A54" }, // DOCUMENTOS
  { id: "seguimiento", label: "Mi seguimiento", sub: "Plus y faltas", Ico: IcoBars, iconBg: "#EAF0F8", iconFg: "#4A7AB5" },
  { id: "avisos", label: "Avisos", sub: "Incidencias y plazos", Ico: IcoCheck, iconBg: "#FBF0DA", iconFg: "#B08421" },
  { id: "cambio", label: "Cambiar turno", sub: "Con una compañera", Ico: IcoSwap, iconBg: "#FBEEDC", iconFg: "#C08A2E" },
  { id: "vacaciones", label: "Mis vacaciones", sub: "Días y solicitudes", Ico: IcoSun, iconBg: "#E4F5F5", iconFg: "#189595" },
  { id: "facturas", label: "Facturas", sub: "Registrar", Ico: IcoReceipt, iconBg: "#F0EEF6", iconFg: "#8B6DAF" },
  { id: "cuenta", label: "Mi cuenta", sub: "Contraseña", Ico: IcoUser, iconBg: "#F0ECE2", iconFg: "#8A7A54" },
];
const TITULOS = { anadir: "Añadir producto", documentos: "Mis documentos", fichajes: "Mis fichajes", recepcion: "Recepcionar pedido", cerrar: "Mi turno", cubrir: "Turnos para cubrir", horario: "Mis horarios", revisar: "Turno anterior", seguimiento: "Mi seguimiento", avisos: "Avisos", cambio: "Cambiar turno", vacaciones: "Mis vacaciones", facturas: "Facturas", cuenta: "Mi cuenta" };

export function WorkerApp({ user, facturas, proveedores, onReload }) {
  const [screen, setScreen] = useState("home");
  const [porCubrir, setPorCubrir] = useState(0); // BOLSA
  const [porRecepcionar, setPorRecepcionar] = useState({ n: 0, listos: 0 }); // RECEPCION

  useEffect(() => {
    const h = (e) => { const d = e.detail && e.detail.destino; if (d === "avisos") setScreen("avisos"); else if (d === "vacaciones") setScreen("vacaciones"); else if (d === "cambio") setScreen("cambio"); else if (d === "cubrir" && BOLSA_ACTIVA) setScreen("cubrir"); else if (d === "recepcion") setScreen("recepcion"); else if (d === "fichajes") setScreen("fichajes"); else if (d === "documentos") setScreen("documentos"); };
    window.addEventListener("recao-nav", h);
    return () => window.removeEventListener("recao-nav", h);
  }, []);

  // BOLSA: cuántos turnos puede cubrir ahora mismo (sin contar los que ya rechazó)
  useEffect(() => {
    if (!BOLSA_ACTIVA || screen !== "home") return;
    sb.rpc("bolsa_disponibles").then(r => setPorCubrir((r || []).filter(x => x.destino === "plantilla" && !x.rechazado).length)).catch(() => {});
  }, [screen]);

  // RECEPCION: pedidos pendientes de recepcionar (y cuántos ya tienen su factura)
  useEffect(() => {
    if (screen !== "home") return;
    sb.fn("recepcion", { accion: "inicio" }).then(r => { const p = r.pendientes || []; setPorRecepcionar({ n: p.length, listos: p.filter(x => x.estado === "por_revisar" && x.via === "email").length }); }).catch(() => {});
  }, [screen]);

  if (screen === "home") {
    const hoy = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    return (
      <div style={{ padding: "18px 16px", maxWidth: 540, margin: "0 auto" }}>
        <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 14 }}>{hoy}</div>

        <button onClick={() => setScreen("cerrar")} style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", background: C.gold, border: "none", borderRadius: 20, padding: 20, display: "flex", alignItems: "center", gap: 15, boxShadow: SHADOW.hero, textAlign: "left" }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, background: C.goldDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IcoCheck size={24} color={C.gold} sw={2.2} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: SF, fontSize: 21, color: C.goldDark }}>Mi turno</span>
            <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.goldSub, marginTop: 2 }}>Tus tareas de hoy y cerrar el turno</span>
          </span>
          <IcoRight size={20} color={C.goldSub} sw={2.4} />
        </button>

        <NovedadesEquipo estilo={{ marginTop: 12 }} />

        {BOLSA_ACTIVA && porCubrir > 0 && ( // BOLSA
          <button onClick={() => setScreen("cubrir")} style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", marginTop: 12, background: C.char, border: "none", borderRadius: 15, padding: "15px 18px", display: "flex", alignItems: "center", gap: 13, textAlign: "left" }}>
            <span style={{ width: 34, height: 34, borderRadius: "999px", background: C.gold, color: C.goldDark, fontFamily: SF, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{porCubrir}</span>
            <span style={{ flex: 1, fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.gold }}>turno{porCubrir > 1 ? "s" : ""} de Mañana o Tarde por cubrir en tus días libres</span>
            <IcoRight size={18} color={C.gold} sw={2.4} />
          </button>
        )}

        {porRecepcionar.n > 0 && ( // RECEPCION
          <button onClick={() => setScreen("recepcion")} style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", marginTop: 12, background: C.char, border: "none", borderRadius: 15, padding: "15px 18px", display: "flex", alignItems: "center", gap: 13, textAlign: "left" }}>
            <span style={{ width: 34, height: 34, borderRadius: "999px", background: C.gold, color: C.goldDark, fontFamily: SF, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{porRecepcionar.n}</span>
            <span style={{ flex: 1, fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.gold }}>pedido{porRecepcionar.n > 1 ? "s" : ""} por recepcionar{porRecepcionar.listos ? ` · ${porRecepcionar.listos} ya ${porRecepcionar.listos > 1 ? "tienen" : "tiene"} su factura` : ""}</span>
            <IcoRight size={18} color={C.gold} sw={2.4} />
          </button>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          {TILES.map(t => { const Ico = t.Ico; return (
            <button key={t.id} onClick={() => setScreen(t.id)} style={{ position: "relative", textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 18, padding: 16, cursor: "pointer", boxShadow: SHADOW.card }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: t.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico size={20} color={t.iconFg} /></span>
              {t.id === "recepcion" && porRecepcionar.n > 0 && <span style={{ position: "absolute", top: 12, right: 12, minWidth: 22, height: 22, padding: "0 6px", boxSizing: "border-box", borderRadius: 999, background: C.red, color: "#fff", fontFamily: F, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{porRecepcionar.n}</span>}
              {t.id === "cubrir" && porCubrir > 0 && <span style={{ position: "absolute", top: 12, right: 12, minWidth: 22, height: 22, padding: "0 6px", boxSizing: "border-box", borderRadius: 999, background: C.red, color: "#fff", fontFamily: F, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{porCubrir}</span>}
              <div style={{ fontFamily: SF, fontSize: 16, color: C.char, marginTop: 12 }}>{t.label}</div>
              <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 2 }}>{t.sub}</div>
            </button>
          ); })}
        </div>

        <button onClick={() => setScreen("anadir")} style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", marginTop: 12, background: "#fff", border: `1.5px solid ${C.char}`, borderRadius: 18, padding: 16, display: "flex", alignItems: "center", gap: 13, textAlign: "left", boxShadow: SHADOW.card }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: C.char, color: C.gold, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SF, fontSize: 22, flexShrink: 0 }} aria-hidden="true">+</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: SF, fontSize: 16, color: C.char }}>Añadir producto</span>
            <span style={{ display: "block", fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 2 }}>Algo de la tienda que no pasa por caja</span>
          </span>
          <IcoRight size={18} color={C.mut} sw={2.4} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: `1px solid ${C.brdL}`, position: "sticky", top: 52, background: C.cream, zIndex: 8 }}>
        <button onClick={() => setScreen("home")} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IcoLeft size={18} color={C.char} sw={2.4} /></button>
        <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>{TITULOS[screen]}</div>
      </div>
      {screen === "recepcion" && <RecepcionView />}
      {screen === "anadir" && <AnadirProductoView onFin={() => setScreen("home")} />}
      {screen === "fichajes" && <MisFichajesView />}
      {screen === "documentos" && <MisDocumentosView />}
      {screen === "cerrar" && <CerrarTurnoView user={user} />}
      {screen === "cubrir" && <CubrirTurnosView user={user} />}
      {screen === "horario" && <MiHorarioView user={user} />}
      {screen === "revisar" && <RevisarTurnoView user={user} />}
      {screen === "seguimiento" && <MiSeguimientoView user={user} />}
      {screen === "avisos" && <MisAvisosView user={user} />}
      {screen === "cambio" && <CambioTurnoView user={user} />}
      {screen === "vacaciones" && <MisVacacionesView user={user} />}
      {screen === "facturas" && <WorkerView facturas={facturas} proveedores={proveedores} onReload={onReload} user={user} />}
      {screen === "cuenta" && <MiCuentaView />}
    </div>
  );
}
