// #142: ayudas de Finanzas: explicación de las cifras del Resumen, glosario y recorrido guiado.
// Solo texto: no calcula nada ni toca datos.
import { useEffect, useState } from "react";

const CSS = `
.gu-b { background: none; border: 1px solid var(--line); border-radius: 99px; width: 22px; height: 22px; font-weight: 800; font-size: 12px; cursor: pointer; color: var(--text); margin-left: 6px; }
.gu-t { margin: 10px 0 0; padding: 12px 14px; background: var(--grid); border-radius: var(--r-s); font-size: 14px; line-height: 1.5; }
.gu-g { display: grid; gap: 8px; margin-top: 12px; }
.gu-g details { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-s); padding: 10px 14px; }
.gu-g summary { font-weight: 700; cursor: pointer; }
.gu-g p { margin: 8px 0 0; font-size: 14px; line-height: 1.5; }
.gu-tour { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; z-index: 60; padding: 16px; }
.gu-tour > div { background: var(--card); color: var(--text); border-radius: var(--r-l); padding: 24px; max-width: 460px; width: 100%; }
.gu-tour h3 { margin: 0 0 8px; }
.gu-tour .fila { display: flex; gap: 8px; justify-content: space-between; margin-top: 18px; }
`;
const Estilo = () => <style>{CSS}</style>;

export const TERMINOS = [
  ["Ventas", "Lo que han pagado los clientes en tienda y paquetería en el mes. Sale de los cierres de Epos."],
  ["Compras", "Lo que ha costado la mercancía que vendemos. Sale de las facturas de proveedores registradas."],
  ["Gastos fijos", "Lo que se paga todos los meses se venda más o menos: alquiler, luz, gestoría, seguros…"],
  ["Personal", "Sueldos y seguridad social del equipo."],
  ["Beneficio (resultado)", "Ventas menos compras, gastos fijos y personal. Es lo que ha ganado la tienda antes de inversiones y de repartir."],
  ["Inversiones", "Dinero gastado en cosas que duran (estanterías, neveras, obras). No se cuentan como gasto del mes, pero sí han salido de la cuenta."],
  ["Lo que se puede repartir", "Beneficio menos inversiones. Es solo un dato, no una recomendación."],
  ["Margen", "Lo que queda de cada venta después de pagar lo que costó el producto. Si vendes a 10 € algo que costó 7 €, el margen es 3 € (30 %)."],
  ["Tesorería", "El dinero que hay de verdad ahora mismo (bancos, sobres y caja fuerte) y el que se espera que entre y salga."],
  ["Conciliación", "Comprobar que cada movimiento del banco corresponde a algo que conocemos (una factura, una venta, una retirada)."],
  ["Coste completo", "El coste de un producto con IVA y recargo, que es lo que realmente sale de la cuenta."],
  ["Descuadre", "Diferencia entre lo que dice Epos que debería haber y lo que se ha contado en la caja."],
  ["Sobres", "Efectivo que sale de la caja y se guarda en sobres para pagos concretos hasta que se abren, se cuentan y se validan."],
];

export function Glosario() {
  return (
    <section className="panel">
      <Estilo />
      <h2>Glosario de Finanzas</h2>
      <p className="sub">Los términos de Finanzas explicados sin palabras técnicas.</p>
      <div className="gu-g">
        {TERMINOS.map(([t, d]) => <details key={t}><summary>{t}</summary><p>{d}</p></details>)}
      </div>
    </section>
  );
}

// «¿qué es esto?» junto a un concepto
export function Que({ texto }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" className="gu-b" aria-expanded={abierto} aria-label="¿Qué es esto?" title="¿Qué es esto?" onClick={() => setAbierto(!abierto)}>?</button>
      {abierto && <p className="gu-t">{texto}</p>}
    </>
  );
}

export function ExplicaResumen() {
  return (
    <section className="panel">
      <Estilo />
      <h2>Cómo leer estas cifras</h2>
      <div className="gu-g">
        <details><summary>Dinero ahora mismo</summary><p>Suma de lo que hay hoy en BBVA, La Caixa (con la fecha del último PDF subido), el efectivo de los sobres y la caja fuerte. Se actualiza solo con lo que se apunta en Día a día.</p></details>
        <details><summary>Ventas, resultado y % sobre ventas</summary><p>El resultado es lo que queda de las ventas tras pagar compras, gastos fijos y personal. No incluye las inversiones ni lo que se reparta. Se explica paso a paso en Cómo vamos → Cuenta de resultados.</p></details>
        <details><summary>Avisos</summary><p>Cosas que conviene revisar (cierres de caja que faltan, descuadres, proveedores duplicados…). Cada aviso lleva a la pantalla donde se resuelve.</p></details>
        <details><summary>Informe del mes</summary><p>Resumen del mes anterior que se prepara el día 10, con las mismas cifras de la cuenta de resultados.</p></details>
      </div>
      <p className="sub">¿Una palabra rara? Mírala en el <a href="#/finanzas/glosario">Glosario</a>.</p>
    </section>
  );
}

const PASOS = [
  ["Resumen", "Es la pantalla de inicio: cifras clave del mes, el dinero que hay ahora mismo y lo que está pendiente."],
  ["Día a día", "Sobres, facturas, compras, banco, pagos pendientes, mantenimiento e inversiones: todo lo que se hace en el día a día."],
  ["Cierre de mes", "La lista de cierre y los descuadres de caja. El informe del día 10 está en el Resumen."],
  ["Cómo vamos", "La cuenta de resultados y la tesorería, para ver cómo va el negocio."],
  ["Glosario", "Si no conoces un término, aquí está explicado sin jerga. Puedes volver a ver este recorrido desde el botón «Recorrido»."],
];
const CLAVE = "recao-fin-recorrido-142";
const leido = () => { try { return localStorage.getItem(CLAVE) === "1"; } catch (e) { return true; } };
const marcar = () => { try { localStorage.setItem(CLAVE, "1"); } catch (e) { /* sin almacenamiento */ } };

export function Recorrido() {
  const [paso, setPaso] = useState(leido() ? -1 : 0);
  useEffect(() => { const h = () => setPaso(0); window.addEventListener("recao-fin-recorrido", h); return () => window.removeEventListener("recao-fin-recorrido", h); }, []);
  const cerrar = () => { marcar(); setPaso(-1); };
  return (
    <>
      <Estilo />
      <button type="button" className="gu-b" style={{ width: "auto", padding: "0 10px", margin: "0 0 12px" }} onClick={() => setPaso(0)}>Recorrido</button>
      {paso >= 0 && (
        <div className="gu-tour" role="dialog" aria-modal="true" aria-label="Recorrido de Finanzas">
          <div>
            <p className="sub">Paso {paso + 1} de {PASOS.length}</p>
            <h3>{PASOS[paso][0]}</h3>
            <p>{PASOS[paso][1]}</p>
            <div className="fila">
              <button type="button" className="btn-l" onClick={cerrar}>Saltar</button>
              <span>
                {paso > 0 && <button type="button" className="btn-l" onClick={() => setPaso(paso - 1)}>Atrás</button>}{" "}
                <button type="button" className="btn-l" onClick={() => (paso + 1 < PASOS.length ? setPaso(paso + 1) : cerrar())}>{paso + 1 < PASOS.length ? "Siguiente" : "Entendido"}</button>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
