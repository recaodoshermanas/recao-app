// Personas · Equipo → Plus festivos: quién trabajó cada festivo del mes y cuánto se le paga de más.
// Sale del cuadrante (horarios): turnos de trabajo en días marcados como festivo. Con el fichaje al lado para comprobarlo.
import { useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { cargarFestivos, horasDeTurno, plusFestivo, PLUS_FESTIVO_8H, AMBITOS } from "../../../src/lib/festivos.js";
import { TURNOS_TRABAJO } from "../../../src/lib/cobertura.js";
import { Avatar, fechaCorta, hoyStr } from "../ui.jsx";
import { eur } from "../fmt.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ultimoDia = (a, m) => new Date(a, m, 0).getDate();
const horasTxt = (h) => `${h.toLocaleString("es-ES", { maximumFractionDigits: 2 })} h`;

export function PlusFestivo({ equipo }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear()); const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [datos, setDatos] = useState(null); // { festivos, turnos, fichados }
  const mm = String(mes).padStart(2, "0");
  const desde = `${anio}-${mm}-01`, hasta = `${anio}-${mm}-${ultimoDia(anio, mes)}`;
  const nombreDe = useMemo(() => Object.fromEntries((equipo || []).map((u) => [u.id, u.nombre])), [equipo]);

  const cargar = useCallback(async () => {
    setDatos(null);
    try {
      const festivos = await cargarFestivos(desde, hasta);
      const fechas = Object.keys(festivos);
      if (!fechas.length) return setDatos({ festivos, turnos: [], fichados: new Set() });
      const lista = `(${fechas.join(",")})`;
      const [hs, fs] = await Promise.all([
        sb.select("horarios", `select=usuario_id,fecha,turno&fecha=in.${lista}`),
        sb.select("fichajes", `select=usuario_id,entrada&anulado=is.false&entrada=gte.${desde}T00:00:00&entrada=lte.${hasta}T23:59:59`),
      ]);
      const fichados = new Set((fs || []).map((x) => `${x.usuario_id}|${String(x.entrada).slice(0, 10)}`));
      const turnos = (hs || []).filter((h) => TURNOS_TRABAJO.includes(h.turno)).map((h) => {
        const horas = horasDeTurno(h.turno, h.fecha);
        return { ...h, horas, importe: plusFestivo(horas), fichado: fichados.has(`${h.usuario_id}|${h.fecha}`) };
      });
      setDatos({ festivos, turnos, fichados });
    } catch (e) { setDatos({ festivos: {}, turnos: [], error: true }); }
  }, [desde, hasta]);
  useEffect(() => { cargar(); }, [cargar]);

  const mover = (d) => { let m = mes + d, a = anio; if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; } setMes(m); setAnio(a); };
  const porPersona = useMemo(() => {
    const g = {}; (datos?.turnos || []).forEach((t) => { (g[t.usuario_id] ||= []).push(t); });
    return Object.entries(g).map(([uid, ts]) => ({ uid, ts: ts.sort((a, b) => a.fecha.localeCompare(b.fecha)), total: ts.reduce((s, t) => s + t.importe, 0) }))
      .sort((a, b) => (nombreDe[a.uid] || "").localeCompare(nombreDe[b.uid] || ""));
  }, [datos, nombreDe]);
  const total = porPersona.reduce((s, p) => s + p.total, 0);
  const hoyS = hoyStr();
  const festivosMes = Object.values(datos?.festivos || {});

  const exportar = () => {
    const cab = ["Persona", "Fecha", "Festivo", "Turno", "Horas", "Plus (€)", "Fichado"];
    const rows = porPersona.flatMap((p) => p.ts.map((t) => [nombreDe[t.usuario_id] || "", t.fecha, datos.festivos[t.fecha]?.nombre || "", t.turno, String(t.horas).replace(".", ","), t.importe.toFixed(2).replace(".", ","), t.fecha > hoyS ? "Pendiente" : t.fichado ? "Sí" : "No"]));
    const csv = [cab, ...rows].map((r) => r.map((x) => `"${String(x)}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `plus_festivos_${anio}_${mm}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <div className="head">
        <div>
          <h2>Plus festivos de {MESES[mes - 1]}{datos && total > 0 ? ` · ${eur(total, 2)}` : ""}</h2>
          <p className="sub">{eur(PLUS_FESTIVO_8H, 2)} más por un turno de 8 h en festivo; los turnos más cortos, la parte proporcional (6 h = {eur(plusFestivo(6), 2)}). Sale del cuadrante.</p>
        </div>
        <div className="nav-sem">
          <button className="btn-l" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
          <b style={{ minWidth: 110, textAlign: "center", textTransform: "capitalize" }}>{MESES[mes - 1]} {anio}</b>
          <button className="btn-l" onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
          {porPersona.length > 0 && <button className="btn-l" onClick={exportar}>Descargar CSV</button>}
        </div>
      </div>
      {!datos ? <p className="empty">Cargando…</p> : datos.error ? <p className="empty">No se ha podido cargar.</p> : (
        <>
          <p className="fest-mes">{festivosMes.length === 0 ? "Este mes no hay festivos." : festivosMes.map((f) => <span key={f.fecha} className="fest-chip" title={AMBITOS[f.ambito]}>{fechaCorta(f.fecha)} · {f.nombre}</span>)}</p>
          {festivosMes.length > 0 && porPersona.length === 0 && <p className="empty">Nadie tiene turno en los festivos de este mes.</p>}
          {porPersona.length > 0 && (
            <div className="horas-grid">
              {porPersona.map((p) => (
                <div key={p.uid} className="horas-p">
                  <h3><Avatar nombre={nombreDe[p.uid]} size={26} />{nombreDe[p.uid] || "—"}<b>{eur(p.total, 2)}</b></h3>
                  <ul className="pq-l">
                    {p.ts.map((t) => (
                      <li key={t.fecha + t.turno}>
                        <span>{fechaCorta(t.fecha)} · {t.turno}<span className="pf">{datos.festivos[t.fecha]?.nombre} · {horasTxt(t.horas)}{t.fecha <= hoyS && (t.fichado ? " · fichado" : "")}</span>
                          {t.fecha < hoyS && !t.fichado && <span className="fest-sin">Sin fichaje ese día: compruébalo antes de pagarlo</span>}
                        </span>
                        <span className="der"><b>{eur(t.importe, 2)}</b></span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
