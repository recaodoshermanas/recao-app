import { useState } from "react";
import { F, SF, C, inp, FONTS_LINK } from "../lib/styles";
import { OWNER_PASSWORD } from "../lib/constants";

export function RoleSelectScreen({ onSelectWorker, onSelectOwner }) {
  return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <link href={FONTS_LINK} rel="stylesheet" />
      <div style={{ fontFamily: SF, fontSize: "36px", color: C.char, marginBottom: "4px" }}>Recao</div>
      <div style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginBottom: "48px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Control financiero</div>
      <button onClick={onSelectWorker} style={{ width: "300px", padding: "22px 24px", border: `1.5px solid ${C.brd}`, borderRadius: "14px", background: "#fff", fontFamily: F, fontSize: "16px", fontWeight: 600, color: C.char, cursor: "pointer", marginBottom: "12px", textAlign: "left" }}>
        Trabajadora<div style={{ fontSize: "12px", fontWeight: 400, color: C.mut, marginTop: "4px" }}>Registrar facturas de proveedores</div>
      </button>
      <button onClick={onSelectOwner} style={{ width: "300px", padding: "22px 24px", border: `2px solid ${C.gold}`, borderRadius: "14px", background: "#fff", fontFamily: F, fontSize: "16px", fontWeight: 600, color: C.char, cursor: "pointer", textAlign: "left" }}>
        Dueño<div style={{ fontSize: "12px", fontWeight: 400, color: C.mut, marginTop: "4px" }}>Panel completo de gestión</div>
      </button>
    </div>
  );
}

export function PasswordScreen({ onSuccess, onBack }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const tryLogin = () => {
    if (pw === OWNER_PASSWORD) { onSuccess(); }
    else { setErr(true); setTimeout(() => setErr(false), 600); }
  };
  return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <link href={FONTS_LINK} rel="stylesheet" />
      <div style={{ fontFamily: SF, fontSize: "32px", color: C.char, marginBottom: "4px" }}>Recao</div>
      <div style={{ fontFamily: F, fontSize: "11px", color: C.mut, marginBottom: "40px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Acceso dueño</div>
      <div style={{ width: "300px" }}>
        <input type="password" autoFocus value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === "Enter") tryLogin(); }} placeholder="Contraseña" style={{ ...inp, marginBottom: "12px", textAlign: "center", letterSpacing: "0.1em", border: err ? `2px solid ${C.red}` : `1.5px solid ${C.brd}`, animation: err ? "shake 0.4s" : "none" }} />
        <style>{`@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }`}</style>
        <button onClick={tryLogin} style={{ width: "100%", padding: "14px", border: "none", borderRadius: "10px", background: C.char, color: C.gold, fontFamily: SF, fontSize: "15px", cursor: "pointer", marginBottom: "10px" }}>Entrar</button>
        <button onClick={onBack} style={{ width: "100%", padding: "10px", border: "none", background: "none", color: C.mut, fontFamily: F, fontSize: "12px", cursor: "pointer" }}>← Volver</button>
      </div>
    </div>
  );
}
