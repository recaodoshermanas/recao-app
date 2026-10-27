// Facturas → «Paquete del trimestre» (solicitud #93): tres .zip para la gestoría (compras, mantenimiento e inversiones),
// cada uno con su Excel (hoja «Sin documento» incluida) y las fotos/PDF de las facturas que los tienen. Solo descarga; no envía nada.
import { useMemo, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { avisar, hoyStr } from "../ui.jsx";

const PAGO = { banco: "Banco", tarjeta: "Banco", efectivo: "Efectivo (caja)", caja_fuerte: "Caja fuerte", efectivo_sobres: "Efectivo sobres", efectivo_caja: "Efectivo (caja)", banco_bbva: "Banco (BBVA)", sin_indicar: "Sin indicar" };
const ORDINAL = ["1.er", "2.º", "3.er", "4.º"];
const msg = (e) => { const t = String(e?.message || e || ""); const m = /"(?:message|error)"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };

// Últimos 8 trimestres, empezando por el actual; por defecto el último terminado
function trimestres(hoy) {
  const a = Number(hoy.slice(0, 4)), q = Math.floor((Number(hoy.slice(5, 7)) - 1) / 3);
  const r = [];
  for (let i = 0; i < 8; i++) {
    const k = a * 4 + q - i, y = Math.floor(k / 4), t = k % 4;
    const m0 = t * 3 + 1, m1 = m0 + 3;
    r.push({ id: `${y}-${t + 1}`, y, t: t + 1, desde: `${y}-${String(m0).padStart(2, "0")}-01`, hasta: m1 > 12 ? `${y + 1}-01-01` : `${y}-${String(m1).padStart(2, "0")}-01`, label: `${ORDINAL[t]} trimestre de ${y}${i === 0 ? " (en curso)" : ""}` });
  }
  return r;
}
const limpio = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const extDe = (url, fallo) => { try { const e = /\.([A-Za-z0-9]{2,5})$/.exec(new URL(url).pathname); return e ? e[1].toLowerCase() : fallo; } catch (_) { return fallo; } };

async function urlDoc(tipo, fila) {
  if (tipo === "compra") { const r = await sb.fn("recepcion", { accion: "abrir", id: fila.recepcion_id }); return r?.recepcion?.doc_url || r?.recepcion?.foto_url || null; }
  const r = await sb.fn(tipo === "mantenimiento" ? "mantenimiento-foto" : "inversiones-foto", { accion: "ver", id: fila.id });
  return r?.url || null;
}
async function bajar(url) { const r = await fetch(url); if (!r.ok) throw new Error(String(r.status)); return { blob: await r.blob(), url }; }

// Hace de 4 en 4 para no saturar
async function enLotes(items, n, fn) {
  const sal = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; sal[k] = await fn(items[k], k); } }));
  return sal;
}

const TIPOS = {
  compra: { archivo: "facturas_compra", titulo: "Facturas de compra", concepto: false },
  mantenimiento: { archivo: "mantenimiento", titulo: "Mantenimiento", concepto: true },
  inversion: { archivo: "inversiones", titulo: "Inversiones", concepto: true },
};

