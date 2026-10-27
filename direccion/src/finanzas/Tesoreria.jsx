// Finanzas → Banco → Tesorería (solicitud #89): el dinero real de hoy y a fin de cada mes. Sustituye al «Saldo estimado».
// «Próximos días» (solicitud #90) sale de tesoreria_prevision(): bancos de hoy + cobros previstos − pagos previstos, día a día.
// «¿Cuánto podemos repartir?» (solicitud #91) sale de tesoreria_repartir(): hoy + cobros − pagos a 60 días − un mes de gastos fijos. Solo socios.
// «Hoy» lee lo mismo que Bancos, Caja fuerte y Efectivo de sobres; «Evolución» sale de tesoreria_evolucion() (solo dirección; sobres, solo socios).
import { Fragment, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, hoyStr } from "../ui.jsx";
import { eur } from "../fmt.js";

const CSS = `
.te-l { display: grid; gap: 4px; margin-top: 12px; }
.te-f { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 10px 14px; border-radius: var(--r-s); color: var(--text); text-decoration: none; }
a.te-f:hover { background: var(--grid); }
.te-f b { font-size: 18px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.te-f small { color: var(--muted); font-size: 12.5px; }
.te-f.tot { border-top: 1.5px solid var(--line); margin-top: 4px; font-weight: 800; }
.te-f.tot b { font-size: 24px; }
.te-t td, .te-t th { font-variant-numeric: tabular-nums; }
.te-t tr.curso td { background: var(--grid); }
.te-sel { display: inline-flex; gap: 4px; margin: 6px 0 4px; }
.te-sel button { padding: 6px 14px; border-radius: 999px; border: 1.5px solid var(--line); background: transparent; color: var(--text); font: inherit; font-weight: 700; cursor: pointer; }
.te-sel button.on { background: var(--text); color: var(--bg, #fff); border-color: var(--text); }
.te-pv { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 10px 0 6px; }
.te-pv > div { padding: 10px 12px; border-radius: var(--r-s); background: var(--grid); }
.te-pv small { display: block; color: var(--muted); font-size: 12.5px; }
.te-pv b { font-size: 19px; font-variant-numeric: tabular-nums; }
.te-pv .fin b { font-size: 22px; }
.te-neg { color: var(--down); }
.te-est td:nth-child(2) { font-style: italic; }
.te-rp { font-size: 34px; font-weight: 800; font-variant-numeric: tabular-nums; margin: 6px 0 2px; }
.te-rp.mal { color: var(--down); }
.te-rl { display: grid; gap: 2px; margin: 10px 0 6px; }
.te-rl > div { display: flex; justify-content: space-between; gap: 12px; padding: 6px 2px; font-variant-numeric: tabular-nums; }
.te-rl > div.res { border-top: 1.5px solid var(--line); margin-top: 4px; font-weight: 800; }
.te-fecha td { border-top: 1.5px solid var(--line); }
`;
const n = (v) => Number(v) || 0;
const cuando = (ts) => (ts ? new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const ddmm = (f) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}` : "");
const nombreMes = (m) => { const t = new Date(`${m}-15T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const celda = (v) => (v == null ? "–" : eur(v, 2));

const TIPOS_OH = [["retiradas", "Retiradas de efectivo"], ["tarjeta", "Pagos con tarjeta"], ["transferencias", "Transferencias sueltas"], ["otros", "Otros cargos (comisiones, Bizum…)"]];
const esOtros = (e) => String(e.concepto || "").startsWith("Otros pagos habituales");

const DIAS_C = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const fechaCorta = (f) => `${DIAS_C[new Date(`${f}T12:00:00`).getDay()]} ${ddmm(f)}`;

