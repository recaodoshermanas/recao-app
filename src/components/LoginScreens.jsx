import { useState } from "react";
import { F, SF, C, inp, FONT_LINK } from "../lib/styles.js";
import { LOGO_URL } from "../lib/constants.js";

function Brand({ size = 36 }) {
  if (LOGO_URL) return <img src={LOGO_URL} alt="Recao" style={{ height: size, marginBottom: "4px" }} />;
  return <div style={{ fontFamily: SF, fontSize: `${size}px`, color: C.char, marginBottom: "4px" }}>Recao</div>;
}

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !pass || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await onLogin(email, pass);
      if (!r.ok) { setErr(r.error || "Error de acceso"); setTimeout(() => setErr(""), 2500); }
    } catch (e) {
      setErr("Error de conexión"); setTimeout(() => setErr(""), 2500);
    } finally { setBusy(false); }
  };

  const shake = !!err;
  return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <link href={FONT_LINK} rel="stylesheet" />
      <Brand size={36} />
      <div style={{ fontFamily: F, fontSize: "11px", color: C.mut, marginBottom: "40px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Control financiero</div>
      <div style={{ width: "300px" }}>
        <input type="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} placeholder="Email" autoComplete="username" style={{ ...inp, marginBottom: "10px", border: shake ? `2px solid ${C.red}` : `1.5px solid ${C.brd}` }} />
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} placeholder="Contraseña" autoComplete="current-password" style={{ ...inp, marginBottom: "12px", border: shake ? `2px solid ${C.red}` : `1.5px solid ${C.brd}`, animation: shake ? "shake 0.4s" : "none" }} />
        <style>{`@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }`}</style>
        {err && <div style={{ fontFamily: F, fontSize: "12px", color: C.red, marginBottom: "10px", textAlign: "center" }}>{err}</div>}
        <button onClick={submit} disabled={busy} style={{ width: "100%", padding: "14px", border: "none", borderRadius: "10px", background: C.char, color: C.gold, fontFamily: SF, fontSize: "15px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Entrando..." : "Entrar"}</button>
      </div>
    </div>
  );
}

export function Header({ user, onLogout }) {
  const roleLabel = user?.rol === "admin" ? "Dirección" : "Trabajadora";
  return (
    <div style={{ background: C.char, padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20 }}>
      {LOGO_URL ? <img src={LOGO_URL} alt="Recao" style={{ height: 24, filter: "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(5deg)" }} /> : <div style={{ fontFamily: SF, fontSize: "18px", color: C.gold }}>Recao</div>}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {user?.nombre && <span style={{ fontFamily: F, fontSize: "12px", color: "#ccc" }}>Hola, {user.nombre}</span>}
        <span style={{ fontFamily: F, fontSize: "11px", color: "#777", textTransform: "uppercase", letterSpacing: "0.08em" }}>{roleLabel}</span>
        <button onClick={onLogout} style={{ border: `1px solid #555`, borderRadius: "6px", background: "none", color: "#777", fontFamily: F, fontSize: "10px", padding: "4px 10px", cursor: "pointer" }}>Salir</button>
      </div>
    </div>
  );
}
