import { useState, useEffect, useCallback } from "react";
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fmtDia(f) { if (!f) return ""; const p = f.split("-"); const d = new Date(f + "T00:00:00"); return `${DOW[d.getDay()]} ${p[2]}/${p[1]}`; }
function hace(ts) { const d = new Date(ts); const s = Math.floor((Date.now() - d.getTime()) / 1000); if (s < 60) return "ahora"; const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`; const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`; const dd = Math.floor(h / 24); if (dd < 7) return `hace ${dd} d`; return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }); }

export function IncidenciasAdminView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fotos, setFotos] = useState({});
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await sb.fn("incidencias", { action: "listar" }); setItems(r.incidencias || []); } catch (e) { /* noop */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const verFoto = async (id) => {
    setFotos(p => ({ ...p, [id]: "loading" }));
    try { const r = await sb.fn("incidencias", { action: "detalle", id }); setFotos(p => ({ ...p, [id]: r.foto || null })); }
    catch (e) { setFotos(p => ({ ...p, [id]: null })); }
  };

  return (
    <div style={{ padding: "16px", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginBottom: 16 }}>Tareas que una trabajadora reportó como no hechas del turno anterior.</div>
      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : items.length === 0 ? <div style={{ fontFamily: SF, fontSize: 16, color: "#1E7A46", textAlign: "center", padding: 30 }}>No hay incidencias ✓</div>
          : items.map(it => {
            const f = fotos[it.id];
            return (
              <div key={it.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 15, marginBottom: 11, boxShadow: SHADOW.card }}>
                <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char, lineHeight: 1.35 }}>{it.tarea_texto}</div>
                <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>
                  Turno <b style={{ textTransform: "capitalize" }}>{it.turno}</b> · {fmtDia(it.fecha)}<br />
                  Cerrado por <b>{it.cerrado_por_nombre}</b> · reportado por <b>{it.reportado_por_nombre}</b>
                </div>
                {it.comentario && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: "#FAF7F2", borderRadius: 10, padding: "9px 12px", marginTop: 10, fontStyle: "italic" }}>“{it.comentario}”</div>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                  <span style={{ fontFamily: F, fontSize: 11, color: C.mutL }}>{hace(it.creado_en)}</span>
                  {f === undefined && <button onClick={() => verFoto(it.id)} style={{ background: C.char, color: C.gold, border: "none", borderRadius: 9, padding: "7px 14px", fontFamily: F, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Ver foto</button>}
                  {f === "loading" && <span style={{ fontFamily: F, fontSize: 12, color: C.mut }}>Cargando…</span>}
                  {f === null && <span style={{ fontFamily: F, fontSize: 12, color: C.mutL }}>Sin foto</span>}
                </div>
                {f && f !== "loading" && <img src={f} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 10, display: "block" }} />}
              </div>
            );
          })}
    </div>
  );
}
