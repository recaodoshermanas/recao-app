import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, avatar, SHADOW, btnDark, inp } from "../../lib/styles.js";
import { IcoLeft, IcoRight } from "../../lib/icons.jsx";
import { sb } from "../../lib/supabase.js";
import { TURNOS, TURNO_OPCIONES, ymd } from "../../lib/turnos.js";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ABBR = { "Mañana": "M", "Tarde": "T", "Apoyo 1": "A1", "Apoyo 2": "A2", "Descanso": "D", "Vacaciones": "V" };
const TRABAJO = ["Mañana", "Tarde", "Apoyo 1", "Apoyo 2"];
const navBtn = { border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 10, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

function lunesDe(d) { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDiaLargo(d) { const dd = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][d.getDay()]; return `${dd} ${d.getDate()} ${MESES_C[d.getMonth()]}`; }

function Avatar({ name, size = 26 }) { const a = avatar(name); return <span style={{ width: size, height: size, borderRadius: "999px", background: a.bg, color: a.fg, fontFamily: SF, fontSize: Math.round(size * 0.42), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.inicial}</span>; }

function PersonaChip({ t, onClick, mut }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, background: mut ? "#fff" : "#FAF7F2", border: `1px solid ${C.brdL}`, borderRadius: 999, padding: "5px 12px 5px 5px", cursor: "pointer" }}>
      <Avatar name={t.nombre} size={mut ? 22 : 26} />
      <span style={{ fontFamily: F, fontSize: mut ? 12 : 13, fontWeight: 600, color: mut ? C.mut : C.char }}>{t.nombre}{t.eventual && <span style={{ fontFamily: F, fontSize: 10, fontWeight: 600, color: C.mutL, marginLeft: 5 }}>eventual</span>}</span>
    </button>
  );
}

