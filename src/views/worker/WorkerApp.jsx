import { useState, useEffect } from "react";
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { IcoCheck, IcoRight, IcoLeft, IcoCalendar, IcoSun, IcoReceipt, IcoSwap, IcoBars, IcoUsers } from "../../lib/icons.jsx";
import { sb } from "../../lib/supabase.js"; // BOLSA
import { BOLSA_ACTIVA } from "../../lib/bolsa.js"; // BOLSA
import { TURNOS, horasTurno, ymd } from "../../lib/turnos.js";
import { CerrarTurnoView } from "./CerrarTurnoView.jsx";
import { MiHorarioView } from "./MiHorarioView.jsx";
import { MisVacacionesView } from "./MisVacacionesView.jsx";
import { MiCuentaView } from "./MiCuentaView.jsx";
import { CambioTurnoView } from "./CambioTurnoView.jsx";
import { RevisarTurnoView } from "./RevisarTurnoView.jsx";
import { MiSeguimientoView } from "./MiSeguimientoView.jsx";
import { MisAvisosView } from "./MisAvisosView.jsx";
import { CubrirTurnosView } from "./CubrirTurnosView.jsx"; // BOLSA
import { RecepcionView, AnadirProductoView, SinCodigo } from "./RecepcionView.jsx"; // RECEPCION
import { EscanearProductoView, ComprobarMarcadoView } from "./ProductoTiendaView.jsx"; // #35 · #72
import { CajaView } from "./CajaView.jsx"; // CAJA (caída de Epos)
import { MisFichajesView } from "./MisFichajesView.jsx"; // FICHAJES
import { MisDocumentosView } from "./MisDocumentosView.jsx"; // DOCUMENTOS
import { HorasExtraView } from "../horasextra/HorasExtraView.jsx"; // #39
import { WorkerView } from "../WorkerView.jsx";
import { IR_CORREO } from "../../lib/enlaceAviso.js";
import { NovedadesEquipo } from "../../components/Novedades.jsx"; // NOVEDADES
import { TarjetaFormacion, FormacionView } from "../eventual/Formacion.jsx"; // #101 formación en vídeo
import { resumenFormacion } from "../../lib/formacion.js"; // #101

