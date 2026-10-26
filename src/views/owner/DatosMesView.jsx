import { useState, useEffect, useRef } from "react";
import { F, SF, C, inp, lbl, crd } from "../../lib/styles.js";
import { fmt, fmt2, mkLabel, uid, pn, currentMK } from "../../lib/utils.js";
import { PAQUETERIA } from "../../lib/constants.js";
import { sb } from "../../lib/supabase.js";
import { Sec } from "../../components/Sec.jsx";
import { AperturaSobres, DescuadreSobres, useSobres } from "./AperturaSobres.jsx"; // SOBRES (#13)
import { EposCierres } from "./EposCierres.jsx"; // #15
import { SalariosMes } from "./SalariosMes.jsx"; // #18
import { StockCierre } from "./StockCierre.jsx"; // #61
import { GastosFijos } from "./GastosFijos.jsx"; // #28

export function DatosMesView({ facturas, monthlyData, config, onReload, initialMonth }) {
  const allMonths = [...new Set([...Object.keys(monthlyData), currentMK])].sort().reverse();
  const [selMonth, setSelMonth] = useState(() => initialMonth || Object.keys(monthlyData).sort().reverse()[0] || currentMK);

  useEffect(() => { if (initialMonth) setSelMonth(initialMonth); }, [initialMonth]);

  const md = monthlyData[selMonth] || {};
  const sobres = useSobres(selMonth); // SOBRES (#13): solo lo ven los socios
  const [stockActivo, setStockActivo] = useState(false); // #61
  const isSummary = !!md.resumen_legacy;

  const [ventas, setVentas] = useState("");
  const [paqueteria, setPaqueteria] = useState({});
  const [paqBanco, setPaqBanco] = useState(null); // #43: desde oct-2026 la paquetería sale de BBVA (null = no aplica)
  const [gastosFijos, setGastosFijos] = useState({});
  const [salarios, setSalarios] = useState([]);
  const [otrosGastos, setOtrosGastos] = useState([]);
  const [inversiones, setInversiones] = useState([]);
  const [mantenimiento, setMantenimiento] = useState([]); // #42
  const [repartoSocios, setRepartoSocios] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const gfGuardar = useRef(null); // #28: apunta el origen (banco / a mano) de los gastos fijos al guardar
  const [salNuevo, setSalNuevo] = useState(null); // #18: null cargando · true tarjetas por trabajadora · false lista de antes
  const [salV2, setSalV2] = useState([]);
  useEffect(() => { setSalNuevo(null); }, [selMonth]);

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

  // #43: paquetería desde el banco (BBVA) para los meses desde octubre de 2026
  useEffect(() => {
    let vivo = true;
    setPaqBanco(null);
    if (selMonth < "2026-10") return;
    sb.rpc("paqueteria_mes_detalle", { p_mes: selMonth }).then((r) => {
      if (!vivo || !r?.aplica) return;
      setPaqBanco(r);
      setPaqueteria(r.efectiva || {});
    }).catch(() => {});
    return () => { vivo = false; };
  }, [selMonth, monthlyData]);

  // #42: el mantenimiento del mes sale de Finanzas → Mantenimiento (solo lectura aquí)
  useEffect(() => {
    let vivo = true;
    const [a, m] = selMonth.split("-").map(Number);
    const sig = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
    sb.select("mantenimientos", `select=id,concepto,importe&activo=eq.true&fecha=gte.${selMonth}-01&fecha=lt.${sig}-01&order=fecha.asc`)
      .then((r) => { if (vivo) setMantenimiento((r || []).map((i) => ({ id: String(i.id), concepto: i.concepto, amount: Number(i.importe) }))); }).catch(() => {});
    return () => { vivo = false; };
  }, [selMonth, monthlyData]);

  // #40: las inversiones del mes salen de la tabla «inversiones» (solo lectura aquí)
  useEffect(() => {
    let vivo = true;
    const [a, m] = selMonth.split("-").map(Number);
    const sig = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
    sb.select("inversiones", `select=id,concepto,importe&activo=eq.true&fecha=gte.${selMonth}-01&fecha=lt.${sig}-01&order=fecha.asc`)
      .then((r) => { if (vivo) setInversiones((r || []).map((i) => ({ id: String(i.id), concepto: i.concepto, amount: Number(i.importe) }))); }).catch(() => {});
    return () => { vivo = false; };
  }, [selMonth, monthlyData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        mes: selMonth,
        ventas_epos: pn(ventas),
        paqueteria, gastos_fijos: gastosFijos, salarios: salNuevo ? salV2 : salarios,
        otros_gastos: otrosGastos,
        reparto_socios: pn(repartoSocios),
        resumen_legacy: null,
      };
      if (paqBanco) payload.paqueteria = await sb.rpc("paqueteria_guardar", { p_mes: selMonth, p_valores: paqueteria }); // #43
      await sb.upsert("datos_mes", payload, "mes");
      try { await gfGuardar.current?.(); } catch (e) { alert("Guardado, pero no se ha podido apuntar el origen de los gastos fijos: " + e.message); }
      if (!salNuevo && salarios.length > 0) {
        await sb.upsert("config", { key: "salarios_template", value: salarios }, "key");
      }
      await onReload();
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  const setGF = (k, v) => setGastosFijos(p => ({ ...p, [k]: pn(v) }));
  const setPQ = (k, v) => setPaqueteria(p => ({ ...p, [k]: pn(v) }));
  const paqLista = paqBanco ? [...new Set([...PAQUETERIA.filter(p => p !== "Amazon" || paqueteria.Amazon), ...Object.keys(paqueteria)])] : PAQUETERIA;
  const paqNota = (p) => !paqBanco ? "" : (paqBanco.manual?.[p] != null && Number(paqBanco.manual[p]) !== Number(paqBanco.auto?.[p] ?? NaN)) || (paqBanco.auto?.[p] == null && paqueteria[p] > 0) ? "a mano" : "banco";
  const facturasMonth = facturas.filter(f => f.fecha.startsWith(selMonth));
  const totalFacturas = facturasMonth.reduce((s, f) => s + (Number(f.importe) || 0), 0);

  return (
    <div style={{ padding: "20px", maxWidth: 540, margin: "0 auto", paddingBottom: "60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ fontFamily: SF, fontSize: "20px", color: C.char, margin: 0 }}>Datos del mes</h2>
        <select value={selMonth} onChange={e => setSelMonth(e.target.value)} style={{ ...inp, width: "auto", padding: "8px 12px", fontSize: "13px" }}>
          {allMonths.map(m => <option key={m} value={m}>{mkLabel(m)}{monthlyData[m]?.resumen_legacy ? " (resumen)" : ""}</option>)}
        </select>
      </div>

      <DescuadreSobres datos={sobres.datos} />

      {isSummary && (
        <div style={{ ...crd, border: `2px solid ${C.gold}`, background: "#FFFBF0", marginBottom: "20px" }}>
          <div style={{ fontFamily: F, fontSize: "13px", color: C.char, lineHeight: 1.5 }}>
            Mes con datos resumidos (ingresos: {fmt(md.resumen_legacy.ingresos)}, gastos: {fmt(md.resumen_legacy.gastos)}). Rellena el desglose abajo si quieres más detalle.
          </div>
        </div>
      )}

      {sobres.datos !== false && <Sec title="Efectivo" sub="Los sobres de los cierres de caja" />}
      <AperturaSobres mes={selMonth} datos={sobres.datos} setDatos={sobres.setDatos} />
      {sobres.datos !== false && <EposCierres mes={selMonth} />}

      {stockActivo && <Sec title="Stock" sub="Fotos del stock de Epos valorado a coste (con IVA y recargo)" />}
      <StockCierre mes={selMonth} onActivo={setStockActivo} />

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
        {paqBanco && <div style={{ fontFamily: F, fontSize: "11px", color: C.mut, marginBottom: "8px" }}>Cobros recibidos en BBVA en el mes (del día 1 al último). Si cambias una cifra a mano, se respeta.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {paqLista.map(p => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: F, fontSize: "12px", color: C.mut, minWidth: "65px" }}>{p}{paqBanco && <span style={{ display: "block", fontSize: "9px" }}>{paqNota(p)}</span>}</span>
              <input type="number" inputMode="decimal" value={paqueteria[p] || ""} onChange={e => setPQ(p, e.target.value)} placeholder="0" style={{ ...inp, padding: "8px 10px", fontSize: "13px", marginBottom: 0 }} />
            </div>
          ))}
        </div>
      </div>

      <Sec title="Salarios" />
      <SalariosMes mes={selMonth} guardado={md.salarios} onCambio={setSalV2} onModo={setSalNuevo} />
      {salNuevo === false && <div style={crd}>
        {salarios.map(s => (
          <div key={s.id} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
            <input value={s.nombre} onChange={e => setSalarios(p => p.map(x => x.id === s.id ? { ...x, nombre: e.target.value } : x))} placeholder="Nombre" style={{ ...inp, flex: 1, padding: "8px 10px", fontSize: "13px", marginBottom: 0 }} />
            <input type="number" inputMode="decimal" value={s.amount || ""} onChange={e => setSalarios(p => p.map(x => x.id === s.id ? { ...x, amount: pn(e.target.value) } : x))} placeholder="0" style={{ ...inp, width: "100px", padding: "8px 10px", fontSize: "13px", marginBottom: 0, textAlign: "right" }} />
            <button onClick={() => setSalarios(p => p.filter(x => x.id !== s.id))} style={{ border: "none", background: "none", color: "#ccc", fontSize: "18px", cursor: "pointer" }}>×</button>
          </div>
        ))}
        <button onClick={() => setSalarios(p => [...p, { id: uid(), nombre: "", amount: 0 }])} style={{ border: `1.5px dashed ${C.brd}`, background: "none", fontFamily: F, fontSize: "12px", color: C.mut, padding: "10px", borderRadius: "8px", width: "100%", cursor: "pointer" }}>+ Añadir salario</button>
      </div>}

      <Sec title="Gastos fijos" />
      <div style={crd}>
        <GastosFijos mes={selMonth} valores={gastosFijos} onValores={v => setGastosFijos(p => ({ ...p, ...v }))} guardarRef={gfGuardar} />
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

      <Sec title="Mantenimiento" sub="Solo lectura: se gestiona en Finanzas → Mantenimiento" />
      <div style={crd}>
        {mantenimiento.length === 0 ? <div style={{ fontFamily: F, fontSize: "13px", color: C.mut, marginBottom: "8px" }}>Ninguno este mes.</div> : mantenimiento.map(i => (
          <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "8px", fontFamily: F, fontSize: "13px", color: C.char }}>
            <span>{i.concepto}</span><span style={{ fontWeight: 700 }}>{fmt2(i.amount)}</span>
          </div>
        ))}
        <a href="#/finanzas/mantenimiento" style={{ fontFamily: F, fontSize: "12.5px", fontWeight: 600, color: C.blu }}>Gestionar en Mantenimiento</a>
      </div>

      <div style={{ marginTop: "28px", padding: "16px 0", borderTop: `2px solid ${C.gold}` }}>
        <div style={{ fontFamily: F, fontSize: "10px", fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>Movimientos de tesorería (no afectan al resultado)</div>
        <Sec title="Inversiones" sub="Solo lectura: se gestionan en Finanzas → Inversiones" />
        <div style={crd}>
          {inversiones.length === 0 ? <div style={{ fontFamily: F, fontSize: "13px", color: C.mut, marginBottom: "8px" }}>Ninguna este mes.</div> : inversiones.map(i => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "8px", fontFamily: F, fontSize: "13px", color: C.char }}>
              <span>{i.concepto}</span><span style={{ fontWeight: 700 }}>{fmt2(i.amount)}</span>
            </div>
          ))}
          <a href="#/finanzas/inversiones" style={{ fontFamily: F, fontSize: "12.5px", fontWeight: 600, color: C.blu }}>Gestionar en Inversiones</a>
        </div>
        <Sec title="Reparto a socios" />
        <div style={crd}><input type="number" inputMode="decimal" value={repartoSocios} onChange={e => setRepartoSocios(e.target.value)} placeholder="0" style={{ ...inp, marginBottom: 0 }} /></div>
      </div>

      <button onClick={handleSave} disabled={saving || salNuevo === null} style={{ width: "100%", padding: "16px", border: "none", borderRadius: "12px", background: saving ? "#D8D0C4" : C.char, color: saving ? "#A09888" : C.gold, fontFamily: SF, fontSize: "16px", cursor: saving ? "default" : "pointer", marginTop: "8px", marginBottom: "40px", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
        {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar datos del mes"}
      </button>
    </div>
  );
}
