// Cierre de mes → «Apertura de sobres» (solicitud #13). Solo los 4 socios.
// Esperado = efectivo vendido en los cierres de caja del mes (las dos cajas) − pagos a proveedor hechos con ese efectivo.
// Contado = lo que hay en los sobres al abrirlos el día 1. Diferencia de 10 € o más (configurable) = descuadre, con nota obligatoria.
import { useCallback, useEffect, useState } from "react";
import { F, SF, C, inp, lbl, crd } from "../../lib/styles.js";
import { fmt2 } from "../../lib/utils.js";
import { sb } from "../../lib/supabase.js";

const ROJO = "#B3261E";
const dinero = (v) => (v == null || v === "" ? "–" : fmt2(Number(v)));
const conSigno = (v) => `${Number(v) > 0 ? "+" : ""}${fmt2(Number(v))}`;
// «6.009,99», «6009,99» y «6009.99» valen lo mismo
const limpio = (v) => { const s = String(v ?? "").trim().replace(/\s/g, ""); return s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s; };
const numero = (v) => { const s = limpio(v); const x = Number(s); return s !== "" && Number.isFinite(x) ? x : NaN; };
const dia = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
const cuando = (ts) => new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Aviso rojo para lo alto del Cierre de mes cuando el mes tiene descuadre guardado
export function DescuadreSobres({ datos }) {
  if (!datos || !datos.descuadre) return null;
  return (
    <div role="alert" style={{ background: ROJO, color: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 18, fontFamily: F }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.9 }}>Descuadre en los sobres</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>{conSigno(datos.diferencia)}</div>
      <div style={{ fontSize: 13, marginTop: 2 }}>Contado {dinero(datos.contado)} frente a {dinero(datos.esperado)} esperados{datos.nota ? ` · ${datos.nota}` : ""}</div>
    </div>
  );
}

export function useSobres(mes) {
  const [datos, setDatos] = useState(null); // null cargando · false sin acceso
  const cargar = useCallback(async () => {
    try { setDatos(await sb.rpc("sobres_mes", { p_mes: mes })); } catch (e) { setDatos(false); }
  }, [mes]);
  useEffect(() => { setDatos(null); cargar(); }, [cargar]);
  return { datos, setDatos, recargar: cargar };
}

