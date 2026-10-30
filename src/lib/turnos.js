export const TURNOS = {
  "Mañana":     { label: "Mañana",     horas: "07:00-15:00", tipo: "completo", bg: "#cbf7d0", fg: "#06281C" },
  "Tarde":      { label: "Tarde",      horas: "15:00-23:00", tipo: "completo", bg: "#f5a68e", fg: "#5a1f10" },
  "Apoyo 1":    { label: "Apoyo 1",    horas: "10:00-16:00", tipo: "apoyo",    bg: "#FFF1D4", fg: "#7a5a12" },
  "Apoyo 2":    { label: "Apoyo 2",    horas: "17:00-23:00", tipo: "apoyo",    bg: "#FFE0B0", fg: "#7a4a12" },
  "Apoyo 3":    { label: "Apoyo 3",    horas: "17:00-22:00", tipo: "apoyo",    bg: "#F3C56E", fg: "#5f3a0e" },
  "Descanso":   { label: "Descanso",   horas: "",            tipo: "libre",    bg: "#E1E2E4", fg: "#555555" },
  "Vacaciones": { label: "Vacaciones", horas: "",            tipo: "libre",    bg: "#60d4d6", fg: "#0a3b3b" },
  "Baja":       { label: "Baja",       horas: "",            tipo: "libre",    bg: "#F3D9D4", fg: "#8a3a2c" },
  "Permiso":    { label: "Permiso",    horas: "",            tipo: "libre",    bg: "#E4DAF0", fg: "#5a4a7a" },
};

// Horarios que cambian según el día de la semana. Cada regla vale desde su fecha (y hasta la siguiente).
// La misma regla está en la base de datos (función turno_horas y turno_extra_auto): si se cambia aquí, cambiarla también allí.
export const VARIANTES_DESDE = "2026-10-24";
const REGLAS = [
  { desde: "2026-10-24", dias: { 6: { "Apoyo 1": "11:00-17:00" }, 0: { "Apoyo 2": "16:00-22:00", "Apoyo 3": "17:00-23:00" } } },
  // #55: el Apoyo 1 del sábado vuelve a 10-16 y el Apoyo 2 del sábado es 16-23 (6 h de turno + 1 h extra automática)
  { desde: "2026-10-31", dias: { 6: { "Apoyo 2": "16:00-23:00" }, 0: { "Apoyo 2": "16:00-22:00", "Apoyo 3": "17:00-23:00" } } },
  // #115: desde el 4 de noviembre el Apoyo 2 de lunes a jueves es 16-22 (viernes sigue 17-23)
  { desde: "2026-11-04", dias: { 1: { "Apoyo 2": "16:00-22:00" }, 2: { "Apoyo 2": "16:00-22:00" }, 3: { "Apoyo 2": "16:00-22:00" }, 4: { "Apoyo 2": "16:00-22:00" }, 6: { "Apoyo 2": "16:00-23:00" }, 0: { "Apoyo 2": "16:00-22:00", "Apoyo 3": "17:00-23:00" } } },
];
export const NOTA_FINDE = "Lunes a jueves (desde el 4/11): Apoyo 2 16:00-22:00 · Sábado: Apoyo 2 16:00-23:00 (1 h extra) · Domingo: Apoyo 2 16:00-22:00, Apoyo 3 17:00-23:00";
function reglaDe(fecha) { let r = null; for (const x of REGLAS) if (fecha >= x.desde) r = x; return r; }
// Horas del turno un día concreto (fecha "AAAA-MM-DD"); sin fecha, las de siempre
export function horasTurno(turno, fecha) {
  const base = TURNOS[turno]?.horas || "";
  if (!base || !fecha) return base;
  const r = reglaDe(fecha); if (!r) return base;
  const dow = new Date(`${fecha}T12:00:00`).getDay();
  return r.dias[dow]?.[turno] || base;
}
// Horas extra que se apuntan solas por hacer ese turno ese día (ya están en la tabla horas_extras)
export function horasExtraAuto(turno, fecha) {
  if (!fecha || fecha < "2026-10-31" || turno !== "Apoyo 2") return 0;
  return new Date(`${fecha}T12:00:00`).getDay() === 6 ? 1 : 0;
}

export const TURNO_OPCIONES = ["Mañana", "Tarde", "Apoyo 1", "Apoyo 2", "Apoyo 3", "Descanso", "Vacaciones", "Baja", "Permiso"];

export function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
