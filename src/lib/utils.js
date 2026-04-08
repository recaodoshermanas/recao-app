import { MONTHS_ES, MONTHS_FULL } from "./constants";

export function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
export function fmt(n) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0); }
export function fmt2(n) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0); }
export function mkLabel(k) { const [y, m] = k.split("-"); return `${MONTHS_FULL[parseInt(m) - 1]} ${y}`; }
export function mkShort(k) { const [y, m] = k.split("-"); return `${MONTHS_ES[parseInt(m) - 1]} ${y.slice(2)}`; }
export function pn(v) { return parseFloat(String(v).replace(",", ".")) || 0; }

const now = new Date();
export const currentMK = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

export function calcMonth(facturas, md, mk) {
  if (md?.resumen_legacy) {
    const s = md.resumen_legacy;
    return { totalIngresos: s.ingresos, totalGastos: s.gastos, resultado: s.resultado, margen: s.ingresos > 0 ? (s.resultado / s.ingresos * 100) : 0, totalFacturas: 0, totalSalarios: 0, totalGastosFijos: 0, totalOtros: 0, totalInversiones: 0, reparto: 0, isSummary: true };
  }
  if (!md) return { totalIngresos: 0, totalGastos: 0, resultado: 0, margen: 0, totalFacturas: 0, totalSalarios: 0, totalGastosFijos: 0, totalOtros: 0, totalInversiones: 0, reparto: 0, isSummary: false };
  const facs = facturas.filter(f => f.fecha?.startsWith(mk));
  const tFac = facs.reduce((s, f) => s + parseFloat(f.importe), 0);
  const tIng = parseFloat(md.ventas_epos || 0) + Object.values(md.paqueteria || {}).reduce((s, v) => s + parseFloat(v), 0);
  const tSal = (md.salarios || []).reduce((s, e) => s + parseFloat(e.amount), 0);
  const tFij = Object.values(md.gastos_fijos || {}).reduce((s, v) => s + parseFloat(v), 0);
  const tOtr = (md.otros_gastos || []).reduce((s, e) => s + parseFloat(e.amount), 0);
  const tGas = tFac + tSal + tFij + tOtr;
  const res = tIng - tGas;
  const tInv = (md.inversiones || []).reduce((s, i) => s + parseFloat(i.amount), 0);
  return { totalIngresos: tIng, totalGastos: tGas, resultado: res, margen: tIng > 0 ? (res / tIng * 100) : 0, totalFacturas: tFac, totalSalarios: tSal, totalGastosFijos: tFij, totalOtros: tOtr, totalInversiones: tInv, reparto: parseFloat(md.reparto_socios || 0), isSummary: false };
}