export function AperturaSobres({ mes, datos, setDatos }) {
  const [abierta, setAbierta] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const [editar, setEditar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setContado(datos && datos.contado != null ? String(datos.contado).replace(".", ",") : ""); setNota((datos && datos.nota) || ""); setEditar(false); setMsg(""); }, [datos]);
  if (datos === false) return null; // no es socio
  if (!datos) return <div style={{ ...crd, fontFamily: F, fontSize: 13, color: C.mut }}>Cargando la apertura de sobres…</div>;

  const esperado = Number(datos.esperado), umbral = Number(datos.umbral);
  const guardado = datos.contado != null;
  const x = numero(contado);
  const valido = Number.isFinite(x) && x >= 0 && /^\d+(\.\d{1,2})?$/.test(limpio(contado));
  const dif = valido ? Math.round((x - esperado) * 100) / 100 : null;
  const descuadre = dif != null && Math.abs(dif) >= umbral;
  const editando = !guardado || editar;
  const difMostrar = editando ? dif : datos.diferencia;
  const descMostrar = editando ? descuadre : datos.descuadre;
  const puedeGuardar = valido && (!descuadre || nota.trim()) && !busy && (!guardado || Number(x) !== Number(datos.contado) || (nota.trim() || "") !== (datos.nota || ""));

  const guardar = async () => {
    setBusy(true); setMsg("");
    try { const r = await sb.rpc("sobres_guardar", { p_mes: mes, p_contado: Math.round(x * 100) / 100, p_nota: nota.trim() || null }); setDatos(r); }
    catch (e) { setMsg(e.message || "No se ha podido guardar"); }
    setBusy(false);
  };
  // Quitar un contado guardado por error: el mes vuelve a quedar sin contar (queda en el historial)
  const quitar = async () => {
    if (!window.confirm(`¿Quitar el contado de ${dinero(datos.contado)}? El mes quedará sin contar. Queda registrado en los cambios.`)) return;
    setBusy(true); setMsg("");
    try { setDatos(await sb.rpc("sobres_quitar", { p_mes: mes })); }
    catch (e) { setMsg(e.message || "No se ha podido quitar"); }
    setBusy(false);
  };
  const fila = (t, v, fuerte) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: F, fontSize: fuerte ? 15 : 13.5, fontWeight: fuerte ? 700 : 500, color: C.char, padding: "5px 0" }}><span>{t}</span><span>{v}</span></div>;

  return (
    <div style={{ ...crd, padding: 0, overflow: "hidden", border: descMostrar && (guardado && !editar) ? `2px solid ${ROJO}` : crd.border }}>
      <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: SF, fontSize: 17, color: C.char }}>Apertura de sobres</span>
          <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2 }}>
            Esperado {dinero(esperado)}{guardado ? ` · contado ${dinero(datos.contado)}` : " · sin contar todavía"}
          </span>
        </span>
        {guardado && <span style={{ fontFamily: F, fontSize: 13, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: datos.descuadre ? ROJO : "#EAF4EE", color: datos.descuadre ? "#fff" : "#1E6B3C" }}>{conSigno(datos.diferencia)}</span>}
        <span aria-hidden="true" style={{ fontFamily: F, fontSize: 18, color: C.mut, transform: abierta ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      {abierta && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.brdL}` }}>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, lineHeight: 1.45, margin: "12px 0 8px" }}>
            Los sobres que se abren el día 1 son los de este mes. El esperado se calcula solo con los cierres de caja de las dos cajas y cambia si se corrige algún cierre. Desde el 24 de octubre, las facturas pagadas en efectivo de caja restan por su fecha, sin engancharlas al cierre.
          </div>
          {fila("Efectivo vendido (cierres de caja)", dinero(datos.efectivo))}
          {fila("Pagos a proveedor hechos con ese efectivo", Number(datos.pagos) ? `−${dinero(datos.pagos)}` : dinero(0))}
          <div style={{ borderTop: `1px dashed ${C.brdL}`, marginTop: 4 }}>{fila("Efectivo esperado", dinero(esperado), true)}</div>
          <button type="button" onClick={() => setDetalle(!detalle)} style={{ background: "none", border: "none", padding: "6px 0", cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, textDecoration: "underline" }}>{detalle ? "Ocultar" : "Ver"} el detalle por día y caja ({datos.cierres} cierre{datos.cierres === 1 ? "" : "s"})</button>
          {detalle && (
            <div style={{ overflowX: "auto", margin: "6px 0 10px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F, fontSize: 12.5 }}>
                <thead><tr style={{ color: C.mut, textAlign: "left" }}><th style={{ padding: "4px 6px" }}>Día</th><th style={{ padding: "4px 6px" }}>Caja</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Efectivo</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Pagos</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Al sobre</th></tr></thead>
                <tbody>
                  {(datos.detalle || []).map((r) => (
                    <tr key={`${r.fecha}-${r.caja}`} style={{ borderTop: `1px solid ${C.brdL}` }}>
                      <td style={{ padding: "5px 6px", textTransform: "capitalize" }}>{dia(r.fecha)}</td>
                      <td style={{ padding: "5px 6px" }}>{r.caja ? `Caja ${r.caja}` : "Facturas en efectivo"}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" }}>{dinero(r.efectivo)}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", color: C.mut }}>{Number(r.pagos) ? `−${dinero(r.pagos)}` : "–"}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700 }}>{dinero(r.neto)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${C.char}`, fontWeight: 700 }}><td style={{ padding: "6px" }} colSpan={4}>Total</td><td style={{ padding: "6px", textAlign: "right" }}>{dinero(esperado)}</td></tr>
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <label style={lbl}>Efectivo contado (total de todos los sobres)</label>
            {editando ? (
              <input inputMode="decimal" value={contado} onChange={(e) => setContado(e.target.value)} placeholder="0,00" style={{ ...inp, marginBottom: 10 }} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontFamily: SF, fontSize: 22, color: C.char, flex: 1 }}>{dinero(datos.contado)}</span>
                <button type="button" disabled={busy} onClick={quitar} style={{ border: "none", background: "none", padding: "8px 6px", fontFamily: F, fontSize: 13, fontWeight: 600, color: ROJO, textDecoration: "underline", cursor: "pointer" }}>Quitar</button>
                <button type="button" onClick={() => setEditar(true)} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, padding: "8px 14px", fontFamily: F, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Corregir</button>
              </div>
            )}
          </div>
          {difMostrar != null && (
            <div style={{ borderRadius: 12, padding: "12px 14px", marginBottom: 10, background: descMostrar ? ROJO : "#F4EFE6", color: descMostrar ? "#fff" : C.char, fontFamily: F }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: descMostrar ? 0.9 : 0.7 }}>Diferencia (contado − esperado)</div>
              <div style={{ fontSize: descMostrar ? 28 : 20, fontWeight: 800 }}>{conSigno(difMostrar)}</div>
              {descMostrar && <div style={{ fontSize: 13, marginTop: 2 }}>Descuadre de {fmt2(umbral)} o más{editando ? ": explica qué ha pasado para poder guardar." : "."}</div>}
            </div>
          )}
          {editando ? (
            <>
              <label style={lbl}>Nota{descuadre ? " (obligatoria)" : " (opcional)"}</label>
              <textarea rows={2} value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} placeholder={descuadre ? "Qué ha pasado con la diferencia" : "Opcional"} style={{ ...inp, resize: "vertical", marginBottom: 10, borderColor: descuadre && !nota.trim() ? ROJO : inp.borderColor }} />
              {contado && !valido && <div style={{ fontFamily: F, fontSize: 12.5, color: ROJO, marginBottom: 8 }}>Pon un importe válido, con 2 decimales como mucho.</div>}
              {msg && <div role="alert" style={{ fontFamily: F, fontSize: 13, color: ROJO, marginBottom: 8 }}>{msg}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                {guardado && <button type="button" onClick={() => { setEditar(false); setContado(String(datos.contado).replace(".", ",")); setNota(datos.nota || ""); }} style={{ flex: 1, padding: 13, border: `1.5px solid ${C.brd}`, borderRadius: 10, background: "transparent", fontFamily: F, fontSize: 14, fontWeight: 600, color: C.mut, cursor: "pointer" }}>Cancelar</button>}
                <button type="button" disabled={!puedeGuardar} onClick={guardar} style={{ flex: 2, padding: 13, border: "none", borderRadius: 10, background: puedeGuardar ? C.char : "#D8D0C4", color: puedeGuardar ? C.gold : "#A09888", fontFamily: SF, fontSize: 15, cursor: puedeGuardar ? "pointer" : "default" }}>{busy ? "Guardando…" : "Guardar contado"}</button>
              </div>
            </>
          ) : (
            <>
              {msg && <div role="alert" style={{ fontFamily: F, fontSize: 13, color: ROJO, marginBottom: 8 }}>{msg}</div>}
              {datos.nota && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: "#F4EFE6", borderRadius: 10, padding: "9px 12px", marginBottom: 8 }}><b>Nota:</b> {datos.nota}</div>}
            </>
          )}
          {datos.guardado && <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 8 }}>Guardado por {datos.guardado.por || "—"} el {cuando(datos.guardado.en)}</div>}
          {(datos.historial || []).length > (guardado ? 1 : 0) && (
            <details style={{ marginTop: 8, fontFamily: F, fontSize: 12.5, color: C.mut }}>
              <summary style={{ cursor: "pointer" }}>Cambios ({datos.historial.length})</summary>
              {datos.historial.map((h, i) => <div key={i} style={{ padding: "4px 0" }}>{cuando(h.en)} · {h.por || "—"}: {h.despues == null ? `quitó el contado de ${dinero(h.antes)}` : <>{h.antes == null ? "sin contado" : `antes ${dinero(h.antes)}`} → {dinero(h.despues)}</>}</div>)}
            </details>
          )}
        </div>
      )}
    </div>
  );
}
