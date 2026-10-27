// Cierre de mes → «Lista de cierre» (solicitud #76). Desde octubre de 2026 el mes solo se cierra aquí, con todos los puntos en verde.
// Cerrar y reabrir quedan apuntados en «Cambios» (tabla cierre_mes_cambios). Los meses hasta septiembre de 2026 no tienen lista:
// se pueden reabrir y volver a cerrar con el mismo botón.
import { useState } from "react";
import { F, SF, C, crd, inp } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

const ROJO = "#B3261E";
const VERDE = "#1E6B3C";
const fechaHora = (s) => new Date(s).toLocaleString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const boton = (activo) => ({ fontFamily: F, fontWeight: 700, fontSize: 14, padding: "11px 16px", borderRadius: 10, border: "none", background: activo ? C.char : "#D8D0C4", color: activo ? C.gold : "#7A7062", cursor: activo ? "pointer" : "default" });

export function CierreLista({ mes, estado, onEstado, irA }) {
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
    if (String(p.ir).startsWith("#/")) window.location.hash = p.ir.slice(1);
    else irA(p.ir);
  };

  return (
    <div style={{ ...crd, border: `2px solid ${estado.cerrado ? VERDE : C.gold}`, marginBottom: 20 }}>
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
            <div key={p.k} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderTop: `1px solid ${C.brdL}`, fontFamily: F, fontSize: 13.5 }}>
              <span aria-hidden style={{ fontWeight: 800, color: p.ok ? VERDE : ROJO, width: 16 }}>{p.ok ? "✓" : "✗"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.char }}>{p.t}</div>
                {!p.ok && (
                  <button type="button" onClick={() => ir(p)} style={{ background: "none", border: "none", padding: 0, marginTop: 2, fontFamily: F, fontSize: 12.5, color: ROJO, textAlign: "left", cursor: "pointer", textDecoration: "underline" }}>
                    {p.falta || "Falta"} →
                  </button>
                )}
              </div>
            </div>
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
