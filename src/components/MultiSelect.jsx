import { useState, useRef, useEffect } from "react";
import { F, C, inp } from "../lib/styles.js";

export function MultiSelect({ label, options, selected, onChange, placeholder = "Todos" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const display = selected.length === 0 ? placeholder : selected.length <= 2 ? selected.map(id => options.find(o => o.value === id)?.label || id).join(", ") : `${selected.length} seleccionados`;

  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: "140px" }}>
      {label && <div style={{ fontFamily: F, fontSize: "10px", fontWeight: 700, color: C.mut, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>}
      <button onClick={() => setOpen(!open)} style={{ ...inp, padding: "8px 12px", fontSize: "13px", cursor: "pointer", textAlign: "left", background: selected.length > 0 ? "#FFF9E6" : "#fff", borderColor: selected.length > 0 ? C.gold : C.brd, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display}</span>
        <span style={{ fontSize: "10px", marginLeft: "6px", color: C.mut }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: `1.5px solid ${C.brd}`, borderRadius: "10px", marginTop: "4px", zIndex: 100, maxHeight: "260px", overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          {options.length > 8 && (
            <div style={{ padding: "8px" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...inp, padding: "6px 10px", fontSize: "12px" }} />
            </div>
          )}
          <div style={{ maxHeight: "200px", overflowY: "auto", padding: "4px 0" }}>
            {selected.length > 0 && (
              <button onClick={() => { onChange([]); }} style={{ width: "100%", padding: "7px 12px", border: "none", background: "transparent", fontFamily: F, fontSize: "12px", color: C.red, cursor: "pointer", textAlign: "left" }}>
                ✕ Limpiar selección
              </button>
            )}
            {filtered.map(o => {
              const checked = selected.includes(o.value);
              return (
                <button key={o.value} onClick={() => { onChange(checked ? selected.filter(v => v !== o.value) : [...selected, o.value]); }} style={{ width: "100%", padding: "7px 12px", border: "none", background: checked ? "#FFF9E6" : "transparent", fontFamily: F, fontSize: "12px", color: C.char, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "16px", height: "16px", borderRadius: "4px", border: `1.5px solid ${checked ? C.gold : C.brd}`, background: checked ? C.gold : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#fff", flexShrink: 0 }}>{checked ? "✓" : ""}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: "12px", fontFamily: F, fontSize: "12px", color: C.mut, textAlign: "center" }}>Sin resultados</div>}
          </div>
        </div>
      )}
    </div>
  );
}
