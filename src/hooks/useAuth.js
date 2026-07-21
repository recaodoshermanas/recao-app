import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// Carga la fila de public.usuarios enlazada al usuario de Auth (rol, nombre...).
async function loadPerfil(authId, token) {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?select=id,email,nombre,rol,activo&auth_id=eq.${authId}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token || SUPABASE_KEY}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    const u = rows?.[0];
    if (!u || !u.activo) return null;
    return { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol };
  } catch (_) {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (session?.user) {
        const perfil = await loadPerfil(session.user.id, session.access_token);
        if (active) setUser(perfil);
      }
      if (active) setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadPerfil(session.user.id, session.access_token).then((perfil) => setUser(perfil));
      } else {
        setUser(null);
      }
    });

    return () => { active = false; sub?.subscription?.unsubscribe(); };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data?.session) return { ok: false, error: "Email o contrasena incorrectos" };
    const perfil = await loadPerfil(data.user.id, data.session.access_token);
    if (!perfil) {
      await supabase.auth.signOut();
      return { ok: false, error: "Usuario sin acceso o desactivado" };
    }
    setUser(perfil);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return { user, checking, login, logout };
}