function Grafico({ serie, minimo }) {
  const W = 640, H = 190, L = 54, R = 10, T = 12, B = 24;
  const vals = serie.map((p) => n(p.s));
  const lo = Math.min(0, ...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i) => L + (i / Math.max(serie.length - 1, 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / span) * (H - T - B);
  const pts = serie.map((p, i) => `${x(i).toFixed(1)},${y(n(p.s)).toFixed(1)}`).join(" ");
  const im = serie.findIndex((p) => p.f === minimo?.fecha);
  const marcas = [0, Math.floor((serie.length - 1) / 2), serie.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", margin: "8px 0" }} role="img" aria-label="Saldo previsto en el banco día a día">
      {[lo, (lo + hi) / 2, hi].map((v, k) => (
        <g key={k}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 4" /><text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{eur(v / 1000, 1).replace(" €", "")}k</text></g>
      ))}
      {lo < 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--down)" />}
      <polyline points={pts} fill="none" stroke="var(--text)" strokeWidth="2.2" strokeLinejoin="round" />
      {marcas.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--muted)">{ddmm(serie[i].f)}</text>)}
      {im >= 0 && <><circle cx={x(im)} cy={y(n(serie[im].s))} r="5" fill="#C26A00" stroke="#fff" strokeWidth="1.5" /><text x={Math.min(Math.max(x(im), L + 40), W - R - 40)} y={y(n(serie[im].s)) - 10} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#C26A00">{ddmm(serie[im].f)}</text></>}
    </svg>
  );
}

function Prevision() {
  const [dias, setDias] = useState(30);
  const [p, setP] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [verOtros, setVerOtros] = useState(false);
  useEffect(() => {
    let vivo = true;
    setP(null); setFallo(false);
    sb.rpc("tesoreria_prevision", { p_dias: dias }).then((v) => { if (vivo) setP(v); }, () => { if (vivo) setFallo(true); });
    return () => { vivo = false; };
  }, [dias]);

  const sel = (
    <div className="te-sel" role="group" aria-label="Plazo de la previsión">
      {[30, 60].map((d) => <button key={d} type="button" className={dias === d ? "on" : ""} onClick={() => setDias(d)}>{d} días</button>)}
    </div>
  );
  const cab = (<><h2>Próximos días</h2><p className="sub">Dinero previsto en el banco (BBVA + La Caixa). El efectivo no entra en esta previsión.</p>{sel}</>);
  if (fallo) return <div className="card" style={{ marginTop: 16 }}>{cab}<p className="empty">No se ha podido cargar la previsión.</p></div>;
  if (!p) return <div className="card" style={{ marginTop: 16 }}>{cab}<Cargando /></div>;

  const eventos = p.eventos || [];
  const neg = n(p.saldo_final) < 0;
  const oh = p.otros || null;
  const mesesOh = oh ? [...new Set((oh.desglose || []).map((x) => x.mes))] : [];
  const impOh = (t, m) => n(((oh?.desglose || []).find((x) => x.tipo === t && x.mes === m) || {}).importe);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      {cab}
      <div className="te-pv">
        <div><small>En el banco hoy</small><b>{eur(p.saldo_hoy, 2)}</b></div>
        <div><small>+ Cobros previstos</small><b>{eur(p.cobros, 2)}</b></div>
        <div><small>− Pagos previstos</small><b>{eur(p.pagos, 2)}</b></div>
        <div className="fin"><small>Previsto el {ddmm(p.fin)}</small><b className={neg ? "te-neg" : ""}>{eur(p.saldo_final, 2)}</b></div>
      </div>
      {p.minimo && <p className="sub" style={{ marginTop: 4 }}><b className={n(p.minimo.saldo) < 0 ? "te-neg" : ""}>El día más justo: {fechaCorta(p.minimo.fecha)}, {eur(p.minimo.saldo, 2)}</b></p>}
      <Grafico serie={p.serie || []} minimo={p.minimo} />
      {p.sin_nombre?.n > 0 && <p className="sub">Desde el 21/10 el banco manda {p.sin_nombre.n} cargos domiciliados sin el nombre del proveedor ({eur(p.sin_nombre.importe, 2)}). Ya están descontados del saldo de hoy, pero no se pueden asignar a un proveedor y cada proveedor se prevé con sus cargos con nombre.</p>}
      <div className="tabla-scroll">
        <table className="ranking te-t">
          <thead><tr><th>Fecha</th><th>Concepto</th><th className="r">Importe</th><th>De dónde sale</th><th className="r">Saldo previsto</th></tr></thead>
          <tbody>
            {eventos.map((e, i) => {
              const primera = i === 0 || eventos[i - 1].fecha !== e.fecha;
              const otros = oh && esOtros(e) && eventos.findIndex(esOtros) === i;
              return (
                <Fragment key={i}>
                <tr className={`${e.real ? "" : "te-est"} ${primera && i > 0 ? "te-fecha" : ""}`}>
                  <td style={{ whiteSpace: "nowrap" }}>{primera ? fechaCorta(e.fecha) : ""}</td>
                  <td>{otros ? <button type="button" onClick={() => setVerOtros(!verOtros)} aria-expanded={verOtros} style={{ font: "inherit", fontStyle: "italic", background: "none", border: "none", padding: 0, color: "inherit", cursor: "pointer", textDecoration: "underline dotted", textAlign: "left" }}>{e.concepto} {verOtros ? "▾" : "▸"}</button> : e.concepto}</td>
                  <td className="r" style={{ color: n(e.importe) < 0 ? "var(--down)" : "var(--up)", fontWeight: 700 }}>{n(e.importe) > 0 ? "+" : ""}{eur(e.importe, 2)}</td>
                  <td><small style={{ color: "var(--muted)" }}>{e.real ? "Dato real · " : "Estimación · "}{e.origen}</small></td>
                  <td className={`r ${primera && n(e.saldo_dia) < 0 ? "te-neg" : ""}`}>{primera ? <b>{eur(e.saldo_dia, 2)}</b> : ""}</td>
                </tr>
                {otros && verOtros && (
                  <tr><td colSpan="5">
                    <p className="sub" style={{ margin: "4px 0" }}>Estimación: {eur(oh.mensual, 2)} al mes (media de {mesesOh.map((m) => nombreMes(m).split(" ")[0].toLowerCase()).join(", ")}), repartida por igual entre todos los días. Solo cuenta lo que sale del banco y no está ya en otra línea: no entran los traspasos entre BBVA y La Caixa, ni facturas, domiciliaciones, nóminas, pagos fijos o impuestos.</p>
                    <table className="ranking te-t">
                      <thead><tr><th>Tipo</th>{mesesOh.map((m) => <th key={m} className="r">{nombreMes(m).split(" ")[0]}</th>)}<th className="r">Media al mes</th></tr></thead>
                      <tbody>
                        {TIPOS_OH.map(([t, nom]) => <tr key={t}><td>{nom}</td>{mesesOh.map((m) => <td key={m} className="r">{celda(impOh(t, m))}</td>)}<td className="r"><b>{celda(mesesOh.reduce((a, m) => a + impOh(t, m), 0) / (mesesOh.length || 1))}</b></td></tr>)}
                        <tr><td><b>Total</b></td>{mesesOh.map((m) => <td key={m} className="r"><b>{celda(TIPOS_OH.reduce((a, [t]) => a + impOh(t, m), 0))}</b></td>)}<td className="r"><b>{celda(oh.mensual)}</b></td></tr>
                      </tbody>
                    </table>
                  </td></tr>
                )}
                </Fragment>
              );
            })}
            {!eventos.length && <tr><td colSpan="5" className="empty">No hay cobros ni pagos previstos.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="sub">Las líneas en cursiva son estimaciones (medias de lo ocurrido en las últimas semanas); el resto son datos reales (facturas pendientes, pagos fijos, impuestos con fecha). Cuando un pago o un cobro aparece en el banco, deja de salir.</p>
    </div>
  );
}

function Repartir() {
  const [r, setR] = useState(null);
  useEffect(() => {
    let vivo = true;
    sb.rpc("tesoreria_repartir").then((v) => { if (vivo) setR(v); }, () => { if (vivo) setR(false); });
    return () => { vivo = false; };
  }, []);
  if (r === false) return null; // la cuenta «Recao» y quien no es socio no ve el bloque
  if (!r) return <div className="card"><h2>¿Cuánto podemos repartir?</h2><Cargando /></div>;
  const mal = n(r.repartir) <= 0;
  return (
    <div className="card">
      <h2>¿Cuánto podemos repartir?</h2>
      {mal ? <p className="te-rp mal">Ahora no conviene repartir</p> : <p className="te-rp">{eur(r.repartir, 2)}</p>}
      {mal && <p className="sub"><b className="te-neg">Faltan {eur(r.falta, 2)} para cubrir el colchón de un mes de gastos fijos.</b></p>}
      <div className="te-rl">
        <div><span>Dinero de hoy <small style={{ color: "var(--muted)" }}>(bancos {eur(r.bancos, 2)} + efectivo vivo {eur(r.efectivo, 2)})</small></span><b>{eur(r.dinero_hoy, 2)}</b></div>
        <div><span>+ Cobros previstos a 60 días</span><b>{eur(r.cobros, 2)}</b></div>
        <div><span>− Pagos previstos a 60 días</span><b>{eur(r.pagos, 2)}</b></div>
        <div><span>− Colchón: un mes de gastos fijos</span><b>{eur(r.colchon, 2)}</b></div>
        {n(r.reserva_impuestos) > 0 && <div><span>− Reserva para los impuestos del {r.reserva_impuestos_fechas}</span><b>{eur(r.reserva_impuestos, 2)}</b></div>}
        <div className="res"><span>= Se puede repartir</span><b className={mal ? "te-neg" : ""}>{eur(r.repartir, 2)}</b></div>
      </div>
      <p className="sub"><a href="#/finanzas/efectivo/sobres" style={{ color: "inherit" }}>De eso, en efectivo guardado hay <b>{eur(r.en_efectivo, 2)}</b></a>{n(r.ya_repartido) > 0 && <> · Ya repartido este mes: <b>{eur(r.ya_repartido, 2)}</b></>}</p>
      <p className="sub">Es una orientación: la app no impide registrar un reparto mayor (se registra en Efectivo de sobres). El colchón es la misma cifra de «Gastos fijos al mes» del Resumen; cobros y pagos son la previsión de «Próximos días» a 60 días. La reserva de impuestos aparece solo cuando el siguiente plazo cae más allá de esos 60 días (si no, ya está en los pagos previstos); es el importe estimado del calendario.</p>
    </div>
  );
}

export function Tesoreria() {
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vivo = true;
    const ok = (p) => p.then((v) => ({ v }), (e) => ({ e }));
    (async () => {
      const [cu, ca, so, ev] = await Promise.all([
        ok(sb.select("cuentas_bancarias", "select=banco,aspsp_nombre,saldo,saldo_fecha,ultima_sync&or=(activa.eq.true,aspsp_nombre.eq.Extracto%20manual)&order=banco")),
        ok(sb.rpc("caja_fuerte_estado")),
        ok(sb.rpc("efectivo_sobres_mes", { p_mes: hoyStr().slice(0, 7) })),
        ok(sb.rpc("tesoreria_evolucion")),
      ]);
      if (!vivo) return;
      setD({ cu, ca, so, ev });
      setFallo(!!(cu.e && ev.e));
    })();
    return () => { vivo = false; };
  }, []);

  if (fallo) return <div className="card"><h2>Tesorería</h2><p className="empty">No se ha podido cargar.</p></div>;
  if (!d) return <div className="card"><Cargando /></div>;

  const bbva = (d.cu.v || []).find((c) => c.banco === "BBVA" && c.aspsp_nombre !== "Extracto manual");
  const caixa = (d.cu.v || []).find((c) => c.aspsp_nombre === "Extracto manual" && c.saldo != null);
  const caixaFecha = caixa?.saldo_fecha ? new Date(caixa.saldo_fecha).toLocaleDateString("sv-SE") : "";
  const caixaViejo = caixaFecha && Date.now() - new Date(`${caixaFecha}T12:00:00`).getTime() > 7 * 864e5;
  const verSobres = !d.so.e;
  const caja = d.ca.e ? null : n(d.ca.v?.saldo);
  const sobres = verSobres ? n(d.so.v?.saldo) : null;
  const efectivo = (caja ?? 0) + (sobres ?? 0);
  const total = (bbva ? n(bbva.saldo) : 0) + (caixa ? n(caixa.saldo) : 0) + efectivo;

  const meses = d.ev.e ? [] : (d.ev.v?.meses || []).map((m) => {
    const efe = m.caja == null && m.sobres == null ? null : n(m.caja) + n(m.sobres);
    return { ...m, efe, total: n(m.bbva) + n(m.caixa) + n(efe), soloBancos: efe == null };
  });
  meses.forEach((m, i) => { m.dif = i > 0 ? m.total - meses[i - 1].total : null; });
  const filas = [...meses].reverse();

  return (
    <>
      <style>{CSS}</style>
      <Repartir />
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Hoy</h2>
        <p className="sub">El dinero real que hay ahora: bancos, caja fuerte{verSobres ? " y efectivo de sobres guardado" : ""}. Son las mismas cifras de Bancos y Efectivo.</p>
        <div className="te-l">
          <a className="te-f" href="#/finanzas/banco/bancos"><span>BBVA{bbva && <small> · actualizado {cuando(bbva.ultima_sync)}</small>}</span><b>{bbva?.saldo != null ? eur(bbva.saldo, 2) : "—"}</b></a>
          <a className="te-f" href="#/finanzas/banco/bancos"><span>La Caixa<small style={{ color: caixaViejo ? "#C26A00" : undefined, fontWeight: caixaViejo ? 700 : undefined }}> · {caixa ? `extracto del ${ddmm(caixaFecha)}${caixaViejo ? " (más de 7 días)" : ""}` : "sin extracto"}</small></span><b>{caixa ? eur(caixa.saldo, 2) : "—"}</b></a>
          <a className="te-f" href="#/finanzas/efectivo/sobres"><span>Efectivo vivo<small> · {verSobres ? `sobres guardado ${eur(sobres, 2)} + ` : ""}caja fuerte {caja == null ? "—" : eur(caja, 2)}</small></span><b>{eur(efectivo, 2)}</b></a>
          <div className="te-f tot"><span>Total</span><b>{eur(total, 2)}</b></div>
        </div>
        {!verSobres && <p className="sub">El efectivo de sobres solo lo ven los socios, y no se suma.</p>}
      </div>

      <Prevision />

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Evolución</h2>
        <p className="sub">Dinero a fin de cada mes. BBVA se calcula desde el saldo de hoy restando los movimientos posteriores; La Caixa es el saldo del último movimiento del mes en el extracto (hay datos desde marzo de 2026); el efectivo, desde octubre de 2026. Los meses sin efectivo suman solo los bancos (*).</p>
        {d.ev.e ? <p className="empty">No se ha podido cargar la evolución.</p> : (
          <div className="tabla-scroll">
            <table className="ranking te-t">
              <thead><tr><th>Mes</th><th className="r">BBVA</th><th className="r">La Caixa</th><th className="r">Efectivo</th><th className="r">Total</th><th className="r">Diferencia</th></tr></thead>
              <tbody>
                {filas.map((m) => (
                  <tr key={m.mes} className={m.en_curso ? "curso" : ""}>
                    <td style={{ whiteSpace: "nowrap" }}>{nombreMes(m.mes)}{m.en_curso && <span className="pf">en curso (hoy)</span>}</td>
                    <td className="r">{celda(m.bbva)}</td>
                    <td className="r">{celda(m.caixa)}</td>
                    <td className="r">{celda(m.efe)}</td>
                    <td className="r"><b>{eur(m.total, 2)}</b>{m.soloBancos ? " *" : ""}</td>
                    <td className="r" style={{ color: m.dif == null ? undefined : m.dif < 0 ? "var(--down)" : "var(--up)", fontWeight: 700 }}>{m.dif == null ? "–" : `${m.dif > 0 ? "+" : ""}${eur(m.dif, 2)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sub">* Solo bancos. Si falta algún movimiento de BBVA, los meses más antiguos se desvían.</p>
      </div>
    </>
  );
}
