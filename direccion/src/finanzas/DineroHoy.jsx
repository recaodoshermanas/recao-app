// Finanzas → Resumen: «El dinero que tenemos hoy» (solicitud #62). No calcula nada nuevo: lee lo mismo que
// Bancos, Efectivo de sobres, Caja fuerte y Facturas pendientes de pago. Solo dirección.
import { useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { hoyStr } from "../ui.jsx";
import { eur } from "../fmt.js";
import { FraseFija, TresNumeros, Plegable } from "./Facil.jsx"; // #148

const CSS = `
.dh { margin-bottom: 18px; }
.dh-l { display: grid; gap: 4px; margin-top: 12px; }
.dh-f { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 10px 14px; border-radius: var(--r-s); color: var(--text); text-decoration: none; }
a.dh-f:hover { background: var(--grid); }
.dh-f b { font-size: 18px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dh-f small { color: var(--muted); font-size: 12.5px; }
.dh-f.gris, .dh-f.gris b { color: var(--muted); }
.dh-f.tot { border-top: 1.5px solid var(--line); margin-top: 4px; font-weight: 700; }
.dh-f.libre { background: var(--grid); font-weight: 800; }
.dh-f.libre b { font-size: 24px; }
.dh-f.libre.pos b { color: var(--up); }
.dh-f.libre.neg b { color: var(--down); }
`;
const n = (v) => Number(v) || 0;
const HORAS_AVISO = 36;
const cuando = (ts) => {
  if (!ts) return "";
  const d = new Date(ts), hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const f = (x) => x.toLocaleDateString("sv-SE");
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  if (f(d) === f(new Date())) return `hoy a las ${hora}`;
  if (f(d) === f(ayer)) return `ayer a las ${hora}`;
  return `el ${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} a las ${hora}`;
};

export function DineroHoy({ ganado, ganadoFlecha, bajo }) {
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vivo = true;
    const ok = (p) => p.then((v) => ({ v }), (e) => ({ e }));
    (async () => {
      const [cu, ca, pa, so] = await Promise.all([
        ok(sb.select("cuentas_bancarias", "select=banco,aspsp_nombre,saldo,saldo_fecha,ultima_sync,ultimo_error&or=(activa.eq.true,aspsp_nombre.eq.Extracto%20manual)&order=banco")),
        ok(sb.rpc("caja_fuerte_estado")),
        ok(sb.rpc("pagos_datos")),
        ok(sb.rpc("efectivo_sobres_mes", { p_mes: hoyStr().slice(0, 7) })),
      ]);
      if (!vivo) return;
      setD({ cu, ca, pa, so });
      setFallo(cu.e && ca.e && pa.e);
    })();
    return () => { vivo = false; };
  }, []);

  if (fallo) return <>{bajo}</>;
  if (!d) return <><FraseFija>Aquí ves de un vistazo cuánto dinero tenemos y si hay algo que hacer.</FraseFija><p className="sub">Cargando…</p>{bajo}</>;

  const bbva = (d.cu.v || []).find((c) => c.banco === "BBVA" && c.aspsp_nombre !== "Extracto manual");
  const caixa = (d.cu.v || []).find((c) => c.aspsp_nombre === "Extracto manual" && c.saldo != null);
  const caixaFecha = caixa?.saldo_fecha ? new Date(caixa.saldo_fecha).toLocaleDateString("sv-SE") : "";
  const caixaViejo = caixaFecha && Date.now() - new Date(caixaFecha + "T12:00:00").getTime() > 7 * 864e5;
  const ddmm = (f) => f.slice(8, 10) + "/" + f.slice(5, 7);
  const viejo = bbva && (bbva.ultimo_error || !bbva.ultima_sync || Date.now() - new Date(bbva.ultima_sync).getTime() > HORAS_AVISO * 36e5);
  const verSobres = !d.so.e;
  const filas = [
    { k: "bbva", t: "BBVA", ruta: "finanzas/banco/bancos", ok: !!bbva && bbva.saldo != null, v: bbva ? n(bbva.saldo) : null,
      s: !bbva ? "Sin conexión" : viejo ? `Sin actualizar desde ${bbva.ultima_sync ? cuando(bbva.ultima_sync) : "—"}` : `actualizado ${cuando(bbva.ultima_sync)}`, aviso: viejo },
    { k: "caixa", t: "La Caixa", ruta: "finanzas/banco/bancos", ...(caixa
      ? { ok: true, v: n(caixa.saldo), s: caixaFecha ? `según extracto del ${ddmm(caixaFecha)}` : "según extracto", aviso: caixaViejo }
      : { ok: false, s: "Sin dato", gris: true }) },
    verSobres && { k: "sobres", t: "Efectivo de sobres guardado", ruta: "finanzas/efectivo/sobres", ok: true, v: n(d.so.v?.saldo) },
    { k: "caja", t: "Caja fuerte", ruta: "finanzas/efectivo/caja", ok: !d.ca.e, v: n(d.ca.v?.saldo), s: d.ca.e ? "No se ha podido cargar" : "" },
  ].filter(Boolean);
  const total = filas.reduce((s, f) => s + (f.ok ? f.v : 0), 0);
  const pend = d.pa.e ? null : (d.pa.v?.pendientes || []);
  const pendTotal = pend ? pend.reduce((s, x) => s + n(x.importe), 0) : null;
  const libre = pendTotal == null ? null : total - pendTotal;
  const Fila = ({ f }) => (
    <a className={`dh-f${f.gris ? " gris" : ""}`} href={`#/${f.ruta}`}>
      <span>{f.t}{f.s && <small style={{ color: f.aviso ? "#C26A00" : undefined }}> · {f.s}</small>}</span>
      <b>{f.ok ? eur(f.v, 2) : "—"}</b>
    </a>
  );
  const banco = filas.filter((f) => (f.k === "bbva" || f.k === "caixa") && f.ok).reduce((t, f) => t + f.v, 0);
  const efSobres = verSobres ? n(d.so.v?.saldo) : 0;
  const efCaja = d.ca.e ? 0 : n(d.ca.v?.saldo);
  const efectivo = efSobres + efCaja;
  const bancoInfo = `Es BBVA${bbva && bbva.saldo != null ? ` (${eur(n(bbva.saldo), 2)})` : ""} más La Caixa${caixa ? ` (${eur(n(caixa.saldo), 2)}${caixaFecha ? `, según el último PDF del ${ddmm(caixaFecha)}` : ""})` : " (sin dato)"}.`;
  const efInfo = verSobres
    ? `Es el efectivo de sobres que queda más la caja fuerte. Ejemplo con nuestros datos: sobres ${eur(efSobres, 2)} + caja fuerte ${eur(efCaja, 2)} = ${eur(efectivo, 2)}.`
    : `Es lo que hay en la caja fuerte (${eur(efCaja, 2)}). El efectivo de sobres solo lo ven los socios y no se suma.`;
  const numeros = [
    { t: "Banco", v: eur(banco, 0), info: bancoInfo },
    { t: "Efectivo", v: eur(efectivo, 0), info: efInfo },
    ...(ganado != null ? [{ t: "Ganado este mes", v: eur(Math.round(ganado), 0), flecha: ganadoFlecha, info: "Es el mismo resultado que sale en Cómo vamos → Cuenta de resultados para el mes en curso (todavía provisional hasta cerrar el mes): lo vendido menos compras, gastos fijos y personal." }] : []),
  ];
  return (
    <>
      <FraseFija>Aquí ves de un vistazo cuánto dinero tenemos y si hay algo que hacer.</FraseFija>
      <TresNumeros frase={`Hoy tenemos ${eur(total, 0)} entre banco y efectivo`} numeros={numeros} />
      {bajo}
      <Plegable titulo="El dinero que tenemos hoy" total={eur(total, 2)} pendiente={filas.some((f) => f.aviso) ? "Algún saldo está sin actualizar" : null}>
    <section className="card dh" aria-label="El dinero que tenemos hoy">
      <style>{CSS}</style>
      <h2>El dinero que tenemos hoy</h2>
      <p className="sub">Lo que hay en el banco, en los sobres y en la caja fuerte, y lo que ya está comprometido a pagar.</p>
      <div className="dh-l">
        {filas.map((f) => <Fila key={f.k} f={f} />)}
        <div className="dh-f tot"><span>Total disponible</span><b>{eur(total, 2)}</b></div>
        {pend && <a className="dh-f" href="#/finanzas/banco/pagos"><span>Facturas pendientes de pago<small> · {pend.length} {pend.length === 1 ? "factura o pago" : "facturas y pagos"}</small></span><b>{eur(-pendTotal, 2)}</b></a>}
        {libre != null && <div className={`dh-f libre ${libre < 0 ? "neg" : "pos"}`}><span>Queda libre</span><b>{eur(libre, 2)}</b></div>}
      </div>
      {!verSobres && <p className="sub">El efectivo de sobres solo lo ven los socios, y no se suma.</p>}
    </section>
      </Plegable>
    </>
  );
}
