// Cierre de mes → «Lista de cierre» (solicitud #76). Desde octubre de 2026 el mes solo se cierra aquí, con todos los puntos en verde.
// Cerrar y reabrir quedan apuntados en «Cambios» (tabla cierre_mes_cambios). Los meses hasta septiembre de 2026 no tienen lista:
// se pueden reabrir y volver a cerrar con el mismo botón.
import { useState } from "react";
import { F, SF, C, crd, inp } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { mkLabel, fmt2 } from "../../lib/utils.js";

const ROJO = "#B3261E";
const VERDE = "#1E6B3C";
const fechaHora = (s) => new Date(s).toLocaleString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const boton = (activo) => ({ fontFamily: F, fontWeight: 700, fontSize: 14, padding: "11px 16px", borderRadius: 10, border: "none", background: activo ? C.char : "#D8D0C4", color: activo ? C.gold : "#7A7062", cursor: activo ? "pointer" : "default" });

// #150 · Finanzas fácil (3/6): puntos que ya eran obligatorios por la sol. 105
const OBLIGATORIOS = new Set(["efectivo_sobres", "retiradas", "movimientos"]);
const INFO = {
  hechos: "Los puntos de la lista que ya están en verde. Ejemplo: 4 de 12.",
  pendientes: "Los puntos que aún faltan por hacer. Hasta que no haya ninguno no se puede cerrar el mes.",
  descuadres: "La suma de lo que no cuadra en las cajas del mes: lo contado frente a lo que dice Epos, en efectivo y en tarjeta. Es la misma cifra que sale en la Cuenta de resultados (negativo = falta dinero).",
};

