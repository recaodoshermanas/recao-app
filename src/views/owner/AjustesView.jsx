import { useEffect, useState, useCallback } from "react";
import { F, SF, C, inp, lbl, crd } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

const btn = { padding: "10px 16px", border: "none", borderRadius: "8px", background: C.char, color: C.gold, fontFamily: SF, fontSize: "13px", cursor: "pointer" };
const btnGhost = { padding: "8px 14px", border: `1px solid ${C.brd}`, borderRadius: "8px", background: "#fff", color: C.char, fontFamily: F, fontSize: "12px", cursor: "pointer" };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px" };
const modal = { background: "#fff", borderRadius: "14px", padding: "22px", width: "100%", maxWidth: "380px", fontFamily: F };

function Field({ label, children }) {
  return <div style={{ marginBottom: "12px" }}><div style={lbl}>{label}</div>{children}</div>;
}

function CreateModal({ onClose, onSaved }) {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [pass, setPass] = useState("");
  const [rol, setRol] = useState("trabajadora");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    if (!email || !nombre || !pass || busy) return;
    setBusy(true); setErr("");
    try {
      await sb.rpc("crear_usuario", { p_email: email.trim().toLowerCase(), p_nombre: nombre.trim(), p_password: pass, p_rol: rol });
      onSaved();
    } catch (e) { setErr("No se pudo crear (¿email duplicado?)"); } finally { setBusy(false); }
  };
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: SF, fontSize: "18px", marginBottom: "16px", color: C.char }}>Nuevo usuario</div>
        <Field label="Email"><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label="Nombre"><input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} /></Field>
        <Field label="Contraseña"><input style={inp} type="text" value={pass} onChange={e => setPass(e.target.value)} /></Field>
        <Field label="Rol">
          <select style={inp} value={rol} onChange={e => setRol(e.target.value)}>
            <option value="trabajadora">Trabajadora</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        {err && <div style={{ color: C.red, fontSize: "12px", marginBottom: "10px" }}>{err}</div>}
        <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
          <button style={btnGhost} onClick={onClose}>Cancelar</button>
          <button style={{ ...btn, flex: 1 }} onClick={save} disabled={busy}>{busy ? "Creando..." : "Crear"}</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ user, currentUser, onClose, onSaved }) {
  const [nombre, setNombre] = useState(user.nombre || "");
  const [email, setEmail] = useState(user.email || "");
  const [rol, setRol] = useState(user.rol);
  const [activo, setActivo] = useState(user.activo);
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isSelf = currentUser?.id === user.id;
  const save = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      await sb.rpc("actualizar_usuario", { p_id: user.id, p_nombre: nombre.trim(), p_email: email.trim().toLowerCase(), p_rol: rol, p_activo: activo });
      if (newPass) await sb.rpc("resetear_password", { p_id: user.id, p_new_password: newPass });
      onSaved();
    } catch (e) { setErr("No se pudo guardar (¿último admin activo?)"); } finally { setBusy(false); }
  };
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: SF, fontSize: "18px", marginBottom: "16px", color: C.char }}>Editar usuario</div>
        <Field label="Nombre"><input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} /></Field>
        <Field label="Email"><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label="Rol">
          <select style={inp} value={rol} onChange={e => setRol(e.target.value)} disabled={isSelf}>
            <option value="trabajadora">Trabajadora</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Estado">
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
            <input type="checkbox" checked={activo} disabled={isSelf} onChange={e => setActivo(e.target.checked)} /> Activo
          </label>
        </Field>
        <Field label="Nueva contraseña (opcional)"><input style={inp} type="text" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Dejar vacío para no cambiar" /></Field>
        {isSelf && <div style={{ fontSize: "11px", color: C.mut, marginBottom: "10px" }}>No puedes cambiar tu propio rol ni desactivarte.</div>}
        {err && <div style={{ color: C.red, fontSize: "12px", marginBottom: "10px" }}>{err}</div>}
        <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
          <button style={btnGhost} onClick={onClose}>Cancelar</button>
          <button style={{ ...btn, flex: 1 }} onClick={save} disabled={busy}>{busy ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

export function AjustesView({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const rows = await sb.select("usuarios", "select=id,email,nombre,rol,activo&order=created_at.asc");
      setUsers(rows || []);
    } catch (e) { setErr("Error cargando usuarios"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: "20px 16px", fontFamily: F }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div style={{ fontFamily: SF, fontSize: "20px", color: C.char }}>Usuarios</div>
        <button style={btn} onClick={() => setCreating(true)}>+ Añadir</button>
      </div>
      {loading && <div style={{ color: C.mut, fontSize: "13px" }}>Cargando...</div>}
      {err && <div style={{ color: C.red, fontSize: "13px" }}>{err}</div>}
      {!loading && users.map(u => (
        <div key={u.id} style={{ ...crd, padding: "12px 14px", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: u.activo ? 1 : 0.5 }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: C.char }}>{u.nombre}</div>
            <div style={{ fontSize: "11px", color: C.mut }}>{u.email} · {u.rol === "admin" ? "Admin" : "Trabajadora"} · {u.activo ? "activo" : "inactivo"}</div>
          </div>
          <button style={btnGhost} onClick={() => setEditing(u)}>✎</button>
        </div>
      ))}
      {creating && <CreateModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {editing && <EditModal user={editing} currentUser={currentUser} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}
