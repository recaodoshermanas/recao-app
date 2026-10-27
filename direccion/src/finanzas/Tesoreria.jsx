// Finanzas → Banco → Tesorería (solicitud #89): el dinero real de hoy y a fin de cada mes. Sustituye al «Saldo estimado».
// «Hoy» lee lo mismo que Bancos, Caja fuerte y Efectivo de sobres; «Evolución» sale de tesoreria_evolucion() (solo dirección; sobres, solo socios).
import { useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, hoyStr } from "../ui.jsx";
import { eur } from "../fmt.js";

const CSS = `
.te-l { display: grid; gap: 4px; margin-top: 12px; }
.te-f { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 10px 14px; border-radius: var(--r-s); color: var(--text); text-decoration: none; }
a.te-f:hover { background: var(--grid); }
.te-f b { font-size: 18px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.te-f small { color: var(--muted); font-size: 12.5px; }
.te-f.tot { border-top: 1.5px solid var(--line); margin-top: 4px; font-weight: 800; }
.te-f.tot b { font-size: 24px; }
.te-t td, .te-t th { font-variant-numeric: tabular-nums; }
.te-t tr.curso td { background: var(--grid); }
`;
const n = (v) => Number(v) || 0;
const cuando = (ts) => (ts ? new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const ddmm = (f) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}` : "");
const nombreMes = (m) => { const t = new Date(`${m}-15T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const celda = (v) => (v == null ? "–" : eur(v, 2));

export function Tesoreria() {
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vivo = true;
    const ok = (p) => p.then((v) => ({ v }), (e) => ({ e }));
    (async () => {
      const [cu, ca, so, ev] = await Promise.all([
        ok(sb.select("cuentas_bancarias", "select=banco,aspsp_nombre,saldo,saldo_fecha,ultima_sync&or=(activa.eq.true,aspsp_nombre.eq.Extracto%20manual)&order=banco")),
        ok(sb.rpc("caja_fuerte_estado")),
        ok(sb.rpc("efectivo_sobres_mes", { p_mes: hoyStr().slice(0, 7) })),
        ok(sb.rpc("tesoreria_evolucion")),
      ]);
      if (!vivo) return;
      setD({ cu, ca, so, ev });
      setFallo(!!(cu.e && ev.e));
    })();
    return () => { vivo = false; };
  }, []);

  if (fallo) return <div className="card"><h2>Tesorería</h2><p className="empty">No se ha podido cargar.</p></div>;
  if (!d) return <div className="card"><Cargando /></div>;

  const bbva = (d.cu.v || []).find((c) => c.banco === "BBVA" && c.aspsp_nombre !== "Extracto manual");
  const caixa = (d.cu.v || []).find((c) => c.aspsp_nombre === "Extracto manual" && c.saldo != null);
  const caixaFecha = caixa?.saldo_fecha ? new Date(caixa.saldo_fecha).toLocaleDateString("sv-SE") : "";
  const caixaViejo = caixaFecha && Date.now() - new Date(`${caixaFecha}T12:00:00`).getTime() > 7 * 864e5;
  const verSobres = !d.so.e;
  const caja = d.ca.e ? null : n(d.ca.v?.saldo);
  const sobres = verSobres ? n(d.so.v?.saldo) : null;
  const efectivo = (caja ?? 0) + (sobres ?? 0);
  const total = (bbva ? n(bbva.saldo) : 0) + (caixa ? n(caixa.saldo) : 0) + efectivo;

  const meses = d.ev.e ? [] : (d.ev.v?.meses || []).map((m) => {
    const efe = m.caja == null && m.sobres == null ? null : n(m.caja) + n(m.sobres);
    return { ...m, efe, total: n(m.bbva) + n(m.caixa) + n(efe), soloBancos: efe == null };
  });
  meses.forEach((m, i) => { m.dif = i > 0 ? m.total - meses[i - 1].total : null; });
  const filas = [...meses].reverse();

  return (
    <>
      <style>{CSS}</style>
      <div className="card">
        <h2>Hoy</h2>
        <p className="sub">El dinero real que hay ahora: bancos, caja fuerte{verSobres ? " y efectivo de sobres guardado" : ""}. Son las mismas cifras de Bancos y Efectivo.</p>
        <div className="te-l">
          <a className="te-f" href="#/finanzas/banco/bancos"><span>BBVA{bbva && <small> · actualizado {cuando(bbva.ultima_sync)}</small>}</span><b>{bbva?.saldo != null ? eur(bbva.saldo, 2) : "—"}</b></a>
          <a className="te-f" href="#/finanzas/banco/bancos"><span>La Caixa<small style={{ color: caixaViejo ? "#C26A00" : undefined, fontWeight: caixaViejo ? 700 : undefined }}> · {caixa ? `extracto del ${ddmm(caixaFecha)}${caixaViejo ? " (más de 7 días)" : ""}` : "sin extracto"}</small></span><b>{caixa ? eur(caixa.saldo, 2) : "—"}</b></a>
          <a className="te-f" href="#/finanzas/efectivo/sobres"><span>Efectivo vivo<small> · {verSobres ? `sobres guardado ${eur(sobres, 2)} + ` : ""}caja fuerte {caja == null ? "—" : eur(caja, 2)}</small></span><b>{eur(efectivo, 2)}</b></a>
          <div className="te-f tot"><span>Total</span><b>{eur(total, 2)}</b></div>
        </div>
        {!verSobres && <p className="sub">El efectivo de sobres solo lo ven los socios, y no se suma.</p>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Evolución</h2>
        <p className="sub">Dinero a fin de cada mes. BBVA se calcula desde el saldo de hoy restando los movimientos posteriores; La Caixa es el saldo del último movimiento del mes en el extracto (hay datos desde marzo de 2026); el efectivo, desde octubre de 2026. Los meses sin efectivo suman solo los bancos (*).</p>
        {d.ev.e ? <p className="empty">No se ha podido cargar la evolución.</p> : (
          <div className="tabla-scroll">
            <table className="ranking te-t">
              <thead><tr><th>Mes</th><th className="r">BBVA</th><th className="r">La Caixa</th><th className="r">Efectivo</th><th className="r">Total</th><th className="r">Diferencia</th></tr></thead>
              <tbody>
                {filas.map((m) => (
                  <tr key={m.mes} className={m.en_curso ? "curso" : ""}>
                    <td style={{ whiteSpace: "nowrap" }}>{nombreMes(m.mes)}{m.en_curso && <span className="pf">en curso (hoy)</span>}</td>
                    <td className="r">{celda(m.bbva)}</td>
                    <td className="r">{celda(m.caixa)}</td>
                    <td className="r">{celda(m.efe)}</td>
                    <td className="r"><b>{eur(m.total, 2)}</b>{m.soloBancos ? " *" : ""}</td>
                    <td className="r" style={{ color: m.dif == null ? undefined : m.dif < 0 ? "var(--down)" : "var(--up)", fontWeight: 700 }}>{m.dif == null ? "–" : `${m.dif > 0 ? "+" : ""}${eur(m.dif, 2)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sub">* Solo bancos. Si falta algún movimiento de BBVA, los meses más antiguos se desvían.</p>
      </div>
    </>
  );
}
