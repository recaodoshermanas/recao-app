import { useState } from "react";
import { F, SF, C, inp, btnDark, LOGO, avatar } from "../lib/styles.js";
import { NotificacionesBell } from "./NotificacionesBell.jsx";
import { tokenRecuperar, limpiarTokenRecuperar, pedirRecuperacion, cambiarConToken } from "../lib/recuperar.js";

export function LoginScreen({ onLogin }) {
  const [token] = useState(() => tokenRecuperar());
  const [modo, setModo] = useState(token ? "nueva" : "entrar"); // entrar | olvido | enviado | nueva
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
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
  const pedir = async () => {
    if (busy) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError("Escribe tu correo"); return; }
    setBusy(true); setError("");
    try { await pedirRecuperacion(email, "app"); setModo("enviado"); }
    catch (e) { setError(e.message || "No se ha podido enviar"); }
    setBusy(false);
  };
  const cambiar = async () => {
    if (busy) return;
    if (pass.length < 8) { setError("Mínimo 8 caracteres"); return; }
    if (pass !== pass2) { setError("Las contraseñas no coinciden"); return; }
    setBusy(true); setError("");
    try {
      const r = await cambiarConToken(token, pass);
      limpiarTokenRecuperar();
      const res = await onLogin(r.email, pass);
      if (!res || !res.ok) { setModo("entrar"); setEmail(r.email); setPass(""); setError("Contraseña cambiada. Entra con la nueva."); }
    } catch (e) { setError(e.message || "No se ha podido cambiar"); }
    setBusy(false);
  };
  const ir = (m) => { setModo(m); setError(""); setPass(""); setPass2(""); if (m === "entrar" && token) limpiarTokenRecuperar(); };
  const onKey = (e) => { if (e.key === "Enter") (modo === "olvido" ? pedir : modo === "nueva" ? cambiar : submit)(); };
  const enlace = { background: "none", border: "none", padding: 4, color: C.mut, fontFamily: F, fontSize: 13, textDecoration: "underline", cursor: "pointer" };
  const texto = { fontFamily: F, fontSize: 14, color: C.char, lineHeight: 1.5 };

  if (modo !== "entrar") return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px" }}>
      <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
        <img src={LOGO} alt="Recao" style={{ height: 48, display: "block", margin: "0 auto" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 36 }}>
          {modo === "olvido" && <>
            <div style={texto}>Escribe tu correo y te mandamos un enlace para elegir una contraseña nueva.</div>
            <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKey} type="email" placeholder="tu@email.com" autoCapitalize="none" autoFocus style={{ ...inp, textAlign: "center" }} />
            {error && <div style={{ fontFamily: F, fontSize: 13, color: C.red }}>{error}</div>}
            <button onClick={pedir} disabled={busy} style={{ ...btnDark, fontSize: 17, padding: 16, marginTop: 6, opacity: busy ? 0.6 : 1 }}>{busy ? "Enviando…" : "Enviarme el enlace"}</button>
          </>}
          {modo === "enviado" && <>
            <div style={texto}>Si <b>{email.trim()}</b> tiene cuenta en Recao, en unos minutos te llega un correo con el enlace. Mira también en spam. El enlace caduca en 1 hora.</div>
          </>}
          {modo === "nueva" && <>
            <div style={texto}>Elige tu contraseña nueva (mínimo 8 caracteres).</div>
            <input value={pass} onChange={e => setPass(e.target.value)} onKeyDown={onKey} type="password" autoComplete="new-password" placeholder="Contraseña nueva" autoFocus style={{ ...inp, textAlign: "center" }} />
            <input value={pass2} onChange={e => setPass2(e.target.value)} onKeyDown={onKey} type="password" autoComplete="new-password" placeholder="Repite la contraseña" style={{ ...inp, textAlign: "center" }} />
            {error && <div style={{ fontFamily: F, fontSize: 13, color: C.red }}>{error}</div>}
            <button onClick={cambiar} disabled={busy} style={{ ...btnDark, fontSize: 17, padding: 16, marginTop: 6, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Guardar y entrar"}</button>
          </>}
          <button onClick={() => ir("entrar")} style={enlace}>Volver a entrar</button>
        </div>
      </div>
    </div>
  );

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
          <button onClick={() => ir("olvido")} style={enlace}>¿Has olvidado tu contraseña?</button>
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
          {user && <NotificacionesBell user={user} />}
          <button onClick={onLogout} style={{ background: "transparent", border: "none", color: "#8A8070", fontFamily: F, fontSize: 12, cursor: "pointer", padding: "4px 6px" }}>Salir</button>
        </div>
      </div>
    </div>
  );
}
