import { useState, useEffect, useCallback } from "react";
import { F, SF, C, inp, lbl, crd, btnDark, avatar } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

const ROLES = [{ id: "trabajadora", label: "Trabajadora" }, { id: "admin", label: "Dirección" }];
const ROLCHIP = { admin: { bg: "#F0ECF6", fg: "#8B6DAF", label: "Dirección" }, trabajadora: { bg: "#EAF0F8", fg: "#4A7AB5", label: "Trabajadora" } };
const EVCHIP = { bg: "#F0ECE2", fg: "#8A7A54", label: "Eventual · sin acceso" };
const btnSm = { padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${C.brd}`, background: "#fff", color: C.char, fontFamily: F, fontSize: 12.5, fontWeight: 600, cursor: "pointer" };

function Avatar({ name, size = 40 }) {
  const a = avatar(name);
  return <span style={{ width: size, height: size, borderRadius: "999px", background: a.bg, color: a.fg, fontFamily: SF, fontSize: Math.round(size * 0.42), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.inicial}</span>;
}

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
    } catch (e) { setError(e.message || "Error al cargar usuarios"); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };

  const crear = async () => {
    if (creating) return;
    if (!nEmail || !nNombre || nPass.length < 8) { flash("Email, nombre y contraseña (mín. 8)"); return; }
    setCreating(true);
    try {
      await sb.fn("gestion-usuarios", { action: "crear", email: nEmail, nombre: nNombre, rol: nRol, password: nPass });
      setNEmail(""); setNNombre(""); setNRol("trabajadora"); setNPass("");
      flash("Usuario creado"); await load();
    } catch (e) { flash(e.message || "Error al crear"); }
    setCreating(false);
  };

  const cambiarRol = async (u, rol) => { try { await sb.fn("gestion-usuarios", { action: "actualizar", id: u.id, rol }); await load(); } catch (e) { flash(e.message); } };
  const toggleActivo = async (u) => { try { await sb.fn("gestion-usuarios", { action: "actualizar", id: u.id, activo: !u.activo }); await load(); } catch (e) { flash(e.message); } };
  const resetPass = async (u) => {
    const p = window.prompt(`Nueva contraseña para ${u.nombre} (mín. 8):`);
    if (!p) return;
    if (p.length < 8) { flash("Mínimo 8 caracteres"); return; }
    try { await sb.fn("gestion-usuarios", { action: "resetear_password", id: u.id, password: p }); flash("Contraseña actualizada"); }
    catch (e) { flash(e.message); }
  };
  const eliminarEventual = async (u) => {
    if (!window.confirm(`¿Eliminar a ${u.nombre}? Se borrarán sus turnos asignados.`)) return;
    try { await sb.fn("gestion-usuarios", { action: "eliminar_eventual", id: u.id }); flash("Eventual eliminado"); await load(); }
    catch (e) { flash(e.message); }
  };

  const conCuenta = usuarios.filter(u => !u.eventual);
  const eventuales = usuarios.filter(u => u.eventual);

  return (
    <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
      <div style={crd}>
        <div style={{ fontFamily: SF, fontSize: 18, color: C.char, marginBottom: 12 }}>Nuevo usuario</div>
        <label style={lbl}>Nombre</label>
        <input style={{ ...inp, marginBottom: 10 }} value={nNombre} onChange={e => setNNombre(e.target.value)} placeholder="Nombre" />
        <label style={lbl}>Email</label>
        <input style={{ ...inp, marginBottom: 10 }} type="email" value={nEmail} onChange={e => setNEmail(e.target.value)} placeholder="email@ejemplo.com" />
        <label style={lbl}>Contraseña</label>
        <input style={{ ...inp, marginBottom: 10 }} type="text" value={nPass} onChange={e => setNPass(e.target.value)} placeholder="Mínimo 8 caracteres" />
        <label style={lbl}>Rol</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {ROLES.map(r => (
            <button key={r.id} onClick={() => setNRol(r.id)} style={{ flex: 1, padding: 11, borderRadius: 12, border: `1.5px solid ${nRol === r.id ? C.char : C.brd}`, background: nRol === r.id ? C.char : "#fff", color: nRol === r.id ? C.gold : C.mut, fontFamily: F, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{r.label}</button>
          ))}
        </div>
        <button onClick={crear} disabled={creating} style={{ ...btnDark, fontSize: 15, opacity: creating ? 0.6 : 1 }}>{creating ? "Creando…" : "Crear usuario"}</button>
        <div style={{ fontFamily: F, fontSize: 11.5, color: C.mutL, marginTop: 10, textAlign: "center" }}>Las personas eventuales (sin cuenta) se añaden desde Horarios.</div>
      </div>

      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
      {error && <div style={{ fontFamily: F, fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</div>}

      <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mutL, textTransform: "uppercase", letterSpacing: "0.08em", margin: "8px 4px 12px" }}>Equipo ({conCuenta.length})</div>
      {loading ? (
        <div style={{ fontFamily: F, fontSize: 13, color: C.mut, padding: 20, textAlign: "center" }}>Cargando…</div>
      ) : conCuenta.map(u => {
        const isSelf = u.id === (currentUser && currentUser.id);
        const rc = ROLCHIP[u.rol] || ROLCHIP.trabajadora;
        return (
          <div key={u.id} style={{ ...crd, opacity: u.activo ? 1 : 0.55 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <Avatar name={u.nombre} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{u.nombre}{isSelf ? " (tú)" : ""}</div>
                  <div style={{ fontFamily: F, fontSize: 12, color: C.mut, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
                </div>
              </div>
              <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "5px 11px", borderRadius: 999, background: rc.bg, color: rc.fg, whiteSpace: "nowrap", flexShrink: 0 }}>{rc.label}</span>
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {!isSelf && <button onClick={() => cambiarRol(u, u.rol === "admin" ? "trabajadora" : "admin")} style={btnSm}>{u.rol === "admin" ? "Hacer trabajadora" : "Hacer dirección"}</button>}
              {!isSelf && <button onClick={() => toggleActivo(u)} style={btnSm}>{u.activo ? "Desactivar" : "Activar"}</button>}
              <button onClick={() => resetPass(u)} style={btnSm}>Resetear contraseña</button>
            </div>
          </div>
        );
      })}

      {eventuales.length > 0 && (
        <div>
          <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mutL, textTransform: "uppercase", letterSpacing: "0.08em", margin: "18px 4px 12px" }}>Eventuales ({eventuales.length})</div>
          {eventuales.map(u => (
            <div key={u.id} style={{ ...crd, opacity: u.activo ? 1 : 0.55 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <Avatar name={u.nombre} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{u.nombre}</div>
                    <div style={{ fontFamily: F, fontSize: 12, color: C.mutL }}>Sin cuenta</div>
                  </div>
                </div>
                <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "5px 11px", borderRadius: 999, background: EVCHIP.bg, color: EVCHIP.fg, whiteSpace: "nowrap", flexShrink: 0 }}>{EVCHIP.label}</span>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button onClick={() => eliminarEventual(u)} style={{ ...btnSm, color: "#B23A2C", border: "1.5px solid #EDC9C3" }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
