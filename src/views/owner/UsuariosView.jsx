import { useState, useEffect, useCallback } from "react";
import { F, SF, C, inp, lbl, crd } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

const ROLES = [
  { id: "trabajadora", label: "Trabajadora" },
  { id: "admin", label: "Direccion" },
];

const btnSm = { padding: "7px 11px", borderRadius: "7px", border: `1.5px solid ${C.brd}`, background: "#fff", color: C.char, fontFamily: F, fontSize: "12px", cursor: "pointer" };

export function UsuariosView({ currentUser }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [nEmail, setNEmail] = useState("");
  const [nNombre, setNNombre] = useState("");
  const [nRol, setNRol] = useState("trabajadora");
  const [nPass, setNPass] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await sb.fn("gestion-usuarios", { action: "listar" });
      setUsuarios(r.usuarios || []);
    } catch (e) {
      setError(e.message || "Error al cargar usuarios");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };

  const crear = async () => {
    if (creating) return;
    if (!nEmail || !nNombre || nPass.length < 8) { flash("Email, nombre y contrasena (min. 8)"); return; }
    setCreating(true);
    try {
      await sb.fn("gestion-usuarios", { action: "crear", email: nEmail, nombre: nNombre, rol: nRol, password: nPass });
      setNEmail(""); setNNombre(""); setNRol("trabajadora"); setNPass("");
      flash("Usuario creado");
      await load();
    } catch (e) { flash(e.message || "Error al crear"); }
    setCreating(false);
  };

  const cambiarRol = async (u, rol) => {
    try { await sb.fn("gestion-usuarios", { action: "actualizar", id: u.id, rol }); await load(); }
    catch (e) { flash(e.message); }
  };

  const toggleActivo = async (u) => {
    try { await sb.fn("gestion-usuarios", { action: "actualizar", id: u.id, activo: !u.activo }); await load(); }
    catch (e) { flash(e.message); }
  };

  const resetPass = async (u) => {
    const p = window.prompt(`Nueva contrasena para ${u.nombre} (min. 8):`);
    if (!p) return;
    if (p.length < 8) { flash("Minimo 8 caracteres"); return; }
    try { await sb.fn("gestion-usuarios", { action: "resetear_password", id: u.id, password: p }); flash("Contrasena actualizada"); }
    catch (e) { flash(e.message); }
  };

  return (
    <div style={{ padding: "16px", maxWidth: "640px", margin: "0 auto" }}>
      <div style={crd}>
        <div style={{ fontFamily: SF, fontSize: "18px", color: C.char, marginBottom: "12px" }}>Nuevo usuario</div>
        <label style={lbl}>Nombre</label>
        <input style={{ ...inp, marginBottom: "10px" }} value={nNombre} onChange={e => setNNombre(e.target.value)} placeholder="Nombre" />
        <label style={lbl}>Email</label>
        <input style={{ ...inp, marginBottom: "10px" }} type="email" value={nEmail} onChange={e => setNEmail(e.target.value)} placeholder="email@ejemplo.com" />
        <label style={lbl}>Contrasena</label>
        <input style={{ ...inp, marginBottom: "10px" }} type="text" value={nPass} onChange={e => setNPass(e.target.value)} placeholder="Minimo 8 caracteres" />
        <label style={lbl}>Rol</label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          {ROLES.map(r => (
            <button key={r.id} onClick={() => setNRol(r.id)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1.5px solid ${nRol === r.id ? C.char : C.brd}`, background: nRol === r.id ? C.char : "#fff", color: nRol === r.id ? C.gold : C.mut, fontFamily: F, fontSize: "13px", cursor: "pointer" }}>{r.label}</button>
          ))}
        </div>
        <button onClick={crear} disabled={creating} style={{ width: "100%", padding: "13px", border: "none", borderRadius: "10px", background: C.char, color: C.gold, fontFamily: SF, fontSize: "15px", cursor: creating ? "default" : "pointer", opacity: creating ? 0.6 : 1 }}>{creating ? "Creando..." : "Crear usuario"}</button>
      </div>

      {msg && <div style={{ fontFamily: F, fontSize: "13px", color: C.char, background: C.gold, padding: "8px 12px", borderRadius: "8px", marginBottom: "12px", textAlign: "center" }}>{msg}</div>}
      {error && <div style={{ fontFamily: F, fontSize: "13px", color: C.red, marginBottom: "12px" }}>{error}</div>}

      <div style={{ fontFamily: F, fontSize: "11px", fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.07em", margin: "8px 4px" }}>Equipo ({usuarios.length})</div>
      {loading ? (
        <div style={{ fontFamily: F, fontSize: "13px", color: C.mut, padding: "20px", textAlign: "center" }}>Cargando...</div>
      ) : usuarios.map(u => {
        const isSelf = u.id === currentUser?.id;
        return (
          <div key={u.id} style={{ ...crd, opacity: u.activo ? 1 : 0.55 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
              <div>
                <div style={{ fontFamily: SF, fontSize: "16px", color: C.char }}>{u.nombre}{isSelf ? " (tu)" : ""}</div>
                <div style={{ fontFamily: F, fontSize: "12px", color: C.mut }}>{u.email}</div>
              </div>
              <span style={{ fontFamily: F, fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: u.rol === "admin" ? C.pur : C.blu }}>{u.rol === "admin" ? "Direccion" : "Trabajadora"}</span>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {!isSelf && <button onClick={() => cambiarRol(u, u.rol === "admin" ? "trabajadora" : "admin")} style={btnSm}>{u.rol === "admin" ? "Hacer trabajadora" : "Hacer direccion"}</button>}
              {!isSelf && <button onClick={() => toggleActivo(u)} style={btnSm}>{u.activo ? "Desactivar" : "Activar"}</button>}
              <button onClick={() => resetPass(u)} style={btnSm}>Resetear contrasena</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