// Inicio de la plantilla (solicitud #10): «Mi turno», «Pendiente», novedades, «En la tienda» (diario) y «Lo tuyo» (de vez en cuando).
// Iconos en un solo tono tostado; el rojo solo para los números de «Pendiente» y la etiqueta «Nuevo».
const TOSTADO = "#8A7A54";
const Ico = ({ children, size = 20, color = TOSTADO }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>{children}</svg>;
const IcoCaja = (p) => <Ico {...p}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3" /><path d="M12 12l8-4.5" /><path d="M12 12v9" /><path d="M12 12L4 7.5" /></Ico>;
const IcoFactura = (p) => <Ico {...p}><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2" /><path d="M9 8h6" /><path d="M9 12h6" /></Ico>;
const IcoLista = (p) => <Ico {...p}><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6l1 1 2-2" /><path d="M4 12l1 1 2-2" /><path d="M4 18l1 1 2-2" /></Ico>;
const IcoEscaner = (p) => <Ico {...p}><path d="M4 7V5a1 1 0 0 1 1-1h2" /><path d="M17 4h2a1 1 0 0 1 1 1v2" /><path d="M20 17v2a1 1 0 0 1-1 1h-2" /><path d="M7 20H5a1 1 0 0 1-1-1v-2" /><path d="M8 8v8" /><path d="M11 8v8" /><path d="M14 8v8" /><path d="M17 8v8" /></Ico>;
const IcoSinCodigo = (p) => <Ico {...p}><path d="M5 6v12" /><path d="M8 6v7" /><path d="M11 6v4" /><path d="M14 6v2" /><path d="M19 6v5" /><path d="M14 15l5 5" /><path d="M19 15l-5 5" /></Ico>;
const IcoEtiqueta = (p) => <Ico {...p}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9" /><circle cx="7.5" cy="7.5" r="1.5" /></Ico>;
const IcoDoc = (p) => <Ico {...p}><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2" /><path d="M9 13h6" /><path d="M9 17h6" /></Ico>;

const IcoFormacion = (p) => <Ico {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5v5l4.5-2.5-4.5-2.5" /></Ico>;

// #35: bloque «Producto» con su circulito de pendientes (como el de las notificaciones de una app)
const PRODUCTO = [
  { id: "recepcion", label: "Recepcionar pedido", Ico: IcoCaja },
  { id: "escanear", label: "Escanear producto", Ico: IcoEscaner },
  { id: "sincodigo", label: "Productos sin código", Ico: IcoSinCodigo },
  { id: "marcado", label: "Comprobar precio marcado", Ico: IcoEtiqueta }, // #72
];
const EN_TIENDA = [
  { id: "facturas", label: "Facturas", Ico: IcoFactura },
  { id: "revisar", label: "Turno anterior", Ico: IcoLista },
];
const LO_TUYO = [
  { id: "horarios", label: "Horarios y fichajes", Ico: (p) => <IcoCalendar size={20} color={TOSTADO} sw={1.9} {...p} /> },
  { id: "vacaciones", label: "Vacaciones", Ico: (p) => <IcoSun size={20} color={TOSTADO} sw={1.9} {...p} /> },
  { id: "cambio", label: "Cambiar turno", Ico: (p) => <IcoSwap size={20} color={TOSTADO} sw={1.9} {...p} /> },
  { id: "horasextra", label: "Horas extra", sub: "Apuntar las que te han pedido", Ico: (p) => <IcoCalendar size={20} color={TOSTADO} sw={1.9} {...p} /> }, // #39
  ...(BOLSA_ACTIVA ? [{ id: "cubrir", label: "Turnos para cubrir", Ico: (p) => <IcoUsers size={20} color={TOSTADO} sw={1.9} {...p} /> }] : []), // BOLSA
  { id: "documentos", label: "Mis documentos", Ico: IcoDoc },
  { id: "seguimiento", label: "Mi seguimiento", sub: "Avisos, plus y faltas", Ico: (p) => <IcoBars size={20} color={TOSTADO} sw={1.9} {...p} /> },
  { id: "formacion", label: "Formación", Ico: IcoFormacion }, // #101 (el subtítulo depende de los vídeos que le faltan)
];
const TITULOS = { caja: "Caja", anadir: "Añadir producto", escanear: "Escanear producto", sincodigo: "Productos sin código", marcado: "Comprobar precio marcado", documentos: "Mis documentos", horarios: "Horarios y fichajes", recepcion: "Recepcionar pedido", cerrar: "Mi turno", cubrir: "Turnos para cubrir", revisar: "Turno anterior", seguimiento: "Mi seguimiento", formacion: "Formación", cambio: "Cambiar turno", horasextra: "Horas extra", vacaciones: "Mis vacaciones", facturas: "Facturas", cuenta: "Mi cuenta" };

// A dónde lleva cada destino de la campana o del correo (?ir=…) en la organización nueva: [pantalla, pestaña]
const DESTINOS = {
  avisos: ["seguimiento", "avisos"], seguimiento: ["seguimiento", null], fichajes: ["horarios", "fichajes"], horario: ["horarios", "horarios"],
  vacaciones: ["vacaciones"], cambio: ["cambio"], horasextra: ["horasextra"], recepcion: ["recepcion"], documentos: ["documentos"], cuenta: ["cuenta"], formacion: ["formacion"],
  ...(BOLSA_ACTIVA ? { cubrir: ["cubrir"] } : {}),
};
// Enlace de un correo de aviso (?ir=vacaciones): abre esa pantalla. Se guarda hasta que la trabajadora sale de ella,
// por si la app se monta dos veces mientras carga.
let irInicial = DESTINOS[IR_CORREO] ? IR_CORREO : null;

const horasQuedan = (iso) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600000));

