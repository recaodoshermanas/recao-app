// Novedades del equipo: las 3 últimas que publica dirección, arriba del inicio de la app (plantilla y eventuales).
import { useEffect, useState } from "react";
import { F, SF, C } from "../lib/styles.js";
import { sb } from "../lib/supabase.js";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaCorta = (f) => { const d = new Date(`${String(f).slice(0, 10)}T12:00:00`); return `${d.getDate()} ${MESES[d.getMonth()]}`; };
const esNueva = (ts) => Date.now() - new Date(ts).getTime() < 7 * 24 * 3600 * 1000;

export function NovedadesEquipo({ estilo }) {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    let vivo = true;
    sb.rpc("mis_novedades").then((r) => { if (vivo) setLista(Array.isArray(r) ? r : []); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  if (!lista.length) return null;
  return (
    <section aria-label="Novedades del equipo" style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 18, padding: "14px 16px", ...estilo }}>
      <div style={{ fontFamily: F, fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>Novedades del equipo</div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {lista.map((n, i) => (
          <li key={n.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${C.brdL}` : "none" }}>
            <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 999, background: C.char, color: C.gold, fontFamily: SF, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: F, fontSize: 14.5, fontWeight: 700, color: C.char }}>{n.titulo}</span>
                {esNueva(n.creado_en) && <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em", color: "#fff", background: C.red, borderRadius: 999, padding: "2px 8px" }}>NUEVO</span>}
              </div>
              <div style={{ fontFamily: F, fontSize: 13.5, color: C.char, lineHeight: 1.45, marginTop: 2 }}>{n.texto}</div>
              <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 4 }}>Desde el {fechaCorta(n.desde)}{n.tema ? ` · ${n.tema}` : ""}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
