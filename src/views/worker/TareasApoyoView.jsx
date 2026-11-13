// #199: tareas que la principal deja a la persona de apoyo al cerrar su turno.
// La misma pantalla vale para la app de la plantilla y la de eventuales.
import { useState, useEffect, useCallback } from "react";
import { F, SF, C, btnDark } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

// Texto del recuadro «Pendiente» del inicio: «3 tareas que te ha dejado Valme · Ciérralas antes de las 16:30»
export function pendienteApoyo(lista) {
  const l = Array.isArray(lista) ? lista : [];
  const n = l.reduce((s, g) => s + (g.tareas || []).length, 0);
  if (!n) return null;
  const de = [...new Set(l.map(g => g.de).filter(Boolean))].join(" y ");
  const hora = l.map(g => g.plazo_hora).filter(Boolean).sort()[0];
  return { n, texto: `${n === 1 ? "1 tarea" : `${n} tareas`} que te ha dejado ${de}`, sub: hora ? `Ciérralas antes de las ${hora}` : "" };
}

function errorTexto(e) {
  const m = String((e && e.message) || "");
  const mm = m.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  try { if (mm) return JSON.parse('"' + mm[1] + '"'); } catch (x) { /* noop */ }
  return m || "No se ha podido guardar";
}

export function TareasApoyoView({ onTerminar }) {
  const [lista, setLista] = useState(null);
  const [estado, setEstado] = useState({});
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [hecho, setHecho] = useState(false);

  const cargar = useCallback(async () => {
    try { const r = await sb.rpc("mis_tareas_apoyo", {}); setLista(Array.isArray(r) ? r : []); } catch (e) { setLista([]); setMsg("No se han podido cargar las tareas. Comprueba la conexión."); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const todas = (lista || []).flatMap(g => g.tareas || []);
  const setEst = (id, v) => setEstado(s => ({ ...s, [id]: { ...(s[id] || { nota: "" }), estado: v } }));
  const setNota = (id, v) => setEstado(s => ({ ...s, [id]: { ...(s[id] || {}), nota: v } }));
  const revisadas = todas.filter(t => estado[t.id] && estado[t.id].estado).length;

  const cerrar = async () => {
    if (revisadas < todas.length) { setMsg(`Te faltan ${todas.length - revisadas} por marcar`); return; }
    if (todas.some(t => estado[t.id].estado === "no" && !(estado[t.id].nota || "").trim())) { setMsg("Indica el motivo de las tareas no hechas"); return; }
    setSaving(true); setMsg("");
    try {
      await sb.rpc("cerrar_tareas_apoyo", { p_items: todas.map(t => ({ id: t.id, hecha: estado[t.id].estado === "hecha", justificacion: estado[t.id].estado === "no" ? estado[t.id].nota.trim() : null })) });
      setHecho(true);
    } catch (e) { setMsg(errorTexto(e)); await cargar(); }
    setSaving(false);
  };

  const segBtn = (activo, tipo) => {
    const col = tipo === "hecha" ? C.grn : C.red;
    return { flex: 1, textAlign: "center", padding: "9px", borderRadius: 10, cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 700, border: `1.5px solid ${activo ? col : C.brd}`, background: activo ? col : "#fff", color: activo ? "#fff" : C.mut };
  };

  if (!lista) return <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 30 }}>Cargando…</div>;

  if (hecho) return (
    <div style={{ padding: 16, maxWidth: 540, margin: "0 auto" }}>
      <div style={{ background: "#E7F3EC", color: "#1E7A46", fontFamily: SF, fontSize: 17, borderRadius: 14, padding: 16, textAlign: "center", marginBottom: 14 }}>Tareas cerradas ✓</div>
      <button onClick={onTerminar} style={{ ...btnDark, fontSize: 16, padding: 15 }}>Volver al inicio</button>
    </div>
  );

  return (
    <div style={{ padding: 16, maxWidth: 540, margin: "0 auto" }}>
      {todas.length === 0 ? (
        <div style={{ background: "#fff", border: `1px dashed ${C.brd}`, borderRadius: 14, padding: 20, textAlign: "center", fontFamily: F, fontSize: 13.5, color: C.mut, lineHeight: 1.5 }}>
          {msg || "No tienes tareas que te hayan dejado, o ya ha pasado el plazo para cerrarlas."}
          <button onClick={onTerminar} style={{ ...btnDark, fontSize: 15, padding: 13, marginTop: 14 }}>Volver al inicio</button>
        </div>
      ) : (
        <>
          {lista.map(g => (
            <div key={g.cierre_id} style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: SF, fontSize: 17, color: C.char }}>Te las ha dejado {g.de}</div>
              <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, margin: "3px 0 12px", lineHeight: 1.4 }}>Turno de {g.turno} · ciérralas antes de las <b style={{ color: C.char }}>{g.plazo_hora}</b>. Después ya no se pueden marcar.</div>
              {(g.tareas || []).map(t => {
                const st = estado[t.id] || {}; const done = st.estado === "hecha", no = st.estado === "no";
                return (
                  <div key={t.id} style={{ background: "#fff", border: `1.5px solid ${no ? C.red : done ? "#BFE6CC" : C.brdL}`, borderRadius: 13, padding: "13px 14px", marginBottom: 9 }}>
                    <div style={{ fontFamily: F, fontSize: 14, color: C.char, fontWeight: 500, marginBottom: 10 }}>{t.texto}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setEst(t.id, "hecha")} style={segBtn(done, "hecha")}>Hecha</button>
                      <button onClick={() => setEst(t.id, "no")} style={segBtn(no, "no")}>No hecha</button>
                    </div>
                    {no && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: "#B23A2C", marginBottom: 8 }}>¿Por qué no se ha hecho?</div>
                        <input value={st.nota || ""} onChange={e => setNota(t.id, e.target.value)} placeholder="Escribe el motivo" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "#FBF4F3", border: "1px solid #EDC9C3", borderRadius: 10, fontFamily: F, fontSize: 12.5, color: "#B23A2C", outline: "none" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.red, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
          <button onClick={cerrar} disabled={saving} style={{ ...btnDark, fontSize: 17, padding: 16, opacity: saving ? 0.5 : 1 }}>{saving ? "Guardando…" : revisadas < todas.length ? `Cerrar tareas (faltan ${todas.length - revisadas})` : "Cerrar tareas"}</button>
        </>
      )}
    </div>
  );
}
