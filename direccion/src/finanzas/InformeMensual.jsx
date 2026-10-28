// Resumen de Finanzas → «Informe para la reunión» (solicitud #65): cifras del mes + comentarios de Claude, en pantalla y en PDF.
import "../informe.css";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../src/lib/supabase.js";
import { eur, pct, num, mesAnio } from "../fmt.js";

const n0 = (v) => Number(v) || 0;
const mesAnterior = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const mesActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const nombreMes = (mes) => mesAnio(`${mes}-01`);
const fechaHora = (s) => new Date(s).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const margenDe = (m) => (m && n0(m.epos_sin_iva) > 0 ? (n0(m.epos_sin_iva) - n0(m.epos_coste)) / n0(m.epos_sin_iva) * 100 : null);
const dif = (a, b) => (a == null || b == null ? "–" : `${a - b > 0 ? "+" : a - b < 0 ? "−" : ""}${num(Math.abs(a - b), 0)} €`);
const difPct = (a, b) => (!b || a == null ? "–" : `${a >= b ? "+" : "−"}${num(Math.abs((a - b) / b * 100), 1)} %`);

const CATS = [
  ["mercancia", "Compras de mercancía"], ["personal", "Personal"], ["local", "Local y suministros"],
  ["servicios", "Servicios"], ["mantenimiento", "Mantenimiento y equipamiento"], ["impuestos", "Impuestos"], ["otros", "Otros"],
];

