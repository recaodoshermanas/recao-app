import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, SHADOW, avatar } from "../../lib/styles.js";
import { IcoCheck } from "../../lib/icons.jsx";
import { sb } from "../../lib/supabase.js";

const secLbl = { fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mutL, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 2px 12px" };

function Avatar({ name, size = 36 }) {
  const a = avatar(name);
  return <span style={{ width: size, height: size, borderRadius: "999px", background: a.bg, color: a.fg, fontFamily: SF, fontSize: Math.round(size * 0.42), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.inicial}</span>;
}

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
    <div style={{ padding: "16px 14px", maxWidth: 640, margin: "0 auto" }}>
      <div style={secLbl}>Cierres de turno</div>
      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Cargando…</div>
        : cierres.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Aún no hay cierres registrados</div>
        : cierres.map(c => {
          const items = c.items || [];
          const hechas = items.filter(i => i.hecha).length;
          const pend = items.length - hechas;
          const open = abierto === c.id;
          const completo = pend === 0;
          return (
            <div key={c.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 15, marginBottom: 10, boxShadow: SHADOW.card }}>
              <div onClick={() => setAbierto(open ? null : c.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <Avatar name={nombreDe[c.usuario_id]} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{nombreDe[c.usuario_id] || "—"}</div>
                    <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 1, textTransform: "capitalize" }}>{fmt(c.fecha)} · {c.turno}</div>
                  </div>
                </div>
                <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 999, background: completo ? "#E7F3EC" : "#FBEAE7", color: completo ? "#1E7A46" : "#B23A2C", whiteSpace: "nowrap", flexShrink: 0 }}>{hechas}/{items.length}{completo ? "" : ` · ${pend} sin hacer`}</span>
              </div>
              {open && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.brdL}` }}>
                  {items.map((it, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", alignItems: "flex-start" }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1, background: it.hecha ? C.grn : "#FBEAE7", display: "flex", alignItems: "center", justifyContent: "center" }}>{it.hecha ? <IcoCheck size={13} color="#fff" sw={3} /> : <span style={{ color: "#B23A2C", fontSize: 12, fontWeight: 700 }}>✕</span>}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: F, fontSize: 13.5, color: C.char }}>{it.tarea_texto}</div>
                        {!it.hecha && it.justificacion && <div style={{ fontFamily: F, fontSize: 12, color: "#B23A2C", marginTop: 2 }}>{it.justificacion}</div>}
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
