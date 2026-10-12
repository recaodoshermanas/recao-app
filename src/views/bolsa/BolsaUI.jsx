// Piezas visuales compartidas por las pantallas de la bolsa
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { TURNOS } from "../../lib/turnos.js";
import { bloqueFecha, plazo } from "../../lib/bolsa.js";

export const card = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 18, padding: 14, display: "flex", alignItems: "center", gap: 14, boxShadow: SHADOW.card };
export const seccion = { fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutL, margin: "4px 2px 0" };
export const btnNo = { flex: 1, minHeight: 44, border: `1.5px solid ${C.brd}`, borderRadius: 12, background: "#fff", fontFamily: F, fontSize: 14.5, fontWeight: 600, color: C.char, cursor: "pointer" };
export const btnSi = { flex: 1.4, minHeight: 44, border: "none", borderRadius: 12, background: C.gold, fontFamily: F, fontSize: 14.5, fontWeight: 700, color: C.goldDark, cursor: "pointer" };
export const btnTexto = { minHeight: 44, border: "none", background: "transparent", fontFamily: F, fontSize: 15, fontWeight: 600, color: C.char, cursor: "pointer" };

export function ShiftChip({ turno }) {
  const d = TURNOS[turno]; if (!d) return null;
  return <span style={{ alignSelf: "flex-start", fontFamily: F, fontSize: 12, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: d.bg, color: d.fg }}>{turno}</span>;
}

export function DateBlock({ f }) {
  const b = bloqueFecha(f);
  return (
    <div style={{ width: 50, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.06em" }}>{b.dia}</span>
      <span style={{ fontFamily: SF, fontSize: 28, color: C.char, lineHeight: 1.05 }}>{b.num}</span>
      <span style={{ fontFamily: F, fontSize: 11.5, color: C.mut }}>{b.mes}</span>
    </div>
  );
}

export function PlazoChip({ f }) {
  const p = plazo(f);
  return <span style={{ alignSelf: "flex-start", flexShrink: 0, padding: "4px 9px", borderRadius: 999, fontFamily: F, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", background: p.urgente ? "#FBEAE7" : "#F3EEE4", color: p.urgente ? "#B23A2C" : C.mut }}>{p.txt}</span>;
}

export function Toast({ texto }) {
  if (!texto) return null;
  return <div role="status" style={{ position: "fixed", left: 16, right: 16, bottom: 24, maxWidth: 508, margin: "0 auto", background: C.char, color: C.gold, borderRadius: 14, padding: "13px 16px", fontFamily: F, fontSize: 14, fontWeight: 600, textAlign: "center", zIndex: 60 }}>{texto}</div>;
}

export function Hoja({ etiqueta, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(44,44,44,.5)", zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div role="dialog" aria-modal="true" aria-label={etiqueta} style={{ background: "#fff", borderRadius: "22px 22px 0 0", padding: "12px 22px 30px", maxWidth: 540, width: "100%", boxSizing: "border-box", margin: "0 auto", display: "flex", flexDirection: "column", gap: 14, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: C.brd, alignSelf: "center" }} />
        {children}
      </div>
    </div>
  );
}

export function Fila({ etiqueta, children }) {
  return (
    <div style={{ display: "flex", gap: 10, fontFamily: F, fontSize: 13.5, lineHeight: 1.45 }}>
      <span style={{ width: 118, flexShrink: 0, color: C.mut }}>{etiqueta}</span>
      <span style={{ fontWeight: 600, color: C.char }}>{children}</span>
    </div>
  );
}

// Interruptor "email + app / solo app"
export function PreferenciaAvisos({ email, onChange }) {
  return (
    <div style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
      <div style={{ fontFamily: SF, fontSize: 17, color: C.char }}>Cómo quieres los avisos</div>
      <div style={{ fontFamily: F, fontSize: 13, color: C.mut, lineHeight: 1.45 }}>Te mandamos un resumen al día con los turnos nuevos y un aviso si alguno se queda sin cubrir.</div>
      <div role="group" aria-label="Avisos" style={{ display: "flex", gap: 6, background: "#F3EEE4", borderRadius: 12, padding: 4 }}>
        {[[true, "Email y app"], [false, "Solo en la app"]].map(([v, l]) => (
          <button key={l} onClick={() => onChange(v)} aria-pressed={email === v} style={{ flex: 1, minHeight: 40, border: "none", borderRadius: 9, cursor: "pointer", fontFamily: F, fontSize: 13.5, fontWeight: 700, background: email === v ? C.char : "transparent", color: email === v ? C.gold : C.mut }}>{l}</button>
        ))}
      </div>
    </div>
  );
}
