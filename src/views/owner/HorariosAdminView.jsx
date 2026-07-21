import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { IcoLeft, IcoRight } from "../../lib/icons.jsx";
import { sb } from "../../lib/supabase.js";
import { TURNOS, TURNO_OPCIONES, ymd } from "../../lib/turnos.js";

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DIAS = ["L","M","X","J","V","S","D"];
const navBtn = { border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

export function HorariosAdminView() {
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [uid, setUid] = useState("");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [mapa, setMapa] = useState({});
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await sb.fn("gestion-usuarios", { action: "listar" });
        const tr = (r.usuarios || []).filter(u => u.rol === "trabajadora" && u.activo);
        setTrabajadoras(tr);
        if (tr[0]) setUid(tr[0].id);
      } catch (e) { /* noop */ }
    })();
  }, []);

  const { first, days } = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const last = new Date(cursor.y, cursor.m + 1, 0);
    const days = [];
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(cursor.y, cursor.m, d));
    return { first, days };
  }, [cursor]);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    const desde = ymd(new Date(cursor.y, cursor.m, 1));
    const hasta = ymd(new Date(cursor.y, cursor.m + 1, 0));
    try {
      const rows = await sb.select("horarios", `select=fecha,turno&usuario_id=eq.${uid}&fecha=gte.${desde}&fecha=lte.${hasta}`);
      const m = {}; rows.forEach(r => { m[r.fecha] = r.turno; });
      setMapa(m);
    } catch (e) { setMapa({}); }
    setLoading(false);
  }, [uid, cursor]);

  useEffect(() => { load(); }, [load]);

  const setTurno = async (fecha, turno) => {
    setPicker(null);
    setMapa(prev => ({ ...prev, [fecha]: turno }));
    try { await sb.upsert("horarios", { usuario_id: uid, fecha, turno }, "usuario_id,fecha"); }
    catch (e) { load(); }
  };

  const startOffset = (first.getDay() + 6) % 7;
  const hoy = ymd(new Date());

  return (
    <div style={{ padding: "16px 14px", maxWidth: 640, margin: "0 auto" }}>
      <select value={uid} onChange={e => setUid(e.target.value)} style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: `1.5px solid ${C.brd}`, fontFamily: F, fontSize: 15, background: "#fff", color: C.char, marginBottom: 14, boxSizing: "border-box" }}>
        {trabajadoras.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
      </select>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setCursor(c => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; })} style={navBtn}><IcoLeft size={18} color={C.char} sw={2.2} /></button>
        <div style={{ fontFamily: SF, fontSize: 19, color: C.char, textTransform: "capitalize" }}>{MESES[cursor.m]} {cursor.y}</div>
        <button onClick={() => setCursor(c => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m }; })} style={navBtn}><IcoRight size={18} color={C.char} sw={2.2} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
        {DIAS.map(d => <div key={d} style={{ textAlign: "center", fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mutL, padding: "2px 0" }}>{d}</div>)}
        {Array.from({ length: startOffset }).map((_, i) => <div key={"e" + i} />)}
        {days.map(d => {
          const f = ymd(d);
          const turno = mapa[f];
          const def = turno ? TURNOS[turno] : null;
          const esHoy = f === hoy;
          return (
            <button key={f} onClick={() => setPicker(f)} style={{ aspectRatio: "1", border: esHoy ? `2px solid ${C.char}` : `1px solid ${C.brdL}`, borderRadius: 12, background: def ? def.bg : "#fff", color: def ? def.fg : C.mutL, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 2, fontFamily: F }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{d.getDate()}</span>
              {def && <span style={{ fontSize: 8.5, lineHeight: 1, marginTop: 2, textAlign: "center" }}>{def.label}</span>}
            </button>
          );
        })}
      </div>

      {loading && <div style={{ fontFamily: F, fontSize: 12, color: C.mut, textAlign: "center", marginTop: 10 }}>Cargando…</div>}

      {picker && (
        <div onClick={() => setPicker(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 640 }}>
            <div style={{ fontFamily: SF, fontSize: 17, color: C.char, marginBottom: 14 }}>{picker}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 9 }}>
              {TURNO_OPCIONES.map(t => {
                const def = TURNOS[t];
                return (
                  <button key={t} onClick={() => setTurno(picker, t)} style={{ padding: "13px", borderRadius: 13, border: `1px solid ${C.brdL}`, background: def.bg, color: def.fg, fontFamily: F, fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                    {def.label}{def.horas ? <div style={{ fontSize: 10.5, fontWeight: 400, marginTop: 2 }}>{def.horas}</div> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