export function CierreLista({ mes, estado, onEstado, irA, descuadre }) {
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [reabriendo, setReabriendo] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (estado === null) return <div style={{ ...crd, fontFamily: F, fontSize: 13, color: C.mut }}>Cargando la lista de cierre…</div>;
  if (!estado) return <div style={{ ...crd, fontFamily: F, fontSize: 13, color: ROJO }}>No se ha podido cargar la lista de cierre. Recarga la página.</div>;

  const puntos = estado.puntos || [];
  const faltan = Number(estado.faltan) || 0;
  const puede = !estado.aplica_lista || faltan === 0;

  const cerrar = async () => {
    if (!window.confirm(`¿Cerrar el mes? Quedará en solo lectura y la Cuenta de resultados lo tratará como mes cerrado.`)) return;
    setBusy(true); setMsg("");
    try { onEstado(await sb.rpc("cierre_mes_cerrar", { p_mes: mes })); } catch (e) { setMsg(e.message || "No se ha podido cerrar"); }
    setBusy(false);
  };
  const reabrir = async () => {
    if (!motivo.trim()) return;
    if (!window.confirm("¿Reabrir el mes? Volverá a poder editarse y la Cuenta de resultados lo enseñará como provisional hasta que se vuelva a cerrar.")) return;
    setBusy(true); setMsg("");
    try { onEstado(await sb.rpc("cierre_mes_reabrir", { p_mes: mes, p_motivo: motivo.trim() })); setReabriendo(false); setMotivo(""); }
    catch (e) { setMsg(e.message || "No se ha podido reabrir"); }
    setBusy(false);
  };
  const ir = (p) => {
    if (p.ok && !String(p.ir).startsWith("#/")) { irA(p.ir); return; } // #150: un punto hecho abre su bloque aquí mismo
    // #81: los sobres y la tarjeta se revisan en Finanzas → Efectivo → Caja (salvo que falte subir el extracto de La Caixa)
    if (p.k === "sobres" || p.k === "tarjeta" || (p.k === "tarjeta2" && !/extracto/i.test(p.falta || ""))) { window.location.hash = `/finanzas/efectivo/caja?mes=${mes}`; return; }
    if (p.k === "tarjeta2") { window.location.hash = "/finanzas/banco/bancos"; return; }
    if (String(p.ir).startsWith("#/")) window.location.hash = p.ir.slice(1);
    else irA(p.ir);
  };

  const total = puntos.length;
  const hechos = total - faltan;
  const nombreMes = mkLabel(mes).split(" ")[0].toLowerCase();
  const cifra = (clave, titulo, valor) => (
    <div key={clave} style={{ flex: "1 1 120px", minWidth: 0, border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 12.5, color: C.mut, fontWeight: 600 }}>
        <span>{titulo}</span>
        <button type="button" aria-expanded={info === clave} aria-label={`¿Qué es ${titulo}?`} onClick={() => setInfo(info === clave ? "" : clave)} style={{ background: "none", border: `1px solid ${C.brd}`, borderRadius: 99, width: 20, height: 20, fontSize: 11, fontWeight: 800, cursor: "pointer", color: C.char, padding: 0 }}>ⓘ</button>
      </div>
      <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: C.char, marginTop: 4, overflowWrap: "anywhere" }}>{valor}</div>
    </div>
  );
  const cabecera = (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontFamily: F, fontSize: 14.5, fontWeight: 600, color: C.char, margin: "0 0 10px" }}>Aquí cierras el mes: ves qué falta por hacer y lo haces paso a paso.</p>
      <p style={{ fontFamily: SF, fontSize: 22, color: C.char, margin: "0 0 10px", lineHeight: 1.2 }}>
        {estado.cerrado ? `${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} está cerrado ✅`
          : !estado.aplica_lista ? "Este mes se cierra directamente, sin lista."
          : faltan === 0 ? "Ya puedes cerrar el mes ✅"
          : `Te faltan ${faltan} cosa${faltan === 1 ? "" : "s"} para cerrar el mes`}
      </p>
      {estado.aplica_lista && !estado.cerrado && total > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechos} aria-label={`${hechos} de ${total} hechos`} style={{ height: 10, borderRadius: 99, background: C.brdL, overflow: "hidden" }}>
            <div style={{ width: `${Math.round((hechos / total) * 100)}%`, height: "100%", background: VERDE }} />
          </div>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 4 }}>{hechos} de {total}</div>
        </div>
      )}
      {estado.aplica_lista && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {cifra("hechos", "Hechos", hechos)}
            {cifra("pendientes", "Pendientes", faltan)}
            {descuadre != null && cifra("descuadres", "Descuadres de caja", fmt2(descuadre))}
          </div>
          {info && <p style={{ fontFamily: F, fontSize: 13.5, lineHeight: 1.5, background: C.brdL, borderRadius: 10, padding: "10px 12px", margin: "8px 0 0", color: C.char }}>{INFO[info]}</p>}
        </>
      )}
    </div>
  );

  return (
    <div style={{ ...crd, border: `2px solid ${estado.cerrado ? VERDE : C.gold}`, marginBottom: 20 }}>
      {cabecera}
      {estado.cerrado ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontFamily: F, fontSize: 14, color: VERDE, fontWeight: 700 }}>
            ✓ Cerrado{estado.cerrado_en ? ` el ${fechaHora(estado.cerrado_en)}` : ""}{estado.cerrado_por ? ` por ${estado.cerrado_por}` : " (antes de la lista de cierre)"}
            <div style={{ fontWeight: 400, fontSize: 12, color: C.mut, marginTop: 2 }}>Mes en solo lectura.</div>
          </div>
          {!reabriendo && <button type="button" onClick={() => { setReabriendo(true); setMsg(""); }} style={{ ...boton(true), background: "#fff", color: C.char, border: `1px solid ${C.brd}` }}>Reabrir mes</button>}
        </div>
      ) : (
        <>
          <div style={{ fontFamily: SF, fontSize: 17, color: C.char, marginBottom: 8 }}>Lista de cierre</div>
          {estado.aplica_lista ? puntos.map((p) => (
            <button type="button" key={p.k} onClick={() => ir(p)} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 0", border: "none", borderTop: `1px solid ${C.brdL}`, background: "none", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: F, fontSize: 13.5 }}>
              <span aria-hidden>{p.ok ? "✅" : "⚠️"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.char }}>{p.t}{OBLIGATORIOS.has(p.k) && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "#FBF0DA", color: "#8A5A00", whiteSpace: "nowrap" }}>Obligatorio para cerrar</span>}</div>
                {!p.ok && <div style={{ marginTop: 2, fontSize: 12.5, color: ROJO, fontWeight: 600 }}>{p.falta || "Falta"} →</div>}
              </div>
            </button>
          )) : (
            <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Los meses hasta septiembre de 2026 no tienen lista de cierre: se cierran directamente.</div>
          )}
          <button type="button" disabled={!puede || busy} onClick={cerrar} style={{ ...boton(puede && !busy), width: "100%", marginTop: 12 }}>
            {busy ? "Cerrando…" : puede ? "Cerrar mes" : `Faltan ${faltan} punto${faltan === 1 ? "" : "s"}`}
          </button>
        </>
      )}
      {reabriendo && (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <label style={{ fontFamily: F, fontSize: 13, color: C.char }}>Motivo para reabrir (obligatorio)
            <input value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} placeholder="Por ejemplo: falta una factura" style={{ ...inp, marginBottom: 0, marginTop: 4 }} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={!motivo.trim() || busy} onClick={reabrir} style={boton(!!motivo.trim() && !busy)}>{busy ? "Reabriendo…" : "Reabrir mes"}</button>
            <button type="button" onClick={() => { setReabriendo(false); setMotivo(""); }} style={{ ...boton(true), background: "#fff", color: C.char, border: `1px solid ${C.brd}` }}>Cancelar</button>
          </div>
        </div>
      )}
      {msg && <div role="alert" style={{ fontFamily: F, fontSize: 13, color: ROJO, fontWeight: 700, marginTop: 8 }}>{msg}</div>}
      {(estado.cambios || []).length > 0 && (
        <details style={{ marginTop: 12, fontFamily: F, fontSize: 12.5, color: C.char }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Cambios ({estado.cambios.length})</summary>
          {estado.cambios.map((c, i) => (
            <div key={i} style={{ padding: "5px 0", borderTop: i ? `1px solid ${C.brdL}` : "none" }}>
              <b>{c.accion === "cerrar" ? "Cerrado" : "Reabierto"}</b> · {fechaHora(c.en)} · {c.quien || "—"}
              {c.motivo && <div style={{ color: C.mut }}>Motivo: {c.motivo}</div>}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
