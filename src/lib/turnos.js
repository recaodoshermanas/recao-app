export const TURNOS = {
  "Mañana":     { label: "Mañana",     horas: "07:00-15:00", tipo: "completo", bg: "#cbf7d0", fg: "#06281C" },
  "Tarde":      { label: "Tarde",      horas: "15:00-23:00", tipo: "completo", bg: "#f5a68e", fg: "#5a1f10" },
  "Apoyo 1":    { label: "Apoyo 1",    horas: "10:00-16:00", tipo: "apoyo",    bg: "#FFF1D4", fg: "#7a5a12" },
  "Apoyo 2":    { label: "Apoyo 2",    horas: "17:00-23:00", tipo: "apoyo",    bg: "#FFE0B0", fg: "#7a4a12" },
  "Descanso":   { label: "Descanso",   horas: "",            tipo: "libre",    bg: "#E1E2E4", fg: "#555555" },
  "Vacaciones": { label: "Vacaciones", horas: "",            tipo: "libre",    bg: "#60d4d6", fg: "#0a3b3b" },
};

export const TURNO_OPCIONES = ["Mañana", "Tarde", "Apoyo 1", "Apoyo 2", "Descanso", "Vacaciones"];

export function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
