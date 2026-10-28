import { useState, useEffect, useCallback } from "react";
import { F, SF, C } from "../lib/styles.js";
import { sb } from "../lib/supabase.js";

function hace(ts) {
  const d = new Date(ts); const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24); if (dias < 7) return `hace ${dias} d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// A qué sección lleva cada notificación al pulsarla.
// El botón de los correos (función notificaciones-email) usa este mismo mapa: si se cambia aquí, cambiarlo también allí.
const DESTINO = {
  aviso_incidencia: "avisos", resolucion: "avisos", plazo_alegacion: "avisos", acuse_pendiente: "avisos", sancion: "avisos",
  tarea_extra_repetida: "tareas_extra", incidencia_reportada: "incidencias", alegacion_presentada: "disciplina", umbral_cerca: "disciplina", prescripcion_proxima: "disciplina", acuse_5d: "disciplina", cierre_incompleto: "cierres",
  vacaciones_pendiente: "vacaciones", vacaciones_resuelto: "vacaciones", vacaciones_conflicto: "vacaciones",
  // Recepción de pedidos: la trabajadora vuelve a «Recepcionar pedido»; dirección, a Producto → Recepción
  fichaje_resuelto: "fichajes", fichaje_solicitud: "fichajes_admin",
  documento_nuevo: "documentos", documento_firmado: "documentos_admin",
  recepcion_documento: "recepcion", recepcion_diferencia: "recepcion_admin", recepcion_sin_documento: "recepcion_admin", recepcion_precio: "recepcion_admin",
  cambio_por_responder: "cambio", cambio_resuelto: "cambio", cambio_pendiente_admin: "cambios",
  // Bolsa de turnos: las de la trabajadora llevan a «Turnos para cubrir»; las de dirección, a Personas → Bolsa del panel
  turno_recordatorio: "mis", // #48: recordatorio de turno a las eventuales → «Mis turnos»
  horario_cambio: "horario", horario_nuevo: "horario", // #102: dirección cambia el horario → «Mi horario»
  bolsa_resumen: "cubrir", bolsa_urgente: "cubrir", bolsa_descanso_pendiente: "cubrir", bolsa_descanso_ok: "cubrir", bolsa_anulado: "cubrir",
  bolsa_cubierto: "bolsa", bolsa_soltado: "bolsa", bolsa_nadie_puede: "bolsa", bolsa_urgente_admin: "bolsa", bolsa_descanso_limite: "bolsa",
  horas_extra_pedida: "horas", horas_extra_resuelta: "horasextra", // #39
  // Solicitudes de tecnología (panel de dirección)
  producto_revisar: "productos_revisar", incidencia_codigo: "productos_revisar",
  caja_fuerte_baja: "caja_fuerte", factura_sin_importe: "facturas", bancos_permiso: "bancos",
  // Formación en vídeo (#79): la eventual abre el vídeo; dirección, la persona en Personas → Equipo → Formación
  formacion_nueva: "formacion", formacion_recordatorio: "formacion", formacion_21d: "formacion_admin",
  tec_te_toca: "solicitudes_tec", tec_estado: "solicitudes_tec", tec_comentario: "solicitudes_tec", tec_nueva: "solicitudes_tec",
};

const IcoBell = ({ color = "#C9C0B0", size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
);

// Móvil + avisos por WhatsApp (trabajadoras). Dirección lo gestiona en Ajustes → Mis avisos.
function telNorm(v) {
  let d = String(v || "").trim().replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = "+" + d.slice(2);
  const dig = d.replace(/\D/g, "");
  if (!d.startsWith("+")) {
    if (dig.length === 9 && /^[6789]/.test(dig)) return "+34" + dig;
    if (dig.length === 11 && dig.startsWith("34")) return "+" + dig;
    return null;
  }
  return dig.length >= 10 && dig.length <= 15 ? "+" + dig : null;
}
function WhatsAppAvisos() {
  const [d, setD] = useState(null);
  const [tel, setTel] = useState("");
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { sb.rpc("mis_avisos").then((r) => { setD(r); setTel((r?.telefono || "").replace(/^\+34(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3")); }).catch(() => {}); }, []);
  if (!d || d.rol === "admin") return null;
  const guardar = async (activo) => {
    const t = tel.trim() ? telNorm(tel) : "";
    if (t === null) { setMsg("Ese móvil no tiene un formato válido"); return; }
    try { const r = await sb.rpc("guardar_mis_avisos", { p_telefono: t, p_whatsapp: activo }); setD(r); setEditando(false); setMsg(activo ? "Guardado ✓" : "Avisos por WhatsApp desactivados"); }
    catch (e) { setMsg("No se ha podido guardar"); }
  };
  const on = d.whatsapp_avisos !== false;
  return (
    <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.brdL}`, background: "#FAF7F2", position: "sticky", bottom: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: C.char }}>Avisos por WhatsApp</span>
        <button onClick={() => guardar(!on)} role="switch" aria-checked={on} aria-label="Avisos por WhatsApp"
          style={{ width: 40, height: 23, borderRadius: 999, border: "none", padding: 2, cursor: "pointer", background: on ? "#2D8B4E" : C.brd }}>
          <span style={{ display: "block", width: 19, height: 19, borderRadius: 999, background: "#fff", transform: on ? "translateX(17px)" : "none" }} />
        </button>
      </div>
      {on && (!d.telefono || editando ? (
        <div style={{ marginTop: 8 }}>
          <input type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="Tu móvil: 612 345 678"
            style={{ width: "100%", boxSizing: "border-box", fontFamily: F, fontSize: 14, padding: "9px 11px", borderRadius: 10, border: `1px solid ${tel && telNorm(tel) === null ? "#E5484D" : C.brd}` }} />
          <div style={{ fontFamily: F, fontSize: 11, color: C.mut, marginTop: 4, lineHeight: 1.35 }}>9 cifras, sin prefijo. Si tu móvil no es español, con prefijo (+351…).</div>
          <button onClick={() => guardar(true)} style={{ marginTop: 8, background: C.gold, color: C.goldDark, border: "none", borderRadius: 10, padding: "8px 14px", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Guardar móvil</button>
        </div>
      ) : (
        <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 4 }}>
          Te avisamos de turnos para cubrir, vacaciones y cambios al {tel}. <button onClick={() => setEditando(true)} style={{ background: "none", border: "none", padding: 0, color: C.blu, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cambiar</button>
        </div>
      ))}
      {msg && <div style={{ fontFamily: F, fontSize: 12, marginTop: 6, color: msg.includes("✓") ? "#2D8B4E" : C.mut }}>{msg}</div>}
    </div>
  );
}