export function WorkerApp({ user, facturas, proveedores, onReload }) {
  const [screen, setScreen] = useState(() => (irInicial ? DESTINOS[irInicial][0] : "home"));
  const [pestana, setPestana] = useState(() => (irInicial ? DESTINOS[irInicial][1] : null)); // pestaña de «Horarios y fichajes» o «Mi seguimiento»
  useEffect(() => { if (irInicial && screen !== DESTINOS[irInicial][0]) irInicial = null; }, [screen]);
  const ir = (destino, ref) => { const d = DESTINOS[destino]; if (!d) return; setPestana(d[1] || null); setVideoAbrir(destino === "formacion" ? ref || null : null); setScreen(d[0]); };
  const abrir = (id) => { setPestana(null); setScreen(id); };

  const [porCubrir, setPorCubrir] = useState(0); // BOLSA
  const [porRecepcionar, setPorRecepcionar] = useState({ n: 0, listos: 0 }); // RECEPCION
  const [sinCodigoN, setSinCodigoN] = useState(0); // #35: altas sin código por escanear
  const [marcadoN, setMarcadoN] = useState(0); // #72: productos que dirección manda comprobar
  const [codigoNuevo, setCodigoNuevo] = useState(""); // #35: código escaneado que no existe → «Añadir producto»
  const [avisos, setAvisos] = useState([]); // avisos de incidencia por responder (sin alegación y con plazo abierto)
  const [dudosos, setDudosos] = useState([]); // FICHAJES: fichajes dudosos de los últimos 14 días
  const [turnoHoy, setTurnoHoy] = useState(null);
  const [videos, setVideos] = useState(null); // #101 formacion_mis_videos()
  const [videoAbrir, setVideoAbrir] = useState(null);
  const cargarVideos = () => { sb.rpc("formacion_mis_videos").then(setVideos).catch(() => {}); };
  const [mesFichajes, setMesFichajes] = useState(null); // FICHAJES: mes que abre «Fichajes» desde «Pendiente»
  useEffect(() => { if (screen === "home") setMesFichajes(null); }, [screen]);

  useEffect(() => {
    const h = (e) => ir(e.detail && e.detail.destino, e.detail && e.detail.ref);
    window.addEventListener("recao-nav", h);
    return () => window.removeEventListener("recao-nav", h);
  }, []);

  // Lo pendiente del inicio: se recarga cada vez que vuelve al inicio
  useEffect(() => {
    if (screen !== "home") return;
    if (BOLSA_ACTIVA) sb.rpc("bolsa_disponibles").then(r => setPorCubrir((r || []).filter(x => x.destino === "plantilla" && !x.rechazado).length)).catch(() => {}); // BOLSA
    sb.fn("recepcion", { accion: "inicio" }).then(r => { const p = r.pendientes || []; setPorRecepcionar({ n: p.length, listos: p.filter(x => x.estado === "por_revisar" && x.via === "email").length }); }).catch(() => {}); // RECEPCION
    sb.fn("recepcion", { accion: "sin_codigo" }).then(r => setSinCodigoN((r.productos || []).length)).catch(() => {}); // #35
    sb.fn("producto-tienda", { accion: "marcado_lista" }).then(r => setMarcadoN((r.productos || []).length)).catch(() => {}); // #72
    sb.fn("disciplina", { action: "mis_avisos" }).then(r => setAvisos((r.avisos || []).filter(a => a.estado === "emitido" && !a.alegacion_en && a.plazo_alegacion && new Date(a.plazo_alegacion) > new Date()))).catch(() => {});
    cargarVideos(); // #101
    sb.rpc("mis_fichajes_dudosos").then(r => setDudosos(Array.isArray(r) ? r : [])).catch(() => {}); // FICHAJES
    sb.select("horarios", `select=turno&usuario_id=eq.${user.id}&fecha=eq.${ymd(new Date())}`).then(r => setTurnoHoy((r && r[0] && r[0].turno) || null)).catch(() => {});
  }, [screen, user.id]);

  if (screen === "home") {
    const hoy = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    const def = turnoHoy && TURNOS[turnoHoy];
    const horas = def && def.tipo !== "libre" ? horasTurno(turnoHoy, ymd(new Date())) : "";
    const subturno = horas ? `${turnoHoy} · ${horas.replace("-", " – ")}` : "Tus tareas de hoy y cerrar el turno";
    const plazo = avisos.length ? avisos.map(a => a.plazo_alegacion).sort()[0] : null;
    const pendiente = [
      avisos.length && { id: "avisos", n: avisos.length, texto: avisos.length > 1 ? "Avisos por responder" : "Aviso por responder", sub: `Quedan ${horasQuedan(plazo)} h`, urgente: true, onClick: () => ir("avisos") },
      porRecepcionar.n && { id: "recepcion", n: porRecepcionar.n, texto: `${porRecepcionar.n > 1 ? "Pedidos" : "Pedido"} por recepcionar${porRecepcionar.listos ? ` · ${porRecepcionar.listos} ya ${porRecepcionar.listos > 1 ? "tienen" : "tiene"} su factura` : ""}`, onClick: () => abrir("recepcion") }, // RECEPCION
      BOLSA_ACTIVA && porCubrir && { id: "cubrir", n: porCubrir, texto: `${porCubrir > 1 ? "Turnos" : "Turno"} por cubrir en tus días libres`, onClick: () => abrir("cubrir") }, // BOLSA
      dudosos.length && { id: "fichajes", n: dudosos.length, texto: `${dudosos.length > 1 ? "Fichajes" : "Fichaje"} que revisar`, onClick: () => { setMesFichajes(dudosos[0].fecha.slice(0, 7)); ir("fichajes"); } }, // FICHAJES (#4)
    ].filter(Boolean);
    const seccion = { fontFamily: F, fontSize: 11, color: C.mutL, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, margin: "18px 2px 8px" };
    const caja = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, overflow: "hidden" };
    return (
      <div style={{ padding: "18px 16px 28px", maxWidth: 540, margin: "0 auto" }}>
        <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 14 }}>{hoy}</div>

        <button type="button" onClick={() => abrir("caja")} style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", background: C.char, border: "none", borderRadius: 20, padding: "16px 18px", display: "flex", alignItems: "center", gap: 15, marginBottom: 12, textAlign: "left" }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }} aria-hidden="true">🛒</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: SF, fontSize: 21, color: C.gold }}>Caja</span>
            <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: "#C9BFA8", marginTop: 2 }}>Cobrar mientras Epos no funciona</span>
          </span>
          <IcoRight size={20} color={C.gold} sw={2.4} />
        </button>

        <button onClick={() => abrir("cerrar")} style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", background: C.gold, border: "none", borderRadius: 20, padding: 18, display: "flex", alignItems: "center", gap: 15, boxShadow: SHADOW.hero, textAlign: "left" }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, background: C.goldDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IcoCheck size={24} color={C.gold} sw={2.2} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: SF, fontSize: 21, color: C.goldDark }}>Mi turno</span>
            <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.goldSub, marginTop: 2 }}>{subturno}</span>
          </span>
          <IcoRight size={20} color={C.goldSub} sw={2.4} />
        </button>

        {pendiente.length > 0 && (
          <div style={{ ...caja, marginTop: 12 }}>
            <div style={{ fontFamily: F, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: C.red, padding: "11px 16px 4px" }}>Pendiente</div>
            {pendiente.map((p, i) => (
              <button key={p.id} type="button" onClick={p.onClick} style={{ width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 11, padding: "11px 16px", border: "none", borderTop: i ? `1px solid ${C.brdL}` : "none", background: p.urgente ? "#FBEDE9" : "#fff", cursor: "pointer", textAlign: "left" }}>
                <span style={{ minWidth: 24, height: 24, padding: "0 7px", boxSizing: "border-box", borderRadius: 999, background: C.red, color: "#fff", fontFamily: F, fontSize: 12.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.n}</span>
                <span style={{ flex: 1, fontFamily: F, fontSize: 14, color: C.char, lineHeight: 1.35 }}>{p.texto}{p.sub && <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#A3362B" }}>{p.sub}</span>}</span>
                <IcoRight size={17} color={p.urgente ? "#A3362B" : C.mutL} sw={2.4} />
              </button>
            ))}
          </div>
        )}

        <NovedadesEquipo compacta estilo={{ marginTop: 12 }} />

        {/* #101: tarjeta negra solo si le faltan vídeos por ver; si está al día, Formación queda solo en «Lo tuyo» */}
        {videos && resumenFormacion(videos).pendientes > 0 && <TarjetaFormacion videos={videos} onAbrir={() => abrir("formacion")} />}

        <div style={seccion}>Producto</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {PRODUCTO.map(t => {
            const n = t.id === "recepcion" ? porRecepcionar.n : t.id === "sincodigo" ? sinCodigoN : t.id === "marcado" ? marcadoN : 0;
            return (
              <button key={t.id} type="button" onClick={() => abrir(t.id)} aria-label={n ? `${t.label}: ${n} pendiente${n > 1 ? "s" : ""}` : t.label} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 92, padding: "12px 6px", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 15, cursor: "pointer", textAlign: "center", boxShadow: SHADOW.card }}>
                <span style={{ position: "relative", display: "inline-flex" }}>
                  <t.Ico size={26} />
                  {n > 0 && <span aria-hidden="true" style={{ position: "absolute", top: -8, right: -12, minWidth: 20, height: 20, padding: "0 5px", boxSizing: "border-box", borderRadius: 999, background: C.red, color: "#fff", border: "2px solid #fff", fontFamily: F, fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n > 99 ? "99+" : n}</span>}
                </span>
                <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, lineHeight: 1.2 }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div style={seccion}>En la tienda</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {EN_TIENDA.map(t => (
            <button key={t.id} type="button" onClick={() => abrir(t.id)} style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 58, padding: "12px 14px", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 15, cursor: "pointer", textAlign: "left", boxShadow: SHADOW.card }}>
              <t.Ico />
              <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char, lineHeight: 1.25 }}>{t.label}</span>
            </button>
          ))}
        </div>

        <div style={seccion}>Lo tuyo</div>
        <div style={caja}>
          {LO_TUYO.map((t, i) => (
            <button key={t.id} type="button" onClick={() => abrir(t.id)} style={{ width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, minHeight: 50, padding: "11px 16px", border: "none", borderTop: i ? `1px solid ${C.brdL}` : "none", background: "#fff", cursor: "pointer", textAlign: "left" }}>
              <t.Ico />
              <span style={{ flex: 1, fontFamily: F, fontSize: 14.5, color: C.char }}>{t.label}{t.sub && <span style={{ display: "block", fontSize: 11.5, color: C.mutL, marginTop: 1 }}>{t.sub}</span>}
                {t.id === "formacion" && videos && (() => { const r = resumenFormacion(videos); return r.pendientes > 0
                  ? <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: C.red, marginTop: 1 }}>{r.pendientes === 1 ? "1 vídeo nuevo" : `${r.pendientes} vídeos nuevos`}</span>
                  : <span style={{ display: "block", fontSize: 11.5, color: C.mutL, marginTop: 1 }}>{r.total ? `Al día · ${r.completos} de ${r.total}` : "Todavía no hay vídeos"}</span>; })()}
              </span>
              {t.id === "formacion" && videos && resumenFormacion(videos).pendientes > 0 && <span style={{ minWidth: 22, height: 22, padding: "0 6px", boxSizing: "border-box", borderRadius: 999, background: C.red, color: "#fff", fontFamily: F, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{resumenFormacion(videos).pendientes}</span>}
              <IcoRight size={17} color={C.mutL} sw={2.4} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: `1px solid ${C.brdL}`, position: "sticky", top: 52, background: C.cream, zIndex: 8 }}>
        <button onClick={() => setScreen("home")} aria-label="Volver al inicio" style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IcoLeft size={18} color={C.char} sw={2.4} /></button>
        <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>{TITULOS[screen]}</div>
      </div>
      {screen === "caja" && <CajaView />}
      {screen === "recepcion" && <RecepcionView />}
      {screen === "anadir" && <AnadirProductoView codigoInicial={codigoNuevo} onFin={() => { setCodigoNuevo(""); setScreen("home"); }} />}
      {screen === "escanear" && <EscanearProductoView onAnadir={(c) => { setCodigoNuevo(c || ""); setScreen("anadir"); }} onFin={() => setScreen("home")} />}
      {screen === "sincodigo" && <SinCodigo onTerminar={() => setScreen("home")} />}
      {screen === "marcado" && <ComprobarMarcadoView onTerminar={() => setScreen("home")} />}
      {screen === "horarios" && <HorariosYFichajes user={user} pestana={pestana} mesFichajes={mesFichajes} />}
      {screen === "documentos" && <MisDocumentosView />}
      {screen === "cerrar" && <CerrarTurnoView user={user} />}
      {screen === "cubrir" && <CubrirTurnosView user={user} />}
      {screen === "revisar" && <RevisarTurnoView user={user} />}
      {screen === "seguimiento" && <Seguimiento user={user} pestana={pestana} />}
      {screen === "cambio" && <CambioTurnoView user={user} />}
      {screen === "horasextra" && <HorasExtraView user={user} />}
      {screen === "vacaciones" && <MisVacacionesView user={user} />}
      {screen === "facturas" && <WorkerView facturas={facturas} proveedores={proveedores} onReload={onReload} user={user} />}
      {screen === "cuenta" && <MiCuentaView />}
      {screen === "formacion" && <FormacionView videos={videos} abrirId={videoAbrir} onCambio={cargarVideos} onVolver={() => { setVideoAbrir(null); setScreen("home"); }} />}
    </div>
  );
}

