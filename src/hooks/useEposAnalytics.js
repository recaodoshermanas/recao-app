import { useState, useEffect, useCallback } from "react";
import { sb } from "../lib/supabase.js";
import { triggerEposSync } from "../lib/epos.js";

export function useEposAnalytics() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [hourlySales, setHourlySales] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [prods, cats, sups, daily, hourly, syncLog] = await Promise.all([
        sb.select("epos_products", "select=id,name,category_id,category_name,supplier_id,supplier_name,cost_price,sale_price&order=name.asc"),
        sb.select("epos_categories", "select=id,name&order=name.asc"),
        sb.select("epos_suppliers", "select=id,name&order=name.asc"),
        sb.select("epos_daily_product_sales", "select=*&order=date.desc&limit=50000"),
        sb.select("epos_hourly_sales", "select=*&order=date.desc&limit=10000"),
        sb.select("epos_sync_log", "select=*&order=synced_at.desc&limit=1"),
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
      setDailySales(daily);
      setHourlySales(hourly);
      setLastSync(syncLog.length > 0 ? syncLog[0] : null);
    } catch (e) {
      console.error("Analytics load error:", e);
      setError(e.message);
    }
    setLoading(false);
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await triggerEposSync();
      await loadData();
    } catch (e) {
      console.error("Sync error:", e);
      setError("Error al sincronizar: " + e.message);
    }
    setSyncing(false);
  }, [loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  return { products, categories, suppliers, dailySales, hourlySales, lastSync, loading, syncing, error, sync, reload: loadData };
}
