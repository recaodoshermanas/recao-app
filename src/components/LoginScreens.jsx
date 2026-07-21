import { useState } from "react";
import { F, SF, C, inp, btnDark, LOGO, avatar } from "../lib/styles.js";

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !email || !pass) return;
    setBusy(true); setError("");
    try {
      const res = await onLogin(email, pass);
      if (!res || !res.ok) setError((res && res.error) || "No se pudo entrar");
    } catch (e) { setError("No se pudo entrar"); }
    setBusy(false);
  };
  const onKey = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px" }}>
      <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
        <img src={LOGO} alt="Recao" style={{ height: 48, display: "block", margin: "0 auto" }} />
        <div style={{ fontFamily: F, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: C.mutL, marginTop: 12 }}>Tienda de barrio · Dos Hermanas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 40 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKey} type="email" placeholder="tu@email.com" autoCapitalize="none" style={{ ...inp, textAlign: "center" }} />
          <input value={pass} onChange={e => setPass(e.target.value)} onKeyDown={onKey} type="password" placeholder="Contraseña" style={{ ...inp, textAlign: "center" }} />
          {error && <div style={{ fontFamily: F, fontSize: 13, color: C.red }}>{error}</div>}
          <button onClick={submit} disabled={busy} style={{ ...btnDark, fontSize: 17, padding: 16, marginTop: 6, opacity: busy ? 0.6 : 1 }}>{busy ? "Entrando…" : "Entrar"}</button>
        </div>
      </div>
    </div>
  );
}

export function Header({ user, onLogout }) {
  const av = avatar(user && user.nombre ? user.nombre : "");
  return (
    <div style={{ background: C.char, position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px", maxWidth: 1100, margin: "0 auto" }}>
        <img src={LOGO} alt="Recao" style={{ height: 22, display: "block", filter: "brightness(0) invert(1)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: F, fontSize: 12, color: "#C9C0B0" }}>{user && user.nombre}</span>
          <span style={{ width: 30, height: 30, borderRadius: "999px", background: av.bg, color: av.fg, fontFamily: SF, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>{av.inicial}</span>
          <button onClick={onLogout} style={{ background: "transparent", border: "none", color: "#8A8070", fontFamily: F, fontSize: 12, cursor: "pointer", padding: "4px 6px" }}>Salir</button>
        </div>
      </div>
    </div>
  );
}
