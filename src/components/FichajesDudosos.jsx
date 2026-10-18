// Inicio de la app: aviso con los fichajes dudosos de los últimos 14 días que la trabajadora puede revisar.
// Desaparece en cuanto pide la corrección de ese día (o dirección lo corrige).
import { useEffect, useState } from "react";
import { F, SF, C } from "../lib/styles.js";
import { sb } from "../lib/supabase.js";
import { IcoRight } from "../lib/icons.jsx";

export const MOTIVO_FICHAJE = { sin_fichaje: "No fichaste", sin_salida: "Falta la salida", cero: "Fichaje de 0 minutos", larga: "Fichaje demasiado largo", tarde: "Entrada después de la hora", exceso: "Salida después de la hora" };
const dia = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

export function FichajesDudosos({ onRevisar, estilo }) {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    let vivo = true;
    sb.rpc("mis_fichajes_dudosos").then((r) => { if (vivo) setLista(Array.isArray(r) ? r : []); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  if (!lista.length) return null;
  const n = lista.length;
  return (
    <button type="button" onClick={() => onRevisar(lista[0].fecha.slice(0, 7))} style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", textAlign: "left", background: "#FFF7E3", border: "1.5px solid #E0B94A", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, ...estilo }}>
      <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 999, background: "#E0B94A", color: "#4A3206", fontFamily: SF, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: F, fontSize: 14.5, fontWeight: 700, color: "#4A3206" }}>{n === 1 ? "Tienes un fichaje que revisar" : `Tienes ${n} fichajes que revisar`}</span>
        {lista.slice(0, 2).map((x) => (
          <span key={x.fecha} style={{ display: "block", fontFamily: F, fontSize: 12.5, color: "#6A4A08", marginTop: 3, textTransform: "none" }}>
            <b style={{ textTransform: "capitalize" }}>{dia(x.fecha)}</b> · {(x.incidencias || []).map((i) => MOTIVO_FICHAJE[i] || i).join(", ")}
          </span>
        ))}
        {n > 2 && <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: "#6A4A08", marginTop: 3 }}>y {n - 2} más</span>}
        <span style={{ display: "block", fontFamily: F, fontSize: 12, color: C.mut, marginTop: 5 }}>Si está mal, pide que lo corrijan desde Mis fichajes.</span>
      </span>
      <IcoRight size={18} color="#8A6410" sw={2.4} />
    </button>
  );
}
