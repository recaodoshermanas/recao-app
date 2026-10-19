// Apertura de sobres → «Extras a pagar con los sobres» (solicitud #17). Solo los 4 socios.
// Lista fija (desde octubre de 2026) + cambios solo de este mes + extras puntuales. «Editar lista fija» vale de este mes en adelante.
// Cuentan como gasto de personal de este mes y salen del efectivo de los sobres el día 1 del mes siguiente (cuando la apertura está guardada).
import { useCallback, useEffect, useState } from "react";
import { F, SF, C, inp, lbl } from "../../lib/styles.js";
import { fmt2 } from "../../lib/utils.js";
import { sb } from "../../lib/supabase.js";

const ROJO = "#B3261E";
const limpio = (v) => { const s = String(v ?? "").trim().replace(/\s/g, ""); return s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s; };
const numero = (v) => { const s = limpio(v); return /^\d+(\.\d{1,2})?$/.test(s) && Number(s) > 0 ? Number(s) : NaN; };
const cuando = (ts) => new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const mesTxt = (m) => new Date(`${m}-15T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
const btnL = { border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, padding: "7px 12px", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, cursor: "pointer" };
const btnTxt = { border: "none", background: "none", padding: "6px 4px", fontFamily: F, fontSize: 12.5, fontWeight: 600, textDecoration: "underline", cursor: "pointer" };
const ACC = { quitar: "quitó", deshacer: "volvió a poner", importe: "cambió el importe de", anadir: "añadió", fijo_anadir: "añadió a la lista fija", fijo_importe: "cambió en la lista fija", fijo_baja: "dio de baja en la lista fija" };

function Importe({ valor, onGuardar, busy }) {
  const [v, setV] = useState(null);
  if (v === null) return <button type="button" onClick={() => setV(String(valor).replace(".", ","))} title="Cambiar el importe solo este mes" style={{ ...btnTxt, textDecoration: "none", fontSize: 13.5, fontWeight: 700, color: C.char }}>{fmt2(Number(valor))}</button>;
  const x = numero(v);
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input autoFocus inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} style={{ ...inp, width: 90, padding: "6px 8px", fontSize: 13, marginBottom: 0 }} />
      <button type="button" disabled={busy || !(x > 0)} onClick={async () => { if (await onGuardar(x)) setV(null); }} style={{ ...btnL, padding: "5px 10px" }}>Guardar</button>
      <button type="button" onClick={() => setV(null)} style={{ ...btnTxt, color: C.mut }}>Cancelar</button>
    </span>
  );
}

function FormExtra({ d, titulo, onGuardar, onCerrar, busy }) {
  const [f, setF] = useState({ trabajadora_id: "", nombre: "", concepto: "", importe: "" });
  const x = numero(f.importe);
  const otra = f.trabajadora_id === "_otra";
  return (
    <div style={{ background: "#F7F2E9", borderRadius: 12, padding: 12, margin: "8px 0" }}>
      <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: C.char, marginBottom: 8 }}>{titulo}</div>
      <label style={lbl}>Trabajadora</label>
      <select value={f.trabajadora_id} onChange={(e) => setF({ ...f, trabajadora_id: e.target.value, nombre: "" })} style={{ ...inp, marginBottom: 8 }}>
        <option value="">Elegir…</option>
        {d.trabajadoras.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        <option value="_otra">Otra (sin cuenta en la app)…</option>
      </select>
      {otra && <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Nombre" style={{ ...inp, marginBottom: 8 }} />}
      <div style={{ display: "flex", gap: 8 }}>
        <input value={f.concepto} maxLength={80} onChange={(e) => setF({ ...f, concepto: e.target.value })} placeholder="Concepto (p. ej. Desempeño)" style={{ ...inp, flex: 2, marginBottom: 8 }} />
        <input inputMode="decimal" value={f.importe} onChange={(e) => setF({ ...f, importe: e.target.value })} placeholder="0,00 €" style={{ ...inp, flex: 1, marginBottom: 8 }} />
      </div>
      {f.importe && !(x > 0) && <div style={{ fontFamily: F, fontSize: 12.5, color: ROJO, marginBottom: 8 }}>Importe mayor que 0, con 2 decimales como mucho.</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCerrar} style={{ ...btnTxt, color: C.mut }}>Cancelar</button>
        <button type="button" disabled={busy || !(otra ? f.nombre.trim() : f.trabajadora_id) || !f.concepto.trim() || !(x > 0)} onClick={async () => { if (await onGuardar({ trabajadora_id: otra ? null : f.trabajadora_id, nombre: otra ? f.nombre.trim() : null, concepto: f.concepto.trim(), importe: x })) onCerrar(); }} style={{ ...btnL, background: C.char, color: C.gold, borderColor: C.char }}>Añadir</button>
      </div>
    </div>
  );
}

export function ExtrasSobres({ mes, contado }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(null); // "puntual" | "fijo"
  const [lista, setLista] = useState(false);
  const cargar = useCallback(async () => { try { setD(await sb.rpc("sobres_extras", { p_mes: mes })); } catch (e) { setD(false); } }, [mes]);
  useEffect(() => { setD(null); setForm(null); setLista(false); cargar(); }, [cargar, contado]);
  if (d === false || !d) return null;

  const accion = async (p) => {
    setBusy(true); setMsg("");
    try { setD(await sb.rpc("sobres_extras_accion", { p_mes: mes, p })); setBusy(false); return true; }
    catch (e) { setMsg(e.message || "No se ha podido guardar"); setBusy(false); return false; }
  };
  const lineas = d.lineas || [];
  const antes = mes < d.desde;

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${C.brdL}`, paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: SF, fontSize: 16, color: C.char, flex: 1 }}>Extras a pagar con los sobres</span>
        <span style={{ fontFamily: F, fontSize: 14, fontWeight: 800, color: C.char }}>{fmt2(Number(d.total))}</span>
      </div>
      <div style={{ fontFamily: F, fontSize: 12, color: C.mut, margin: "2px 0 8px", lineHeight: 1.4 }}>
        {antes ? `La lista fija empieza en ${mesTxt(d.desde)}.` : "No cambian el esperado ni la diferencia. Cuentan como gasto de personal de este mes y, cuando la apertura está guardada, salen solos en Efectivo de sobres el día 1."}
      </div>
      {lineas.length === 0 && <div style={{ fontFamily: F, fontSize: 13, color: C.mut, padding: "4px 0" }}>Sin extras este mes.</div>}
      {lineas.map((l) => (
        <div key={l.clave} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.brdL}`, fontFamily: F, fontSize: 13.5, opacity: l.quitado ? 0.5 : 1 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ color: C.char, fontWeight: 600, textDecoration: l.quitado ? "line-through" : "none" }}>{l.nombre}</span>
            <span style={{ color: C.mut }}> · {l.concepto}{l.origen === "puntual" ? " · solo este mes" : l.importe_fijo != null && Number(l.importe) !== Number(l.importe_fijo) ? ` · fijo ${fmt2(Number(l.importe_fijo))}` : ""}</span>
          </span>
          {l.quitado ? <span style={{ fontWeight: 700, color: C.mut, textDecoration: "line-through" }}>{fmt2(Number(l.importe))}</span> : <Importe valor={l.importe} busy={busy} onGuardar={(x) => accion({ accion: "importe", clave: l.clave, importe: x })} />}
          {l.quitado
            ? <button type="button" disabled={busy} onClick={() => accion({ accion: "deshacer", clave: l.clave })} style={{ ...btnTxt, color: C.char }}>Deshacer</button>
            : <button type="button" disabled={busy} onClick={() => accion({ accion: "quitar", clave: l.clave })} title="Solo este mes" style={{ ...btnTxt, color: ROJO }}>Quitar</button>}
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: `2px solid ${C.char}`, padding: "7px 0 2px", fontFamily: F, fontSize: 14, fontWeight: 700, color: C.char }}><span>Total extras</span><span>{fmt2(Number(d.total))}</span></div>
      {d.contado != null && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontFamily: F, fontSize: 14, fontWeight: 700, color: C.char }}><span>Queda en efectivo tras pagar extras</span><span>{fmt2(Number(d.queda))}</span></div>}
      {msg && <div role="alert" style={{ fontFamily: F, fontSize: 13, color: ROJO, margin: "6px 0" }}>{msg}</div>}

      {form === "puntual" && <FormExtra d={d} titulo="Extra solo para este mes" busy={busy} onCerrar={() => setForm(null)} onGuardar={(x) => accion({ accion: "anadir", ...x })} />}
      {!antes && !form && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button type="button" onClick={() => setForm("puntual")} style={btnL}>+ Añadir extra</button>
          <button type="button" onClick={() => setLista(!lista)} style={{ ...btnL, background: lista ? "#F4EFE6" : "#fff" }}>{lista ? "Cerrar lista fija" : "Editar lista fija"}</button>
        </div>
      )}

      {lista && !antes && (
        <div style={{ border: `1.5px dashed ${C.brd}`, borderRadius: 12, padding: 12, marginTop: 10 }}>
          <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700, color: C.char }}>Lista fija</div>
          <div style={{ fontFamily: F, fontSize: 12, color: C.mut, margin: "2px 0 8px" }}>Lo que cambies aquí vale desde {mesTxt(mes)} en adelante. Los meses anteriores no se tocan.</div>
          {(d.fijos || []).map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.brdL}`, fontFamily: F, fontSize: 13.5 }}>
              <span style={{ flex: 1, minWidth: 0 }}><b style={{ color: C.char }}>{f.nombre}</b><span style={{ color: C.mut }}> · {f.concepto}</span></span>
              <Importe valor={f.importe} busy={busy} onGuardar={(x) => accion({ accion: "fijo_importe", id: f.id, importe: x })} />
              <button type="button" disabled={busy} onClick={() => { if (window.confirm(`¿Dar de baja «${f.concepto}» de ${f.nombre} desde ${mesTxt(mes)}? Los meses anteriores no cambian.`)) accion({ accion: "fijo_baja", id: f.id }); }} style={{ ...btnTxt, color: ROJO }}>Dar de baja</button>
            </div>
          ))}
          {form === "fijo"
            ? <FormExtra d={d} titulo={`Extra fijo desde ${mesTxt(mes)}`} busy={busy} onCerrar={() => setForm(null)} onGuardar={(x) => accion({ accion: "fijo_anadir", ...x })} />
            : <button type="button" onClick={() => setForm("fijo")} style={{ ...btnL, marginTop: 8 }}>+ Añadir extra fijo</button>}
        </div>
      )}

      {(d.historial || []).length > 0 && (
        <details style={{ marginTop: 8, fontFamily: F, fontSize: 12.5, color: C.mut }}>
          <summary style={{ cursor: "pointer" }}>Cambios en los extras ({d.historial.length})</summary>
          {d.historial.map((h, i) => (
            <div key={i} style={{ padding: "4px 0" }}>
              {cuando(h.en)} · {h.por || "—"} {ACC[h.accion] || h.accion} {h.detalle?.concepto} de {h.detalle?.nombre}
              {h.detalle?.antes != null && h.detalle?.despues != null ? `: ${fmt2(Number(h.detalle.antes))} → ${fmt2(Number(h.detalle.despues))}` : h.detalle?.despues != null ? ` (${fmt2(Number(h.detalle.despues))})` : h.detalle?.antes != null ? ` (${fmt2(Number(h.detalle.antes))})` : ""}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
