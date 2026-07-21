import { useState, useEffect, useCallback } from "react";
import { F, SF, C, btnDark } from "../../lib/styles.js";
import { IcoCheck } from "../../lib/icons.jsx";
import { sb } from "../../lib/supabase.js";
import { ymd } from "../../lib/turnos.js";

function isoDow(d) { const g = d.getDay(); return g === 0 ? 7 : g; }

export function CerrarTurnoView({ user }) {
  const hoy = new Date();
  const fecha = ymd(hoy);
  const dow = isoDow(hoy);
  const [turno, setTurno] = useState(hoy.getHours() < 15 ? "mañana" : "tarde");
  const [tareas, setTareas] = useState([]);
  const [estado, setEstado] = useState({});
  const [yaCerrado, setYaCerrado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setMsg("");
    try {
      const ex = await sb.select("cierres_turno", `select=id&usuario_id=eq.${user.id}&fecha=eq.${fecha}&turno=eq.${turno}`);
      if (ex[0]) {
        const items = await sb.select("cierre_items", `select=tarea_texto,hecha,justificacion&cierre_id=eq.${ex[0].id}`);
        setYaCerrado(items); setTareas([]); setLoading(false); return;
      }
      setYaCerrado(null);
      const all = await sb.select("cierre_tareas", `select=id,orden,texto,dia_semana,hora,grupo&turno=eq.${turno}&activa=eq.true&order=orden.asc`);
      const aplican = all.filter(t => t.dia_semana == null || t.dia_semana === dow);
      setTareas(aplican);
      const st = {}; aplican.forEach(t => { st[t.id] = { hecha: true, justificacion: "" }; });
      setEstado(st);
    } catch (e) { setMsg(e.message || "Error"); }
    setLoading(false);
  }, [user.id, fecha, turno, dow]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setEstado(s => ({ ...s, [id]: { ...s[id], hecha: !s[id].hecha } }));
  const setJust = (id, v) => setEstado(s => ({ ...s, [id]: { ...s[id], justificacion: v } }));

  const enviar = async () => {
    const faltan = tareas.filter(t => !estado[t.id].hecha && !estado[t.id].justificacion.trim());
    if (faltan.length) { setMsg("Justifica las tareas que no has hecho"); return; }
    setSaving(true); setMsg("");
    try {
      const cierre = await sb.insert("cierres_turno", { usuario_id: user.id, fecha, turno });
      const cid = cierre[0].id;
      const items = tareas.map(t => ({ cierre_id: cid, tarea_id: t.id, tarea_texto: t.texto, hecha: estado[t.id].hecha, justificacion: estado[t.id].hecha ? null : estado[t.id].justificacion.trim() }));
      await sb.insert("cierre_items", items);
      await load();
    } catch (e) { setMsg(e.message || "Error al enviar"); }
    setSaving(false);
  };

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, background: "#F0EBE1", padding: 4, borderRadius: 13, marginBottom: 14 }}>
        {["mañana", "tarde"].map(t => (
          <button key={t} onClick={() => setTurno(t)} style={{ flex: 1, textAlign: "center", padding: 9, borderRadius: 10, border: "none", cursor: "pointer", background: turno === t ? C.char : "transparent", color: turno === t ? C.gold : C.mut, fontFamily: F, fontWeight: 600, fontSize: 14, textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>

      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.red, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Cargando…</div>
        : yaCerrado ? (
          <div>
            <div style={{ background: "#E7F3EC", color: "#1E7A46", fontFamily: SF, fontSize: 16, borderRadius: 14, padding: 14, marginBottom: 14, textAlign: "center" }}>Turno cerrado ✓</div>
            {yaCerrado.map((it, i) => (
              <div key={i} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 13, padding: "11px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: it.hecha ? C.grn : "#FBEAE7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {it.hecha ? <IcoCheck size={15} color="#fff" sw={3} /> : <span style={{ color: "#B23A2C", fontSize: 13, fontWeight: 700 }}>✕</span>}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F, fontSize: 14, color: C.char }}>{it.tarea_texto}</div>
                  {!it.hecha && it.justificacion && <div style={{ fontFamily: F, fontSize: 12, color: "#B23A2C", marginTop: 3 }}>{it.justificacion}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {tareas.map(t => {
              const st = estado[t.id] || { hecha: true, justificacion: "" };
              return (
                <div key={t.id} style={{ background: "#fff", border: st.hecha ? `1px solid ${C.brdL}` : `1.5px solid ${C.red}`, borderRadius: 13, padding: "13px 14px", marginBottom: 9 }}>
                  <div onClick={() => toggle(t.id)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: st.hecha ? C.grn : "#fff", border: st.hecha ? "none" : `2px solid ${C.brd}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {st.hecha && <IcoCheck size={15} color="#fff" sw={3} />}
                    </span>
                    <span style={{ fontFamily: F, fontSize: 14, color: C.char, fontWeight: 500 }}>{t.texto}{t.hora ? <span style={{ color: C.mut, fontSize: 12 }}> · {t.hora}</span> : null}</span>
                  </div>
                  {!st.hecha && (
                    <input value={st.justificacion} onChange={e => setJust(t.id, e.target.value)} placeholder="¿Por qué no se hizo?" style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: "9px 12px", background: "#FBF4F3", border: "1px solid #EDC9C3", borderRadius: 10, fontFamily: F, fontSize: 12.5, color: "#B23A2C", outline: "none" }} />
                  )}
                </div>
              );
            })}
            <button onClick={enviar} disabled={saving || tareas.length === 0} style={{ ...btnDark, fontSize: 17, padding: 16, marginTop: 6, opacity: saving ? 0.6 : 1 }}>{saving ? "Enviando…" : "Cerrar turno"}</button>
          </div>
        )}
    </div>
  );
}
