import { useState, useEffect, useCallback } from "react";
import { F, C } from "../lib/styles.js";
import { sb } from "../lib/supabase.js";

function fmt(s) { if (!s) return ""; const p = s.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; }

export function FechasCerradas() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [et, setEt] = useState(""); const [ini, setIni] = useState(""); const [fin, setFin] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setItems(await sb.select("vacaciones_cerrado", "select=*&order=fecha_inicio.asc")); } catch (e) { /* noop */ } }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!ini || !fin) return; setBusy(true);
    try { await sb.insert("vacaciones_cerrado", { etiqueta: et.trim() || "Semana Santa", fecha_inicio: ini, fecha_fin: fin }); setEt(""); setIni(""); setFin(""); setOpen(false); await load(); } catch (e) { /* noop */ }
    setBusy(false);
  };
  const del = async (id) => { if (!window.confirm("¿Quitar este periodo cerrado?")) return; try { await sb.delete("vacaciones_cerrado", `id=eq.${id}`); await load(); } catch (e) { /* noop */ } };
  const inp = { border: `1.5px solid ${C.brd}`, borderRadius: 9, padding: "8px 10px", fontFamily: F, fontSize: 13, color: C.char, background: "#fff", outline: "none" };
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: 14, marginBottom: 18 }}>
      <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginBottom: 8, lineHeight: 1.45 }}>Periodos en los que no se conceden vacaciones. <b style={{ color: C.char }}>Navidad y Reyes (24/12–6/1)</b> está fijo. Añade aquí la Semana Santa de cada año.</div>
      {items.map(c => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${C.brdL}` }}>
          <div style={{ fontFamily: F, fontSize: 13, color: C.char }}><b>{c.etiqueta}</b> · {fmt(c.fecha_inicio)} – {fmt(c.fecha_fin)}</div>
          <button onClick={() => del(c.id)} style={{ background: "none", border: "none", color: C.mutL, cursor: "pointer", fontSize: 13, fontFamily: F }}>Quitar</button>
        </div>
      ))}
      {open ? (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={et} onChange={e => setEt(e.target.value)} placeholder="Etiqueta (ej: Semana Santa 2027)" style={inp} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><div style={{ fontFamily: F, fontSize: 11, color: C.mutL, marginBottom: 3 }}>Desde</div><input type="date" value={ini} onChange={e => setIni(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
            <div style={{ flex: 1 }}><div style={{ fontFamily: F, fontSize: 11, color: C.mutL, marginBottom: 3 }}>Hasta</div><input type="date" value={fin} onChange={e => setFin(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box" }} /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={add} disabled={busy || !ini || !fin} style={{ background: C.char, color: C.gold, border: "none", borderRadius: 10, padding: "9px 16px", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (busy || !ini || !fin) ? 0.5 : 1 }}>Añadir</button>
            <button onClick={() => setOpen(false)} style={{ background: "#fff", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "9px 14px", fontFamily: F, fontSize: 13, color: C.mut, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      ) : <button onClick={() => setOpen(true)} style={{ marginTop: 10, background: "#fff", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "8px 14px", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, cursor: "pointer" }}>+ Añadir Semana Santa</button>}
    </div>
  );
}