// Pestañas oscuras como las de la bolsa
function Pestanas({ valor, onChange, opciones }) {
  return (
    <div style={{ padding: "14px 16px 0", maxWidth: 540, margin: "0 auto" }}>
      <div role="tablist" style={{ display: "flex", gap: 4, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: 4 }}>
        {opciones.map(o => { const on = valor === o.id; return (
          <button key={o.id} role="tab" aria-selected={on} type="button" onClick={() => onChange(o.id)} style={{ flex: 1, minHeight: 42, border: "none", borderRadius: 11, cursor: "pointer", background: on ? C.char : "transparent", color: on ? C.gold : C.mut, fontFamily: F, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {o.label}{o.n > 0 && <span style={{ background: C.red, color: "#fff", borderRadius: 999, padding: "0 7px", fontSize: 11.5, lineHeight: "18px" }}>{o.n}</span>}
          </button>
        ); })}
      </div>
    </div>
  );
}

function HorariosYFichajes({ user, pestana, mesFichajes }) {
  const [tab, setTab] = useState(pestana || "horarios");
  return (
    <>
      <Pestanas valor={tab} onChange={setTab} opciones={[{ id: "horarios", label: "Horarios" }, { id: "fichajes", label: "Fichajes" }]} />
      {tab === "horarios" ? <MiHorarioView user={user} /> : <MisFichajesView mesInicial={mesFichajes} />}
    </>
  );
}

// «Mi seguimiento»: Avisos (incidencias, prueba, alegación y resolución) y Plus y faltas. Con un aviso abierto se abre en Avisos.
function Seguimiento({ user, pestana }) {
  const [abiertos, setAbiertos] = useState(null);
  const [tab, setTab] = useState(pestana);
  useEffect(() => {
    sb.fn("disciplina", { action: "mis_avisos" })
      .then(r => { const n = (r.avisos || []).filter(a => a.estado === "emitido" && !a.alegacion_en && a.plazo_alegacion && new Date(a.plazo_alegacion) > new Date()).length; setAbiertos(n); setTab(t => t || (n ? "avisos" : "plus")); })
      .catch(() => { setAbiertos(0); setTab(t => t || "plus"); });
  }, []);
  if (!tab) return <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 30 }}>Cargando…</div>;
  return (
    <>
      <Pestanas valor={tab} onChange={setTab} opciones={[{ id: "avisos", label: "Avisos", n: abiertos }, { id: "plus", label: "Plus y faltas" }]} />
      {tab === "avisos" ? <MisAvisosView user={user} /> : <MiSeguimientoView user={user} />}
    </>
  );
}
