import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { TURNOS, ymd } from "../../lib/turnos.js";

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DIAS = ["L","M","X","J","V","S","D"];
const navBtn = { border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 8, width: 38, height: 38, fontSize: 18, color: C.char, cursor: "pointer" };

export function MiHorarioView({ user }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [mapa, setMapa] = useState({});

  const { first, days } = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const last = new Date(cursor.y, cursor.m + 1, 0);
    const days = [];
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(cursor.y, cursor.m, d));
    return { first, days };
  }, [cursor]);

  const load = useCallback(async () => {
    const desde = ymd(new Date(cursor.y, cursor.m, 1));
    const hasta = ymd(new Date(cursor.y, cursor.m + 1, 0));
    try {
      const rows = await sb.select("horarios", `select=fecha,turno&usuario_id=eq.${user.id}&fecha=gte.${desde}&fecha=lte.${hasta}`);
      const m = {}; rows.forEach(r => { m[r.fecha] = r.turno; }); setMapa(m);
    } catch (e) { setMapa({}); }
  }, [cursor, user.id]);
  useEffect(() => { load(); }, [load]);

  const startOffset = (first.getDay() + 6) % 7;
  const hoy = ymd(new Date());
  const usados = [...new Set(Object.values(mapa))];

  return (
    <div style={{ padding: "14px", maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={() => setCursor(c => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; })} style={navBtn}>‹</button>
        <div style={{ fontFamily: SF, fontSize: 18, color: C.char, textTransform: "capitalize" }}>{MESES[cursor.m]} {cursor.y}</div>
        <button onClick={() => setCursor(c => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m }; })} style={navBtn}>›</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {DIAS.map(d => <div key={d} style={{ textAlign: "center", fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mut }}>{d}</div>)}
        {Array.from({ length: startOffset }).map((_, i) => <div key={"e" + i} />)}
        {days.map(d => {
          const f = ymd(d);
          const def = mapa[f] ? TURNOS[mapa[f]] : null;
          const esHoy = f === hoy;
          return (
            <div key={f} style={{ aspectRatio: "1", border: esHoy ? `2px solid ${C.char}` : `1px solid ${C.brd}`, borderRadius: 8, background: def ? def.bg : "#fff", color: def ? def.fg : C.mut, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 2 }}>
              <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600 }}>{d.getDate()}</span>
              {def && <span style={{ fontFamily: F, fontSize: 8.5, lineHeight: 1, marginTop: 2, textAlign: "center" }}>{def.label}</span>}
            </div>
          );
        })}
      </div>

      {usados.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {usados.map(t => { const def = TURNOS[t]; if (!def) return null; return (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 11.5, color: C.mut }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: def.bg, border: `1px solid ${C.brd}` }} />
              {def.label}{def.horas ? ` ${def.horas}` : ""}
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
