import { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Area, AreaChart } from "recharts";

/* ─── SUPABASE CLIENT ─── */
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
    if (!r.ok) throw new Error(`Insert ${table}: ${r.status} ${await r.text()}`);
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
    if (!r.ok) throw new Error(`Upsert ${table}: ${r.status} ${await r.text()}`);
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

/* ─── CONSTANTS ─── */
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

/* ─── HELPERS ─── */
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

/* ─── STYLES ─── */
const F = `'DM Sans', system-ui, sans-serif`;
const SF = `'DM Serif Display', Georgia, serif`;
const C = { cream: "#FAF7F2", char: "#2C2C2C", gold: "#F1BE49", brd: "#E4DDD0", mut: "#8A8070", grn: "#2D8B4E", red: "#C44D3F", blu: "#4A7AB5", pur: "#8B6DAF" };
const inp = { width: "100%", padding: "12px 14px", border: `1.5px solid ${C.brd}`, borderRadius: "10px", fontFamily: F, fontSize: "15px", color: C.char, background: "#fff", boxSizing: "border-box", outline: "none" };
const lbl = { display: "block", fontFamily: F, fontSize: "11px", fontWeight: 700, color: C.mut, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.07em" };
const crd = { background: "#fff", borderRadius: "12px", border: `1.5px solid ${C.brd}`, padding: "18px", marginBottom: "12px" };

/* ─── CONFIRM DIALOG ─── */
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

/* ─── DATA HOOK ─── */
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

/* ═════════════════ WORKER VIEW ═════════════════ */
function WorkerView({ facturas, proveedores, onReload }) {
  const [modo, setModo] = useState("lista");
  const [editId, setEditId] = useState(null);
  const [proveedor, setProveedor] = useState("");
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isNewProv, setIsNewProv] = useState(false);
  const { ask, Dialog } = useConfirm();

  const resetForm = () => { setProveedor(""); setImporte(""); setFecha(new Date().toISOString().split("T")[0]); setNota(""); setEditId(null); setIsNewProv(false); };

  const allProveedores = useMemo(() => {
    const fromFacs = [...new Set(facturas.map(f => f.proveedor))];
    return [...new Set([...proveedores, ...fromFacs])].sort();
  }, [facturas, proveedores]);

  const handleSave = async () => {
    const amt = pn(importe);
    if (!proveedor.trim() || amt <= 0) return;
    setSaving(true);
    try {
      const payload = { proveedor: proveedor.trim(), importe: amt, fecha, nota: nota.trim() || null };
      if (editId) await sb.update("facturas_proveedores", `id=eq.${editId}`, payload);
      else {
        await sb.insert("facturas_proveedores", payload);
        if (isNewProv && !proveedores.includes(proveedor.trim())) {
          try { await sb.insert("proveedores", { nombre: proveedor.trim() }); } catch {}
        }
      }
      await onReload();
      resetForm();
      setSaved(true);
      setTimeout(() => { setSaved(false); setModo("lista"); }, 1000);
    } catch (e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  const startEdit = (f) => { setEditId(f.id); setProveedor(f.proveedor); setImporte(String(f.importe)); setFecha(f.fecha); setNota(f.nota || ""); setModo("form"); };

  const handleDelete = async (id) => {
    try { await sb.delete("facturas_proveedores", `id=eq.${id}`); await onReload(); }
    catch (e) { alert("Error: " + e.message); }
  };

  const sorted = [...facturas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const grouped = {};
  sorted.forEach(f => { const mk = f.fecha.substring(0, 7); if (!grouped[mk]) grouped[mk] = []; grouped[mk].push(f); });

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      <Dialog />
      {modo === "lista" ? (
        <>
          <button onClick={() => { resetForm(); setModo("form"); }} style={{ width: "100%", padding: "18px", border: `2px dashed ${C.brd}`, borderRadius: "12px", background: "transparent", fontFamily: SF, fontSize: "16px", color: C.char, cursor: "pointer", marginBottom: "20px" }}>+ Nueva factura de proveedor</button>
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: C.mut, fontFamily: F, fontSize: "14px" }}>No hay facturas registradas</div>
          ) : (
            Object.entries(grouped).map(([mk, items]) => (
              <div key={mk}>
                <div style={{ fontFamily: SF, fontSize: "15px", color: C.char, marginBottom: "10px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span>{mkLabel(mk)}</span>
                  <span style={{ fontFamily: F, fontSize: "13px", fontWeight: 700, color: C.mut }}>{fmt(items.reduce((s, f) => s + parseFloat(f.importe), 0))}</span>
                </div>
                {items.map(f => (
                  <div key={f.id} style={{ ...crd, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: F, fontSize: "14px", fontWeight: 600, color: C.char, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.proveedor}</div>
                      <div style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginTop: "2px" }}>{new Date(f.fecha).toLocaleDateString("es-ES")}{f.nota ? ` · ${f.nota}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "10px" }}>
                      <span style={{ fontFamily: F, fontSize: "15px", fontWeight: 700, color: C.char }}>{fmt2(f.importe)}</span>
                      <button onClick={() => startEdit(f)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "14px", color: C.mut, padding: "4px" }}>✎</button>
                      <button onClick={() => ask("¿Eliminar esta factura?", () => handleDelete(f.id))} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "18px", color: "#ccc", padding: "4px" }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </>
      ) : (
        <>
          <h3 style={{ fontFamily: SF, fontSize: "20px", color: C.char, marginBottom: "24px" }}>{editId ? "Editar factura" : "Nueva factura"}</h3>
          <label style={lbl}>Proveedor</label>
          {isNewProv ? (
            <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
              <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del nuevo proveedor" style={{ ...inp, flex: 1, marginBottom: 0 }} autoFocus />
              <button onClick={() => { setIsNewProv(false); setProveedor(""); }} style={{ border: `1.5px solid ${C.brd}`, background: "none", color: C.mut, fontFamily: F, fontSize: "12px", padding: "0 12px", borderRadius: "10px", cursor: "pointer" }}>Lista</button>
            </div>
          ) : (
            <select value={proveedor} onChange={e => { if (e.target.value === "__new__") { setIsNewProv(true); setProveedor(""); } else setProveedor(e.target.value); }} style={{ ...inp, marginBottom: "16px", appearance: "auto" }}>
              <option value="">Seleccionar proveedor</option>
              {allProveedores.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__new__">+ Nuevo proveedor...</option>
            </select>
          )}
          <label style={lbl}>Importe (€)</label>
          <input type="number" inputMode="decimal" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0,00" style={{ ...inp, marginBottom: "16px" }} />
          <label style={lbl}>Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, marginBottom: "16px" }} />
          <label style={lbl}>Nota (opcional)</label>
          <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nº factura, observaciones..." style={{ ...inp, marginBottom: "28px" }} />
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => { resetForm(); setModo("lista"); }} style={{ flex: 1, padding: "14px", border: `1.5px solid ${C.brd}`, borderRadius: "10px", background: "transparent", fontFamily: F, fontSize: "14px", fontWeight: 600, color: C.mut, cursor: "pointer" }}>Cancelar</button>
            <button onClick={handleSave} disabled={!proveedor || !importe || saving} style={{ flex: 2, padding: "14px", border: "none", borderRadius: "10px", background: (!proveedor || !importe || saving) ? "#D8D0C4" : C.char, color: (!proveedor || !importe || saving) ? "#A09888" : C.gold, fontFamily: SF, fontSize: "15px", cursor: (!proveedor || !importe || saving) ? "default" : "pointer" }}>{saving ? "Guardando..." : saved ? "✓ Guardado" : (editId ? "Actualizar" : "Guardar")}</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═════════════════ OWNER VIEW ═════════════════ */
function OwnerView({ facturas, monthlyData, proveedores, config, onReload }) {
  const [tab, setTab] = useState("resumen");
  const tabs = [
    { id: "resumen", label: "Evolución", icon: "◉" },
    { id: "mes", label: "Datos mes", icon: "✎" },
    { id: "resultados", label: "P&L", icon: "▤" },
    { id: "tesoreria", label: "Tesorería", icon: "◈" },
  ];
  return (
    <div>
      <div style={{ display: "flex", borderBottom: `2px solid ${C.brd}`, background: C.cream, position: "sticky", top: 52, zIndex: 9 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "11px 4px 9px", border: "none", background: tab === t.id ? C.char : "transparent", color: tab === t.id ? C.gold : C.mut, fontFamily: F, fontSize: "11px", fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", borderBottom: tab === t.id ? `3px solid ${C.gold}` : "3px solid transparent" }}>
            <span style={{ fontSize: "14px", display: "block", marginBottom: "1px" }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      {tab === "resumen" && <EvolucionView facturas={facturas} monthlyData={monthlyData} />}
      {tab === "mes" && <DatosMesView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} />}
      {tab === "resultados" && <PLView facturas={facturas} monthlyData={monthlyData} />}
      {tab === "tesoreria" && <TesoreriaView facturas={facturas} monthlyData={monthlyData} config={config} onReload={onReload} />}
    </div>
  );
}

/* ─── EVOLUCIÓN ─── */
function EvolucionView({ facturas, monthlyData }) {
  const months = Object.keys(monthlyData).sort();
  const data = months.map(mk => {
    const c = calcMonth(facturas, monthlyData[mk], mk);
    return { name: mkShort(mk), mk, ingresos: c.totalIngresos, gastos: c.totalGastos, resultado: c.resultado, margen: c.margen };
  });
  if (data.length === 0) return <div style={{ padding: "60px 20px", textAlign: "center", color: C.mut, fontFamily: F }}>No hay datos</div>;

  const insights = [];
  const latest = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  if (latest.resultado > 0) {
    const best = data.reduce((max, d) => d.resultado > max.resultado ? d : max, data[0]);
    if (latest.mk === best.mk) insights.push({ type: "success", text: `${mkShort(latest.mk)} es vuestro mejor mes en resultado: ${fmt(latest.resultado)}` });
  }
  if (prev) {
    const ingGrowth = ((latest.ingresos - prev.ingresos) / prev.ingresos * 100).toFixed(1);
    if (parseFloat(ingGrowth) > 0) insights.push({ type: "up", text: `Ingresos +${ingGrowth}% vs ${mkShort(prev.mk)}` });
    if (latest.margen > prev.margen) insights.push({ type: "up", text: `Margen mejora: ${latest.margen.toFixed(1)}% vs ${prev.margen.toFixed(1)}%` });
  }
  const totalRes = data.reduce((s, d) => s + d.resultado, 0);
  insights.push({ type: "info", text: `Beneficio acumulado (${data.length} meses): ${fmt(totalRes)}` });
  const avgMargen = data.reduce((s, d) => s + d.margen, 0) / data.length;
  insights.push({ type: "info", text: `Margen medio: ${avgMargen.toFixed(1)}%` });

  const CT = ({ active, payload, label }) => active && payload?.length ? (
    <div style={{ background: "#fff", border: `1px solid ${C.brd}`, borderRadius: "8px", padding: "12px", fontFamily: F, fontSize: "12px" }}>
      <div style={{ fontWeight: 700, marginBottom: "6px" }}>{label}</div>
      {payload.map(p => (<div key={p.dataKey} style={{ color: p.color, marginBottom: "2px" }}>{p.dataKey === "ingresos" ? "Ingresos" : p.dataKey === "gastos" ? "Gastos" : "Resultado"}: {fmt(p.value)}</div>))}
    </div>
  ) : null;

  return (
    <div style={{ padding: "20px", maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontFamily: SF, fontSize: "20px", color: C.char, marginBottom: "4px" }}>Evolución del negocio</h2>
      <p style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginBottom: "24px" }}>Salud financiera de Recao mes a mes</p>
      <div style={{ background: `linear-gradient(135deg, ${C.char} 0%, #3D3D3D 100%)`, borderRadius: "16px", padding: "22px", marginBottom: "20px", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontFamily: F, fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "4px" }}>Último mes · {mkShort(latest.mk)}</div>
            <div style={{ fontFamily: SF, fontSize: "32px", color: C.gold }}>{fmt(latest.resultado)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: F, fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "4px" }}>Acumulado</div>
            <div style={{ fontFamily: F, fontSize: "22px", fontWeight: 700, color: "#8FCB9B" }}>{fmt(totalRes)}</div>
          </div>
        </div>
      </div>
      <div style={{ ...crd, padding: "16px 10px 8px 0" }}>
        <div style={{ fontFamily: F, fontSize: "12px", fontWeight: 700, color: C.char, marginBottom: "12px", marginLeft: "16px" }}>Ingresos vs Gastos</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="grnG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.grn} stopOpacity={0.15} /><stop offset="100%" stopColor={C.grn} stopOpacity={0} /></linearGradient>
              <linearGradient id="redG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.red} stopOpacity={0.15} /><stop offset="100%" stopColor={C.red} stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.mut }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CT />} />
            <Area type="monotone" dataKey="ingresos" stroke={C.grn} strokeWidth={2.5} fill="url(#grnG)" dot={{ r: 4, fill: C.grn }} />
            <Area type="monotone" dataKey="gastos" stroke={C.red} strokeWidth={2.5} fill="url(#redG)" dot={{ r: 4, fill: C.red }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ ...crd, padding: "16px 10px 8px 0" }}>
        <div style={{ fontFamily: F, fontSize: "12px", fontWeight: 700, color: C.char, marginBottom: "12px", marginLeft: "16px" }}>Resultado mensual</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.mut }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CT />} />
            <Bar dataKey="resultado" fill={C.gold} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ ...crd, padding: "16px 10px 8px 0" }}>
        <div style={{ fontFamily: F, fontSize: "12px", fontWeight: 700, color: C.char, marginBottom: "12px", marginLeft: "16px" }}>Margen (%)</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.mut }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.mut }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? (<div style={{ background: "#fff", border: `1px solid ${C.brd}`, borderRadius: "8px", padding: "10px", fontFamily: F, fontSize: "12px" }}><strong>{label}</strong>: {payload[0].value.toFixed(1)}%</div>) : null} />
            <Line type="monotone" dataKey="margen" stroke={C.blu} strokeWidth={2.5} dot={{ r: 4, fill: C.blu }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: "8px" }}>
        <div style={{ fontFamily: SF, fontSize: "15px", color: C.char, marginBottom: "10px" }}>Diagnóstico</div>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...crd, padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "16px" }}>{ins.type === "success" ? "🟢" : ins.type === "up" ? "📈" : "ℹ️"}</span>
            <span style={{ fontFamily: F, fontSize: "13px", color: C.char }}>{ins.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── DATOS MES ─── */
function DatosMesView({ facturas, monthlyData, config, onReload }) {
  const allMonths = [...new Set([...Object.keys(monthlyData), currentMK])].sort().reverse();
  const [selMonth, setSelMonth] = useState(() => Object.keys(monthlyData).sort().reverse()[0] || currentMK);
  const md = monthlyData[selMonth] || {};
  const isSummary = !!md.resumen_legacy;

  const [ventas, setVentas] = useState("");
  const [paqueteria, setPaqueteria] = useState({});
  const [gastosFijos, setGastosFijos] = useState({});
  const [salarios, setSalarios] = useState([]);
  const [otrosGastos, setOtrosGastos] = useState([]);
  const [inversiones, setInversiones] = useState([]);
  const [repartoSocios, setRepartoSocios] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const d = monthlyData[selMonth] || {};
    if (d.resumen_legacy) {
      setVentas(""); setPaqueteria({}); setGastosFijos({});
      setSalarios(config.salarios_template || []); setOtrosGastos([]);
      setInversiones([]); setRepartoSocios("");
      return;
    }
    setVentas(d.ventas_epos || "");
    setPaqueteria(d.paqueteria || {});
    setGastosFijos(d.gastos_fijos || {});
    setSalarios(d.salarios || config.salarios_template || []);
    setOtrosGastos(d.otros_gastos || []);
    setInversiones(d.inversiones || []);
    setRepartoSocios(d.reparto_socios || "");
  }, [selMonth, monthlyData, config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        mes: selMonth,
        ventas_epos: pn(ventas),
        paqueteria, gastos_fijos: gastosFijos, salarios,
        otros_gastos: otrosGastos, inversiones,
        reparto_socios: pn(repartoSocios),
        resumen_legacy: null,
      };
      await sb.upsert("datos_mes", payload, "mes");
      if (salarios.length > 0) {
        await sb.upsert("config", { key: "salarios_template", value: salarios }, "key");
      }
      await onReload();
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  const setGF = (k, v) => setGastosFijos(p => ({ ...p, [k]: pn(v) }));
  const setPQ = (k, v) => setPaqueteria(p => ({ ...p, [k]: pn(v) }));
  const facturasMonth = facturas.filter(f => f.fecha.startsWith(selMonth));
  const totalFacturas = facturasMonth.reduce((s, f) => s + parseFloat(f.importe), 0);

  return (
    <div style={{ padding: "20px", maxWidth: 540, margin: "0 auto", paddingBottom: "60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ fontFamily: SF, fontSize: "20px", color: C.char, margin: 0 }}>Datos del mes</h2>
        <select value={selMonth} onChange={e => setSelMonth(e.target.value)} style={{ ...inp, width: "auto", padding: "8px 12px", fontSize: "13px" }}>
          {allMonths.map(m => <option key={m} value={m}>{mkLabel(m)}{monthlyData[m]?.resumen_legacy ? " (resumen)" : ""}</option>)}
        </select>
      </div>

      {isSummary && (
        <div style={{ ...crd, border: `2px solid ${C.gold}`, background: "#FFFBF0", marginBottom: "20px" }}>
          <div style={{ fontFamily: F, fontSize: "13px", color: C.char, lineHeight: 1.5 }}>
            Mes con datos resumidos (ingresos: {fmt(md.resumen_legacy.ingresos)}, gastos: {fmt(md.resumen_legacy.gastos)}). Rellena el desglose abajo si quieres más detalle.
          </div>
        </div>
      )}

      <Sec title="Facturas proveedores" sub="Registradas por trabajadoras" />
      <div style={crd}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: F, fontSize: "14px", color: C.char }}>{facturasMonth.length} facturas</span>
          <span style={{ fontFamily: F, fontSize: "16px", fontWeight: 700, color: C.char }}>{fmt2(totalFacturas)}</span>
        </div>
      </div>

      <Sec title="Ingresos" />
      <div style={crd}>
        <label style={lbl}>Ventas EPOS (€)</label>
        <input type="number" inputMode="decimal" value={ventas} onChange={e => setVentas(e.target.value)} placeholder="50349" style={{ ...inp, marginBottom: "16px" }} />
        <label style={lbl}>Paquetería</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {PAQUETERIA.map(p => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: F, fontSize: "12px", color: C.mut, minWidth: "65px" }}>{p}</span>
              <input type="number" inputMode="decimal" value={paqueteria[p] || ""} onChange={e => setPQ(p, e.target.value)} placeholder="0" style={{ ...inp, padding: "8px 10px", fontSize: "13px", marginBottom: 0 }} />
            </div>
          ))}
        </div>
      </div>

      <Sec title="Salarios" />
      <div style={crd}>
        {salarios.map(s => (
          <div key={s.id} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
            <input value={s.nombre} onChange={e => setSalarios(p => p.map(x => x.id === s.id ? { ...x, nombre: e.target.value } : x))} placeholder="Nombre" style={{ ...inp, flex: 1, padding: "8px 10px", fontSize: "13px", marginBottom: 0 }} />
            <input type="number" inputMode="decimal" value={s.amount || ""} onChange={e => setSalarios(p => p.map(x => x.id === s.id ? { ...x, amount: pn(e.target.value) } : x))} placeholder="0" style={{ ...inp, width: "100px", padding: "8px 10px", fontSize: "13px", marginBottom: 0, textAlign: "right" }} />
            <button onClick={() => setSalarios(p => p.filter(x => x.id !== s.id))} style={{ border: "none", background: "none", color: "#ccc", fontSize: "18px", cursor: "pointer" }}>×</button>
          </div>
        ))}
        <button onClick={() => setSalarios(p => [...p, { id: uid(), nombre: "", amount: 0 }])} style={{ border: `1.5px dashed ${C.brd}`, background: "none", fontFamily: F, fontSize: "12px", color: C.mut, padding: "10px", borderRadius: "8px", width: "100%", cursor: "pointer" }}>+ Añadir salario</button>
      </div>

      <Sec title="Gastos fijos" />
      <div style={crd}>
        {GASTOS_FIJOS_TPL.map(g => (
          <div key={g.key} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <span style={{ fontFamily: F, fontSize: "13px", color: C.char, flex: 1 }}>{g.label}</span>
            <input type="number" inputMode="decimal" value={gastosFijos[g.key] || ""} onChange={e => setGF(g.key, e.target.value)} placeholder="0" style={{ ...inp, width: "110px", padding: "8px 10px", fontSize: "13px", marginBottom: 0, textAlign: "right" }} />
          </div>
        ))}
      </div>

      <Sec title="Otros gastos operativos" />
      <div style={crd}>
        {otrosGastos.map(o => (
          <div key={o.id} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
            <input value={o.concepto} onChange={e => setOtrosGastos(p => p.map(x => x.id === o.id ? { ...x, concepto: e.target.value } : x))} placeholder="Concepto" style={{ ...inp, flex: 1, padding: "8px 10px", fontSize: "13px", marginBottom: 0 }} />
            <input type="number" inputMode="decimal" value={o.amount || ""} onChange={e => setOtrosGastos(p => p.map(x => x.id === o.id ? { ...x, amount: pn(e.target.value) } : x))} placeholder="0" style={{ ...inp, width: "100px", padding: "8px 10px", fontSize: "13px", marginBottom: 0, textAlign: "right" }} />
            <button onClick={() => setOtrosGastos(p => p.filter(x => x.id !== o.id))} style={{ border: "none", background: "none", color: "#ccc", fontSize: "18px", cursor: "pointer" }}>×</button>
          </div>
        ))}
        <button onClick={() => setOtrosGastos(p => [...p, { id: uid(), concepto: "", amount: 0 }])} style={{ border: `1.5px dashed ${C.brd}`, background: "none", fontFamily: F, fontSize: "12px", color: C.mut, padding: "10px", borderRadius: "8px", width: "100%", cursor: "pointer" }}>+ Añadir gasto</button>
      </div>

      <div style={{ marginTop: "28px", padding: "16px 0", borderTop: `2px solid ${C.gold}` }}>
        <div style={{ fontFamily: F, fontSize: "10px", fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>Movimientos de tesorería (no afectan al resultado)</div>
        <Sec title="Inversiones" />
        <div style={crd}>
          {inversiones.map(i => (
            <div key={i.id} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
              <input value={i.concepto} onChange={e => setInversiones(p => p.map(x => x.id === i.id ? { ...x, concepto: e.target.value } : x))} placeholder="Ej: Congelador" style={{ ...inp, flex: 1, padding: "8px 10px", fontSize: "13px", marginBottom: 0 }} />
              <input type="number" inputMode="decimal" value={i.amount || ""} onChange={e => setInversiones(p => p.map(x => x.id === i.id ? { ...x, amount: pn(e.target.value) } : x))} placeholder="0" style={{ ...inp, width: "100px", padding: "8px 10px", fontSize: "13px", marginBottom: 0, textAlign: "right" }} />
              <button onClick={() => setInversiones(p => p.filter(x => x.id !== i.id))} style={{ border: "none", background: "none", color: "#ccc", fontSize: "18px", cursor: "pointer" }}>×</button>
            </div>
          ))}
          <button onClick={() => setInversiones(p => [...p, { id: uid(), concepto: "", amount: 0 }])} style={{ border: `1.5px dashed ${C.brd}`, background: "none", fontFamily: F, fontSize: "12px", color: C.mut, padding: "10px", borderRadius: "8px", width: "100%", cursor: "pointer" }}>+ Añadir inversión</button>
        </div>
        <Sec title="Reparto a socios" />
        <div style={crd}><input type="number" inputMode="decimal" value={repartoSocios} onChange={e => setRepartoSocios(e.target.value)} placeholder="0" style={{ ...inp, marginBottom: 0 }} /></div>
      </div>

      <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "16px", border: "none", borderRadius: "12px", background: saving ? "#D8D0C4" : C.char, color: saving ? "#A09888" : C.gold, fontFamily: SF, fontSize: "16px", cursor: saving ? "default" : "pointer", marginTop: "8px", marginBottom: "40px", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
        {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar datos del mes"}
      </button>
    </div>
  );
}

function Sec({ title, sub }) {
  return (
    <div style={{ marginTop: "18px", marginBottom: "8px" }}>
      <div style={{ fontFamily: SF, fontSize: "15px", color: C.char }}>{title}</div>
      {sub && <div style={{ fontFamily: F, fontSize: "11px", color: C.mut, marginTop: "1px" }}>{sub}</div>}
    </div>
  );
}

/* ─── P&L ─── */
function PLView({ facturas, monthlyData }) {
  const months = Object.keys(monthlyData).sort().reverse();
  if (!months.length) return <div style={{ textAlign: "center", padding: "60px 20px", color: C.mut, fontFamily: F }}>No hay datos</div>;
  return (
    <div style={{ padding: "20px", maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontFamily: SF, fontSize: "20px", color: C.char, marginBottom: "4px" }}>Cuenta de resultados</h2>
      <p style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginBottom: "20px" }}>Solo operaciones. Inversiones y repartos no aparecen aquí.</p>
      {months.map(mk => {
        const c = calcMonth(facturas, monthlyData[mk], mk);
        return (
          <div key={mk} style={{ ...crd, marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontFamily: SF, fontSize: "16px", color: C.char }}>{mkLabel(mk)}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: F, fontSize: "18px", fontWeight: 700, color: c.resultado >= 0 ? C.grn : C.red }}>{fmt(c.resultado)}</div>
                <div style={{ fontFamily: F, fontSize: "11px", color: C.mut }}>Margen {c.margen.toFixed(1)}%</div>
              </div>
            </div>
            <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", marginBottom: "12px", background: "#f0ebe3" }}>
              {c.totalIngresos > 0 && <div style={{ width: `${Math.min((c.totalGastos / c.totalIngresos) * 100, 100)}%`, background: C.red, borderRadius: "3px 0 0 3px" }} />}
              {c.resultado > 0 && <div style={{ flex: 1, background: C.grn, borderRadius: "0 3px 3px 0" }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── TESORERÍA ─── */
function TesoreriaView({ facturas, monthlyData, config, onReload }) {
  const { ask, Dialog } = useConfirm();
  const months = Object.keys(monthlyData).sort();
  const saldoInicial = config.saldo_inicial;

  if (!saldoInicial) return <SaldoSetup onReload={onReload} />;

  let saldo = parseFloat(saldoInicial.amount);
  const rows = months.map(mk => {
    const c = calcMonth(facturas, monthlyData[mk], mk);
    const netoCaja = c.resultado - c.totalInversiones - c.reparto;
    saldo += netoCaja;
    return { mk, ...c, netoCaja, saldo };
  });
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;

  const handleReset = async () => {
    try { await sb.delete("config", `key=eq.saldo_inicial`); await onReload(); }
    catch (e) { alert("Error: " + e.message); }
  };

  return (
    <div style={{ padding: "20px", maxWidth: 600, margin: "0 auto" }}>
      <Dialog />
      <h2 style={{ fontFamily: SF, fontSize: "20px", color: C.char, marginBottom: "4px" }}>Tesorería</h2>
      <p style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginBottom: "20px" }}>Dinero real: operaciones + inversiones + socios</p>
      <div style={{ background: `linear-gradient(135deg, ${C.char} 0%, #3D3D3D 100%)`, borderRadius: "16px", padding: "24px", marginBottom: "20px", color: "#fff" }}>
        <div style={{ fontFamily: F, fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "4px" }}>Saldo estimado</div>
        <div style={{ fontFamily: SF, fontSize: "36px", color: C.gold }}>{fmt(latest ? latest.saldo : saldoInicial.amount)}</div>
        <div style={{ fontFamily: F, fontSize: "11px", color: "#666", marginTop: "8px" }}>Inicio: {fmt(saldoInicial.amount)} · {saldoInicial.fecha || ""}</div>
      </div>
      {[...rows].reverse().map(r => (
        <div key={r.mk} style={crd}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontFamily: SF, fontSize: "15px", color: C.char }}>{mkLabel(r.mk)}</span>
            <span style={{ fontFamily: F, fontSize: "15px", fontWeight: 700, color: r.netoCaja >= 0 ? C.grn : C.red }}>{r.netoCaja >= 0 ? "+" : ""}{fmt(r.netoCaja)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <Mini label="Resultado op." val={r.resultado} color={C.grn} />
            <Mini label="Inversiones" val={r.totalInversiones} color={C.blu} />
            <Mini label="Socios" val={r.reparto} color={C.pur} />
            <Mini label="Saldo acum." val={r.saldo} color={C.char} />
          </div>
        </div>
      ))}
      <button onClick={() => ask("¿Reiniciar el saldo inicial?", handleReset)} style={{ display: "block", margin: "24px auto", padding: "8px 20px", border: `1px solid ${C.brd}`, borderRadius: "8px", background: "none", color: C.mut, fontFamily: F, fontSize: "11px", cursor: "pointer" }}>Reiniciar saldo inicial</button>
    </div>
  );
}

function SaldoSetup({ onReload }) {
  const [amount, setAmount] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const v = pn(amount);
    if (v < 0) return;
    setSaving(true);
    try {
      await sb.upsert("config", { key: "saldo_inicial", value: { amount: v, fecha } }, "key");
      await onReload();
    } catch (e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  return (
    <div style={{ padding: "20px", maxWidth: 460, margin: "0 auto" }}>
      <h2 style={{ fontFamily: SF, fontSize: "20px", color: C.char, marginBottom: "20px" }}>Tesorería</h2>
      <div style={{ ...crd, border: `2px solid ${C.gold}`, padding: "24px" }}>
        <div style={{ fontFamily: F, fontSize: "15px", fontWeight: 600, color: C.char, marginBottom: "6px" }}>Punto de partida</div>
        <p style={{ fontFamily: F, fontSize: "13px", color: C.mut, lineHeight: 1.5, marginBottom: "20px" }}>Contad todo el dinero del negocio (sobres + banco). Solo se hace una vez.</p>
        <label style={lbl}>Fecha</label>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, marginBottom: "14px" }} />
        <label style={lbl}>Dinero total (€)</label>
        <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="15000" style={{ ...inp, marginBottom: "20px" }} />
        <button onClick={handleSave} disabled={!amount || saving} style={{ width: "100%", padding: "14px", border: "none", borderRadius: "10px", background: (!amount || saving) ? "#D8D0C4" : C.char, color: (!amount || saving) ? "#A09888" : C.gold, fontFamily: SF, fontSize: "15px", cursor: (!amount || saving) ? "default" : "pointer" }}>{saving ? "Guardando..." : "Fijar punto de partida"}</button>
      </div>
    </div>
  );
}

function Mini({ label, val, color }) {
  return (
    <div style={{ background: C.cream, borderRadius: "8px", padding: "10px 12px" }}>
      <div style={{ fontFamily: F, fontSize: "10px", color: C.mut, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontFamily: F, fontSize: "14px", fontWeight: 700, color: val === 0 ? "#ccc" : color }}>{fmt(val)}</div>
    </div>
  );
}

/* ═════════════════ MAIN APP ═════════════════ */
export default function RecaoApp() {
  const [role, setRole] = useState(null);
  const [pendingOwner, setPendingOwner] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const { facturas, monthlyData, proveedores, config, loading, error, reload } = useRecaoData();

  const tryLogin = () => {
    if (pwInput === OWNER_PASSWORD) { setRole("dueno"); setPendingOwner(false); setPwInput(""); setPwError(false); }
    else { setPwError(true); setTimeout(() => setPwError(false), 600); }
  };

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: SF, color: C.char, background: C.cream }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      <div style={{ fontSize: "32px", marginBottom: "8px" }}>Recao</div>
      <div style={{ fontFamily: F, fontSize: "12px", color: C.mut }}>Cargando datos...</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: F, color: C.red }}>
      Error de conexión: {error}
      <br /><button onClick={reload} style={{ marginTop: "16px", padding: "10px 20px", border: "none", borderRadius: "8px", background: C.char, color: C.gold, cursor: "pointer", fontFamily: F }}>Reintentar</button>
    </div>
  );

  if (pendingOwner) return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      <div style={{ fontFamily: SF, fontSize: "32px", color: C.char, marginBottom: "4px" }}>Recao</div>
      <div style={{ fontFamily: F, fontSize: "11px", color: C.mut, marginBottom: "40px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Acceso dueño</div>
      <div style={{ width: "300px" }}>
        <input type="password" autoFocus value={pwInput} onChange={e => setPwInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") tryLogin(); }} placeholder="Contraseña" style={{ ...inp, marginBottom: "12px", textAlign: "center", letterSpacing: "0.1em", border: pwError ? `2px solid ${C.red}` : `1.5px solid ${C.brd}`, animation: pwError ? "shake 0.4s" : "none" }} />
        <style>{`@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }`}</style>
        <button onClick={tryLogin} style={{ width: "100%", padding: "14px", border: "none", borderRadius: "10px", background: C.char, color: C.gold, fontFamily: SF, fontSize: "15px", cursor: "pointer", marginBottom: "10px" }}>Entrar</button>
        <button onClick={() => { setPendingOwner(false); setPwInput(""); }} style={{ width: "100%", padding: "10px", border: "none", background: "none", color: C.mut, fontFamily: F, fontSize: "12px", cursor: "pointer" }}>← Volver</button>
      </div>
    </div>
  );

  if (!role) return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      <div style={{ fontFamily: SF, fontSize: "36px", color: C.char, marginBottom: "4px" }}>Recao</div>
      <div style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginBottom: "48px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Control financiero</div>
      <button onClick={() => setRole("trabajadora")} style={{ width: "300px", padding: "22px 24px", border: `1.5px solid ${C.brd}`, borderRadius: "14px", background: "#fff", fontFamily: F, fontSize: "16px", fontWeight: 600, color: C.char, cursor: "pointer", marginBottom: "12px", textAlign: "left" }}>
        Trabajadora<div style={{ fontSize: "12px", fontWeight: 400, color: C.mut, marginTop: "4px" }}>Registrar facturas de proveedores</div>
      </button>
      <button onClick={() => setPendingOwner(true)} style={{ width: "300px", padding: "22px 24px", border: `2px solid ${C.gold}`, borderRadius: "14px", background: "#fff", fontFamily: F, fontSize: "16px", fontWeight: 600, color: C.char, cursor: "pointer", textAlign: "left" }}>
        Dueño<div style={{ fontSize: "12px", fontWeight: 400, color: C.mut, marginTop: "4px" }}>Panel completo de gestión</div>
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.cream }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      <div style={{ background: C.char, padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ fontFamily: SF, fontSize: "18px", color: C.gold }}>Recao</div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontFamily: F, fontSize: "11px", color: "#777", textTransform: "uppercase", letterSpacing: "0.08em" }}>{role === "trabajadora" ? "Trabajadora" : "Dueño"}</span>
          <button onClick={() => setRole(null)} style={{ border: `1px solid #555`, borderRadius: "6px", background: "none", color: "#777", fontFamily: F, fontSize: "10px", padding: "4px 10px", cursor: "pointer" }}>Salir</button>
        </div>
      </div>
      {role === "trabajadora" && <WorkerView facturas={facturas} proveedores={proveedores} onReload={reload} />}
      {role === "dueno" && <OwnerView facturas={facturas} monthlyData={monthlyData} proveedores={proveedores} config={config} onReload={reload} />}
    </div>
  );
}
