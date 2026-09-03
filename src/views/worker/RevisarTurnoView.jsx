import { useState, useEffect, useCallback } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fmtDia(f) { if (!f) return ""; const p = f.split("-"); const d = new Date(f + "T00:00:00"); return `${DOW[d.getDay()]} ${p[2]}/${p[1]}`; }

function comprimir(file, maxSide = 1200, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w >= h && w > maxSide) { h = Math.round(h * maxSide / w); w = maxSide; }
      else if (h > maxSide) { w = Math.round(w * maxSide / h); h = maxSide; }
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject; img.src = url;
  });
}

export function RevisarTurnoView({ user }) {
  const [cierre, setCierre] = useState(null);
  const [yaVerif, setYaVerif] = useState(false);
  const [completadas, setCompletadas] = useState([]);
  const [noCompletadas, setNoCompletadas] = useState([]);
  const [reportadas, setReportadas] = useState([]);
  const [marcadas, setMarcadas] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3200); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await sb.fn("incidencias", { action: "turno_anterior" });
      setCierre(r.cierre || null);
      setYaVerif(!!r.ya_verificado);
      setCompletadas(r.completadas || []);
      setNoCompletadas(r.no_completadas || []);
      setReportadas(r.reportadas || []);
      setMarcadas({});
    } catch (e) { /* noop */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setMarcadas(m => { const c = { ...m }; if (c[id]) delete c[id]; else c[id] = { comentario: "", foto: null }; return c; });
  const setCom = (id, v) => setMarcadas(m => ({ ...m, [id]: { ...m[id], comentario: v } }));
  const onFoto = async (id, e) => { const f = e.target.files && e.target.files[0]; if (!f) return; try { const d = await comprimir(f); setMarcadas(m => ({ ...m, [id]: { ...m[id], foto: d } })); } catch { flash("No se pudo procesar la foto"); } };

  const nMarcadas = Object.keys(marcadas).length;
  const pedirEnviar = () => {
    if (Object.values(marcadas).some(v => !v.foto)) { flash("Cada tarea marcada como no conforme necesita una foto"); return; }
    setConfirmar(true);
  };
  const enviar = async () => {
    setBusy(true);
    try {
      const noconformes = Object.entries(marcadas).map(([id, v]) => ({ cierre_item_id: Number(id), comentario: (v.comentario || "").trim() || null, foto: v.foto }));
      await sb.fn("incidencias", { action: "verificar", cierre_id: cierre.id, noconformes });
      setConfirmar(false);
      flash("Verificación enviada. Dirección lo revisará.");
      await load();
    } catch (e) { setConfirmar(false); flash(e.message || "No se pudo enviar"); }
    setBusy(false);
  };

  const cab = cierre && (
    <div style={{ background: C.char, borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gold }}>Turno anterior</div>
      <div style={{ fontFamily: SF, fontSize: 18, color: "#fff", marginTop: 3, textTransform: "capitalize" }}>{cierre.turno} · {fmtDia(cierre.fecha)}</div>
      <div style={{ fontFamily: F, fontSize: 12.5, color: "#C9C0B0", marginTop: 2 }}>Cerrado por {cierre.nombre}</div>
    </div>
  );

  const seccionNoCompletadas = noCompletadas.length > 0 && (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.mutL, marginBottom: 8 }}>El turno anterior dejó sin hacer</div>
      {noCompletadas.map(it => (
        <div key={it.id} style={{ background: "#F7F4EE", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "11px 13px", marginBottom: 8 }}>
          <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut }}>{it.texto}</div>
          {it.justificacion && <div style={{ fontFamily: F, fontSize: 12, color: C.mutL, marginTop: 3, fontStyle: "italic" }}>“{it.justificacion}”</div>}
        </div>
      ))}
      <div style={{ fontFamily: F, fontSize: 11.5, color: C.mutL, marginTop: 2 }}>Estas ya constan como no hechas. No se verifican.</div>
    </div>
  );

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : !cierre ? <div style={{ fontFamily: F, fontSize: 14, color: C.mut, textAlign: "center", padding: 30 }}>No hay ningún turno anterior reciente para revisar.</div>
          : yaVerif ? (
            <div>
              {cab}
              <div style={{ background: "#E7F3EC", color: "#1E7A46", fontFamily: SF, fontSize: 16, borderRadius: 14, padding: 14, marginBottom: 14, textAlign: "center" }}>Verificación enviada ✓</div>
              {reportadas.length > 0 ? (
                <div>
                  <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.mutL, marginBottom: 8 }}>Marcaste como no conformes</div>
                  {reportadas.map((x, i) => {
                    const t = completadas.find(c => c.id === x.cierre_item_id);
                    return (
                      <div key={i} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "11px 13px", marginBottom: 8 }}>
                        <div style={{ fontFamily: F, fontSize: 13.5, color: C.char }}>{t ? t.texto : "Tarea"}</div>
                        {x.comentario && <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 3 }}>{x.comentario}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 8 }}>No marcaste ninguna tarea como no conforme.</div>}
              {seccionNoCompletadas}
            </div>
          ) : (
            <div>
              {cab}
              <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginBottom: 14, lineHeight: 1.4 }}>Estas tareas se marcaron como <b>hechas</b>. Si alguna no estaba hecha de verdad, márcala como no conforme y adjunta una foto. Cuando termines, envía la verificación.</div>
              {completadas.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 16 }}>El turno anterior no marcó ninguna tarea como hecha.</div>
                : completadas.map(it => {
                  const mk = marcadas[it.id];
                  return (
                    <div key={it.id} style={{ background: "#fff", border: `1.5px solid ${mk ? C.red : C.brdL}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                      <div style={{ fontFamily: F, fontSize: 14, color: C.char, lineHeight: 1.35 }}>{it.texto}</div>
                      {!mk ? (
                        <button onClick={() => toggle(it.id)} style={{ marginTop: 10, background: "#FBEDE9", color: C.red, border: "none", borderRadius: 10, padding: "8px 14px", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>No estaba hecha</button>
                      ) : (
                        <div style={{ marginTop: 12 }}>
                          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `1.5px dashed ${mk.foto ? C.grn : C.red}`, borderRadius: 12, padding: mk.foto ? 8 : 14, cursor: "pointer", marginBottom: 10 }}>
                            {mk.foto ? <img src={mk.foto} alt="" style={{ maxHeight: 160, maxWidth: "100%", borderRadius: 8, display: "block" }} />
                              : <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: C.red }}>Foto obligatoria · toca para hacerla</span>}
                            <input type="file" accept="image/*" capture="environment" onChange={e => onFoto(it.id, e)} style={{ display: "none" }} />
                          </label>
                          <textarea value={mk.comentario} onChange={e => setCom(it.id, e.target.value)} placeholder="Comentario (opcional)" rows={2} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: "10px 12px", fontFamily: F, fontSize: 14, color: C.char, outline: "none", resize: "vertical", marginBottom: 8 }} />
                          <button onClick={() => toggle(it.id)} style={{ background: "none", border: "none", color: C.mut, fontFamily: F, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>Quitar marca</button>
                        </div>
                      )}
                    </div>
                  );
                })}

              {seccionNoCompletadas}

              <button onClick={pedirEnviar} disabled={completadas.length === 0} style={{ width: "100%", boxSizing: "border-box", marginTop: 18, background: C.char, color: C.gold, border: "none", borderRadius: 13, padding: 15, fontFamily: SF, fontSize: 16, cursor: "pointer", opacity: completadas.length === 0 ? 0.5 : 1 }}>
                {nMarcadas > 0 ? `Enviar verificación · ${nMarcadas} no conforme${nMarcadas > 1 ? "s" : ""}` : "Enviar verificación · todo conforme"}
              </button>
            </div>
          )}

      {confirmar && (
        <div onClick={() => setConfirmar(false)} style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.cream, width: "100%", maxWidth: 540, borderRadius: "20px 20px 0 0", padding: "18px 18px 24px" }}>
            <div style={{ width: 40, height: 4, background: C.brd, borderRadius: 999, margin: "0 auto 16px" }} />
            <div style={{ fontFamily: SF, fontSize: 20, color: C.char, marginBottom: 6 }}>Enviar verificación</div>
            <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut, marginBottom: 16, lineHeight: 1.45 }}>
              {nMarcadas > 0
                ? `Vas a marcar ${nMarcadas} tarea${nMarcadas > 1 ? "s" : ""} como no conforme${nMarcadas > 1 ? "s" : ""}, con su foto. `
                : "No has marcado ninguna tarea como no conforme. "}
              Una vez enviada, la verificación <b>no se puede modificar</b>.
            </div>
            <button onClick={enviar} disabled={busy} style={{ width: "100%", boxSizing: "border-box", background: C.char, color: C.gold, border: "none", borderRadius: 13, padding: 15, fontFamily: SF, fontSize: 16, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>{busy ? "Enviando…" : "Enviar verificación"}</button>
            <button onClick={() => setConfirmar(false)} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: C.mut, fontFamily: F, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