export function HorariosAdminView() {
  const [trab, setTrab] = useState([]);
  const nombreDe = useMemo(() => Object.fromEntries(trab.map(t => [t.id, t.nombre])), [trab]);
  const [vista, setVista] = useState("dia");
  const [dia, setDia] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [mapa, setMapa] = useState({});
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null);
  const [addTo, setAddTo] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };

  const semana = useMemo(() => { const ini = lunesDe(dia); return Array.from({ length: 7 }, (_, i) => addDays(ini, i)); }, [dia]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await sb.fn("gestion-usuarios", { action: "listar" });
      setTrab((r.usuarios || []).filter(u => u.rol === "trabajadora" && u.activo));
      const ini = lunesDe(dia), fin = addDays(ini, 6);
      const rows = await sb.select("horarios", `select=usuario_id,fecha,turno&fecha=gte.${ymd(ini)}&fecha=lte.${ymd(fin)}`);
      const m = {}; rows.forEach(x => { m[`${x.usuario_id}|${x.fecha}`] = x.turno; }); setMapa(m);
    } catch (e) { /* noop */ }
    setLoading(false);
  }, [dia]);
  useEffect(() => { load(); }, [load]);

  const aplicarTurno = async (uid, fecha, turno) => {
    setMapa(prev => ({ ...prev, [`${uid}|${fecha}`]: turno }));
    try { await sb.upsert("horarios", { usuario_id: uid, fecha, turno }, "usuario_id,fecha"); } catch (e) { load(); }
  };
  const setTurno = async (uid, fecha, turno) => { setPicker(null); await aplicarTurno(uid, fecha, turno); };
  const quitarTurno = async (uid, fecha) => { setPicker(null); setMapa(prev => { const n = { ...prev }; delete n[`${uid}|${fecha}`]; return n; }); try { await sb.delete("horarios", `usuario_id=eq.${uid}&fecha=eq.${fecha}`); } catch (e) { load(); } };

  const asignarExistente = async (uid) => { const { turno, fecha } = addTo; setAddTo(null); await aplicarTurno(uid, fecha, turno); };
  const crearYAsignar = async () => {
    const nombre = nuevoNombre.trim(); if (!nombre) return;
    setBusy(true);
    try {
      const r = await sb.fn("gestion-usuarios", { action: "crear_eventual", nombre });
      const { turno, fecha } = addTo; setNuevoNombre(""); setAddTo(null);
      await sb.upsert("horarios", { usuario_id: r.usuario.id, fecha, turno }, "usuario_id,fecha");
      await load();
    } catch (e) { flash(e.message || "Error"); }
    setBusy(false);
  };

  const hoyStr = ymd(new Date());
  const esHoy = ymd(dia) === hoyStr;
  const fechaDia = ymd(dia);

  const porTurno = {}; TURNO_OPCIONES.forEach(t => { porTurno[t] = []; });
  const sinAsignar = [];
  trab.forEach(t => { const tu = mapa[`${t.id}|${fechaDia}`]; if (tu && porTurno[tu]) porTurno[tu].push(t); else if (!t.eventual) sinAsignar.push(t); });

  const filasSemana = [...trab.filter(t => !t.eventual), ...trab.filter(t => t.eventual && semana.some(d => mapa[`${t.id}|${ymd(d)}`]))];
  const eventualesLibres = addTo ? trab.filter(t => t.eventual && mapa[`${t.id}|${addTo.fecha}`] !== addTo.turno) : [];

  return (
    <div style={{ padding: "14px", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, background: "#F0EBE1", padding: 4, borderRadius: 13, marginBottom: 14 }}>
        {[["dia", "Día"], ["semana", "Semana"]].map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)} style={{ flex: 1, textAlign: "center", padding: 9, borderRadius: 10, border: "none", cursor: "pointer", background: vista === v ? C.char : "transparent", color: vista === v ? C.gold : C.mut, fontFamily: F, fontWeight: 600, fontSize: 14 }}>{l}</button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={() => setDia(d => addDays(d, vista === "dia" ? -1 : -7))} style={navBtn}><IcoLeft size={18} color={C.char} sw={2.2} /></button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: SF, fontSize: 18, color: C.char, textTransform: "capitalize" }}>{vista === "dia" ? fmtDiaLargo(dia) : `${semana[0].getDate()} ${MESES_C[semana[0].getMonth()]} – ${semana[6].getDate()} ${MESES_C[semana[6].getMonth()]}`}</div>
          {!esHoy && <button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setDia(d); }} style={{ marginTop: 3, background: "none", border: "none", color: C.blu, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Ir a hoy</button>}
        </div>
        <button onClick={() => setDia(d => addDays(d, vista === "dia" ? 1 : 7))} style={navBtn}><IcoRight size={18} color={C.char} sw={2.2} /></button>
      </div>

      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : vista === "dia" ? (
          <div>
            {TRABAJO.map(tk => { const def = TURNOS[tk]; const gente = porTurno[tk]; return (
              <div key={tk} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: SHADOW.card }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 5, background: def.bg }} />
                  <span style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{def.label}</span>
                  <span style={{ fontFamily: F, fontSize: 12, color: C.mutL, marginLeft: "auto" }}>{def.horas}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {gente.map(g => <PersonaChip key={g.id} t={g} onClick={() => setPicker({ uid: g.id, fecha: fechaDia })} />)}
                  <button onClick={() => { setAddTo({ turno: tk, fecha: fechaDia }); setNuevoNombre(""); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1.5px dashed ${C.brd}`, borderRadius: 999, padding: "7px 14px", cursor: "pointer", color: C.mut, fontFamily: F, fontSize: 12.5, fontWeight: 600 }}>+ Añadir</button>
                </div>
              </div>
            ); })}

            {(porTurno["Descanso"].length + porTurno["Vacaciones"].length + sinAsignar.length) > 0 && (
              <div style={{ marginTop: 4 }}>
                {[["Descanso", porTurno["Descanso"]], ["Vacaciones", porTurno["Vacaciones"]], ["Sin asignar", sinAsignar]].map(([lab, gente]) => gente.length === 0 ? null : (
                  <div key={lab} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.mutL, minWidth: 74 }}>{lab}</span>
                    {gente.map(g => <PersonaChip key={g.id} t={g} mut onClick={() => setPicker({ uid: g.id, fecha: fechaDia })} />)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 520 }}>
              <div style={{ display: "grid", gridTemplateColumns: "84px repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                <div />
                {semana.map((d, i) => { const es = ymd(d) === hoyStr; return (
                  <div key={i} style={{ textAlign: "center", fontFamily: F, fontSize: 11, fontWeight: 700, color: es ? C.char : C.mutL }}>
                    <div>{DIAS[i]}</div>
                    <div style={{ fontSize: 12 }}>{d.getDate()}</div>
                  </div>
                ); })}
              </div>
              {filasSemana.map(t => (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "84px repeat(7, 1fr)", gap: 4, marginBottom: 4, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <Avatar name={t.nombre} size={24} />
                    <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: t.eventual ? C.mut : C.char, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.nombre.split(" ")[0]}</span>
                  </div>
                  {semana.map((d, i) => { const f = ymd(d); const tu = mapa[`${t.id}|${f}`]; const def = tu ? TURNOS[tu] : null; return (
                    <button key={i} onClick={() => setPicker({ uid: t.id, fecha: f })} title={def ? def.label : ""} style={{ height: 38, borderRadius: 9, border: `1px solid ${def ? "transparent" : C.brdL}`, background: def ? def.bg : "#fff", color: def ? def.fg : C.mutL, cursor: "pointer", fontFamily: F, fontSize: 11, fontWeight: 700 }}>{def ? ABBR[tu] : ""}</button>
                  ); })}
                </div>
              ))}
            </div>
          </div>
        )}

      {picker && (
        <div onClick={() => setPicker(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 680 }}>
            <div style={{ fontFamily: SF, fontSize: 17, color: C.char }}>{nombreDe[picker.uid]}</div>
            <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginBottom: 14 }}>{picker.fecha.split("-").reverse().join("/")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 9 }}>
              {TURNO_OPCIONES.map(t => { const def = TURNOS[t]; return (
                <button key={t} onClick={() => setTurno(picker.uid, picker.fecha, t)} style={{ padding: 13, borderRadius: 13, border: `1px solid ${C.brdL}`, background: def.bg, color: def.fg, fontFamily: F, fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                  {def.label}{def.horas ? <div style={{ fontSize: 10.5, fontWeight: 400, marginTop: 2 }}>{def.horas}</div> : null}
                </button>
              ); })}
            </div>
            <button onClick={() => quitarTurno(picker.uid, picker.fecha)} style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, border: `1.5px solid ${C.brd}`, background: "#fff", color: C.mut, fontFamily: F, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Quitar turno</button>
          </div>
        </div>
      )}

      {addTo && (
        <div onClick={() => setAddTo(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 680 }}>
            <div style={{ fontFamily: SF, fontSize: 17, color: C.char }}>Añadir a {TURNOS[addTo.turno].label}</div>
            <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginBottom: 16 }}>{addTo.fecha.split("-").reverse().join("/")}</div>
            {eventualesLibres.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 8 }}>Personas eventuales</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {eventualesLibres.map(t => <PersonaChip key={t.id} t={t} onClick={() => asignarExistente(t.id)} />)}
                </div>
              </div>
            )}
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 8 }}>Nueva persona (sin cuenta)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} onKeyDown={e => { if (e.key === "Enter") crearYAsignar(); }} placeholder="Nombre" style={{ ...inp, flex: 1 }} />
              <button onClick={crearYAsignar} disabled={busy || !nuevoNombre.trim()} style={{ ...btnDark, width: "auto", padding: "0 20px", fontSize: 15, opacity: busy || !nuevoNombre.trim() ? 0.6 : 1 }}>Añadir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
