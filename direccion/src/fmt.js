// Formatos en español (agrupando miles también en números de 4 cifras: 4.007 €)
function group(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

export function num(n, dec = 0) {
  if (n == null || isNaN(n)) return "–";
  const neg = n < 0; const v = Math.abs(Number(n));
  const [i, d] = v.toFixed(dec).split(".");
  return (neg ? "−" : "") + group(i) + (d ? "," + d : "");
}
export const eur = (n, dec = 0) => (n == null ? "–" : `${num(n, dec)} €`);
export function eurK(n) {
  if (n == null) return "–";
  return Math.abs(n) >= 10000 ? `${num(n / 1000, 0)}k` : num(n);
}
export const pct = (n, dec = 1) => (n == null ? "–" : `${num(n, dec)} %`);

// variación relativa → { txt, cls }
export function delta(actual, base) {
  if (!base) return { v: null, txt: "–", cls: "flat" };
  const v = (actual - base) / base * 100;
  const r = Math.round(v);
  const cls = r > 0 ? "up" : r < 0 ? "down" : "flat";
  const txt = `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r)} %`;
  return { v, txt, cls };
}
export const arrow = (cls) => (cls === "up" ? "↑" : cls === "down" ? "↓" : "→");

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_C = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function parseDate(s) { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); }
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const diaLargo = (s) => { const d = parseDate(s); return `${cap(DIAS[d.getDay()])}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };
export const nombreDia = (s) => DIAS[parseDate(s).getDay()];
export const letraDia = (i) => DIAS_C[i];
export const nombreMes = (s) => MESES[parseDate(s).getMonth()];
export const mesCorto = (s) => MESES_C[parseDate(s).getMonth()];
export const mesAnio = (s) => { const d = parseDate(s); return `${cap(MESES[d.getMonth()])} ${d.getFullYear()}`; };
export const hora = (s) => s ? s.slice(11, 16) : "–";
export function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
// Nombres de producto de Epos vienen a veces EN MAYÚSCULAS: los pasamos a forma de frase
export function bonito(s) {
  if (!s) return "";
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (letters && letters === letters.toUpperCase()) { const l = s.toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); }
  return s;
}
