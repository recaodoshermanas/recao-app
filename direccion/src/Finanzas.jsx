// Finanzas: todo sale de dash_finanzas() (datos del mes, facturas, Epos y cierres de caja).
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { initTips } from "./charts.js";
import { eur, eurK, pct, num, mesCorto, mesAnio, parseDate } from "./fmt.js";

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
export function FinanzasResumen() {
  const { d, fallo } = useFinanzas();
  if (!d) return <Estado fallo={fallo} />;
  const c = mesEnCurso(d);
  const cerrados = d.meses.filter((m) => m.cerrado).slice(-12);
  const ult = c.ult;
  const nombreMesActual = mesAnio(d.mes_actual);

  // avisos
  const avisos = [];
  if (ult && ult.epos_coste) {
    const gap = ult.mercancia - ult.epos_coste;
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
  const mesN = parseDate(d.mes_actual).getMonth();
  if ([0, 3, 6, 9].includes(mesN) && parseDate(hoy).getDate() <= 20) avisos.push({ t: `Este mes toca el pago trimestral de IVA (hasta el día 20). No está en la previsión de abajo.` });

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
            ? <a key={i} className="aviso" href={`#/${a.ruta}`}><b>!</b><span>{a.t}</span><i aria-hidden="true">→</i></a>
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

      {ult && <Estructura mes={ult} />}
    </>
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
  const scroll = useRef(null);
  const meses = useMemo(() => (d ? d.meses.filter((m) => m.cerrado).slice(-12) : []), [d]);
  useEffect(() => { if (meses.length && !sel) setSel(meses[meses.length - 1].mes); }, [meses, sel]);
  // en pantallas estrechas, que se vean primero los meses más recientes
  useEffect(() => { const el = scroll.current; if (el) el.scrollLeft = el.scrollWidth; }, [meses.length]);
  if (!d) return <Estado fallo={fallo} />;
  const mes = meses.find((m) => m.mes === sel) || meses[meses.length - 1];
  const val = (m, v) => (modo === "pct" ? (m.ingresos ? pct(v / m.ingresos * 100, 1) : "–") : num(v));
  const filas = [
    { k: "ventas", l: "Ventas (con IVA)" }, { k: "paqueteria", l: "Paquetería" }, { k: "ingresos", l: "Ingresos", b: true },
    ...CATS.map((c) => ({ k: c.id, l: c.label, neg: true })),
    { k: "gastos", l: "Gastos", b: true, neg: true }, { k: "resultado", l: "Resultado", b: true, r: true },
  ];
  const margenFilas = [
    { l: "Venta sin IVA (Epos)", f: (m) => m.epos_sin_iva },
    { l: "Coste de lo vendido (Epos)", f: (m) => m.epos_coste },
    { l: "Margen real", f: (m) => (m.epos_sin_iva ? (m.epos_sin_iva - m.epos_coste) / m.epos_sin_iva * 100 : null), pct: true },
    { l: "Compras − coste de lo vendido", f: (m) => (m.epos_coste ? m.mercancia - m.epos_coste : null), alerta: true },
  ];
  return (
    <>
      <div className="card">
        <div className="head">
          <div><h2>Cuenta de resultados</h2><p className="sub">Como la hoja de Ingresos y gastos (con IVA), pero agrupada por tipo de gasto. Pulsa un mes para ver el detalle.</p></div>
          <div className="seg" role="group" aria-label="Unidades">
            <button aria-pressed={modo === "eur"} onClick={() => setModo("eur")}>€</button>
            <button aria-pressed={modo === "pct"} onClick={() => setModo("pct")}>% de ingresos</button>
          </div>
        </div>
        <div className="tabla-scroll" ref={scroll}>
          <table className="fpl">
            <thead><tr><th />{meses.map((m) => <th key={m.mes} className={m.mes === mes.mes ? "sel" : ""}><button onClick={() => setSel(m.mes)}>{mesCorto(m.mes)}<small>{String(parseDate(m.mes).getFullYear()).slice(2)}</small></button></th>)}</tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.k} className={`${f.b ? "b" : ""}${f.r ? " r" : ""}`}>
                  <th>{f.l}</th>
                  {meses.map((m) => <td key={m.mes} className={`${m.mes === mes.mes ? "sel" : ""}${f.r ? (m.resultado >= 0 ? " up" : " down") : ""}`}>{val(m, n0(m[f.k]))}</td>)}
                </tr>
              ))}
              <tr className="sep"><th colSpan={meses.length + 1}>Margen real según Epos (sin IVA)</th></tr>
              {margenFilas.map((f) => (
                <tr key={f.l}>
                  <th>{f.l}</th>
                  {meses.map((m) => { const v = f.f(m); return <td key={m.mes} className={`${m.mes === mes.mes ? "sel" : ""}${f.alerta && v > 1000 ? " down" : ""}`}>{v == null ? "–" : f.pct ? pct(v, 1) : num(v)}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {mes && <DetalleMes mes={mes} categorias={d.categorias} onCambio={recargar} onEditMonth={onEditMonth} />}
    </>
  );
}

function DetalleMes({ mes, onCambio, onEditMonth }) {
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
      <div className="card c6">
        <div className="head">
          <div><h2>{mesAnio(mes.mes)}</h2><p className="sub">Resultado {eur(sinDecimales(mes.resultado))} · {pct(mes.ingresos ? mes.resultado / mes.ingresos * 100 : 0)} de los ingresos</p></div>
          {onEditMonth && <button className="btn-l" onClick={() => onEditMonth(mes.mes.slice(0, 7))}>Editar mes</button>}
        </div>
        <h3 className="fh3">Compras de mercancía</h3>
        <ul className="pq-l">
          <li><span>Facturas de proveedores{mes.facturas_n ? ` (${mes.facturas_n} en la app)` : ""}</span><b>{eur(sinDecimales(mes.facturas))}</b></li>
          {mes.facturas_historico > 0 && <li className="nota"><span>de ellas, total de la hoja sin detalle</span><span>{eur(sinDecimales(mes.facturas_historico))}</span></li>}
        </ul>
        <h3 className="fh3">Salarios</h3>
        <ul className="pq-l">
          {(mes.salarios_det || []).filter((s) => n0(s.amount)).map((s) => <li key={s.id}><span>{s.nombre || "Sin nombre"}</span><span>{eur(n0(s.amount), 2)}</span></li>)}
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
  const ajustada = bruto + n0(x.pagos_efectivo);
  const porPagos = n0(x.pagos_efectivo) > 0 && Math.abs(ajustada) < Math.abs(bruto);
  return { v: porPagos ? ajustada : bruto, porPagos };
}
export function FinanzasCaja() {
  const { d, fallo } = useFinanzas();
  if (!d) return <Estado fallo={fallo} />;
  const dias = d.caja.filter((x) => x.fecha < d.hoy);
  const hoyFila = d.caja.find((x) => x.fecha === d.hoy);
  const completos = dias.filter((x) => x.cierres >= 2);
  const difEf = completos.reduce((s, x) => s + difEfectivo(x).v, 0);
  const difTj = completos.reduce((s, x) => s + n0(x.contado_tarjeta) - n0(x.epos_tarjeta), 0);
  const actual = d.meses[d.meses.length - 1], anterior = d.meses[d.meses.length - 2];
  const efSinDestino = (m) => n0(m.epos_efectivo) - n0(m.facturas_efectivo);
  return (
    <>
      <div className="grid">
        <Kpi titulo="Días con los dos cierres" valor={`${completos.length} de ${dias.length}`} sub={`Últimos ${dias.length} días cerrados`} tono={completos.length < dias.length ? "mal" : ""} />
        <Kpi titulo="Descuadre de efectivo" valor={eur(difEf, 0)} sub="Contado menos Epos en los días con los dos cierres, descontando las facturas pagadas de la caja" tono={Math.abs(difEf) > 50 ? "mal" : ""} />
        <Kpi titulo="Descuadre de tarjeta" valor={eur(difTj, 0)} sub="Datáfono contado menos Epos" tono={Math.abs(difTj) > 50 ? "mal" : ""} />
        <Kpi titulo="Efectivo sin destino apuntado" valor={eur(sinDecimales(efSinDestino(anterior)))} sub={`${mesAnio(anterior.mes)}: entró ${eur(sinDecimales(anterior.epos_efectivo))} en efectivo y se pagaron ${eur(sinDecimales(anterior.facturas_efectivo))} en facturas`} tip="El resto del efectivo (ingresos al banco, sobres, pagos sin factura…) no queda registrado en ningún sitio." />
      </div>
      <div className="grid">
        <div className="card c12">
          <div className="head">
            <div><h2>Cuadre diario</h2><p className="sub">Lo que registra Epos frente a lo que cuentan las trabajadoras al cerrar cada turno</p></div>
            {hoyFila && <p className="sub">Hoy: {hoyFila.cierres} de 2 cierres hechos</p>}
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
          <p className="sub fuera">* Diferencia una vez descontadas las facturas pagadas en efectivo ese día (hasta el 8 de septiembre se contaba la caja después de pagarlas). Los cierres se registran en la app desde el 30 de julio de 2026.</p>
        </div>
      </div>
      <div className="grid">
        <div className="card c12">
          <h2>Efectivo del mes</h2>
          <dl className="kv">
            {[anterior, actual].map((m) => (
              <FilaEfectivo key={m.mes} m={m} />
            ))}
          </dl>
        </div>
      </div>
    </>
  );
}
function FilaEfectivo({ m }) {
  return (
    <>
      <dt>{mesAnio(m.mes)}: entra en efectivo</dt><dd>{eur(sinDecimales(m.epos_efectivo))}</dd>
      <dt>Facturas pagadas en efectivo</dt><dd>{eur(sinDecimales(m.facturas_efectivo))}</dd>
      <dt>Sin destino apuntado</dt><dd>{eur(sinDecimales(n0(m.epos_efectivo) - n0(m.facturas_efectivo)))}</dd>
    </>
  );
}

// ---------- 4. Compras ----------
export function FinanzasCompras() {
  const { d, fallo } = useFinanzas();
  if (!d) return <Estado fallo={fallo} />;
  const meses = d.meses.filter((m) => m.cerrado).slice(-6);
  const actual = d.meses[d.meses.length - 1];
  const nombres = [mesCorto(d.meses[d.meses.length - 3].mes), mesCorto(d.meses[d.meses.length - 2].mes), mesCorto(actual.mes)];
  const total6 = meses.reduce((s, m) => s + (m.epos_coste ? m.mercancia - m.epos_coste : 0), 0);
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
                const dif = m.epos_coste ? m.mercancia - m.epos_coste : null;
                return (
                  <tr key={m.mes}>
                    <td>{mesAnio(m.mes)}</td>
                    <td className="r">{eur(sinDecimales(m.ventas))}</td>
                    <td className="r">{eur(sinDecimales(m.mercancia))}</td>
                    <td className="r">{eur(sinDecimales(m.epos_coste))}</td>
                    <td className={`r b ${dif > 1000 ? "down" : ""}`}>{dif == null ? "–" : `${dif > 0 ? "+" : ""}${eur(sinDecimales(dif))}`}</td>
                    <td className="r">{pct(m.mercancia / m.ventas * 100, 0)}</td>
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
