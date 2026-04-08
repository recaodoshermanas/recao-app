import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Area, AreaChart } from "recharts";
import { F, SF, C, crd } from "../../lib/styles";
import { fmt, mkShort, calcMonth } from "../../lib/utils";

export function EvolucionView({ facturas, monthlyData }) {
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
