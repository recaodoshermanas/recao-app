// #242: la principal del turno que lleva a una trabajadora nueva en formación.
// AcogidaHoy: bloque en su inicio («Hoy llevas a…»), solo el día y solo a ella.
// AcogidaParte: los dos bloques que le salen dentro del cierre de turno (lo que ha contestado la nueva y lo que ve ella).
// Los guiones y «Lo que llevamos» son los mismos que en el panel (src/lib/acogida.js).
import { useState, useEffect } from "react";
import { F, SF, C } from "../lib/styles.js";
import { sb } from "../lib/supabase.js";
import { txtDia, guionDia, loQueLlevamos, nombreCorto, COMO, PREG_FIJAS } from "../lib/acogida.js";

const diaDe = (x) => (x.dias || []).find((d) => d.fecha === x.fecha) || null;
const sinComillas = (s) => String(s || "").replace(/[«»]/g, "");

export function AcogidaHoy({ estilo }) {
  const [lista, setLista] = useState(null);
  const [abierto, setAbierto] = useState({});
  useEffect(() => {
    sb.rpc("acogida_mi_dia", {}).then((r) => setLista(Array.isArray(r) ? r : [])).catch(() => setLista([]));
  }, []);
  if (!lista || !lista.length) return null;
  return lista.map((x) => {
    const d = diaDe(x);
    if (!d) return null;
    const T = txtDia(d.n);
    const L = loQueLlevamos(x, d);
    const g = guionDia(x, d);
    const completo = !!abierto[x.acogida_id];
    const resumen = g.split("\n\n").slice(1, 3).join("\n\n");
    const amar = { fontFamily: F, fontSize: 13, color: C.gold, lineHeight: 1.5 };
    return (
      <div key={x.acogida_id} style={{ background: C.char, borderRadius: 18, padding: "15px 16px", marginTop: 12, ...estilo }}>
        <div style={{ fontFamily: SF, fontSize: 19, color: "#fff" }}>Hoy llevas a {nombreCorto(x.nombre)}</div>
        <div style={{ fontFamily: F, fontSize: 12.5, color: C.gold, fontWeight: 700, marginTop: 2 }}>Día {d.n} de {(x.dias || []).length} · {T.tit}</div>
        {L && L.hayAlgo && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #4A4A4A" }}>
            <div style={{ ...amar, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Lo que llevamos</div>
            <div style={amar}>· Sigue sin entender: {L.no ? <>{L.no.texto} ({L.no.dias}){L.no.insiste && <b> · lleva dos días con esto</b>}</> : "sin apuntar"}</div>
            <div style={amar}>· Pidió para hoy: {L.pide || "sin apuntar"}</div>
            <div style={amar}>· Cómo ha ido: {L.hist.map((h) => `Día ${h.n} ${h.como ? COMO[h.como].toLowerCase() : "sin parte"}`).join(" → ")}</div>
            {L.consejo && <div style={{ ...amar, fontWeight: 700 }}>· {L.consejo}</div>}
          </div>
        )}
        <div style={{ fontFamily: F, fontSize: 13.5, color: "#EDE7DC", lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 10 }}>{completo ? g : resumen}</div>
        <button onClick={() => setAbierto((a) => ({ ...a, [x.acogida_id]: !completo }))} style={{ marginTop: 10, background: "none", border: "none", padding: 0, color: C.gold, fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{completo ? "Ver menos" : "Ver el guion completo →"}</button>
        <div style={{ fontFamily: F, fontSize: 11.5, color: "#9a927f", marginTop: 8, lineHeight: 1.4 }}>Al cerrar tu turno te pedirá lo que te diga {nombreCorto(x.nombre)} y cómo la ves.</div>
      </div>
    );
  });
}

// Cierre de turno: dos bloques por cada trabajadora nueva que lleva hoy
export function AcogidaParte({ item, valor, onChange, falta }) {
  const d = diaDe(item);
  if (!d) return null;
  const T = txtDia(d.n);
  const v = valor || {};
  const set = (k, val) => onChange({ ...v, [k]: val });
  const n = nombreCorto(item.nombre);
  const grp = { fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.mutL, margin: "18px 2px 10px" };
  const caja = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 13, padding: "13px 14px", marginBottom: 9 };
  const preg = { fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char, marginBottom: 6 };
  const area = (k, ph, req) => (
    <textarea value={v[k] || ""} onChange={(e) => set(k, e.target.value.slice(0, 500))} rows={2} placeholder={ph}
      style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1.5px solid ${req && falta && !(v[k] || "").trim() ? C.red : C.brd}`, borderRadius: 11, fontFamily: F, fontSize: 14, color: C.char, background: "#fff", outline: "none", resize: "vertical", marginBottom: 12 }} />
  );
  const toque = (k, op) => (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      {op.map(([val, txt]) => {
        const on = v[k] === val;
        return <button key={val} type="button" onClick={() => set(k, on ? null : val)} style={{ flex: 1, padding: "10px 6px", borderRadius: 10, cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 700, border: `1.5px solid ${on ? C.char : C.brd}`, background: on ? C.char : "#fff", color: on ? C.gold : C.mut }}>{txt}</button>;
      })}
    </div>
  );
  return (
    <div>
      <div style={grp}>Acogida de {n} · día {d.n}</div>
      <div style={caja}>
        <div style={{ fontFamily: SF, fontSize: 17, color: C.char, marginBottom: 4 }}>Pregúntale y apunta lo que diga</div>
        <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, lineHeight: 1.4, marginBottom: 12 }}>Con sus palabras. Sirve para ayudarla mañana, no para ponerle nota.</div>
        <div style={preg}>1 · {sinComillas(PREG_FIJAS[0])} <span style={{ color: C.red }}>*</span></div>
        {area("no", "Escribe lo que te diga. Si de verdad dice que nada, escribe «nada, todo claro»", true)}
        {falta && !(v.no || "").trim() && <div style={{ fontFamily: F, fontSize: 12.5, color: C.red, margin: "-6px 0 12px" }}>Este es obligatorio: es lo que verá mañana la compañera que la lleve.</div>}
        <div style={preg}>2 · {sinComillas(PREG_FIJAS[1])}</div>
        {area("necesita", "Escribe lo que te diga")}
        <div style={preg}>3 · {T.preg}</div>
        {area("dia", "Escribe lo que te diga")}
      </div>
      <div style={caja}>
        <div style={{ fontFamily: SF, fontSize: 17, color: C.char, marginBottom: 10 }}>Y lo que ves tú</div>
        <div style={preg}>¿Cómo ha ido hoy?</div>
        {toque("como", [["suelta", "Se ha soltado"], ["remolque", "Ha ido a remolque"]])}
        <div style={preg}>¿La ves lista para mañana?</div>
        {toque("lista", [["si", "Sí"], ["casi", "Casi"], ["no", "No"]])}
        <div style={preg}>¿Algo más? <span style={{ color: C.mutL, fontWeight: 500 }}>(opcional)</span></div>
        {area("mas", "Lo que le ha costado más…")}
      </div>
    </div>
  );
}

// Guarda el parte de cada acogida antes de cerrar el turno
export async function guardarPartes(lista, partes) {
  for (const x of lista) {
    const v = partes[x.acogida_id] || {};
    await sb.rpc("acogida_guardar_parte", { p_acogida: x.acogida_id, p_fecha: x.fecha, p_no_entendido: (v.no || "").trim(), p_necesita: v.necesita || null, p_pregunta_dia: v.dia || null, p_como: v.como || null, p_lista: v.lista || null, p_algo_mas: v.mas || null });
  }
}
export const faltaParte = (lista, partes) => lista.find((x) => !((partes[x.acogida_id] || {}).no || "").trim()) || null;