async function armar(tipo, filas, tr, avance) {
  const [XLSX, { default: JSZip }] = await Promise.all([import("xlsx"), import("jszip")]);
  const T = TIPOS[tipo];
  const zip = new JSZip();
  const usados = new Set();
  let fallos = 0;
  // Documentos
  const conDoc = filas.filter((f) => f.tieneDoc);
  let hechos = 0;
  await enLotes(conDoc, 4, async (f) => {
    try {
      const url = await urlDoc(tipo, f.raw);
      if (!url) throw new Error("sin enlace");
      const { blob } = await bajar(url);
      const ext = extDe(url, blob.type === "application/pdf" ? "pdf" : "jpg");
      let base = [f.fecha, limpio(f.proveedor) || "sin-proveedor", limpio(f.numero) || (T.concepto ? limpio(f.concepto) : "")].filter(Boolean).join("_");
      let nombre = `${base}.${ext}`, n = 2;
      while (usados.has(nombre)) nombre = `${base}_${n++}.${ext}`;
      usados.add(nombre);
      zip.file(`documentos/${nombre}`, blob);
      f.archivo = nombre;
    } catch (_) { f.tieneDoc = false; f.fallo = true; fallos++; }
    avance(++hechos, conDoc.length);
  });
  // Excel
  const cab = ["Fecha", "Proveedor", "Número de factura", ...(T.concepto ? ["Concepto"] : []), "Importe", "Forma de pago", "Documento"];
  const fila = (f) => [f.fecha, f.proveedor, f.numero, ...(T.concepto ? [f.concepto] : []), f.importe, f.pago, f.tieneDoc ? "sí" : f.fallo ? "no (no se pudo descargar)" : "no"];
  const hoja = (lista, vacio) => {
    if (!lista.length) return XLSX.utils.aoa_to_sheet([[vacio]]);
    const total = lista.reduce((s, f) => s + (Number(f.importe) || 0), 0);
    const ws = XLSX.utils.aoa_to_sheet([cab, ...lista.map(fila), [], ["TOTAL", ...Array(T.concepto ? 3 : 2).fill(""), Math.round(total * 100) / 100]]);
    ws["!cols"] = cab.map((c) => ({ wch: c === "Proveedor" || c === "Concepto" ? 32 : 18 }));
    return ws;
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hoja(filas, "Sin facturas este trimestre"), "Facturas");
  if (filas.length) XLSX.utils.book_append_sheet(wb, hoja(filas.filter((f) => !f.tieneDoc), "Todas tienen documento"), "Sin documento");
  zip.file(`${T.archivo}_${tr.t}T_${tr.y}.xlsx`, XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  const out = await zip.generateAsync({ type: "blob" });
  return { out, nombre: `Recao_${T.archivo}_${tr.t}T_${tr.y}.zip`, fallos };
}

function descargar(blob, nombre) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

export function PaqueteTrimestre({ facturas }) {
  const hoy = hoyStr();
  const lista = useMemo(() => trimestres(hoy), [hoy]);
  const [id, setId] = useState(lista[1].id); // el último trimestre terminado
  const [estado, setEstado] = useState("");
  const [busy, setBusy] = useState(false);

  const preparar = async () => {
    const tr = lista.find((x) => x.id === id);
    setBusy(true);
    try {
      setEstado("Preparando… leyendo los datos");
      const [man, inv] = await Promise.all([sb.rpc("mantenimientos_datos"), sb.rpc("inversiones_datos")]);
      const dentro = (f) => f && String(f).slice(0, 10) >= tr.desde && String(f).slice(0, 10) < tr.hasta;
      const orden = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
      const datos = {
        compra: (facturas || []).filter((f) => dentro(f.fecha) && !/hist[óo]rico/i.test(f.proveedor || "")).map((f) => ({ raw: f, fecha: String(f.fecha).slice(0, 10), proveedor: f.proveedor, numero: f.doc_numero || "", importe: f.importe == null ? null : Number(f.importe), pago: PAGO[f.tipo_pago] || "", tieneDoc: !!(f.doc_path && f.recepcion_id) })),
        mantenimiento: (man?.items || []).filter((i) => dentro(i.fecha)).map((i) => ({ raw: i, fecha: String(i.fecha).slice(0, 10), proveedor: i.proveedor || "", numero: i.num_factura || "", concepto: i.concepto || "", importe: Number(i.importe), pago: PAGO[i.forma_pago] || "", tieneDoc: !!i.doc })),
        inversion: (inv?.items || []).filter((i) => dentro(i.fecha)).map((i) => ({ raw: i, fecha: String(i.fecha).slice(0, 10), proveedor: i.proveedor || "", numero: "", concepto: i.concepto || "", importe: Number(i.importe), pago: PAGO[i.forma_pago] || "", tieneDoc: !!i.foto })),
      };
      let fallos = 0; const n = Object.keys(datos).length;
      for (const [k, tipo] of Object.keys(datos).entries()) {
        datos[tipo].sort(orden);
        const r = await armar(tipo, datos[tipo], tr, (h, t) => setEstado(`Preparando ${TIPOS[tipo].titulo.toLowerCase()} (${k + 1}/${n})… documentos ${h}/${t}`));
        fallos += r.fallos;
        descargar(r.out, r.nombre);
        await new Promise((ok) => setTimeout(ok, 700)); // el navegador acepta varias descargas seguidas con una pequeña pausa
      }
      setEstado("");
      avisar(fallos ? `Paquete descargado. ${fallos} documento${fallos > 1 ? "s" : ""} no se ha podido bajar: sale marcado en el Excel` : "Paquete del trimestre descargado", fallos ? "mal" : "ok");
    } catch (e) { setEstado(""); avisar(msg(e), "mal"); }
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Paquete del trimestre</h2>
          <p className="sub" style={{ margin: "4px 0 0" }}>Para la gestoría: tres .zip (compras, mantenimiento e inversiones) con su Excel y las fotos y PDF de las facturas. Solo se descarga; no se envía nada.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label><span className="sr">Trimestre</span>
            <select value={id} onChange={(e) => setId(e.target.value)} disabled={busy}>{lista.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
          </label>
          <button className="btn-p" onClick={preparar} disabled={busy}>{busy ? "Preparando…" : "Paquete del trimestre"}</button>
        </div>
      </div>
      {estado && <p className="sub" style={{ margin: "8px 0 0" }}>{estado}</p>}
    </div>
  );
}
