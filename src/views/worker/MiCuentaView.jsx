import { useState } from "react";
import { F, SF, C, inp, lbl, btnDark, SHADOW } from "../../lib/styles.js";
import { IcoUser } from "../../lib/icons.jsx";
import { supabase } from "../../lib/supabase.js";

export function MiCuentaView() {
  const [p1, setP1] = useState(""); const [p2, setP2] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const guardar = async () => {
    if (p1.length < 8) { setMsg("Mínimo 8 caracteres"); return; }
    if (p1 !== p2) { setMsg("Las contraseñas no coinciden"); return; }
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) setMsg("Error: " + error.message);
    else { setMsg("Contraseña actualizada"); setP1(""); setP2(""); }
  };
  return (
    <div style={{ padding: "16px", maxWidth: 400, margin: "0 auto" }}>
      <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 18, padding: 18, boxShadow: SHADOW.card }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "#F0ECE2", display: "flex", alignItems: "center", justifyContent: "center" }}><IcoUser size={22} color="#8A7A54" /></span>
          <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>Cambiar contraseña</div>
        </div>
        <label style={lbl}>Nueva contraseña</label>
        <input type="password" value={p1} onChange={e => setP1(e.target.value)} placeholder="Mínimo 8 caracteres" style={{ ...inp, marginBottom: 10 }} />
        <label style={lbl}>Repetir contraseña</label>
        <input type="password" value={p2} onChange={e => setP2(e.target.value)} placeholder="Repite la contraseña" style={{ ...inp, marginBottom: 14 }} />
        {msg && <div style={{ fontFamily: F, fontSize: 13, color: msg.includes("actualizada") ? C.grn : C.red, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
        <button onClick={guardar} disabled={busy} style={{ ...btnDark, fontSize: 15, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Guardar"}</button>
      </div>
    </div>
  );
}
