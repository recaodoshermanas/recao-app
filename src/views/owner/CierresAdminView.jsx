import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, SHADOW, avatar } from "../../lib/styles.js";
import { IcoCheck } from "../../lib/icons.jsx";
import { fmt2 } from "../../lib/utils.js";
import { sb } from "../../lib/supabase.js";
import { ymd } from "../../lib/turnos.js";

const secLbl = { fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mutL, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 2px 12px" };
const sel = { padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${C.brd}`, fontFamily: F, fontSize: 14, background: "#fff", color: C.char, boxSizing: "border-box" };
const dateInp = { flex: 1, padding: "9px 11px", borderRadius: 10, border: `1.5px solid ${C.brd}`, fontFamily: F, fontSize: 13, background: "#fff", color: C.char, boxSizing: "border-box", minWidth: 0 };

function Avatar({ name, size = 36 }) {
  const a = avatar(name);
  return <span style={{ width: size, height: size, borderRadius: "999px", background: a.bg, color: a.fg, fontFamily: SF, fontSize: Math.round(size * 0.42), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.inicial}</span>;
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); }

export function CierresAdminView() {
  const [trab, setTrab] = useState([]);
  const nombreDe = useMemo(() => Object.fromEntries(trab.map(t => [t.id, t.nombre])), [trab]);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState(null);
  const [fUid, setFUid] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    (async () => {
      try { const r = await sb.fn("gestion-usuarios", { action: "listar" }); setTrab((r.usuarios || []).filter(u => u.rol === "trabajadora")); } catch (e) { /* noop */ }
    })();
  }, []);

  const loadCierres = useCallback(async () => {
    setLoading(true);
    try {
      let q = "select=*,items:cierre_items(tarea_texto,hecha,justificacion),caja:cierres_caja(caja1_efectivo,caja1_tarjeta,caja2_efectivo,caja2_tarjeta,tickets:facturas_proveedores(proveedor,importe,caja))&order=fecha.desc,completado_en.desc";
      if (fUid) q += `&usuario_id=eq.${fUid}`;
      if (desde) q += `&fecha=gte.${desde}`;
      if (hasta) q += `&fecha=lte.${hasta}`;
      setCierres(await sb.select("cierres_turno", q));
    } catch (e) { setCierres([]); }
    setLoading(false);
  }, [fUid, desde, hasta]);
  useEffect(() => { loadCierres(); }, [loadCierres]);

  const preset = (dias) => { if (dias === null) { setDesde(""); setHasta(""); } else if (dias === 0) { const h = ymd(new Date()); setDesde(h); setHasta(h); } else { setDesde(addDays(-(dias - 1))); setHasta(ymd(new Date())); } };
  const presetActivo = (dias) => { if (dias === null) return !desde && !hasta; if (dias === 0) return desde === ymd(new Date()) && hasta === ymd(new Date()); return hasta === ymd(new Date()) && desde === addDays(-(dias - 1)); };
  const fmtF = (f) => { const p = f.split("-"); return `${p[2]}/${p[1]}`; };

  const chip = (lab, dias) => {
    const on = presetActivo(dias);
    return <button key={lab} onClick={() => preset(dias)} style={{ fontFamily: F, fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 999, cursor: "pointer", border: on ? `1.5px solid ${C.char}` : `1.5px solid ${C.brd}`, background: on ? C.char : "#fff", color: on ? C.gold : C.mut }}>{lab}</button>;
  };

  const cajaDe = (c) => (c.caja && c.caja[0]) || null;
  const totalCaja = (caja) => {
    if (!caja) return 0;
    const tk = (caja.tickets || []).reduce((s, t) => s + Number(t.importe), 0);
    return Number(caja.caja1_efectivo) + Number(caja.caja1_tarjeta) + Number(caja.caja2_efectivo) + Number(caja.caja2_tarjeta) + tk;
  };

  const lineaCaja = (l, v) => <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontSize: 12.5, color: C.mut, marginBottom: 4 }}><span>{l}</span><span style={{ color: C.char, fontWeight: 600 }}>{fmt2(v)}</span></div>;
  const bloqueCaja = (titulo, ef, ta, tickets) => {
    const t = tickets.reduce((s, x) => s + Number(x.importe), 0);
    const sub = Number(ef) + Number(ta) + t;
    return (
      <div style={{ marginBottom: 11 }}>
        <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.char, marginBottom: 6 }}>{titulo}</div>
        {lineaCaja("Efectivo en sobre", ef)}
        {lineaCaja("Tarjeta", ta)}
        {tickets.map((x, i) => lineaCaja(`Ticket · ${x.proveedor}`, x.importe))}
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontSize: 12.5, color: C.char, fontWeight: 700, marginTop: 4, paddingTop: 5, borderTop: `1px dashed ${C.brdL}` }}><span>Subtotal caja</span><span>{fmt2(sub)}</span></div>
      </div>
    );
  };

  return (
    <div style={{ padding: "16px 14px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 14, marginBottom: 16, boxShadow: SHADOW.card }}>
        <select value={fUid} onChange={e => setFUid(e.target.value)} style={{ ...sel, width: "100%", marginBottom: 10 }}>
          <option value="">Todas las trabajadoras</option>
          {trab.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
          {chip("Hoy", 0)}{chip("7 días", 7)}{chip("30 días", 30)}{chip("Todo", null)}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={dateInp} />
          <span style={{ fontFamily: F, fontSize: 12, color: C.mutL }}>–</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={dateInp} />
        </div>
      </div>

      <div style={secLbl}>Cierres ({cierres.length})</div>
      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Cargando…</div>
        : cierres.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>No hay cierres con estos filtros</div>
        : cierres.map(c => {
          const items = c.items || [];
          const hechas = items.filter(i => i.hecha).length;
          const pend = items.length - hechas;
          const open = abierto === c.id;
          const completo = pend === 0;
          const caja = cajaDe(c);
          const cajaTot = totalCaja(caja);
          const tk1 = caja ? (caja.tickets || []).filter(t => t.caja === 1) : [];
          const tk2 = caja ? (caja.tickets || []).filter(t => t.caja === 2) : [];
          return (
            <div key={c.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 15, marginBottom: 10, boxShadow: SHADOW.card }}>
              <div onClick={() => setAbierto(open ? null : c.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <Avatar name={nombreDe[c.usuario_id]} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{nombreDe[c.usuario_id] || "—"}</div>
                    <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 1, textTransform: "capitalize" }}>{fmtF(c.fecha)} · {c.turno}</div>
                    {caja && <div style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: C.goldDark, marginTop: 2 }}>Caja: {fmt2(cajaTot)}</div>}
                  </div>
                </div>
                <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 999, background: completo ? "#E7F3EC" : "#FBEAE7", color: completo ? "#1E7A46" : "#B23A2C", whiteSpace: "nowrap", flexShrink: 0 }}>{hechas}/{items.length}{completo ? "" : ` · ${pend} sin hacer`}</span>
              </div>
              {open && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.brdL}` }}>
                  {caja && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ ...secLbl, margin: "0 0 8px" }}>Cierre de caja</div>
                      <div style={{ background: "#FBF8F1", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: 13 }}>
                        {bloqueCaja("Caja 1", caja.caja1_efectivo, caja.caja1_tarjeta, tk1)}
                        {bloqueCaja("Caja 2", caja.caja2_efectivo, caja.caja2_tarjeta, tk2)}
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SF, fontSize: 15, color: C.char, borderTop: `1px solid ${C.brdL}`, paddingTop: 9 }}><span>Total del turno</span><span>{fmt2(cajaTot)}</span></div>
                      </div>
                    </div>
                  )}
                  <div style={{ ...secLbl, margin: "0 0 8px" }}>Tareas</div>
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
