// Cierre de mes → «Stock» (solicitud #61). Solo sale cuando dirección ha puesto la fecha del inventario inicial
// (app_config.stock_inventario_fecha). Stock inicial = foto de la noche del último día del mes anterior; final = la del último día del mes.
// Los mismos datos que usa la Cuenta de resultados para la variación de existencias (función stock_cierre_mes).
import { useEffect, useState } from "react";
import { F, SF, C, crd } from "../../lib/styles.js";
import { fmt2 } from "../../lib/utils.js";
import { sb } from "../../lib/supabase.js";

const ROJO = "#B3261E";
const fecha = (f) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—");
const cant = (x) => `${Number(x.cantidad || 0).toLocaleString("es-ES", { maximumFractionDigits: 3 })} ${x.al_peso ? "kg" : "uds"}`;
const numTxt = (n, d = 0) => Number(n || 0).toLocaleString("es-ES", { maximumFractionDigits: d });

export function StockCierre({ mes, onActivo }) {
  const [d, setD] = useState(null);
  const [cmp, setCmp] = useState(null); // #119: comparación con el coste de Epos
  useEffect(() => {
    let vivo = true; setD(null); setCmp(null);
    sb.rpc("stock_comparacion_epos", { p_mes: mes }).then((r) => { if (vivo) setCmp(r || null); }).catch(() => { if (vivo) setCmp(null); });
    sb.rpc("stock_cierre_mes", { p_mes: mes }).then((r) => { if (vivo) { setD(r || false); onActivo?.(!!r?.activo); } }).catch(() => { if (vivo) { setD(false); onActivo?.(false); } });
    return () => { vivo = false; };
  }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d || !d.activo) return null;
  const fila = (t, v, extra = {}) => <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: F, fontSize: 13.5, color: C.char, padding: "3px 0", ...extra }}><span>{t}</span><span style={{ whiteSpace: "nowrap" }}>{v}</span></div>;
  const ud = (u, k) => `${numTxt(u, 0)} uds${Number(k) ? ` · ${numTxt(k, 2)} kg` : ""}`;
  return (
    <div style={crd}>
      {d.stock_inicial != null ? fila(`Stock inicial · noche del ${fecha(d.fecha_inicial)}`, <b>{fmt2(Number(d.stock_inicial))}</b>) : fila(`Stock inicial · noche del ${fecha(d.fecha_inicial)}`, <span style={{ color: C.mut }}>{d.falta_inicial ? "falta la foto" : "antes del inventario"}</span>)}
      {d.stock_inicial != null && fila("", ud(d.unidades_inicial, d.kg_inicial), { color: C.mut, fontSize: 12, padding: 0 })}
      {d.stock_final != null ? fila(`Stock final · noche del ${fecha(d.fecha_final)}`, <b>{fmt2(Number(d.stock_final))}</b>) : fila(`Stock final · noche del ${fecha(d.fecha_final)}`, <span style={{ color: d.falta_final ? ROJO : C.mut, fontWeight: d.falta_final ? 700 : 400 }}>{d.falta_final ? "falta la foto" : "aún no hay foto"}</span>)}
      {d.stock_final != null && fila("", ud(d.unidades_final, d.kg_final), { color: C.mut, fontSize: 12, padding: 0 })}
      {d.aplica
        ? fila("Variación de existencias (inicial − final)", <b>{fmt2(Number(d.variacion))}</b>, { borderTop: `1px solid ${C.brdL}`, marginTop: 6, paddingTop: 6 })
        : <div style={{ fontFamily: F, fontSize: 12.5, color: d.falta_final ? ROJO : C.mut, marginTop: 6, lineHeight: 1.4 }}>{d.falta_final ? "Falta la foto del stock del último día del mes: la Cuenta de resultados de este mes sigue con las compras hasta que haya foto." : "Este mes no tiene foto de stock inicial y final desde el inventario: la Cuenta de resultados usa las compras, como siempre."}</div>}
      {d.aplica && fila("", `${numTxt(d.variacion_unidades, 0)} uds${Number(d.variacion_kg) ? ` · ${numTxt(d.variacion_kg, 2)} kg` : ""}`, { color: C.mut, fontSize: 12, padding: 0 })}
      {d.aplica && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 6, lineHeight: 1.4 }}>Coste de la mercancía vendida = stock inicial + compras del mes − stock final. Es la cifra que usa la Cuenta de resultados.</div>}
      {d.aplica && cmp?.aplica && (
        <div style={{ borderTop: `1px solid ${C.brdL}`, marginTop: 10, paddingTop: 8 }}>
          <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700, color: C.char, marginBottom: 2 }}>Comparación del coste de lo vendido</div>
          {fila("Según stock (stock inicial + compras − stock final)", <b>{fmt2(Number(cmp.segun_stock))}</b>)}
          {fila("Según Epos (coste de cada venta, con IVA y recargo)", <b>{fmt2(Number(cmp.segun_epos))}</b>)}
          {fila("Diferencia (stock − Epos)", <b>{fmt2(Number(cmp.diferencia))}{cmp.diferencia_pct != null ? ` · ${Number(cmp.diferencia_pct).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %` : ""}</b>, { borderTop: `1px solid ${C.brdL}`, marginTop: 4, paddingTop: 6 })}
          <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 6, lineHeight: 1.4 }}>Las dos cifras van a coste completo (con IVA y recargo). Epos usa el coste que tenía cada producto al venderse; las devoluciones restan.{Number(cmp.lineas_sin_coste) > 0 ? ` ${numTxt(cmp.lineas_sin_coste)} líneas vendidas tienen coste 0 en Epos y no suman al coste según Epos.` : ""}</div>
        </div>
      )}
      {(d.sin_valorar || []).length > 0 && (
        <details style={{ marginTop: 10, fontFamily: F, fontSize: 13 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, color: C.char }}>Sin valorar (sin coste en Epos): {d.sin_valorar.length} productos</summary>
          {d.sin_valorar.map((x, i) => <div key={i}>{fila(<span style={{ color: C.mut }}>{x.nombre}{x.proveedor ? ` · ${x.proveedor}` : ""}</span>, cant(x))}</div>)}
        </details>
      )}
      {(d.negativos || []).length > 0 && (
        <details style={{ marginTop: 6, fontFamily: F, fontSize: 13 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, color: C.char }}>Stock negativo: {d.negativos.length} productos</summary>
          {d.negativos.map((x, i) => <div key={i}>{fila(<span style={{ color: C.mut }}>{x.nombre}{x.proveedor ? ` · ${x.proveedor}` : ""}</span>, cant(x))}</div>)}
        </details>
      )}
      <div style={{ fontFamily: SF, fontSize: 12, color: C.mut, marginTop: 8 }}>Inventario inicial: {fecha(d.inventario)}</div>
    </div>
  );
}