function Tabla({ cols, filas }) {
  return (
    <table className="inf-tabla">
      <thead><tr>{cols.map((c, i) => <th key={i} className={i ? "d" : ""}>{c}</th>)}</tr></thead>
      <tbody>{filas.map((f, i) => <tr key={i}>{f.map((c, j) => <td key={j} className={j ? "d" : ""}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}
function Apartado({ n, titulo, texto, children }) {
  return (
    <section className="inf-ap">
      <h3><span>{n}</span> {titulo}</h3>
      {children}
      <p className="inf-com">{texto ? texto : "Sin comentario."}</p>
    </section>
  );
}

function InformeV1({ inf }) {
  const d = inf.datos, c = inf.comentarios || {}, m = d.mes_datos || {}, a = d.mes_anterior, y = d.mismo_mes_ano_anterior;
  const tk = n0(d.ventas?.tickets), tka = n0(d.ventas?.tickets_anterior);
  const medio = (mm, t) => (mm && t ? n0(mm.epos_venta) / t : null);
  const porDia = (mm) => (mm && n0(mm.epos_dias) ? n0(mm.epos_venta) / n0(mm.epos_dias) : null);
  const ef = d.efectivo_sobres, cf = d.caja_fuerte || {}, bk = d.banco || {}, pp = d.pendientes_pago || {}, sc = d.apertura_sobres || {};
  const cambios = CATS.map(([id, l]) => ({ l, v: n0(m[id]), p: a ? n0(a[id]) : null })).filter((x) => x.p != null).sort((x, z) => Math.abs(z.v - z.p) - Math.abs(x.v - x.p));
  const mayor = cambios[0];
  return (
    <article className="inf-doc">
      <header className="inf-cab">
        <h2>Informe de Finanzas · {nombreMes(inf.mes)}</h2>
        <p>Versión {inf.version} · generado el {fechaHora(inf.creado_en)} por {inf.quien || "—"}</p>
      </header>
      {d.provisional && (
        <div className="inf-prov"><b>Cifras provisionales:</b> el cierre del mes no está completo. Falta: {(d.falta || []).join("; ") || "revisar el cierre"}.</div>
      )}

      <Apartado n="1" titulo="Resumen del mes" texto={c.resumen}>
        <dl className="inf-kpis">
          <div><dt>Resultado</dt><dd>{eur(m.resultado)}</dd></div>
          <div><dt>Ingresos</dt><dd>{eur(m.ingresos)}</dd></div>
          <div><dt>Venta de Epos</dt><dd>{eur(m.epos_venta)}</dd></div>
          <div><dt>Margen real</dt><dd>{margenDe(m) == null ? "–" : pct(margenDe(m))}</dd></div>
        </dl>
      </Apartado>

      <Apartado n="2" titulo="Ventas" texto={c.ventas}>
        <Tabla cols={["", nombreMes(inf.mes), a ? mesAnio(a.mes) : "Mes anterior", y ? mesAnio(y.mes) : "Mismo mes año anterior"]} filas={[
          ["Venta de Epos", eur(m.epos_venta, 2), a ? eur(a.epos_venta, 2) : "–", y ? eur(y.epos_venta, 2) : "no hay datos"],
          ["Tickets", num(tk), tka ? num(tka) : "–", "–"],
          ["Ticket medio", eur(medio(m, tk), 2), eur(medio(a, tka), 2), "–"],
          ["Venta media por día", eur(porDia(m), 0), eur(porDia(a), 0), y ? eur(porDia(y), 0) : "–"],
          ["Variación de la venta", "", a ? difPct(n0(m.epos_venta), n0(a.epos_venta)) : "–", y ? difPct(n0(m.epos_venta), n0(y.epos_venta)) : "–"],
        ]} />
      </Apartado>

      <Apartado n="3" titulo="Margen" texto={c.margen}>
        <Tabla cols={["", nombreMes(inf.mes), a ? mesAnio(a.mes) : "Mes anterior"]} filas={[
          ["Margen real de Epos", margenDe(m) == null ? "–" : pct(margenDe(m)), margenDe(a) == null ? "–" : pct(margenDe(a))],
          // #61: con stock inicial y final, «mercancia» ya es el coste de lo vendido y las compras van aparte
          ["Compras de mercancía (facturas)", eur(m.compras_mercancia ?? m.mercancia, 0), a ? eur(a.compras_mercancia ?? a.mercancia, 0) : "–"],
          ...((m.variacion_existencias != null || a?.variacion_existencias != null) ? [
            ["Stock inicial", m.stock_inicial != null ? eur(m.stock_inicial, 0) : "–", a?.stock_inicial != null ? eur(a.stock_inicial, 0) : "–"],
            ["Stock final", m.stock_final != null ? eur(m.stock_final, 0) : "–", a?.stock_final != null ? eur(a.stock_final, 0) : "–"],
            ["Variación de existencias", m.variacion_existencias != null ? eur(m.variacion_existencias, 0) : "–", a?.variacion_existencias != null ? eur(a.variacion_existencias, 0) : "–"],
            ["Coste de la mercancía vendida", m.variacion_existencias != null ? eur(m.mercancia, 0) : "–", a?.variacion_existencias != null ? eur(a.mercancia, 0) : "–"],
          ] : []),
          ["Coste de lo vendido (Epos)", eur(m.epos_coste, 0), a ? eur(a.epos_coste, 0) : "–"],
          ["Compras menos coste de lo vendido", eur(n0(m.compras_mercancia ?? m.mercancia) - n0(m.epos_coste), 0), a ? eur(n0(a.compras_mercancia ?? a.mercancia) - n0(a.epos_coste), 0) : "–"],
        ]} />
      </Apartado>

      <Apartado n="4" titulo="Gastos" texto={c.gastos}>
        <Tabla cols={["Categoría", nombreMes(inf.mes), a ? mesAnio(a.mes) : "Mes anterior", "Cambio"]} filas={[
          ...CATS.map(([id, l]) => [l, eur(m[id], 0), a ? eur(a[id], 0) : "–", a ? dif(n0(m[id]), n0(a[id])) : "–"]),
          ["Gastos totales", eur(m.gastos, 0), a ? eur(a.gastos, 0) : "–", a ? dif(n0(m.gastos), n0(a.gastos)) : "–"],
        ]} />
        {mayor && Math.abs(mayor.v - mayor.p) > 0 && <p className="inf-nota">Lo que más ha cambiado: {mayor.l} ({dif(mayor.v, mayor.p)}).</p>}
      </Apartado>

      <Apartado n="5" titulo="Resultado" texto={c.resultado}>
        <Tabla cols={["", "Importe"]} filas={[
          ["Beneficio del negocio (resultado del mes)", eur(m.resultado, 0)],
          ["Descuadres de caja", eur(m.descuadres_caja, 0)],
          ...(d.socio ? [["Reparto a socios", eur(m.reparto_sobres, 0)], ["Resultado tras el reparto", eur(m.resultado_tras_reparto, 0)]] : []),
        ]} />
      </Apartado>

      <Apartado n="6" titulo="Efectivo" texto={c.efectivo}>
        <Tabla cols={["", "Importe"]} filas={[
          ["Apertura de sobres: contado", eur(sc.contado, 2)],
          ["Apertura de sobres: esperado", eur(sc.esperado, 2)],
          ["Apertura de sobres: descuadre", eur(sc.diferencia, 2)],
          ["Sobres sin revisar", num(sc.sin_revisar)],
          ...(ef ? [
            ["Efectivo de sobres: entrada del mes", eur(ef.entrada, 2)],
            ["Efectivo de sobres: salidas", eur(ef.total_salidas, 2)],
            ["Efectivo de sobres: lo que queda", eur(ef.saldo, 2)],
          ] : []),
          ["Caja fuerte: recargas del mes", eur(cf.recargas, 2)],
          ["Caja fuerte: pagos del mes", eur(cf.pagos, 2)],
          ["Caja fuerte: saldo a fin de mes", eur(cf.saldo_fin_mes, 2)],
        ]} />
      </Apartado>

      <Apartado n="7" titulo="Banco" texto={c.banco}>
        <Tabla cols={["", "Importe"]} filas={[
          [`Saldo ${bk.banco || "del banco"} a principio de mes`, eur(bk.saldo_inicial, 2)],
          ["Entradas del mes", eur(bk.entradas, 2)],
          ["Salidas del mes", eur(bk.salidas, 2)],
          [`Saldo ${bk.banco || "del banco"} a final de mes`, eur(bk.saldo_final, 2)],
          [`Facturas pendientes de pago al cierre (${num(pp.n)})`, eur(pp.importe, 2)],
        ]} />
        {(pp.mayores || []).length > 0 && <p className="inf-nota">Las mayores: {pp.mayores.map((p) => `${p.proveedor} ${eur(p.importe, 2)}`).join(" · ")}.</p>}
        <p className="inf-nota">El saldo de cada mes se calcula a partir del saldo actual del banco y de los movimientos posteriores.</p>
      </Apartado>

      <section className="inf-ap">
        <h3><span>8</span> Avisos y puntos a tratar en la reunión</h3>
        {(c.avisos || []).length ? <ul className="inf-avisos">{c.avisos.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="inf-com">Sin avisos.</p>}
      </section>
    </article>
  );
}


// ---------- #104: informe v2 (todas las cifras, variaciones y medias vienen ya calculadas en los datos) ----------
const fecha = (f) => (f ? `${String(f).slice(8, 10)}/${String(f).slice(5, 7)}/${String(f).slice(0, 4)}` : "–");
const signo = (v, txt) => (v == null ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${txt}`);
const pctVar = (v) => (v == null ? "–" : signo(v, `${num(Math.abs(v), 1)} %`));
const eurDif = (v, dec = 0) => (v == null ? "–" : signo(v, `${num(Math.abs(v), dec)} €`));
const ppDif = (v) => (v == null ? "–" : signo(v, `${num(Math.abs(v), 1)} pp`));
const mesCortoDe = (m) => mesAnio(`${m}-01`);

const MET = {
  ventas: ["Venta de Epos (con IVA)", (v) => eur(v, 0)], tickets: ["Tickets", (v) => num(v)], ticket_medio: ["Ticket medio", (v) => eur(v, 2)],
  venta_dia: ["Venta media por día", (v) => eur(v, 0)], margen_pct: ["Margen real de Epos", (v) => pct(v, 1)],
  coste_vendido: ["Coste de lo vendido (Epos)", (v) => eur(v, 0)], compras: ["Compras de mercancía", (v) => eur(v, 0)], dif_compras_coste: ["Compras menos coste de lo vendido", (v) => eur(v, 0)],
  res_tienda: ["Resultado de la tienda", (v) => eur(v, 0)], res_paqueteria: ["Resultado de la paquetería", (v) => eur(v, 0)], resultado: ["Beneficio del negocio", (v) => eur(v, 0)],
  gastos: ["Gastos totales", (v) => eur(v, 0)], mercancia: ["Compras de mercancía (gasto)", (v) => eur(v, 0)], personal: ["Personal (total)", (v) => eur(v, 0)],
  local: ["Local y suministros", (v) => eur(v, 0)], servicios: ["Servicios", (v) => eur(v, 0)], impuestos: ["Impuestos", (v) => eur(v, 0)],
  mantenimiento: ["Mantenimiento y equipamiento", (v) => eur(v, 0)], otros: ["Otros", (v) => eur(v, 0)],
  descuadres_caja: ["Descuadres de caja", (v) => eur(v, 2)], dinero_total: ["Dinero total a fin de mes (bancos + efectivo)", (v) => eur(v, 0)],
};
const CATS_V2 = [["mercancia", "Compras de mercancía"], ["personal", "Personal"], ["local", "Local y suministros"], ["servicios", "Servicios"], ["mantenimiento", "Mantenimiento y equipamiento"], ["impuestos", "Impuestos"], ["otros", "Otros"]];
const CAT_NOMBRE = Object.fromEntries(CATS_V2);

// tabla con los meses anteriores, la media, este mes y el mismo mes del año anterior
function TablaComp({ d, ks, mes }) {
  const comp = d.comparativa || {}, filas = comp.filas || [];
  const meses = comp.meses || [];
  const f0 = filas[0];
  const cabMeses = meses.length ? meses : ((f0 && f0.serie) || []).map((x) => x.mes);
  return (
    <>
      <div className="inf-scroll">
        <table className="inf-tabla inf-comp">
          <thead><tr>
            <th />
            {cabMeses.map((m) => <th key={m} className="d">{mesCortoDe(m)}</th>)}
            <th className="d">Media {cabMeses.length ? `${cabMeses.length} m.` : ""}</th>
            <th className="d inf-act">{nombreMes(mes)}</th>
            <th className="d">{comp.hay_aa ? "Mismo mes año ant." : "Año ant."}</th>
            <th className="d">Dif. con la media</th>
            <th className="d">Dif. con año ant.</th>
          </tr></thead>
          <tbody>
            {ks.map((k) => {
              const f = filas.find((x) => x.k === k); if (!f) return null;
              const [l, fm] = MET[k]; const esPct = k === "margen_pct";
              const dm = esPct ? ppDif(f.dif_media) : f.pct_media != null ? `${pctVar(f.pct_media)}` : eurDif(f.dif_media);
              const da = esPct ? ppDif(f.dif_aa) : f.pct_aa != null ? `${pctVar(f.pct_aa)}` : eurDif(f.dif_aa);
              return (
                <tr key={k}>
                  <td>{l}</td>
                  {cabMeses.map((m) => { const sv = (f.serie || []).find((x) => x.mes === m); return <td key={m} className="d">{sv && sv.v != null ? fm(sv.v) : "–"}</td>; })}
                  <td className="d">{f.media6 != null ? fm(f.media6) : "–"}</td>
                  <td className="d inf-act"><b>{f.actual != null ? fm(f.actual) : "–"}</b></td>
                  <td className="d">{f.mismo_mes_aa != null ? fm(f.mismo_mes_aa) : "–"}</td>
                  <td className="d">{dm}</td>
                  <td className="d">{da}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="inf-nota">
        {comp.n_meses < 6 ? `Solo hay ${comp.n_meses} mes${comp.n_meses === 1 ? "" : "es"} con datos antes de este. ` : ""}
        {comp.hay_aa ? "" : "No hay datos del mismo mes del año anterior. "}
        Las diferencias son en % (en puntos, «pp», para el margen) y salen ya calculadas.
      </p>
    </>
  );
}

function InformeV2({ inf }) {
  const d = inf.datos, c = inf.comentarios || {}, mes = inf.mes;
  const k = d.kpis || {}, tp = d.tienda_paq || {}, gd = d.gastos_det || {}, cm = d.compras || {}, st = d.stock || {}, cj = d.caja || {}, ef = d.efectivo || {};
  const cf = d.caja_fuerte || {}, bb = d.banco || {}, cx = d.banco_caixa || {}, se = d.sin_explicar || {}, pp = d.pendientes_pago || {}, ts = d.tesoreria || {}, sc = d.apertura_sobres || {};
  const efs = d.efectivo_sobres, rep = d.repartir_socios, im = d.impuestos, vivo = ef.vivo, evo = ef.recorrido, pv = ts.previsiones || {}, fm = ts.fin_de_mes;
  const c1 = cj.caja1, c2 = cj.caja2;
  const hayStock = st.activo && (st.stock_inicial != null || st.stock_final != null);
  const fila = (l, v) => [l, v];
  return (
    <article className="inf-doc">
      <header className="inf-cab">
        <h2>Informe de Finanzas · {nombreMes(mes)}</h2>
        <p>Versión {inf.version} · generado el {fechaHora(inf.creado_en)} por {inf.quien || "—"}</p>
      </header>
      {d.provisional && (
        <div className="inf-prov">
          <b>Cifras provisionales:</b> el mes no está completo. Lo que falta según la lista de cierre:
          <ul>{(d.falta || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      <Apartado n="1" titulo="El mes en una línea y cifras clave" texto={c.resumen}>
        <dl className="inf-kpis inf-kpis5">
          <div><dt>Venta de Epos</dt><dd>{eur(k.ventas, 0)}</dd></div>
          <div><dt>Margen real</dt><dd>{k.margen_pct == null ? "–" : pct(k.margen_pct, 1)}</dd></div>
          <div><dt>Resultado del mes</dt><dd>{eur(k.resultado, 0)}</dd></div>
          <div><dt>Descuadres de caja</dt><dd>{eur(k.descuadres_caja, 2)}</dd></div>
          <div><dt>Dinero total a fin de mes</dt><dd>{k.dinero_total == null ? "–" : eur(k.dinero_total, 0)}</dd></div>
        </dl>
      </Apartado>

      <Apartado n="2" titulo="Ventas" texto={c.ventas}>
        <TablaComp d={d} mes={mes} ks={["ventas", "tickets", "ticket_medio", "venta_dia"]} />
      </Apartado>

      <Apartado n="3" titulo="Margen" texto={c.margen}>
        <TablaComp d={d} mes={mes} ks={["margen_pct", "coste_vendido", "compras", "dif_compras_coste"]} />
      </Apartado>

      <Apartado n="4" titulo="Tienda y paquetería" texto={c.tienda_paq}>
        <Tabla cols={["", nombreMes(mes)]} filas={[
          ["Tienda · ventas (con IVA)", eur(tp.tienda_ventas, 0)],
          ["Tienda · gastos (todos los gastos van a la tienda)", eur(tp.tienda_gastos, 0)],
          ["Resultado de la tienda", eur(tp.tienda_resultado, 0)],
          ["Paquetería · ingresos (solo sus comisiones)", eur(tp.paq_ingresos, 0)],
          ["Resultado de la paquetería", eur(tp.paq_resultado, 0)],
          ["Descuadres de caja", eur(tp.descuadres_caja, 2)],
          ["Beneficio del negocio (suma de todo)", eur(tp.total, 0)],
        ]} />
        <TablaComp d={d} mes={mes} ks={["res_tienda", "res_paqueteria", "resultado"]} />
        {tp.paq_detalle && Object.keys(tp.paq_detalle).length > 0 && <p className="inf-nota">Paquetería por empresa: {Object.entries(tp.paq_detalle).map(([n, v]) => `${n} ${eur(v, 2)}`).join(" · ")}.</p>}
      </Apartado>

      <Apartado n="5" titulo="Gastos con detalle" texto={c.gastos}>
        <TablaComp d={d} mes={mes} ks={["gastos", ...CATS_V2.map(([id]) => id)]} />
        {(gd.mayores_cambios || []).length > 0 && (
          <>
            <h4 className="inf-sub">Las líneas que más cambian respecto al mes anterior</h4>
            <Tabla cols={["Línea", "Categoría", nombreMes(mes), "Mes anterior", "Cambio"]} filas={gd.mayores_cambios.map((x) => [x.c, CAT_NOMBRE[x.cat] || x.cat, eur(x.importe, 0), x.anterior == null ? "–" : eur(x.anterior, 0), eurDif(x.dif, 0)])} />
          </>
        )}
        {CATS_V2.filter(([id]) => id !== "personal").map(([id, l]) => {
          const g = gd[id]; const lineas = g ? (g.lineas || []).filter((x) => x.importe != null) : []; if (!lineas.length) return null;
          return (
            <div key={id}>
              <h4 className="inf-sub">{l}</h4>
              <Tabla cols={["Línea", nombreMes(mes), "Mes anterior", "Cambio"]} filas={lineas.map((x) => [x.c, eur(x.importe, 0), x.anterior == null ? "–" : eur(x.anterior, 0), eurDif(x.dif, 0)])} />
            </div>
          );
        })}
        {gd.personal && <p className="inf-nota">Personal: solo como total, sin nombres. Total {eur(gd.personal.total, 0)}, de los cuales salarios {eur(gd.personal.salarios, 0)} (mes anterior: personal {gd.personal.anterior == null ? "–" : eur(gd.personal.anterior, 0)}, salarios {gd.personal.salarios_anterior == null ? "–" : eur(gd.personal.salarios_anterior, 0)}).</p>}
        {gd.hay_detalle === false && <p className="inf-nota">No se ha podido leer el detalle por líneas de este mes.</p>}
      </Apartado>

      <Apartado n="6" titulo="Compras y proveedores" texto={c.compras}>
        {(cm.principales || []).length ? (
          <>
            <p className="inf-nota">Compras del mes a proveedores: {eur(cm.total, 0)}.</p>
            <Tabla cols={["Proveedor", nombreMes(mes), "Peso en el mes", "Mes anterior", "Cambio", "Cambio %"]} filas={cm.principales.map((x) => [x.proveedor, eur(x.importe, 0), x.peso_pct == null ? "–" : pct(x.peso_pct, 1), x.anterior == null ? "–" : eur(x.anterior, 0), eurDif(x.dif, 0), pctVar(x.pct)])} />
            {(cm.subidas || []).length > 0 && (
              <>
                <h4 className="inf-sub">Los proveedores que más han subido</h4>
                <Tabla cols={["Proveedor", nombreMes(mes), "Mes anterior", "Subida", "Subida %"]} filas={cm.subidas.map((x) => [x.proveedor, eur(x.importe, 0), eur(x.anterior, 0), eurDif(x.dif, 0), pctVar(x.pct)])} />
              </>
            )}
          </>
        ) : <p className="inf-nota">No hay compras por proveedor de este mes.</p>}
      </Apartado>

      <Apartado n="7" titulo="Stock" texto={c.stock}>
        {hayStock ? (
          <Tabla cols={["", "Importe"]} filas={[
            ["Stock a principio de mes", st.stock_inicial != null ? eur(st.stock_inicial, 0) : "–"],
            ["Stock a final de mes", st.stock_final != null ? eur(st.stock_final, 0) : "–"],
            ["Variación de existencias", st.variacion != null ? eur(st.variacion, 0) : "–"],
            ["Productos sin valorar (última foto)", st.sin_valorar_n != null ? `${num(st.sin_valorar_n)} productos · ${num(st.sin_valorar_unid)} unidades` : "–"],
          ]} />
        ) : <p className="inf-nota">Todavía no hay datos de stock.</p>}
      </Apartado>

      <Apartado n="8" titulo="Caja y descuadres" texto={c.caja}>
        <Tabla cols={["Apertura de sobres", "Importe"]} filas={[
          ["Contado", eur(sc.contado, 2)], ["Esperado", eur(sc.esperado, 2)], ["Descuadre", eur(sc.diferencia, 2)], ["Sobres sin revisar", num(sc.sin_revisar)],
        ]} />
        {cj.tarjeta_aplica ? (
          <Tabla cols={["Tarjeta frente al banco", "Epos tarjeta", "Remesa del banco", "Descuadre", "Comisión datáfono", "Días en «Revisar»"]} filas={[
            ["Caja 1 · BBVA", eur(c1?.epos, 2), eur(c1?.bbva, 2), eur(c1?.descuadre, 2), eur(c1?.comision, 2), num(c1?.por_revisar)],
            ["Caja 2 · La Caixa", eur(c2?.epos, 2), eur(c2?.bbva, 2), eur(c2?.descuadre, 2), eur(c2?.comision, 2), num(c2?.por_revisar)],
          ]} />
        ) : <p className="inf-nota">La comparación de la tarjeta con el banco, día a día, empieza en octubre de 2026.</p>}
        <Tabla cols={["", "Importe"]} filas={[
          ["Comisión del datáfono del mes", cj.comision_datafono != null ? eur(cj.comision_datafono, 2) : "–"],
          ["Comisión de Bizum del mes (cargos «Liquidación remesa Bizum»)", eur(cj.comision_bizum, 2)],
          ["Descuadre de tarjeta", eur(cj.descuadre_tarjeta, 2)], ["Descuadre de efectivo", eur(cj.descuadre_efectivo, 2)], ["Descuadres de caja (total)", eur(cj.descuadre_caja, 2)],
          ["Días que siguen en «Revisar» (no cuentan en el resultado)", num(cj.dias_revisar)],
        ]} />
        {cj.extracto_caixa && <p className="inf-nota">Último extracto de La Caixa: {fecha(cj.extracto_caixa.ultimo)}.</p>}
      </Apartado>

      <Apartado n="9" titulo="Efectivo" texto={c.efectivo}>
        <Tabla cols={["", "Importe"]} filas={[
          ...(vivo ? [["Efectivo vivo total (hoy)", eur(vivo.total, 2)], ["Retiradas del banco (importe) · sin asignar", `${eur(vivo.retiradas_importe, 2)} · ${num(vivo.retiradas_sin_asignar)}`]] : []),
          ...(evo ? [["Recorrido del efectivo: saldo inicial", eur(evo.saldo_inicial, 2)], ["Entradas del mes", eur(n0(evo.entrada) + n0(evo.otras_entradas), 2)], ["Salidas del mes", eur(evo.total_salidas, 2)], ["Saldo", eur(evo.saldo, 2)]] : []),
          ["Caja fuerte · recargas del mes", eur(cf.recargas, 2)], ["Caja fuerte · pagos del mes", eur(cf.pagos, 2)], ["Caja fuerte · saldo a fin de mes", eur(cf.saldo_fin_mes, 2)],
          ...(efs ? [
            ["Efectivo de sobres · saldo inicial", eur(efs.saldo_inicial, 2)], ["Efectivo de sobres · entrada del mes", eur(efs.entrada, 2)],
            ["Efectivo de sobres · salidas", eur(efs.total_salidas, 2)], ["Efectivo de sobres · reparto a socios", eur(efs.reparto_total, 2)], ["Efectivo de sobres · lo que queda", eur(efs.saldo, 2)],
          ] : []),
        ]} />
        {efs && efs.por_tipo && Object.keys(efs.por_tipo).length > 0 && <p className="inf-nota">Salidas de efectivo de sobres por tipo: {Object.entries(efs.por_tipo).map(([t, v]) => `${t.replace(/_/g, " ")} ${eur(v, 2)}`).join(" · ")}.</p>}
      </Apartado>

      <Apartado n="10" titulo="Bancos" texto={c.bancos}>
        <Tabla cols={["", "BBVA", "La Caixa"]} filas={[
          ["Saldo a principio de mes", bb.saldo_inicial != null ? eur(bb.saldo_inicial, 2) : "–", cx.saldo_inicial != null ? eur(cx.saldo_inicial, 2) : "–"],
          ["Entradas del mes", eur(bb.entradas, 2), eur(cx.entradas, 2)],
          ["Salidas del mes", eur(bb.salidas, 2), eur(cx.salidas, 2)],
          ["Saldo a final de mes", bb.saldo_final != null ? eur(bb.saldo_final, 2) : "–", cx.saldo_final != null ? eur(cx.saldo_final, 2) : "–"],
          ["Movimientos del mes", num(bb.movimientos), num(cx.movimientos)],
          ["Último extracto subido", "automático", cx.ultimo_extracto ? fecha(cx.ultimo_extracto) : "sin extracto"],
        ]} />
        {se.aplica
          ? <p className="inf-nota"><b>Movimientos sin explicar en la conciliación: {num(se.n)}</b> ({eur(se.entradas, 2)} de entradas · {eur(se.salidas, 2)} de salidas; BBVA {num(se.bbva)} · La Caixa {num(se.caixa)}).</p>
          : <p className="inf-nota">La conciliación de movimientos con explicación empieza en octubre de 2026: en este mes no aplica.</p>}
        <p className="inf-nota">El saldo de cada mes se calcula a partir del saldo actual de cada cuenta y los movimientos posteriores (igual que en Tesorería).</p>
      </Apartado>

      <Apartado n="11" titulo="Facturas pendientes de pago a fin de mes" texto={c.pendientes}>
        <p className="inf-nota">{num(pp.n)} factura{pp.n === 1 ? "" : "s"} · {eur(pp.importe, 2)} en total.</p>
        {(pp.antiguas || []).length > 0 && <Tabla cols={["Las más antiguas", "Fecha", "Importe", "Días pendientes a fin de mes"]} filas={pp.antiguas.map((x) => [x.proveedor, fecha(x.fecha), eur(x.importe, 2), num(x.dias)])} />}
        {(pp.mayores || []).length > 0 && <p className="inf-nota">Las mayores: {pp.mayores.map((x) => `${x.proveedor} ${eur(x.importe, 2)}`).join(" · ")}.</p>}
      </Apartado>

      <Apartado n="12" titulo="Tesorería" texto={c.tesoreria}>
        <Tabla cols={["", "Importe"]} filas={[
          ["Dinero real a fin de mes (bancos + efectivo)", fm && fm.total != null ? eur(fm.total, 0) : "–"],
          ["  · BBVA", fm && fm.bbva != null ? eur(fm.bbva, 0) : "–"], ["  · La Caixa", fm && fm.caixa != null ? eur(fm.caixa, 0) : "–"],
          ["Dinero real hoy", ts.dinero_hoy != null ? eur(ts.dinero_hoy, 0) : "–"],
        ]} />
        <Tabla cols={["Previsión desde hoy", "Cobros", "Pagos", "Saldo al final", "Punto más bajo"]} filas={[["30 días", "d30"], ["60 días", "d60"]].map(([l, kk]) => { const p = pv[kk]; return p ? [`${l} (hasta el ${fecha(p.hasta)})`, eur(p.cobros, 0), eur(p.pagos, 0), eur(p.saldo_final, 0), p.minimo ? `${eur(p.minimo.saldo, 0)} (${fecha(p.minimo.fecha)})` : "–"] : [l, "–", "–", "–", "–"]; })} />
        {rep ? (
          <>
            <h4 className="inf-sub">«¿Cuánto podemos repartir?» (solo socios · es un dato, no una recomendación)</h4>
            <Tabla cols={["Cálculo (a 60 días)", "Importe"]} filas={[
              ["Dinero real hoy", eur(rep.dinero_hoy, 0)], ["Cobros previstos", eur(rep.cobros, 0)], ["Pagos previstos", `−${eur(rep.pagos, 0)}`],
              ["Colchón", `−${eur(rep.colchon, 0)}`], ["Reserva de impuestos" + (rep.reserva_impuestos_fechas ? ` (${rep.reserva_impuestos_fechas})` : ""), `−${eur(rep.reserva_impuestos, 0)}`],
              ["Ya repartido", eur(rep.ya_repartido, 0)], ["Cifra de Tesorería", eur(rep.repartir, 0)],
            ]} />
          </>
        ) : null}
        {c.solo_socios && rep ? <p className="inf-com inf-socios"><b>Solo socios:</b> {c.solo_socios}</p> : null}
      </Apartado>

      <Apartado n="13" titulo="Impuestos" texto={c.impuestos}>
        {im && (im.modelos || []).length ? (
          <>
            <p className="inf-nota">Próximo plazo: {im.trimestre}.º trimestre de {im.anio}{im.primera_fecha ? ` · hasta el ${fecha(im.primera_fecha)}` : ""}{im.dias != null ? ` (quedan ${num(im.dias)} días)` : ""} · estimado {eur(im.total_estimado, 2)}. Datos a fecha de generación.</p>
            <Tabla cols={["Modelo", "Qué es", "Fecha límite", "Importe estimado", "Estado"]} filas={im.modelos.map((x) => [x.modelo, x.que, fecha(x.limite), x.estimado != null ? eur(x.estimado, 2) : "–", x.estado === "pagado" ? "Pagado" : "Pendiente"])} />
          </>
        ) : <p className="inf-nota">No hay plazos de impuestos próximos.</p>}
      </Apartado>

      <section className="inf-ap">
        <h3><span>14</span> Puntos para la reunión</h3>
        {(c.avisos || []).length ? <ul className="inf-avisos">{c.avisos.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="inf-com">Sin puntos.</p>}
        {(d.avisos_finanzas || []).length > 0 && (
          <>
            <h4 className="inf-sub">Avisos de Finanzas (Resumen) a fecha de generación</h4>
            <ul className="inf-avisos">{d.avisos_finanzas.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </>
        )}
      </section>
    </article>
  );
}

function Informe({ inf }) {
  return inf.datos && inf.datos.version === 2 ? <InformeV2 inf={inf} /> : <InformeV1 inf={inf} />;
}

export function InformeMensual() {
  const [mes, setMes] = useState(mesAnterior());
  const [lista, setLista] = useState([]);
  const [abierto, setAbierto] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const [cierre, setCierre] = useState(null); // #106: el informe solo se genera con el mes cerrado

  useEffect(() => {
    let vivo = true;
    setCierre(null);
    supabase.rpc("cierre_mes_estado", { p_mes: mes }).then((r) => { if (vivo) setCierre(r); }).catch(() => { if (vivo) setCierre(false); });
    return () => { vivo = false; };
  }, [mes]);
  const cerrado = cierre ? !!cierre.cerrado : null;

  const cargarLista = useCallback(async () => {
    try { setLista((await supabase.rpc("fin_informe_lista")) || []); } catch (e) { /* la lista es opcional */ }
  }, []);
  useEffect(() => { cargarLista(); }, [cargarLista]);

  const abrir = async (id) => {
    setError("");
    try { setAbierto(await supabase.rpc("fin_informe_ver", { p_id: id })); }
    catch (e) { setError("No se ha podido abrir el informe."); }
  };
  const generar = async () => {
    setGenerando(true); setError("");
    try {
      const r = await supabase.fn("informe-finanzas", { mes });
      await cargarLista();
      await abrir(r.id);
    } catch (e) { setError(e.message || "No se ha podido generar el informe."); }
    setGenerando(false);
  };

  return (
    <div className="grid">
      <div className="card c12 inf-caja">
        <div className="head">
          <div><h2>Informe para la reunión</h2><p className="sub">Las cifras del mes de Finanzas con un comentario de cada apartado, listo para la reunión de dirección del día 10.</p></div>
        </div>
        <div className="inf-ctrl">
          <label>Mes <input type="month" value={mes} max={mesActual()} min="2026-01" onChange={(e) => e.target.value && setMes(e.target.value)} /></label>
          <button className="btn-p" type="button" onClick={generar} disabled={generando || cerrado !== true}>{generando ? "Generando… (puede tardar un minuto)" : "Generar informe"}</button>
          {abierto && <button className="btn-l" type="button" onClick={() => window.print()}>Descargar PDF</button>}
        </div>
        {cerrado === false && (
          <p className="inf-error" role="status">Cierra el mes para poder generar el informe.{cierre.faltan > 0 ? ` Faltan ${cierre.faltan} punto${cierre.faltan > 1 ? "s" : ""} de la lista de cierre.` : ""} <a href="#/finanzas/resultados/cierre">Ir a la lista de cierre</a></p>
        )}
        {cierre === false && <p className="inf-error" role="status">No se ha podido comprobar si el mes está cerrado.</p>}
        {error && <p className="inf-error" role="alert">{error}</p>}
        {lista.length > 0 && (
          <div className="inf-lista">
            <h3>Informes anteriores</h3>
            <ul>
              {lista.map((x) => (
                <li key={x.id}>
                  <button type="button" className={abierto?.id === x.id ? "on" : ""} onClick={() => abrir(x.id)}>
                    <b>{nombreMes(x.mes)}</b> · versión {x.version}{x.provisional ? " · provisional" : ""} <span>{fechaHora(x.creado_en)} · {x.quien || "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {abierto && <div className="c12 inf-imprimible"><Informe inf={abierto} /></div>}
    </div>
  );
}
