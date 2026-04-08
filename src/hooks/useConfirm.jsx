import { useState } from "react";
import { F, C } from "../lib/styles.js";

export function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (msg, onOk) => setState({ msg, onOk });
  const Dialog = () => state ? (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", padding: "28px", maxWidth: 340, width: "100%", textAlign: "center" }}>
        <p style={{ fontFamily: F, fontSize: "15px", color: C.char, marginBottom: "24px", lineHeight: 1.5 }}>{state.msg}</p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => setState(null)} style={{ flex: 1, padding: "12px", border: `1.5px solid ${C.brd}`, borderRadius: "10px", background: "none", fontFamily: F, fontSize: "14px", color: C.mut, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => { state.onOk(); setState(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: "10px", background: C.red, color: "#fff", fontFamily: F, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Confirmar</button>
        </div>
      </div>
    </div>
  ) : null;
  return { ask, Dialog };
}
