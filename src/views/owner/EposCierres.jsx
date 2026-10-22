// Cierre de mes → «Epos frente a cierres de caja» (solicitud #15). Solo los 4 socios y solo informativo.
// Epos = cobrado en efectivo − cambio devuelto (tickets completados). Cierres = efectivo de caja 1 + caja 2, todos los turnos.
// Diferencia = cierres − Epos. De 10 € o más (configurable), en rojo. Hoy no entra hasta mañana.
import { useCallback, useEffect, useState } from "react";
import { F, SF, C, crd } from "../../lib/styles.js";
import { fmt2 } from "../../lib/utils.js";
import { sb } from "../../lib/supabase.js";

const ROJO = "#B3261E";
const dinero = (v) => (v == null ? "–" : fmt2(Number(v)));
const conSigno = (v) => `${Number(v) > 0 ? "+" : ""}${fmt2(Number(v))}`;
const dia = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
const largo = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
// ["mañana","tarde","tarde"] → «mañana y 2 de tarde»
const turnos = (t) => {
  if (!t || !t.length) return "";
  const n = {}; t.forEach((x) => { n[x] = (n[x] || 0) + 1; });
  return Object.entries(n).map(([k, v]) => (v > 1 ? `${v} de ${k}` : k)).join(" y ");
};

