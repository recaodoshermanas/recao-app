// #186 · Ventanas de elección del Protocolo v2.0: lo primero que ve la trabajadora en «Mis vacaciones».
// Verano (15–30/11): dos bloques, principal y secundario. Primavera (1–15/12) y otoño (1–15/3): una semana de lunes a domingo.
// Fuera de ventana solo se piden días sueltos; quien no presentó su semana puede pedirla después, sin prioridad.
import { useState } from "react";
import { F, SF, C, btnDark } from "../lib/styles.js";
import { sb } from "../lib/supabase.js";

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const dm = (s) => { const [, m, d] = s.split("-").map(Number); return `${d} ${MES[m - 1]}`; };
const dml = (s) => { const [, m, d] = s.split("-").map(Number); return `${d} de ${MESL[m - 1]}`; };
const QUE = { verano: "tus dos bloques de verano", primavera: "tu semana de primavera", otono: "tu semana de otoño" };
const ENTRE = { primavera: "entre marzo y mayo", otono: "entre septiembre y noviembre" };
export const errMsg = (e) => { const t = String(e?.message || e || ""); const i = t.indexOf("{"); if (i >= 0) { try { return JSON.parse(t.slice(i)).message || t; } catch (x) { /* noop */ } } return t || "No se ha podido guardar"; };

const caja = { background: "#fff", border: `1.5px solid ${C.char}`, borderRadius: 18, padding: 16, marginBottom: 12 };
const tit = { fontFamily: SF, fontSize: 19, color: C.char, lineHeight: 1.2 };
const sub = { fontFamily: F, fontSize: 12.5, color: C.mut, lineHeight: 1.45, marginTop: 5 };
const plazo = { display: "inline-block", fontFamily: F, fontSize: 11.5, fontWeight: 700, background: C.gold, color: C.goldDark, borderRadius: 999, padding: "4px 11px", marginTop: 9 };
const sel = { width: "100%", boxSizing: "border-box", padding: "12px 12px", border: `1.5px solid ${C.brd}`, borderRadius: 12, fontFamily: F, fontSize: 14, color: C.char, background: "#fff" };
const lbl = { fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.mutL, margin: "12px 2px 6px" };
const okBox = { background: "#E7F3EC", border: "1px solid #CBE6D5", borderRadius: 12, padding: "10px 12px", fontFamily: F, fontSize: 13, color: "#1E5E38", lineHeight: 1.45, marginTop: 12 };
const errBox = { background: "#FBEDE9", border: "1px solid #EDC9C3", borderRadius: 12, padding: "10px 12px", fontFamily: F, fontSize: 12.5, color: C.red, lineHeight: 1.4, marginTop: 10 };

function Plazo({ v }) {
  return <span style={plazo}>{v.dias_quedan === 1 ? "Último día de plazo" : `Te quedan ${v.dias_quedan} días · hasta el ${dml(v.cierra_mia)}`}</span>;
}

