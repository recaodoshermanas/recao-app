// Turnos imprescindibles todos los días.
export const TURNOS_REQUERIDOS = ["Mañana", "Tarde", "Apoyo 1", "Apoyo 2"];

// Turnos que se piden además según el día de la semana (0 = domingo … 6 = sábado).
// Domingos: también un Apoyo 3 (17:00–22:00).
export const TURNOS_REQUERIDOS_POR_DIA = { 0: ["Apoyo 3"] };

// Turnos de trabajo (quien tiene uno de estos ese día no está libre para cubrir otro).
export const TURNOS_TRABAJO = ["Mañana", "Tarde", "Apoyo 1", "Apoyo 2", "Apoyo 3"];

// Texto para explicar la regla en pantalla.
export const REGLA_COBERTURA = "Mañana, Tarde, Apoyo 1 y Apoyo 2 todos los días, y Apoyo 3 los domingos";

// Turnos que tienen que estar cubiertos en una fecha ("AAAA-MM-DD").
export function requeridosDe(fecha) {
  const dow = new Date(fecha + "T12:00:00Z").getUTCDay();
  return [...TURNOS_REQUERIDOS, ...(TURNOS_REQUERIDOS_POR_DIA[dow] || [])];
}

// A partir de los horarios ([{usuario_id, fecha, turno}]) devuelve los turnos
// requeridos sin cubrir en cualquier día con horario cargado (no solo los días
// con vacaciones). Cada hueco: {fecha, turno}.
export function huecosCobertura(horarios) {
  const porDia = {};
  for (const h of horarios) { (porDia[h.fecha] = porDia[h.fecha] || []).push(h.turno); }
  const huecos = [];
  for (const fecha of Object.keys(porDia).sort()) {
    const turnos = porDia[fecha];
    for (const t of requeridosDe(fecha)) {
      if (!turnos.includes(t)) huecos.push({ fecha, turno: t });
    }
  }
  return huecos;
}
