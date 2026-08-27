import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { ymd } from "../../lib/turnos.js";

const PROPIETARIOS = ["Migue", "Pablo", "Javi", "Adrian"];
const ESTADOS = [
  { id: "pendiente", label: "Por hacer", bg: "#F0EADF", fg: "#7A6A3F" },
  { id: "en_curso", label: "En curso", bg: "#E7EEF7", fg: "#3D6AA5" },
  { id: "hecha", label: "Hecha", bg: "#E7F3EC", fg: "#1E7A46" },
];
const PRIORIDADES = [
  { id: "alta", label: "Alta", color: "#C44D3F" },
  { id: "media", label: "Media", color: "#D89A2E" },
  { id: "baja", label: "Baja", color: "#8AA0B5" },
];
const estadoDe = (id) => ESTADOS.find(e => e.id === id) || ESTADOS[0];
const prioridadDe = (id) => PRIORIDADES.find(p => p.id === id) || PRIORIDADES[1];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fmtDia(f) { if (!f) return ""; const p = f.split("-"); const d = new Date(f + "T00:00:00"); return `${DOW[d.getDay()]} ${p[2]}/${p[1]}`; }
const HOY = ymd(new Date());

function Ini({ nombre, size = 22 }) {
  const bg = { Migue: "#4A7AB5", Pablo: "#2D8B4E", Javi: "#8B6DAF", Adrian: "#C44D3F" }[nombre] || "#8A8070";
  return <span title={nombre} style={{ width: size, height: size, borderRadius: 999, background: bg, color: "#fff", fontFamily: F, fontSize: size * 0.42, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{nombre.charAt(0)}</span>;
}
function EstadoChip({ id }) { const e = estadoDe(id); return <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: e.bg, color: e.fg }}>{e.label}</span>; }

