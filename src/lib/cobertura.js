export const TURNOS_REQUERIDOS = ["Mañana", "Tarde", "Apoyo 1", "Apoyo 2"];

// A partir de los horarios ([{usuario_id, fecha, turno}]) devuelve los turnos
// requeridos sin cubrir, solo en días donde hay alguien de Vacaciones
// (días operativos afectados). Cada hueco: {fecha, turno}.
export function huecosCobertura(horarios) {
  const porDia = {};
  for (const h of horarios) { (porDia[h.fecha] = porDia[h.fecha] || []).push(h.turno); }
  const huecos = [];
  for (const fecha of Object.keys(porDia).sort()) {
    const turnos = porDia[fecha];
    if (!turnos.includes("Vacaciones")) continue;
    for (const t of TURNOS_REQUERIDOS) {
      if (!turnos.includes(t)) huecos.push({ fecha, turno: t });
    }
  }
  return huecos;
}
