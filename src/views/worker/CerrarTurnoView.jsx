import { useState, useEffect, useCallback } from "react";
import { F, SF, C, inp } from "../../lib/styles.js";
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

  const TurnoSel = () => (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {["mañana", "tarde"].map(t => (
        <button key={t} onClick={() => setTurno(t)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1.5px solid ${turno === t ? C.char : C.brd}`, background: turno === t ? C.char : "#fff", color: turno === t ? C.gold : C.mut, fontFamily: F, fontSize: 14, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>{t}</button>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      <TurnoSel />
      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.red, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Cargando…</div>
        : yaCerrado ? (
          <div>
            <div style={{ background: "#E1F5EE", color: "#0F6E56", fontFamily: SF, fontSize: 16, borderRadius: 12, padding: 14, marginBottom: 14, textAlign: "center" }}>Turno cerrado ✓</div>
            {yaCerrado.map((it, i) => (
              <div key={i} style={{ background: "#fff", border: `1px solid ${C.brd}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ fontFamily: F, fontSize: 14, color: C.char, display: "flex", justifyContent: "space-between" }}>
                  <span>{it.tarea_texto}</span><span>{it.hecha ? "✓" : "—"}</span>
                </div>
                {!it.hecha && it.justificacion && <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 4 }}>Motivo: {it.justificacion}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div>
            {tareas.map(t => {
              const st = estado[t.id] || { hecha: true, justificacion: "" };
              return (
                <div key={t.id} style={{ background: "#fff", border: `1px solid ${C.brd}`, borderRadius: 10, padding: "12px", marginBottom: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={st.hecha} onChange={() => toggle(t.id)} style={{ width: 20, height: 20, accentColor: C.grn, flexShrink: 0 }} />
                    <span style={{ fontFamily: F, fontSize: 14, color: C.char, textDecoration: st.hecha ? "none" : "none" }}>
                      {t.texto}{t.hora ? <span style={{ color: C.mut, fontSize: 12 }}> · {t.hora}</span> : null}
                    </span>
                  </label>
                  {!st.hecha && (
                    <input value={st.justificacion} onChange={e => setJust(t.id, e.target.value)} placeholder="¿Por qué no se hizo?" style={{ ...inp, marginTop: 10, marginBottom: 0, fontSize: 13, border: `1.5px solid ${C.red}` }} />
                  )}
                </div>
              );
            })}
            <button onClick={enviar} disabled={saving || tareas.length === 0} style={{ width: "100%", padding: 15, border: "none", borderRadius: 12, background: C.char, color: C.gold, fontFamily: SF, fontSize: 16, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1, marginTop: 6 }}>{saving ? "Enviando…" : "Cerrar turno"}</button>
          </div>
        )}
    </div>
  );
}
