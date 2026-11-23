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
  // #222: las tareas que piden hora (Limpieza del suelo) la traen puesta al marcar «Hecha»
  const ahoraHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const setHora = (id, v) => setEstado(s => ({ ...s, [id]: { ...(s[id] || {}), hora: v } }));
  const marcarHecha = (t) => setEstado(s => ({ ...s, [t.id]: { ...(s[t.id] || { nota: "" }), estado: "hecha", hora: (s[t.id] && s[t.id].hora) || (t.pide_hora ? ahoraHM() : "") } }));
  // #223: paqueterías de «Picar paquetería» (Hecha: las picadas; A medias: Picada / Falta / No vino)
  const setPaq = (id, nombre, v) => setEstado(s => { const p = { ...((s[id] && s[id].paq) || {}) }; if (p[nombre] === v) delete p[nombre]; else p[nombre] = v; return { ...s, [id]: { ...(s[id] || { nota: "" }), paq: p } }; });
  const paqDe = (t) => t.paqueterias || [];
  const paqResumen = (t, st) => { const p = (st && st.paq) || {}, l = paqDe(t); const pic = l.filter(n => p[n] === "picada"), fal = l.filter(n => p[n] === "falta"); return `Picadas: ${pic.join(", ") || "—"} · Falta por picar: ${fal.join(", ") || "—"}`; };
  const paqError = (t, st) => {
    const l = paqDe(t); if (!l.length || !st) return null; const p = st.paq || {};
    if (st.estado === "hecha") return l.some(n => p[n] === "picada") ? null : "Marca al menos una paquetería";
    if (st.estado === "medias") {
      if (l.some(n => !p[n])) return "Marca cada paquetería: Picada, Falta o No vino";
      if (!l.some(n => p[n] === "picada") || !l.some(n => p[n] === "falta")) return "A medias necesita al menos una picada y una que falte";
    }
    return null;
  };
  const paqItems = (t, st) => { const l = paqDe(t); if (!l.length || (st.estado !== "hecha" && st.estado !== "medias")) return null; const p = st.paq || {}; return l.map(n => ({ nombre: n, estado: st.estado === "hecha" ? (p[n] === "picada" ? "picada" : "no_vino") : p[n] })); };
  const notaDe = (t, st) => st.estado === "medias" && paqDe(t).length ? paqResumen(t, st) : (st.nota || "").trim();
  const revisadas = todas.filter(t => estado[t.id] && estado[t.id].estado).length;

  const cerrar = async () => {
    if (revisadas < todas.length) { setMsg(`Te faltan ${todas.length - revisadas} por marcar`); return; }
    const conPaq = todas.map(t => paqError(t, estado[t.id])).find(Boolean); // #223
    if (conPaq) { setMsg(conPaq); return; }
    if (todas.some(t => estado[t.id].estado !== "hecha" && !notaDe(t, estado[t.id]))) { setMsg("Indica el motivo de las tareas a medias o no hechas"); return; }
    const conHora = todas.filter(t => t.pide_hora && estado[t.id].estado === "hecha");
    if (conHora.some(t => !(estado[t.id].hora || "").trim())) { setMsg("Pon la hora a la que se limpió"); return; }
    if (conHora.some(t => estado[t.id].hora < "07:00" || estado[t.id].hora > "23:00")) { setMsg("La hora tiene que estar entre las 7:00 y las 23:00"); return; }
    setSaving(true); setMsg("");
    try {
      // #201: tres estados. «A medias» aquí no pasa a nadie: lo valora dirección, igual que «No hecha»
      const BD = { hecha: "hecha", medias: "a_medias", no: "no_hecha" };
      await sb.rpc("cerrar_tareas_apoyo_v2", { p_items: todas.map(t => ({ id: t.id, hecha: estado[t.id].estado === "hecha", estado: BD[estado[t.id].estado], justificacion: estado[t.id].estado !== "hecha" ? notaDe(t, estado[t.id]) : null, paqueterias: paqItems(t, estado[t.id]), hora: t.pide_hora && estado[t.id].estado === "hecha" ? estado[t.id].hora : null })) }); // #222
      setHecho(true);
    } catch (e) { setMsg(errorTexto(e)); await cargar(); }
    setSaving(false);
  };

  const segBtn = (activo, tipo) => {
    const col = tipo === "hecha" ? C.grn : tipo === "medias" ? "#C27C0E" : C.red;
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
                const st = estado[t.id] || {}; const done = st.estado === "hecha", no = st.estado === "no", medias = st.estado === "medias";
                return (
                  <div key={t.id} style={{ background: "#fff", border: `1.5px solid ${no ? C.red : medias ? "#C27C0E" : done ? "#BFE6CC" : C.brdL}`, borderRadius: 13, padding: "13px 14px", marginBottom: 9 }}>
                    <div style={{ fontFamily: F, fontSize: 14, color: C.char, fontWeight: 500, marginBottom: 10 }}>{t.texto}
                      {(t.detalle || []).length > 0 && <div style={{ marginTop: 4, fontWeight: 400 }}>{t.detalle.map((x, i) => <div key={i} style={{ fontFamily: F, fontSize: 12.5, color: C.mut, lineHeight: 1.45 }}>{x}</div>)}</div>}{/* #221 */}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => marcarHecha(t)} style={segBtn(done, "hecha")}>Hecha</button>
                      <button onClick={() => setEst(t.id, "medias")} style={segBtn(medias, "medias")}>A medias</button>
                      <button onClick={() => setEst(t.id, "no")} style={segBtn(no, "no")}>No hecha</button>
                    </div>
                    {done && t.pide_hora && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: C.grn, marginBottom: 8 }}>¿A qué hora se limpió?</div>
                        <input type="time" min="07:00" max="23:00" value={st.hora || ""} onChange={e => setHora(t.id, e.target.value)} style={{ boxSizing: "border-box", padding: "9px 12px", background: "#F1F8F3", border: `1px solid ${(st.hora || "") ? "#BFE6CC" : C.red}`, borderRadius: 10, fontFamily: F, fontSize: 15, color: C.char, outline: "none" }} />
                        {!(st.hora || "") && <div style={{ fontFamily: F, fontSize: 11.5, color: C.red, marginTop: 6 }}>Pon la hora a la que se limpió</div>}
                      </div>
                    )}
                    {done && paqDe(t).length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: C.grn, marginBottom: 8 }}>¿Qué paqueterías han venido?</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {paqDe(t).map(n => { const on = (st.paq || {})[n] === "picada"; return <button key={n} onClick={() => setPaq(t.id, n, "picada")} style={{ padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontFamily: F, fontSize: 12.5, fontWeight: 700, border: `1.5px solid ${on ? C.grn : C.brd}`, background: on ? C.grn : "#fff", color: on ? "#fff" : C.char }}>{on ? "✓ " : ""}{n}</button>; })}
                        </div>
                        {paqError(t, st) && <div style={{ fontFamily: F, fontSize: 11.5, color: C.red, marginTop: 6 }}>{paqError(t, st)}</div>}
                      </div>
                    )}
                    {medias && paqDe(t).length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: "#7A4E06", marginBottom: 8, lineHeight: 1.4 }}>Marca cada paquetería. No pasa a nadie: lo verá dirección.</div>
                        {paqDe(t).map(n => (
                          <div key={n} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            <div style={{ width: 62, fontFamily: F, fontSize: 12.5, fontWeight: 600, color: C.char }}>{n}</div>
                            {[["picada", "Picada", C.grn], ["falta", "Falta", "#C27C0E"], ["no_vino", "No vino", C.mut]].map(([v, txt, col]) => { const on = (st.paq || {})[n] === v; return <button key={v} onClick={() => setPaq(t.id, n, v)} style={{ flex: 1, padding: "7px 4px", borderRadius: 9, cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 700, border: `1.5px solid ${on ? col : C.brd}`, background: on ? col : "#fff", color: on ? "#fff" : C.mut }}>{txt}</button>; })}
                          </div>
                        ))}
                        <div style={{ fontFamily: F, fontSize: 12, color: "#7A4E06", marginTop: 4 }}>{paqResumen(t, st)}</div>
                        {paqError(t, st) && <div style={{ fontFamily: F, fontSize: 11.5, color: C.red, marginTop: 6 }}>{paqError(t, st)}</div>}
                      </div>
                    )}
                    {(no || (medias && !paqDe(t).length)) && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: medias ? "#7A4E06" : "#B23A2C", marginBottom: 8, lineHeight: 1.4 }}>{medias ? "¿Por qué se ha quedado a medias y qué falta? No pasa a nadie: lo verá dirección." : "¿Por qué no se ha hecho?"}</div>
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
