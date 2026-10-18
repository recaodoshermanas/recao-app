import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { IcoLeft, IcoRight } from "../../lib/icons.jsx";
import { sb } from "../../lib/supabase.js";
import { TURNOS, ymd, NOTA_FINDE } from "../../lib/turnos.js";
import { BOLSA_ACTIVA } from "../../lib/bolsa.js"; // BOLSA
import { cargarFestivos, PLUS_FESTIVO_8H } from "../../lib/festivos.js"; // FESTIVOS

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DIAS = ["L","M","X","J","V","S","D"];
const navBtn = { border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

export function MiHorarioView({ user }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [mapa, setMapa] = useState({});
  const [pend, setPend] = useState({}); // BOLSA: fecha → true si es un descanso compensatorio pendiente
  const [fest, setFest] = useState({}); // FESTIVOS: fecha → { nombre, ambito }

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
    try { setFest(await cargarFestivos(desde, hasta)); } catch (e) { setFest({}); } // FESTIVOS
    if (BOLSA_ACTIVA) { // BOLSA
      try {
        const p = await sb.select("bolsa_turnos", `select=fecha&descanso_de=eq.${user.id}&estado=eq.abierto&fecha=gte.${desde}&fecha=lte.${hasta}`);
        const mp = {}; p.forEach(r => { mp[r.fecha] = true; }); setPend(mp);
      } catch (e) { setPend({}); }
    }
  }, [cursor, user.id]);
  useEffect(() => { load(); }, [load]);

  const startOffset = (first.getDay() + 6) % 7;
  const hoy = ymd(new Date());
  const usados = [...new Set(Object.values(mapa))];
  const hayPend = Object.keys(pend).length > 0;

  return (
    <div style={{ padding: "16px 14px", maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setCursor(c => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; })} style={navBtn}><IcoLeft size={18} color={C.char} sw={2.2} /></button>
        <div style={{ fontFamily: SF, fontSize: 19, color: C.char, textTransform: "capitalize" }}>{MESES[cursor.m]} {cursor.y}</div>
        <button onClick={() => setCursor(c => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m }; })} style={navBtn}><IcoRight size={18} color={C.char} sw={2.2} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
        {DIAS.map(d => <div key={d} style={{ textAlign: "center", fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mutL }}>{d}</div>)}
        {Array.from({ length: startOffset }).map((_, i) => <div key={"e" + i} />)}
        {days.map(d => {
          const f = ymd(d);
          const def = mapa[f] ? TURNOS[mapa[f]] : null;
          const esHoy = f === hoy;
          const esPend = !!pend[f];
          const esFest = fest[f];
          return (
            <div key={f} title={esPend ? "Descanso pendiente: lo trabajas hasta que alguien coja tu turno" : esFest ? `Festivo: ${esFest.nombre}` : undefined} style={{ position: "relative", aspectRatio: "1", border: esPend ? "2px dashed #E0B94A" : esHoy ? `2px solid ${C.char}` : `1px solid ${C.brdL}`, borderRadius: 12, background: def ? def.bg : "#fff", color: def ? def.fg : C.mutL, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 2 }}>
              {esFest && <span aria-label="Festivo" style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: 999, background: C.red }} />}
              <span style={{ fontFamily: F, fontSize: 12.5, fontWeight: 600, color: esFest && !def ? C.red : undefined }}>{d.getDate()}</span>
              {def && <span style={{ fontFamily: F, fontSize: 8.5, lineHeight: 1, marginTop: 2, textAlign: "center" }}>{def.label}</span>}
              {esPend && <span style={{ fontFamily: F, fontSize: 7.5, fontWeight: 700, lineHeight: 1, marginTop: 2, color: "#8A6410" }}>desc. pend.</span>}
            </div>
          );
        })}
      </div>

      {Object.keys(fest).length > 0 && ( // FESTIVOS
        <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: F, fontSize: 12.5, fontWeight: 700, color: C.char }}><span style={{ width: 8, height: 8, borderRadius: 999, background: C.red }} />Festivos de {MESES[cursor.m]}</div>
          {Object.values(fest).map((x) => (
            <div key={x.fecha} style={{ fontFamily: F, fontSize: 12.5, color: C.char, marginTop: 5 }}>
              <strong>{Number(x.fecha.slice(8))}</strong> · {x.nombre}{mapa[x.fecha] && TURNOS[mapa[x.fecha]]?.tipo !== "libre" ? <span style={{ color: C.mut }}> · trabajas ({mapa[x.fecha]})</span> : ""}
            </div>
          ))}
          <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 6, lineHeight: 1.4 }}>Si trabajas un festivo cobras {PLUS_FESTIVO_8H.toFixed(2).replace(".", ",")} € más por un turno de 8 h, y la parte proporcional si es más corto.</div>
        </div>
      )}

      {hayPend && (
        <div style={{ marginTop: 14, fontFamily: F, fontSize: 12.5, color: "#6A4A08", background: "#FFFBF0", border: "1.5px dashed #E0B94A", borderRadius: 12, padding: "10px 12px", lineHeight: 1.45 }}>
          <strong>Descanso pendiente:</strong> ese día te toca descansar, pero sigues apuntada hasta que una compañera coja tu turno en la bolsa.
        </div>
      )}

      {usados.length > 0 && (
        <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {usados.map(t => { const def = TURNOS[t]; if (!def) return null; return (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F, fontSize: 12, fontWeight: 600, color: C.char, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 999, padding: "6px 12px" }}>
              <span style={{ width: 14, height: 14, borderRadius: 5, background: def.bg }} />
              {def.label}{def.horas ? <span style={{ color: C.mutL, fontWeight: 400, marginLeft: 2 }}>{def.horas}</span> : ""}
            </div>
          ); })}
        </div>
      )}
      {usados.some(t => String(t).startsWith("Apoyo")) && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 8 }}>{NOTA_FINDE}</div>}
    </div>
  );
}
