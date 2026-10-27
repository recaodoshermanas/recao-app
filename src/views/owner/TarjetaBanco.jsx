// Cierre de mes → «Tarjeta frente al banco» (solicitud #74). Desde octubre de 2026: caja 1 (datáfono de BBVA, conectado)
// y caja 2 (datáfono de La Caixa, con el extracto en PDF que se sube en Finanzas → Bancos).
// Por día: tarjeta según Epos (esperado de los cierres de la caja), según el datáfono (contado), lo ingresado por el banco
// (BBVA: remesas «LIQUIDACION REMESA DE COMERCIOS»; La Caixa: «ON …» del día de la venta), comisión = datáfono − banco y descuadre = datáfono − Epos.
// La comisión del mes va a Servicios («Comisiones del datáfono · caja N») y el descuadre se suma a «Descuadres de caja».
import { useState } from "react";
import { F, SF, C, crd } from "../../lib/styles.js";
import { fmt2 } from "../../lib/utils.js";

const ROJO = "#B3261E";
const AMBAR = "#8A5A00";
const dinero = (v) => (v == null ? "–" : fmt2(Number(v)));
const conSigno = (v) => (v == null ? "–" : `${Number(v) > 0 ? "+" : ""}${fmt2(Number(v))}`);
const dia = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
const corto = (f) => new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
const num = (s) => { const t = String(s ?? "").trim().replace(/\s/g, ""); if (!t) return null; const x = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return Number.isFinite(x) ? x : NaN; };

// #81: «Dar por buena» y «Corregir» están en el panel, Finanzas → Efectivo → Caja → «Cuadre por turno».
const CAJAS = {
  1: { banco: "BBVA", nombre: "Caja 1 (datáfono de BBVA)" },
  2: { banco: "La Caixa", nombre: "Caja 2 (datáfono de La Caixa)" },
};

function TarjetaCaja({ caja, mes, datos, d, setDatos }) {
  const { banco, nombre } = CAJAS[caja];
  const [abierta, setAbierta] = useState(false);
  const t = d.totales || {};
  const ext = d.extracto;
  const sinExtracto = caja === 2 && ext && Number(ext.movimientos) === 0;
  const revisar = Number(t.por_revisar) > 0;
  const color = (v) => ({ fontWeight: 700, color: Number(v) < 0 ? ROJO : Number(v) > 0 ? "#1E6B3C" : C.mut });
  const tot = (l, v, extra) => (
    <div style={{ background: C.cream, borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</div>
      <div style={{ fontSize: 14, fontWeight: 700, ...(extra || {}) }}>{v}</div>
    </div>
  );
  return (
    <div style={{ ...crd, padding: 0, overflow: "hidden", border: revisar ? `2px solid ${AMBAR}` : crd.border }}>
      <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: SF, fontSize: 17, color: C.char }}>Tarjeta frente al banco · caja {caja}</span>
          <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2 }}>
            {nombre} · comisión {dinero(t.comision)} · descuadre {conSigno(t.descuadre)}{revisar ? ` · ${t.por_revisar} día${t.por_revisar === 1 ? "" : "s"} por revisar` : ""}
          </span>
        </span>
        <span style={{ fontFamily: F, fontSize: 13, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: revisar ? "#FBF0DA" : "#EAF4EE", color: revisar ? AMBAR : "#1E6B3C" }}>{revisar ? "Revisar" : "Al día"}</span>
        <span aria-hidden="true" style={{ fontFamily: F, fontSize: 18, color: C.mut, transform: abierta ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      {abierta && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.brdL}`, fontFamily: F }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, margin: "12px 0" }}>
            {tot("Tarjeta Epos", dinero(t.epos))}
            {tot("Datáfono", dinero(t.datafono))}
            {tot(`Ingresado ${banco}`, dinero(t.bbva))}
            {tot("Comisión", dinero(t.comision))}
            {tot("Descuadre", conSigno(t.descuadre), color(t.descuadre))}
            {tot("Días por revisar", String(t.por_revisar || 0), revisar ? { color: AMBAR } : null)}
          </div>
          <div style={{ fontSize: 12.5, color: C.mut, lineHeight: 1.45, marginBottom: 8 }}>
            {caja === 1
              ? "BBVA ingresa la tarjeta de cada día con fecha valor del día siguiente (lo del fin de semana llega junto el lunes). "
              : "La Caixa abona la tarjeta de cada día con un movimiento «ON …» cuyo número final es el día y mes de la venta (se lee del extracto en PDF que subes en Finanzas → Bancos); el pequeño cargo «C. …» del mismo día se suma a la comisión. "}
            Comisión = datáfono − {banco}: va como gasto en Servicios («Comisiones del datáfono · caja {caja}»). Descuadre = datáfono − Epos: si es negativo falta dinero, si es positivo sobra; se suma a «Descuadres de caja». Sale «Revisar» cuando la comisión es negativa o pasa del 3 %, o cuando a los 3 días hábiles no ha llegado la remesa.
            {Number(t.pendientes) > 0 ? ` Hay ${t.pendientes} día${Number(t.pendientes) === 1 ? "" : "s"} esperando la remesa: su comisión no cuenta todavía.` : ""}
          </div>
          {caja === 2 && (
            <div style={{ fontSize: 12.5, lineHeight: 1.45, marginBottom: 8, color: sinExtracto ? AMBAR : C.mut, fontWeight: sinExtracto ? 700 : 400 }}>
              {sinExtracto ? "Todavía no has subido el extracto de La Caixa: " : ext && ext.ultimo ? `Extracto de La Caixa cargado hasta el ${corto(ext.ultimo)}. Para actualizarlo, ` : ""}
              <a href="#/finanzas/bancos" style={{ color: "inherit" }}>súbelo en Finanzas → Bancos</a>.
            </div>
          )}
          <a href={`#/finanzas/efectivo/caja?mes=${mes}`} style={{ display: "inline-block", marginTop: 4, fontSize: 13.5, fontWeight: 700, color: C.char }}>Revisar en Caja →</a>
          <div style={{ fontSize: 11.5, color: C.mut, marginTop: 2 }}>Cada día se da por bueno o se corrige en Finanzas → Efectivo → Caja («Cuadre por turno»).</div>
        </div>
      )}
    </div>
  );
}

export function TarjetaBanco({ mes, datos, setDatos }) {
  if (mes < "2026-10" || datos === false) return null;
  if (!datos) return <div style={{ ...crd, fontFamily: F, fontSize: 13, color: C.mut }}>Cargando tarjeta frente al banco…</div>;
  if (!datos.aplica) return null;
  const c1 = datos.caja1 || { dias: datos.dias, totales: datos.totales };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <TarjetaCaja caja={1} mes={mes} datos={datos} d={c1} setDatos={setDatos} />
      {datos.caja2 && <TarjetaCaja caja={2} mes={mes} datos={datos} d={datos.caja2} setDatos={setDatos} />}
    </div>
  );
}