export function TareasAdminView() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("lista");
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fProp, setFProp] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fArea, setFArea] = useState("");
  const [cal, setCal] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selDay, setSelDay] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await sb.select("tareas_admin", "select=*&order=creado_en.desc"); setTasks(r || []); } catch (e) { /* noop */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const areas = useMemo(() => [...new Set(tasks.map(t => t.area).filter(Boolean))].sort(), [tasks]);

  const base = useMemo(() => tasks.filter(t =>
    (!fProp || (t.propietarios || []).includes(fProp)) && (!fArea || t.area === fArea)
  ), [tasks, fProp, fArea]);
  const listaTasks = useMemo(() => {
    const arr = base.filter(t => !fEstado || t.estado === fEstado);
    return [...arr].sort((a, b) => (a.fecha_fin || "9999").localeCompare(b.fecha_fin || "9999"));
  }, [base, fEstado]);

  const nuevo = () => setEdit({ titulo: "", descripcion: "", propietarios: [], estado: "pendiente", prioridad: "media", area: "", fecha_inicio: "", fecha_fin: "" });
  const abrir = (t) => setEdit({ ...t, propietarios: t.propietarios || [], descripcion: t.descripcion || "", area: t.area || "", fecha_inicio: t.fecha_inicio || "", fecha_fin: t.fecha_fin || "" });

  const guardar = async () => {
    if (!edit.titulo.trim()) return;
    setBusy(true);
    const payload = {
      titulo: edit.titulo.trim(), descripcion: edit.descripcion.trim() || null,
      propietarios: edit.propietarios, estado: edit.estado, prioridad: edit.prioridad,
      area: edit.area.trim() || null, fecha_inicio: edit.fecha_inicio || null, fecha_fin: edit.fecha_fin || null,
      actualizado_en: new Date().toISOString(),
    };
    try {
      if (edit.id) await sb.update("tareas_admin", `id=eq.${edit.id}`, payload);
      else await sb.insert("tareas_admin", payload);
      setEdit(null); await load();
    } catch (e) { /* noop */ }
    setBusy(false);
  };
  const borrar = async () => {
    if (!edit.id || !window.confirm("¿Eliminar esta tarea?")) return;
    setBusy(true);
    try { await sb.delete("tareas_admin", `id=eq.${edit.id}`); setEdit(null); await load(); } catch (e) { /* noop */ }
    setBusy(false);
  };

  const sel = { flex: 1, minWidth: 0, border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "8px 10px", fontFamily: F, fontSize: 12.5, color: C.char, background: "#fff", outline: "none" };
  const filtrosPA = (
    <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
      <select value={fProp} onChange={e => setFProp(e.target.value)} style={sel}><option value="">Todos</option>{PROPIETARIOS.map(p => <option key={p} value={p}>{p}</option>)}</select>
      <select value={fArea} onChange={e => setFArea(e.target.value)} style={sel}><option value="">Área</option>{areas.map(a => <option key={a} value={a}>{a}</option>)}</select>
    </div>
  );

  const TarjetaMini = ({ t, onClick }) => {
    const vencida = t.fecha_fin && t.fecha_fin < HOY && t.estado !== "hecha";
    return (
      <button onClick={onClick} style={{ width: "100%", boxSizing: "border-box", textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderLeft: `3px solid ${prioridadDe(t.prioridad).color}`, borderRadius: 12, padding: "11px 12px", marginBottom: 8, cursor: "pointer", boxShadow: SHADOW.card }}>
        <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.char, lineHeight: 1.3 }}>{t.titulo}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {(t.propietarios || []).map(n => <Ini key={n} nombre={n} size={20} />)}
          {t.area && <span style={{ fontFamily: F, fontSize: 10.5, color: C.mut, background: "#FAF7F2", borderRadius: 6, padding: "2px 6px" }}>{t.area}</span>}
          {t.fecha_fin && <span style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: vencida ? C.red : C.mut, marginLeft: "auto" }}>{fmtDia(t.fecha_fin)}</span>}
        </div>
      </button>
    );
  };

  const Lista = () => (
    <div>
      <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
        <select value={fProp} onChange={e => setFProp(e.target.value)} style={sel}><option value="">Todos</option>{PROPIETARIOS.map(p => <option key={p} value={p}>{p}</option>)}</select>
        <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={sel}><option value="">Estado</option>{ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
        <select value={fArea} onChange={e => setFArea(e.target.value)} style={sel}><option value="">Área</option>{areas.map(a => <option key={a} value={a}>{a}</option>)}</select>
      </div>
      {listaTasks.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 26 }}>No hay tareas.</div>
        : listaTasks.map(t => (
          <button key={t.id} onClick={() => abrir(t)} style={{ width: "100%", boxSizing: "border-box", textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: 14, marginBottom: 9, cursor: "pointer", boxShadow: SHADOW.card }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: prioridadDe(t.prioridad).color, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F, fontSize: 14.5, fontWeight: 600, color: t.estado === "hecha" ? C.mutL : C.char, textDecoration: t.estado === "hecha" ? "line-through" : "none" }}>{t.titulo}</div>
                {t.descripcion && <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 3, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{t.descripcion}</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                  <EstadoChip id={t.estado} />
                  {(t.propietarios || []).map(n => <Ini key={n} nombre={n} size={21} />)}
                  {t.area && <span style={{ fontFamily: F, fontSize: 11, color: C.mut, background: "#FAF7F2", borderRadius: 7, padding: "2px 8px" }}>{t.area}</span>}
                  {t.fecha_fin && <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: (t.fecha_fin < HOY && t.estado !== "hecha") ? C.red : C.mut, marginLeft: "auto" }}>{fmtDia(t.fecha_fin)}</span>}
                </div>
              </div>
            </div>
          </button>
        ))}
    </div>
  );

  const Tablero = () => (
    <div>
      {filtrosPA}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
        {ESTADOS.map(col => {
          const items = base.filter(t => t.estado === col.id);
          return (
            <div key={col.id} style={{ minWidth: 250, width: 250, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9, padding: "0 2px" }}>
                <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700 }}><EstadoChip id={col.id} /></span>
                <span style={{ fontFamily: F, fontSize: 12, color: C.mutL, fontWeight: 600 }}>{items.length}</span>
              </div>
              {items.length === 0 ? <div style={{ fontFamily: F, fontSize: 12, color: C.mutL, textAlign: "center", padding: "18px 0", border: `1.5px dashed ${C.brdL}`, borderRadius: 12 }}>—</div>
                : items.map(t => <TarjetaMini key={t.id} t={t} onClick={() => abrir(t)} />)}
            </div>
          );
        })}
      </div>
    </div>
  );

  const Calendario = () => {
    const first = new Date(cal.getFullYear(), cal.getMonth(), 1);
    const off = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(1 - off);
    const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
    const byDay = {}; base.forEach(t => { if (t.fecha_fin) (byDay[t.fecha_fin] = byDay[t.fecha_fin] || []).push(t); });
    const mover = (n) => { setSelDay(null); setCal(new Date(cal.getFullYear(), cal.getMonth() + n, 1)); };
    const selTasks = selDay ? (byDay[selDay] || []) : [];
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => mover(-1)} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 9, width: 34, height: 34, cursor: "pointer", fontSize: 16, color: C.char }}>‹</button>
          <span style={{ fontFamily: SF, fontSize: 17, color: C.char, textTransform: "capitalize" }}>{MESES[cal.getMonth()]} {cal.getFullYear()}</span>
          <button onClick={() => mover(1)} style={{ border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 9, width: 34, height: 34, cursor: "pointer", fontSize: 16, color: C.char }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
          {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => <div key={i} style={{ textAlign: "center", fontFamily: F, fontSize: 10.5, fontWeight: 700, color: C.mutL, padding: "2px 0" }}>{d}</div>)}
          {cells.map((d, i) => {
            const k = ymd(d); const esMes = d.getMonth() === cal.getMonth(); const items = byDay[k] || []; const esHoy = k === HOY;
            return (
              <button key={i} onClick={() => setSelDay(items.length ? k : null)} style={{ minHeight: 52, background: selDay === k ? "#FBF4E6" : "#fff", border: `1px solid ${esHoy ? C.gold : C.brdL}`, borderRadius: 9, padding: 4, cursor: items.length ? "pointer" : "default", textAlign: "left", opacity: esMes ? 1 : 0.4, overflow: "hidden" }}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: esHoy ? 800 : 600, color: esHoy ? C.goldSub : C.char }}>{d.getDate()}</div>
                {items.slice(0, 2).map(t => <div key={t.id} style={{ fontFamily: F, fontSize: 9, color: "#fff", background: estadoDe(t.estado).fg, borderRadius: 4, padding: "1px 3px", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.titulo}</div>)}
                {items.length > 2 && <div style={{ fontFamily: F, fontSize: 9, color: C.mut, marginTop: 1 }}>+{items.length - 2}</div>}
              </button>
            );
          })}
        </div>
        {selDay && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.mutL, marginBottom: 8 }}>{fmtDia(selDay)}</div>
            {selTasks.map(t => <TarjetaMini key={t.id} t={t} onClick={() => abrir(t)} />)}
          </div>
        )}
      </div>
    );
  };

  const Timeline = () => {
    const withDates = base.filter(t => t.fecha_fin || t.fecha_inicio);
    const sinFechas = base.filter(t => !t.fecha_fin && !t.fecha_inicio);
    if (withDates.length === 0) return (
      <div>{filtrosPA}<div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 26 }}>No hay tareas con fechas para el timeline.</div>
        {sinFechas.map(t => <TarjetaMini key={t.id} t={t} onClick={() => abrir(t)} />)}</div>
    );
    const dayMs = 86400000;
    const toMs = (s) => new Date(s + "T00:00:00").getTime();
    const rows = withDates.map(t => { const s = toMs(t.fecha_inicio || t.fecha_fin); const e = toMs(t.fecha_fin || t.fecha_inicio); return { t, sd: Math.min(s, e), ed: Math.max(s, e) }; });
    const todayMs = toMs(HOY);
    let min = Math.min(todayMs, ...rows.map(r => r.sd)) - 3 * dayMs;
    let max = Math.max(todayMs, ...rows.map(r => r.ed)) + 3 * dayMs;
    const totalDays = Math.round((max - min) / dayMs) + 1;
    const pxDay = 26, leftW = 106, rowH = 34, headH = 24;
    const trackW = totalDays * pxDay;
    const xOf = (ms) => Math.round((ms - min) / dayMs) * pxDay;
    const marks = [];
    for (let i = 0; i < totalDays; i++) { const d = new Date(min + i * dayMs); if (((d.getDay() + 6) % 7) === 0) marks.push({ x: i * pxDay, label: `${d.getDate()}/${d.getMonth() + 1}` }); }
    const todayX = xOf(todayMs);
    rows.sort((a, b) => a.sd - b.sd);
    return (
      <div>
        {filtrosPA}
        <div style={{ overflowX: "auto", border: `1px solid ${C.brdL}`, borderRadius: 14, background: "#fff" }}>
          <div style={{ position: "relative", width: leftW + trackW, minWidth: "100%" }}>
            <div style={{ display: "flex", height: headH, borderBottom: `1px solid ${C.brdL}` }}>
              <div style={{ width: leftW, flexShrink: 0, position: "sticky", left: 0, background: "#fff", zIndex: 3, borderRight: `1px solid ${C.brdL}` }} />
              <div style={{ position: "relative", width: trackW }}>
                {marks.map((m, i) => <span key={i} style={{ position: "absolute", left: m.x + 3, top: 6, fontFamily: F, fontSize: 9.5, color: C.mutL, whiteSpace: "nowrap" }}>{m.label}</span>)}
              </div>
            </div>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: leftW + todayX, width: 2, background: C.gold, zIndex: 2, pointerEvents: "none" }} />
            {marks.map((m, i) => <div key={i} style={{ position: "absolute", top: headH, bottom: 0, left: leftW + m.x, width: 1, background: C.brdL, opacity: 0.5, zIndex: 0 }} />)}
            {rows.map(({ t, sd, ed }) => {
              const x = xOf(sd); const w = Math.max(pxDay - 4, xOf(ed) - xOf(sd) + pxDay - 4); const col = estadoDe(t.estado).fg;
              return (
                <div key={t.id} style={{ display: "flex", height: rowH, alignItems: "center", borderBottom: `1px solid ${C.brdL}` }}>
                  <button onClick={() => abrir(t)} style={{ width: leftW, flexShrink: 0, position: "sticky", left: 0, background: "#fff", zIndex: 1, borderRight: `1px solid ${C.brdL}`, borderTop: "none", borderBottom: "none", borderLeft: "none", textAlign: "left", padding: "0 8px", cursor: "pointer", height: "100%", fontFamily: F, fontSize: 11.5, fontWeight: 600, color: C.char, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.titulo}</button>
                  <div style={{ position: "relative", width: trackW, height: "100%" }}>
                    <button onClick={() => abrir(t)} title={t.titulo} style={{ position: "absolute", left: x + 2, top: 7, height: rowH - 15, width: w, background: col, opacity: t.estado === "hecha" ? 0.5 : 1, border: "none", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: "0 5px", overflow: "hidden" }}>
                      {(t.propietarios || []).slice(0, 3).map(n => <span key={n} style={{ fontFamily: F, fontSize: 9, fontWeight: 800, color: "#fff" }}>{n.charAt(0)}</span>)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontFamily: F, fontSize: 11, color: C.mut }}><span style={{ width: 14, height: 2, background: C.gold, display: "inline-block" }} /> Hoy · desliza la tabla para ver más fechas</div>
        {sinFechas.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 8 }}>Sin fechas</div>
            {sinFechas.map(t => <TarjetaMini key={t.id} t={t} onClick={() => abrir(t)} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: "16px", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={nuevo} style={{ background: C.char, color: C.gold, border: "none", borderRadius: 11, padding: "10px 16px", fontFamily: F, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>+ Nueva tarea</button>
      </div>
      <div style={{ display: "flex", gap: 4, background: "#EFE9DD", borderRadius: 11, padding: 3, marginBottom: 14 }}>
        {[["lista", "Lista"], ["tablero", "Tablero"], ["calendario", "Calendario"], ["timeline", "Timeline"]].map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)} style={{ flex: 1, padding: "7px 3px", borderRadius: 8, border: "none", background: vista === v ? "#fff" : "transparent", color: vista === v ? C.char : C.mut, fontFamily: F, fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: vista === v ? SHADOW.card : "none" }}>{l}</button>
        ))}
      </div>

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 26 }}>Cargando…</div>
        : vista === "lista" ? <Lista /> : vista === "tablero" ? <Tablero /> : vista === "calendario" ? <Calendario /> : <Timeline />}

      {edit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.45)", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setEdit(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.cream, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "18px 18px 26px" }}>
            <div style={{ width: 40, height: 4, background: C.brd, borderRadius: 999, margin: "0 auto 16px" }} />
            <input value={edit.titulo} onChange={e => setEdit({ ...edit, titulo: e.target.value })} placeholder="Título de la tarea" style={{ width: "100%", boxSizing: "border-box", border: "none", background: "transparent", fontFamily: SF, fontSize: 20, color: C.char, outline: "none", marginBottom: 6 }} />
            <textarea value={edit.descripcion} onChange={e => setEdit({ ...edit, descripcion: e.target.value })} placeholder="Descripción (opcional)" rows={2} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: "10px 12px", fontFamily: F, fontSize: 14, color: C.char, outline: "none", resize: "vertical", marginBottom: 14, background: "#fff" }} />

            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 7 }}>Propietarios</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
              {PROPIETARIOS.map(n => { const on = edit.propietarios.includes(n); return (
                <button key={n} onClick={() => setEdit({ ...edit, propietarios: on ? edit.propietarios.filter(x => x !== n) : [...edit.propietarios, n] })} style={{ display: "flex", alignItems: "center", gap: 7, background: on ? "#fff" : "transparent", border: `1.5px solid ${on ? C.char : C.brd}`, borderRadius: 999, padding: "5px 12px 5px 5px", cursor: "pointer" }}>
                  <Ini nombre={n} size={22} /><span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: on ? C.char : C.mut }}>{n}</span>
                </button>
              ); })}
            </div>

            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 7 }}>Estado</div>
            <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
              {ESTADOS.map(e => { const on = edit.estado === e.id; return <button key={e.id} onClick={() => setEdit({ ...edit, estado: e.id })} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1.5px solid ${on ? e.fg : C.brd}`, background: on ? e.bg : "#fff", color: on ? e.fg : C.mut, fontFamily: F, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{e.label}</button>; })}
            </div>

            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 7 }}>Prioridad</div>
            <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
              {PRIORIDADES.map(p => { const on = edit.prioridad === p.id; return <button key={p.id} onClick={() => setEdit({ ...edit, prioridad: p.id })} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1.5px solid ${on ? p.color : C.brd}`, background: on ? p.color : "#fff", color: on ? "#fff" : C.mut, fontFamily: F, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{p.label}</button>; })}
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 7 }}>Inicio</div>
                <input type="date" value={edit.fecha_inicio} onChange={e => setEdit({ ...edit, fecha_inicio: e.target.value })} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "9px 11px", fontFamily: F, fontSize: 13.5, color: C.char, background: "#fff", outline: "none" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 7 }}>Fecha límite</div>
                <input type="date" value={edit.fecha_fin} onChange={e => setEdit({ ...edit, fecha_fin: e.target.value })} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "9px 11px", fontFamily: F, fontSize: 13.5, color: C.char, background: "#fff", outline: "none" }} />
              </div>
            </div>

            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 7 }}>Área de trabajo</div>
            <input list="areas-list" value={edit.area} onChange={e => setEdit({ ...edit, area: e.target.value })} placeholder="Ej: Tienda, Proveedores, Personal…" style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "9px 11px", fontFamily: F, fontSize: 14, color: C.char, background: "#fff", outline: "none", marginBottom: 18 }} />
            <datalist id="areas-list">{areas.map(a => <option key={a} value={a} />)}</datalist>

            <button onClick={guardar} disabled={busy || !edit.titulo.trim()} style={{ width: "100%", boxSizing: "border-box", background: C.char, color: C.gold, border: "none", borderRadius: 13, padding: 15, fontFamily: SF, fontSize: 16, cursor: "pointer", opacity: (busy || !edit.titulo.trim()) ? 0.5 : 1 }}>{busy ? "Guardando…" : (edit.id ? "Guardar cambios" : "Crear tarea")}</button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <button onClick={() => setEdit(null)} style={{ background: "none", border: "none", color: C.mut, fontFamily: F, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              {edit.id && <button onClick={borrar} style={{ background: "none", border: "none", color: C.red, fontFamily: F, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Eliminar</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
