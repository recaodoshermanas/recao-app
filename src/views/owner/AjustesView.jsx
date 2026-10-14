import { useState, useEffect, useCallback } from "react";
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { UsuariosView, telNormalizado, TEL_AYUDA } from "./UsuariosView.jsx";

// La antigua pantalla de Ajustes gestionaba usuarios con RPCs (crear_usuario,
// listar_usuarios, ...) que se revocaron en el cutover de seguridad. La gestion
// de usuarios vive ahora en UsuariosView (via edge function gestion-usuarios),
// asi que Ajustes la reutiliza. Encima va la conexion de WhatsApp.
export function AjustesView({ currentUser }) {
  return (
    <>
      <MisAvisosCard />
      <WhatsAppCard />
      <UsuariosView currentUser={currentUser} />
    </>
  );
}

// ---------- Mis avisos (cada persona de dirección elige qué le llega y por dónde) ----------
const AREAS = [
  { id: "personas", label: "Personas", sub: "Bolsa de turnos, vacaciones, cambios, disciplina" },
  { id: "producto", label: "Producto", sub: "Cierres con tareas pendientes, tareas sin hacer" },
  { id: "finanzas", label: "Finanzas", sub: "Caja y descuadres (cuando existan)" },
  { id: "marketing", label: "Marketing", sub: "Reseñas de Google (cuando existan)" },
];
const CANALES = [{ id: "email", label: "Correo" }, { id: "whatsapp", label: "WhatsApp" }];

