import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { F, SF, C, crd, inp } from "../../lib/styles.js";
import { fmt } from "../../lib/utils.js";
import { useEposAnalytics } from "../../hooks/useEposAnalytics.js";
import { MultiSelect } from "../../components/MultiSelect.jsx";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CHART_COLORS = [C.gold, C.grn, C.blu, C.pur, C.red, "#E67E22", "#1ABC9C", "#E84393"];

function getDatePresets() {
  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  const daysAgo = n => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); };
  const monthStart = () => fmt(new Date(today.getFullYear(), today.getMonth(), 1));
  const prevMonthStart = () => fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const prevMonthEnd = () => fmt(new Date(today.getFullYear(), today.getMonth(), 0));
  return [
    { label: "Últimos 7 días", from: daysAgo(6), to: fmt(today) },
    { label: "Últimos 30 días", from: daysAgo(29), to: fmt(today) },
    { label: "Este mes", from: monthStart(), to: fmt(today) },
    { label: "Mes anterior", from: prevMonthStart(), to: prevMonthEnd() },
    { label: "Últimos 90 días", from: daysAgo(89), to: fmt(today) },
    { label: "Todo", from: "2020-01-01", to: fmt(today) },
  ];
}

function SyncBar({ lastSync, syncing, onSync }) {
  const when = lastSync?.synced_at ? new Date(lastSync.synced_at) : null;
  const ago = when ? Math.round((Date.now() - when.getTime()) / 60000) : null;
  const agoStr = ago !== null ? (ago < 60 ? `hace ${ago} min` : ago < 1440 ? `hace ${Math.round(ago / 60)}h` : `hace ${Math.round(ago / 1440)}d`) : "nunca";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: C.char, borderRadius: "12px", marginBottom: "16px" }}>
      <div style={{ fontFamily: F, fontSize: "12px", color: "#aaa" }}>
        {lastSync?.status === "success" ? "✓" : "⚠"} Última sync: <span style={{ color: C.gold, fontWeight: 600 }}>{agoStr}</span>
        {lastSync?.products_synced ? ` · ${lastSync.products_synced} productos · ${lastSync.transactions_synced} transacciones` : ""}
      </div>
      <button onClick={onSync} disabled={syncing} style={{ padding: "6px 16px", border: "none", borderRadius: "8px", background: syncing ? C.mut : C.gold, color: C.char, fontFamily: F, fontSize: "12px", fontWeight: 700, cursor: syncing ? "wait" : "pointer" }}>
        {syncing ? "Sincronizando..." : "⟳ Actualizar"}
      </button>
    </div>
  );
}

