// #71 · Exportar la Cuenta de resultados a Excel y a PDF. Las librerías se cargan al pulsar el botón.
import { num, mesCorto, mesAnio, parseDate } from "../fmt.js";

const n0 = (v) => Number(v) || 0;
const yy = (m) => String(parseDate(m).getFullYear()).slice(2);
export const etiquetaMes = (m) => `${mesCorto(m.mes)} ${yy(m.mes)}${m.cerrado ? "" : " (provisional)"}`;

// Tabla tal y como se ve en pantalla: mismos meses, mismas filas y mismo modo (€ o % de ingresos)
export function armarTabla({ meses, filas, margenFilas, modo, mes }) {
  const valor = (f, m) => {
    const v = f.get ? f.get(m) : m[f.k];
    if (f.get && v == null) return null;
    const x = n0(v), s = x && f.k === "reparto_sobres" ? -x : x;
    return modo === "pct" ? (m.ingresos ? s / m.ingresos * 100 : null) : s;
  };
  return {
    modo,
    cabecera: meses.map(etiquetaMes),
    filas: filas.map((f) => (f.sep ? { sep: true, label: f.l } : { label: f.l, b: !!(f.b || f.b2), valores: meses.map((m) => valor(f, m)), pct: modo === "pct" })),
    margen: margenFilas.map((f) => ({ label: f.l, valores: meses.map((m) => { const v = f.f(m); return v == null ? null : v; }), pct: !!f.pct })),
    desde: `${mesCorto(meses[0].mes)}${yy(meses[0].mes)}`,
    hasta: `${mesCorto(meses[meses.length - 1].mes)}${yy(meses[meses.length - 1].mes)}`,
    detalle: { titulo: `${mesAnio(mes.mes)}${mes.cerrado ? "" : " (provisional)"}`, hoja: `Detalle ${mesCorto(mes.mes)} ${yy(mes.mes)}`, filas: filasDetalle(mes) },
  };
}

// Detalle del mes elegido, como se ve debajo de la tabla
export function filasDetalle(mes) {
  const r = [];
  const add = (apartado, concepto, importe) => r.push({ apartado, concepto, importe: n0(importe) });
  add("Compras de mercancía", "Facturas de proveedores", mes.facturas);
  if (n0(mes.facturas_historico) > 0) add("Compras de mercancía", "  de ellas, total de la hoja sin detalle", mes.facturas_historico);
  [["facturas_efectivo", "pagadas en efectivo"], ["facturas_banco", "por banco"], ["facturas_caja_fuerte", "de la caja fuerte"], ["facturas_sobres", "con efectivo de sobres"]].forEach(([k, t]) => {
    const v = k === "facturas_banco" ? n0(mes.facturas_banco) + n0(mes.facturas_tarjeta) : n0(mes[k]);
    if (v) add("Compras de mercancía", `  de ellas, ${t}`, v);
  });
  Object.entries(mes.paqueteria_det || {}).filter(([, v]) => n0(v)).sort((a, b) => n0(b[1]) - n0(a[1])).forEach(([k, v]) => add("Paquetería", k, v));
  add("Paquetería", "Total paquetería", mes.paqueteria);
  (mes.salarios_det || []).filter((s) => n0(s.amount)).forEach((s) => add("Salarios", s.nombre || "Sin nombre", s.amount));
  if (n0(mes.extras) > 0) add("Salarios", "Extras a trabajadoras (efectivo de sobres)", mes.extras);
  const FIJ = { ss: "Seguridad Social", alquiler: "Alquiler", iva_alquiler: "IVA del alquiler", luz: "Luz", agua: "Agua", ayuntamiento: "Ayuntamiento", asesoria: "Asesoría", securitas: "Securitas", epos: "Epos", anthropic: "Anthropic-Claude", whatsapp: "WhatsApp Business", whatsapp_varios: "WhatsApp Business - Servicios Varios" };
  Object.entries(mes.fijos_det || {}).filter(([, v]) => n0(v)).forEach(([k, v]) => add("Gastos fijos", FIJ[k] || k, v));
  (mes.lineas || []).forEach((l) => add("Otros gastos", l.concepto, l.importe));
  (mes.mantenimiento_det || []).forEach((l) => add("Mantenimiento", l.concepto, l.importe));
  if (n0(mes.inversiones) > 0) add("Inversiones (fuera del resultado)", "Inversiones del mes", mes.inversiones);
  return r;
}

const nombreArchivo = (t, ext) => `Recao_cuenta_resultados_${t.desde}-${t.hasta}.${ext}`;

