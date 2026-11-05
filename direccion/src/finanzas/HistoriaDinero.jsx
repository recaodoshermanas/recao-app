// Finanzas → Cómo vamos → La historia del dinero (solicitud #153): del dinero del día 1 al de hoy, movimiento a movimiento.
// No calcula nada propio: todo sale de historia_dinero_mes(), que usa los mismos datos que Bancos, Efectivo de sobres y Caja fuerte.
import { useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, hoyStr } from "../ui.jsx";
import { eur } from "../fmt.js";

const CSS = `
.hd-fija { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
.hd-paso { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-l); padding: 14px 16px; margin-bottom: 12px; }
.hd-paso > h3 { margin: 0 0 4px; font-size: 18px; display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
.hd-paso > h3 b { font-variant-numeric: tabular-nums; white-space: nowrap; }
.hd-paso.entro > h3 b, .hd-paso.entro .hd-gt { color: var(--up); }
.hd-paso.salio > h3 b, .hd-paso.salio .hd-gt { color: var(--down); }
.hd-paso > .sub { margin: 0 0 8px; }
.hd-g { border-top: 1px solid var(--line); }
.hd-g > summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; gap: 12px; padding: 10px 2px; align-items: baseline; }
.hd-g > summary::-webkit-details-marker { display: none; }
.hd-g > summary::before { content: "▸"; color: var(--muted); margin-right: 6px; }
.hd-g[open] > summary::before { content: "▾"; }
.hd-g > summary span:first-of-type { flex: 1; }
.hd-gt { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.hd-fr { margin: 0 0 8px 18px; color: var(--muted); font-size: 13.5px; }
.hd-t { width: 100%; border-collapse: collapse; font-size: 14px; }
.hd-t td { padding: 6px 6px; border-top: 1px solid var(--grid); vertical-align: top; }
.hd-t td.r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 700; }
.hd-t td.f { white-space: nowrap; color: var(--muted); }
.hd-t a { color: inherit; text-decoration: underline dotted; }
.hd-rojo { border-color: var(--down); background: var(--grid); }
.hd-rojo > h3 { color: var(--down); }
.hd-lugares { display: grid; gap: 2px; margin: 6px 0 0 18px; font-size: 14px; }
.hd-lugares > div { display: flex; justify-content: space-between; gap: 12px; font-variant-numeric: tabular-nums; }
.hd-hoy { background: var(--grid); }
.hd-mes { display: flex; gap: 8px; align-items: center; margin: 0 0 12px; flex-wrap: wrap; }
.hd-mes button { padding: 6px 12px; border-radius: 999px; border: 1.5px solid var(--line); background: transparent; color: var(--text); font: inherit; font-weight: 700; cursor: pointer; }
.hd-mes button:disabled { opacity: .4; cursor: default; }
.hd-mes input { padding: 6px 8px; font: inherit; }
`;

