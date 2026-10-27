// Extracto de CaixaBank (cuenta de la caja 2), solicitud #74. Se lee en el navegador: el PDF de CaixaBankNow
// es una tabla «Concepto · Fecha · Importe · Saldo» (una sola fecha por movimiento). También se acepta texto pegado
// con las columnas separadas por «;» (fecha;concepto;importe;saldo). Al servidor solo llegan los movimientos ya leídos.

const IMP = "[+-]?\\d[\\d.]*,\\d{2}";
const SAL = "-?\\d[\\d.]*,\\d{2}";
const R_PDF = new RegExp(`^(.+?)\\s+(\\d{2}[/-]\\d{2}[/-]\\d{4})\\s+(${IMP})\\s*€?\\s+(${SAL})\\s*€?$`);
const R_TXT = new RegExp(`^(\\d{2}[/-]\\d{2}[/-]\\d{4})\\s*;\\s*(.+?)\\s*;\\s*(${IMP})\\s*€?\\s*;\\s*(${SAL})\\s*€?$`);

const euros = (t) => Math.round(Number(String(t).replace(/\./g, "").replace(",", ".")) * 100) / 100;
const iso = (d) => { const [dd, mm, aa] = d.split(/[/-]/); return `${aa}-${mm}-${dd}`; };
const limpia = (l) => l.replace(/[   ]/g, " ").replace(/[−–]/g, "-").replace(/\s+/g, " ").trim();

// Texto (de un PDF o pegado) → movimientos en el orden del archivo
export function parsearTexto(texto) {
  const movs = [];
  let ignoradas = 0;
  for (const bruta of String(texto || "").split(/\r?\n/)) {
    const l = limpia(bruta);
    if (!l) continue;
    let m = R_TXT.exec(l);
    let fecha, concepto, imp, sal;
    if (m) [, fecha, concepto, imp, sal] = m;
    else if ((m = R_PDF.exec(l))) [, concepto, fecha, imp, sal] = m;
    else { if (/\d{2}[/-]\d{2}[/-]\d{4}/.test(l)) ignoradas++; continue; }
    movs.push({ fecha: iso(fecha), concepto: concepto.trim(), importe: euros(imp), saldo: euros(sal) });
  }
  return resumen(movs, ignoradas);
}

// Comprueba que los saldos encadenan (saldo anterior + importe = saldo siguiente) y dice en qué orden viene el archivo
export function resumen(movs, ignoradas = 0) {
  const cadena = (nuevoPrimero) => {
    let ok = 0;
    for (let i = 0; i + 1 < movs.length; i++) {
      const [nuevo, viejo] = nuevoPrimero ? [movs[i], movs[i + 1]] : [movs[i + 1], movs[i]];
      if (Math.abs(viejo.saldo + nuevo.importe - nuevo.saldo) < 0.005) ok++;
    }
    return ok;
  };
  const pares = Math.max(movs.length - 1, 0);
  const okDesc = cadena(true), okAsc = cadena(false);
  const nuevoPrimero = okDesc >= okAsc;
  const ok = Math.max(okDesc, okAsc);
  const ultimo = movs.length ? (nuevoPrimero ? movs[0] : movs[movs.length - 1]) : null;
  const fechas = movs.map((m) => m.fecha).sort();
  return { movs, ignoradas, pares, encadenan: ok, desde: fechas[0] || null, hasta: fechas[fechas.length - 1] || null, saldoFinal: ultimo ? ultimo.saldo : null };
}

// PDF → texto por filas (se agrupan los trozos de texto que están a la misma altura)
export async function leerPdf(archivo) {
  const pdfjs = await import("pdfjs-dist/build/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
  const lineas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pag = await (await doc.getPage(n)).getTextContent();
    const filas = [];
    for (const it of pag.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = it.transform[5], x = it.transform[4];
      const f = filas.find((r) => Math.abs(r.y - y) < 3);
      if (f) f.trozos.push({ x, s: it.str }); else filas.push({ y, trozos: [{ x, s: it.str }] });
    }
    filas.sort((a, b) => b.y - a.y);
    for (const f of filas) lineas.push(f.trozos.sort((a, b) => a.x - b.x).map((t) => t.s.trim()).join(" "));
  }
  return lineas.join("\n");
}