export async function exportarExcel(t) {
  const XLSX = await import("xlsx");
  const aoa = [["", ...t.cabecera]], fmt = [null];
  t.filas.forEach((f) => { if (f.sep) { aoa.push([f.label]); fmt.push(null); } else { aoa.push([f.label, ...f.valores.map((v) => (v == null ? "–" : v))]); fmt.push(f.pct ? '0.0"%"' : "#,##0"); } });
  aoa.push([]); fmt.push(null);
  aoa.push(["Margen real según Epos (sin IVA)"]); fmt.push(null);
  t.margen.forEach((f) => { aoa.push([f.label, ...f.valores.map((v) => (v == null ? "–" : v))]); fmt.push(f.pct ? '0.0"%"' : "#,##0"); });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  aoa.forEach((row, i) => row.forEach((v, c) => { if (c > 0 && typeof v === "number" && fmt[i]) ws[XLSX.utils.encode_cell({ r: i, c })].z = fmt[i]; }));
  ws["!cols"] = [{ wch: 36 }, ...t.cabecera.map(() => ({ wch: 13 }))];
  const det = [["Apartado", "Concepto", "Importe (€)"], ...t.detalle.filas.map((x) => [x.apartado, x.concepto, x.importe])];
  const wd = XLSX.utils.aoa_to_sheet(det);
  det.forEach((row, i) => { if (i > 0) wd[XLSX.utils.encode_cell({ r: i, c: 2 })].z = "#,##0.00"; });
  wd["!cols"] = [{ wch: 32 }, { wch: 46 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cuenta de resultados");
  XLSX.utils.book_append_sheet(wb, wd, t.detalle.hoja);
  XLSX.writeFile(wb, nombreArchivo(t, "xlsx"));
}

export async function exportarPdf(t) {
  const { jsPDF } = await import("jspdf");
  const at = await import("jspdf-autotable");
  const autoTable = [at.autoTable, at.default, at.default && at.default.autoTable, at.default && at.default.default].find((f) => typeof f === "function");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const txt = (v, pct) => (v == null ? "-" : `${num(v, pct ? 1 : 0)}${pct ? " %" : ""}`.replace("−", "-"));
  const ancho = doc.internal.pageSize.getWidth();
  const generado = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.setFontSize(15); doc.text("Recao · Cuenta de resultados", 10, 12);
  doc.setFontSize(9); doc.setTextColor(110);
  doc.text(`${t.cabecera[0]} a ${t.cabecera[t.cabecera.length - 1]} · ${t.modo === "pct" ? "% de ingresos" : "importes en €, con IVA"} · generado el ${generado}`, 10, 17);
  const n = t.cabecera.length, fuente = n > 12 ? 6.2 : n > 9 ? 7 : 8;
  const cuerpo = t.filas.map((f) => (f.sep
    ? [{ content: f.label, colSpan: n + 1, styles: { fontStyle: "bold", fillColor: [240, 236, 226] } }]
    : [{ content: f.label, styles: f.b ? { fontStyle: "bold" } : {} }, ...f.valores.map((v) => ({ content: txt(v, f.pct), styles: { halign: "right", ...(f.b ? { fontStyle: "bold" } : {}) } }))]));
  cuerpo.push([{ content: "Margen real según Epos (sin IVA)", colSpan: n + 1, styles: { fontStyle: "bold", fillColor: [240, 236, 226] } }]);
  t.margen.forEach((f) => cuerpo.push([f.label, ...f.valores.map((v) => ({ content: txt(v, f.pct), styles: { halign: "right" } }))]));
  autoTable(doc, {
    startY: 21, margin: { left: 10, right: 10, top: 10, bottom: 10 }, tableWidth: ancho - 20,
    head: [["", ...t.cabecera.map((c) => ({ content: c, styles: { halign: "right" } }))]],
    body: cuerpo,
    styles: { fontSize: fuente, cellPadding: 1.1, textColor: 30 }, headStyles: { fillColor: [40, 36, 30], textColor: 255 },
    columnStyles: { 0: { cellWidth: 46 } },
  });
  doc.addPage();
  doc.setFontSize(13); doc.setTextColor(30); doc.text(`Detalle · ${t.detalle.titulo}`, 10, 12);
  const det = []; let ult = null;
  t.detalle.filas.forEach((x) => {
    if (x.apartado !== ult) { det.push([{ content: x.apartado, colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 236, 226] } }]); ult = x.apartado; }
    det.push([x.concepto, { content: num(x.importe, 2), styles: { halign: "right" } }]);
  });
  autoTable(doc, { startY: 16, margin: { left: 10, right: 10, top: 10, bottom: 10 }, head: [["Concepto", { content: "Importe (€)", styles: { halign: "right" } }]], body: det, styles: { fontSize: 8.5, cellPadding: 1.2, textColor: 30 }, headStyles: { fillColor: [40, 36, 30], textColor: 255 }, columnStyles: { 0: { cellWidth: 200 } } });
  doc.save(nombreArchivo(t, "pdf"));
}
