// Finanzas: todo sale de dash_finanzas() (datos del mes, facturas, Epos y cierres de caja).
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase, sb } from "../../src/lib/supabase.js";
import { Panel } from "./ui.jsx"; // #70
import { initTips } from "./charts.js";
import { eur, eurK, pct, num, mesCorto, mesAnio, parseDate } from "./fmt.js";
import { CajaFuerte } from "./CajaFuerte.jsx"; // CAJA FUERTE (#11)
import { CuadreTurnos } from "./finanzas/CuadreTurnos.jsx"; // #81
import { InformeMensual } from "./finanzas/InformeMensual.jsx"; // #65
import { armarTabla, exportarExcel, exportarPdf } from "./finanzas/exportarCuenta.js"; // #71

const CATS = [
  { id: "mercancia", label: "Compras de mercancía" },
  { id: "personal", label: "Personal" },
  { id: "local", label: "Local y suministros" },
  { id: "servicios", label: "Servicios" },
  { id: "impuestos", label: "Impuestos" },
  { id: "mantenimiento", label: "Mantenimiento y equipamiento" },
  { id: "otros", label: "Otros" },
];
const CAT_LABEL = Object.fromEntries(CATS.map((c) => [c.id, c.label]));
const n0 = (v) => Number(v) || 0;
const sinDecimales = (v) => (v == null ? null : Math.round(v));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- datos ----------
let cache = null;
export function useFinanzas() {
  const [d, setD] = useState(cache);
  const [fallo, setFallo] = useState(false);
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("dash_finanzas");
    if (error) { if (!cache) setFallo(true); return; }
    cache = data; setD(data); setFallo(false);
  }, []);
  useEffect(() => {
    initTips(document.body);
    cargar();
    const t = setInterval(() => { if (!document.hidden) cargar(); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [cargar]);
  return { d, fallo, recargar: cargar };
}

// Cálculos del mes en curso a partir de la previsión (media de los 3 últimos meses cerrados)
function mesEnCurso(d) {
  const P = d.prevision || {};
  const cerrados = d.meses.filter((m) => m.cerrado);
  const ult = cerrados[cerrados.length - 1];
  const diasMes = P.dias_mes, dia = P.dia;
  // media de las últimas 4 semanas; la previsión de cierre la calcula la base de datos día a día de la semana
  const mediaDia = n0(P.media_dia_28) || (ult ? ult.ventas / 30 : 0);
  const proyeccion = P.proyeccion != null ? n0(P.proyeccion) : n0(P.venta_prev) + mediaDia * (diasMes - n0(P.dias_prev));
  const ratioSinIva = P.venta > 0 ? P.venta_sin_iva / P.venta : (ult && ult.epos_venta ? ult.epos_sin_iva / ult.epos_venta : 0.93);
  const margen = P.venta_sin_iva > 0 ? (P.venta_sin_iva - P.coste) / P.venta_sin_iva : (ult && ult.epos_sin_iva ? (ult.epos_sin_iva - ult.epos_coste) / ult.epos_sin_iva : 0.39);
  const fijos = n0(P.personal) + n0(P.local) + n0(P.servicios) + n0(P.otros);
  const paq = n0(P.paqueteria);
  const benefMargen = proyeccion * ratioSinIva * margen + paq - fijos;
  const benefCompras = proyeccion * (1 - n0(P.compras_ratio)) + paq - fijos;
  // venta para cubrir gastos: con el margen de Epos y con el ritmo de compras (el peor de los dos manda)
  const necesariaMargen = margen > 0 ? (fijos - paq) / (ratioSinIva * margen) / diasMes : null;
  const necesariaCompras = n0(P.compras_ratio) < 1 ? (fijos - paq) / (1 - n0(P.compras_ratio)) / diasMes : null;
  const necesariaDia = Math.max(n0(necesariaMargen), n0(necesariaCompras)) || null;
  return { P, ult, diasMes, dia, mediaDia, proyeccion, ratioSinIva, margen, fijos, paq, benefMargen, benefCompras, necesariaMargen, necesariaCompras, necesariaDia };
}

// ---------- piezas comunes ----------
function Estado({ fallo }) {
  return <div className="state">{fallo ? "No se han podido cargar los datos. Recarga la página en un momento." : "Cargando…"}</div>;
}
function Kpi({ titulo, valor, sub, tono, tip }) {
  return (
    <div className="card fkpi" data-tip={tip}>
      <h2>{titulo}</h2>
      <p className={`num${tono ? " " + tono : ""}`}>{valor}</p>
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}

// Barras de venta y línea de resultado de los meses cerrados
function GraficoMeses({ meses }) {
  const W = 760, H = 260, m = { t: 20, r: 10, b: 28, l: 46 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = Math.max(...meses.map((x) => x.ingresos)) * 1.08 || 1;
  const min = Math.min(0, ...meses.map((x) => x.resultado));
  const y = (v) => m.t + (max - v) / (max - min) * ih;
  const gw = iw / meses.length, bw = Math.min(34, gw * 0.56);
  const ticks = 4, paso = Math.ceil(max / ticks / 5000) * 5000;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ingresos y resultado por mes">
      {Array.from({ length: Math.floor(max / paso) + 1 }, (_, i) => i * paso).map((v) => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke={v ? "var(--grid)" : "var(--line)"} />
          <text x={m.l - 8} y={y(v) + 4} textAnchor="end" className="axis">{v ? eurK(v) : "0"}</text>
        </g>
      ))}
      {meses.map((x, i) => {
        const bx = m.l + gw * i + (gw - bw) / 2;
        const tip = `<b>${esc(mesAnio(x.mes))}</b><br>Ingresos: <b>${eur(x.ingresos)}</b><br>Gastos: ${eur(x.gastos)}<br>Resultado: <b>${eur(x.resultado)}</b> (${pct(x.ingresos ? x.resultado / x.ingresos * 100 : 0)})`;
        return (
          <g key={x.mes}>
            <rect x={bx} y={y(x.ingresos)} width={bw} height={Math.max(0, y(0) - y(x.ingresos))} rx="4" fill="var(--grid)" />
            <rect x={bx} y={Math.min(y(0), y(x.resultado))} width={bw} height={Math.abs(y(0) - y(x.resultado))} rx="3" fill={x.resultado >= 0 ? "var(--up)" : "var(--down)"} />
            <text x={bx + bw / 2} y={H - 8} textAnchor="middle" className="axis">{mesCorto(x.mes)}</text>
            <rect x={m.l + gw * i} y={m.t} width={gw} height={ih} fill="transparent" data-tip={tip} />
          </g>
        );
      })}
    </svg>
  );
}

// ---------- 1. Resumen ----------
export function FinanzasResumen({ onEditMonth }) {
  const { d, fallo } = useFinanzas();
  const [extra, setExtra] = useState([]);
  useEffect(() => {
    supabase.rpc("finanzas_avisos_extra").then(({ data }) => { if (Array.isArray(data)) setExtra(data); }, () => {});
  }, [d]);
  if (!d) return <Estado fallo={fallo} />;
  const c = mesEnCurso(d);
  const cerrados = d.meses.filter((m) => m.cerrado).slice(-12);
  const ult = c.ult;
  const nombreMesActual = mesAnio(d.mes_actual);

  // avisos
  const avisos = [];
  if (ult && ult.epos_coste) {
    const gap = n0(ult.compras_mercancia ?? ult.mercancia) - ult.epos_coste;
    if (gap > 1000) avisos.push({ t: `En ${mesAnio(ult.mes).toLowerCase()} se compraron ${eur(gap)} más de lo que costó lo vendido según Epos. O crece el stock o hay costes que no cuadran.`, ruta: "finanzas/compras" });
  }
  const hoy = d.hoy;
  const caja14 = d.caja.filter((x) => x.fecha < hoy).slice(0, 14);
  const sinCierre = caja14.filter((x) => x.cierres < 2);
  if (sinCierre.length) avisos.push({ t: `${sinCierre.length} día${sinCierre.length > 1 ? "s" : ""} de las dos últimas semanas sin los dos cierres de caja (${sinCierre.map((x) => diaCortito(x.fecha)).join(", ")}).`, ruta: "finanzas/caja" });
  const descuadres = caja14.filter((x) => x.cierres >= 2 && Math.abs(difEfectivo(x).v) > 10);
  if (descuadres.length) avisos.push({ t: `${descuadres.length} día${descuadres.length > 1 ? "s" : ""} con el efectivo descuadrado más de 10 € frente a Epos.`, ruta: "finanzas/caja" });
  const dup = d.proveedores.filter((p) => p.variantes.length > 1);
  if (dup.length) avisos.push({ t: `Proveedores escritos de varias formas: ${dup.map((p) => p.variantes.join(" / ")).join("; ")}. Conviene unificarlos.`, ruta: "finanzas/compras" });
  // #64: el aviso genérico del IVA trimestral lo sustituye el bloque «Impuestos»

  avisos.push(...extra);

  return (
    <>
      <section className="fhero">
        <div className="fhero-t">
          <h1>{nombreMesActual} · día {c.dia} de {c.diasMes}</h1>
          <p className="fhero-s">Beneficio estimado del mes si se vende como en las últimas semanas (cierre previsto ≈ {eur(sinDecimales(c.proyeccion))}) y los gastos siguen como en los tres últimos meses.</p>
        </div>
        <div className="fhero-esc">
          <p className="fhero-k">Con lo que estáis comprando</p>
          <p className="big">{eur(sinDecimales(c.benefCompras))}</p>
          <p className="fhero-n">Compras = {pct(n0(c.P.compras_ratio) * 100, 0)} de la venta, como de media en los 3 últimos meses. Es lo que dice hoy la cuenta de resultados.</p>
        </div>
        <div className="fhero-esc">
          <p className="fhero-k">Con el margen real de Epos</p>
          <p className="big">{eur(sinDecimales(c.benefMargen))}</p>
          <p className="fhero-n">Margen sobre lo vendido del {pct(c.margen * 100, 1)}. Si las compras se ajustan a lo que se vende, este sería el beneficio.</p>
        </div>
        <dl className="fhero-dl">
          <div><dt>Venta necesaria al día para cubrir gastos</dt><dd>{eur(sinDecimales(c.necesariaDia))}</dd></div>
          <div><dt>Venta media al día (últimas 4 semanas)</dt><dd>{eur(sinDecimales(c.mediaDia))}</dd></div>
          <div><dt>Diferencia entre los dos escenarios</dt><dd>{eur(sinDecimales(c.benefMargen - c.benefCompras))}</dd><span>Es lo que hay que explicar con el inventario: stock acumulado, costes de Epos desactualizados o mermas.</span></div>
        </dl>
      </section>

      {avisos.length > 0 && (
        <section className="avisos favisos" aria-label="Avisos">
          {avisos.map((a, i) => a.ruta
            ? <a key={i} className="aviso" href={`#/${a.ruta}`} onClick={a.mes && onEditMonth ? (e) => { e.preventDefault(); onEditMonth(a.mes); } : undefined}><b>!</b><span>{a.t}</span><i aria-hidden="true">→</i></a>
            : <div key={i} className="aviso"><b>!</b><span>{a.t}</span></div>)}
        </section>
      )}

      <div className="grid">
        <Kpi titulo="Venta del mes" valor={eur(sinDecimales(c.P.venta))} sub={`${c.dia} días · cierre previsto ≈ ${eur(sinDecimales(c.proyeccion))}`} tip="La previsión suma lo que llevamos y, para cada día que queda, la venta media de ese día de la semana en las últimas 4 semanas." />
        <Kpi titulo="Margen real" valor={pct(c.margen * 100)} sub="Venta sin IVA menos coste de lo vendido (Epos)" tip="Calculado con el coste de cada producto en Epos. Si algún coste está desactualizado, el margen real será otro." />
        <Kpi titulo="Gastos fijos al mes" valor={eur(sinDecimales(c.fijos))} sub={`Personal ${eur(sinDecimales(c.P.personal))} · local ${eur(sinDecimales(c.P.local))} · resto ${eur(sinDecimales(n0(c.P.servicios) + n0(c.P.otros)))}`} tip="Media de los tres últimos meses cerrados, sin compras de mercancía ni impuestos." />
        <Kpi titulo="Compras este mes" valor={eur(sinDecimales(c.P.facturas))} sub={`Coste de lo vendido: ${eur(sinDecimales(c.P.coste))}`} tono={c.P.facturas > c.P.coste * 1.1 ? "mal" : ""} />
      </div>

      <div className="grid">
        <div className="card c12">
          <div className="head">
            <div><h2>Últimos 12 meses</h2><p className="sub">Ingresos (gris) y resultado (verde) de cada mes cerrado</p></div>
            <a className="enlace" href="#/finanzas/resultados">Cuenta de resultados →</a>
          </div>
          <GraficoMeses meses={cerrados} />
        </div>
      </div>

      <ImpuestosResumen />

      <StockResumen />

      {ult && <Estructura mes={ult} />}

      <InformeMensual />
    </>
  );
}
// #64 · Bloque «Impuestos» del Resumen: próximo plazo de los modelos 115, 111, 131, 130 y 303 con lo estimado y lo pagado en BBVA
const TRI = ["", "1.er trimestre", "2.º trimestre", "3.er trimestre", "4.º trimestre"];
const fechaLarga = (f) => parseDate(f).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
const fechaCorta = (f) => parseDate(f).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
function EstadoImp({ m }) {
  if (m.estado === "pagado") return <span style={{ color: "var(--up)", fontWeight: 700 }}>Pagado el {fechaCorta(m.pagado_el)}</span>;
  if (m.estado === "sin_pago") return <span style={{ color: "var(--down)", fontWeight: 700 }}>Sin pago en el banco</span>;
  return <span style={{ color: "#B5651D", fontWeight: 700 }}>Pendiente</span>;
}
const importeImp = (m) => (m.estado === "pagado" ? eur(m.pagado, 2) : m.estimado != null ? `${eur(m.estimado, 2)} estimado` : "Sin estimación");
function TablaImp({ modelos }) {
  return (
    <div className="tabla-scroll">
      <table className="ranking">
        <thead><tr><th>Modelo</th><th>Qué es</th><th>Fecha límite</th><th className="r">Importe</th><th>Estado</th></tr></thead>
        <tbody>
          {modelos.map((m) => (
            <tr key={m.modelo + m.limite}>
              <td className="b">{m.modelo}</td>
              <td>{m.que}</td>
              <td>{fechaLarga(m.limite)}</td>
              <td className="r">{importeImp(m)}</td>
              <td><EstadoImp m={m} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ImpuestosResumen() {
  const [r, setR] = useState(null);
  const [verAnio, setVerAnio] = useState(false);
  useEffect(() => { supabase.rpc("finanzas_impuestos").then(({ data }) => setR(data || null), () => setR(null)); }, []);
  const p = r?.proximo;
  if (!p || !p.modelos) return null;
  const naranja = !!p.naranja;
  const titulo = p.pendientes > 0
    ? `Próximo pago: hasta el ${fechaLarga(p.primera_fecha)} · estimado ${eur(p.total_estimado, 2)}`
    : `${TRI[p.trimestre]} de ${p.anio}: todo pagado (${eur(p.total_pagado, 2)})`;
  const a = r.anio;
  return (
    <div className="grid">
      <div className="card c12" style={naranja ? { border: "2px solid #E8913A", background: "rgba(232,145,58,.08)" } : undefined}>
        <div className="head">
          <div>
            <h2>Impuestos</h2>
            <p style={{ margin: "6px 0 2px", fontSize: 20, fontWeight: 800, color: naranja ? "#B5651D" : "var(--text)" }}>{titulo}</p>
            <p className="sub">{TRI[p.trimestre]} de {p.anio}{p.pendientes > 0 && p.dias != null ? ` · quedan ${p.dias} día${p.dias === 1 ? "" : "s"}` : ""}. Los presenta la gestoría y se cargan en BBVA. El estimado es lo que se pagó de ese modelo el trimestre anterior; al aparecer el cargo en el banco pasa a «Pagado».</p>
          </div>
          <button className="btn-txt" onClick={() => setVerAnio(!verAnio)} aria-expanded={verAnio}>{verAnio ? "Ocultar el año" : "Ver el año"}</button>
        </div>
        <TablaImp modelos={p.modelos} />
        {verAnio && a && (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ margin: "0 0 4px" }}>Año {a.anio}</h3>
            <p className="sub">Pagado {eur(a.total_pagado, 2)} · pendiente estimado {eur(a.total_pendiente, 2)} · total del año {eur(n0(a.total_pagado) + n0(a.total_pendiente), 2)}</p>
            {(a.trimestres || []).map((t) => (
              <div key={t.trimestre} style={{ marginTop: 12 }}>
                <p style={{ margin: "0 0 -6px", fontWeight: 700 }}>{TRI[t.trimestre]} · pagado {eur(t.pagado, 2)}{n0(t.pendiente) > 0 ? ` · pendiente estimado ${eur(t.pendiente, 2)}` : ""}</p>
                <TablaImp modelos={t.modelos || []} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// #61 · Bloque «Stock» del Resumen: solo cuando dirección ha puesto la fecha del inventario inicial
function StockResumen() {
  const [s, setS] = useState(null);
  useEffect(() => { supabase.rpc("stock_resumen").then(({ data }) => setS(data || null), () => setS(null)); }, []);
  if (!s || !s.activo) return null;
  const u = s.ultima;
  const fechaTxt = (f) => parseDate(f).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const max = Math.max(1, ...(s.evolucion || []).map((e) => n0(e.valor)));
  return (
    <div className="grid">
      <div className="card c12">
        <div className="head">
          <div><h2>Stock</h2><p className="sub">{u ? `Foto de la noche del ${fechaTxt(u.fecha)} · valorado a coste con IVA y recargo` : `Aún no hay foto del stock desde el inventario del ${fechaTxt(s.inventario)}`}</p></div>
          <a className="enlace" href="#/finanzas/resultados/cierre">Cierre de mes →</a>
        </div>
        {s.error_ultimo && (!u || s.error_ultimo.fecha > u.fecha) && <p className="aviso-txt">No se pudo guardar la foto de la noche del {fechaTxt(s.error_ultimo.fecha)}: {s.error_ultimo.error}</p>}
        {u && (
          <div className="grid sin-margen">
            <Kpi titulo="Valor del stock" valor={eur(sinDecimales(u.valor))} sub={`${num(u.productos_con_stock)} productos con stock`} />
            <Kpi titulo="Unidades" valor={num(u.unidades)} sub={n0(u.kg) ? `y ${num(u.kg, 1)} kg de productos al peso` : "Sin productos al peso"} />
            <Kpi titulo="Sin valorar" valor={`${num(u.sin_valorar_n)} productos`} sub={`${num(u.sin_valorar_unid)} unidades sin coste en Epos: no suman`} tono={u.sin_valorar_n ? "mal" : ""} />
            <Kpi titulo="Stock negativo" valor={`${num(u.negativos_n)} productos`} sub="No restan del valor: salen aparte" tono={u.negativos_n ? "mal" : ""} />
          </div>
        )}
        {(s.evolucion || []).length > 0 && (
          <ul className="fbarras">
            {s.evolucion.map((e) => (
              <li key={e.fecha}>
                <span className="n">{fechaTxt(e.fecha)}</span>
                <span className="bar-cell"><span className="bar" style={{ width: `${(n0(e.valor) / max) * 100}%` }} /></span>
                <span className="v">{eur(sinDecimales(e.valor))}</span>
                <span className="m" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const diaCortito = (f) => parseDate(f).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });

function Estructura({ mes }) {
  const filas = CATS.map((c) => ({ ...c, v: n0(mes[c.id]) })).filter((x) => x.v > 0);
  return (
    <div className="grid">
      <div className="card c12">
        <h2>A dónde va cada 100 € que entran</h2>
        <p className="sub">{mesAnio(mes.mes)} · ingresos {eur(sinDecimales(mes.ingresos))}</p>
        <ul className="fbarras">
          {filas.map((x) => (
            <li key={x.id}>
              <span className="n">{x.label}</span>
              <span className="bar-cell"><span className="bar" style={{ width: `${Math.min(100, x.v / mes.ingresos * 100)}%` }} /></span>
              <span className="v">{eur(sinDecimales(x.v))}</span>
              <span className="m">{num(x.v / mes.ingresos * 100, 1)} €</span>
            </li>
          ))}
          <li className="total">
            <span className="n">Queda (resultado)</span>
            <span className="bar-cell"><span className={`bar ${mes.resultado >= 0 ? "pos" : "neg"}`} style={{ width: `${Math.min(100, Math.abs(mes.resultado) / mes.ingresos * 100)}%` }} /></span>
            <span className="v">{eur(sinDecimales(mes.resultado))}</span>
            <span className="m">{num(mes.resultado / mes.ingresos * 100, 1)} €</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// ---------- 2. Cuenta de resultados ----------
export function FinanzasResultados({ onEditMonth }) {
  const { d, fallo, recargar } = useFinanzas();
  const [modo, setModo] = useState("eur");
  const [sel, setSel] = useState(null);
  const [exportando, setExportando] = useState(null);
  const [cifra, setCifra] = useState(null); // #70: {f, m} de la cifra pulsada
  const scroll = useRef(null);
  const cerrados = useMemo(() => (d ? d.meses.filter((m) => m.cerrado) : []), [d]);
  // #68 / #76: los meses sin cerrar (el mes en curso, los de desde octubre de 2026 aún sin cerrar y los reabiertos) salen como columnas provisionales
  const mesHoy = d ? `${String(d.hoy || "").slice(0, 7)}-01` : "";
  const abiertos = useMemo(() => (d ? d.meses.filter((m) => !m.cerrado && m.mes <= mesHoy && (m.mes === mesHoy || m.mes >= "2026-10-01" || m.con_datos)) : []), [d, mesHoy]);
  const meses = useMemo(() => [...cerrados.slice(-12), ...abiertos].sort((a, b) => (a.mes < b.mes ? -1 : 1)), [cerrados, abiertos]);
  // solo se compara con meses que existen de verdad en la app: cerrados o sin cerrar (provisionales)
  const disponibles = useMemo(() => Object.fromEntries([...cerrados, ...abiertos].map((m) => [m.mes, m])), [cerrados, abiertos]);
  useEffect(() => { if (cerrados.length && !sel) setSel(cerrados[cerrados.length - 1].mes); }, [cerrados, sel]);
  // en pantallas estrechas, que se vean primero los meses más recientes
  useEffect(() => { const el = scroll.current; if (el) el.scrollLeft = el.scrollWidth; }, [meses.length]);
  if (!d) return <Estado fallo={fallo} />;
  const mes = meses.find((m) => m.mes === sel) || cerrados[cerrados.length - 1] || meses[meses.length - 1];
  const val = (m, v) => (modo === "pct" ? (m.ingresos ? pct(v / m.ingresos * 100, 1) : "–") : num(v));
  // #69: tienda y paquetería por separado (tributan distinto). Todos los gastos son de la tienda; la paquetería no tiene gastos propios.
  const resTienda = (m) => n0(m.ventas) - n0(m.gastos);
  const filas = [
    { sep: true, k: "sep_tienda", l: "Tienda" },
    { k: "ventas", l: "Ventas (con IVA)" },
    // #61: en los meses con stock inicial y final, la mercancía es el coste de lo vendido (compras + variación de existencias)
    ...(meses.some((m) => m.variacion_existencias != null)
      ? [{ k: "compras_mercancia", l: "Compras de mercancía", neg: true, get: (m) => (m.compras_mercancia != null ? m.compras_mercancia : m.mercancia) },
         { k: "variacion_existencias", l: "Variación de existencias", neg: true, get: (m) => m.variacion_existencias },
         { k: "mercancia", l: "Coste de la mercancía vendida", neg: true, b2: true, get: (m) => m.mercancia },
         ...CATS.filter((c) => c.id !== "mercancia").map((c) => ({ k: c.id, l: c.label, neg: true }))]
      : CATS.map((c) => ({ k: c.id, l: c.label, neg: true }))),
    { k: "gastos", l: "Gastos", b: true, neg: true },
    { k: "resultado_tienda", l: "Resultado de la tienda", b: true, r: true, get: resTienda },
    { sep: true, k: "sep_paq", l: "Paquetería" },
    { k: "paqueteria", l: "Ingresos de paquetería" },
    { k: "resultado_paqueteria", l: "Resultado de la paquetería", b: true, r: true, get: (m) => n0(m.paqueteria) },
    { sep: true, k: "sep_total", l: "Total del negocio" },
    // #36: desde octubre de 2026, la suma de los descuadres de los sobres (resta si falta dinero, suma si sobra)
    ...(meses.some((m) => m.mes >= "2026-10") ? [{ k: "descuadres_caja", l: "Descuadres de caja" }] : []),
    { k: "resultado", l: "Beneficio del negocio", b: true, r: true },
    // Solo los socios (#14): el reparto no es gasto, va debajo del beneficio
    ...(d.socio ? [{ k: "reparto_sobres", l: "Reparto a socios", neg: true }, { k: "resultado_tras_reparto", l: "Resultado después del reparto", b: true, r2: true }] : []),
  ];
  const margenFilas = [
    { l: "Venta sin IVA (Epos)", f: (m) => m.epos_sin_iva },
    { l: "Coste de lo vendido (Epos)", f: (m) => m.epos_coste },
    { l: "Margen real", f: (m) => (m.epos_sin_iva ? (m.epos_sin_iva - m.epos_coste) / m.epos_sin_iva * 100 : null), pct: true },
    { l: "Compras − coste de lo vendido", f: (m) => (m.epos_coste ? n0(m.compras_mercancia ?? m.mercancia) - m.epos_coste : null), alerta: true },
  ];
  // #71: se exporta exactamente lo que se ve (mismos meses, filas y modo)
  const exportar = async (tipo) => {
    setExportando(tipo);
    try {
      const t = armarTabla({ meses, filas, margenFilas, modo, mes });
      await (tipo === "xlsx" ? exportarExcel(t) : exportarPdf(t));
    } catch (e) { window.alert("No se ha podido generar el archivo. Inténtalo de nuevo."); }
    setExportando(null);
  };
  return (
    <>
      <div className="card">
        <div className="head">
          <div><h2>Cuenta de resultados</h2><p className="sub">Como la hoja de Ingresos y gastos (con IVA), pero agrupada por tipo de gasto. Pulsa un mes para ver el detalle.</p></div>
          <div className="fpl-acciones">
            <div className="seg" role="group" aria-label="Unidades">
              <button aria-pressed={modo === "eur"} onClick={() => setModo("eur")}>€</button>
              <button aria-pressed={modo === "pct"} onClick={() => setModo("pct")}>% de ingresos</button>
            </div>
            <button className="btn-l" disabled={!!exportando} onClick={() => exportar("xlsx")}>{exportando === "xlsx" ? "Generando…" : "Descargar Excel"}</button>
            <button className="btn-l" disabled={!!exportando} onClick={() => exportar("pdf")}>{exportando === "pdf" ? "Generando…" : "Descargar PDF"}</button>
          </div>
        </div>
        <div className="tabla-scroll" ref={scroll}>
          <table className="fpl">
            <thead><tr><th />{meses.map((m) => <th key={m.mes} className={`${m.mes === mes.mes ? "sel" : ""}${m.cerrado ? "" : " curso"}`}><button onClick={() => setSel(m.mes)}>{mesCorto(m.mes)}<small>{String(parseDate(m.mes).getFullYear()).slice(2)}</small>{!m.cerrado && <small className="ec"> · {m.mes === mesHoy ? "en curso" : "provisional"}</small>}</button></th>)}</tr></thead>
            <tbody>
              {filas.map((f) => f.sep ? <tr key={f.k} className="sep"><th colSpan={meses.length + 1}>{f.l}</th></tr> : (
                <tr key={f.k} className={`${f.b || f.b2 ? "b" : ""}${f.r ? " r" : ""}${f.r2 ? " r tras" : ""}`}>
                  <th>{f.l}</th>
                  {meses.map((m) => { const txt = f.get ? (f.get(m) == null ? "–" : val(m, n0(f.get(m)))) : f.neg && f.k === "reparto_sobres" && n0(m[f.k]) ? `−${val(m, n0(m[f.k]))}` : val(m, n0(m[f.k])); return <td key={m.mes} className={`${m.mes === mes.mes ? "sel" : ""}${m.cerrado ? "" : " curso"}${f.r ? (n0(f.get ? f.get(m) : m[f.k]) >= 0 ? " up" : " down") : ""}${f.r2 ? (n0(m.resultado_tras_reparto) >= 0 ? " up" : " neg-fuerte") : ""}`}>{txt === "–" ? txt : <button className="cifra" title="Ver de dónde sale" onClick={() => setCifra({ f, m })}>{txt}</button>}</td>; })}
                </tr>
              ))}
              <tr className="sep"><th colSpan={meses.length + 1}>Margen real según Epos (sin IVA)</th></tr>
              {margenFilas.map((f) => (
                <tr key={f.l}>
                  <th>{f.l}</th>
                  {meses.map((m) => { const v = f.f(m); return <td key={m.mes} className={`${m.mes === mes.mes ? "sel" : ""}${m.cerrado ? "" : " curso"}${f.alerta && v > 1000 ? " down" : ""}`}>{v == null ? "–" : f.pct ? pct(v, 1) : num(v)}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {mes && <DetalleMes mes={mes} disponibles={disponibles} onCambio={recargar} onEditMonth={onEditMonth} />}
      {cifra && <VentanaCifra f={cifra.f} m={cifra.m} filas={filas} socio={!!d.socio} onClose={() => setCifra(null)} onEditMonth={onEditMonth} />}
    </>
  );
}

// ---------- #70: pulsar una cifra de la Cuenta de resultados y ver de qué partidas sale ----------
// Solo consulta. Las partidas salen de fin_cuenta_partidas(), que usa exactamente las mismas fuentes que dash_finanzas().
const partidasCache = {};
const PAGO = { tarjeta: "Tarjeta", banco: "Banco", efectivo: "Efectivo", caja_fuerte: "Caja fuerte", efectivo_sobres: "Efectivo de sobres", efectivo_caja: "Efectivo de caja", sin_indicar: "Sin indicar" };
const fechaP = (f) => (f ? parseDate(String(f).slice(0, 10)).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) : "");
const valorFila = (f, m) => (f.get ? f.get(m) : m[f.k]);
// pantalla donde se cambia cada cifra
const ENLACE = {
  ventas: "cierre", paqueteria: "cierre", personal: "cierre", local: "cierre", servicios: "cierre", impuestos: "cierre", otros: "cierre",
  descuadres_caja: "cierre", variacion_existencias: "cierre",
  mercancia: "facturas", compras_mercancia: "facturas", mantenimiento: "mantenimiento", reparto_sobres: "sobres",
};
const PANTALLA = {
  cierre: { l: "Cierre de mes", ruta: "#/finanzas/resultados/cierre" },
  facturas: { l: "Facturas", ruta: "#/finanzas/gastos/facturas" },
  mantenimiento: { l: "Mantenimiento", ruta: "#/finanzas/gastos/mantenimiento" },
  sobres: { l: "Efectivo de sobres", ruta: "#/finanzas/efectivo/sobres" },
};

// filas que son suma de otras filas: las partidas son esas filas, con su signo
function partidasCompuestas(k, m, filas) {
  const gastoFilas = filas.filter((f) => !f.sep && f.neg && !["gastos", "reparto_sobres", "compras_mercancia", "variacion_existencias"].includes(f.k));
  const gastos = gastoFilas.map((f) => ({ c: f.l, i: n0(valorFila(f, m)) }));
  if (k === "gastos") return gastos;
  if (k === "resultado_tienda") return [{ c: "Ventas (con IVA)", i: n0(m.ventas) }, { c: "Gastos (se restan)", i: -n0(m.gastos) }];
  if (k === "resultado_paqueteria") return [{ c: "Ingresos de paquetería", i: n0(m.paqueteria) }];
  if (k === "ingresos") return [{ c: "Ventas (con IVA)", i: n0(m.ventas) }, { c: "Ingresos de paquetería", i: n0(m.paqueteria) }];
  if (k === "resultado") return [{ c: "Ventas (con IVA)", i: n0(m.ventas) }, { c: "Ingresos de paquetería", i: n0(m.paqueteria) }, { c: "Gastos (se restan)", i: -n0(m.gastos) },
    ...(n0(m.descuadres_caja) ? [{ c: "Descuadres de caja", i: n0(m.descuadres_caja) }] : [])];
  if (k === "resultado_tras_reparto") return [{ c: "Beneficio del negocio", i: n0(m.resultado) }, { c: "Reparto a socios (se resta)", i: -n0(m.reparto_sobres) }];
  return null;
}

function VentanaCifra({ f, m, filas, socio, onClose, onEditMonth }) {
  const compuesta = partidasCompuestas(f.k, m, filas);
  const [datos, setDatos] = useState(compuesta ? null : partidasCache[m.mes] || null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    if (compuesta || datos) return;
    let vivo = true;
    sb.rpc("fin_cuenta_partidas", { p_mes: m.mes })
      .then((r) => { partidasCache[m.mes] = r; if (vivo) setDatos(r); })
      .catch(() => { if (vivo) setFallo(true); });
    return () => { vivo = false; };
  }, [m.mes]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = n0(valorFila(f, m));
  const lista = compuesta || (datos ? datos.filas?.[f.k] || [] : null);
  const suma = lista ? lista.filter((p) => !p.nota).reduce((s, p) => s + n0(p.i), 0) : 0;
  const cuadra = Math.abs(suma - total) < 0.01;
  const verDoc = async (doc) => {
    const w = window.open("", "_blank");
    try {
      let url;
      if (doc.t === "recepcion") { const r = await sb.fn("recepcion", { accion: "abrir", id: doc.id }); url = r?.recepcion?.doc_url || r?.recepcion?.foto_url; }
      else { const r = await sb.fn("mantenimiento-foto", { accion: "ver", id: doc.id }); url = r?.url; }
      if (!url) throw new Error("sin documento");
      if (w) w.location = url; else window.location.href = url;
    } catch (e) { if (w) w.close(); window.alert("No se ha podido abrir el documento."); }
  };
  const pant = PANTALLA[ENLACE[f.k]];
  const ir = () => {
    onClose();
    if (ENLACE[f.k] === "cierre" && onEditMonth) onEditMonth(m.mes.slice(0, 7));
    else window.location.hash = pant.ruta;
  };
  const signo = f.k === "reparto_sobres" && total ? "−" : "";
  return (
    <Panel titulo={`${f.l} · ${mesAnio(m.mes)}`} sub={!m.cerrado ? avisoProvisional(m) : undefined} onClose={onClose} ancho="520px"
      pie={pant ? <button className="btn-l" onClick={ir}>Cambiar en {pant.l} →</button> : null}>
      <div className="vc-total"><span>Total</span><b>{signo}{eur(total, 2)}</b></div>
      {fallo ? <p className="empty">No se han podido cargar las partidas. Inténtalo de nuevo.</p>
        : !lista ? <p className="empty">Cargando…</p>
        : Math.abs(total) < 0.005 && !lista.some((p) => n0(p.i)) ? <p className="empty">Sin partidas este mes</p>
        : <>
          <ul className="vc-lista">
            {lista.map((p, i) => (
              <li key={i} className={p.nota ? "nota" : ""}>
                <div className="vc-l">
                  <span className="vc-c">{p.c}{p.doc && <button className="btn-txt" title="Ver el documento" aria-label="Ver el documento" onClick={() => verDoc(p.doc)}>📄</button>}</span>
                  <small>{[fechaP(p.f), PAGO[p.d] || p.d, p.nota ? "no suma" : ""].filter(Boolean).join(" · ")}</small>
                  {(p.sub || []).length > 0 && <small className="vc-sub">{p.sub.map((x) => `${fechaP(x.f)}: ${eur(n0(x.i), 2)}`).join(" · ")}</small>}
                </div>
                <span className="vc-i">{p.i == null ? "–" : eur(n0(p.i), 2)}</span>
              </li>
            ))}
          </ul>
          <div className={`vc-suma${cuadra ? "" : " mal"}`}><span>Suma de las partidas</span><b>{eur(suma, 2)}</b></div>
          {!cuadra && <p className="sub" style={{ color: "#B42318", fontWeight: 700 }}>No cuadra con la tabla ({eur(suma - total, 2)} de diferencia). Avisa a Tecnología.</p>}
          {f.k === "personal" && !socio && lista.some((p) => /Extras/.test(p.c)) && <p className="sub">El detalle de los extras solo lo ven los socios.</p>}
        </>}
    </Panel>
  );
}

// #68: mes con el que se compara (delta = meses de diferencia, −1 anterior, −12 mismo mes del año pasado)
// #76: aviso de los meses sin cerrar (el mes en curso, o uno pasado aún sin cerrar o reabierto)
function avisoProvisional(m) { const h = new Date(); const hoy = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-01`; return m.mes === hoy ? "Mes en curso: cifras provisionales hasta hoy" : "Mes sin cerrar: cifras provisionales"; }
function claveMes(mes, delta) { const f = parseDate(mes); const x = new Date(f.getFullYear(), f.getMonth() + delta, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-01`; }

function Comparacion({ mes, disponibles }) {
  const ant = disponibles[claveMes(mes.mes, -1)], anio = disponibles[claveMes(mes.mes, -12)];
  const filas = [
    { l: "Ventas (con IVA)", k: "ventas" },
    { l: "Ingresos", k: "ingresos", b: true },
    ...CATS.map((c) => ({ l: c.label, k: c.id, gasto: true })),
    { l: "Gastos", k: "gastos", gasto: true, b: true },
    { l: "Beneficio del negocio", k: "resultado", b: true },
  ];
  const celdas = (f, base) => {
    if (!base) return [<td key="v">–</td>, <td key="d">–</td>];
    const v = n0(mes[f.k]), b = n0(base[f.k]), dif = v - b;
    const pc = b ? dif / Math.abs(b) * 100 : null;
    const bien = Math.abs(dif) < 0.5 ? "" : (f.gasto ? dif < 0 : dif > 0) ? " bien" : " mal";
    return [<td key="v">{num(b)}</td>, <td key="d" className={`dif${bien}`}>{`${dif > 0.5 ? "+" : ""}${num(dif)} €`}{pc == null ? " · –" : ` · ${pc > 0 ? "+" : ""}${num(pc, 1)} %`}</td>];
  };
  return (
    <div className="card c12">
      <h2>Comparación</h2>
      <p className="sub">{mesAnio(mes.mes)} frente al mes anterior ({mesAnio(claveMes(mes.mes, -1))}) y al mismo mes del año anterior ({mesAnio(claveMes(mes.mes, -12))}). Verde = mejor, rojo = peor.</p>
      {!mes.cerrado && ant && <p className="sub" style={{ color: "#9A4A00", fontWeight: 700 }}>Compara un mes a medias con un mes completo.</p>}
      <div className="tabla-scroll">
        <table className="fpl comp">
          <thead><tr><th /><th>{mesCorto(mes.mes)} {String(parseDate(mes.mes).getFullYear()).slice(2)}</th><th>Mes anterior</th><th>Diferencia</th><th>Año anterior</th><th>Diferencia</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.k} className={f.b ? "b" : ""}>
                <th>{f.l}</th><td>{num(n0(mes[f.k]))}</td>{celdas(f, ant)}{celdas(f, anio)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetalleMes({ mes, disponibles, onCambio, onEditMonth }) {
  const [guardando, setGuardando] = useState(null);
  const cambiar = async (concepto, categoria) => {
    setGuardando(concepto);
    await supabase.from("fin_conceptos").upsert({ concepto, categoria, actualizado: new Date().toISOString() });
    await onCambio();
    setGuardando(null);
  };
  const fijos = mes.fijos_det || {};
  const FIJ = { ss: "Seguridad Social", alquiler: "Alquiler", iva_alquiler: "IVA del alquiler", luz: "Luz", agua: "Agua", ayuntamiento: "Ayuntamiento", asesoria: "Asesoría", securitas: "Securitas", epos: "Epos" };
  return (
    <div className="grid">
      <Comparacion mes={mes} disponibles={disponibles} />
      <div className="card c6">
        <div className="head">
          <div><h2>{mesAnio(mes.mes)}</h2><p className="sub">Resultado {eur(sinDecimales(mes.resultado))} · {pct(mes.ingresos ? mes.resultado / mes.ingresos * 100 : 0)} de los ingresos</p>
            {!mes.cerrado && <p className="sub" style={{ color: "#9A4A00", fontWeight: 700 }}>{avisoProvisional(mes)}</p>}
            {n0(mes.descuadres_caja) !== 0 && <p className="sub">Incluye {eur(mes.descuadres_caja, 2)} de descuadres de caja{mes.descuadre_tarjeta != null ? `: efectivo de los sobres ${eur(n0(mes.descuadre_efectivo), 2)} · tarjeta (cajas 1 y 2) ${eur(n0(mes.descuadre_tarjeta), 2)}` : " (sobres)"}</p>}
            {n0(mes.sobres_sin_revisar) > 0 && <p className="sub" style={{ color: "#9A4A00", fontWeight: 700 }}>{mes.sobres_sin_revisar} sobre{mes.sobres_sin_revisar === 1 ? "" : "s"} sin revisar en la Apertura de sobres: cuentan como correctos.</p>}
          </div>
          {onEditMonth && <button className="btn-l" onClick={() => onEditMonth(mes.mes.slice(0, 7))}>Editar mes</button>}
        </div>
        <h3 className="fh3">Compras de mercancía</h3>
        <ul className="pq-l">
          <li><span>Facturas de proveedores{mes.facturas_n ? ` (${mes.facturas_n} en la app)` : ""}</span><b>{eur(sinDecimales(mes.facturas))}</b></li>
          {mes.facturas_historico > 0 && <li className="nota"><span>de ellas, total de la hoja sin detalle</span><span>{eur(sinDecimales(mes.facturas_historico))}</span></li>}
                    {/* #46: «tarjeta» y «banco» se suman en una sola cifra «Banco» */}
          {[["facturas_efectivo", "pagadas en efectivo"], ["facturas_banco", "por banco"], ["facturas_caja_fuerte", "de la caja fuerte"], ["facturas_sobres", "con efectivo de sobres"]].map(([k, t]) => [k, t, k === "facturas_banco" ? n0(mes.facturas_banco) + n0(mes.facturas_tarjeta) : n0(mes[k])]).filter(([, , v]) => v).map(([k, t, v]) => <li key={k} className="nota"><span>de ellas, {t}</span><span>{eur(sinDecimales(v))}</span></li>)}
          {n0(mes.facturas_pendientes) > 0 && <li className="nota" style={{ color: "#9A4A00" }}><span>{mes.facturas_pendientes} pendiente{mes.facturas_pendientes > 1 ? "s" : ""} de importe (no cuentan todavía)</span><span>–</span></li>}
        </ul>
        {/* #69: paquetería cobrada por empresa (desde octubre de 2026, de BBVA; antes, lo metido en el Cierre de mes) */}
        <h3 className="fh3">Paquetería</h3>
        <ul className="pq-l">
          {Object.entries(mes.paqueteria_det || {}).filter(([, v]) => n0(v)).sort((a, b) => n0(b[1]) - n0(a[1])).map(([k, v]) => <li key={k}><span>{k}</span><span>{eur(n0(v), 2)}</span></li>)}
          <li className="total"><span><b>Total paquetería</b></span><b>{eur(n0(mes.paqueteria), 2)}</b></li>
        </ul>
        <h3 className="fh3">Salarios</h3>
        <ul className="pq-l">
          {(mes.salarios_det || []).filter((s) => n0(s.amount)).map((s) => <li key={s.id}><span>{s.nombre || "Sin nombre"}</span><span>{eur(n0(s.amount), 2)}</span></li>)}
          {n0(mes.extras) > 0 && <li><span>Extras a trabajadoras (efectivo de sobres)</span><span>{eur(n0(mes.extras), 2)}</span></li>}
        </ul>
        <h3 className="fh3">Gastos fijos</h3>
        <ul className="pq-l">
          {Object.entries(fijos).filter(([, v]) => n0(v)).map(([k, v]) => <li key={k}><span>{FIJ[k] || k}</span><span>{eur(n0(v), 2)}</span></li>)}
        </ul>
      </div>
      <div className="card c6">
        <h2>Otros gastos</h2>
        <p className="sub">Cambia la categoría de un concepto y se aplica a todos los meses.</p>
        {(mes.lineas || []).length === 0 ? <p className="empty">Sin otros gastos.</p> : (
          <ul className="flineas">
            {mes.lineas.map((l, i) => (
              <li key={l.concepto + i}>
                <span className="n">{l.concepto}</span>
                <select value={l.categoria} disabled={guardando === l.concepto} onChange={(e) => cambiar(l.concepto, e.target.value)} aria-label={`Categoría de ${l.concepto}`}>
                  {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <span className="v">{eur(n0(l.importe), 2)}</span>
              </li>
            ))}
          </ul>
        )}
        {(mes.mantenimiento_det || []).length > 0 && <>
          <h3 className="fh3">Mantenimiento</h3>
          <ul className="pq-l">
            {mes.mantenimiento_det.map((l) => <li key={l.id}><span>{l.concepto}</span><span>{eur(n0(l.importe), 2)}</span></li>)}
          </ul>
          <a className="sub" href="#/finanzas/mantenimiento">Gestionar en Mantenimiento</a>
        </>}
        {n0(mes.inversiones) > 0 && <p className="sub fuera">Inversiones (fuera del resultado): {eur(sinDecimales(mes.inversiones))}</p>}
      </div>
    </div>
  );
}

// ---------- 3. Caja ----------
// Diferencia de efectivo de un día. Si ese día se pagaron facturas en efectivo y la diferencia
// se explica por esos pagos (se contó después de pagar), se descuentan.
function difEfectivo(x) {
  const bruto = n0(x.contado_efectivo) - n0(x.epos_efectivo);
  // #25: desde el 24/10 lo contado sale de los cierres de Epos, que ya cuentan las facturas pagadas desde el cajón
  if (x.fuente === "epos") return { v: bruto, porPagos: false };
  const ajustada = bruto + n0(x.pagos_efectivo);
  const porPagos = n0(x.pagos_efectivo) > 0 && Math.abs(ajustada) < Math.abs(bruto);
  return { v: porPagos ? ajustada : bruto, porPagos };
}
// #81: mes del cuadre (por defecto el mes en curso; «#/finanzas/efectivo/caja?mes=2026-10» abre ese mes)
const mesDeRuta = () => { const m = /[?&]mes=(\d{4}-\d{2})/.exec(window.location.hash || ""); return m ? m[1] : null; };
function SelectorMes({ mes, meses, onChange }) {
  return (
    <label className="filtros-linea" style={{ margin: 0 }}>
      <span className="sub" style={{ margin: 0 }}>Mes</span>
      <select value={mes} onChange={(e) => onChange(e.target.value)}>{meses.map((m) => <option key={m} value={m}>{mesAnio(`${m}-01`)}</option>)}</select>
    </label>
  );
}
export function FinanzasCaja() {
  const { d, fallo } = useFinanzas();
  const [mesSel, setMesSel] = useState(() => mesDeRuta());
  useEffect(() => { const h = () => { const m = mesDeRuta(); if (m) setMesSel(m); }; window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  if (!d) return <Estado fallo={fallo} />;
  const mesHoy = d.hoy.slice(0, 7);
  const meses = [...new Set([...d.caja.map((x) => x.fecha.slice(0, 7)).filter((m) => m < "2026-10"), ...(() => { const r = []; for (let m = "2026-10"; m <= mesHoy; m = claveMes(`${m}-01`, 1).slice(0, 7)) r.push(m); return r; })()])].sort().reverse();
  const mes = mesSel && meses.includes(mesSel) ? mesSel : mesHoy;
  const cambiarMes = (m) => { setMesSel(m); try { window.history.replaceState(null, "", `#/finanzas/efectivo/caja${m === mesHoy ? "" : `?mes=${m}`}`); } catch (e) { /* sin historial */ } };
  if (mes >= "2026-10") {
    return (
      <>
        <div className="grid"><div className="c12"><CajaFuerte /></div></div>
        <div className="grid">
          <div className="card c12">
            <div className="head">
              <div><h2>Cuadre por turno</h2><p className="sub">Cada cierre de Epos (turno y caja): efectivo y tarjeta frente a lo contado, y la tarjeta de cada día frente al banco. Aquí se confirma; el Cierre de mes solo enseña los totales.</p></div>
              <SelectorMes mes={mes} meses={meses} onChange={cambiarMes} />
            </div>
            <CuadreTurnos mes={mes} />
          </div>
        </div>
        <RecorridoEfectivo meses={d.meses} />
      </>
    );
  }
  const dias = d.caja.filter((x) => x.fecha < d.hoy && x.fecha.startsWith(mes));
  const completos = dias.filter((x) => x.cierres >= 2);
  const difEf = completos.reduce((s, x) => s + difEfectivo(x).v, 0);
  const difTj = completos.reduce((s, x) => s + n0(x.contado_tarjeta) - n0(x.epos_tarjeta), 0);
  return (
    <>
      <div className="grid"><div className="c12"><CajaFuerte /></div></div>
      <div className="grid">
        <Kpi titulo="Días con los dos cierres" valor={`${completos.length} de ${dias.length}`} sub={`${dias.length} días con datos de ${mesAnio(`${mes}-01`).toLowerCase()}`} tono={completos.length < dias.length ? "mal" : ""} />
        <Kpi titulo="Descuadre de efectivo" valor={eur(difEf, 0)} sub="Contado menos Epos en los días con los dos cierres, descontando las facturas pagadas de la caja" tono={Math.abs(difEf) > 50 ? "mal" : ""} />
        <Kpi titulo="Descuadre de tarjeta" valor={eur(difTj, 0)} sub="Datáfono contado menos Epos" tono={Math.abs(difTj) > 50 ? "mal" : ""} />
      </div>
      <div className="grid">
        <div className="card c12">
          <div className="head">
            <div><h2>Cuadre diario</h2><p className="sub">Lo que registra Epos frente a lo que cuentan las trabajadoras al cerrar cada turno (desde el 24 de octubre, lo contado en los cierres de Epos)</p></div>
            <SelectorMes mes={mes} meses={meses} onChange={cambiarMes} />
          </div>
          <div className="tabla-scroll">
            <table className="ranking fcaja">
              <thead><tr><th>Día</th><th className="r">Efectivo Epos</th><th className="r">Contado</th><th className="r">Pagos en efectivo</th><th className="r">Diferencia</th><th className="r">Tarjeta Epos</th><th className="r">Contado</th><th className="r">Diferencia</th><th>Cierres</th></tr></thead>
              <tbody>
                {dias.map((x) => {
                  const falta = x.cierres < 2;
                  const de = difEfectivo(x), dt = n0(x.contado_tarjeta) - n0(x.epos_tarjeta);
                  return (
                    <tr key={x.fecha} className={falta ? "falta" : ""}>
                      <td>{diaCortito(x.fecha)}</td>
                      <td className="r">{eur(x.epos_efectivo, 2)}</td>
                      <td className="r">{x.cierres ? eur(x.contado_efectivo, 2) : "–"}</td>
                      <td className="r">{n0(x.pagos_efectivo) ? eur(x.pagos_efectivo, 2) : "–"}</td>
                      <td className={`r b ${falta ? "" : Math.abs(de.v) > 10 ? "down" : ""}`} data-tip={de.porPagos ? "Descontadas las facturas pagadas en efectivo ese día: se contó la caja después de pagarlas." : undefined}>{falta ? "–" : eur(de.v, 2)}{de.porPagos && !falta ? " *" : ""}</td>
                      <td className="r">{eur(x.epos_tarjeta, 2)}</td>
                      <td className="r">{x.cierres ? eur(x.contado_tarjeta, 2) : "–"}</td>
                      <td className={`r b ${falta ? "" : Math.abs(dt) > 10 ? "down" : ""}`}>{falta ? "–" : eur(dt, 2)}</td>
                      <td>{falta ? <span className="chip-mal">{x.cierres ? `Falta ${x.turnos.includes("mañana") ? "tarde" : "mañana"}` : "Sin cierres"}</span> : "Mañana y tarde"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="sub fuera">* Diferencia una vez descontadas las facturas pagadas en efectivo ese día (hasta el 8 de septiembre se contaba la caja después de pagarlas). Los cierres se registran en la app desde el 30 de julio de 2026; desde el 24 de octubre, el efectivo y la tarjeta contados salen de los cierres de Epos (cuentan las facturas pagadas desde el cajón como dinero) y el detalle por turno y caja está en Cierre de mes → «Epos frente a cierres».</p>
        </div>
      </div>
      <RecorridoEfectivo meses={d.meses} />
    </>
  );
}
// #82: recorrido del efectivo de la caja al sobre (mes anterior y mes en curso); las cifras vienen de caja_recorrido_efectivo()
function RecorridoEfectivo({ meses }) {
  const [r, setR] = useState(null);
  useEffect(() => { supabase.rpc("caja_recorrido_efectivo").then(({ data }) => setR(Array.isArray(data) ? data : []), () => setR([])); }, []);
  if (!r) return null;
  const v = (x, signo) => (x == null ? "–" : `${signo && n0(x) ? signo : ""}${eur(n0(x), 2)}`);
  const lineas = [
    ["Venta en efectivo según Epos", (m) => v(m.venta_epos), "Suma del efectivo esperado de los cierres de Epos del mes."],
    ["Descuadres de efectivo (contado − esperado)", (m) => v(m.descuadre), "Diferencia entre lo que contaron las trabajadoras y lo que dice Epos, turno a turno."],
    ["= Efectivo contado en los cierres", (m) => v(m.contado_cierres), null, true],
    ["− Pagado desde el cajón", (m) => v(m.pagado_cajon), "Facturas con «Efectivo (caja)» y mantenimientos con «Efectivo de caja»."],
    ["= Debería haber en los sobres", (m) => v(m.deberia), "Lo mismo que da como esperado la Apertura de sobres.", true],
    ["Contado al abrir los sobres", (m) => (m.contado_apertura != null ? v(m.contado_apertura) : m.mes >= "2026-10" ? "Pendiente de abrir" : "–"), "Se da por abierto cuando todos los sobres del mes están revisados."],
    ["Diferencia entre lo contado y lo que debería haber", (m) => v(m.diferencia), null, true],
  ];
  const aviso = r.some((m) => m.cierres > 0 && m.sin_revisar > 0);
  return (
    <div className="grid">
      <div className="card c12">
        <h2>Recorrido del efectivo</h2>
        <p className="sub">Del efectivo que entra en caja a lo que debería haber en los sobres, con las mismas cifras de los cierres de Epos y de la Apertura de sobres.</p>
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th></th>{r.map((m) => <th key={m.mes} className="r">{mesAnio(m.mes + "-01")}{m.en_curso ? " (en curso)" : ""}</th>)}</tr></thead>
            <tbody>
              {lineas.map(([t, f, tip, b]) => (
                <tr key={t}><td className={b ? "b" : ""} data-tip={tip || undefined}>{t}</td>{r.map((m) => <td key={m.mes} className={`r${b ? " b" : ""}`}>{f(m)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        {aviso && <p className="sub fuera">Quedan sobres sin revisar: los descuadres de efectivo son provisionales hasta que se confirmen.</p>}
        {meses[meses.length - 1] && r.find((m) => m.en_curso && m.cierres > 0 && Math.abs(n0(meses[meses.length - 1].epos_efectivo) - n0(m.venta_epos)) > 0.5) && <p className="sub fuera">Epos lleva {eur(n0(meses[meses.length - 1].epos_efectivo), 2)} en efectivo este mes; la primera línea solo suma los turnos con cierre, por eso puede ser menor.</p>}
        <p className="sub fuera">Los cierres de Epos empiezan en octubre de 2026; en meses anteriores las líneas que no existen salen con «–». <a href="#/finanzas/efectivo/sobres">Lo que se hace con el efectivo de los sobres está en Efectivo de sobres →</a></p>
      </div>
    </div>
  );
}

// ---------- 4. Compras ----------
export function FinanzasCompras() {
  const { d, fallo } = useFinanzas();
  if (!d) return <Estado fallo={fallo} />;
  const meses = d.meses.filter((m) => m.cerrado).slice(-6);
  const actual = d.meses[d.meses.length - 1];
  const nombres = [mesCorto(d.meses[d.meses.length - 3].mes), mesCorto(d.meses[d.meses.length - 2].mes), mesCorto(actual.mes)];
  const total6 = meses.reduce((s, m) => s + (m.epos_coste ? n0(m.compras_mercancia ?? m.mercancia) - m.epos_coste : 0), 0);
  return (
    <>
      <div className="card">
        <h2>Compras frente a lo vendido</h2>
        <p className="sub">Compras de mercancía (facturas y productos pagados aparte) frente al coste de lo que se vendió según Epos. Si la diferencia es positiva mes tras mes, o crece el stock o los costes de Epos no son reales. El inventario lo aclara.</p>
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Mes</th><th className="r">Ventas</th><th className="r">Compras</th><th className="r">Coste vendido</th><th className="r">Diferencia</th><th className="r">Compras / ventas</th></tr></thead>
            <tbody>
              {meses.map((m) => {
                const dif = m.epos_coste ? n0(m.compras_mercancia ?? m.mercancia) - m.epos_coste : null;
                return (
                  <tr key={m.mes}>
                    <td>{mesAnio(m.mes)}</td>
                    <td className="r">{eur(sinDecimales(m.ventas))}</td>
                    <td className="r">{eur(sinDecimales(m.compras_mercancia ?? m.mercancia))}</td>
                    <td className="r">{eur(sinDecimales(m.epos_coste))}</td>
                    <td className={`r b ${dif > 1000 ? "down" : ""}`}>{dif == null ? "–" : `${dif > 0 ? "+" : ""}${eur(sinDecimales(dif))}`}</td>
                    <td className="r">{pct(n0(m.compras_mercancia ?? m.mercancia) / m.ventas * 100, 0)}</td>
                  </tr>
                );
              })}
              <tr className="tot"><td>Últimos {meses.length} meses</td><td /><td /><td /><td className="r b">{total6 > 0 ? "+" : ""}{eur(sinDecimales(total6))}</td><td /></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid">
        <div className="card c12">
          <div className="head">
            <div><h2>Proveedores</h2><p className="sub">Facturas registradas en la app, últimos tres meses</p></div>
            <a className="enlace" href="#/finanzas/facturas">Ver facturas →</a>
          </div>
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>Proveedor</th>{nombres.map((n, i) => <th key={i} className="r">{n}{i === 2 ? " (en curso)" : ""}</th>)}<th className="r">Facturas</th></tr></thead>
              <tbody>
                {d.proveedores.map((p) => (
                  <tr key={p.clave}>
                    <td><span className="pn">{p.nombre}</span>{p.variantes.length > 1 && <span className="pf aviso-txt">Escrito de {p.variantes.length} formas: {p.variantes.join(" / ")}</span>}</td>
                    <td className="r">{p.m2 ? eur(sinDecimales(p.m2)) : "–"}</td>
                    <td className="r">{p.m1 ? eur(sinDecimales(p.m1)) : "–"}</td>
                    <td className="r">{p.m0 ? eur(sinDecimales(p.m0)) : "–"}</td>
                    <td className="r">{p.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