const n = (v) => Number(v) || 0;
const ddmm = (f) => (f ? `${String(f).slice(8, 10)}/${String(f).slice(5, 7)}` : "");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nomMes = (m) => MESES[Number(m.slice(5, 7)) - 1];
const sumaMes = (m, d) => { const f = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + d, 1); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`; };
const RUTA = { BBVA: "#/finanzas/banco/bancos", "La Caixa": "#/finanzas/banco/bancos", Sobres: "#/finanzas/efectivo/sobres", "Caja fuerte": "#/finanzas/efectivo/caja" };

const ENTRO = [
  ["efectivo", "Ventas en efectivo", "El efectivo de las ventas que se ha contado y guardado en los sobres del mes."],
  ["tarjeta", "Ventas con tarjeta (incluido Bizum)", "Lo que el banco nos ingresa de los cobros con tarjeta y Bizum."],
  ["paqueteria", "Paquetería", "Lo que nos pagan las empresas de paquetería por los envíos y recogidas."],
  ["otros_ingresos", "Otros ingresos", "Otro dinero que ha entrado en el banco y no es ni venta ni paquetería."],
];
const SALIO = [
  ["proveedores", "Proveedores", "Lo que pagamos a quien nos vende la mercancía."],
  ["personas", "Sueldos y pagos a personas", "Nóminas, Seguridad Social y los sueldos y extras que se pagan en efectivo."],
  ["fijos", "Alquiler y gastos fijos", "Lo que se paga todos los meses: alquiler, luz, teléfono, gestoría, seguros, marketing…"],
  ["impuestos", "Impuestos", "Lo que pagamos a Hacienda, al Ayuntamiento y otras administraciones."],
  ["mantenimiento", "Mantenimiento", "Arreglos y reparaciones pagados desde la caja fuerte o los sobres."],
  ["inversiones", "Inversiones", "Cosas que duran (obras, neveras, estanterías). Han salido del dinero aunque no sean un gasto del mes."],
  ["comisiones", "Comisiones del banco", "Lo que cobran el banco y el datáfono por sus servicios."],
  ["reparto", "Reparto a socios", "El dinero que se han llevado los socios."],
  ["otros", "Otros pagos", "Pagos del banco que la app todavía no sabe a qué corresponden."],
];
const ENTRE = [
  ["traspaso", "Traspasos entre BBVA y La Caixa", "Dinero que pasa de un banco nuestro al otro."],
  ["retirada", "Retiradas del banco a efectivo", "Dinero que se saca del banco y se guarda en sobres o caja fuerte."],
  ["caja_fuerte", "Sobres a la caja fuerte", "Dinero en efectivo que pasa de los sobres a la caja fuerte."],
];

function Grupo({ titulo, frase, movs, firma }) {
  const total = movs.reduce((s, m) => s + n(m.importe), 0);
  return (
    <details className="hd-g">
      <summary><span>{titulo}</span><span className="hd-gt">{firma}{eur(Math.abs(total), 2)}</span></summary>
      <p className="hd-fr">{frase}</p>
      <div className="tabla-scroll" style={{ marginLeft: 18 }}>
        <table className="hd-t"><tbody>
          {movs.map((m, i) => (
            <tr key={i}>
              <td className="f">{ddmm(m.fecha)}</td>
              <td>{m.concepto}<br /><small style={{ color: "var(--muted)" }}>{m.sitio} · <a href={RUTA[m.sitio]}>ver el origen</a></small></td>
              <td className="r">{firma}{eur(Math.abs(n(m.importe)), 2)}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </details>
  );
}

function Lugares({ v }) {
  return (
    <div className="hd-lugares">
      <div><span>BBVA</span><span>{eur(v.bbva, 2)}</span></div>
      <div><span>La Caixa</span><span>{eur(v.caixa, 2)}</span></div>
      {v.sobres != null && <div><span>Efectivo de sobres</span><span>{eur(v.sobres, 2)}</span></div>}
      <div><span>Caja fuerte</span><span>{eur(v.caja, 2)}</span></div>
    </div>
  );
}

export function HistoriaDinero() {
  const mesHoy = hoyStr().slice(0, 7);
  const [mes, setMes] = useState(mesHoy);
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vivo = true;
    setD(null); setFallo(false);
    sb.rpc("historia_dinero_mes", { p_mes: mes }).then((v) => { if (vivo) setD(v); }, () => { if (vivo) setFallo(true); });
    return () => { vivo = false; };
  }, [mes]);

  const selector = (
    <div className="hd-mes">
      <button type="button" onClick={() => setMes(sumaMes(mes, -1))} disabled={mes <= "2026-01"} aria-label="Mes anterior">←</button>
      <input type="month" value={mes} min="2026-01" max={mesHoy} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mes" />
      <button type="button" onClick={() => setMes(sumaMes(mes, 1))} disabled={mes >= mesHoy} aria-label="Mes siguiente">→</button>
    </div>
  );
  const cab = (<><style>{CSS}</style><h2>La historia del dinero</h2><p className="hd-fija">Aquí ves, paso a paso, de dónde viene el dinero que tenemos.</p>{selector}</>);
  if (fallo) return <section className="card">{cab}<p className="empty">No se ha podido cargar. Solo lo ve dirección.</p></section>;
  if (!d) return <section className="card">{cab}<Cargando /></section>;

  const movs = d.movimientos || [];
  const de = (sentido, grupo) => movs.filter((m) => m.sentido === sentido && m.grupo === grupo);
  const falta = n(d.no_explicado);
  const cuadra = Math.abs(falta) < 0.005;
  const sinEnlazar = d.sin_enlazar || [];
  const sinEnlazarTot = sinEnlazar.reduce((s, x) => s + n(x.importe), 0);
  const antiguo = mes < "2026-10";

  return (
    <section className="card">
      {cab}
      {antiguo && <p className="sub">⚠️ Antes de octubre de 2026 el control del dinero en la app no estaba completo: este mes puede no cuadrar.</p>}

      <div className="hd-paso">
        <h3><span>🐷 El {Number(d.desde.slice(8, 10))} de {nomMes(mes)} teníamos</span><b>{eur(d.inicio.total, 2)}</b></h3>
        <p className="sub">Es el dinero que había al empezar el mes, sumando los cuatro sitios donde se guarda.</p>
        <details className="hd-g">
          <summary><span>Ver cuánto había en cada sitio</span></summary>
          <Lugares v={d.inicio} />
          <p className="hd-fr" style={{ marginTop: 8 }}>Se calcula hacia atrás desde el saldo del banco, restando los movimientos del mes.{d.caixa_sin_movimientos_previos ? " Falta el extracto de La Caixa anterior a este mes: su dinero de partida sale a 0 €." : ""}</p>
        </details>
      </div>

      <div className="hd-paso entro">
        <h3><span>➕ Entró</span><b>+{eur(d.entro, 2)}</b></h3>
        <p className="sub">Dinero nuevo que ha llegado del exterior este mes.</p>
        {ENTRO.map(([k, t, f]) => { const g = de("entro", k); return g.length ? <Grupo key={k} titulo={t} frase={f} movs={g} firma="+" /> : null; })}
      </div>

      <div className="hd-paso salio">
        <h3><span>➖ Salió</span><b>−{eur(d.salio, 2)}</b></h3>
        <p className="sub">Dinero que se ha ido fuera de Recao este mes.</p>
        {SALIO.map(([k, t, f]) => { const g = de("salio", k); return g.length ? <Grupo key={k} titulo={t} frase={f} movs={g} firma="−" /> : null; })}
      </div>

      <div className="hd-paso hd-hoy">
        <h3><span>💰 {d.en_curso ? "Hoy tenemos" : `El ${Number(d.hasta.slice(8, 10))} de ${nomMes(mes)} teníamos`}</span><b>{eur(d.hoy.total, 2)}</b></h3>
        <p className="sub">{d.en_curso ? "Es la misma cifra de «El dinero que tenemos hoy» en el Resumen." : "Es lo que había al acabar el mes."}</p>
        <details className="hd-g">
          <summary><span>Ver cuánto hay en cada sitio</span></summary>
          <Lugares v={d.hoy} />
          {d.en_curso && d.caixa_fecha && <p className="hd-fr" style={{ marginTop: 8 }}>La Caixa: según el último extracto subido, del {ddmm(String(d.caixa_fecha).slice(0, 10))}.</p>}
        </details>
        <p className="sub" style={{ marginTop: 10 }}>{eur(d.inicio.total, 2)} + {eur(d.entro, 2)} − {eur(d.salio, 2)} {cuadra ? "= " : "+ lo que no sabemos explicar = "}<b>{eur(d.hoy.total, 2)}</b>{cuadra ? " ✅ Cuadra." : ""}</p>
      </div>

      {!cuadra && (
        <div className="hd-paso hd-rojo">
          <h3><span>🔴 Dinero que no sabemos explicar</span><b>{falta > 0 ? "+" : "−"}{eur(Math.abs(falta), 2)}</b></h3>
          <p className="sub">Es la diferencia real entre lo que hay y lo que cuentan los movimientos. No se ha repartido ni escondido en ninguna otra línea.</p>
          {sinEnlazar.length > 0 && (
            <>
              <p className="sub"><b>De esto, {eur(sinEnlazarTot, 2)}</b> es dinero metido en la caja fuerte como «sacado del banco» sin que se haya enlazado la retirada del banco correspondiente:</p>
              <table className="hd-t"><tbody>{sinEnlazar.map((x, i) => <tr key={i}><td className="f">{ddmm(x.fecha)}</td><td>{x.banco}{x.nota ? ` · ${x.nota}` : ""}</td><td className="r">{eur(x.importe, 2)}</td></tr>)}</tbody></table>
              <p className="sub">Para arreglarlo, enlaza cada recarga con su retirada en <a href="#/finanzas/efectivo/caja" style={{ color: "inherit" }}>Caja fuerte</a>, o revisa si falta algún movimiento del banco.</p>
            </>
          )}
        </div>
      )}

      <div className="hd-paso">
        <h3><span>🔁 Dinero que se ha movido entre nuestras huchas</span></h3>
        <p className="sub">No es dinero que entra ni que sale, solo cambia de sitio. Por eso no cuenta en «Entró» ni en «Salió».</p>
        {ENTRE.map(([k, t, f]) => { const g = de("entre", k); return g.length ? <Grupo key={k} titulo={t} frase={f} movs={g} firma="" /> : null; })}
        {de("entre", "traspaso").length + de("entre", "retirada").length + de("entre", "caja_fuerte").length === 0 && <p className="empty">Este mes no ha habido movimientos entre huchas.</p>}
      </div>

      {d.socio && d.sobres_apertura_registrada === false && (
        <div className="hd-paso"><p className="sub" style={{ margin: 0 }}>ℹ️ Los sobres de este mes aún no se han abierto ni contado. Ese dinero todavía no está en ninguno de los cuatro sitios y aparecerá aquí cuando se abran.</p></div>
      )}
      {!d.socio && <p className="sub">El efectivo de sobres solo lo ven los socios, por eso no se suma aquí.</p>}

      <details className="hd-g">
        <summary><span>¿Por qué no es igual a lo que hemos ganado?</span></summary>
        <p className="hd-fr">Lo que hemos ganado está en la <a href="#/finanzas/como/resultados" style={{ color: "inherit" }}>Cuenta de resultados</a> y cuenta ventas y gastos del mes, estén cobrados o pagados o no. Esta pantalla cuenta solo el dinero que se ha movido de verdad. Se diferencian por: facturas todavía sin pagar o pagadas de meses anteriores, inversiones (salen dinero pero no son gasto del mes), el reparto a socios, el efectivo de meses anteriores y los IVA. El estado de cada cosa pendiente está en <a href="#/finanzas/como/tesoreria" style={{ color: "inherit" }}>Tesorería</a>.</p>
      </details>
    </section>
  );
}
