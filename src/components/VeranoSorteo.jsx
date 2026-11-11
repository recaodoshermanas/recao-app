// Mis vacaciones · Sorteo de verano (#184): de qué número saldrá el sorteo y, cuando dirección publica el cuadro,
// el bloque que le ha tocado, el número de origen, el reparto completo y cómo se ha calculado (para poder comprobarlo).
import { useEffect, useState } from "react";
import { F, SF, C } from "../lib/styles.js";
import { sb } from "../lib/supabase.js";

const dm = (s) => { if (!s) return ""; const d = new Date(String(s).slice(0, 10) + "T12:00:00"); return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }); };
const caja = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: "13px 15px", marginBottom: 12 };
const sub = { fontFamily: F, fontSize: 12.5, color: C.mut, lineHeight: 1.45 };

export function VeranoSorteo() {
  const [d, setD] = useState(null);
  const [ver, setVer] = useState(false);
  useEffect(() => { sb.rpc("vac_verano_resultado").then((r) => setD(Array.isArray(r) ? r : [])).catch(() => setD([])); }, []);
  if (!d || !d.length) return null;
  return (
    <>
      {d.map((x) => !x.publicado ? (
        <div key={x.ventana_id} style={caja}>
          <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700, color: C.char }}>Sorteo de los bloques de verano {x.anio}</div>
          <div style={{ ...sub, marginTop: 3 }}>Si coincidís varias en el mismo bloque, se sortea con el número de: <b>{x.fuente}</b>{x.fecha_sorteo ? <> ({dm(x.fecha_sorteo)})</> : null}. Con el mismo número sale siempre el mismo resultado, y podrás comprobarlo tú misma.</div>
        </div>
      ) : (
        <div key={x.ventana_id} style={{ ...caja, border: "1.5px solid #48c7c9" }}>
          <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#0d6d6d" }}>Tu bloque de verano {x.anio}</div>
          {x.mio && x.mio.bloque
            ? <div style={{ fontFamily: SF, fontSize: 22, color: C.char, margin: "4px 0 2px" }}>Bloque {x.mio.bloque}: {dm(x.mio.ini)} – {dm(x.mio.fin)}</div>
            : <div style={{ fontFamily: F, fontSize: 14, color: C.char, margin: "4px 0 2px" }}>No tienes bloque asignado. Habla con dirección.</div>}
          <div style={sub}>Ya está en el calendario como vacaciones aprobadas (14 días). Sorteo con el número <b>{x.numero}</b>{x.fuente ? <> ({x.fuente})</> : null}.</div>
          <button onClick={() => setVer(!ver)} style={{ marginTop: 8, background: "none", border: "none", padding: 0, fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, textDecoration: "underline", cursor: "pointer" }}>{ver ? "Ocultar el reparto" : "Ver el reparto completo y cómo se ha hecho"}</button>
          {ver && (
            <div style={{ marginTop: 8 }}>
              {(x.reparto || []).slice().sort((a, b) => (a.bloque || 99) - (b.bloque || 99)).map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: F, fontSize: 13, padding: "5px 0", borderTop: i ? `1px solid ${C.brdL}` : "none" }}>
                  <span><b>{r.bloque ? `B${r.bloque}` : "–"}</b> {r.ini ? `${dm(r.ini)} – ${dm(r.fin)}` : ""}</span><span>{r.nombre}</span>
                </div>
              ))}
              {(x.pasos || []).length > 0 && <div style={{ ...sub, marginTop: 8 }}>{x.pasos.map((p, i) => <div key={i} style={{ marginTop: 4 }}>• {p.texto}</div>)}</div>}
              <div style={{ ...sub, marginTop: 8 }}>
                Cómo comprobarlo: en cualquier calculadora «SHA-256» de internet escribe «{x.numero}|{x.anio}|número de bloque|nombre completo» (por ejemplo «{x.numero}|{x.anio}|3|{x.mio?.nombre || "Nombre Apellido"}»). En cada empate gana la huella más baja. Quien no consiguió su bloque principal el año anterior gana el empate sin sortear. Lo que queda libre se reparte por el orden de «{x.numero}|{x.anio}|orden|nombre»: primero quien presentó y después quien no.
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
