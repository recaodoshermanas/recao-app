// #149 · Finanzas fácil (2/6): cabecera de cada pestaña de «Día a día» (y Caja): frase fija, frase respuesta y 3 números con ⓘ.
// Solo presentación: lee lo mismo que ya leía cada pestaña (mismas funciones de la base de datos) y no cambia ningún cálculo.
import { useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { hoyStr } from "../ui.jsx";
import { eur, mesAnio } from "../fmt.js";
import { FraseFija, TresNumeros, flechaMes } from "./Facil.jsx";
import { useDineroHoy } from "./DineroHoy.jsx";
import { useFinanzas } from "../Finanzas.jsx";

const n = (v) => Number(v) || 0;
const e0 = (v) => eur(v, 0);
const e2 = (v) => eur(v, 2);
const mesMas = (m, k) => { const d = new Date(`${m}-15T12:00:00`); d.setMonth(d.getMonth() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const nombreMesDe = (m) => mesAnio(`${m}-01`).split(" ")[0].toLowerCase();
const DESDE_CONC = "2026-10-01"; // misma fecha que usa la conciliación de Bancos (#87)

function useCarga(fn, deps = []) {
  const [d, setD] = useState(undefined); // undefined = cargando · null = falló
  useEffect(() => {
    let vivo = true;
    Promise.resolve().then(fn).then((r) => { if (vivo) setD(r ?? null); }, () => { if (vivo) setD(null); });
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return d;
}

function Cab({ fija, frase, numeros, cargando }) {
  return (
    <>
      <FraseFija>{fija}</FraseFija>
      {cargando ? <p className="ff-resp">Cargando…</p> : <TresNumeros frase={frase} numeros={numeros} />}
    </>
  );
}

// ---------- Caja (caja fuerte) ----------
export function CabCaja() {
  const d = useCarga(() => sb.rpc("caja_fuerte_estado"));
  const mes = hoyStr().slice(0, 7), ant = mesMas(mes, -1);
  const movs = d?.movimientos || [];
  const suma = (m, tipo) => movs.filter((x) => x.tipo === tipo && String(x.fecha).startsWith(m)).reduce((s, x) => s + Math.abs(n(x.importe)), 0);
  const pag = suma(mes, "pago"), rec = suma(mes, "recarga");
  return (
    <Cab cargando={d === undefined}
      fija="Caja fuerte: el dinero que dejamos en la tienda para pagar a proveedores."
      frase={d ? `En la caja fuerte hay ${e2(n(d.saldo))}` : "No se ha podido cargar la caja fuerte."}
      numeros={d ? [
        { t: "Hay ahora", v: e2(n(d.saldo)), info: "El dinero que queda en la caja fuerte: lo que hemos metido menos las facturas pagadas con ella. Ejemplo: metimos 500 € y pagamos 120 € de una factura, hay 380 €." },
        { t: "Pagado este mes", v: e2(pag), flecha: flechaMes(pag, suma(ant, "pago"), nombreMesDe(ant), e0, false), info: "Lo que se ha pagado este mes con dinero de la caja fuerte (facturas de proveedores). Ejemplo: 3 facturas que suman 140 €." },
        { t: "Recargado este mes", v: e2(rec), info: "El dinero que hemos añadido a la caja fuerte este mes (viene de Efectivo de sobres). Ejemplo: «Añadir dinero a caja» 300 €." },
      ] : []} />
  );
}

// ---------- Efectivo de sobres ----------
export function CabSobres() {
  const mes = hoyStr().slice(0, 7);
  const d = useCarga(() => sb.rpc("efectivo_sobres_mes", { p_mes: mes }));
  const entro = d ? n(d.entrada) + n(d.otras_entradas) : 0;
  return (
    <Cab cargando={d === undefined}
      fija="Efectivo de sobres: el dinero de los sobres del mes y en qué se ha ido."
      frase={d ? `Del efectivo del mes quedan ${e2(n(d.saldo))}` : "No se ha podido cargar (solo lo ven los socios)."}
      numeros={d ? [
        { t: "Entró", v: e2(entro), info: "Lo que ha entrado este mes: el saldo de los sobres que se abren el día 1 más las retiradas del banco. Ejemplo: sobres de septiembre 1.500 €." },
        { t: "Pagado", v: e2(n(d.total_salidas)), info: "Todo lo que ha salido: repartos a socios, extras a trabajadoras, ingresos al banco, caja fuerte y compras pagadas con «Efectivo sobres»." },
        { t: "Queda", v: e2(n(d.saldo)), info: "Lo que sigue guardado ahora: lo que había al empezar el mes + lo que entró − lo que salió." },
      ] : []} />
  );
}

// ---------- Bancos ----------
export function CabBancos() {
  const { d: dh } = useDineroHoy();
  const mes = hoyStr().slice(0, 7);
  const x = useCarga(async () => {
    const movs = await sb.select("movimientos_banco", "select=id,fecha_operacion,importe&limit=5000&order=fecha_operacion.desc");
    const conc = await sb.rpc("banco_conciliacion");
    const ex = new Set((conc || []).map((c) => c.movimiento_id));
    const sinExp = movs.filter((m) => String(m.fecha_operacion).slice(0, 10) >= DESDE_CONC && !ex.has(m.id)).length;
    const delMes = movs.filter((m) => String(m.fecha_operacion).slice(0, 7) === mes);
    return { sinExp, entra: delMes.filter((m) => m.importe > 0).reduce((s, m) => s + n(m.importe), 0), sale: -delMes.filter((m) => m.importe < 0).reduce((s, m) => s + n(m.importe), 0) };
  });
  const cu = dh?.cu?.v || [];
  const bbva = cu.filter((c) => /bbva/i.test(`${c.banco} ${c.aspsp_nombre || ""}`));
  const saldo = bbva.length ? bbva.reduce((s, c) => s + n(c.saldo), 0) : null;
  const frase = x === undefined ? "" : x ? (x.sinExp > 0 ? `Tienes ${x.sinExp} movimiento${x.sinExp === 1 ? "" : "s"} sin explicar` : "Todo el banco está explicado ✅") : "No se ha podido cargar el banco.";
  return (
    <Cab cargando={x === undefined}
      fija="Bancos: lo que ha entrado y salido de las cuentas, y si sabemos a qué corresponde cada movimiento."
      frase={frase}
      numeros={x ? [
        { t: "Saldo BBVA", v: saldo == null ? "–" : e2(saldo), info: "Lo que hay ahora en la cuenta de BBVA según el banco. Ejemplo: 4.250,00 €." },
        { t: "Entradas del mes", v: e2(x.entra), info: "Todo el dinero que ha entrado este mes en las cuentas (BBVA y CaixaBank): ventas con tarjeta, ingresos de efectivo… Ejemplo: 18.400 €." },
        { t: "Salidas del mes", v: e2(x.sale), info: "Todo el dinero que ha salido este mes de las cuentas (BBVA y CaixaBank): pagos a proveedores, recibos, nóminas… Ejemplo: 15.900 €." },
      ] : []} />
  );
}

// ---------- Facturas pendientes de pago ----------
export function CabPagos() {
  const mes = hoyStr().slice(0, 7);
  const d = useCarga(() => sb.rpc("pagos_datos"));
  const pend = d?.pendientes || [];
  const total = pend.reduce((s, p) => s + n(p.importe), 0);
  const venc = pend.filter((p) => p.tipo === "f" && n(p.dias) > 30);
  const pagadasMes = (d?.pagadas || []).filter((p) => String(p.pagada_fecha || "").startsWith(mes));
  return (
    <Cab cargando={d === undefined}
      fija="Facturas pendientes de pago: lo que debemos a proveedores y todavía no ha salido del banco."
      frase={d ? (pend.length ? `Tienes ${pend.length} factura${pend.length === 1 ? "" : "s"} por pagar (${e2(total)})` : "No tienes ninguna factura por pagar ✅") : "No se han podido cargar las facturas pendientes."}
      numeros={d ? [
        { t: "Por pagar", v: e2(total), info: "Lo que falta por pagar a proveedores (transferencia) y los pagos fijos pendientes. Se quitan solas cuando el pago aparece en el banco." },
        { t: "Vencidas", v: `${venc.length}${venc.length ? ` · ${e2(venc.reduce((s, p) => s + n(p.importe), 0))}` : ""}`, info: "Facturas que llevan más de 30 días pendientes (en la lista salen en rojo). Ejemplo: una factura del 1 de octubre sin pagar a 4 de noviembre." },
        { t: "Pagadas este mes", v: e2(pagadasMes.reduce((s, p) => s + n(p.importe), 0)), info: `Facturas cuyo pago se ha confirmado este mes (${pagadasMes.length}).` },
      ] : []} />
  );
}

// ---------- Facturas ----------
export function CabFacturas({ facturas }) {
  const mes = hoyStr().slice(0, 7), ant = mesMas(mes, -1);
  const ids = useCarga(() => sb.rpc("facturas_pendientes_pago_ids").then((r) => new Set((Array.isArray(r) ? r : []).map(String))));
  const delMes = (m) => (facturas || []).filter((f) => String(f.fecha).startsWith(m));
  const act = delMes(mes);
  const total = act.reduce((s, f) => s + n(f.importe), 0);
  const sinPagar = ids ? act.filter((f) => ids.has(String(f.id))).reduce((s, f) => s + n(f.importe), 0) : null;
  return (
    <Cab cargando={false}
      fija="Facturas: todo lo que hemos comprado a proveedores y cómo se ha pagado."
      frase={`Este mes van ${act.length} factura${act.length === 1 ? "" : "s"} (${e2(total)})`}
      numeros={[
        { t: "Nº de facturas", v: String(act.length), info: "Facturas apuntadas con fecha de este mes. Ejemplo: 42 facturas." },
        { t: "Total", v: e2(total), flecha: flechaMes(total, delMes(ant).reduce((s, f) => s + n(f.importe), 0), nombreMesDe(ant), e0, false), info: "La suma de los importes de las facturas de este mes (las que aún no tienen importe cuentan 0)." },
        { t: "Sin pagar", v: sinPagar == null ? "–" : e2(sinPagar), info: "De las facturas de este mes, lo que todavía está pendiente de pago (las mismas de «Facturas pendientes de pago»)." },
      ]} />
  );
}

// ---------- Compras ----------
export function CabCompras() {
  const { d } = useFinanzas();
  if (!d) return <Cab cargando fija="Compras: lo que compramos de mercancía frente a lo que vendemos." numeros={[]} />;
  const comp = (m) => n(m.compras_mercancia ?? m.mercancia);
  const act = d.meses.find((m) => m.mes === d.mes_actual) || d.meses[d.meses.length - 1];
  const prev = d.meses[d.meses.indexOf(act) - 1];
  const anio = String(act.mes).slice(0, 4);
  const cerr = d.meses.filter((m) => m.cerrado && String(m.mes).startsWith(anio));
  const media = cerr.length ? cerr.reduce((s, m) => s + comp(m), 0) / cerr.length : null;
  return (
    <Cab
      fija="Compras: lo que compramos de mercancía frente a lo que vendemos."
      frase={`Este mes hemos comprado ${e0(comp(act))}`}
      numeros={[
        { t: "Comprado", v: e0(comp(act)), info: "Compras de mercancía de este mes (facturas y productos pagados aparte). Ejemplo: 21.300 €." },
        { t: "Mes pasado", v: prev ? e0(comp(prev)) : "–", info: "Lo comprado el mes anterior, para comparar." },
        { t: "Media del año", v: media == null ? "–" : e0(media), info: `Media mensual de las compras de los meses ya cerrados de ${anio}${cerr.length ? ` (${cerr.length} mes${cerr.length === 1 ? "" : "es"})` : ""}.` },
      ]} />
  );
}

// ---------- Mantenimiento e Inversiones (misma forma) ----------
function CabLista({ rpc, fija, frase, plural, titulo3, info3 }) {
  const d = useCarga(() => sb.rpc(rpc));
  const hoy = hoyStr(), mes = hoy.slice(0, 7), ant = mesMas(mes, -1), anio = hoy.slice(0, 4);
  const items = d?.items || [];
  const suma = (f) => items.filter((i) => String(i.fecha).startsWith(f)).reduce((s, i) => s + n(i.importe), 0);
  const delAnio = items.filter((i) => String(i.fecha).startsWith(anio));
  const esteMes = suma(mes);
  const mensual = { t: "Este mes", v: e2(esteMes), flecha: flechaMes(esteMes, suma(ant), nombreMesDe(ant), e0, false), info: `Lo apuntado este mes en ${plural}.` };
  const anual = { t: plural === "inversiones" ? "Este año" : "En el año", v: e2(suma(anio)), info: `Todo lo apuntado en ${plural} desde el 1 de enero de ${anio}.` };
  const hayMes = items.some((i) => String(i.fecha).startsWith(mes));
  return (
    <Cab cargando={d === undefined}
      fija={fija}
      frase={d ? frase({ mes: e2(esteMes), anio: e2(suma(anio)), hayMes }) : "No se ha podido cargar."}
      numeros={d ? [
        ...(plural === "inversiones" ? [anual, mensual] : [mensual, anual]),
        { t: titulo3, v: String(delAnio.length), info: info3 },
      ] : []} />
  );
}

export const CabMantenimiento = () => (
  <CabLista rpc="mantenimientos_datos"
    fija="Mantenimiento: arreglos y reparaciones de la tienda (frigoríficos, luz, fontanería…)."
    frase={(x) => (x.hayMes ? `Este mes se han gastado ${x.mes} en arreglos` : "Este mes no hay arreglos")}
    plural="mantenimiento" titulo3="Nº de arreglos"
    info3="Cuántos arreglos hay apuntados este año. Ejemplo: 7 arreglos." />
);

export const CabInversiones = () => (
  <CabLista rpc="inversiones_datos"
    fija="Inversiones: compras que duran años (maquinaria, muebles, obras) y no son gasto del día a día."
    frase={(x) => `Este año llevamos ${x.anio} invertidos`}
    plural="inversiones" titulo3="Nº de inversiones"
    info3="Cuántas inversiones hay apuntadas este año. Ejemplo: 3 inversiones." />
);
