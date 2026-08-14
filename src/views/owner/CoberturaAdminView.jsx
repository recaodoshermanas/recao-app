import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, SHADOW, avatar } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { TURNOS, ymd } from "../../lib/turnos.js";
import { huecosCobertura, TURNOS_REQUERIDOS } from "../../lib/cobertura.js";

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fmtDia(f) { const p = f.split("-"); const d = new Date(f + "T00:00:00"); return `${DOW[d.getDay()]} ${p[2]}/${p[1]}`; }
function masDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); }
function nombreCorto(n) { const p = (n || "").trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1].charAt(0)}.` : p[0]; }

function Avatar({ name, size = 26 }) { const a = avatar(name); return <span style={{ width: size, height: size, borderRadius: "999px", background: a.bg, color: a.fg, fontFamily: SF, fontSize: Math.round(size * 0.42), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.inicial}</span>; }
function ShiftChip({ turno }) { const d = TURNOS[turno]; if (!d) return null; return <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: d.bg, color: d.fg }}>{turno}</span>; }

export function CoberturaAdminView() {
  const [trab, setTrab] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState(null);
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await sb.fn("gestion-usuarios", { action: "listar" });
      setTrab((r.usuarios || []).filter(u => u.rol === "trabajadora" && u.activo));
      const hoy = ymd(new Date());
      const rows = await sb.select("horarios", `select=usuario_id,fecha,turno&fecha=gte.${hoy}&fecha=lte.${masDias(60)}`);
      setHorarios(rows);
    } catch (e) { /* noop */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const turnoDe = useMemo(() => { const m = {}; horarios.forEach(h => { m[`${h.usuario_id}|${h.fecha}`] = h.turno; }); return m; }, [horarios]);
  const huecos = useMemo(() => huecosCobertura(horarios), [horarios]);
  const porDia = {}; huecos.forEach(h => { (porDia[h.fecha] = porDia[h.fecha] || []).push(h.turno); });
  const dias = Object.keys(porDia).sort();

  const disponibles = (fecha) => trab.filter(t => { const tu = turnoDe[`${t.id}|${fecha}`]; return !(tu && (TURNOS_REQUERIDOS.includes(tu) || tu === "Vacaciones")); });

  const asignar = async (fecha, turno, uid) => {
    setHorarios(prev => [...prev.filter(h => !(h.usuario_id === uid && h.fecha === fecha)), { usuario_id: uid, fecha, turno }]);
    setOpenKey(null); flash("Turno asignado");
    try { await sb.upsert("horarios", { usuario_id: uid, fecha, turno }, "usuario_id,fecha"); } catch (e) { flash(e.message || "Error"); load(); }
  };

  return (
    <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
      <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginBottom: 16 }}>Días con turnos sin cubrir (por vacaciones u otros huecos). Asigna a alguien que esté de descanso.</div>

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : dias.length === 0 ? <div style={{ fontFamily: SF, fontSize: 16, color: "#1E7A46", textAlign: "center", padding: 30 }}>Todo cubierto ✓</div>
          : dias.map(fecha => (
            <div key={fecha} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 15, marginBottom: 10, boxShadow: SHADOW.card }}>
              <div style={{ fontFamily: SF, fontSize: 16, color: C.char, textTransform: "capitalize" }}>{fmtDia(fecha)}</div>
              {porDia[fecha].map(turno => {
                const key = `${fecha}|${turno}`; const abierto = openKey === key; const disp = disponibles(fecha);
                return (
                  <div key={turno} style={{ borderTop: `1px solid ${C.brdL}`, paddingTop: 11, marginTop: 11 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ShiftChip turno={turno} />
                      <span style={{ fontFamily: F, fontSize: 12.5, color: "#B23A2C", fontWeight: 600 }}>sin cubrir</span>
                      <button onClick={() => setOpenKey(abierto ? null : key)} style={{ marginLeft: "auto", background: abierto ? C.char : C.gold, color: abierto ? C.gold : C.goldDark, border: "none", borderRadius: 10, padding: "8px 15px", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{abierto ? "Cerrar" : "Asignar"}</button>
                    </div>
                    {abierto && (
                      <div style={{ marginTop: 11 }}>
                        {disp.length === 0 ? <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>Nadie libre este día. Puedes gestionarlo en Horarios (mover turnos o añadir una eventual).</div>
                          : <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {disp.map(t => (
                              <button key={t.id} onClick={() => asignar(fecha, turno, t.id)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#FAF7F2", border: `1px solid ${C.brdL}`, borderRadius: 999, padding: "6px 13px 6px 6px", cursor: "pointer" }}>
                                <Avatar name={t.nombre} size={24} />
                                <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char }}>{nombreCorto(t.nombre)}{t.eventual && <span style={{ fontSize: 10, color: C.mutL, marginLeft: 5 }}>eventual</span>}</span>
                              </button>
                            ))}
                          </div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
    </div>
  );
}
