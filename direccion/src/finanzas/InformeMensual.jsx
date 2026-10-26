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

function Informe({ inf }) {
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
          ["Compras de mercancía (facturas)", eur(m.mercancia, 0), a ? eur(a.mercancia, 0) : "–"],
          ["Coste de lo vendido (Epos)", eur(m.epos_coste, 0), a ? eur(a.epos_coste, 0) : "–"],
          ["Compras menos coste de lo vendido", eur(n0(m.mercancia) - n0(m.epos_coste), 0), a ? eur(n0(a.mercancia) - n0(a.epos_coste), 0) : "–"],
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

export function InformeMensual() {
  const [mes, setMes] = useState(mesAnterior());
  const [lista, setLista] = useState([]);
  const [abierto, setAbierto] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

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
          <button className="btn-p" type="button" onClick={generar} disabled={generando}>{generando ? "Generando… (puede tardar un minuto)" : "Generar informe"}</button>
          {abierto && <button className="btn-l" type="button" onClick={() => window.print()}>Descargar PDF</button>}
        </div>
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