function Interruptor({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} onClick={() => onChange(!on)}
      style={{ width: 40, height: 23, borderRadius: 999, border: "none", padding: 2, cursor: "pointer", background: on ? C.grn : C.brd, transition: "background .15s", flexShrink: 0 }}>
      <span style={{ display: "block", width: 19, height: 19, borderRadius: 999, background: "#fff", transform: on ? "translateX(17px)" : "none", transition: "transform .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </button>
  );
}

function MisAvisosCard() {
  const [d, setD] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [tel, setTel] = useState("");
  const [abierta, setAbierta] = useState(null); // área desplegada
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const cargar = useCallback(async () => {
    try {
      const r = await sb.rpc("mis_avisos");
      setD(r); setPrefs(r?.prefs || null);
      setTel((r?.telefono || "").replace(/^\+34(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3"));
    } catch (e) { setMsg(e.message || "No se han podido cargar tus avisos"); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (!d || d.rol !== "admin" || !prefs) return null;

  const area = (a) => prefs.areas?.[a] || { email: true, whatsapp: false };
  const setArea = (a, canal, v) => setPrefs((p) => ({ ...p, areas: { ...p.areas, [a]: { ...area(a), [canal]: v } } }));
  // Ajuste por tipo: si no hay, manda el del área
  const valorTipo = (t, canal) => {
    const o = prefs.tipos?.[t.tipo]?.[canal];
    if (typeof o === "boolean") return o;
    const base = area(t.area)[canal];
    return canal === "whatsapp" ? base && (!prefs.solo_urgente_whatsapp || t.urgente) : base;
  };
  const setTipo = (t, canal, v) => setPrefs((p) => ({ ...p, tipos: { ...(p.tipos || {}), [t.tipo]: { ...(p.tipos?.[t.tipo] || {}), [canal]: v } } }));

  const telOk = !tel || telNormalizado(tel);
  const guardar = async () => {
    const t = tel.trim() ? telNormalizado(tel) : "";
    if (t === null) { setMsg("El móvil no tiene un formato válido"); return; }
    setBusy(true); setMsg("");
    try { const r = await sb.rpc("guardar_mis_avisos", { p_telefono: t, p_prefs: prefs }); setD(r); setPrefs(r.prefs); setMsg("Guardado ✓"); }
    catch (e) { setMsg(e.message || "No se ha podido guardar"); }
    setBusy(false);
  };
  const probar = async () => {
    setBusy(true); setMsg("");
    try { await sb.fn("whatsapp", { action: "probar" }); setMsg("Mensaje de prueba enviado ✓ Mira tu WhatsApp."); }
    catch (e) { setMsg(e.message || "No se ha podido enviar"); }
    setBusy(false);
  };

  const card = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 18, margin: "16px auto", maxWidth: 640, boxShadow: SHADOW.card, fontFamily: F, color: C.char };
  const btn = { background: C.gold, color: C.goldDark, border: "none", borderRadius: 10, padding: "9px 16px", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" };
  const btnL = { ...btn, background: "#fff", color: C.char, border: `1.5px solid ${C.brd}` };
  const fila = { display: "grid", gridTemplateColumns: "1fr 64px 64px", alignItems: "center", gap: 8 };

  return (
    <div style={card}>
      <div style={{ fontFamily: SF, fontSize: 18 }}>Mis avisos</div>
      <div style={{ fontSize: 13, color: C.mut, marginTop: 2, lineHeight: 1.45 }}>Qué te llega y por dónde. En la campanita del panel y de la app lo ves todo siempre; aquí eliges qué te llega además por correo y por WhatsApp.</div>

      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginTop: 14, marginBottom: 4 }}>Tu móvil</label>
      <input type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="612 345 678"
        style={{ width: "100%", boxSizing: "border-box", fontFamily: F, fontSize: 14, padding: "10px 12px", borderRadius: 10, border: `1px solid ${telOk ? C.brd : C.red}` }} />
      <div style={{ fontSize: 11.5, color: telOk ? C.mut : C.red, marginTop: 4, lineHeight: 1.4 }}>{telOk ? "" : "Formato no válido. "}{TEL_AYUDA}</div>

      <div style={{ ...fila, marginTop: 16, paddingBottom: 6, borderBottom: `1px solid ${C.brdL}`, fontSize: 11.5, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: ".05em" }}>
        <span>Área</span>{CANALES.map((c) => <span key={c.id} style={{ textAlign: "center" }}>{c.label}</span>)}
      </div>
      {AREAS.map((a) => {
        const tipos = (d.tipos || []).filter((t) => t.area === a.id);
        return (
          <div key={a.id} style={{ borderBottom: `1px solid ${C.brdL}`, padding: "10px 0" }}>
            <div style={fila}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</div>
                <div style={{ fontSize: 12, color: C.mut }}>{a.sub}</div>
                {tipos.length > 0 && <button onClick={() => setAbierta(abierta === a.id ? null : a.id)} style={{ background: "none", border: "none", padding: 0, marginTop: 4, color: C.blu, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{abierta === a.id ? "Ocultar detalle" : `Afinar aviso a aviso (${tipos.length})`}</button>}
              </div>
              {CANALES.map((c) => <div key={c.id} style={{ display: "flex", justifyContent: "center" }}><Interruptor on={area(a.id)[c.id]} onChange={(v) => setArea(a.id, c.id, v)} label={`${a.label} por ${c.label}`} /></div>)}
            </div>
            {abierta === a.id && (
              <div style={{ marginTop: 8, display: "grid", gap: 6, background: "#FAF8F4", borderRadius: 10, padding: "8px 10px" }}>
                {tipos.map((t) => (
                  <div key={t.tipo} style={fila}>
                    <span style={{ fontSize: 12.5 }}>{t.etiqueta}{t.urgente && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: C.red }}>URGENTE</span>}</span>
                    {CANALES.map((c) => <div key={c.id} style={{ display: "flex", justifyContent: "center" }}><Interruptor on={valorTipo(t, c.id)} onChange={(v) => setTipo(t, c.id, v)} label={`${t.etiqueta} por ${c.label}`} /></div>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>Por WhatsApp, solo lo urgente</div>
          <div style={{ fontSize: 12, color: C.mut }}>Turnos sin cubrir a 10 días o menos y plazos de disciplina. Lo demás, por correo y en la app.</div>
        </div>
        <Interruptor on={prefs.solo_urgente_whatsapp} onChange={(v) => setPrefs((p) => ({ ...p, solo_urgente_whatsapp: v }))} label="Por WhatsApp solo lo urgente" />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={guardar}>Guardar</button>
        <button style={{ ...btnL, opacity: busy || !d.telefono ? 0.5 : 1 }} disabled={busy || !d.telefono} onClick={probar} title={d.telefono ? "" : "Guarda antes tu móvil"}>Probar WhatsApp</button>
        {msg && <span style={{ fontSize: 13, color: msg.includes("✓") ? C.grn : C.red }}>{msg}</span>}
      </div>
    </div>
  );
}

const ESTADO_PL = { APPROVED: ["Aprobada", "#1E7A46", "#E7F3EC"], PENDING: ["En revisión", "#8A6410", "#FBF0DA"], REJECTED: ["Rechazada", "#B23A2C", "#FBEAE7"] };

// Conexion con WhatsApp (API oficial de Meta). El token se pega aqui y va
// directo al servidor (app_config); la pantalla nunca lo vuelve a mostrar.
function WhatsAppCard() {
  const [est, setEst] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const cargar = useCallback(async () => {
    try { setEst(await sb.fn("whatsapp", { action: "estado" })); } catch (e) { setEst({ conectado: false, error: e.message }); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardarToken = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await sb.fn("whatsapp", { action: "guardar_token", token: token.trim() });
      setEst(r); setToken(""); setAbierto(false); setMsg("Conectado ✓");
    } catch (e) { setMsg(e.message || "No se ha podido guardar"); }
    setBusy(false);
  };

  const card = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 18, margin: "16px auto", maxWidth: 640, boxShadow: SHADOW.card, fontFamily: F, color: C.char };
  const btn = { background: C.gold, color: C.goldDark, border: "none", borderRadius: 10, padding: "9px 16px", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" };
  const num = est?.numeros?.[0];

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: SF, fontSize: 18 }}>WhatsApp</div>
          <div style={{ fontSize: 13, color: C.mut, marginTop: 2 }}>
            {!est ? "Comprobando…" : est.conectado ? `Conectado a ${est.cuenta || "la cuenta de WhatsApp"}` : "Sin conectar"}
          </div>
        </div>
        <button style={btn} onClick={() => setAbierto((v) => !v)}>{est?.conectado ? "Cambiar token" : "Conectar"}</button>
      </div>

      {est?.error && !est.conectado && <div style={{ fontSize: 12.5, color: C.red, marginTop: 10 }}>{est.error}</div>}

      {num && (
        <div style={{ fontSize: 13, marginTop: 12, display: "grid", gap: 4 }}>
          <div><b>Número:</b> {num.display_phone_number} · {num.verified_name}</div>
          <div style={{ color: C.mut }}>Nombre: {num.name_status || "—"} · Estado: {num.status || "—"} · Calidad: {num.quality_rating || "—"}</div>
        </div>
      )}

      {est?.conectado && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: C.mut, marginBottom: 6 }}>Plantillas</div>
          {(est.plantillas || []).length === 0 ? <div style={{ fontSize: 13, color: C.mut }}>Todavía no hay plantillas.</div> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {est.plantillas.map((p) => { const e = ESTADO_PL[p.status] || [p.status, C.mut, "#F3EFE8"]; return (
                <span key={p.name + p.language} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: e[2], color: e[1], fontWeight: 600 }}>{p.name} · {e[0]}</span>
              ); })}
            </div>
          )}
        </div>
      )}

      {abierto && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.brdL}`, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, color: C.mut, lineHeight: 1.45 }}>
            En Meta Business → Ajustes → Usuarios del sistema → «Recao Notificaciones» → <b>Generar identificador</b> (app Recao, caducidad «Nunca», permisos whatsapp_business_management y whatsapp_business_messaging). Copia el identificador y pégalo aquí. Se guarda en el servidor y no se vuelve a mostrar.
          </div>
          <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pega aquí el identificador (empieza por EAA…)"
            style={{ fontFamily: F, fontSize: 14, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.brd}` }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={{ ...btn, opacity: busy || token.trim().length < 50 ? 0.5 : 1 }} disabled={busy || token.trim().length < 50} onClick={guardarToken}>{busy ? "Comprobando…" : "Guardar y comprobar"}</button>
            <button style={{ ...btn, background: "transparent", color: C.mut }} onClick={() => { setAbierto(false); setToken(""); }}>Cancelar</button>
          </div>
        </div>
      )}
      {msg && <div style={{ fontSize: 13, marginTop: 10, color: msg.includes("✓") ? C.grn : C.red }}>{msg}</div>}
    </div>
  );
}
