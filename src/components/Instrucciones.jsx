import { useState, useEffect } from "react";
import { F, C } from "../lib/styles.js";
import { sb } from "../lib/supabase.js";

// #35 · «Instrucciones» arriba de cada pantalla de producto: cerradas por defecto, se despliegan al pulsar.
// El texto (un paso por línea) lo edita dirección en el panel: Producto → App de tienda.
let cacheInstr = null;
export function Instrucciones({ pantalla, sinMargen }) {
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState(cacheInstr);
  useEffect(() => {
    sb.select("producto_instrucciones", "select=pantalla,texto").then((r) => { cacheInstr = Object.fromEntries((r || []).map((x) => [x.pantalla, x.texto])); setLista(cacheInstr); }).catch(() => {});
  }, []);
  const pasos = String(lista?.[pantalla] ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (!pasos.length) return null;
  return (
    <div style={sinMargen ? { marginTop: -6 } : { maxWidth: 540, margin: "0 auto", padding: "10px 16px 0", boxSizing: "border-box" }}>
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: "6px 0", cursor: "pointer", fontFamily: F, fontSize: 14, fontWeight: 700, color: "#6B4A0C" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B4A0C" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: abierto ? "rotate(90deg)" : "none", transition: "transform .15s" }}><path d="M9 6l6 6-6 6" /></svg>
        Instrucciones
      </button>
      {abierto && (
        <ol style={{ margin: "4px 0 2px", padding: "12px 14px 12px 34px", background: "#FBF6EA", border: "1px solid #EFE3C4", borderRadius: 14, fontFamily: F, fontSize: 13.5, lineHeight: 1.45, color: C.char, display: "flex", flexDirection: "column", gap: 5 }}>
          {pasos.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      )}
    </div>
  );
}

