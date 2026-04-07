import { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Area, AreaChart } from "recharts";

/* ─── SUPABASE CONFIG ─── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

const sb = {
  async select(table, query = "") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) throw new Error(`Select ${table}: ${r.status}`);
    return r.json();
  },
  async insert(table, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`Insert ${table}: ${r.status}`);
    return r.json();
  },
  async update(table, query, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`Update ${table}: ${r.status}`);
    return r.json();
  },
  async upsert(table, data, onConflict) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ""}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`Upsert ${table}: ${r.status}`);
    return r.json();
  },
  async delete(table, query) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) throw new Error(`Delete ${table}: ${r.status}`);
    return true;
  },
};

const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const PAQUETERIA = ["Celeritas","Inpost","Vinted Go","UPS","Disashop","Nacex","GLS","Amazon"];
const GASTOS_FIJOS_TPL = [
  { key: "ss", label: "Seguros Sociales" },
  { key: "alquiler", label: "Alquiler" },
  { key: "iva_alquiler", label: "IVA Alquiler" },
  { key: "luz", label: "Luz" },
  { key: "agua", label: "Agua (Emasesa)" },
  { key: "asesoria", label: "Asesoría / Gestoría" },
  { key: "securitas", label: "Securitas" },
  { key: "epos", label: "EPOS Now" },
  { key: "ayuntamiento", label: "Gasto Ayuntamiento" },
];
const OWNER_PASSWORD = "Recao2019_";

function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
function fmt(n) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0); }
function fmt2(n) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0); }
function mkLabel(k) { const [y, m] = k.split("-"); return `${MONTHS_FULL[parseInt(m) - 1]} ${y}`; }
function mkShort(k) { const [y, m] = k.split("-"); return `${MONTHS_ES[parseInt(m) - 1]} ${y.slice(2)}`; }
function pn(v) { return parseFloat(String(v).replace(",", ".")) || 0; }

const now = new Date();
const currentMK = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

function calcMonth(facturas, md, mk) {
  if (md?.resumen_legacy) {
    const s = md.resumen_legacy;
    return { totalIngresos: s.ingresos, totalGastos: s.gastos, resultado: s.resultado, margen: s.ingresos > 0 ? (s.resultado / s.ingresos * 100) : 0, totalFacturas: 0, totalSalarios: 0, totalGastosFijos: 0, totalOtros: 0, totalInversiones: 0, reparto: 0, isSummary: true };
  }
  if (!md) return { totalIngresos: 0, totalGastos: 0, resultado: 0, margen: 0, totalFacturas: 0, totalSalarios: 0, totalGastosFijos: 0, totalOtros: 0, totalInversiones: 0, reparto: 0, isSummary: false };
  const facs = facturas.filter(f => f.fecha?.startsWith(mk));
  const tFac = facs.reduce((s, f) => s + parseFloat(f.importe), 0);
  const tIng = parseFloat(md.ventas_epos || 0) + Object.values(md.paqueteria || {}).reduce((s, v) => s + parseFloat(v), 0);
  const tSal = (md.salarios || []).reduce((s, e) => s + parseFloat(e.amount), 0);
  const tFij = Object.values(md.gastos_fijos || {}).reduce((s, v) => s + parseFloat(v), 0);
  const tOtr = (md.otros_gastos || []).reduce((s, e) => s + parseFloat(e.amount), 0);
  const tGas = tFac + tSal + tFij + tOtr;
  const res = tIng - tGas;
  const tInv = (md.inversiones || []).reduce((s, i) => s + parseFloat(i.amount), 0);
  return { totalIngresos: tIng, totalGastos: tGas, resultado: res, margen: tIng > 0 ? (res / tIng * 100) : 0, totalFacturas: tFac, totalSalarios: tSal, totalGastosFijos: tFij, totalOtros: tOtr, totalInversiones: tInv, reparto: parseFloat(md.reparto_socios || 0), isSummary: false };
}

const F = `'DM Sans', system-ui, sans-serif`;
const SF = `'DM Serif Display', Georgia, serif`;
const C = { cream: "#FAF7F2", char: "#2C2C2C", gold: "#F1BE49", brd: "#E4DDD0", mut: "#8A8070", grn: "#2D8B4E", red: "#C44D3F", blu: "#4A7AB5", pur: "#8B6DAF" };
const inp = { width: "100%", padding: "12px 14px", border: `1.5px solid ${C.brd}`, borderRadius: "10px", fontFamily: F, fontSize: "15px", color: C.char, background: "#fff", boxSizing: "border-box", outline: "none" };
const lbl = { display: "block", fontFamily: F, fontSize: "11px", fontWeight: 700, color: C.mut, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.07em" };
const crd = { background: "#fff", borderRadius: "12px", border: `1.5px solid ${C.brd}`, padding: "18px", marginBottom: "12px" };

function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (msg, onOk) => setState({ msg, onOk });
  const Dialog = () => state ? (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", padding: "28px", maxWidth: 340, width: "100%", textAlign: "center" }}>
        <p style={{ fontFamily: F, fontSize: "15px", color: C.char, marginBottom: "24px", lineHeight: 1.5 }}>{state.msg}</p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => setState(null)} style={{ flex: 1, padding: "12px", border: `1.5px solid ${C.brd}`, borderRadius: "10px", background: "none", fontFamily: F, fontSize: "14px", color: C.mut, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => { state.onOk(); setState(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: "10px", background: C.red, color: "#fff", fontFamily: F, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Confirmar</button>
        </div>
      </div>
    </div>
  ) : null;
  return { ask, Dialog };
}

function useRecaoData() {
  const [facturas, setFacturas] = useState([]);
  const [monthlyData, setMonthlyData] = useState({});
  const [proveedores, setProveedores] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { facturas, monthlyData, proveedores, config, loading, error, reload };
}

// (componentes y resto del código sigue en App.jsx parte 2 — placeholder mínimo)
export default function RecaoApp() {
  const { facturas, monthlyData, loading, error, reload } = useRecaoData();
  if (loading) return <div style={{ padding: 40, fontFamily: SF, color: C.char }}>Cargando Recao...</div>;
  if (error) return <div style={{ padding: 40, fontFamily: F, color: C.red }}>Error: {error} <button onClick={reload}>Reintentar</button></div>;
  return <div style={{ padding: 40, fontFamily: F, color: C.char }}>App Recao cargada. {facturas.length} facturas, {Object.keys(monthlyData).length} meses.</div>;
}
