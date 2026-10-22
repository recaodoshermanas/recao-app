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
      const [facs, mes, provs, cfgs, invs] = await Promise.all([
        sb.select("facturas_proveedores", "select=*&order=fecha.desc"),
        sb.select("datos_mes", "select=*&order=mes.desc"),
        sb.select("proveedores", "select=*&activo=eq.true&order=nombre.asc"),
        sb.select("config", "select=*"),
        sb.select("inversiones", "select=id,fecha,concepto,importe&activo=eq.true&order=fecha.asc").catch(() => []), // #40: única fuente de las inversiones
      ]);
      setFacturas(facs);
      const mObj = {};
      const invMes = {};
      (invs || []).forEach(i => { (invMes[i.fecha.slice(0, 7)] ||= []).push({ id: String(i.id), concepto: i.concepto, amount: Number(i.importe) }); });
      mes.forEach(m => { mObj[m.mes] = { ...m, inversiones: invMes[m.mes] || [] }; });
      // #43: desde oct-2026 la paquetería de cada mes sale de los cobros de BBVA (+ correcciones a mano)
      try {
        const paq = await sb.rpc("paqueteria_meses");
        Object.entries(paq || {}).forEach(([k, v]) => { if (mObj[k]) mObj[k] = { ...mObj[k], paqueteria: v }; });
      } catch (e) { /* solo dirección */ }
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
