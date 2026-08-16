import { useState, useEffect, useCallback } from "react";
import { F, SF, C } from "../lib/styles.js";
import { sb } from "../lib/supabase.js";

function hace(ts) {
  const d = new Date(ts); const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24); if (dias < 7) return `hace ${dias} d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const IcoBell = ({ color = "#C9C0B0", size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
);

export function NotificacionesBell({ user }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try { const r = await sb.select("notificaciones", "select=*&order=creado_en.desc&limit=50"); setItems(r || []); } catch (e) { /* noop */ }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 45000); return () => clearInterval(t); }, [load]);

  const noLeidas = items.filter(n => !n.leida).length;

  const marcarUna = async (n) => {
    if (n.leida) return;
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x));
    try { await sb.update("notificaciones", `id=eq.${n.id}`, { leida: true }); } catch (e) { /* noop */ }
  };
  const marcarTodas = async () => {
    setItems(prev => prev.map(x => ({ ...x, leida: true })));
    try { await sb.update("notificaciones", `usuario_id=eq.${user.id}&leida=eq.false`, { leida: true }); } catch (e) { /* noop */ }
  };

  return (
    <>
      <button onClick={() => setOpen(o => !o)} style={{ position: "relative", background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
        <IcoBell />
        {noLeidas > 0 && <span style={{ position: "absolute", top: -1, right: -1, minWidth: 16, height: 16, padding: "0 4px", boxSizing: "border-box", borderRadius: 999, background: "#E5484D", color: "#fff", fontFamily: F, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{noLeidas > 9 ? "9+" : noLeidas}</span>}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
          <div style={{ position: "fixed", top: 54, right: 8, width: 340, maxWidth: "92vw", maxHeight: "72vh", overflowY: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.22)", zIndex: 60, border: `1px solid ${C.brdL}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: `1px solid ${C.brdL}`, position: "sticky", top: 0, background: "#fff" }}>
              <span style={{ fontFamily: SF, fontSize: 16, color: C.char }}>Notificaciones</span>
              {noLeidas > 0 && <button onClick={marcarTodas} style={{ background: "none", border: "none", color: C.blu, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Marcar todas</button>}
            </div>
            {items.length === 0 ? (
              <div style={{ padding: "34px 16px", textAlign: "center", fontFamily: F, fontSize: 13, color: C.mut }}>No tienes notificaciones</div>
            ) : items.map(n => (
              <button key={n.id} onClick={() => marcarUna(n)} style={{ width: "100%", boxSizing: "border-box", textAlign: "left", display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 16px", background: n.leida ? "#fff" : "#FBF4E6", border: "none", borderBottom: `1px solid ${C.brdL}`, cursor: "pointer" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: n.leida ? "transparent" : C.gold, marginTop: 6, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: F, fontSize: 13.5, fontWeight: 700, color: C.char }}>{n.titulo}</span>
                  {n.cuerpo && <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2, lineHeight: 1.35 }}>{n.cuerpo}</span>}
                  <span style={{ display: "block", fontFamily: F, fontSize: 11, color: C.mutL, marginTop: 4 }}>{hace(n.creado_en)}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
