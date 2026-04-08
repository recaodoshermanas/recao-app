import { useState } from "react";
import { F, SF, C, inp, FONT_LINK } from "../lib/styles.js";
import { OWNER_PASSWORD, LOGO_URL } from "../lib/constants.js";

function Brand({ size = 36 }) {
  if (LOGO_URL) return <img src={LOGO_URL} alt="Recao" style={{ height: size, marginBottom: "4px" }} />;
  return <div style={{ fontFamily: SF, fontSize: `${size}px`, color: C.char, marginBottom: "4px" }}>Recao</div>;
}

export function RoleSelectScreen({ onSelectWorker, onSelectOwner }) {
  return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <link href={FONT_LINK} rel="stylesheet" />
      <Brand size={36} />
      <div style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginBottom: "48px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Control financiero</div>
      <button onClick={onSelectWorker} style={{ width: "300px", padding: "22px 24px", border: `1.5px solid ${C.brd}`, borderRadius: "14px", background: "#fff", fontFamily: F, fontSize: "16px", fontWeight: 600, color: C.char, cursor: "pointer", marginBottom: "12px", textAlign: "left" }}>
        Trabajadora<div style={{ fontSize: "12px", fontWeight: 400, color: C.mut, marginTop: "4px" }}>Registrar facturas de proveedores</div>
      </button>
      <button onClick={onSelectOwner} style={{ width: "300px", padding: "22px 24px", border: `2px solid ${C.gold}`, borderRadius: "14px", background: "#fff", fontFamily: F, fontSize: "16px", fontWeight: 600, color: C.char, cursor: "pointer", textAlign: "left" }}>
        Dirección<div style={{ fontSize: "12px", fontWeight: 400, color: C.mut, marginTop: "4px" }}>Panel completo de gestión</div>
      </button>
    </div>
  );
}

export function PasswordScreen({ onSuccess, onBack }) {
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const tryLogin = () => {
    if (pwInput === OWNER_PASSWORD) onSuccess();
    else { setPwError(true); setTimeout(() => setPwError(false), 600); }
  };
  return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <link href={FONT_LINK} rel="stylesheet" />
      <Brand size={32} />
      <div style={{ fontFamily: F, fontSize: "11px", color: C.mut, marginBottom: "40px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Acceso dirección</div>
      <div style={{ width: "300px" }}>
        <input type="password" autoFocus value={pwInput} onChange={e => setPwInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") tryLogin(); }} placeholder="Contraseña" style={{ ...inp, marginBottom: "12px", textAlign: "center", letterSpacing: "0.1em", border: pwError ? `2px solid ${C.red}` : `1.5px solid ${C.brd}`, animation: pwError ? "shake 0.4s" : "none" }} />
        <style>{`@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }`}</style>
        <button onClick={tryLogin} style={{ width: "100%", padding: "14px", border: "none", borderRadius: "10px", background: C.char, color: C.gold, fontFamily: SF, fontSize: "15px", cursor: "pointer", marginBottom: "10px" }}>Entrar</button>
        <button onClick={onBack} style={{ width: "100%", padding: "10px", border: "none", background: "none", color: C.mut, fontFamily: F, fontSize: "12px", cursor: "pointer" }}>← Volver</button>
      </div>
    </div>
  );
}

export function Header({ roleLabel, onLogout }) {
  return (
    <div style={{ background: C.char, padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20 }}>
      {LOGO_URL ? <img src={LOGO_URL} alt="Recao" style={{ height: 24, filter: "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(5deg)" }} /> : <div style={{ fontFamily: SF, fontSize: "18px", color: C.gold }}>Recao</div>}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontFamily: F, fontSize: "11px", color: "#777", textTransform: "uppercase", letterSpacing: "0.08em" }}>{roleLabel}</span>
        <button onClick={onLogout} style={{ border: `1px solid #555`, borderRadius: "6px", background: "none", color: "#777", fontFamily: F, fontSize: "10px", padding: "4px 10px", cursor: "pointer" }}>Salir</button>
      </div>
    </div>
  );
}
