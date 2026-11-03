// #148 · Finanzas fácil (1/6): parte de arriba del Resumen (frase fija, frase respuesta, 3 números y avisos con semáforo)
// y la tarjeta plegable que se reutiliza en las demás pantallas. No calcula nada nuevo: usa las mismas fuentes que el resto.
import { useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { eur, mesAnio } from "../fmt.js";
import { useDineroHoy, calcDinero } from "./DineroHoy.jsx";

const CSS = `
.rf-fija { margin: 0 0 6px; font-size: 15px; color: var(--text-2); }
.rf-frase { margin: 0 0 14px; font-family: var(--display); font-weight: 800; font-size: clamp(24px, 4vw, 34px); letter-spacing: -0.02em; line-height: 1.15; }
.rf-nums { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
.rf-num { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-l); padding: 16px 18px; min-width: 0; }
.rf-num h2 { margin: 0; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.rf-num .v { margin: 6px 0 2px; font-family: var(--display); font-weight: 800; font-size: clamp(26px, 3.6vw, 40px); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.rf-num .fl { margin: 0; font-size: 13.5px; font-weight: 700; }
.rf-num .fl.up { color: var(--up); } .rf-num .fl.down { color: var(--down); }
.rf-i { background: none; border: 1px solid var(--line); border-radius: 99px; width: 22px; height: 22px; font-size: 12px; font-weight: 800; cursor: pointer; color: var(--text); padding: 0; }
.rf-ex { margin: 8px 0 0; padding: 10px 12px; background: var(--grid); border-radius: var(--r-s); font-size: 13.5px; line-height: 1.45; font-weight: 400; }
.rf-sem { display: grid; gap: 8px; margin-bottom: 18px; }
.rf-av { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: var(--r-s); border: 1px solid var(--line); background: var(--card); color: var(--text); text-decoration: none; font-size: 14.5px; }
a.rf-av:hover { background: var(--grid); }
.rf-av .pto { flex: none; font-size: 16px; line-height: 1.3; }
.rf-av .tx { flex: 1; min-width: 0; }
.rf-av.rojo { border-color: var(--down); } .rf-av.ama { border-color: #C26A00; }
.rf-av .rev { flex: none; font: inherit; font-size: 13px; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); cursor: pointer; }
.rf-av details { margin-top: 6px; font-size: 13px; } .rf-av summary { cursor: pointer; color: var(--text-2); } .rf-av ul { margin: 6px 0 0 18px; padding: 0; }
.rf-pl { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-l); margin-bottom: 12px; }
.rf-pl > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 14px 18px; flex-wrap: wrap; }
.rf-pl > summary::-webkit-details-marker { display: none; }
.rf-pl > summary .t { font-weight: 800; font-size: 16px; flex: 1 1 auto; min-width: 0; }
.rf-pl > summary .tot { font-weight: 700; font-variant-numeric: tabular-nums; }
.rf-pl > summary .fl { color: var(--text-2); font-size: 20px; transition: transform .15s; }
.rf-pl[open] > summary .fl { transform: rotate(90deg); }
.rf-pl > .cuerpo { padding: 0 8px 12px; }
.rf-pl > .cuerpo > .grid, .rf-pl > .cuerpo > section, .rf-pl > .cuerpo > div { margin-top: 0; }
@media (max-width: 720px) { .rf-nums { grid-template-columns: 1fr; } .rf-num { padding: 14px 16px; } }
`;

// Tarjeta plegada (cerrada por defecto) con su total y ✅ / ⚠️
export function Plegable({ titulo, total, estado, children, abierta = false }) {
  return (
    <details className="rf-pl" open={abierta}>
      <style>{CSS}</style>
      <summary>
        <span className="t">{titulo}</span>
        {total != null && <span className="tot">{total}</span>}
        {estado && <span aria-label={estado === "ok" ? "Todo bien" : "Hay algo pendiente"}>{estado === "ok" ? "✅" : "⚠️"}</span>}
        <span className="fl" aria-hidden="true">›</span>
      </summary>
      <div className="cuerpo">{children}</div>
    </details>
  );
}

function Numero({ titulo, valor, flecha, explica }) {
  const [ab, setAb] = useState(false);
  return (
    <div className="rf-num">
      <h2>{titulo}<button type="button" className="rf-i" aria-expanded={ab} aria-label={`¿Qué es ${titulo}?`} title="¿Qué es esto?" onClick={() => setAb(!ab)}>ⓘ</button></h2>
      <p className="v">{valor}</p>
      {flecha && <p className={`fl ${flecha.up ? "up" : "down"}`}>{flecha.t}</p>}
      {ab && <div className="rf-ex">{explica}</div>}
    </div>
  );
}

const DESDE_CONC = "2026-10-01"; // misma fecha que usa la conciliación de Bancos (#87)
const nombreMes = (m) => mesAnio(m).split(" ")[0].toLowerCase();
const n0 = (v) => Number(v) || 0;

// Nivel del semáforo de un aviso: rojo = hay que hacer algo, amarillo = ojo
export function nivelAviso(a) {
  return /no se actualiza|sin cerrar|sin los dos cierres|contado a 0|sin explicar|descuadrad/i.test(a.t) ? "rojo" : "ama";
}

export function ResumenArriba({ d, avisos, onEditMonth, onRevisar }) {
  const { d: dh } = useDineroHoy();
  const [sinExp, setSinExp] = useState(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const movs = await sb.select("movimientos_banco", `select=id,fecha_operacion&fecha_operacion=gte.${DESDE_CONC}&limit=5000`);
        const conc = await sb.rpc("banco_conciliacion");
        const ex = new Set((conc || []).map((x) => x.movimiento_id));
        if (vivo) setSinExp(movs.filter((m) => !ex.has(m.id)).length);
      } catch (e) { if (vivo) setSinExp(null); }
    })();
    return () => { vivo = false; };
  }, []);

  const din = dh ? calcDinero(dh) : null;
  const filaV = (k) => din?.filas.find((f) => f.k === k);
  const banco = din ? ["bbva", "caixa"].reduce((s, k) => s + (filaV(k)?.ok ? filaV(k).v : 0), 0) : null;
  const efectivo = din ? ["sobres", "caja"].reduce((s, k) => s + (filaV(k)?.ok ? filaV(k).v : 0), 0) : null;
  const cargado = din && banco != null;
  const total = cargado ? banco + efectivo : null;

  const mesAct = d.meses.find((m) => m.mes === d.mes_actual) || d.meses[d.meses.length - 1];
  const idx = d.meses.indexOf(mesAct);
  const mesAnt = idx > 0 ? d.meses[idx - 1] : null;
  const ganado = mesAct ? n0(mesAct.resultado) : null;
  let flecha = null;
  if (mesAnt && ganado != null) {
    const dif = ganado - n0(mesAnt.resultado);
    const r = Math.round(Math.abs(dif));
    flecha = r === 0 ? { up: true, t: `= igual que ${nombreMes(mesAnt.mes)}` }
      : { up: dif > 0, t: `${dif > 0 ? "↑" : "↓"} ${eur(r)} ${dif > 0 ? "más" : "menos"} que ${nombreMes(mesAnt.mes)}` };
  }

  const todos = [...avisos.map((a) => ({ ...a, nivel: nivelAviso(a) }))];
  if (sinExp > 0) todos.push({ t: `Banco: ${sinExp} movimiento${sinExp === 1 ? "" : "s"} sin explicar.`, ruta: "finanzas/banco/bancos", nivel: "rojo" });
  todos.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "rojo" ? -1 : 1));

  const fSobres = filaV("sobres"), fCaja = filaV("caja"), fBbva = filaV("bbva"), fCaixa = filaV("caixa");
  const fCaixaTxt = din?.caixaFecha ? `Último PDF de La Caixa: ${din.caixaFecha.slice(8, 10)}/${din.caixaFecha.slice(5, 7)}/${din.caixaFecha.slice(0, 4)}.` : "Todavía no hay PDF de La Caixa subido.";

  return (
    <section aria-label="Resumen fácil">
      <style>{CSS}</style>
      <p className="rf-fija">Aquí ves de un vistazo cuánto dinero tenemos y si hay algo que hacer.</p>
      <p className="rf-frase">{cargado ? `Hoy tenemos ${eur(total)} entre banco y efectivo` : "Calculando el dinero que tenemos…"}</p>
      <div className="rf-nums">
        <Numero titulo="Banco" valor={cargado ? eur(banco) : "—"}
          explica={<>Es lo que hay en las cuentas: BBVA {fBbva?.ok ? eur(fBbva.v) : "sin dato"} + La Caixa {fCaixa?.ok ? eur(fCaixa.v) : "sin dato"}. {fCaixaTxt}</>} />
        <Numero titulo="Efectivo" valor={cargado ? eur(efectivo) : "—"}
          explica={<>Es el dinero en mano: sobres {fSobres ? eur(fSobres.v) : "(solo lo ven los socios)"} + caja fuerte {fCaja?.ok ? eur(fCaja.v) : "sin dato"}{fSobres && fCaja?.ok ? <>. Juntos suman {eur(efectivo)}</> : ""}. Ejemplo: «Sobres 1.200 € + Caja fuerte 800 €».</>} />
        <Numero titulo="Ganado este mes" valor={ganado != null ? eur(Math.round(ganado)) : "—"} flecha={flecha}
          explica={<>Lo que queda en {mesAct ? nombreMes(mesAct.mes) : "el mes"} después de pagar compras, gastos y personal. Es el mismo «Beneficio del negocio» de la Cuenta de resultados. El mes aún no ha terminado, así que va creciendo con los días.</>} />
      </div>

      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Avisos</h2>
      <div className="rf-sem">
        {todos.length === 0 && <div className="rf-av"><span className="pto">🟢</span><span className="tx">Todo en orden.</span></div>}
        {todos.map((a, i) => {
          const pto = a.nivel === "rojo" ? "🔴" : "🟡";
          if (a.clave) return (
            <div key={i} className={`rf-av ${a.nivel}`}><span className="pto">{pto}</span><span className="tx">{a.t}{(a.detalle || []).length > 0 && <details><summary>Ver detalle</summary><ul>{a.detalle.map((t, j) => <li key={j}>{t}</li>)}</ul></details>}</span><button type="button" className="rev" onClick={() => onRevisar(a.clave)}>Marcar como revisado</button></div>
          );
          return a.ruta
            ? <a key={i} className={`rf-av ${a.nivel}`} href={`#/${a.ruta}`} onClick={a.mes && onEditMonth ? (e) => { e.preventDefault(); onEditMonth(a.mes); } : undefined}><span className="pto">{pto}</span><span className="tx">{a.t}</span><span aria-hidden="true">→</span></a>
            : <div key={i} className={`rf-av ${a.nivel}`}><span className="pto">{pto}</span><span className="tx">{a.t}</span></div>;
        })}
      </div>
    </section>
  );
}
