const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

export const sb = {
  async select(table, query = "") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers });
    if (!r.ok) throw new Error(`Select ${table}: ${r.status}`);
    return r.json();
  },
  async insert(table, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`Insert ${table}: ${r.status} ${await r.text()}`);
    return r.json();
  },
  async update(table, query, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`Update ${table}: ${r.status}`);
    return r.json();
  },
  async upsert(table, data, onConflict) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ""}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`Upsert ${table}: ${r.status} ${await r.text()}`);
    return r.json();
  },
  async delete(table, query) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { method: "DELETE", headers });
    if (!r.ok) throw new Error(`Delete ${table}: ${r.status}`);
    return true;
  },
};
