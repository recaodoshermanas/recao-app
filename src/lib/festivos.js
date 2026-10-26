// Festivos (nacionales, de Andalucía y locales de Dos Hermanas) y plus por trabajarlos.
// La lista vive en la tabla `festivos`; dirección la mantiene desde Personas → Horarios → Festivos.
import { sb } from "./supabase.js";
import { horasTurno } from "./turnos.js";

export const AMBITOS = { nacional: "Nacional", andalucia: "Andalucía", local: "Local (Dos Hermanas)" };

// Plus por trabajar un festivo: 37,50 € más del salario diario en un turno de 8 h, proporcional en turnos más cortos (Pablo, solicitud #6).
export const PLUS_FESTIVO_8H = 37.5;

// fecha "AAAA-MM-DD" → { fecha, nombre, ambito } de los festivos activos entre dos fechas
export async function cargarFestivos(desde, hasta) {
  const r = await sb.select("festivos", `select=fecha,nombre,ambito&activo=eq.true&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.asc`);
  return Object.fromEntries((r || []).map((f) => [f.fecha, f]));
}

// Horas de un turno un día concreto (con las variantes de fin de semana), p. ej. "Apoyo 3" un martes → 5
export function horasDeTurno(turno, fecha) {
  const t = horasTurno(turno, fecha);
  const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(t || "");
  if (!m) return 0;
  const ini = +m[1] * 60 + +m[2]; let fin = +m[3] * 60 + +m[4];
  if (fin <= ini) fin += 24 * 60;
  return (fin - ini) / 60;
}

// #59: 37,50 € por un turno de 8 h; si dura otra cosa, la parte proporcional redondeada hacia arriba al euro (6 h = 29 €).
// La misma regla está en la base de datos (función extras_auto, que lo mete en Efectivo de sobres y Salarios).
export const plusFestivo = (horas) => (!horas ? 0 : horas === 8 ? PLUS_FESTIVO_8H : Math.ceil((PLUS_FESTIVO_8H * horas) / 8));
