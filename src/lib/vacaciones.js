export function resumenVacaciones(total, solicitudes, hoyStr) {
  const acc = { total: total ?? 22, aprobados: 0, disfrutados: 0, futuros: 0, solicitados: 0 };
  for (const s of solicitudes) {
    if (s.estado === "aceptado") {
      acc.aprobados += s.dias;
      if (s.fecha_fin < hoyStr) acc.disfrutados += s.dias; else acc.futuros += s.dias;
    } else if (s.estado === "pendiente") {
      acc.solicitados += s.dias;
    }
  }
  acc.restantes = acc.total - acc.aprobados;
  return acc;
}

// Modelo real: el calendario (horarios con turno "Vacaciones") es la fuente de verdad
// de los dias cogidos. Las solicitudes pendientes cuentan como "por confirmar".
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
