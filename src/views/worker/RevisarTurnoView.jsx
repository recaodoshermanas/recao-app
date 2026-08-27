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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openItem, setOpenItem] = useState(null);
  const [foto, setFoto] = useState(null);
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await sb.fn("incidencias", { action: "turno_anterior" }); setCierre(r.cierre || null); setItems(r.items || []); }
    catch (e) { /* noop */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const abrir = (id) => { setOpenItem(id); setFoto(null); setComentario(""); };
  const onFoto = async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; try { setFoto(await comprimir(f)); } catch { flash("No se pudo procesar la foto"); } };
  const reportar = async (id) => {
    setBusy(true);
    try {
      await sb.fn("incidencias", { action: "reportar", cierre_item_id: id, comentario: comentario.trim() || null, foto: foto || null });
      setItems(prev => prev.map(x => x.id === id ? { ...x, reportada: true } : x));
      setOpenItem(null); setFoto(null); setComentario(""); flash("Reportado. Dirección lo verá.");
    } catch (e) { flash(e.message || "Error"); }
    setBusy(false);
  };

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : !cierre ? <div style={{ fontFamily: F, fontSize: 14, color: C.mut, textAlign: "center", padding: 30 }}>No hay ningún turno anterior reciente para revisar.</div>
          : <>
            <div style={{ background: C.char, borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gold }}>Turno anterior</div>
              <div style={{ fontFamily: SF, fontSize: 18, color: "#fff", marginTop: 3, textTransform: "capitalize" }}>{cierre.turno} · {fmtDia(cierre.fecha)}</div>
              <div style={{ fontFamily: F, fontSize: 12.5, color: "#C9C0B0", marginTop: 2 }}>Cerrado por {cierre.nombre}</div>
            </div>
            <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginBottom: 14, lineHeight: 1.4 }}>Estas tareas se marcaron como hechas. Si alguna no estaba hecha de verdad, repórtalo (puedes añadir una foto como prueba).</div>
            {items.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>El turno anterior no marcó ninguna tarea.</div>
              : items.map(it => (
                <div key={it.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontFamily: F, fontSize: 14, color: C.char, lineHeight: 1.35 }}>{it.texto}</div>
                  {it.reportada ? (
                    <div style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: C.red, marginTop: 10 }}>Reportada ✓</div>
                  ) : openItem === it.id ? (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `1.5px dashed ${C.brd}`, borderRadius: 12, padding: foto ? 8 : 14, cursor: "pointer", marginBottom: 10 }}>
                        {foto ? <img src={foto} alt="" style={{ maxHeight: 160, maxWidth: "100%", borderRadius: 8, display: "block" }} />
                          : <span style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Añadir foto (opcional)</span>}
                        <input type="file" accept="image/*" capture="environment" onChange={onFoto} style={{ display: "none" }} />
                      </label>
                      <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="¿Qué pasó? (opcional)" rows={2} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: "10px 12px", fontFamily: F, fontSize: 14, color: C.char, outline: "none", resize: "vertical", marginBottom: 10 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => reportar(it.id)} disabled={busy} style={{ flex: 1, background: C.red, color: "#fff", border: "none", borderRadius: 11, padding: 12, fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Enviando…" : "Reportar"}</button>
                        <button onClick={() => setOpenItem(null)} style={{ background: "#fff", color: C.mut, border: `1.5px solid ${C.brd}`, borderRadius: 11, padding: "12px 16px", fontFamily: F, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => abrir(it.id)} style={{ marginTop: 10, background: "#FBEDE9", color: C.red, border: "none", borderRadius: 10, padding: "8px 14px", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>No estaba hecha</button>
                  )}
                </div>
              ))}
          </>
      }
    </div>
  );
}
