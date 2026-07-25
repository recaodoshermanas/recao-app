import { useState, useEffect, useCallback } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const pad = (n) => String(n).padStart(2, "0");
function fmtDia(f) { if (!f) return ""; const p = f.split("-"); const d = new Date(f + "T00:00:00"); return `${DOW[d.getDay()]} ${p[2]}/${p[1]}`; }
function fmtH(n) { return Number(n).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " h"; }

const inpStyle = { width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 11, padding: "11px 13px", fontFamily: F, fontSize: 15, color: C.char, background: "#fff", outline: "none" };
const lblStyle = { fontFamily: F, fontSize: 12, fontWeight: 700, color: C.mut, margin: "14px 2px 6px", display: "block" };

export function HorasExtrasView() {
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fUsuario, setFUsuario] = useState("");
  const [fFecha, setFFecha] = useState("");
  const [fHoras, setFHoras] = useState("");
  const [fNota, setFNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2800); };

  const first = `${anio}-${pad(mes)}-01`;
  const lastDay = new Date(anio, mes, 0).getDate();
  const last = `${anio}-${pad(mes)}-${pad(lastDay)}`;

  const loadTrab = useCallback(async () => {
    try { const r = await sb.fn("gestion-usuarios", { action: "listar" }); setTrabajadoras((r.usuarios || []).filter(u => u.rol === "trabajadora" && u.activo)); } catch (e) { /* noop */ }
  }, []);
  const loadEntradas = useCallback(async () => {
    setLoading(true);
    try { const rows = await sb.select("horas_extras", `select=*&fecha=gte.${first}&fecha=lte.${last}&order=fecha.asc`); setEntradas(rows); } catch (e) { flash(e.message); }
    setLoading(false);
  }, [first, last]);
  useEffect(() => { loadTrab(); }, [loadTrab]);
  useEffect(() => { loadEntradas(); }, [loadEntradas]);

  const cambiarMes = (d) => { let m = mes + d, a = anio; if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; } setMes(m); setAnio(a); };
  const abrir = () => { setFUsuario(""); const h = new Date(); const dentro = (h.getFullYear() === anio && h.getMonth() + 1 === mes); setFFecha(dentro ? `${anio}-${pad(mes)}-${pad(h.getDate())}` : first); setFHoras(""); setFNota(""); setShowForm(true); };
  const guardar = async () => {
    if (!fUsuario) return flash("Elige una trabajadora");
    const h = parseFloat(String(fHoras).replace(",", "."));
    if (!(h > 0)) return flash("Indica las horas");
    if (!fFecha) return flash("Indica la fecha");
    setBusy(true);
    try { await sb.insert("horas_extras", { usuario_id: fUsuario, fecha: fFecha, horas: h, nota: fNota.trim() || null }); setShowForm(false); flash("Horas añadidas"); await loadEntradas(); }
    catch (e) { flash(e.message); }
    setBusy(false);
  };
  const eliminar = async (e) => { if (!window.confirm("¿Eliminar este registro?")) return; try { await sb.delete("horas_extras", `id=eq.${e.id}`); await loadEntradas(); } catch (err) { flash(err.message); } };

  const nombreDe = {}; trabajadoras.forEach(t => nombreDe[t.id] = t.nombre);
  const porPersona = {};
  entradas.forEach(e => { (porPersona[e.usuario_id] = porPersona[e.usuario_id] || []).push(e); });
  const personas = Object.keys(porPersona).map(uid => ({ uid, nombre: nombreDe[uid] || "—", items: porPersona[uid], total: porPersona[uid].reduce((s, x) => s + Number(x.horas), 0) })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const totalMes = entradas.reduce((s, x) => s + Number(x.horas), 0);

  const navBtn = { border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 20, color: C.char, lineHeight: 1 };

  return (
    <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={() => cambiarMes(-1)} style={navBtn}>‹</button>
        <div style={{ fontFamily: SF, fontSize: 18, color: C.char, textTransform: "capitalize" }}>{MESES[mes - 1]} {anio}</div>
        <button onClick={() => cambiarMes(1)} style={navBtn}>›</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.char, borderRadius: 14, padding: "13px 18px", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: F, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8A8070" }}>Total del mes</div>
          <div style={{ fontFamily: SF, fontSize: 23, color: C.gold, marginTop: 2 }}>{fmtH(totalMes)}</div>
        </div>
        <button onClick={abrir} style={{ background: C.gold, color: C.goldDark, border: "none", borderRadius: 11, padding: "10px 16px", fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Añadir</button>
      </div>

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : personas.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>No hay horas extras registradas este mes</div>
          : personas.map(p => (
            <div key={p.uid} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: "14px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: SF, fontSize: 16.5, color: C.char }}>{p.nombre}</span>
                <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: C.goldDark, background: "#F6E9CE", padding: "4px 11px", borderRadius: 999 }}>{fmtH(p.total)}</span>
              </div>
              {p.items.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${C.brdL}` }}>
                  <span style={{ fontFamily: F, fontSize: 13, color: C.mut, textTransform: "capitalize", width: 74, flexShrink: 0 }}>{fmtDia(e.fecha)}</span>
                  <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: C.char, width: 52, flexShrink: 0 }}>{fmtH(e.horas)}</span>
                  <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nota || ""}</span>
                  <button onClick={() => eliminar(e)} style={{ background: "none", border: "none", color: C.mutL, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 4px", flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          ))}

      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,18,15,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div onClick={ev => ev.stopPropagation()} style={{ width: "100%", maxWidth: 540, background: C.cream, borderRadius: "20px 20px 0 0", padding: "20px 18px 26px", boxSizing: "border-box" }}>
            <div style={{ fontFamily: SF, fontSize: 19, color: C.char, marginBottom: 4 }}>Añadir horas extras</div>
            <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>Se guardan en {MESES[mes - 1]} {anio}</div>
            <label style={lblStyle}>Trabajadora</label>
            <select value={fUsuario} onChange={e => setFUsuario(e.target.value)} style={inpStyle}>
              <option value="">Elige…</option>
              {trabajadoras.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <label style={lblStyle}>Fecha</label>
            <input type="date" value={fFecha} min={first} max={last} onChange={e => setFFecha(e.target.value)} style={inpStyle} />
            <label style={lblStyle}>Horas extra</label>
            <input type="number" inputMode="decimal" step="0.5" min="0" value={fHoras} onChange={e => setFHoras(e.target.value)} placeholder="Ej. 2,5" style={inpStyle} />
            <label style={lblStyle}>Motivo (opcional)</label>
            <input type="text" value={fNota} onChange={e => setFNota(e.target.value)} placeholder="Ej. cubrió a Ana el sábado" style={inpStyle} />
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: "#fff", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: 13, fontFamily: F, fontSize: 15, fontWeight: 600, color: C.mut, cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardar} disabled={busy} style={{ flex: 2, background: C.char, border: "none", borderRadius: 12, padding: 13, fontFamily: F, fontSize: 15, fontWeight: 700, color: C.gold, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