// #25: desde octubre de 2026, una fila por cierre de Epos (turno y caja) con lo esperado, lo contado y la diferencia
const AMBAR = "#8A5A00";
const hora = (ts) => (ts ? String(ts).slice(11, 16) : "–");
const turnoTxt = (r) => (r.dos_turnos ? "Mañana y tarde" : r.turno === "mañana" ? "Mañana" : "Tarde");
function EposCierresTurnos({ mes }) {
  const [d, setD] = useState(null);
  const [abierta, setAbierta] = useState(false);
  const [fila, setFila] = useState(null);
  const cargar = useCallback(async () => {
    try { setD(await sb.rpc("epos_cierres_mes", { p_mes: mes })); } catch (e) { setD(false); }
  }, [mes]);
  useEffect(() => { setD(null); cargar(); }, [cargar]);
  if (d === false) return null;
  if (!d) return <div style={{ ...crd, fontFamily: F, fontSize: 13, color: C.mut }}>Cargando Epos frente a cierres…</div>;
  const filas = d.cierres || [];
  const malo = d.marcados > 0;
  const ult = (() => { try { return d.ultimo ? JSON.parse(d.ultimo) : null; } catch (e) { return null; } })();
  const err = (() => { try { return d.error ? JSON.parse(d.error) : null; } catch (e) { return null; } })();
  const celda = { padding: "5px 6px", textAlign: "right", whiteSpace: "nowrap" };
  const dif = (v, fuerte) => <span style={{ fontWeight: fuerte ? 800 : 600, color: Number(v) < 0 ? ROJO : Number(v) > 0 ? "#1E6B3C" : C.mut }}>{v == null ? "–" : conSigno(v)}</span>;
  return (
    <div style={{ ...crd, padding: 0, overflow: "hidden", border: malo ? `2px solid ${ROJO}` : crd.border }}>
      <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: SF, fontSize: 17, color: C.char }}>Epos frente a cierres de caja</span>
          <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2 }}>
            {filas.length} cierre{filas.length === 1 ? "" : "s"} de Epos · efectivo {conSigno(d.ef)} · tarjeta {conSigno(d.ta)}{malo ? ` · ${d.marcados} turno${d.marcados === 1 ? "" : "s"} con más de 5 €` : ""}
          </span>
        </span>
        <span style={{ fontFamily: F, fontSize: 13, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: malo ? ROJO : "#EAF4EE", color: malo ? "#fff" : "#1E6B3C" }}>{conSigno(d.neto)}</span>
        <span aria-hidden="true" style={{ fontFamily: F, fontSize: 18, color: C.mut, transform: abierta ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      {abierta && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.brdL}` }}>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, lineHeight: 1.45, margin: "12px 0 8px" }}>
            Lo que Epos esperaba en cada cierre frente a lo que contaron al cerrar, por forma de pago (debajo de cada diferencia: esperado → contado). Neto = diferencia de efectivo + diferencia de tarjeta; en color si pasa de ±5 €. «Cruce» = sobra en una forma de pago y falta en la otra: un cobro marcado con la forma de pago equivocada, no una falta de dinero. Pulsa una fila para ver sus facturas y los billetes que deben ir al sobre.
          </div>
          {err && <div role="alert" style={{ fontFamily: F, fontSize: 12.5, color: "#fff", background: ROJO, borderRadius: 10, padding: "9px 12px", marginBottom: 8 }}>La última carga de Epos ha fallado ({err.error}). Puede faltar algún cierre reciente.</div>}
          {(d.facturas_sin_sobre || []).length > 0 && <div style={{ fontFamily: F, fontSize: 12.5, color: AMBAR, background: "#FBF0DA", borderRadius: 10, padding: "9px 12px", marginBottom: 8 }}>Facturas en efectivo de caja sin ningún cierre en su turno: {d.facturas_sin_sobre.map((f) => `${dia(f.fecha)} ${f.turno || ""} · ${f.proveedor} ${dinero(f.importe)}`).join("; ")}.</div>}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F, fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: C.mut, textAlign: "left" }}>
                  <th style={{ padding: "4px 6px" }}>Día</th><th style={{ padding: "4px 6px" }}>Turno y caja</th><th style={{ padding: "4px 6px" }}>Quién</th>
                  <th style={celda}>Efectivo</th><th style={celda}>Tarjeta</th><th style={celda}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => {
                  const abierto = fila === r.eod_id;
                  return [
                    <tr key={r.eod_id} onClick={() => setFila(abierto ? null : r.eod_id)} style={{ borderTop: `1px solid ${C.brdL}`, cursor: "pointer", background: r.marcado ? "#FBE3DE" : r.cruce || r.emergencia ? "#FBF4E6" : "transparent" }}>
                      <td style={{ padding: "5px 6px", textTransform: "capitalize", whiteSpace: "nowrap" }}>{dia(r.fecha)}</td>
                      <td style={{ padding: "5px 6px", whiteSpace: "nowrap" }}>{turnoTxt(r)} · caja {r.caja}<span style={{ display: "block", fontSize: 11, color: C.mut }}>{hora(r.abre)}–{hora(r.cierra)}</span></td>
                      <td style={{ padding: "5px 6px", color: C.mut, minWidth: 110 }}>{(r.personas || []).join(", ") || "–"}</td>
                      <td style={celda}>{dif(r.ef_dif)}<span style={{ display: "block", fontSize: 11, color: C.mut }}>{dinero(r.ef_esperado)} → {dinero(r.ef_contado)}</span></td>
                      <td style={celda}>{dif(r.ta_dif)}<span style={{ display: "block", fontSize: 11, color: C.mut }}>{dinero(r.ta_esperado)} → {dinero(r.ta_contado)}</span></td>
                      <td style={celda}>
                        {dif(r.neto, true)}
                        {r.cruce && <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: AMBAR }}>Cruce</span>}
                        {r.emergencia && <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: AMBAR }}>Con ventas de emergencia</span>}
                      </td>
                    </tr>,
                    abierto && (
                      <tr key={`${r.eod_id}-d`}><td colSpan={6} style={{ padding: "4px 6px 12px", background: "#FBF8F1" }}>
                        <div style={{ fontFamily: F, fontSize: 12.5, color: C.char, lineHeight: 1.5 }}>
                          {(r.facturas || []).length ? (
                            <>
                              <b>Facturas pagadas con «Efectivo de caja» que salen de este sobre</b>
                              {r.facturas.map((f) => <div key={f.id} style={{ display: "flex", justifyContent: "space-between", maxWidth: 360 }}><span>· {f.proveedor}</span><span>{dinero(f.importe)}</span></div>)}
                            </>
                          ) : <span style={{ color: C.mut }}>Sin facturas en efectivo de caja en este sobre.</span>}
                          <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 360, marginTop: 6, fontWeight: 700 }}><span>Billetes que deben ir al sobre</span><span>{dinero(r.deberia)}</span></div>
                          <div style={{ fontSize: 11.5, color: C.mut }}>Efectivo contado en el cierre ({dinero(r.ef_contado)}) menos esas facturas. Las facturas del turno se restan en el sobre de la caja 1; si ese turno no tiene caja 1, en el de la caja 2.</div>
                          {Number(r.deberia) < 0 && <div style={{ color: ROJO, fontWeight: 700, marginTop: 4 }}>Las facturas superan el efectivo del cierre: revisa si alguna se pagó de otro sitio (caja fuerte, sobres…).</div>}
                          {r.emergencia && <div style={{ color: AMBAR, marginTop: 4 }}>Este turno tuvo ventas de la caja de emergencia, que se subieron a Epos después del cierre: el descuadre no es una falta de dinero.</div>}
                        </div>
                      </td></tr>
                    ),
                  ];
                })}
                <tr style={{ borderTop: `2px solid ${C.char}`, fontWeight: 700 }}>
                  <td style={{ padding: "6px" }} colSpan={3}>Total del mes{(d.emergencia || []).length ? " (sin los turnos con ventas de emergencia)" : ""}</td>
                  <td style={celda}>{dif(d.ef, true)}</td><td style={celda}>{dif(d.ta, true)}</td><td style={celda}>{dif(d.neto, true)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {ult && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 8 }}>Cierres traídos de Epos el {new Date(ult.en).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. Se actualiza solo a las 00:20 y a las 7:20.</div>}
        </div>
      )}
    </div>
  );
}

export function EposCierres({ mes }) {
  if (mes >= "2026-10") return <EposCierresTurnos mes={mes} />;
  return <EposCierresDias mes={mes} />;
}

function EposCierresDias({ mes }) {
  const [d, setD] = useState(null); // null cargando · false sin acceso
  const [abierta, setAbierta] = useState(false);
  const cargar = useCallback(async () => {
    try { setD(await sb.rpc("epos_vs_cierres", { p_mes: mes })); } catch (e) { setD(false); }
  }, [mes]);
  useEffect(() => { setD(null); cargar(); }, [cargar]);
  if (d === false) return null; // no es socio
  if (!d) return <div style={{ ...crd, fontFamily: F, fontSize: 13, color: C.mut }}>Cargando Epos frente a cierres…</div>;
  if (!d.hasta) return (
    <div style={{ ...crd, fontFamily: F }}>
      <div style={{ fontFamily: SF, fontSize: 17, color: C.char }}>Epos frente a cierres de caja</div>
      <div style={{ fontSize: 12.5, color: C.mut, marginTop: 2 }}>Todavía no hay días cerrados en este mes.</div>
    </div>
  );

  const dias = d.dias || [];
  const fila = (t, v, extra = {}) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: F, fontSize: 13.5, fontWeight: 500, color: C.char, padding: "5px 0", ...extra }}><span>{t}</span><span>{v}</span></div>;
  const celda = { padding: "5px 6px", textAlign: "right" };

  return (
    <div style={{ ...crd, padding: 0, overflow: "hidden", border: d.descuadre ? `2px solid ${ROJO}` : crd.border }}>
      <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: SF, fontSize: 17, color: C.char }}>Epos frente a cierres de caja</span>
          <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2 }}>
            Epos {dinero(d.epos)} · cierres {dinero(d.cierres)}{d.en_curso ? ` · hasta el ${largo(d.hasta)}` : ""}
          </span>
        </span>
        <span style={{ fontFamily: F, fontSize: 13, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: d.descuadre ? ROJO : "#EAF4EE", color: d.descuadre ? "#fff" : "#1E6B3C" }}>{conSigno(d.diferencia)}</span>
        <span aria-hidden="true" style={{ fontFamily: F, fontSize: 18, color: C.mut, transform: abierta ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      {abierta && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.brdL}` }}>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, lineHeight: 1.45, margin: "12px 0 8px" }}>
            Lo que Epos dice que se cobró en efectivo (menos el cambio devuelto) frente a lo que se apuntó en los cierres de caja de las dos cajas. Solo para ver: no cambia nada de las cuentas. {d.en_curso ? "Hoy entra mañana, cuando el día esté cerrado." : ""}
          </div>
          {fila("Efectivo según Epos", dinero(d.epos))}
          {fila("Efectivo según los cierres de caja", dinero(d.cierres))}
          <div style={{ borderRadius: 12, padding: "12px 14px", margin: "8px 0 10px", background: d.descuadre ? ROJO : "#F4EFE6", color: d.descuadre ? "#fff" : C.char, fontFamily: F }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: d.descuadre ? 0.9 : 0.7 }}>Diferencia (cierres − Epos)</div>
            <div style={{ fontSize: d.descuadre ? 28 : 20, fontWeight: 800 }}>{conSigno(d.diferencia)}</div>
            {d.dias_descuadre > 0 && <div style={{ fontSize: 13, marginTop: 2 }}>{d.dias_descuadre} día{d.dias_descuadre === 1 ? "" : "s"} con {fmt2(Number(d.umbral))} o más de diferencia o sin cierre</div>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F, fontSize: 12.5 }}>
              <thead><tr style={{ color: C.mut, textAlign: "left" }}><th style={{ padding: "4px 6px" }}>Día</th><th style={{ padding: "4px 6px" }}>Turnos</th><th style={{ ...celda, padding: "4px 6px" }}>Epos</th><th style={{ ...celda, padding: "4px 6px" }}>Cierres</th><th style={{ ...celda, padding: "4px 6px" }}>Diferencia</th></tr></thead>
              <tbody>
                {dias.map((r) => {
                  const rojo = r.descuadre;
                  return (
                    <tr key={r.fecha} style={{ borderTop: `1px solid ${C.brdL}`, background: rojo ? "#FBE3DE" : "transparent" }}>
                      <td style={{ padding: "5px 6px", textTransform: "capitalize", whiteSpace: "nowrap" }}>{dia(r.fecha)}</td>
                      <td style={{ padding: "5px 6px", color: C.mut }}>{turnos(r.turnos)}</td>
                      <td style={celda}>{r.estado === "sin_epos" ? "–" : dinero(r.epos)}</td>
                      <td style={celda}>{r.estado === "falta_cierre" ? "–" : dinero(r.cierres)}</td>
                      <td style={{ ...celda, fontWeight: 700, color: rojo ? ROJO : C.char, whiteSpace: "nowrap" }}>
                        {r.estado === "falta_cierre" ? "Falta cierre de caja" : r.estado === "sin_epos" ? <span style={{ color: C.mut, fontWeight: 500 }}>Sin datos de Epos</span> : conSigno(r.diferencia)}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: `2px solid ${C.char}`, fontWeight: 700 }}>
                  <td style={{ padding: "6px" }} colSpan={2}>Total{d.dias_sin_epos > 0 ? " (sin los días sin datos de Epos)" : ""}</td>
                  <td style={celda}>{dinero(d.epos)}</td>
                  <td style={celda}>{dinero(d.cierres)}</td>
                  <td style={{ ...celda, color: d.descuadre ? ROJO : C.char }}>{conSigno(d.diferencia)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
