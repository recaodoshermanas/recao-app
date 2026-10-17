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

// Horarios que cambian según el día de la semana (desde el sábado 24/10/2026).
// La misma regla está en la base de datos (función turno_horas): si se cambia aquí, cambiarla también allí.
export const VARIANTES_DESDE = "2026-10-24";
const VARIANTES = { 6: { "Apoyo 1": "11:00-17:00" }, 0: { "Apoyo 2": "16:00-22:00", "Apoyo 3": "17:00-23:00" } };
export const NOTA_FINDE = "Sábado: Apoyo 1 11:00-17:00 · Domingo: Apoyo 2 16:00-22:00, Apoyo 3 17:00-23:00";
// Horas del turno un día concreto (fecha "AAAA-MM-DD"); sin fecha, las de siempre
export function horasTurno(turno, fecha) {
  const base = TURNOS[turno]?.horas || "";
  if (!base || !fecha || fecha < VARIANTES_DESDE) return base;
  const dow = new Date(`${fecha}T12:00:00`).getDay();
  return VARIANTES[dow]?.[turno] || base;
}

export const TURNO_OPCIONES = ["Mañana", "Tarde", "Apoyo 1", "Apoyo 2", "Apoyo 3", "Descanso", "Vacaciones", "Baja", "Permiso"];

export function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
