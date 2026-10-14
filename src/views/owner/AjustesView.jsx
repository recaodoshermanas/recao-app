import { useState, useEffect, useCallback } from "react";
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { UsuariosView } from "./UsuariosView.jsx";

// La antigua pantalla de Ajustes gestionaba usuarios con RPCs (crear_usuario,
// listar_usuarios, ...) que se revocaron en el cutover de seguridad. La gestion
// de usuarios vive ahora en UsuariosView (via edge function gestion-usuarios),
// asi que Ajustes la reutiliza. Encima va la conexion de WhatsApp.
export function AjustesView({ currentUser }) {
  return (
    <>
      <WhatsAppCard />
      <UsuariosView currentUser={currentUser} />
    </>
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
