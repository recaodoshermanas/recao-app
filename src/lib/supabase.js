import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// Cliente oficial: gestiona la sesion de Supabase Auth (login, refresh, persistencia).
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Cabeceras autenticadas: usa el token del usuario si hay sesion; si no, la clave publica.
async function authHeaders(extra = {}) {
  let token = SUPABASE_KEY;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) token = data.session.access_token;
  } catch (_) { /* sin sesion */ }
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, ...extra };
}

// Wrapper REST (misma API de antes) pero ahora las peticiones viajan con el token del usuario.
export const sb = {
  async select(table, query = "") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: await authHeaders() });
    if (!r.ok) throw new Error(`Select ${table}: ${r.status}`);
    return r.json();
  },
  async insert(table, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`Insert ${table}: ${r.status} ${await r.text()}`);
    return r.json();
  },
  async update(table, query, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      method: "PATCH",
      headers: await authHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`Update ${table}: ${r.status}`);
    return r.json();
  },
  async upsert(table, data, onConflict) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ""}`;
    const r = await fetch(url, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" }),
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`Upsert ${table}: ${r.status} ${await r.text()}`);
    return r.json();
  },
  async delete(table, query) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { method: "DELETE", headers: await authHeaders() });
    if (!r.ok) throw new Error(`Delete ${table}: ${r.status}`);
    return true;
  },
  async rpc(fn, params = {}) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(params),
    });
    if (!r.ok) throw new Error(`RPC ${fn}: ${r.status} ${await r.text()}`);
    return r.json();
  },
  // Llama a una edge function con el token del usuario (p.ej. gestion-usuarios).
  async fn(name, body = {}) {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || out?.ok === false) throw new Error(out?.error || `Fn ${name}: ${r.status}`);
    return out;
  },
};
