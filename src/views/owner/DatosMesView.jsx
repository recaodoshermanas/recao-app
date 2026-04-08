import { useState, useEffect } from "react";
import { F, SF, C, inp, lbl, crd } from "../../lib/styles.js";
import { fmt, fmt2, mkLabel, uid, pn, currentMK } from "../../lib/utils.js";
import { PAQUETERIA, GASTOS_FIJOS_TPL } from "../../lib/constants.js";
import { sb } from "../../lib/supabase.js";
import { Sec } from "../../components/Sec.jsx";

export function DatosMesView({ facturas, monthlyData, config, onReload, initialMonth }) {
  const allMonths = [...new Set([...Object.keys(monthlyData), currentMK])].sort().reverse();
  const [selMonth, setSelMonth] = useState(() => initialMonth || Object.keys(monthlyData).sort().reverse()[0] || currentMK);

  useEffect(() => { if (initialMonth) setSelMonth(initialMonth); }, [initialMonth]);

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