export function NotificacionesBell({ user }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try { const r = await sb.select("notificaciones", "select=*&order=creado_en.desc&limit=50"); setItems(r || []); } catch (e) { /* noop */ }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 45000); return () => clearInterval(t); }, [load]);

  const noLeidas = items.filter(n => !n.leida).length;

  const clic = async (n) => {
    const destino = DESTINO[n.tipo];
    // Las de tecnología llevan a la solicitud concreta (el título empieza por «#N ·»)
    // Las de tarea extra repetida (#56) abren el detalle de esa tarea (va entre comillas en el texto)
    const ref = destino === "solicitudes_tec" ? (/^#(\d+)/.exec(n.titulo || "") || [])[1]
      : destino === "tareas_extra" ? "tareas-extra" + ((/"(.+)"/.exec(n.cuerpo || "") || [])[1] ? ":" + encodeURIComponent(/"(.+)"/.exec(n.cuerpo)[1]) : "")
      : destino === "formacion" ? n.ref || undefined
      : destino === "formacion_admin" ? (n.ref ? "formacion:" + n.ref : "formacion")
      : undefined;
    if (destino) { setOpen(false); window.dispatchEvent(new CustomEvent("recao-nav", { detail: { destino, ref } })); }
    if (!n.leida) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x));
      try { await sb.update("notificaciones", `id=eq.${n.id}`, { leida: true }); } catch (e) { /* noop */ }
    }
  };
  const marcarTodas = async () => {
    setItems(prev => prev.map(x => ({ ...x, leida: true })));
    try { await sb.update("notificaciones", `usuario_id=eq.${user.id}&leida=eq.false`, { leida: true }); } catch (e) { /* noop */ }
  };

  return (
    <>
      <button onClick={() => setOpen(o => !o)} style={{ position: "relative", background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
        <IcoBell />
        {noLeidas > 0 && <span style={{ position: "absolute", top: -1, right: -1, minWidth: 16, height: 16, padding: "0 4px", boxSizing: "border-box", borderRadius: 999, background: "#E5484D", color: "#fff", fontFamily: F, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{noLeidas > 9 ? "9+" : noLeidas}</span>}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
          <div style={{ position: "fixed", top: 54, right: 8, width: 340, maxWidth: "92vw", maxHeight: "72vh", overflowY: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.22)", zIndex: 60, border: `1px solid ${C.brdL}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: `1px solid ${C.brdL}`, position: "sticky", top: 0, background: "#fff" }}>
              <span style={{ fontFamily: SF, fontSize: 16, color: C.char }}>Notificaciones</span>
              {noLeidas > 0 && <button onClick={marcarTodas} style={{ background: "none", border: "none", color: C.blu, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Marcar todas</button>}
            </div>
            {items.length === 0 ? (
              <div style={{ padding: "34px 16px", textAlign: "center", fontFamily: F, fontSize: 13, color: C.mut }}>No tienes notificaciones</div>
            ) : items.map(n => (
              <button key={n.id} onClick={() => clic(n)} style={{ width: "100%", boxSizing: "border-box", textAlign: "left", display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 16px", background: n.leida ? "#fff" : "#FBF4E6", border: "none", borderBottom: `1px solid ${C.brdL}`, cursor: "pointer" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: n.leida ? "transparent" : C.gold, marginTop: 6, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: F, fontSize: 13.5, fontWeight: 700, color: C.char }}>{n.titulo}</span>
                  {n.cuerpo && <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2, lineHeight: 1.35 }}>{n.cuerpo}</span>}
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 11, color: C.mutL, marginTop: 4 }}>{hace(n.creado_en)}{DESTINO[n.tipo] && <span style={{ color: C.blu, fontWeight: 600 }}>· abrir</span>}</span>
                </span>
              </button>
            ))}
            <WhatsAppAvisos />
          </div>
        </>
      )}
    </>
  );
}
