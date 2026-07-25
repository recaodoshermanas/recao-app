import { useState, useEffect, useCallback } from "react";
import { sb } from "../lib/supabase.js";

export function useRecaoData(user) {
  const [facturas, setFacturas] = useState([]);
  const [monthlyData, setMonthlyData] = useState({});
  const [proveedores, setProveedores] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Recarga los datos SIN tocar "loading" (para no desmontar la vista y perder
  // la navegacion al guardar/eliminar). El spinner a pantalla completa solo se
  // muestra en la carga inicial, gestionada por el efecto de abajo.
  const reload = useCallback(async () => {
    try {
      setError(null);
      const [facs, mes, provs, cfgs] = await Promise.all([
        sb.select("facturas_proveedores", "select=*&order=fecha.desc"),
        sb.select("datos_mes", "select=*&order=mes.desc"),
        sb.select("proveedores", "select=*&order=nombre.asc"),
        sb.select("config", "select=*"),
      ]);
      setFacturas(facs);
      const mObj = {};
      mes.forEach(m => { mObj[m.mes] = m; });
      setMonthlyData(mObj);
      setProveedores(provs.map(p => p.nombre));
      const cfgObj = {};
      cfgs.forEach(c => { cfgObj[c.key] = c.value; });
      setConfig(cfgObj);
    } catch (e) {
      console.error(e);
      setError(e.message);
    }
  }, []);

  const uid = user ? user.id : null;
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    reload().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [uid, reload]);

  return { facturas, monthlyData, proveedores, config, loading, error, reload };
}
