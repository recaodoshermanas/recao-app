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
