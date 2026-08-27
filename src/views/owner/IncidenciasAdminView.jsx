import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, SHADOW } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fmtDia(f) { if (!f) return ""; const p = f.split("-"); const d = new Date(f + "T00:00:00"); return `${DOW[d.getDay()]} ${p[2]}/${p[1]}`; }
function hace(ts) { const d = new Date(ts); const s = Math.floor((Date.now() - d.getTime()) / 1000); if (s < 60) return "ahora"; const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`; const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`; const dd = Math.floor(h / 24); if (dd < 7) return `hace ${dd} d`; return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }); }

const selStyle = { flex: 1, minWidth: 0, border: `1.5px solid ${C.brd}`, borderRadius: 11, padding: "9px 11px", fontFamily: F, fontSize: 13, color: C.char, background: "#fff", outline: "none" };

export function IncidenciasAdminView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fotos, setFotos] = useState({});
  const [periodo, setPeriodo] = useState("30");
  const [fCulpable, setFCulpable] = useState("");
  const [fReporta, setFReporta] = useState("");

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

  const personas = useMemo(() => {
    const m = {};
    items.forEach(x => { if (x.cerrado_por) m[x.cerrado_por] = x.cerrado_por_nombre; if (x.reportado_por) m[x.reportado_por] = x.reportado_por_nombre; });
    return Object.entries(m).map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [items]);

  const enPeriodo = useMemo(() => {
    if (periodo === "todo") return items;
    const dias = periodo === "7" ? 7 : 30;
    const lim = Date.now() - dias * 86400000;
    return items.filter(x => new Date(x.creado_en).getTime() >= lim);
  }, [items, periodo]);

  const ranking = useMemo(() => {
    const m = {};
    enPeriodo.forEach(x => { if (!x.cerrado_por) return; (m[x.cerrado_por] = m[x.cerrado_por] || { nombre: x.cerrado_por_nombre, n: 0 }).n++; });
    return Object.entries(m).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.n - a.n);
  }, [enPeriodo]);

  const filtradas = useMemo(() => enPeriodo.filter(x =>
    (!fCulpable || x.cerrado_por === fCulpable) && (!fReporta || x.reportado_por === fReporta)
  ), [enPeriodo, fCulpable, fReporta]);

  const maxN = ranking.length ? ranking[0].n : 0;

  return (
    <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : items.length === 0 ? <div style={{ fontFamily: SF, fontSize: 16, color: "#1E7A46", textAlign: "center", padding: 30 }}>No hay incidencias ✓</div>
          : <>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[["7", "7 días"], ["30", "30 días"], ["todo", "Todo"]].map(([v, l]) => (
                <button key={v} onClick={() => setPeriodo(v)} style={{ flex: 1, padding: "8px 6px", borderRadius: 10, border: `1.5px solid ${periodo === v ? C.char : C.brd}`, background: periodo === v ? C.char : "#fff", color: periodo === v ? C.gold : C.mut, fontFamily: F, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>
              ))}
            </div>

            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.mutL, marginBottom: 9 }}>Tareas no hechas por persona</div>
            {ranking.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, padding: "4px 0 16px" }}>Sin incidencias en este período.</div>
              : <div style={{ marginBottom: 20 }}>
                {ranking.map(r => {
                  const activo = fCulpable === r.id;
                  return (
                    <button key={r.id} onClick={() => setFCulpable(activo ? "" : r.id)} style={{ width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 10, background: activo ? "#FBEDE9" : "#fff", border: `1px solid ${activo ? "#EDC9C3" : C.brdL}`, borderRadius: 12, padding: "9px 12px", marginBottom: 6, cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.char, width: 118, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nombre}</span>
                      <span style={{ flex: 1, height: 8, background: "#F0EADF", borderRadius: 999, overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${maxN ? Math.round(r.n / maxN * 100) : 0}%`, background: C.red, borderRadius: 999 }} /></span>
                      <span style={{ fontFamily: SF, fontSize: 15, color: C.char, width: 22, textAlign: "right" }}>{r.n}</span>
                    </button>
                  );
                })}
              </div>
            }

            <div style={{ display: "flex", gap: 8 }}>
              <select value={fCulpable} onChange={e => setFCulpable(e.target.value)} style={selStyle}>
                <option value="">Sin hacer: todas</option>
                {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <select value={fReporta} onChange={e => setFReporta(e.target.value)} style={selStyle}>
                <option value="">Reportó: todas</option>
                {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "11px 2px 13px" }}>
              <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>{filtradas.length} incidencia{filtradas.length !== 1 ? "s" : ""}</span>
              {(fCulpable || fReporta) && <button onClick={() => { setFCulpable(""); setFReporta(""); }} style={{ background: "none", border: "none", color: C.blu, fontFamily: F, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Limpiar filtros</button>}
            </div>

            {filtradas.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>No hay incidencias con estos filtros.</div>
              : filtradas.map(it => {
                const f = fotos[it.id];
                return (
                  <div key={it.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 15, marginBottom: 11, boxShadow: SHADOW.card }}>
                    <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char, lineHeight: 1.35 }}>{it.tarea_texto}</div>
                    <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>
                      Turno <b style={{ textTransform: "capitalize" }}>{it.turno}</b> · {fmtDia(it.fecha)}<br />
                      Sin hacer: <b style={{ color: C.red }}>{it.cerrado_por_nombre}</b> · reportó <b>{it.reportado_por_nombre}</b>
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
          </>
      }
    </div>
  );
}
