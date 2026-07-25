import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, btnDark } from "../lib/styles.js";
import { IcoLeft, IcoRight } from "../lib/icons.jsx";
import { sb } from "../lib/supabase.js";
import { TURNOS, ymd } from "../lib/turnos.js";
import { esTrabajo } from "../lib/vacaciones.js";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const navBtn = { border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

export function VacacionesPicker({ usuarioId, maxDias, submitLabel = "Enviar solicitud", onSubmit, onCancel }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [mapa, setMapa] = useState({});
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const hoy = ymd(new Date());
  const cap = maxDias == null ? Infinity : maxDias;

  const load = useCallback(async () => {
    const desde = ymd(new Date(cursor.y, cursor.m, 1));
    const hasta = ymd(new Date(cursor.y, cursor.m + 1, 0));
    try { const rows = await sb.select("horarios", `select=fecha,turno&usuario_id=eq.${usuarioId}&fecha=gte.${desde}&fecha=lte.${hasta}`); const m = {}; rows.forEach(r => { m[r.fecha] = r.turno; }); setMapa(m); }
    catch (e) { setMapa({}); }
  }, [cursor, usuarioId]);
  useEffect(() => { load(); }, [load]);

  const dias = useMemo(() => { const last = new Date(cursor.y, cursor.m + 1, 0).getDate(); const out = []; for (let d = 1; d <= last; d++) out.push(new Date(cursor.y, cursor.m, d)); return out; }, [cursor]);
  const startOffset = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2200); };
  const toggle = (f, turno) => {
    if (f < hoy || !esTrabajo(turno)) return;
    setSel(prev => {
      const n = new Set(prev);
      if (n.has(f)) { n.delete(f); return n; }
      if (n.size >= cap) { flash(cap <= 0 ? "No te quedan días disponibles" : `Solo te quedan ${cap} días`); return n; }
      n.add(f); return n;
    });
  };

  const enviar = async () => { if (sel.size === 0 || busy) return; setBusy(true); try { await onSubmit([...sel].sort()); } catch (e) { flash(e.message || "Error"); } setBusy(false); };

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 18, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setCursor(c => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; })} style={navBtn}><IcoLeft size={16} color={C.char} sw={2.2} /></button>
        <div style={{ fontFamily: SF, fontSize: 16, color: C.char, textTransform: "capitalize" }}>{MESES[cursor.m]} {cursor.y}</div>
        <button onClick={() => setCursor(c => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m }; })} style={navBtn}><IcoRight size={16} color={C.char} sw={2.2} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {DIAS.map(d => <div key={d} style={{ textAlign: "center", fontFamily: F, fontSize: 10.5, fontWeight: 700, color: C.mutL }}>{d}</div>)}
        {Array.from({ length: startOffset }).map((_, i) => <div key={"e" + i} />)}
        {dias.map(d => {
          const f = ymd(d);
          const turno = mapa[f];
          const def = turno ? TURNOS[turno] : null;
          const trabaja = esTrabajo(turno);
          const past = f < hoy;
          const selected = sel.has(f);
          const selectable = trabaja && !past;
          let bg = "#fff", fg = C.mutL, border = `1px solid ${C.brdL}`, extra = null;
          if (selected) { bg = C.gold; fg = "#402300"; border = `2px solid ${C.char}`; extra = "✓"; }
          else if (turno === "Vacaciones") { bg = "#d6f3f3"; fg = "#0d6d6d"; }
          else if (def && def.tipo === "libre") { bg = "#EFEFF0"; fg = "#9a9a9a"; }
          else if (trabaja) { bg = def.bg; fg = def.fg; }
          return (
            <button key={f} onClick={() => toggle(f, turno)} disabled={!selectable && !selected} style={{ aspectRatio: "1", border, borderRadius: 10, background: bg, color: fg, cursor: selectable || selected ? "pointer" : "default", opacity: past ? 0.4 : 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F, padding: 0 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{d.getDate()}</span>
              {extra ? <span style={{ fontSize: 10, lineHeight: 1, marginTop: 1 }}>{extra}</span> : (def && trabaja ? <span style={{ fontSize: 7.5, lineHeight: 1, marginTop: 1 }}>{def.label}</span> : null)}
            </button>
          );
        })}
      </div>

      <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, marginTop: 10 }}>Toca los días de trabajo que quieres coger de vacaciones. Tus descansos no cuentan.</div>
      {msg && <div style={{ fontFamily: F, fontSize: 12.5, color: C.red, marginTop: 8, textAlign: "center" }}>{msg}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
        <div style={{ fontFamily: F, fontSize: 13, color: C.mut, flex: 1 }}>
          <b style={{ fontFamily: SF, fontSize: 18, color: C.char }}>{sel.size}</b> {sel.size === 1 ? "día" : "días"}{maxDias != null ? ` · quedan ${Math.max(0, cap - sel.size)}` : ""}
        </div>
        {onCancel && <button onClick={onCancel} style={{ background: "#fff", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: "0 16px", height: 42, fontFamily: F, fontSize: 13, fontWeight: 600, color: C.mut, cursor: "pointer" }}>Cancelar</button>}
        <button onClick={enviar} disabled={sel.size === 0 || busy} style={{ ...btnDark, width: "auto", padding: "0 22px", height: 42, fontSize: 15, opacity: sel.size === 0 || busy ? 0.5 : 1 }}>{busy ? "…" : submitLabel}</button>
      </div>
    </div>
  );
}
