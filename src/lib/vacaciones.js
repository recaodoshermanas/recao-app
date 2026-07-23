import { TURNOS } from "./turnos.js";

function ymdL(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
function sig(f) { const d = new Date(f + "T00:00:00"); d.setDate(d.getDate() + 1); return ymdL(d); }

// Un turno "cuenta" como dia de trabajo si no es libre (Descanso / Vacaciones)
export function esTrabajo(turno) { const def = TURNOS[turno]; return !!def && def.tipo !== "libre"; }

export function rangoFechas(ini, fin) {
  const out = []; if (!ini || !fin) return out;
  const d = new Date(ini + "T00:00:00"), end = new Date(fin + "T00:00:00");
  while (d <= end) { out.push(ymdL(d)); d.setDate(d.getDate() + 1); }
  return out;
}

// De un rango, solo gastan vacaciones los dias que le tocaba trabajar.
// Sin dato de horario se asume dia de trabajo.
export function diasQueGastan(fechas, mapaTurnos) {
  return fechas.filter(f => { const t = mapaTurnos[f]; return t === undefined || esTrabajo(t); });
}

// Agrupa fechas sueltas en bloques. "saltables" (p.ej. descansos) no rompen el bloque,
// asi que dos semanas de vacaciones salen como un unico periodo.
export function agruparRangos(fechas, saltables) {
  const skip = saltables instanceof Set ? saltables : new Set(saltables || []);
  const orden = [...new Set(fechas)].sort();
  const out = [];
  for (const f of orden) {
    const last = out[out.length - 1];
    if (last) {
      let cur = sig(last.fin);
      while (cur < f && skip.has(cur)) cur = sig(cur);
      if (cur === f) { last.fin = f; last.dias++; continue; }
    }
    out.push({ ini: f, fin: f, dias: 1 });
  }
  return out;
}

export function resumenVacaciones(total, solicitudes, hoyStr) {
  const acc = { total: total ?? 22, aprobados: 0, disfrutados: 0, futuros: 0, solicitados: 0 };
  for (const s of solicitudes) {
    if (s.estado === "aceptado") {
      acc.aprobados += s.dias;
      if (s.fecha_fin < hoyStr) acc.disfrutados += s.dias; else acc.futuros += s.dias;
    } else if (s.estado === "pendiente") { acc.solicitados += s.dias; }
  }
  acc.restantes = acc.total - acc.aprobados;
  return acc;
}

// El calendario es la fuente de verdad de los dias cogidos.
export function resumenCalendario(total, vacFechas, solicitudes, hoyStr) {
  const fechas = vacFechas || [];
  let disfrutados = 0, planificados = 0;
  for (const f of fechas) { if (f <= hoyStr) disfrutados++; else planificados++; }
  let pendientes = 0;
  for (const s of (solicitudes || [])) { if (s.estado === "pendiente") pendientes += (s.dias || 0); }
  const t = total ?? 22;
  const cogidos = fechas.length;
  return { total: t, cogidos, disfrutados, planificados, pendientes, restantes: t - cogidos - pendientes };
}
