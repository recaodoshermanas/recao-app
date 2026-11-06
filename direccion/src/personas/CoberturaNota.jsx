// Cobertura de turnos (#168): una sola nota del mes, igual en Personas → Resumen y Personas → Bolsa de turnos.
// Los números vienen de la base de datos (cobertura_resumen / cobertura_turnos); aquí solo se pintan.
import { useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import "./cobertura.css";

export const NIVELES = [
  { k: "muy_bien", t: "Muy bien", d: "cubierto con 20 días o más" },
  { k: "a_tiempo", t: "A tiempo", d: "cubierto con 10 a 19 días" },
  { k: "tarde", t: "Tarde", d: "cubierto con menos de 10 días" },
  { k: "sin_cubrir", t: "Sin cubrir", d: "sin nadie a 10 días o menos" },
  { k: "urgencia", t: "Urgencia de dirección", d: "cubierto a mano con menos de 7 días" },
];
const DONDE = { bolsa: "en la bolsa", bolsa_plantilla: "en la bolsa de plantilla", sin_publicar: "sin publicar" };
const dia = (f) => new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
const mesTxt = (f) => new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { month: "long" });
const signo = (n) => (n > 0 ? `+${n}` : `${n}`);

export const colorNota = (p, cfg) => (p == null ? "gris" : p >= (cfg?.verde ?? 85) ? "verde" : p >= (cfg?.ambar ?? 60) ? "ambar" : "rojo");

export function useCobertura(meses) {
  const [s, setS] = useState({ cargando: true });
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await sb.rpc("cobertura_resumen", { p_meses: meses });
        const actual = (r?.meses || [])[0];
        const t = actual ? await sb.rpc("cobertura_turnos", { p_mes: actual.mes }) : [];
        if (vivo) setS({ cargando: false, cfg: r, meses: r?.meses || [], turnos: t || [] });
      } catch (e) { if (vivo) setS({ cargando: false, error: true }); }
    })();
    return () => { vivo = false; };
  }, [meses]);
  return s;
}

export function NotaMes({ m, cfg, titulo }) {
  const c = colorNota(m.pct, cfg), meta = cfg?.meta ?? 85;
  const dif = m.pct == null ? null : Math.round(m.pct - meta);
  return (
    <div className={`cb-nota ${c}`}>
      {titulo && <h4>{titulo}</h4>}
      <p className="cb-pct">{m.pct == null ? "—" : `${m.pct} %`}</p>
      <div className="cb-barra" role="img" aria-label={`Nota ${m.pct ?? "sin dato"} %, meta ${meta} %`}>
        <i style={{ width: `${Math.max(0, Math.min(100, m.pct || 0))}%` }} /><b style={{ left: `${meta}%` }} title={`Meta ${meta} %`} />
      </div>
      <p className="cb-sub">
        {dif == null ? "Aún no hay turnos que cuenten" : dif === 0 ? "Justo en la meta" : `${Math.abs(dif)} puntos ${dif < 0 ? "por debajo" : "por encima"} de la meta`} ({meta} %)
        {m.total ? ` · ${m.total} turnos` : ""}
      </p>
      {(m.sin_dato > 0 || m.pendientes > 0) && <p className="cb-sub">{[m.sin_dato > 0 && `${m.sin_dato} sin dato (no cuentan)`, m.pendientes > 0 && `${m.pendientes} pendientes (aún no cuentan)`].filter(Boolean).join(" · ")}</p>}
    </div>
  );
}

export function PorCubrir({ turnos }) {
  const lista = (turnos || []).filter((t) => t.nivel === "pendiente" || t.nivel === "sin_cubrir");
  return (
    <details className="cb-det">
      <summary>Turnos por cubrir ({lista.length})</summary>
      {lista.length === 0 ? <p className="cb-sub">No queda ningún turno del mes sin cubrir.</p> : (
        <ul className="cb-lista">
          {lista.map((t) => (
            <li key={t.fecha + t.turno} className={t.dias <= 10 ? "rojo" : ""}>
              <b>{dia(t.fecha)}</b><span>{t.turno}</span>
              <span>{t.dias <= 0 ? "es hoy o ya pasó" : t.dias === 1 ? "falta 1 día" : `faltan ${t.dias} días`}</span>
              <em>{DONDE[t.donde] || ""}</em>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

export function Desglose({ m, cfg, turnos }) {
  const [abierto, setAbierto] = useState(null);
  return (
    <div className="cb-desglose">
      <h4>Desglose de {mesTxt(m.mes)}</h4>
      <table>
        <thead><tr><th>Nivel</th><th>Turnos</th><th>Nota</th><th>Puntos</th></tr></thead>
        <tbody>
          {NIVELES.map((n) => {
            const x = (m.niveles || {})[n.k] || { n: 0, puntos: 0 };
            const lista = (turnos || []).filter((t) => t.nivel === n.k);
            return [
              <tr key={n.k} className={x.n ? "pulsa" : ""} onClick={() => x.n && setAbierto(abierto === n.k ? null : n.k)}>
                <td><b>{n.t}</b><small>{n.d}</small></td><td>{x.n}</td><td>{signo(cfg?.notas?.[n.k] ?? 0)}</td><td>{x.n ? signo(x.puntos) : "0"}</td>
              </tr>,
              abierto === n.k && <tr key={n.k + "l"} className="det"><td colSpan="4">{lista.map((t) => `${dia(t.fecha)} · ${t.turno}`).join("  —  ")}</td></tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