function Verano({ v, onHecho }) {
  const e = v.eleccion;
  const [editar, setEditar] = useState(!e);
  const [p, setP] = useState(e ? String(e.principal) : "");
  const [s, setS] = useState(e ? String(e.secundario) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const bloques = v.bloques || [];
  const nombre = (n) => { const b = bloques.find((x) => String(x.n) === String(n)); return b ? `Bloque ${b.n} · ${dm(b.ini)} – ${dm(b.fin)}` : ""; };
  const guardar = async () => {
    if (!p || !s) { setErr("Tienes que elegir los dos bloques: el principal y el secundario."); return; }
    if (p === s) { setErr("El bloque principal y el secundario tienen que ser distintos."); return; }
    setBusy(true); setErr("");
    try { await sb.rpc("vac_guardar_verano", { p_ventana: v.id, p_principal: Number(p), p_secundario: Number(s) }); setEditar(false); await onHecho("Bloques de verano guardados"); }
    catch (x) { setErr(errMsg(x)); }
    setBusy(false);
  };
  return (
    <div style={caja}>
      <div style={tit}>Elige tus dos bloques de verano {v.anio}</div>
      <div style={sub}>Dos semanas seguidas, de lunes a domingo. Elige un bloque principal y uno secundario: los dos son obligatorios. Si coincidís varias en el mismo bloque, se sortea; quien no presente sus bloques en plazo pasa la última en el reparto.</div>
      <Plazo v={v} />
      {!editar && e ? (
        <>
          <div style={okBox}>✓ Presentado<br /><b>Principal:</b> {nombre(e.principal)}<br /><b>Secundario:</b> {nombre(e.secundario)}</div>
          <button onClick={() => setEditar(true)} style={{ ...btnDark, background: "#fff", color: C.char, border: `1.5px solid ${C.brd}`, fontFamily: F, fontSize: 14, fontWeight: 600, padding: 12, marginTop: 10 }}>Cambiar mis bloques</button>
        </>
      ) : (
        <>
          <div style={lbl}>Bloque principal</div>
          <select value={p} onChange={(ev) => setP(ev.target.value)} style={sel}>
            <option value="">Elige…</option>
            {bloques.map((b) => <option key={b.n} value={String(b.n)}>{nombre(b.n)}</option>)}
          </select>
          <div style={lbl}>Bloque secundario</div>
          <select value={s} onChange={(ev) => setS(ev.target.value)} style={sel}>
            <option value="">Elige…</option>
            {bloques.filter((b) => String(b.n) !== p).map((b) => <option key={b.n} value={String(b.n)}>{nombre(b.n)}</option>)}
          </select>
          {err && <div style={errBox}>{err}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {e && <button onClick={() => { setEditar(false); setErr(""); setP(String(e.principal)); setS(String(e.secundario)); }} style={{ background: "#fff", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: "0 16px", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.mut, cursor: "pointer" }}>Cancelar</button>}
            <button onClick={guardar} disabled={busy} style={{ ...btnDark, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : e ? "Guardar el cambio" : "Presentar mis bloques"}</button>
          </div>
        </>
      )}
    </div>
  );
}

function Semana({ v, fueraPlazo, hoy, onHecho }) {
  const e = v.eleccion;
  const [editar, setEditar] = useState(!e);
  const [lunes, setLunes] = useState(e ? e.fecha_inicio : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const semanas = (Array.isArray(v.semanas) ? v.semanas : []).filter((w) => !fueraPlazo || !hoy || w.lunes > hoy);
  const puedeCambiar = !e || (e.estado === "pendiente" && (!fueraPlazo || e.fuera_plazo));
  const guardar = async () => {
    if (!lunes) { setErr("Elige una semana."); return; }
    setBusy(true); setErr("");
    try { await sb.rpc("vac_pedir_semana", { p_ventana: v.id, p_lunes: lunes }); setEditar(false); await onHecho(e ? "Semana cambiada" : "Semana enviada a dirección"); }
    catch (x) { setErr(errMsg(x)); }
    setBusy(false);
  };
  const nombre = QUE[v.tipo].replace("tu ", "");
  return (
    <div style={caja}>
      <div style={tit}>{fueraPlazo ? `Pedir mi ${nombre} ${v.anio}` : `Elige tu ${nombre} ${v.anio}`}</div>
      {fueraPlazo
        ? <div style={sub}>La ventana cerró el {dml(v.cierra_mia)} y no presentaste tu semana. Puedes pedirla ahora, pero <b>sin prioridad</b>: solo puedes elegir semanas que no haya pedido en plazo ninguna compañera.</div>
        : <div style={sub}>Una semana completa, de lunes a domingo, {ENTRE[v.tipo]}. Si coincides con una compañera, dirección lo resuelve al cerrar la ventana, con sorteo. Puedes cambiarla hasta el último día de plazo.</div>}
      {!fueraPlazo && <Plazo v={v} />}
      {!editar && e ? (
        <>
          <div style={okBox}>✓ {e.estado === "aceptado" ? "Aprobada" : "Presentada"}{e.fuera_plazo ? " (fuera de plazo)" : ""}: semana del <b>{dm(e.fecha_inicio)} al {dm(e.fecha_fin)}</b>{e.estado === "pendiente" ? ". Dirección la aprobará al resolver el reparto." : "."}</div>
          {puedeCambiar && <button onClick={() => setEditar(true)} style={{ ...btnDark, background: "#fff", color: C.char, border: `1.5px solid ${C.brd}`, fontFamily: F, fontSize: 14, fontWeight: 600, padding: 12, marginTop: 10 }}>Cambiar mi semana</button>}
        </>
      ) : (
        <>
          <div style={lbl}>Semana</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {semanas.map((w) => {
              const bloqueada = !!w.cerrada || (fueraPlazo && (w.ocupada || w.aprobada));
              const motivo = w.cerrada ? `Cerrado: ${w.cerrada}` : fueraPlazo && w.ocupada ? "Ya pedida en plazo" : fueraPlazo && w.aprobada ? "Ya cogida" : w.ocupada ? "También la ha pedido otra compañera" : "";
              const on = lunes === w.lunes;
              return (
                <button key={w.lunes} disabled={bloqueada} onClick={() => setLunes(w.lunes)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, textAlign: "left", padding: "11px 13px", borderRadius: 12, cursor: bloqueada ? "default" : "pointer", border: on ? `2px solid ${C.char}` : `1.5px solid ${C.brdL}`, background: on ? C.gold : bloqueada ? "#F3F1EC" : "#fff", opacity: bloqueada ? 0.6 : 1, fontFamily: F }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: on ? C.goldDark : C.char }}>{dm(w.lunes)} – {dm(w.domingo)}</span>
                  {motivo && <span style={{ fontSize: 11, color: bloqueada ? C.mut : "#8a6a1e", fontWeight: 600 }}>{motivo}</span>}
                </button>
              );
            })}
          </div>
          {err && <div style={errBox}>{err}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {e && <button onClick={() => { setEditar(false); setErr(""); setLunes(e.fecha_inicio); }} style={{ background: "#fff", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: "0 16px", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.mut, cursor: "pointer" }}>Cancelar</button>}
            <button onClick={guardar} disabled={busy || !lunes} style={{ ...btnDark, opacity: busy || !lunes ? 0.6 : 1 }}>{busy ? "Enviando…" : e ? "Guardar el cambio" : "Enviar mi semana"}</button>
          </div>
        </>
      )}
    </div>
  );
}

// datos = respuesta de vac_mis_ventanas()
export function VacacionesVentana({ datos, onHecho }) {
  const vs = (datos && datos.ventanas) || [];
  const hoy = datos && datos.hoy;
  const abiertas = vs.filter((v) => v.estado === "abierta");
  // Semanas no presentadas en plazo (o presentadas fuera de plazo) cuya temporada aún no ha pasado
  const tardias = vs.filter((v) => v.tipo !== "verano" && v.estado === "cerrada" && (!v.presentado || (v.eleccion && v.eleccion.fuera_plazo)) && hoy && v.rango_hasta > hoy);
  const proxima = vs.filter((v) => v.estado === "futura").sort((a, b) => (a.abre < b.abre ? -1 : 1))[0];
  if (!datos) return null;
  return (
    <>
      {abiertas.map((v) => v.tipo === "verano" ? <Verano key={v.id} v={v} onHecho={onHecho} /> : <Semana key={v.id} v={v} onHecho={onHecho} />)}
      {tardias.map((v) => <Semana key={v.id} v={v} fueraPlazo hoy={hoy} onHecho={onHecho} />)}
      {abiertas.length === 0 && (
        <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: "13px 15px", marginBottom: 12 }}>
          <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700, color: C.char }}>Ahora no hay ninguna ventana de elección abierta</div>
          <div style={{ ...sub, marginTop: 3 }}>
            {hoy && hoy < "2027-01-01" ? <>Lo que te quede de 2026 lo sigues pidiendo como siempre (hasta el 23 de diciembre). Para 2027, fuera de las ventanas solo se piden los días sueltos (3 al año, con un mes de antelación).</> : "Fuera de las ventanas solo se piden los días sueltos (3 al año, con un mes de antelación)."}
            {proxima ? <> La próxima ventana abre el <b>{dml(proxima.abre)}</b>: tocará elegir {QUE[proxima.tipo]} {proxima.anio}{ENTRE[proxima.tipo] ? ` (${ENTRE[proxima.tipo]})` : ""}.</> : null}
          </div>
        </div>
      )}
    </>
  );
}
