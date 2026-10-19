// Novedades del equipo: las 3 últimas que publica dirección, arriba del inicio de la app (plantilla y eventuales).
// En la app de la plantilla va en modo compacto: las nuevas (menos de 7 días) completas y las demás en una línea, con «Ver todo».
import { useEffect, useState } from "react";
import { F, SF, C } from "../lib/styles.js";
import { sb } from "../lib/supabase.js";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaCorta = (f) => { const d = new Date(`${String(f).slice(0, 10)}T12:00:00`); return `${d.getDate()} ${MESES[d.getMonth()]}`; };
const esNueva = (ts) => Date.now() - new Date(ts).getTime() < 7 * 24 * 3600 * 1000;
const IcoPin = ({ size = 16, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4L7 10l-1.5 1.5 7 7L14 17l1.5-4 4-4" /><path d="M9 15l-4.5 4.5" /><path d="M14.5 4L20 9.5" /></svg>;
const chipNuevo = { fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em", color: "#fff", background: C.red, borderRadius: 999, padding: "2px 8px" };

function Completa({ n, numero }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: F, fontSize: 14.5, fontWeight: 700, color: C.char }}>{numero}{n.titulo}</span>
        {esNueva(n.creado_en) && <span style={chipNuevo}>NUEVO</span>}
      </div>
      <div style={{ fontFamily: F, fontSize: 13.5, color: C.char, lineHeight: 1.45, marginTop: 2 }}>{n.texto}</div>
      <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 4 }}>Desde el {fechaCorta(n.desde)}{n.tema ? ` · ${n.tema}` : ""}</div>
    </div>
  );
}

export function NovedadesEquipo({ estilo, compacta = false }) {
  const [lista, setLista] = useState([]);
  const [todo, setTodo] = useState(false);
  useEffect(() => {
    let vivo = true;
    sb.rpc("mis_novedades").then((r) => { if (vivo) setLista(Array.isArray(r) ? r : []); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  if (!lista.length) return null;

  if (compacta) {
    const nuevas = lista.filter((n) => esNueva(n.creado_en));
    const viejas = lista.filter((n) => !esNueva(n.creado_en));
    const abiertas = todo ? lista : nuevas;
    const cerradas = todo ? [] : viejas;
    return (
      <section aria-label="Novedades del equipo" style={{ background: "#fff", border: "1.5px solid #E0B94A", borderRadius: 18, padding: "13px 16px", ...estilo }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, color: C.goldSub }}>
          <IcoPin />
          <span style={{ flex: 1, fontFamily: SF, fontSize: 17, color: C.char }}>Novedades</span>
          {viejas.length > 0 && <button type="button" onClick={() => setTodo(!todo)} style={{ background: "none", border: "none", padding: "4px 0", cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 700, color: C.goldSub }}>{todo ? "Ver menos" : "Ver todo"}</button>}
        </div>
        {abiertas.map((n, i) => <div key={n.id} style={{ paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0, borderTop: i ? `1px solid ${C.brdL}` : "none" }}><Completa n={n} /></div>)}
        {cerradas.length > 0 && (
          <div style={{ borderTop: abiertas.length ? `1px solid ${C.brdL}` : "none", marginTop: abiertas.length ? 10 : 0, paddingTop: abiertas.length ? 9 : 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {cerradas.map((n) => (
              <button key={n.id} type="button" onClick={() => setTodo(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: F, fontSize: 13, color: C.char, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>· {n.titulo}</button>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Novedades del equipo" style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 18, padding: "14px 16px", ...estilo }}>
      <div style={{ fontFamily: F, fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>Novedades del equipo</div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {lista.map((n, i) => (
          <li key={n.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${C.brdL}` : "none" }}>
            <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 999, background: C.char, color: C.gold, fontFamily: SF, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}><Completa n={n} /></div>
          </li>
        ))}
      </ol>
    </section>
  );
}
