import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

export function CierresAdminView() {
  const [trab, setTrab] = useState([]);
  const nombreDe = useMemo(() => Object.fromEntries(trab.map(t => [t.id, t.nombre])), [trab]);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await sb.fn("gestion-usuarios", { action: "listar" });
      setTrab(r.usuarios || []);
      const c = await sb.select("cierres_turno", "select=*,items:cierre_items(tarea_texto,hecha,justificacion)&order=fecha.desc,completado_en.desc");
      setCierres(c);
    } catch (e) { /* noop */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const fmt = (f) => { const p = f.split("-"); return `${p[2]}/${p[1]}`; };

  return (
    <div style={{ padding: "14px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 2px 10px" }}>Cierres de turno</div>
      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Cargando…</div>
        : cierres.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Aún no hay cierres registrados</div>
        : cierres.map(c => {
          const items = c.items || [];
          const hechas = items.filter(i => i.hecha).length;
          const pend = items.length - hechas;
          const open = abierto === c.id;
          return (
            <div key={c.id} style={{ background: "#fff", border: `1px solid ${C.brd}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div onClick={() => setAbierto(open ? null : c.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{nombreDe[c.usuario_id] || "—"}</div>
                  <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2, textTransform: "capitalize" }}>{fmt(c.fecha)} · {c.turno}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: pend > 0 ? C.red : C.grn }}>{hechas}/{items.length}</div>
                  <div style={{ fontFamily: F, fontSize: 11, color: C.mut }}>{pend > 0 ? `${pend} sin hacer` : "completo"}</div>
                </div>
              </div>
              {open && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.brd}` }}>
                  {items.map((it, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", alignItems: "flex-start" }}>
                      <span style={{ color: it.hecha ? C.grn : C.red, fontSize: 14, marginTop: 1 }}>{it.hecha ? "✓" : "✗"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: F, fontSize: 13, color: C.char }}>{it.tarea_texto}</div>
                        {!it.hecha && it.justificacion && <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 2, fontStyle: "italic" }}>{it.justificacion}</div>}
                      </div>
                    </div>
                  ))}
                  {c.notas && <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 8 }}>Notas: {c.notas}</div>}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
