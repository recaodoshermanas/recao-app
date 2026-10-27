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
import { TarjetaBanco } from "./TarjetaBanco.jsx"; // #74
import { CierreLista } from "./CierreLista.jsx"; // #76

// #77: el Cierre de mes se guarda solo (al salir del campo, al añadir o quitar una línea y tras rellenar del banco).
// Guardar ya no cierra el mes: eso se hace con «Cerrar mes» en la lista de cierre (#76).
const ESPERA = 1500; // ms sin tocar nada antes de guardar mientras se escribe
const estable = (x) => JSON.stringify(x, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((c) => [c, v[c]])) : v)); // compara sin importar el orden de las claves

export function DatosMesView({ facturas, monthlyData, config, onReload, initialMonth }) {
  // #76: desde octubre de 2026 salen todos los meses hasta el actual, aunque aún no tengan nada guardado
  const desdeOct = [];
  for (let m = "2026-10"; m <= currentMK; ) { desdeOct.push(m); const [a, n] = m.split("-").map(Number); m = n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, "0")}`; }
  const allMonths = [...new Set([...Object.keys(monthlyData), ...desdeOct, currentMK])].sort().reverse();
  const [selMonth, setSelMonth] = useState(() => initialMonth || Object.keys(monthlyData).sort().reverse()[0] || currentMK);

  useEffect(() => { if (initialMonth) setSelMonth(initialMonth); }, [initialMonth]);

  const guardadosRef = useRef({}); // #77: lo último guardado en esta pantalla, por mes (por si la recarga aún no ha llegado)
  const md = { ...(monthlyData[selMonth] || {}), ...(guardadosRef.current[selMonth] || {}) };
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
  const [tarjeta, setTarjeta] = useState(null); // #74: desde octubre de 2026, ventas de Epos y tarjeta de la caja 1 frente a BBVA (false = sin acceso)
  const [repartoSobres, setRepartoSobres] = useState(null); // #75: solo lectura, sale de Efectivo de sobres (null = no es socio)
  const [cierre, setCierre] = useState(null); // #76: estado de la lista de cierre (null cargando · false error)
  const [guardado, setGuardado] = useState(null); // #77: { zona, estado: "guardando" | "ok" | "error" }
  const sucio = useRef(false);
  const zona = useRef("");
  const temporizador = useRef(null);
  const enMarcha = useRef(false);
  const otraVez = useRef(false);
  const guardarRef = useRef(null);
  const iniciado = useRef("");
  const gfGuardar = useRef(null); // #28: apunta el origen (banco / a mano) de los gastos fijos al guardar
  const [salNuevo, setSalNuevo] = useState(null); // #18: null cargando · true tarjetas por trabajadora · false lista de antes
  const [salV2, setSalV2] = useState([]);
  useEffect(() => { setSalNuevo(null); }, [selMonth]);

  // #77: el formulario se rellena al cambiar de mes (no en cada recarga, para no pisar lo que se está escribiendo)
  useEffect(() => {
    if (iniciado.current === selMonth) return;
    iniciado.current = selMonth;
    sucio.current = false; setGuardado(null);
    const d = { ...(monthlyData[selMonth] || {}), ...(guardadosRef.current[selMonth] || {}) };
    if (d.resumen_legacy) {
      setVentas(""); setPaqueteria({}); setGastosFijos({});
      setSalarios(config.salarios_template || []); setOtrosGastos([]);
      setInversiones([]);
      return;
    }
    setVentas(d.ventas_epos || "");
    setPaqueteria(d.paqueteria || {});
    setGastosFijos(d.gastos_fijos || {});
    setSalarios(d.salarios || config.salarios_template || []);
    setOtrosGastos(d.otros_gastos || []);
    setInversiones(d.inversiones || []);
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
  }, [selMonth]); // #77: solo al cambiar de mes, para no pisar lo que se está escribiendo

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

  // #75: el reparto a socios solo se registra en Efectivo de sobres; aquí se enseña (solo a los socios)
  useEffect(() => {
    let vivo = true;
    setRepartoSobres(null);
    sb.rpc("reparto_socios_meses").then((r) => { if (vivo) setRepartoSobres(r ? Number(r[selMonth] || 0) : null); }).catch(() => {});
    return () => { vivo = false; };
  }, [selMonth, monthlyData]);

  // #74: desde octubre de 2026 las ventas salen de Epos (no se escriben) y la tarjeta de la caja 1 se cruza con BBVA
  const desdeEpos = selMonth >= "2026-10";
  useEffect(() => {
    let vivo = true;
    setTarjeta(null);
    if (selMonth >= "2026-10") sb.rpc("tarjeta_banco_mes", { p_mes: selMonth }).then((r) => { if (vivo) setTarjeta(r); }).catch(() => { if (vivo) setTarjeta(false); });
    return () => { vivo = false; };
  }, [selMonth, monthlyData]);

  // #76: lista de cierre del mes
  const cargarCierre = () => sb.rpc("cierre_mes_estado", { p_mes: selMonth }).then((r) => setCierre(r)).catch(() => setCierre(false));
  useEffect(() => {
    let vivo = true;
    setCierre(null);
    sb.rpc("cierre_mes_estado", { p_mes: selMonth }).then((r) => { if (vivo) setCierre(r); }).catch(() => { if (vivo) setCierre(false); });
    return () => { vivo = false; };
  }, [selMonth]);
  const cerrado = !!(cierre && cierre.cerrado);

  // #77: guardado automático. Guarda lo mismo y en el mismo sitio que el antiguo botón «Guardar datos del mes».
  guardarRef.current = async () => {
    clearTimeout(temporizador.current);
    if (!sucio.current) return;
    if (!cierre || cierre.cerrado) { if (cierre && cierre.cerrado) sucio.current = false; return; } // mes cerrado: no se guarda nada
    if (salNuevo === null || iniciado.current !== selMonth) return;
    if (enMarcha.current) { otraVez.current = true; return; }
    enMarcha.current = true; sucio.current = false;
    const z = zona.current;
    setGuardado({ zona: z, estado: "guardando" });
    try {
      const payload = {
        mes: selMonth,
        ventas_epos: desdeEpos && tarjeta && tarjeta.venta_epos != null ? Number(tarjeta.venta_epos) : pn(ventas),
        paqueteria, gastos_fijos: gastosFijos, salarios: salNuevo ? salV2 : salarios,
        otros_gastos: otrosGastos,
        resumen_legacy: null,
      };
      if (paqBanco) payload.paqueteria = await sb.rpc("paqueteria_guardar", { p_mes: selMonth, p_valores: paqueteria }); // #43
      await sb.upsert("datos_mes", payload, "mes");
      await gfGuardar.current?.(); // #28: origen (banco / a mano) de los gastos fijos
      if (!salNuevo && salarios.length > 0) {
        await sb.upsert("config", { key: "salarios_template", value: salarios }, "key");
      }
      guardadosRef.current[selMonth] = payload;
      setGuardado({ zona: z, estado: "ok" });
      setTimeout(() => setGuardado((g) => (g && g.estado === "ok" ? null : g)), 2000);
      cargarCierre();
      onReload();
    } catch (e) {
      sucio.current = true;
      setGuardado({ zona: z, estado: "error", msg: e.message });
    }
    enMarcha.current = false;
    if (otraVez.current) { otraVez.current = false; guardarRef.current(); }
  };
  const tocar = (z, ms = ESPERA) => {
    sucio.current = true; zona.current = z;
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => guardarRef.current?.(), ms);
  };
  const salir = () => { if (sucio.current) guardarRef.current?.(); };
  // Salarios (formato nuevo): se guardan cuando cambian respecto a lo guardado (nóminas fijas, sobres…)
  useEffect(() => {
    if (salNuevo !== true || iniciado.current !== selMonth) return;
    if (estable(salV2) !== estable(md.salarios || null)) tocar("salarios");
  }, [salV2, salNuevo]); // eslint-disable-line react-hooks/exhaustive-deps
  // Si había algo pendiente mientras cargaba la lista de cierre, se guarda ahora (o se descarta si el mes está cerrado)
  useEffect(() => { if (cierre && sucio.current) tocar(zona.current || "ingresos", 300); }, [cierre]); // eslint-disable-line react-hooks/exhaustive-deps
  // Al salir de la pantalla o cerrar la pestaña, se guarda lo pendiente
  useEffect(() => {
    const antes = (e) => { if (sucio.current) { guardarRef.current?.(); e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", antes);
    return () => { window.removeEventListener("beforeunload", antes); if (sucio.current) guardarRef.current?.(); };
  }, []);
  const cambiarMes = async (m) => { if (sucio.current) await guardarRef.current?.(); setSelMonth(m); };
  const irA = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const Aviso = ({ z }) => {
    if (!guardado || guardado.zona !== z) return null;
    if (guardado.estado === "guardando") return <div style={{ fontFamily: F, fontSize: 12, color: C.mut, margin: "-6px 2px 10px" }}>Guardando…</div>;
    if (guardado.estado === "ok") return <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#1E6B3C", margin: "-6px 2px 10px" }}>Guardado ✓</div>;
    return (
      <div role="alert" style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: "#B3261E", margin: "-6px 2px 10px" }}>
        No se ha guardado: <button type="button" onClick={() => { sucio.current = true; guardarRef.current?.(); }} style={{ background: "none", border: "none", padding: 0, fontFamily: F, fontSize: 12.5, fontWeight: 700, color: "#B3261E", textDecoration: "underline", cursor: "pointer" }}>reintentar</button>
      </div>
    );
  };
  // Cualquier cambio dentro de un apartado lo marca para guardar; al salir del campo se guarda
  const zonaProps = (z) => ({ onChange: () => tocar(z), onBlur: salir, onClick: (e) => { if (e.target.closest("button")) tocar(z, 200); } });

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
        <select value={selMonth} onChange={e => cambiarMes(e.target.value)} style={{ ...inp, width: "auto", padding: "8px 12px", fontSize: "13px" }}>
          {allMonths.map(m => <option key={m} value={m}>{mkLabel(m)}{monthlyData[m]?.resumen_legacy ? " (resumen)" : ""}{(m === selMonth ? cerrado : monthlyData[m]?.cerrado) ? " · cerrado" : ""}</option>)}
        </select>
      </div>

      <CierreLista mes={selMonth} estado={cierre} onEstado={(r) => { setCierre(r); onReload(); }} irA={irA} />

      <DescuadreSobres datos={sobres.datos} />

      {/* #76: con el mes cerrado, todo lo de abajo queda en solo lectura */}
      <fieldset disabled={cerrado} style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>

      {isSummary && (
        <div style={{ ...crd, border: `2px solid ${C.gold}`, background: "#FFFBF0", marginBottom: "20px" }}>
          <div style={{ fontFamily: F, fontSize: "13px", color: C.char, lineHeight: 1.5 }}>
            Mes con datos resumidos (ingresos: {fmt(md.resumen_legacy.ingresos)}, gastos: {fmt(md.resumen_legacy.gastos)}). Rellena el desglose abajo si quieres más detalle.
          </div>
        </div>
      )}

      {sobres.datos !== false && <Sec title="Efectivo" sub="Los sobres de los cierres de caja" />}
      <div id="cm-sobres"><AperturaSobres mes={selMonth} datos={sobres.datos} setDatos={(r) => { sobres.setDatos(r); if (r) cargarCierre(); }} /></div>
      <div id="cm-epos">{sobres.datos !== false && <EposCierres mes={selMonth} />}</div>
      <div id="cm-tarjeta"><TarjetaBanco mes={selMonth} datos={tarjeta} setDatos={(r) => { setTarjeta(r); cargarCierre(); }} /></div>

      {stockActivo && <Sec title="Stock" sub="Fotos del stock de Epos valorado a coste (con IVA y recargo)" />}
      <StockCierre mes={selMonth} onActivo={setStockActivo} />

      <Sec title="Facturas proveedores" sub="Registradas por trabajadoras" />
      <div style={crd}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: F, fontSize: "14px", color: C.char }}>{facturasMonth.length} facturas</span>
          <span style={{ fontFamily: F, fontSize: "16px", fontWeight: 700, color: C.char }}>{fmt2(totalFacturas)}</span>
        </div>
      </div>

      <div id="cm-ingresos" {...zonaProps("ingresos")}>
      <Sec title="Ingresos" />
      <div style={crd}>
        <label style={lbl}>Ventas EPOS (€)</label>
        {desdeEpos ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "16px", fontFamily: F, fontSize: "15px", color: C.char }}>
            <span style={{ fontWeight: 700 }}>{tarjeta === null ? "Cargando…" : tarjeta && tarjeta.venta_epos != null ? fmt2(tarjeta.venta_epos) : "Sin ventas de Epos"}</span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px", background: "#EAF4EE", color: "#1E6B3C" }}>De Epos</span>
          </div>
        ) : (
          <input type="number" inputMode="decimal" value={ventas} onChange={e => setVentas(e.target.value)} placeholder="50349" style={{ ...inp, marginBottom: "16px" }} />
        )}
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
      <Aviso z="ingresos" />
      </div>

      <div id="cm-salarios" {...zonaProps("salarios")}>
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
      <Aviso z="salarios" />
      </div>

      <div id="cm-gf" {...zonaProps("gf")}>
      <Sec title="Gastos fijos" />
      <div style={crd}>
        <GastosFijos mes={selMonth} valores={gastosFijos} onValores={v => { setGastosFijos(p => ({ ...p, ...v })); tocar("gf"); }} guardarRef={gfGuardar} />
      </div>
      <Aviso z="gf" />
      </div>

      <div {...zonaProps("otros")}>
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
      <Aviso z="otros" />
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
        {repartoSobres !== null && <>
          <Sec title="Reparto a socios" sub="Solo lectura: se registra en Efectivo de sobres" />
          <div style={crd}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "8px", fontFamily: F, fontSize: "13px", color: C.char }}>
              <span>Reparto a socios</span><span style={{ fontWeight: 700 }}>{fmt2(repartoSobres)}</span>
            </div>
            <a href="#/finanzas/efectivo/sobres" style={{ fontFamily: F, fontSize: "12.5px", fontWeight: 600, color: C.blu }}>Se registra en Efectivo de sobres</a>
          </div>
        </>}
      </div>

      </fieldset>
    </div>
  );
}
