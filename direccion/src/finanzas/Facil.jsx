// #148 · Piezas comunes de «Finanzas fácil»: frase fija, frase respuesta + 3 números con ⓘ y flecha, y tarjetas plegadas.
// Solo presentación: no calculan nada, reciben las cifras ya calculadas.
import { useState } from "react";

const CSS = `
.ff-fija { margin: 0 0 14px; font-size: 16px; font-weight: 600; color: var(--text); }
.ff-resp { margin: 0 0 12px; font-size: clamp(20px, 3.4vw, 28px); font-weight: 800; line-height: 1.2; color: var(--text); }
.ff-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
.ff-n { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-l); padding: 14px 16px; min-width: 0; }
.ff-n .t { display: flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--muted); font-weight: 600; }
.ff-n .v { margin: 6px 0 2px; font-size: clamp(22px, 4.2vw, 34px); font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.1; overflow-wrap: anywhere; }
.ff-n .fl { font-size: 13px; font-weight: 700; margin: 0; }
.ff-n .fl.sube { color: var(--up); } .ff-n .fl.baja { color: var(--down); }
.ff-i { background: none; border: 1px solid var(--line); border-radius: 99px; width: 22px; height: 22px; font-size: 12px; font-weight: 800; cursor: pointer; color: var(--text); padding: 0; flex: none; }
.ff-ex { grid-column: 1 / -1; margin: 0; padding: 12px 14px; background: var(--grid); border-radius: var(--r-s); font-size: 14px; line-height: 1.5; }
.ff-pl { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-l); margin-bottom: 12px; }
.ff-pl > summary { cursor: pointer; padding: 14px 16px; display: flex; gap: 10px; align-items: baseline; font-weight: 700; list-style: none; }
.ff-pl > summary::-webkit-details-marker { display: none; }
.ff-pl > summary::after { content: "▾"; margin-left: auto; color: var(--muted); }
.ff-pl[open] > summary::after { content: "▴"; }
.ff-pl .ff-tot { font-variant-numeric: tabular-nums; color: var(--muted); font-weight: 600; }
.ff-pl .ff-pend { font-size: 13px; font-weight: 500; color: #9A4A00; }
.ff-pl > .ff-cuerpo { padding: 0 8px 8px; }
.ff-sem { display: grid; gap: 8px; margin: 0 0 16px; }
.ff-sem > * { display: flex; gap: 10px; align-items: center; padding: 12px 14px; background: var(--card); border: 1px solid var(--line); border-radius: var(--r-s); color: var(--text); text-decoration: none; font-size: 14.5px; }
@media (max-width: 640px) { .ff-3 { grid-template-columns: 1fr; } }
`;

export function FraseFija({ children }) {
  return <><style>{CSS}</style><p className="ff-fija">{children}</p></>;
}

// numeros: [{ t, v, info, flecha? }]. flecha: { actual, anterior, mes, mejora: "sube"|"baja" (por defecto sube = mejor) }
export function flechaMes(actual, anterior, nombreMes, fmt, subeEsMejor = true) {
  if (actual == null || anterior == null || !isFinite(actual) || !isFinite(anterior)) return null;
  const dif = actual - anterior;
  if (Math.abs(dif) < 0.5) return { txt: `= igual que ${nombreMes}`, tono: "" };
  const mejor = subeEsMejor ? dif > 0 : dif < 0;
  return { txt: `${dif > 0 ? "↑" : "↓"} ${fmt(Math.abs(dif))} ${dif > 0 ? "más" : "menos"} que ${nombreMes}`, tono: mejor ? "sube" : "baja" };
}

export function TresNumeros({ frase, numeros }) {
  const [abierto, setAbierto] = useState(-1);
  return (
    <>
      <style>{CSS}</style>
      {frase && <p className="ff-resp">{frase}</p>}
      <div className="ff-3">
        {numeros.map((n, i) => (
          <div className="ff-n" key={n.t}>
            <div className="t"><span>{n.t}</span>
              {n.info && <button type="button" className="ff-i" aria-expanded={abierto === i} aria-label={`¿Qué es ${n.t}?`} onClick={() => setAbierto(abierto === i ? -1 : i)}>ⓘ</button>}
            </div>
            <p className="v">{n.v}</p>
            {n.flecha && <p className={`fl ${n.flecha.tono}`}>{n.flecha.txt}</p>}
          </div>
        ))}
        {abierto >= 0 && numeros[abierto]?.info && <p className="ff-ex">{numeros[abierto].info}</p>}
      </div>
    </>
  );
}

// Tarjeta plegada (cerrada por defecto) con su total y ✅ / ⚠️
export function Plegable({ titulo, total, pendiente, abierta, children }) {
  return (
    <details className="ff-pl" open={abierta}>
      <style>{CSS}</style>
      <summary>
        <span>{pendiente ? "⚠️" : "✅"} {titulo}</span>
        {total != null && <span className="ff-tot">{total}</span>}
        {pendiente && <span className="ff-pend">{pendiente}</span>}
      </summary>
      <div className="ff-cuerpo">{children}</div>
    </details>
  );
}

export function Semaforo({ avisos, okTxt = "Todo en orden" }) {
  return (
    <div className="ff-sem" aria-label="Avisos">
      <style>{CSS}</style>
      {avisos.length === 0 && <div><b aria-hidden="true">🟢</b><span>{okTxt}</span></div>}
      {avisos.map((a, i) => {
        const ico = <b aria-hidden="true">{a.nivel === "rojo" ? "🔴" : "🟡"}</b>;
        return a.ruta
          ? <a key={i} href={`#/${a.ruta}`} onClick={a.onClick}>{ico}<span>{a.t}</span><i aria-hidden="true" style={{ marginLeft: "auto" }}>→</i></a>
          : <div key={i}>{ico}<span>{a.t}</span>{a.accion}</div>;
      })}
    </div>
  );
}
