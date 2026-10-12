// Bolsa de turnos · utilidades compartidas (v4)
import { TURNOS, ymd } from "./turnos.js";

// ─────────────────────────────────────────────────────────────────────
// INTERRUPTOR DE LANZAMIENTO
// false → la bolsa no aparece en ningún sitio. true → activa.
// Antes de ponerlo a true: migración SQL + edge function (ver LEEME.md).
// ─────────────────────────────────────────────────────────────────────
export const BOLSA_ACTIVA = false;

// Teléfono de dirección que ven las trabajadoras para avisar
export const TELEFONO_DIRECCION = "646 683 216";

// Reglas (las mismas que aplica la base de datos)
export const DIAS_ANTELACION = 21;  // se publica con 3 semanas
export const DIAS_URGENTE = 10;     // a 10 días, urgente
export const DIAS_SOLTAR = 7;       // se puede soltar desde la app hasta 7 días antes

export const TURNOS_BOLSA = ["Mañana", "Tarde", "Apoyo 1", "Apoyo 2", "Apoyo 3"];
export const TURNOS_PLANTILLA = ["Mañana", "Tarde"];
export const esTurnoTrabajo = (t) => TURNOS_BOLSA.includes(t);
export const destinoDe = (t) => (TURNOS_PLANTILLA.includes(t) ? "plantilla" : "eventuales");

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_C = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fecha(f) { return new Date(f + "T00:00:00"); }
export function horarioDe(turno) { const h = TURNOS[turno]?.horas || ""; return h.replace("-", " – "); }
export function horasDe(turno) {
  const h = TURNOS[turno]?.horas; if (!h) return 0;
  const [a, b] = h.split("-"); const m = (s) => { const [x, y] = s.split(":").map(Number); return x * 60 + y; };
  return Math.round((m(b) - m(a)) / 60);
}
export function bloqueFecha(f) { const d = fecha(f); return { dia: DIAS_C[d.getDay()], num: String(d.getDate()), mes: MESES_C[d.getMonth()] }; }
export function fechaLarga(f) { const d = fecha(f); const s = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; return s.charAt(0).toUpperCase() + s.slice(1); }
export function fechaCorta(f) { const d = fecha(f); return `${DIAS[d.getDay()]} ${d.getDate()}`; }
export function mesLargo(f) { return MESES[fecha(f).getMonth()]; }

function lunesDe(d) { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); x.setHours(0, 0, 0, 0); return x; }
export function grupoSemana(f) {
  const hoyL = lunesDe(new Date()); const l = lunesDe(fecha(f));
  const diff = Math.round((l - hoyL) / (7 * 86400000));
  if (diff <= 0) return "Esta semana";
  if (diff === 1) return "Próxima semana";
  const dom = new Date(l); dom.setDate(dom.getDate() + 6);
  return l.getMonth() === dom.getMonth()
    ? `Semana del ${l.getDate()} al ${dom.getDate()} ${MESES_C[dom.getMonth()]}`
    : `Semana del ${l.getDate()} ${MESES_C[l.getMonth()]} al ${dom.getDate()} ${MESES_C[dom.getMonth()]}`;
}
export function hoyYmd() { return ymd(new Date()); }
export function diasHasta(f) { const hoy = new Date(); hoy.setHours(0, 0, 0, 0); return Math.round((fecha(f) - hoy) / 86400000); }
export function plazo(f) {
  const d = diasHasta(f);
  const urgente = d <= DIAS_URGENTE;
  const txt = urgente ? (d <= 0 ? "Urgente · hoy" : d === 1 ? "Urgente · mañana" : `Urgente · ${d} días`) : `Faltan ${d} días`;
  return { dias: d, urgente, txt };
}
export function horaCorta(ts) { const d = new Date(ts); return d.toLocaleString("es-ES", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

// Mensajes para los motivos que devuelve la base de datos
export const MOTIVOS = {
  cogido: { titulo: "Se te han adelantado", texto: "Otra compañera ha cogido este turno hace un momento. Se lo queda la primera que acepta, pero hay más turnos esperándote." },
  ya_es_tuyo: { titulo: "Este turno ya es tuyo", texto: "Lo tienes en tus turnos." },
  caducado: { titulo: "Este turno ya ha pasado", texto: "La fecha de este turno ya ha pasado." },
  ya_trabajas: { titulo: "Ese día ya trabajas", texto: "Ya tienes otro turno ese mismo día." },
  no_libra: { titulo: "Ese día no libras", texto: "Solo puedes cubrir turnos de los días que tienes descanso." },
  descanso_12h: { titulo: "No tendrías 12 h de descanso", texto: "Entre el final de un turno y el comienzo del siguiente tiene que haber al menos 12 horas." },
  prioridad_apoyo: { titulo: "Todavía no está disponible", texto: "Las primeras 48 horas este turno es solo para las compañeras de apoyo." },
  sin_dia_cambio: { titulo: "No tienes día para cambiar", texto: "Necesitas un día de apoyo esa misma semana para librarlo a cambio." },
  elige_dia: { titulo: "Elige el día que libras", texto: "Escoge uno de tus días de apoyo de esa semana." },
  es_suya: { titulo: "Es tu propio descanso", texto: "Este turno es tuyo: está en la bolsa para que puedas descansar." },
  destino: { titulo: "No disponible", texto: "Este turno no es para tu tipo de contrato." },
  no_existe: { titulo: "Este turno ya no está", texto: "Dirección lo ha retirado de la bolsa." },
  menos_7_dias: { titulo: "Quedan menos de 7 días", texto: "Ya no puedes soltarlo desde la app. Llama a dirección." },
  cadena_cubierta: { titulo: "Ya no se puede deshacer solo", texto: "Tu cambio ya ha movido a otra compañera. Llama a dirección para arreglarlo." },
  no_es_tuyo: { titulo: "No disponible", texto: "Este turno no está a tu nombre." },
  sin_sesion: { titulo: "Sesión caducada", texto: "Vuelve a entrar en la app e inténtalo de nuevo." },
};
export const motivo = (m) => MOTIVOS[m] || MOTIVOS.cogido;
