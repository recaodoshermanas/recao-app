import { useState, useEffect, useCallback } from "react";
import { sb } from "../lib/supabase.js";

const KEY = "recao_session_v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function readStored() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed.user || null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState(() => readStored());
  const [checking, setChecking] = useState(true);

  // Revalida al arrancar: si el usuario fue desactivado, cierra sesión.
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!user) { setChecking(false); return; }
      try {
        const rows = await sb.select("usuarios", `id=eq.${user.id}&select=id,activo,rol,nombre,email`);
        if (cancel) return;
        const u = rows?.[0];
        if (!u || !u.activo) {
          localStorage.removeItem(KEY);
          setUser(null);
        } else if (u.rol !== user.rol || u.nombre !== user.nombre || u.email !== user.email) {
          const refreshed = { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol };
          localStorage.setItem(KEY, JSON.stringify({ user: refreshed, expiresAt: Date.now() + TTL_MS }));
          setUser(refreshed);
        }
      } catch { /* offline: mantener sesión local */ }
      if (!cancel) setChecking(false);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await sb.rpc("login_usuario", { p_email: email.trim().toLowerCase(), p_password: password });
    const row = Array.isArray(res) ? res[0] : res;
    if (!row || !row.id) return { ok: false, error: "Email o contraseña incorrectos" };
    const u = { id: row.id, email: row.email, nombre: row.nombre, rol: row.rol };
    localStorage.setItem(KEY, JSON.stringify({ user: u, expiresAt: Date.now() + TTL_MS }));
    setUser(u);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setUser(null);
  }, []);

  return { user, checking, login, logout };
}