function KPICard({ label, value, sub, icon }) {
  return (
    <div style={{ ...crd, flex: 1, minWidth: "130px", padding: "14px 16px", textAlign: "center" }}>
      <div style={{ fontSize: "18px", marginBottom: "4px" }}>{icon}</div>
      <div style={{ fontFamily: SF, fontSize: "22px", color: C.char, marginBottom: "2px" }}>{value}</div>
      <div style={{ fontFamily: F, fontSize: "10px", fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      {sub && <div style={{ fontFamily: F, fontSize: "11px", color: sub.startsWith("+") ? C.grn : sub.startsWith("-") ? C.red : C.mut, marginTop: "4px", fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function Heatmap({ data }) {
  if (!data || data.length === 0) return null;
  const grid = {};
  let maxVal = 0;
  data.forEach(r => {
    const d = new Date(r.date + "T12:00:00");
    const dow = (d.getDay() + 6) % 7;
    const key = `${dow}-${r.hour}`;
    grid[key] = (grid[key] || 0) + r.total_amount;
    if (grid[key] > maxVal) maxVal = grid[key];
  });

  const hours = [];
  for (let h = 7; h <= 23; h++) hours.push(h);
  const cellH = 28;

  return (
    <div style={{ ...crd, padding: "16px" }}>
      <div style={{ fontFamily: F, fontSize: "12px", fontWeight: 700, color: C.char, marginBottom: "12px" }}>Mapa de calor · Ventas por hora y día</div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: "320px" }}>
          <div style={{ display: "flex", marginBottom: "4px", paddingLeft: "32px" }}>
            {DIAS.map(d => (
              <div key={d} style={{ flex: 1, textAlign: "center", fontFamily: F, fontSize: "10px", fontWeight: 700, color: C.mut }}>{d}</div>
            ))}
          </div>
          {hours.map(h => (
            <div key={h} style={{ display: "flex", alignItems: "center", marginBottom: "2px" }}>
              <div style={{ width: "32px", fontFamily: F, fontSize: "10px", color: C.mut, textAlign: "right", paddingRight: "6px" }}>{h}:00</div>
              {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                const val = grid[`${dow}-${h}`] || 0;
                const intensity = maxVal > 0 ? val / maxVal : 0;
                const bg = intensity === 0 ? "#F5F0E8" : `rgba(241, 190, 73, ${0.15 + intensity * 0.85})`;
                return (
                  <div key={dow} style={{ flex: 1, height: `${cellH}px`, margin: "1px", borderRadius: "4px", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }} title={`${DIAS[dow]} ${h}:00 — ${fmt(val)}`}>
                    {intensity > 0.3 && <span style={{ fontFamily: F, fontSize: "9px", fontWeight: 600, color: intensity > 0.6 ? C.char : C.mut }}>{val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Ranking({ data, metric = "total_amount" }) {
  if (!data || data.length === 0) return null;
  const sorted = [...data].sort((a, b) => b[metric] - a[metric]).slice(0, 15);
  const maxVal = sorted[0]?.[metric] || 1;

  return (
    <div style={{ ...crd, padding: "16px" }}>
      <div style={{ fontFamily: F, fontSize: "12px", fontWeight: 700, color: C.char, marginBottom: "12px" }}>Ranking de productos</div>
      {sorted.map((item, i) => (
        <div key={item.name + i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <div style={{ width: "22px", fontFamily: F, fontSize: "11px", fontWeight: 700, color: C.mut, textAlign: "right" }}>{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ fontFamily: F, fontSize: "12px", color: C.char, fontWeight: 500 }}>{item.name}</span>
              <span style={{ fontFamily: F, fontSize: "12px", color: C.char, fontWeight: 700 }}>{fmt(item.total_amount)}</span>
            </div>
            <div style={{ height: "6px", background: "#F0EBE2", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(item[metric] / maxVal * 100)}%`, background: `linear-gradient(90deg, ${C.gold}, #E6A817)`, borderRadius: "3px" }} />
            </div>
            <div style={{ fontFamily: F, fontSize: "10px", color: C.mut, marginTop: "2px" }}>{item.quantity?.toFixed(0)} uds · {item.category_name || "—"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.brd}`, borderRadius: "8px", padding: "10px 14px", fontFamily: F, fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight: 700, marginBottom: "4px", color: C.char }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.char, marginBottom: "2px" }}>
          {p.name === "total" ? "Facturación" : p.name}: {typeof p.value === "number" ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

export function AnalyticaView() {
  const { products, categories, suppliers, dailySales, hourlySales, lastSync, loading, syncing, error, sync } = useEposAnalytics();

  const [selProducts, setSelProducts] = useState([]);
  const [selCategories, setSelCategories] = useState([]);
  const [selSuppliers, setSelSuppliers] = useState([]);
  const presets = getDatePresets();
  const [datePreset, setDatePreset] = useState(2);
  const [dateFrom, setDateFrom] = useState(presets[2].from);
  const [dateTo, setDateTo] = useState(presets[2].to);
  const [granularity, setGranularity] = useState("day");
  const [rankMetric, setRankMetric] = useState("total_amount");

  const applyPreset = (idx) => {
    setDatePreset(idx);
    setDateFrom(presets[idx].from);
    setDateTo(presets[idx].to);
  };

  const productOpts = useMemo(() => products.map(p => ({ value: p.id, label: p.name })), [products]);
  const categoryOpts = useMemo(() => categories.map(c => ({ value: c.id, label: c.name })), [categories]);
  const supplierOpts = useMemo(() => suppliers.map(s => ({ value: s.id, label: s.name })), [suppliers]);

  const filteredDaily = useMemo(() => {
    return dailySales.filter(r => {
      if (r.date < dateFrom || r.date > dateTo) return false;
      if (selProducts.length > 0 && !selProducts.includes(r.product_id)) return false;
      if (selCategories.length > 0 && !selCategories.includes(r.category_id)) return false;
      if (selSuppliers.length > 0 && !selSuppliers.includes(r.supplier_id)) return false;
      return true;
    });
  }, [dailySales, dateFrom, dateTo, selProducts, selCategories, selSuppliers]);

  const filteredHourly = useMemo(() => {
    return hourlySales.filter(r => r.date >= dateFrom && r.date <= dateTo);
  }, [hourlySales, dateFrom, dateTo]);

  const kpis = useMemo(() => {
    const totalRevenue = filteredDaily.reduce((s, r) => s + parseFloat(r.total_amount), 0);
    const totalUnits = filteredDaily.reduce((s, r) => s + parseFloat(r.quantity), 0);
    const totalCost = filteredDaily.reduce((s, r) => s + parseFloat(r.cost_total || 0), 0);
    const totalTx = filteredDaily.reduce((s, r) => s + (r.transaction_count || 0), 0);
    const ticketMedio = totalTx > 0 ? totalRevenue / totalTx : 0;
    const margen = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0;

    const daysDiff = Math.max(1, Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1);
    const prevTo = new Date(dateFrom);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - daysDiff + 1);
    const prevFromStr = prevFrom.toISOString().slice(0, 10);
    const prevToStr = prevTo.toISOString().slice(0, 10);
    const prevData = dailySales.filter(r => {
      if (r.date < prevFromStr || r.date > prevToStr) return false;
      if (selProducts.length > 0 && !selProducts.includes(r.product_id)) return false;
      if (selCategories.length > 0 && !selCategories.includes(r.category_id)) return false;
      if (selSuppliers.length > 0 && !selSuppliers.includes(r.supplier_id)) return false;
      return true;
    });
    const prevRevenue = prevData.reduce((s, r) => s + parseFloat(r.total_amount), 0);
    const revChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : null;

    return { totalRevenue, totalUnits, totalTx, ticketMedio, margen, totalCost, revChange };
  }, [filteredDaily, dailySales, dateFrom, dateTo, selProducts, selCategories, selSuppliers]);

  const evolutionData = useMemo(() => {
    const grouped = {};
    filteredDaily.forEach(r => {
      let key = r.date;
      if (granularity === "week") {
        const d = new Date(r.date + "T12:00:00");
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day + 1);
        key = d.toISOString().slice(0, 10);
      }
      if (!grouped[key]) grouped[key] = { date: key, total: 0, units: 0 };
      grouped[key].total += parseFloat(r.total_amount);
      grouped[key].units += parseFloat(r.quantity);
    });

    if (selProducts.length > 0 && selProducts.length <= 6) {
      filteredDaily.forEach(r => {
        if (!selProducts.includes(r.product_id)) return;
        let key = r.date;
        if (granularity === "week") {
          const d = new Date(r.date + "T12:00:00");
          const day = d.getDay() || 7;
          d.setDate(d.getDate() - day + 1);
          key = d.toISOString().slice(0, 10);
        }
        if (!grouped[key]) grouped[key] = { date: key, total: 0, units: 0 };
        const pName = r.product_name?.slice(0, 20) || `P${r.product_id}`;
        grouped[key][pName] = (grouped[key][pName] || 0) + parseFloat(r.total_amount);
      });
    }

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      label: d.date.slice(5),
    }));
  }, [filteredDaily, granularity, selProducts]);

  const productLines = useMemo(() => {
    if (selProducts.length === 0 || selProducts.length > 6) return [];
    const names = new Set();
    filteredDaily.forEach(r => {
      if (selProducts.includes(r.product_id)) {
        names.add(r.product_name?.slice(0, 20) || `P${r.product_id}`);
      }
    });
    return Array.from(names);
  }, [filteredDaily, selProducts]);

  const rankingData = useMemo(() => {
    const grouped = {};
    filteredDaily.forEach(r => {
      const key = r.product_id;
      if (!grouped[key]) grouped[key] = { name: r.product_name, category_name: r.category_name, total_amount: 0, quantity: 0 };
      grouped[key].total_amount += parseFloat(r.total_amount);
      grouped[key].quantity += parseFloat(r.quantity);
    });
    return Object.values(grouped);
  }, [filteredDaily]);

  if (loading) return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: F, fontSize: "14px", color: C.mut }}>Cargando analítica...</div>
    </div>
  );

  const hasData = dailySales.length > 0;

  return (
    <div style={{ padding: "20px", maxWidth: 640, margin: "0 auto" }}>
      <h2 style={{ fontFamily: SF, fontSize: "20px", color: C.char, marginBottom: "4px" }}>Analítica EPOS</h2>
      <p style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginBottom: "16px" }}>Ventas por producto, categoría y proveedor</p>

      {error && <div style={{ ...crd, padding: "12px 16px", borderColor: C.red, marginBottom: "12px", fontFamily: F, fontSize: "12px", color: C.red }}>{error}</div>}

      <SyncBar lastSync={lastSync} syncing={syncing} onSync={sync} />

      {!hasData ? (
        <div style={{ ...crd, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📊</div>
          <div style={{ fontFamily: SF, fontSize: "16px", color: C.char, marginBottom: "8px" }}>Sin datos todavía</div>
          <div style={{ fontFamily: F, fontSize: "13px", color: C.mut, marginBottom: "16px" }}>Pulsa "Actualizar" para sincronizar con EPOS Now por primera vez</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
            {presets.map((p, i) => (
              <button key={i} onClick={() => applyPreset(i)} style={{ padding: "5px 12px", borderRadius: "20px", border: `1.5px solid ${datePreset === i ? C.gold : C.brd}`, background: datePreset === i ? C.gold : "#fff", color: datePreset === i ? C.char : C.mut, fontFamily: F, fontSize: "11px", fontWeight: datePreset === i ? 700 : 500, cursor: "pointer" }}>
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDatePreset(-1); }} style={{ ...inp, padding: "6px 10px", fontSize: "12px", flex: 1 }} />
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDatePreset(-1); }} style={{ ...inp, padding: "6px 10px", fontSize: "12px", flex: 1 }} />
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
            <MultiSelect label="Producto" options={productOpts} selected={selProducts} onChange={setSelProducts} />
            <MultiSelect label="Categoría" options={categoryOpts} selected={selCategories} onChange={setSelCategories} />
            <MultiSelect label="Proveedor" options={supplierOpts} selected={selSuppliers} onChange={setSelSuppliers} />
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <KPICard label="Facturación" value={fmt(kpis.totalRevenue)} icon="💰" sub={kpis.revChange ? `${kpis.revChange > 0 ? "+" : ""}${kpis.revChange}% vs anterior` : null} />
            <KPICard label="Unidades" value={kpis.totalUnits.toFixed(0)} icon="📦" />
            <KPICard label="Transacciones" value={kpis.totalTx.toLocaleString("es-ES")} icon="🧾" />
            <KPICard label="Ticket medio" value={fmt(kpis.ticketMedio)} icon="🎟️" />
          </div>

          {kpis.totalCost > 0 && (
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <KPICard label="Coste total" value={fmt(kpis.totalCost)} icon="📉" />
              <KPICard label="Margen" value={`${kpis.margen.toFixed(1)}%`} icon="📊" sub={kpis.margen > 30 ? "Saludable" : kpis.margen > 15 ? "Ajustado" : "Bajo"} />
            </div>
          )}

          <div style={{ ...crd, padding: "16px 8px 8px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", marginLeft: "16px" }}>
              <div style={{ fontFamily: F, fontSize: "12px", fontWeight: 700, color: C.char }}>Evolución de ventas</div>
              <div style={{ display: "flex", gap: "4px" }}>
                {["day", "week"].map(g => (
                  <button key={g} onClick={() => setGranularity(g)} style={{ padding: "3px 10px", borderRadius: "12px", border: `1px solid ${granularity === g ? C.gold : C.brd}`, background: granularity === g ? C.gold : "transparent", color: granularity === g ? C.char : C.mut, fontFamily: F, fontSize: "10px", fontWeight: 600, cursor: "pointer" }}>
                    {g === "day" ? "Día" : "Semana"}
                  </button>
                ))}
              </div>
            </div>
            {evolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.mut }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(evolutionData.length / 10))} />
                  <YAxis tick={{ fontSize: 10, fill: C.mut }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  {productLines.length === 0 ? (
                    <Line type="monotone" dataKey="total" name="Facturación" stroke={C.gold} strokeWidth={2.5} dot={evolutionData.length < 40 ? { r: 3, fill: C.gold } : false} />
                  ) : (
                    productLines.map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name} name={name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={evolutionData.length < 30 ? { r: 2.5 } : false} />
                    ))
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", fontFamily: F, fontSize: "12px", color: C.mut }}>Sin datos en este rango</div>
            )}
          </div>

          <Heatmap data={filteredHourly} />

          <div style={{ display: "flex", gap: "4px", marginBottom: "8px", marginTop: "4px" }}>
            {[{ k: "total_amount", l: "Por facturación" }, { k: "quantity", l: "Por unidades" }].map(m => (
              <button key={m.k} onClick={() => setRankMetric(m.k)} style={{ padding: "4px 12px", borderRadius: "12px", border: `1px solid ${rankMetric === m.k ? C.gold : C.brd}`, background: rankMetric === m.k ? C.gold : "transparent", color: rankMetric === m.k ? C.char : C.mut, fontFamily: F, fontSize: "10px", fontWeight: 600, cursor: "pointer" }}>
                {m.l}
              </button>
            ))}
          </div>
          <Ranking data={rankingData} metric={rankMetric} />
        </>
      )}
    </div>
  );
}
