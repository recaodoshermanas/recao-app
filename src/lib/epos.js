const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function triggerEposSync() {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/epos-sync`, { method: "POST" });
  if (!r.ok) throw new Error(`Sync failed: ${r.status}`);
  return r.json();
}
